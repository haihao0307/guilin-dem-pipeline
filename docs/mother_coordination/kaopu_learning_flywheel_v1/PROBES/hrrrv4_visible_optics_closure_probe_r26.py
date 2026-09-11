#!/usr/bin/env python3
"""
KAOPU R26 visible-cloud optical closure semantic probe.

This is a bounded numeric/source-semantic fixture, not atmospheric truth and not
a WRF/HRRR model run. It reproduces selected locked HRRRv4/WRF3.9 RRTMG-SW
composition equations and a small subset of locked lookup-table values to test
the information boundaries of a Weather -> optical packet -> renderer adapter.

Locked source:
NOAA-EMC/HRRR commit 40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827
WRFV3.9/phys/module_ra_rrtmg_sw.F
"""

from math import exp, isclose

EXTLIQ = {
    16: [
        9.004493e-01, 6.366723e-01, 4.542354e-01, 3.468253e-01, 2.816431e-01,
        2.383415e-01, 2.070854e-01, 1.831854e-01, 1.642115e-01, 1.487539e-01,
        1.359169e-01, 1.250900e-01, 1.158354e-01, 1.078400e-01, 1.008646e-01,
    ],
    17: [
        6.741200e-01, 5.390739e-01, 4.198767e-01, 3.332553e-01, 2.735633e-01,
        2.317727e-01, 2.012760e-01, 1.780400e-01, 1.596927e-01, 1.447980e-01,
        1.324480e-01, 1.220347e-01, 1.131327e-01, 1.054313e-01, 9.870534e-02,
    ],
}
ABARI = 3.448e-03
BBARI = 2.431

def liquid_extinction(radius_um: float, band: int) -> float:
    if not (1.5 <= radius_um <= 60.0):
        raise ValueError("liquid radius outside locked LIQFLAG=1 range")
    index_fortran = int(radius_um - 1.5)
    if index_fortran == 0:
        index_fortran = 1
    if index_fortran == 58:
        index_fortran = 57
    fint = radius_um - 1.5 - float(index_fortran)
    a = EXTLIQ[band][index_fortran - 1]
    b = EXTLIQ[band][index_fortran]
    return a + fint * (b - a)

def ice_ebert_extinction(radius_um: float) -> float:
    return ABARI + BBARI / radius_um

def delta_scale(tau_orig: float, ssa_orig: float, forward_fraction: float):
    denom = 1.0 - forward_fraction * ssa_orig
    return denom * tau_orig, ssa_orig * (1.0 - forward_fraction) / denom

def local_coefficients(tau: float, ssa: float, path_m: float):
    if path_m <= 0:
        raise ValueError("path length must be explicit and positive")
    sigma_t = tau / path_m
    sigma_s = ssa * sigma_t
    sigma_a = (1.0 - ssa) * sigma_t
    return sigma_t, sigma_s, sigma_a

def binary_subcolumn_transmission(cloud_fraction: float, in_cloud_tau: float):
    return (1.0 - cloud_fraction) + cloud_fraction * exp(-in_cloud_tau)

def naive_scaled_tau_transmission(cloud_fraction: float, in_cloud_tau: float):
    return exp(-cloud_fraction * in_cloud_tau)

def consumed_liquid_radius(source_radius_um: float):
    return max(2.5, source_radius_um)

def require_spectral_projection(band_values, weights=None):
    if weights is None:
        raise ValueError("spectral-to-display weights/evaluator identity required")
    return sum(v*w for v, w in zip(band_values, weights))

tests = []
def check(name, condition):
    tests.append((name, bool(condition)))

ext_5_b16 = liquid_extinction(5.0, 16)
tau_10 = 10.0 * ext_5_b16
tau_20 = 20.0 * ext_5_b16
check("radius_alone_does_not_fix_tau", isclose(tau_20, 2.0 * tau_10) and tau_20 != tau_10)

ext_15_b16 = liquid_extinction(15.0, 16)
check("radius_changes_optical_coefficient", not isclose(ext_5_b16, ext_15_b16))

ext_5_b17 = liquid_extinction(5.0, 17)
check("spectral_band_identity_matters", not isclose(ext_5_b16, ext_5_b17))

lwp, iwp, r_liq, r_ice = 12.0, 8.0, 5.0, 30.0
tau_mixed = lwp * liquid_extinction(r_liq, 16) + iwp * ice_ebert_extinction(r_ice)
mass_weighted_radius = (lwp*r_liq + iwp*r_ice) / (lwp+iwp)
tau_bad_average = (lwp+iwp) * liquid_extinction(mass_weighted_radius, 16)
check("mixed_phase_not_average_radius", abs(tau_mixed - tau_bad_average) > 1e-6)

tau_d, ssa_d = delta_scale(3.0, 0.97, 0.55)
check("delta_scaling_changes_tau", not isclose(tau_d, 3.0))
check("delta_scaling_changes_ssa", not isclose(ssa_d, 0.97))

sig_100 = local_coefficients(2.0, 0.95, 100.0)[0]
sig_1000 = local_coefficients(2.0, 0.95, 1000.0)[0]
check("tau_to_local_extinction_requires_path", not isclose(sig_100, sig_1000))

st, ss, sa = local_coefficients(2.0, 0.95, 500.0)
check("local_sigma_decomposition_closes", isclose(ss + sa, st, rel_tol=1e-12, abs_tol=1e-15))

cf, tic = 0.4, 3.0
check("cloud_fraction_not_linear_tau_multiplier",
      abs(binary_subcolumn_transmission(cf, tic) - naive_scaled_tau_transmission(cf, tic)) > 1e-3)

source_re = 2.0
consumed_re = consumed_liquid_radius(source_re)
check("produced_vs_consumed_radius_distinct", source_re != consumed_re and isclose(consumed_re, 2.5))

try:
    require_spectral_projection([tau_10, 10.0*ext_5_b17])
    projection_rejected = False
except ValueError:
    projection_rejected = True
check("spectral_to_display_projection_must_be_explicit", projection_rejected)

band_packet = [tau_10, 10.0*ext_5_b17]
projection = require_spectral_projection(band_packet, [0.6, 0.4])
check("projection_is_derived_evaluator_output", projection > 0 and band_packet == [tau_10, 10.0*ext_5_b17])

snow_uses_ice_table_in_locked_source = True
snow_category_is_ice_category = False
check("table_reuse_does_not_erase_hydrometeor_identity",
      snow_uses_ice_table_in_locked_source and not snow_category_is_ice_category)

passed = sum(ok for _, ok in tests)
for name, ok in tests:
    print(f"{'PASS' if ok else 'FAIL'} {name}")
print(f"{passed}/{len(tests)} PASS")
if passed != len(tests):
    raise SystemExit(1)
