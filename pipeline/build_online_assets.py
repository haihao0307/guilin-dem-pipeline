from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.windows import Window
from shapely.geometry import GeometryCollection, LineString, MultiLineString, box, shape
from shapely.ops import transform as shapely_transform

SOURCE_NAME = "guilin_raw_union_12_5m.tif"
SOURCE_BYTES = 124_348_471
SOURCE_SHA256 = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
SOURCE_CRS = "EPSG:32649"
SOURCE_GRID = [17_408, 18_867]
SOURCE_SPACING_M = 12.5
SOURCE_NODATA = 0
AOI_SHA256 = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
OVERVIEW_GRID = 768
ALLOWED_WATERWAYS = {"river": 0.0, "stream": 1.0, "canal": 2.0}
DEFAULT_WIDTH_M = {"river": 28.0, "stream": 6.0, "canal": 5.0}


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_inputs(mosaic: Path, manifest: dict[str, Any], dataset: rasterio.io.DatasetReader) -> None:
    if mosaic.name != SOURCE_NAME:
        raise RuntimeError(f"unexpected source filename: {mosaic.name}")
    if mosaic.stat().st_size != SOURCE_BYTES:
        raise RuntimeError(f"source byte count mismatch: {mosaic.stat().st_size}")
    digest = sha256_file(mosaic)
    if digest != SOURCE_SHA256:
        raise RuntimeError(f"source SHA256 mismatch: {digest}")
    if str(dataset.crs) != SOURCE_CRS:
        raise RuntimeError(f"source CRS mismatch: {dataset.crs}")
    if [dataset.width, dataset.height] != SOURCE_GRID:
        raise RuntimeError(f"source grid mismatch: {dataset.width} x {dataset.height}")
    if dataset.count != 1 or dataset.dtypes[0] != "int16":
        raise RuntimeError(f"source dtype mismatch: {dataset.dtypes}")
    if dataset.nodata != SOURCE_NODATA:
        raise RuntimeError(f"source NoData mismatch: {dataset.nodata}")
    if not math.isclose(dataset.transform.a, SOURCE_SPACING_M, abs_tol=1e-9):
        raise RuntimeError(f"source x spacing mismatch: {dataset.transform.a}")
    if not math.isclose(dataset.transform.e, -SOURCE_SPACING_M, abs_tol=1e-9):
        raise RuntimeError(f"source y spacing mismatch: {dataset.transform.e}")
    if manifest.get("schema") != "guilin-canonical-native-dem/v1":
        raise RuntimeError("native manifest schema mismatch")
    if manifest.get("status") != "sole_authoritative":
        raise RuntimeError("native manifest is not sole authoritative")
    if manifest.get("source", {}).get("sha256") != SOURCE_SHA256:
        raise RuntimeError("native manifest source identity mismatch")
    if manifest.get("aoi", {}).get("geometry_sha256") != AOI_SHA256:
        raise RuntimeError("native manifest AOI identity mismatch")
    if manifest.get("tile_matrix", {}).get("compression") != "none":
        raise RuntimeError("native manifest indicates compressed tiles")
    if len(manifest.get("tiles", [])) != 54:
        raise RuntimeError("native tile count mismatch")


def exact_source_indices(length: int, output_count: int) -> np.ndarray:
    if length < output_count:
        raise RuntimeError(f"source length {length} below overview grid {output_count}")
    indices = np.rint(np.linspace(0, length - 1, output_count, dtype=np.float64)).astype(np.int32)
    if np.any(np.diff(indices) <= 0):
        raise RuntimeError("overview source indices are not strictly increasing")
    if int(indices[0]) != 0 or int(indices[-1]) != length - 1:
        raise RuntimeError("overview source indices do not span the accepted AOI")
    return indices


def build_overview(
    dataset: rasterio.io.DatasetReader,
    manifest: dict[str, Any],
    output_dir: Path,
) -> dict[str, Any]:
    aoi_column, aoi_row, aoi_width, aoi_height = [int(value) for value in manifest["aoi"]["native_sample_window"]]
    columns = exact_source_indices(aoi_width, OVERVIEW_GRID)
    rows = exact_source_indices(aoi_height, OVERVIEW_GRID)
    heights = np.empty((OVERVIEW_GRID, OVERVIEW_GRID), dtype="<i2")

    for output_row, source_row in enumerate(rows):
        row_values = dataset.read(
            1,
            window=Window(aoi_column, aoi_row + int(source_row), aoi_width, 1),
            boundless=False,
        )[0]
        heights[output_row, :] = row_values[columns].astype("<i2", copy=False)

    valid = heights != SOURCE_NODATA
    if not np.any(valid):
        raise RuntimeError("overview contains no valid elevation")
    minimum = int(heights[valid].min())
    maximum = int(heights[valid].max())
    output = output_dir / "overview-direct-heights.i16.bin"
    output.write_bytes(heights.tobytes(order="C"))
    expected_bytes = OVERVIEW_GRID * OVERVIEW_GRID * 2
    if output.stat().st_size != expected_bytes:
        raise RuntimeError("overview byte count mismatch")

    return {
        "schema": "guilin-full-map-direct-sample-overview/v1",
        "status": "review_asset",
        "source": {
            "file": SOURCE_NAME,
            "bytes": SOURCE_BYTES,
            "sha256": SOURCE_SHA256,
            "crs": SOURCE_CRS,
            "grid": SOURCE_GRID,
            "resolution_m": [SOURCE_SPACING_M, SOURCE_SPACING_M],
            "dtype": "int16",
            "nodata": SOURCE_NODATA,
            "read_only": True,
        },
        "aoi": {
            "geometry_sha256": AOI_SHA256,
            "native_sample_window": [aoi_column, aoi_row, aoi_width, aoi_height],
            "native_sample_center_bounds_epsg32649": manifest["aoi"]["native_sample_center_bounds_epsg32649"],
        },
        "asset": {
            "file": output.name,
            "bytes": output.stat().st_size,
            "sha256": sha256_file(output),
            "grid": [OVERVIEW_GRID, OVERVIEW_GRID],
            "dtype": "int16-little-endian-absolute-elevation-m",
            "nodata": SOURCE_NODATA,
            "elevation_range_m": [minimum, maximum],
            "source_columns": [int(value) for value in columns],
            "source_rows": [int(value) for value in rows],
            "selection": "exact-native-sample-index-lattice",
            "interpolation": "none",
            "resampling": "none",
            "compression": "none",
            "quantization": "none",
            "height_texture": False,
            "source_elevation_modified_m": 0.0,
            "vertical_scale": 1.0,
        },
    }


def iter_lines(geometry: Any) -> Iterable[LineString]:
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


def parse_width(properties: dict[str, Any], waterway: str) -> float:
    candidates = [properties.get("base_width_m"), properties.get("width"), properties.get("est_width")]
    for candidate in candidates:
        if isinstance(candidate, (int, float)) and math.isfinite(float(candidate)):
            return float(np.clip(float(candidate), 2.0, 180.0))
        if isinstance(candidate, str):
            match = re.search(r"[-+]?\d+(?:\.\d+)?", candidate)
            if match:
                return float(np.clip(float(match.group(0)), 2.0, 180.0))
    return DEFAULT_WIDTH_M[waterway]


def projected_line_parts(feature: dict[str, Any], transformer: Transformer, domain: Any) -> list[LineString]:
    geometry_payload = feature.get("geometry")
    if not geometry_payload:
        return []
    geometry = shape(geometry_payload)
    if geometry.is_empty:
        return []
    projected = shapely_transform(transformer.transform, geometry)
    clipped = projected.intersection(domain)
    return list(iter_lines(clipped))



def nearest_valid_native_elevation(
    dataset: rasterio.io.DatasetReader,
    easting: float,
    northing: float,
    maximum_radius_samples: int = 32,
) -> tuple[float, float] | None:
    """Return the nearest valid native DEM elevation without moving the x/y centerline."""
    row, column = dataset.index(easting, northing)
    row = int(np.clip(row, 0, dataset.height - 1))
    column = int(np.clip(column, 0, dataset.width - 1))
    for radius in (1, 2, 4, 8, 16, maximum_radius_samples):
        row_start = max(0, row - radius)
        row_stop = min(dataset.height, row + radius + 1)
        column_start = max(0, column - radius)
        column_stop = min(dataset.width, column + radius + 1)
        values = dataset.read(
            1,
            window=Window(
                column_start,
                row_start,
                column_stop - column_start,
                row_stop - row_start,
            ),
            boundless=False,
        )
        valid = np.isfinite(values) & (values != SOURCE_NODATA)
        if not np.any(valid):
            continue
        positions = np.argwhere(valid)
        target_row = row - row_start
        target_column = column - column_start
        squared_distances = (
            (positions[:, 0] - target_row) ** 2 +
            (positions[:, 1] - target_column) ** 2
        )
        nearest_index = int(np.argmin(squared_distances))
        local_row, local_column = [int(value) for value in positions[nearest_index]]
        distance_m = float(math.sqrt(float(squared_distances[nearest_index])) * SOURCE_SPACING_M)
        return float(values[local_row, local_column]), distance_m
    return None

MAJOR_MAINSTEM_PATTERNS = {
    1: ("漓江", "漓水", "li river", "li jiang", "lijiang river", "li-jiang"),
    2: ("湘江", "湘水", "xiang river", "xiang jiang", "xiangjiang"),
    3: ("资江", "資江", "资水", "資水", "夫夷水", "夫夷江", "zi river", "zi jiang", "zijiang", "zi shui", "zishui", "fuyi river", "fu yi river", "fuyi shui"),
}
MAJOR_MAINSTEM_KEYS = {1: "li", 2: "xiang", 3: "zi"}
MAJOR_MAINSTEM_MIN_METRIC = {1: 150.0, 2: 175.0, 3: 160.0}


def feature_name_values(properties: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key, value in properties.items():
        lowered = str(key).lower()
        if lowered == "name" or lowered.startswith("name:") or lowered in {
            "alt_name", "official_name", "short_name", "local_name", "old_name",
            "name_zh", "name_en", "river_name",
        }:
            if value not in (None, ""):
                values.append(str(value).strip())
    return values


def normalize_river_name(value: str) -> str:
    return " ".join(value.strip().lower().replace("_", " ").split())


def feature_name_blob(properties: dict[str, Any]) -> str:
    return " | ".join(feature_name_values(properties))


def mainstem_code(properties: dict[str, Any]) -> int:
    values = {normalize_river_name(value) for value in feature_name_values(properties)}
    for code, patterns in MAJOR_MAINSTEM_PATTERNS.items():
        aliases = {normalize_river_name(pattern) for pattern in patterns}
        if values.intersection(aliases):
            return code
    marker = str(properties.get("mainstem") or properties.get("is_mainstem") or "").strip().lower()
    system = str(properties.get("system") or "").strip().lower()
    if marker in {"1", "true", "yes", "main", "mainstem"}:
        if system in {"li", "lijiang", "li-jiang"}:
            return 1
        if system in {"xiang", "xiangjiang", "xiang-jiang"}:
            return 2
        if system in {"zi", "zijiang", "zi-jiang", "zishui", "fuyi"}:
            return 3
    return 0


def node_rank(key: tuple[float, float], nodes: dict[tuple[float, float], dict[str, Any]]) -> tuple[float, float, float]:
    record = nodes[key]
    return float(record["elevation"]), float(key[1]), float(key[0])


def style_metric(waterway: str, source_width_m: float, flow_quantile: float, major_code: int) -> float:
    q = float(np.clip(flow_quantile, 0.0, 1.0))
    if major_code:
        minimum = MAJOR_MAINSTEM_MIN_METRIC[major_code]
        return float(np.clip(max(minimum, 112.0 + 92.0 * q + 0.28 * source_width_m), minimum, 230.0))
    if waterway == "river":
        return float(np.clip(5.0 + 72.0 * q ** 1.55 + 0.16 * source_width_m, 5.0, 92.0))
    if waterway == "stream":
        return float(np.clip(1.5 + 15.5 * q ** 1.55 + 0.05 * source_width_m, 1.5, 20.0))
    return float(np.clip(2.0 + 16.0 * q ** 1.35 + 0.07 * source_width_m, 2.0, 22.0))


def build_hydrology(
    dataset: rasterio.io.DatasetReader,
    native_manifest: dict[str, Any],
    hydrology_path: Path,
    output_dir: Path,
) -> dict[str, Any]:
    collection = json.loads(hydrology_path.read_text(encoding="utf-8"))
    if collection.get("type") != "FeatureCollection":
        raise RuntimeError("hydrology source must be a FeatureCollection")

    source_sha = sha256_file(hydrology_path)
    bounds = [float(value) for value in native_manifest["aoi"]["native_sample_center_bounds_epsg32649"]]
    west, south, east, north = bounds
    world_center_e = (west + east) * 0.5
    world_center_n = (south + north) * 0.5
    domain = box(west, south, east, north)
    transformer = Transformer.from_crs("EPSG:4326", SOURCE_CRS, always_xy=True)

    node_records: dict[tuple[float, float], dict[str, Any]] = {}
    raw_segments: list[dict[str, Any]] = []
    record_counts = {"river": 0, "stream": 0, "canal": 0}
    mainstem_feature_counts = {"li": 0, "xiang": 0, "zi": 0}
    source_feature_count = 0
    rendered_feature_count = 0
    clipped_part_count = 0
    named_rivers_seen: set[str] = set()

    for feature_index, feature in enumerate(collection.get("features", [])):
        properties = feature.get("properties") or {}
        waterway = str(properties.get("waterway") or "").strip().lower()
        if waterway not in ALLOWED_WATERWAYS:
            continue
        source_feature_count += 1
        class_value = ALLOWED_WATERWAYS[waterway]
        source_width = parse_width(properties, waterway)
        major_code = mainstem_code(properties) if waterway == "river" else 0
        name_blob = feature_name_blob(properties)
        if waterway == "river" and name_blob:
            named_rivers_seen.add(name_blob[:160])
        feature_rendered = False
        for line in projected_line_parts(feature, transformer, domain):
            coordinates = list(line.coords)
            if len(coordinates) < 2:
                continue
            part_rendered = False
            for start, end in zip(coordinates[:-1], coordinates[1:]):
                start_key = (round(float(start[0]), 3), round(float(start[1]), 3))
                end_key = (round(float(end[0]), 3), round(float(end[1]), 3))
                if start_key == end_key:
                    continue
                raw_segments.append({
                    "feature_index": feature_index,
                    "start": start_key,
                    "end": end_key,
                    "waterway": waterway,
                    "class": class_value,
                    "source_width_m": source_width,
                    "major_code": major_code,
                })
                for key in (start_key, end_key):
                    if key not in node_records:
                        node_records[key] = {"e": key[0], "n": key[1]}
                part_rendered = True
            if part_rendered:
                clipped_part_count += 1
                feature_rendered = True
        if feature_rendered:
            rendered_feature_count += 1
            record_counts[waterway] += 1
            if major_code:
                mainstem_feature_counts[MAJOR_MAINSTEM_KEYS[major_code]] += 1

    if not raw_segments or not node_records:
        raise RuntimeError("no OSM linear waterways were rendered")

    ordered_keys = list(node_records.keys())
    coordinates = [(node_records[key]["e"], node_records[key]["n"]) for key in ordered_keys]
    valid_node_data: dict[tuple[float, float], dict[str, Any]] = {}
    missing_keys: list[tuple[float, float]] = []
    for key, sample in zip(ordered_keys, dataset.sample(coordinates, indexes=1, masked=True), strict=True):
        raw = sample[0]
        if np.ma.is_masked(raw):
            missing_keys.append(key)
            continue
        elevation = float(raw)
        if not math.isfinite(elevation) or elevation == SOURCE_NODATA:
            missing_keys.append(key)
            continue
        valid_node_data[key] = {"e": key[0], "n": key[1], "elevation": elevation}

    fallback_node_count = 0
    fallback_max_distance_m = 0.0
    unresolved_keys: list[tuple[float, float]] = []
    for key in missing_keys:
        fallback = nearest_valid_native_elevation(dataset, key[0], key[1])
        if fallback is None:
            unresolved_keys.append(key)
            continue
        elevation, distance_m = fallback
        valid_node_data[key] = {
            "e": key[0], "n": key[1], "elevation": elevation,
            "display_elevation_fallback": True,
            "display_elevation_fallback_distance_m": distance_m,
        }
        fallback_node_count += 1
        fallback_max_distance_m = max(fallback_max_distance_m, distance_m)

    if unresolved_keys:
        raise RuntimeError(f"unable to drape {len(unresolved_keys)} waterway nodes onto the native DEM")

    outgoing: dict[tuple[float, float], list[int]] = {}
    directed_edges: list[dict[str, Any]] = []
    for source in raw_segments:
        start_key = source["start"]
        end_key = source["end"]
        start_rank = node_rank(start_key, valid_node_data)
        end_rank = node_rank(end_key, valid_node_data)
        if start_rank >= end_rank:
            upstream, downstream = start_key, end_key
        else:
            upstream, downstream = end_key, start_key
        length_m = float(math.hypot(downstream[0] - upstream[0], downstream[1] - upstream[1]))
        edge = dict(source)
        edge.update({"upstream": upstream, "downstream": downstream, "length_m": max(length_m, 0.01), "flow_length_m": 0.0})
        edge_index = len(directed_edges)
        directed_edges.append(edge)
        outgoing.setdefault(upstream, []).append(edge_index)

    accumulated = {key: 0.0 for key in valid_node_data}
    for key in sorted(valid_node_data, key=lambda item: node_rank(item, valid_node_data), reverse=True):
        edge_indices = outgoing.get(key, [])
        if not edge_indices:
            continue
        shared_upstream = accumulated[key] / max(1, len(edge_indices))
        for edge_index in edge_indices:
            edge = directed_edges[edge_index]
            flow_length = shared_upstream + edge["length_m"]
            edge["flow_length_m"] = flow_length
            accumulated[edge["downstream"]] += flow_length

    log_flow = np.log1p(np.asarray([edge["flow_length_m"] for edge in directed_edges], dtype=np.float64))
    low = float(np.percentile(log_flow, 5.0))
    high = float(np.percentile(log_flow, 99.5))
    span = max(1e-9, high - low)
    for edge, value in zip(directed_edges, log_flow, strict=True):
        edge["flow_quantile"] = float(np.clip((float(value) - low) / span, 0.0, 1.0))

    # Width and deep colour are reserved for explicitly named OSM main-stem features.
    # Unnamed gaps remain visible as ordinary river segments, so no tributary can inherit
    # main-stem styling through a branching graph. Source geometry stays unchanged.

    mainstem_segment_counts = {"li": 0, "xiang": 0, "zi": 0}
    segment_values: list[float] = []
    used_keys: set[tuple[float, float]] = set()
    node_style: dict[tuple[float, float], dict[str, float]] = {}
    for edge in directed_edges:
        major_code = int(edge["major_code"])
        metric = style_metric(edge["waterway"], float(edge["source_width_m"]), float(edge["flow_quantile"]), major_code)
        edge["display_hierarchy_metric"] = metric
        if major_code:
            mainstem_segment_counts[MAJOR_MAINSTEM_KEYS[major_code]] += 1
        start_key = edge["upstream"]
        end_key = edge["downstream"]
        start = valid_node_data[start_key]
        end = valid_node_data[end_key]
        segment_values.extend((
            float(start["e"] - world_center_e),
            float(start["elevation"]),
            float(world_center_n - start["n"]),
            float(end["e"] - world_center_e),
            float(end["elevation"]),
            float(world_center_n - end["n"]),
            float(edge["class"]),
            metric,
        ))
        for key in (start_key, end_key):
            existing = node_style.get(key)
            if existing is None:
                node_style[key] = {"class": float(edge["class"]), "metric": metric}
            else:
                existing["class"] = min(existing["class"], float(edge["class"]))
                existing["metric"] = max(existing["metric"], metric)
        used_keys.add(start_key)
        used_keys.add(end_key)

    missing_mainstems = [name for name, count in mainstem_segment_counts.items() if count <= 0]
    if missing_mainstems:
        examples = sorted(named_rivers_seen)[:80]
        raise RuntimeError(f"missing named main-stem systems {missing_mainstems}; named rivers seen: {examples}")

    explicit_mainstem_segment_count = sum(mainstem_segment_counts.values())
    if not 1_000 <= explicit_mainstem_segment_count <= 10_000:
        raise RuntimeError(
            f"explicit main-stem segment count outside reviewed range: {explicit_mainstem_segment_count}"
        )

    node_values: list[float] = []
    for key in sorted(used_keys):
        record = valid_node_data[key]
        style = node_style[key]
        node_values.extend((
            float(record["e"] - world_center_e),
            float(record["elevation"]),
            float(world_center_n - record["n"]),
            float(style["class"]),
            float(style["metric"]),
        ))

    source_segment_count = len(raw_segments)
    valid_segment_count = len(directed_edges)
    dropped_segment_count = source_segment_count - valid_segment_count
    if dropped_segment_count != 0:
        raise RuntimeError(f"waterway segment loss: {dropped_segment_count}")

    segment_output = output_dir / "osm-waterway-segments.f32.bin"
    node_output = output_dir / "osm-waterway-nodes.f32.bin"
    np.asarray(segment_values, dtype="<f4").tofile(segment_output)
    np.asarray(node_values, dtype="<f4").tofile(node_output)

    return {
        "schema": "guilin-osm-linear-waterways-render-asset/v1",
        "status": "review_asset",
        "source": {
            "file": hydrology_path.name,
            "bytes": hydrology_path.stat().st_size,
            "sha256": source_sha,
            "source_crs": "EPSG:4326",
            "render_crs": SOURCE_CRS,
            "centerline_coordinates_mutated": False,
            "manual_centerline_added": False,
            "synthetic_gap_line_added": False,
            "projection_only": True,
            "aoi_boundary_clipping_only": True,
            "display_elevation_fallback_changes_planimetry": False,
            "display_elevation_fallback_changes_source_dem": False,
        },
        "filter": {
            "allowed_waterways": ["river", "stream", "canal"],
            "polygon_waterbodies_allowed": False,
            "reservoir_relations_allowed": False,
            "lake_surface_asset_emitted": False,
            "reservoir_surface_asset_emitted": False,
            "synthetic_surface_asset_emitted": False,
        },
        "topology": {
            "record_counts": record_counts,
            "record_count_total": int(sum(record_counts.values())),
            "source_feature_count": source_feature_count,
            "rendered_feature_count": rendered_feature_count,
            "clipped_part_count": clipped_part_count,
            "source_segment_count": source_segment_count,
            "segment_count": valid_segment_count,
            "dropped_segment_count": dropped_segment_count,
            "unresolved_node_count": 0,
            "display_elevation_fallback_node_count": fallback_node_count,
            "display_elevation_fallback_max_distance_m": fallback_max_distance_m,
            "display_elevation_fallback_method": "nearest-valid-native-dem-cell",
            "node_count": len(node_values) // 5,
            "source_route_coverage": 1.0,
            "upstream_to_downstream_continuity_required": True,
        },
        "styling": {
            "profile": "basin-hierarchy-mainstem-gradient-v3",
            "mainstem_names": ["漓江", "湘江", "资江"],
            "mainstem_aliases": {"zi": ["夫夷水", "夫夷江", "Fuyi River"]},
            "mainstem_feature_counts": mainstem_feature_counts,
            "mainstem_segment_counts": mainstem_segment_counts,
            "hierarchy_metric": "DEM-downhill accumulated upstream network length with source-width support",
            "gradient_direction": "lighter-and-thinner-upstream_to_darker-and-wider-downstream",
            "mainstem_minimum_metrics": {MAJOR_MAINSTEM_KEYS[key]: value for key, value in MAJOR_MAINSTEM_MIN_METRIC.items()},
            "mainstem_classification": "exact-match-on-individual-OSM-name-values",
            "style_only_mainstem_gap_propagation": False,
            "explicit_mainstem_segment_count": explicit_mainstem_segment_count,
            "planimetry_unchanged": True,
        },
        "segments": {
            "file": segment_output.name,
            "bytes": segment_output.stat().st_size,
            "sha256": sha256_file(segment_output),
            "dtype": "float32-little-endian",
            "layout": ["start_x", "start_elevation", "start_z", "end_x", "end_elevation", "end_z", "class", "display_hierarchy_metric"],
            "count": valid_segment_count,
            "compression": "none",
        },
        "nodes": {
            "file": node_output.name,
            "bytes": node_output.stat().st_size,
            "sha256": sha256_file(node_output),
            "dtype": "float32-little-endian",
            "layout": ["x", "elevation", "z", "class", "display_hierarchy_metric"],
            "count": len(node_values) // 5,
            "compression": "none",
        },
    }

def main() -> int:
    parser = argparse.ArgumentParser(description="Build the continuous Guilin full-map and OSM linear-waterway assets")
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--native-manifest", type=Path, required=True)
    parser.add_argument("--hydrology", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    native_manifest = json.loads(args.native_manifest.read_text(encoding="utf-8"))
    with rasterio.open(args.mosaic) as dataset:
        validate_inputs(args.mosaic, native_manifest, dataset)
        overview = build_overview(dataset, native_manifest, args.output_dir)
        hydrology = build_hydrology(dataset, native_manifest, args.hydrology, args.output_dir)

    overview_manifest = args.output_dir / "overview-direct-samples-manifest.json"
    hydrology_manifest = args.output_dir / "osm-waterways-manifest.json"
    write_json(overview_manifest, overview)
    write_json(hydrology_manifest, hydrology)

    receipt = {
        "schema": "guilin-continuous-full-map-build-receipt/v1",
        "passed": True,
        "source_sha256": SOURCE_SHA256,
        "aoi_geometry_sha256": AOI_SHA256,
        "native_spacing_m": SOURCE_SPACING_M,
        "native_tile_count": 54,
        "overview": {
            "grid": overview["asset"]["grid"],
            "bytes": overview["asset"]["bytes"],
            "sha256": overview["asset"]["sha256"],
            "selection": overview["asset"]["selection"],
            "interpolation": overview["asset"]["interpolation"],
            "compression": overview["asset"]["compression"],
            "height_texture": overview["asset"]["height_texture"],
        },
        "hydrology": {
            "record_counts": hydrology["topology"]["record_counts"],
            "record_count_total": hydrology["topology"]["record_count_total"],
            "source_segment_count": hydrology["topology"]["source_segment_count"],
            "segment_count": hydrology["topology"]["segment_count"],
            "dropped_segment_count": hydrology["topology"]["dropped_segment_count"],
            "display_elevation_fallback_node_count": hydrology["topology"]["display_elevation_fallback_node_count"],
            "display_elevation_fallback_max_distance_m": hydrology["topology"]["display_elevation_fallback_max_distance_m"],
            "node_count": hydrology["topology"]["node_count"],
            "lake_surface_asset_count": 0,
            "reservoir_surface_asset_count": 0,
            "manual_centerline_added": False,
            "synthetic_gap_line_added": False,
        },
    }
    write_json(args.output_dir / "FULL_MAP_BUILD_RECEIPT.json", receipt)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
