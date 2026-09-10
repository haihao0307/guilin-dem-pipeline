#!/usr/bin/env python3
"""
KAOPU R22 semantic/executable probe: HRRRv4 effective-radius producer liveness.

This probe encodes only source-locked control-flow facts from NOAA-EMC HRRR v4.1.20.
It does NOT execute WRF/HRRR, does NOT create atmospheric observations, and cannot
raise ReplayStatus. Its purpose is to prevent a false L1 instrumentation test where
RE_CLOUD/RE_ICE/RE_SNOW are stream-exposed but the Thompson effective-radius producer
is never requested.

Locked facts used:
- shipped em_scm_xy baseline: mp_physics=2, ra_lw_physics=1, ra_sw_physics=1.
- Registry.EM_COMMON default: use_mp_re=1.
- module_physics_init: effective-radius request flags start at 0 and are enabled only
  under use_mp_re=1 + RRTMG LW + RRTMG SW + supported microphysics, including
  THOMPSON/THOMPSONAERO.
- module_mp_thompson: calc_effectRad is guarded by all three request flags nonzero.
- physics initialization gives plausible nonzero starting effective radii
  (2.51, 5.01, 10.01 micrometres), so nonzero output alone is not freshness evidence.
"""

from dataclasses import dataclass
from typing import Tuple

TARGETS = ("RE_CLOUD", "RE_ICE", "RE_SNOW")
THOMPSONAERO = 28
RRTMG_LW = 4
RRTMG_SW = 4

@dataclass(frozen=True)
class Config:
    mp_physics: int
    ra_lw_physics: int
    ra_sw_physics: int
    use_mp_re: int
    exposed: Tuple[str, ...]
    fail_fast: bool

def request_flags(cfg: Config) -> Tuple[int, int, int]:
    enabled = (
        cfg.use_mp_re == 1
        and cfg.ra_lw_physics == RRTMG_LW
        and cfg.ra_sw_physics == RRTMG_SW
        and cfg.mp_physics == THOMPSONAERO
    )
    return (1, 1, 1) if enabled else (0, 0, 0)

def producer_refresh_eligible(cfg: Config) -> bool:
    # Locked Thompson call path requires all three flags nonzero.
    return all(v != 0 for v in request_flags(cfg))

def exposure_complete(cfg: Config) -> bool:
    return set(TARGETS).issubset(cfg.exposed)

def check(name: str, ok: bool) -> None:
    if not ok:
        raise AssertionError(name)
    print(f"PASS {name}")

# Shipped SCM baseline, with Registry default use_mp_re made explicit here.
baseline = Config(2, 1, 1, 1, TARGETS, False)
check("baseline_microphysics_is_not_thompsonaero", baseline.mp_physics != THOMPSONAERO)
check("baseline_radiation_is_not_rrtmg_pair",
      baseline.ra_lw_physics != RRTMG_LW and baseline.ra_sw_physics != RRTMG_SW)
check("stream_exposure_does_not_imply_producer_liveness",
      exposure_complete(baseline) and not producer_refresh_eligible(baseline))

# R21's intended mp=28 edit by itself is insufficient if shipped radiation remains 1/1.
mp_only = Config(28, 1, 1, 1, TARGETS, False)
check("mp28_alone_is_insufficient", not producer_refresh_eligible(mp_only))

check("use_mp_re_is_a_required_gate",
      not producer_refresh_eligible(Config(28, 4, 4, 0, TARGETS, False)))
check("rrtmg_lw_is_a_required_gate",
      not producer_refresh_eligible(Config(28, 1, 4, 1, TARGETS, False)))
check("rrtmg_sw_is_a_required_gate",
      not producer_refresh_eligible(Config(28, 4, 1, 1, TARGETS, False)))

canonical = Config(28, 4, 4, 1, TARGETS, True)
check("canonical_l1_source_gate_is_satisfied", producer_refresh_eligible(canonical))
check("canonical_l1_exposes_all_three_fields", exposure_complete(canonical))
check("canonical_l1_is_fail_fast", canonical.fail_fast)

# Source initialization itself produces plausible nonzero radii. Therefore value
# plausibility/nonzeroness is not a freshness proof.
initial_um = (2.51, 5.01, 10.01)
check("initial_radii_are_plausible_nonzero", all(v > 0.0 for v in initial_um))
freshness_evidence = False
check("plausible_nonzero_values_do_not_prove_refresh",
      all(v > 0.0 for v in initial_um) and not freshness_evidence)

# Producer liveness and stream observability are orthogonal.
check("manifest_can_resolve_while_producer_is_inactive",
      exposure_complete(mp_only) and not producer_refresh_eligible(mp_only))

# This source-semantic probe cannot promote runtime authentication.
replay_status_before = "source_callpath_authenticated"
replay_status_after = replay_status_before
check("replay_status_not_promoted", replay_status_after == "source_callpath_authenticated")

print("RESULT 14/14 PASS")
