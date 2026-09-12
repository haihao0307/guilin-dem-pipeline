#!/usr/bin/env bash
set -euo pipefail

PACKAGE="WEATHER_MOTHER_FULL_HANDOFF_R26_STABLE_R27_CANDIDATE_2026-09-12"
HANDOFF="weather-mother/handoffs/$PACKAGE"
ZIP="weather-mother/handoffs/$PACKAGE.zip"
STAGE="/tmp/$PACKAGE"
R26_COMMIT="26c1b48fc48172ba64fe2d867f4f59a6584ccb33"
R27_COMMIT="d2f4ab4ce0b498c9a28e4b386c29109adbaf2283"
YOHEI_COMMIT="029d2e564b65a0874af439232ca8856c42981a14"
R21_COMMIT="d6796df38a2cb872f58ff1f8ce72b5f36d8d2322"
R22_COMMIT="8aeb8dac519f8bda851cfc998e07266870d3eaef"

rm -rf "$STAGE"
rm -f "$ZIP"
mkdir -p "$STAGE"/{stable-r26,candidate-r27,source,reference/r21,reference/r22,workflows,evidence}

for f in 00_START_HERE.md 01_CURRENT_STATE.md 02_SOURCE_LOCKS.json 03_ARCHITECTURE_DECISIONS.md 04_R27_STATUS_AND_FAILURES.md 05_NEXT_STEPS.md 06_ACCEPTANCE_GATES.md CURRENT.json WORKFLOW_STATUS.json verify_package.py build_package.sh; do
  cp "$HANDOFF/$f" "$STAGE/$f"
done

# Immutable runnable pages.
git show "$R26_COMMIT:weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html" > "$STAGE/stable-r26/index.html"
git show "$R27_COMMIT:weather-mother/full-weather-r27-unified-cloud-dna-20260912/index.html" > "$STAGE/candidate-r27/index.html"

# R23–R26 source stages and R27 assembly/QA tools.
for dir in r23-mobile-recovery-src r24-mobile-aircraft-directpass-src r25-mobile-cloud-occlusion-src r26-observation-bandwidth-src r27-text-v1 r27-tools; do
  if [ -d "weather-mother/$dir" ]; then cp -a "weather-mother/$dir" "$STAGE/source/"; fi
done
if [ -d weather-mother/r27-assembly-v3 ]; then cp -a weather-mother/r27-assembly-v3 "$STAGE/source/"; fi

# Fixed ten-cloud source, extracted from its own immutable commit.
mkdir -p "$STAGE/source/yohei-cloud-atlas-r02"
git show "$YOHEI_COMMIT:weather-mother/deliveries/weather-mother-yohei-cloud-atlas-r02.html" > "$STAGE/source/yohei-cloud-atlas-r02/weather-mother-yohei-cloud-atlas-r02.html"
git show "$YOHEI_COMMIT:weather-mother/deliveries/weather-mother-yohei-cloud-atlas-r02-qa.json" > "$STAGE/source/yohei-cloud-atlas-r02/weather-mother-yohei-cloud-atlas-r02-qa.json"
git show "$YOHEI_COMMIT:weather-mother/deliveries/WEATHER_MOTHER_YOHEI_CLOUD_ATLAS_R02_README.md" > "$STAGE/source/yohei-cloud-atlas-r02/WEATHER_MOTHER_YOHEI_CLOUD_ATLAS_R02_README.md"

# Historical accepted baselines.
git show "$R21_COMMIT:weather-mother/aircraft-r21-20260908/index.html" > "$STAGE/reference/r21/index.html"
git show "$R22_COMMIT:weather-mother/full-weather-r22-20260909/index.html" > "$STAGE/reference/r22/index.html"

# Relevant build/QA workflows.
for f in \
  .github/workflows/build-verify-weather-r23-mobile-cloud-first-v2.yml \
  .github/workflows/build-verify-weather-r24-mobile-aircraft-directpass.yml \
  .github/workflows/build-verify-weather-r25-mobile-cloud-occlusion.yml \
  .github/workflows/build-verify-weather-r26-observation-bandwidth.yml \
  .github/workflows/diag-r27-payload-v3.yml \
  .github/workflows/publish-verify-weather-mother-r27-unified-cloud-dna.yml \
  .github/workflows/publish-verify-weather-mother-r27-unified-cloud-dna-v2.yml \
  .github/workflows/publish-verify-weather-mother-r27-unified-cloud-dna-v3.yml \
  .github/workflows/publish-verify-weather-mother-r27-unified-cloud-dna-v4.yml; do
  [ -f "$f" ] && cp "$f" "$STAGE/workflows/"
done

# Existing evidence when present.
git show df296367d842e91279a42fc2616b7e0e441ca141:weather-mother/full-weather-r26-observation-bandwidth-20260911/PUBLIC_QA_MOBILE_OBSERVATION_BANDWIDTH_2026-09-11.json > "$STAGE/evidence/R26_PUBLIC_QA.json" || true
git log --format='%H %cI %s' df296367d842e91279a42fc2616b7e0e441ca141..d2f4ab4ce0b498c9a28e4b386c29109adbaf2283 > "$STAGE/evidence/R27_COMMIT_HISTORY.txt"

python3 "$STAGE/verify_package.py"

python3 - "$STAGE" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
files=[]
for p in sorted(x for x in root.rglob('*') if x.is_file()):
    data=p.read_bytes()
    files.append({'path':p.relative_to(root).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(root/'MANIFEST.json').write_text(json.dumps({
    'schema':'weather-mother-full-handoff-manifest/2',
    'package':root.name,
    'stableVersion':'R26 Observation Bandwidth',
    'candidateVersion':'R27 Unified Cloud Object DNA',
    'candidateBrowserQA':False,
    'productionReady':False,
    'files':files
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=[]
for p in sorted(x for x in root.rglob('*') if x.is_file() and x.name!='SHA256SUMS.txt'):
    lines.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root).as_posix()}")
(root/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
PY

(cd /tmp && zip -X -9 -q -r "$GITHUB_WORKSPACE/$ZIP" "$PACKAGE")
unzip -tqq "$ZIP"
SHA="$(sha256sum "$ZIP" | awk '{print $1}')"
BYTES="$(wc -c < "$ZIP" | tr -d ' ')"
printf '%s  %s\n' "$SHA" "$(basename "$ZIP")" > "$HANDOFF/PACKAGE_SHA256.txt"
python3 - "$HANDOFF/PACKAGE_BUILD.json" "$SHA" "$BYTES" <<'PY'
import json,pathlib,sys
pathlib.Path(sys.argv[1]).write_text(json.dumps({
 'schema':'weather-mother-full-handoff-build/2',
 'package':'WEATHER_MOTHER_FULL_HANDOFF_R26_STABLE_R27_CANDIDATE_2026-09-12.zip',
 'bytes':int(sys.argv[3]),'sha256':sys.argv[2],
 'stablePageCommit':'26c1b48fc48172ba64fe2d867f4f59a6584ccb33',
 'candidatePageCommit':'d2f4ab4ce0b498c9a28e4b386c29109adbaf2283',
 'verifyPackage':'passed','zipIntegrity':'passed',
 'candidateBrowserQA':False,'productionReady':False
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
PY
