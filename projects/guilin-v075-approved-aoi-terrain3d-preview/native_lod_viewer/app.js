(() => {
  'use strict';

  const MANIFEST_URL = 'data/native_lod_manifest.json';
  const EXPECTED_SOURCE_SHA = '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
  const EXPECTED_AOI_SHA = '36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80';
  const EXPECTED_TILE_BYTES = 8_388_608;
  const SOURCE_SPACING_M = 12.5;
  const TILE_GRID = 2048;
  const NODATA = 0;
  const NATIVE_WINDOW = 512;
  const MAX_DEVICE_PIXEL_RATIO = 1.75;

  const $ = id => document.getElementById(id);
  const canvas = $('terrainCanvas');
  const loadingCard = $('loadingCard');
  const loadingDetail = $('loadingDetail');
  const errorCard = $('errorCard');
  const errorMessage = $('errorMessage');
  const labelLayer = $('labelLayer');
  const controlPanel = $('controlPanel');
  const togglePanel = $('togglePanel');
  const renderInfo = $('renderInfo');

  const runtimeErrors = [];
  window.addEventListener('error', event => runtimeErrors.push(String(event.error?.stack || event.message || 'window error')));
  window.addEventListener('unhandledrejection', event => runtimeErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection')));

  const state = {
    gl: null,
    program: null,
    vao: null,
    indexBuffer: null,
    heightTexture: null,
    uniforms: {},
    manifest: null,
    tileById: new Map(),
    anchorById: new Map(),
    tileCache: new Map(),
    currentTile: null,
    currentAnchor: null,
    codes: null,
    currentTileSha: null,
    mode: 'overview',
    overviewGrid: 512,
    renderGrid: 0,
    sourceWindow: { x: 0, y: 0, width: TILE_GRID, height: TILE_GRID },
    worldWidth: 1,
    worldDepth: 1,
    renderOriginElevation: 0,
    maxElevation: 1,
    indexCount: 0,
    validTriangleCount: 0,
    projection: new Float32Array(16),
    view: new Float32Array(16),
    viewProjection: new Float32Array(16),
    camera: {
      target: [0, 0, 0],
      yaw: -0.72,
      pitch: 0.58,
      distance: 28_000,
      minDistance: 80,
      maxDistance: 180_000,
    },
    dirty: true,
    frameCount: 0,
    lastFrameTimestamp: performance.now(),
    fps: 0,
    pointers: new Map(),
    pinch: null,
    labelsVisible: true,
    labels: [],
    loadToken: 0,
    qaReady: false,
  };

  const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform highp usampler2D uHeight;
uniform ivec2 uSourceOffset;
uniform ivec2 uWindowSize;
uniform int uGridSize;
uniform vec2 uWorldSize;
uniform float uRenderOrigin;
uniform float uVerticalScale;
uniform mat4 uViewProjection;
out vec2 vSourcePosition;
out float vElevation;
void main() {
  int column = gl_VertexID % uGridSize;
  int row = gl_VertexID / uGridSize;
  int sourceX = uSourceOffset.x + int(round(float(column) * float(uWindowSize.x - 1) / float(uGridSize - 1)));
  int sourceY = uSourceOffset.y + int(round(float(row) * float(uWindowSize.y - 1) / float(uGridSize - 1)));
  uint code = texelFetch(uHeight, ivec2(sourceX, sourceY), 0).r;
  float elevation = float(code);
  float fx = float(sourceX - uSourceOffset.x) / max(1.0, float(uWindowSize.x - 1));
  float fy = float(sourceY - uSourceOffset.y) / max(1.0, float(uWindowSize.y - 1));
  vec3 worldPosition = vec3(
    (fx - 0.5) * uWorldSize.x,
    (elevation - uRenderOrigin) * uVerticalScale,
    (fy - 0.5) * uWorldSize.y
  );
  vSourcePosition = vec2(float(sourceX), float(sourceY));
  vElevation = elevation;
  gl_Position = uViewProjection * vec4(worldPosition, 1.0);
}`;

  const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform highp usampler2D uHeight;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uSourceSpacing;
uniform float uVerticalScale;
in vec2 vSourcePosition;
in float vElevation;
out vec4 outColor;
float sampleHeight(ivec2 p, float fallbackValue) {
  ivec2 size = textureSize(uHeight, 0);
  ivec2 q = clamp(p, ivec2(0), size - 1);
  uint code = texelFetch(uHeight, q, 0).r;
  return code == 0u ? fallbackValue : float(code);
}
vec3 terrainRamp(float t, float slope) {
  vec3 valley = vec3(0.075, 0.245, 0.145);
  vec3 forest = vec3(0.155, 0.335, 0.185);
  vec3 upland = vec3(0.36, 0.405, 0.245);
  vec3 rock = vec3(0.49, 0.49, 0.43);
  vec3 high = vec3(0.72, 0.71, 0.65);
  vec3 color;
  if (t < 0.25) color = mix(valley, forest, t / 0.25);
  else if (t < 0.58) color = mix(forest, upland, (t - 0.25) / 0.33);
  else if (t < 0.82) color = mix(upland, rock, (t - 0.58) / 0.24);
  else color = mix(rock, high, (t - 0.82) / 0.18);
  return mix(color, vec3(0.58, 0.56, 0.50), smoothstep(0.28, 0.9, slope) * 0.48);
}
void main() {
  ivec2 p = ivec2(round(vSourcePosition));
  float leftH = sampleHeight(p + ivec2(-1, 0), vElevation);
  float rightH = sampleHeight(p + ivec2(1, 0), vElevation);
  float upH = sampleHeight(p + ivec2(0, -1), vElevation);
  float downH = sampleHeight(p + ivec2(0, 1), vElevation);
  float dx = (rightH - leftH) * uVerticalScale / (2.0 * uSourceSpacing);
  float dz = (downH - upH) * uVerticalScale / (2.0 * uSourceSpacing);
  vec3 normal = normalize(vec3(-dx, 1.0, -dz));
  float slope = 1.0 - normal.y;
  float t = clamp((vElevation - uMinElevation) / max(1.0, uMaxElevation - uMinElevation), 0.0, 1.0);
  vec3 base = terrainRamp(t, slope);
  vec3 sun = normalize(vec3(-0.52, 0.78, 0.34));
  float diffuse = max(dot(normal, sun), 0.0);
  float soft = max(dot(normal, normalize(vec3(0.35, 0.55, -0.45))), 0.0);
  float light = 0.34 + diffuse * 0.52 + soft * 0.14;
  float ridge = smoothstep(0.2, 0.72, slope) * 0.08;
  vec3 color = base * light + vec3(ridge);
  color = pow(max(color, vec3(0.0)), vec3(0.92));
  outColor = vec4(color, 1.0);
}`;

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
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
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setUint16(0, 0x00ff, true);
    return new Uint16Array(buffer)[0] === 0x00ff;
  }

  function decodeInt16LittleEndian(buffer) {
    assert(buffer.byteLength === EXPECTED_TILE_BYTES, `瓦片字节数不正确：${buffer.byteLength}`);
    if (isLittleEndian()) return new Uint16Array(buffer);
    const view = new DataView(buffer);
    const result = new Uint16Array(buffer.byteLength / 2);
    for (let index = 0; index < result.length; index += 1) result[index] = view.getUint16(index * 2, true);
    return result;
  }

  function validateManifest(manifest) {
    assert(manifest?.schema === 'guilin-v077-native-lod-manifest/v1', '原生 LOD 清单版本不正确');
    assert(manifest.status === 'foundation', '原生 LOD 阶段状态不正确');
    assert(manifest.source?.sha256 === EXPECTED_SOURCE_SHA, '源 TIFF SHA256 不正确');
    assert(manifest.aoi?.geometry_sha256 === EXPECTED_AOI_SHA, 'AOI 几何 SHA256 不正确');
    assert(manifest.source?.crs === 'EPSG:32649', '源坐标系不正确');
    assert(Array.isArray(manifest.source?.resolution_m) && manifest.source.resolution_m.every(value => Number(value) === SOURCE_SPACING_M), '源像元必须为 12.5 米');
    assert(manifest.source?.dtype === 'int16' && manifest.source?.nodata === NODATA, '源数据类型或 NoData 不正确');
    assert(Array.isArray(manifest.tile_matrix?.stored_grid) && manifest.tile_matrix.stored_grid[0] === TILE_GRID && manifest.tile_matrix.stored_grid[1] === TILE_GRID, '瓦片网格必须为 2048 × 2048');
    assert(manifest.tile_matrix?.expected_tile_bytes === EXPECTED_TILE_BYTES, '瓦片合同字节数不正确');
    assert(manifest.tile_matrix?.resampling === 'none', '原生瓦片禁止重采样');
    assert(manifest.rules?.source_resampling === false, '源重采样状态不正确');
    assert(manifest.rules?.gap_fill_applied === false, '补洞状态不正确');
    assert(manifest.rules?.fallback_30m_used === false, '30 米替代状态不正确');
    assert(manifest.rules?.source_elevation_modified_m === 0, '源高程发生修改');
    assert(manifest.rules?.vertical_scale === 1, '垂直比例必须为 1.00');
    assert(manifest.rules?.hydrology_centerline_mutated === false, '水系中心线状态不正确');
    assert(manifest.rules?.public_deployment_allowed === false, '本阶段禁止公开部署');
    assert(Array.isArray(manifest.tiles) && manifest.tiles.length >= 3, '原生瓦片数量不足');
    for (const tile of manifest.tiles) {
      assert(tile.stored_bytes === EXPECTED_TILE_BYTES, `${tile.id} 字节数合同不正确`);
      assert(tile.encoding === 'int16-little-endian-raw-elevation-m', `${tile.id} 编码不正确`);
      assert(tile.resampling === 'none' && tile.source_elevation_modified_m === 0, `${tile.id} 真值身份不正确`);
      assert(Array.isArray(tile.valid_grid) && tile.valid_grid[0] > 1 && tile.valid_grid[1] > 1, `${tile.id} 有效网格不正确`);
    }
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`着色器编译失败：${log}`);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`着色器链接失败：${log}`);
    }
    return program;
  }

  function setupWebGL() {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    assert(gl, '当前浏览器未提供 WebGL2');
    assert(gl.getParameter(gl.MAX_TEXTURE_SIZE) >= TILE_GRID, 'GPU 最大纹理尺寸低于 2048');
    state.gl = gl;
    state.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    state.uniforms = {
      height: gl.getUniformLocation(state.program, 'uHeight'),
      sourceOffset: gl.getUniformLocation(state.program, 'uSourceOffset'),
      windowSize: gl.getUniformLocation(state.program, 'uWindowSize'),
      gridSize: gl.getUniformLocation(state.program, 'uGridSize'),
      worldSize: gl.getUniformLocation(state.program, 'uWorldSize'),
      renderOrigin: gl.getUniformLocation(state.program, 'uRenderOrigin'),
      minElevation: gl.getUniformLocation(state.program, 'uMinElevation'),
      maxElevation: gl.getUniformLocation(state.program, 'uMaxElevation'),
      sourceSpacing: gl.getUniformLocation(state.program, 'uSourceSpacing'),
      verticalScale: gl.getUniformLocation(state.program, 'uVerticalScale'),
      viewProjection: gl.getUniformLocation(state.program, 'uViewProjection'),
    };
    state.vao = gl.createVertexArray();
    state.indexBuffer = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0.035, 0.065, 0.075, 1);
  }

  function uploadHeightTexture(codes) {
    const gl = state.gl;
    if (state.heightTexture) gl.deleteTexture(state.heightTexture);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, TILE_GRID, TILE_GRID, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, codes);
    gl.bindTexture(gl.TEXTURE_2D, null);
    state.heightTexture = texture;
  }

  function sourceIndexForGrid(gridIndex, gridSize, sourceOffset, sourceLength) {
    return sourceOffset + Math.round(gridIndex * (sourceLength - 1) / (gridSize - 1));
  }

  function buildIndices() {
    const gridSize = state.renderGrid;
    const { x, y, width, height } = state.sourceWindow;
    const maxIndices = (gridSize - 1) * (gridSize - 1) * 6;
    const indices = new Uint32Array(maxIndices);
    const sourceColumns = new Int32Array(gridSize);
    const sourceRows = new Int32Array(gridSize);
    for (let column = 0; column < gridSize; column += 1) sourceColumns[column] = sourceIndexForGrid(column, gridSize, x, width);
    for (let row = 0; row < gridSize; row += 1) sourceRows[row] = sourceIndexForGrid(row, gridSize, y, height);

    let cursor = 0;
    let validCells = 0;
    for (let row = 0; row < gridSize - 1; row += 1) {
      const sourceRow0 = sourceRows[row] * TILE_GRID;
      const sourceRow1 = sourceRows[row + 1] * TILE_GRID;
      for (let column = 0; column < gridSize - 1; column += 1) {
        const sourceColumn0 = sourceColumns[column];
        const sourceColumn1 = sourceColumns[column + 1];
        if (
          state.codes[sourceRow0 + sourceColumn0] === NODATA ||
          state.codes[sourceRow0 + sourceColumn1] === NODATA ||
          state.codes[sourceRow1 + sourceColumn0] === NODATA ||
          state.codes[sourceRow1 + sourceColumn1] === NODATA
        ) continue;
        const a = row * gridSize + column;
        const b = a + 1;
        const c = a + gridSize;
        const d = c + 1;
        indices[cursor++] = a;
        indices[cursor++] = c;
        indices[cursor++] = b;
        indices[cursor++] = b;
        indices[cursor++] = c;
        indices[cursor++] = d;
        validCells += 1;
      }
    }
    const gl = state.gl;
    gl.bindVertexArray(state.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.subarray(0, cursor), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    state.indexCount = cursor;
    state.validTriangleCount = validCells * 2;
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

  function cameraEye() {
    const camera = state.camera;
    const horizontal = Math.cos(camera.pitch) * camera.distance;
    return [
      camera.target[0] + Math.sin(camera.yaw) * horizontal,
      camera.target[1] + Math.sin(camera.pitch) * camera.distance,
      camera.target[2] + Math.cos(camera.yaw) * horizontal,
    ];
  }

  function updateCameraMatrices() {
    resizeCanvas();
    const eye = cameraEye();
    const span = Math.max(state.worldWidth, state.worldDepth);
    const near = Math.max(0.5, state.camera.distance / 8000);
    const far = state.camera.distance + span * 8 + Math.max(2000, state.maxElevation - state.renderOriginElevation);
    mat4Perspective(state.projection, Math.PI / 4.1, canvas.width / Math.max(1, canvas.height), near, far);
    mat4LookAt(state.view, eye, state.camera.target, [0, 1, 0]);
    mat4Multiply(state.viewProjection, state.projection, state.view);
  }

  function renderScene(timestamp = performance.now()) {
    if (!state.gl || !state.currentTile || !state.heightTexture || state.indexCount <= 0) return;
    updateCameraMatrices();
    const gl = state.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(state.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.heightTexture);
    gl.uniform1i(state.uniforms.height, 0);
    gl.uniform2i(state.uniforms.sourceOffset, state.sourceWindow.x, state.sourceWindow.y);
    gl.uniform2i(state.uniforms.windowSize, state.sourceWindow.width, state.sourceWindow.height);
    gl.uniform1i(state.uniforms.gridSize, state.renderGrid);
    gl.uniform2f(state.uniforms.worldSize, state.worldWidth, state.worldDepth);
    gl.uniform1f(state.uniforms.renderOrigin, state.renderOriginElevation);
    gl.uniform1f(state.uniforms.minElevation, state.currentTile.elevation_range_m[0]);
    gl.uniform1f(state.uniforms.maxElevation, state.currentTile.elevation_range_m[1]);
    gl.uniform1f(state.uniforms.sourceSpacing, SOURCE_SPACING_M);
    gl.uniform1f(state.uniforms.verticalScale, 1);
    gl.uniformMatrix4fv(state.uniforms.viewProjection, false, state.viewProjection);
    gl.bindVertexArray(state.vao);
    gl.drawElements(gl.TRIANGLES, state.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    state.frameCount += 1;
    const elapsed = timestamp - state.lastFrameTimestamp;
    if (elapsed >= 750) {
      state.fps = state.frameCount * 1000 / elapsed;
      state.frameCount = 0;
      state.lastFrameTimestamp = timestamp;
    }
    updateLabels();
    updateRenderInfo();
    state.dirty = false;
  }

  function renderLoop(timestamp) {
    if (state.dirty) renderScene(timestamp);
    requestAnimationFrame(renderLoop);
  }

  function sampleAt(col, row) {
    if (!state.codes) return null;
    const x = clamp(Math.round(col), 0, TILE_GRID - 1);
    const y = clamp(Math.round(row), 0, TILE_GRID - 1);
    const value = state.codes[y * TILE_GRID + x];
    return value === NODATA ? null : value;
  }

  function anchorPixel(anchor, tile) {
    const [westCenter, , , northCenter] = tile.source_sample_center_bounds_epsg32649;
    return {
      col: Math.round((anchor.e - westCenter) / SOURCE_SPACING_M),
      row: Math.round((northCenter - anchor.n) / SOURCE_SPACING_M),
    };
  }

  function computeWindow(mode, anchor) {
    const [validWidth, validHeight] = state.currentTile.valid_grid;
    if (mode === 'overview') return { x: 0, y: 0, width: validWidth, height: validHeight };
    let centerCol = Math.floor(validWidth / 2);
    let centerRow = Math.floor(validHeight / 2);
    if (anchor) {
      const pixel = anchorPixel(anchor, state.currentTile);
      centerCol = pixel.col;
      centerRow = pixel.row;
    }
    const width = Math.min(NATIVE_WINDOW, validWidth);
    const height = Math.min(NATIVE_WINDOW, validHeight);
    return {
      x: clamp(Math.round(centerCol - width / 2), 0, validWidth - width),
      y: clamp(Math.round(centerRow - height / 2), 0, validHeight - height),
      width,
      height,
    };
  }

  function windowElevationRange() {
    const { x, y, width, height } = state.sourceWindow;
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let row = y; row < y + height; row += 1) {
      const offset = row * TILE_GRID + x;
      for (let col = 0; col < width; col += 1) {
        const value = state.codes[offset + col];
        if (value === NODATA) continue;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
    }
    if (!Number.isFinite(minimum)) return state.currentTile.elevation_range_m;
    return [minimum, maximum];
  }

  function resetCamera(focusAnchor = true) {
    const range = windowElevationRange();
    state.renderOriginElevation = range[0];
    state.maxElevation = range[1];
    const span = Math.max(state.worldWidth, state.worldDepth);
    const relief = Math.max(1, range[1] - range[0]);
    const camera = state.camera;
    camera.yaw = state.mode === 'native' ? -0.82 : -0.72;
    camera.pitch = state.mode === 'native' ? 0.46 : 0.58;
    camera.distance = state.mode === 'native' ? span * 0.72 : span * 1.18;
    camera.minDistance = Math.max(45, SOURCE_SPACING_M * 3);
    camera.maxDistance = Math.max(span * 6, 60_000);
    camera.target = [0, relief * 0.22, 0];

    if (focusAnchor && state.currentAnchor) {
      const pixel = anchorPixel(state.currentAnchor, state.currentTile);
      if (
        pixel.col >= state.sourceWindow.x && pixel.col < state.sourceWindow.x + state.sourceWindow.width &&
        pixel.row >= state.sourceWindow.y && pixel.row < state.sourceWindow.y + state.sourceWindow.height
      ) {
        const elevation = sampleAt(pixel.col, pixel.row) ?? range[0];
        const x = ((pixel.col - state.sourceWindow.x) / Math.max(1, state.sourceWindow.width - 1) - 0.5) * state.worldWidth;
        const z = ((pixel.row - state.sourceWindow.y) / Math.max(1, state.sourceWindow.height - 1) - 0.5) * state.worldDepth;
        camera.target = [x, elevation - state.renderOriginElevation, z];
      }
    }
    camera.distance = clamp(camera.distance, camera.minDistance, camera.maxDistance);
    state.dirty = true;
  }

  function setViewWindow(mode, { reset = true } = {}) {
    state.mode = mode;
    state.sourceWindow = computeWindow(mode, state.currentAnchor);
    state.renderGrid = mode === 'native' ? state.sourceWindow.width : state.overviewGrid;
    state.worldWidth = (state.sourceWindow.width - 1) * SOURCE_SPACING_M;
    state.worldDepth = (state.sourceWindow.height - 1) * SOURCE_SPACING_M;
    buildIndices();
    if (reset) resetCamera(true);
    document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    $('overviewQuality').disabled = mode === 'native';
    updateDataPanel();
    rebuildLabels();
    updateQaResult();
    state.dirty = true;
  }

  async function loadTile(tileId, anchorId = null) {
    const token = ++state.loadToken;
    const tile = state.tileById.get(tileId);
    assert(tile, `找不到瓦片 ${tileId}`);
    state.currentAnchor = anchorId ? state.anchorById.get(anchorId) : null;
    loadingCard.hidden = false;
    loadingDetail.textContent = `${tile.id} · 校验 8,388,608 字节`;
    errorCard.hidden = true;
    errorMessage.textContent = '';

    let cache = state.tileCache.get(tile.id);
    if (!cache) {
      const buffer = await fetchBinary(`data/${tile.file}`);
      if (token !== state.loadToken) return;
      assert(buffer.byteLength === tile.stored_bytes && buffer.byteLength === EXPECTED_TILE_BYTES, `${tile.id} 字节数不一致`);
      const digest = await sha256Hex(buffer);
      if (token !== state.loadToken) return;
      assert(digest === tile.sha256, `${tile.id} SHA256 不一致`);
      cache = { codes: decodeInt16LittleEndian(buffer), sha256: digest };
      state.tileCache.set(tile.id, cache);
    }
    if (token !== state.loadToken) return;
    state.currentTile = tile;
    state.codes = cache.codes;
    state.currentTileSha = cache.sha256;
    uploadHeightTexture(state.codes);
    setViewWindow(state.mode, { reset: true });
    updateAnchorButtonState(anchorId);
    loadingCard.hidden = true;
    state.qaReady = true;
    updateQaResult();
    await nextFrame();
    state.dirty = true;
  }

  function updateAnchorButtonState(anchorId) {
    document.querySelectorAll('[data-anchor]').forEach(button => button.classList.toggle('active', button.dataset.anchor === anchorId));
  }

  async function selectAnchor(anchorId) {
    const anchor = state.anchorById.get(anchorId);
    assert(anchor, `找不到地标 ${anchorId}`);
    const tileId = state.manifest.anchor_tile_map[anchorId];
    if (state.currentTile?.id === tileId) {
      state.currentAnchor = anchor;
      setViewWindow(state.mode, { reset: true });
      updateAnchorButtonState(anchorId);
      await nextFrame();
      return;
    }
    await loadTile(tileId, anchorId);
  }

  function formatKm(value) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} km`;
  }

  function updateDataPanel() {
    if (!state.currentTile) return;
    $('tileId').textContent = state.currentTile.id;
    $('tileRange').textContent = `${formatKm(state.worldWidth)} × ${formatKm(state.worldDepth)}`;
    $('elevationRange').textContent = `${state.renderOriginElevation.toFixed(0)} 至 ${state.maxElevation.toFixed(0)} m`;
    const sourceStep = (state.sourceWindow.width - 1) / Math.max(1, state.renderGrid - 1);
    $('vertexSpacing').textContent = `${(sourceStep * SOURCE_SPACING_M).toFixed(sourceStep === 1 ? 1 : 2)} m`;
  }

  function updateRenderInfo() {
    if (!state.currentTile) return;
    const mode = state.mode === 'native' ? '原生近景' : '整块';
    renderInfo.textContent = `${mode} · ${state.renderGrid}² 顶点 · ${state.validTriangleCount.toLocaleString()} 三角形 · WebGL2 按需渲染`;
  }

  function rebuildLabels() {
    labelLayer.replaceChildren();
    state.labels = [];
    if (!state.currentTile || !state.labelsVisible) return;
    for (const anchor of state.currentTile.anchors || []) {
      const pixel = anchorPixel(anchor, state.currentTile);
      if (
        pixel.col < state.sourceWindow.x || pixel.col >= state.sourceWindow.x + state.sourceWindow.width ||
        pixel.row < state.sourceWindow.y || pixel.row >= state.sourceWindow.y + state.sourceWindow.height
      ) continue;
      const elevation = sampleAt(pixel.col, pixel.row);
      if (elevation === null) continue;
      const element = document.createElement('div');
      element.className = 'landmark-label';
      element.textContent = anchor.name;
      labelLayer.appendChild(element);
      state.labels.push({
        element,
        x: ((pixel.col - state.sourceWindow.x) / Math.max(1, state.sourceWindow.width - 1) - 0.5) * state.worldWidth,
        y: elevation - state.renderOriginElevation + 16,
        z: ((pixel.row - state.sourceWindow.y) / Math.max(1, state.sourceWindow.height - 1) - 0.5) * state.worldDepth,
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
    if (nx < -1.1 || nx > 1.1 || ny < -1.1 || ny > 1.1 || nz < -1 || nz > 1) return null;
    return [(nx * 0.5 + 0.5) * canvas.clientWidth, (1 - (ny * 0.5 + 0.5)) * canvas.clientHeight];
  }

  function updateLabels() {
    for (const label of state.labels) {
      const projected = projectWorld(label.x, label.y, label.z);
      if (!projected) {
        label.element.style.display = 'none';
      } else {
        label.element.style.display = '';
        label.element.style.left = `${projected[0]}px`;
        label.element.style.top = `${projected[1]}px`;
      }
    }
  }

  function updateQaResult() {
    const sourceStep = state.renderGrid > 1 ? (state.sourceWindow.width - 1) / (state.renderGrid - 1) : 0;
    const loadingOverlayDisplayed = getComputedStyle(loadingCard).display !== 'none';
    const errorOverlayDisplayed = getComputedStyle(errorCard).display !== 'none';
    const result = {
      schema: 'guilin-v077-native-lod-browser-qa/v1',
      passed: Boolean(
        state.qaReady &&
        state.gl &&
        state.currentTile &&
        state.currentTileSha === state.currentTile.sha256 &&
        runtimeErrors.length === 0 &&
        !loadingOverlayDisplayed &&
        !errorOverlayDisplayed
      ),
      data_ready: Boolean(state.qaReady && state.currentTile),
      webgl2: Boolean(state.gl),
      source_sha256: state.manifest?.source?.sha256 || null,
      aoi_geometry_sha256: state.manifest?.aoi?.geometry_sha256 || null,
      source_resolution_m: SOURCE_SPACING_M,
      tile_count: state.manifest?.tiles?.length || 0,
      current_tile_id: state.currentTile?.id || null,
      current_tile_bytes: state.currentTile?.stored_bytes || 0,
      current_tile_sha256: state.currentTileSha,
      current_tile_sha256_verified: Boolean(state.currentTile && state.currentTileSha === state.currentTile.sha256),
      mode: state.mode,
      render_grid: [state.renderGrid, state.renderGrid],
      source_window: [state.sourceWindow.x, state.sourceWindow.y, state.sourceWindow.width, state.sourceWindow.height],
      vertex_spacing_m: sourceStep * SOURCE_SPACING_M,
      native_vertex_mode: Boolean(state.mode === 'native' && Math.abs(sourceStep - 1) < 1e-9),
      valid_triangle_count: state.validTriangleCount,
      vertical_scale: 1,
      resampling: 'none',
      gap_fill_applied: false,
      fallback_30m_used: false,
      source_elevation_modified_m: 0,
      public_deployment_allowed: false,
      hydrology_centerline_mutated: false,
      max_texture_size: state.gl ? state.gl.getParameter(state.gl.MAX_TEXTURE_SIZE) : 0,
      runtime_errors: runtimeErrors.slice(),
      loading_overlay_displayed: loadingOverlayDisplayed,
      error_overlay_displayed: errorOverlayDisplayed,
      render_status: renderInfo.textContent,
    };
    window.__GUILIN_V077_QA_RESULT = result;
    return result;
  }

  function setupControls() {
    document.querySelectorAll('[data-anchor]').forEach(button => {
      button.addEventListener('click', () => selectAnchor(button.dataset.anchor).catch(showError));
    });
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        if (!state.currentTile) return;
        setViewWindow(button.dataset.mode, { reset: true });
      });
    });
    $('overviewQuality').addEventListener('change', event => {
      state.overviewGrid = Number(event.target.value);
      if (state.currentTile && state.mode === 'overview') setViewWindow('overview', { reset: false });
    });
    $('resetCamera').addEventListener('click', () => resetCamera(true));
    $('toggleLabels').addEventListener('click', event => {
      state.labelsVisible = !state.labelsVisible;
      event.currentTarget.textContent = state.labelsVisible ? '隐藏地标' : '显示地标';
      rebuildLabels();
      state.dirty = true;
    });
    togglePanel.addEventListener('click', () => {
      const collapsed = controlPanel.classList.toggle('collapsed');
      togglePanel.setAttribute('aria-expanded', String(!collapsed));
    });

    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pointers.size === 2) {
        const points = Array.from(state.pointers.values());
        state.pinch = { distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), cameraDistance: state.camera.distance };
      }
    });
    canvas.addEventListener('pointermove', event => {
      const previous = state.pointers.get(event.pointerId);
      if (!previous) return;
      const current = { x: event.clientX, y: event.clientY };
      state.pointers.set(event.pointerId, current);
      if (state.pointers.size === 2 && state.pinch) {
        const points = Array.from(state.pointers.values());
        const distance = Math.max(8, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
        state.camera.distance = clamp(state.pinch.cameraDistance * state.pinch.distance / distance, state.camera.minDistance, state.camera.maxDistance);
      } else {
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        if (event.shiftKey || event.button === 2 || event.buttons === 2) {
          const scale = state.camera.distance * 0.0014;
          const rightX = Math.cos(state.camera.yaw);
          const rightZ = -Math.sin(state.camera.yaw);
          const forwardX = Math.sin(state.camera.yaw);
          const forwardZ = Math.cos(state.camera.yaw);
          state.camera.target[0] -= dx * scale * rightX + dy * scale * forwardX;
          state.camera.target[2] -= dx * scale * rightZ + dy * scale * forwardZ;
        } else {
          state.camera.yaw -= dx * 0.005;
          state.camera.pitch = clamp(state.camera.pitch + dy * 0.004, 0.08, 1.42);
        }
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
      state.camera.distance = clamp(state.camera.distance * Math.exp(event.deltaY * 0.001), state.camera.minDistance, state.camera.maxDistance);
      state.dirty = true;
    }, { passive: false });
    window.addEventListener('resize', () => { state.dirty = true; });
  }

  function showError(error) {
    const message = String(error?.stack || error?.message || error);
    runtimeErrors.push(message);
    console.error(error);
    loadingCard.hidden = true;
    errorMessage.textContent = message;
    errorCard.hidden = false;
    updateQaResult();
  }

  async function initialize() {
    setupControls();
    setupWebGL();
    loadingDetail.textContent = '读取原生 LOD 清单';
    const manifest = await fetchJson(MANIFEST_URL);
    validateManifest(manifest);
    state.manifest = manifest;
    for (const tile of manifest.tiles) state.tileById.set(tile.id, tile);
    for (const tile of manifest.tiles) {
      for (const anchor of tile.anchors || []) state.anchorById.set(anchor.id, anchor);
    }
    const defaultAnchor = new URLSearchParams(location.search).get('anchor') || 'guilin';
    const selected = state.anchorById.has(defaultAnchor) ? defaultAnchor : state.anchorById.keys().next().value;
    await selectAnchor(selected);
    requestAnimationFrame(renderLoop);
    window.__GUILIN_V077_TEST_API = {
      async selectAnchor(anchorId) {
        await selectAnchor(anchorId);
        state.dirty = true;
        await nextFrame();
        await nextFrame();
        return updateQaResult();
      },
      async setMode(mode) {
        assert(mode === 'overview' || mode === 'native', 'mode must be overview or native');
        setViewWindow(mode, { reset: true });
        state.dirty = true;
        await nextFrame();
        await nextFrame();
        return updateQaResult();
      },
      async setOverviewGrid(grid) {
        assert([512, 768, 1024].includes(Number(grid)), 'unsupported overview grid');
        state.overviewGrid = Number(grid);
        $('overviewQuality').value = String(grid);
        if (state.mode === 'overview') setViewWindow('overview', { reset: false });
        state.dirty = true;
        await nextFrame();
        await nextFrame();
        return updateQaResult();
      },
      resetCamera() {
        resetCamera(true);
        return updateQaResult();
      },
      getState() {
        return updateQaResult();
      },
    };
    updateQaResult();
  }

  initialize().catch(showError);
})();
