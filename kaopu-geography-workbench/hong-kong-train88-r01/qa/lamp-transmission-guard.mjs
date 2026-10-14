/**
 * Local QA candidate only; not imported by integration.mjs.
 *
 * const guard = createLampTransmissionGuard({T, root: display});
 * // After updating the camera / placement and before each renderer.render:
 * guard.update(camera);
 * try { renderer.render(scene, camera); } finally { guard.reset(); }
 * guard.setEnabled(false); // also restores any visibility owned by this guard
 *
 * The only supported shader is the current rigid, non-displaced native lamp
 * glass. Geometry, material, transforms, ancestors, and shadows are not edited.
 * The caller must call reset immediately after rendering; the override must
 * never span UI/event handling. reset cannot detect a concurrent write of false
 * to an already-false mesh, which is why this is a synchronous render scope.
 *
 * For a perspective camera, a triangle's FrontSide half-space is exactly
 * ((b-a) x (c-a)) dot (eyeLocal-a) > 0. This is the homogeneous projected
 * orientation after clipping, not a lamp-axis, normal-attribute, or occlusion
 * approximation. Three r170 flips gl.frontFace for a negative model determinant,
 * cancelling that determinant's sign. Positive camera orientation and an
 * ordinary, unmirrored WebGL perspective projection are required here.
 *
 * Strictly negative planes, separated from zero by a conservative float32
 * transform/projection error budget, are required for EVERY triangle. Clipping
 * preserves winding; it cannot turn an entirely back-facing polygon into a
 * front-facing polygon. The budget addresses ordinary highp float32 arithmetic;
 * it is not a claim of bit-identical behavior on every GPU implementation.
 * Unknown, edge-on, degenerate, changed, or unsupported inputs retain the mesh.
 */
export const LAMP_MATERIAL_NAME = 'A4 native clear convex lamp glass / non-emissive';
const U32 = 2 ** -24, GAMMA4 = 4 * U32 / (1 - 4 * U32);
const finite = values => values.every(Number.isFinite);
const affine = m => finite(m.elements) && m.elements[3] === 0 &&
  m.elements[7] === 0 && m.elements[11] === 0 && m.elements[15] === 1;
const effectivelyVisible = mesh => {
  for (let p = mesh; p; p = p.parent) if (!p.visible) return false;
  return true;
};

function prepare(mesh, T) {
  const material = mesh.material, g = mesh.geometry, p = g?.attributes.position, index = g?.index;
  const expectedKey = T.Material.prototype.onBeforeCompile.toString() + '/rigid-source-domain-v1';
  // The batched lamp is deliberately singled out; other glass is never touched.
  if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.isBatchedMesh ||
      Array.isArray(material) || material?.name !== LAMP_MATERIAL_NAME ||
      material.customProgramCacheKey() !== expectedKey || !material.isMeshPhysicalMaterial ||
      mesh.onBeforeRender !== T.Object3D.prototype.onBeforeRender || mesh.castShadow ||
      !p || p.itemSize !== 3 || p.normalized || p.isInterleavedBufferAttribute ||
      !(p.array instanceof Float32Array) || Object.keys(g.morphAttributes).length ||
      (index && !(index.array instanceof Uint16Array || index.array instanceof Uint32Array))) return null;
  const count = index?.count ?? p.count;
  if (!count || count % 3) return null;
  const planes = new Float64Array(count / 3 * 8), bounds = [0, 0, 0];
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3();
  for (let i = 0, j = 0; i < count; i += 3, j += 8) {
    const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k);
    if (ids.some(id => !Number.isInteger(id) || id < 0 || id >= p.count)) return null;
    a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
    for (const v of [a, b, c]) {
      if (!finite(v.toArray())) return null;
      for (let k = 0; k < 3; k++) bounds[k] = Math.max(bounds[k], Math.abs(v.getComponent(k)));
    }
    b.sub(a); c.sub(a); n.crossVectors(b, c);
    const area2 = n.length();
    // Degeneracy is unknown, rather than assuming the GPU must discard it.
    if (!(area2 > 0) || !Number.isFinite(area2)) return null;
    n.multiplyScalar(1 / area2);
    planes.set([n.x, n.y, n.z, a.x, a.y, a.z, (b.length() + c.length()) / area2, 1 / area2], j);
  }
  return {mesh, material, geometry: g, position: p, index, planes, bounds,
    positionVersion: p.version, indexVersion: index?.version,
    materialVersion: material.version, onBeforeCompile: material.onBeforeCompile,
    programKey: material.customProgramCacheKey, expectedKey};
}

function unchanged(r, T) {
  const {mesh, material: m, geometry: g, position: p, index} = r;
  return mesh.geometry === g && mesh.material === m && m.side === T.FrontSide &&
    m.visible && m.transmission > 0 && !m.wireframe && !m.displacementMap &&
    m.version === r.materialVersion && m.onBeforeCompile === r.onBeforeCompile &&
    m.customProgramCacheKey === r.programKey && m.customProgramCacheKey() === r.expectedKey &&
    mesh.onBeforeRender === T.Object3D.prototype.onBeforeRender && !mesh.castShadow &&
    !mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.isBatchedMesh &&
    !Object.keys(g.morphAttributes).length && g.attributes.position === p &&
    g.index === index && p.version === r.positionVersion && index?.version === r.indexVersion;
}

function standardCamera(camera, T) {
  if (!camera?.isPerspectiveCamera || camera.isArrayCamera ||
      camera.coordinateSystem !== T.WebGLCoordinateSystem) return false;
  const p = camera.projectionMatrix.elements;
  return affine(camera.matrixWorld) && camera.matrixWorld.determinant() > 0 && finite(p) &&
    p[0] > 0 && p[5] > 0 && p[1] === 0 && p[2] === 0 && p[3] === 0 &&
    p[4] === 0 && p[6] === 0 && p[7] === 0 && p[11] === -1 &&
    p[12] === 0 && p[13] === 0 && p[15] === 0 && p[14] < 0;
}

// Uniform float32 quantization plus a four-term highp dot product's roundoff.
// This bound is global for the mesh, so no per-frame vertex stream is needed.
function errorBudget(r, modelView, projection) {
  const m = modelView.elements, q = m.map(Math.fround), max = [], error = [];
  for (let row = 0; row < 3; row++) {
    let sum = Math.abs(q[12 + row]), diff = Math.abs(m[12 + row] - q[12 + row]);
    for (let k = 0; k < 3; k++) {
      sum += Math.abs(q[k * 4 + row]) * r.bounds[k];
      diff += Math.abs(m[k * 4 + row] - q[k * 4 + row]) * r.bounds[k];
    }
    error[row] = diff + GAMMA4 * sum;
    max[row] = sum + error[row];
  }
  const p = projection.elements;
  for (let row = 0; row < 2; row++) {
    const scale = p[row * 5], offset = p[8 + row], fs = Math.fround(scale), fo = Math.fround(offset);
    error[row] += (Math.abs(scale - fs) * max[row] + Math.abs(offset - fo) * max[2] +
      GAMMA4 * (Math.abs(fs) * max[row] + Math.abs(fo) * max[2])) / scale;
  }
  // ||A||_2 <= sqrt(||A^T A||_infinity), exact 1 for rigid transforms up to roundoff.
  let normSquared = 0;
  for (let i = 0; i < 3; i++) {
    let row = 0;
    for (let j = 0; j < 3; j++) {
      let dot = 0;
      for (let k = 0; k < 3; k++) dot += m[4 * i + k] * m[4 * j + k];
      row += Math.abs(dot);
    }
    normSquared = Math.max(normSquared, row);
  }
  return {epsilon: Math.hypot(...error), radius: Math.hypot(...max),
    norm: Math.sqrt(normSquared), det: Math.abs(modelView.determinant())};
}

export function createLampTransmissionGuard({T, root, enabled = true}) {
  if (!T || !root?.traverse) throw new TypeError('T and the rigid display root are required');
  const records = [], hidden = [];
  root.traverse(mesh => {
    if (mesh.material?.name !== LAMP_MATERIAL_NAME) return;
    const record = prepare(mesh, T);
    if (record) records.push(record);
  });
  const inverse = new T.Matrix4(), modelView = new T.Matrix4(), eye = new T.Vector3();
  const stats = {candidateMeshes: records.length, triangles: records.reduce((n, r) => n + r.planes.length / 8, 0),
    hiddenMeshes: 0, testedTriangles: 0, reason: 'not-updated'};
  function reset() {
    for (const {mesh, visible} of hidden) mesh.visible = visible;
    hidden.length = 0;
  }
  function update(camera) {
    reset();
    stats.hiddenMeshes = 0; stats.testedTriangles = 0;
    if (!enabled) { stats.reason = 'disabled'; return {...stats}; }
    camera?.updateWorldMatrix?.(true, false);
    if (!standardCamera(camera, T)) { stats.reason = 'unsupported-camera'; return {...stats}; }
    stats.reason = 'retained';
    for (const r of records) {
      if (!effectivelyVisible(r.mesh) || !unchanged(r, T)) continue;
      r.mesh.updateWorldMatrix(true, false);
      const world = r.mesh.matrixWorld, det = world.determinant();
      if (!affine(world) || !Number.isFinite(det) || det === 0) continue;
      inverse.copy(world).invert();
      eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
      modelView.multiplyMatrices(camera.matrixWorldInverse, world);
      const e = errorBudget(r, modelView, camera.projectionMatrix);
      if (!finite([...eye.toArray(), ...Object.values(e)]) || !(e.det > 0)) continue;
      // Roundoff bound for n'=(u+du)x(v+dv), w'=w+dw, with |du|,|dv|<=2eps.
      // Divide the resulting triple-product error by |det(A)|*|nLocal|.
      const cpuMargin = 1e-6 * (1 + eye.length());
      let allBack = true;
      for (let i = 0; i < r.planes.length; i += 8) {
        stats.testedTriangles++;
        const p = r.planes;
        const signedDistance = p[i] * (eye.x - p[i + 3]) + p[i + 1] * (eye.y - p[i + 4]) +
          p[i + 2] * (eye.z - p[i + 5]);
        const budget = (e.norm ** 2 * e.epsilon +
          (2 * e.epsilon * e.norm * p[i + 6] + 4 * e.epsilon ** 2 * p[i + 7]) *
          (e.radius + e.epsilon)) / e.det + cpuMargin;
        if (!Number.isFinite(signedDistance) || !Number.isFinite(budget) || !(signedDistance < -budget)) {
          allBack = false; break;
        }
      }
      if (allBack) {
        hidden.push({mesh: r.mesh, visible: r.mesh.visible});
        r.mesh.visible = false;
        stats.hiddenMeshes++;
      }
    }
    if (stats.hiddenMeshes) stats.reason = 'strictly-back-facing';
    return {...stats};
  }
  return {update, reset, setEnabled(value) { enabled = Boolean(value); if (!enabled) reset(); },
    get enabled() { return enabled; }, get stats() { return {...stats}; }};
}
