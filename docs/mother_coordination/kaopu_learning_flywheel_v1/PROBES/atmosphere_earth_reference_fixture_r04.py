#!/usr/bin/env python3
"""KAOPU Atmosphere R04 reference-root fixture.

Bounded purpose:
- encode the U.S. Standard Atmosphere 1976 lower-atmosphere defining equations
  from official NASA/NOAA documentation as a static regression root;
- preserve NRLMSIS 2.1 as a separate driver-conditioned whole-atmosphere root;
- use release-package test vectors only as Candidate executable evidence when
  transported through a non-authoritative mirror;
- define, but do not fabricate, HITRAN numerical optical checkpoints when no
  authenticated line-data retrieval has been performed.

This is a coordinator learning probe, not a production Mother implementation.
"""

import json
import math

USSA = {
    "source": "U.S. Standard Atmosphere, 1976 (NASA-TM-X-74335 / NOAA-S/T-76-1562)",
    "status": "ObservationRoot",
    "role": "static-regression-reference",
    "constants": {
        "Rstar_J_per_kmol_K": 8.31432e3,
        "M0_kg_per_kmol": 28.9644,
        "g0_m_s2": 9.80665,
        "P0_Pa": 101325.0,
        "T0_K": 288.15,
        "earth_effective_radius_km": 6356.766,
    },
    "layers": [
        {"H_b_km_geopotential": 0.0, "L_M_K_per_km": -6.5},
        {"H_b_km_geopotential": 11.0, "L_M_K_per_km": 0.0},
        {"H_b_km_geopotential": 20.0, "L_M_K_per_km": 1.0},
        {"H_b_km_geopotential": 32.0, "L_M_K_per_km": 2.8},
        {"H_b_km_geopotential": 47.0, "L_M_K_per_km": 0.0},
        {"H_b_km_geopotential": 51.0, "L_M_K_per_km": -2.8},
        {"H_b_km_geopotential": 71.0, "L_M_K_per_km": -2.0},
        {"H_b_km_geopotential": 84.8520, "L_M_K_per_km": None},
    ],
}

NRLMSIS = {
    "source": "NRLMSIS 2.1",
    "officialSpecificationStatus": "ObservationRoot",
    "releaseVectorStatus": "Candidate",
    "releaseVectorTransport": "non-authoritative GitHub mirror of the public NRL package; not an independent Observation Root",
    "role": "driver-conditioned-whole-atmosphere-reference",
    "officialInputIdentity": [
        "year/day",
        "time_of_day",
        "geodetic_altitude_km",
        "geodetic_latitude_deg",
        "geodetic_longitude_deg",
        "solar_F10.7_81day",
        "solar_F10.7_previous_day",
        "geomagnetic_Ap",
    ],
    "sameAltitude500kmReleaseVectors": [
        {
            "iyd": 89039, "sec": 31499, "alt_km": 500.0,
            "glat_deg": 42.6, "glong_deg": -71.5,
            "f107a": 225.1, "f107": 216.4, "Ap": 14.0,
            "rho_g_cm3": 0.1034e-14, "T_K": 1036.90,
        },
        {
            "iyd": 3128, "sec": 34273, "alt_km": 500.0,
            "glat_deg": 6.5, "glong_deg": 96.0,
            "f107a": 125.8, "f107": 110.2, "Ap": 39.0,
            "rho_g_cm3": 0.1017e-14, "T_K": 1116.07,
        },
        {
            "iyd": 6257, "sec": 18301, "alt_km": 500.0,
            "glat_deg": -47.6, "glong_deg": 125.3,
            "f107a": 77.6, "f107": 82.9, "Ap": 4.0,
            "rho_g_cm3": 0.1879e-15, "T_K": 838.19,
        },
        {
            "iyd": 6022, "sec": 4328, "alt_km": 500.0,
            "glat_deg": 22.0, "glong_deg": 130.3,
            "f107a": 82.1, "f107": 93.9, "Ap": 6.0,
            "rho_g_cm3": 0.1339e-15, "T_K": 777.86,
        },
    ],
}

HITRAN = {
    "source": "HITRANonline definitions + HAPI documentation",
    "status": "ObservationRoot",
    "numericLineCheckpointStatus": "Unknown",
    "reason": "No authenticated HITRAN line-data retrieval was performed in this bounded cycle; HAPI currently requires an API key for downloads.",
    "checkpointSchema": {
        "spectral_coordinate": "vacuum_wavenumber_cm-1",
        "line_intensity_unit": "cm-1/(molecule*cm-2) at Tref=296 K",
        "required_state": [
            "molecule/isotopologue",
            "line_list_release_or_query_provenance",
            "temperature_K",
            "pressure",
            "line_shape_model",
            "column_number_density",
            "path_geometry",
        ],
        "derived_query": "optical_depth = column_number_density * absorption_coefficient",
    },
}


def geopotential_to_geometric_km(H_km):
    r = USSA["constants"]["earth_effective_radius_km"]
    return r * H_km / (r - H_km)


def build_ussa_layer_bases():
    c = USSA["constants"]
    R = c["Rstar_J_per_kmol_K"]
    M = c["M0_kg_per_kmol"]
    g = c["g0_m_s2"]
    T = c["T0_K"]
    P = c["P0_Pa"]
    out = []
    layers = USSA["layers"]

    for i, layer in enumerate(layers):
        H = layer["H_b_km_geopotential"]
        if i > 0:
            H_prev = layers[i - 1]["H_b_km_geopotential"]
            L_prev_km = layers[i - 1]["L_M_K_per_km"]
            dH_m = (H - H_prev) * 1000.0
            if L_prev_km == 0.0:
                P *= math.exp(-g * M * dH_m / (R * T))
            else:
                L_prev_m = L_prev_km / 1000.0
                T_next = T + L_prev_m * dH_m
                P *= (T / T_next) ** (g * M / (R * L_prev_m))
                T = T_next

        rho = P * M / (R * T)
        out.append({
            "H_km_geopotential": H,
            "Z_km_geometric": geopotential_to_geometric_km(H),
            "T_M_K": T,
            "P_Pa": P,
            "rho_kg_m3_from_PM0_RTM": rho,
        })
    return out


def summarize_nrl_vectors():
    vectors = NRLMSIS["sameAltitude500kmReleaseVectors"]
    temps = [v["T_K"] for v in vectors]
    rhos = [v["rho_g_cm3"] for v in vectors]
    assert len({v["alt_km"] for v in vectors}) == 1
    return {
        "alt_km": vectors[0]["alt_km"],
        "case_count": len(vectors),
        "temperature_min_K": min(temps),
        "temperature_max_K": max(temps),
        "temperature_span_K": max(temps) - min(temps),
        "mass_density_min_g_cm3": min(rhos),
        "mass_density_max_g_cm3": max(rhos),
        "mass_density_max_over_min": max(rhos) / min(rhos),
        "interpretationStatus": "Candidate",
        "interpretation": (
            "Altitude alone cannot identify an NRLMSIS state. "
            "The full driver/location/time tuple is part of reference-sample identity."
        ),
    }


def main():
    ussa_bases = build_ussa_layer_bases()

    # Locked checks derived directly from the official lower-atmosphere constants/equations.
    assert abs(ussa_bases[0]["P_Pa"] - 101325.0) < 1e-9
    assert abs(ussa_bases[0]["T_M_K"] - 288.15) < 1e-12
    assert abs(ussa_bases[-1]["Z_km_geometric"] - 86.0) < 5e-4
    assert all(ussa_bases[i + 1]["P_Pa"] < ussa_bases[i]["P_Pa"] for i in range(len(ussa_bases) - 1))

    result = {
        "probe": "KAOPU_ATMOSPHERE_R04_REFERENCE_ROOTS",
        "productionMotherMutation": False,
        "status": "Candidate",
        "observationRoots": {
            "USSA1976": {
                **USSA,
                "computedLayerBases": ussa_bases,
                "scopeNote": (
                    "This executable subset intentionally stops at the official 0-86 km "
                    "lower-atmosphere defining equations. It does not reimplement the "
                    "more complex 86-1000 km USSA species model in this cycle."
                ),
            },
            "NRLMSIS21": {
                **NRLMSIS,
                "sameAltitudeVariationSummary": summarize_nrl_vectors(),
            },
            "HITRAN": HITRAN,
        },
        "currentBestViewCandidate": [
            "Do not merge USSA1976 and NRLMSIS2.1 into one averaged truth profile; they are independent roots with different roles and validity semantics.",
            "Reference-sample identity must include source/version, coordinate type, units, altitude, and every driver required by that source.",
            "A reducer that removes time/location/solar/geomagnetic fields from a whole-atmosphere state must declare the approximation and its error/Unknown contract.",
            "Spectral checkpoints must bind coordinate convention, spectroscopy provenance, thermodynamic state, line-shape evaluator, and path/column state.",
        ],
        "unknown": [
            "Official NRL package was not executed locally in this cycle; mirrored release vectors remain Candidate executable evidence, not a new Observation Root.",
            "No authenticated HITRAN transition line was downloaded; numeric wavelength/wavenumber checkpoints remain Unknown rather than synthesized.",
            "USSA1976 86-1000 km species equations were not reimplemented in this bounded cycle.",
        ],
    }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
