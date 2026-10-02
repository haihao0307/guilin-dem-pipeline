from __future__ import annotations

import base64
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
R28_BUILD = ROOT / "weather-mother/r28-tiny-clouds-teacher-src/build-r28-tiny-clouds-teacher.py"
R28_OUT = ROOT / "weather-mother/full-weather-r28-tiny-clouds-teacher-20261001/index.html"
TEMPLATE = ROOT / "weather-mother/r29-protean-clouds-teacher-src/protean-clouds-teacher.template.html"
OUT = ROOT / "weather-mother/full-weather-r29-protean-clouds-teacher-20261002/index.html"


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"R29 Protean patch {label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)


def insert_before_final_html(text: str, payload: str) -> str:
    marker = "</html>"
    idx = text.lower().rfind(marker)
    if idx < 0:
        raise SystemExit("R29 Protean patch: final closing html not found")
    return text[:idx] + payload + text[idx:]


# Build the accepted R28 page first. This preserves the complete R27 Weather
# workbench and the frozen Tiny Clouds teacher before adding Protean Clouds.
subprocess.check_call([sys.executable, str(R28_BUILD)], cwd=ROOT)
r28 = R28_OUT.read_text(encoding="utf-8")
protean = TEMPLATE.read_text(encoding="utf-8")
protean64 = base64.b64encode(protean.encode("utf-8")).decode("ascii")

nav_old = '<button id="tinyTeacherTab" aria-pressed="false">17年老师云</button></nav>'
nav_new = '<button id="tinyTeacherTab" aria-pressed="false">17年老师云</button><button id="proteanTeacherTab" aria-pressed="false">云中飞行老师</button></nav>'
r29 = once(r28, nav_old, nav_new, "Weather Mother teacher navigation")

shell_style = '<style id="weather-mother-r29-protean-shell">body.protean-active #drive{display:none!important}body.protean-active nav{z-index:30}@media(max-width:700px){body.protean-active nav{top:145px;left:50%;right:auto;transform:translateX(-50%);max-width:calc(100vw - 16px)}}</style>'
r29 = once(r29, '<nav aria-label="选择体验">', shell_style + '<nav aria-label="选择体验">', "Protean shell style")

bridge = f'''<script id="weather-mother-r29-protean-clouds-teacher">(()=>{{'use strict';document.documentElement.dataset.weatherProteanCloudsTeacher='r29-exact-formula';const proteanSource=decodeURIComponent(escape(atob('{protean64}')));const button=document.getElementById('proteanTeacherTab'),tinyButton=document.getElementById('tinyTeacherTab');let frame=null,loadPromise=null,active=false;const shellQA={{version:'WM-R29-PROTEAN-CLOUDS-WORKBENCH-20261002',r27Preserved:true,tinyTeacherPreserved:true,oneWeatherMotherWorkbench:true,proteanFormulaExact:true,proteanFrameReused:true,errors:[],visualAcceptance:false,realDeviceQA:false,productionReady:false}};function pauseFrame(f){{try{{f.contentWindow.cloudModuleHidden=true;f.contentWindow.dispatchEvent(new Event('blur'));f.contentDocument.dispatchEvent(new Event('visibilitychange'))}}catch(e){{shellQA.errors.push(String(e))}}}}function resumeFrame(f){{try{{f.contentWindow.cloudModuleHidden=false;f.contentDocument.dispatchEvent(new Event('visibilitychange'))}}catch(e){{shellQA.errors.push(String(e))}}}}function ensureFrame(){{if(frame)return loadPromise||Promise.resolve(frame);frame=document.createElement('iframe');frame.hidden=true;frame.dataset.key='protean-teacher';frame.title='Protean Clouds 云中飞行老师原式复刻';loadPromise=new Promise(resolve=>frame.onload=()=>resolve(frame));frame.srcdoc=proteanSource;document.body.append(frame);return loadPromise}}async function showProtean(){{active=true;window.WeatherR28TinyCloudsWorkbench?.hideTeacher();document.body.classList.remove('weather-active','teacher-active');document.body.classList.add('protean-active');for(const f of document.querySelectorAll('iframe[data-key]'))if(f!==frame){{f.hidden=true;pauseFrame(f)}}document.querySelectorAll('button[data-scene]').forEach(b=>b.setAttribute('aria-pressed','false'));tinyButton?.setAttribute('aria-pressed','false');button.setAttribute('aria-pressed','true');document.getElementById('drive').hidden=true;const f=await ensureFrame();if(!active)return f;f.hidden=false;resumeFrame(f);try{{f.contentWindow.WeatherProteanCloudsTeacher?.setPlaying(true);f.contentWindow.focus()}}catch(e){{shellQA.errors.push(String(e))}}return f}}function hideProtean(){{active=false;document.body.classList.remove('protean-active');button.setAttribute('aria-pressed','false');if(frame){{frame.hidden=true;pauseFrame(frame);try{{frame.contentWindow.WeatherProteanCloudsTeacher?.setPlaying(false)}}catch(e){{shellQA.errors.push(String(e))}}}}}}document.querySelectorAll('button[data-scene]').forEach(b=>b.addEventListener('click',hideProtean,true));tinyButton?.addEventListener('click',hideProtean,true);button.addEventListener('click',e=>{{e.preventDefault();showProtean().catch(err=>shellQA.errors.push(String(err)))}});window.WeatherR29ProteanWorkbench={{qa:shellQA,showProtean,hideProtean,frame:()=>frame,isProteanActive:()=>active,proteanSourceBytes:proteanSource.length}};const params=new URLSearchParams(location.search);if(params.get('scene')==='protean'||params.get('teacher')==='protean-clouds')setTimeout(()=>showProtean().catch(err=>shellQA.errors.push(String(err))),0)}})();</script>'''
r29 = insert_before_final_html(r29, bridge)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(r29, encoding="utf-8")
print(OUT)
print(
    f"r28_bytes={len(r28.encode('utf-8'))} "
    f"protean_bytes={len(protean.encode('utf-8'))} "
    f"r29_bytes={len(r29.encode('utf-8'))}"
)
