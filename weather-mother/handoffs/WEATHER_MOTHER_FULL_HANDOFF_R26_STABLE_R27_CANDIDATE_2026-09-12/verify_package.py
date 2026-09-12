#!/usr/bin/env python3
import hashlib
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent
required = [
    "00_START_HERE.md",
    "01_CURRENT_STATE.md",
    "02_SOURCE_LOCKS.json",
    "03_ARCHITECTURE_DECISIONS.md",
    "04_R27_STATUS_AND_FAILURES.md",
    "05_NEXT_STEPS.md",
    "06_ACCEPTANCE_GATES.md",
    "CURRENT.json",
    "WORKFLOW_STATUS.json",
    "stable-r26/index.html",
    "candidate-r27/index.html",
    "source/r23-mobile-recovery-src/mobile-safe-aircraft.html",
    "source/r25-mobile-cloud-occlusion-src/aircraft-cloud-occlusion.js",
    "source/r26-observation-bandwidth-src/observation-bandwidth.glsl",
    "source/yohei-cloud-atlas-r02/weather-mother-yohei-cloud-atlas-r02.html",
    "reference/r21/index.html",
    "reference/r22/index.html",
]
missing = [p for p in required if not (root / p).is_file()]
if missing:
    raise SystemExit("Missing required files: " + ", ".join(missing))

current = json.loads((root / "CURRENT.json").read_text(encoding="utf-8"))
assert current["stableVersion"] == "R26 Observation Bandwidth"
assert current["developmentCandidate"] == "R27 Unified Cloud Object DNA"
assert current["candidateSourcePresent"] is True
assert current["candidateBrowserQA"] is False
assert current["productionReady"] is False

# R26 deliberately preserves the R22 wrapper title. Verify the immutable wrapper
# identity and package size instead of incorrectly requiring an R26 title string.
r26_bytes = (root / "stable-r26/index.html").read_bytes()
r26 = r26_bytes.decode("utf-8")
assert len(r26_bytes) > 100_000
for marker in ("完整天气恢复 R22", "银边积云", "原自由飞行", "原天气系统"):
    assert marker in r26, marker

r27_bytes = (root / "candidate-r27/index.html").read_bytes()
r27 = r27_bytes.decode("utf-8")
for marker in ("Cloud DNA Flight R27", "Cloud Seed", "Detail Seed", "sameCloudForObserveAndFlight:true"):
    assert marker in r27, marker
assert len(r27_bytes) == current["candidateBytes"]
assert hashlib.sha256(r27_bytes).hexdigest() == current["candidateSHA256"]

for path in root.rglob("*"):
    if path.is_dir() and path.name in {".git", "node_modules", "__pycache__"}:
        raise SystemExit(f"Forbidden directory: {path.relative_to(root)}")

print("PACKAGE_VERIFY_OK")
print("files", sum(1 for p in root.rglob("*") if p.is_file()))
