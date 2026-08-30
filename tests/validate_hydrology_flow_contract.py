from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

EXPECTED_LAYOUT = [
    "start_x", "start_elevation", "start_z",
    "end_x", "end_elevation", "end_z",
    "class", "mainstem_code", "source_width_m",
    "start_flow_progress", "end_flow_progress",
    "start_flow_distance_m", "end_flow_distance_m",
]


def fail(message: str) -> None:
    raise SystemExit(message)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--segments", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if manifest.get("styling", {}).get("profile") != "longitudinal-flow-taper-v4":
        fail("unexpected hydrology style profile")
    if manifest.get("segments", {}).get("layout") != EXPECTED_LAYOUT:
        fail("unexpected hydrology segment layout")
    direction = manifest.get("direction") or {}
    expected_direction = {
        "segment_vertex_order": "upstream_to_downstream",
        "flow_progress_monotonic": True,
        "flow_distance_monotonic": True,
        "future_flow_animation_ready": True,
    }
    for key, value in expected_direction.items():
        if direction.get(key) != value:
            fail(f"direction contract {key}: {direction.get(key)!r}")

    raw = np.fromfile(args.segments, dtype="<f4")
    if raw.size % len(EXPECTED_LAYOUT):
        fail("segment binary stride mismatch")
    segments = raw.reshape((-1, len(EXPECTED_LAYOUT)))
    if len(segments) != int(manifest["segments"]["count"]):
        fail("segment count mismatch")
    if np.any(segments[:, 4] > segments[:, 1] + 1e-5):
        fail("stored flow contains uphill segment orientation")
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
        if minimum > 0.02 or maximum < 0.98:
            fail(f"{name} progress does not span upstream/downstream: {minimum}, {maximum}")
        if float(np.quantile(selected[:, 9], 0.10)) > 0.35:
            fail(f"{name} upstream is not sufficiently narrow-coded")
        if float(np.quantile(selected[:, 10], 0.90)) < 0.65:
            fail(f"{name} downstream is not sufficiently broad-coded")
        summaries[name] = {
            "segments": int(len(selected)),
            "progress_min": minimum,
            "progress_max": maximum,
            "source_width_m": [float(selected[:, 8].min()), float(selected[:, 8].max())],
        }

    payload = {
        "schema": "guilin-hydrology-longitudinal-flow-contract-qa/v1",
        "passed": True,
        "segment_count": int(len(segments)),
        "segment_vertex_order": "upstream_to_downstream",
        "uphill_segment_count": 0,
        "flow_progress_inversion_count": 0,
        "flow_distance_inversion_count": 0,
        "future_flow_animation_ready": True,
        "mainstems": summaries,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
