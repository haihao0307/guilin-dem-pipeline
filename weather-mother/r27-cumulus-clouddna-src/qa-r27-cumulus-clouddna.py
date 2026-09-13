from __future__ import annotations

import base64
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "weather-mother/r27-cumulus-clouddna-src/build-r27-cumulus-clouddna.py"
OUT = ROOT / "weather-mother/full-weather-r27-cumulus-clouddna-20260913/index.html"

subprocess.check_call([sys.executable, str(BUILD)], cwd=ROOT)
page = OUT.read_text(encoding="utf-8")
m = re.search(r"const safe=decodeURIComponent\(escape\(atob\('([^']+)'\)\)\);", page)
if not m:
    raise SystemExit("R27 cumulus DNA QA: embedded mobile payload missing")
safe = base64.b64decode(m.group(1)).decode("utf-8")

checks = {
    "foundation_marker_preserved": "weatherFoundation='r27-units-clock-optics'" in page,
    "cumulus_marker_present": "weatherCumulusCloudDNA='r27-shared-seed-density'" in page,
    "same_iframe_coordinator_present": "observeFlightRenderer='same-aircraft-iframe'" in page,
    "reference_seeds_present": "objectSeed:73017,detailSeed:991" in safe,
    "reference_is_zero_delta": "DNAReference={object:[dnaUnit(73017,1)" in safe and "detail:[dnaUnit(991,5)" in safe,
    "shared_js_parameter_function": "window.WeatherCumulusDNAParams=dnaParams" in safe,
    "gpu_dna_uniforms": "uniform vec4 uDNAObject;uniform vec3 uDNADetail" in safe,
    "gpu_dna_upload": "gl.uniform4fv(loc.uDNAObject,dna.object)" in safe and "gl.uniform3fv(loc.uDNADetail,dna.detail)" in safe,
    "cpu_uses_shared_params": safe.count("window.WeatherCumulusDNAParams?window.WeatherCumulusDNAParams()") >= 2,
    "canonical_density_export": "sampleDensity:(point,sceneName='silver',timeS=0)" in safe,
    "cloud_query_api": "CloudQuery:{sample:sampleCloudDensity}" in safe,
    "seed_control_api": "getCloudDNA,setSeeds,CloudQuery" in safe,
    "same_cloud_claim_scoped": "sameCloudForObserveAndFlight:true" in safe and "canonicalDensityQuery:true" in safe,
    "observer_mode_gate": "S.flying&&viewMode==='flight'" in safe and "setViewMode" in safe and "getViewMode" in safe,
    "speed_fix_preserved": "kmps=S.speed/1000" in safe and "kmps=S.speed/3600" not in safe,
    "world_clock_fix_preserved": "if(worldPlaying)S.time+=dt" in safe and "getWorldClockState" in safe,
    "beer_lambert_view_preserved": "float tau=d*ds*2.7,a=1.-exp(-tau)" in safe and "T*=exp(-tau)" in safe,
    "beer_lambert_cpu_preserved": "sigmaExtKm=1.10" in safe and "return Math.exp(-tau)" in safe,
    "observation_bandwidth_preserved": "smoothstep(14.,26.,dist)" in safe and "detailPolicy:'prefix-preserving'" in safe,
    "no_shared_depth_overclaim": "sharedDepth:false" in safe and "depthFBO:false" in safe,
    "acceptance_not_overclaimed": "visualAcceptance:false" in safe and "realDeviceQA:false" in safe and "productionReady:false" in safe,
}

result = {
    "version": "WM-R27-CUMULUS-CLOUD-DNA-STATIC-QA-20260913",
    "checks": checks,
    "allPassed": all(checks.values()),
    "scope": {
        "buildAndStaticQA": True,
        "publicBrowserQA": False,
        "sameDensityAcrossObserveFlightRuntimeProbe": False,
        "realDeviceQA": False,
        "visualAcceptance": False,
        "productionReady": False,
    },
}
print(json.dumps(result, ensure_ascii=False, indent=2))
if not result["allPassed"]:
    raise SystemExit(1)
