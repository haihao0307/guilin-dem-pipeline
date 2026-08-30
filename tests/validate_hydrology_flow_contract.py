from __future__ import annotations

import argparse
import json
from collections import defaultdict, deque
from pathlib import Path

import numpy as np

EXPECTED_LAYOUT = [
    "start_x", "start_elevation", "start_z",
    "end_x", "end_elevation", "end_z",
    "class", "mainstem_code", "source_width_m",
    "start_flow_progress", "end_flow_progress",
    "start_flow_distance_m", "end_flow_distance_m",
]
EXPECTED_PROFILE = "network-directed-physical-width-v6"


def fail(message: str) -> None:
    raise SystemExit(message)


def node_key(x: float, z: float) -> tuple[float, float]:
    return round(float(x), 3), round(float(z), 3)


def component_count(segments: np.ndarray) -> int:
    adjacency: dict[tuple[float, float], set[tuple[float, float]]] = defaultdict(set)
    for segment in segments:
        start = node_key(segment[0], segment[2])
        end = node_key(segment[3], segment[5])
        adjacency[start].add(end)
        adjacency[end].add(start)
    visited: set[tuple[float, float]] = set()
    count = 0
    for start in adjacency:
        if start in visited:
            continue
        count += 1
        queue = deque([start])
        visited.add(start)
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--segments", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    styling = manifest.get("styling") or {}
    if styling.get("profile") != EXPECTED_PROFILE:
        fail(f"unexpected hydrology style profile: {styling.get('profile')}")
    if styling.get("width_mode") != "source-width-meters-projected-to-screen":
        fail("hydrology width is not derived from source metres")
    if manifest.get("segments", {}).get("layout") != EXPECTED_LAYOUT:
        fail("unexpected hydrology segment layout")
    direction = manifest.get("direction") or {}
    expected_direction = {
        "segment_vertex_order": "upstream_to_downstream",
        "orientation_method": "connected-network outlet shortest-path distance",
        "flow_progress_monotonic": True,
        "flow_distance_monotonic": True,
        "future_flow_animation_ready": True,
        "li_continuity_verified_south_of_yangshuo": True,
    }
    for key, value in expected_direction.items():
        if direction.get(key) != value:
            fail(f"direction contract {key}: {direction.get(key)!r}")

    if int(styling.get("li_gui_continuation_segment_count", 0)) <= 0:
        fail("Gui River continuation is absent from the Li mainstem")
    if int(styling.get("li_south_of_yangshuo_segment_count", 0)) <= 0:
        fail("Li mainstem stops at or north of Yangshuo")
    if styling.get("li_reaches_aoi_south_boundary") is not True:
        fail("Li and Gui continuous mainstem does not reach the AOI south boundary")

    raw = np.fromfile(args.segments, dtype="<f4")
    if raw.size % len(EXPECTED_LAYOUT):
        fail("segment binary stride mismatch")
    segments = raw.reshape((-1, len(EXPECTED_LAYOUT)))
    if len(segments) != int(manifest["segments"]["count"]):
        fail("segment count mismatch")
    if np.any(segments[:, 10] + 1e-7 < segments[:, 9]):
        fail("flow progress inversion")
    if np.any(segments[:, 12] <= segments[:, 11]):
        fail("flow distance inversion")
    if np.any((segments[:, 9:11] < -1e-6) | (segments[:, 9:11] > 1.000001)):
        fail("flow progress outside 0..1")

    codes = segments[:, 7].astype(np.int32)
    if np.any(np.abs(segments[:, 7] - codes) > 1e-6) or np.any((codes < 0) | (codes > 3)):
        fail("invalid mainstem code")
    summaries = {}
    for code, name in ((1, "li"), (2, "xiang"), (3, "zi")):
        selected = segments[codes == code]
        if len(selected) <= 0:
            fail(f"missing {name} mainstem")
        minimum = float(np.min(selected[:, 9:11]))
        maximum = float(np.max(selected[:, 9:11]))
        if minimum > 0.03 or maximum < 0.97:
            fail(f"{name} progress does not span upstream/downstream: {minimum}, {maximum}")
        if float(np.quantile(selected[:, 9], 0.10)) > 0.35:
            fail(f"{name} upstream is not sufficiently narrow-coded")
        if float(np.quantile(selected[:, 10], 0.90)) < 0.65:
            fail(f"{name} downstream is not sufficiently broad-coded")
        summaries[name] = {
            "segments": int(len(selected)),
            "components": component_count(selected),
            "progress_min": minimum,
            "progress_max": maximum,
            "source_width_m": [float(selected[:, 8].min()), float(selected[:, 8].max())],
        }

    if summaries["li"]["components"] != int(styling.get("mainstem_component_counts", {}).get("li", -1)):
        fail("Li component count differs between binary and manifest")

    uphill_count = int(np.count_nonzero(segments[:, 4] > segments[:, 1] + 1e-5))
    payload = {
        "schema": "guilin-hydrology-network-directed-contract-qa/v2",
        "passed": True,
        "segment_count": int(len(segments)),
        "segment_vertex_order": "upstream_to_downstream",
        "orientation_method": direction["orientation_method"],
        "local_dem_uphill_segment_count": uphill_count,
        "flow_progress_inversion_count": 0,
        "flow_distance_inversion_count": 0,
        "future_flow_animation_ready": True,
        "li_gui_continuation_segment_count": int(styling["li_gui_continuation_segment_count"]),
        "li_south_of_yangshuo_segment_count": int(styling["li_south_of_yangshuo_segment_count"]),
        "li_reaches_aoi_south_boundary": True,
        "mainstems": summaries,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
