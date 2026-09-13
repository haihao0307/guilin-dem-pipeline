from __future__ import annotations

import base64
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
R26_BUILD = ROOT / "weather-mother/r26-observation-bandwidth-src/build-r26.py"
R26_OUT = ROOT / "weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html"
OUT = ROOT / "weather-mother/full-weather-r27-foundation-20260913/index.html"


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"R27 foundation patch {label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


# Rebuild the accepted R26 chain first. This preserves R22 shell + R23 cloud-first
# + R25 aircraft optical attenuation + R26 observation bandwidth.
subprocess.check_call([sys.executable, str(R26_BUILD)], cwd=ROOT)
r26 = R26_OUT.read_text(encoding="utf-8")

m = re.search(r"const safe=decodeURIComponent\(escape\(atob\('([^']+)'\)\)\);", r26)
if not m:
    raise SystemExit("R27 foundation: could not locate embedded R26 mobile-safe payload")
old64 = m.group(1)
safe = base64.b64decode(old64).decode("utf-8")

# Identity only; historical compatibility exports remain available.
safe = once(safe, "<title>Weather Mother · R26 Observation Bandwidth Flight</title>", "<title>Weather Mother · R27 Foundation Flight</title>", "title")
safe = once(safe, "WEATHER MOTHER / R26 MOBILE", "WEATHER MOTHER / R27 FOUNDATION", "brand")
safe = once(safe, "CLOUD-FIRST · OBS-BAND · OPTICAL", "CLOUD-FIRST · OBS-BAND · OPTICAL · FOUNDATION", "badge")

# Explicit independent world clock. Flight pause remains flight-only; P / clock button
# freezes cloud time while the observer can continue to move.
safe = once(
    safe,
    "let gl,program,buf,loc={},last=performance.now(),raf=0,lost=false,scene='silver',pointer=null,obsOverride=-1;",
    "let gl,program,buf,loc={},last=performance.now(),raf=0,lost=false,scene='silver',pointer=null,obsOverride=-1,worldPlaying=true;",
    "world clock state",
)
safe = once(
    safe,
    "const qa={version:'WM-R26-MOBILE-OBSERVATION-BANDWIDTH-20260911',ready:false,frames:0,errors:[],renderSize:[0,0],variance:0,scene:'silver',context:'webgl1',observationBandwidth:true,detailPolicy:'prefix-preserving',nearFullKm:14,farCoarseKm:26,observationOverride:-1};",
    "const qa={version:'WM-R27-FOUNDATION-UNITS-CLOCK-OPTICS-20260913',ready:false,frames:0,errors:[],renderSize:[0,0],variance:0,scene:'silver',context:'webgl1',observationBandwidth:true,detailPolicy:'prefix-preserving',nearFullKm:14,farCoarseKm:26,observationOverride:-1,units:{position:'km',speed:'m/s',time:'s',extinction:'km^-1'},speedIntegration:'mps-to-kmps-1e-3',worldClockIndependent:true,opticalStepIntegration:true,visualAcceptance:false,realDeviceQA:false,productionReady:false};",
    "qa identity",
)
safe = once(
    safe,
    '<div class="hint">W/S 加减速 · A/D 转弯 · Q/E 下降/爬升 · 拖动环顾 360° · 空格暂停</div>',
    '<div class="hint">W/S 加减速 · A/D 转弯 · Q/E 下降/爬升 · 拖动环顾 360° · 空格暂停飞行 · P 暂停世界</div>',
    "control hint",
)
safe = once(
    safe,
    '<button id="fly" aria-pressed="true">飞行中</button><button id="look">追尾视角</button>',
    '<button id="fly" aria-pressed="true">飞行中</button><button id="clock" aria-pressed="true">世界运行</button><button id="look">追尾视角</button>',
    "clock button",
)

# Fix the R23 unit inconsistency: state speed is m/s (HUD already multiplies by 3.6),
# while world position is km. Therefore integration must use /1000, not /3600.
safe = once(safe, "const b=basis(),kmps=S.speed/3600;", "const b=basis(),kmps=S.speed/1000;", "speed units")
safe = once(safe, "}S.time+=dt;updateHud();}", "}if(worldPlaying)S.time+=dt;updateHud();}", "world time independence")
safe = once(
    safe,
    "$('#fly').setAttribute('aria-pressed',String(S.flying));}",
    "$('#fly').setAttribute('aria-pressed',String(S.flying));$('#clock').textContent=worldPlaying?'世界运行':'世界暂停';$('#clock').setAttribute('aria-pressed',String(worldPlaying));}",
    "clock hud",
)
safe = once(
    safe,
    "function reset(){Object.assign(S,{position:[0,4.4,4.8],yaw:0,pitch:-.02,lookYaw:0,lookPitch:0,roll:0,speed:75,flying:true,time:0});keys.clear();updateHud();}",
    "function reset(){Object.assign(S,{position:[0,4.4,4.8],yaw:0,pitch:-.02,lookYaw:0,lookPitch:0,roll:0,speed:75,flying:true,time:0});worldPlaying=true;keys.clear();updateHud();}",
    "reset world clock",
)
safe = once(
    safe,
    "function setScene(x){scene=x==='sea'?'sea':'silver';qa.scene=scene;updateHud();}function setFlying(x){S.flying=!!x;keys.clear();updateHud();}function getState(){return{...JSON.parse(JSON.stringify(S)),scene,cameraPositionMeters:S.position.map(x=>x*1000),mobileSafe:true};}",
    "function setScene(x){scene=x==='sea'?'sea':'silver';qa.scene=scene;updateHud();}function setFlying(x){S.flying=!!x;keys.clear();updateHud();}function setWorldPlaying(x){worldPlaying=!!x;updateHud();}function getWorldClockState(){return{playing:worldPlaying,timeS:S.time};}function getState(){return{...JSON.parse(JSON.stringify(S)),scene,cameraPositionMeters:S.position.map(x=>x*1000),mobileSafe:true,worldPlaying,units:qa.units};}",
    "world clock API",
)
safe = once(
    safe,
    "if(e.code==='Space'){S.flying=!S.flying;e.preventDefault();}if(e.key==='Home'){reset();e.preventDefault();}",
    "if(e.code==='Space'){S.flying=!S.flying;e.preventDefault();}if(k==='p'){setWorldPlaying(!worldPlaying);e.preventDefault();}if(e.key==='Home'){reset();e.preventDefault();}",
    "world clock keyboard",
)
safe = once(
    safe,
    "$('#fly').onclick=()=>setFlying(!S.flying);$('#look').onclick=()=>{S.lookYaw=0;S.lookPitch=0};",
    "$('#fly').onclick=()=>setFlying(!S.flying);$('#clock').onclick=()=>setWorldPlaying(!worldPlaying);$('#look').onclick=()=>{S.lookYaw=0;S.lookPitch=0};",
    "world clock button event",
)

# Correct view-path attenuation to integrate using the actual march step ds.
# This preserves the same 2.7 km^-1 extinction coefficient and makes the
# existing sun approximation explicit as an optical-depth variable.
safe = once(safe, "float d=den(x,t);if(d>.006){", "float d=den(x,t),ds=d>.02?.34:.48;if(d>.006){", "view ds")
safe = once(
    safe,
    "float s1=den(x+sun*.42,t),s2=den(x+sun*.95,t),light=exp(-(s1*.42+s2*.65)*1.45),",
    "float s1=den(x+sun*.42,t),s2=den(x+sun*.95,t),sunTau=(s1*.42+s2*.65)*1.45,light=exp(-sunTau),",
    "sun optical depth",
)
safe = once(safe, "float a=1.-exp(-d*.34*2.7);", "float tau=d*ds*2.7,a=1.-exp(-tau);", "view optical depth")
safe = once(safe, "T*=1.-a;od+=d*.34;}t+=d>.02?.34:.48;", "T*=exp(-tau);od+=d*ds;}t+=ds;", "view transmittance")

# R25's CPU aircraft probe was already Beer-Lambert. Make its units explicit
# without changing its numerical result: 1.10 km^-1 over a 2.4 km probe.
safe = once(safe, "const length=2.4,steps=10,ds=length/steps;let od=0;", "const lengthKm=2.4,steps=10,dsKm=lengthKm/steps,sigmaExtKm=1.10;let tau=0;", "r25 probe units")
safe = once(
    safe,
    "for(let i=0;i<steps;i++){const q=ds*(i+.5),x=position[0]+fx*q,y=position[1]+fy*q,z=position[2]+fz*q;od+=densityAt(x,y,z,scene,time)*ds;}",
    "for(let i=0;i<steps;i++){const q=dsKm*(i+.5),x=position[0]+fx*q,y=position[1]+fy*q,z=position[2]+fz*q;tau+=densityAt(x,y,z,scene,time)*sigmaExtKm*dsKm;}",
    "r25 probe integral",
)
safe = once(safe, "return Math.exp(-1.10*od);", "return Math.exp(-tau);", "r25 probe transmittance")
safe = once(safe, "occlusionModel:'cpu-mirror-beer-lambert',failOpen:true", "occlusionModel:'cpu-mirror-beer-lambert',opticalUnits:'km-km^-1',failOpen:true", "r25 qa units")

# Preserve R23/R26 compatibility surfaces while exposing the R27 foundation API.
safe = once(
    safe,
    "window.AircraftWorld={qa,getState,setScene,reset,setPose,setLook,setFlying,gl:()=>gl,capture:()=>canvas.toDataURL()};window.WeatherMobileR23={qa,getState,setScene};window.WeatherMobileR26={qa,getState,setScene,setObservationOverride,observationWeight,cloud:window.WeatherMobileR23};",
    "window.AircraftWorld={qa,getState,setScene,reset,setPose,setLook,setFlying,setWorldPlaying,getWorldClockState,gl:()=>gl,capture:()=>canvas.toDataURL()};window.WeatherMobileR23={qa,getState,setScene};window.WeatherMobileR26={qa,getState,setScene,setObservationOverride,observationWeight,cloud:window.WeatherMobileR23};window.WeatherMobileR27Foundation={qa,getState,setScene,setFlying,setWorldPlaying,getWorldClockState,setObservationOverride,observationWeight,cloud:window.WeatherMobileR26};",
    "r27 foundation exports",
)

new64 = base64.b64encode(safe.encode("utf-8")).decode("ascii")
r27 = once(r26, old64, new64, "embedded mobile payload")
r27 = once(
    r27,
    "document.documentElement.dataset.weatherObservationBandwidth='r26';",
    "document.documentElement.dataset.weatherObservationBandwidth='r26';document.documentElement.dataset.weatherFoundation='r27-units-clock-optics';",
    "outer foundation marker",
)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(r27, encoding="utf-8")
print(OUT)
print(f"r26_bytes={len(r26.encode('utf-8'))} r27_bytes={len(r27.encode('utf-8'))} safe_bytes={len(safe.encode('utf-8'))}")
