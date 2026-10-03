import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rot2 = (x, y, a) => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];

const CFG = {
  C: {
    id: 'C', name: 'tree()', root: [-0.05, -1.0], len0: 0.35,
    ang: THREE.MathUtils.degToRad(40), br: 3, depth: 7, wid: 0.001,
    leafDepth: 5, leafRadiusMul: 0.915, leafOffsetMul: 3,
  },
  L: {
    id: 'L', name: 'treeL()', root: [-1.2, -1.0], len0: 0.42,
    ang: THREE.MathUtils.degToRad(20), br: 3, depth: 6, wid: 0.0021,
    leafDepth: 5, leafRadiusMul: 0.4, leafOffsetMul: 3,
  },
  R: {
    id: 'R', name: 'treeR()', root: [1.1, -1.0], len0: 0.45,
    ang: THREE.MathUtils.degToRad(25.7), br: 4, depth: 5, wid: 0.001,
    leafDepth: 5, leafRadiusMul: 0.4, leafOffsetMul: 2,
  },
};

const P = { tree: 'ALL', depth: 0.34, time: 0, radius: 0.004 };
let playing = false;
let activeCamera = 'front';
let lastFrame = performance.now();
let lastBuild = 0;

const stage = $('stage');
const errorEl = $('error');
const infoEl = $('info');
const statusEl = $('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07100f);
scene.fog = new THREE.FogExp2(0x07100f, 0.075);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb8d4cb, 0x22161c, 1.7));
const key = new THREE.DirectionalLight(0xd8fff5, 2.2);
key.position.set(3.5, 5.5, 4.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff8abd, 1.1);
rim.position.set(-4, 1.5, -3);
scene.add(rim);

const perspective = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
perspective.position.set(3.6, 1.3, 5.6);
const front = new THREE.OrthographicCamera(-2, 2, 1.2, -1.2, 0.01, 20);
front.position.set(0, 0, 6);
front.lookAt(0, 0, 0);

const controls = new OrbitControls(perspective, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, -0.12, 0);
controls.minDistance = 2.2;
controls.maxDistance = 14;
controls.enabled = false;

const planeMat = new THREE.MeshBasicMaterial({
  color: 0x17312d, transparent: true, opacity: 0.18,
  side: THREE.DoubleSide, depthWrite: false
});
const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.56, 2.0), planeMat);
plane.position.z = -0.015;
scene.add(plane);
const border = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.56, 2.0)),
  new THREE.LineBasicMaterial({ color: 0x45605a, transparent: true, opacity: 0.55 })
);
border.position.z = -0.01;
scene.add(border);

const branchGeometry = new THREE.CylinderGeometry(1, 1, 1, 7, 1, false);
const leafGeometry = new THREE.SphereGeometry(1, 9, 6);
const branchMaterial = new THREE.MeshStandardMaterial({
  color: 0x33e6cc, roughness: 0.46, metalness: 0.02,
});
const leafMaterial = new THREE.MeshStandardMaterial({
  color: 0xcc2a78, emissive: 0x250713, emissiveIntensity: 0.55,
  roughness: 0.42, metalness: 0,
});

const MAX_SEGMENTS = 6000;
const MAX_LEAVES = 1700;
const branches = new THREE.InstancedMesh(branchGeometry, branchMaterial, MAX_SEGMENTS);
const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, MAX_LEAVES);
branches.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(branches, leaves);

const tmp = new THREE.Object3D();
const yAxis = new THREE.Vector3(0, 1, 0);
const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const dir = new THREE.Vector3();

function windAngles(time) {
  const speed = time * 0.3;
  return {
    w0: 0.2 * Math.sin(speed + 6.2),
    w1: 0.2 * Math.sin(speed + 1.0),
  };
}

function teacherRule(cfg, path, l, time) {
  const { w0, w1 } = windAngles(time);
  if (cfg.id === 'C') {
    if (path === 0) return { offset: 1 * l, queryRot: -cfg.ang };
    if (path === 1) return { offset: 2 * l, queryRot: w0 + cfg.ang };
    return { offset: 4 * l, queryRot: w1 };
  }
  if (cfg.id === 'L') {
    if (path === 0) return { offset: 2 * l, queryRot: w0 + cfg.ang };
    if (path === 1) return { offset: 4 * l, queryRot: -cfg.ang };
    return { offset: 4 * l, queryRot: w1 + cfg.ang };
  }
  if (path === 0) return { offset: 1 * l, queryRot: -cfg.ang };
  if (path === 1) return { offset: 2 * l, queryRot: w0 + cfg.ang };
  if (path === 2) return { offset: 4 * l, queryRot: w1 };
  return { offset: 4 * l, queryRot: -cfg.ang };
}

function hash01(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967295;
}

function rawDepthSlope(cfg, path, level, prefix, parentSlope) {
  const center = (cfg.br - 1) * 0.5;
  const spread = center > 0 ? (path - center) / center : 0;
  const alternate = hash01(cfg.id + ':' + prefix) * 2 - 1;
  const levelFade = 0.92 - 0.045 * Math.min(level, 7);
  return clamp(parentSlope * 0.46 + spread * 0.42 * levelFade + alternate * 0.12, -0.92, 0.92);
}

function pushSegment(out, cfg, startX, startY, endX, endY, rawZ0, rawZ1, level, pathKey) {
  out.segments.push({
    cfg, a: [startX, startY, rawZ0], b: [endX, endY, rawZ1], level, pathKey
  });
}

function buildTeacher(cfg, out) {
  const root = {
    x: cfg.root[0], y: cfg.root[1], theta: 0,
    l: cfg.len0, rawZ0: 0, rawZ1: 0, rawSlope: 0, prefix: ''
  };
  pushSegment(out, cfg, root.x, root.y, root.x, root.y + 2 * root.l, 0, 0, 0, 'root');

  function recurse(parent, level) {
    if (level > cfg.depth) return;
    const l = parent.l * 0.5;
    for (let path = 0; path < cfg.br; path += 1) {
      const prefix = parent.prefix + String(path);
      const rule = teacherRule(cfg, path, l, P.time);
      const localAttach = rot2(0, rule.offset, parent.theta);
      const x = parent.x + localAttach[0];
      const y = parent.y + localAttach[1];
      const attachFraction = clamp(rule.offset / (2 * parent.l), 0, 1);
      const rawZ0 = lerp(parent.rawZ0, parent.rawZ1, attachFraction);
      const theta = parent.theta - rule.queryRot;
      const rawSlope = rawDepthSlope(cfg, path, level, prefix, parent.rawSlope);
      const localEnd = rot2(0, 2 * l, theta);
      const endX = x + localEnd[0];
      const endY = y + localEnd[1];
      const rawZ1 = rawZ0 + 2 * l * rawSlope;
      pushSegment(out, cfg, x, y, endX, endY, rawZ0, rawZ1, level, prefix);

      if (level === cfg.leafDepth) {
        const localLeaf = rot2(0, cfg.leafOffsetMul * l, theta);
        out.leaves.push({
          cfg,
          p: [
            x + localLeaf[0],
            y + localLeaf[1],
            rawZ0 + cfg.leafOffsetMul * l * rawSlope,
          ],
          radius: cfg.leafRadiusMul * l,
          prefix,
        });
      }

      recurse({
        x, y, theta, l, rawZ0, rawZ1, rawSlope, prefix
      }, level + 1);
    }
  }

  recurse(root, 1);
}

function activeConfigs() {
  return P.tree === 'ALL' ? [CFG.L, CFG.C, CFG.R] : [CFG[P.tree]];
}

function buildGraph() {
  const out = { segments: [], leaves: [] };
  for (const cfg of activeConfigs()) buildTeacher(cfg, out);
  return out;
}

function setSegmentInstance(index, segment) {
  v0.set(segment.a[0], segment.a[1], segment.a[2] * P.depth);
  v1.set(segment.b[0], segment.b[1], segment.b[2] * P.depth);
  dir.copy(v1).sub(v0);
  const length = Math.max(1e-5, dir.length());
  const midpoint = v0.clone().add(v1).multiplyScalar(0.5);
  const widthScale = segment.cfg.wid / 0.001;
  const radius = P.radius * widthScale;
  tmp.position.copy(midpoint);
  tmp.quaternion.setFromUnitVectors(yAxis, dir.normalize());
  tmp.scale.set(radius, length, radius);
  tmp.updateMatrix();
  branches.setMatrixAt(index, tmp.matrix);
}

function setLeafInstance(index, leaf) {
  tmp.position.set(leaf.p[0], leaf.p[1], leaf.p[2] * P.depth);
  tmp.quaternion.identity();
  const r = Math.max(0.004, leaf.radius);
  tmp.scale.setScalar(r);
  tmp.updateMatrix();
  leaves.setMatrixAt(index, tmp.matrix);
}

function rebuild() {
  const graph = buildGraph();
  const segCount = Math.min(graph.segments.length, MAX_SEGMENTS);
  const leafCount = Math.min(graph.leaves.length, MAX_LEAVES);
  for (let i = 0; i < segCount; i += 1) setSegmentInstance(i, graph.segments[i]);
  for (let i = 0; i < leafCount; i += 1) setLeafInstance(i, graph.leaves[i]);
  branches.count = segCount;
  leaves.count = leafCount;
  branches.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;

  const wind = windAngles(P.time);
  infoEl.textContent = `XY 老师投影锁定 · 分枝 ${segCount} · 叶端 ${leafCount} · Z=${P.depth.toFixed(2)}`;
  statusEl.textContent = `正向节点图已建立。wind0=${wind.w0.toFixed(3)} rad，wind1=${wind.w1.toFixed(3)} rad。当前 Z 只来自独立 Lift 声部，不回写老师平面角度。`;
  $('treeO').textContent = P.tree === 'ALL' ? 'ALL' : CFG[P.tree].name;
  $('depthO').textContent = P.depth.toFixed(2);
  $('timeO').textContent = P.time.toFixed(2) + ' s';
  $('radiusO').textContent = P.radius.toFixed(4);
  window.__kuko3dProjectionSignature = {
    teacherTime: P.time,
    tree: P.tree,
    segmentCount: segCount,
    leafCount,
    xyIndependentOfDepth: true,
  };
}

function setFront() {
  activeCamera = 'front';
  controls.enabled = false;
  $('front').classList.add('on');
  $('orbit').classList.remove('on');
}

function setOrbit() {
  activeCamera = 'orbit';
  controls.enabled = true;
  $('orbit').classList.add('on');
  $('front').classList.remove('on');
}

$('front').addEventListener('click', setFront);
$('orbit').addEventListener('click', setOrbit);
$('flat').addEventListener('click', () => {
  P.depth = 0;
  $('depth').value = '0';
  rebuild();
  setFront();
});
$('play').addEventListener('click', () => {
  playing = !playing;
  $('play').classList.toggle('on', playing);
  $('play').textContent = playing ? '暂停风相位' : '风相位播放';
});
$('tree').addEventListener('change', (event) => {
  P.tree = event.target.value;
  rebuild();
});
$('depth').addEventListener('input', (event) => {
  P.depth = Number(event.target.value);
  rebuild();
});
$('time').addEventListener('input', (event) => {
  P.time = Number(event.target.value);
  rebuild();
});
$('radius').addEventListener('input', (event) => {
  P.radius = Number(event.target.value);
  rebuild();
});

function resize() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  renderer.setSize(width, height, false);
  perspective.aspect = width / height;
  perspective.updateProjectionMatrix();

  const aspect = width / height;
  const teacherHalfW = 1.84;
  const teacherHalfH = 1.08;
  let halfW = teacherHalfW;
  let halfH = teacherHalfH;
  if (aspect > teacherHalfW / teacherHalfH) halfW = halfH * aspect;
  else halfH = halfW / aspect;
  front.left = -halfW;
  front.right = halfW;
  front.top = halfH;
  front.bottom = -halfH;
  front.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

function animate(now) {
  if (playing && now - lastBuild > 80) {
    P.time += (now - lastFrame) / 1000;
    if (P.time > 30) P.time -= 30;
    $('time').value = String(P.time);
    rebuild();
    lastBuild = now;
  }
  lastFrame = now;
  controls.update();
  renderer.render(scene, activeCamera === 'front' ? front : perspective);
  requestAnimationFrame(animate);
}

try {
  rebuild();
  setFront();
  window.__kuko3dLiftReady = true;
  window.KuKoDay123Lift3D = {
    setDepth(value) {
      P.depth = clamp(Number(value) || 0, 0, 0.9);
      $('depth').value = String(P.depth);
      rebuild();
    },
    setTime(value) {
      P.time = clamp(Number(value) || 0, 0, 30);
      $('time').value = String(P.time);
      rebuild();
    },
    setTree(id) {
      if (!['ALL', 'C', 'L', 'R'].includes(id)) return;
      P.tree = id;
      $('tree').value = id;
      rebuild();
    },
    front: setFront,
    orbit: setOrbit,
    getState() {
      return {
        ...P,
        activeCamera,
        playing,
        projectionLocked: true,
        teacherEdited: false,
        appliesToPandanus: false,
        signature: window.__kuko3dProjectionSignature,
      };
    },
  };
  document.documentElement.dataset.ready = 'true';
  animate(performance.now());
} catch (error) {
  errorEl.hidden = false;
  errorEl.textContent = String(error?.stack || error);
  throw error;
}
