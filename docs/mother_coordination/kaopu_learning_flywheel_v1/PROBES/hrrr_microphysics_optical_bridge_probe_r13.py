#!/usr/bin/env python3
"""KAOPU R13 bounded semantic probe.

This probe uses test-only synthetic numbers. It does NOT claim decoded HRRR
atmospheric values. It tests whether the public HRRR native field schema plus
an explicit microphysics/optics contract is sufficient to avoid common
category errors.
"""

import math

HRRR_NATIVE_LOCKED_FIELDS = {
    "PRES", "CLWMR", "CIMIXR", "RWMR", "SNMR", "GRLE",
    "NCONCD", "NCCICE", "SPNCR", "FRACCC", "HGT", "TMP",
    "SPFH", "MASSDEN",
}

# DTC/WRF Thompson calc_effectRad inputs mapped to public HRRR field names.
THOMPSON_EFFECTIVE_RADIUS_INPUTS = {
    "TMP", "PRES", "SPFH", "CLWMR", "NCONCD", "CIMIXR", "NCCICE", "SNMR"
}

DIRECT_EFFECTIVE_RADIUS_NAMES = {"RE_CLOUD", "RE_ICE", "RE_SNOW", "REFF"}


def check(name, condition, detail):
    if not condition:
        raise AssertionError(f"FAIL {name}: {detail}")
    print(f"PASS {name}: {detail}")


def main():
    check(
        "public_bundle_covers_calc_effectRad_inputs",
        THOMPSON_EFFECTIVE_RADIUS_INPUTS <= HRRR_NATIVE_LOCKED_FIELDS,
        sorted(THOMPSON_EFFECTIVE_RADIUS_INPUTS),
    )

    check(
        "effective_radius_not_directly_exposed_in_locked_index",
        HRRR_NATIVE_LOCKED_FIELDS.isdisjoint(DIRECT_EFFECTIVE_RADIUS_NAMES),
        "re_cloud/re_ice/re_snow must be derived/replayed, not relabeled as native GRIB fields",
    )

    # Test-only liquid-cloud state. These are not HRRR observations.
    rho_water = 1000.0          # kg m^-3
    qc = 5.0e-4                 # kg water per kg air
    nc = 1.0e8                  # droplets per kg air
    mass_per_drop = qc / nc
    r_mono = (3.0 * mass_per_drop / (4.0 * math.pi * rho_water)) ** (1.0 / 3.0)

    # Same total number and total mass, different PSD -> different projected area.
    r_small = 0.5 * r_mono
    r_large = (2.0 * r_mono**3 - r_small**3) ** (1.0 / 3.0)
    area_mono = math.pi * r_mono**2
    area_bimodal = 0.5 * math.pi * r_small**2 + 0.5 * math.pi * r_large**2
    area_ratio = area_bimodal / area_mono
    check(
        "mass_plus_number_do_not_uniquely_fix_optical_cross_section",
        abs(area_ratio - 1.0) > 0.05,
        f"same mass+number but bimodal/mono projected-area ratio={area_ratio:.9f}",
    )

    # A simple geometric-optics wiring example. Qext=2 is test-only here and is
    # not promoted as a universal visible-cloud closure.
    qext = 2.0
    rho_air_lo = 0.6
    rho_air_hi = 1.2
    alpha_lo = qext * area_mono * nc * rho_air_lo
    alpha_hi = qext * area_mono * nc * rho_air_hi
    check(
        "extinction_per_length_depends_on_air_density",
        math.isclose(alpha_hi / alpha_lo, 2.0, rel_tol=0.0, abs_tol=1e-12),
        f"alpha(rho=0.6)={alpha_lo:.9f} m^-1; alpha(rho=1.2)={alpha_hi:.9f} m^-1",
    )

    check(
        "q_over_n_radius_is_only_an_explicit_candidate_shortcut",
        5.0e-6 < r_mono < 20.0e-6,
        f"test-only monodisperse radius={r_mono * 1e6:.6f} um; not source-native Thompson re_cloud",
    )

    # Renderer-neutral optical decomposition invariant.
    omega0 = 0.999  # test-only evaluator wiring value
    alpha_ext = alpha_lo
    alpha_sca = omega0 * alpha_ext
    alpha_abs = (1.0 - omega0) * alpha_ext
    check(
        "optical_decomposition_conserves_extinction",
        math.isclose(alpha_abs + alpha_sca, alpha_ext, rel_tol=0.0, abs_tol=1e-12),
        f"ext={alpha_ext:.9f}, sca={alpha_sca:.9f}, abs={alpha_abs:.9f} m^-1",
    )

    required_ice_context = {
        "wavelength_or_band",
        "ice_habit_or_scattering_model",
        "phase_function_or_asymmetry_model",
    }
    public_hrrr_optical_context = set()
    check(
        "ice_visible_optics_remain_typed_missing_without_spectral_habit_model",
        not required_ice_context <= public_hrrr_optical_context,
        sorted(required_ice_context - public_hrrr_optical_context),
    )

    print("7/7 PASS")


if __name__ == "__main__":
    main()
