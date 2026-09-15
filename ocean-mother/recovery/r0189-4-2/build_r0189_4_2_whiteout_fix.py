from __future__ import annotations

from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "ocean-mother/recovery/r0189-4-1/Ocean_Mother_R018.9.4.1_Startup_Recovery.html"
OUT_DIR = ROOT / "ocean-mother/recovery/r0189-4-2"
OUT = OUT_DIR / "Ocean_Mother_R018.9.4.2_GPU_Deterministic.html"
REPORT = OUT_DIR / "R0189_4_2_BUILD_REPORT.json"
EXPECTED_BASE_SHA256 = "3c907bd4aa6ddb3b615784f9a2ff816ca46f3a83a5f7c0d7224a53d325ae4ef5"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


def main() -> None:
    raw = BASE.read_bytes()
    base_sha = sha256(raw)
    if base_sha != EXPECTED_BASE_SHA256:
        raise RuntimeError(f"R018.9.4.1 source SHA mismatch: {base_sha}")
    source = raw.decode("utf-8")

    deep_match = re.search(r"const ORIGINAL_DEEP_HTML=(.*?);\nconst deepFrame=", source, re.S)
    primary_match = re.search(r"const FRAG=`(.*?)`;\n\nconst FRAG_SAFE=", source, re.S)
    if not deep_match or not primary_match:
        raise RuntimeError("required protected block missing")
    deep_hash = sha256(deep_match.group(1).encode())
    primary_hash = sha256(primary_match.group(1).encode())

    candidate = source
    candidate = replace_once(
        candidate,
        "float inside=smoothstep(2.5,-3.1,sd);",
        "float inside=1.-smoothstep(-3.1,2.5,sd);",
        "compatibility island mask",
    )
    candidate = replace_once(
        candidate,
        "float breakZone=smoothstep(22.,4.,sd)*smoothstep(-2.,1.5,sd);",
        "float breakZone=(1.-smoothstep(4.,22.,sd))*smoothstep(-2.,1.5,sd);",
        "compatibility breaker mask",
    )
    candidate = replace_once(
        candidate,
        "  col=1.-exp(-col*uOptics.z);\n  col=pow(max(col,0.),vec3(.96));",
        "  col=max(col,vec3(0.));\n  float peak=max(col.r,max(col.g,col.b));\n  if(peak>3.0)col*=3.0/peak;\n  col=col/(vec3(1.)+col*.82);\n  col=pow(clamp(col,0.,1.),vec3(.98));",
        "bounded compatibility tone map",
    )

    identities = [
        ("Ocean Mother | R018.9.4.1 启动兼容修复", "Ocean Mother | R018.9.4.2 显卡白屏修复", "title"),
        ("ISLAND GOLD COAST / R018.9.4.1", "ISLAND GOLD COAST / R018.9.4.2", "brand"),
        ("version:'0.3.9.4.1-r0189-startup-compat'", "version:'0.3.9.4.2-r0189-gpu-deterministic'", "version"),
        ("buildId:'r0189.4.1-startup-compat-v001-deep-frozen'", "buildId:'r0189.4.2-gpu-deterministic-v001-deep-frozen'", "build id"),
        ("badge.id='compatBadge';badge.textContent='兼容渲染';", "badge.id='compatBadge';badge.textContent='兼容渲染 2';", "compatibility badge"),
        (
            "curlModel:'three-layer crest lip and falling sheet',deepModel:'frozen Ocean Mother V001',renderPath,primaryStartupError,rendererInfo",
            "curlModel:'three-layer crest lip and falling sheet',deepModel:'frozen Ocean Mother V001',gpuDeterministicFix:'ordered smoothstep and bounded tone map',renderPath,primaryStartupError,rendererInfo",
            "QA marker",
        ),
    ]
    for old, new, label in identities:
        candidate = replace_once(candidate, old, new, label)

    safe_match = re.search(r"const FRAG_SAFE=`(.*?)`;\n\nfunction compile", candidate, re.S)
    if not safe_match:
        raise RuntimeError("compatibility fragment shader missing")
    safe = safe_match.group(1)
    numeric = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)"
    reversed_smoothsteps = []
    for match in re.finditer(rf"smoothstep\(({numeric}),\s*({numeric}),", safe):
        edge0, edge1 = map(float, match.groups())
        if edge0 >= edge1:
            reversed_smoothsteps.append({"edge0": edge0, "edge1": edge1})
    if reversed_smoothsteps:
        raise RuntimeError(f"undefined descending smoothstep remains: {reversed_smoothsteps}")

    new_deep_match = re.search(r"const ORIGINAL_DEEP_HTML=(.*?);\nconst deepFrame=", candidate, re.S)
    new_primary_match = re.search(r"const FRAG=`(.*?)`;\n\nconst FRAG_SAFE=", candidate, re.S)
    if sha256(new_deep_match.group(1).encode()) != deep_hash:
        raise RuntimeError("deep V001 changed")
    if sha256(new_primary_match.group(1).encode()) != primary_hash:
        raise RuntimeError("primary visual shader changed")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT.write_text(candidate, encoding="utf-8")
    report = {
        "baseline": "R018.9.4.1",
        "baselineSha256": base_sha,
        "candidate": "R018.9.4.2",
        "candidateSha256": sha256(candidate.encode()),
        "rootCause": "descending-edge smoothstep calls in the compatibility shader invoked undefined GLSL behavior on the user's Windows GPU",
        "fixes": [
            "replace descending-edge smoothstep calls with ordered equivalent expressions",
            "bound compatibility HDR values before a rational tone map",
            "retain automatic primary-to-compatibility startup fallback",
        ],
        "descendingSmoothstepCount": 0,
        "deepOceanByteIdentityInsideCandidate": True,
        "primaryVisualShaderUnchanged": True,
        "visualApproved": False,
        "productionApproved": False,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
