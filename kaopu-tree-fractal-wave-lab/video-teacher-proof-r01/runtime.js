import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (d) => THREE.MathUtils.degToRad(d);
const up = new THREE.Vector3(0, 1, 0);

const P = { score: 'coral', growth: 1, width: 1, depth: 0.58, spread: 0.92, terminal: 3, thickness: 0.92 };
let mode = 'surface';
let playing = false;
let autoRotate = false;
let lastTime = performance.now();
let rebuildTimer = 0;
let current = null;

const stage = $('stage');
const errorEl = $('error');
const evidence = $('evidence');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07100f);
scene.fog = new THREE.FogExp2(0x07100f, 0.038);

const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 80);
camera.position.set(6.4, 3.8, 7.6);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stage.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0, 0.8, 0);
controls.minDistance = 2.6;
controls.maxDistance = 24;
controls.maxPolarAngle = Math.PI * 0.95;

scene.add(new THREE.HemisphereLight(0xc7ddd6, 0x281b1c, 1.8));
const key = new THREE.DirectionalLight(0xe8fff8, 2.7);
key.position.set(5, 9, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff93bb, 0.9);
rim.position.set(-5, 3, -4);
scene.add(rim);

const grid = new THREE.GridHelper(11, 22, 0x2d443e, 0x152723);
grid.position.y = -2.31;
scene.add(grid);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(5.4, 64),
  new THREE.MeshStandardMaterial({ color: 0x13211e, roughness: 1, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.33;
scene.add(ground);

const fieldMat = new THREE.PointsMaterial({ color: 0x6d95c9, size: 0.04, transparent: true, opacity: 0.58, sizeAttenuation: true });
let fieldPoints = new THREE.Points(new THREE.BufferGeometry(), fieldMat);
scene.add(fieldPoints);

const skeletonMat = new THREE.LineBasicMaterial({ color: 0xd6e0dc, transparent: true, opacity: 0.9 });
let skeletonLines = new THREE.LineSegments(new THREE.BufferGeometry(), skeletonMat);
scene.add(skeletonLines);

const branchGeo = new THREE.CylinderGeometry(1, 1, 1, 9, 1, false);
const collarGeo = new THREE.SphereGeometry(1, 10, 7);
const terminalGeo = new THREE.SphereGeometry(1, 12, 8);
const thicknessMat = new THREE.MeshStandardMaterial({ color: 0x6ed3c2, roughness: 0.72, metalness: 0 });
const surfaceMat = new THREE.MeshPhysicalMaterial({ color: 0xd9d6cf, roughness: 0.48, metalness: 0, clearcoat: 0.16, clearcoatRoughness: 0.72 });
const terminalMat = new THREE.MeshPhysicalMaterial({ color: 0xda7698, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.62 });
const MAX_EDGES = 1200;
const MAX_NODES = 900;
const branchMesh = new THREE.InstancedMesh(branchGeo, surfaceMat, MAX_EDGES);
const collarMesh = new THREE.InstancedMesh(collarGeo, surfaceMat, MAX_NODES);
const terminalMesh = new THREE.InstancedMesh(terminalGeo, terminalMat, MAX_NODES);
for (const mesh of [branchMesh, collarMesh, terminalMesh]) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(branchMesh, collarMesh, terminalMesh);

const tmp = new THREE.Object3D();
const yAxis = new THREE.Vector3(0, 1, 0);

function hash01(text) {
  let h = 2166136261 >>> 0;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h / 4294967295;
}

function makeNode(p, parent = -1, depth = 0, birth = 0, order = 0) {
  return { p: p.clone(), parent, depth, birth, order, children: [], support: 1, terminal: true };
}

function insideEnvelope(score, p) {
  if (score === 'coral') {
    const y = p.y + 2.0;
    if (y < 0 || y > 6.0) return false;
    const half = (0.45 + 0.52 * y) * P.width;
    const depth = (0.32 + 0.08 * y) * P.depth;
    return Math.abs(p.x) <= half && Math.abs(p.z) <= depth;
  }
  const y = p.y + 2.1;
  if (y < 0 || y > 6.2) return false;
  const crown = y < 1.9 ? 0.45 : (0.6 + 1.2 * Math.sin(clamp((y - 1.5) / 4.8, 0, 1) * Math.PI)) * P.width;
  return Math.hypot(p.x, p.z / Math.max(0.25, P.depth)) <= crown;
}

function nearExisting(p, nodes, minDist, ignoreIndex = -1) {
  for (let i = 0; i < nodes.length; i += 1) {
    if (i === ignoreIndex) continue;
    if (p.distanceToSquared(nodes[i].p) < minDist * minDist) return true;
  }
  return false;
}

function addEdge(graph, parentIndex, childPos, birth, order) {
  if (!insideEnvelope(graph.score, childPos)) { graph.stops.envelope += 1; return -1; }
  if (nearExisting(childPos, graph.nodes, order >= 3 ? 0.14 : 0.22, parentIndex)) { graph.stops.space += 1; return -1; }
  const child = makeNode(childPos, parentIndex, graph.nodes[parentIndex].depth + 1, birth, order);
  const childIndex = graph.nodes.length;
  graph.nodes.push(child);
  graph.nodes[parentIndex].children.push(childIndex);
  graph.nodes[parentIndex].terminal = false;
  graph.edges.push({ a: parentIndex, b: childIndex, birth, order });
  return childIndex;
}

function growBranch(graph, nodeIndex, direction, length, depthLeft, order, phase, birthBase) {
  if (depthLeft <= 0 || graph.edges.length >= MAX_EDGES - 8) return;
  const start = graph.nodes[nodeIndex].p;
  const bend = new THREE.Vector3(
    Math.sin(phase * 1.73 + depthLeft) * 0.06,
    graph.score === 'coral' ? 0.08 : 0.13,
    Math.cos(phase * 1.29 + depthLeft) * 0.045 * P.depth
  );
  const dir = direction.clone().add(bend).normalize();
  const nextPos = start.clone().addScaledVector(dir, length);
  const birth = birthBase + (5 - depthLeft) * 0.075;
  const next = addEdge(graph, nodeIndex, nextPos, birth, order);
  if (next < 0) return;

  const nextLength = length * (graph.score === 'coral' ? 0.69 : 0.67);
  growBranch(graph, next, dir, nextLength, depthLeft - 1, order, phase + 0.37, birthBase);

  if (depthLeft >= 2) {
    const sideCount = depthLeft >= 4 ? 2 : 1;
    for (let s = 0; s < sideCount; s += 1) {
      const sign = s === 0 ? -1 : 1;
      const axis = graph.score === 'coral' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const angle = rad((graph.score === 'coral' ? 28 : 34) * P.spread) * sign;
      const sideDir = dir.clone().applyAxisAngle(axis, angle);
      if (graph.score === 'tree') sideDir.applyAxisAngle(dir, (phase + s * 1.7) % (Math.PI * 2));
      else sideDir.z += (hash01(`${phase}:${s}:z`) - 0.5) * 0.08 * P.depth;
      sideDir.normalize();
      growBranch(graph, next, sideDir, nextLength * 0.9, depthLeft - 2, order + 1, phase + 1.1 + s, birthBase + 0.06);
    }
  }
}

function buildGraph(score) {
  const graph = { score, nodes: [], edges: [], terminals: [], stops: { envelope: 0, space: 0 } };
  const root = makeNode(new THREE.Vector3(0, -2.28, 0), -1, 0, 0, 0);
  graph.nodes.push(root);

  if (score === 'coral') {
    let current = 0;
    for (let i = 0; i < 4; i += 1) {
      const next = addEdge(graph, current, graph.nodes[current].p.clone().add(new THREE.Vector3(0, 0.48, 0)), 0.05 + i * 0.04, 0);
      if (next < 0) break;
      current = next;
    }
    const roots = 7;
    for (let i = 0; i < roots; i += 1) {
      const u = (i / (roots - 1)) * 2 - 1;
      const angle = rad(u * 54 * P.spread);
      const dir = new THREE.Vector3(Math.sin(angle), Math.cos(angle) * 0.78 + 0.35, (hash01(`coral:${i}:z`) - 0.5) * 0.12 * P.depth).normalize();
      growBranch(graph, current, dir, 0.72 + 0.08 * (1 - Math.abs(u)), 5, 1, i * 0.77, 0.22 + i * 0.012);
    }
  } else {
    let trunk = 0;
    const trunkNodes = [0];
    for (let i = 0; i < 8; i += 1) {
      const drift = new THREE.Vector3(Math.sin(i * 0.72) * 0.025, 0.56, Math.cos(i * 0.63) * 0.018 * P.depth);
      const next = addEdge(graph, trunk, graph.nodes[trunk].p.clone().add(drift), 0.04 + i * 0.045, 0);
      if (next < 0) break;
      trunk = next;
      trunkNodes.push(next);
    }
    const tiers = [2, 3, 4, 5, 6, 7];
    tiers.forEach((tier, i) => {
      const parent = trunkNodes[Math.min(tier, trunkNodes.length - 1)];
      const az = i * 2.399963;
      const dir = new THREE.Vector3(Math.cos(az) * 0.78 * P.spread, 0.48, Math.sin(az) * 0.78 * P.depth).normalize();
      growBranch(graph, parent, dir, 0.66, 4, 1, az, 0.25 + i * 0.025);
    });
  }

  for (let i = graph.nodes.length - 1; i >= 0; i -= 1) {
    const node = graph.nodes[i];
    let support = node.terminal ? 1 : 0.65;
    for (const child of node.children) support += graph.nodes[child].support;
    node.support = support;
    if (node.terminal && node.parent >= 0) graph.terminals.push(i);
  }
  const rootSupport = Math.max(1, graph.nodes[0].support);
  for (const edge of graph.edges) {
    const child = graph.nodes[edge.b];
    const ratio = child.support / rootSupport;
    edge.radius = (0.014 + 0.105 * Math.pow(ratio, 0.44)) * P.thickness;
  }
  graph.maxBirth = Math.max(0.1, ...graph.edges.map((e) => e.birth));
  graph.signature = {
    schema: 'KAOPU.video-teacher-proof/1',
    score,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    terminalCount: graph.terminals.length,
    stopEnvelope: graph.stops.envelope,
    stopSpace: graph.stops.space,
    acyclicParentGraph: graph.edges.every((e) => e.a < e.b),
    direct3D: true,
    stageSeparation: true,
    targetFieldIsConditionNotGeometry: true,
    growthChangesVisibleTopology: true,
    teacherEvidenceOnly: true,
    baseline: 'Native 3D R02/R03 reset',
    retiredVersionsImported: false
  };
  return graph;
}

function generateField(score) {
  const points = [];
  const count = score === 'coral' ? 420 : 360;
  for (let i = 0; i < count; i += 1) {
    const y = -1.9 + hash01(`${score}:${i}:y`) * 5.6;
    if (score === 'coral') {
      const half = (0.42 + 0.5 * (y + 1.9)) * P.width;
      const x = (hash01(`${score}:${i}:x`) * 2 - 1) * half;
      const z = (hash01(`${score}:${i}:z`) * 2 - 1) * (0.28 + 0.08 * (y + 1.9)) * P.depth;
      points.push(x, y, z);
    } else {
      const h = clamp((y + 1.9) / 5.6, 0, 1);
      const r = (0.35 + 1.15 * Math.sin(h * Math.PI)) * P.width * Math.sqrt(hash01(`${score}:${i}:r`));
      const a = hash01(`${score}:${i}:a`) * Math.PI * 2;
      points.push(Math.cos(a) * r, y, Math.sin(a) * r * P.depth);
    }
  }
  return points;
}

function replaceGeometry(object, geometry) {
  object.geometry.dispose();
  object.geometry = geometry;
}

function updateField() {
  const arr = generateField(P.score);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  replaceGeometry(fieldPoints, geometry);
}

function updateSkeleton(graph, visibleEdges) {
  const arr = [];
  for (const edge of visibleEdges) {
    const a = graph.nodes[edge.a].p;
    const b = graph.nodes[edge.b].p;
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  replaceGeometry(skeletonLines, geometry);
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

function setSphere(mesh, index, p, scale) {
  tmp.position.copy(p);
  tmp.quaternion.identity();
  tmp.scale.copy(scale);
  tmp.updateMatrix();
  mesh.setMatrixAt(index, tmp.matrix);
}

function stageFlags() {
  return {
    field: mode === 'field',
    skeleton: mode === 'skeleton',
    thickness: mode === 'thickness',
    terminal: mode === 'terminal',
    surface: mode === 'surface'
  };
}

function renderStage() {
  if (!current) return;
  const threshold = P.growth * current.maxBirth;
  const visibleEdges = current.edges.filter((e) => e.birth <= threshold);
  const visibleNodes = new Set([0]);
  for (const edge of visibleEdges) { visibleNodes.add(edge.a); visibleNodes.add(edge.b); }
  const flags = stageFlags();

  fieldPoints.visible = flags.field;
  skeletonLines.visible = flags.skeleton || flags.field;
  branchMesh.visible = flags.thickness || flags.terminal || flags.surface;
  collarMesh.visible = flags.surface;
  terminalMesh.visible = flags.terminal || flags.surface;

  updateSkeleton(current, visibleEdges);
  branchMesh.material = flags.surface ? surfaceMat : thicknessMat;
  collarMesh.material = flags.surface ? surfaceMat : thicknessMat;

  let edgeCount = 0;
  for (const edge of visibleEdges) {
    if (edgeCount >= MAX_EDGES) break;
    const a = current.nodes[edge.a].p;
    const b = current.nodes[edge.b].p;
    const radius = flags.thickness ? edge.radius * 0.92 : edge.radius;
    setCylinder(edgeCount++, a, b, Math.max(0.008, radius));
  }
  branchMesh.count = edgeCount;
  branchMesh.instanceMatrix.needsUpdate = true;

  let collarCount = 0;
  if (flags.surface) {
    const incoming = new Map(current.edges.map((edge) => [edge.b, edge]));
    for (let i = 0; i < current.nodes.length && collarCount < MAX_NODES; i += 1) {
      if (!visibleNodes.has(i)) continue;
      const node = current.nodes[i];
      if (node.parent < 0 || node.terminal) continue;
      const parentEdge = incoming.get(i);
      const r = parentEdge ? parentEdge.radius * 1.08 : 0.03;
      setSphere(collarMesh, collarCount++, node.p, new THREE.Vector3(r, r, r));
    }
  }
  collarMesh.count = collarCount;
  collarMesh.instanceMatrix.needsUpdate = true;

  let tipCount = 0;
  const perTerminal = Math.max(1, P.terminal | 0);
  for (const terminalIndex of current.terminals) {
    if (!visibleNodes.has(terminalIndex) || tipCount >= MAX_NODES - 4) continue;
    const node = current.nodes[terminalIndex];
    const parent = current.nodes[node.parent];
    const dir = node.p.clone().sub(parent.p).normalize();
    for (let j = 0; j < perTerminal && tipCount < MAX_NODES; j += 1) {
      const tangent = new THREE.Vector3(-dir.y, dir.x, dir.z * 0.3).normalize();
      const offset = tangent.multiplyScalar((j - (perTerminal - 1) * 0.5) * 0.035);
      const pos = node.p.clone().add(offset).addScaledVector(dir, 0.035 * j);
      const base = current.score === 'coral' ? 0.065 : 0.035;
      const scale = current.score === 'coral'
        ? new THREE.Vector3(base * 0.78, base * 1.55, base * 0.88)
        : new THREE.Vector3(base, base * 1.6, base);
      setSphere(terminalMesh, tipCount++, pos, scale);
    }
  }
  terminalMesh.count = tipCount;
  terminalMesh.instanceMatrix.needsUpdate = true;

  $('segmentBadge').textContent = `Segment ${visibleEdges.length}/${current.edges.length}`;
  $('tipBadge').textContent = `Terminal ${tipCount}`;
  $('fieldBadge').textContent = `Field ${fieldPoints.geometry.attributes.position?.count || 0}`;
  $('stageBadge').textContent = mode[0].toUpperCase() + mode.slice(1);
  $('growthO').textContent = `${Math.round(P.growth * 100)}%`;
  $('info').textContent = `${P.score} Score · ${visibleEdges.length} 可见枝段 · ${current.terminals.length} 结构末端 · Stop envelope ${current.stops.envelope} / space ${current.stops.space}`;
  $('status').textContent = mode === 'field'
    ? '目标包络只规定允许生长的空间与密度，不直接变成枝条。'
    : mode === 'skeleton'
      ? '骨架是无环父子图；生长进度改变真实可见边数，不是裁剪最终表面。'
      : mode === 'thickness'
        ? '厚度在骨架成立后，根据下游 support 反传；不允许粗线掩盖错误拓扑。'
        : mode === 'terminal'
          ? '末端组织独立出现。Coral Score 使用圆钝短棒；Tree Score 只保留克制的枝端芽区。'
          : '最终表面隐藏目标点和调试骨架，用连续扫掠段、局部连接领圈与圆钝末端表达老师的最终生产层。';

  window.__videoTeacherProofSignature = {
    ...current.signature,
    mode,
    growth: P.growth,
    visibleEdgeCount: visibleEdges.length,
    visibleTerminalOrganCount: tipCount,
    fieldPointCount: fieldPoints.geometry.attributes.position?.count || 0,
    evidenceVisible: evidence.classList.contains('show')
  };
}

function fitGraph() {
  if (!current || !current.nodes.length) return;
  const box = new THREE.Box3();
  for (const node of current.nodes) box.expandByPoint(node.p);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 3);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(1.05, 0.62, 1.18).normalize(), span * 1.65);
  camera.near = Math.max(0.02, span / 180);
  camera.far = Math.max(60, span * 12);
  camera.updateProjectionMatrix();
  controls.update();
}

function updateOutputs() {
  $('scoreO').textContent = P.score;
  $('growthO').textContent = `${Math.round(P.growth * 100)}%`;
  $('widthO').textContent = P.width.toFixed(2);
  $('depthO').textContent = P.depth.toFixed(2);
  $('spreadO').textContent = P.spread.toFixed(2);
  $('terminalO').textContent = String(P.terminal);
  $('thicknessO').textContent = P.thickness.toFixed(2);
}

function rebuild(fit = false) {
  current = buildGraph(P.score);
  updateField();
  updateOutputs();
  renderStage();
  if (fit) requestAnimationFrame(fitGraph);
}

function setMode(next) {
  mode = next;
  for (const button of document.querySelectorAll('[data-mode]')) button.classList.toggle('on', button.dataset.mode === mode);
  renderStage();
}

for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode));
$('evidenceBtn').addEventListener('click', () => { evidence.classList.toggle('show'); $('evidenceBtn').classList.toggle('on', evidence.classList.contains('show')); renderStage(); });
$('score').addEventListener('change', (event) => { P.score = event.target.value; rebuild(true); });
function bind(id, key, parse = Number, rebuildNeeded = true) {
  $(id).addEventListener('input', (event) => {
    P[key] = parse(event.target.value);
    clearTimeout(rebuildTimer);
    if (rebuildNeeded) rebuildTimer = setTimeout(() => rebuild(false), 80);
    else { updateOutputs(); renderStage(); }
  });
}
bind('growth', 'growth', Number, false);
bind('width', 'width');
bind('depth', 'depth');
bind('spread', 'spread');
bind('terminal', 'terminal', (v) => parseInt(v, 10), false);
bind('thickness', 'thickness');
$('fit').addEventListener('click', fitGraph);
$('auto').addEventListener('click', () => { autoRotate = !autoRotate; controls.autoRotate = autoRotate; controls.autoRotateSpeed = 0.62; $('auto').classList.toggle('on', autoRotate); });
$('play').addEventListener('click', () => {
  playing = !playing;
  if (playing && P.growth >= 1) P.growth = 0;
  $('play').classList.toggle('on', playing);
  $('play').textContent = playing ? '暂停生长' : '播放生长';
  $('growth').value = String(P.growth);
  renderStage();
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
  window.__videoTeacherProofR01Ready = true;
  window.VideoTeacherProofR01 = {
    setMode,
    setScore(value) { if (!['coral', 'tree'].includes(value)) return; P.score = value; $('score').value = value; rebuild(true); },
    setGrowth(value) { P.growth = clamp(Number(value) || 0, 0, 1); $('growth').value = String(P.growth); updateOutputs(); renderStage(); },
    showEvidence(value = true) { evidence.classList.toggle('show', Boolean(value)); $('evidenceBtn').classList.toggle('on', Boolean(value)); renderStage(); },
    fit: fitGraph,
    getState() { return { params: { ...P }, mode, playing, autoRotate, signature: window.__videoTeacherProofSignature }; }
  };
  document.documentElement.dataset.ready = 'true';
  (function animate(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (playing) {
      P.growth = Math.min(1, P.growth + dt * 0.18);
      $('growth').value = String(P.growth);
      updateOutputs();
      renderStage();
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
