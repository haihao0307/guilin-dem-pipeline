import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const rad = d => THREE.MathUtils.degToRad(d);
const up = new THREE.Vector3(0, 1, 0);

const P = {
  score: 'tree', density: 170, influence: 1.25, kill: 0.20, step: 0.23,
  split: 15, turn: 19, inertia: 0.86, space: 1.05, growth: 0.66,
  stage: 'allocation',
};

let seed = 82041;
let current = null;
let playing = false;
let autoRotate = false;
let lastTime = performance.now();
let buildTimer = 0;

const stage = $('stage');
const errorEl = $('error');
const infoEl = $('info');
const statusEl = $('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07100f);
scene.fog = new THREE.FogExp2(0x07100f, 0.028);

const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 80);
camera.position.set(7.2, 4.4, 8.6);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0, 1.2, 0);
controls.minDistance = 2.8;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.95;

scene.add(new THREE.HemisphereLight(0xc0ddd4, 0x24191a, 1.75));
const key = new THREE.DirectionalLight(0xe8fff8, 2.6);
key.position.set(6, 10, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff89b0, 0.82);
rim.position.set(-6, 3, -5);
scene.add(rim);

const grid = new THREE.GridHelper(12, 24, 0x2d453f, 0x152723);
grid.position.y = -2.25;
scene.add(grid);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(5.8, 64),
  new THREE.MeshStandardMaterial({ color: 0x13211e, roughness: 1, transparent: true, opacity: 0.36, side: THREE.DoubleSide })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.27;
scene.add(ground);

const branchGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
const sphereGeo = new THREE.SphereGeometry(1, 8, 6);
const branchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, metalness: 0 });
const tipMat = new THREE.MeshStandardMaterial({ color: 0xd25b89, emissive: 0x370716, emissiveIntensity: 0.34, roughness: 0.5 });
const splitMat = new THREE.MeshStandardMaterial({ color: 0xd9bc6e, emissive: 0x2d2105, emissiveIntensity: 0.22, roughness: 0.58 });
const MAX_SEGMENTS = 900;
const MAX_MARKERS = 240;
const branchMesh = new THREE.InstancedMesh(branchGeo, branchMat, MAX_SEGMENTS);
const tipMesh = new THREE.InstancedMesh(sphereGeo, tipMat, MAX_MARKERS);
const splitMesh = new THREE.InstancedMesh(sphereGeo, splitMat, MAX_MARKERS);
for (const mesh of [branchMesh, tipMesh, splitMesh]) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(branchMesh, tipMesh, splitMesh);

const aliveTargetMat = new THREE.PointsMaterial({ color: 0x6d94d0, size: 0.055, transparent: true, opacity: 0.66, sizeAttenuation: true });
const claimedTargetMat = new THREE.PointsMaterial({ color: 0x42575f, size: 0.031, transparent: true, opacity: 0.30, sizeAttenuation: true });
let aliveTargets = new THREE.Points(new THREE.BufferGeometry(), aliveTargetMat);
let claimedTargets = new THREE.Points(new THREE.BufferGeometry(), claimedTargetMat);
scene.add(aliveTargets, claimedTargets);

const territoryMat = new THREE.LineBasicMaterial({ color: 0x8aadd8, transparent: true, opacity: 0.52 });
let territoryLines = new THREE.LineSegments(new THREE.BufferGeometry(), territoryMat);
scene.add(territoryLines);

const tmp = new THREE.Object3D();
const yAxis = new THREE.Vector3(0, 1, 0);

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
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h / 4294967295;
}

function rotateToward(from, to, maxAngle) {
  const a = from.clone().normalize();
  const b = to.clone().normalize();
  const angle = a.angleTo(b);
  if (angle <= maxAngle || angle < 1e-6) return b;
  let axis = new THREE.Vector3().crossVectors(a, b);
  if (axis.lengthSq() < 1e-8) axis = new THREE.Vector3(1, 0, 0).cross(a);
  axis.normalize();
  return a.applyAxisAngle(axis, maxAngle).normalize();
}

function pointSegmentDistance(p, a, b) {
  const ab = b.clone().sub(a);
  const t = clamp(p.clone().sub(a).dot(ab) / Math.max(1e-8, ab.lengthSq()), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

function makeNode(p, dir, parent, order, birth, scaffold = false) {
  return { p: p.clone(), dir: dir.clone().normalize(), parent, order, birth, scaffold, children: [], load: 1 };
}

function addSegment(graph, aNode, bNode, birth, scaffold = false) {
  const segment = { a: graph.nodes[aNode].p.clone(), b: graph.nodes[bNode].p.clone(), from: aNode, to: bNode, birth, order: graph.nodes[bNode].order, scaffold, radius: 0.018 };
  graph.segments.push(segment);
  graph.nodes[aNode].children.push(bNode);
  return graph.segments.length - 1;
}

function buildScaffold() {
  const graph = { nodes: [], segments: [], initialTips: [], splitNodes: [], collisionRejects: 0, maxTurnObserved: 0, backwardSegments: 0 };
  const root = new THREE.Vector3(0, -2.08, 0);
  graph.nodes.push(makeNode(root, up, -1, 0, 0, true));
  let parent = 0;

  if (P.score === 'coral') {
    for (let i = 1; i <= 7; i++) {
      const p = new THREE.Vector3(0.025 * Math.sin(i * 0.55), -2.08 + i * 0.28, 0.02 * Math.cos(i * 0.41));
      const id = graph.nodes.length;
      graph.nodes.push(makeNode(p, p.clone().sub(graph.nodes[parent].p), parent, 0, 0, true));
      addSegment(graph, parent, id, 0, true); parent = id;
    }
    const base = graph.nodes[parent];
    for (const sign of [-1, 1]) {
      const dir = new THREE.Vector3(sign * 0.68, 0.72, sign * 0.04).normalize();
      graph.initialTips.push({ node: parent, p: base.p.clone(), dir, order: 1, age: 0, sinceSplit: 6, idle: 0, key: `C${sign}` });
    }
    graph.initialTips.push({ node: parent, p: base.p.clone(), dir: new THREE.Vector3(0, 1, 0.02).normalize(), order: 0, age: 0, sinceSplit: 6, idle: 0, key: 'CL' });
  } else {
    const trunkSteps = P.score === 'tree' ? 13 : 9;
    for (let i = 1; i <= trunkSteps; i++) {
      const y = -2.08 + i * 0.27;
      const p = new THREE.Vector3(0.045 * Math.sin(i * 0.38), y, 0.035 * Math.sin(i * 0.53));
      const id = graph.nodes.length;
      graph.nodes.push(makeNode(p, p.clone().sub(graph.nodes[parent].p), parent, 0, 0, true));
      addSegment(graph, parent, id, 0, true); parent = id;
    }
    const leader = graph.nodes[parent];
    graph.initialTips.push({ node: parent, p: leader.p.clone(), dir: leader.dir.clone(), order: 0, age: 0, sinceSplit: 8, idle: 0, key: 'TL' });

    const tiers = P.score === 'tree' ? [7, 9, 11, 12] : [5, 7, 8];
    tiers.forEach((nodeId, ti) => {
      const node = graph.nodes[Math.min(nodeId, graph.nodes.length - 1)];
      const count = ti % 2 ? 2 : 3;
      for (let j = 0; j < count; j++) {
        const az = ti * 1.67 + j * Math.PI * 2 / count;
        const dir = new THREE.Vector3(Math.cos(az) * 0.74, 0.55 + 0.10 * ti, Math.sin(az) * 0.74).normalize();
        graph.initialTips.push({ node: Math.min(nodeId, graph.nodes.length - 1), p: node.p.clone(), dir, order: 1, age: 0, sinceSplit: 6, idle: 0, key: `T${ti}-${j}` });
      }
    });
  }
  return graph;
}

function generateTargets() {
  const rng = rngFactory(seed + (P.score === 'tree' ? 11 : P.score === 'coral' ? 23 : 37));
  const targets = [];
  for (let i = 0; i < P.density; i++) {
    if (P.score === 'tree') {
      const y = 0.0 + Math.pow(rng(), 0.72) * 4.65;
      const yn = clamp(y / 4.65, 0, 1);
      const envelope = (0.48 + 2.0 * Math.sin(yn * Math.PI)) * Math.sqrt(rng());
      const az = rng() * Math.PI * 2;
      const lobe = 0.80 + 0.20 * Math.sin(az * 3 + y * 0.8);
      targets.push(new THREE.Vector3(Math.cos(az) * envelope * lobe, y, Math.sin(az) * envelope * 0.82));
    } else if (P.score === 'coral') {
      const y = -0.45 + Math.pow(rng(), 0.74) * 5.1;
      const yn = clamp((y + 0.45) / 5.1, 0, 1);
      const width = 0.35 + 2.75 * Math.pow(yn, 0.78);
      const x = (rng() * 2 - 1) * width * (0.72 + 0.28 * rng());
      const z = (rng() - 0.5) * 0.32 + 0.05 * Math.sin(x * 1.6 + y * 2.2);
      targets.push(new THREE.Vector3(x, y, z));
    } else {
      const y = -0.25 + Math.pow(rng(), 0.76) * 4.4;
      const az = rng() * Math.PI * 2;
      const r = (0.35 + 1.85 * Math.sin(clamp((y + 0.25) / 4.4, 0, 1) * Math.PI)) * Math.sqrt(rng());
      targets.push(new THREE.Vector3(Math.cos(az) * r, y, Math.sin(az) * r));
    }
  }
  return targets;
}

function targetAllowed(tip, target) {
  const v = target.clone().sub(tip.p);
  const len = v.length();
  if (len < 1e-6 || len > P.influence) return false;
  const dot = v.multiplyScalar(1 / len).dot(tip.dir);
  const minForward = tip.order === 0 ? 0.08 : (P.score === 'coral' ? 0.02 : 0.16);
  if (dot < minForward) return false;
  if (P.score === 'tree' && tip.order > 0 && target.y < tip.p.y - 0.32) return false;
  return true;
}

function allocateTargets(targets, alive, active) {
  const assignments = new Map();
  for (const id of alive) {
    const target = targets[id];
    let winner = -1;
    let best = Infinity;
    for (let i = 0; i < active.length; i++) {
      const tip = active[i];
      if (!targetAllowed(tip, target)) continue;
      const v = target.clone().sub(tip.p);
      const len = v.length();
      const forward = clamp(v.normalize().dot(tip.dir), 0.01, 1);
      const cost = len / (0.42 + forward);
      if (cost < best) { best = cost; winner = i; }
    }
    if (winner >= 0) {
      if (!assignments.has(winner)) assignments.set(winner, []);
      assignments.get(winner).push(id);
    }
  }
  return assignments;
}

function averageDir(ids, targets, origin) {
  const sum = new THREE.Vector3();
  for (const id of ids) sum.add(targets[id].clone().sub(origin).normalize());
  return sum.lengthSq() ? sum.normalize() : up.clone();
}

function splitGroups(ids, targets, tip) {
  if (ids.length < P.split || tip.sinceSplit < 5 || tip.order >= (P.score === 'coral' ? 4 : 3)) return null;
  const dirs = ids.map(id => ({ id, d: targets[id].clone().sub(tip.p).normalize() }));
  let a = dirs[0].d.clone(), b = dirs[0].d.clone(), minDot = 1;
  for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) {
    const dot = dirs[i].d.dot(dirs[j].d);
    if (dot < minDot) { minDot = dot; a = dirs[i].d.clone(); b = dirs[j].d.clone(); }
  }
  for (let iter = 0; iter < 5; iter++) {
    const A = [], B = [];
    for (const item of dirs) (item.d.dot(a) >= item.d.dot(b) ? A : B).push(item);
    if (!A.length || !B.length) return null;
    a.set(0, 0, 0); b.set(0, 0, 0);
    A.forEach(x => a.add(x.d)); B.forEach(x => b.add(x.d)); a.normalize(); b.normalize();
  }
  const A = [], B = [];
  for (const item of dirs) (item.d.dot(a) >= item.d.dot(b) ? A : B).push(item.id);
  const minGroup = Math.max(4, Math.floor(P.split * 0.28));
  const minAngle = P.score === 'coral' ? rad(22) : rad(29);
  if (A.length < minGroup || B.length < minGroup || a.angleTo(b) < minAngle) return null;
  return [A, B];
}

function fieldDirection(tip) {
  if (P.score === 'tree') {
    const radial = new THREE.Vector3(tip.p.x, 0, tip.p.z);
    if (radial.lengthSq()) radial.normalize();
    return up.clone().multiplyScalar(tip.order === 0 ? 1 : 0.34).addScaledVector(radial, tip.order ? 0.22 : 0.02).normalize();
  }
  if (P.score === 'coral') {
    const outward = new THREE.Vector3(Math.sign(tip.p.x || 1), 0.28, -tip.p.z * 1.7);
    return outward.lengthSq() ? outward.normalize() : up.clone();
  }
  return up.clone().multiplyScalar(0.35).add(tip.dir.clone().multiplyScalar(0.15)).normalize();
}

function avoidanceDirection(p, graph) {
  const repel = new THREE.Vector3();
  const radius = Math.max(0.25, P.step * 1.45);
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = p.clone().sub(graph.nodes[i].p);
    const len = d.length();
    if (len > 1e-5 && len < radius) {
      const w = (radius - len) / radius;
      repel.addScaledVector(d.multiplyScalar(1 / len), w * w);
    }
  }
  return repel.lengthSq() ? repel.normalize() : repel;
}

function ancestorSet(nodeId, graph, count = 6) {
  const set = new Set();
  let id = nodeId;
  for (let i = 0; i < count && id >= 0; i++) { set.add(id); id = graph.nodes[id].parent; }
  return set;
}

function candidateClear(a, b, parentNode, graph) {
  const ignore = ancestorSet(parentNode, graph, 8);
  const clearance = Math.max(0.105, P.step * 0.48);
  const samples = [a.clone().lerp(b, 0.34), a.clone().lerp(b, 0.68), b];
  for (const sample of samples) {
    for (let i = 0; i < graph.segments.length; i++) {
      const s = graph.segments[i];
      if (ignore.has(s.from) || ignore.has(s.to)) continue;
      if (pointSegmentDistance(sample, s.a, s.b) < clearance) return false;
    }
  }
  return true;
}

function constrainedDirection(tip, desired, maxTurn, graph) {
  let dir = rotateToward(tip.dir, desired, maxTurn);
  if (P.score === 'tree') {
    if (tip.order === 0 && dir.y < 0.48) dir = rotateToward(dir, up, rad(18));
    if (tip.order > 0 && dir.y < -0.18) dir.y = -0.18;
  }
  if (P.score === 'coral') dir.z *= 0.22;
  dir.normalize();

  const attempts = [0, rad(10), -rad(10), rad(18), -rad(18)];
  for (const angle of attempts) {
    const test = dir.clone();
    if (angle) {
      let axis = new THREE.Vector3().crossVectors(tip.dir, up);
      if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
      test.applyAxisAngle(axis.normalize(), angle).normalize();
    }
    const end = tip.p.clone().addScaledVector(test, P.step);
    if (P.score === 'tree' && tip.order > 0) {
      const r0 = Math.hypot(tip.p.x, tip.p.z), r1 = Math.hypot(end.x, end.z);
      if (r1 < r0 - 0.10) continue;
    }
    if (candidateClear(tip.p, end, tip.node, graph)) return { dir: test, end };
  }
  graph.collisionRejects += 1;
  return null;
}

function makeAllocationSnapshot(active, assignments, targets) {
  const rays = [];
  for (const [tipIndex, ids] of assignments.entries()) {
    const tip = active[tipIndex];
    const step = Math.max(1, Math.floor(ids.length / 3));
    for (let i = 0; i < ids.length && rays.length < 180; i += step) {
      rays.push({ a: tip.p.clone(), b: targets[ids[i]].clone() });
      if (i + step >= ids.length) break;
    }
  }
  return { rays, tipPositions: active.map(t => t.p.clone()) };
}

function growGraph() {
  const graph = buildScaffold();
  const targets = generateTargets();
  const alive = new Set(targets.map((_, i) => i));
  const claimed = new Set();
  let active = graph.initialTips.map(t => ({ ...t, p: t.p.clone(), dir: t.dir.clone() }));
  let splitCount = 0;
  let maxBirth = 0;
  let allocationSnapshot = null;

  for (let iteration = 1; iteration <= 150 && active.length && graph.segments.length < MAX_SEGMENTS; iteration++) {
    maxBirth = iteration;
    const killIds = [];
    for (const id of alive) {
      const target = targets[id];
      let hit = false;
      for (const tip of active) if (target.distanceTo(tip.p) < P.kill) { hit = true; break; }
      if (!hit) {
        for (let i = Math.max(0, graph.segments.length - 220); i < graph.segments.length; i++) {
          const s = graph.segments[i];
          if (pointSegmentDistance(target, s.a, s.b) < P.kill * 0.72) { hit = true; break; }
        }
      }
      if (hit) killIds.push(id);
    }
    killIds.forEach(id => { alive.delete(id); claimed.add(id); });

    const assignments = allocateTargets(targets, alive, active);
    if (!allocationSnapshot || (iteration >= 9 && allocationSnapshot.rays.length < 16)) allocationSnapshot = makeAllocationSnapshot(active, assignments, targets);

    const next = [];
    for (let ti = 0; ti < active.length; ti++) {
      const tip = active[ti];
      const ids = assignments.get(ti) || [];
      if (!ids.length) {
        tip.idle += 1;
        if (tip.idle < 3 && tip.age < 8) next.push(tip);
        continue;
      }
      tip.idle = 0;
      const split = splitGroups(ids, targets, tip);
      const groups = split || [ids];
      if (split) { splitCount += 1; graph.splitNodes.push(tip.node); }

      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        const avg = averageDir(group, targets, tip.p);
        const field = fieldDirection(tip);
        const avoid = avoidanceDirection(tip.p, graph);
        const desired = avg.clone().multiplyScalar(1.0)
          .addScaledVector(tip.dir, P.inertia)
          .addScaledVector(field, tip.order === 0 ? 0.48 : 0.22)
          .addScaledVector(avoid, P.space)
          .normalize();
        const allowedTurn = rad(P.turn * (split ? 1.32 : 1));
        const candidate = constrainedDirection(tip, desired, allowedTurn, graph);
        if (!candidate) continue;
        const turn = tip.dir.angleTo(candidate.dir);
        graph.maxTurnObserved = Math.max(graph.maxTurnObserved, turn);
        if (tip.dir.dot(candidate.dir) < 0) graph.backwardSegments += 1;

        const order = split ? Math.min(4, tip.order + 1) : tip.order;
        const nodeId = graph.nodes.length;
        graph.nodes.push(makeNode(candidate.end, candidate.dir, tip.node, order, iteration, false));
        addSegment(graph, tip.node, nodeId, iteration, false);
        next.push({ node: nodeId, p: candidate.end.clone(), dir: candidate.dir.clone(), order, age: tip.age + 1, sinceSplit: split ? 0 : tip.sinceSplit + 1, idle: 0, key: `${tip.key}.${gi}.${iteration}` });
      }
    }
    active = next.slice(0, 72);
    if (!alive.size) break;
  }

  for (let i = graph.nodes.length - 1; i > 0; i--) {
    const parent = graph.nodes[i].parent;
    if (parent >= 0) graph.nodes[parent].load += graph.nodes[i].load;
  }
  const rootLoad = Math.max(1, graph.nodes[0].load);
  for (const s of graph.segments) {
    const load = graph.nodes[s.to].load;
    const orderFactor = 1 - 0.08 * Math.min(s.order, 4);
    s.radius = s.scaffold ? (0.034 + 0.115 * Math.pow(load / rootLoad, 0.42)) : (0.012 + 0.085 * Math.pow(load / rootLoad, 0.43)) * orderFactor;
  }

  const orderCounts = {};
  graph.segments.forEach(s => { orderCounts[s.order] = (orderCounts[s.order] || 0) + 1; });
  graph.targets = targets;
  graph.alive = alive;
  graph.claimed = claimed;
  graph.active = active;
  graph.splitCount = splitCount;
  graph.maxBirth = maxBirth;
  graph.allocationSnapshot = allocationSnapshot || { rays: [], tipPositions: [] };
  graph.signature = {
    schema: 'KAOPU.branch-growth-hybrid-teacher/2',
    score: P.score,
    targetCount: targets.length,
    claimedTargets: claimed.size,
    segmentCount: graph.segments.length,
    activeTips: active.length,
    splitCount,
    maxOrder: Math.max(...graph.segments.map(s => s.order), 0),
    orderCounts,
    maxTurnDeg: Number(THREE.MathUtils.radToDeg(graph.maxTurnObserved).toFixed(2)),
    backwardSegments: graph.backwardSegments,
    collisionRejects: graph.collisionRejects,
    direct3D: true,
    scaffoldFirst: true,
    targetAllocation: true,
    forwardCone: true,
    boundedTurn: true,
    selfAvoidance: true,
    realBranchSplits: splitCount > 0,
    loadBackPropagation: true,
    stagedLearningVisible: true,
    cameraAffectsGeneration: false,
    teacherLayer: true,
    runtimeTruth: false,
    sharedWithCoral: true,
    speciesAssigned: false,
    r01Retired: true,
  };
  return graph;
}

function setCylinder(index, a, b, radius, color) {
  const dir = b.clone().sub(a);
  const length = Math.max(1e-5, dir.length());
  tmp.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.quaternion.setFromUnitVectors(yAxis, dir.normalize());
  tmp.scale.set(radius, length, radius);
  tmp.updateMatrix();
  branchMesh.setMatrixAt(index, tmp.matrix);
  branchMesh.setColorAt(index, color);
}

function setSphere(mesh, index, p, radius) {
  tmp.position.copy(p);
  tmp.quaternion.identity();
  tmp.scale.setScalar(radius);
  tmp.updateMatrix();
  mesh.setMatrixAt(index, tmp.matrix);
}

function segmentColor(segment) {
  if (segment.scaffold || segment.order === 0) return new THREE.Color(0xb8c4a8);
  if (segment.order === 1) return new THREE.Color(0x55cbbb);
  if (segment.order === 2) return new THREE.Color(0x6baaa0);
  return new THREE.Color(0x537d76);
}

function replacePoints(pointsObject, vectors) {
  pointsObject.geometry.dispose();
  const arr = [];
  vectors.forEach(p => arr.push(p.x, p.y, p.z));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  pointsObject.geometry = g;
}

function updateTargetVisuals() {
  if (!current) return;
  replacePoints(aliveTargets, [...current.alive].map(id => current.targets[id]));
  replacePoints(claimedTargets, [...current.claimed].map(id => current.targets[id]));
  const showField = P.stage === 'field' || P.stage === 'allocation';
  aliveTargets.visible = showField;
  claimedTargets.visible = showField;
}

function updateTerritories() {
  const arr = [];
  if (current && P.stage === 'allocation') {
    for (const ray of current.allocationSnapshot.rays) arr.push(ray.a.x, ray.a.y, ray.a.z, ray.b.x, ray.b.y, ray.b.z);
  }
  territoryLines.geometry.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  territoryLines.geometry = g;
  territoryLines.visible = P.stage === 'allocation';
}

function visibleBirthLimit() {
  if (!current) return 0;
  if (P.stage === 'field') return 0;
  if (P.stage === 'allocation') return Math.max(5, Math.floor(current.maxBirth * clamp(P.growth, 0.25, 0.72)));
  return Math.floor(current.maxBirth * P.growth);
}

function updateMeshes() {
  if (!current) return;
  const limit = visibleBirthLimit();
  let count = 0;
  const visibleTo = new Set();
  for (const s of current.segments) {
    if (P.stage === 'field' && !s.scaffold) continue;
    if (!s.scaffold && s.birth > limit) continue;
    if (count >= MAX_SEGMENTS) break;
    const loadMode = P.stage === 'load';
    const radius = loadMode ? s.radius : (s.scaffold ? 0.030 : 0.0155);
    setCylinder(count++, s.a, s.b, radius, segmentColor(s));
    visibleTo.add(s.to);
  }
  branchMesh.count = count;
  branchMesh.instanceMatrix.needsUpdate = true;
  if (branchMesh.instanceColor) branchMesh.instanceColor.needsUpdate = true;

  const visibleChildren = new Set();
  for (const s of current.segments) if ((s.scaffold || s.birth <= limit) && visibleTo.has(s.to)) visibleChildren.add(s.from);
  let tipCount = 0;
  for (const id of visibleTo) {
    if (!visibleChildren.has(id) && tipCount < MAX_MARKERS && P.stage !== 'field') setSphere(tipMesh, tipCount++, current.nodes[id].p, 0.046);
  }
  tipMesh.count = tipCount;
  tipMesh.instanceMatrix.needsUpdate = true;
  tipMesh.visible = P.stage === 'allocation' || P.stage === 'skeleton';

  let splitCount = 0;
  for (const id of current.splitNodes) {
    const node = current.nodes[id];
    if (node.birth <= limit && splitCount < MAX_MARKERS) setSphere(splitMesh, splitCount++, node.p, 0.052);
  }
  splitMesh.count = splitCount;
  splitMesh.instanceMatrix.needsUpdate = true;
  splitMesh.visible = P.stage === 'skeleton' || P.stage === 'load';

  updateTargetVisuals();
  updateTerritories();
  $('growthO').textContent = `${Math.round(P.growth * 100)}%`;
  infoEl.textContent = `${count} 可见段 · ${current.signature.splitCount} 次真实 Split · MaxTurn ${current.signature.maxTurnDeg}° · Backward ${current.signature.backwardSegments}`;
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

function stageText() {
  if (P.stage === 'field') return '① 目标场：只看主轴/基底与 Supply / Opportunity Field。目标点是环境样本，不是最终枝条，也不是“食物真相”。';
  if (P.stage === 'allocation') return '② 目标分配：蓝色 Territory 线显示多个 Active Tips 在生长前先瓜分前向目标；看得见的新知识就在这里，不再把最终乱线当成学习结果。';
  if (P.stage === 'skeleton') return '③ 分枝骨架：隐藏目标场，检查主轴、层级、Split Node、最大转角和自避让。R02 禁止回头段与全空间乱窜。';
  return '④ 负载粗细：从末端向基部反传下游 Load，粗细最后才出现；不能每层机械乘一个常数，也不能用粗细掩盖错误拓扑。';
}

function updateOutputs() {
  $('scoreO').textContent = P.score;
  $('densityO').textContent = String(P.density);
  $('influenceO').textContent = P.influence.toFixed(2);
  $('killO').textContent = P.kill.toFixed(2);
  $('stepO').textContent = P.step.toFixed(2);
  $('splitO').textContent = String(P.split);
  $('turnO').textContent = `${P.turn}°`;
  $('inertiaO').textContent = P.inertia.toFixed(2);
  $('spaceO').textContent = P.space.toFixed(2);
  $('growthO').textContent = `${Math.round(P.growth * 100)}%`;
}

function rebuild(fit = false) {
  current = growGraph();
  updateOutputs();
  updateMeshes();
  $('segBadge').textContent = `Segment ${current.signature.segmentCount}`;
  $('targetBadge').textContent = `Target ${current.signature.targetCount}`;
  $('tipBadge').textContent = `Tip ${current.signature.activeTips}`;
  $('splitBadge').textContent = `Split ${current.signature.splitCount}`;
  $('turnBadge').textContent = `Turn ${current.signature.maxTurnDeg}°`;
  statusEl.textContent = `${stageText()} 当前：Order ${current.signature.maxOrder}；Collision reject ${current.signature.collisionRejects}；Backward ${current.signature.backwardSegments}。R01 神经错乱曲不进入知识体系。`;
  window.__branchGrowthTeacherR02Signature = current.signature;
  if (fit) requestAnimationFrame(fitGraph);
}

function setStage(value) {
  P.stage = value;
  document.querySelectorAll('[data-stage]').forEach(button => button.classList.toggle('on', button.dataset.stage === value));
  if (value === 'field') P.growth = 0.20;
  if (value === 'allocation') P.growth = 0.58;
  if (value === 'skeleton' || value === 'load') P.growth = 1;
  $('growth').value = String(P.growth);
  updateMeshes();
  statusEl.textContent = `${stageText()} 当前：Order ${current.signature.maxOrder}；Collision reject ${current.signature.collisionRejects}；Backward ${current.signature.backwardSegments}。`;
}

document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => setStage(button.dataset.stage)));
let timer = 0;
function schedule() { clearTimeout(timer); timer = setTimeout(() => rebuild(false), 100); }
function bindRange(id, key, parse = Number) { $(id).addEventListener('input', event => { P[key] = parse(event.target.value); if (key === 'growth') updateMeshes(); else schedule(); }); }
$('score').addEventListener('change', event => { P.score = event.target.value; rebuild(true); });
bindRange('density', 'density', v => parseInt(v, 10));
bindRange('influence', 'influence');
bindRange('kill', 'kill');
bindRange('step', 'step');
bindRange('split', 'split', v => parseInt(v, 10));
bindRange('turn', 'turn', v => parseInt(v, 10));
bindRange('inertia', 'inertia');
bindRange('space', 'space');
bindRange('growth', 'growth');

$('fit').addEventListener('click', fitGraph);
$('front').addEventListener('click', () => { camera.position.set(0, 1.2, 10); controls.target.set(0, 1.1, 0); controls.update(); });
$('side').addEventListener('click', () => { camera.position.set(10, 1.2, 0); controls.target.set(0, 1.1, 0); controls.update(); });
$('rebuild').addEventListener('click', () => { seed += 137; rebuild(true); });
$('auto').addEventListener('click', () => { autoRotate = !autoRotate; controls.autoRotate = autoRotate; controls.autoRotateSpeed = 0.58; $('auto').classList.toggle('on', autoRotate); });
$('play').addEventListener('click', () => {
  playing = !playing;
  if (playing) { P.stage = 'skeleton'; document.querySelectorAll('[data-stage]').forEach(b => b.classList.toggle('on', b.dataset.stage === 'skeleton')); P.growth = 0; }
  $('play').classList.toggle('on', playing);
  $('play').textContent = playing ? '暂停生长' : '播放生长';
  $('growth').value = String(P.growth);
  updateMeshes();
});

function resize() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

try {
  rebuild(true);
  setStage('allocation');
  window.__branchGrowthTeacherR02Ready = true;
  window.BranchGrowthTeacherR02 = {
    rebuild: () => rebuild(false),
    fit: fitGraph,
    setStage,
    setScore(value) { if (!['tree', 'coral', 'neutral'].includes(value)) return; P.score = value; $('score').value = value; rebuild(true); },
    setGrowth(value) { P.growth = clamp(Number(value) || 0, 0, 1); $('growth').value = String(P.growth); updateMeshes(); },
    getState() { return { params: { ...P }, signature: current?.signature || null, playing, autoRotate }; },
  };
  document.documentElement.dataset.ready = 'true';
  (function animate(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (playing) {
      P.growth = Math.min(1, P.growth + dt * 0.16);
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
