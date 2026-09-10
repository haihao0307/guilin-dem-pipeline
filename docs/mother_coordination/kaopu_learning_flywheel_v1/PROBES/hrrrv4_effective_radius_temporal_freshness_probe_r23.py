#!/usr/bin/env python3
"""KAOPU R23 source-semantic probe: temporal eligibility of HRRRv4 Thompson re_* checkpoints.

This is NOT a WRF/HRRR numerical simulation. It tests provenance/temporal rules distilled
from locked NOAA-EMC HRRRv4 source and official WRF output semantics.
"""
from dataclasses import dataclass

INIT_CLOUD = 2.51e-6
INIT_ICE = 5.01e-6
CLOUD_MIN = 2.51e-6
ICE_MIN = 5.01e-6

@dataclass(frozen=True)
class Checkpoint:
    segment_kind: str
    valid_step: int
    producer_step: int | None
    value_cloud: float
    value_ice: float
    producer_eligible: bool


def producer_cloud(raw: float) -> float:
    return max(CLOUD_MIN, min(raw, 50e-6))


def producer_ice(raw: float) -> float:
    return max(ICE_MIN, min(raw, 125e-6))


def naive_value_changed_from_init(cp: Checkpoint) -> bool:
    return cp.value_cloud != INIT_CLOUD or cp.value_ice != INIT_ICE


def temporally_eligible(cp: Checkpoint) -> bool:
    return (
        cp.producer_eligible
        and cp.valid_step >= 1
        and cp.producer_step is not None
        and cp.producer_step == cp.valid_step
    )


def main() -> None:
    checks = []
    def check(name, cond):
        checks.append((name, bool(cond)))

    cold_t0 = Checkpoint("cold-start", 0, None, INIT_CLOUD, INIT_ICE, True)
    check("cold-start t0 is not producer-refreshed", not temporally_eligible(cold_t0))

    aliased_cloud = producer_cloud(1.0e-9)
    aliased_ice = producer_ice(1.0e-9)
    check("producer clamp can equal cloud init", aliased_cloud == INIT_CLOUD)
    check("producer clamp can equal ice init", aliased_ice == INIT_ICE)

    post_step_alias = Checkpoint("cold-start", 1, 1, aliased_cloud, aliased_ice, True)
    check("event lineage accepts producer-refreshed alias", temporally_eligible(post_step_alias))
    check("value-change heuristic falsely rejects valid alias", not naive_value_changed_from_init(post_step_alias))

    post_step_changed = Checkpoint("cold-start", 1, 1, 12e-6, 22e-6, True)
    check("post-step producer event is eligible", temporally_eligible(post_step_changed))
    check("value-change heuristic happens to pass changed case", naive_value_changed_from_init(post_step_changed))

    restart_t0 = Checkpoint("restart", 0, None, 12e-6, 22e-6, True)
    check("restart t0 carried state is not producer-refreshed", not temporally_eligible(restart_t0))
    check("changed-looking restart value cannot prove freshness", naive_value_changed_from_init(restart_t0))

    restart_post_step = Checkpoint("restart", 1, 1, 12e-6, 22e-6, True)
    check("restart after one producer step is eligible", temporally_eligible(restart_post_step))

    stale = Checkpoint("cold-start", 2, 1, 18e-6, 30e-6, True)
    check("stale producer epoch is rejected", not temporally_eligible(stale))

    inactive = Checkpoint("cold-start", 1, 1, 12e-6, 22e-6, False)
    check("inactive producer path is rejected", not temporally_eligible(inactive))

    passed = sum(v for _, v in checks)
    for name, ok in checks:
        print(("PASS" if ok else "FAIL") + " | " + name)
    print(f"RESULT {passed}/{len(checks)} PASS")
    if passed != len(checks):
        raise SystemExit(1)

if __name__ == "__main__":
    main()
