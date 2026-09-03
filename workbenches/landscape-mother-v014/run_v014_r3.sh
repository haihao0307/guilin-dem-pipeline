#!/usr/bin/env bash
set -euo pipefail

ROOT="$GITHUB_WORKSPACE"
PAYLOAD_ROOT="$ROOT/workbenches/landscape-mother-v014/payload"
PATCH="$ROOT/workbenches/landscape-mother-v014/patch_strict_scale_r3.py"
SRC="$RUNNER_TEMP/landscape-mother-v014-src"
OUT_A="$RUNNER_TEMP/landscape-mother-v014"
OUT_B="$RUNNER_TEMP/landscape-mother-v014-repeat"
CHUNKS="$RUNNER_TEMP/putao-chunks"
SHARDS="$RUNNER_TEMP/putao-shards"
RELEASE_ROOT="https://github.com/haihao0307/guilin-dem-pipeline/releases/download/guilin-canonical-elevation-store-12p5m-v1"

export SRC OUT_A OUT_B CHUNKS SHARDS

printf '\n[V014 R3] materialize source\n'
mkdir -p "$SRC" "$OUT_A" "$OUT_B" "$CHUNKS" "$SHARDS"
cat "$PAYLOAD_ROOT"/source.*.b64 | base64 -d > "$RUNNER_TEMP/landscape-mother-v014-source.tar.gz"
echo "efeec1f7ff2ece2fbabffa016e6849e9a145d6e3787c343a1ac044999ca95a74  $RUNNER_TEMP/landscape-mother-v014-source.tar.gz" | sha256sum -c -
tar -xzf "$RUNNER_TEMP/landscape-mother-v014-source.tar.gz" -C "$SRC"
python "$PATCH" "$SRC"
python -m py_compile "$SRC/build_putao.py" "$SRC/browser_qa.py" "$SRC/verify_v014.py"
node --check "$SRC/runtime/app.js"

printf '\n[V014 R3] download canonical 12.5 m shards\n'
curl -L --fail --retry 6 --retry-all-errors --connect-timeout 20 \
  "$RELEASE_ROOT/elevation-shard-004.i16pack" \
  -o "$SHARDS/elevation-shard-004.i16pack"
curl -L --fail --retry 6 --retry-all-errors --connect-timeout 20 \
  "$RELEASE_ROOT/elevation-shard-005.i16pack" \
  -o "$SHARDS/elevation-shard-005.i16pack"
cat > "$SHARDS/SHA256SUMS" <<'SUMS'
ea174388ecd3a3999ebf13daca69901664f83ba43a4e504351005721e5a2b2a8  elevation-shard-004.i16pack
685f47bedee1d2f9f15a687ed564fb06cd06d621261eecf42698639b346d14ec  elevation-shard-005.i16pack
SUMS
(cd "$SHARDS" && sha256sum -c SHA256SUMS)

python - <<'PY'
import hashlib, os
from pathlib import Path
shards=Path(os.environ['SHARDS'])
chunks=Path(os.environ['CHUNKS'])
entries=[
 ('elevation-shard-004.i16pack',56634368,'r026-c008.i16','8619dde4b9d1752e77d87ebd129b057bea31d4ef750c8dc5fc952024485ba889'),
 ('elevation-shard-004.i16pack',57158656,'r026-c009.i16','259d37d9e5cbc40648593a9a88e6dd27e5a6d0a8c80fc351c9f9a6b71b074f83'),
 ('elevation-shard-005.i16pack',2097152,'r027-c008.i16','a409fedc4e6bd2a2f9fe149b578549c5ad23ed55a581cccfdca92f1c0b83ba63'),
 ('elevation-shard-005.i16pack',2621440,'r027-c009.i16','67f388f87a0dbbe1da07707a33bf26e6b7023a529ee8b90ed1e25a7275d7415f'),
]
cache={}
for shard,offset,name,expected in entries:
    data=cache.setdefault(shard,(shards/shard).read_bytes())
    out=data[offset:offset+524288]
    if len(out)!=524288:
        raise RuntimeError(f'{name}: short extraction')
    digest=hashlib.sha256(out).hexdigest()
    if digest!=expected:
        raise RuntimeError(f'{name}: {digest}')
    (chunks/name).write_bytes(out)
    print(name,digest)
PY

printf '\n[V014 R3] deterministic build x2\n'
PUTAO_CHUNK_DIR="$CHUNKS" LANDSCAPE_OUT="$OUT_A" python "$SRC/build_putao.py"
PUTAO_CHUNK_DIR="$CHUNKS" LANDSCAPE_OUT="$OUT_B" python "$SRC/build_putao.py"
for f in index.html styles.css app.js; do cp "$SRC/runtime/$f" "$OUT_A/$f"; done
cp "$SRC/README.md" "$OUT_A/README.md"
cp "$SRC/SCALE_VERTICALITY_KNOWLEDGE_R015.md" "$OUT_A/SCALE_VERTICALITY_KNOWLEDGE_R015.md"
cmp "$OUT_A/scene.bin" "$OUT_B/scene.bin"
cmp "$OUT_A/SCENE_META.json" "$OUT_B/SCENE_META.json"
node --check "$OUT_A/app.js"
LANDSCAPE_OUT="$OUT_A" python "$SRC/verify_v014.py"

printf '\n[V014 R3] local mobile and desktop WebGL QA\n'
python -m http.server 4173 --directory "$OUT_A" >"$RUNNER_TEMP/v014-http.log" 2>&1 &
SERVER_PID=$!
cleanup_server(){ kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup_server EXIT
LANDSCAPE_OUT="$OUT_A" LANDSCAPE_URL="http://127.0.0.1:4173/?scene=fenglin" python "$SRC/browser_qa.py"
cleanup_server
trap - EXIT

printf '\n[V014 R3] release receipt\n'
python - <<'PY'
import hashlib,json,os
from pathlib import Path
root=Path(os.environ['OUT_A'])
h=lambda p: hashlib.sha256((root/p).read_bytes()).hexdigest()
meta=json.loads((root/'SCENE_META.json').read_text())
browser=json.loads((root/'BROWSER_QA.json').read_text())
release={
 'schema':'landscape-mother-v014-online-release/1',
 'release':'guilin-putao-fenglin-v014-20260903-r3',
 'sourceCommit':os.environ['GITHUB_SHA'],
 'directQuery':'scene=fenglin',
 'files':{p:h(p) for p in ['index.html','styles.css','app.js','scene.bin','SCENE_META.json','SOURCE_RECEIPT.json','STATIC_QA.json','BROWSER_QA.json']},
 'sourceSpacingM':12.5,
 'cropSizeM':meta['source']['cropSizeM'],
 'towerCount':meta['scene']['towerCount'],
 'heightRangeM':meta['scene']['sourceRelativeHeightRangeM'],
 'meanSlopeDeg':meta['scene']['areaWeightedMeanSlopeDeg'],
 'meanSlope45PlusDeg':meta['scene']['areaWeightedMeanSlope45PlusDeg'],
 'slope87PlusRatio':meta['scene']['areaRatioSlope87Plus'],
 'mobileBrowserPassed':browser['profiles'][0]['passed'],
 'desktopBrowserPassed':browser['profiles'][1]['passed'],
 'realIPhoneVerified':False,
 'visualApproved':False,
 'visualAcceptance':False,
 'productionReady':False,
}
(root/'ONLINE_RELEASE.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(release,ensure_ascii=False,indent=2))
PY

printf '\n[V014 R3] scoped gh-pages publication\n'
git fetch origin gh-pages
git worktree add "$RUNNER_TEMP/site" origin/gh-pages
cd "$RUNNER_TEMP/site"
rm -rf landscape-mother-v014
mkdir -p landscape-mother-v014 landscape-mother
for f in index.html styles.css app.js scene.bin SCENE_META.json SOURCE_RECEIPT.json STATIC_QA.json BROWSER_QA.json ONLINE_RELEASE.json README.md SCALE_VERTICALITY_KNOWLEDGE_R015.md; do
  cp "$OUT_A/$f" "landscape-mother-v014/$f"
done
cat > landscape-mother/index.html <<'HTML'
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="refresh" content="0;url=../landscape-mother-v014/?scene=fenglin&v=guilin-putao-fenglin-v014-20260903-r3"><title>Landscape Mother</title><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#6ea7c5;color:#fff;font:14px system-ui}</style></head><body>正在打开桂林葡萄峰林三维工作台<script>location.replace('../landscape-mother-v014/?scene=fenglin&v=guilin-putao-fenglin-v014-20260903-r3')</script></body></html>
HTML
git config user.name github-actions[bot]
git config user.email 41898282+github-actions[bot]@users.noreply.github.com
git add landscape-mother-v014 landscape-mother/index.html
git commit -m "feat(landscape-mother): publish strict-scale Guilin Putao fenglin V014 R3"
if ! git push origin HEAD:gh-pages; then
  git fetch origin gh-pages
  git rebase origin/gh-pages
  git push origin HEAD:gh-pages
fi
cd "$ROOT"

printf '\n[V014 R3] verify public HTTPS bytes and browser\n'
BASE="https://haihao0307.github.io/guilin-dem-pipeline/landscape-mother-v014"
EXPECTED_SCENE="$(sha256sum "$OUT_A/scene.bin" | awk '{print $1}')"
EXPECTED_JS="$(sha256sum "$OUT_A/app.js" | awk '{print $1}')"
ok=0
for attempt in $(seq 1 42); do
  cb="${GITHUB_RUN_ID}-${attempt}"
  if curl -fsSL "$BASE/scene.bin?cb=$cb" -o "$RUNNER_TEMP/public-scene.bin" \
    && curl -fsSL "$BASE/app.js?cb=$cb" -o "$RUNNER_TEMP/public-app.js" \
    && [ "$(sha256sum "$RUNNER_TEMP/public-scene.bin" | awk '{print $1}')" = "$EXPECTED_SCENE" ] \
    && [ "$(sha256sum "$RUNNER_TEMP/public-app.js" | awk '{print $1}')" = "$EXPECTED_JS" ] \
    && curl -fsSL "https://haihao0307.github.io/guilin-dem-pipeline/landscape-mother/?cb=$cb" | grep -q 'landscape-mother-v014'; then
      ok=1
      break
  fi
  sleep 10
done
test "$ok" = 1
cp "$OUT_A/BROWSER_QA.json" "$OUT_A/LOCAL_BROWSER_QA.json"
LANDSCAPE_OUT="$OUT_A" LANDSCAPE_URL="$BASE/?scene=fenglin&public=${GITHUB_RUN_ID}" python "$SRC/browser_qa.py"
mv "$OUT_A/BROWSER_QA.json" "$OUT_A/PUBLIC_BROWSER_QA.json"
cp "$OUT_A/LOCAL_BROWSER_QA.json" "$OUT_A/BROWSER_QA.json"

python - <<'PY' >> "$GITHUB_STEP_SUMMARY"
import json,os
from pathlib import Path
root=Path(os.environ['OUT_A'])
m=json.loads((root/'SCENE_META.json').read_text())
q=json.loads((root/'PUBLIC_BROWSER_QA.json').read_text())
print('## Landscape Mother Guilin Putao Fenglin V014 R3')
print(f"Canonical source spacing: {m['source']['nativeSpacingM'][0]} m")
print(f"Domain: {m['source']['cropSizeM'][0]:.0f} x {m['source']['cropSizeM'][1]:.0f} m")
print(f"Towers: {m['scene']['towerCount']}")
print(f"Source relative height: {m['scene']['sourceRelativeHeightRangeM'][0]:.1f} to {m['scene']['sourceRelativeHeightRangeM'][1]:.1f} m")
print(f"Mean exposed slope: {m['scene']['areaWeightedMeanSlopeDeg']:.2f} deg")
print(f"Mean 45+ slope: {m['scene']['areaWeightedMeanSlope45PlusDeg']:.2f} deg")
print(f"Area >=87 deg: {m['scene']['areaRatioSlope87Plus']*100:.2f}%")
print(f"Public mobile browser passed: {q['profiles'][0]['passed']}")
print(f"Public desktop browser passed: {q['profiles'][1]['passed']}")
print('visualApproved=false; visualAcceptance=false; productionReady=false')
PY
