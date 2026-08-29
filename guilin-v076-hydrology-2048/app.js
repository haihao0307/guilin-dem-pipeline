(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('terrainCanvas');
  const fallbackCanvas = $('fallbackCanvas');
  const loadingCard = $('loadingCard');
  const loadingTitle = $('loadingTitle');
  const loadingDetail = $('loadingDetail');
  const progressBar = $('progressBar');
  const statusPill = $('statusPill');
  const statusText = $('statusText');
  const dataPanel = $('dataPanel');
  const errorCard = $('errorCard');
  const errorMessage = $('errorMessage');
  const renderInfo = $('renderInfo');
  const viewerShell = $('viewerShell');
  const labelLayer = $('labelLayer');

  const TERRAIN_MANIFEST_URL = 'data/terrain_2048_manifest.json';
  const TERRAIN_HEIGHT_URL = 'data/terrain_2048_u16.bin';
  const WATER_MANIFEST_URL = 'data/hydrology_sample_manifest.json';
  const WATER_BUFFER_URL = 'data/hydrology_ribbons.f32.bin';
  const AOI_URL = 'data/accepted_aoi.json';
  const EXPECTED_GRID = 2048;
  const EXPECTED_HEIGHT_BYTES = EXPECTED_GRID * EXPECTED_GRID * 2;
  const EXPECTED_AOI_SHA = '36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80';
  const EXPECTED_SOURCE_SHA = '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
  const EXPECTED_AOI_BOUNDS = [380331.8, 2705928.1, 530128.2, 2926987.2];
  const NODATA_CODE = 65535;
  const MAX_DEVICE_PIXEL_RATIO = 1.6;
  const runtimeErrors = [];

  const LANDMARKS = [
    { id: 'zhenbaoding', name: '真寶鼎', e: 482534.530462443, n: 2890708.122979571 },
    { id: 'guilin', name: '桂林城', e: 429459.239540243, n: 2795494.225020682 },
    { id: 'yangtang', name: '秧塘機場', e: 414949.565810143, n: 2789301.889164384 },
    { id: 'yangshuo', name: '陽朔縣', e: 448648.462659552, n: 2740850.767499203 },
  ];

  const state = {
    terrainManifest: null,
    waterManifest: null,
    aoi: null,
    codes: null,
    waterFloats: null,
    gl: null,
    terrainProgram: null,
    waterProgram: null,
    terrainVao: null,
    terrainIndexBuffer: null,
    terrainIndexCount: 0,
    validCellCount: 0,
    terrainUniforms: {},
    waterVao: null,
    waterBuffer: null,
    waterVertexCount: 0,
    waterUniforms: {},
    heightTexture: null,
    renderGrid: 768,
    verticalScale: 1,
    waterVisible: true,
    worldWidth: 1,
    worldDepth: 1,
    renderOriginElevation: 0,
    projection: new Float32Array(16),
    view: new Float32Array(16),
    viewProjection: new Float32Array(16),
    dirty: true,
    frameCount: 0,
    fallbackReady: false,
    pointers: new Map(),
    pinch: null,
    labels: [],
    camera: {
      target: [0, 300, 0],
      yaw: -0.72,
      pitch: 0.58,
      distance: 300000,
      minDistance: 6000,
      maxDistance: 1200000,
    },
  };

  window.addEventListener('error', event => {
    runtimeErrors.push(String(event.message || event.error || 'window error'));
    updateQaResult();
  });
  window.addEventListener('unhandledrejection', event => {
    runtimeErrors.push(String(event.reason || 'unhandled rejection'));
    updateQaResult();
  });

  function setProgress(percent, title, detail) {
    progressBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
    if (title) loadingTitle.textContent = title;
    if (detail) loadingDetail.textContent = detail;
  }

  function setReadyStatus(text) {
    statusPill.classList.remove('loading', 'error');
    statusPill.classList.add('ready');
    statusText.textContent = text;
  }

  function setErrorStatus(text) {
    statusPill.classList.remove('loading', 'ready');
    statusPill.classList.add('error');
    statusText.textContent = '三维预览需检查';
    errorMessage.textContent = text;
    errorCard.hidden = false;
    loadingCard.hidden = true;
    document.body.dataset.ready = 'false';
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function approximately(a, b, tolerance = 1e-6) {
    return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tolerance;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  async function fetchBinary(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.arrayBuffer();
  }

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  }

  function isLittleEndian() {
    const probe = new ArrayBuffer(2);
    new DataView(probe).setUint16(0, 0x00ff, true);
    return new Uint16Array(probe)[0] === 0x00ff;
  }

  function decodeUint16(buffer) {
    if (isLittleEndian()) return new Uint16Array(buffer);
    const view = new DataView(buffer);
    const result = new Uint16Array(buffer.byteLength / 2);
    for (let index = 0; index < result.length; index += 1) result[index] = view.getUint16(index * 2, true);
    return result;
  }

  function decodeFloat32(buffer) {
    if (isLittleEndian()) return new Float32Array(buffer);
    const view = new DataView(buffer);
    const result = new Float32Array(buffer.byteLength / 4);
    for (let index = 0; index < result.length; index += 1) result[index] = view.getFloat32(index * 4, true);
    return result;
  }

  function validateContracts(terrainManifest, waterManifest, aoi, heightBuffer, waterBuffer, heightSha, waterSha) {
    assert(terrainManifest?.schema === 'guilin-v075-accepted-aoi-terrain-grid/v2', '2048 高程合同版本不正确');
    assert(terrainManifest.crs === 'EPSG:32649', '高程坐标系合同不正确');
    assert(terrainManifest.aoi_status === 'ACCEPTED', '高程 AOI 状态不正确');
    assert(terrainManifest.aoi_geometry_sha256 === EXPECTED_AOI_SHA, '高程 AOI 哈希不正确');
    assert(Array.isArray(terrainManifest.output_grid) && terrainManifest.output_grid[0] === EXPECTED_GRID && terrainManifest.output_grid[1] === EXPECTED_GRID, '数值高程必须为 2048 × 2048');
    assert(heightBuffer.byteLength === EXPECTED_HEIGHT_BYTES, `2048 高程字节数不正确：${heightBuffer.byteLength}`);
    assert(terrainManifest.stored_bytes === EXPECTED_HEIGHT_BYTES, '高程清单字节数不正确');
    assert(terrainManifest.sha256 === heightSha, '2048 高程 SHA256 不一致');
    assert(terrainManifest.source_sha256 === EXPECTED_SOURCE_SHA, '高程来源 TIFF 哈希不正确');
    assert(Array.isArray(terrainManifest.source_resolution_m) && terrainManifest.source_resolution_m.every(value => approximately(value, 12.5)), '高程真值来源必须为 12.5 米');
    assert(terrainManifest.source_elevation_modified_m === 0, '来源高程被修改');
    assert(terrainManifest.vertical_scale === 1, '默认垂直比例必须为 1.00');
    assert(terrainManifest.gap_fill_applied === false && terrainManifest.fallback_30m_used === false, '禁止补洞或 30 米替代');
    assert(terrainManifest.output_nodata_code === NODATA_CODE, 'NoData 编码不正确');

    assert(aoi?.status === 'ACCEPTED' && aoi.distillation_allowed === true, '确认范围尚未锁定');
    assert(aoi.geometry_sha256 === EXPECTED_AOI_SHA, '确认范围哈希不一致');
    assert(Array.isArray(aoi.bounds_epsg32649) && aoi.bounds_epsg32649.every((value, index) => approximately(value, EXPECTED_AOI_BOUNDS[index], 0.11)), '确认范围边界不一致');

    assert(waterManifest?.schema === 'guilin-v075-hydrology-sampled-ribbons/v1', '水系采样合同版本不正确');
    assert(waterManifest.crs === 'EPSG:32649', '水系坐标系不正确');
    assert(waterManifest.aoi_geometry_sha256 === EXPECTED_AOI_SHA, '水系 AOI 哈希不一致');
    assert(waterManifest.centerline_coordinates_mutated === false, '水系中心线坐标发生变化');
    assert(waterManifest.gap_fill_applied === false && waterManifest.fallback_30m_used === false, '水系禁止补洞或 30 米替代');
    assert(waterManifest.primitive === 'triangles', '水系图元合同不正确');
    assert(waterManifest.vertex_count > 0 && waterManifest.vertex_count % 6 === 0, '水系三角顶点数量不正确');
    assert(waterManifest.stored_bytes === waterBuffer.byteLength, '水系字节数不一致');
    assert(waterBuffer.byteLength === waterManifest.vertex_count * 4 * 4, '水系顶点布局不一致');
    assert(waterManifest.sha256 === waterSha, '水系 SHA256 不一致');
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || 'shader compile failed';
      gl.deleteShader(shader);
      throw new Error(log);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || 'program link failed';
      gl.deleteProgram(program);
      throw new Error(log);
    }
    return program;
  }

  const TERRAIN_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D uHeight;
uniform ivec2 uSourceSize;
uniform int uGridSize;
uniform vec2 uWorldSize;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uRenderOrigin;
uniform float uVerticalScale;
uniform mat4 uViewProjection;
out vec2 vSourcePosition;
out float vElevation;
void main() {
  int column = gl_VertexID % uGridSize;
  int row = gl_VertexID / uGridSize;
  int sourceX = int(round(float(column) * float(uSourceSize.x - 1) / float(uGridSize - 1)));
  int sourceY = int(round(float(row) * float(uSourceSize.y - 1) / float(uGridSize - 1)));
  uint code = texelFetch(uHeight, ivec2(sourceX, sourceY), 0).r;
  float elevation = mix(uMinElevation, uMaxElevation, float(code) / 65534.0);
  float tx = float(column) / float(uGridSize - 1);
  float tz = float(row) / float(uGridSize - 1);
  vec3 worldPosition = vec3(
    mix(-0.5 * uWorldSize.x, 0.5 * uWorldSize.x, tx),
    (elevation - uRenderOrigin) * uVerticalScale,
    mix(-0.5 * uWorldSize.y, 0.5 * uWorldSize.y, tz)
  );
  vSourcePosition = vec2(float(sourceX), float(sourceY));
  vElevation = elevation;
  gl_Position = uViewProjection * vec4(worldPosition, 1.0);
}`;

  const TERRAIN_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D uHeight;
uniform ivec2 uSourceSize;
uniform vec2 uSourceSpacing;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uVerticalScale;
in vec2 vSourcePosition;
in float vElevation;
out vec4 outColor;
float decodeHeight(uint code, float fallbackValue) {
  return code == 65535u ? fallbackValue : mix(uMinElevation, uMaxElevation, float(code) / 65534.0);
}
vec3 elevationRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.18) return mix(vec3(0.035,0.185,0.105), vec3(0.075,0.305,0.145), t / 0.18);
  if (t < 0.38) return mix(vec3(0.075,0.305,0.145), vec3(0.230,0.405,0.190), (t - 0.18) / 0.20);
  if (t < 0.58) return mix(vec3(0.230,0.405,0.190), vec3(0.440,0.475,0.245), (t - 0.38) / 0.20);
  if (t < 0.76) return mix(vec3(0.440,0.475,0.245), vec3(0.650,0.575,0.370), (t - 0.58) / 0.18);
  if (t < 0.90) return mix(vec3(0.650,0.575,0.370), vec3(0.690,0.690,0.635), (t - 0.76) / 0.14);
  return mix(vec3(0.690,0.690,0.635), vec3(0.930,0.925,0.875), (t - 0.90) / 0.10);
}
void main() {
  ivec2 p = clamp(ivec2(round(vSourcePosition)), ivec2(0), uSourceSize - 1);
  float center = vElevation;
  float leftHeight = decodeHeight(texelFetch(uHeight, ivec2(max(p.x - 1, 0), p.y), 0).r, center);
  float rightHeight = decodeHeight(texelFetch(uHeight, ivec2(min(p.x + 1, uSourceSize.x - 1), p.y), 0).r, center);
  float northHeight = decodeHeight(texelFetch(uHeight, ivec2(p.x, max(p.y - 1, 0)), 0).r, center);
  float southHeight = decodeHeight(texelFetch(uHeight, ivec2(p.x, min(p.y + 1, uSourceSize.y - 1)), 0).r, center);
  float slopeX = (rightHeight - leftHeight) * uVerticalScale / max(2.0 * uSourceSpacing.x, 0.001);
  float slopeZ = (southHeight - northHeight) * uVerticalScale / max(2.0 * uSourceSpacing.y, 0.001);
  vec3 normal = normalize(vec3(-slopeX, 1.0, -slopeZ));
  vec3 lightDirection = normalize(vec3(-0.48, 0.72, 0.50));
  float directLight = max(dot(normal, lightDirection), 0.0);
  float skyLight = 0.44 + 0.18 * normal.y;
  float t = (vElevation - uMinElevation) / max(uMaxElevation - uMinElevation, 1.0);
  vec3 base = elevationRamp(t);
  float contour = 0.985 + 0.015 * smoothstep(0.45, 0.55, abs(fract(vElevation / 100.0) - 0.5));
  float detail = 0.94 + 0.10 * clamp(length(vec2(slopeX, slopeZ)) * 2.0, 0.0, 1.0);
  vec3 color = base * (skyLight + directLight * 0.72) * contour * detail;
  float haze = smoothstep(0.72, 1.0, t) * 0.08;
  color = mix(color, vec3(0.93,0.94,0.90), haze);
  color = pow(max(color, vec3(0.0)), vec3(0.92));
  outColor = vec4(color, 1.0);
}`;

  const WATER_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 aPositionClass;
uniform highp usampler2D uHeight;
uniform ivec2 uSourceSize;
uniform vec2 uWorldSize;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uRenderOrigin;
uniform float uVerticalScale;
uniform float uSurfaceOffset;
uniform mat4 uViewProjection;
out float vClass;
void main() {
  vec2 uv = clamp(vec2(aPositionClass.x / uWorldSize.x + 0.5, aPositionClass.z / uWorldSize.y + 0.5), vec2(0.0), vec2(1.0));
  ivec2 p = ivec2(round(uv * vec2(uSourceSize - 1)));
  uint code = texelFetch(uHeight, p, 0).r;
  float elevation = code == 65535u ? aPositionClass.y - uSurfaceOffset : mix(uMinElevation, uMaxElevation, float(code) / 65534.0);
  vec3 worldPosition = vec3(aPositionClass.x, (elevation + uSurfaceOffset - uRenderOrigin) * uVerticalScale, aPositionClass.z);
  vClass = aPositionClass.w;
  gl_Position = uViewProjection * vec4(worldPosition, 1.0);
}`;

  const WATER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vClass;
out vec4 outColor;
void main() {
  vec3 color = vec3(0.10, 0.42, 0.54);
  float alpha = 0.82;
  if (vClass > 1.5) {
    color = vec3(0.10, 0.58, 0.51);
    alpha = 0.90;
  } else if (vClass > 0.5) {
    color = vec3(0.10, 0.62, 0.78);
    alpha = 0.94;
  }
  outColor = vec4(color, alpha);
}`;

  function createHeightTexture(gl, codes) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, EXPECTED_GRID, EXPECTED_GRID, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, codes);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  function sampledSourceIndices(gridSize) {
    const result = new Int32Array(gridSize);
    const scale = (EXPECTED_GRID - 1) / (gridSize - 1);
    for (let index = 0; index < gridSize; index += 1) result[index] = Math.round(index * scale);
    return result;
  }

  function buildTerrainIndices(codes, gridSize) {
    const sourceColumns = sampledSourceIndices(gridSize);
    const sourceRows = sampledSourceIndices(gridSize);
    let validCellCount = 0;
    for (let row = 0; row < gridSize - 1; row += 1) {
      const sourceRow0 = sourceRows[row] * EXPECTED_GRID;
      const sourceRow1 = sourceRows[row + 1] * EXPECTED_GRID;
      for (let column = 0; column < gridSize - 1; column += 1) {
        const sourceColumn0 = sourceColumns[column];
        const sourceColumn1 = sourceColumns[column + 1];
        if (
          codes[sourceRow0 + sourceColumn0] !== NODATA_CODE &&
          codes[sourceRow0 + sourceColumn1] !== NODATA_CODE &&
          codes[sourceRow1 + sourceColumn0] !== NODATA_CODE &&
          codes[sourceRow1 + sourceColumn1] !== NODATA_CODE
        ) validCellCount += 1;
      }
    }
    const indices = new Uint32Array(validCellCount * 6);
    let cursor = 0;
    for (let row = 0; row < gridSize - 1; row += 1) {
      const sourceRow0 = sourceRows[row] * EXPECTED_GRID;
      const sourceRow1 = sourceRows[row + 1] * EXPECTED_GRID;
      const vertexRow0 = row * gridSize;
      const vertexRow1 = (row + 1) * gridSize;
      for (let column = 0; column < gridSize - 1; column += 1) {
        const sourceColumn0 = sourceColumns[column];
        const sourceColumn1 = sourceColumns[column + 1];
        if (
          codes[sourceRow0 + sourceColumn0] === NODATA_CODE ||
          codes[sourceRow0 + sourceColumn1] === NODATA_CODE ||
          codes[sourceRow1 + sourceColumn0] === NODATA_CODE ||
          codes[sourceRow1 + sourceColumn1] === NODATA_CODE
        ) continue;
        const a = vertexRow0 + column;
        const b = a + 1;
        const c = vertexRow1 + column;
        const d = c + 1;
        indices[cursor++] = a;
        indices[cursor++] = c;
        indices[cursor++] = b;
        indices[cursor++] = b;
        indices[cursor++] = c;
        indices[cursor++] = d;
      }
    }
    return { indices, validCellCount };
  }

  function setupPrograms(gl) {
    state.terrainProgram = createProgram(gl, TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER);
    state.terrainUniforms = {
      height: gl.getUniformLocation(state.terrainProgram, 'uHeight'),
      sourceSize: gl.getUniformLocation(state.terrainProgram, 'uSourceSize'),
      gridSize: gl.getUniformLocation(state.terrainProgram, 'uGridSize'),
      worldSize: gl.getUniformLocation(state.terrainProgram, 'uWorldSize'),
      sourceSpacing: gl.getUniformLocation(state.terrainProgram, 'uSourceSpacing'),
      minElevation: gl.getUniformLocation(state.terrainProgram, 'uMinElevation'),
      maxElevation: gl.getUniformLocation(state.terrainProgram, 'uMaxElevation'),
      renderOrigin: gl.getUniformLocation(state.terrainProgram, 'uRenderOrigin'),
      verticalScale: gl.getUniformLocation(state.terrainProgram, 'uVerticalScale'),
      viewProjection: gl.getUniformLocation(state.terrainProgram, 'uViewProjection'),
    };
    state.terrainVao = gl.createVertexArray();
    state.terrainIndexBuffer = gl.createBuffer();

    state.waterProgram = createProgram(gl, WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER);
    state.waterUniforms = {
      height: gl.getUniformLocation(state.waterProgram, 'uHeight'),
      sourceSize: gl.getUniformLocation(state.waterProgram, 'uSourceSize'),
      worldSize: gl.getUniformLocation(state.waterProgram, 'uWorldSize'),
      minElevation: gl.getUniformLocation(state.waterProgram, 'uMinElevation'),
      maxElevation: gl.getUniformLocation(state.waterProgram, 'uMaxElevation'),
      renderOrigin: gl.getUniformLocation(state.waterProgram, 'uRenderOrigin'),
      verticalScale: gl.getUniformLocation(state.waterProgram, 'uVerticalScale'),
      surfaceOffset: gl.getUniformLocation(state.waterProgram, 'uSurfaceOffset'),
      viewProjection: gl.getUniformLocation(state.waterProgram, 'uViewProjection'),
    };
    state.waterVao = gl.createVertexArray();
    state.waterBuffer = gl.createBuffer();
  }

  function uploadTerrainIndices(gl, gridSize) {
    const { indices, validCellCount } = buildTerrainIndices(state.codes, gridSize);
    gl.bindVertexArray(state.terrainVao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.terrainIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    state.renderGrid = gridSize;
    state.terrainIndexCount = indices.length;
    state.validCellCount = validCellCount;
    $('meshGrid').textContent = `${gridSize} × ${gridSize}`;
    $('triangleCount').textContent = (validCellCount * 2).toLocaleString();
    renderInfo.textContent = `WebGL2 · 2048 高程采样 · ${gridSize} 实时网格 · 水系 ${state.waterVertexCount.toLocaleString()} 顶点`;
    state.dirty = true;
    updateQaResult();
  }

  function uploadWater(gl, waterFloats) {
    gl.bindVertexArray(state.waterVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.waterBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, waterFloats, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);
    state.waterVertexCount = waterFloats.length / 4;
  }

  function mat4Perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  }

  function mat4LookAt(out, eye, center, up) {
    let zx = eye[0] - center[0];
    let zy = eye[1] - center[1];
    let zz = eye[2] - center[2];
    let length = Math.hypot(zx, zy, zz) || 1;
    zx /= length; zy /= length; zz /= length;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    length = Math.hypot(xx, xy, xz) || 1;
    xx /= length; xy /= length; xz /= length;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function mat4Multiply(out, a, b) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        result[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    out.set(result);
    return out;
  }

  function cameraEye() {
    const camera = state.camera;
    const horizontal = Math.cos(camera.pitch) * camera.distance;
    return [
      camera.target[0] + Math.sin(camera.yaw) * horizontal,
      camera.target[1] + Math.sin(camera.pitch) * camera.distance,
      camera.target[2] + Math.cos(camera.yaw) * horizontal,
    ];
  }

  function resizeCanvas() {
    const ratio = Math.min(MAX_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1);
    const width = Math.max(2, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(2, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      state.dirty = true;
    }
  }

  function updateCameraMatrices() {
    resizeCanvas();
    const eye = cameraEye();
    const near = Math.max(10, state.camera.distance / 6000);
    const far = state.camera.distance + Math.max(state.worldWidth, state.worldDepth) * 5;
    mat4Perspective(state.projection, Math.PI / 4.2, canvas.width / Math.max(1, canvas.height), near, far);
    mat4LookAt(state.view, eye, state.camera.target, [0, 1, 0]);
    mat4Multiply(state.viewProjection, state.projection, state.view);
  }

  function drawTerrain(gl) {
    const manifest = state.terrainManifest;
    const uniforms = state.terrainUniforms;
    gl.useProgram(state.terrainProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.heightTexture);
    gl.uniform1i(uniforms.height, 0);
    gl.uniform2i(uniforms.sourceSize, EXPECTED_GRID, EXPECTED_GRID);
    gl.uniform1i(uniforms.gridSize, state.renderGrid);
    gl.uniform2f(uniforms.worldSize, state.worldWidth, state.worldDepth);
    gl.uniform2f(uniforms.sourceSpacing, manifest.output_spacing_xy_m[0], manifest.output_spacing_xy_m[1]);
    gl.uniform1f(uniforms.minElevation, manifest.elevation_range_m[0]);
    gl.uniform1f(uniforms.maxElevation, manifest.elevation_range_m[1]);
    gl.uniform1f(uniforms.renderOrigin, state.renderOriginElevation);
    gl.uniform1f(uniforms.verticalScale, state.verticalScale);
    gl.uniformMatrix4fv(uniforms.viewProjection, false, state.viewProjection);
    gl.bindVertexArray(state.terrainVao);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.drawElements(gl.TRIANGLES, state.terrainIndexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  function drawWater(gl) {
    if (!state.waterVisible || !state.waterVertexCount) return;
    const uniforms = state.waterUniforms;
    gl.useProgram(state.waterProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.heightTexture);
    gl.uniform1i(uniforms.height, 0);
    gl.uniform2i(uniforms.sourceSize, EXPECTED_GRID, EXPECTED_GRID);
    gl.uniform2f(uniforms.worldSize, state.worldWidth, state.worldDepth);
    gl.uniform1f(uniforms.minElevation, state.terrainManifest.elevation_range_m[0]);
    gl.uniform1f(uniforms.maxElevation, state.terrainManifest.elevation_range_m[1]);
    gl.uniform1f(uniforms.renderOrigin, state.renderOriginElevation);
    gl.uniform1f(uniforms.verticalScale, state.verticalScale);
    gl.uniform1f(uniforms.surfaceOffset, state.waterManifest.water_surface_offset_m);
    gl.uniformMatrix4fv(uniforms.viewProjection, false, state.viewProjection);
    gl.bindVertexArray(state.waterVao);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, state.waterVertexCount);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  function renderScene() {
    const gl = state.gl;
    if (!gl || !state.terrainIndexCount) return;
    updateCameraMatrices();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.84, 0.89, 0.86, 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawTerrain(gl);
    drawWater(gl);
    state.frameCount += 1;
    updateLabels();
    state.dirty = false;
  }

  function renderLoop() {
    if (state.dirty) renderScene();
    requestAnimationFrame(renderLoop);
  }

  function sampleElevationAtUtm(easting, northing) {
    const manifest = state.terrainManifest;
    if (!manifest || !state.codes) return null;
    const [west, south, east, north] = manifest.aoi_bounds_epsg32649;
    const column = clamp(Math.round((easting - west) / (east - west) * (EXPECTED_GRID - 1)), 0, EXPECTED_GRID - 1);
    const row = clamp(Math.round((north - northing) / (north - south) * (EXPECTED_GRID - 1)), 0, EXPECTED_GRID - 1);
    const code = state.codes[row * EXPECTED_GRID + column];
    if (code === NODATA_CODE) return null;
    const [minimum, maximum] = manifest.elevation_range_m;
    return minimum + code / 65534 * (maximum - minimum);
  }

  function makeLabels() {
    labelLayer.replaceChildren();
    state.labels = [];
    const [centerE, centerN] = state.terrainManifest.aoi_center_epsg32649;
    for (const landmark of LANDMARKS) {
      if (
        landmark.e < EXPECTED_AOI_BOUNDS[0] || landmark.e > EXPECTED_AOI_BOUNDS[2] ||
        landmark.n < EXPECTED_AOI_BOUNDS[1] || landmark.n > EXPECTED_AOI_BOUNDS[3]
      ) continue;
      const elevation = sampleElevationAtUtm(landmark.e, landmark.n);
      if (elevation === null) continue;
      const element = document.createElement('div');
      element.className = 'landmark-label';
      element.textContent = landmark.name;
      labelLayer.appendChild(element);
      state.labels.push({
        element,
        x: landmark.e - centerE,
        z: centerN - landmark.n,
        elevation,
      });
    }
  }

  function projectWorld(x, y, z) {
    const matrix = state.viewProjection;
    const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const clipZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (clipW <= 0) return null;
    const nx = clipX / clipW;
    const ny = clipY / clipW;
    const nz = clipZ / clipW;
    if (nx < -1.12 || nx > 1.12 || ny < -1.12 || ny > 1.12 || nz < -1 || nz > 1) return null;
    return [
      (nx * 0.5 + 0.5) * canvas.clientWidth,
      (1 - (ny * 0.5 + 0.5)) * canvas.clientHeight,
    ];
  }

  function updateLabels() {
    for (const label of state.labels) {
      const y = (label.elevation - state.renderOriginElevation) * state.verticalScale + 10;
      const projected = projectWorld(label.x, y, label.z);
      if (!projected) {
        label.element.hidden = true;
        continue;
      }
      label.element.hidden = false;
      label.element.style.left = `${projected[0]}px`;
      label.element.style.top = `${projected[1]}px`;
    }
  }

  function setView(name) {
    const span = Math.max(state.worldWidth, state.worldDepth);
    const relief = Math.max(1, state.terrainManifest.elevation_range_m[1] - state.terrainManifest.elevation_range_m[0]);
    const camera = state.camera;
    camera.target = [0, relief * 0.20 * state.verticalScale, 0];
    if (name === 'north') {
      camera.yaw = 0;
      camera.pitch = 1.545;
      camera.distance = span * 0.92;
    } else if (name === 'low') {
      camera.yaw = -0.95;
      camera.pitch = 0.18;
      camera.distance = span * 0.83;
      camera.target[1] = relief * 0.28 * state.verticalScale;
    } else if (name === 'guilin') {
      const guilin = LANDMARKS.find(item => item.id === 'guilin');
      const [centerE, centerN] = state.terrainManifest.aoi_center_epsg32649;
      const elevation = sampleElevationAtUtm(guilin.e, guilin.n) ?? state.renderOriginElevation;
      camera.target = [guilin.e - centerE, (elevation - state.renderOriginElevation) * state.verticalScale, centerN - guilin.n];
      camera.yaw = -0.62;
      camera.pitch = 0.34;
      camera.distance = span * 0.38;
    } else {
      camera.yaw = -0.72;
      camera.pitch = 0.58;
      camera.distance = span * 1.22;
    }
    camera.distance = clamp(camera.distance, camera.minDistance, camera.maxDistance);
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    state.dirty = true;
  }

  function bindControls() {
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, button: event.button });
      if (state.pointers.size === 2) {
        const points = Array.from(state.pointers.values());
        state.pinch = { distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) };
      }
    });
    canvas.addEventListener('pointermove', event => {
      const previous = state.pointers.get(event.pointerId);
      if (!previous) return;
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, button: previous.button });
      if (state.pointers.size >= 2) {
        const points = Array.from(state.pointers.values());
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        if (state.pinch && state.pinch.distance > 0) {
          state.camera.distance = clamp(state.camera.distance * state.pinch.distance / Math.max(distance, 1), state.camera.minDistance, state.camera.maxDistance);
          state.dirty = true;
        }
        state.pinch = { distance };
        return;
      }
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (previous.button === 2 || event.shiftKey) {
        const scale = state.camera.distance / Math.max(300, canvas.clientHeight);
        const rightX = Math.cos(state.camera.yaw);
        const rightZ = -Math.sin(state.camera.yaw);
        const forwardX = Math.sin(state.camera.yaw);
        const forwardZ = Math.cos(state.camera.yaw);
        state.camera.target[0] -= rightX * dx * scale;
        state.camera.target[2] -= rightZ * dx * scale;
        state.camera.target[0] += forwardX * dy * scale;
        state.camera.target[2] += forwardZ * dy * scale;
      } else {
        state.camera.yaw -= dx * 0.006;
        state.camera.pitch = clamp(state.camera.pitch + dy * 0.0045, 0.05, 1.56);
      }
      state.dirty = true;
    });
    const releasePointer = event => {
      state.pointers.delete(event.pointerId);
      if (state.pointers.size < 2) state.pinch = null;
    };
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      state.camera.distance = clamp(state.camera.distance * Math.exp(event.deltaY * 0.0011), state.camera.minDistance, state.camera.maxDistance);
      state.dirty = true;
    }, { passive: false });

    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
    $('resetView').addEventListener('click', () => setView('overview'));
    $('verticalScale').addEventListener('change', event => {
      state.verticalScale = Number(event.target.value);
      setView(document.querySelector('[data-view].active')?.dataset.view || 'overview');
      updateQaResult();
    });
    $('toggleWater').addEventListener('change', event => {
      state.waterVisible = event.target.checked;
      state.dirty = true;
      updateQaResult();
    });
    $('togglePanel').addEventListener('click', event => {
      const hidden = viewerShell.classList.toggle('panel-hidden');
      event.currentTarget.textContent = hidden ? '展开数据' : '收起数据';
      event.currentTarget.setAttribute('aria-expanded', String(!hidden));
    });
    $('renderQuality').addEventListener('change', async event => {
      const quality = Number(event.target.value);
      event.target.disabled = true;
      setProgress(92, `构建 ${quality} × ${quality} 实时网格`, '保留 2048 数值高程作为着色与坡面法线来源');
      loadingCard.hidden = false;
      await new Promise(resolve => requestAnimationFrame(resolve));
      try {
        uploadTerrainIndices(state.gl, quality);
        loadingCard.hidden = true;
      } finally {
        event.target.disabled = false;
      }
    });
    $('showFallback').addEventListener('click', () => showFallback());
    window.addEventListener('resize', () => { state.dirty = true; });
    new ResizeObserver(() => { state.dirty = true; }).observe(viewerShell);
  }

  function fallbackColor(code, minimum, maximum) {
    if (code === NODATA_CODE) return [222, 229, 223, 255];
    const elevation = minimum + code / 65534 * (maximum - minimum);
    const t = clamp((elevation - minimum) / Math.max(1, maximum - minimum), 0, 1);
    const stops = [
      [0, [14, 61, 39]], [0.24, [30, 103, 55]], [0.5, [99, 127, 69]],
      [0.72, [164, 143, 91]], [0.9, [180, 179, 160]], [1, [235, 233, 222]],
    ];
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let index = 0; index < stops.length - 1; index += 1) {
      if (t >= stops[index][0] && t <= stops[index + 1][0]) { left = stops[index]; right = stops[index + 1]; break; }
    }
    const local = (t - left[0]) / Math.max(1e-6, right[0] - left[0]);
    return [0, 1, 2].map(channel => Math.round(left[1][channel] + (right[1][channel] - left[1][channel]) * local)).concat(255);
  }

  function buildFallback() {
    if (state.fallbackReady || !state.codes) return;
    const size = 768;
    fallbackCanvas.width = size;
    fallbackCanvas.height = size;
    const context = fallbackCanvas.getContext('2d', { alpha: false });
    const image = context.createImageData(size, size);
    const [minimum, maximum] = state.terrainManifest.elevation_range_m;
    for (let row = 0; row < size; row += 1) {
      const sourceRow = Math.round(row * (EXPECTED_GRID - 1) / (size - 1));
      for (let column = 0; column < size; column += 1) {
        const sourceColumn = Math.round(column * (EXPECTED_GRID - 1) / (size - 1));
        const color = fallbackColor(state.codes[sourceRow * EXPECTED_GRID + sourceColumn], minimum, maximum);
        const offset = (row * size + column) * 4;
        image.data[offset] = color[0];
        image.data[offset + 1] = color[1];
        image.data[offset + 2] = color[2];
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    state.fallbackReady = true;
  }

  function showFallback() {
    buildFallback();
    fallbackCanvas.hidden = false;
    canvas.hidden = true;
    labelLayer.hidden = true;
    errorCard.hidden = true;
    renderInfo.textContent = '二维 2048 数值高程备用预览';
  }

  function populateMetrics() {
    const terrain = state.terrainManifest;
    const water = state.waterManifest;
    $('sourceGrid').textContent = `${terrain.output_grid[0]} × ${terrain.output_grid[1]}`;
    $('elevationRange').textContent = `${terrain.elevation_range_m[0].toFixed(0)} 至 ${terrain.elevation_range_m[1].toFixed(0)} m`;
    $('nodataCount').textContent = `${terrain.nodata_sample_count.toLocaleString()} · ${(terrain.nodata_sample_count / (EXPECTED_GRID * EXPECTED_GRID) * 100).toFixed(2)}%`;
    const clipped = water.clipped_feature_counts;
    $('waterFeatures').textContent = (clipped.li + clipped.xiang + clipped.other).toLocaleString();
    $('waterSegments').textContent = water.emitted_segment_count.toLocaleString();
    $('waterVertices').textContent = water.vertex_count.toLocaleString();
    $('waterBreaks').textContent = water.nodata_break_count.toLocaleString();
  }

  function updateQaResult() {
    if (!state.terrainManifest || !state.waterManifest) return;
    const passed =
      document.body.dataset.ready === 'true' &&
      runtimeErrors.length === 0 &&
      state.terrainManifest.output_grid?.[0] === EXPECTED_GRID &&
      state.terrainManifest.output_grid?.[1] === EXPECTED_GRID &&
      state.terrainManifest.gap_fill_applied === false &&
      state.terrainManifest.fallback_30m_used === false &&
      state.waterManifest.centerline_coordinates_mutated === false &&
      state.waterVertexCount > 0 && state.validCellCount > 0;
    window.__GUILIN_V075_QA_RESULT = {
      schema: 'guilin-v075-2048-hydrology-browser-qa/v1',
      passed,
      release: document.body.dataset.release,
      data_ready: document.body.dataset.ready === 'true',
      aoi_status: state.aoi?.status,
      aoi_geometry_sha256: state.aoi?.geometry_sha256,
      source_resolution_m: 12.5,
      source_grid: state.terrainManifest.output_grid,
      terrain_height_bytes: state.terrainManifest.stored_bytes,
      terrain_height_sha256: state.terrainManifest.sha256,
      render_grid: [state.renderGrid, state.renderGrid],
      valid_triangle_count: state.validCellCount * 2,
      water_loaded: state.waterVertexCount > 0,
      water_visible: state.waterVisible,
      water_vertex_count: state.waterVertexCount,
      water_segment_count: state.waterManifest.emitted_segment_count,
      water_nodata_break_count: state.waterManifest.nodata_break_count,
      centerline_coordinates_mutated: state.waterManifest.centerline_coordinates_mutated,
      gap_fill_applied: false,
      fallback_30m_used: false,
      default_vertical_scale: Number($('verticalScale').value),
      webgl2: Boolean(state.gl),
      webgl_renderer: state.gl ? state.gl.getParameter(state.gl.RENDERER) : null,
      webgl_vendor: state.gl ? state.gl.getParameter(state.gl.VENDOR) : null,
      max_texture_size: state.gl ? state.gl.getParameter(state.gl.MAX_TEXTURE_SIZE) : 0,
      runtime_errors: [...runtimeErrors],
    };
  }

  async function initialize() {
    setProgress(8, '读取确认范围与数据合同', '锁定 33,113.874 km² AOI');
    const [terrainManifest, waterManifest, aoi] = await Promise.all([
      fetchJson(TERRAIN_MANIFEST_URL),
      fetchJson(WATER_MANIFEST_URL),
      fetchJson(AOI_URL),
    ]);
    state.terrainManifest = terrainManifest;
    state.waterManifest = waterManifest;
    state.aoi = aoi;

    setProgress(24, '读取 2048 × 2048 数值高程', '8,388,608 字节，NoData 原样保留');
    const heightBuffer = await fetchBinary(TERRAIN_HEIGHT_URL);
    setProgress(48, '读取水系采样三角网格', '漓江、湘江与其他河流按中心线贴地');
    const waterBuffer = await fetchBinary(WATER_BUFFER_URL);

    setProgress(62, '核对高程与水系哈希', '验证真值来源、AOI 和水系中心线合同');
    const [heightSha, waterSha] = await Promise.all([sha256Hex(heightBuffer), sha256Hex(waterBuffer)]);
    validateContracts(terrainManifest, waterManifest, aoi, heightBuffer, waterBuffer, heightSha, waterSha);
    state.codes = decodeUint16(heightBuffer);
    state.waterFloats = decodeFloat32(waterBuffer);
    state.worldWidth = terrainManifest.aoi_world_size_m[0];
    state.worldDepth = terrainManifest.aoi_world_size_m[1];
    state.renderOriginElevation = terrainManifest.elevation_range_m[0];
    state.camera.minDistance = Math.max(5000, Math.min(state.worldWidth, state.worldDepth) * 0.03);
    state.camera.maxDistance = Math.max(state.worldWidth, state.worldDepth) * 5.5;

    setProgress(72, '初始化 WebGL2 地形渲染', '2048 高程纹理参与坡面法线与着色');
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    assert(gl, '当前浏览器无法建立 WebGL2 三维环境');
    state.gl = gl;
    setupPrograms(gl);
    state.heightTexture = createHeightTexture(gl, state.codes);
    uploadWater(gl, state.waterFloats);

    setProgress(82, `构建 ${state.renderGrid} × ${state.renderGrid} 实时地形`, '三角形按 NoData 保守剔除');
    await new Promise(resolve => requestAnimationFrame(resolve));
    uploadTerrainIndices(gl, state.renderGrid);
    populateMetrics();
    makeLabels();
    bindControls();
    setView('overview');
    if (window.innerWidth < 600) viewerShell.classList.add('panel-hidden');

    setProgress(100, '2048 高程与水系已就绪', '可以旋转、缩放和切换实时网格');
    renderLoop();
    await new Promise(resolve => requestAnimationFrame(resolve));
    state.dirty = true;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const glError = gl.getError();
    assert(glError === gl.NO_ERROR, `WebGL2 初始绘制错误：${glError}`);
    loadingCard.hidden = true;
    document.body.dataset.ready = 'true';
    setReadyStatus('2048 高程与水系已载入');
    updateQaResult();
  }

  initialize().catch(error => {
    console.error(error);
    runtimeErrors.push(String(error?.message || error));
    setErrorStatus(String(error?.message || error));
    if (state.codes) {
      buildFallback();
      fallbackCanvas.hidden = false;
      canvas.hidden = true;
      labelLayer.hidden = true;
    }
    updateQaResult();
  });
})();
