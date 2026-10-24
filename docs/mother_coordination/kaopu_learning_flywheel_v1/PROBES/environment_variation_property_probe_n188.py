"""Candidate probe for N181 input-space ownership; not a production motion test."""

import json
from hypothesis import find, settings, strategies as st
import hypothesis


def simulated_controller(v):
    """Synthetic hidden interaction used only to test the verifier method."""
    hidden_failure = (
        37 <= v["door_angle_deg"] <= 43
        and v["obstacle_gap_cm"] <= 44
        and v["object_mass_dkg"] >= 120
    )
    return {
        "task_completed": not hidden_failure,
        "fallback_triggered": False,
        "trace_digest_present": True,
    }


def violates_contract(v):
    receipt = simulated_controller(v)
    return not (
        receipt["task_completed"]
        and not receipt["fallback_triggered"]
        and receipt["trace_digest_present"]
    )


manual_cases = [
    {"door_angle_deg": 0, "obstacle_gap_cm": 60, "object_mass_dkg": 50, "stair_height_mm": 120},
    {"door_angle_deg": 30, "obstacle_gap_cm": 60, "object_mass_dkg": 120, "stair_height_mm": 160},
    {"door_angle_deg": 60, "obstacle_gap_cm": 60, "object_mass_dkg": 180, "stair_height_mm": 180},
    {"door_angle_deg": 90, "obstacle_gap_cm": 60, "object_mass_dkg": 300, "stair_height_mm": 220},
    {"door_angle_deg": 30, "obstacle_gap_cm": 45, "object_mass_dkg": 180, "stair_height_mm": 140},
    {"door_angle_deg": 60, "obstacle_gap_cm": 45, "object_mass_dkg": 180, "stair_height_mm": 200},
]

variation_strategy = st.fixed_dictionaries(
    {
        "door_angle_deg": st.integers(min_value=0, max_value=90),
        "obstacle_gap_cm": st.integers(min_value=35, max_value=90),
        "object_mass_dkg": st.integers(min_value=5, max_value=300),
        "stair_height_mm": st.integers(min_value=120, max_value=220),
    }
)

probe_settings = settings(
    max_examples=5000,
    derandomize=True,
    database=None,
    deadline=None,
)

manual_failures = [v for v in manual_cases if violates_contract(v)]
minimal_1 = find(variation_strategy, violates_contract, settings=probe_settings)
minimal_2 = find(variation_strategy, violates_contract, settings=probe_settings)

result = {
    "schemaVersion": "n188-v1",
    "hypothesisVersion": hypothesis.__version__,
    "probeKind": "synthetic_method_contrast_not_production_motion_validation",
    "manualCaseCount": len(manual_cases),
    "manualFailureCount": len(manual_failures),
    "propertySearchFoundFailure": violates_contract(minimal_1),
    "minimalCounterexample": minimal_1,
    "deterministicReplayMatch": minimal_1 == minimal_2,
    "secondRunCounterexample": minimal_2,
    "interpretation": "Hand-picked held-out cases can all pass while a generated legal variation exposes and shrinks a failure. This validates the method boundary only."
}

print(json.dumps(result, indent=2, sort_keys=True))

assert result["manualFailureCount"] == 0
assert result["propertySearchFoundFailure"] is True
assert result["deterministicReplayMatch"] is True
