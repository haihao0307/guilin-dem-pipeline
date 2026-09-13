from __future__ import annotations

import base64
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
V1_BUILD = ROOT / "weather-mother/r27-cumulus-clouddna-src/build-r27-cumulus-clouddna.py"
OUT = ROOT / "weather-mother/full-weather-r27-cumulus-clouddna-20260913/index.html"


def once(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"R27 cumulus DNA v2 {label}: expected 1 match, got {n}")
    return text.replace(old, new, 1)


def sub1(text: str, pattern: str, repl: str, label: str) -> str:
    out, n = re.subn(pattern, lambda _: repl, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"R27 cumulus DNA v2 {label}: expected 1 regex match, got {n}")
    return out


# V1 proved shared CPU/GPU parameters and a single observer/flight iframe. V2
# narrows Detail Seed to the high-frequency tail. The first three prefix bands,
# which carry broad cloud identity, remain unchanged across Detail Seed values.
subprocess.check_call([sys.executable, str(V1_BUILD)], cwd=ROOT)
page = OUT.read_text(encoding="utf-8")
m = re.search(r"const safe=decodeURIComponent\(escape\(atob\('([^']+)'\)\)\);", page)
if not m:
    raise SystemExit("R27 cumulus DNA v2: embedded mobile payload not found")
old64 = m.group(1)
safe = base64.b64decode(old64).decode("utf-8")

safe = once(safe, "WM-R27-CUMULUS-CLOUD-DNA-20260913", "WM-R27-CUMULUS-CLOUD-DNA-HF-20260913", "qa version")
safe = once(
    safe,
    "cpuGpuDNAParametersShared:true,objectSeed:73017",
    "cpuGpuDNAParametersShared:true,detailSeedHighBandsOnly:true,detailSeedEnvelopeInvariant:true,objectSeed:73017",
    "qa detail policy",
)

# bandsOB is formatted across multiple GLSL lines, so allow whitespace between
# its final semicolon and closing brace. This remains a strict single-match patch.
safe = sub1(
    safe,
    r"float bandsOB\(vec3 p,float highGate\)\{.*?return \.5\+s/\.96875;\s*\}",
    """float bandsOB(vec3 p,float highGate){
  float a=.5,s=0.;
  for(int i=0;i<5;i++){
    float gate=i<3?1.:highGate;
    vec3 sampleP=p;
    if(i>=3)sampleP+=uDNADetail*(float(i)-2.)*1.7;
    s+=a*(yo(sampleP)-.5)*gate;
    p=mat3(.86,.18,.47,-.28,.95,.12,-.42,-.23,.88)*p*2.0+vec3(.37,.19,.53);
    a*=.5;
  }
  return .5+s/.96875;
}""",
    "GPU high-band policy",
)
safe = once(safe, "p*.72+vec3(uDNADetail.xy,uTime*.004+uDNADetail.z)", "p*.72+vec3(0.,0.,uTime*.004)", "GPU low prefix")
safe = once(safe, "p*1.85+vec3(11.3,7.1,3.7)+uDNADetail*1.7", "p*1.85+vec3(11.3,7.1,3.7)", "GPU mid prefix")

safe = sub1(
    safe,
    r"function bands\(x,y,z\)\{.*?return s/n;\}",
    "function bands(x,y,z){const dna=window.WeatherCumulusDNAParams?window.WeatherCumulusDNAParams():{detail:[0,0,0]},p=dna.detail;let a=.5,s=0,n=0;for(let i=0;i<5;i++){const k=i>=3?(i-2)*1.7:0;s+=a*yo(x+p[0]*k,y+p[1]*k,z+p[2]*k);n+=a;const nx=.86*x-.28*y-.42*z,ny=.18*x+.95*y-.23*z,nz=.47*x+.12*y+.88*z;x=nx*2+.37;y=ny*2+.19;z=nz*2+.53;a*=.5;}return s/n;}",
    "CPU high-band policy",
)
safe = sub1(
    safe,
    r"function densityAt\(x,y,z,scene,time\)\{.*?return sat\(shape\*baseGate\*topGate\*\(scene==='sea'\?\.78:1\.08\)\);\}",
    "function densityAt(x,y,z,scene,time){const d=cloudSdf(x,y,z,scene);if(d>.42||y<1.35||y>7.5)return 0;const dna=window.WeatherCumulusDNAParams?window.WeatherCumulusDNAParams():{detail:[0,0,0]},p=dna.detail,dx=p[0],dy=p[1],dz=p[2],low=bands(x*.72,y*.72,z*.72+time*.004),mid=bands(x*1.85+11.3,y*1.85+7.1,z*1.85+3.7),hi=yo(x*7.3+2.1+dx*3.1,y*7.3+5.7+dy*3.1,z*7.3+13.+dz*3.1);const erode=(low-.52)*.24+(mid-.5)*.10+(hi-.5)*.025;const shape=1-smooth(-.28,.18,d+erode),baseGate=smooth(1.45,1.85,y),topGate=1-smooth(6.25,7.15,y);return sat(shape*baseGate*topGate*(scene==='sea'?.78:1.08));}",
    "CPU prefix restoration",
)
safe = once(safe, "sharedCumulusCloudDNA:true,failOpen:true", "sharedCumulusCloudDNA:true,detailSeedHighBandsOnly:true,detailSeedEnvelopeInvariant:true,failOpen:true", "R25 policy flags")
safe = once(
    safe,
    "window.WeatherMobileR25={qa,sampleDensity:",
    "window.WeatherMobileR25={qa,sampleEnvelopeDistance:(point,sceneName='silver')=>Array.isArray(point)&&point.length>=3?cloudSdf(Number(point[0]),Number(point[1]),Number(point[2]),sceneName==='sea'?'sea':'silver'):9,sampleDensity:",
    "envelope query export",
)
safe = once(
    safe,
    "CloudQuery:{sample:sampleCloudDensity}",
    "CloudQuery:{sample:sampleCloudDensity,envelope:(point,sceneName=scene)=>window.WeatherMobileR25&&window.WeatherMobileR25.sampleEnvelopeDistance?window.WeatherMobileR25.sampleEnvelopeDistance(point,sceneName):9}",
    "R27 envelope query",
)

new64 = base64.b64encode(safe.encode("utf-8")).decode("ascii")
page = once(page, old64, new64, "embedded payload")
page = once(
    page,
    "document.documentElement.dataset.weatherCumulusCloudDNA='r27-shared-seed-density';",
    "document.documentElement.dataset.weatherCumulusCloudDNA='r27-shared-seed-density';document.documentElement.dataset.weatherCumulusDetailPolicy='high-bands-only';",
    "outer policy marker",
)
OUT.write_text(page, encoding="utf-8")
print(OUT)
print(f"r27_cumulus_v2_bytes={len(page.encode('utf-8'))} safe_bytes={len(safe.encode('utf-8'))}")
