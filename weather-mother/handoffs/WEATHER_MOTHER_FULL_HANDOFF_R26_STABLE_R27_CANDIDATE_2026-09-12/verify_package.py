#!/usr/bin/env python3
import json
import pathlib
import hashlib

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

r26 = (root / "stable-r26/index.html").read_text(encoding="utf-8")
r27 = (root / "candidate-r27/index.html").read_text(encoding="utf-8")
for marker in ("R26", "Observation"):
    assert marker in r26, marker
for marker in ("Cloud DNA Flight R27", "Cloud Seed", "Detail Seed", "sameCloudForObserveAndFlight:true"):
    assert marker in r27, marker
assert len(r27.encode("utf-8")) == current["candidateBytes"]
assert hashlib.sha256(r27.encode("utf-8")).hexdigest() == current["candidateSHA256"]

for path in root.rglob("*"):
    if path.is_dir() and path.name in {".git", "node_modules", "__pycache__"}:
        raise SystemExit(f"Forbidden directory: {path.relative_to(root)}")

print("PACKAGE_VERIFY_OK")
print("files", sum(1 for p in root.rglob("*") if p.is_file()))
