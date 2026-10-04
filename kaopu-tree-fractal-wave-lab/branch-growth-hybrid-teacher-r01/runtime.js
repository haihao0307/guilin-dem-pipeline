import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const up = new THREE.Vector3(0, 1, 0);

const P = {
  score: 'neutral', density: 420, influence: 1.45, kill: 0.22, step: 0.26,
  split: 12, inertia: 0.42, field: 0.52, wave: 0.18, space: 0.72,
  growth: 1,
};

let showTargets = true;
let showTips = true;
let showLoad = true;
let autoRotate = false;
let playing = false;
let seed = 41007;
let current = null;
let lastTime = performance.now();
let buildTimer = 0;

const stage = $('stage');
const errorEl = $('error');
const infoEl = $('info');
const statusEl = $('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07100f);
scene.fog = new THREE.FogExp2(0x07100f, 0.035);

const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 70);
camera.position.set(6.5, 4.2, 8.2);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0, 1.4, 0);
controls.minDistance = 2.8;
controls.maxDistance = 26;
controls.maxPolarAngle = Math.PI * 0.95;

scene.add(new THREE.HemisphereLight(0xbddbd2, 0x24191a, 1.75));
const key = new THREE.DirectionalLight(0xe8fff8, 2.5);
key.position.set(5, 9, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff83b0, 0.9);
rim.position.set(-5, 3, -4);
scene.add(rim);

const grid = new THREE.GridHelper(12, 24, 0x2c443e, 0x152723);
grid.position.y = -2.25;
scene.add(grid);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(5.8, 64),
  new THREE.MeshStandardMaterial({ color: 0x13211e, roughness: 1, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.27;
scene.add(ground);

const branchGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
const tipGeo = new THREE.SphereGeometry(1, 8, 6);
const branchMat = new THREE.MeshStandardMaterial({ color: 0x78d9c8, roughness: 0.68, metalness: 0 });
const tipMat = new THREE.MeshStandardMaterial({ color: 0xd45a87, emissive: 0x370716, emissiveIntensity: 0.34, roughness: 0.5 });
const MAX_SEGMENTS = 2800;
const MAX_TIPS = 420;
const branchMesh = new THREE.InstancedMesh(branchGeo, branchMat, MAX_SEGMENTS);
const tipMesh = new THREE.InstancedMesh(tipGeo, tipMat, MAX_TIPS);
branchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
tipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(branchMesh, tipMesh);

const targetMat = new THREE.PointsMaterial({ color: 0x7097d0, size: 0.045, transparent: true, opacity: 0.52, sizeAttenuation: true });
let targetPoints = new THREE.Points(new THREE.BufferGeometry(), targetMat);
scene.add(targetPoints);

const tmp = new THREE.Object3D();
const yAxis = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion();

function rngFactory(s) {
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = s; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash01(text) {
  let h = 2166136261 >>> 0;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h / 4294967295;
}

function scoreField(point, parentDir) {
  if (P.score === 'tree') {
    const radial = new THREE.Vector3(point.x, 0, point.z);
    if (radial.lengthSq()) radial.normalize();
    return up.clone().multiplyScalar(0.72).addScaledVector(radial, point.y > 0.7 ? 0.26 : 0.04).normalize();
  }
  if (P.score === 'coral') {
    const fanOut = new THREE.Vector3(Math.sign(point.x || 1), 0.22, -point.z * 1.7);
    return fanOut.lengthSq() ? fanOut.normalize() : parentDir.clone();
  }
  return up.clone().multiplyScalar(0.22).add(parentDir.clone().multiplyScalar(0.12)).normalize();
}

function generateTargets() {
  const rng = rngFactory(seed + (P.score === 'tree' ? 17 : P.score === 'coral' ? 29 : 43));
  const targets = [];
  for (let i = 0; i < P.density; i += 1) {
    if (P.score === 'tree') {
      if (i < Math.max(20, Math.floor(P.density * 0.12))) {
        const y = -1.85 + rng() * 3.1;
        targets.push(new THREE.Vector3((rng() - 0.5) * 0.42, y, (rng() - 0.5) * 0.42));
      } else {
        const theta = rng() * Math.PI * 2;
        const r = Math.sqrt(rng());
        const y = 0.3 + Math.pow(rng(), 0.7) * 4.35;
        const crown = (0.65 + 1.7 * Math.sin(clamp((y - 0.3) / 4.35, 0, 1) * Math.PI)) * r;
        targets.push(new THREE.Vector3(Math.cos(theta) * crown, y, Math.sin(theta) * crown * 0.82));
      }
    } else if (P.score === 'coral') {
      const u = (rng() - 0.5) * 2;
      const y = -1.65 + Math.pow(rng(), 0.72) * 5.6;
      const width = 0.35 + 2.55 * Math.pow(clamp((y + 1.65) / 5.6, 0, 1), 0.72);
      const x = u * width * (0.72 + 0.28 * rng());
      const z = (rng() - 0.5) * 0.38 + 0.07 * Math.sin(y * 2.4 + u * 3.1);
      targets.push(new THREE.Vector3(x, y, z));
    } else {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = Math.cbrt(rng());
      targets.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * r * 2.55,
        -0.55 + Math.cos(phi) * r * 2.65 + 1.15,
        Math.sin(phi) * Math.sin(theta) * r * 2.25
      ));
    }
  }
  return targets;
}

function repelFromNodes(point, nodes) {
  const repel = new THREE.Vector3();
  const radius = Math.max(0.18, P.step * 2.6);
  for (let i = Math.max(0, nodes.length - 260); i < nodes.length; i += 1) {
    const d = point.clone().sub(nodes[i].p);
    const len = d.length();
    if (len > 1e-5 && len < radius) {
      const w = (radius - len) / radius;
      repel.addScaledVector(d.multiplyScalar(1 / len), w * w);
    }
  }
  return repel.lengthSq() ? repel.normalize() : repel;
}

function averageDirection(targetIds, targets, origin) {
  const avg = new THREE.Vector3();
  for (const id of targetIds) avg.add(targets[id].clone().sub(origin).normalize());
  return avg.lengthSq() ? avg.normalize() : up.clone();
}

function partitionDirections(targetIds, targets, node) {
  let lateral = new THREE.Vector3().crossVectors(node.dir, up);
  if (lateral.lengthSq() < 0.04) lateral.set(1, 0, 0);
  lateral.normalize();
  const A = [], B = [];
  for (const id of targetIds) {
    const dir = targets[id].clone().sub(node.p).normalize();
    (dir.dot(lateral) >= 0 ? A : B).push(id);
  }
  return [A, B];
}

function makeChild(nodeIndex, targetIds, nodes, targets, iteration, childIndex) {
  const parent = nodes[nodeIndex];
  const avg = averageDirection(targetIds, targets, parent.p);
  const field = scoreField(parent.p, parent.dir);
  const phase = nodeIndex * 1.618 + childIndex * 0.73 + seed * 0.00013;
  const wave = new THREE.Vector3(
    Math.sin(iteration * 0.23 + phase),
    0.18 * Math.sin(iteration * 0.17 + phase * 1.3),
    Math.cos(iteration * 0.19 + phase) * (P.score === 'coral' ? 0.16 : 1)
  ).multiplyScalar(P.wave);
  const repel = repelFromNodes(parent.p, nodes).multiplyScalar(P.space);
  const jitter = new THREE.Vector3(
    (hash01(`${nodeIndex}:${iteration}:${childIndex}:x`) - 0.5) * 0.08,
    (hash01(`${nodeIndex}:${iteration}:${childIndex}:y`) - 0.5) * 0.035,
    (hash01(`${nodeIndex}:${iteration}:${childIndex}:z`) - 0.5) * 0.08
  );
  const dir = avg.clone()
    .addScaledVector(parent.dir, P.inertia)
    .addScaledVector(field, P.field)
    .add(wave)
    .add(repel)
    .add(jitter)
    .normalize();
  if (P.score === 'coral') dir.z *= 0.24;
  dir.normalize();
  const p = parent.p.clone().addScaledVector(dir, P.step);
  return { p, dir, parent: nodeIndex, load: 1, birth: iteration, children: [] };
}

function buildGraph() {
  const targets = generateTargets();
  const alive = new Set(targets.map((_, i) => i));
  const start = new THREE.Vector3(0, -2.05, 0);
  const nodes = [{ p: start, dir: up.clone(), parent: -1, load: 1, birth: 0, children: [] }];
  let active = [0];
  const segments = [];
  let splitCount = 0;
  let maxIteration = 0;

  for (let iteration = 1; iteration <= 360 && active.length && nodes.length < MAX_SEGMENTS; iteration += 1) {
    maxIteration = iteration;
    const influence = new Map();
    const killed = [];
    for (const targetId of alive) {
      const target = targets[targetId];
      let best = Infinity;
      let bestTip = -1;
      for (const tipId of active) {
        const d = target.distanceTo(nodes[tipId].p);
        if (d < P.kill) { killed.push(targetId); bestTip = -1; break; }
        if (d < P.influence && d < best) { best = d; bestTip = tipId; }
      }
      if (bestTip >= 0) {
        if (!influence.has(bestTip)) influence.set(bestTip, []);
        influence.get(bestTip).push(targetId);
      }
    }
    for (const id of killed) alive.delete(id);

    const next = [];
    for (const tipId of active) {
      let ids = influence.get(tipId) || [];
      if (!ids.length) {
        let nearest = -1;
        let best = Infinity;
        for (const id of alive) {
          const d = targets[id].distanceTo(nodes[tipId].p);
          if (d < best) { best = d; nearest = id; }
        }
        if (nearest >= 0 && best < P.influence * 2.2) ids = [nearest];
        else continue;
      }

      const [A, B] = partitionDirections(ids, targets, nodes[tipId]);
      const dirA = A.length ? averageDirection(A, targets, nodes[tipId].p) : null;
      const dirB = B.length ? averageDirection(B, targets, nodes[tipId].p) : null;
      const angle = dirA && dirB ? dirA.angleTo(dirB) : 0;
      const shouldSplit = ids.length >= P.split && A.length >= 3 && B.length >= 3 && angle > 0.32;
      const groups = shouldSplit ? [A, B] : [ids];
      if (shouldSplit) splitCount += 1;

      groups.forEach((group, childIndex) => {
        if (!group.length || nodes.length >= MAX_SEGMENTS) return;
        const child = makeChild(tipId, group, nodes, targets, iteration, childIndex);
        const childId = nodes.length;
        nodes.push(child);
        nodes[tipId].children.push(childId);
        segments.push({ a: nodes[tipId].p.clone(), b: child.p.clone(), node: childId, birth: iteration });
        next.push(childId);
      });
    }
    active = next.slice(0, 260);
    if (!alive.size) break;
  }

  for (let i = nodes.length - 1; i > 0; i -= 1) {
    const parent = nodes[i].parent;
    if (parent >= 0) nodes[parent].load += nodes[i].load;
  }
  const rootLoad = Math.max(1, nodes[0].load);
  for (const segment of segments) {
    const ratio = nodes[segment.node].load / rootLoad;
    segment.radius = 0.014 + 0.105 * Math.pow(ratio, 0.43);
  }

  return {
    targets, alive, nodes, active, segments, splitCount, maxIteration,
    signature: {
      schema: 'KAOPU.branch-growth-hybrid-teacher/1',
      score: P.score,
      targetCount: targets.length,
      claimedTargets: targets.length - alive.size,
      segmentCount: segments.length,
      nodeCount: nodes.length,
      activeTips: active.length,
      splitCount,
      maxIteration,
      direct3D: true,
      multipleActiveTips: true,
      targetAllocation: true,
      realBranchSplits: splitCount > 0,
      loadBackPropagation: true,
      cameraAffectsGeneration: false,
      teacherLayer: true,
      runtimeTruth: false,
      sharedWithCoral: true,
      speciesAssigned: false,
    },
  };
}

function setCylinder(index, a, b, radius) {
  const dir = b.clone().sub(a);
  const length = Math.max(1e-5, dir.length());
  tmp.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.quaternion.setFromUnitVectors(yAxis, dir.normalize());
  tmp.scale.set(radius, length, radius);
  tmp.updateMatrix();
  branchMesh.setMatrixAt(index, tmp.matrix);
}

function setSphere(mesh, index, p, radius) {
  tmp.position.copy(p);
  tmp.quaternion.identity();
  tmp.scale.setScalar(radius);
  tmp.updateMatrix();
  mesh.setMatrixAt(index, tmp.matrix);
}

function rebuildTargets(graph) {
  const arr = [];
  for (const id of graph.alive) {
    const p = graph.targets[id];
    arr.push(p.x, p.y, p.z);
  }
  targetPoints.geometry.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  targetPoints.geometry = g;
  targetPoints.visible = showTargets;
}

function updateMeshes() {
  if (!current) return;
  const visibleIteration = P.growth * Math.max(1, current.maxIteration);
  let count = 0;
  for (const s of current.segments) {
    if (s.birth > visibleIteration || count >= MAX_SEGMENTS) continue;
    setCylinder(count, s.a, s.b, showLoad ? s.radius : 0.018);
    count += 1;
  }
  branchMesh.count = count;
  branchMesh.instanceMatrix.needsUpdate = true;

  let tipCount = 0;
  if (showTips) {
    for (const id of current.active) {
      if (tipCount >= MAX_TIPS) break;
      setSphere(tipMesh, tipCount++, current.nodes[id].p, 0.055);
    }
  }
  tipMesh.count = tipCount;
  tipMesh.instanceMatrix.needsUpdate = true;

  $('growthO').textContent = `${Math.round(P.growth * 100)}%`;
  $('info').textContent = `${count} 可见段 · ${current.signature.claimedTargets}/${current.signature.targetCount} 已占领目标 · ${current.signature.splitCount} 次真实分裂 · Score ${P.score}`;
}

function fitGraph() {
  if (!current || !current.segments.length) return;
  const box = new THREE.Box3();
  for (const s of current.segments) { box.expandByPoint(s.a); box.expandByPoint(s.b); }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 3);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(1.05, 0.62, 1.18).normalize(), span * 1.55);
  camera.near = Math.max(0.02, span / 180);
  camera.far = Math.max(60, span * 12);
  camera.updateProjectionMatrix();
  controls.update();
}

function updateOutputs() {
  $('scoreO').textContent = P.score;
  $('densityO').textContent = String(P.density);
  $('influenceO').textContent = P.influence.toFixed(2);
  $('killO').textContent = P.kill.toFixed(2);
  $('stepO').textContent = P.step.toFixed(2);
  $('splitO').textContent = String(P.split);
  $('inertiaO').textContent = P.inertia.toFixed(2);
  $('fieldO').textContent = P.field.toFixed(2);
  $('waveO').textContent = P.wave.toFixed(2);
  $('spaceO').textContent = P.space.toFixed(2);
  $('growthO').textContent = `${Math.round(P.growth * 100)}%`;
}

function rebuild(fit = false) {
  current = buildGraph();
  rebuildTargets(current);
  updateOutputs();
  updateMeshes();
  $('segBadge').textContent = `Segment ${current.signature.segmentCount}`;
  $('targetBadge').textContent = `Target ${current.signature.targetCount}`;
  $('tipBadge').textContent = `Tip ${current.signature.activeTips}`;
  $('splitBadge').textContent = `Split ${current.signature.splitCount}`;
  $('status').textContent = `老师管线已建立：${current.signature.multipleActiveTips ? '多活跃端' : '单端'}瓜分目标；${current.signature.splitCount} 次真实分裂；粗细由下游负载反传。当前 ${P.score === 'tree' ? '树线镜头强调主轴与体积冠层' : P.score === 'coral' ? '珊瑚镜头强调近二维扇面与密集末端' : '中性镜头只检查共享算法'}。这仍是 Teacher / Learning 层，不是对象 Truth。`;
  window.__branchGrowthTeacherR01Signature = current.signature;
  if (fit) requestAnimationFrame(fitGraph);
}

function scheduleRebuild() {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => rebuild(false), 90);
}

function bindRange(id, key, parse = Number) {
  $(id).addEventListener('input', (event) => { P[key] = parse(event.target.value); if (key === 'growth') updateMeshes(); else scheduleRebuild(); });
}

$('score').addEventListener('change', (event) => { P.score = event.target.value; rebuild(true); });
bindRange('density', 'density', (v) => parseInt(v, 10));
bindRange('influence', 'influence');
bindRange('kill', 'kill');
bindRange('step', 'step');
bindRange('split', 'split', (v) => parseInt(v, 10));
bindRange('inertia', 'inertia');
bindRange('field', 'field');
bindRange('wave', 'wave');
bindRange('space', 'space');
bindRange('growth', 'growth');

$('fit').addEventListener('click', fitGraph);
$('rebuild').addEventListener('click', () => { seed += 101; rebuild(true); });
$('targets').addEventListener('click', () => { showTargets = !showTargets; $('targets').classList.toggle('on', showTargets); targetPoints.visible = showTargets; });
$('tips').addEventListener('click', () => { showTips = !showTips; $('tips').classList.toggle('on', showTips); updateMeshes(); });
$('load').addEventListener('click', () => { showLoad = !showLoad; $('load').classList.toggle('on', showLoad); updateMeshes(); });
$('auto').addEventListener('click', () => { autoRotate = !autoRotate; controls.autoRotate = autoRotate; controls.autoRotateSpeed = 0.62; $('auto').classList.toggle('on', autoRotate); });
$('play').addEventListener('click', () => {
  playing = !playing;
  if (playing && P.growth >= 1) P.growth = 0;
  $('play').classList.toggle('on', playing);
  $('play').textContent = playing ? '暂停生长' : '播放生长';
  $('growth').value = String(P.growth);
  updateMeshes();
});

function resize() {
  const w = Math.max(1, stage.clientWidth);
  const h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

try {
  rebuild(true);
  window.__branchGrowthTeacherR01Ready = true;
  window.BranchGrowthTeacherR01 = {
    rebuild: () => rebuild(false),
    fit: fitGraph,
    setScore(value) { if (!['neutral', 'tree', 'coral'].includes(value)) return; P.score = value; $('score').value = value; rebuild(true); },
    setDensity(value) { P.density = Math.round(clamp(Number(value) || 420, 120, 720) / 20) * 20; $('density').value = String(P.density); rebuild(false); },
    setSplit(value) { P.split = Math.round(clamp(Number(value) || 12, 5, 28)); $('split').value = String(P.split); rebuild(false); },
    setGrowth(value) { P.growth = clamp(Number(value) || 0, 0, 1); $('growth').value = String(P.growth); updateMeshes(); },
    getState() { return { params: { ...P }, signature: current?.signature || null, showTargets, showTips, showLoad, autoRotate, playing }; },
  };
  document.documentElement.dataset.ready = 'true';
  (function animate(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (playing) {
      P.growth = Math.min(1, P.growth + dt * 0.18);
      $('growth').value = String(P.growth);
      updateMeshes();
      if (P.growth >= 1) { playing = false; $('play').classList.remove('on'); $('play').textContent = '播放生长'; }
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  })(performance.now());
} catch (error) {
  errorEl.hidden = false;
  errorEl.textContent = String(error?.stack || error);
  throw error;
}
