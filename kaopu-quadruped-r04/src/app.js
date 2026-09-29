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
};

nodes.presetCount.textContent = String(CONTRACT.identityPresets);
nodes.instrumentBytes.textContent = formatBytes(instrumentBytes);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#101419');
scene.fog = new THREE.Fog('#101419', 10, 28);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
camera.position.set(3.6, 2.1, 5.4);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 0.35;
controls.maxDistance = 50;
controls.target.set(0, 0.7, 0);

scene.add(new THREE.HemisphereLight('#dcecff', '#312a21', 1.55));
const key = new THREE.DirectionalLight('#fff0d0', 4.3);
key.position.set(4.5, 7.5, 5.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -5;
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 30;
scene.add(key);
const rim = new THREE.DirectionalLight('#8fb9ff', 1.35);
rim.position.set(-4.5, 3.2, -5.5);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: '#20262d', roughness: 0.98, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.025;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(16, 32, '#58636e', '#303740');
grid.position.y = -0.02;
for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) {
  material.transparent = true;
  material.opacity = 0.38;
}
scene.add(grid);

let activeResult = null;
let activeKey = null;
let lastBounds = null;
let frameCount = 0;

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
}

function computeBounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error('生成结果没有有效包围盒');
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error('生成结果尺寸无效');
  return { box, sphere };
}

function fitCamera(bounds = lastBounds) {
  if (!bounds) return;
  const radius = Math.max(bounds.sphere.radius, 0.25);
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = radius / Math.tan(halfFov) * 1.32;
  const direction = new THREE.Vector3(1.05, 0.58, 1.5).normalize();
  camera.position.copy(bounds.sphere.center).addScaledVector(direction, distance);
  camera.near = Math.max(distance / 500, 0.005);
  camera.far = Math.max(distance * 80, 80);
  camera.updateProjectionMatrix();
  controls.target.copy(bounds.sphere.center);
  controls.minDistance = Math.max(radius * 0.2, 0.15);
  controls.maxDistance = Math.max(radius * 18, 20);
  controls.update();
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
    activeResult = next;
    next = null;
    scene.add(activeResult.root);
    lastBounds = bounds;
    activeKey = key;
    scoreInput.value = activeResult.score;
    updatePresetButtons();
    updateMetrics(metrics, hash);
    setStatus(`演奏完成：${formatBytes(metrics.scoreBytes)} 的谱子，经通用四足框架计算为 ${formatInteger(metrics.triangles)} 个三角面。`);
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
    if (!entry) return;
    play(entry.score, { key: keyName });
  });
}

document.querySelector('#play').addEventListener('click', () => play(scoreInput.value, { key: null }));
document.querySelector('#verify').addEventListener('click', () => {
  if (!activeResult) return setStatus('当前没有可校验结果。', true);
  const passed = verifyReplay(activeResult);
  setStatus(passed ? '独立重演校验通过：同一谱子经同一版本乐器得到逐字节一致的三维结果。' : '独立重演校验失败。', !passed);
});
document.querySelector('#camera').addEventListener('click', () => fitCamera());
document.querySelector('#download-score').addEventListener('click', () => {
  const score = scoreInput.value.trim();
  parseScore(score);
  downloadText('KAOPU_QUADRUPED_K4.score', `${score}\n`);
});
document.querySelector('#download-instrument').addEventListener('click', () => {
  const bytes = decodeBase64(instrumentPayload);
  const blob = new Blob([bytes], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'KAOPU_QUADRUPED_K4.js';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
scoreInput.addEventListener('input', () => {
  activeKey = null;
  updatePresetButtons();
  nodes.scoreBytes.textContent = formatBytes(new TextEncoder().encode(scoreInput.value.trim()).length);
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

window.__KAOPU_QUADRUPED_R04__ = {
  version: VERSION,
  contract: CONTRACT,
  scores: SCORE_LIBRARY,
  play: (score) => play(score, { key: null }),
  state: () => ({
    frames: frameCount,
    active: Boolean(activeResult),
    score: activeResult?.score ?? null,
    metrics: activeResult ? measure(activeResult.root, activeResult.score) : null,
    hash: activeResult ? fingerprint(activeResult.root) : null,
    camera: camera.position.toArray(),
  }),
};

play(SCORE_LIBRARY.polarBear.score, { key: 'polarBear' });
