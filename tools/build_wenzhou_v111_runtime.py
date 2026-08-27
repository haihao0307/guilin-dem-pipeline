#!/usr/bin/env python3
"""Create the Wenzhou v1.1.1 high-resolution runtime from the verified v1.1 code."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "web/wenzhou-v110"
TARGET = ROOT / "web/wenzhou-v111"


def replace_required(text: str, old: str, new: str, count: int = 1) -> str:
    occurrences = text.count(old)
    if occurrences < count:
        raise RuntimeError(f"required replacement missing: {old[:120]!r}")
    return text.replace(old, new, count)


def regex_replace_required(text: str, pattern: str, replacement: str, count: int = 1) -> str:
    updated, replaced = re.subn(pattern, replacement, text, count=count, flags=re.S)
    if replaced != count:
        raise RuntimeError(f"required regex replacement failed: {pattern[:120]!r}, got {replaced}")
    return updated


def build_index() -> None:
    text = (SOURCE / "index.html").read_text(encoding="utf-8")
    text = text.replace("V1.1 DRAFT", "V1.1.1 HIRES DRAFT")
    text = text.replace("V1.1</title>", "V1.1.1</title>")
    text = text.replace("12.5 m 真值 DEM", "12.5 m 真值 + 高精 LOD")
    text = text.replace('<input id="showPending" type="checkbox" checked>', '<input id="showPending" type="checkbox">')
    text = text.replace('<strong id="gridMetric">513²</strong>', '<strong id="gridMetric">1025²</strong>')
    text = text.replace('<strong id="triangleMetric">524,288</strong>', '<strong id="triangleMetric">2,097,152</strong>')
    text = text.replace('<strong id="bathyMetric">257²</strong>', '<strong id="bathyMetric">1025²</strong>')
    text = text.replace("离线层为从真值高程、坡度和海域掩膜生成的 satellite-color material，不宣称原始卫星照片。", "默认优先载入 EOX Sentinel-2 cloudless 2024 PNG；离线层为 4096 PNG 无损 satellite-color material。")
    (TARGET / "index.html").write_text(text, encoding="utf-8")


def build_runtime() -> None:
    text = (SOURCE / "runtime.js").read_text(encoding="utf-8")
    text = replace_required(text, "const ASSET = './assets/bootstrap/';", "const ASSET = './assets/hires/';")
    text = text.replace("__WENZHOU_V110_DIAGNOSTICS__", "__WENZHOU_V111_DIAGNOSTICS__")

    text = replace_required(
        text,
        "  if(uMode==0)color*=light;\n  if(vMarine>.5)color=mix(color,vec3(.08,.24,.31),.35);\n  float fog=smoothstep(85000.0,250000.0,length(uCamera-vWorld));color=mix(color,uFogColor,fog*.82);",
        "  if(vMarine>.5)discard;\n  if(uMode==0)color*=light;\n  float fog=smoothstep(180000.0,420000.0,length(uCamera-vWorld));color=mix(color,uFogColor,fog*.16);",
    )
    text = replace_required(text, "f*.8),1.0);}`, "f*.16),1.0);}`")
    text = replace_required(
        text,
        "float wave=(sin(aPosition.x*.00035+uTime*.55)+cos(aPosition.z*.00029-uTime*.43))*.32;",
        "float wave=(sin(aPosition.x*.000055+uTime*.18)+cos(aPosition.z*.000047-uTime*.14))*.045;",
    )
    text = replace_required(
        text,
        "vec3 c=mix(vec3(.055,.22,.29),vec3(.20,.47,.52),fres);outColor=vec4(c,uOpacity);",
        "vec3 c=mix(vec3(.045,.19,.27),vec3(.16,.39,.47),fres);outColor=vec4(c,uOpacity);",
    )

    text = replace_required(text, "function computeNormals(positions, grid) {", "function computeNormals(positions, grid, spacing) {")
    text = replace_required(text, "2 * 290", "2 * spacing")
    text = replace_required(text, "const targetGrid = mobile ? 257 : sourceGrid;", "const targetGrid = mobile ? Math.min(513, sourceGrid) : sourceGrid;")
    text = replace_required(text, "const sourceHeight = new Uint16Array(heightBuffer);", "const sourceHeight = new Int16Array(heightBuffer);")
    text = replace_required(
        text,
        "const value = minimum + sourceHeight[sourceIndex] / 65535 * (maximum - minimum);",
        "const value = sourceHeight[sourceIndex] === -32768 ? 0 : sourceHeight[sourceIndex];",
    )
    text = replace_required(text, "const normals = computeNormals(positions, targetGrid);", "const normals = computeNormals(positions, targetGrid, width / Math.max(targetGrid - 1, 1));")

    detail_code = r'''
function createDetailTerrain(gl, heightBuffer, marineBuffer, tile, mobile) {
  const sourceGrid = tile.grid[0];
  const targetGrid = mobile ? Math.min(513, sourceGrid) : sourceGrid;
  const sourceHeight = new Int16Array(heightBuffer);
  const sourceMarine = new Uint8Array(marineBuffer);
  const [xMin, zMin, xMax, zMax] = tile.localBounds;
  const width = xMax - xMin;
  const depth = zMax - zMin;
  const positions = new Float32Array(targetGrid * targetGrid * 3);
  const uvs = new Float32Array(targetGrid * targetGrid * 2);
  const marine = new Float32Array(targetGrid * targetGrid);
  const heights = new Float32Array(targetGrid * targetGrid);
  for (let row = 0; row < targetGrid; row += 1) {
    const sourceRow = Math.round(row / (targetGrid - 1) * (sourceGrid - 1));
    for (let col = 0; col < targetGrid; col += 1) {
      const sourceCol = Math.round(col / (targetGrid - 1) * (sourceGrid - 1));
      const sourceIndex = sourceRow * sourceGrid + sourceCol;
      const index = row * targetGrid + col;
      const raw = sourceHeight[sourceIndex];
      const value = raw === -32768 ? 0 : raw;
      const x = xMin + col / (targetGrid - 1) * width;
      const z = zMin + row / (targetGrid - 1) * depth;
      heights[index] = value;
      positions[index * 3] = x;
      positions[index * 3 + 1] = value + 0.06;
      positions[index * 3 + 2] = z;
      uvs[index * 2] = clamp((x + state.terrain.width / 2) / state.terrain.width, 0, 1);
      uvs[index * 2 + 1] = 1 - clamp((z + state.terrain.depth / 2) / state.terrain.depth, 0, 1);
      marine[index] = sourceMarine[sourceIndex] > 0 ? 1 : 0;
    }
  }
  const normals = computeNormals(positions, targetGrid, width / Math.max(targetGrid - 1, 1));
  const vertices = new Float32Array(targetGrid * targetGrid * 9);
  for (let index = 0; index < targetGrid * targetGrid; index += 1) {
    const offset = index * 9;
    vertices.set(positions.subarray(index * 3, index * 3 + 3), offset);
    vertices.set(normals.subarray(index * 3, index * 3 + 3), offset + 3);
    vertices.set(uvs.subarray(index * 2, index * 2 + 2), offset + 6);
    vertices[offset + 8] = marine[index];
  }
  const indices = new Uint32Array((targetGrid - 1) * (targetGrid - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < targetGrid - 1; row += 1) {
    for (let col = 0; col < targetGrid - 1; col += 1) {
      const a = row * targetGrid + col, b = a + 1, c = a + targetGrid, d = c + 1;
      indices.set([a, c, b, b, c, d], cursor);
      cursor += 6;
    }
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, vertices);
  const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices);
  const stride = 9 * 4;
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 8 * 4);
  gl.bindVertexArray(null);
  return { vao, vertexBuffer, indexBuffer, indexCount: indices.length, grid: targetGrid, width, depth, heights, marine, xMin, xMax, zMin, zMax, spacing: tile.sourceSpacingMeters };
}

function destroyTerrainMesh(mesh) {
  if (!mesh || !state.gl) return;
  state.gl.deleteBuffer(mesh.vertexBuffer);
  state.gl.deleteBuffer(mesh.indexBuffer);
  state.gl.deleteVertexArray(mesh.vao);
}

async function loadDetailTile(id) {
  const token = ++state.detailToken;
  if (id === 'overall' || !state.manifest.detailTiles?.[id]) {
    destroyTerrainMesh(state.detailTerrain);
    state.detailTerrain = null;
    return;
  }
  const tile = state.manifest.detailTiles[id];
  ui.runtimeState.textContent = `${id} 12.5 m 细节载入中`;
  try {
    const [heightBuffer, marineBuffer] = await Promise.all([
      fetchBuffer(`${ASSET}${tile.heightAsset}`),
      fetchBuffer(`${ASSET}${tile.marineAsset}`),
    ]);
    if (token !== state.detailToken) return;
    const next = createDetailTerrain(state.gl, heightBuffer, marineBuffer, tile, matchMedia('(max-width: 760px)').matches);
    destroyTerrainMesh(state.detailTerrain);
    state.detailTerrain = next;
    ui.runtimeState.textContent = `${id} 原生 12.5 m 细节`;
  } catch (error) {
    if (token === state.detailToken) ui.runtimeState.textContent = `细节瓦片失败：${error.message}`;
  }
}
'''
    text = replace_required(text, "\nfunction createBathymetryMesh(gl, buffer, manifest) {", "\n" + detail_code + "\nfunction createBathymetryMesh(gl, buffer, manifest, mobile) {")

    bathy_pattern = r"function createBathymetryMesh\(gl, buffer, manifest, mobile\) \{.*?\n\}\n\nfunction createFlatMesh"
    bathy_replacement = r'''function createBathymetryMesh(gl, buffer, manifest, mobile) {
  const sourceValues = new Int16Array(buffer);
  const sourceGrid = manifest.bathymetryOverview.grid[0];
  const grid = mobile ? Math.min(513, sourceGrid) : sourceGrid;
  const bounds = manifest.bathymetryOverview.bounds;
  const origin = manifest.worldOriginProjected;
  const positions = new Float32Array(grid * grid * 5);
  const valid = new Uint8Array(grid * grid);
  for (let row = 0; row < grid; row += 1) {
    const sourceRow = Math.round(row / (grid - 1) * (sourceGrid - 1));
    for (let col = 0; col < grid; col += 1) {
      const sourceCol = Math.round(col / (grid - 1) * (sourceGrid - 1));
      const sourceIndex = sourceRow * sourceGrid + sourceCol;
      const index = row * grid + col;
      const value = sourceValues[sourceIndex];
      valid[index] = value === -32768 ? 0 : 1;
      positions[index * 5] = bounds[0] + col / (grid - 1) * (bounds[2] - bounds[0]) - origin[0];
      positions[index * 5 + 1] = value === -32768 ? -0.2 : Math.min(value, -0.15);
      positions[index * 5 + 2] = origin[1] - (bounds[3] - row / (grid - 1) * (bounds[3] - bounds[1]));
      positions[index * 5 + 3] = col / (grid - 1);
      positions[index * 5 + 4] = row / (grid - 1);
    }
  }
  const indexValues = [];
  for (let row = 0; row < grid - 1; row += 1) {
    for (let col = 0; col < grid - 1; col += 1) {
      const a = row * grid + col, b = a + 1, c = a + grid, d = c + 1;
      if (valid[a] && valid[b] && valid[c] && valid[d]) indexValues.push(a, c, b, b, c, d);
    }
  }
  const indices = new Uint32Array(indexValues);
  const vao = gl.createVertexArray();gl.bindVertexArray(vao);
  const vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
  const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,5*4,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,5*4,3*4);
  gl.bindVertexArray(null);
  return { vao, vertexBuffer, indexBuffer, indexCount: indices.length, grid, validCellCount: valid.reduce((sum, value) => sum + value, 0) };
}

function createFlatMesh'''
    text = regex_replace_required(text, bathy_pattern, bathy_replacement)

    text = replace_required(
        text,
        "gl: null, manifest: null, terrain: null, bathy: null, coastData: null, riverData: null,",
        "gl: null, manifest: null, terrain: null, detailTerrain: null, detailToken: 0, bathy: null, coastData: null, riverData: null,",
    )

    sample_pattern = r"function sampleTerrain\(x, z\) \{.*?\nfunction sampleMarine\(x,z\)\{.*?\}\n"
    sample_replacement = r'''function sampleMeshTerrain(mesh, x, z) {
  if (!mesh) return null;
  const xMin = mesh.xMin ?? -mesh.width / 2, xMax = mesh.xMax ?? mesh.width / 2;
  const zMin = mesh.zMin ?? -mesh.depth / 2, zMax = mesh.zMax ?? mesh.depth / 2;
  if (x < xMin || x > xMax || z < zMin || z > zMax) return null;
  const column = (x - xMin) / Math.max(xMax - xMin, 1) * (mesh.grid - 1);
  const row = (z - zMin) / Math.max(zMax - zMin, 1) * (mesh.grid - 1);
  const x0 = Math.floor(column), z0 = Math.floor(row), x1 = Math.min(mesh.grid - 1, x0 + 1), z1 = Math.min(mesh.grid - 1, z0 + 1);
  const tx = column - x0, tz = row - z0;
  const a = mesh.heights[z0 * mesh.grid + x0], b = mesh.heights[z0 * mesh.grid + x1], c = mesh.heights[z1 * mesh.grid + x0], d = mesh.heights[z1 * mesh.grid + x1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
function sampleTerrain(x, z) {
  const detail = sampleMeshTerrain(state.detailTerrain, x, z);
  if (detail != null) return detail;
  return sampleMeshTerrain(state.terrain, x, z) ?? 0;
}
function sampleMarine(x, z) {
  const terrain = state.detailTerrain && x >= state.detailTerrain.xMin && x <= state.detailTerrain.xMax && z >= state.detailTerrain.zMin && z <= state.detailTerrain.zMax ? state.detailTerrain : state.terrain;
  if (!terrain) return 0;
  const xMin = terrain.xMin ?? -terrain.width / 2, xMax = terrain.xMax ?? terrain.width / 2;
  const zMin = terrain.zMin ?? -terrain.depth / 2, zMax = terrain.zMax ?? terrain.depth / 2;
  if (x < xMin || x > xMax || z < zMin || z > zMax) return 0;
  const column = Math.round((x - xMin) / Math.max(xMax - xMin, 1) * (terrain.grid - 1));
  const row = Math.round((z - zMin) / Math.max(zMax - zMin, 1) * (terrain.grid - 1));
  return terrain.marine[row * terrain.grid + column] > 0 ? 1 : 0;
}
'''
    text = regex_replace_required(text, sample_pattern, sample_replacement)

    vector_pattern = r"function buildCoastMesh\(\)\{.*?\nfunction buildRiverMesh\(\)\{.*?\}\n\nfunction resizeCanvas"
    vector_replacement = r'''function buildCoastMesh() {
  const values = [];
  for (const part of state.coastData.parts || []) {
    const coords = part.coords || [];
    for (let index = 1; index < coords.length; index += 1) {
      for (const point of [coords[index - 1], coords[index]]) values.push(point[0], point[1], point[2], .62, .92, .88, .78);
    }
  }
  state.coastMesh = createFlatMesh(state.gl, values);
}
function buildRiverMesh() {
  const gl = state.gl;
  if (state.riverMesh) { gl.deleteBuffer(state.riverMesh.buffer); gl.deleteVertexArray(state.riverMesh.vao); }
  const values = [];
  const colors = { river:[.06,.48,.67,.92], stream:[.17,.57,.70,.70], canal:[.15,.64,.60,.76], tidal_channel:[.06,.68,.72,.88] };
  for (const part of state.riverData.parts || []) {
    const coords = part.coords || [];
    if (coords.length < 2) continue;
    const baseWidth = Math.max(Number(part.widthMeters || 0), part.type === 'river' ? 42 : part.type === 'tidal_channel' ? 24 : part.type === 'canal' ? 8 : 4) * state.riverWidth;
    const color = colors[part.type] || colors.stream;
    for (let index = 1; index < coords.length; index += 1) {
      const p0 = coords[index - 1], p1 = coords[index];
      const dx = p1[0] - p0[0], dz = p1[2] - p0[2], length = Math.hypot(dx, dz);
      if (length < .01) continue;
      const nx = -dz / length * baseWidth * .5, nz = dx / length * baseWidth * .5;
      const y0 = p0[1] + .08, y1 = p1[1] + .08;
      const a = [p0[0] + nx, y0, p0[2] + nz], b = [p0[0] - nx, y0, p0[2] - nz], c = [p1[0] + nx, y1, p1[2] + nz], d = [p1[0] - nx, y1, p1[2] - nz];
      for (const vertex of [a,b,c,c,b,d]) values.push(vertex[0], vertex[1], vertex[2], ...color);
    }
  }
  state.riverMesh = createFlatMesh(gl, values, gl.DYNAMIC_DRAW);
  state.pendingMesh = createFlatMesh(gl, [], gl.DYNAMIC_DRAW);
}

function resizeCanvas'''
    text = regex_replace_required(text, vector_pattern, vector_replacement)

    text = replace_required(
        text,
        "function flyTo(id){const anchor=anchors[id];if(!anchor)return;state.camera.ground=false;",
        "function flyTo(id){const anchor=anchors[id];if(!anchor)return;void loadDetailTile(id);state.camera.ground=false;",
    )
    text = replace_required(text, "FORMAT:'image/jpeg'", "FORMAT:'image/png'")
    text = replace_required(text, "WIDTH:'2048',HEIGHT:'2048'", "WIDTH:'4096',HEIGHT:'4096'")

    terrain_draw = "gl.bindVertexArray(state.terrain.vao);gl.drawElements(gl.TRIANGLES,state.terrain.indexCount,gl.UNSIGNED_INT,0);"
    detail_draw = terrain_draw + "if(state.detailTerrain){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);gl.bindVertexArray(state.detailTerrain.vao);gl.drawElements(gl.TRIANGLES,state.detailTerrain.indexCount,gl.UNSIGNED_INT,0);gl.disable(gl.POLYGON_OFFSET_FILL);}"
    text = replace_required(text, terrain_draw, detail_draw)
    text = replace_required(
        text,
        "terrainGrid:[state.terrain.grid,state.terrain.grid],terrainTriangleCount:state.terrain.indexCount/3,",
        "terrainGrid:[state.terrain.grid,state.terrain.grid],terrainTriangleCount:state.terrain.indexCount/3,detailGrid:state.detailTerrain?[state.detailTerrain.grid,state.detailTerrain.grid]:null,detailSpacingMeters:state.detailTerrain?.spacing??null,",
    )

    start_pattern = r"async function start\(\)\{.*?\n\nstart\(\)\.catch\(showFatal\);"
    start_replacement = r'''async function start(){
  bindUi();
  setLoading(8,'建立温州高精三维世界','载入高精 manifest 与 GPU 程序');
  const gl=ui.canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance'});
  if(!gl)throw new Error('当前浏览器未提供 WebGL2');
  state.gl=gl;
  ui.renderReadout.textContent=`WebGL2 · ${gl.getParameter(gl.RENDERER)}`;
  const terrainProgram=createProgram(gl,TERRAIN_VERTEX,TERRAIN_FRAGMENT),bathyProgram=createProgram(gl,BATHY_VERTEX,BATHY_FRAGMENT),waterProgram=createProgram(gl,WATER_VERTEX,WATER_FRAGMENT),flatProgram=createProgram(gl,FLAT_VERTEX,FLAT_FRAGMENT);
  state.programs.terrain={program:terrainProgram,uniforms:locations(gl,terrainProgram,['uViewProj','uMap','uCamera','uFogColor','uMode'])};
  state.programs.bathy={program:bathyProgram,uniforms:locations(gl,bathyProgram,['uViewProj','uCamera','uFogColor','uEmphasis'])};
  state.programs.water={program:waterProgram,uniforms:locations(gl,waterProgram,['uViewProj','uCamera','uTime','uSeaLevel','uOpacity'])};
  state.programs.flat={program:flatProgram,uniforms:locations(gl,flatProgram,['uViewProj','uPointSize','uRound'])};
  state.manifest=await fetchJson(`${ASSET}manifest.json`);
  const mobile=matchMedia('(max-width: 760px)').matches;
  const overview=state.manifest.terrainOverview;
  setLoading(24,'载入高精权威地形',`读取 ${overview.grid[0]} × ${overview.grid[1]} 无损高程和海域掩膜`);
  const[heightBuffer,marineBuffer,satelliteImage]=await Promise.all([
    fetchBuffer(`${ASSET}${overview.heightAsset}`),
    fetchBuffer(`${ASSET}${overview.marineAsset}`),
    loadImage(`${ASSET}${state.manifest.offlineSatelliteColor.asset}`),
  ]);
  state.terrain=createInterleavedTerrain(gl,heightBuffer,marineBuffer,state.manifest,mobile);
  state.textures.offline=createTexture(gl,satelliteImage);
  state.activeTexture=state.textures.offline;
  ui.triangleMetric.textContent=numberFormat.format(state.terrain.indexCount/3);
  ui.elevationMetric.textContent=`${overview.minimumElevationMeters.toFixed(0)}–${overview.maximumElevationMeters.toFixed(0)} m`;
  setLoading(48,'高精地形已经可见','继续载入裁切后的 GEBCO 海底');
  state.bathy=createBathymetryMesh(gl,await fetchBuffer(`${ASSET}${state.manifest.bathymetryOverview.asset}`),state.manifest,mobile);
  setLoading(68,'载入贴地 OSM 水系','所有河段已裁切至真值 AOI，并按源 COG 25 m 采样贴地');
  [state.coastData,state.riverData]=await Promise.all([
    fetchJson(`${ASSET}${state.manifest.hydrology.coastlineAsset}`),
    fetchJson(`${ASSET}${state.manifest.hydrology.riverAsset}`),
  ]);
  buildCoastMesh();
  buildRiverMesh();
  ui.riverMetric.textContent=numberFormat.format(state.riverData.partCount);
  ui.coastMetric.textContent=numberFormat.format(state.coastData.partCount);
  ui.hydrologyTag.textContent=`OSM ${numberFormat.format(state.riverData.partCount)} 段 · 25 m 贴地采样`;
  setLoading(92,'完成高精共享三维世界','准备在线 Sentinel-2 PNG 与原生 12.5 m 镜头瓦片');
  state.ready=true;
  ui.runtimeState.textContent=`全域 ${overview.grid[0]}² · ${overview.spacingMeters[0].toFixed(1)} m`;
  ui.loadingCard.classList.add('hidden');
  setStatus('高精三维地形、稳定海面、裁切海底和贴地 OSM 水系已载入','ok');
  updateMaterialUi();
  requestAnimationFrame(render);
  setTimeout(()=>void enableOnlineSatellite(),120);
}

start().catch(showFatal);'''
    text = regex_replace_required(text, start_pattern, start_replacement)

    (TARGET / "runtime.js").write_text(text, encoding="utf-8")


def main() -> int:
    if not SOURCE.is_dir():
        raise FileNotFoundError(SOURCE)
    TARGET.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE / "style.css", TARGET / "style.css")
    build_index()
    build_runtime()
    print(TARGET)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
