#!/usr/bin/env python3
"""Generated-fixture probe for the candidate Wenzhou observation-band policy."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np


HERE = Path(__file__).resolve().parent
KERNEL_ROOT = HERE.parent
TRANSFORM_DIR = KERNEL_ROOT / "transform"
for location in (HERE, TRANSFORM_DIR):
    if str(location) not in sys.path:
        sys.path.insert(0, str(location))

from observation_policy import PrecisionRequest, reconstruct_for_request  # noqa: E402
from reversible_cdf53 import decode_grid, encode_grid  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=KERNEL_ROOT / "qa/OBSERVATION_POLICY_PROBE_R1.json",
    )
    return parser.parse_args()


def generated_fixture() -> np.ndarray:
    y, x = np.mgrid[:129, :131]
    broad = 420.0 + 1.8 * x + 1.1 * y
    ridge = 95.0 * np.exp(-((x - 72.0) ** 2) / 150.0)
    valley = -65.0 * np.exp(-((y - 78.0) ** 2) / 95.0)
    micro = 4.0 * np.sin(x / 2.7) + 2.5 * np.cos(y / 3.4)
    return np.rint(broad + ridge + valley + micro).astype(np.int16)


def masked_fixture(source: np.ndarray) -> np.ndarray:
    result = source.copy()
    result[10:15, 18:23] = -32768
    result[90:94, 103:109] = -32768
    return result


def error_metrics(source: np.ndarray, candidate: np.ndarray) -> dict[str, float]:
    valid = source != -32768
    difference = candidate[valid].astype(np.float64) - source[valid].astype(np.float64)
    if not difference.size:
        return {"maxAbsErrorM": 0.0, "rmseM": 0.0}
    return {
        "maxAbsErrorM": float(np.max(np.abs(difference))),
        "rmseM": float(math.sqrt(float(np.mean(difference**2)))),
    }


def case_report(
    case_id: str,
    source: np.ndarray,
    request: PrecisionRequest,
) -> dict[str, Any]:
    encoded = encode_grid(source, nodata=-32768)
    reconstructed, selection = reconstruct_for_request(encoded, request)
    return {
        "case": case_id,
        "request": {
            "pixelFootprintM": request.pixel_footprint_m,
            "visualErrorFraction": request.visual_error_fraction,
            "interactionSpacingM": request.interaction_spacing_m,
            "physicsSpacingM": request.physics_spacing_m,
            "storySpacingM": request.story_spacing_m,
            "safetySpacingM": request.safety_spacing_m,
            "forceTruth": request.force_truth,
            "task": request.task,
        },
        "selection": selection.to_json_dict(),
        "nodataMaskEqual": bool(
            np.array_equal(reconstructed == -32768, source == -32768)
        ),
        "exactGridEqual": bool(np.array_equal(reconstructed, source)),
        "errors": error_metrics(source, reconstructed),
    }


def main() -> int:
    args = parse_args()
    source = generated_fixture()
    masked = masked_fixture(source)
    exact = decode_grid(encode_grid(source))
    masked_exact = decode_grid(encode_grid(masked))
    if not np.array_equal(exact, source) or not np.array_equal(masked_exact, masked):
        raise RuntimeError("canonical generated-fixture round trip failed")

    reports = [
        case_report(
            "near_visual_truth",
            source,
            PrecisionRequest(pixel_footprint_m=8.0, task="near_visual"),
        ),
        case_report(
            "far_visual",
            source,
            PrecisionRequest(pixel_footprint_m=160.0, task="far_visual"),
        ),
        case_report(
            "far_with_physics_override",
            source,
            PrecisionRequest(
                pixel_footprint_m=160.0,
                physics_spacing_m=25.0,
                task="physics_query",
            ),
        ),
        case_report(
            "far_with_interaction_truth",
            source,
            PrecisionRequest(
                pixel_footprint_m=160.0,
                interaction_spacing_m=12.5,
                task="interaction_query",
            ),
        ),
        case_report(
            "forced_truth",
            source,
            PrecisionRequest(
                pixel_footprint_m=800.0,
                force_truth=True,
                task="control_point_qa",
            ),
        ),
        case_report(
            "far_visual_masked_guard",
            masked,
            PrecisionRequest(
                pixel_footprint_m=160.0,
                task="masked_tile_visual",
            ),
        ),
    ]

    by_id = {item["case"]: item for item in reports}
    gates = {
        "canonicalRoundTripExact": bool(np.array_equal(exact, source)),
        "maskedCanonicalRoundTripExact": bool(np.array_equal(masked_exact, masked)),
        "allNoDataMasksExact": all(item["nodataMaskEqual"] for item in reports),
        "nearVisualRetainsTruth": by_id["near_visual_truth"]["exactGridEqual"],
        "farVisualDropsFineBands": by_id["far_visual"]["selection"]["zero_detail_levels"]
        == [0, 1],
        "physicsOverridesFarVisual": by_id["far_with_physics_override"]["selection"]
        ["zero_detail_levels"]
        == [0],
        "interactionCanRequireTruth": by_id["far_with_interaction_truth"]
        ["exactGridEqual"],
        "forceTruthRestoresExactGrid": by_id["forced_truth"]["exactGridEqual"],
        "maskedTileForcesTruthUntilMaskAwareFiltering": (
            by_id["far_visual_masked_guard"]["exactGridEqual"]
            and by_id["far_visual_masked_guard"]["selection"]["nodata_guarded"]
            and by_id["far_visual_masked_guard"]["selection"]["zero_detail_levels"]
            == []
        ),
        "realSourceProbe": False,
    }
    passed = all(value for key, value in gates.items() if key != "realSourceProbe")
    output = {
        "schema": "wenzhou-dem-observation-policy-probe/v1",
        "status": "candidate_generated_fixture_probe_passed" if passed else "failed",
        "passed": passed,
        "sourceDataUsed": False,
        "realWenzhouWindowUsed": False,
        "fixture": {
            "grid": [int(source.shape[0]), int(source.shape[1])],
            "spacingM": 12.5,
            "dtype": str(source.dtype),
            "maskedNoDataSamples": int(np.count_nonzero(masked == -32768)),
            "purpose": "policy_math_and_state_contract_only",
        },
        "cases": reports,
        "gates": gates,
        "limits": [
            "The 0.5 pixel visual fraction is a candidate policy value.",
            "No real Wenzhou elevation sample was used.",
            "Masked transform tiles keep all bands until a validated mask-aware observation filter exists.",
            "No shoreline, ridge, valley or shared-edge production gate was evaluated.",
            "No browser, GPU, memory or visual acceptance evidence was produced.",
        ],
        "productionIntegration": False,
        "visualAcceptance": False,
        "productionReady": False,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if passed else 3


if __name__ == "__main__":
    raise SystemExit(main())
