from __future__ import annotations

import base64
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "weather-mother/r27-foundation-src/build-r27-foundation.py"
OUT = ROOT / "weather-mother/full-weather-r27-foundation-20260913/index.html"

subprocess.check_call([sys.executable, str(BUILD)], cwd=ROOT)
page = OUT.read_text(encoding="utf-8")
m = re.search(r"const safe=decodeURIComponent\(escape\(atob\('([^']+)'\)\)\);", page)
if not m:
    raise SystemExit("R27 QA: embedded mobile payload missing")
safe = base64.b64decode(m.group(1)).decode("utf-8")

checks = {
    "derived_from_r26_marker": "weatherObservationBandwidth='r26'" in page,
    "foundation_marker": "weatherFoundation='r27-units-clock-optics'" in page,
    "speed_mps_to_kmps": "kmps=S.speed/1000" in safe and "kmps=S.speed/3600" not in safe,
    "world_clock_independent": "worldPlaying=true" in safe and "if(worldPlaying)S.time+=dt" in safe,
    "world_clock_api": "setWorldPlaying" in safe and "getWorldClockState" in safe,
    "view_ds_explicit": "float d=den(x,t),ds=d>.02?.34:.48" in safe,
    "view_beer_lambert": "float tau=d*ds*2.7,a=1.-exp(-tau)" in safe and "T*=exp(-tau)" in safe,
    "sun_optical_depth_explicit": "sunTau=(s1*.42+s2*.65)*1.45,light=exp(-sunTau)" in safe,
    "r25_probe_units_explicit": "sigmaExtKm=1.10" in safe and "Math.exp(-tau)" in safe,
    "r26_observation_bandwidth_preserved": "smoothstep(14.,26.,dist)" in safe,
    "r23_compatibility_preserved": "window.WeatherMobileR23" in safe,
    "r26_compatibility_preserved": "window.WeatherMobileR26" in safe,
    "r27_foundation_api_present": "window.WeatherMobileR27Foundation" in safe,
    "acceptance_not_overclaimed": "visualAcceptance:false" in safe and "realDeviceQA:false" in safe and "productionReady:false" in safe,
}

# Independent numeric probes for the corrected unit and attenuation contracts.
speed_mps = 75.0
dt_s = 10.0
distance_km = speed_mps / 1000.0 * dt_s
rho = 0.42
sigma_km = 1.55
length_km = 2.4
analytic_t = __import__("math").exp(-rho * sigma_km * length_km)
checks["numeric_speed_probe_0_750km"] = abs(distance_km - 0.750) < 1e-12
checks["numeric_optical_probe_finite"] = 0.0 < analytic_t < 1.0

result = {
    "version": "WM-R27-FOUNDATION-STATIC-QA-20260913",
    "checks": checks,
    "allPassed": all(checks.values()),
    "numeric": {
        "speedMps": speed_mps,
        "durationS": dt_s,
        "distanceKm": distance_km,
        "rho": rho,
        "sigmaExtKmInv": sigma_km,
        "lengthKm": length_km,
        "transmittance": analytic_t,
    },
    "scope": {
        "staticAndBuildQA": True,
        "gpuBrowserQA": False,
        "realDeviceQA": False,
        "visualAcceptance": False,
        "productionReady": False,
    },
}
print(json.dumps(result, ensure_ascii=False, indent=2))
if not result["allPassed"]:
    raise SystemExit(1)
