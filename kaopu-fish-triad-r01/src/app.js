import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import resolvedScore from '../scores/resolved/MUSKELLUNGE_RESOLVED_SCORE_R01.json';
import { VERSION, build, update, measure, snapshot, validate, dispose } from './instrument.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#stage');
const statusText = $('#statusText');
const scoreReport = validate(resolvedScore);
if (!scoreReport.valid) throw new Error(scoreReport.errors.join('；'));

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(0x071317, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x071317, 0.31);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
camera.position.set(1.20, 0.64, 1.34);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 0.135, 0);
controls.minDistance = 0.62;
controls.maxDistance = 4.2;
controls.update();

scene.add(new THREE.HemisphereLight(0xb9d6db, 0x142229, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 3.1);
key.position.set(-1.1, 1.8, 1.9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 8;
key.shadow.camera.left = -1.2;
key.shadow.camera.right = 1.2;
key.shadow.camera.top = 1.2;
key.shadow.camera.bottom = -1.2;
scene.add(key);
const rim = new THREE.DirectionalLight(0x75bfd0, 1.9);
rim.position.set(0.8, 0.4, -1.8);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffe2bf, 1.2);
fill.position.set(-1.5, -0.1, 0.3);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x0b2026, roughness: 0.92, metalness: 0.02, transparent: true, opacity: 0.64 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.105;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(4, 40, 0x34515a, 0x19323a);
grid.position.y = -0.102;
grid.material.transparent = true;
grid.material.opacity = 0.19;
scene.add(grid);

const performer = build(resolvedScore, { waterFlowMps: [0, 0, 0] });
scene.add(performer.root);
performer.root.rotation.y = 0;

const originalMaterials = new Map();
performer.root.traverse((object) => {
  if (object.isMesh || object.isSkinnedMesh) originalMaterials.set(object.uuid, object.material);
});
const whiteMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd9dddb, roughness: 0.55, metalness: 0.02, clearcoat: 0.05, side: THREE.DoubleSide });
let currentViewMode = 'surface';
let currentMotion = resolvedScore.performance.initialState.mode;
let playbackSpeed = 1;
let teacherObject = null;
let teacherVisible = true;

function restoreMaterials() {
  performer.root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh)) return;
    const material = originalMaterials.get(object.uuid);
    if (material) object.material = material;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((item) => {
      if (!item) return;
      item.wireframe = false;
      item.transparent = item.opacity < 1;
      if (item.userData.__surfaceOpacity !== undefined) item.opacity = item.userData.__surfaceOpacity;
      item.depthWrite = item.opacity >= 0.95;
    });
  });
  performer.skeletonHelper.visible = false;
}

function setViewMode(mode) {
  currentViewMode = mode;
  restoreMaterials();
  if (mode === 'white') {
    performer.root.traverse((object) => {
      if (object.isMesh || object.isSkinnedMesh) object.material = whiteMaterial;
    });
  }
  if (mode === 'wire') {
    performer.root.traverse((object) => {
      if (!(object.isMesh || object.isSkinnedMesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => { if (material) material.wireframe = true; });
    });
  }
  if (mode === 'skeleton') {
    performer.skeletonHelper.visible = true;
    performer.root.traverse((object) => {
      if (!(object.isMesh || object.isSkinnedMesh) || object === performer.skeletonHelper) return;
      const material = object.material;
      if (!material || Array.isArray(material)) return;
      material.userData.__surfaceOpacity ??= material.opacity;
      material.transparent = true;
      material.opacity = Math.min(0.34, material.opacity);
      material.depthWrite = false;
    });
  }
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === mode));
  updateStatus();
}

function setMotion(mode) {
  if (!resolvedScore.motion.modes[mode]) return;
  currentMotion = mode;
  performer.state.mode = mode;
  document.querySelectorAll('[data-motion]').forEach((button) => button.classList.toggle('active', button.dataset.motion === mode));
  updateStatus();
}

function cameraPreset(preset) {
  const target = new THREE.Vector3(0, 0.135, 0);
  const positions = {
    perspective: new THREE.Vector3(1.20, 0.64, 1.34),
    side: new THREE.Vector3(0, 0.18, 1.72),
    otherSide: new THREE.Vector3(0, 0.18, -1.72),
    top: new THREE.Vector3(0, 1.82, 0.002),
    front: new THREE.Vector3(-1.72, 0.18, 0)
  };
  camera.position.copy(positions[preset] ?? positions.perspective);
  controls.target.copy(target);
  controls.update();
}

function updateStatus() {
  statusText.textContent = `${VERSION} · ${currentMotion.replaceAll('_', ' ')} · ${currentViewMode.toUpperCase()}`;
  $('#motionReadout').textContent = currentMotion;
  $('#viewReadout').textContent = currentViewMode;
}

function populateDiagnostics() {
  const stats = measure(performer);
  const snapshotNow = snapshot(performer);
  $('#meshCount').textContent = stats.meshes.toLocaleString();
  $('#vertexCount').textContent = stats.vertices.toLocaleString();
  $('#triangleCount').textContent = stats.triangles.toLocaleString();
  $('#boneCount').textContent = stats.bones.toLocaleString();
  $('#boundsSize').textContent = stats.bounds.size.map((value) => value.toFixed(3)).join(' × ');
  $('#fingerprint').textContent = snapshotNow.diagnosticFingerprint32;
  window.__KAOPU_DIAGNOSTICS__ = { stats, snapshot: snapshotNow };
}

function drawReferenceDiagram() {
  const svg = $('#referenceDiagram');
  const stations = resolvedScore.construction.sections.stations;
  const xMin = -0.52;
  const xMax = 0.52;
  const yMin = -0.02;
  const yMax = 0.31;
  const W = 620;
  const H = 215;
  const mapX = (x) => (x - xMin) / (xMax - xMin) * W;
  const mapY = (y) => H - (y - yMin) / (yMax - yMin) * H;
  const top = stations.map((s) => `${mapX(s.xM).toFixed(1)},${mapY(s.centerYM + s.halfHeightM).toFixed(1)}`);
  const bottom = [...stations].reverse().map((s) => `${mapX(s.xM).toFixed(1)},${mapY(s.centerYM - s.halfHeightM).toFixed(1)}`);
  const body = [...top, ...bottom].join(' ');
  const finPolygons = resolvedScore.construction.parts.fins
    .filter((fin) => fin.plane === 'VERTICAL')
    .map((fin) => {
      const points = fin.profileM.map(([x, y]) => `${mapX(fin.rootXM + x).toFixed(1)},${mapY(fin.rootYM + y).toFixed(1)}`).join(' ');
      return `<polygon points="${points}" class="ref-fin"/>`;
    }).join('');
  const stationLines = stations.map((s) => `<line x1="${mapX(s.xM)}" y1="${mapY(s.centerYM - s.halfHeightM)}" x2="${mapX(s.xM)}" y2="${mapY(s.centerYM + s.halfHeightM)}"/>`).join('');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<polygon points="${body}" class="ref-body"/>${finPolygons}<g class="ref-stations">${stationLines}</g>`;
}

document.querySelectorAll('[data-motion]').forEach((button) => button.addEventListener('click', () => setMotion(button.dataset.motion)));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setViewMode(button.dataset.view)));
document.querySelectorAll('[data-camera]').forEach((button) => button.addEventListener('click', () => cameraPreset(button.dataset.camera)));
$('#speed').addEventListener('input', (event) => {
  playbackSpeed = Number(event.target.value);
  $('#speedValue').textContent = `${playbackSpeed.toFixed(2)}×`;
});
$('#pause').addEventListener('click', () => {
  playbackSpeed = playbackSpeed === 0 ? 1 : 0;
  $('#speed').value = String(playbackSpeed);
  $('#speedValue').textContent = `${playbackSpeed.toFixed(2)}×`;
  $('#pause').textContent = playbackSpeed === 0 ? '继续' : '暂停';
});
$('#teacherToggle').addEventListener('click', () => {
  teacherVisible = !teacherVisible;
  if (teacherObject) teacherObject.visible = teacherVisible;
  $('#teacherToggle').textContent = teacherVisible ? '隐藏本地老师' : '显示本地老师';
});

$('#fbxInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  $('#teacherImportStatus').textContent = '正在解析本地 FBX…';
  try {
    const buffer = await file.arrayBuffer();
    const loader = new FBXLoader();
    const object = loader.parse(buffer, '');
    if (teacherObject) scene.remove(teacherObject);
    teacherObject = object;
    teacherObject.name = 'LOCAL_REFERENCE_TEACHER_ONLY';
    teacherObject.traverse((child) => {
      if (!child.isMesh) return;
      child.material = new THREE.MeshStandardMaterial({ color: 0x54d3e6, wireframe: true, transparent: true, opacity: 0.18, depthWrite: false });
      child.castShadow = false;
      child.receiveShadow = false;
    });
    const box = new THREE.Box3().setFromObject(teacherObject);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    const scale = longest > 0 ? 0.98 / longest : 1;
    teacherObject.scale.setScalar(scale);
    teacherObject.position.copy(center.multiplyScalar(-scale));
    teacherObject.position.y += 0.14;
    teacherObject.visible = teacherVisible;
    scene.add(teacherObject);
    $('#teacherImportStatus').textContent = `本地老师已载入：${file.name}（仅比较，不进入正式谱或播放器）`;
    $('#teacherToggle').disabled = false;
  } catch (error) {
    $('#teacherImportStatus').textContent = `FBX 解析失败：${error.message}`;
    console.error(error);
  }
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(canvas);
resize();

const clock = new THREE.Clock();
let simulationTime = 0;
let diagnosticsTimer = 0;
function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  simulationTime += delta * playbackSpeed;
  update(performer, simulationTime, { waterFlowMps: [0, 0, 0] }, { mode: currentMotion });
  controls.update();
  renderer.render(scene, camera);
  diagnosticsTimer += delta;
  if (diagnosticsTimer > 0.8) {
    diagnosticsTimer = 0;
    populateDiagnostics();
  }
  requestAnimationFrame(animate);
}

drawReferenceDiagram();
setMotion(currentMotion);
setViewMode('surface');
cameraPreset('perspective');
populateDiagnostics();
updateStatus();
window.__KAOPU_READY__ = true;
window.__KAOPU_HANDLE__ = performer;
window.__KAOPU_SCORE__ = resolvedScore;
window.__KAOPU_SET_MOTION__ = setMotion;
window.__KAOPU_SET_VIEW__ = setViewMode;
window.addEventListener('beforeunload', () => {
  resizeObserver.disconnect();
  dispose(performer);
  renderer.dispose();
});
animate();
