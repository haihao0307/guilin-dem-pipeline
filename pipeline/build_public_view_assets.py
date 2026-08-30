from __future__ import annotations

import argparse
import json
import math
from array import array
from pathlib import Path
from typing import Iterable

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.windows import Window
from shapely.geometry import GeometryCollection, LineString, MultiLineString, box, shape
from shapely.ops import transform as shapely_transform

from core import (
    AOI_BOUNDS,
    AOI_SHA256,
    CRS,
    HYDRO_BLOB_SHA1,
    HYDRO_BYTES,
    HYDRO_SHA256,
    NODATA,
    RAW_BYTES,
    RAW_GRID,
    RAW_NAME,
    RAW_SHA256,
    SPACING,
    aoi_window,
    git_blob_sha1,
    sha256,
    write_json,
)

OVERVIEW_STRIDE = 16
HYDROLOGY_MAX_SEGMENT_M = 100.0
ALLOWED_WATERWAYS = {"river", "stream", "canal"}
WATERWAY_CODES = {"river": 0.0, "stream": 1.0, "canal": 2.0}
DEFAULT_WIDTH_M = {"river": 36.0, "stream": 5.0, "canal": 7.0}


def iter_lines(geometry) -> Iterable[LineString]:
    if geometry.is_empty:
        return
    if isinstance(geometry, LineString):
        if len(geometry.coords) >= 2 and geometry.length > 0:
            yield geometry
        return
    if isinstance(geometry, MultiLineString):
        for part in geometry.geoms:
            yield from iter_lines(part)
        return
    if isinstance(geometry, GeometryCollection):
        for part in geometry.geoms:
            yield from iter_lines(part)


def direct_sample_indices(size: int, stride: int) -> np.ndarray:
    indices = np.arange(0, size, stride, dtype=np.int32)
    if indices.size == 0 or int(indices[-1]) != size - 1:
        indices = np.append(indices, np.int32(size - 1))
    return indices


def validate_source(path: Path, dataset: rasterio.io.DatasetReader) -> None:
    if path.name != RAW_NAME:
        raise RuntimeError(f"unexpected source file {path.name}")
    if path.stat().st_size != RAW_BYTES:
        raise RuntimeError(f"source byte count mismatch {path.stat().st_size}")
    if sha256(path) != RAW_SHA256:
        raise RuntimeError("source SHA256 mismatch")
    if str(dataset.crs) != CRS:
        raise RuntimeError(f"source CRS mismatch {dataset.crs}")
    if [dataset.width, dataset.height] != RAW_GRID:
        raise RuntimeError(f"source grid mismatch {dataset.width} x {dataset.height}")
    if dataset.count != 1 or dataset.dtypes[0] != "int16" or dataset.nodata != NODATA:
        raise RuntimeError("source data contract mismatch")
    if not math.isclose(dataset.transform.a, SPACING, abs_tol=1e-9):
        raise RuntimeError("source x spacing mismatch")
    if not math.isclose(dataset.transform.e, -SPACING, abs_tol=1e-9):
        raise RuntimeError("source y spacing mismatch")


def build_overview(dataset: rasterio.io.DatasetReader, output_dir: Path) -> dict:
    col0, row0, width, height = aoi_window(dataset)
    source_columns = direct_sample_indices(width, OVERVIEW_STRIDE)
    source_rows = direct_sample_indices(height, OVERVIEW_STRIDE)
    values = np.zeros((len(source_rows), len(source_columns)), dtype="<i2")

    chunk_rows = 128
    for output_start in range(0, len(source_rows), chunk_rows):
        output_stop = min(len(source_rows), output_start + chunk_rows)
        selected = source_rows[output_start:output_stop]
        source_start = int(selected[0])
        source_stop = int(selected[-1])
        block = dataset.read(
            1,
            window=Window(col0, row0 + source_start, width, source_stop - source_start + 1),
        )
        row_offsets = selected.astype(np.int64) - source_start
        values[output_start:output_stop] = block[row_offsets][:, source_columns]

    output = output_dir / "overview-direct-samples-i16.bin"
    values.tofile(output)

    first_center = dataset.xy(row0, col0, offset="center")
    last_center = dataset.xy(row0 + height - 1, col0 + width - 1, offset="center")
    valid = values != NODATA
    valid_values = values[valid]
    if valid_values.size == 0:
        raise RuntimeError("overview contains no valid elevations")

    manifest = {
        "schema": "guilin-full-map-direct-sample-overview/v1",
        "status": "display_lod_derived_from_sole_truth",
        "source": {
            "file": RAW_NAME,
            "bytes": RAW_BYTES,
            "sha256": RAW_SHA256,
            "crs": CRS,
            "native_spacing_m": SPACING,
            "dtype": "int16",
            "nodata": NODATA,
        },
        "aoi": {
            "geometry_sha256": AOI_SHA256,
            "native_sample_window": [col0, row0, width, height],
            "native_sample_center_bounds_epsg32649": [
                float(first_center[0]),
                float(last_center[1]),
                float(last_center[0]),
                float(first_center[1]),
            ],
        },
        "asset": {
            "file": output.name,
            "bytes": output.stat().st_size,
            "sha256": sha256(output),
            "encoding": "int16-little-endian-direct-source-samples",
            "grid": [int(len(source_columns)), int(len(source_rows))],
            "source_columns": source_columns.tolist(),
            "source_rows": source_rows.tolist(),
            "source_stride_nominal_samples": OVERVIEW_STRIDE,
            "source_stride_nominal_m": OVERVIEW_STRIDE * SPACING,
            "selection": "direct_integer_source_indices",
            "interpolation": "none",
            "compression": "none",
            "quantization": "none",
            "height_texture": False,
            "elevation_range_m": [int(valid_values.min()), int(valid_values.max())],
        },
        "rules": {
            "authoritative_source_unchanged": True,
            "source_elevation_modified_m": 0.0,
            "native_detail_uses_raw_tiles": True,
            "overview_is_display_lod_only": True,
            "overview_never_replaces_native_truth": True,
        },
    }
    write_json(output_dir / "overview-direct-samples-manifest.json", manifest)
    return manifest


def densify_line(line: LineString, maximum_step: float) -> np.ndarray:
    coords = np.asarray(line.coords, dtype=np.float64)
    output: list[tuple[float, float]] = []
    for index in range(len(coords) - 1):
        start = coords[index]
        end = coords[index + 1]
        distance = float(np.hypot(*(end - start)))
        divisions = max(1, int(math.ceil(distance / maximum_step)))
        for step in range(divisions):
            fraction = step / divisions
            point = start + (end - start) * fraction
            if not output or point[0] != output[-1][0] or point[1] != output[-1][1]:
                output.append((float(point[0]), float(point[1])))
    output.append((float(coords[-1][0]), float(coords[-1][1])))
    return np.asarray(output, dtype=np.float64)


def sample_elevations(
    dataset: rasterio.io.DatasetReader,
    points: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    elevations = np.full(len(points), np.nan, dtype=np.float64)
    valid = np.zeros(len(points), dtype=bool)
    for start in range(0, len(points), 50_000):
        stop = min(len(points), start + 50_000)
        for offset, sample in enumerate(dataset.sample(points[start:stop], indexes=1, masked=True)):
            value = sample[0]
            index = start + offset
            if np.ma.is_masked(value):
                continue
            numeric = float(value)
            if math.isfinite(numeric) and numeric != NODATA:
                elevations[index] = numeric
                valid[index] = True
    return elevations, valid


def build_hydrology(
    dataset: rasterio.io.DatasetReader,
    hydrology_path: Path,
    output_dir: Path,
) -> dict:
    if hydrology_path.stat().st_size != HYDRO_BYTES:
        raise RuntimeError("hydrology byte count mismatch")
    if sha256(hydrology_path) != HYDRO_SHA256:
        raise RuntimeError("hydrology SHA256 mismatch")
    if git_blob_sha1(hydrology_path) != HYDRO_BLOB_SHA1:
        raise RuntimeError("hydrology Git blob identity mismatch")

    collection = json.loads(hydrology_path.read_text(encoding="utf-8"))
    if collection.get("type") != "FeatureCollection":
        raise RuntimeError("hydrology source must be a FeatureCollection")
    if collection.get("centerline_policy") != "OSM coordinates immutable; display width is derived separately":
        raise RuntimeError("hydrology centerline policy mismatch")

    transformer = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)
    domain = box(*AOI_BOUNDS)
    center_e = (AOI_BOUNDS[0] + AOI_BOUNDS[2]) * 0.5
    center_n = (AOI_BOUNDS[1] + AOI_BOUNDS[3]) * 0.5

    line_records: list[dict] = []
    point_sets: list[np.ndarray] = []
    source_feature_count = 0
    clipped_record_count = 0
    rejected_waterbody_count = 0
    class_record_counts = {name: 0 for name in ALLOWED_WATERWAYS}

    for feature_index, feature in enumerate(collection.get("features", [])):
        geometry_payload = feature.get("geometry")
        if not geometry_payload:
            continue
        properties = feature.get("properties") or {}
        waterway = str(properties.get("waterway") or "").strip().lower()
        if waterway not in ALLOWED_WATERWAYS:
            rejected_waterbody_count += 1
            continue
        if any(
            str(properties.get(key) or "").strip().lower() in {"reservoir", "lake", "basin", "pond"}
            for key in ("water", "natural", "landuse")
        ):
            rejected_waterbody_count += 1
            continue

        source_feature_count += 1
        projected = shapely_transform(transformer.transform, shape(geometry_payload))
        clipped = projected.intersection(domain)
        for line in iter_lines(clipped):
            points = densify_line(line, HYDROLOGY_MAX_SEGMENT_M)
            if len(points) < 2:
                continue
            base_width = float(properties.get("base_width_m") or DEFAULT_WIDTH_M[waterway])
            line_records.append(
                {
                    "feature_index": feature_index,
                    "waterway": waterway,
                    "base_width_m": float(np.clip(base_width, 1.0, 250.0)),
                    "point_count": len(points),
                }
            )
            point_sets.append(points)
            clipped_record_count += 1
            class_record_counts[waterway] += 1

    if not point_sets:
        raise RuntimeError("no OSM line hydrology inside AOI")

    all_points = np.concatenate(point_sets, axis=0)
    elevations, valid = sample_elevations(dataset, all_points)

    segments = array("f")
    nodes = array("f")
    point_cursor = 0
    source_segment_count = 0
    emitted_segment_count = 0
    nodata_break_count = 0
    class_segment_counts = {name: 0 for name in ALLOWED_WATERWAYS}

    for record, points in zip(line_records, point_sets, strict=True):
        count = record["point_count"]
        line_elevations = elevations[point_cursor:point_cursor + count]
        line_valid = valid[point_cursor:point_cursor + count]
        point_cursor += count
        code = WATERWAY_CODES[record["waterway"]]
        width = record["base_width_m"]

        for index in range(count):
            if not line_valid[index]:
                continue
            point = points[index]
            nodes.extend(
                (
                    float(point[0] - center_e),
                    float(line_elevations[index]),
                    float(center_n - point[1]),
                    code,
                    width,
                )
            )

        for index in range(count - 1):
            source_segment_count += 1
            if not (line_valid[index] and line_valid[index + 1]):
                nodata_break_count += 1
                continue
            start = points[index]
            end = points[index + 1]
            segments.extend(
                (
                    float(start[0] - center_e),
                    float(line_elevations[index]),
                    float(center_n - start[1]),
                    float(end[0] - center_e),
                    float(line_elevations[index + 1]),
                    float(center_n - end[1]),
                    code,
                    width,
                )
            )
            emitted_segment_count += 1
            class_segment_counts[record["waterway"]] += 1

    if not np.little_endian:
        segments.byteswap()
        nodes.byteswap()

    segment_path = output_dir / "osm-waterway-segments-f32.bin"
    node_path = output_dir / "osm-waterway-nodes-f32.bin"
    with segment_path.open("wb") as handle:
        segments.tofile(handle)
    with node_path.open("wb") as handle:
        nodes.tofile(handle)

    manifest = {
        "schema": "guilin-osm-linear-waterways-render-asset/v1",
        "status": "derived_from_immutable_osm_centerlines",
        "source": {
            "file": hydrology_path.name,
            "bytes": HYDRO_BYTES,
            "sha256": HYDRO_SHA256,
            "git_blob_sha1": HYDRO_BLOB_SHA1,
            "centerline_coordinates_mutated": False,
            "manual_centerline_added": False,
            "synthetic_gap_line_added": False,
        },
        "filter": {
            "allowed_waterways": sorted(ALLOWED_WATERWAYS),
            "lake_geometry_count": 0,
            "lake_surface_asset_emitted": False,
            "reservoir_geometry_count": 0,
            "reservoir_surface_asset_emitted": False,
            "synthetic_surface_asset_emitted": False,
            "rejected_non_linear_or_waterbody_records": rejected_waterbody_count,
        },
        "topology": {
            "source_feature_count": source_feature_count,
            "aoi_clipped_linear_record_count": clipped_record_count,
            "record_counts": class_record_counts,
            "source_segment_count_after_render_densification": source_segment_count,
            "emitted_segment_count": emitted_segment_count,
            "segment_counts": class_segment_counts,
            "node_vertex_count": len(nodes) // 5,
            "nodata_break_count": nodata_break_count,
            "render_densification_max_m": HYDROLOGY_MAX_SEGMENT_M,
            "route_continuity_contract": True,
        },
        "segments": {
            "file": segment_path.name,
            "bytes": segment_path.stat().st_size,
            "sha256": sha256(segment_path),
            "float32_stride": 8,
            "layout": [
                "start_x_m_from_aoi_center",
                "start_absolute_elevation_m",
                "start_z_m_from_aoi_center",
                "end_x_m_from_aoi_center",
                "end_absolute_elevation_m",
                "end_z_m_from_aoi_center",
                "waterway_code",
                "display_width_source_m",
            ],
            "compression": "none",
        },
        "nodes": {
            "file": node_path.name,
            "bytes": node_path.stat().st_size,
            "sha256": sha256(node_path),
            "float32_stride": 5,
            "layout": [
                "x_m_from_aoi_center",
                "absolute_elevation_m",
                "z_m_from_aoi_center",
                "waterway_code",
                "display_width_source_m",
            ],
            "compression": "none",
        },
        "terrain_relation": {
            "elevation_source_sha256": RAW_SHA256,
            "source_elevation_modified_m": 0.0,
            "vertical_scale": 1.0,
            "height_texture": False,
        },
    }
    write_json(output_dir / "osm-waterways-manifest.json", manifest)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the full-map numeric overview and OSM line-waterway render assets."
    )
    parser.add_argument("--source-tiff", type=Path, required=True)
    parser.add_argument("--hydrology", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    with rasterio.open(args.source_tiff) as dataset:
        validate_source(args.source_tiff, dataset)
        overview = build_overview(dataset, args.output_dir)
        hydrology = build_hydrology(dataset, args.hydrology, args.output_dir)

    combined = {
        "schema": "guilin-continuous-full-map-view-assets/v1",
        "passed": True,
        "source_sha256": RAW_SHA256,
        "aoi_geometry_sha256": AOI_SHA256,
        "native_spacing_m": SPACING,
        "native_tile_count": 54,
        "overview": overview["asset"],
        "hydrology": {
            "segments": hydrology["segments"],
            "nodes": hydrology["nodes"],
            "filter": hydrology["filter"],
            "topology": hydrology["topology"],
        },
        "height_image_texture_used": False,
        "source_compression": "unchanged",
        "derived_asset_compression": "none",
    }
    write_json(args.output_dir / "continuous-full-map-assets.json", combined)
    print(json.dumps(combined, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
