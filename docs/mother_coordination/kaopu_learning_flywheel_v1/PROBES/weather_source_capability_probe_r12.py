#!/usr/bin/env python3
"""KAOPU R12 bounded semantic probe: Weather source capability/query-support contracts.

This is contract/executable evidence only. It does not assert meteorological truth for any
particular HRRR grid cell. Source capability constants are tied to the R12 source lock.
"""

HRRR = {
    "role": "operational_model_analysis_and_forecast",
    "horizontal_km": 3.0,
    "update_hours": 1.0,
    "domain": "regional_CONUS_with_separate_Alaska_sector",
    "native_levels": 50,
    "native_level_fields": {
        "PRES", "CLWMR", "CIMIXR", "RWMR", "SNMR", "GRLE",
        "NCONCD", "NCCICE", "SPNCR", "FRACCC", "HGT", "TMP",
        "SPFH", "UGRD", "VGRD", "VVEL", "TKE", "MASSDEN",
    },
    "subhourly_support_kind": "2d_surface_level_product",
}

MERRA2 = {
    "role": "delayed_global_reanalysis",
    "horizontal_km_approx": 50.0,
    "time_support_hours": 3.0,
    "domain": "global",
}

RENDERER_QUERY_FOOTPRINT_M = 100.0  # test-only local rendering target


def run():
    required_microphysics = {
        "PRES", "HGT", "CLWMR", "CIMIXR", "NCONCD", "NCCICE",
        "FRACCC", "TMP", "SPFH",
    }
    direct_renderer_optics = {
        "EXTINCTION", "SCATTERING", "SINGLE_SCATTER_ALBEDO", "PHASE_G"
    }

    area_support_ratio = (MERRA2["horizontal_km_approx"] / HRRR["horizontal_km"]) ** 2
    temporal_ratio = MERRA2["time_support_hours"] / HRRR["update_hours"]
    hrrr_to_local_gap = HRRR["horizontal_km"] * 1000.0 / RENDERER_QUERY_FOOTPRINT_M
    merra_to_local_gap = MERRA2["horizontal_km_approx"] * 1000.0 / RENDERER_QUERY_FOOTPRINT_M

    # A 2-D summary/integral cannot identify a unique 3-D profile.
    profile_a = [1.0, 0.0]
    profile_b = [0.0, 1.0]

    checks = [
        ("native cloud/microphysics state present", required_microphysics.issubset(HRRR["native_level_fields"])),
        ("renderer optical closure not directly present", direct_renderer_optics.isdisjoint(HRRR["native_level_fields"])),
        ("HRRR reduces coarse support gap versus MERRA-2", area_support_ratio > 250.0 and temporal_ratio == 3.0),
        ("100 m local target still requires downscaling", 1.0 < hrrr_to_local_gap < merra_to_local_gap),
        ("regional model cannot be universal global source", HRRR["domain"].startswith("regional")),
        ("2-D support does not uniquely identify a 3-D profile", sum(profile_a) == sum(profile_b) and profile_a != profile_b),
        ("model analysis/forecast is not an atmospheric Observation root", "observation" not in HRRR["role"]),
    ]

    passed = sum(1 for _, ok in checks if ok)
    for name, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'}: {name}")
    print(f"RESULT: {passed}/{len(checks)} PASS")
    print(f"MERRA2/HRRR nominal horizontal support-area ratio: {area_support_ratio:.6f}")
    print(f"MERRA2/HRRR temporal-support ratio: {temporal_ratio:.6f}")
    print(f"HRRR/100m nominal footprint ratio: {hrrr_to_local_gap:.6f}")
    print(f"MERRA2/100m nominal footprint ratio: {merra_to_local_gap:.6f}")

    if passed != len(checks):
        raise SystemExit(1)


if __name__ == "__main__":
    run()
