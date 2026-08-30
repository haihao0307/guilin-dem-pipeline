from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np

SEGMENT_STRIDE = 13
NODE_STRIDE = 8
RUNTIME_PROFILE = "knowledge-indexed-connected-routes-v6"
TILE_RUNTIME_BASE_URL = "../guilin-truth-data/native/"
CLASS_BUDGETS = {0: 12_000, 1: 2_500, 2: 500}
TOTAL_SEGMENT_LIMIT = 30_000


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def node_key(x: float, z: float) -> tuple[float, float]:
    return round(float(x), 3), round(float(z), 3)


def segment_length(segment: np.ndarray) -> float:
    return float(math.hypot(float(segment[3] - segment[0]), float(segment[5] - segment[2])))


def node_record_from_segment(segment: np.ndarray, endpoint: int) -> tuple[float, ...]:
    if endpoint == 0:
        return (
            float(segment[0]), float(segment[1]), float(segment[2]),
            float(segment[6]), float(segment[7]), float(segment[8]),
            float(segment[9]), float(segment[11]),
        )
    return (
        float(segment[3]), float(segment[4]), float(segment[5]),
        float(segment[6]), float(segment[7]), float(segment[8]),
        float(segment[10]), float(segment[12]),
    )


def build_runtime_nodes(segments: np.ndarray) -> np.ndarray:
    records: dict[tuple[float, float], tuple[float, ...]] = {}
    degree: Counter[tuple[float, float]] = Counter()
    for segment in segments:
        start_key = node_key(segment[0], segment[2])
        end_key = node_key(segment[3], segment[5])
        degree[start_key] += 1
        degree[end_key] += 1
        for endpoint in (0, 1):
            record = node_record_from_segment(segment, endpoint)
            key = node_key(record[0], record[2])
            previous = records.get(key)
            if previous is None:
                records[key] = record
                continue
            if record[4] > previous[4] or (record[4] == previous[4] and record[6] > previous[6]):
                records[key] = record
    ordered = []
    for key in sorted(records):
        record = list(records[key])
        record[7] = max(record[7], float(degree[key]))
        ordered.append(record)
    return np.asarray(ordered, dtype="<f4")


def build_graph(segments: np.ndarray):
    outgoing: dict[tuple[float, float], list[int]] = defaultdict(list)
    incoming: dict[tuple[float, float], list[int]] = defaultdict(list)
    starts: list[tuple[float, float]] = []
    ends: list[tuple[float, float]] = []
    for index, segment in enumerate(segments):
        start = node_key(segment[0], segment[2])
        end = node_key(segment[3], segment[5])
        starts.append(start)
        ends.append(end)
        outgoing[start].append(index)
        incoming[end].append(index)
    return outgoing, incoming, starts, ends


def choose_downstream(candidates: list[int], segments: np.ndarray, visited: set[int]) -> int | None:
    available = [index for index in candidates if index not in visited]
    if not available:
        return None
    return max(
        available,
        key=lambda index: (
            1 if segments[index, 7] > 0.5 else 0,
            float(segments[index, 8]),
            float(segments[index, 10]),
            segment_length(segments[index]),
            -index,
        ),
    )


def trace_route(
    seed_index: int,
    segments: np.ndarray,
    outgoing: dict[tuple[float, float], list[int]],
    ends: list[tuple[float, float]],
    selected: set[int],
) -> tuple[list[int], tuple[float, float], str]:
    route: list[int] = []
    visited: set[int] = set()
    current = seed_index
    terminal = ends[current]
    reason = "outlet"
    while current is not None and current not in visited:
        if current in selected:
            terminal = node_key(segments[current, 0], segments[current, 2])
            reason = "joined-selected-network"
            break
        visited.add(current)
        route.append(current)
        terminal = ends[current]
        next_candidates = outgoing.get(terminal, [])
        selected_next = [index for index in next_candidates if index in selected]
        if selected_next:
            reason = "joined-selected-network"
            break
        current = choose_downstream(next_candidates, segments, visited)
        if current is None:
            reason = "outlet"
            break
    if current in visited and current is not None:
        reason = "cycle"
    return route, terminal, reason


def route_metrics(route: list[int], segments: np.ndarray, reason: str) -> dict[str, Any]:
    class_counts = Counter(int(round(float(segments[index, 6]))) for index in route if segments[index, 7] <= 0.5)
    return {
        "route": route,
        "reason": reason,
        "class_counts": dict(class_counts),
        "max_width": max((float(segments[index, 8]) for index in route), default=0.0),
        "max_progress": max((float(segments[index, 10]) for index in route), default=0.0),
        "length_m": sum(segment_length(segments[index]) for index in route),
        "contains_mainstem": any(segments[index, 7] > 0.5 for index in route),
    }


def select_connected_routes(segments: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    outgoing, incoming, starts, ends = build_graph(segments)
    main_indices = set(int(index) for index in np.flatnonzero(segments[:, 7] > 0.5))
    selected = set(main_indices)
    ordinary_indices = [index for index in range(len(segments)) if index not in main_indices]

    headwater_seeds = []
    for index in ordinary_indices:
        start = starts[index]
        ordinary_incoming = [candidate for candidate in incoming.get(start, []) if candidate not in main_indices]
        if not ordinary_incoming:
            headwater_seeds.append(index)

    route_records: list[dict[str, Any]] = []
    seen_seeds: set[int] = set()
    for seed in headwater_seeds:
        if seed in seen_seeds:
            continue
        route, _, reason = trace_route(seed, segments, outgoing, ends, selected)
        if not route or reason == "cycle":
            continue
        seen_seeds.update(route)
        route_records.append(route_metrics(route, segments, reason))

    route_records.sort(
        key=lambda item: (
            item["reason"] == "joined-selected-network",
            item["max_width"],
            item["max_progress"],
            item["length_m"],
        ),
        reverse=True,
    )

    used_budgets = Counter()
    accepted_route_count = 0
    skipped_for_budget = 0
    for record in route_records:
        additions = [index for index in record["route"] if index not in selected]
        if not additions:
            continue
        counts = Counter(int(round(float(segments[index, 6]))) for index in additions)
        if len(selected) + len(additions) > TOTAL_SEGMENT_LIMIT:
            skipped_for_budget += 1
            continue
        if any(used_budgets[class_index] + counts[class_index] > CLASS_BUDGETS[class_index] for class_index in CLASS_BUDGETS):
            skipped_for_budget += 1
            continue
        selected.update(additions)
        used_budgets.update(counts)
        accepted_route_count += 1

    fallback_candidates = sorted(
        (index for index in ordinary_indices if index not in selected),
        key=lambda index: (
            float(segments[index, 8]),
            float(segments[index, 10]),
            segment_length(segments[index]),
        ),
        reverse=True,
    )
    fallback_route_count = 0
    for seed in fallback_candidates:
        class_index = int(round(float(segments[seed, 6])))
        if used_budgets[class_index] >= CLASS_BUDGETS[class_index]:
            continue
        route, _, reason = trace_route(seed, segments, outgoing, ends, selected)
        if not route or reason == "cycle":
            continue
        additions = [index for index in route if index not in selected]
        counts = Counter(int(round(float(segments[index, 6]))) for index in additions)
        if len(selected) + len(additions) > TOTAL_SEGMENT_LIMIT:
            continue
        if any(used_budgets[key] + counts[key] > CLASS_BUDGETS[key] for key in CLASS_BUDGETS):
            continue
        selected.update(additions)
        used_budgets.update(counts)
        fallback_route_count += 1

    selected_indices = np.asarray(sorted(selected), dtype=np.int64)
    runtime_segments = np.asarray(segments[selected_indices], dtype="<f4")

    selected_outgoing: dict[tuple[float, float], list[int]] = defaultdict(list)
    for index in selected_indices:
        selected_outgoing[starts[int(index)]].append(int(index))

    route_breaks = []
    for index in selected_indices:
        index = int(index)
        if segments[index, 7] > 0.5:
            continue
        end = ends[index]
        full_next = outgoing.get(end, [])
        selected_next = selected_outgoing.get(end, [])
        if full_next and not selected_next:
            route_breaks.append(index)
    if route_breaks:
        raise RuntimeError(f"distilled routes contain {len(route_breaks)} internal downstream breaks")

    diagnostics = {
        "mainstem_segment_count": len(main_indices),
        "headwater_seed_count": len(headwater_seeds),
        "candidate_route_count": len(route_records),
        "accepted_route_count": accepted_route_count,
        "fallback_route_count": fallback_route_count,
        "skipped_route_count_for_budget": skipped_for_budget,
        "ordinary_class_budgets": {str(key): value for key, value in CLASS_BUDGETS.items()},
        "ordinary_class_selected": {str(key): int(used_budgets[key]) for key in CLASS_BUDGETS},
        "runtime_route_break_count": 0,
        "selection_method": "complete headwater-to-mainstem-or-outlet routes",
    }
    return runtime_segments, diagnostics


def main() -> int:
    parser = argparse.ArgumentParser(description="Distill Guilin truth into a connected-route first-load runtime")
    parser.add_argument("--native-manifest", type=Path, required=True)
    parser.add_argument("--overview-manifest", type=Path, required=True)
    parser.add_argument("--hydrology-manifest", type=Path, required=True)
    parser.add_argument("--segments", type=Path, required=True)
    parser.add_argument("--nodes", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    native = read_json(args.native_manifest)
    overview = read_json(args.overview_manifest)
    hydrology = read_json(args.hydrology_manifest)
    raw = np.fromfile(args.segments, dtype="<f4")
    if raw.size % SEGMENT_STRIDE:
        raise RuntimeError(f"invalid full hydrology segment float count: {raw.size}")
    full_segments = raw.reshape((-1, SEGMENT_STRIDE))
    expected_full_count = int(hydrology["segments"]["count"])
    if len(full_segments) != expected_full_count:
        raise RuntimeError(f"full hydrology count mismatch: {len(full_segments)} != {expected_full_count}")

    runtime_segments, route_diagnostics = select_connected_routes(full_segments)
    runtime_nodes = build_runtime_nodes(runtime_segments)
    segment_output = args.output_dir / "osm-waterway-segments.f32.bin"
    node_output = args.output_dir / "osm-waterway-nodes.f32.bin"
    runtime_segments.tofile(segment_output)
    runtime_nodes.tofile(node_output)

    main_counts = {
        "li": int(np.count_nonzero(runtime_segments[:, 7] == 1.0)),
        "xiang": int(np.count_nonzero(runtime_segments[:, 7] == 2.0)),
        "zi": int(np.count_nonzero(runtime_segments[:, 7] == 3.0)),
    }
    full_main_counts = hydrology["styling"]["mainstem_segment_counts"]
    for name in main_counts:
        if main_counts[name] != int(full_main_counts[name]):
            raise RuntimeError(f"distilled runtime lost {name} mainstem segments: {main_counts[name]} != {full_main_counts[name]}")

    selected_class_counts = {
        "river_segments": int(np.count_nonzero(runtime_segments[:, 6] < 0.5)),
        "stream_segments": int(np.count_nonzero((runtime_segments[:, 6] >= 0.5) & (runtime_segments[:, 6] < 1.5))),
        "canal_segments": int(np.count_nonzero(runtime_segments[:, 6] >= 1.5)),
    }

    runtime_manifest = copy.deepcopy(hydrology)
    runtime_manifest["status"] = "distilled_runtime_review_asset"
    runtime_manifest["runtime"] = {
        "profile": RUNTIME_PROFILE,
        "first_load": True,
        "full_source_segment_count": expected_full_count,
        "selected_segment_count": int(len(runtime_segments)),
        "selected_node_count": int(len(runtime_nodes)),
        "selected_class_counts": selected_class_counts,
        "selection_policy": {
            "named_mainstems": "all segments, including Li to Gui continuation south of Yangshuo",
            "ordinary_waterways": "complete directed routes from headwater to selected mainstem or outlet",
            "geometry_mutated": False,
            "simplification": "none",
            "coordinate_quantization": "none beyond original float32 runtime storage",
            "internal_route_breaks_allowed": False,
        },
        "route_diagnostics": route_diagnostics,
        "full_detail_source": "truth/OSM_HYDROLOGY_IMMUTABLE.geojson",
        "stale_assets_allowed": False,
    }
    runtime_manifest["topology"]["full_source_segment_count"] = expected_full_count
    runtime_manifest["topology"]["source_segment_count"] = int(len(runtime_segments))
    runtime_manifest["topology"]["segment_count"] = int(len(runtime_segments))
    runtime_manifest["topology"]["node_count"] = int(len(runtime_nodes))
    runtime_manifest["topology"]["dropped_segment_count"] = 0
    runtime_manifest["topology"]["runtime_selected_route_coverage"] = 1.0
    runtime_manifest["topology"]["runtime_route_break_count"] = 0
    runtime_manifest["styling"]["mainstem_segment_counts"] = main_counts
    runtime_manifest["segments"] = {
        "file": segment_output.name,
        "bytes": segment_output.stat().st_size,
        "sha256": sha256_file(segment_output),
        "dtype": "float32-little-endian",
        "layout": hydrology["segments"]["layout"],
        "count": int(len(runtime_segments)),
        "compression": "none",
    }
    runtime_manifest["nodes"] = {
        "file": node_output.name,
        "bytes": node_output.stat().st_size,
        "sha256": sha256_file(node_output),
        "dtype": "float32-little-endian",
        "layout": hydrology["nodes"]["layout"],
        "count": int(len(runtime_nodes)),
        "compression": "none",
    }
    write_json(args.output_dir / "osm-waterways-manifest.json", runtime_manifest)

    initial_data_bytes = (
        int(overview["asset"]["bytes"])
        + segment_output.stat().st_size
        + node_output.stat().st_size
        + args.native_manifest.stat().st_size
        + args.overview_manifest.stat().st_size
    )
    knowledge = {
        "schema": "guilin-dem-distilled-knowledge-runtime/v2",
        "status": "review_asset",
        "truth": {
            "source_file": native["source"]["file"],
            "source_bytes": native["source"]["bytes"],
            "source_sha256": native["source"]["sha256"],
            "aoi_geometry_sha256": native["aoi"]["geometry_sha256"],
            "native_spacing_m": native["source"]["resolution_m"],
            "native_grid": native["source"]["grid"],
            "native_tile_count": native["tile_matrix"]["full_matrix_tile_count"],
            "native_tile_bytes_each": native["tile_matrix"]["expected_tile_bytes"],
            "compression": native["tile_matrix"]["compression"],
            "resampling": native["tile_matrix"]["resampling"],
            "height_image_texture_used": False,
        },
        "terrain_knowledge": {
            "aoi_bounds_epsg32649": native["aoi"]["native_sample_center_bounds_epsg32649"],
            "native_sample_window": native["aoi"]["native_sample_window"],
            "overview_grid": overview["asset"]["grid"],
            "overview_selection": overview["asset"]["selection"],
            "overview_interpolation": overview["asset"]["interpolation"],
            "elevation_range_m": overview["asset"]["elevation_range_m"],
        },
        "hydrology_knowledge": {
            "full_record_counts": hydrology["topology"]["record_counts"],
            "full_source_segment_count": expected_full_count,
            "full_source_node_count": hydrology["topology"]["node_count"],
            "mainstem_names": hydrology["styling"]["mainstem_names"],
            "mainstem_aliases": hydrology["styling"]["mainstem_aliases"],
            "mainstem_segment_counts": hydrology["styling"]["mainstem_segment_counts"],
            "li_gui_continuation_segment_count": hydrology["styling"]["li_gui_continuation_segment_count"],
            "li_south_of_yangshuo_segment_count": hydrology["styling"]["li_south_of_yangshuo_segment_count"],
            "li_reaches_aoi_south_boundary": hydrology["styling"]["li_reaches_aoi_south_boundary"],
            "segment_vertex_order": hydrology["direction"]["segment_vertex_order"],
            "orientation_method": hydrology["direction"]["orientation_method"],
            "flow_progress_monotonic": hydrology["direction"]["flow_progress_monotonic"],
            "flow_distance_monotonic": hydrology["direction"]["flow_distance_monotonic"],
            "future_flow_animation_ready": hydrology["direction"]["future_flow_animation_ready"],
            "runtime_route_break_count": 0,
            "lake_surface_asset_count": 0,
            "reservoir_surface_asset_count": 0,
            "synthetic_surface_asset_count": 0,
        },
        "runtime": {
            "profile": RUNTIME_PROFILE,
            "online_page_mode": "small viewer plus knowledge index plus connected route LOD plus on-demand native data",
            "initial_numeric_data_bytes": int(initial_data_bytes),
            "initial_numeric_data_mib": round(initial_data_bytes / 1024 / 1024, 3),
            "distilled_hydrology_segment_count": int(len(runtime_segments)),
            "distilled_hydrology_node_count": int(len(runtime_nodes)),
            "native_tile_delivery": "same-origin-on-demand",
            "native_tile_runtime_base_url": TILE_RUNTIME_BASE_URL,
            "native_tile_download_bytes_per_tile": native["tile_matrix"]["expected_tile_bytes"],
            "all_native_tiles_downloaded_on_page_open": False,
            "full_truth_downloaded_on_page_open": False,
            "stale_public_assets_allowed": False,
        },
        "lineage": {
            "native_manifest_sha256": sha256_file(args.native_manifest),
            "overview_manifest_sha256": sha256_file(args.overview_manifest),
            "full_hydrology_manifest_sha256": sha256_file(args.hydrology_manifest),
            "runtime_hydrology_manifest_sha256": sha256_file(args.output_dir / "osm-waterways-manifest.json"),
        },
    }
    write_json(args.output_dir / "guilin-distilled-knowledge.json", knowledge)

    receipt = {
        "schema": "guilin-dem-distilled-runtime-build-receipt/v2",
        "passed": True,
        "runtime_profile": RUNTIME_PROFILE,
        "full_source_segment_count": expected_full_count,
        "distilled_segment_count": int(len(runtime_segments)),
        "distilled_node_count": int(len(runtime_nodes)),
        "distilled_segment_bytes": segment_output.stat().st_size,
        "distilled_node_bytes": node_output.stat().st_size,
        "initial_numeric_data_bytes": int(initial_data_bytes),
        "native_tiles_on_page_open": 0,
        "runtime_route_break_count": 0,
        "li_gui_continuation_segment_count": hydrology["styling"]["li_gui_continuation_segment_count"],
        "li_south_of_yangshuo_segment_count": hydrology["styling"]["li_south_of_yangshuo_segment_count"],
        "stale_assets_allowed": False,
    }
    write_json(args.output_dir / "DISTILLED_RUNTIME_BUILD_RECEIPT.json", receipt)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
