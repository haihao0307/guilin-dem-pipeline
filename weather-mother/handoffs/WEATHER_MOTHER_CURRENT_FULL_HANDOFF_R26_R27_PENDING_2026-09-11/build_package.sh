#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="WEATHER_MOTHER_CURRENT_FULL_HANDOFF_R26_R27_PENDING_2026-09-11"
HANDOFF_DIR="weather-mother/handoffs/${PACKAGE_NAME}"
ZIP_PATH="weather-mother/handoffs/${PACKAGE_NAME}.zip"
STAGE="/tmp/${PACKAGE_NAME}"

rm -rf "$STAGE"
rm -f "$ZIP_PATH"
mkdir -p "$STAGE"/{runtime,source,reference/r21,reference/r22,workflows,evidence,docs}

for file in \
  00_START_HERE.md \
  01_CURRENT_STATE.md \
  02_SOURCE_LOCKS.json \
  03_ARCHITECTURE_DECISIONS.md \
  04_KNOWN_ISSUES_AND_FAILURES.md \
  05_NEXT_R27_PLAN.md \
  06_ACCEPTANCE_GATES.md \
  07_PACKAGE_SCOPE.md \
  08_PACKAGE_CHECKLIST.json \
  CURRENT.json \
  verify_package.py \
  build_package.sh
do
  cp "$HANDOFF_DIR/$file" "$STAGE/$file"
done

cp weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html "$STAGE/runtime/index.html"
cp weather-mother/full-weather-r26-observation-bandwidth-20260911/PUBLIC_QA_MOBILE_OBSERVATION_BANDWIDTH_2026-09-11.json "$STAGE/evidence/" 2>/dev/null || true
cp weather-mother/full-weather-r26-observation-bandwidth-20260911/PUBLIC_R26_MOBILE_OBSERVATION_BANDWIDTH_390x844.png "$STAGE/evidence/" 2>/dev/null || true

for dir in \
  r23-mobile-recovery-src \
  r24-mobile-aircraft-directpass-src \
  r25-mobile-cloud-occlusion-src \
  r26-observation-bandwidth-src
do
  cp -a "weather-mother/$dir" "$STAGE/source/"
done

mkdir -p "$STAGE/source/yohei-cloud-atlas-r02"
cp weather-mother/deliveries/weather-mother-yohei-cloud-atlas-r02.html "$STAGE/source/yohei-cloud-atlas-r02/"
cp weather-mother/deliveries/weather-mother-yohei-cloud-atlas-r02-qa.json "$STAGE/source/yohei-cloud-atlas-r02/"
cp weather-mother/deliveries/WEATHER_MOTHER_YOHEI_CLOUD_ATLAS_R02_README.md "$STAGE/source/yohei-cloud-atlas-r02/"

cp weather-mother/aircraft-r21-20260908/index.html "$STAGE/reference/r21/index.html"
cp weather-mother/aircraft-r21-20260908/CHANGES.md "$STAGE/reference/r21/" 2>/dev/null || true
cp weather-mother/full-weather-r22-20260909/index.html "$STAGE/reference/r22/index.html"
cp weather-mother/full-weather-r22-20260909/CHANGES.md "$STAGE/reference/r22/" 2>/dev/null || true

for workflow in \
  build-verify-weather-r23-mobile-cloud-first-v2.yml \
  build-verify-weather-r24-mobile-aircraft-directpass.yml \
  build-verify-weather-r25-mobile-cloud-occlusion.yml \
  build-verify-weather-r26-observation-bandwidth.yml
do
  if [ -f ".github/workflows/$workflow" ]; then
    cp ".github/workflows/$workflow" "$STAGE/workflows/"
  fi
done

cp weather-mother/research/FLIGHT_BETWEEN_CLOUDS_R03_CONTRACT.md "$STAGE/docs/" 2>/dev/null || true

python3 "$STAGE/verify_package.py"

python3 - "$STAGE" <<'PY'
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
files = []
for path in sorted(p for p in root.rglob("*") if p.is_file()):
    data = path.read_bytes()
    files.append({
        "path": path.relative_to(root).as_posix(),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    })
manifest = {
    "schema": "weather-mother-full-handoff-manifest/1",
    "package": root.name,
    "status": "in-progress",
    "currentVersion": "R26 Observation Bandwidth",
    "r27Implemented": False,
    "productionReady": False,
    "sourceHead": "df296367d842e91279a42fc2616b7e0e441ca141",
    "pageCommit": "26c1b48fc48172ba64fe2d867f4f59a6584ccb33",
    "fileCountBeforeManifest": len(files),
    "files": files,
}
(root / "MANIFEST.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
lines = []
for path in sorted(p for p in root.rglob("*") if p.is_file() and p.name != "SHA256SUMS.txt"):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    lines.append(f"{digest}  {path.relative_to(root).as_posix()}")
(root / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

(
  cd /tmp
  zip -X -9 -q -r "$GITHUB_WORKSPACE/$ZIP_PATH" "$PACKAGE_NAME"
)
unzip -tqq "$ZIP_PATH"

ZIP_SHA="$(sha256sum "$ZIP_PATH" | awk '{print $1}')"
ZIP_BYTES="$(wc -c < "$ZIP_PATH" | tr -d ' ')"
printf '%s  %s\n' "$ZIP_SHA" "$(basename "$ZIP_PATH")" > "$HANDOFF_DIR/PACKAGE_SHA256.txt"

python3 - "$HANDOFF_DIR/PACKAGE_BUILD.json" "$ZIP_SHA" "$ZIP_BYTES" <<'PY'
import json
import pathlib
import sys

out = pathlib.Path(sys.argv[1])
receipt = {
    "schema": "weather-mother-full-handoff-build/1",
    "package": "WEATHER_MOTHER_CURRENT_FULL_HANDOFF_R26_R27_PENDING_2026-09-11.zip",
    "bytes": int(sys.argv[3]),
    "sha256": sys.argv[2],
    "sourceBranch": "feature/weather-mother-r26-observation-bandwidth-20260911",
    "sourceHead": "df296367d842e91279a42fc2616b7e0e441ca141",
    "handoffBranch": "handoff/weather-mother-current-full-r26-r27-pending-20260911",
    "currentVersion": "R26 Observation Bandwidth",
    "pageCommit": "26c1b48fc48172ba64fe2d867f4f59a6584ccb33",
    "verifyPackage": "passed",
    "zipIntegrity": "passed",
    "status": "in-progress",
    "r27Implemented": False,
    "productionReady": False,
}
out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(receipt, ensure_ascii=False, indent=2))
PY
