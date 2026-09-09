#!/usr/bin/env python3
"""KAOPU R09 bounded executable probe.

Exercise one real radiosonde-derived weather-column fixture without silently
turning moisture diagnostics into cloud truth or coordinate conversion into
spatial retargeting.

The embedded Salt Lake City TEMP groups are a transport-mirror fixture. Their
source/evidence limits are recorded in references/weather-column-r09/SOURCE_LOCK.json.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import exp, log
from typing import Optional

STATION_ID = "USM00072572"
WMO_ID = "72572"
STATION_ELEVATION_M = 1289.0

TTAA_HEIGHT_GROUPS = ("85500", "70146", "50584")
TTBB_THERMO_GROUPS = (
    ("11639", "03849"),
    ("22596", "00435"),
    ("33586", "00339"),
    ("44567", "02530"),
    ("55558", "03536"),
    ("66541", "05728"),
    ("77507", "08561"),
)

class UnsupportedConversion(RuntimeError):
    pass

@dataclass(frozen=True)
class NativeLevel:
    pressure_hpa: float
    geopotential_height_m: Optional[float]
    temperature_c: Optional[float] = None
    dewpoint_depression_c: Optional[float] = None

@dataclass(frozen=True)
class DerivedInterval:
    base_pressure_hpa: float
    top_pressure_hpa: float
    base_geopotential_m: float
    top_geopotential_m: float
    derivation: str
    status: str = "Candidate"

@dataclass(frozen=True)
class RuntimePlacement:
    base_geopotential_m: float
    top_geopotential_m: float
    terrain_height_m: float
    base_agl_m: float
    top_agl_m: float
    operation: str
    lineage: str


def decode_ttaa_mandatory_height(group: str) -> NativeLevel:
    """Decode only the standard pressure groups used by this bounded fixture."""
    code = group[:2]
    hhh = int(group[2:])
    if code == "85":
        height = hhh + (1000 if hhh <= 500 else 0)
        return NativeLevel(850.0, float(height))
    if code == "70":
        return NativeLevel(700.0, float(hhh + 3000))
    if code == "50":
        return NativeLevel(500.0, float(hhh * 10))
    raise UnsupportedConversion(f"R09 probe intentionally does not decode {group}")


def decode_temperature_and_depression(group: str) -> tuple[float, float]:
    ttt = int(group[:3])
    temp = ttt / 10.0
    if int(group[2]) % 2 == 1:
        temp = -temp
    dd = int(group[3:])
    depression = dd / 10.0 if dd <= 50 else float(dd - 50)
    return temp, depression


def decode_ttbb_pair(level_group: str, thermo_group: str) -> NativeLevel:
    pressure = float(int(level_group[2:]))
    temp, depression = decode_temperature_and_depression(thermo_group)
    return NativeLevel(pressure, None, temp, depression)


def log_pressure_interpolate_height(p_hpa: float, lower: NativeLevel, upper: NativeLevel) -> float:
    if lower.geopotential_height_m is None or upper.geopotential_height_m is None:
        raise UnsupportedConversion("mandatory geopotential-height anchors required")
    if not (upper.pressure_hpa <= p_hpa <= lower.pressure_hpa):
        raise UnsupportedConversion("pressure is outside bounded interpolation segment")
    f = (log(lower.pressure_hpa) - log(p_hpa)) / (log(lower.pressure_hpa) - log(upper.pressure_hpa))
    return lower.geopotential_height_m + f * (upper.geopotential_height_m - lower.geopotential_height_m)


def derive_moist_interval(levels: tuple[NativeLevel, ...], threshold_c: float = 4.0) -> tuple[float, float]:
    """Diagnostic only. Dewpoint-depression threshold is NOT a cloud observation."""
    selected = [
        x.pressure_hpa for x in levels
        if x.dewpoint_depression_c is not None and x.dewpoint_depression_c <= threshold_c
    ]
    if not selected:
        raise RuntimeError("no bounded moist diagnostic interval")
    return max(selected), min(selected)


def coordinate_convert(interval: DerivedInterval, terrain_height_m: float) -> RuntimePlacement:
    return RuntimePlacement(
        interval.base_geopotential_m,
        interval.top_geopotential_m,
        terrain_height_m,
        interval.base_geopotential_m - terrain_height_m,
        interval.top_geopotential_m - terrain_height_m,
        "coordinate_conversion",
        "same-physical-column / derived AGL diagnostic",
    )


def spatial_retarget_preserve_agl(
    interval: DerivedInterval, source_terrain_m: float, target_terrain_m: float
) -> RuntimePlacement:
    delta = target_terrain_m - source_terrain_m
    base = interval.base_geopotential_m + delta
    top = interval.top_geopotential_m + delta
    return RuntimePlacement(
        base,
        top,
        target_terrain_m,
        base - target_terrain_m,
        top - target_terrain_m,
        "spatial_retarget",
        "DerivedSyntheticRetarget / preserve-source-AGL",
    )


def require_ellipsoid_height(
    geopotential_height_m: float, geoid_separation_m: Optional[float]
) -> float:
    if geoid_separation_m is None:
        raise UnsupportedConversion("geoid/ellipsoid transform context missing")
    return geopotential_height_m + geoid_separation_m


def synthetic_light_transmittance(tau: float) -> float:
    """Evaluator-only Beer-Lambert wiring fixture; tau is not inferred from radiosonde."""
    return exp(-tau)


def main() -> None:
    mandatory = {
        x.pressure_hpa: x for x in map(decode_ttaa_mandatory_height, TTAA_HEIGHT_GROUPS)
    }
    significant = tuple(decode_ttbb_pair(a, b) for a, b in TTBB_THERMO_GROUPS)

    tests: list[tuple[str, bool]] = []
    tests.append((
        "real mandatory-height groups decode to expected geopotential anchors",
        mandatory[850.0].geopotential_height_m == 1500.0
        and mandatory[700.0].geopotential_height_m == 3146.0
        and mandatory[500.0].geopotential_height_m == 5840.0,
    ))

    p_base, p_top = derive_moist_interval(significant)
    tests.append((
        "moist diagnostic interval is recovered without calling it cloud truth",
        p_base == 596.0 and p_top == 541.0,
    ))

    base_z = log_pressure_interpolate_height(
        p_base, mandatory[700.0], mandatory[500.0]
    )
    top_z = log_pressure_interpolate_height(
        p_top, mandatory[700.0], mandatory[500.0]
    )
    interval = DerivedInterval(
        p_base,
        p_top,
        base_z,
        top_z,
        "dewpoint-depression<=4C diagnostic + log-pressure interpolation between observed 700/500-hPa geopotential anchors",
    )

    source = coordinate_convert(interval, STATION_ELEVATION_M)
    higher_terrain = coordinate_convert(interval, STATION_ELEVATION_M + 1000.0)
    tests.append((
        "coordinate conversion preserves physical geopotential placement",
        source.base_geopotential_m == higher_terrain.base_geopotential_m
        and source.top_geopotential_m == higher_terrain.top_geopotential_m
        and abs((higher_terrain.base_agl_m - source.base_agl_m) + 1000.0) < 1e-9,
    ))

    retarget = spatial_retarget_preserve_agl(
        interval, STATION_ELEVATION_M, STATION_ELEVATION_M + 1000.0
    )
    tests.append((
        "preserving AGL over new terrain is explicitly a synthetic retarget",
        retarget.operation == "spatial_retarget"
        and retarget.lineage.startswith("DerivedSyntheticRetarget")
        and abs(retarget.base_agl_m - source.base_agl_m) < 1e-9
        and abs(retarget.base_geopotential_m - source.base_geopotential_m - 1000.0) < 1e-9,
    ))

    cloud_optical_state = {
        "cloud_fraction": None,
        "specific_cloud_liquid_water": None,
        "specific_cloud_ice_water": None,
        "extinction_m-1": None,
    }
    tests.append((
        "radiosonde thermodynamics do not silently synthesize cloud optical truth",
        all(v is None for v in cloud_optical_state.values()),
    ))

    try:
        require_ellipsoid_height(interval.base_geopotential_m, None)
        ellipsoid_rejected = False
    except UnsupportedConversion:
        ellipsoid_rejected = True
    tests.append((
        "ellipsoid placement is rejected without geoid transform context",
        ellipsoid_rejected,
    ))

    weather_state_before = (interval, cloud_optical_state.copy())
    t_lo, t_mid, t_hi = map(synthetic_light_transmittance, (0.2, 1.2, 2.0))
    weather_state_after = (interval, cloud_optical_state.copy())
    tests.append((
        "synthetic optical evaluator is monotonic and does not mutate weather state",
        t_lo > t_mid > t_hi and weather_state_before == weather_state_after,
    ))

    passed = sum(ok for _, ok in tests)
    for name, ok in tests:
        print(f"{'PASS' if ok else 'FAIL'}  {name}")
    print("---")
    print(f"fixture_station={STATION_ID}/{WMO_ID} station_elevation_m={STATION_ELEVATION_M:.1f}")
    print(f"diagnostic_pressure_interval_hpa={p_base:.0f}..{p_top:.0f}")
    print(f"derived_geopotential_interval_m={base_z:.3f}..{top_z:.3f}")
    print(f"source_AGL_m={source.base_agl_m:.3f}..{source.top_agl_m:.3f}")
    print(
        "same-physical-column_over_+1000m-terrain_AGL_m="
        f"{higher_terrain.base_agl_m:.3f}..{higher_terrain.top_agl_m:.3f}"
    )
    print(
        "retarget_preserve_AGL_geopotential_m="
        f"{retarget.base_geopotential_m:.3f}..{retarget.top_geopotential_m:.3f}"
    )
    print(f"synthetic_T(tau=0.2,1.2,2.0)={t_lo:.6f},{t_mid:.6f},{t_hi:.6f}")
    print(f"RESULT {passed}/{len(tests)} PASS")
    if passed != len(tests):
        raise SystemExit(1)

if __name__ == "__main__":
    main()
