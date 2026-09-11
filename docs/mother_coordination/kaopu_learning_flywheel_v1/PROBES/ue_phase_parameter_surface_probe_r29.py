#!/usr/bin/env python3
"""R29 source-semantic probe: distinguish UE5.8 wrapper controls from raw PhaseG."""

from dataclasses import dataclass
from typing import Callable

@dataclass(frozen=True)
class Surface:
    name: str
    forward_when: Callable[[float], bool]
    backward_when: Callable[[float], bool]

RAW = Surface(
    "UE5.8 VolumetricAdvancedOutput.PhaseG",
    forward_when=lambda g: g < 0.0,
    backward_when=lambda g: g > 0.0,
)
WRAPPER = Surface(
    "UE5.8 default cloud material Phase A/B",
    forward_when=lambda p: p > 0.0,
    backward_when=lambda p: p < 0.0,
)

SAMPLES = (-0.85, -0.5, 0.5, 0.85)

def semantics_consistent(mapping):
    for p in SAMPLES:
        g = mapping(p)
        if WRAPPER.forward_when(p) != RAW.forward_when(g):
            return False
        if WRAPPER.backward_when(p) != RAW.backward_when(g):
            return False
    return True

checks = {
    "surfaces_are_distinct": RAW.name != WRAPPER.name,
    "identity_mapping_inconsistent": not semantics_consistent(lambda p: p),
    "negation_mapping_consistent": semantics_consistent(lambda p: -p),
    "scaled_negation_consistent": semantics_consistent(lambda p: -0.5 * p),
    "raw_negative_forward": RAW.forward_when(-0.5) and not RAW.forward_when(0.5),
    "wrapper_positive_forward": WRAPPER.forward_when(0.5) and not WRAPPER.forward_when(-0.5),
    "zero_neutral_raw": not RAW.forward_when(0.0) and not RAW.backward_when(0.0),
    "zero_neutral_wrapper": not WRAPPER.forward_when(0.0) and not WRAPPER.backward_when(0.0),
}
checks["nonunique_transform"] = (
    checks["negation_mapping_consistent"] and checks["scaled_negation_consistent"]
)
checks["same_physical_semantics_are_possible"] = checks["negation_mapping_consistent"]
checks["mapping_not_identified_by_docs"] = checks["nonunique_transform"]
checks["direct_copy_rejected"] = checks["identity_mapping_inconsistent"]

passed = sum(checks.values())
for name, ok in checks.items():
    print(("PASS" if ok else "FAIL"), name)
print(f"{passed}/{len(checks)} PASS")
