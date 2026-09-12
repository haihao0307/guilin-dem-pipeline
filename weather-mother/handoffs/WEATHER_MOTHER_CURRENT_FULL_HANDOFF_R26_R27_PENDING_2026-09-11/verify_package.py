#!/usr/bin/env python3
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent
required = [
    "00_START_HERE.md",
    "01_CURRENT_STATE.md",
    "02_SOURCE_LOCKS.json",
    "03_ARCHITECTURE_DECISIONS.md",
    "04_KNOWN_ISSUES_AND_FAILURES.md",
    "05_NEXT_R27_PLAN.md",
    "06_ACCEPTANCE_GATES.md",
    "07_PACKAGE_SCOPE.md",
    "CURRENT.json",
    "08_PACKAGE_CHECKLIST.json",
    "runtime/index.html",
    "source/r23-mobile-recovery-src/mobile-safe-aircraft.html",
    "source/r25-mobile-cloud-occlusion-src/aircraft-cloud-occlusion.js",
    "source/r26-observation-bandwidth-src/observation-bandwidth.glsl",
    "source/yohei-cloud-atlas-r02/weather-mother-yohei-cloud-atlas-r02.html",
    "reference/r21/index.html",
    "reference/r22/index.html",
]
missing = [path for path in required if not (root / path).is_file()]
if missing:
    raise SystemExit("Missing required files: " + ", ".join(missing))

current = json.loads((root / "CURRENT.json").read_text(encoding="utf-8"))
locks = json.loads((root / "02_SOURCE_LOCKS.json").read_text(encoding="utf-8"))
assert current["r27Implemented"] is False
assert current["productionReady"] is False
assert locks["acceptance"]["r27Implemented"] is False
html = (root / "runtime/index.html").read_text(encoding="utf-8")
assert "R26" in html and "Observation" in html

for path in root.rglob("*"):
    if path.is_dir() and path.name in {".git", "node_modules", "__pycache__"}:
        raise SystemExit(f"Forbidden directory: {path.relative_to(root)}")

print("PACKAGE_VERIFY_OK")
print("files", sum(1 for path in root.rglob("*") if path.is_file()))
