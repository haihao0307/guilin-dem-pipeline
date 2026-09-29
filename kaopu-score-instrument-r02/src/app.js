import { SCORES, DEFAULT_SCORE_KEY, FULL_SCORE } from './scores.js';

const Instrument = window.KAOPUInstrument;
if (!Instrument) throw new Error('KAOPU instrument payload was not initialized');
const { THREE, VERSION, buildScore, dispose, measure, snapshot, equalSnapshots, byteLength } = Instrument;
const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const input = $('score');
const presetButtons = [...document.querySelectorAll('[data-score-key]')];
const instrumentFileBytes = Number(document.querySelector('meta[name="kaopu-instrument-file-bytes"]').content);
const instrumentCoreBytes = Number(document.querySelector('meta[name="kaopu-instrument-core-bytes"]').content);
const workbenchBytes = Number(document.querySelector('meta[name="kaopu-workbench-bytes"]').content);
const instrumentPayload = window.__KAOPU_INSTRUMENT_BYTES__;
const formatBytes = (value) => value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1024 / 1024).toFixed(2)} MiB`;
const integer = (value) => Number(value).toLocaleString('zh-CN');

class OrbitRig {
  constructor(camera, element) {
    this.camera = camera;
    this.element = element;
    this.target = new THREE.Vector3();
    this.spherical = new THREE.Spherical(8, 1.1, 0.7);
    this.minRadius = 0.2;
    this.maxRadius = 100;
    this.pointers = new Map();
    this.lastPinch = 0;
    this.element.addEventListener('pointerdown', (event) => this.down(event));
    this.element.addEventListener('pointermove', (event) => this.move(event));
    this.element.addEventListener('pointerup', (event) => this.up(event));
    this.element.addEventListener('pointercancel', (event) => this.up(event));
    this.element.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * Math.exp(event.deltaY * 0.001), this.minRadius, this.maxRadius);
      this.update();
    }, { passive: false });
  }
  down(event) {
    event.preventDefault();
    this.element.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.lastPinch = this.pinchDistance();
  }
  move(event) {
    if (!this.pointers.has(event.pointerId)) return;
    event.preventDefault();
    const previous = this.pointers.get(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.spherical.theta -= (event.clientX - previous.x) * 0.006;
      this.spherical.phi -= (event.clientY - previous.y) * 0.006;
      this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, 0.08, Math.PI - 0.08);
    } else if (this.pointers.size >= 2) {
      const distance = this.pinchDistance();
      if (distance > 0 && this.lastPinch > 0) {
        this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * this.lastPinch / distance, this.minRadius, this.maxRadius);
      }
      this.lastPinch = distance;
    }
    this.update();
  }
  up(event) {
    this.pointers.delete(event.pointerId);
    this.lastPinch = this.pinchDistance();
  }
  pinchDistance() {
    if (this.pointers.size < 2) return 0;
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  setView(target, position, minRadius, maxRadius) {
    this.target.copy(target);
    this.spherical.setFromVector3(position.clone().sub(target));
    this.minRadius = minRadius;
    this.maxRadius = maxRadius;
    this.update();
  }
  update() {
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d1117');
scene.fog = new THREE.Fog('#0d1117', 20, 70);
const camera = new THREE.PerspectiveCamera(43, 1, 0.01, 500);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('status').textContent = `无法启动三维渲染：${error.message}`;
  $('status').classList.add('error');
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);
const orbit = new OrbitRig(camera, renderer.domElement);

scene.add(new THREE.HemisphereLight('#dbe9ff', '#2b2118', 1.6));
const key = new THREE.DirectionalLight('#fff0cf', 4.5);
key.position.set(7, 11, 8);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.1, far: 45 });
scene.add(key);
const rim = new THREE.DirectionalLight('#81aee0', 1.65);
rim.position.set(-8, 5, -10);
scene.add(rim);
const fill = new THREE.PointLight('#d7b46a', 18, 18, 2);
fill.position.set(0, 4.5, 0);
scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ color: '#000000', opacity: 0.34 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.003;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(30, 30, '#586575', '#28313b');
grid.position.y = 0.001;
grid.material.transparent = true;
grid.material.opacity = 0.42;
scene.add(grid);

let current = null;
let currentMetrics = null;
let currentKey = DEFAULT_SCORE_KEY;
let lastError = null;
let draft = false;
let frames = 0;
const setStatus = (text, error = false) => {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
};

function fitCamera() {
  if (!current) return;
  const sphere = new THREE.Box3().setFromObject(current.root).getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.1);
  const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.22;
  const direction = new THREE.Vector3(1.28, 0.82, 1.42).normalize();
  const position = sphere.center.clone().addScaledVector(direction, distance);
  camera.near = Math.max(distance / 2500, 0.002);
  camera.far = Math.max(distance * 60, 100);
  camera.updateProjectionMatrix();
  scene.fog.near = Math.max(distance * 1.8, 18);
  scene.fog.far = Math.max(distance * 5.5, 65);
  orbit.setView(sphere.center, position, radius * 0.16, Math.max(distance * 9, 30));
}

function updatePresetText(key) {
  const entry = SCORES[key];
  $('score-name').textContent = entry?.name ?? '自定义谱子';
  $('score-note').textContent = entry?.note ?? '当前谱子由用户编辑。';
  presetButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.scoreKey === key)));
}

function updateMetrics() {
  const metrics = currentMetrics;
  $('score-bytes').textContent = formatBytes(metrics.bytes);
  $('instrument-core').textContent = formatBytes(instrumentCoreBytes);
  $('instrument-file').textContent = formatBytes(instrumentFileBytes);
  $('workbench-bytes').textContent = formatBytes(workbenchBytes);
  $('objects').textContent = integer(metrics.objects);
  $('triangles').textContent = integer(metrics.triangles);
  $('geometry-bytes').textContent = formatBytes(metrics.geometryBytes);
  $('hash').textContent = metrics.hash;
  $('draft').textContent = `已演奏 ${formatBytes(metrics.bytes)} · ${integer(metrics.groups)} 个变换组 · ${integer(metrics.vertices)} 个顶点`;
  updatePresetText(currentKey);
}

function play(text = input.value, key = null) {
  let candidate = null;
  try {
    candidate = buildScore(text);
    const box = new THREE.Box3().setFromObject(candidate.root);
    if (![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) throw new Error('生成结果超出数值范围');
    const metrics = measure(candidate.root, candidate.score);
    if (current) {
      scene.remove(current.root);
      dispose(current.root);
    }
    current = candidate;
    currentMetrics = metrics;
    currentKey = key && SCORES[key]?.score === candidate.score ? key : 'custom';
    scene.add(current.root);
    draft = false;
    lastError = null;
    $('verify').disabled = false;
    updateMetrics();
    fitCamera();
    setStatus(`演奏完成：${formatBytes(metrics.bytes)} 的谱子展开为 ${integer(metrics.objects)} 个简单几何体。`);
    return true;
  } catch (error) {
    if (candidate && candidate !== current) dispose(candidate.root);
    lastError = error.message;
    setStatus(`谱子未执行：${error.message}。已保留上次有效空间。`, true);
    return false;
  }
}

function verify() {
  if (!current || draft) {
    setStatus('先演奏当前草稿，再校验结果。', true);
    return false;
  }
  const before = snapshot(current.root);
  let rebuilt;
  try {
    rebuilt = buildScore(current.score);
    const passed = equalSnapshots(before, snapshot(rebuilt.root));
    setStatus(passed
      ? '重演校验通过：两次独立生成的顶点、法线、UV、索引、世界变换和材质完全一致。'
      : '重演校验失败：实际三维输出不一致。', !passed);
    return passed;
  } finally {
    if (rebuilt) dispose(rebuilt.root);
  }
}

function downloadBytes(filename, bytes, type) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

$('play').onclick = () => play();
$('camera').onclick = fitCamera;
$('verify').onclick = verify;
$('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(input.value.trim());
    setStatus('谱子已复制。它不包含顶点、模型或贴图。');
  } catch {
    input.focus();
    input.select();
    setStatus('谱子已选中，可以直接复制。');
  }
};
$('download-instrument').onclick = () => {
  downloadBytes('KAOPU_INSTRUMENT_K2.js', instrumentPayload, 'text/javascript;charset=utf-8');
  setStatus(`纯乐器已导出：${formatBytes(instrumentPayload.byteLength)}，不含界面、相机、示例谱和当前空间组合。`);
};
$('download-score').onclick = () => {
  const data = new TextEncoder().encode(input.value.trim() + '\n');
  downloadBytes('KAOPU_SPATIAL_SCORE_K2.txt', data, 'text/plain;charset=utf-8');
  setStatus(`当前谱子已导出：${formatBytes(byteLength(input.value.trim()))}。`);
};

for (const button of presetButtons) {
  button.onclick = () => {
    const key = button.dataset.scoreKey;
    input.value = SCORES[key].score;
    play(input.value, key);
  };
}

input.addEventListener('input', () => {
  draft = !current || input.value.trim() !== current.score;
  $('verify').disabled = draft;
  $('draft').textContent = `草稿 ${formatBytes(byteLength(input.value.trim()))}；账本仍对应上一次已演奏结果。`;
  updatePresetText('custom');
  setStatus('谱子已修改。按“演奏谱子”后，三维空间才会改变。');
});
input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    play();
  }
});

function resize() {
  const width = Math.max(viewport.clientWidth, 1);
  const height = Math.max(viewport.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  orbit.update();
}
new ResizeObserver(resize).observe(viewport);
resize();
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  frames += 1;
});

window.__KAOPU_R02__ = {
  version: VERSION,
  fullScore: FULL_SCORE,
  playScore: (text) => {
    input.value = text;
    return play(text);
  },
  verify,
  metrics: () => ({ ...currentMetrics }),
  state: () => ({
    error: lastError,
    draft,
    frames,
    calls: renderer.info.render.calls,
    renderedTriangles: renderer.info.render.triangles,
    camera: camera.position.toArray(),
    instrumentBytes: instrumentPayload.byteLength
  }),
  bounds: () => {
    const box = new THREE.Box3().setFromObject(current.root);
    return { min: box.min.toArray(), max: box.max.toArray() };
  },
  instrumentBytes: () => new Uint8Array(instrumentPayload)
};

input.value = SCORES[DEFAULT_SCORE_KEY].score;
play(input.value, DEFAULT_SCORE_KEY);
