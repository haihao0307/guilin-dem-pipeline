#!/usr/bin/env bash
set -euo pipefail

CANONICAL_BRANCH="project/guilin-native-12p5m-single-truth"
CANONICAL_TAG="guilin-native-12p5m-single-truth-v001"
RAW_NAME="guilin_raw_union_12_5m.tif"
RAW_SHA256="9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
PUBLIC_URL="https://haihao0307.github.io/guilin-dem-pipeline/guilin"
CACHE_DIR="out/cache";TILE_DIR="out/native-tiles";CLEAN_ROOT="out/clean-root";SITE_DIR="out/canonical-site";EVIDENCE_DIR="out/evidence";PAGES_DIR="out/gh-pages"
rm -rf out;mkdir -p "$CACHE_DIR" "$TILE_DIR" "$EVIDENCE_DIR"
gh release download "$CANONICAL_TAG" --pattern "$RAW_NAME" --dir "$CACHE_DIR"
gh release download "$CANONICAL_TAG" --pattern 'native-r*-2048x2048-i16.bin' --dir "$TILE_DIR"
test "$(stat -c '%s' "$CACHE_DIR/$RAW_NAME")" = "124348471"
echo "$RAW_SHA256  $CACHE_DIR/$RAW_NAME" | sha256sum -c -
test "$(find "$TILE_DIR" -maxdepth 1 -name 'native-r*-2048x2048-i16.bin' | wc -l)" = "54"
WORKFLOW_SOURCE="$(find .github/workflows -maxdepth 1 -type f -name 'guilin-single-truth*.yml' | sort | head -1)"
python pipeline/generate_canonical.py --source-tiff "$CACHE_DIR/$RAW_NAME" --tile-dir "$TILE_DIR" --hydrology truth/OSM_HYDROLOGY_IMMUTABLE.geojson --clean-root "$CLEAN_ROOT" --viewer-source viewer --workflow-source "$WORKFLOW_SOURCE" --evidence "$EVIDENCE_DIR"
node --check "$CLEAN_ROOT/viewer/app.js"
! grep -Eqi 'createTexture|texImage2D|texSubImage2D|sampler2D|sampler2DArray' "$CLEAN_ROOT/viewer/app.js"
mkdir -p "$SITE_DIR/data" "$SITE_DIR/contracts" "$SITE_DIR/knowledge"
cp "$CLEAN_ROOT/viewer/index.html" "$CLEAN_ROOT/viewer/styles.css" "$CLEAN_ROOT/viewer/app.js" "$SITE_DIR/"
cp "$CLEAN_ROOT/truth/NATIVE_ELEVATION_MANIFEST.json" "$SITE_DIR/data/"
cp "$TILE_DIR"/native-r*-2048x2048-i16.bin "$SITE_DIR/data/"
cp "$CLEAN_ROOT"/contracts/*.json "$SITE_DIR/contracts/";cp "$CLEAN_ROOT"/knowledge/*.json "$SITE_DIR/knowledge/";touch "$SITE_DIR/.nojekyll"
export GITHUB_SHA GITHUB_RUN_ID
python - <<'PY'
import json,os
from pathlib import Path
p={'schema':'guilin-single-truth-online-version/v1','head':os.environ['GITHUB_SHA'],'run_id':int(os.environ['GITHUB_RUN_ID']),'source_sha256':'9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4','native_spacing_m':12.5,'tile_count':54,'tile_compression':'none','direct_numeric_vertex_geometry':True,'height_image_texture_used':False}
Path('out/canonical-site/version.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
PY
CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
python -m http.server 8765 --bind 127.0.0.1 --directory "$SITE_DIR" > "$EVIDENCE_DIR/local-http.log" 2>&1 & SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
for attempt in $(seq 1 80);do curl --fail --silent http://127.0.0.1:8765/ >/dev/null&&break;sleep .25;done
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage --ignore-gpu-blocklist --enable-webgl --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=45000 --dump-dom http://127.0.0.1:8765/ > "$EVIDENCE_DIR/local-dom.html"
grep -q 'data-ready="true"' "$EVIDENCE_DIR/local-dom.html";grep -q 'data-texture-count="0"' "$EVIDENCE_DIR/local-dom.html";rm -f "$EVIDENCE_DIR/local-dom.html";kill "$SERVER_PID" 2>/dev/null||true;trap - EXIT
rm -rf "$PAGES_DIR";git clone --depth 1 --branch gh-pages "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "$PAGES_DIR"
rm -rf "$PAGES_DIR/guilin";cp -a "$SITE_DIR" "$PAGES_DIR/guilin";touch "$PAGES_DIR/.nojekyll"
(cd "$PAGES_DIR";git config user.name "Haihao_Nature Grace HK";git config user.email "haihao0307@gmail.com";git add -A;if ! git diff --cached --quiet;then git commit -m "deploy(guilin): refresh sole native numeric DEM";git push origin gh-pages;fi)
for attempt in $(seq 1 150);do if curl --fail --silent "$PUBLIC_URL/version.json?run=$GITHUB_RUN_ID" > "$EVIDENCE_DIR/public-version.json"&&grep -q "$GITHUB_RUN_ID" "$EVIDENCE_DIR/public-version.json";then break;fi;sleep 5;done
grep -q "$GITHUB_RUN_ID" "$EVIDENCE_DIR/public-version.json"
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage --ignore-gpu-blocklist --enable-webgl --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=60000 --dump-dom "$PUBLIC_URL/?run=$GITHUB_RUN_ID" > "$EVIDENCE_DIR/public-dom.html"
grep -q 'data-ready="true"' "$EVIDENCE_DIR/public-dom.html";grep -q 'data-texture-count="0"' "$EVIDENCE_DIR/public-dom.html";rm -f "$EVIDENCE_DIR/public-dom.html"
git checkout --orphan guilin-single-truth-refresh;git rm -rf .;cp -a "$CLEAN_ROOT"/. .;git add -A;git config user.name "Haihao_Nature Grace HK";git config user.email "haihao0307@gmail.com";git commit -m "canonical(guilin): refresh sole native truth [skip ci]";ROOT_SHA="$(git rev-parse HEAD)";git push origin "HEAD:${CANONICAL_BRANCH}" --force;git push origin HEAD:main --force;git tag -f "$CANONICAL_TAG" "$ROOT_SHA";git push origin "+refs/tags/${CANONICAL_TAG}:refs/tags/${CANONICAL_TAG}";gh release edit "$CANONICAL_TAG" --target "$ROOT_SHA"
