from __future__ import annotations

import argparse
from array import array
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from shapely.geometry import GeometryCollection, LineString, MultiLineString, box, shape
from shapely.ops import transform as shapely_transform

RAW_TIFF_NAME = "guilin_raw_union_12_5m.tif"
RAW_TIFF_SIZE = 124_348_471
RAW_TIFF_SHA256 = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
RAW_SOURCE_GRID = [17_408, 18_867]
RAW_SOURCE_RESOLUTION_M = 12.5
RAW_SOURCE_CRS = "EPSG:32649"
AOI_BOUNDS = [380_331.8, 2_705_928.1, 530_128.2, 2_926_987.2]
AOI_GEOMETRY_SHA256 = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
OUTPUT_GRID = 2_048
NODATA_CODE = np.uint16(65_535)
HYDROLOGY_GIT_BLOB_SHA1 = "c00174242b68106cec9febcf24e0b94464b3727c"
HYDROLOGY_EXPECTED_SIZE = 5_832_414
HYDROLOGY_SOURCE_COMMIT = "e737eb4c5d4f2d61b07c9786c3d8edfcf2718c56"
HYDROLOGY_SOURCE_PATH = "guilin-v072-terrain-rivers/data/osm_hydrology.geojson"
WATER_SURFACE_OFFSET_M = 0.8
MAX_WATER_ASSET_BYTES = 95 * 1024 * 1024


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha1(path: Path) -> str:
    payload = path.read_bytes()
    digest = hashlib.sha1()
    digest.update(f"blob {len(payload)}\0".encode("ascii"))
    digest.update(payload)
    return digest.hexdigest()


def canonical_geometry_digest(collection: dict[str, Any]) -> str:
    coordinates: list[dict[str, Any]] = []
    for feature in collection.get("features", []):
        geometry = feature.get("geometry") or {}
        properties = feature.get("properties") or {}
        coordinates.append(
            {
                "osm_type": properties.get("osm_type"),
                "osm_id": properties.get("osm_id"),
                "system": properties.get("system"),
                "geometry_type": geometry.get("type"),
                "coordinates": geometry.get("coordinates"),
            }
        )
    payload = json.dumps(coordinates, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def extract_lines(geometry: Any) -> Iterable[LineString]:
    if geometry.is_empty:
        return
    if isinstance(geometry, LineString):
        if len(geometry.coords) >= 2 and geometry.length > 0:
            yield geometry
        return
    if isinstance(geometry, MultiLineString):
        for part in geometry.geoms:
            yield from extract_lines(part)
        return
    if isinstance(geometry, GeometryCollection):
        for part in geometry.geoms:
            yield from extract_lines(part)


def densify_line(line: LineString, step_m: float) -> np.ndarray:
    if line.length <= 0:
        return np.empty((0, 2), dtype=np.float64)
    count = max(2, int(math.ceil(line.length / step_m)) + 1)
    distances = np.linspace(0.0, line.length, count, dtype=np.float64)
    return np.asarray([line.interpolate(float(distance)).coords[0] for distance in distances], dtype=np.float64)


def sample_elevations(dataset: rasterio.io.DatasetReader, points: np.ndarray, batch_size: int = 50_000) -> tuple[np.ndarray, np.ndarray]:
    elevations = np.full(len(points), np.nan, dtype=np.float64)
    valid = np.zeros(len(points), dtype=bool)
    for start in range(0, len(points), batch_size):
        end = min(len(points), start + batch_size)
        for offset, value in enumerate(dataset.sample(points[start:end], indexes=1, masked=True)):
            raw = value[0]
            index = start + offset
            masked = bool(np.ma.is_masked(raw))
            numeric = float(raw) if not masked else math.nan
            if not masked and math.isfinite(numeric):
                elevations[index] = numeric
                valid[index] = True
    return elevations, valid


def normalized_lateral(points: np.ndarray, index: int) -> tuple[float, float]:
    previous = points[max(0, index - 1)]
    following = points[min(len(points) - 1, index + 1)]
    dx = float(following[0] - previous[0])
    dz = float(following[1] - previous[1])
    length = math.hypot(dx, dz)
    if length <= 1e-9:
        return 0.0, 1.0
    return -dz / length, dx / length


def system_class(system: str) -> float:
    if system == "li":
        return 1.0
    if system == "xiang":
        return 2.0
    return 0.0


def sample_step(system: str) -> float:
    return 25.0 if system in {"li", "xiang"} else 75.0


def visual_half_width(base_width_m: float, system: str) -> float:
    del system
    return float(np.clip(base_width_m * 0.5, 2.5, 90.0))


def build_water_mesh(
    dataset: rasterio.io.DatasetReader,
    hydrology: dict[str, Any],
    hydrology_path: Path,
    terrain_codes: np.ndarray,
    output_dir: Path,
) -> dict[str, Any]:
    transformer = Transformer.from_crs("EPSG:4326", RAW_SOURCE_CRS, always_xy=True)
    clip_domain = box(*AOI_BOUNDS)
    center_e = (AOI_BOUNDS[0] + AOI_BOUNDS[2]) / 2.0
    center_n = (AOI_BOUNDS[1] + AOI_BOUNDS[3]) / 2.0

    records: list[dict[str, Any]] = []
    all_points: list[np.ndarray] = []
    source_feature_counts = {"li": 0, "xiang": 0, "other": 0}
    clipped_feature_counts = {"li": 0, "xiang": 0, "other": 0}
    source_line_count = 0
    sampled_point_cursor = 0

    for feature_index, feature in enumerate(hydrology.get("features", [])):
        geometry_payload = feature.get("geometry")
        if not geometry_payload:
            continue
        properties = feature.get("properties") or {}
        system = str(properties.get("system") or "other")
        if system not in source_feature_counts:
            system = "other"
        source_feature_counts[system] += 1
        projected = shapely_transform(transformer.transform, shape(geometry_payload))
        clipped = projected.intersection(clip_domain)
        feature_contributed = False
        for line in extract_lines(clipped):
            source_line_count += 1
            points = densify_line(line, sample_step(system))
            if len(points) < 2:
                continue
            start = sampled_point_cursor
            sampled_point_cursor += len(points)
            all_points.append(points)
            records.append(
                {
                    "feature_index": feature_index,
                    "system": system,
                    "class": system_class(system),
                    "base_width_m": float(properties.get("base_width_m") or 5.0),
                    "waterway": str(properties.get("waterway") or "waterway"),
                    "name": str(properties.get("name") or properties.get("name_en") or ""),
                    "start": start,
                    "count": len(points),
                }
            )
            feature_contributed = True
        if feature_contributed:
            clipped_feature_counts[system] += 1

    if not all_points:
        raise RuntimeError("No hydrology geometry intersects the accepted AOI")
    point_array = np.concatenate(all_points, axis=0)
    elevations, native_valid = sample_elevations(dataset, point_array)
    west, south, east, north = AOI_BOUNDS
    preview_columns = np.clip(np.floor((point_array[:, 0] - west) / (east - west) * OUTPUT_GRID).astype(np.int64), 0, OUTPUT_GRID - 1)
    preview_rows = np.clip(np.floor((north - point_array[:, 1]) / (north - south) * OUTPUT_GRID).astype(np.int64), 0, OUTPUT_GRID - 1)
    preview_valid = terrain_codes[preview_rows, preview_columns] != NODATA_CODE
    valid = native_valid & preview_valid

    vertices = array("f")
    source_segment_count = 0
    emitted_segment_count = 0
    nodata_break_count = 0
    class_segment_counts = {"li": 0, "xiang": 0, "other": 0}
    sampled_centerline_length_m = 0.0

    point_cursor = 0
    for record, points in zip(records, all_points, strict=True):
        count = record["count"]
        line_elevations = elevations[point_cursor:point_cursor + count]
        line_valid = valid[point_cursor:point_cursor + count]
        point_cursor += count
        half_width = visual_half_width(record["base_width_m"], record["system"])
        class_value = record["class"]
        for index in range(count - 1):
            source_segment_count += 1
            p0 = points[index]
            p1 = points[index + 1]
            sampled_centerline_length_m += float(np.linalg.norm(p1 - p0))
            if not (line_valid[index] and line_valid[index + 1]):
                nodata_break_count += 1
                continue
            l0x, l0z = normalized_lateral(points, index)
            l1x, l1z = normalized_lateral(points, index + 1)
            left0 = (p0[0] + l0x * half_width - center_e, line_elevations[index] + WATER_SURFACE_OFFSET_M, center_n - (p0[1] + l0z * half_width))
            right0 = (p0[0] - l0x * half_width - center_e, line_elevations[index] + WATER_SURFACE_OFFSET_M, center_n - (p0[1] - l0z * half_width))
            left1 = (p1[0] + l1x * half_width - center_e, line_elevations[index + 1] + WATER_SURFACE_OFFSET_M, center_n - (p1[1] + l1z * half_width))
            right1 = (p1[0] - l1x * half_width - center_e, line_elevations[index + 1] + WATER_SURFACE_OFFSET_M, center_n - (p1[1] - l1z * half_width))
            for vertex in (left0, right0, left1, right0, right1, left1):
                vertices.extend((float(vertex[0]), float(vertex[1]), float(vertex[2]), class_value))
            emitted_segment_count += 1
            class_segment_counts[record["system"]] += 1

    if len(vertices) == 0 or len(vertices) % 4:
        raise RuntimeError("Hydrology ribbon mesh is empty or malformed")
    if sys.byteorder != "little":
        vertices.byteswap()
    water_path = output_dir / "hydrology_ribbons.f32.bin"
    with water_path.open("wb") as handle:
        vertices.tofile(handle)
    if water_path.stat().st_size >= MAX_WATER_ASSET_BYTES:
        raise RuntimeError(f"Hydrology asset exceeds GitHub file limit guard: {water_path.stat().st_size}")
    vertex_count = len(vertices) // 4

    manifest = {
        "schema": "guilin-v075-hydrology-sampled-ribbons/v1",
        "crs": RAW_SOURCE_CRS,
        "aoi_geometry_sha256": AOI_GEOMETRY_SHA256,
        "aoi_bounds_epsg32649": AOI_BOUNDS,
        "source_commit": HYDROLOGY_SOURCE_COMMIT,
        "source_path": HYDROLOGY_SOURCE_PATH,
        "source_git_blob_sha1": HYDROLOGY_GIT_BLOB_SHA1,
        "source_sha256": sha256_file(hydrology_path),
        "source_centerline_coordinate_sha256": canonical_geometry_digest(hydrology),
        "source_feature_counts": source_feature_counts,
        "clipped_feature_counts": clipped_feature_counts,
        "source_line_count_after_clip": source_line_count,
        "sample_step_m": {"li": 25.0, "xiang": 25.0, "other": 75.0},
        "source_segment_count": source_segment_count,
        "emitted_segment_count": emitted_segment_count,
        "nodata_break_count": nodata_break_count,
        "native_nodata_sample_count": int(np.count_nonzero(~native_valid)),
        "preview_nodata_sample_count": int(np.count_nonzero(~preview_valid)),
        "segment_counts_by_system": class_segment_counts,
        "sampled_centerline_length_m": sampled_centerline_length_m,
        "centerline_coordinates_mutated": False,
        "display_width_policy": "source base_width_m split symmetrically around immutable centerline; no centerline translation",
        "drape_policy": "sample native 12.5 m DEM at immutable centerline; break at native or conservative 2048 preview NoData; runtime vertices re-drape to displayed 2048 grid; fixed 0.8 m display offset",
        "water_surface_offset_m": WATER_SURFACE_OFFSET_M,
        "vertex_layout": ["x_m_from_aoi_center", "absolute_elevation_m", "z_m_from_aoi_center", "system_class"],
        "system_class": {"other": 0, "li": 1, "xiang": 2},
        "primitive": "triangles",
        "vertex_count": vertex_count,
        "float_count": len(vertices),
        "file": water_path.name,
        "stored_bytes": water_path.stat().st_size,
        "maximum_asset_bytes": MAX_WATER_ASSET_BYTES,
        "sha256": sha256_file(water_path),
        "gap_fill_applied": False,
        "fallback_30m_used": False,
    }
    (output_dir / "hydrology_sample_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def build_terrain_grid(dataset: rasterio.io.DatasetReader, output_dir: Path) -> tuple[dict[str, Any], np.ndarray]:
    window = from_bounds(*AOI_BOUNDS, transform=dataset.transform)
    terrain = dataset.read(
        1,
        window=window,
        out_shape=(OUTPUT_GRID, OUTPUT_GRID),
        resampling=Resampling.bilinear,
        masked=True,
    ).astype(np.float32)
    mask_average = dataset.read_masks(
        1,
        window=window,
        out_shape=(OUTPUT_GRID, OUTPUT_GRID),
        resampling=Resampling.average,
    )
    data = np.asarray(terrain.data, dtype=np.float32)
    valid = (~np.ma.getmaskarray(terrain)) & (mask_average == 255) & np.isfinite(data)
    if int(np.count_nonzero(valid)) < OUTPUT_GRID * OUTPUT_GRID // 4:
        raise RuntimeError("Accepted AOI contains too few valid DEM samples")

    minimum = float(np.min(data[valid]))
    maximum = float(np.max(data[valid]))
    span = max(maximum - minimum, 1.0)
    encoded = np.full((OUTPUT_GRID, OUTPUT_GRID), NODATA_CODE, dtype="<u2")
    encoded_values = np.clip(np.rint((data[valid] - minimum) / span * 65_534.0), 0, 65_534).astype(np.uint16)
    encoded[valid] = encoded_values
    height_path = output_dir / "terrain_2048_u16.bin"
    height_path.write_bytes(encoded.tobytes(order="C"))

    valid_values = data[valid]
    p01, p02, p50, p98, p99 = [float(value) for value in np.percentile(valid_values, [1, 2, 50, 98, 99])]
    west, south, east, north = AOI_BOUNDS
    spacing_x = (east - west) / OUTPUT_GRID
    spacing_y = (north - south) / OUTPUT_GRID
    manifest = {
        "schema": "guilin-v075-accepted-aoi-terrain-grid/v2",
        "crs": RAW_SOURCE_CRS,
        "aoi_status": "ACCEPTED",
        "aoi_geometry_sha256": AOI_GEOMETRY_SHA256,
        "aoi_bounds_epsg32649": AOI_BOUNDS,
        "aoi_world_size_m": [east - west, north - south],
        "aoi_center_epsg32649": [(west + east) / 2.0, (south + north) / 2.0],
        "source_file": RAW_TIFF_NAME,
        "source_release_tag": "guilin-v070-raw-mosaic-v001",
        "source_release_asset_id": 530_206_518,
        "source_sha256": RAW_TIFF_SHA256,
        "source_size_bytes": RAW_TIFF_SIZE,
        "source_grid": RAW_SOURCE_GRID,
        "source_resolution_m": [RAW_SOURCE_RESOLUTION_M, RAW_SOURCE_RESOLUTION_M],
        "source_elevation_modified_m": 0.0,
        "output_grid": [OUTPUT_GRID, OUTPUT_GRID],
        "output_file": height_path.name,
        "output_encoding": "uint16-little-endian",
        "output_nodata_code": int(NODATA_CODE),
        "output_spacing_xy_m": [spacing_x, spacing_y],
        "sample_center_bounds_epsg32649": [west + spacing_x / 2.0, south + spacing_y / 2.0, east - spacing_x / 2.0, north - spacing_y / 2.0],
        "elevation_range_m": [minimum, maximum],
        "percentiles_m": {"p01": p01, "p02": p02, "p50": p50, "p98": p98, "p99": p99},
        "valid_sample_count": int(np.count_nonzero(valid)),
        "nodata_sample_count": int(valid.size - np.count_nonzero(valid)),
        "valid_fraction": float(np.mean(valid)),
        "mask_policy": "conservative average mask; output valid only when covered native mask remains fully valid",
        "resampling": "bilinear elevation from native 12.5 m source for browser preview only",
        "vertical_scale": 1.0,
        "gap_fill_applied": False,
        "fallback_30m_used": False,
        "stored_bytes": height_path.stat().st_size,
        "sha256": sha256_file(height_path),
    }
    (output_dir / "terrain_2048_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest, encoded


def validate_inputs(mosaic: Path, hydrology: Path) -> dict[str, str]:
    if mosaic.name != RAW_TIFF_NAME:
        raise RuntimeError(f"Unexpected source TIFF name: {mosaic.name}")
    if mosaic.stat().st_size != RAW_TIFF_SIZE:
        raise RuntimeError(f"Source TIFF size mismatch: {mosaic.stat().st_size}")
    raw_sha = sha256_file(mosaic)
    if raw_sha != RAW_TIFF_SHA256:
        raise RuntimeError(f"Source TIFF SHA256 mismatch: {raw_sha}")
    if hydrology.stat().st_size != HYDROLOGY_EXPECTED_SIZE:
        raise RuntimeError(f"Hydrology source size mismatch: {hydrology.stat().st_size}")
    blob_sha = git_blob_sha1(hydrology)
    if blob_sha != HYDROLOGY_GIT_BLOB_SHA1:
        raise RuntimeError(f"Hydrology git blob mismatch: {blob_sha}")
    return {"raw_sha256": raw_sha, "hydrology_git_blob_sha1": blob_sha, "hydrology_sha256": sha256_file(hydrology)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--hydrology", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    input_receipt = validate_inputs(args.mosaic, args.hydrology)
    hydrology = json.loads(args.hydrology.read_text(encoding="utf-8"))
    if hydrology.get("type") != "FeatureCollection":
        raise RuntimeError("Hydrology source is not a FeatureCollection")
    if hydrology.get("centerline_policy") != "OSM coordinates immutable; display width is derived separately":
        raise RuntimeError("Hydrology centerline contract mismatch")

    with rasterio.open(args.mosaic) as dataset:
        if str(dataset.crs) != RAW_SOURCE_CRS:
            raise RuntimeError(f"Unexpected CRS: {dataset.crs}")
        if [dataset.width, dataset.height] != RAW_SOURCE_GRID:
            raise RuntimeError(f"Unexpected source grid: {dataset.width} x {dataset.height}")
        if not math.isclose(abs(dataset.transform.a), RAW_SOURCE_RESOLUTION_M, abs_tol=1e-9) or not math.isclose(abs(dataset.transform.e), RAW_SOURCE_RESOLUTION_M, abs_tol=1e-9):
            raise RuntimeError("Source pixel spacing is not 12.5 m")
        if dataset.transform.b != 0 or dataset.transform.d != 0:
            raise RuntimeError("Rotated source grids are unsupported")
        terrain_manifest, terrain_codes = build_terrain_grid(dataset, args.output_dir)
        water_manifest = build_water_mesh(dataset, hydrology, args.hydrology, terrain_codes, args.output_dir)

    receipt = {
        "schema": "guilin-v075-2048-hydrology-build-receipt/v1",
        "inputs": input_receipt,
        "aoi_geometry_sha256": AOI_GEOMETRY_SHA256,
        "terrain": {
            "grid": terrain_manifest["output_grid"],
            "file": terrain_manifest["output_file"],
            "sha256": terrain_manifest["sha256"],
            "stored_bytes": terrain_manifest["stored_bytes"],
        },
        "hydrology": {
            "file": water_manifest["file"],
            "sha256": water_manifest["sha256"],
            "stored_bytes": water_manifest["stored_bytes"],
            "vertex_count": water_manifest["vertex_count"],
            "emitted_segment_count": water_manifest["emitted_segment_count"],
        },
        "vertical_scale": 1.0,
        "gap_fill_applied": False,
        "fallback_30m_used": False,
    }
    (args.output_dir / "build_receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
