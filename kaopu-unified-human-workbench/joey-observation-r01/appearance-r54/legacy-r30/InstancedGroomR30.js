import * as T from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {fiberMaterialDiagnostics as sourceFiberDiagnostics} from './FiberMaterial.js';
import {attachInstancedFiberMaterialR30, fiberMaterialDiagnostics} from './InstancedFiberMaterialR30.js';

/** Static, lossless FP32 storage conversion of an ALREADY constructed safe groom.
 * No guide re-sampling, collision changes, reduced segment count, radius scaling,
 * animation or physics. The original remains separately allocated for A/B QA.
 * Use createDecodedProbeView() with the original contact probes: this mesh's
 * position attribute is only a tiny render template, not the full groom.
 */
export function attachInstancedGroomR30(a, reference, {textureWidth = 2048, packedData = null} = {}) {
  const started = performance.now();
  const viewer = a.motion().viewer;
  if (reference?.kind === 'R30-packed-fibre-data') { packedData = reference; reference = null; }
  const source = reference?.mesh;
  if (packedData && (packedData.kind !== 'R30-packed-fibre-data' || typeof packedData.report !== 'function'))
    throw new Error('Invalid direct packed groom object');
  if (!packedData && (!source?.geometry || typeof reference.report !== 'function'))
    throw new Error('Pass the safe LowCountGroomR30 object or direct packed data');
  const baseline = (packedData || reference).report();
  const {count, segments, surfaceSegments} = baseline;
  const per = segments + 1, normalPer = surfaceSegments + 1;
  if (!Number.isInteger(count) || count < 1 || count > 16777216 || segments !== 64 || surfaceSegments !== 20)
    throw new Error('This R30 equivalence conversion requires 64 segments and a 20-segment surface prefix');
  if (!Number.isInteger(textureWidth) || textureWidth < 1) throw new Error('textureWidth must be a positive integer');
  const capabilities = viewer.renderer.capabilities;
  if (!(capabilities.maxVertexTextures >= 2)) throw new Error('At least two vertex texture units are required');
  const maxSize = capabilities.maxTextureSize;
  if (!(maxSize >= 1)) throw new Error('Renderer texture size capability is unavailable');
  const originalGeometry = source?.geometry;
  const arrays = source ? {} : null;
  if (source) {
    const sourceReport = reference.report();
    if (sourceReport.count !== count || sourceReport.segments !== segments || sourceReport.surfaceSegments !== surfaceSegments)
      throw new Error('Explicit comparison reference has a different strand layout');
  }
  if (source) for (const key of ['position', 'tangent', 'scalpNormal', 'strandSide', 'strandRadius', 'along', 'strandRandom']) {
    const attribute = originalGeometry.getAttribute(key);
    if (!attribute || attribute.count !== count * per * 2 || !(attribute.array instanceof Float32Array))
      throw new Error(`Unexpected source attribute: ${key}`);
    arrays[key] = attribute.array;
  }
  function makeTexture(entries, name, preparedData = null, preparedSize = null) {
    const width = preparedSize ? preparedSize[0] : Math.min(textureWidth, maxSize, entries);
    const height = preparedSize ? preparedSize[1] : Math.ceil(entries / width);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > maxSize || height > maxSize || width * height < entries)
      throw new Error(`${name} exceeds the device texture dimensions`);
    if (preparedData && (!(preparedData instanceof Float32Array) || preparedData.length !== width * height * 4))
      throw new Error(`${name} has invalid FP32 backing storage`);
    const data = preparedData || new Float32Array(width * height * 4);
    const texture = new T.DataTexture(data, width, height, T.RGBAFormat, T.FloatType);
    texture.name = name;
    texture.internalFormat = 'RGBA32F';
    texture.minFilter = texture.magFilter = T.NearestFilter;
    texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.unpackAlignment = 1;
    texture.colorSpace = T.NoColorSpace;
    return texture;
  }
  const points = makeTexture(count * per, 'R30 FP32 corrected positions and actual radii', packedData?.pointData, packedData?.pointTextureSize);
  const normals = makeTexture(count * normalPer, 'R30 FP32 scalp normals and strand random', packedData?.normalData, packedData?.normalTextureSize);
  const pointData = points.image.data, normalData = normals.image.data;
  if (!packedData) for (let i = 0; i < count; i++) {
    for (let j = 0; j < per; j++) {
      const vertex = (i * per + j) * 2;
      const p = vertex * 3, d = (i * per + j) * 4;
      for (let k = 0; k < 3; k++) pointData[d + k] = arrays.position[p + k];
      pointData[d + 3] = arrays.strandRadius[vertex];
      if (j < normalPer) {
        const n = (i * normalPer + j) * 4;
        for (let k = 0; k < 3; k++) normalData[n + k] = arrays.scalpNormal[p + k];
        normalData[n + 3] = arrays.strandRandom[vertex];
      }
    }
  }
  if (!pointData.every(Number.isFinite) || !normalData.every(Number.isFinite)) {
    points.dispose(); normals.dispose();
    throw new Error('Non-finite source texture data');
  }
  points.needsUpdate = normals.needsUpdate = true;

  const geometry = new T.InstancedBufferGeometry();
  const vertices = per * 2;
  const placeholders = new Float32Array(vertices * 3);
  const pointIndices = new Float32Array(vertices);
  const sides = new Float32Array(vertices), along = new Float32Array(vertices);
  const indices = new Uint16Array(segments * 6);
  const ids = new Float32Array(count);
  let nextIndex = 0;
  for (let j = 0; j < per; j++) {
    for (let side = 0; side < 2; side++) {
      const v = j * 2 + side;
      pointIndices[v] = j;
      sides[v] = side ? 1 : -1;
      along[v] = j / segments;
    }
    if (j < segments) for (const index of [j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2]) indices[nextIndex++] = index;
  }
  for (let i = 0; i < count; i++) ids[i] = i;
  geometry.setAttribute('position', new T.BufferAttribute(placeholders, 3));
  geometry.setAttribute('fiberPoint', new T.BufferAttribute(pointIndices, 1));
  geometry.setAttribute('strandSide', new T.BufferAttribute(sides, 1));
  geometry.setAttribute('along', new T.BufferAttribute(along, 1));
  geometry.setAttribute('fiberStrandId', new T.InstancedBufferAttribute(ids, 1));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  geometry.instanceCount = count;
  // Three uses the bounding-sphere centre for transparent-object sorting even
  // with frustumCulled=false. Keep the source centre, not the template origin.
  if (originalGeometry) {
    if (!originalGeometry.boundingSphere) originalGeometry.computeBoundingSphere();
    geometry.boundingSphere = originalGeometry.boundingSphere.clone();
    if (originalGeometry.boundingBox) geometry.boundingBox = originalGeometry.boundingBox.clone();
  } else {
    if (!packedData.boundingSphere?.isSphere) throw new Error('Packed data requires its complete centreline bounding sphere');
    geometry.boundingSphere = packedData.boundingSphere.clone();
    if (packedData.boundingBox) geometry.boundingBox = packedData.boundingBox.clone();
  }

  function checkPoint(i, j) {
    if (!Number.isInteger(i) || i < 0 || i >= count || !Number.isInteger(j) || j < 0 || j >= per)
      throw new RangeError('Strand/point index outside the groom');
  }
  function decodePoint(i, j) {
    checkPoint(i, j);
    const p = (i * per + j) * 4;
    const n = (i * normalPer + Math.min(j, surfaceSegments)) * 4;
    const lo = (i * per + Math.max(0, j - 1)) * 4;
    const hi = (i * per + Math.min(segments, j + 1)) * 4;
    const tangent = [0, 1, 2].map(k => pointData[hi + k] - pointData[lo + k]);
    const length = Math.hypot(...tangent);
    return {
      position: Array.from(pointData.subarray(p, p + 3)),
      normal: Array.from(normalData.subarray(n, n + 3)),
      radius: pointData[p + 3], random: normalData[n + 3], along: along[j * 2],
      tangent: tangent.map(value => length > 0 ? Math.fround(value / length) : 0),
    };
  }
  function audit() {
    if (!arrays) return {
      method: 'direct packed FP32 storage; no expanded reference constructed or retained',
      comparedPoints: 0, comparedVertices: 0, decodedPointCount: count * per,
      finite: pointData.every(Number.isFinite) && normalData.every(Number.isFinite),
      maxPositionErrorM: null, maxNormalComponentError: null, maxRadiusErrorM: null,
      maxRandomError: null, maxAlongError: null, maxTangentComponentError: null, maxSideError: null,
      exactStoredAttributes: null, tangentWithinFloat32Tolerance: null, referenceCompared: false,
      gpuReadbackVerified: false,
      limitation: 'No reference equivalence claim without explicit reference; run decoded full-segment contact QA',
    };
    const max = {position: 0, normal: 0, radius: 0, random: 0, along: 0, tangent: 0, side: 0};
    let finite = true, comparedVertices = 0;
    for (let i = 0; i < count; i++) for (let j = 0; j < per; j++) {
      const decoded = decodePoint(i, j);
      for (let side = 0; side < 2; side++) {
        const v = (i * per + j) * 2 + side;
        for (const [name, attribute] of [['position', 'position'], ['normal', 'scalpNormal'], ['tangent', 'tangent']]) {
          for (let k = 0; k < 3; k++) {
            const delta = Math.abs(decoded[name][k] - arrays[attribute][v * 3 + k]);
            finite &&= Number.isFinite(delta);
            max[name] = Math.max(max[name], delta);
          }
        }
        for (const [name, attribute] of [['radius', 'strandRadius'], ['random', 'strandRandom'], ['along', 'along']]) {
          const delta = Math.abs(decoded[name] - arrays[attribute][v]);
          finite &&= Number.isFinite(delta);
          max[name] = Math.max(max[name], delta);
        }
        max.side = Math.max(max.side, Math.abs(sides[j * 2 + side] - arrays.strandSide[v]));
        comparedVertices++;
      }
    }
    return {
      method: 'all CPU-decoded FP32 texels and template attributes versus both original ribbon vertices',
      comparedPoints: count * per, comparedVertices, finite, referenceCompared: true,
      maxPositionErrorM: max.position, maxNormalComponentError: max.normal,
      maxRadiusErrorM: max.radius, maxRandomError: max.random, maxAlongError: max.along,
      maxTangentComponentError: max.tangent, maxSideError: max.side,
      exactStoredAttributes: finite && ['position', 'normal', 'radius', 'random', 'along', 'side'].every(k => max[k] === 0),
      tangentWithinFloat32Tolerance: finite && max.tangent <= 2e-7,
      gpuReadbackVerified: false,
      limitation: 'CPU texture decoding only; GPU raster/main-shadow equivalence and decoded contact checks require separate QA',
    };
  }
  const decodeAudit = audit();
  if (!decodeAudit.finite || (arrays && (!decodeAudit.exactStoredAttributes || !decodeAudit.tangentWithinFloat32Tolerance))) {
    geometry.dispose(); points.dispose(); normals.dispose();
    throw new Error(`Source is not representable by this lossless R30 layout: ${JSON.stringify(decodeAudit)}`);
  }

  const originalVisible = source?.visible;
  const originalMaterial = source?.material;
  const u = originalMaterial?.uniforms;
  const sourceDiagnostics = originalMaterial ? sourceFiberDiagnostics(originalMaterial) : null;
  const fiberOptions = sourceDiagnostics ? {
    color: u.hairColor.value, roughness: u.roughness.value, specular: u.surfaceSpecular.value,
    radiusScale: u.radiusScale.value, opacity: u.fiberOpacity.value,
    coverageAA: sourceDiagnostics.coverageAA, coverageResolve: sourceDiagnostics.coverageResolve,
    shadows: sourceDiagnostics.shadows, guides: u.guideMode.value > 0.5,
    ambientGain: u.ambientGain.value,
  } : packedData.fiberOptions;
  const mesh = new T.Mesh(geometry);
  mesh.name = packedData ? 'R30 direct-packed FP32 actual fibre ribbons' : 'R30 instanced FP32 actual fibre ribbons';
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(source?.matrix || packedData.matrix);
  mesh.renderOrder = source?.renderOrder || 0;
  if (source) mesh.layers.mask = source.layers.mask;
  const fiber = attachInstancedFiberMaterialR30(mesh, {
    renderer: viewer.renderer,
    fiberData: {points, normals, pointCount: per, normalPointCount: normalPer},
    ...fiberOptions,
  });
  const hiddenGuides = [];
  if (source) source.visible = false;
  else viewer.scene.traverse(object => {
    if (object.name === '18 colour-coded structural guides (diagnostic thickness)') {
      hiddenGuides.push([object, object.visible]); object.visible = false;
    }
  });
  (source?.parent || viewer.scene).add(mesh);
  const templateBytes = placeholders.byteLength + pointIndices.byteLength + sides.byteLength + along.byteLength + indices.byteLength;
  const instanceBytes = ids.byteLength;
  const textureBytes = pointData.byteLength + normalData.byteLength;
  const texturePayloadBytes = (count * per + count * normalPer) * 16;
  const originalGeometryBytes = originalGeometry ? Object.values(originalGeometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (originalGeometry.index?.array.byteLength || 0) : 0;
  const dataBytes = {
    textureBytes, texturePayloadBytes, texturePaddingBytes: textureBytes - texturePayloadBytes,
    pointTextureBytes: pointData.byteLength, normalTextureBytes: normalData.byteLength,
    templateBytes, instanceBytes,
    cpuTypedArrayBytes: textureBytes + templateBytes + instanceBytes,
    cpuTextureStorageReusedWithoutCopy: !!packedData,
    cpuAdditionalTypedArrayBytesDuringAttach: (packedData ? 0 : textureBytes) + templateBytes + instanceBytes,
    gpuDataBytesEstimated: textureBytes + templateBytes + instanceBytes,
    originalGeometryBytesRetainedSeparately: originalGeometryBytes,
    combinedGpuDataBytesEstimated: textureBytes + templateBytes + instanceBytes + originalGeometryBytes,
    excludes: 'native person, reference point/solver caches, JS objects, render/shadow targets, programs and driver overhead; CPU mirrors and GPU are separate allocations',
  };
  let mode = 'instanced', disposed = false;
  const conversionMs = performance.now() - started;
  function report() {
    return {
      ...baseline,
      kind: packedData ? 'R30-direct-packed-instanced-fibre-study' : 'R30-instanced-FP32-equivalence-study',
      sourceKind: baseline.kind, geometryBytes: textureBytes + templateBytes + instanceBytes,
      storage: 'RGBA32F final corrected positions/radii; RGBA32F 21-point normals/random; one indexed ribbon template',
      noGuideRegenerationDuringAttach: true, originalCollisionCorrectionsPreserved: true,
      directPacked: !!packedData, expandedReferenceRetained: !!source,
      packedBuildDataBytes: packedData ? baseline.dataBytes : null,
      count, segments, surfaceSegments, conversionMs, decodeAudit, dataBytes,
      textures: {
        points: [points.image.width, points.image.height],
        normals: [normals.image.width, normals.image.height],
        type: 'RGBA32F', minFilter: 'NearestFilter', magFilter: 'NearestFilter', mipmaps: false,
      },
      render: {instanceCount: geometry.instanceCount, templateVertices: vertices, trianglesPerPass: count * segments * 2},
      comparisonMode: mode, disposed, physics: false, animation: false,
      fiber: fiberMaterialDiagnostics(fiber.material),
      referenceFiber: originalMaterial ? sourceFiberDiagnostics(originalMaterial) : null,
    };
  }
  function setComparisonMode(nextMode) {
    if (disposed) throw new Error('Instanced groom is disposed');
    if (!['instanced', 'reference', 'both', 'none'].includes(nextMode)) throw new Error('Unknown comparison mode');
    if (!source && (nextMode === 'reference' || nextMode === 'both')) throw new Error('No expanded reference was supplied');
    mode = nextMode;
    mesh.visible = nextMode === 'instanced' || nextMode === 'both';
    if (source) source.visible = nextMode === 'reference' || nextMode === 'both';
    viewer.render();
  }
  function createDecodedProbeView() {
    if (disposed) throw new Error('Instanced groom is disposed');
    mesh.updateWorldMatrix(true, false);
    const positions = new Float32Array(count * per * 6);
    for (let i = 0; i < count; i++) for (let j = 0; j < per; j++) {
      const src = (i * per + j) * 4, dst = (i * per + j) * 6;
      for (let k = 0; k < 3; k++) positions[dst + k] = positions[dst + 3 + k] = pointData[src + k];
    }
    return {
      mesh: {geometry: {attributes: {position: {array: positions}}}, matrixWorld: mesh.matrixWorld.clone()},
      report,
      diagnosticOnly: true,
      dataSource: 'CPU decoding of the actual uploaded FP32 point texture',
      cpuBytes: positions.byteLength,
    };
  }
  viewer.render();
  return {
    mesh, reference, material: fiber.material, depthMaterial: fiber.depthMaterial,
    textures: {points, normals}, report, audit, decodePoint, createDecodedProbeView, setComparisonMode,
    update() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.parent?.remove(mesh);
      geometry.dispose(); fiber.dispose(); points.dispose(); normals.dispose();
      if (source) source.visible = originalVisible;
      for (const [guide, visible] of hiddenGuides) guide.visible = visible;
      viewer.render();
    },
  };
}

/** Attach existing direct-packed arrays without copying them. Passing reference
 * is optional and explicit, intended for 1800-strand equivalence QA only. */
export function attachPackedGroomR30(a, packed, {reference = null, ...options} = {}) {
  return attachInstancedGroomR30(a, reference, {...options, packedData: packed});
}
