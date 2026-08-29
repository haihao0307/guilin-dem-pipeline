from __future__ import annotations

import argparse
import json
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"patch target missing: {label}")
    return text.replace(old, new, 1)


def patch_overview(root: Path) -> None:
    index = root / "overview" / "index.html"
    app = root / "overview" / "app.js"
    html = index.read_text(encoding="utf-8")
    html = html.replace("桂林 V0.7.5", "桂林 V0.7.9 在线")
    html = html.replace("GAEA Proof", "在线全域河网 3D")
    html = html.replace("本地验收", "在线交互")
    html = html.replace("Artifact", "WebGL2")
    index.write_text(html, encoding="utf-8")

    js = app.read_text(encoding="utf-8")
    js = js.replace("public_deployment_allowed: false", "public_deployment_allowed: true")
    app.write_text(js, encoding="utf-8")


def patch_native(root: Path) -> None:
    index = root / "native" / "index.html"
    app = root / "native" / "app.js"
    styles = root / "native" / "styles.css"

    html = index.read_text(encoding="utf-8")
    html = html.replace("guilin-v077-native-lod-artifact-viewer", "guilin-v079-native-lod-online-viewer")
    html = html.replace("桂林 V0.7.7 原生 12.5 米 LOD 检查", "桂林 V0.7.9 在线原生 12.5 米地形")
    html = html.replace("Artifact 本地验收", "在线 WebGL2")
    html = html.replace("原生近景 6.4 km", "原生近景 9.6 km")
    html = html.replace(
        "原生近景固定为 512 × 512，每个顶点对应一个 12.5 米源像元。",
        "原生近景固定为 768 × 768，每个顶点对应一个真实 12.5 米源像元。整块模式可检查当前 25.6 公里瓦片。",
    )
    tile_section = '''
      <section class="panel-section">
        <p class="section-kicker">全域原生瓦片</p>
        <label class="field-label" for="tileSelector">选择 9 × 6 瓦片</label>
        <select id="tileSelector" aria-label="选择桂林原生地形瓦片"></select>
        <p class="microcopy">每块文件保持 2048 × 2048 原生高程。切换瓦片后可继续旋转、平移和缩放。</p>
      </section>
'''
    marker = '      <section class="panel-section">\n        <p class="section-kicker">查看尺度</p>'
    html = replace_once(html, marker, tile_section + "\n" + marker, "native tile selector section")
    index.write_text(html, encoding="utf-8")

    js = app.read_text(encoding="utf-8")
    js = js.replace("const NATIVE_WINDOW = 512;", "const NATIVE_WINDOW = 768;")
    js = js.replace("public_deployment_allowed: false", "public_deployment_allowed: true")

    old_load_tail = '''    state.currentTile = tile;
    state.codes = cache.codes;
    state.currentTileSha = cache.sha256;
    uploadHeightTexture(state.codes);'''
    new_load_tail = '''    state.currentTile = tile;
    state.codes = cache.codes;
    state.currentTileSha = cache.sha256;
    const tileSelector = document.getElementById('tileSelector');
    if (tileSelector) tileSelector.value = tile.id;
    uploadHeightTexture(state.codes);'''
    js = replace_once(js, old_load_tail, new_load_tail, "load tile selector sync")

    select_tile = '''
  async function selectTile(tileId) {
    assert(state.tileById.has(tileId), `找不到瓦片 ${tileId}`);
    await loadTile(tileId, null);
  }
'''
    marker = "\n  function updateAnchorButtonState(anchorId) {"
    js = replace_once(js, marker, select_tile + marker, "selectTile function")

    controls_marker = '''  function setupControls() {
    document.querySelectorAll('[data-anchor]').forEach(button => {'''
    controls_new = '''  function setupControls() {
    const tileSelector = document.getElementById('tileSelector');
    if (tileSelector) {
      tileSelector.addEventListener('change', () => selectTile(tileSelector.value).catch(showError));
    }
    document.querySelectorAll('[data-anchor]').forEach(button => {'''
    js = replace_once(js, controls_marker, controls_new, "tile selector listener")

    init_marker = '''    state.manifest = manifest;
    for (const tile of manifest.tiles) state.tileById.set(tile.id, tile);
    for (const tile of manifest.tiles) {'''
    init_new = '''    state.manifest = manifest;
    for (const tile of manifest.tiles) state.tileById.set(tile.id, tile);
    const tileSelector = document.getElementById('tileSelector');
    if (tileSelector) {
      for (const tile of manifest.tiles) {
        const option = document.createElement('option');
        const [row, column] = tile.matrix_index;
        option.value = tile.id;
        option.textContent = `第 ${row + 1} 行 · 第 ${column + 1} 列 · ${tile.id}`;
        tileSelector.appendChild(option);
      }
    }
    for (const tile of manifest.tiles) {'''
    js = replace_once(js, init_marker, init_new, "populate tile selector")

    old_default = '''    const defaultAnchor = new URLSearchParams(location.search).get('anchor') || 'guilin';
    const selected = state.anchorById.has(defaultAnchor) ? defaultAnchor : state.anchorById.keys().next().value;
    await selectAnchor(selected);'''
    new_default = '''    const params = new URLSearchParams(location.search);
    const requestedTile = params.get('tile');
    const defaultAnchor = params.get('anchor') || 'guilin';
    if (requestedTile && state.tileById.has(requestedTile)) {
      await selectTile(requestedTile);
    } else {
      const selected = state.anchorById.has(defaultAnchor) ? defaultAnchor : state.anchorById.keys().next().value;
      await selectAnchor(selected);
    }'''
    js = replace_once(js, old_default, new_default, "tile query bootstrap")

    api_marker = '''    window.__GUILIN_V077_TEST_API = {
      async selectAnchor(anchorId) {'''
    api_new = '''    window.__GUILIN_V079_TEST_API = window.__GUILIN_V077_TEST_API = {
      async selectTile(tileId) {
        await selectTile(tileId);
        state.dirty = true;
        await nextFrame();
        await nextFrame();
        return updateQaResult();
      },
      async selectAnchor(anchorId) {'''
    js = replace_once(js, api_marker, api_new, "test API tile method")
    app.write_text(js, encoding="utf-8")

    css = styles.read_text(encoding="utf-8")
    css += '''
#tileSelector { font-variant-numeric: tabular-nums; }
.topbar a { pointer-events: auto; color: inherit; }
'''
    styles.write_text(css, encoding="utf-8")


def write_version(root: Path, head: str, run_id: str) -> None:
    manifest = {
        "schema": "guilin-v079-online-3d/v1",
        "status": "online-interactive-candidate",
        "git_head": head,
        "workflow_run_id": run_id,
        "overview": "overview/index.html",
        "native_12_5m": "native/index.html",
        "native_tile_count": 54,
        "lake_assets": 0,
        "visualAcceptance": False,
        "productionReady": False,
    }
    (root / "version.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-root", type=Path, required=True)
    parser.add_argument("--head", default="unknown")
    parser.add_argument("--run-id", default="unknown")
    args = parser.parse_args()
    patch_overview(args.site_root)
    patch_native(args.site_root)
    write_version(args.site_root, args.head, args.run_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
