from __future__ import annotations
import base64
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE_COMMIT = "8aeb8dac519f8bda851cfc998e07266870d3eaef"
BASE_PATH = "weather-mother/full-weather-r22-20260909/index.html"
R23_SAFE = ROOT / "weather-mother/r23-mobile-recovery-src/mobile-safe-aircraft.html"
R25_OVERLAY = ROOT / "weather-mother/r25-mobile-cloud-occlusion-src/aircraft-cloud-occlusion.js"
OBS_GLSL = ROOT / "weather-mother/r26-observation-bandwidth-src/observation-bandwidth.glsl"
OUT = ROOT / "weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html"


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"R26 patch {label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


base = subprocess.check_output(["git", "show", f"{BASE_COMMIT}:{BASE_PATH}"], cwd=ROOT).decode("utf-8")
safe = R23_SAFE.read_text(encoding="utf-8")
overlay = R25_OVERLAY.read_text(encoding="utf-8")
obs_glsl = OBS_GLSL.read_text(encoding="utf-8").strip()

safe = once(safe, "<title>Weather Mother · R23 Mobile Silver Flight</title>", "<title>Weather Mother · R26 Observation Bandwidth Flight</title>", "title")
safe = once(safe, "WEATHER MOTHER / R23 MOBILE", "WEATHER MOTHER / R26 MOBILE", "brand")
safe = once(safe, '<div class="badge">CLOUD-FIRST</div>', '<div class="badge">CLOUD-FIRST · OBS-BAND</div>', "badge")
safe = once(
    safe,
    "let gl,program,buf,loc={},last=performance.now(),raf=0,lost=false,scene='silver',pointer=null;",
    "let gl,program,buf,loc={},last=performance.now(),raf=0,lost=false,scene='silver',pointer=null,obsOverride=-1;",
    "state variable",
)
safe = once(
    safe,
    "const qa={version:'WM-R23-MOBILE-CLOUD-FIRST-20260910',ready:false,frames:0,errors:[],renderSize:[0,0],variance:0,scene:'silver',context:'webgl1'};",
    "const qa={version:'WM-R26-MOBILE-OBSERVATION-BANDWIDTH-20260911',ready:false,frames:0,errors:[],renderSize:[0,0],variance:0,scene:'silver',context:'webgl1',observationBandwidth:true,detailPolicy:'prefix-preserving',nearFullKm:14,farCoarseKm:26,observationOverride:-1};",
    "qa identity",
)
safe = once(
    safe,
    "varying vec2 v;uniform vec2 uRes;uniform float uTime,uScene;uniform vec3 uCam,uFwd,uRight,uUp;",
    "varying vec2 v;uniform vec2 uRes;uniform float uTime,uScene,uObsOverride;uniform vec3 uCam,uFwd,uRight,uUp;",
    "shader uniform",
)
old_bands = "float bands(vec3 p){float a=.5,s=0.,n=0.;for(int i=0;i<5;i++){s+=a*yo(p);n+=a;p=mat3(.86,.18,.47,-.28,.95,.12,-.42,-.23,.88)*p*2.0+vec3(.37,.19,.53);a*=.5;}return s/n;}"
safe = once(safe, old_bands, "", "legacy bands")
old_den = "float den(vec3 p){float d=cloudSdf(p);if(d>.42||p.y<1.35||p.y>7.5)return 0.;float low=bands(p*.72+vec3(0.,0.,uTime*.004)),mid=bands(p*1.85+vec3(11.3,7.1,3.7)),hi=yo(p*7.3+vec3(2.1,5.7,13.));float erode=(low-.52)*.24+(mid-.5)*.10+(hi-.5)*.025;float shape=1.-smoothstep(-.28,.18,d+erode);float base=smoothstep(1.45,1.85,p.y),top=1.-smoothstep(6.25,7.15,p.y);return sat(shape*base*top*(uScene<.5?1.08:.78));}"
safe = once(safe, old_den, obs_glsl, "observation density")
safe = once(safe, "float d=den(x);", "float d=den(x,t);", "view density call")
safe = once(safe, "float s1=den(x+sun*.42),s2=den(x+sun*.95),", "float s1=den(x+sun*.42,t),s2=den(x+sun*.95,t),", "sun density calls")
safe = once(
    safe,
    "['uRes','uTime','uScene','uCam','uFwd','uRight','uUp'].forEach(n=>loc[n]=gl.getUniformLocation(program,n));",
    "['uRes','uTime','uScene','uObsOverride','uCam','uFwd','uRight','uUp'].forEach(n=>loc[n]=gl.getUniformLocation(program,n));",
    "uniform lookup",
)
safe = once(
    safe,
    "gl.uniform1f(loc.uScene,scene==='silver'?0:1);gl.uniform3fv(loc.uCam,S.position);",
    "gl.uniform1f(loc.uScene,scene==='silver'?0:1);gl.uniform1f(loc.uObsOverride,obsOverride);gl.uniform3fv(loc.uCam,S.position);",
    "uniform upload",
)
old_exports = "window.AircraftWorld={qa,getState,setScene,reset,setPose,setLook,setFlying,gl:()=>gl,capture:()=>canvas.toDataURL()};window.WeatherMobileR23={qa,getState,setScene};"
new_exports = "function observationWeight(dist){const x=clamp((Number(dist)-14)/12,0,1),s=x*x*(3-2*x);return 1-s;}function setObservationOverride(v){obsOverride=v==null?-1:clamp(Number(v)||0,0,1);qa.observationOverride=obsOverride;}window.AircraftWorld={qa,getState,setScene,reset,setPose,setLook,setFlying,gl:()=>gl,capture:()=>canvas.toDataURL()};window.WeatherMobileR23={qa,getState,setScene};window.WeatherMobileR26={qa,getState,setScene,setObservationOverride,observationWeight,cloud:window.WeatherMobileR23};"
safe = once(safe, old_exports, new_exports, "runtime exports")

# Preserve the R25 depth-free optical aircraft attenuation. It continues to
# read WeatherMobileR23 as a compatibility surface, now backed by R26 cloud QA.
idx = safe.lower().rfind("</body>")
if idx < 0:
    raise SystemExit("R26 mobile source has no closing body")
ui = """<script id=\"weather-mother-r26-ui\">requestAnimationFrame(()=>{const b=document.querySelector('.badge'),r=document.querySelector('.brand');if(b)b.textContent='CLOUD-FIRST · OBS-BAND · OPTICAL';if(r)r.textContent='WEATHER MOTHER / R26 MOBILE';if(window.WeatherMobileR26)window.WeatherMobileR26.optical=window.WeatherMobileR25||null;});</script>"""
safe_r26 = safe[:idx] + "\n<script>\n" + overlay + "\n</script>\n" + ui + "\n" + safe[idx:]
safe64 = base64.b64encode(safe_r26.encode("utf-8")).decode("ascii")

patch = f'''\n<script id="weather-mother-r26-observation-bandwidth">\n(()=>{{'use strict';\nconst isAppleMobile=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);\nconst compactTouch=innerWidth<=700&&navigator.maxTouchPoints>0;\nif(!(isAppleMobile||compactTouch))return;\ndocument.documentElement.dataset.weatherObservationBandwidth='r26';\nconst safe=decodeURIComponent(escape(atob('{safe64}')));\nlet timer=0;\nfunction patchAircraft(){{\n  for(const f of document.querySelectorAll('iframe[data-key="aircraft"]')){{\n    if(f.dataset.mobileAircraftDirect==='r26')continue;\n    f.dataset.mobileAircraftDirect='r26';\n    f.dataset.mobileCloudFirst='r23-proven-r26-bandwidth';\n    f.dataset.mobileCloudOcclusion='r25-cpu-beer-lambert-no-fbo';\n    f.dataset.mobileObservationBandwidth='prefix-preserving-14-26km';\n    f.srcdoc=safe;\n  }}\n  clearTimeout(timer);timer=setTimeout(patchAircraft,160);\n}}\nnew MutationObserver(patchAircraft).observe(document.documentElement,{{childList:true,subtree:true}});\naddEventListener('resize',patchAircraft);patchAircraft();\n}})();\n</script>\n'''
idx = base.lower().rfind("</html>")
out = base + patch if idx < 0 else base[:idx] + patch + base[idx:]
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out, encoding="utf-8")
print(OUT)
print(f"base_bytes={len(base.encode('utf-8'))} mobile_r26_bytes={len(safe_r26.encode('utf-8'))} out_bytes={len(out.encode('utf-8'))}")
