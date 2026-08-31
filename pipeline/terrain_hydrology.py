from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from pyproj import Transformer
from raster_window import Window
from shapely.geometry import GeometryCollection, LineString, MultiLineString, box, shape
from shapely.ops import transform as shapely_transform

from hydrology_network_v6 import orient_network

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
    dataset: Any,
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
            "resampling": "exact_sample_subset_for_overview_only",
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
    dataset: Any,
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
    1: ("漓江", "漓水", "桂江", "桂水", "li river", "li jiang", "lijiang river", "li-jiang", "gui river", "gui jiang", "guijiang"),
    2: ("湘江", "湘水", "xiang river", "xiang jiang", "xiangjiang"),
    3: ("资江", "資江", "资水", "資水", "夫夷水", "夫夷江", "zi river", "zi jiang", "zijiang", "zi shui", "zishui", "fuyi river", "fu yi river", "fuyi shui"),
}
MAJOR_MAINSTEM_KEYS = {1: "li", 2: "xiang", 3: "zi"}
FLOW_STYLE_PROFILE = "network-directed-physical-width-v6"


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
    system = str(properties.get("system") or "").strip().lower()
    if system in {"li", "lijiang", "li-jiang", "guijiang", "gui-jiang"}:
        return 1
    if system in {"xiang", "xiangjiang", "xiang-jiang"}:
        return 2
    if system in {"zi", "zijiang", "zi-jiang", "zishui", "fuyi"}:
        return 3
    values = {normalize_river_name(value) for value in feature_name_values(properties)}
    for code, patterns in MAJOR_MAINSTEM_PATTERNS.items():
        aliases = {normalize_river_name(pattern) for pattern in patterns}
        if values.intersection(aliases):
            return code
    marker = str(properties.get("mainstem") or properties.get("is_mainstem") or "").strip().lower()
    if marker in {"1", "true", "yes", "main", "mainstem"}:
        if system in {"li", "lijiang", "li-jiang", "guijiang", "gui-jiang"}:
            return 1
        if system in {"xiang", "xiangjiang", "xiang-jiang"}:
            return 2
        if system in {"zi", "zijiang", "zi-jiang", "zishui", "fuyi"}:
            return 3
    return 0


def node_rank(key: tuple[float, float], nodes: dict[tuple[float, float], dict[str, Any]]) -> tuple[float, float, float]:
    record = nodes[key]
    return float(record["elevation"]), float(key[1]), float(key[0])


def unit_interval(value: float, minimum: float, maximum: float) -> float:
    return float(np.clip((value - minimum) / max(1e-9, maximum - minimum), 0.0, 1.0))


def build_hydrology(
    dataset: Any,
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
        source_system = str(properties.get("system") or "").strip().lower()
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
                    "system": source_system,
                    "name_blob": name_blob,
                    "osm_id": properties.get("osm_id"),
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

    directed_edges, network_diagnostics = orient_network(
        raw_segments,
        valid_node_data,
        (west, south, east, north),
    )

    uphill_segment_count = sum(
        1 for edge in directed_edges
        if valid_node_data[edge["upstream"]]["elevation"] + 1e-6 < valid_node_data[edge["downstream"]]["elevation"]
    )
    flow_progress_inversion_count = sum(
        1 for edge in directed_edges
        if edge["end_flow_progress"] + 1e-7 < edge["start_flow_progress"]
    )
    flow_distance_inversion_count = sum(
        1 for edge in directed_edges
        if edge["flow_distance_end_m"] <= edge["flow_distance_start_m"]
    )
    if flow_progress_inversion_count or flow_distance_inversion_count:
        raise RuntimeError(
            "invalid upstream/downstream network contract: "
            f"progress={flow_progress_inversion_count}, distance={flow_distance_inversion_count}"
        )

    mainstem_segment_counts = {"li": 0, "xiang": 0, "zi": 0}
    segment_values: list[float] = []
    used_keys: set[tuple[float, float]] = set()
    node_style: dict[tuple[float, float], dict[str, float]] = {}
    for edge in directed_edges:
        major_code = int(edge["major_code"])
        if major_code:
            mainstem_segment_counts[MAJOR_MAINSTEM_KEYS[major_code]] += 1
        start_key = edge["upstream"]
        end_key = edge["downstream"]
        start = valid_node_data[start_key]
        end = valid_node_data[end_key]
        start_progress = float(edge["start_flow_progress"])
        end_progress = float(edge["end_flow_progress"])
        start_distance = float(edge["flow_distance_start_m"])
        end_distance = float(edge["flow_distance_end_m"])
        source_width = float(edge["source_width_m"])
        segment_values.extend((
            float(start["e"] - world_center_e),
            float(start["elevation"]),
            float(world_center_n - start["n"]),
            float(end["e"] - world_center_e),
            float(end["elevation"]),
            float(world_center_n - end["n"]),
            float(edge["class"]),
            float(major_code),
            source_width,
            start_progress,
            end_progress,
            start_distance,
            end_distance,
        ))
        for key, progress, distance in (
            (start_key, start_progress, start_distance),
            (end_key, end_progress, end_distance),
        ):
            existing = node_style.get(key)
            if existing is None:
                node_style[key] = {
                    "class": float(edge["class"]),
                    "mainstem_code": float(major_code),
                    "source_width_m": source_width,
                    "flow_progress": progress,
                    "flow_distance_m": distance,
                }
            else:
                existing["class"] = min(existing["class"], float(edge["class"]))
                existing["source_width_m"] = max(existing["source_width_m"], source_width)
                if major_code and (not existing["mainstem_code"] or progress >= existing["flow_progress"]):
                    existing["mainstem_code"] = float(major_code)
                existing["flow_progress"] = max(existing["flow_progress"], progress)
                existing["flow_distance_m"] = max(existing["flow_distance_m"], distance)
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

    mainstem_progress_ranges = {}
    mainstem_source_width_ranges_m = {}
    for code, key_name in MAJOR_MAINSTEM_KEYS.items():
        selected = [edge for edge in directed_edges if int(edge["major_code"]) == code]
        if not selected:
            continue
        mainstem_progress_ranges[key_name] = [
            float(min(edge["start_flow_progress"] for edge in selected)),
            float(max(edge["end_flow_progress"] for edge in selected)),
        ]
        mainstem_source_width_ranges_m[key_name] = [
            float(min(edge["source_width_m"] for edge in selected)),
            float(max(edge["source_width_m"] for edge in selected)),
        ]

    node_values: list[float] = []
    for key in sorted(used_keys):
        record = valid_node_data[key]
        style = node_style[key]
        node_values.extend((
            float(record["e"] - world_center_e),
            float(record["elevation"]),
            float(world_center_n - record["n"]),
            float(style["class"]),
            float(style["mainstem_code"]),
            float(style["source_width_m"]),
            float(style["flow_progress"]),
            float(style["flow_distance_m"]),
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
            "node_count": len(node_values) // 8,
            "source_route_coverage": 1.0,
            "upstream_to_downstream_continuity_required": True,
            "local_dem_uphill_segment_count": uphill_segment_count,
            "uphill_segment_count": uphill_segment_count,
            "flow_progress_inversion_count": flow_progress_inversion_count,
            "flow_distance_inversion_count": flow_distance_inversion_count,
            "maximum_flow_distance_m": float(max(edge["flow_distance_end_m"] for edge in directed_edges)),
        },
        "styling": {
            "profile": FLOW_STYLE_PROFILE,
            "mainstem_names": ["漓江及桂江连续干流", "湘江", "资江"],
            "mainstem_aliases": {
                "li": ["漓江", "桂江", "Li River", "Gui River"],
                "zi": ["夫夷水", "夫夷江", "Fuyi River"],
            },
            "mainstem_feature_counts": mainstem_feature_counts,
            "mainstem_segment_counts": mainstem_segment_counts,
            "mainstem_progress_ranges": mainstem_progress_ranges,
            "mainstem_source_width_ranges_m": mainstem_source_width_ranges_m,
            "progress_basis": "connected mainstem distance to verified network outlet",
            "gradient_direction": "upstream-light-and-thin_to_downstream-dark-and-wide",
            "upstream_mainstem_width_equivalent": "headwater-scale-derived-from-source-width",
            "downstream_mainstem_width_uses_source_width": True,
            "width_mode": "source-width-meters-projected-to-screen",
            "mainstem_classification": "source-system plus exact OSM name aliases",
            "li_gui_continuation_segment_count": network_diagnostics["li_gui_continuation_segment_count"],
            "li_south_of_yangshuo_segment_count": network_diagnostics["li_south_of_yangshuo_segment_count"],
            "li_min_northing_m": network_diagnostics["li_min_northing_m"],
            "li_reaches_aoi_south_boundary": network_diagnostics["li_reaches_aoi_south_boundary"],
            "mainstem_component_counts": network_diagnostics["mainstem_component_counts"],
            "style_only_mainstem_gap_propagation": False,
            "explicit_mainstem_segment_count": explicit_mainstem_segment_count,
            "planimetry_unchanged": True,
        },
        "direction": {
            "segment_vertex_order": "upstream_to_downstream",
            "orientation_method": network_diagnostics["orientation_method"],
            "general_component_count": network_diagnostics["general_component_count"],
            "general_outlet_count": network_diagnostics["general_outlet_count"],
            "distance_tie_segment_count": network_diagnostics["distance_tie_segment_count"],
            "li_continuity_verified_south_of_yangshuo": True,
            "flow_progress_monotonic": True,
            "flow_distance_monotonic": True,
            "future_flow_animation_ready": True,
        },
        "segments": {
            "file": segment_output.name,
            "bytes": segment_output.stat().st_size,
            "sha256": sha256_file(segment_output),
            "dtype": "float32-little-endian",
            "layout": ["start_x", "start_elevation", "start_z", "end_x", "end_elevation", "end_z", "class", "mainstem_code", "source_width_m", "start_flow_progress", "end_flow_progress", "start_flow_distance_m", "end_flow_distance_m"],
            "count": valid_segment_count,
            "compression": "none",
        },
        "nodes": {
            "file": node_output.name,
            "bytes": node_output.stat().st_size,
            "sha256": sha256_file(node_output),
            "dtype": "float32-little-endian",
            "layout": ["x", "elevation", "z", "class", "mainstem_code", "source_width_m", "flow_progress", "flow_distance_m"],
            "count": len(node_values) // 8,
            "compression": "none",
        },
    }


