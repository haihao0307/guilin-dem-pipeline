#!/usr/bin/env python3
"""Finalize V1.1.1 visual defaults and responsive ocean geometry."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "web/wenzhou-v111/runtime.js"
INDEX = ROOT / "web/wenzhou-v111/index.html"


def replace_once(text: str, old: str, new: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected one occurrence, got {count}: {old[:120]!r}")
    return text.replace(old, new, 1)


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")
    text = replace_once(text, '<input id="showCoast" type="checkbox" checked>', '<input id="showCoast" type="checkbox">')
    text = text.replace("<span>OSM 海岸线</span>", "<span>OSM 海岸线诊断</span>")
    INDEX.write_text(text, encoding="utf-8")


def patch_runtime() -> None:
    text = RUNTIME.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "function createInterleavedTerrain(gl, heightBuffer, marineBuffer, manifest, mobile) {\n  const sourceGrid = manifest.terrainOverview.grid[0];\n  const targetGrid = mobile ? Math.min(513, sourceGrid) : sourceGrid;",
        "function createInterleavedTerrain(gl, heightBuffer, marineBuffer, manifest, mobile, targetOverride = null) {\n  const sourceGrid = manifest.terrainOverview.grid[0];\n  const targetGrid = targetOverride || (mobile ? Math.min(513, sourceGrid) : sourceGrid);",
    )
    text = replace_once(
        text,
        "gl: null, manifest: null, terrain: null, detailTerrain: null, detailToken: 0, bathy: null, coastData: null, riverData: null,",
        "gl: null, manifest: null, terrain: null, oceanTerrain: null, detailTerrain: null, detailToken: 0, bathy: null, coastData: null, riverData: null,",
    )
    text = replace_once(
        text,
        "layers: { terrain: true, ocean: true, bathy: false, rivers: true, coast: true, pending: false },",
        "layers: { terrain: true, ocean: true, bathy: false, rivers: true, coast: false, pending: false },",
    )
    text = replace_once(
        text,
        "const detail = state.detailTerrain;\n  const pad = 900;",
        "const detail = state.detailTerrain;\n  const mobileHydrology = matchMedia('(max-width: 760px)').matches;\n  const pad = 900;",
    )
    text = replace_once(
        text,
        "const stride = detail ? 1 : part.type === 'river' || part.type === 'tidal_channel' ? 2 : part.name ? 3 : 8;",
        "const stride = detail ? 1 : mobileHydrology ? (part.type === 'river' || part.type === 'tidal_channel' ? 4 : part.name ? 7 : 18) : (part.type === 'river' || part.type === 'tidal_channel' ? 2 : part.name ? 3 : 8);",
    )
    text = replace_once(
        text,
        "gl.bindVertexArray(state.terrain.vao);gl.drawElements(gl.TRIANGLES,state.terrain.indexCount,gl.UNSIGNED_INT,0);gl.depthMask(true);",
        "gl.bindVertexArray(state.oceanTerrain.vao);gl.drawElements(gl.TRIANGLES,state.oceanTerrain.indexCount,gl.UNSIGNED_INT,0);gl.depthMask(true);",
    )
    text = replace_once(
        text,
        "state.terrain=createInterleavedTerrain(gl,heightBuffer,marineBuffer,state.manifest,mobile);\n  state.textures.offline=createTexture(gl,satelliteImage);",
        "state.terrain=createInterleavedTerrain(gl,heightBuffer,marineBuffer,state.manifest,mobile);\n  state.oceanTerrain=createInterleavedTerrain(gl,heightBuffer,marineBuffer,state.manifest,mobile,mobile?385:769);\n  state.textures.offline=createTexture(gl,satelliteImage);",
    )
    text = replace_once(
        text,
        "const mobile=matchMedia('(max-width: 760px)').matches;\n  const overview=state.manifest.terrainOverview;",
        "const mobile=matchMedia('(max-width: 760px)').matches;\n  if(mobile){ui.controller.classList.remove('open');ui.panelToggle.setAttribute('aria-expanded','false');}\n  const overview=state.manifest.terrainOverview;",
    )
    text = replace_once(
        text,
        "bathymetryGrid:state.manifest.bathymetryOverview.grid,riverParts:",
        "bathymetryGrid:state.manifest.bathymetryOverview.grid,oceanGrid:[state.oceanTerrain.grid,state.oceanTerrain.grid],riverParts:",
    )
    RUNTIME.write_text(text, encoding="utf-8")


def main() -> int:
    patch_index()
    patch_runtime()
    print("patched", INDEX, RUNTIME)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
