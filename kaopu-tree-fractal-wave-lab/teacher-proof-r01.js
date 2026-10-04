import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';

const host = document.querySelector('#videoTeacherProofStage');
const info = document.querySelector('#videoTeacherProofInfo');
const status = document.querySelector('#videoTeacherProofStatus');
const targetValue = document.querySelector('#videoTeacherTargetValue');
const segmentValue = document.querySelector('#videoTeacherSegmentValue');
const terminalValue = document.querySelector('#videoTeacherTerminalValue');
const growthInput = document.querySelector('#videoTeacherGrowth');
const growthValue = document.querySelector('#videoTeacherGrowthValue');
const scoreButtons = [...document.querySelectorAll('[data-proof-score]')];
const stageButtons = [...document.querySelectorAll('[data-proof-stage]')];

if (!host) throw new Error('video teacher proof host is missing');

const P = { score: 'tree', stage: 'targets', growth: 1 };
let playing = false;
let graph = null;
let yaw = -0.72;
let pitch = 0.25;
let distance = 11.0;
let dragging = false;
let lastPointer = null;
let lastTime = performance.now();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07100f);
scene.fog = new THREE.FogExp2(0x07100f, 0.038);
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 60);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc6ded6, 0x211819, 1.65));
const key = new THREE.DirectionalLight(0xeafff8, 2.45);
key.position.set(5, 8, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff83b0, 0.72);
rim.position.set(-4, 3, -4);
scene.add(rim);

const grid = new THREE.GridHelper(12, 24, 0x2d4640, 0x162724);
grid.position.y = -2.31;
scene.add(grid);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(5.7, 64),
  new THREE.MeshStandardMaterial({ color: 0x13211e, roughness: 1, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.33;
scene.add(ground);

const segmentGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
const jointGeo = new THREE.SphereGeometry(1, 9, 7);
const terminalGeo = new THREE.SphereGeometry(1, 10, 8);
const scaffoldMat = new THREE.MeshStandardMaterial({ color: 0x8b9994, roughness: 0.8, transparent: true, opacity: 0.72 });
const branchMat = new THREE.MeshStandardMaterial({ color: 0x55d7c1, roughness: 0.67 });
const surfaceMat = new THREE.MeshStandardMaterial({ color: 0x8bb9a5, roughness: 0.76 });
const terminalMat = new THREE.MeshStandardMaterial({ color: 0xd75c8d, emissive: 0x310715, emissiveIntensity: 0.28, roughness: 0.48 });
const targetMat = new THREE.PointsMaterial({ color: 0x70a0da, size: 0.055, transparent: true, opacity: 0.62, sizeAttenuation: true });

const MAX_SEGMENTS = 420;
const MAX_JOINTS = 460;
const MAX_TERMINALS = 160;
const segmentMesh = new THREE.InstancedMesh(segmentGeo, branchMat, MAX_SEGMENTS);
const jointMesh = new THREE.InstancedMesh(jointGeo, surfaceMat, MAX_JOINTS);
const terminalMesh = new THREE.InstancedMesh(terminalGeo, terminalMat, MAX_TERMINALS);
segmentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
jointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
terminalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(segmentMesh, jointMesh, terminalMesh);
let targetsPoints = new THREE.Points(new THREE.BufferGeometry(), targetMat);
scene.add(targetsPoints);

const tmp = new THREE.Object3D();
const yAxis = new THREE.Vector3(0, 1, 0);
const center = new THREE.Vector3(0, 0.45, 0);

function rngFactory(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function clampTurn(current, desired, maxAngle) {
  const a = current.clone().normalize();
  const b = desired.clone().normalize();
  const angle = a.angleTo(b);
  if (angle <= maxAngle) return b;
  const q = new THREE.Quaternion().setFromUnitVectors(a, b);
  const limited = new THREE.Quaternion().identity().slerp(q, maxAngle / Math.max(angle, 1e-6));
  return a.applyQuaternion(limited).normalize();
}

function generateEnvelope(score) {
  const rng = rngFactory(score === 'tree' ? 731 : 1187);
  const points = [];
  const groups = [];
  const groupCount = score === 'tree' ? 7 : 9;
  for (let g = 0; g < groupCount; g += 1) groups[g] = [];

  if (score === 'tree') {
    const lobes = [
      { c: new THREE.Vector3(0, 3.6, 0), r: new THREE.Vector3(0.85, 1.25, 0.78) },
      { c: new THREE.Vector3(1.7, 2.55, 0.25), r: new THREE.Vector3(1.05, 0.85, 0.78) },
      { c: new THREE.Vector3(-1.7, 2.6, -0.15), r: new THREE.Vector3(1.05, 0.9, 0.8) },
      { c: new THREE.Vector3(1.25, 1.4, -1.15), r: new THREE.Vector3(0.85, 0.7, 0.72) },
      { c: new THREE.Vector3(-1.2, 1.45, 1.05), r: new THREE.Vector3(0.9, 0.72, 0.72) },
      { c: new THREE.Vector3(0.2, 2.1, 1.55), r: new THREE.Vector3(0.75, 0.75, 0.65) },
      { c: new THREE.Vector3(-0.2, 2.0, -1.55), r: new THREE.Vector3(0.75, 0.75, 0.65) },
    ];
    lobes.forEach((lobe, g) => {
      const count = g === 0 ? 54 : 38;
      for (let i = 0; i < count; i += 1) {
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);
        const rr = Math.cbrt(rng());
        const p = lobe.c.clone().add(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * rr * lobe.r.x,
          Math.cos(phi) * rr * lobe.r.y,
          Math.sin(phi) * Math.sin(theta) * rr * lobe.r.z
        ));
        groups[g].push(points.length);
        points.push(p);
      }
    });
  } else {
    for (let g = 0; g < groupCount; g += 1) {
      const u = -1 + 2 * g / (groupCount - 1);
      const c = new THREE.Vector3(u * 2.7, 0.15 + 3.15 * (1 - 0.12 * Math.abs(u)), 0.12 * Math.sin(g * 1.7));
      const count = 34;
      for (let i = 0; i < count; i += 1) {
        const theta = rng() * Math.PI * 2;
        const rr = Math.sqrt(rng());
        const p = c.clone().add(new THREE.Vector3(
          Math.cos(theta) * rr * (0.42 + 0.3 * rng()),
          Math.sin(theta) * rr * (0.62 + 0.22 * rng()),
          (rng() - 0.5) * 0.32
        ));
        groups[g].push(points.length);
        points.push(p);
      }
    }
  }
  return { points, groups };
}

function centroid(ids, points) {
  const c = new THREE.Vector3();
  for (const id of ids) c.add(points[id]);
  return c.multiplyScalar(1 / Math.max(1, ids.length));
}

function splitGroup(ids, points, origin, direction) {
  let lateral = new THREE.Vector3().crossVectors(direction, yAxis);
  if (lateral.lengthSq() < 0.05) lateral.set(1, 0, 0);
  lateral.normalize();
  const A = [], B = [];
  for (const id of ids) {
    const d = points[id].clone().sub(origin);
    (d.dot(lateral) >= 0 ? A : B).push(id);
  }
  return [A, B];
}

function buildGraph(score) {
  const envelope = generateEnvelope(score);
  const segments = [];
  const nodes = [];
  const terminals = [];
  let birth = 0;

  function addNode(p, parent = -1) {
    const id = nodes.length;
    nodes.push({ p: p.clone(), parent, children: [], load: 1 });
    if (parent >= 0) nodes[parent].children.push(id);
    return id;
  }
  function addSegment(a, b, parentNode, order, scaffold = false) {
    const node = addNode(b, parentNode);
    const segment = { a: a.clone(), b: b.clone(), node, order, scaffold, birth: birth++, children: [], load: 1, radius: 0.018 };
    segments.push(segment);
    return { node, segment: segments.length - 1 };
  }

  const root = addNode(new THREE.Vector3(0, -2.05, 0));
  const primarySeeds = [];
  if (score === 'tree') {
    let parent = root;
    let p = nodes[root].p.clone();
    const tierNodes = [];
    for (let i = 0; i < 10; i += 1) {
      const next = p.clone().add(new THREE.Vector3(0.018 * Math.sin(i * 0.7), 0.42, 0.016 * Math.cos(i * 0.6)));
      const added = addSegment(p, next, parent, 0, true);
      parent = added.node;
      p = next;
      if ([3, 5, 7, 8].includes(i)) tierNodes.push(parent);
    }
    primarySeeds.push({ node: parent, ids: envelope.groups[0], dir: new THREE.Vector3(0, 1, 0), order: 0, key: 'leader' });
    const branchGroups = [1, 2, 3, 4, 5, 6];
    branchGroups.forEach((groupId, i) => {
      const node = tierNodes[Math.min(tierNodes.length - 1, Math.floor(i / 2) + 1)];
      const origin = nodes[node].p;
      const dir = centroid(envelope.groups[groupId], envelope.points).sub(origin).normalize();
      primarySeeds.push({ node, ids: envelope.groups[groupId], dir, order: 1, key: `primary-${i}` });
    });
  } else {
    let parent = root;
    let p = nodes[root].p.clone();
    for (let i = 0; i < 4; i += 1) {
      const next = p.clone().add(new THREE.Vector3(0, 0.42, 0));
      const added = addSegment(p, next, parent, 0, true);
      parent = added.node;
      p = next;
    }
    envelope.groups.forEach((ids, i) => {
      const dir = centroid(ids, envelope.points).sub(p).normalize();
      primarySeeds.push({ node: parent, ids, dir, order: 1, key: `fan-${i}` });
    });
  }

  function grow(seed, depth = 0) {
    if (!seed.ids.length || segments.length >= MAX_SEGMENTS || depth > 3) return;
    let origin = nodes[seed.node].p.clone();
    let parentNode = seed.node;
    let direction = seed.dir.clone().normalize();
    const targetCenter = centroid(seed.ids, envelope.points);
    const steps = depth === 0 ? 5 : depth === 1 ? 4 : 3;
    const stepLength = score === 'tree' ? 0.34 - depth * 0.035 : 0.31 - depth * 0.03;

    for (let i = 0; i < steps && segments.length < MAX_SEGMENTS; i += 1) {
      const desired = targetCenter.clone().sub(origin).normalize();
      const wave = new THREE.Vector3(
        0.06 * Math.sin((birth + i) * 0.55 + depth),
        score === 'tree' ? 0.025 : 0.05 * Math.cos((birth + i) * 0.43),
        score === 'tree' ? 0.055 * Math.cos((birth + i) * 0.49) : 0.018 * Math.sin((birth + i) * 0.67)
      );
      const desiredWithWave = desired.add(wave).normalize();
      direction = clampTurn(direction, desiredWithWave, THREE.MathUtils.degToRad(depth === 0 ? 11 : depth === 1 ? 17 : 24));
      if (score === 'tree' && direction.y < -0.05) direction.y = -0.05;
      if (score === 'coral') direction.z *= 0.18;
      direction.normalize();
      const next = origin.clone().addScaledVector(direction, stepLength);
      const added = addSegment(origin, next, parentNode, seed.order + depth, false);
      parentNode = added.node;
      origin = next;
    }

    if (depth >= 3 || seed.ids.length < 10) {
      terminals.push({ node: parentNode, order: seed.order + depth });
      return;
    }
    const [A, B] = splitGroup(seed.ids, envelope.points, origin, direction);
    if (A.length < 4 || B.length < 4) {
      terminals.push({ node: parentNode, order: seed.order + depth });
      return;
    }
    const dirs = [A, B].map(ids => centroid(ids, envelope.points).sub(origin).normalize());
    grow({ node: parentNode, ids: A, dir: clampTurn(direction, dirs[0], THREE.MathUtils.degToRad(28)), order: seed.order + 1, key: `${seed.key}-a` }, depth + 1);
    grow({ node: parentNode, ids: B, dir: clampTurn(direction, dirs[1], THREE.MathUtils.degToRad(28)), order: seed.order + 1, key: `${seed.key}-b` }, depth + 1);
  }

  for (const seedItem of primarySeeds) grow(seedItem, 0);

  for (let i = nodes.length - 1; i > 0; i -= 1) {
    const parent = nodes[i].parent;
    if (parent >= 0) nodes[parent].load += nodes[i].load;
  }
  const rootLoad = Math.max(1, nodes[root].load);
  for (const segment of segments) {
    segment.load = nodes[segment.node].load;
    const ratio = segment.load / rootLoad;
    segment.radius = segment.scaffold
      ? 0.045 + 0.14 * Math.pow(ratio, 0.42)
      : 0.016 + 0.105 * Math.pow(ratio, 0.42) * (1 - 0.08 * Math.min(segment.order, 3));
  }

  const backtracks = segments.filter(s => {
    const d = s.b.clone().sub(s.a).normalize();
    return score === 'tree' ? d.y < -0.2 : Math.abs(d.z) > 0.45;
  }).length;

  return {
    score,
    targets: envelope.points,
    segments,
    nodes,
    terminals,
    signature: {
      schema: 'KAOPU.video-teacher-proof/1',
      score,
      stageCount: 4,
      targetCount: envelope.points.length,
      segmentCount: segments.length,
      terminalCount: terminals.length,
      scaffoldCount: segments.filter(s => s.scaffold).length,
      branchCount: segments.filter(s => !s.scaffold).length,
      maxOrder: Math.max(...segments.map(s => s.order), 0),
      backtrackCount: backtracks,
      targetEnvelope: true,
      localGrammar: true,
      growthHistory: true,
      loadBackPropagation: true,
      terminalOrganization: true,
      surfaceStage: true,
      cameraAffectsGeneration: false,
      speciesAssigned: false,
      exactTeacherSourceClaim: false,
    }
  };
}

function setCylinder(index, a, b, radius) {
  const dir = b.clone().sub(a);
  const length = Math.max(1e-5, dir.length());
  tmp.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.quaternion.setFromUnitVectors(yAxis, dir.normalize());
  tmp.scale.set(radius, length, radius);
  tmp.updateMatrix();
  segmentMesh.setMatrixAt(index, tmp.matrix);
}

function setSphere(mesh, index, p, radius) {
  tmp.position.copy(p);
  tmp.quaternion.identity();
  tmp.scale.setScalar(radius);
  tmp.updateMatrix();
  mesh.setMatrixAt(index, tmp.matrix);
}

function rebuildTargetPoints() {
  const arr = [];
  for (const p of graph.targets) arr.push(p.x, p.y, p.z);
  targetsPoints.geometry.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  targetsPoints.geometry = geometry;
}

function renderGraph() {
  if (!graph) return;
  const maxBirth = Math.max(1, ...graph.segments.map(s => s.birth));
  const birthLimit = P.growth * maxBirth;
  let segmentCount = 0;
  let jointCount = 0;
  const stage = P.stage;
  const showTargets = stage === 'targets' || stage === 'skeleton';
  const showOnlyScaffold = stage === 'targets';
  const thick = stage === 'thickness' || stage === 'surface';
  const showJoints = stage === 'surface';
  const showTerminals = stage === 'surface';

  segmentMesh.material = stage === 'targets' ? scaffoldMat : stage === 'surface' ? surfaceMat : branchMat;
  for (const s of graph.segments) {
    if (s.birth > birthLimit || segmentCount >= MAX_SEGMENTS) continue;
    if (showOnlyScaffold && !s.scaffold) continue;
    const radius = s.scaffold ? (thick ? s.radius : 0.023) : (thick ? s.radius : 0.012);
    setCylinder(segmentCount++, s.a, s.b, radius);
    if (showJoints && jointCount < MAX_JOINTS) setSphere(jointMesh, jointCount++, s.a, radius * 1.08);
  }
  segmentMesh.count = segmentCount;
  segmentMesh.instanceMatrix.needsUpdate = true;
  jointMesh.count = jointCount;
  jointMesh.instanceMatrix.needsUpdate = true;
  jointMesh.visible = showJoints;
  targetsPoints.visible = showTargets;

  let terminalCount = 0;
  if (showTerminals) {
    for (const terminal of graph.terminals) {
      if (terminalCount >= MAX_TERMINALS) break;
      const node = graph.nodes[terminal.node];
      setSphere(terminalMesh, terminalCount++, node.p, 0.05 + 0.008 * Math.max(0, 3 - terminal.order));
    }
  }
  terminalMesh.count = terminalCount;
  terminalMesh.instanceMatrix.needsUpdate = true;
  terminalMesh.visible = showTerminals;

  info.textContent = `${graph.signature.targetCount} 目标样本 · ${segmentCount} 可见段 · ${graph.signature.terminalCount} 末端区 · 阶段 ${stage}`;
  targetValue.textContent = String(graph.signature.targetCount);
  segmentValue.textContent = String(graph.signature.segmentCount);
  terminalValue.textContent = String(graph.signature.terminalCount);
  growthValue.textContent = `${Math.round(P.growth * 100)}%`;
  status.textContent = stage === 'targets'
    ? '① 目标包络：只显示环境允许生长的空间与主轴/基底，不把点云直接当成枝条。'
    : stage === 'skeleton'
      ? '② 阶段骨架：局部方向受目标包络约束；父子分裂清楚，禁止回头和缠绕。'
      : stage === 'thickness'
        ? '③ 厚度反传：先完成拓扑，再由末端负载向基部反传粗细，拒绝每层机械乘常数。'
        : '④ 末端与表面：在正确骨架上增加局部连接领圈、圆钝末端和统一材质；点云已退出成品。';
  window.__videoTeacherProofSignature = graph.signature;
}

function rebuild(fit = false) {
  graph = buildGraph(P.score);
  rebuildTargetPoints();
  renderGraph();
  if (fit) fitCamera();
}

function fitCamera() {
  if (!graph || !graph.segments.length) return;
  const box = new THREE.Box3();
  for (const s of graph.segments) { box.expandByPoint(s.a); box.expandByPoint(s.b); }
  const c = box.getCenter(new THREE.Vector3());
  center.copy(c);
  const size = box.getSize(new THREE.Vector3());
  distance = Math.max(size.x, size.y, size.z, 3) * 1.55;
  updateCamera();
}

function updateCamera() {
  const cp = Math.cos(pitch);
  camera.position.set(
    center.x + Math.sin(yaw) * cp * distance,
    center.y + Math.sin(pitch) * distance,
    center.z + Math.cos(yaw) * cp * distance
  );
  camera.lookAt(center);
}

function resize() {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

renderer.domElement.addEventListener('pointerdown', event => {
  dragging = true;
  lastPointer = [event.clientX, event.clientY];
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging || !lastPointer) return;
  const dx = event.clientX - lastPointer[0];
  const dy = event.clientY - lastPointer[1];
  lastPointer = [event.clientX, event.clientY];
  yaw -= dx * 0.006;
  pitch = clamp(pitch + dy * 0.004, -0.65, 1.15);
  updateCamera();
});
renderer.domElement.addEventListener('pointerup', event => {
  dragging = false;
  lastPointer = null;
  try { renderer.domElement.releasePointerCapture(event.pointerId); } catch (_) {}
});
renderer.domElement.addEventListener('wheel', event => {
  event.preventDefault();
  distance = clamp(distance * Math.exp(event.deltaY * 0.001), 3, 24);
  updateCamera();
}, { passive: false });

for (const button of scoreButtons) {
  button.addEventListener('click', () => {
    P.score = button.dataset.proofScore;
    for (const b of scoreButtons) b.classList.toggle('on', b === button);
    rebuild(true);
  });
}
for (const button of stageButtons) {
  button.addEventListener('click', () => {
    P.stage = button.dataset.proofStage;
    for (const b of stageButtons) b.classList.toggle('on', b === button);
    renderGraph();
  });
}
growthInput.addEventListener('input', () => {
  P.growth = Number(growthInput.value);
  renderGraph();
});
document.querySelector('#videoTeacherPlay').addEventListener('click', event => {
  playing = !playing;
  if (playing && P.growth >= 1) P.growth = 0;
  event.currentTarget.classList.toggle('on', playing);
  event.currentTarget.textContent = playing ? '暂停生长' : '播放生长';
});
document.querySelector('#videoTeacherFit').addEventListener('click', fitCamera);

window.addEventListener('resize', resize);
resize();
rebuild(true);
window.__videoTeacherProofReady = true;
window.VideoTeacherProofR01 = {
  setStage(stage) {
    if (!['targets', 'skeleton', 'thickness', 'surface'].includes(stage)) return;
    P.stage = stage;
    for (const b of stageButtons) b.classList.toggle('on', b.dataset.proofStage === stage);
    renderGraph();
  },
  setScore(score) {
    if (!['tree', 'coral'].includes(score)) return;
    P.score = score;
    for (const b of scoreButtons) b.classList.toggle('on', b.dataset.proofScore === score);
    rebuild(true);
  },
  setGrowth(value) {
    P.growth = clamp(Number(value) || 0, 0, 1);
    growthInput.value = String(P.growth);
    renderGraph();
  },
  getState() { return { params: { ...P }, signature: graph.signature }; },
};
document.documentElement.dataset.videoTeacherProof = 'ready';

(function animate(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (playing) {
    P.growth = Math.min(1, P.growth + dt * 0.16);
    growthInput.value = String(P.growth);
    renderGraph();
    if (P.growth >= 1) {
      playing = false;
      const button = document.querySelector('#videoTeacherPlay');
      button.classList.remove('on');
      button.textContent = '播放生长';
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
})(performance.now());
