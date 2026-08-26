from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.merge import merge
from pyproj import Transformer

RESOLUTION = 12.5
NODATA = 0
EXPECTED_CRS = "EPSG:32649"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def aligned_union_bounds(datasets: list[rasterio.io.DatasetReader]) -> tuple[float, float, float, float]:
    west = min(ds.bounds.left for ds in datasets)
    south = min(ds.bounds.bottom for ds in datasets)
    east = max(ds.bounds.right for ds in datasets)
    north = max(ds.bounds.top for ds in datasets)
    return (
        math.floor(west / RESOLUTION) * RESOLUTION,
        math.floor(south / RESOLUTION) * RESOLUTION,
        math.ceil(east / RESOLUTION) * RESOLUTION,
        math.ceil(north / RESOLUTION) * RESOLUTION,
    )


def verify_sources(source_dir: Path, manifest_path: Path) -> tuple[list[Path], list[dict]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected = {item["file"]: item for item in manifest["sources"]}
    paths = sorted(source_dir.glob("*.dem.tif"))
    if len(paths) != 12:
        raise RuntimeError(f"需要 12 张新源 DEM，实际找到 {len(paths)} 张")
    if {path.name for path in paths} != set(expected):
        missing = sorted(set(expected) - {path.name for path in paths})
        extra = sorted({path.name for path in paths} - set(expected))
        raise RuntimeError(f"源片集合不一致。missing={missing}, extra={extra}")

    records: list[dict] = []
    for path in paths:
        item = expected[path.name]
        actual_hash = sha256(path)
        actual_bytes = path.stat().st_size
        if actual_hash != item["sha256"]:
            raise RuntimeError(f"SHA256 不匹配：{path.name}")
        if actual_bytes != item["bytes"]:
            raise RuntimeError(f"字节数不匹配：{path.name}")
        with rasterio.open(path) as ds:
            if str(ds.crs) != EXPECTED_CRS:
                raise RuntimeError(f"CRS 不匹配：{path.name} {ds.crs}")
            if abs(abs(ds.transform.a) - RESOLUTION) > 1e-6 or abs(abs(ds.transform.e) - RESOLUTION) > 1e-6:
                raise RuntimeError(f"像元尺寸不匹配：{path.name}")
            records.append(
                {
                    "file": path.name,
                    "bytes": actual_bytes,
                    "sha256": actual_hash,
                    "width": ds.width,
                    "height": ds.height,
                    "bounds": [ds.bounds.left, ds.bounds.bottom, ds.bounds.right, ds.bounds.top],
                    "transform": list(ds.transform)[:6],
                    "nodata": ds.nodata,
                }
            )
    return paths, records


def build_mosaic(paths: list[Path], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    datasets = [rasterio.open(path) for path in paths]
    try:
        bounds = aligned_union_bounds(datasets)
        dst_kwds = {
            "driver": "GTiff",
            "count": 1,
            "dtype": "int16",
            "crs": EXPECTED_CRS,
            "nodata": NODATA,
            "tiled": True,
            "blockxsize": 512,
            "blockysize": 512,
            "compress": "DEFLATE",
            "predictor": 2,
            "BIGTIFF": "YES",
        }
        merge(
            datasets,
            bounds=bounds,
            res=(RESOLUTION, RESOLUTION),
            nodata=NODATA,
            dtype="int16",
            method="first",
            resampling=Resampling.nearest,
            target_aligned_pixels=True,
            mem_limit=256,
            dst_path=str(output_path),
            dst_kwds=dst_kwds,
        )
    finally:
        for ds in datasets:
            ds.close()


def mosaic_statistics(mosaic_path: Path) -> dict:
    valid_pixels = 0
    total_pixels = 0
    minimum = None
    maximum = None
    with rasterio.open(mosaic_path) as ds:
        for _, window in ds.block_windows(1):
            data = ds.read(1, window=window)
            valid = data != NODATA
            count = int(valid.sum())
            valid_pixels += count
            total_pixels += data.size
            if count:
                values = data[valid]
                local_min = int(values.min())
                local_max = int(values.max())
                minimum = local_min if minimum is None else min(minimum, local_min)
                maximum = local_max if maximum is None else max(maximum, local_max)
        return {
            "width": ds.width,
            "height": ds.height,
            "bounds": [ds.bounds.left, ds.bounds.bottom, ds.bounds.right, ds.bounds.top],
            "transform": list(ds.transform)[:6],
            "crs": str(ds.crs),
            "resolution_m": [abs(ds.transform.a), abs(ds.transform.e)],
            "valid_pixels": valid_pixels,
            "nodata_pixels": total_pixels - valid_pixels,
            "total_pixels": total_pixels,
            "valid_fraction": valid_pixels / total_pixels if total_pixels else 0.0,
            "nodata_fraction": (total_pixels - valid_pixels) / total_pixels if total_pixels else 0.0,
            "minimum_elevation_m": minimum,
            "maximum_elevation_m": maximum,
        }


def colorize_preview(mosaic_path: Path, output_path: Path, max_width: int) -> dict:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(mosaic_path) as ds:
        scale = min(1.0, max_width / ds.width)
        width = max(1, int(round(ds.width * scale)))
        height = max(1, int(round(ds.height * scale)))
        data = ds.read(1, out_shape=(height, width), resampling=Resampling.bilinear).astype(np.float32)
        mask = ds.read_masks(1, out_shape=(height, width), resampling=Resampling.nearest) > 0
        valid = data[mask]
        if not valid.size:
            raise RuntimeError("拼接结果没有有效像元")
        p2, p98 = np.percentile(valid, [2.0, 98.0])
        if p98 <= p2:
            p98 = p2 + 1.0
        normalized = np.clip((data - p2) / (p98 - p2), 0.0, 1.0)

        stops = np.array([0.0, 0.20, 0.45, 0.70, 1.0], dtype=np.float32)
        colors = np.array(
            [
                [34, 68, 48],
                [62, 101, 64],
                [112, 126, 78],
                [157, 145, 103],
                [207, 207, 196],
            ],
            dtype=np.float32,
        )
        rgb = np.empty((height, width, 3), dtype=np.float32)
        for channel in range(3):
            rgb[..., channel] = np.interp(normalized, stops, colors[:, channel])

        fill_value = float(np.median(valid))
        terrain = np.where(mask, data, fill_value)
        xres = (ds.bounds.right - ds.bounds.left) / width
        yres = (ds.bounds.top - ds.bounds.bottom) / height
        grad_y, grad_x = np.gradient(terrain, yres, xres)
        slope = np.arctan(np.hypot(grad_x, grad_y))
        aspect = np.arctan2(-grad_x, grad_y)
        azimuth = math.radians(315.0)
        altitude = math.radians(45.0)
        hillshade = (
            math.sin(altitude) * np.cos(slope)
            + math.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
        )
        hillshade = np.clip((hillshade + 1.0) * 0.5, 0.0, 1.0)
        rgb *= (0.48 + 0.72 * hillshade[..., None])
        rgb = np.clip(rgb, 0, 255).astype(np.uint8)
        alpha = np.where(mask, 255, 0).astype(np.uint8)
        rgba = np.dstack([rgb, alpha])
        Image.fromarray(rgba, mode="RGBA").save(output_path, format="WEBP", quality=90, method=6)
        return {
            "width": width,
            "height": height,
            "percentile_stretch_m": [float(p2), float(p98)],
            "file": output_path.name,
        }


def source_footprints(records: list[dict], output_path: Path) -> None:
    transformer = Transformer.from_crs(EXPECTED_CRS, "EPSG:4326", always_xy=True)
    features = []
    for index, record in enumerate(records, start=1):
        west, south, east, north = record["bounds"]
        ring_utm = [(west, south), (east, south), (east, north), (west, north), (west, south)]
        ring_wgs84 = [list(transformer.transform(x, y)) for x, y in ring_utm]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "index": index,
                    "file": record["file"],
                    "sha256": record["sha256"],
                },
                "geometry": {"type": "Polygon", "coordinates": [ring_wgs84]},
            }
        )
    output_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--source-manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--web-data-dir", type=Path, required=True)
    parser.add_argument("--preview-max-width", type=int, default=8192)
    args = parser.parse_args()

    paths, records = verify_sources(args.source_dir, args.source_manifest)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.web_data_dir.mkdir(parents=True, exist_ok=True)

    mosaic_path = args.output_dir / "guilin_raw_union_12_5m.tif"
    build_mosaic(paths, mosaic_path)
    stats = mosaic_statistics(mosaic_path)
    preview = colorize_preview(
        mosaic_path,
        args.web_data_dir / "guilin_raw_union_preview.webp",
        args.preview_max_width,
    )
    source_footprints(records, args.web_data_dir / "source_footprints.geojson")

    qa = {
        "schema": "guilin-v070-raw-union/v1",
        "source_policy": "12 new 12.5 m DEM files only",
        "source_count": len(records),
        "source_order": [record["file"] for record in records],
        "merge_policy": "nearest-neighbour, first-valid, target-aligned 12.5 m grid",
        "crop_applied": False,
        "gap_fill_applied": False,
        "edge_trim_applied": False,
        "mosaic": stats,
        "mosaic_sha256": sha256(mosaic_path),
        "mosaic_bytes": mosaic_path.stat().st_size,
        "sources": records,
    }
    (args.output_dir / "mosaic_qa.json").write_text(
        json.dumps(qa, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    web_manifest = {
        "schema": "guilin-v070-selection-web/v1",
        "title": "桂林 12.5 米原始联合拼接",
        "crs": EXPECTED_CRS,
        "source_resolution_m": RESOLUTION,
        "source_count": len(records),
        "mosaic_bounds_epsg32649": stats["bounds"],
        "mosaic_grid": [stats["width"], stats["height"]],
        "valid_fraction": stats["valid_fraction"],
        "nodata_fraction": stats["nodata_fraction"],
        "elevation_range_m": [stats["minimum_elevation_m"], stats["maximum_elevation_m"]],
        "preview": preview,
        "selection_output": {
            "geojson_crs": "EPSG:4326",
            "projected_coordinates": "EPSG:32649",
            "wkt_crs": "EPSG:32649",
        },
        "mosaic_release_asset": "guilin_raw_union_12_5m.tif",
    }
    (args.web_data_dir / "mosaic_manifest.json").write_text(
        json.dumps(web_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(qa, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
