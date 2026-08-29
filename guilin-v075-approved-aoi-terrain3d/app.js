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

  const SOURCE_MANIFEST_URL = 'data/source/terrain_manifest.json';
  const SOURCE_HEIGHT_URL = 'data/source/terrain_height_u16.bin';
  const AOI_URL = 'data/accepted_aoi.json';
  const EXPECTED_SOURCE_GRID = [1024, 1110];
  const EXPECTED_SOURCE_BYTES = 1024 * 1110 * 2;
  const EXPECTED_AOI_BOUNDS = [380331.8, 2705928.1, 530128.2, 2926987.2];
  const NODATA_CODE = 65535;
  const MAX_DEVICE_PIXEL_RATIO = 1.75;
  const runtimeErrors = [];

  const LANDMARKS = [
    { id: 'zhenbaoding', name: '真寶鼎', e: 482534.530462443, n: 2890708.122979571 },
    { id: 'guilin', name: '桂林城', e: 429459.239540243, n: 2795494.225020682 },
    { id: 'yangtang', name: '秧塘機場', e: 414949.565810143, n: 2789301.889164384 },
    { id: 'yangshuo', name: '陽朔縣', e: 448648.462659552, n: 2740850.767499203 },
  ];

  const state = {
    manifest: null,
    aoi: null,
    codes: null,
    model: null,
    gl: null,
    program: null,
    vao: null,
    buffers: [],
    uniform: {},
    projection: new Float32Array(16),
    view: new Float32Array(16),
    viewProjection: new Float32Array(16),
    dirty: true,
    renderedFrames: 0,
    verticalScale: 1,
    camera: {
      target: [0, 280, 0],
      yaw: -0.68,
      pitch: 0.58,
      distance: 260000,
      minDistance: 12000,
      maxDistance: 900000,
    },
    pointers: new Map(),
    labels: [],
    fallbackReady: false,
  };

  window.addEventListener('error', event => {
    runtimeErrors.push(String(event.message || event.error || 'window error'));
  });
  window.addEventListener('unhandledrejection', event => {
    runtimeErrors.push(String(event.reason || 'unhandled rejection'));
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

  function validateContracts(manifest, aoi, binary) {
    assert(manifest && manifest.crs === 'EPSG:32649', '来源坐标系合同不正确');
    assert(Array.isArray(manifest.source_resolution_m) && manifest.source_resolution_m.every(value => approximately(value, 12.5)), '来源分辨率必须为 12.5 米');
    assert(Array.isArray(manifest.source_grid) && manifest.source_grid[0] === 17408 && manifest.source_grid[1] === 18867, '原始网格合同不正确');
    assert(manifest.vertical_scale === 1 && manifest.source_elevation_modified_m === 0, '来源高程发生了修改');
    assert(manifest.gap_fill_applied === false, '来源数据禁止补洞');
    assert(manifest.height?.width === EXPECTED_SOURCE_GRID[0] && manifest.height?.height === EXPECTED_SOURCE_GRID[1], '三维预览网格尺寸不正确');
    assert(manifest.height?.nodata_code === NODATA_CODE, 'NoData 编码不正确');
    assert(binary.byteLength === EXPECTED_SOURCE_BYTES, `高程网格字节数不正确：${binary.byteLength}`);
    assert(aoi?.status === 'ACCEPTED' && aoi.distillation_allowed === true, 'AOI 尚未进入 ACCEPTED');
    assert(aoi.crs === 'EPSG:32649', 'AOI 坐标系不正确');
    assert(Array.isArray(aoi.bounds_epsg32649) && aoi.bounds_epsg32649.length === 4, 'AOI 范围缺失');
    assert(aoi.bounds_epsg32649.every((value, index) => approximately(value, EXPECTED_AOI_BOUNDS[index], 0.11)), 'AOI 与浩哥确认范围不一致');
    assert(aoi.nodata_policy.includes('no interpolation') && aoi.nodata_policy.includes('no 30 m substitution'), 'AOI NoData 合同不完整');
  }

  function decodeCodes(buffer) {
    const view = new DataView(buffer);
    const result = new Uint16Array(buffer.byteLength / 2);
    for (let index = 0; index < result.length; index += 1) {
      result[index] = view.getUint16(index * 2, true);
    }
    return result;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function makeIndexList(start, end, step) {
    const values = [];
    for (let value = start; value <= end; value += step) values.push(value);
    if (values[values.length - 1] !== end) values.push(end);
    return values;
  }

  function buildNoDataPrefix(codes, width, height) {
    const stride = width + 1;
    const prefix = new Uint32Array((height + 1) * stride);
    for (let row = 0; row < height; row += 1) {
      let rowSum = 0;
      const sourceOffset = row * width;
      const currentOffset = (row + 1) * stride;
      const previousOffset = row * stride;
      for (let col = 0; col < width; col += 1) {
        if (codes[sourceOffset + col] === NODATA_CODE) rowSum += 1;
        prefix[currentOffset + col + 1] = prefix[previousOffset + col + 1] + rowSum;
      }
    }
    return { prefix, stride };
  }

  function regionNoDataCount(prefixData, row0, col0, row1, col1) {
    const { prefix, stride } = prefixData;
    const r0 = row0;
    const c0 = col0;
    const r1 = row1 + 1;
    const c1 = col1 + 1;
    return prefix[r1 * stride + c1] - prefix[r0 * stride + c1] - prefix[r1 * stride + c0] + prefix[r0 * stride + c0];
  }

  function decodeElevation(code, minElevation, maxElevation) {
    return minElevation + (code / 65534) * (maxElevation - minElevation);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function terrainColor(elevation, normalY, low, high) {
    const stops = [
      [0.00, [0.055, 0.205, 0.125]],
      [0.24, [0.105, 0.330, 0.170]],
      [0.45, [0.285, 0.430, 0.205]],
      [0.63, [0.475, 0.470, 0.245]],
      [0.79, [0.645, 0.585, 0.410]],
      [0.91, [0.670, 0.675, 0.625]],
      [1.00, [0.900, 0.900, 0.845]],
    ];
    const t = clamp((elevation - low) / Math.max(1, high - low), 0, 1);
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let index = 0; index < stops.length - 1; index += 1) {
      if (t >= stops[index][0] && t <= stops[index + 1][0]) {
        left = stops[index];
        right = stops[index + 1];
        break;
      }
    }
    const local = (t - left[0]) / Math.max(1e-6, right[0] - left[0]);
    const slopeTone = 0.88 + normalY * 0.12;
    return [
      lerp(left[1][0], right[1][0], local) * slopeTone,
      lerp(left[1][1], right[1][1], local) * slopeTone,
      lerp(left[1][2], right[1][2], local) * slopeTone,
    ];
  }

  function buildTerrainModel(manifest, aoi, codes) {
    const width = manifest.height.width;
    const height = manifest.height.height;
    const [sourceWest, sourceSouth, sourceEast, sourceNorth] = manifest.bounds_epsg32649;
    const [aoiWest, aoiSouth, aoiEast, aoiNorth] = aoi.bounds_epsg32649;
    const dx = (sourceEast - sourceWest) / (width - 1);
    const dz = (sourceNorth - sourceSouth) / (height - 1);

    const col0 = clamp(Math.floor((aoiWest - sourceWest) / (sourceEast - sourceWest) * (width - 1)), 0, width - 1);
    const col1 = clamp(Math.ceil((aoiEast - sourceWest) / (sourceEast - sourceWest) * (width - 1)), 0, width - 1);
    const row0 = clamp(Math.floor((sourceNorth - aoiNorth) / (sourceNorth - sourceSouth) * (height - 1)), 0, height - 1);
    const row1 = clamp(Math.ceil((sourceNorth - aoiSouth) / (sourceNorth - sourceSouth) * (height - 1)), 0, height - 1);
    assert(col1 > col0 && row1 > row0, 'AOI 裁切窗口为空');

    const cropWidth = col1 - col0 + 1;
    const cropHeight = row1 - row0 + 1;
    const adaptiveStep = Math.max(1, Math.ceil(Math.max(cropWidth / 280, cropHeight / 420)));
    const cols = makeIndexList(col0, col1, adaptiveStep);
    const rows = makeIndexList(row0, row1, adaptiveStep);
    const meshWidth = cols.length;
    const meshHeight = rows.length;
    const vertexCount = meshWidth * meshHeight;
    const [sourceMinElevation, sourceMaxElevation] = manifest.elevation_range_m;
    const centerE = (aoiWest + aoiEast) / 2;
    const centerN = (aoiSouth + aoiNorth) / 2;

    const prefixData = buildNoDataPrefix(codes, width, height);
    const heights = new Float32Array(vertexCount);
    const valid = new Uint8Array(vertexCount);
    const xCoordinates = new Float32Array(meshWidth);
    const zCoordinates = new Float32Array(meshHeight);
    let validVertexCount = 0;
    let noDataVertexCount = 0;
    let minElevation = Number.POSITIVE_INFINITY;
    let maxElevation = Number.NEGATIVE_INFINITY;

    for (let colIndex = 0; colIndex < meshWidth; colIndex += 1) {
      xCoordinates[colIndex] = sourceWest + cols[colIndex] * dx - centerE;
    }
    for (let rowIndex = 0; rowIndex < meshHeight; rowIndex += 1) {
      const northing = sourceNorth - rows[rowIndex] * dz;
      zCoordinates[rowIndex] = centerN - northing;
    }

    for (let rowIndex = 0; rowIndex < meshHeight; rowIndex += 1) {
      const sourceRow = rows[rowIndex];
      for (let colIndex = 0; colIndex < meshWidth; colIndex += 1) {
        const sourceCol = cols[colIndex];
        const vertexIndex = rowIndex * meshWidth + colIndex;
        const code = codes[sourceRow * width + sourceCol];
        if (code === NODATA_CODE) {
          heights[vertexIndex] = Number.NaN;
          noDataVertexCount += 1;
          continue;
        }
        const elevation = decodeElevation(code, sourceMinElevation, sourceMaxElevation);
        heights[vertexIndex] = elevation;
        valid[vertexIndex] = 1;
        validVertexCount += 1;
        minElevation = Math.min(minElevation, elevation);
        maxElevation = Math.max(maxElevation, elevation);
      }
    }
    assert(validVertexCount > 100, 'AOI 内有效高程样本过少');

    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const renderOriginElevation = minElevation;

    function heightAt(rowIndex, colIndex, fallback) {
      const row = clamp(rowIndex, 0, meshHeight - 1);
      const col = clamp(colIndex, 0, meshWidth - 1);
      const value = heights[row * meshWidth + col];
      return Number.isFinite(value) ? value : fallback;
    }

    const colorLow = Math.max(minElevation, manifest.analysis?.percentile_stretch_m?.[0] ?? minElevation);
    const colorHigh = Math.min(maxElevation, manifest.analysis?.percentile_stretch_m?.[1] ?? maxElevation);

    for (let rowIndex = 0; rowIndex < meshHeight; rowIndex += 1) {
      for (let colIndex = 0; colIndex < meshWidth; colIndex += 1) {
        const vertexIndex = rowIndex * meshWidth + colIndex;
        const base = vertexIndex * 3;
        const elevation = heights[vertexIndex];
        positions[base] = xCoordinates[colIndex];
        positions[base + 2] = zCoordinates[rowIndex];
        if (!Number.isFinite(elevation)) {
          positions[base + 1] = 0;
          normals[base + 1] = 1;
          continue;
        }
        positions[base + 1] = elevation - renderOriginElevation;
        const hLeft = heightAt(rowIndex, colIndex - 1, elevation);
        const hRight = heightAt(rowIndex, colIndex + 1, elevation);
        const hNorth = heightAt(rowIndex - 1, colIndex, elevation);
        const hSouth = heightAt(rowIndex + 1, colIndex, elevation);
        const xLeft = xCoordinates[Math.max(0, colIndex - 1)];
        const xRight = xCoordinates[Math.min(meshWidth - 1, colIndex + 1)];
        const zNorth = zCoordinates[Math.max(0, rowIndex - 1)];
        const zSouth = zCoordinates[Math.min(meshHeight - 1, rowIndex + 1)];
        const gradientX = (hRight - hLeft) / Math.max(1, xRight - xLeft);
        const gradientZ = (hSouth - hNorth) / Math.max(1, zSouth - zNorth);
        let nx = -gradientX;
        let ny = 1;
        let nz = -gradientZ;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        normals[base] = nx;
        normals[base + 1] = ny;
        normals[base + 2] = nz;
        const color = terrainColor(elevation, ny, colorLow, colorHigh);
        colors[base] = color[0];
        colors[base + 1] = color[1];
        colors[base + 2] = color[2];
      }
    }

    const indexValues = [];
    let hiddenNoDataCells = 0;
    for (let rowIndex = 0; rowIndex < meshHeight - 1; rowIndex += 1) {
      const rawRow0 = rows[rowIndex];
      const rawRow1 = rows[rowIndex + 1];
      for (let colIndex = 0; colIndex < meshWidth - 1; colIndex += 1) {
        const rawCol0 = cols[colIndex];
        const rawCol1 = cols[colIndex + 1];
        if (regionNoDataCount(prefixData, rawRow0, rawCol0, rawRow1, rawCol1) > 0) {
          hiddenNoDataCells += 1;
          continue;
        }
        const a = rowIndex * meshWidth + colIndex;
        const b = (rowIndex + 1) * meshWidth + colIndex;
        const c = rowIndex * meshWidth + colIndex + 1;
        const d = (rowIndex + 1) * meshWidth + colIndex + 1;
        if (!(valid[a] && valid[b] && valid[c] && valid[d])) {
          hiddenNoDataCells += 1;
          continue;
        }
        indexValues.push(a, b, c, c, b, d);
      }
    }
    assert(indexValues.length > 600, 'AOI 内没有足够的有效三角形');
    const indices = new Uint32Array(indexValues);

    const landmarkPoints = LANDMARKS.map(landmark => {
      const sourceCol = clamp(Math.round((landmark.e - sourceWest) / dx), 0, width - 1);
      const sourceRow = clamp(Math.round((sourceNorth - landmark.n) / dz), 0, height - 1);
      const code = codes[sourceRow * width + sourceCol];
      const elevation = code === NODATA_CODE ? minElevation : decodeElevation(code, sourceMinElevation, sourceMaxElevation);
      return {
        ...landmark,
        x: landmark.e - centerE,
        y: elevation - renderOriginElevation + 120,
        z: centerN - landmark.n,
      };
    });

    return {
      sourceWindow: { col0, col1, row0, row1, cropWidth, cropHeight, adaptiveStep },
      rows,
      cols,
      meshWidth,
      meshHeight,
      vertexCount,
      validVertexCount,
      noDataVertexCount,
      hiddenNoDataCells,
      triangleCount: indices.length / 3,
      positions,
      normals,
      colors,
      indices,
      valid,
      heights,
      minElevation,
      maxElevation,
      renderOriginElevation,
      worldWidth: xCoordinates[meshWidth - 1] - xCoordinates[0],
      worldDepth: zCoordinates[meshHeight - 1] - zCoordinates[0],
      xCoordinates,
      zCoordinates,
      landmarkPoints,
      nodataPolicy: 'Every displayed cell is rejected when any underlying source overview sample in its footprint is NoData. No interpolation and no gap fill.',
    };
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'shader compile failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl) {
    const vertexSource = `#version 300 es
      precision highp float;
      layout(location=0) in vec3 aPosition;
      layout(location=1) in vec3 aNormal;
      layout(location=2) in vec3 aColor;
      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform float uVerticalScale;
      out vec3 vNormal;
      out vec3 vColor;
      out float vDepth;
      void main() {
        vec3 position = vec3(aPosition.x, aPosition.y * uVerticalScale, aPosition.z);
        vec4 viewPosition = uView * vec4(position, 1.0);
        gl_Position = uProjection * viewPosition;
        vNormal = normalize(vec3(aNormal.x, aNormal.y / max(0.001, uVerticalScale), aNormal.z));
        vColor = aColor;
        vDepth = -viewPosition.z;
      }
    `;
    const fragmentSource = `#version 300 es
      precision highp float;
      in vec3 vNormal;
      in vec3 vColor;
      in float vDepth;
      uniform float uFogNear;
      uniform float uFogFar;
      out vec4 outColor;
      void main() {
        vec3 lightDirection = normalize(vec3(-0.48, 0.82, -0.31));
        float diffuse = max(dot(normalize(vNormal), lightDirection), 0.0);
        float opposite = max(dot(normalize(vNormal), -lightDirection), 0.0);
        float light = 0.47 + diffuse * 0.52 + opposite * 0.045;
        vec3 terrain = vColor * light;
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        vec3 sky = vec3(0.82, 0.875, 0.865);
        outColor = vec4(mix(terrain, sky, fog * 0.58), 1.0);
      }
    `;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'program link failed';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function uploadBuffer(gl, target, data, location, size) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    if (location !== null) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }
    state.buffers.push(buffer);
    return buffer;
  }

  function initializeWebGL(model) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('当前浏览器没有可用的 WebGL2');
    const program = createProgram(gl);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    uploadBuffer(gl, gl.ARRAY_BUFFER, model.positions, 0, 3);
    uploadBuffer(gl, gl.ARRAY_BUFFER, model.normals, 1, 3);
    uploadBuffer(gl, gl.ARRAY_BUFFER, model.colors, 2, 3);
    uploadBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, model.indices, null, 0);
    gl.bindVertexArray(null);

    state.gl = gl;
    state.program = program;
    state.vao = vao;
    state.uniform.projection = gl.getUniformLocation(program, 'uProjection');
    state.uniform.view = gl.getUniformLocation(program, 'uView');
    state.uniform.verticalScale = gl.getUniformLocation(program, 'uVerticalScale');
    state.uniform.fogNear = gl.getUniformLocation(program, 'uFogNear');
    state.uniform.fogFar = gl.getUniformLocation(program, 'uFogFar');

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0.82, 0.875, 0.865, 1);

    const maximumDimension = Math.max(model.worldWidth, model.worldDepth);
    state.camera.minDistance = Math.max(7000, maximumDimension * 0.07);
    state.camera.maxDistance = maximumDimension * 4.5;
    applyViewPreset('overview');
    resizeCanvas();
    requestRender();
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
    for (let col = 0; col < 4; col += 1) {
      for (let row = 0; row < 4; row += 1) {
        result[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
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
    if (!state.gl) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      state.gl.viewport(0, 0, width, height);
    }
    requestRender();
  }

  function requestRender() {
    state.dirty = true;
  }

  function render() {
    if (!state.gl || !state.model || !state.program) return;
    const gl = state.gl;
    const model = state.model;
    const camera = state.camera;
    const eye = cameraEye();
    const aspect = canvas.width / Math.max(1, canvas.height);
    const far = Math.max(model.worldWidth, model.worldDepth) * 8;
    mat4Perspective(state.projection, Math.PI / 4, aspect, 20, far);
    mat4LookAt(state.view, eye, camera.target, [0, 1, 0]);
    mat4Multiply(state.viewProjection, state.projection, state.view);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(state.program);
    gl.uniformMatrix4fv(state.uniform.projection, false, state.projection);
    gl.uniformMatrix4fv(state.uniform.view, false, state.view);
    gl.uniform1f(state.uniform.verticalScale, state.verticalScale);
    gl.uniform1f(state.uniform.fogNear, camera.distance * 0.72);
    gl.uniform1f(state.uniform.fogFar, camera.distance * 1.65);
    gl.bindVertexArray(state.vao);
    gl.drawElements(gl.TRIANGLES, model.indices.length, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);

    state.renderedFrames += 1;
    updateLandmarkLabels();
    updateCompass();
    if (state.renderedFrames === 1) finalizeReadyState();
  }

  function animationLoop() {
    if (state.dirty) {
      state.dirty = false;
      render();
    }
    requestAnimationFrame(animationLoop);
  }

  function applyViewPreset(name) {
    if (!state.model) return;
    const maxDimension = Math.max(state.model.worldWidth, state.model.worldDepth);
    const camera = state.camera;
    if (name === 'north') {
      camera.target = [0, (state.model.maxElevation - state.model.renderOriginElevation) * 0.16, 0];
      camera.yaw = 0;
      camera.pitch = Math.PI / 2 - 0.015;
      camera.distance = maxDimension * 1.25;
    } else if (name === 'low') {
      camera.target = [0, (state.model.maxElevation - state.model.renderOriginElevation) * 0.18, 0];
      camera.yaw = -0.72;
      camera.pitch = 0.18;
      camera.distance = maxDimension * 0.92;
    } else if (name === 'guilin') {
      const guilin = state.model.landmarkPoints.find(item => item.id === 'guilin');
      camera.target = [guilin?.x || 0, Math.max(120, (guilin?.y || 300) * 0.45), guilin?.z || 0];
      camera.yaw = -0.9;
      camera.pitch = 0.34;
      camera.distance = maxDimension * 0.42;
    } else {
      camera.target = [0, (state.model.maxElevation - state.model.renderOriginElevation) * 0.18, 0];
      camera.yaw = -0.67;
      camera.pitch = 0.56;
      camera.distance = maxDimension * 1.12;
    }
    camera.distance = clamp(camera.distance, camera.minDistance, camera.maxDistance);
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    requestRender();
  }

  function orbit(deltaX, deltaY) {
    state.camera.yaw -= deltaX * 0.006;
    state.camera.pitch = clamp(state.camera.pitch + deltaY * 0.005, 0.075, Math.PI / 2 - 0.012);
    requestRender();
  }

  function pan(deltaX, deltaY) {
    const camera = state.camera;
    const scale = camera.distance * 0.00125;
    const rightX = Math.cos(camera.yaw);
    const rightZ = -Math.sin(camera.yaw);
    const forwardX = -Math.sin(camera.yaw);
    const forwardZ = -Math.cos(camera.yaw);
    camera.target[0] -= rightX * deltaX * scale;
    camera.target[2] -= rightZ * deltaX * scale;
    camera.target[0] += forwardX * deltaY * scale;
    camera.target[2] += forwardZ * deltaY * scale;
    const halfWidth = state.model.worldWidth * 0.7;
    const halfDepth = state.model.worldDepth * 0.7;
    camera.target[0] = clamp(camera.target[0], -halfWidth, halfWidth);
    camera.target[2] = clamp(camera.target[2], -halfDepth, halfDepth);
    requestRender();
  }

  function zoom(factor) {
    state.camera.distance = clamp(state.camera.distance * factor, state.camera.minDistance, state.camera.maxDistance);
    requestRender();
  }

  function installInteractions() {
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      state.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        previousX: event.clientX,
        previousY: event.clientY,
        button: event.button,
        pointerType: event.pointerType,
      });
    });
    canvas.addEventListener('pointermove', event => {
      const pointer = state.pointers.get(event.pointerId);
      if (!pointer) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const pointers = [...state.pointers.values()];
      if (pointers.length === 1) {
        const dx = pointer.x - pointer.previousX;
        const dy = pointer.y - pointer.previousY;
        if (pointer.button === 2 || (event.buttons & 2) === 2) pan(dx, dy);
        else orbit(dx, dy);
      } else if (pointers.length >= 2) {
        const first = pointers[0];
        const second = pointers[1];
        const previousDistance = Math.hypot(first.previousX - second.previousX, first.previousY - second.previousY) || 1;
        const currentDistance = Math.hypot(first.x - second.x, first.y - second.y) || 1;
        const previousCenterX = (first.previousX + second.previousX) / 2;
        const previousCenterY = (first.previousY + second.previousY) / 2;
        const currentCenterX = (first.x + second.x) / 2;
        const currentCenterY = (first.y + second.y) / 2;
        zoom(previousDistance / currentDistance);
        pan(currentCenterX - previousCenterX, currentCenterY - previousCenterY);
      }
      for (const item of state.pointers.values()) {
        item.previousX = item.x;
        item.previousY = item.y;
      }
    });
    const release = event => {
      state.pointers.delete(event.pointerId);
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) { /* no-op */ }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      zoom(Math.exp(event.deltaY * 0.0011));
    }, { passive: false });

    document.querySelectorAll('[data-view]').forEach(button => {
      button.addEventListener('click', () => applyViewPreset(button.dataset.view));
    });
    $('resetView').addEventListener('click', () => applyViewPreset('overview'));
    $('verticalScale').addEventListener('change', event => {
      state.verticalScale = Number(event.target.value) || 1;
      requestRender();
    });
    $('togglePanel').addEventListener('click', event => {
      const collapsed = dataPanel.classList.toggle('collapsed');
      event.currentTarget.textContent = collapsed ? '展开数据' : '收起数据';
      event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    });
    $('showFallback').addEventListener('click', () => {
      if (state.model) renderFallback(state.model);
    });
    window.addEventListener('resize', resizeCanvas, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(viewerShell);
  }

  function createLandmarkLabels(model) {
    const layer = document.createElement('div');
    layer.className = 'landmark-layer';
    layer.setAttribute('aria-hidden', 'true');
    viewerShell.appendChild(layer);
    state.labels = model.landmarkPoints.map(point => {
      const node = document.createElement('div');
      node.className = 'landmark-label';
      node.innerHTML = `<span>${point.name}</span><i></i>`;
      layer.appendChild(node);
      return { node, point };
    });
  }

  function projectPoint(point) {
    const matrix = state.viewProjection;
    const x = point.x;
    const y = point.y * state.verticalScale;
    const z = point.z;
    const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (clipW <= 0) return null;
    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    return {
      x: (ndcX * 0.5 + 0.5) * canvas.clientWidth,
      y: (-ndcY * 0.5 + 0.5) * canvas.clientHeight,
      visible: ndcX > -1.15 && ndcX < 1.15 && ndcY > -1.15 && ndcY < 1.15,
    };
  }

  function updateLandmarkLabels() {
    for (const item of state.labels) {
      const projected = projectPoint(item.point);
      if (!projected || !projected.visible) {
        item.node.hidden = true;
        continue;
      }
      item.node.hidden = false;
      item.node.style.transform = `translate(${projected.x}px, ${projected.y}px) translate(-50%, -100%)`;
    }
  }

  function updateCompass() {
    const arrow = document.querySelector('.compass i');
    if (arrow) arrow.style.transform = `rotate(${state.camera.yaw}rad)`;
  }

  function renderFallback(model) {
    fallbackCanvas.hidden = false;
    canvas.hidden = true;
    const rect = fallbackCanvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    fallbackCanvas.width = Math.max(2, Math.round(rect.width * dpr));
    fallbackCanvas.height = Math.max(2, Math.round(rect.height * dpr));
    const context = fallbackCanvas.getContext('2d');
    const offscreen = document.createElement('canvas');
    offscreen.width = model.meshWidth;
    offscreen.height = model.meshHeight;
    const offscreenContext = offscreen.getContext('2d');
    const image = offscreenContext.createImageData(model.meshWidth, model.meshHeight);
    for (let index = 0; index < model.vertexCount; index += 1) {
      const pixel = index * 4;
      const color = index * 3;
      if (!model.valid[index]) {
        image.data[pixel + 3] = 0;
        continue;
      }
      image.data[pixel] = clamp(Math.round(model.colors[color] * 255), 0, 255);
      image.data[pixel + 1] = clamp(Math.round(model.colors[color + 1] * 255), 0, 255);
      image.data[pixel + 2] = clamp(Math.round(model.colors[color + 2] * 255), 0, 255);
      image.data[pixel + 3] = 255;
    }
    offscreenContext.putImageData(image, 0, 0);
    const background = context.createLinearGradient(0, 0, 0, fallbackCanvas.height);
    background.addColorStop(0, '#dce7e5');
    background.addColorStop(1, '#eef0e8');
    context.fillStyle = background;
    context.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
    const sourceAspect = model.meshWidth / model.meshHeight;
    const targetAspect = fallbackCanvas.width / fallbackCanvas.height;
    let drawWidth;
    let drawHeight;
    if (sourceAspect > targetAspect) {
      drawWidth = fallbackCanvas.width * 0.92;
      drawHeight = drawWidth / sourceAspect;
    } else {
      drawHeight = fallbackCanvas.height * 0.92;
      drawWidth = drawHeight * sourceAspect;
    }
    const x = (fallbackCanvas.width - drawWidth) / 2;
    const y = (fallbackCanvas.height - drawHeight) / 2;
    context.imageSmoothingEnabled = true;
    context.drawImage(offscreen, x, y, drawWidth, drawHeight);
    errorCard.hidden = true;
    setErrorStatus('WebGL2 不可用，当前显示数值高程备用俯视图。');
    errorCard.hidden = true;
    statusText.textContent = '已打开备用高程预览';
    state.fallbackReady = true;
  }

  function updateMetrics(model) {
    $('meshGrid').textContent = `${model.meshWidth.toLocaleString()} × ${model.meshHeight.toLocaleString()}`;
    $('triangleCount').textContent = model.triangleCount.toLocaleString();
    $('elevationRange').textContent = `${Math.round(model.minElevation).toLocaleString()} 至 ${Math.round(model.maxElevation).toLocaleString()} m`;
    $('nodataCount').textContent = `${model.hiddenNoDataCells.toLocaleString()} 个透明网格`;
    renderInfo.textContent = `WebGL2 · ${model.vertexCount.toLocaleString()} 顶点 · 预览步长 ${model.sourceWindow.adaptiveStep}`;
  }

  function finalizeReadyState() {
    if (document.body.dataset.ready === 'true') return;
    loadingCard.hidden = true;
    document.body.dataset.ready = 'true';
    setReadyStatus('三维 DEM 已载入');
    const model = state.model;
    window.__GUILIN_V075_QA__ = Object.freeze({
      schema: 'guilin-v075-browser-qa/v1',
      passed: runtimeErrors.length === 0 && !!state.gl && model.triangleCount > 0,
      release: document.body.dataset.release,
      webgl2: !!state.gl,
      aoi_status: state.aoi.status,
      aoi_geometry_sha256: state.aoi.geometry_sha256,
      aoi_bounds_epsg32649: state.aoi.bounds_epsg32649,
      source_resolution_m: state.manifest.source_resolution_m,
      source_grid: state.manifest.source_grid,
      source_preview_grid: [state.manifest.height.width, state.manifest.height.height],
      source_binary_bytes: state.codes.byteLength,
      source_binary_exact_bytes: state.codes.byteLength === EXPECTED_SOURCE_BYTES,
      preview_mesh_grid: [model.meshWidth, model.meshHeight],
      preview_step: model.sourceWindow.adaptiveStep,
      valid_vertex_count: model.validVertexCount,
      triangle_count: model.triangleCount,
      hidden_nodata_cells: model.hiddenNoDataCells,
      nodata_policy: model.nodataPolicy,
      gap_fill_applied: false,
      fallback_30m_used: false,
      external_runtime_dependency_count: 0,
      render_origin_elevation_m: model.renderOriginElevation,
      default_vertical_scale: 1,
      runtime_errors: [...runtimeErrors],
    });
    window.dispatchEvent(new CustomEvent('guilin-v075-ready', { detail: window.__GUILIN_V075_QA__ }));
  }

  async function initialize() {
    try {
      setProgress(10, '核对浩哥确认的 AOI', '读取 ACCEPTED 几何与边界');
      const aoi = await fetchJson(AOI_URL);
      setProgress(24, '读取数值高程合同', '核对 12.5 米、EPSG:32649 与 NoData');
      const manifest = await fetchJson(SOURCE_MANIFEST_URL);
      setProgress(42, '读取真实高程预览网格', '下载 1,136,640 个高程编码');
      const binary = await fetchBinary(SOURCE_HEIGHT_URL);
      validateContracts(manifest, aoi, binary);
      state.aoi = aoi;
      state.manifest = manifest;
      setProgress(58, '解码高程', '使用小端 uint16 数值网格');
      state.codes = decodeCodes(binary);
      setProgress(72, '裁切确认范围', '生成保留 NoData 的三维网格');
      state.model = buildTerrainModel(manifest, aoi, state.codes);
      setProgress(88, '建立 WebGL2 地形', '上传顶点、法线、色阶与三角形');
      initializeWebGL(state.model);
      createLandmarkLabels(state.model);
      updateMetrics(state.model);
      installInteractions();
      setProgress(100, '三维 DEM 已完成', '正在显示总览视角');
      animationLoop();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtimeErrors.push(message);
      console.error(error);
      setErrorStatus(message);
      window.__GUILIN_V075_QA__ = Object.freeze({
        schema: 'guilin-v075-browser-qa/v1',
        passed: false,
        release: document.body.dataset.release,
        runtime_errors: [...runtimeErrors],
      });
      if (state.model) renderFallback(state.model);
    }
  }

  initialize();
})();
