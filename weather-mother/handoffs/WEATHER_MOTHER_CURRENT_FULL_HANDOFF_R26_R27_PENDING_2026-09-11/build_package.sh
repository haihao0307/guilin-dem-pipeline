#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="WEATHER_MOTHER_CURRENT_FULL_HANDOFF_R26_R27_PENDING_2026-09-11"
HANDOFF_DIR="weather-mother/handoffs/WEATHER_MOTHER_CURRENT_FULL_HANDOFF_R26_R27_PENDING_2026-09-11"
ZIP_PATH="weather-mother/handoffs/${PACKAGE_NAME}.zip"
STAGE="/tmp/${PACKAGE_NAME}"

rm -rf "$STAGE"
rm -f "$ZIP_PATH"
mkdir -p "$STAGE"/{runtime,source,reference/r21,reference/r22,workflows,evidence,docs}

cp "$HANDOFF_DIR"/00_START_HERE.md "$STAGE"/
cp "$HANDOFF_DIR"/01_CURRENT_STATE.md "$STAGE"/
cp "$HANDOFF_DIR"/02_SOURCE_LOCKS.json "$STAGE"/
cp "$HANDOFF_DIR"/03_ARCHITECTURE_DECISIONS.md "$STAGE"/
cp "$HANDOFF_DIR"/04_KNOWN_ISSUES_AND_FAILURES.md "$STAGE"/
cp "$HANDOFF_DIR"/05_NEXT_R27_PLAN.md "$STAGE"/
cp "$HANDOFF_DIR"/06_ACCEPTANCE_GATES.md "$STAGE"/
cp "$HANDOFF_DIR"/07_PACKAGE_SCOPE.md "$STAGE"/
cp "$HANDOFF_DIR"/08_PACKAGE_CHECKLIST.json "$STAGE"/
cp "$HANDOFF_DIR"/CURRENT.json "$STAGE"/
cp "$HANDOFF_DIR"/verify_package.py "$STAGE"/
cp "$HANDOFF_DIR"/build_package.sh "$STAGE"/

cp weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html "$STAGE/runtime/index.html"
cp weather-mother/full-weather-r26-observation-bandwidth-20260911/PUBLIC_QA_MOBILE_OBSERVATION_BANDWIDTH_2026-09-11.json "$STAGE/evidence/" 2>/dev/null || true
cp weather-mother/full-weather-r26-observation-bandwidth-20260911/PUBLIC_R26_MOBILE_OBSERVATION_BANDWIDTH_390x844.png "$STAGE/evidence/" 2>/dev/null || true

cp -a weather-mother/r23-mobile-recovery-src "$STAGE/source/"
cp -a weather-mother/r24-mobile-aircraft-directpass-src "$STAGE/source/"
cp -a weather-mother/r25-mobile-cloud-occlusion-src "$STAGE/source/"
cp -a weather-mother/r26-observation-bandwidth-src "$STAGE/source/"

mkdir -p "$STAGE/source/yohei-cloud-atlas-r02"
cp weather-mother/deliveries/weather-mother-yohei-cloud-atlas-r02.html "$STAGE/source/yohei-cloud-atlas-r02/"
cp weather-mother/deliveries/weather-mother-yohei-cloud-atlas-r02-qa.json "$STAGE/source/yohei-cloud-atlas-r02/"
cp weather-mother/deliveries/WEATHER_MOTHER_YOHEI_CLOUD_ATLAS_R02_README.md "$STAGE/source/yohei-cloud-atlas-r02/"

cp weather-mother/aircraft-r21-20260908/index.html "$STAGE/reference/r21/index.html"
cp weather-mother/aircraft-r21-20260908/CHANGES.md "$STAGE/reference/r21/" 2>/dev/null || true
cp weather-mother/full-weather-r22-20260909/index.html "$STAGE/reference/r22/index.html"
cp weather-mother/full-weather-r22-20260909/CHANGES.md "$STAGE/reference/r22/" 2>/dev/null || true

cp .github/workflows/build-verify-weather-r23-mobile-cloud-first-v2.yml "$STAGE/workflows/" 2>/dev/null || true
cp .github/workflows/build-verify-weather-r24-mobile-aircraft-directpass.yml "$STAGE/workflows/"
cp .github/workflows/build-verify-weather-r25-mobile-cloud-occlusion.yml "$STAGE/workflows/"
cp .github/workflows/build-verify-weather-r26-observation-bandwidth.yml "$STAGE/workflows/"

cp weather-mother/research/FLIGHT_BETWEEN_CLOUDS_R03_CONTRACT.md "$STAGE/docs/" 2>/dev/null || true

python3 "$STAGE/verify_package.py"

python3 - "$STAGE" <<'PY'
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
records = []
for path in sorted(p for p in root.rglob("*") if p.is_file()):
    rel = path.relative_to(root).as_posix()
    data = path.read_bytes()
    records.append({{"hath": rel,"bytes": len(data),"sha256": hashlib.sha256(data).hexdigest()}})

manifest = {{
    "schema": "weather-mother-full-handoff-manifest/1",
    "package": root.name,
    "status": "in-progress",
    "currentVersion": "R26 Observation Bandwidth",
    "r27Implemented": False,
    "productionReady": False,
    "sourceHead": "df296367d842e91279a42fc2616b7e0e441ca141",
    "pageCommit": "26c1b48fc48172ba64fe2d867f4f59a6584ccb33",
    "fileCountBeforeManifest": len(records),
    "files": records,
}}
Q0L@