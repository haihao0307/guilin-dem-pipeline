import * as THREE from '../vendor/three.module.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {createNativeBody, NATIVE_CLOTH_APPEARANCE} from './render-support.mjs';

const GROUND_SHIFT_M = 0.9858653545379639;
const STRAIN_COLOR_LIMIT = .15;
const SOURCE_NORMALS = 'presets/r04/sewn-normals-r0433.mjs @ c84b16a0ae022dda9fe22c09df758fcb8095bc07';

/** Engineering principal strains of F = Ds * inverse(Dm).
 * Both UV and solved positions use millimetres. No material calibration,
 * stress model or pressure inference is involved. The signed display value
 * is the principal strain with greatest absolute magnitude.
 */
export function trianglePrincipalStrain(uv0, uv1, uv2, p0, p1, p2) {
  const a = uv1[0] - uv0[0], b = uv2[0] - uv0[0];
  const c = uv1[1] - uv0[1], d = uv2[1] - uv0[1];
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) {
    throw new Error('纸样包含退化三角形，无法计算材料应变。');
  }
  let c00 = 0, c01 = 0, c11 = 0;
  for (let k = 0; k < 3; k++) {
    const ds0 = p1[k] - p0[k], ds1 = p2[k] - p0[k];
    const f0 = (ds0 * d - ds1 * c) / determinant;
    const f1 = (-ds0 * b + ds1 * a) / determinant;
    c00 += f0 * f0;
    c01 += f0 * f1;
    c11 += f1 * f1;
  }
  const delta = Math.hypot(c00 - c11, 2 * c01);
  const majorStretch = Math.sqrt(Math.max(0, (c00 + c11 + delta) / 2));
  const minorStretch = Math.sqrt(Math.max(0, (c00 + c11 - delta) / 2));
  const major = majorStretch - 1, minor = minorStretch - 1;
  const signedMax = Math.abs(major) >= Math.abs(minor) ? major : minor;
  if (![majorStretch, minorStretch, signedMax].every(Number.isFinite)) {
    throw new Error('成衣三角形包含非有限的材料应变。');
  }
  return {major, minor, majorStretch, minorStretch, signedMax};
}

// Retained original sewn-normal algorithm. It only joins shading normals on
// already coincident, active stitches; no coordinates or indices are changed.
function smoothSewnNormals(geometry, spec, activeSeams = []) {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  if (!p || !n) return {joined: 0};
  const active = new Set(activeSeams), offsets = new Map();
  let count = 0;
  for (const panel of spec.panels) { offsets.set(panel.id, count); count += panel.uvMm.length; }
  if (count !== p.count) throw Error('SEAM_NORMAL_VERTEX_COUNT');
  const parent = Int32Array.from({length: count}, (_, i) => i), base = Float32Array.from(n.array);
  const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  let joined = 0, rejectedGap = 0, rejectedFold = 0;
  for (const seam of spec.seams || []) {
    if (!active.has(seam.id)) continue;
    const oa = offsets.get(seam.a.panelId), ob = offsets.get(seam.b.panelId);
    if (oa === undefined || ob === undefined) throw Error('SEAM_NORMAL_PANEL_ID');
    for (const [a, b] of seam.stitchVertexPairs || []) {
      const i = oa + a, j = ob + b;
      if (i >= count || j >= count || i < 0 || j < 0) throw Error('SEAM_NORMAL_INDEX');
      let distance = 0, dot = 0;
      for (let k = 0; k < 3; k++) {
        distance += (p.array[3 * i + k] - p.array[3 * j + k]) ** 2;
        dot += base[3 * i + k] * base[3 * j + k];
      }
      if (distance > 1e-12) { rejectedGap++; continue; }
      if (dot < .5) { rejectedFold++; continue; }
      const r = root(i), s = root(j);
      if (r !== s) { parent[s] = r; joined++; }
    }
  }
  const groups = new Map();
  for (let i = 0; i < count; i++) { const r = root(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  let smoothedVertices = 0;
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    let compatible = true;
    for (const i of ids) for (const j of ids) {
      let dot = 0;
      for (let k = 0; k < 3; k++) dot += base[3 * i + k] * base[3 * j + k];
      if (dot < .5) compatible = false;
    }
    if (!compatible) continue;
    const sum = [0, 0, 0];
    for (const i of ids) for (let k = 0; k < 3; k++) sum[k] += base[3 * i + k];
    const length = Math.hypot(...sum);
    if (length < 1e-8) continue;
    for (const i of ids) for (let k = 0; k < 3; k++) n.array[3 * i + k] = sum[k] / length;
    smoothedVertices += ids.length;
  }
  n.needsUpdate = true;
  return {joined, smoothedVertices, rejectedGap, rejectedFold, positionsChanged: false, indicesChanged: false, maxGapMm: .001, maximumNormalAngleDeg: 60};
}

function validateResult(result) {
  const panels = result?.spec?.panels, positions = result?.record?.positionsMm;
  if (!Array.isArray(panels) || !panels.length || !Array.isArray(positions)) throw new Error('成衣结果不完整。');
  let count = 0;
  const ids = new Set();
  for (const panel of panels) {
    if (typeof panel.id !== 'string' || ids.has(panel.id) || !Array.isArray(panel.uvMm) || panel.uvMm.length < 3 || !Array.isArray(panel.triangles) || !panel.triangles.length) throw new Error('裁片身份或拓扑无效。');
    ids.add(panel.id);
    if (!panel.uvMm.every(p => p.length === 2 && p.every(Number.isFinite))) throw new Error('纸样坐标无效。');
    for (const tri of panel.triangles) if (tri.length !== 3 || !tri.every(i => Number.isInteger(i) && i >= 0 && i < panel.uvMm.length)) throw new Error('成衣三角形索引无效。');
    count += panel.uvMm.length;
  }
  if (positions.length !== count || !positions.every(p => p.length === 3 && p.every(Number.isFinite))) throw new Error('成衣坐标数量或数值与纸样不符。');
  return count;
}

function lineGeometry(vertices, sequences, closed = false) {
  const points = [];
  for (const sequence of sequences) {
    if (!Array.isArray(sequence) || sequence.length < 2) continue;
    const n = sequence.length;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const a = sequence[i], b = sequence[(i + 1) % n];
      if (![a, b].every(j => Number.isInteger(j) && j >= 0 && 3 * j + 2 < vertices.length)) throw new Error('裁片边界引用无效。');
      points.push(vertices[3 * a], vertices[3 * a + 1], vertices[3 * a + 2], vertices[3 * b], vertices[3 * b + 1], vertices[3 * b + 2]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function buildGarment(result) {
  const count = validateResult(result), {spec, record} = result;
  const combined = new THREE.BufferGeometry(), positions = new Float32Array(count * 3), indices = [];
  record.positionsMm.forEach((p, i) => positions.set([
    Math.fround(p[0] / 1000),
    Math.fround(Math.fround(p[1] / 1000) - GROUND_SHIFT_M),
    Math.fround(p[2] / 1000)
  ], 3 * i));
  let offset = 0;
  for (const panel of spec.panels) {
    for (const tri of panel.triangles) indices.push(...tri.map(i => offset + i));
    offset += panel.uvMm.length;
  }
  combined.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  combined.setIndex(indices);
  combined.computeVertexNormals();
  const normalAudit = smoothSewnNormals(combined, spec, record.activeSeams || []);
  const normals = combined.attributes.normal.array;
  if (!normals.every(Number.isFinite)) throw new Error('成衣法线无效。');
  const group = new THREE.Group(), rows = [], active = new Set(record.activeSeams || []);
  const signedValues = [], principalMajor = [], principalMinor = [];
  const neutral = new THREE.Color('#e1e4d8'), tension = new THREE.Color('#c24f35'), compression = new THREE.Color('#427f9c');
  let pendingResources = [];
  offset = 0;
  try {
    for (const panel of spec.panels) {
      const n = panel.uvMm.length;
      const local = positions.slice(offset * 3, (offset + n) * 3);
      const geometry = new THREE.BufferGeometry();
      pendingResources.push(geometry);
      geometry.setAttribute('position', new THREE.BufferAttribute(local, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals.slice(offset * 3, (offset + n) * 3), 3));
      geometry.setIndex(panel.triangles.flat());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const fabricMaterial = new THREE.MeshStandardMaterial({color: NATIVE_CLOTH_APPEARANCE.color, roughness: NATIVE_CLOTH_APPEARANCE.roughness, side: THREE.DoubleSide});
      pendingResources.push(fabricMaterial);
      // Diagnostic geometry duplicates the very same solved triangle corners,
      // without moving them, so each triangle receives its exact scalar color.
      const strainGeometry = geometry.toNonIndexed(), colors = new Float32Array(panel.triangles.length * 9);
      pendingResources.push(strainGeometry);
      for (let t = 0; t < panel.triangles.length; t++) {
        const [a, b, c] = panel.triangles[t];
        const value = trianglePrincipalStrain(panel.uvMm[a], panel.uvMm[b], panel.uvMm[c], record.positionsMm[offset + a], record.positionsMm[offset + b], record.positionsMm[offset + c]);
        signedValues.push(value.signedMax); principalMajor.push(value.major); principalMinor.push(value.minor);
        const color = neutral.clone().lerp(value.signedMax < 0 ? compression : tension, Math.min(1, Math.abs(value.signedMax) / STRAIN_COLOR_LIMIT));
        for (let v = 0; v < 3; v++) colors.set([color.r, color.g, color.b], t * 9 + v * 3);
      }
      strainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const strainMaterial = new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide, toneMapped: false});
      pendingResources.push(strainMaterial);
      const mesh = new THREE.Mesh(geometry, fabricMaterial);
      mesh.name = 'native-material-panel-' + panel.id;
      mesh.userData.panelId = panel.id;
      const selectedEdges = new Set();
      for (const seam of spec.seams || []) if (active.has(seam.id)) {
        for (const ref of [seam.a, seam.b]) if (ref.panelId === panel.id) selectedEdges.add(ref.edge);
      }
      const seamSequences = [...selectedEdges].map(id => {
        if (!Array.isArray(panel.edges?.[id])) throw new Error('活动接缝引用了不存在的裁片边。');
        return panel.edges[id];
      });
      const seamGeometry = lineGeometry(local, seamSequences);
      pendingResources.push(seamGeometry);
      const seamMaterial = new THREE.LineBasicMaterial({color: 0x526350, transparent: true, opacity: .8, depthWrite: false, depthFunc: THREE.LessEqualDepth});
      pendingResources.push(seamMaterial);
      const seams = new THREE.LineSegments(seamGeometry, seamMaterial);
      seams.name = 'active-seam-annotations-' + panel.id; seams.renderOrder = 3; seams.visible = false;
      const outlineGeometry = lineGeometry(local, [panel.boundary || []], true);
      pendingResources.push(outlineGeometry);
      const outlineMaterial = new THREE.LineBasicMaterial({color: 0xfff8dd, depthWrite: false, depthFunc: THREE.LessEqualDepth});
      pendingResources.push(outlineMaterial);
      const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      outline.name = 'selected-panel-boundary-' + panel.id; outline.renderOrder = 4; outline.visible = false;
      group.add(mesh, seams, outline);
      rows.push({id: panel.id, mesh, seams, outline, geometry, strainGeometry, fabricMaterial, strainMaterial, vertices: n, triangles: panel.triangles.length});
      pendingResources = [];
      offset += n;
    }
  } catch (error) {
    for (const row of rows) disposeRow(row);
    for (const resource of pendingResources) resource.dispose();
    combined.dispose();
    throw error;
  }
  combined.dispose();
  const sorted = signedValues.map(Math.abs).sort((a, b) => a - b);
  const greatest = signedValues.reduce((a, b) => Math.abs(a) >= Math.abs(b) ? a : b, 0);
  const stats = {
    vertices: count, triangles: indices.length / 3, panels: rows.length,
    panelIds: rows.map(row => row.id), activeSeams: active.size,
    normalAudit, normalSource: SOURCE_NORMALS,
    strain: {minimumPrincipal: Math.min(...principalMinor), maximumPrincipal: Math.max(...principalMajor), signedMaximumAbsolute: greatest, p95Absolute: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)], trianglesMeasured: signedValues.length, units: 'engineering strain; dimensionless', pressure: false},
    coordinateMapping: 'positionsMm / 1000, subtract original groundShift from Y only',
    movedSolvedVertices: false, physicalTopologyChanged: false,
    diagnosticCornerExpansion: 'Only duplicate original corners for constant per-triangle diagnostic colors; physical mesh remains unchanged'
  };
  return {group, rows, stats, dispose() { for (const row of rows) disposeRow(row); group.clear(); }};
}

function disposeRow(row) {
  row.geometry.dispose(); row.strainGeometry.dispose(); row.fabricMaterial.dispose(); row.strainMaterial.dispose();
  row.seams.geometry.dispose(); row.seams.material.dispose(); row.outline.geometry.dispose(); row.outline.material.dispose();
}

function addOriginalLights(scene) {
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x353945, 1.6));
  const key = new THREE.DirectionalLight(0xffdac1, 3.2); key.position.set(-2, 3, 4);
  const rim = new THREE.DirectionalLight(0xa3c2df, 2.6); rim.position.set(2, 2, -2);
  scene.add(key, rim);
}

export function createStudyStage(canvas, frozenPerson, originalResult, {onSelectPanel = () => {}, onRender = () => {}} = {}) {
  if (!canvas?.getContext) throw new Error('三维画布不存在。');
  let disposed = false, ready = false, lost = false, raf = 0, width = 1, height = 1, leftWidth = 1;
  let display = 'fabric', selectedPanel = null, seamsVisible = false, namedView = 'back-detail';
  let renderCalls = 0, sceneDraws = 0, lastRenderMS = 0, candidateRevision = 0;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0xece9e1, 1);
  const scenes = [new THREE.Scene(), new THREE.Scene()];
  const camera = new THREE.PerspectiveCamera(31, 1, .01, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.minDistance = .25; controls.maxDistance = 12;
  const bodies = scenes.map(scene => {
    const body = createNativeBody(THREE, frozenPerson, scheduleRender);
    scene.add(body.mesh); addOriginalLights(scene); return body;
  });
  const garments = [buildGarment(originalResult), buildGarment(originalResult)];
  garments.forEach((garment, i) => scenes[i].add(garment.group));
  const container = canvas.parentElement;
  if (!container) throw new Error('三维画布没有显示容器。');

  function scheduleRender() {
    if (disposed || lost || !ready || raf) return;
    raf = requestAnimationFrame(render);
  }
  function render() {
    raf = 0;
    if (disposed || lost || !ready) return;
    const began = performance.now();
    renderer.setScissorTest(true);
    for (let i = 0; i < 2; i++) {
      const x = i ? leftWidth : 0, w = i ? width - leftWidth : leftWidth;
      camera.aspect = w / height; camera.updateProjectionMatrix();
      renderer.setViewport(x, 0, w, height); renderer.setScissor(x, 0, w, height);
      renderer.render(scenes[i], camera); sceneDraws++;
    }
    camera.aspect = leftWidth / height; camera.updateProjectionMatrix();
    renderer.setScissorTest(false);
    renderCalls++; lastRenderMS = performance.now() - began;
    onRender(snapshot());
  }
  function garmentBounds() {
    const bounds = new THREE.Box3();
    for (const garment of garments) for (const row of garment.rows) bounds.union(row.geometry.boundingBox);
    return bounds;
  }
  function frame(which) {
    const isDetail = which === 'detail' || which === 'back-detail';
    const bounds = isDetail ? garmentBounds() : new THREE.Box3().setFromBufferAttribute(bodies[0].geometry.attributes.position);
    if (!isDetail) bounds.union(garmentBounds());
    if (which === 'back-detail') {
      // Frame the lower, central area of BOTH solved garments with the same
      // camera. Only camera bounds change; no garment or body vertices move.
      const size = bounds.getSize(new THREE.Vector3()), centerX = (bounds.min.x + bounds.max.x) / 2;
      bounds.max.y = bounds.min.y + size.y * .62;
      bounds.min.x = centerX - size.x * .36;
      bounds.max.x = centerX + size.x * .36;
    }
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const angle = which === 'side' ? Math.PI / 2 : which === 'back' || which === 'back-detail' ? Math.PI : 0;
    const horizontal = Math.abs(Math.cos(angle)) * size.x + Math.abs(Math.sin(angle)) * size.z;
    const pad = which === 'back-detail' ? 1.2 : which === 'detail' ? 1.28 : 1.2;
    const distance = Math.max(size.y, horizontal / camera.aspect) / (2 * Math.tan(camera.fov * Math.PI / 360)) * pad;
    camera.position.copy(center).add(new THREE.Vector3(Math.sin(angle) * distance, 0, Math.cos(angle) * distance));
    controls.target.copy(center); camera.zoom = 1; camera.updateProjectionMatrix(); controls.update();
  }
  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = Math.max(2, Math.floor(rect.width)); height = Math.max(1, Math.floor(rect.height)); leftWidth = Math.floor(width / 2);
    renderer.setSize(width, height, false);
    camera.aspect = leftWidth / height; camera.updateProjectionMatrix();
    if (namedView !== 'orbit') frame(namedView);
    scheduleRender();
  }
  function applyPresentation() {
    for (const garment of garments) for (const row of garment.rows) {
      row.mesh.geometry = display === 'strain' ? row.strainGeometry : row.geometry;
      row.mesh.material = display === 'strain' ? row.strainMaterial : row.fabricMaterial;
      row.fabricMaterial.color.set(NATIVE_CLOTH_APPEARANCE.color);
      if (selectedPanel) {
        if (row.id === selectedPanel) row.fabricMaterial.color.lerp(new THREE.Color(0xffffff), .2);
        else row.fabricMaterial.color.multiplyScalar(.84);
      }
      row.outline.visible = row.id === selectedPanel;
      row.seams.visible = seamsVisible;
    }
    scheduleRender();
  }
  function selectPanel(id) {
    if (id !== null && !garments.some(g => g.rows.some(row => row.id === id))) throw new Error('所选裁片不在当前成衣中。');
    selectedPanel = id; applyPresentation();
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let pointerDown = null, pointerWasMultiple = false;
  const activePointers = new Set();
  function down(event) {
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) pointerWasMultiple = true;
    if (event.isPrimary && (event.button === 0 || event.pointerType === 'touch')) {
      pointerDown = {id: event.pointerId, x: event.clientX, y: event.clientY};
      pointerWasMultiple = activePointers.size > 1;
    }
  }
  function up(event) {
    activePointers.delete(event.pointerId);
    if (!pointerDown || pointerDown.id !== event.pointerId) return;
    const start = pointerDown; pointerDown = null;
    if (pointerWasMultiple || Math.hypot(start.x - event.clientX, start.y - event.clientY) > 5 || disposed || lost) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * width;
    const side = x >= leftWidth ? 1 : 0, panelWidth = side ? width - leftWidth : leftWidth;
    pointer.set((x - (side ? leftWidth : 0)) / panelWidth * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    camera.aspect = panelWidth / height; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    scenes[side].updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([bodies[side].mesh, ...garments[side].rows.map(row => row.mesh)], false)[0];
    const id = hit?.object?.userData?.panelId || null;
    selectPanel(id); onSelectPanel(id);
  }
  function cancelPointer(event) { activePointers.delete(event.pointerId); if (pointerDown?.id === event.pointerId) pointerDown = null; }
  function manualView() { namedView = 'orbit'; }
  function contextLost(event) { event.preventDefault(); lost = true; if (raf) cancelAnimationFrame(raf); raf = 0; onRender(snapshot()); }
  function contextRestored() { lost = false; scheduleRender(); }
  controls.addEventListener('change', scheduleRender); controls.addEventListener('start', manualView);
  canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  const observer = new ResizeObserver(resize); observer.observe(container);
  ready = true; resize();

  function snapshot() {
    return {
      ready: ready && !disposed && !lost, contextLost: lost, display, selectedPanel,
      seamsVisible, namedView, candidateRevision, viewport: {width, height, views: 2},
      camera: {position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom, fov: camera.fov},
      renderCalls, sceneDraws, lastRenderCPUMS: lastRenderMS,
      renderPolicy: 'On demand; shared camera; one renderer, two scissored scenes; no simulated animation loop',
      body: {verticesPerView: bodies[0].model.vertexCount, trianglesPerView: bodies[0].model.faces.length / 3, geometrySHA256: bodies[0].mesh.userData.geometrySHA256, topologySHA256: bodies[0].mesh.userData.topologySHA256, originalFrozenSkinFields: true},
      original: structuredClone(garments[0].stats), candidate: structuredClone(garments[1].stats),
      strainColors: {negative: 'compression blue', zero: 'neutral', positive: 'tension red', saturationAbsoluteStrain: STRAIN_COLOR_LIMIT, mapping: 'per-triangle largest-absolute principal engineering strain; not pressure'},
      normalsMethod: SOURCE_NORMALS, noProxy: true, bodyScaling: false, garmentScaling: false,
      singleRenderer: true, sharedCamera: true, physicalSolverRunsInStage: false
    };
  }
  return {
    setCandidate(result) {
      if (disposed || lost) throw new Error('三维显示当前不可用。');
      // Construct and validate before replacing the current usable candidate.
      const next = buildGarment(result), previous = garments[1];
      scenes[1].add(next.group); scenes[1].remove(previous.group); garments[1] = next;
      previous.dispose(); candidateRevision++;
      if (selectedPanel && !garments.some(g => g.rows.some(row => row.id === selectedPanel))) selectedPanel = null;
      applyPresentation(); if (namedView !== 'orbit') frame(namedView); scheduleRender();
    },
    setDisplay(value) { if (!['fabric', 'strain'].includes(value)) throw new Error('未知显示方式。'); display = value; applyPresentation(); },
    selectPanel,
    setSeams(value) { seamsVisible = !!value; applyPresentation(); },
    view(value) { if (!['front', 'side', 'back', 'detail', 'back-detail'].includes(value)) throw new Error('未知观察角度。'); namedView = value; frame(value); scheduleRender(); },
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true; ready = false; if (raf) cancelAnimationFrame(raf);
      observer.disconnect(); controls.removeEventListener('change', scheduleRender); controls.removeEventListener('start', manualView); controls.dispose();
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancelPointer);
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
      garments.forEach(g => g.dispose()); bodies.forEach(body => body.dispose()); scenes.forEach(scene => scene.clear()); renderer.dispose();
    }
  };
}
