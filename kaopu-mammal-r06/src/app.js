import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  VERSION,
  CONTRACT,
  buildScore,
  dispose,
  measure,
  fingerprint,
  verifyReplay,
  parseScore,
} from './instrument.js';
import { SCORE_LIBRARY } from './scores.js';

const viewport = document.querySelector('#viewport');
const scoreInput = document.querySelector('#score');
const statusNode = document.querySelector('#status');
const sourceNode = document.querySelector('#active-source');
const instrumentBytes = Number(document.querySelector('meta[name="kaopu-instrument-bytes"]')?.content || 0);
const instrumentPayload = document.querySelector('#kaopu-instrument-payload')?.textContent?.trim() || '';
const presetButtons = [...document.querySelectorAll('[data-score-key]')];
const nodes = {
  scoreBytes: document.querySelector('#score-bytes'),
  instrumentBytes: document.querySelector('#instrument-bytes'),
  meshes: document.querySelector('#meshes'),
  triangles: document.querySelector('#triangles'),
  geometryBytes: document.querySelector('#geometry-bytes'),
  hash: document.querySelector('#hash'),
  presetCount: document.querySelector('#preset-count'),
  grid: document.querySelector('#grid-size'),
};

nodes.presetCount.textContent = String(CONTRACT.identityPresets);
nodes.instrumentBytes.textContent = formatBytes(instrumentBytes);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0e1217');
scene.fog = new THREE.Fog('#0e1217', 12, 32);
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
camera.position.set(2.8, 1.6, 4.8);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.25;
controls.maxDistance = 60;
controls.target.set(0, 0.55, 0);

scene.add(new THREE.HemisphereLight('#e1efff', '#30281f', 1.65));
const key = new THREE.DirectionalLight('#fff0d2', 4.1);
key.position.set(4.2, 7.2, 5.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -5;
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 30;
scene.add(key);
const fill = new THREE.DirectionalLight('#9fc5ff', 1.1);
fill.position.set(-4.5, 3.5, 3.0);
scene.add(fill);
const rim = new THREE.DirectionalLight('#b9d7ff', 1.45);
rim.position.set(-2.5, 4.2, -5.0);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: '#232a31', roughness: 0.98, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.012;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(16, 32, '#65717c', '#333b44');
grid.position.y = -0.008;
for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) {
  material.transparent = true;
  material.opacity = 0.30;
}
scene.add(grid);

let activeResult = null;
let activeKey = null;
let lastBounds = null;
let frameCount = 0;
let skeletonHelper = null;
let skeletonVisible = false;

function setStatus(message, error = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle('error', error);
}

function formatInteger(value) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatBytes(value) {
  if (value < 1024) return `${formatInteger(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function updatePresetButtons() {
  for (const button of presetButtons) button.setAttribute('aria-pressed', String(button.dataset.scoreKey === activeKey));
}

function updateMetrics(metrics, hash) {
  nodes.scoreBytes.textContent = formatBytes(metrics.scoreBytes);
  nodes.meshes.textContent = formatInteger(metrics.meshes);
  nodes.triangles.textContent = formatInteger(metrics.triangles);
  nodes.geometryBytes.textContent = formatBytes(metrics.geometryBytes);
  nodes.hash.textContent = hash;
  nodes.grid.textContent = metrics.grid ? `${metrics.grid.nx}×${metrics.grid.ny}×${metrics.grid.nz}` : '—';
}

function computeBounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error('生成结果没有有效包围盒');
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error('生成结果尺寸无效');
  return { box, sphere };
}

function fitCamera(bounds = lastBounds, direction = new THREE.Vector3(1.1, 0.55, 1.55)) {
  if (!bounds) return;
  const radius = Math.max(bounds.sphere.radius, 0.18);
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = radius / Math.tan(halfFov) * 1.32;
  camera.position.copy(bounds.sphere.center).addScaledVector(direction.normalize(), distance);
  camera.near = Math.max(distance / 500, 0.003);
  camera.far = Math.max(distance * 80, 80);
  camera.updateProjectionMatrix();
  controls.target.copy(bounds.sphere.center);
  controls.minDistance = Math.max(radius * 0.2, 0.08);
  controls.maxDistance = Math.max(radius * 18, 18);
  controls.update();
}

function setView(name) {
  if (!lastBounds) return;
  const directions = {
    quarter: new THREE.Vector3(1.1, 0.55, 1.55),
    front: new THREE.Vector3(0, 0.16, 1),
    left: new THREE.Vector3(-1, 0.12, 0),
    right: new THREE.Vector3(1, 0.12, 0),
    top: new THREE.Vector3(0.02, 1, 0.02),
  };
  fitCamera(lastBounds, directions[name] ?? directions.quarter);
}

function disposeHelper() {
  if (!skeletonHelper) return;
  skeletonHelper.removeFromParent();
  skeletonHelper.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material?.dispose?.();
  });
  skeletonHelper = null;
}

function buildSkeletonHelper(result) {
  const helper = new THREE.Group();
  helper.name = 'ANATOMY_AUDIT_HELPER';
  const material = new THREE.LineBasicMaterial({ color: '#efc66f', transparent: true, opacity: 0.94 });
  const pointMaterial = new THREE.MeshBasicMaterial({ color: '#ffe2a2' });
  const vertices = [];
  const addSegment = (a, b) => vertices.push(...a, ...b);
  const a = result.anchors;
  addSegment(a.pelvis, a.lumbar);
  addSegment(a.lumbar, a.thorax);
  addSegment(a.thorax, a.neckBase);
  addSegment(a.neckBase, a.neckTip);
  addSegment(a.neckTip, a.head);
  addSegment(a.head, a.muzzle);
  for (const side of [-1, 1]) {
    addSegment(a[`shoulder${side}`], a[`elbow${side}`]);
    addSegment(a[`elbow${side}`], a[`wrist${side}`]);
    addSegment(a[`wrist${side}`], a[`forePaw${side}`]);
    addSegment(a[`hip${side}`], a[`stifle${side}`]);
    addSegment(a[`stifle${side}`], a[`hock${side}`]);
    addSegment(a[`hock${side}`], a[`hindPaw${side}`]);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  helper.add(new THREE.LineSegments(lineGeometry, material));
  for (const [key, point] of Object.entries(a)) {
    if (!Array.isArray(point) || point.length !== 3 || key.includes('Correction')) continue;
    const marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.0035, result.spec.global.bodyLength * 0.007), 10, 8), pointMaterial);
    marker.position.fromArray(point);
    helper.add(marker);
  }
  helper.visible = skeletonVisible;
  return helper;
}

function play(score = scoreInput.value, { resetCamera = true, key = null } = {}) {
  let next = null;
  try {
    const parsed = parseScore(score);
    next = buildScore(parsed.text);
    const bounds = computeBounds(next.root);
    const metrics = measure(next.root, next.score);
    const hash = fingerprint(next.root);
    if (activeResult) {
      scene.remove(activeResult.root);
      dispose(activeResult.root);
    }
    disposeHelper();
    activeResult = next;
    next = null;
    scene.add(activeResult.root);
    skeletonHelper = buildSkeletonHelper(activeResult);
    scene.add(skeletonHelper);
    lastBounds = bounds;
    activeKey = key;
    scoreInput.value = activeResult.score;
    updatePresetButtons();
    updateMetrics(metrics, hash);
    const entry = key ? SCORE_LIBRARY[key] : null;
    sourceNode.textContent = entry?.source ?? '手工输入的新谱；没有修改乐器。';
    setStatus(`演奏完成：谱子携带形体与表面差异，K5 公共声部计算出 ${formatInteger(metrics.triangles)} 个三角面。`);
    if (resetCamera) fitCamera(bounds);
  } catch (error) {
    if (next) dispose(next.root);
    setStatus(`谱子未执行：${error instanceof Error ? error.message : String(error)}`, true);
  }
}

function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

for (const button of presetButtons) {
  button.addEventListener('click', () => {
    const keyName = button.dataset.scoreKey;
    const entry = SCORE_LIBRARY[keyName];
    if (entry) play(entry.score, { key: keyName });
  });
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => setView(button.dataset.view));

document.querySelector('#play').addEventListener('click', () => play(scoreInput.value, { key: null }));
document.querySelector('#verify').addEventListener('click', () => {
  if (!activeResult) return setStatus('当前没有可校验结果。', true);
  const passed = verifyReplay(activeResult);
  setStatus(passed ? '独立重演校验通过：同一谱子经同一版本乐器得到逐字节一致结果。' : '独立重演校验失败。', !passed);
});
document.querySelector('#camera').addEventListener('click', () => fitCamera());
document.querySelector('#skeleton').addEventListener('click', (event) => {
  skeletonVisible = !skeletonVisible;
  if (skeletonHelper) skeletonHelper.visible = skeletonVisible;
  event.currentTarget.setAttribute('aria-pressed', String(skeletonVisible));
  setStatus(skeletonVisible ? '已显示由谱子计算出的骨性锚点和固定长度肢体链。' : '已隐藏解剖锚点。');
});
document.querySelector('#download-score').addEventListener('click', () => {
  const score = scoreInput.value.trim();
  parseScore(score);
  downloadText('KAOPU_MAMMAL_K5.score', `${score}\n`);
});
document.querySelector('#download-instrument').addEventListener('click', () => {
  const bytes = decodeBase64(instrumentPayload);
  const blob = new Blob([bytes], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'KAOPU_MAMMAL_K5.js';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
scoreInput.addEventListener('input', () => {
  activeKey = null;
  updatePresetButtons();
  nodes.scoreBytes.textContent = formatBytes(new TextEncoder().encode(scoreInput.value.trim()).length);
  sourceNode.textContent = '编辑中的谱子；尚未重新演奏。';
  setStatus('谱子已修改；当前三维结果尚未改变。');
});
scoreInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    play(scoreInput.value, { key: null });
  }
});

const resizeObserver = new ResizeObserver(() => {
  const width = Math.max(viewport.clientWidth, 1);
  const height = Math.max(viewport.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
resizeObserver.observe(viewport);
renderer.setAnimationLoop(() => {
  frameCount += 1;
  controls.update();
  renderer.render(scene, camera);
});

window.__KAOPU_MAMMAL_R06__ = {
  version: VERSION,
  contract: CONTRACT,
  scores: SCORE_LIBRARY,
  play: (score) => play(score, { key: null }),
  setView,
  state: () => ({
    frames: frameCount,
    active: Boolean(activeResult),
    key: activeKey,
    score: activeResult?.score ?? null,
    metrics: activeResult ? measure(activeResult.root, activeResult.score) : null,
    hash: activeResult ? fingerprint(activeResult.root) : null,
    camera: camera.position.toArray(),
    skeletonVisible,
  }),
};

play(SCORE_LIBRARY.neutralDog.score, { key: 'neutralDog' });
