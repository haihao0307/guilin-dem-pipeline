from __future__ import annotations

from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "ocean-mother/recovery/r0189-2/Ocean_Mother_R018.9.2_Shore_Contact_Candidate.html"
OUT_DIR = ROOT / "ocean-mother/recovery/r0189-3"
OUT = OUT_DIR / "Ocean_Mother_R018.9.3_Rock_Form_Candidate.html"
REPORT = OUT_DIR / "R0189_3_BUILD_REPORT.json"
EXPECTED_BASE_SHA256 = "e7a4bb92ecfd2eedd3a0b7be3121b5eb55561aacea9742e6783d4434a3afa51d"

ROCK_BLOCK = r'''float cragOne(vec2 p,vec2 c,vec2 r,float h,float seed,float turn){
  vec2 q=rot2(turn)*(p-c)/r;
  vec2 a0=normalize(vec2(.82,.57));
  vec2 a1=normalize(vec2(-.46,.89));
  vec2 a2=normalize(vec2(.96,-.28));
  float d0=abs(dot(q,a0))*.94+abs(dot(q,vec2(-a0.y,a0.x)))*.34;
  float d1=abs(dot(q,a1))*.90+abs(dot(q,vec2(-a1.y,a1.x)))*.39;
  float d2=abs(dot(q,a2))*.88+abs(dot(q,vec2(-a2.y,a2.x)))*.37;
  float d=max(d0,max(d1,d2));
  float edge=h*sat((1.-d)*2.85);
  float planeA=h*(.78-.15*q.x+.09*q.y);
  float planeB=h*(.84+.08*q.x-.18*q.y);
  float planeC=h*(.80-.04*q.x-.07*q.y);
  float z=max(0.,min(edge,min(planeA,min(planeB,planeC))));
  float split=smoothstep(.84,.97,abs(sin(dot(q,vec2(5.4,-3.1))+seed*2.37)))*smoothstep(.38,.92,d);
  return z*(1.-split*.11);
}
float rockField(vec2 p){
  float r=0.;
  r=max(r,cragOne(p,vec2(35.,-12.),vec2(7.6,4.5),6.2,1.1,.32));
  r=max(r,cragOne(p,vec2(28.,-24.),vec2(5.2,3.1),4.0,4.3,-.28));
  r=max(r,cragOne(p,vec2(-34.,10.),vec2(8.5,5.0),6.4,7.2,.18));
  r=max(r,cragOne(p,vec2(-42.,0.),vec2(4.8,2.9),3.7,9.7,-.55));
  r=max(r,cragOne(p,vec2(4.,31.),vec2(6.4,3.8),4.8,13.4,.46));
  r=max(r,cragOne(p,vec2(17.,27.),vec2(4.0,2.5),3.2,16.1,-.12));
  r=max(r,cragOne(p,vec2(-7.,-34.),vec2(5.3,3.1),3.5,19.3,.62));
  r=max(r,cragOne(p,vec2(-4.,4.),vec2(5.5,3.4),3.6,22.8,-.34));
  r=max(r,cragOne(p,vec2(10.,1.),vec2(3.6,2.3),2.6,25.6,.41));
  return r;
}'''

OLD_VIEWS = "function setView(name){const views={overview:[.72,.44,118,[2,5,-2]],top:[-.12,1.46,132,[4,1,-3]],shore:[-.48,.15,50,[29,.8,-19]],breaker:[.68,.10,48,[23,.5,17]],rocks:[.08,.18,44,[34,2.5,-12]],fire:[1.18,.22,50,[0,10,3]]};"
NEW_VIEWS = "function setView(name){const views={overview:[.72,.42,104,[2,4,-2]],top:[-.12,1.46,126,[4,1,-3]],shore:[-.62,.20,58,[18,1.2,-12]],breaker:[.68,.10,48,[23,.5,17]],rocks:[-.12,.22,53,[30,2,-10]],fire:[1.18,.22,50,[0,10,3]]};"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract(text: str, pattern: str, label: str) -> str:
    match = re.search(pattern, text, re.S)
    if not match:
        raise RuntimeError(f"Missing protected block: {label}")
    return match.group(0)


def replace_pattern(text: str, pattern: str, replacement: str, label: str) -> str:
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one {label} block, got {count}")
    return out


def replace_one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} string, got {count}")
    return text.replace(old, new, 1)


def main() -> None:
    raw = BASE.read_bytes()
    base_sha = digest(raw)
    if base_sha != EXPECTED_BASE_SHA256:
        raise RuntimeError(f"R018.9.2 source SHA mismatch: {base_sha}")
    source = raw.decode("utf-8")

    protected_patterns = {
        "deep": r'const ORIGINAL_DEEP_HTML=.*?;\nconst deepFrame=',
        "shoreDistance": r'float shoreDistance\(vec2 p\)\{.*?\n\}',
        "terrainHeightBody": r'float terrainHeight\(vec2 p\)\{.*?\n\}',
        "waterHeight": r'float waterHeight\(vec2 p\)\{.*?\n\}',
        "foamField": r'float foamFilament\(vec2 p,float scale,vec2 drift,float phase\)\{.*?\n\}\nfloat foamField\(vec2 p\)\{.*?\n\}',
        "curlDensity": r'float curlDensity\(vec3 p\)\{.*?\n\}',
        "sprayDensity": r'float sprayDensity\(vec3 p\)\{.*?\n\}',
        "smokeDensityAt": r'float smokeDensityAt\(vec3 p\)\{.*?\n\}',
        "shadeWater": r'vec3 shadeWater\(vec3 p,vec3 rd,vec3 sunDir,vec3 sky\)\{.*?\n\}',
    }
    before = {key: digest(extract(source, pattern, key).encode()) for key, pattern in protected_patterns.items()}

    candidate = replace_pattern(
        source,
        r'float cragOne\(vec2 p,vec2 c,vec2 r,float h,float seed,float turn\)\{.*?\n\}\nfloat rockField\(vec2 p\)\{.*?\n\}',
        ROCK_BLOCK,
        "rock geometry",
    )
    candidate = replace_one(candidate, OLD_VIEWS, NEW_VIEWS, "camera views")

    identities = [
        ("Ocean Mother | R018.9.2 岸线接触与湿岩候选", "Ocean Mother | R018.9.3 岩石形体候选", "title"),
        ("ISLAND GOLD COAST / R018.9.2", "ISLAND GOLD COAST / R018.9.3", "brand"),
        ("R018.9.2 · 岸线接触与湿岩候选", "R018.9.3 · 岩石形体候选", "footer"),
        ("version:'0.3.9.2-r0189-shore-contact'", "version:'0.3.9.3-r0189-rock-form'", "runtime version"),
        ("buildId:'r0189.2-shore-contact-v001-deep-frozen'", "buildId:'r0189.3-rock-form-v001-deep-frozen'", "build id"),
    ]
    for old, new, label in identities:
        candidate = replace_one(candidate, old, new, label)

    after = {key: digest(extract(candidate, pattern, key).encode()) for key, pattern in protected_patterns.items()}
    changed_protected = [key for key in before if before[key] != after[key]]
    if changed_protected:
        raise RuntimeError("Protected blocks changed: " + ", ".join(changed_protected))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT.write_text(candidate, encoding="utf-8")
    report = {
        "baseline": "R018.9.2 cumulative candidate from exact R018.9",
        "baselineSha256": base_sha,
        "candidate": "R018.9.3",
        "candidateSha256": digest(candidate.encode()),
        "scope": [
            "replace inflated radial boulders with analytic multi-plane rock forms",
            "reduce rock radii/heights while preserving nine inherited anchors",
            "recompose overview, shore, and rock review cameras",
            "candidate identity strings",
        ],
        "protected": sorted(protected_patterns),
        "protectedHashesUnchanged": True,
        "deepOceanByteIdentityInsideCandidate": before["deep"] == after["deep"],
        "deepOcean": "frozen original V001",
        "rockAnchorCount": 9,
        "externalAssets": 0,
        "visualApproved": False,
        "productionApproved": False,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
