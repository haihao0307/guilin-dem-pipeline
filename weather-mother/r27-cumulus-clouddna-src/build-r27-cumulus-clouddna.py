from __future__ import annotations

import base64
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
FOUNDATION_BUILD = ROOT / "weather-mother/r27-foundation-src/build-r27-foundation.py"
FOUNDATION_OUT = ROOT / "weather-mother/full-weather-r27-foundation-20260913/index.html"
OUT = ROOT / "weather-mother/full-weather-r27-cumulus-clouddna-20260913/index.html"


def exact(text: str, old: str, new: str, count: int, label: str) -> str:
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f"R27 cumulus DNA patch {label}: expected {count} matches, got {actual}")
    return text.replace(old, new, count)


def once(text: str, old: str, new: str, label: str) -> str:
    return exact(text, old, new, 1, label)


# Continue from the proven R27 units/clock/optics foundation. Do not revive the
# older standalone R27 Cloud-DNA page as a replacement runtime: it predates the
# corrected m/s->km/s integration and the explicit Beer-Lambert path contract.
subprocess.check_call([sys.executable, str(FOUNDATION_BUILD)], cwd=ROOT)
foundation = FOUNDATION_OUT.read_text(encoding="utf-8")

m = re.search(r"const safe=decodeURIComponent\(escape\(atob\('([^']+)'\)\)\);", foundation)
if not m:
    raise SystemExit("R27 cumulus DNA: embedded foundation mobile payload not found")
old64 = m.group(1)
safe = base64.b64decode(old64).decode("utf-8")

safe = once(
    safe,
    "<title>Weather Mother · R27 Foundation Flight</title>",
    "<title>Weather Mother · R27 Cumulus Cloud DNA</title>",
    "title",
)
safe = exact(
    safe,
    "WEATHER MOTHER / R27 FOUNDATION",
    "WEATHER MOTHER / R27 CUMULUS DNA",
    2,
    "brand writes",
)
safe = once(
    safe,
    "CLOUD-FIRST · OBS-BAND · OPTICAL · FOUNDATION",
    "CLOUD-FIRST · OBS-BAND · OPTICAL · CUMULUS DNA",
    "badge",
)
safe = once(
    safe,
    "</head>",
    "<style id=\"weather-r27-cumulus-dna-ui\">body[data-view-mode=observe] .pad{display:none}body[data-view-mode=observe] #fly{display:none}</style></head>",
    "observe UI style",
)

# Seed hashing is performed once in JavaScript and the resulting parameters are
# shared by CPU density queries and GPU uniforms. This avoids pretending that a
# JS double and a WebGL1 float hash are bit-identical. The accepted foundation
# is the zero-delta reference: seed 73017 / detail 991 yields exactly the old
# cloud envelope and noise coordinates.
safe = once(
    safe,
    "const keys=new Set();",
    """const keys=new Set();
const CloudDNAState=window.WeatherCumulusDNAState={objectSeed:73017,detailSeed:991};
function dnaUnit(seed,salt){const v=Math.sin((Number(seed)||1)*.013+salt*1.731)*43758.5453123;return v-Math.floor(v);}
const DNAReference={object:[dnaUnit(73017,1),dnaUnit(73017,2),dnaUnit(73017,3),dnaUnit(73017,4)],detail:[dnaUnit(991,5),dnaUnit(991,6),dnaUnit(991,7)]};
function dnaParams(){const s=CloudDNAState.objectSeed,d=CloudDNAState.detailSeed;return{object:[(dnaUnit(s,1)-DNAReference.object[0])*.70,(dnaUnit(s,2)-DNAReference.object[1])*.40,(dnaUnit(s,3)-DNAReference.object[2])*.90,1+(dnaUnit(s,4)-DNAReference.object[3])*.12],detail:[(dnaUnit(d,5)-DNAReference.detail[0])*7.,(dnaUnit(d,6)-DNAReference.detail[1])*7.,(dnaUnit(d,7)-DNAReference.detail[2])*7.]};}
window.WeatherCumulusDNAParams=dnaParams;
let viewMode='flight';document.body.dataset.viewMode=viewMode;""",
    "shared DNA state",
)

safe = once(
    safe,
    "const qa={version:'WM-R27-FOUNDATION-UNITS-CLOCK-OPTICS-20260913',ready:false,frames:0,errors:[],renderSize:[0,0],variance:0,scene:'silver',context:'webgl1',observationBandwidth:true,detailPolicy:'prefix-preserving',nearFullKm:14,farCoarseKm:26,observationOverride:-1,units:{position:'km',speed:'m/s',time:'s',extinction:'km^-1'},speedIntegration:'mps-to-kmps-1e-3',worldClockIndependent:true,opticalStepIntegration:true,visualAcceptance:false,realDeviceQA:false,productionReady:false};",
    "const qa={version:'WM-R27-CUMULUS-CLOUD-DNA-20260913',ready:false,frames:0,errors:[],renderSize:[0,0],variance:0,scene:'silver',context:'webgl1',observationBandwidth:true,detailPolicy:'prefix-preserving',nearFullKm:14,farCoarseKm:26,observationOverride:-1,units:{position:'km',speed:'m/s',time:'s',extinction:'km^-1'},speedIntegration:'mps-to-kmps-1e-3',worldClockIndependent:true,opticalStepIntegration:true,cumulusCloudDNA:true,sameCloudForObserveAndFlight:true,canonicalDensityQuery:true,cpuGpuDNAParametersShared:true,objectSeed:73017,detailSeed:991,visualAcceptance:false,realDeviceQA:false,productionReady:false};",
    "qa identity",
)

safe = once(
    safe,
    "varying vec2 v;uniform vec2 uRes;uniform float uTime,uScene,uObsOverride;uniform vec3 uCam,uFwd,uRight,uUp;",
    "varying vec2 v;uniform vec2 uRes;uniform float uTime,uScene,uObsOverride;uniform vec4 uDNAObject;uniform vec3 uDNADetail;uniform vec3 uCam,uFwd,uRight,uUp;",
    "DNA shader uniforms",
)

old_cloud_sdf = "float cloudSdf(vec3 p){float d=9.;if(uScene<.5){d=min(d,ell(p,vec3(-4.2,3.65,-7.0),vec3(4.3,1.55,3.7)));d=min(d,ell(p,vec3(.3,4.0,-8.7),vec3(4.1,1.85,4.0)));d=min(d,ell(p,vec3(4.4,3.7,-11.2),vec3(3.5,1.65,3.8)));d=min(d,ell(p,vec3(-1.7,5.0,-12.0),vec3(2.7,2.1,3.0)));d=min(d,ell(p,vec3(2.0,5.4,-13.7),vec3(2.35,2.0,2.7)));d=min(d,ell(p,vec3(-5.8,4.75,-13.5),vec3(2.8,1.8,3.0)));}else{d=min(d,ell(p,vec3(-4.5,3.15,-7.0),vec3(5.1,.78,4.3)));d=min(d,ell(p,vec3(2.2,3.55,-9.8),vec3(5.6,.88,5.0)));d=min(d,ell(p,vec3(-2.5,4.05,-13.8),vec3(6.0,1.0,4.2)));d=min(d,ell(p,vec3(5.2,4.4,-17.0),vec3(5.8,.82,4.0)));}return d;}"
new_cloud_sdf = "float cloudSdf(vec3 p){float d=9.,sc=uDNAObject.w;if(uScene<.5){d=min(d,ell(p,vec3(-4.2,3.65,-7.0)+uDNAObject.xyz,vec3(4.3,1.55,3.7)*sc));d=min(d,ell(p,vec3(.3,4.0,-8.7)+uDNAObject.xyz*vec3(-.35,.25,.45),vec3(4.1,1.85,4.0)*sc));d=min(d,ell(p,vec3(4.4,3.7,-11.2)+uDNAObject.xyz*vec3(.42,-.18,.72),vec3(3.5,1.65,3.8)*sc));d=min(d,ell(p,vec3(-1.7,5.0,-12.0)+uDNAObject.xyz*vec3(-.24,.62,.55),vec3(2.7,2.1,3.0)*sc));d=min(d,ell(p,vec3(2.0,5.4,-13.7)+uDNAObject.xyz*vec3(.28,.74,.86),vec3(2.35,2.0,2.7)*sc));d=min(d,ell(p,vec3(-5.8,4.75,-13.5)+uDNAObject.xyz*vec3(-.62,.48,.80),vec3(2.8,1.8,3.0)*sc));}else{d=min(d,ell(p,vec3(-4.5,3.15,-7.0),vec3(5.1,.78,4.3)));d=min(d,ell(p,vec3(2.2,3.55,-9.8),vec3(5.6,.88,5.0)));d=min(d,ell(p,vec3(-2.5,4.05,-13.8),vec3(6.0,1.0,4.2)));d=min(d,ell(p,vec3(5.2,4.4,-17.0),vec3(5.8,.82,4.0)));}return d;}"
safe = once(safe, old_cloud_sdf, new_cloud_sdf, "GPU cumulus envelope")

# Keep R26 observation-bandwidth algebra intact; only translate the canonical
# frequency coordinates by the shared detail parameters. At the reference seed
# uDNADetail=0 and the accepted R26 field is exactly recovered.
safe = once(
    safe,
    "p*.72+vec3(0.,0.,uTime*.004)",
    "p*.72+vec3(uDNADetail.xy,uTime*.004+uDNADetail.z)",
    "low-band detail seed",
)
safe = once(
    safe,
    "p*1.85+vec3(11.3,7.1,3.7)",
    "p*1.85+vec3(11.3,7.1,3.7)+uDNADetail*1.7",
    "mid-band detail seed",
)
safe = once(
    safe,
    "p*7.3+vec3(2.1,5.7,13.)",
    "p*7.3+vec3(2.1,5.7,13.)+uDNADetail*3.1",
    "high-band detail seed",
)

safe = once(
    safe,
    "['uRes','uTime','uScene','uObsOverride','uCam','uFwd','uRight','uUp'].forEach(n=>loc[n]=gl.getUniformLocation(program,n));",
    "['uRes','uTime','uScene','uObsOverride','uDNAObject','uDNADetail','uCam','uFwd','uRight','uUp'].forEach(n=>loc[n]=gl.getUniformLocation(program,n));",
    "uniform lookup",
)
safe = once(
    safe,
    "function draw(){if(!gl||lost)return;const b=basis();",
    "function draw(){if(!gl||lost)return;const b=basis(),dna=dnaParams();",
    "draw DNA params",
)
safe = once(
    safe,
    "gl.uniform1f(loc.uScene,scene==='silver'?0:1);gl.uniform1f(loc.uObsOverride,obsOverride);gl.uniform3fv(loc.uCam,S.position);",
    "gl.uniform1f(loc.uScene,scene==='silver'?0:1);gl.uniform1f(loc.uObsOverride,obsOverride);gl.uniform4fv(loc.uDNAObject,dna.object);gl.uniform3fv(loc.uDNADetail,dna.detail);gl.uniform3fv(loc.uCam,S.position);",
    "DNA uniform upload",
)

# Observation and flight are now two observer states over one continuously
# alive cloud field. No cloud payload is swapped when the user presses 观云.
safe = once(
    safe,
    "if(S.flying){S.speed=clamp(S.speed+((keys.has('w')?1:0)-(keys.has('s')?1:0))*18*dt,25,120);",
    "if(S.flying&&viewMode==='flight'){S.speed=clamp(S.speed+((keys.has('w')?1:0)-(keys.has('s')?1:0))*18*dt,25,120);",
    "observer mode movement gate",
)
safe = once(
    safe,
    "$('#viewname').textContent=(scene==='silver'?'银边积云':'层叠云海')+' · 云中飞行';",
    "$('#viewname').textContent=(scene==='silver'?'银边积云':'层叠云海')+(viewMode==='observe'?' · 同一云体观测':' · 云中飞行');",
    "mode title",
)
safe = once(
    safe,
    "$('#fly').textContent=S.flying?'飞行中':'已暂停';",
    "$('#fly').textContent=S.flying?'飞行中':'已暂停';$('#watch').textContent=viewMode==='observe'?'观云中':'返回观云';",
    "mode HUD",
)
safe = once(
    safe,
    "function reset(){Object.assign(S,{position:[0,4.4,4.8],yaw:0,pitch:-.02,lookYaw:0,lookPitch:0,roll:0,speed:75,flying:true,time:0});worldPlaying=true;keys.clear();updateHud();}",
    "function reset(){Object.assign(S,{position:[0,4.4,4.8],yaw:0,pitch:-.02,lookYaw:0,lookPitch:0,roll:0,speed:75,flying:viewMode==='flight',time:0});worldPlaying=true;keys.clear();updateHud();}",
    "mode-aware reset",
)
safe = once(
    safe,
    "function setScene(x){scene=x==='sea'?'sea':'silver';qa.scene=scene;updateHud();}function setFlying(x){S.flying=!!x;keys.clear();updateHud();}function setWorldPlaying(x){worldPlaying=!!x;updateHud();}function getWorldClockState(){return{playing:worldPlaying,timeS:S.time};}function getState(){return{...JSON.parse(JSON.stringify(S)),scene,cameraPositionMeters:S.position.map(x=>x*1000),mobileSafe:true,worldPlaying,units:qa.units};}",
    "function setScene(x){scene=x==='sea'?'sea':'silver';qa.scene=scene;updateHud();}function setFlying(x){S.flying=!!x;keys.clear();updateHud();}function setWorldPlaying(x){worldPlaying=!!x;updateHud();}function getWorldClockState(){return{playing:worldPlaying,timeS:S.time};}function getState(){return{...JSON.parse(JSON.stringify(S)),scene,cameraPositionMeters:S.position.map(x=>x*1000),mobileSafe:true,worldPlaying,viewMode,units:qa.units};}function setViewMode(x){viewMode=x==='observe'?'observe':'flight';document.body.dataset.viewMode=viewMode;S.flying=viewMode==='flight';keys.clear();updateHud();return viewMode;}function getViewMode(){return viewMode;}",
    "view mode API",
)

# Patch the R25 CPU mirror with the exact same JS-derived DNA parameters. This
# preserves the no-FBO mobile path while making CloudQuery and optical aircraft
# attenuation read the same seeded cumulus envelope as the GPU.
old_cpu_sdf = "function cloudSdf(x,y,z,scene){let d=9;if(scene==='sea'){\n  d=Math.min(d,ell(x,y,z,-4.5,3.15,-7.0,5.1,.78,4.3));d=Math.min(d,ell(x,y,z,2.2,3.55,-9.8,5.6,.88,5.0));d=Math.min(d,ell(x,y,z,-2.5,4.05,-13.8,6.0,1.0,4.2));d=Math.min(d,ell(x,y,z,5.2,4.4,-17.0,5.8,.82,4.0));\n}else{\n  d=Math.min(d,ell(x,y,z,-4.2,3.65,-7.0,4.3,1.55,3.7));d=Math.min(d,ell(x,y,z,.3,4.0,-8.7,4.1,1.85,4.0));d=Math.min(d,ell(x,y,z,4.4,3.7,-11.2,3.5,1.65,3.8));d=Math.min(d,ell(x,y,z,-1.7,5.0,-12.0,2.7,2.1,3.0));d=Math.min(d,ell(x,y,z,2.0,5.4,-13.7,2.35,2.0,2.7));d=Math.min(d,ell(x,y,z,-5.8,4.75,-13.5,2.8,1.8,3.0));\n}return d;}"
new_cpu_sdf = "function cloudSdf(x,y,z,scene){const dna=window.WeatherCumulusDNAParams?window.WeatherCumulusDNAParams():{object:[0,0,0,1]},o=dna.object,ox=o[0],oy=o[1],oz=o[2],sc=o[3];let d=9;if(scene==='sea'){\n  d=Math.min(d,ell(x,y,z,-4.5,3.15,-7.0,5.1,.78,4.3));d=Math.min(d,ell(x,y,z,2.2,3.55,-9.8,5.6,.88,5.0));d=Math.min(d,ell(x,y,z,-2.5,4.05,-13.8,6.0,1.0,4.2));d=Math.min(d,ell(x,y,z,5.2,4.4,-17.0,5.8,.82,4.0));\n}else{\n  d=Math.min(d,ell(x,y,z,-4.2+ox,3.65+oy,-7.0+oz,4.3*sc,1.55*sc,3.7*sc));d=Math.min(d,ell(x,y,z,.3-ox*.35,4.0+oy*.25,-8.7+oz*.45,4.1*sc,1.85*sc,4.0*sc));d=Math.min(d,ell(x,y,z,4.4+ox*.42,3.7-oy*.18,-11.2+oz*.72,3.5*sc,1.65*sc,3.8*sc));d=Math.min(d,ell(x,y,z,-1.7-ox*.24,5.0+oy*.62,-12.0+oz*.55,2.7*sc,2.1*sc,3.0*sc));d=Math.min(d,ell(x,y,z,2.0+ox*.28,5.4+oy*.74,-13.7+oz*.86,2.35*sc,2.0*sc,2.7*sc));d=Math.min(d,ell(x,y,z,-5.8-ox*.62,4.75+oy*.48,-13.5+oz*.80,2.8*sc,1.8*sc,3.0*sc));\n}return d;}"
safe = once(safe, old_cpu_sdf, new_cpu_sdf, "CPU cumulus envelope")

old_cpu_density = "function densityAt(x,y,z,scene,time){const d=cloudSdf(x,y,z,scene);if(d>.42||y<1.35||y>7.5)return 0;const low=bands(x*.72,y*.72,z*.72+time*.004),mid=bands(x*1.85+11.3,y*1.85+7.1,z*1.85+3.7),hi=yo(x*7.3+2.1,y*7.3+5.7,z*7.3+13.);const erode=(low-.52)*.24+(mid-.5)*.10+(hi-.5)*.025;const shape=1-smooth(-.28,.18,d+erode),baseGate=smooth(1.45,1.85,y),topGate=1-smooth(6.25,7.15,y);return sat(shape*baseGate*topGate*(scene==='sea'?.78:1.08));}"
new_cpu_density = "function densityAt(x,y,z,scene,time){const d=cloudSdf(x,y,z,scene);if(d>.42||y<1.35||y>7.5)return 0;const dna=window.WeatherCumulusDNAParams?window.WeatherCumulusDNAParams():{detail:[0,0,0]},p=dna.detail,dx=p[0],dy=p[1],dz=p[2],low=bands(x*.72+dx,y*.72+dy,z*.72+time*.004+dz),mid=bands(x*1.85+11.3+dx*1.7,y*1.85+7.1+dy*1.7,z*1.85+3.7+dz*1.7),hi=yo(x*7.3+2.1+dx*3.1,y*7.3+5.7+dy*3.1,z*7.3+13.+dz*3.1);const erode=(low-.52)*.24+(mid-.5)*.10+(hi-.5)*.025;const shape=1-smooth(-.28,.18,d+erode),baseGate=smooth(1.45,1.85,y),topGate=1-smooth(6.25,7.15,y);return sat(shape*baseGate*topGate*(scene==='sea'?.78:1.08));}"
safe = once(safe, old_cpu_density, new_cpu_density, "CPU seeded density")

safe = once(
    safe,
    "opticalOcclusion:true,occlusionModel:'cpu-mirror-beer-lambert',opticalUnits:'km-km^-1',failOpen:true",
    "opticalOcclusion:true,occlusionModel:'cpu-mirror-beer-lambert',opticalUnits:'km-km^-1',sharedCumulusCloudDNA:true,failOpen:true",
    "R25 shared DNA QA",
)
safe = once(
    safe,
    "window.WeatherMobileR25={qa,getState:",
    "window.WeatherMobileR25={qa,sampleDensity:(point,sceneName='silver',timeS=0)=>Array.isArray(point)&&point.length>=3?densityAt(Number(point[0]),Number(point[1]),Number(point[2]),sceneName==='sea'?'sea':'silver',Number(timeS)||0):0,getState:",
    "canonical CPU density export",
)

old_exports = "window.AircraftWorld={qa,getState,setScene,reset,setPose,setLook,setFlying,setWorldPlaying,getWorldClockState,gl:()=>gl,capture:()=>canvas.toDataURL()};window.WeatherMobileR23={qa,getState,setScene};window.WeatherMobileR26={qa,getState,setScene,setObservationOverride,observationWeight,cloud:window.WeatherMobileR23};window.WeatherMobileR27Foundation={qa,getState,setScene,setFlying,setWorldPlaying,getWorldClockState,setObservationOverride,observationWeight,cloud:window.WeatherMobileR26};"
new_exports = "function cleanSeed(v){return clamp(Math.round(Number(v)||1),1,99999999);}function getCloudDNA(){const p=dnaParams();return{objectSeed:CloudDNAState.objectSeed,detailSeed:CloudDNAState.detailSeed,objectParams:p.object.slice(),detailParams:p.detail.slice(),referenceSeed:{objectSeed:73017,detailSeed:991}};}function setSeeds(objectSeed,detailSeed){CloudDNAState.objectSeed=cleanSeed(objectSeed);CloudDNAState.detailSeed=cleanSeed(detailSeed);qa.objectSeed=CloudDNAState.objectSeed;qa.detailSeed=CloudDNAState.detailSeed;return getCloudDNA();}function sampleCloudDensity(point,sceneName=scene,timeS=S.time){if(!window.WeatherMobileR25||typeof window.WeatherMobileR25.sampleDensity!=='function')return 0;return window.WeatherMobileR25.sampleDensity(point,sceneName,timeS);}window.AircraftWorld={qa,getState,setScene,reset,setPose,setLook,setFlying,setWorldPlaying,getWorldClockState,setViewMode,getViewMode,gl:()=>gl,capture:()=>canvas.toDataURL()};window.WeatherMobileR23={qa,getState,setScene};window.WeatherMobileR26={qa,getState,setScene,setObservationOverride,observationWeight,cloud:window.WeatherMobileR23};window.WeatherMobileR27Foundation={qa,getState,setScene,setFlying,setWorldPlaying,getWorldClockState,setObservationOverride,observationWeight,cloud:window.WeatherMobileR26};window.WeatherMobileR27CumulusDNA={qa,getState,setScene,setFlying,setWorldPlaying,getWorldClockState,setObservationOverride,observationWeight,setViewMode,getViewMode,getCloudDNA,setSeeds,CloudQuery:{sample:sampleCloudDensity},foundation:window.WeatherMobileR27Foundation,cloud:window.WeatherMobileR26};"
safe = once(safe, old_exports, new_exports, "R27 cumulus API exports")

new64 = base64.b64encode(safe.encode("utf-8")).decode("ascii")
r27 = once(foundation, old64, new64, "embedded mobile payload")
r27 = once(
    r27,
    "document.documentElement.dataset.weatherObservationBandwidth='r26';document.documentElement.dataset.weatherFoundation='r27-units-clock-optics';",
    "document.documentElement.dataset.weatherObservationBandwidth='r26';document.documentElement.dataset.weatherFoundation='r27-units-clock-optics';document.documentElement.dataset.weatherCumulusCloudDNA='r27-shared-seed-density';",
    "outer cumulus marker",
)

# R22 used two different renderers for cloud watching and aircraft driving.
# On the mobile-safe R27 branch that would contradict the shared-cloud claim.
# Keep piloting=true in the original coordinator and reinterpret Watch/Drive as
# observer-mode changes on the same aircraft iframe. The old scapes renderer is
# retained in the frozen base but is no longer swapped in by these two actions.
coordinator = r'''
<script id="weather-mother-r27-cumulus-coordinator">
(()=>{'use strict';
const isAppleMobile=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const compactTouch=innerWidth<=700&&navigator.maxTouchPoints>0;
if(!(isAppleMobile||compactTouch))return;
function install(){
  const hub=window.AircraftClouds;
  if(!hub){setTimeout(install,50);return;}
  if(hub.__r27CumulusUnified)return;
  const rawDrive=hub.drive.bind(hub);
  const waitApi=async()=>{
    for(let i=0;i<160;i++){
      const f=hub.frame('aircraft'),api=f&&f.contentWindow&&f.contentWindow.WeatherMobileR27CumulusDNA;
      if(api)return api;
      await new Promise(r=>setTimeout(r,50));
    }
    throw Error('R27 cumulus Cloud DNA mobile API unavailable');
  };
  const syncDriveButton=api=>{
    const b=document.querySelector('#drive');if(!b)return;
    const observe=api&&api.getViewMode&&api.getViewMode()==='observe';
    b.hidden=!observe;b.textContent='驾驶同一云体';
  };
  hub.watch=async()=>{await rawDrive();const api=await waitApi();api.setViewMode('observe');syncDriveButton(api);return api.getState();};
  hub.drive=async()=>{await rawDrive();const api=await waitApi();api.setViewMode('flight');syncDriveButton(api);return api.getState();};
  hub.cloudDNA=async()=>{const api=await waitApi();return api.getCloudDNA();};
  hub.__r27CumulusUnified=true;
  hub.qa.unifiedCumulusCloudDNA=true;
  hub.qa.observeFlightRenderer='same-aircraft-iframe';
  setInterval(()=>{const f=hub.frame('aircraft'),api=f&&f.contentWindow&&f.contentWindow.WeatherMobileR27CumulusDNA;if(api)syncDriveButton(api);},250);
}
install();
})();
</script>
'''
idx = r27.lower().rfind("</html>")
r27 = r27 + coordinator if idx < 0 else r27[:idx] + coordinator + r27[idx:]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(r27, encoding="utf-8")
print(OUT)
print(f"foundation_bytes={len(foundation.encode('utf-8'))} r27_cumulus_bytes={len(r27.encode('utf-8'))} safe_bytes={len(safe.encode('utf-8'))}")
