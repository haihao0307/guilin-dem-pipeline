const viewport = document.querySelector('#viewport');
const scoreInput = document.querySelector('#score');
const statusNode = document.querySelector('#status');
const emptyNote = document.querySelector('#empty-note');
const payload = document.querySelector('#kaopu-instrument-payload')?.textContent?.trim() || '';

function decode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function loadEmbeddedInstrument(base64) {
  if (!base64) throw new Error('缺少内嵌纯乐器数据');
  const source = new TextDecoder().decode(decode(base64));
  new Function(`${source}\n;globalThis.KAOPUMammal = KAOPUMammal;`)();
  if (!globalThis.KAOPUMammal) throw new Error('纯乐器加载失败');
  return globalThis.KAOPUMammal;
}
const { THREE, CONTRACT, VERSION, buildScore, dispose, measure, fingerprint } = loadEmbeddedInstrument(payload);

function createOrbitController(camera, domElement) {
  const target = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  const controller = {
    target,
    minDistance: 0.25,
    maxDistance: 60,
    sync() {
      offset.copy(camera.position).sub(target);
      spherical.setFromVector3(offset);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius || 1, controller.minDistance, controller.maxDistance);
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.03, Math.PI - 0.03);
      camera.lookAt(target);
    },
    update() {
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, controller.minDistance, controller.maxDistance);
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.03, Math.PI - 0.03);
      camera.position.copy(offset.setFromSpherical(spherical)).add(target);
      camera.lookAt(target);
    },
  };
  domElement.addEventListener('pointerdown', (event) => {
    dragging = true; previousX = event.clientX; previousY = event.clientY;
    domElement.setPointerCapture?.(event.pointerId); controller.sync();
  });
  domElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    spherical.theta -= ((event.clientX - previousX) / Math.max(domElement.clientWidth, 1)) * Math.PI * 1.8;
    spherical.phi -= ((event.clientY - previousY) / Math.max(domElement.clientHeight, 1)) * Math.PI * 1.35;
    previousX = event.clientX; previousY = event.clientY; controller.update();
  });
  const stop = (event) => { dragging = false; domElement.releasePointerCapture?.(event.pointerId); };
  domElement.addEventListener('pointerup', stop); domElement.addEventListener('pointercancel', stop);
  domElement.addEventListener('wheel', (event) => {
    event.preventDefault(); controller.sync(); spherical.radius *= Math.exp(event.deltaY * 0.0012); controller.update();
  }, { passive: false });
  controller.sync();
  return controller;
}

const nodes = {
  scoreBytes: document.querySelector('#score-bytes'),
  meshes: document.querySelector('#meshes'),
  triangles: document.querySelector('#triangles'),
  hash: document.querySelector('#hash'),
};
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0e1217');
scene.fog = new THREE.Fog('#0e1217', 12, 32);
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
camera.position.set(2.8, 1.6, 4.8);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);
const controls = createOrbitController(camera, renderer.domElement);
controls.target.set(0, 0.55, 0); controls.sync();
scene.add(new THREE.HemisphereLight('#e1efff', '#30281f', 1.65));
const key = new THREE.DirectionalLight('#fff0d2', 4.1); key.position.set(4.2, 7.2, 5.4); key.castShadow = true; scene.add(key);
const rim = new THREE.DirectionalLight('#b9d7ff', 1.35); rim.position.set(-3.5, 3.5, -5); scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#232a31', roughness: 0.98 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.012; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(16, 32, '#65717c', '#333b44'); grid.position.y = -0.008; scene.add(grid);
let active = null;
let lastBounds = null;
let frames = 0;
function status(text, error = false) { statusNode.textContent = text; statusNode.classList.toggle('error', error); }
function fit(direction = new THREE.Vector3(1.1, 0.55, 1.55)) {
  if (!lastBounds) return;
  const radius = Math.max(lastBounds.sphere.radius, 0.18);
  const distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * 1.32;
  camera.position.copy(lastBounds.sphere.center).addScaledVector(direction.normalize(), distance);
  controls.target.copy(lastBounds.sphere.center);
  controls.minDistance = Math.max(radius * 0.2, 0.08);
  controls.maxDistance = Math.max(radius * 18, 18);
  camera.near = Math.max(distance / 500, 0.003); camera.far = Math.max(distance * 80, 80); camera.updateProjectionMatrix(); controls.sync();
}
function updateDraft() { nodes.scoreBytes.textContent = String(new TextEncoder().encode(scoreInput.value.trim()).length); }
function play() {
  let next = null;
  try {
    next = buildScore(scoreInput.value);
    const box = new THREE.Box3().setFromObject(next.root); const sphere = box.getBoundingSphere(new THREE.Sphere());
    const metrics = measure(next.root, next.score); const hash = fingerprint(next.root);
    if (active) { scene.remove(active.root); dispose(active.root); }
    active = next; next = null; scene.add(active.root); lastBounds = { box, sphere };
    nodes.scoreBytes.textContent = String(metrics.scoreBytes); nodes.meshes.textContent = String(metrics.meshes);
    nodes.triangles.textContent = new Intl.NumberFormat('zh-CN').format(metrics.triangles); nodes.hash.textContent = hash;
    emptyNote.hidden = true; status('演奏完成：具体对象来自导入谱，播放器和乐器没有内置身份。'); fit();
  } catch (error) {
    if (next) dispose(next.root);
    status(`谱子未执行：${error instanceof Error ? error.message : String(error)}`, true);
  }
}
document.querySelector('#play').addEventListener('click', play);
document.querySelector('#camera').addEventListener('click', () => fit());
for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => {
    const directions = { quarter: new THREE.Vector3(1.1, 0.55, 1.55), front: new THREE.Vector3(0, 0.15, 1), left: new THREE.Vector3(-1, 0.12, 0), right: new THREE.Vector3(1, 0.12, 0), top: new THREE.Vector3(0.02, 1, 0.02) };
    fit(directions[button.dataset.view] ?? directions.quarter);
  });
}
scoreInput.addEventListener('input', updateDraft);
document.querySelector('#file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  scoreInput.value = (await file.text()).trim(); updateDraft(); status(`已导入 ${file.name}，尚未演奏。`);
});
document.querySelector('#download-instrument').addEventListener('click', () => {
  const blob = new Blob([decode(payload)], { type: 'text/javascript' }); const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'KAOPU_MAMMAL_K5.js'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const resize = new ResizeObserver(() => {
  const width = Math.max(viewport.clientWidth, 1); const height = Math.max(viewport.clientHeight, 1);
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
});
resize.observe(viewport);
renderer.setAnimationLoop(() => { frames += 1; renderer.render(scene, camera); });
window.__KAOPU_EMPTY_K5__ = {
  version: VERSION,
  contract: CONTRACT,
  state: () => ({ frames, active: Boolean(active), score: active?.score ?? null, metrics: active ? measure(active.root, active.score) : null, hash: active ? fingerprint(active.root) : null }),
};
