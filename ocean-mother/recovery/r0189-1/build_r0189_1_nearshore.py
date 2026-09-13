from __future__ import annotations

from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "ocean-mother/recovery/r0189-exact/Ocean_Mother_R018.9_Direct_Open.html"
OUT_DIR = ROOT / "ocean-mother/recovery/r0189-1"
OUT = OUT_DIR / "Ocean_Mother_R018.9.1_Nearshore_Candidate.html"
REPORT = OUT_DIR / "R0189_1_BUILD_REPORT.json"

EXPECTED_BASE_SHA256 = "7eef3bc029d19fb6fe81c8f65a97a4fa40470cac57c1f86b3f1f1f89af8aa5de"

FOAM_BLOCK = r'''float foamFilament(vec2 p,float scale,vec2 drift,float phase){
  vec2 q=rot2(.40+phase*.17)*p*scale+drift*uTime+vec2(phase,-phase*.61);
  float warp=(fbm(q*.43+vec2(2.7,-4.1))-.5)*1.24;
  q+=vec2(warp,-warp*.46);
  float n=(noise2(q)+.46*noise2(q*2.11+vec2(7.1,-3.4)))/1.46;
  float ridge=abs(n-.5);
  float aa=max(fwidth(n)*1.75,.0048);
  float thread=1.-smoothstep(.020-aa,.060+aa,ridge);
  float torn=smoothstep(.39,.76,fbm(q*.39+vec2(-2.3,5.8)));
  float gaps=smoothstep(.28,.67,noise2(q*.71+vec2(4.6,-1.3)));
  return thread*(.10+.90*torn)*(.22+.78*gaps);
}
float foamField(vec2 p){
  float sd=shoreDistance(p),a=atan(p.y,p.x),t=uTime;
  float fineA=foamFilament(p,.132,vec2(.017,-.009),.7);
  float fineB=foamFilament(p,.225,vec2(-.010,.016),2.2);
  float longStrand=foamFilament(rot2(.27)*p,.092,vec2(.022,.003),4.3);
  float macro=fbm(p*.060+vec2(t*.008,-t*.005));
  float macroGate=smoothstep(.34,.70,macro);
  float alongshore=.58+.42*sin(a*6.1+t*.13+fbm(p*.034+3.1)*4.6);
  float foam=0.;
  if(flag(1)){
    for(int i=0;i<3;i++){
      float front;
      float band=breakerBand(p,float(i),t,front);
      float core=smoothstep(.045,.42,band);
      float trailing=exp(-pow(max(front,0.)/(3.55+float(i)*.34),2.))*exp(-pow(min(front,0.)/(1.05+float(i)*.12),2.));
      float lace=mix(fineA,fineB,fract(float(i)*.37+.18));
      float crestBreak=(.10+.90*lace)*(.32+.68*macroGate);
      float wake=trailing*swellExposure(p)*(.06+.94*mix(longStrand,fineB,.42));
      foam+=(core*crestBreak+wake*.22)*uMedia.x*(1.-float(i)*.15);
    }
  }
  if(flag(8)){
    float shore=exp(-pow((sd+.16)/2.34,2.));
    float pulse=.5+.5*sin(a*4.9-t*uWaves.y*.92+fbm(p*.088)*4.7);
    float runupLace=mix(fineA,longStrand,.61)*smoothstep(.30,.76,macro);
    foam+=shore*pow(pulse,1.18)*(.05+.95*runupLace)*uMedia.z*.42*(.58+.42*alongshore);
    float wetBand=smoothstep(-uIsland.z*.96,-1.05,sd)*(1.-smoothstep(-1.05,.48,sd));
    foam+=wetBand*.021*(.10+.90*fineB)*uMedia.z;
  }
  return sat(pow(max(foam,0.),1.04));
}
'''

SHADE_WATER = r'''vec3 shadeWater(vec3 p,vec3 rd,vec3 sunDir,vec3 sky){
  vec3 n=waterNormal(p.xz);
  float depth=max(.04,p.y-terrainHeight(p.xz));
  float shallow=exp(-depth*.17*uOptics.x);
  float fres=pow(1.-max(dot(n,-rd),0.),4.6);
  vec3 refl=skyColor(reflect(rd,n),sunDir);
  vec3 deep=vec3(.008,.105,.165);
  vec3 shelf=vec3(.025,.30,.35);
  vec3 lagoon=vec3(.105,.47,.43);
  vec3 seabed=vec3(.48,.39,.25);
  vec3 body=mix(deep,shelf,sat(shallow*.86));
  body=mix(body,lagoon,pow(shallow,1.8)*.54);
  body=mix(body,seabed,pow(shallow,3.2)*.19*uOptics.x);
  float spec=pow(max(dot(reflect(-sunDir,n),-rd),0.),210.);
  float broadSpec=pow(max(dot(reflect(-sunDir,n),-rd),0.),36.);
  float foam=foamField(p.xz);
  vec3 col=mix(body,refl,.12+.69*fres);
  col+=vec3(1.,.78,.48)*spec*2.25+vec3(.35,.54,.58)*broadSpec*.15;
  float foamBody=smoothstep(.16,.78,foam);
  float foamThread=smoothstep(.028,.22,foam)*(1.-smoothstep(.58,.92,foam));
  float foamWarm=.5+.5*noise2(p.xz*.15+vec2(uTime*.010,-uTime*.005));
  vec3 foamCol=mix(vec3(.78,.90,.90),vec3(.95,.94,.88),foamWarm*.18);
  col=mix(col,foamCol,foamBody*.58);
  col+=foamThread*vec3(.13,.18,.17)*(.30+.70*max(dot(n,sunDir),0.));
  float steep=smoothstep(.075,.34,1.-n.y)*(1.-foamBody);
  col+=steep*vec3(.035,.16,.19)*(.28+.72*shallow);
  if(flag(64)){
    vec2 fs[4];fs[0]=vec2(-6.5,3.5);fs[1]=vec2(-1.,-1.8);fs[2]=vec2(4.8,3.2);fs[3]=vec2(1.8,8.);
    float glow=0.;for(int i=0;i<4;i++){float d=length(p.xz-fs[i]);glow+=exp(-d*.14)/(1.+depth*.11);}
    col+=vec3(1.,.17,.018)*glow*uRocks.z*.14*(.58+.42*max(dot(n,normalize(vec3(-.4,.8,-.2))),0.));
  }
  if(uMode==2)col=mix(vec3(.05,.78,.68),vec3(.008,.035,.17),sat(depth/18.))+foam*vec3(1.,.22,.015);
  return col;
}
'''


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract(text: str, pattern: str, label: str) -> str:
    m = re.search(pattern, text, re.S)
    if not m:
        raise RuntimeError(f"Missing protected block: {label}")
    return m.group(0)


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one {label} block, got {count}")
    return out


def main() -> None:
    base_bytes = BASE.read_bytes()
    base_sha = sha256_bytes(base_bytes)
    if base_sha != EXPECTED_BASE_SHA256:
        raise RuntimeError(f"R018.9 baseline SHA mismatch: {base_sha}")
    base = base_bytes.decode("utf-8")

    protected_patterns = {
        "deep": r'const ORIGINAL_DEEP_HTML=.*?;\nconst deepFrame=',
        "shoreDistance": r'float shoreDistance\(vec2 p\)\{.*?\n\}',
        "rockField": r'float rockField\(vec2 p\)\{.*?\n\}',
        "terrainHeight": r'float terrainHeight\(vec2 p\)\{.*?\n\}',
        "waterHeight": r'float waterHeight\(vec2 p\)\{.*?\n\}',
        "setView": r'function setView\(name\)\{.*?\n\}',
    }
    before = {k: sha256_bytes(extract(base, p, k).encode()) for k, p in protected_patterns.items()}

    candidate = base
    candidate = replace_once(
        candidate,
        r'float foamFilament\(vec2 p,float scale,vec2 drift,float phase\)\{.*?\n\}\nfloat foamField\(vec2 p\)\{.*?\n\}\n',
        FOAM_BLOCK,
        "foam",
    )
    candidate = replace_once(
        candidate,
        r'vec3 shadeWater\(vec3 p,vec3 rd,vec3 sunDir,vec3 sky\)\{.*?\n\}\n\nvoid main\(\)\{',
        SHADE_WATER + "\nvoid main(){",
        "shadeWater",
    )

    candidate = candidate.replace("Ocean Mother | R018.9 海岛近岸水体修正版", "Ocean Mother | R018.9.1 近岸泡沫与水线候选", 1)
    candidate = candidate.replace("ISLAND GOLD COAST / R018.9", "ISLAND GOLD COAST / R018.9.1", 1)
    candidate = candidate.replace("R018.9 · 近岸水体修正版", "R018.9.1 · 近岸泡沫与水线候选", 1)
    candidate = candidate.replace("version:'0.3.9-island-r018-wave-refinement-lazy-deep'", "version:'0.3.9.1-r0189-nearshore-conservative'", 1)
    candidate = candidate.replace("buildId:'island-r018-wave-refinement-lazy-v001-deep'", "buildId:'r0189.1-nearshore-conservative-v001-deep-frozen'", 1)

    after = {k: sha256_bytes(extract(candidate, p, k).encode()) for k, p in protected_patterns.items()}
    changed_protected = [k for k in before if before[k] != after[k]]
    if changed_protected:
        raise RuntimeError("Protected R018.9 blocks changed: " + ", ".join(changed_protected))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT.write_text(candidate, encoding="utf-8")
    report = {
        "baseline": "R018.9",
        "baselineSha256": base_sha,
        "candidate": "R018.9.1",
        "candidateSha256": sha256_bytes(candidate.encode()),
        "scope": ["foamFilament", "foamField", "shadeWater", "candidate identity strings"],
        "protected": sorted(protected_patterns),
        "protectedHashesUnchanged": True,
        "deepOceanByteIdentityInsideCandidate": before["deep"] == after["deep"],
        "visualApproved": False,
        "productionApproved": False,
        "notes": "Conservative nearshore-only candidate. Island geometry, rock field, water height, camera views, and embedded V001 deep ocean are unchanged from exact R018.9."
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
