import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VERSION, buildScore, dispose, measure, snapshot, equalSnapshots, byteLength } from './instrument.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const input = $('score');
const buttons = [...document.querySelectorAll('[data-score]')];
const bytes = (n) => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KiB`;
const integer = (n) => n.toLocaleString('zh-CN');
const instrumentBytes = Number(document.querySelector('meta[name="kaopu-instrument-bytes"]').content);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#101419');
scene.fog = new THREE.Fog('#101419', 15, 38);
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 500);
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('status').textContent = `无法启动三维渲染：${e.message}`; $('status').classList.add('error'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight('#dceaff', '#2b251e', 1.48));
const key = new THREE.DirectionalLight('#fff0d2', 4.25);
key.position.set(4.5, 7.5, 5.2);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 32 });
scene.add(key);
const rim = new THREE.DirectionalLight('#90baff', 1.42);
rim.position.set(-4.5, 3.2, -5.5);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.32 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.002;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(20, 20, '#697481', '#303741');
grid.position.y = 0.001;
grid.material.transparent = true;
grid.material.opacity = 0.5;
scene.add(grid);

let current = null;
let currentMetrics = null;
let lastError = null;
let draft = false;
let frames = 0;
const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
function fit() {
  if (!current) return;
  const sphere = new THREE.Box3().setFromObject(current.root).getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.1);
  const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.15;
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(1.25, 0.86, 1.45).normalize(), distance);
  camera.near = Math.max(distance / 2000, 0.001);
  camera.far = Math.max(distance * 80, 80);
  controls.minDistance = radius * 0.15;
  controls.maxDistance = Math.max(distance * 8, 20);
  scene.fog.near = Math.max(distance * 2, 15);
  scene.fog.far = Math.max(distance * 6, 38);
  camera.updateProjectionMatrix();
  controls.update();
}
function updateMetrics() {
  const m = currentMetrics;
  $('bytes').textContent = bytes(m.bytes);
  $('instrument').textContent = bytes(instrumentBytes);
  $('objects').textContent = integer(m.objects);
  $('vertices').textContent = integer(m.vertices);
  $('triangles').textContent = integer(m.triangles);
  $('ratio').textContent = `${(m.triangles / m.bytes).toFixed(1)} 面/B`;
  $('hash').textContent = m.hash;
  $('network').textContent = '0';
  $('draft').textContent = `已演奏 ${bytes(m.bytes)} · 几何缓冲区 ${bytes(m.geometryBytes)}`;
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.score === current.score)));
}
function play(text = input.value) {
  let candidate = null;
  try {
    candidate = buildScore(text);
    const box = new THREE.Box3().setFromObject(candidate.root);
    if (![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) throw new Error('生成结果超出数值范围');
    const metrics = measure(candidate.root, candidate.score);
    if (current) { scene.remove(current.root); dispose(current.root); }
    current = candidate;
    currentMetrics = metrics;
    scene.add(current.root);
    draft = false;
    lastError = null;
    $('verify').disabled = false;
    updateMetrics();
    fit();
    status(`演奏完成：${bytes(metrics.bytes)} 谱子 → ${metrics.objects} 个对象。`);
    return true;
  } catch (e) {
    if (candidate && candidate !== current) dispose(candidate.root);
    lastError = e.message;
    status(`谱子未执行：${e.message}。保留上次有效结果。`, true);
    return false;
  }
}
function verify() {
  if (!current || draft) { status('先演奏当前草稿，再校验结果。', true); return false; }
  const before = snapshot(current.root);
  let rebuilt;
  try {
    rebuilt = buildScore(current.score);
    const passed = equalSnapshots(before, snapshot(rebuilt.root));
    status(passed ? '重演校验通过：顶点、法线、UV、索引、世界变换和材质逐项一致。' : '重演校验失败：实际输出不一致。', !passed);
    return passed;
  } finally { if (rebuilt) dispose(rebuilt.root); }
}
$('play').onclick = () => play();
$('camera').onclick = fit;
$('verify').onclick = verify;
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(input.value.trim()); status('谱子已复制。只需这串文本和同版本乐器即可复述。'); }
  catch { input.focus(); input.select(); status('谱子已选中，可以直接复制。'); }
};
for (const b of buttons) b.onclick = () => { input.value = b.dataset.score; play(); };
input.addEventListener('input', () => {
  draft = !current || input.value.trim() !== current.score;
  $('verify').disabled = draft;
  $('draft').textContent = `草稿 ${bytes(byteLength(input.value.trim()))}；下方账本仍对应已演奏结果。`;
  status('谱子已修改。按“演奏谱子”应用；三维结果尚未改变。');
});
input.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); play(); } });
function resize() {
  renderer.setSize(Math.max(viewport.clientWidth, 1), Math.max(viewport.clientHeight, 1), false);
  camera.aspect = Math.max(viewport.clientWidth, 1) / Math.max(viewport.clientHeight, 1);
  camera.updateProjectionMatrix();
  fit();
}
new ResizeObserver(resize).observe(viewport);
resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); frames++; });
window.__KAOPU_R01__ = {
  version: VERSION,
  playScore: (text) => { input.value = text; return play(text); },
  verify,
  metrics: () => ({ ...currentMetrics }),
  state: () => ({ error: lastError, draft, frames, camera: camera.position.toArray(), calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries }),
  bounds: () => { const b = new THREE.Box3().setFromObject(current.root); return { min: b.min.toArray(), max: b.max.toArray() }; }
};
play();
