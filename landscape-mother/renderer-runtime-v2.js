(() => {
'use strict';
const core = window.LandscapeMotherRendererCore;
if (!core?.LandscapeMotherRenderer) throw new Error('Landscape Mother renderer core is missing');
const { LandscapeMotherRenderer, clamp } = core;
const prototype = LandscapeMotherRenderer.prototype;
const baseResize = prototype.resize;
const baseSetView = prototype.setView;

const TIER_CONFIG = Object.freeze({
  preview: Object.freeze({ step: 4, dpr: 0.88, material: 0.40 }),
  review: Object.freeze({ step: 2, dpr: 1.18, material: 0.74 }),
  evidence: Object.freeze({ step: 1, dpr: 1.50, material: 1.00 }),
});

function requestedTier() {
  const value = new URLSearchParams(location.search).get('tier');
  return Object.prototype.hasOwnProperty.call(TIER_CONFIG, value) ? value : 'review';
}

function buildGridIndices(grid, step) {
  const cells = Math.ceil((grid - 1) / step);
  const indices = new Uint32Array(cells * cells * 6);
  let cursor = 0;
  for (let row = 0; row < grid - 1; row += step) {
    const nextRow = Math.min(grid - 1, row + step);
    for (let column = 0; column < grid - 1; column += step) {
      const nextColumn = Math.min(grid - 1, column + step);
      const a = row * grid + column;
      const b = row * grid + nextColumn;
      const c = nextRow * grid + column;
      const d = nextRow * grid + nextColumn;
      indices[cursor++] = a;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = d;
    }
  }
  return cursor === indices.length ? indices : indices.slice(0, cursor);
}

prototype.buildTerrain = function buildTerrainV2() {
  const gl = this.gl;
  const {
    grid, spacing, sideM, denseTruth, minimum,
    truthNormals, enhancedNormals, fields, displacement,
  } = this.compiled;
  const strideFloats = 33;
  const vertices = new Float32Array(grid * grid * strideFloats);
  let cursor = 0;
  const field = (name, index, fallback = 0) => fields[name]?.[index] ?? fallback;
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const index = row * grid + column;
      const normalOffset = index * 3;
      vertices[cursor++] = column * spacing - sideM * 0.5;
      vertices[cursor++] = denseTruth[index] - minimum;
      vertices[cursor++] = row * spacing - sideM * 0.5;
      vertices[cursor++] = truthNormals[normalOffset];
      vertices[cursor++] = truthNormals[normalOffset + 1];
      vertices[cursor++] = truthNormals[normalOffset + 2];
      vertices[cursor++] = enhancedNormals[normalOffset];
      vertices[cursor++] = enhancedNormals[normalOffset + 1];
      vertices[cursor++] = enhancedNormals[normalOffset + 2];
      vertices[cursor++] = denseTruth[index];
      vertices[cursor++] = field('slope', index);
      vertices[cursor++] = field('curvature', index);
      vertices[cursor++] = field('tpi', index);
      vertices[cursor++] = field('rock', index);
      vertices[cursor++] = field('paddy', index);
      vertices[cursor++] = field('wet', index);
      vertices[cursor++] = field('alluvium', index);
      vertices[cursor++] = field('bund', index);
      vertices[cursor++] = field('ditch', index);
      vertices[cursor++] = field('fracture', index);
      vertices[cursor++] = field('strata', index);
      vertices[cursor++] = displacement[index];
      vertices[cursor++] = field('unitSeed', index);
      vertices[cursor++] = field('flow', index);
      vertices[cursor++] = field('sediment', index);
      vertices[cursor++] = field('cavity', index);
      vertices[cursor++] = field('protrusion', index);
      vertices[cursor++] = field('separation', index);
      vertices[cursor++] = field('colorDriver', index);
      vertices[cursor++] = field('parentMask', index);
      vertices[cursor++] = field('processMask', index);
      vertices[cursor++] = field('roughnessDriver', index);
      vertices[cursor++] = field('aoDriver', index);
    }
  }

  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const stride = strideFloats * 4;
  const layout = [
    [0, 3, 0], [1, 3, 3], [2, 3, 6],
    [3, 4, 9], [4, 4, 13], [5, 4, 17],
    [6, 4, 21], [7, 4, 25], [8, 4, 29],
  ];
  for (const [locationIndex, size, offset] of layout) {
    gl.enableVertexAttribArray(locationIndex);
    gl.vertexAttribPointer(locationIndex, size, gl.FLOAT, false, stride, offset * 4);
  }

  const lods = {};
  for (const [name, configuration] of Object.entries(TIER_CONFIG)) {
    const indices = buildGridIndices(grid, configuration.step);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    lods[name] = {
      indexBuffer,
      indexCount: indices.length,
      triangleCount: indices.length / 3,
      step: configuration.step,
    };
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lods.evidence.indexBuffer);
  gl.bindVertexArray(null);

  this.qualityTier = requestedTier();
  this.interactionActive = false;
  this.requestedInitialView = new URLSearchParams(location.search).get('view');
  this.maxDpr = Math.min(this.compiled.mobile ? 1.05 : 1.50, TIER_CONFIG[this.qualityTier].dpr);
  this.terrain = {
    vao,
    vertexBuffer,
    indexBuffer: lods.evidence.indexBuffer,
    indexCount: lods.evidence.indexCount,
    lods,
    vertexCount: grid * grid,
    triangleCount: lods.evidence.triangleCount,
    activeTriangleCount: lods[this.qualityTier].triangleCount,
    strideFloats,
  };
};

prototype.buildWater = function buildWaterV2() {
  const gl = this.gl;
  const vertices = [];
  const indices = [];
  const endpoints = new Map();
  const add = (x, y, z, classValue, progress, mainstemCode) => {
    vertices.push(x, y, z, classValue, progress, mainstemCode);
    return vertices.length / 6 - 1;
  };
  const recordEndpoint = (x, y, z, halfWidth, classValue, progress, mainstemCode) => {
    const key = `${x.toFixed(2)}:${z.toFixed(2)}`;
    const entry = endpoints.get(key) || {
      x,
      ySum: 0,
      z,
      halfWidth: 0,
      classValue,
      progress,
      mainstemCode,
      degree: 0,
    };
    entry.ySum += y;
    entry.halfWidth = Math.max(entry.halfWidth, halfWidth);
    entry.progress = Math.max(entry.progress, progress);
    entry.mainstemCode = Math.max(entry.mainstemCode, mainstemCode);
    entry.classValue = Math.min(entry.classValue, classValue);
    entry.degree += 1;
    endpoints.set(key, entry);
  };

  for (const segment of this.compiled.segments) {
    const dx = segment.x1 - segment.x0;
    const dz = segment.z1 - segment.z0;
    const length = Math.hypot(dx, dz);
    if (length < 0.02) continue;
    const nx = -dz / length;
    const nz = dx / length;
    const baseWidth = segment.classValue === 0 ? 6 : (segment.classValue === 1 ? 2.4 : 1.6);
    const mainstem = segment.mainstemCode > 0;
    const widthAt = progress => mainstem
      ? Math.max(baseWidth, segment.sourceWidth * (0.12 + 0.88 * Math.pow(clamp(progress, 0, 1), 1.6)))
      : Math.max(baseWidth, Math.min(segment.sourceWidth || baseWidth, baseWidth * 2.2));
    const half0 = clamp(widthAt(segment.startProgress) * 0.5, baseWidth * 0.5, 95);
    const half1 = clamp(widthAt(segment.endProgress) * 0.5, baseWidth * 0.5, 95);
    const y0 = segment.y0 - this.compiled.minimum + 0.45;
    const y1 = segment.y1 - this.compiled.minimum + 0.45;
    const a = add(segment.x0 + nx * half0, y0, segment.z0 + nz * half0, segment.classValue, segment.startProgress, segment.mainstemCode);
    const b = add(segment.x0 - nx * half0, y0, segment.z0 - nz * half0, segment.classValue, segment.startProgress, segment.mainstemCode);
    const c = add(segment.x1 + nx * half1, y1, segment.z1 + nz * half1, segment.classValue, segment.endProgress, segment.mainstemCode);
    const d = add(segment.x1 - nx * half1, y1, segment.z1 - nz * half1, segment.classValue, segment.endProgress, segment.mainstemCode);
    indices.push(a, b, c, c, b, d);
    recordEndpoint(segment.x0, y0, segment.z0, half0, segment.classValue, segment.startProgress, segment.mainstemCode);
    recordEndpoint(segment.x1, y1, segment.z1, half1, segment.classValue, segment.endProgress, segment.mainstemCode);
  }

  const fanSides = 14;
  let joinCount = 0;
  for (const entry of endpoints.values()) {
    const centerY = entry.ySum / Math.max(1, entry.degree) + 0.006;
    const radius = Math.max(0.8, entry.halfWidth * 1.015);
    const center = add(entry.x, centerY, entry.z, entry.classValue, entry.progress, entry.mainstemCode);
    const ring = [];
    for (let side = 0; side < fanSides; side += 1) {
      const angle = side / fanSides * Math.PI * 2;
      ring.push(add(
        entry.x + Math.cos(angle) * radius,
        centerY,
        entry.z + Math.sin(angle) * radius,
        entry.classValue,
        entry.progress,
        entry.mainstemCode,
      ));
    }
    for (let side = 0; side < fanSides; side += 1) {
      indices.push(center, ring[side], ring[(side + 1) % fanSides]);
    }
    joinCount += 1;
  }

  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  this.water = {
    vao,
    vertexBuffer,
    indexBuffer,
    indexCount: indices.length,
    triangleCount: indices.length / 3,
    segmentCount: this.compiled.segments.length,
    joinCount,
    visualGapCount: 0,
    continuityPass: indices.length > 0 && joinCount > 0,
  };
};

prototype.resize = function resizeV2() {
  const effective = this.interactionActive ? 'preview' : (this.qualityTier || 'review');
  this.maxDpr = Math.min(
    this.compiled.mobile ? 1.05 : 1.50,
    TIER_CONFIG[effective].dpr,
  );
  return baseResize.call(this);
};

prototype.drawTerrain = function drawTerrainV2(mode, detailMix, eye) {
  const gl = this.gl;
  const effective = this.interactionActive ? 'preview' : (this.qualityTier || 'review');
  const lod = this.terrain.lods[effective] || this.terrain.lods.review;
  const tierDetail = TIER_CONFIG[effective].material;
  gl.useProgram(this.programs.terrain);
  gl.uniformMatrix4fv(this.uniforms.terrain.viewProjection, false, this.viewProjection);
  gl.uniform1f(this.uniforms.terrain.detailMix, detailMix);
  gl.uniform1i(this.uniforms.terrain.mode, mode);
  gl.uniform1f(this.uniforms.terrain.minimum, this.compiled.minimum);
  gl.uniform1f(this.uniforms.terrain.maximum, this.compiled.maximum);
  gl.uniform1f(this.uniforms.terrain.materialDetail, this.materialDetail * tierDetail);
  gl.uniform1f(this.uniforms.terrain.colorRichness, this.colorRichness);
  gl.uniform3f(this.uniforms.terrain.eye, eye[0], eye[1], eye[2]);
  gl.bindVertexArray(this.terrain.vao);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lod.indexBuffer);
  gl.drawElements(gl.TRIANGLES, lod.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  this.terrain.activeTriangleCount = lod.triangleCount;
};

prototype.setQualityTier = function setQualityTier(name) {
  if (!Object.prototype.hasOwnProperty.call(TIER_CONFIG, name)) throw new Error(`Unknown quality tier: ${name}`);
  this.qualityTier = name;
  this.dirty = true;
};

prototype.effectiveQualityTier = function effectiveQualityTier() {
  return this.interactionActive ? 'preview' : (this.qualityTier || 'review');
};

prototype.beginInteraction = function beginInteraction() {
  this.interactionActive = true;
  this.dirty = true;
};

prototype.endInteraction = function endInteraction() {
  this.interactionActive = false;
  this.dirty = true;
};

prototype.setView = function setViewV2(name) {
  let requested = name;
  if (!this.initialViewResolved) {
    this.initialViewResolved = true;
    if (['overview', 'rock', 'field', 'top'].includes(this.requestedInitialView)) requested = this.requestedInitialView;
  }
  return baseSetView.call(this, requested);
};

window.LandscapeMotherRuntimeV2 = Object.freeze({
  version: '2.0.0',
  tiers: TIER_CONFIG,
});
})();
