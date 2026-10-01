from __future__ import annotations

import base64
import hashlib
import os
import pathlib
import subprocess
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
R27_BUILD = ROOT / "weather-mother/r27-cumulus-clouddna-src/build-r27-cumulus-clouddna-v2.py"
R27_OUT = ROOT / "weather-mother/full-weather-r27-cumulus-clouddna-20260913/index.html"
TEMPLATE = ROOT / "weather-mother/r28-tiny-clouds-teacher-src/tiny-clouds-teacher.template.html"
OUT = ROOT / "weather-mother/full-weather-r28-tiny-clouds-teacher-20261001/index.html"

NOISE_URL = "https://raw.githubusercontent.com/tengbao/vanta/gallery/gallery/noise.png"
NOISE_BYTES = 264_082
NOISE_GIT_BLOB = "32a561c7f6847e7c0a668e9a684af5dc969c72fc"


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"R28 Tiny Clouds patch {label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)


def insert_before_final_html(text: str, payload: str) -> str:
    marker = "</html>"
    idx = text.lower().rfind(marker)
    if idx < 0:
        raise SystemExit("R28 Tiny Clouds patch: final closing html not found")
    return text[:idx] + payload + text[idx:]


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def acquire_noise() -> bytes:
    local = os.environ.get("WEATHER_R28_NOISE_FILE")
    if local:
        data = pathlib.Path(local).read_bytes()
    else:
        request = urllib.request.Request(
            NOISE_URL,
            headers={"User-Agent": "Weather-Mother-R28-Tiny-Clouds-Builder/1.0"},
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read()
    actual_sha = git_blob_sha(data)
    if len(data) != NOISE_BYTES or actual_sha != NOISE_GIT_BLOB:
        raise SystemExit(
            "R28 fixed noise mismatch: "
            f"bytes={len(data)} git_blob={actual_sha}; "
            f"expected bytes={NOISE_BYTES} git_blob={NOISE_GIT_BLOB}"
        )
    return data


# R28 is an additive teacher voice inside the accepted R27 Weather Mother page.
subprocess.check_call([sys.executable, str(R27_BUILD)], cwd=ROOT)
r27 = R27_OUT.read_text(encoding="utf-8")
noise = acquire_noise()
teacher = TEMPLATE.read_text(encoding="utf-8")
teacher = teacher.replace(
    "__NOISE_DATA_URI__",
    "data:image/png;base64," + base64.b64encode(noise).decode("ascii"),
)
teacher = teacher.replace("__NOISE_BYTES__", str(NOISE_BYTES))
teacher = teacher.replace("__NOISE_GIT_BLOB__", NOISE_GIT_BLOB)
if "__NOISE_" in teacher:
    raise SystemExit("R28 unresolved teacher placeholder")
teacher64 = base64.b64encode(teacher.encode("utf-8")).decode("ascii")

nav_old = '<button data-scene="weather">原天气系统</button></nav><button id="drive" hidden>驾驶飞机</button>'
nav_new = '<button data-scene="weather">原天气系统</button><button id="tinyTeacherTab" aria-pressed="false">17年老师云</button></nav><button id="drive" hidden>驾驶飞机</button>'
r28 = once(r27, nav_old, nav_new, "single Weather Mother navigation")
shell_style = '<style id="weather-mother-r28-tiny-clouds-shell">nav{max-width:calc(100vw - 18px);overflow-x:auto;scrollbar-width:none}nav::-webkit-scrollbar{display:none}body.teacher-active #drive{display:none!important}@media(max-width:700px){body.teacher-active nav{top:145px;left:50%;right:auto;transform:translateX(-50%);max-width:calc(100vw - 16px)}}</style>'
r28 = once(r28, '<nav aria-label="选择体验">', shell_style + '<nav aria-label="选择体验">', "teacher shell style")
bridge = f'''<script id="weather-mother-r28-tiny-clouds-teacher">(()=>{{'use strict';document.documentElement.dataset.weatherTinyCloudsTeacher='r28-exact-formula';const teacherSource=decodeURIComponent(escape(atob('{teacher64}')));const button=document.getElementById('tinyTeacherTab');let frame=null,loadPromise=null,active=false;const shellQA={{version:'WM-R28-TINY-CLOUDS-WORKBENCH-20261001',r27Preserved:true,oneWeatherMotherWorkbench:true,teacherFormulaExact:true,teacherFrameReused:true,errors:[],visualAcceptance:false,realDeviceQA:false,productionReady:false}};function pauseFrame(f){{try{{f.contentWindow.cloudModuleHidden=true;f.contentWindow.dispatchEvent(new Event('blur'));f.contentDocument.dispatchEvent(new Event('visibilitychange'))}}catch(e){{shellQA.errors.push(String(e))}}}}function resumeFrame(f){{try{{f.contentWindow.cloudModuleHidden=false;f.contentDocument.dispatchEvent(new Event('visibilitychange'))}}catch(e){{shellQA.errors.push(String(e))}}}}function ensureFrame(){{if(frame)return loadPromise||Promise.resolve(frame);frame=document.createElement('iframe');frame.hidden=true;frame.dataset.key='tiny-teacher';frame.title='2017 Tiny Clouds 老师原式复刻';loadPromise=new Promise(resolve=>frame.onload=()=>resolve(frame));frame.srcdoc=teacherSource;document.body.append(frame);return loadPromise}}async function showTeacher(){{active=true;document.body.classList.remove('weather-active');document.body.classList.add('teacher-active');for(const f of document.querySelectorAll('iframe[data-key]'))if(f!==frame){{f.hidden=true;pauseFrame(f)}}document.querySelectorAll('button[data-scene]').forEach(b=>b.setAttribute('aria-pressed','false'));button.setAttribute('aria-pressed','true');document.getElementById('drive').hidden=true;const f=await ensureFrame();if(!active)return f;f.hidden=false;resumeFrame(f);try{{f.contentWindow.WeatherTinyCloudsTeacher?.setPlaying(true);f.contentWindow.focus()}}catch(e){{shellQA.errors.push(String(e))}}return f}}function hideTeacher(){{active=false;document.body.classList.remove('teacher-active');button.setAttribute('aria-pressed','false');if(frame){{frame.hidden=true;pauseFrame(frame);try{{frame.contentWindow.WeatherTinyCloudsTeacher?.setPlaying(false)}}catch(e){{shellQA.errors.push(String(e))}}}}}}document.querySelectorAll('button[data-scene]').forEach(b=>b.addEventListener('click',hideTeacher,true));button.addEventListener('click',e=>{{e.preventDefault();showTeacher().catch(err=>shellQA.errors.push(String(err)))}});window.WeatherR28TinyCloudsWorkbench={{qa:shellQA,showTeacher,hideTeacher,frame:()=>frame,isTeacherActive:()=>active,teacherSourceBytes:teacherSource.length}};const params=new URLSearchParams(location.search);if(params.get('scene')==='tiny'||params.get('teacher')==='tiny-clouds')setTimeout(()=>showTeacher().catch(err=>shellQA.errors.push(String(err))),0)}})();</script>'''
r28 = insert_before_final_html(r28, bridge)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(r28, encoding="utf-8")
print(OUT)
print(
    f"r27_bytes={len(r27.encode('utf-8'))} "
    f"teacher_bytes={len(teacher.encode('utf-8'))} "
    f"r28_bytes={len(r28.encode('utf-8'))} "
    f"noise_bytes={len(noise)} noise_git_blob={git_blob_sha(noise)}"
)
