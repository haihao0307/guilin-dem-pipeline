from __future__ import annotations

import argparse
import contextlib
import math
import os
import sys
import traceback
import warnings
from pathlib import Path
from typing import Any, Iterator

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.fill import fillnodata
from rasterio.shutil import copy as rio_copy
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds
from rasterio.windows import Window, bounds as window_bounds, transform as window_transform
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform as shapely_transform

from common import read_json, sha256_file, utc_now, write_json


class PipelineError(RuntimeError):
    pass


def is_dem_name(name: str) -> bool:
    lower = name.lower()
    return lower.endswith(".dem.tif") or lower.endswith("_dem.tif")


def aligned_grid(bounds: tuple[float, float, float, float], resolution: float) -> tuple[Any, int, int, tuple[float, float, float, float]]:
    minx, miny, maxx, maxy = bounds
    aligned_minx = math.floor(minx / resolution) * resolution
    aligned_miny = math.floor(miny / resolution) * resolution
    aligned_maxx = math.ceil(maxx / resolution) * resolution
    aligned_maxy = math.ceil(maxy / resolution) * resolution
    width = int(round((aligned_maxx - aligned_minx) / resolution))
    height = int(round((aligned_maxy - aligned_miny) / resolution))
    transform = from_origin(aligned_minx, aligned_maxy, resolution, resolution)
    return transform, width, height, (aligned_minx, aligned_miny, aligned_maxx, aligned_maxy)


def iter_windows(width: int, height: int, block_size: int) -> Iterator[Window]:
    for row in range(0, height, block_size):
        for col in range(0, width, block_size):
            yield Window(col, row, min(block_size, width - col), min(block_size, height - row))


def intersects(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return not (a[2] <= b[0] or a[0] >= b[2] or a[3] <= b[1] or a[1] >= b[3])


def locate_sources(config: dict[str, Any], root: Path) -> tuple[list[Path], dict[str, Any]]:
    existing_path = root / config["outputs"]["existingResolved"]
    existing = read_json(existing_path) if existing_path.exists() else {"status": "not_scanned", "files": []}

    source_paths: list[Path] = []
    source_records: list[dict[str, Any]] = []
    resolved_set: set[Path] = set()
    for entry in existing.get("files", []):
        path = Path(str(entry.get("resolvedPath", "")))
        if not path.is_file():
            continue
        resolved = path.resolve()
        if resolved in resolved_set:
            continue
        resolved_set.add(resolved)
        source_paths.append(resolved)
        source_records.append({"role": "reused_existing", **entry})

    raw_dem_dir = root / "data" / "raw" / "dem"
    for path in sorted(raw_dem_dir.glob("*")):
        if not path.is_file() or not is_dem_name(path.name):
            continue
        resolved = path.resolve()
        if resolved in resolved_set:
            continue
        resolved_set.add(resolved)
        source_paths.append(resolved)
        source_records.append(
            {
                "role": "downloaded_or_fallback_source",
                "file": path.name,
                "resolvedPath": str(resolved),
                "bytes": path.stat().st_size,
            }
        )

    if not source_paths:
        raise PipelineError("No DEM source rasters were found")
    return source_paths, {"existingScanStatus": existing.get("status"), "files": source_records}


def inspect_sources(source_paths: list[Path], target_crs: str) -> list[dict[str, Any]]:
    inspections: list[dict[str, Any]] = []
    for path in source_paths:
        with rasterio.open(path) as dataset:
            if dataset.count < 1:
                raise PipelineError(f"DEM has no raster bands: {path}")
            if dataset.crs is None:
                raise PipelineError(f"DEM has no CRS: {path}")
            target_bounds = transform_bounds(dataset.crs, target_crs, *dataset.bounds, densify_pts=21)
            inspections.append(
                {
                    "file": str(path),
                    "name": path.name,
                    "bytes": path.stat().st_size,
                    "driver": dataset.driver,
                    "width": dataset.width,
                    "height": dataset.height,
                    "dtype": dataset.dtypes[0],
                    "nodata": dataset.nodata,
                    "crs": dataset.crs.to_string(),
                    "resolution": [abs(dataset.transform.a), abs(dataset.transform.e)],
                    "bounds": list(dataset.bounds),
                    "targetBounds": list(target_bounds),
                }
            )
    return inspections


def create_profile(
    crs: str,
    transform: Any,
    width: int,
    height: int,
    dtype: str,
    nodata: float | int,
    block_size: int,
    predictor: int,
) -> dict[str, Any]:
    return {
        "driver": "GTiff",
        "width": width,
        "height": height,
        "count": 1,
        "dtype": dtype,
        "crs": crs,
        "transform": transform,
        "nodata": nodata,
        "tiled": True,
        "blockxsize": block_size,
        "blockysize": block_size,
        "compress": "DEFLATE",
        "predictor": predictor,
        "BIGTIFF": "YES",
        "interleave": "band",
    }


def write_raw_mosaic(
    source_paths: list[Path],
    inspections: list[dict[str, Any]],
    polygon_utm: Polygon,
    crs: str,
    transform: Any,
    width: int,
    height: int,
    resolution: float,
    nodata: float,
    block_size: int,
    raw_path: Path,
    count_path: Path,
    fill_path: Path,
) -> None:
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_profile = create_profile(crs, transform, width, height, "float32", nodata, block_size, 3)
    count_profile = create_profile(crs, transform, width, height, "uint8", 0, block_size, 2)
    fill_profile = create_profile(crs, transform, width, height, "uint8", 255, block_size, 2)
    polygon_geojson = [mapping(polygon_utm)]

    with contextlib.ExitStack() as stack:
        sources = [stack.enter_context(rasterio.open(path)) for path in source_paths]
        vrts = []
        for source in sources:
            source_nodata = source.nodata
            if source_nodata is None:
                source_nodata = 0.0
            vrts.append(
                stack.enter_context(
                    WarpedVRT(
                        source,
                        crs=crs,
                        transform=transform,
                        width=width,
                        height=height,
                        src_nodata=source_nodata,
                        nodata=nodata,
                        dtype="float32",
                        resampling=Resampling.bilinear,
                    )
                )
            )
        raw_dataset = stack.enter_context(rasterio.open(raw_path, "w", **raw_profile))
        count_dataset = stack.enter_context(rasterio.open(count_path, "w", **count_profile))
        fill_dataset = stack.enter_context(rasterio.open(fill_path, "w", **fill_profile))

        total_windows = math.ceil(width / block_size) * math.ceil(height / block_size)
        for index, window in enumerate(iter_windows(width, height, block_size), start=1):
            h, w = int(window.height), int(window.width)
            win_bounds = window_bounds(window, transform)
            inside = geometry_mask(
                polygon_geojson,
                out_shape=(h, w),
                transform=window_transform(window, transform),
                invert=True,
                all_touched=False,
            )
            source_arrays: list[np.ndarray] = []
            for vrt, inspection in zip(vrts, inspections):
                if not intersects(win_bounds, tuple(inspection["targetBounds"])):
                    continue
                array = vrt.read(1, window=window, masked=True, out_dtype="float32")
                values = array.filled(np.nan)
                values[values == nodata] = np.nan
                if np.isfinite(values).any():
                    source_arrays.append(values)

            if source_arrays:
                stack_array = np.stack(source_arrays, axis=0)
                valid_count = np.sum(np.isfinite(stack_array), axis=0).astype(np.uint8)
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", message="All-NaN slice encountered", category=RuntimeWarning)
                    with np.errstate(all="ignore"):
                        median = np.nanmedian(stack_array, axis=0).astype(np.float32)
                median[~np.isfinite(median)] = nodata
            else:
                valid_count = np.zeros((h, w), dtype=np.uint8)
                median = np.full((h, w), nodata, dtype=np.float32)

            median[~inside] = nodata
            valid_count[~inside] = 0
            fill_class = np.full((h, w), 255, dtype=np.uint8)
            fill_class[inside & (median != nodata)] = 0
            fill_class[inside & (median == nodata)] = 2

            raw_dataset.write(median, 1, window=window)
            count_dataset.write(valid_count, 1, window=window)
            fill_dataset.write(fill_class, 1, window=window)
            if index == 1 or index % 40 == 0 or index == total_windows:
                print(f"拼接块进度：{index}/{total_windows}")


def scan_coverage(path: Path, polygon_utm: Polygon, block_size: int, nodata: float) -> dict[str, Any]:
    inside_pixels = 0
    valid_pixels = 0
    gap_pixels = 0
    minimum = math.inf
    maximum = -math.inf
    total = 0.0
    total_sq = 0.0
    polygon_geojson = [mapping(polygon_utm)]

    with rasterio.open(path) as dataset:
        for window in iter_windows(dataset.width, dataset.height, block_size):
            h, w = int(window.height), int(window.width)
            inside = geometry_mask(
                polygon_geojson,
                out_shape=(h, w),
                transform=window_transform(window, dataset.transform),
                invert=True,
                all_touched=False,
            )
            array = dataset.read(1, window=window)
            valid = inside & np.isfinite(array) & (array != nodata)
            gaps = inside & ~valid
            inside_count = int(np.count_nonzero(inside))
            valid_count = int(np.count_nonzero(valid))
            inside_pixels += inside_count
            valid_pixels += valid_count
            gap_pixels += int(np.count_nonzero(gaps))
            if valid_count:
                values = array[valid].astype(np.float64)
                minimum = min(minimum, float(values.min()))
                maximum = max(maximum, float(values.max()))
                total += float(values.sum())
                total_sq += float(np.square(values).sum())

        mean = total / valid_pixels if valid_pixels else math.nan
        variance = max(total_sq / valid_pixels - mean * mean, 0.0) if valid_pixels else math.nan
        return {
            "insidePixels": inside_pixels,
            "validPixels": valid_pixels,
            "gapPixels": gap_pixels,
            "validFraction": valid_pixels / inside_pixels if inside_pixels else 0.0,
            "min": minimum if valid_pixels else None,
            "max": maximum if valid_pixels else None,
            "mean": mean if valid_pixels else None,
            "std": math.sqrt(variance) if valid_pixels else None,
            "width": dataset.width,
            "height": dataset.height,
            "bounds": list(dataset.bounds),
            "resolution": [abs(dataset.transform.a), abs(dataset.transform.e)],
            "crs": dataset.crs.to_string() if dataset.crs else None,
        }


def copy_raster_blocks(source_path: Path, target_path: Path, profile: dict[str, Any], block_size: int) -> None:
    with rasterio.open(source_path) as source, rasterio.open(target_path, "w", **profile) as target:
        for window in iter_windows(source.width, source.height, block_size):
            target.write(source.read(1, window=window), 1, window=window)
        target.update_tags(**source.tags())


def fill_small_gaps_blockwise(
    raw_path: Path,
    initial_fill_path: Path,
    final_temp_path: Path,
    fill_temp_path: Path,
    polygon_utm: Polygon,
    nodata: float,
    block_size: int,
    max_search_distance: int,
) -> dict[str, int]:
    polygon_geojson = [mapping(polygon_utm)]
    filled_pixels = 0
    unresolved_pixels = 0

    with rasterio.open(raw_path) as raw, rasterio.open(initial_fill_path) as initial_fill:
        final_profile = raw.profile.copy()
        fill_profile = initial_fill.profile.copy()
        with rasterio.open(final_temp_path, "w", **final_profile) as final, rasterio.open(fill_temp_path, "w", **fill_profile) as fill_output:
            total_windows = math.ceil(raw.width / block_size) * math.ceil(raw.height / block_size)
            for index, window in enumerate(iter_windows(raw.width, raw.height, block_size), start=1):
                h, w = int(window.height), int(window.width)
                center = raw.read(1, window=window)
                fill_class = initial_fill.read(1, window=window)
                gaps_center = fill_class == 2

                if np.any(gaps_center):
                    row0 = max(0, int(window.row_off) - max_search_distance)
                    col0 = max(0, int(window.col_off) - max_search_distance)
                    row1 = min(raw.height, int(window.row_off + window.height) + max_search_distance)
                    col1 = min(raw.width, int(window.col_off + window.width) + max_search_distance)
                    expanded_window = Window(col0, row0, col1 - col0, row1 - row0)
                    expanded = raw.read(1, window=expanded_window).astype(np.float32)
                    valid_mask = (np.isfinite(expanded) & (expanded != nodata)).astype(np.uint8)
                    filled = fillnodata(
                        expanded,
                        mask=valid_mask,
                        max_search_distance=max_search_distance,
                        smoothing_iterations=0,
                    )
                    r0 = int(window.row_off) - row0
                    c0 = int(window.col_off) - col0
                    center_filled = filled[r0 : r0 + h, c0 : c0 + w]
                    successful = gaps_center & np.isfinite(center_filled) & (center_filled != nodata)
                    center[successful] = center_filled[successful]
                    fill_class[successful] = 1
                    remaining = gaps_center & ~successful
                    fill_class[remaining] = 2
                    filled_pixels += int(np.count_nonzero(successful))
                    unresolved_pixels += int(np.count_nonzero(remaining))

                inside = geometry_mask(
                    polygon_geojson,
                    out_shape=(h, w),
                    transform=window_transform(window, raw.transform),
                    invert=True,
                    all_touched=False,
                )
                center[~inside] = nodata
                fill_class[~inside] = 255
                final.write(center, 1, window=window)
                fill_output.write(fill_class, 1, window=window)
                if index == 1 or index % 40 == 0 or index == total_windows:
                    print(f"空洞处理进度：{index}/{total_windows}")
    return {"filledPixels": filled_pixels, "unresolvedPixels": unresolved_pixels}


def add_tags(path: Path, tags: dict[str, Any]) -> None:
    with rasterio.open(path, "r+") as dataset:
        dataset.update_tags(**{key: str(value) for key, value in tags.items()})


def build_overviews(path: Path, levels: list[int], categorical: bool) -> None:
    with rasterio.open(path, "r+") as dataset:
        usable = [level for level in levels if dataset.width // level >= 1 and dataset.height // level >= 1]
        if usable:
            dataset.build_overviews(usable, Resampling.nearest if categorical else Resampling.average)
            dataset.update_tags(ns="rio_overview", resampling="nearest" if categorical else "average")


def make_cog(source_path: Path, output_path: Path, block_size: int, categorical: bool) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()
    options = {
        "driver": "COG",
        "COMPRESS": "DEFLATE",
        "BLOCKSIZE": block_size,
        "BIGTIFF": "IF_SAFER",
        "OVERVIEW_RESAMPLING": "NEAREST" if categorical else "AVERAGE",
    }
    rio_copy(source_path, output_path, **options)


def save_preview(path: Path, dem_path: Path) -> None:
    import matplotlib.pyplot as plt

    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(dem_path) as dataset:
        max_size = 1600
        scale = max(dataset.width / max_size, dataset.height / max_size, 1.0)
        out_width = max(1, int(dataset.width / scale))
        out_height = max(1, int(dataset.height / scale))
        data = dataset.read(1, out_shape=(out_height, out_width), masked=True, resampling=Resampling.average)
        extent = [dataset.bounds.left, dataset.bounds.right, dataset.bounds.bottom, dataset.bounds.top]
    figure, axis = plt.subplots(figsize=(11, 12))
    image = axis.imshow(data, extent=extent, origin="upper", cmap="terrain")
    axis.set_title("Zhenbao Ding 15 km north to Yangshuo Pingle boundary DEM")
    axis.set_xlabel("Easting, EPSG:32649")
    axis.set_ylabel("Northing, EPSG:32649")
    figure.colorbar(image, ax=axis, label="Elevation reference value")
    figure.tight_layout()
    figure.savefig(path, dpi=150)
    plt.close(figure)


def run(config_path: Path, root: Path) -> int:
    config = read_json(config_path)
    resolved = read_json(root / config["outputs"]["resolvedAoiJson"])
    if resolved.get("status") != "exact_boundary_resolved":
        raise PipelineError("The exact Yangshuo Pingle shared boundary has not been resolved")

    source_paths, source_lineage = locate_sources(config, root)
    target_crs = config["processing"]["outputCrs"]
    resolution = float(config["processing"]["outputPixelSpacingMeters"])
    nodata = float(config["processing"]["nodata"])
    block_size = int(config["processing"]["blockSize"])
    levels = [int(value) for value in config["processing"].get("overviewLevels", [])]

    final_wgs84 = Polygon([(float(x), float(y)) for x, y in resolved["final"]["wgs84Polygon"]])
    transformer = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True)
    final_utm = shapely_transform(transformer.transform, final_wgs84)
    transform, width, height, aligned_bounds_value = aligned_grid(final_utm.bounds, resolution)
    print(f"输出网格：{width} × {height}，像元 {resolution} m")

    inspections = inspect_sources(source_paths, target_crs)
    work_dir = root / "data" / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    raw_path = work_dir / "mosaic_raw_float32.tif"
    count_temp = work_dir / "source_count_uint8.tif"
    initial_fill = work_dir / "fill_class_initial_uint8.tif"
    final_temp = work_dir / "final_dem_float32.tif"
    fill_temp = work_dir / "fill_class_uint8.tif"

    write_raw_mosaic(
        source_paths,
        inspections,
        final_utm,
        target_crs,
        transform,
        width,
        height,
        resolution,
        nodata,
        block_size,
        raw_path,
        count_temp,
        initial_fill,
    )
    before = scan_coverage(raw_path, final_utm, block_size, nodata)
    gap_area_km2 = before["gapPixels"] * resolution * resolution / 1_000_000.0
    print(f"拼接前有效覆盖：{before['validFraction']:.5%}，空洞 {gap_area_km2:.3f} km²")

    fill_result = {"filledPixels": 0, "unresolvedPixels": before["gapPixels"]}
    fill_enabled = bool(config["processing"].get("fillSmallGaps", True))
    max_fill_area = float(config["processing"].get("maxFillAreaKm2", 0.0))
    if before["gapPixels"] == 0:
        with rasterio.open(raw_path) as dataset:
            raw_profile_copy = dataset.profile.copy()
        with rasterio.open(initial_fill) as dataset:
            fill_profile_copy = dataset.profile.copy()
        copy_raster_blocks(raw_path, final_temp, raw_profile_copy, block_size)
        copy_raster_blocks(initial_fill, fill_temp, fill_profile_copy, block_size)
    elif fill_enabled and gap_area_km2 <= max_fill_area:
        fill_result = fill_small_gaps_blockwise(
            raw_path,
            initial_fill,
            final_temp,
            fill_temp,
            final_utm,
            nodata,
            block_size,
            int(config["processing"].get("fillMaxSearchDistancePixels", 400)),
        )
    else:
        with rasterio.open(raw_path) as dataset:
            raw_profile_copy = dataset.profile.copy()
        with rasterio.open(initial_fill) as dataset:
            fill_profile_copy = dataset.profile.copy()
        copy_raster_blocks(raw_path, final_temp, raw_profile_copy, block_size)
        copy_raster_blocks(initial_fill, fill_temp, fill_profile_copy, block_size)

    after = scan_coverage(final_temp, final_utm, block_size, nodata)
    minimum_valid = float(config["processing"].get("minimumValidFraction", 0.995))
    if after["validFraction"] < minimum_valid and bool(config["processing"].get("failOnLargeGap", True)):
        raise PipelineError(
            f"Final coverage {after['validFraction']:.5%} is below required {minimum_valid:.5%}. "
            "The raw mosaic and QA inputs remain in data/work."
        )

    source_names = ",".join(path.name for path in source_paths)
    runtime_source_path = root / "metadata" / "runtime_source.json"
    runtime_source = read_json(runtime_source_path) if runtime_source_path.exists() else {}
    product_label = str(runtime_source.get("productLabel") or config["project"]["accuracyLabel"])
    common_tags = {
        "PROJECT_ID": config["project"]["id"],
        "PRODUCT_LABEL": product_label,
        "SOURCE_MODE": str(runtime_source.get("mode", "unknown")),
        "TEMPORARY_FALLBACK": str(bool(runtime_source.get("temporaryFallback", False))).lower(),
        "SOURCE_FILES": source_names,
        "AOI_POLICY": "Zhenbao Ding summit plus 15000m north; south follows Yangshuo Pingle shared boundary",
        "OVERLAP_REDUCER": "median",
    }
    add_tags(final_temp, {**common_tags, "PRODUCT_ROLE": "FINAL_INCREMENTAL_MOSAIC_DEM"})
    add_tags(count_temp, {**common_tags, "PRODUCT_ROLE": "NUMBER_OF_VALID_SOURCE_DEMS_PER_PIXEL"})
    add_tags(fill_temp, {**common_tags, "PRODUCT_ROLE": "FILL_CLASS_0_ORIGINAL_1_FILLED_2_UNRESOLVED_255_OUTSIDE"})

    if config["processing"].get("buildOverviews", True):
        build_overviews(final_temp, levels, categorical=False)
        build_overviews(count_temp, levels, categorical=True)
        build_overviews(fill_temp, levels, categorical=True)

    final_output = root / config["outputs"]["finalDem"]
    count_output = root / config["outputs"]["sourceCount"]
    fill_output = root / config["outputs"]["fillClass"]
    make_cog(final_temp, final_output, block_size, categorical=False)
    make_cog(count_temp, count_output, block_size, categorical=True)
    make_cog(fill_temp, fill_output, block_size, categorical=True)
    save_preview(root / config["outputs"]["preview"], final_output)

    output_records = []
    for role, path in (
        ("finalDem", final_output),
        ("sourceCount", count_output),
        ("fillClass", fill_output),
    ):
        with rasterio.open(path) as dataset:
            output_records.append(
                {
                    "role": role,
                    "file": str(path),
                    "bytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                    "width": dataset.width,
                    "height": dataset.height,
                    "dtype": dataset.dtypes[0],
                    "nodata": dataset.nodata,
                    "crs": dataset.crs.to_string() if dataset.crs else None,
                    "resolution": [abs(dataset.transform.a), abs(dataset.transform.e)],
                    "bounds": list(dataset.bounds),
                    "overviews": dataset.overviews(1),
                    "imageStructure": dataset.tags(ns="IMAGE_STRUCTURE"),
                }
            )

    qa = {
        "schemaVersion": "1.0.0",
        "generatedAt": utc_now(),
        "status": "complete",
        "project": config["project"],
        "runtimeSource": runtime_source,
        "boundary": resolved,
        "grid": {
            "crs": target_crs,
            "resolutionMeters": resolution,
            "width": width,
            "height": height,
            "alignedBounds": list(aligned_bounds_value),
        },
        "sourceLineage": source_lineage,
        "sourceInspection": inspections,
        "coverageBeforeFill": before,
        "gapAreaBeforeFillKm2": gap_area_km2,
        "fillOperation": fill_result,
        "coverageAfterFill": after,
        "outputs": output_records,
    }
    write_json(root / config["outputs"]["qaReport"], qa)
    manifest_path = root / config["outputs"]["sourceManifest"]
    download_manifest: dict[str, Any] = {}
    if manifest_path.exists():
        try:
            previous_manifest = read_json(manifest_path)
            download_manifest = {
                key: previous_manifest[key]
                for key in (
                    "source",
                    "search",
                    "selectedProducts",
                    "existingFive",
                    "downloads",
                    "extractedFromArchives",
                    "newDemFiles",
                )
                if key in previous_manifest
            }
        except Exception as exc:
            download_manifest = {"previousManifestReadError": str(exc)}
    write_json(
        manifest_path,
        {
            "schemaVersion": "1.0.1",
            "generatedAt": utc_now(),
            "project": config["project"],
            "downloadStage": download_manifest,
            "sourceLineage": source_lineage,
            "sourceInspection": inspections,
            "outputs": output_records,
        },
    )
    print(f"最终 DEM：{final_output}")
    print(f"最终有效覆盖：{after['validFraction']:.5%}")
    print(f"质检报告：{root / config['outputs']['qaReport']}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mosaic, clip and package the incremental DEM task")
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return run(Path(args.config).resolve(), Path(args.root).resolve())
    except KeyboardInterrupt:
        print("\n任务被用户中断。", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
