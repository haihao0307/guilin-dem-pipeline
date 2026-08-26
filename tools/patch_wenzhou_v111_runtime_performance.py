#!/usr/bin/env python3
"""Apply the reviewed V1.1.1 runtime corrections without changing source truth assets."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "web/wenzhou-v111/runtime.js"
INDEX = ROOT / "web/wenzhou-v111/index.html"


def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"expected one occurrence, found {text.count(old)}: {old[:100]!r}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"expected one regex occurrence, found {count}: {pattern[:100]!r}")
    return updated


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")
    text = replace_once(text, '<input id="showBathy" type="checkbox" checked>', '<input id="showBathy" type="checkbox">')
    text = text.replace("<span>GEBCO 海底</span>", "<span>GEBCO 海底诊断</span>")
    INDEX.write_text(text, encoding="utf-8")


def patch_runtime() -> None:
    text = RUNTIME.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "layers: { terrain: true, ocean: true, bathy: true, rivers: true, coast: true, pending: false },",
        "layers: { terrain: true, ocean: true, bathy: false, rivers: true, coast: true, pending: false },",
    )
    text = replace_once(text, "riverWidth: 1, waterOpacity: .68,", "riverWidth: 1, waterOpacity: .76,")

    text = replace_once(
        text,
        "    destroyTerrainMesh(state.detailTerrain);\n    state.detailTerrain = null;\n    return;",
        "    destroyTerrainMesh(state.detailTerrain);\n    state.detailTerrain = null;\n    if (state.riverData) buildRiverMesh();\n    return;",
    )
    text = replace_once(
        text,
        "    state.detailTerrain = next;\n    ui.runtimeState.textContent = `${id} 原生 12.5 m 细节`;",
        "    state.detailTerrain = next;\n    if (state.riverData) buildRiverMesh();\n    ui.runtimeState.textContent = `${id} 原生 12.5 m 细节 · OSM 25 m 贴地`;",
    )

    pattern = r"function buildRiverMesh\(\) \{.*?\n\}\n\nfunction resizeCanvas"
    replacement = r'''function buildRiverMesh() {
  const gl = state.gl;
  if (state.riverMesh) { gl.deleteBuffer(state.riverMesh.buffer); gl.deleteVertexArray(state.riverMesh.vao); }
  const values = [];
  const colors = { river:[.06,.48,.67,.92], stream:[.17,.57,.70,.70], canal:[.15,.64,.60,.76], tidal_channel:[.06,.68,.72,.88] };
  const detail = state.detailTerrain;
  const pad = 900;
  let visibleParts = 0;
  let renderedSegments = 0;
  for (const part of state.riverData.parts || []) {
    const coords = part.coords || [];
    if (coords.length < 2) continue;
    const primary = part.type === 'river' || part.type === 'tidal_channel' || Boolean(part.name);
    if (!detail && !primary && Number(part.sourceRunLengthMeters || 0) < 1500) continue;
    const stride = detail ? 1 : part.type === 'river' || part.type === 'tidal_channel' ? 2 : part.name ? 3 : 8;
    const baseWidth = Math.max(Number(part.widthMeters || 0), part.type === 'river' ? 42 : part.type === 'tidal_channel' ? 24 : part.type === 'canal' ? 8 : 4) * state.riverWidth;
    const color = colors[part.type] || colors.stream;
    let partUsed = false;
    for (let index = stride; index < coords.length; index += stride) {
      const p0 = coords[index - stride], p1 = coords[index];
      if (detail) {
        const inside = (point) => point[0] >= detail.xMin - pad && point[0] <= detail.xMax + pad && point[2] >= detail.zMin - pad && point[2] <= detail.zMax + pad;
        if (!inside(p0) && !inside(p1)) continue;
      }
      const dx = p1[0] - p0[0], dz = p1[2] - p0[2], length = Math.hypot(dx, dz);
      if (length < .01) continue;
      const nx = -dz / length * baseWidth * .5, nz = dx / length * baseWidth * .5;
      const y0 = p0[1] + .08, y1 = p1[1] + .08;
      const a = [p0[0] + nx, y0, p0[2] + nz], b = [p0[0] - nx, y0, p0[2] - nz], c = [p1[0] + nx, y1, p1[2] + nz], d = [p1[0] - nx, y1, p1[2] - nz];
      for (const vertex of [a,b,c,c,b,d]) values.push(vertex[0], vertex[1], vertex[2], ...color);
      renderedSegments += 1;
      partUsed = true;
    }
    if (partUsed) visibleParts += 1;
  }
  state.riverMesh = createFlatMesh(gl, values, gl.DYNAMIC_DRAW);
  state.pendingMesh = createFlatMesh(gl, [], gl.DYNAMIC_DRAW);
  state.renderedRiverParts = visibleParts;
  state.renderedRiverSegments = renderedSegments;
  ui.hydrologyTag.textContent = detail
    ? `局部 OSM ${numberFormat.format(visibleParts)} 段 · 25 m 贴地`
    : `全域 OSM ${numberFormat.format(visibleParts)} 段 · 屏幕 LOD`;
}

function resizeCanvas'''
    text = regex_once(text, pattern, replacement)

    text = replace_once(
        text,
        "riverParts:state.riverData.partCount,coastlineParts:state.coastData.partCount,",
        "riverParts:state.riverData.partCount,renderedRiverParts:state.renderedRiverParts??0,renderedRiverSegments:state.renderedRiverSegments??0,coastlineParts:state.coastData.partCount,",
    )

    RUNTIME.write_text(text, encoding="utf-8")


def main() -> int:
    if not RUNTIME.is_file() or not INDEX.is_file():
        raise FileNotFoundError("web/wenzhou-v111 candidate is missing")
    patch_index()
    patch_runtime()
    print("patched", RUNTIME, INDEX)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
