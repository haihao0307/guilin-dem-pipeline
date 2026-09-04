#!/usr/bin/env bash
set -euo pipefail

ROOT="$GITHUB_WORKSPACE"
RETUNE="$ROOT/workbenches/landscape-mother-v015p2/retune_v015_p2.py"
BASE_A="$RUNNER_TEMP/landscape-mother-v015p2-base-a"
BASE_B="$RUNNER_TEMP/landscape-mother-v015p2-base-b"
OUT_A="$RUNNER_TEMP/landscape-mother-v015p2"
OUT_B="$RUNNER_TEMP/landscape-mother-v015p2-repeat"
SITE="$RUNNER_TEMP/landscape-mother-v015p2-site"
BROWSER_QA="$RUNNER_TEMP/browser_qa_v015p2.py"
SOURCE_URL="https://haihao0307.github.io/guilin-dem-pipeline/landscape-mother-v015-progress"
PUBLIC_DIR="landscape-mother-v015-p2"
PUBLIC_URL="https://haihao0307.github.io/guilin-dem-pipeline/$PUBLIC_DIR"

export OUT_A OUT_B PUBLIC_URL

printf '\n[V015 P2] fetch verified P1 runtime\n'
mkdir -p "$BASE_A" "$BASE_B" "$OUT_A" "$OUT_B"
FILES=(index.html styles.css app.js scene.bin SCENE_META.json SOURCE_RECEIPT.json README.md SCALE_VERTICALITY_KNOWLEDGE_R015.md ONLINE_RELEASE.json PROGRESS_NOTES.md)
for file in "${FILES[@]}"; do
  curl -fsSL --retry 6 --retry-all-errors --connect-timeout 20 \
    "$SOURCE_URL/$file?source=v015p2-${GITHUB_RUN_ID}" -o "$BASE_A/$file"
done
python - <<'PY'
import hashlib,json,os
from pathlib import Path
root=Path(os.environ['RUNNER_TEMP'])/'landscape-mother-v015p2-base-a'
release=json.loads((root/'ONLINE_RELEASE.json').read_text())
if not release.get('shareAllowed'):
    raise SystemExit('P1 source release is not shareable')
for name,expected in release['files'].items():
    path=root/name
    if not path.is_file():
        continue
    actual=hashlib.sha256(path.read_bytes()).hexdigest()
    if actual!=expected:
        raise SystemExit(f'{name}: expected {expected}, got {actual}')
print('verified source release',release['release'])
PY
cp -a "$BASE_A/." "$BASE_B/"
cp -a "$BASE_A/." "$OUT_A/"
cp -a "$BASE_B/." "$OUT_B/"

printf '\n[V015 P2] deterministic retune x2\n'
python "$RETUNE" "$OUT_A"
python "$RETUNE" "$OUT_B"
cmp "$OUT_A/scene.bin" "$OUT_B/scene.bin"
cmp "$OUT_A/SCENE_META.json" "$OUT_B/SCENE_META.json"
cmp "$OUT_A/app.js" "$OUT_B/app.js"
cmp "$OUT_A/index.html" "$OUT_B/index.html"
node --check "$OUT_A/app.js"
python -m py_compile "$RETUNE"
python - <<'PY'
import json,os
from pathlib import Path
root=Path(os.environ['OUT_A'])
meta=json.loads((root/'SCENE_META.json').read_text())
scene=meta['scene']
assert meta['version']=='V015P2'
assert scene['towerCount']==18
assert scene['renderRelativeHeightRangeM'][0]>=60
assert scene['renderRelativeHeightRangeM'][1]<=200
assert scene['areaWeightedMeanSlopeDeg']>=60
assert scene['areaWeightedP90SlopeDeg']>=87
assert scene['areaRatioSlope87Plus']>=0.20
assert meta['approvals']=={'visualApproved':False,'visualAcceptance':False,'productionReady':False}
assert (root/'scene.bin').stat().st_size==scene['binaryBytes']
print(json.dumps({
 'heightRangeM':scene['renderRelativeHeightRangeM'],
 'towerMeanSlopeDeg':scene['areaWeightedMeanSlopeDeg'],
 'towerP90SlopeDeg':scene['areaWeightedP90SlopeDeg'],
 'towerSlope87Plus':scene['areaRatioSlope87Plus'],
},ensure_ascii=False,indent=2))
PY

printf '\n[V015 P2] prepare P2 browser QA\n'
cp "$ROOT/workbenches/landscape-mother-v015/browser_qa_v015.py" "$BROWSER_QA"
sed -i "s/V015P1/V015P2/g; s/v015-progress-browser-qa\/1/v015-p2-browser-qa\/1/g" "$BROWSER_QA"
python -m py_compile "$BROWSER_QA"

printf '\n[V015 P2] local mobile and desktop WebGL QA\n'
python -m http.server 4176 --directory "$OUT_A" >"$RUNNER_TEMP/v015p2-http.log" 2>&1 &
SERVER_PID=$!
cleanup_server(){ kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup_server EXIT
LANDSCAPE_OUT="$OUT_A" LANDSCAPE_URL="http://127.0.0.1:4176/?scene=fenglin&v=v015p2" python "$BROWSER_QA"
cleanup_server
trap - EXIT
cp "$OUT_A/BROWSER_QA.json" "$OUT_A/LOCAL_BROWSER_QA.json"

printf '\n[V015 P2] prepare release receipt\n'
python - <<'PY'
import hashlib,json,os
from pathlib import Path
root=Path(os.environ['OUT_A'])
meta=json.loads((root/'SCENE_META.json').read_text())
qa=json.loads((root/'BROWSER_QA.json').read_text())
files=['index.html','styles.css','app.js','scene.bin','SCENE_META.json','SOURCE_RECEIPT.json','PROGRESS_NOTES.md','BROWSER_QA.json']
receipt={
 'schema':'landscape-mother-v015-p2-release/1',
 'release':'guilin-putao-fenglin-v015-p2-20260904-r1',
 'sourceCommit':os.environ['GITHUB_SHA'],
 'sourceRuntime':'guilin-putao-fenglin-v015-progress-20260904-p1',
 'publicUrl':os.environ['PUBLIC_URL']+'/?scene=fenglin&v=guilin-putao-fenglin-v015-p2-20260904-r1',
 'files':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files},
 'sourceSpacingM':meta['source']['nativeSpacingM'][0],
 'cropSizeM':meta['source']['cropSizeM'],
 'towerCount':meta['scene']['towerCount'],
 'heightRangeM':meta['scene']['renderRelativeHeightRangeM'],
 'towerMeanSlopeDeg':meta['scene']['areaWeightedMeanSlopeDeg'],
 'towerP90SlopeDeg':meta['scene']['areaWeightedP90SlopeDeg'],
 'towerSlope87PlusRatio':meta['scene']['areaRatioSlope87Plus'],
 'localMobileBrowserPassed':qa['profiles'][0]['passed'],
 'localDesktopBrowserPassed':qa['profiles'][1]['passed'],
 'publicBrowserPassed':False,
 'shareAllowed':False,
 'realIPhoneVerified':False,
 'visualApproved':False,
 'visualAcceptance':False,
 'productionReady':False,
}
(root/'ONLINE_RELEASE.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
PY

printf '\n[V015 P2] scoped gh-pages publication\n'
git fetch origin gh-pages
git worktree add "$SITE" origin/gh-pages
cd "$SITE"
rm -rf "$PUBLIC_DIR"
mkdir -p "$PUBLIC_DIR"
for file in index.html styles.css app.js scene.bin SCENE_META.json SOURCE_RECEIPT.json PROGRESS_NOTES.md BROWSER_QA.json ONLINE_RELEASE.json README.md SCALE_VERTICALITY_KNOWLEDGE_R015.md; do
  cp "$OUT_A/$file" "$PUBLIC_DIR/$file"
done
git config user.name github-actions[bot]
git config user.email 41898282+github-actions[bot]@users.noreply.github.com
git add "$PUBLIC_DIR"
git commit -m "feat(landscape-mother): publish Guilin Putao V015 P2 progress"
if ! git push origin HEAD:gh-pages; then
  git fetch origin gh-pages
  git rebase origin/gh-pages
  git push origin HEAD:gh-pages
fi
cd "$ROOT"

printf '\n[V015 P2] verify public HTTPS bytes\n'
EXPECTED_SCENE="$(sha256sum "$OUT_A/scene.bin" | awk '{print $1}')"
EXPECTED_JS="$(sha256sum "$OUT_A/app.js" | awk '{print $1}')"
ok=0
for attempt in $(seq 1 48); do
  cache="${GITHUB_RUN_ID}-${attempt}"
  if curl -fsSL "$PUBLIC_URL/scene.bin?cb=$cache" -o "$RUNNER_TEMP/public-v015p2-scene.bin" \
    && curl -fsSL "$PUBLIC_URL/app.js?cb=$cache" -o "$RUNNER_TEMP/public-v015p2-app.js" \
    && [ "$(sha256sum "$RUNNER_TEMP/public-v015p2-scene.bin" | awk '{print $1}')" = "$EXPECTED_SCENE" ] \
    && [ "$(sha256sum "$RUNNER_TEMP/public-v015p2-app.js" | awk '{print $1}')" = "$EXPECTED_JS" ]; then
      ok=1
      break
  fi
  sleep 10
done
test "$ok" = 1

printf '\n[V015 P2] public mobile and desktop WebGL QA\n'
LANDSCAPE_OUT="$OUT_A" LANDSCAPE_URL="$PUBLIC_URL/?scene=fenglin&v=public-${GITHUB_RUN_ID}" python "$BROWSER_QA"
mv "$OUT_A/BROWSER_QA.json" "$OUT_A/PUBLIC_BROWSER_QA.json"
cp "$OUT_A/LOCAL_BROWSER_QA.json" "$OUT_A/BROWSER_QA.json"

python - <<'PY'
import hashlib,json,os
from pathlib import Path
root=Path(os.environ['OUT_A'])
receipt=json.loads((root/'ONLINE_RELEASE.json').read_text())
public=json.loads((root/'PUBLIC_BROWSER_QA.json').read_text())
receipt['publicBrowserPassed']=public['passed']
receipt['shareAllowed']=bool(public['passed'])
receipt['publicBrowserQaSha256']=hashlib.sha256((root/'PUBLIC_BROWSER_QA.json').read_bytes()).hexdigest()
(root/'ONLINE_RELEASE.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
if not receipt['shareAllowed']:
    raise SystemExit('public browser QA did not pass')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
PY

printf '\n[V015 P2] publish final receipt and public QA\n'
cd "$SITE"
git fetch origin gh-pages
git rebase origin/gh-pages
cp "$OUT_A/ONLINE_RELEASE.json" "$PUBLIC_DIR/ONLINE_RELEASE.json"
cp "$OUT_A/PUBLIC_BROWSER_QA.json" "$PUBLIC_DIR/PUBLIC_BROWSER_QA.json"
git add "$PUBLIC_DIR/ONLINE_RELEASE.json" "$PUBLIC_DIR/PUBLIC_BROWSER_QA.json"
git commit -m "test(landscape-mother): record V015 P2 public browser proof"
if ! git push origin HEAD:gh-pages; then
  git fetch origin gh-pages
  git rebase origin/gh-pages
  git push origin HEAD:gh-pages
fi
cd "$ROOT"

python - <<'PY' >> "$GITHUB_STEP_SUMMARY"
import json,os
from pathlib import Path
root=Path(os.environ['OUT_A'])
meta=json.loads((root/'SCENE_META.json').read_text())
release=json.loads((root/'ONLINE_RELEASE.json').read_text())
print('## Landscape Mother Guilin Putao V015 P2')
print(f"Public URL: {release['publicUrl']}")
print(f"Towers: {meta['scene']['towerCount']}")
print(f"Height range: {meta['scene']['renderRelativeHeightRangeM'][0]:.1f} to {meta['scene']['renderRelativeHeightRangeM'][1]:.1f} m")
print(f"Tower mean slope: {meta['scene']['areaWeightedMeanSlopeDeg']:.2f} deg")
print(f"Tower P90 slope: {meta['scene']['areaWeightedP90SlopeDeg']:.2f} deg")
print(f"Tower area >=87 deg: {meta['scene']['areaRatioSlope87Plus']*100:.2f}%")
print(f"Share allowed: {release['shareAllowed']}")
print('visualApproved=false; visualAcceptance=false; productionReady=false')
PY
