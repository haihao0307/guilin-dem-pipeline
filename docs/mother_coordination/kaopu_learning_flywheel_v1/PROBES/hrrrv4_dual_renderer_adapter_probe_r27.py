#!/usr/bin/env python3
"""
KAOPU R27 dual-renderer cloud-adapter contract probe.

Bounded numeric/source-semantic evidence only. This is not an Unreal Engine,
Karma, WRF, or HRRR runtime execution and is not a physical atmospheric
observation.

The optical fixture uses a small exact subset of locked HRRRv4/WRF3.9
RRTMG-SW cloud coefficients/formulas from:
NOAA-EMC/HRRR commit 40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827
WRFV3.9/phys/module_ra_rrtmg_sw.F

The two renderer adapters test transferable quantity/identity boundaries:
- Karma-style: absorption/scattering rates in m^-1 plus anisotropy g.
- UE-style semantic binding: albedo + physical extinction, with engine-unit
  conversion and phase-function binding deliberately unresolved unless an
  explicit adapter policy/calibration is supplied.
"""

from dataclasses import dataclass
from math import exp, isclose
from typing import Tuple

# Exact locked RRTMG-SW subset sufficient for r_liq = 8 um interpolation.
EXTLIQ = {
    16: (9.004493e-01, 6.366723e-01, 4.542354e-01, 3.468253e-01,
         2.816431e-01, 2.383415e-01, 2.070854e-01),
    17: (6.741200e-01, 5.390739e-01, 4.198767e-01, 3.332553e-01,
         2.735633e-01, 2.317727e-01, 2.012760e-01),
}
SSALIQ = {
    16: (8.362119e-01, 8.098460e-01, 7.762291e-01, 7.486042e-01,
         7.294172e-01, 7.161000e-01, 7.060656e-01),
    17: (6.995459e-01, 7.158012e-01, 7.076001e-01, 6.927244e-01,
         6.786434e-01, 6.673545e-01, 6.585859e-01),
}
ASYLIQ = {
    16: (8.038165e-01, 8.014154e-01, 7.942381e-01, 7.970521e-01,
         8.086621e-01, 8.233392e-01, 8.374127e-01),
    17: (8.941000e-01, 9.054049e-01, 9.049510e-01, 9.027216e-01,
         9.021636e-01, 9.037878e-01, 9.069852e-01),
}

# Locked Ebert-Curry branch coefficients for the 2500-4000 cm^-1 interval.
ABARI = 3.448e-03
BBARI = 2.431
CBARI = 4.666e-01
DBARI = 2.050e-05
EBARI = 9.595e-01
FBARI = 1.076e-04


@dataclass(frozen=True)
class WeatherLayer:
    cloud_fraction: float
    path_m: float
    liquid_path_g_m2: float
    ice_path_g_m2: float
    snow_path_g_m2: float
    liquid_radius_um: float
    ice_radius_um: float
    snow_radius_um: float
    amount_semantics: str = "in_cloud_water_path_g_m2"
    subgrid_semantics: str = "binary_clear_cloudy_fraction"


@dataclass(frozen=True)
class BandOptics:
    band: int
    tau: float
    ssa: float
    g: float


@dataclass(frozen=True)
class SpectralLayerOpticalPacket:
    bands: Tuple[BandOptics, ...]
    cloud_fraction: float
    path_m: float
    optical_model: str
    amount_semantics: str
    subgrid_semantics: str


def interp_locked(values, radius_um):
    index = int(radius_um - 1.5)
    if index == 0:
        index = 1
    if index == 58:
        index = 57
    fraction = radius_um - 1.5 - float(index)
    return values[index - 1] + fraction * (values[index] - values[index - 1])


def liquid_props(radius_um, band):
    return (
        interp_locked(EXTLIQ[band], radius_um),
        interp_locked(SSALIQ[band], radius_um),
        interp_locked(ASYLIQ[band], radius_um),
    )


def ebert_curry_ice_props(radius_um):
    extinction = ABARI + BBARI / radius_um
    ssa = 1.0 - CBARI - DBARI * radius_um
    g = min(1.0 - 1e-12, EBARI + FBARI * radius_um)
    return extinction, ssa, g


def evaluate_optics(layer):
    if layer.amount_semantics != "in_cloud_water_path_g_m2":
        raise ValueError("fixture requires explicit in-cloud water-path semantics")
    bands = []
    for band in (16, 17):
        contributions = []
        phase_inputs = (
            (layer.liquid_path_g_m2, liquid_props(layer.liquid_radius_um, band)),
            (layer.ice_path_g_m2, ebert_curry_ice_props(layer.ice_radius_um)),
            # Locked source reuses ice-family constants for this snow fixture;
            # snow remains a distinct hydrometeor category in provenance.
            (layer.snow_path_g_m2, ebert_curry_ice_props(layer.snow_radius_um)),
        )
        for water_path, (extinction, ssa, g) in phase_inputs:
            tau = water_path * extinction
            scatter_tau = tau * ssa
            contributions.append((tau, scatter_tau, scatter_tau * g))
        total_tau = sum(x[0] for x in contributions)
        total_scatter_tau = sum(x[1] for x in contributions)
        total_ssa = total_scatter_tau / total_tau
        total_g = sum(x[2] for x in contributions) / total_scatter_tau
        bands.append(BandOptics(band, total_tau, total_ssa, total_g))
    return SpectralLayerOpticalPacket(
        tuple(bands),
        layer.cloud_fraction,
        layer.path_m,
        "locked-HRRRv4-RRTMG-SW-structural-fixture",
        layer.amount_semantics,
        layer.subgrid_semantics,
    )


def karma_style_adapter(packet):
    """Renderer-neutral shape matching Karma's documented local vocabulary."""
    output = []
    for item in packet.bands:
        sigma_t = item.tau / packet.path_m
        sigma_s = item.ssa * sigma_t
        sigma_a = (1.0 - item.ssa) * sigma_t
        output.append({
            "band": item.band,
            "absorption_m_inverse": sigma_a,
            "scattering_m_inverse": sigma_s,
            "anisotropy": item.g,
        })
    return tuple(output)


def ue_style_semantic_adapter(
    packet,
    *,
    meters_per_engine_length_unit=None,
    phase_binding_policy=None,
    conservative_density_hint=1.0,
):
    """
    Preserve physical coefficients separately from an engine numeric binding.

    Current UE documentation calls Volume-material Extinction a world-space
    density, but does not state an SI extinction unit. Therefore this probe does
    not silently assume a final UE numeric scale. An explicit declared length
    conversion can be tested algebraically, while actual UE binding remains a
    separate engine-runtime calibration gate.
    """
    output = []
    for item in packet.bands:
        sigma_t = item.tau / packet.path_m
        engine_extinction = (
            None if meters_per_engine_length_unit is None
            else sigma_t * meters_per_engine_length_unit
        )
        phase_binding = (
            None if phase_binding_policy is None
            else {"policy": phase_binding_policy, "source_g": item.g}
        )
        output.append({
            "band": item.band,
            "albedo": item.ssa,
            "physical_extinction_m_inverse": sigma_t,
            "source_asymmetry_g": item.g,
            "engine_extinction": engine_extinction,
            "phase_binding": phase_binding,
            # This is an evaluator acceleration hint only. It is deliberately
            # not used in the physical coefficient equations above.
            "conservative_density_hint": conservative_density_hint if item.tau > 0 else 0.0,
        })
    return tuple(output)


def binary_subcolumn_transmission(cloud_fraction, in_cloud_tau):
    return (1.0 - cloud_fraction) + cloud_fraction * exp(-in_cloud_tau)


def spectral_projection(values, matrix=None):
    if matrix is None:
        raise ValueError("spectral-to-display projection identity is required")
    return tuple(
        sum(row[i] * values[i] for i in range(len(values)))
        for row in matrix
    )


tests = []


def check(name, condition):
    tests.append((name, bool(condition)))


layer = WeatherLayer(
    cloud_fraction=0.35,
    path_m=600.0,
    liquid_path_g_m2=12.0,
    ice_path_g_m2=6.0,
    snow_path_g_m2=2.0,
    liquid_radius_um=8.0,
    ice_radius_um=30.0,
    snow_radius_um=60.0,
)
packet = evaluate_optics(layer)
packet_snapshot = packet

karma = karma_style_adapter(packet)
ue_unbound = ue_style_semantic_adapter(packet)

check("two_spectral_bands_remain_distinct",
      not isclose(packet.bands[0].tau, packet.bands[1].tau))
check("spectral_packet_is_immutable",
      packet.__dataclass_params__.frozen and packet == packet_snapshot)

for k_item, u_item in zip(karma, ue_unbound):
    band = k_item["band"]
    sigma_a = k_item["absorption_m_inverse"]
    sigma_s = k_item["scattering_m_inverse"]
    sigma_t = u_item["physical_extinction_m_inverse"]
    check(f"local_coefficient_conservation_band_{band}",
          isclose(sigma_a + sigma_s, sigma_t, rel_tol=1e-12))
    check(f"karma_ue_algebraic_albedo_equivalence_band_{band}",
          isclose(sigma_s / sigma_t, u_item["albedo"], rel_tol=1e-12))
    check(f"ue_engine_extinction_not_guessed_band_{band}",
          u_item["engine_extinction"] is None)
    check(f"ue_phase_mapping_not_guessed_band_{band}",
          u_item["phase_binding"] is None)

# A declared 0.01 m/world-unit scale is used only as a mathematical test fixture.
# It is not claimed as an authenticated UE Extinction unit.
ue_declared_scale = ue_style_semantic_adapter(
    packet, meters_per_engine_length_unit=0.01
)
for band_item, u_item in zip(packet.bands, ue_declared_scale):
    path_in_declared_units = packet.path_m / 0.01
    check(f"declared_length_scale_preserves_tau_band_{band_item.band}",
          isclose(
              u_item["engine_extinction"] * path_in_declared_units,
              band_item.tau,
              rel_tol=1e-12,
          ))

# Partial cloud is not collapsed into a linear extinction multiplier.
for band_item in packet.bands:
    mixture_t = binary_subcolumn_transmission(packet.cloud_fraction, band_item.tau)
    naive_t = exp(-packet.cloud_fraction * band_item.tau)
    check(f"partial_cloud_subcolumn_is_nonlinear_band_{band_item.band}",
          abs(mixture_t - naive_t) > 1e-4)

# UE Conservative Density is treated as an optimization hint, not physical state.
ue_hint_low = ue_style_semantic_adapter(
    packet, meters_per_engine_length_unit=0.01, conservative_density_hint=0.1
)
ue_hint_high = ue_style_semantic_adapter(
    packet, meters_per_engine_length_unit=0.01, conservative_density_hint=10.0
)
check("conservative_density_hint_does_not_change_physical_extinction",
      all(isclose(a["physical_extinction_m_inverse"], b["physical_extinction_m_inverse"])
              for a, b in zip(ue_hint_low, ue_hint_high)))
check("conservative_density_hint_does_not_change_albedo",
      all(isclose(a["albedo"], b["albedo"])
              for a, b in zip(ue_hint_low, ue_hint_high)))

# Spectral-to-display conversion must be an explicit evaluator operation.
try:
    spectral_projection([x.tau for x in packet.bands])
    missing_projection_rejected = False
except ValueError:
    missing_projection_rejected = True
check("missing_spectral_projection_is_rejected", missing_projection_rejected)

test_projection = (
    (0.70, 0.30),
    (0.50, 0.50),
    (0.20, 0.80),
)
display_triplet = spectral_projection(
    [x.tau for x in packet.bands],
    test_projection,
)
check("projection_is_derived_and_does_not_mutate_packet",
      len(display_triplet) == 3 and packet == packet_snapshot)

# Default UE cloud material documents dual phase-function and multiscatter
# controls; a single source asymmetry g is therefore not silently promoted
# to those artist/evaluator parameters.
ue_custom_phase = ue_style_semantic_adapter(
    packet,
    phase_binding_policy="explicit-custom-single-HG-candidate",
)
check("phase_binding_requires_explicit_policy",
      all(x["phase_binding"]["policy"] == "explicit-custom-single-HG-candidate"
          for x in ue_custom_phase))

passed = sum(ok for _, ok in tests)
for name, ok in tests:
    print(f"{'PASS' if ok else 'FAIL'} {name}")
print(f"{passed}/{len(tests)} PASS")

if passed != len(tests):
    raise SystemExit(1)
