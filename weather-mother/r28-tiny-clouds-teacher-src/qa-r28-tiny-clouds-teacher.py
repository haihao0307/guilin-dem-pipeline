from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "weather-mother/r28-tiny-clouds-teacher-src/build-r28-tiny-clouds-teacher.py"
OUT = ROOT / "weather-mother/full-weather-r28-tiny-clouds-teacher-20261001/index.html"
EXPECTED_NOISE_BYTES = 264_082
EXPECTED_NOISE_GIT_BLOB = "32a561c7f6847e7c0a668e9a684af5dc969c72fc"


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


subprocess.check_call([sys.executable, str(BUILD)], cwd=ROOT)
page = OUT.read_text(encoding="utf-8")
m = re.search(r"const teacherSource=decodeURIComponent\(escape\(atob\('([^']+)'\)\)\);", page)
if not m:
    raise SystemExit("R28 static QA: embedded teacher payload missing")
teacher = base64.b64decode(m.group(1)).decode("utf-8")
noise_match = re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", teacher)
if not noise_match:
    raise SystemExit("R28 static QA: embedded noise data URI missing")
noise = base64.b64decode(noise_match.group(1))

exact_lines = [
    "#define T texture(iChannel0,(s*p.zw+ceil(s*p.x))/2e2).y/(s+=s)*4.",
    "vec4 p,d=vec4(.8,0,x/iResolution.y-.8),c=vec4(.6,.7,d);",
    "O=c-d.w;",
    "for(float f,s,t=2e2+sin(dot(x,x));--t>0.;p=.05*t*d)",
    "p.xz+=iTime,",
    "s=2.,",
    "f=p.w+1.-T-T-T-T,",
    "f<0.?O+=(O-1.-f*c.zyxw)*f*.4:O;",
]
checks = {
    "r27_shared_cumulus_marker_preserved": "weatherCumulusCloudDNA='r27-shared-seed-density'" in page,
    "r27_detail_policy_preserved": "weatherCumulusDetailPolicy='high-bands-only'" in page,
    "r28_teacher_marker": "weatherTinyCloudsTeacher='r28-exact-formula'" in page,
    "one_weather_mother_nav": page.count('id="tinyTeacherTab"') == 1 and "17年老师云" in page,
    "teacher_bridge_present": "window.WeatherR28TinyCloudsWorkbench" in page,
    "teacher_frame_reused": "teacherFrameReused:true" in page and "if(frame)return loadPromise" in page,
    "teacher_formula_exact_tokens": all(token in teacher for token in exact_lines),
    "four_texture_taps": "f=p.w+1.-T-T-T-T," in teacher and teacher.count("-T-T-T-T") >= 2,
    "reverse_march_frozen": "--t>0.;p=.05*t*d" in teacher,
    "webgl2_exact_loop": "#version 300 es" in teacher and "getContext('webgl2'" in teacher,
    "fixed_texture_filter_contract": "gl.LINEAR_MIPMAP_LINEAR" in teacher and "gl.REPEAT" in teacher,
    "noise_embedded_single_file": len(noise) == EXPECTED_NOISE_BYTES and git_blob_sha(noise) == EXPECTED_NOISE_GIT_BLOB,
    "r27_not_replaced": "r27Preserved:true" in page and "oneWeatherMotherWorkbench:true" in page,
    "runtime_has_no_external_noise_request": "img.src=NOISE_DATA_URI" in teacher and "https://raw.githubusercontent.com" not in teacher,
    "acceptance_not_overclaimed": "visualAcceptance:false" in teacher and "realDeviceQA:false" in teacher and "productionReady:false" in teacher,
}
result = {
    "version": "WM-R28-TINY-CLOUDS-TEACHER-STATIC-QA-20261001",
    "allPassed": all(checks.values()),
    "checks": checks,
    "artifact": {
        "path": str(OUT.relative_to(ROOT)),
        "bytes": len(page.encode("utf-8")),
        "sha256": hashlib.sha256(page.encode("utf-8")).hexdigest(),
        "teacherBytes": len(teacher.encode("utf-8")),
        "noiseBytes": len(noise),
        "noiseGitBlob": git_blob_sha(noise),
    },
    "scope": {
        "teacherFormulaReplica": True,
        "singleWeatherMotherWorkbench": True,
        "r27RegressionPreservedByStructure": True,
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
