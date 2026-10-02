from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "weather-mother/r29-protean-clouds-teacher-src/build-r29-protean-clouds-teacher.py"
OUT = ROOT / "weather-mother/full-weather-r29-protean-clouds-teacher-20261002/index.html"

subprocess.check_call([sys.executable, str(BUILD)], cwd=ROOT)
page = OUT.read_text(encoding="utf-8")
m = re.search(r"const proteanSource=decodeURIComponent\(escape\(atob\('([^']+)'\)\)\);", page)
if not m:
    raise SystemExit("R29 static QA: embedded Protean payload missing")
protean = base64.b64decode(m.group(1)).decode("utf-8")

exact_tokens = [
    "mat2 rot(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}",
    "const mat3 m3 = mat3(0.33338, 0.56034, -0.71817, -0.87887, 0.32651, -0.15323, 0.15162, 0.69596, 0.61339)*1.93;",
    "vec2 disp(float t){ return vec2(sin(t*0.22)*1., cos(t*0.175)*1.)*2.; }",
    "p2.xy -= disp(p.z).xy;",
    "p.xy *= rot(sin(p.z+iTime)*(0.1 + prm1*0.05) + iTime*0.09);",
    "for(int i = 0; i < 5; i++)",
    "p += sin(p.zxy*0.75*trk + iTime*trk*.8)*dspAmp;",
    "d -= abs(dot(cos(p), sin(p.yzx))*z);",
    "p = p*m3;",
    "for(int i=0; i<130; i++)",
    "if(rez.a > 0.99)break;",
    "float dif =  clamp((den - map(pos+.8).x)/9., 0.001, 1. );",
    "dif += clamp((den - map(pos+.35).x)/2.5, 0.001, 1. );",
    "col.rgba += vec4(0.06,0.11,0.11, 0.1)*clamp(fogC-fogT, 0., 1.);",
    "t += clamp(0.5 - dn*dn*.05, 0.09, 0.3);",
    "vec3 ic = mix(a, b, x) + vec3(1e-6,0.,0.);",
    "bsMo = (iMouse.xy - 0.5*iResolution.xy)/iResolution.y;",
    "float time = iTime*3.;",
    "vec3 target = normalize(ro - vec3(disp(time + tgtDst)*dspAmp, time + tgtDst));",
    "rd.xy *= rot(-disp(time + 3.5).x*0.2 + bsMo.x);",
    "prm1 = smoothstep(-0.4, 0.4,sin(iTime*0.3));",
    "col = iLerp(col.bgr, col.rgb, clamp(1.-prm1,0.05,1.));",
    "col = pow(col, vec3(.55,0.65,0.6))*vec3(1.,.97,.9);",
    "col *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.12)*0.7+0.3;",
]
checks = {
    "r27_shared_cumulus_preserved": "weatherCumulusCloudDNA='r27-shared-seed-density'" in page,
    "r27_detail_policy_preserved": "weatherCumulusDetailPolicy='high-bands-only'" in page,
    "tiny_teacher_preserved": "weatherTinyCloudsTeacher='r28-exact-formula'" in page and "WeatherR28TinyCloudsWorkbench" in page,
    "tiny_teacher_tab_preserved": page.count('id="tinyTeacherTab"') == 1 and "17年老师云" in page,
    "protean_teacher_marker": "weatherProteanCloudsTeacher='r29-exact-formula'" in page,
    "protean_teacher_tab": page.count('id="proteanTeacherTab"') == 1 and "云中飞行老师" in page,
    "one_weather_workbench": "oneWeatherMotherWorkbench:true" in page,
    "protean_frame_reused": "proteanFrameReused:true" in page and "if(frame)return loadPromise" in page,
    "formula_exact_tokens": all(token in protean for token in exact_tokens),
    "map_layers_five": protean.count("for(int i = 0; i < 5; i++)") >= 2,
    "ray_steps_130": protean.count("for(int i=0; i<130; i++)") >= 2,
    "dynamic_step_preserved": protean.count("t += clamp(0.5 - dn*dn*.05, 0.09, 0.3);") >= 2,
    "differential_fog_preserved": "clamp(fogC-fogT, 0., 1.)" in protean and "fogT = fogC;" in protean,
    "volume_gradient_lighting_preserved": "map(pos+.8).x" in protean and "map(pos+.35).x" in protean,
    "flight_camera_preserved": "target = normalize" in protean and "rightdir" in protean and "updir" in protean,
    "mouse_steering_preserved": "uniform vec4 iMouse;" in protean and "setMousePixels" in protean,
    "webgl2_wrapper_only": "#version 300 es" in protean and "getContext('webgl2'" in protean,
    "no_external_runtime_assets": "http://" not in protean and "https://" not in protean.replace("https://www.shadertoy.com/view/3l23Rh", ""),
    "license_isolated_noncommercial": "CC BY-NC-SA 3.0" in protean and "commercialProductionAllowed:false" in protean,
    "acceptance_not_overclaimed": "pixelIdentityToUploadedVideo:false" in protean and "visualAcceptance:false" in protean and "realDeviceQA:false" in protean and "productionReady:false" in protean,
}
result = {
    "version": "WM-R29-PROTEAN-CLOUDS-TEACHER-STATIC-QA-20261002",
    "allPassed": all(checks.values()),
    "checks": checks,
    "artifact": {
        "path": str(OUT.relative_to(ROOT)),
        "bytes": len(page.encode("utf-8")),
        "sha256": hashlib.sha256(page.encode("utf-8")).hexdigest(),
        "proteanTeacherBytes": len(protean.encode("utf-8")),
    },
    "scope": {
        "proteanFormulaReplica": True,
        "tinyTeacherPreserved": True,
        "r27Preserved": True,
        "singleWeatherMotherWorkbench": True,
        "publicBrowserQA": False,
        "pixelIdentityToUploadedVideo": False,
        "realDeviceQA": False,
        "visualAcceptance": False,
        "productionReady": False,
    },
}
print(json.dumps(result, ensure_ascii=False, indent=2))
if not result["allPassed"]:
    raise SystemExit(1)
