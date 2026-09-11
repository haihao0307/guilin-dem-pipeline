#!/usr/bin/env python3
"""KAOPU R24 source-semantic probe: HRRRv4 ThompsonAero aerosol state-source identity.

This is NOT a WRF/HRRR numerical model run. It tests evidence contracts distilled from
locked NOAA-EMC HRRR source and official WRF documentation.
"""
from dataclasses import dataclass

LOCKED_HRRR_COMMIT = "40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827"
LOCKED_THOMPSON_BLOB = "1e6cdb1e718473ee1a031e16b1c00c96113f19f8"
LOCKED_PHYS_INIT_BLOB = "2a6dac7d3c0c2b9c87ff3a2dfdbcf9e635aa6e6d"
LOCKED_SCM_NAMELIST_BLOB = "50571a305625bdf5ddecb91c7493a8acb5eb3dd9"
LOCKED_HRRR_NAMELIST_BLOB = "7b9b8ccb34d00bf03558e6abb4915202b1e50860"
EPS = 1.0e-15


@dataclass(frozen=True)
class Harness:
    mp_physics: int
    ra_lw_physics: int
    ra_sw_physics: int
    use_mp_re: int
    thompson_arrays_present: bool
    max_nwfa: float
    max_nifa: float
    external_aerosol_icbc: bool
    ccn_activation_table_present: bool


def producer_request_live(h: Harness) -> bool:
    return (
        h.mp_physics == 28
        and h.ra_lw_physics == 4
        and h.ra_sw_physics == 4
        and h.use_mp_re == 1
    )


def thompson_aerosol_aware(h: Harness) -> bool:
    # Locked source sets is_aerosol_aware from PRESENT(nwfa2d,nwfa,nifa),
    # not from the provenance of those values.
    return h.mp_physics == 28 and h.thompson_arrays_present


def state_source(h: Harness) -> tuple[str, str]:
    # Locked thompson_init fills basic profiles when an aerosol field is absent/nearly zero.
    nwfa_source = "preexisting/external" if h.max_nwfa >= EPS else "source-internal-fallback-profile"
    nifa_source = "preexisting/external" if h.max_nifa >= EPS else "source-internal-fallback-profile"
    return nwfa_source, nifa_source


def execution_preflight(h: Harness) -> bool:
    # CCN activation table remains an auxiliary runtime dependency for the aerosol-aware path.
    return producer_request_live(h) and thompson_aerosol_aware(h) and h.ccn_activation_table_present


def same_state_source(a: Harness, b: Harness) -> bool:
    return state_source(a) == state_source(b) and a.external_aerosol_icbc == b.external_aerosol_icbc


def evidence_ceiling(h: Harness, operational: Harness) -> str:
    if not execution_preflight(h):
        return "preflight-only"
    if same_state_source(h, operational):
        return "state-source-aligned-harness"
    return "algorithm-path-only"


def check(name: str, cond: bool, results: list[tuple[str, bool]]):
    results.append((name, bool(cond)))


def main() -> int:
    # Minimal L1 candidate: same ThompsonAero implementation path, no external aerosol IC/BC;
    # zero/empty aerosol state is intentionally allowed to trigger locked thompson_init fallback.
    l1_fallback = Harness(28, 4, 4, 1, True, 0.0, 0.0, False, True)
    # Operational HRRR identity: external aerosol IC/BC is enabled and aerosol state is provided.
    operational = Harness(28, 4, 4, 1, True, 1.0, 1.0, True, True)
    baseline_scm = Harness(2, 1, 1, 1, False, 0.0, 0.0, False, False)

    results: list[tuple[str, bool]] = []
    check("locked_source_identity_present", len(LOCKED_HRRR_COMMIT) == 40 and len(LOCKED_THOMPSON_BLOB) == 40, results)
    check("baseline_scm_not_target_producer_path", not producer_request_live(baseline_scm), results)
    check("mp28_arrays_make_thompson_aerosol_aware", thompson_aerosol_aware(l1_fallback), results)
    check("missing_nwfa_selects_internal_fallback", state_source(l1_fallback)[0] == "source-internal-fallback-profile", results)
    check("missing_nifa_selects_internal_fallback", state_source(l1_fallback)[1] == "source-internal-fallback-profile", results)
    check("operational_state_source_is_external", state_source(operational) == ("preexisting/external", "preexisting/external"), results)
    check("l1_and_operational_share_algorithm_request_gate", producer_request_live(l1_fallback) and producer_request_live(operational), results)
    check("same_algorithm_path_does_not_imply_same_state_source", not same_state_source(l1_fallback, operational), results)
    check("fallback_l1_can_pass_source_execution_preflight", execution_preflight(l1_fallback), results)
    check("ccn_table_remains_required", not execution_preflight(Harness(28, 4, 4, 1, True, 0.0, 0.0, False, False)), results)
    check("fallback_l1_evidence_ceiling_is_algorithm_path_only", evidence_ceiling(l1_fallback, operational) == "algorithm-path-only", results)
    check("fallback_l1_cannot_promote_runtime_auth", evidence_ceiling(l1_fallback, operational) != "state-source-aligned-harness", results)

    passed = sum(ok for _, ok in results)
    for name, ok in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}")
    print(f"RESULT {passed}/{len(results)} PASS")
    print("ReplayStatus remains source_callpath_authenticated")
    print("ObservationRootAdded=false")
    print("ProductionMotherMutationAllowed=false")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
