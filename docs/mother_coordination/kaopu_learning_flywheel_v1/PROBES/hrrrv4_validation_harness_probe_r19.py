#!/usr/bin/env python3
"""KAOPU R19 bounded validation-harness semantic probe.

This probe does NOT run WRF or HRRR. It verifies the evidence/gate logic
derived from locked HRRRv4 source/configuration and official WRF docs.
All values below are source/configuration facts, not atmospheric data.
"""

HRRR_OPERATIONAL = {
    "nx": 1800,
    "ny": 1060,
    "nz": 51,
    "dx_m": 3000.0,
    "dy_m": 3000.0,
    "mp_physics": 28,
    "use_aero_icbc": True,
    "use_rap_aero_icbc": True,
    "specified_boundary": True,
    "periodic_x": False,
    "periodic_y": False,
}

HRRR_LOCKED_SCM = {
    "nx": 3,
    "ny": 3,
    "nz": 60,
    "dx_m": 4000.0,
    "dy_m": 4000.0,
    "mp_physics": 2,
    "periodic_x": True,
    "periodic_y": True,
    "horizontal_gradients": False,
    "advection_default": False,
    "initialization": "ideal_text_sounding_soil",
}

WRF_DOCS = {
    "mp28_supported": True,
    "mp28_internal_profile_when_use_aero_icbc_false": True,
    "runtime_io_without_recompile": True,
    "runtime_io_performance_hit_documented": True,
}

# Microphysics identifiers appearing in the inspected current official WRF
# Testing Framework ARW serial-vs-MPI/OpenMP table. The table contains
# non-aerosol Thompson mp=8 but not aerosol-aware Thompson mp=28.
WTF_INSPECTED_MP_VALUES = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16}

tests = [
    ("locked HRRR SCM is a 3x3 stencil",
     (HRRR_LOCKED_SCM["nx"], HRRR_LOCKED_SCM["ny"]) == (3, 3)),
    ("locked HRRR SCM removes horizontal-gradient dynamics",
     HRRR_LOCKED_SCM["horizontal_gradients"] is False),
    ("locked HRRR SCM default microphysics is not HRRRv4 mp=28",
     HRRR_LOCKED_SCM["mp_physics"] != HRRR_OPERATIONAL["mp_physics"]),
    ("locked HRRRv4 uses external/operational aerosol ICBC flags",
     HRRR_OPERATIONAL["use_aero_icbc"] and HRRR_OPERATIONAL["use_rap_aero_icbc"]),
    ("SCM periodic boundaries differ from HRRR specified boundaries",
     HRRR_LOCKED_SCM["periodic_x"] and HRRR_OPERATIONAL["specified_boundary"]),
    ("official WRF supports mp=28 internal-profile mode when use_aero_icbc=false",
     WRF_DOCS["mp28_internal_profile_when_use_aero_icbc_false"]),
    ("internal-profile mp=28 is not the locked HRRR external-aerosol configuration",
     HRRR_OPERATIONAL["use_aero_icbc"] is not False),
    ("runtime I/O is lower source perturbation but not documented zero-cost",
     WRF_DOCS["runtime_io_without_recompile"]
     and WRF_DOCS["runtime_io_performance_hit_documented"]),
    ("inspected current WTF ARW table does not cover mp=28",
     28 not in WTF_INSPECTED_MP_VALUES),
    ("inspected current WTF ARW table does cover Thompson mp=8",
     8 in WTF_INSPECTED_MP_VALUES),
]

scm_plumbing_preflight_eligible = (
    WRF_DOCS["runtime_io_without_recompile"]
    and (HRRR_LOCKED_SCM["nx"], HRRR_LOCKED_SCM["ny"]) == (3, 3)
)

scm_operational_replay_authentication_eligible = (
    HRRR_LOCKED_SCM["mp_physics"] == HRRR_OPERATIONAL["mp_physics"]
    and HRRR_LOCKED_SCM["horizontal_gradients"] is True
    and HRRR_LOCKED_SCM.get("use_aero_icbc") == HRRR_OPERATIONAL["use_aero_icbc"]
    and HRRR_LOCKED_SCM["periodic_x"] == HRRR_OPERATIONAL["periodic_x"]
)

tests += [
    ("SCM is eligible as a runtime-I/O plumbing preflight",
     scm_plumbing_preflight_eligible),
    ("SCM is ineligible to authenticate HRRRv4 operational replay",
     scm_operational_replay_authentication_eligible is False),
]

passed = sum(bool(ok) for _, ok in tests)
for name, ok in tests:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")
print(f"RESULT: {passed}/{len(tests)} PASS")

if passed != len(tests):
    raise SystemExit(1)
