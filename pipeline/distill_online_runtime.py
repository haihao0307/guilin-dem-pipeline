from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

SEGMENT_STRIDE = 13
NODE_STRIDE = 8
RUNTIME_PROFILE = "knowledge-indexed-first-load-v1"
TILE_RELEASE_BASE_URL = (
    "https://github.com/haihao0307/guilin-dem-pipeline/releases/download/"
    "guilin-native-12p5m-single-truth-v001/"
)


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


def select_top(indices: np.ndarray, progress: np.ndarray, limit: int) -> np.ndarray:
    if indices.size <= limit:
        return indices
    order = np.argsort(progress[indices], kind="stable")
    return indices[order[-limit:]]


def node_record_from_segment(segment: np.ndarray, endpoint: int) -> tuple[float, ...]:
    if endpoint == 0:
        return (
            float(segment[0]),
            float(segment[1]),
            float(segment[2]),
            float(segment[6]),
            float(segment[7]),
            float(segment[8]),
            float(segment[9]),
            float(segment[11]),
        )
    return (
        float(segment[3]),
        float(segment[4]),
        float(segment[5]),
        float(segment[6]),
        float(segment[7]),
        float(segment[8]),
        float(segment[10]),
        float(segment[12]),
    )


def build_runtime_nodes(segments: np.ndarray) -> np.ndarray:
    records: dict[tuple[float, float], tuple[float, ...]] = {}
    for segment in segments:
        for endpoint in (0, 1):
            record = node_record_from_segment(segment, endpoint)
            key = (round(record[0], 3), round(record[2], 3))
            previous = records.get(key)
            if previous is None:
                records[key] = record
                continue
            previous_mainstem = previous[4]
            current_mainstem = record[4]
            previous_progress = previous[6]
            current_progress = record[6]
            if current_mainstem > previous_mainstem or (
                current_mainstem == previous_mainstem and current_progress > previous_progress
            ):
                records[key] = record
    ordered = [records[key] for key in sorted(records)]
    return np.asarray(ordered, dtype="<f4")


def main() -> int:
    parser = argparse.ArgumentParser(description="Distill the Guilin truth into a small first-load runtime")
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

    class_value = full_segments[:, 6]
    mainstem_code = full_segments[:, 7]
    source_width = full_segments[:, 8]
    end_progress = full_segments[:, 10]

    main_indices = np.flatnonzero(mainstem_code > 0.5)
    ordinary_river = np.flatnonzero((class_value < 0.5) & (mainstem_code <= 0.5))
    streams = np.flatnonzero((class_value >= 0.5) & (class_value < 1.5))
    canals = np.flatnonzero(class_value >= 1.5)

    selected = set(int(index) for index in main_indices)
    selected.update(int(index) for index in select_top(ordinary_river, end_progress, 12_000))
    selected.update(int(index) for index in select_top(streams, end_progress, 2_500))
    selected.update(int(index) for index in select_top(canals, end_progress, 500))

    selected_indices = np.asarray(sorted(selected), dtype=np.int64)
    runtime_segments = np.asarray(full_segments[selected_indices], dtype="<f4")
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
    if any(value <= 0 for value in main_counts.values()):
        raise RuntimeError(f"distilled runtime lost a named mainstem: {main_counts}")

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
            "named_mainstems": "all",
            "ordinary_rivers": "top 12000 by downstream progress",
            "streams": "top 2500 by downstream progress",
            "canals": "top 500 by downstream progress",
            "geometry_mutated": False,
            "simplification": "none",
            "coordinate_quantization": "none beyond original float32 runtime storage",
        },
        "full_detail_source": "truth/OSM_HYDROLOGY_IMMUTABLE.geojson",
        "stale_assets_allowed": False,
    }
    runtime_manifest["topology"]["full_source_segment_count"] = expected_full_count
    runtime_manifest["topology"]["source_segment_count"] = int(len(runtime_segments))
    runtime_manifest["topology"]["segment_count"] = int(len(runtime_segments))
    runtime_manifest["topology"]["node_count"] = int(len(runtime_nodes))
    runtime_manifest["topology"]["dropped_segment_count"] = 0
    runtime_manifest["topology"]["runtime_selected_route_coverage"] = 1.0
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
        "schema": "guilin-dem-distilled-knowledge-runtime/v1",
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
            "mainstem_segment_counts": hydrology["styling"]["mainstem_segment_counts"],
            "segment_vertex_order": hydrology["direction"]["segment_vertex_order"],
            "flow_progress_monotonic": hydrology["direction"]["flow_progress_monotonic"],
            "flow_distance_monotonic": hydrology["direction"]["flow_distance_monotonic"],
            "future_flow_animation_ready": hydrology["direction"]["future_flow_animation_ready"],
            "lake_surface_asset_count": 0,
            "reservoir_surface_asset_count": 0,
            "synthetic_surface_asset_count": 0,
        },
        "runtime": {
            "profile": RUNTIME_PROFILE,
            "online_page_mode": "small viewer plus knowledge index plus on-demand data",
            "initial_numeric_data_bytes": int(initial_data_bytes),
            "initial_numeric_data_mib": round(initial_data_bytes / 1024 / 1024, 3),
            "distilled_hydrology_segment_count": int(len(runtime_segments)),
            "distilled_hydrology_node_count": int(len(runtime_nodes)),
            "native_tile_delivery": "release-on-demand",
            "native_tile_release_base_url": TILE_RELEASE_BASE_URL,
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
        "schema": "guilin-dem-distilled-runtime-build-receipt/v1",
        "passed": True,
        "runtime_profile": RUNTIME_PROFILE,
        "full_source_segment_count": expected_full_count,
        "distilled_segment_count": int(len(runtime_segments)),
        "distilled_node_count": int(len(runtime_nodes)),
        "distilled_segment_bytes": segment_output.stat().st_size,
        "distilled_node_bytes": node_output.stat().st_size,
        "initial_numeric_data_bytes": int(initial_data_bytes),
        "native_tiles_on_page_open": 0,
        "stale_assets_allowed": False,
    }
    write_json(args.output_dir / "DISTILLED_RUNTIME_BUILD_RECEIPT.json", receipt)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
