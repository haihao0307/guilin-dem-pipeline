import * as THREE from 'three';

// The instrument knows geometry. It knows nothing about the page, camera or examples.
export const VERSION = 'K1.0.1';
export const LIMITS = Object.freeze({ bytes: 4096, depth: 8, repeat: 256, meshes: 1200 });
const SHAPES = {
  b: { dims: [1, 1, 1], color: 'd69a5a' },
  s: { dims: [0.5], color: '5b9bd5' },
  c: { dims: [0.5, 1], color: '6ea870' },
  n: { dims: [0.5, 1], color: 'b98a62' },
  t: { dims: [0.65, 0.18], color: 'c87883' },
  p: { dims: [1, 1], color: '6f7d8c' }
};
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
export const byteLength = (text) => new TextEncoder().encode(text).length;

function numbers(text, defaults, label, uniform = false) {
  if (text === '') return [...defaults];
  const parts = text.split(',').map((part) => part.trim());
  if (parts.length > defaults.length || parts.some((p) => !NUMBER.test(p))) {
    throw new Error(`${label}：需要 1–${defaults.length} 个有效数字，不能留空`);
  }
  const values = parts.map(Number);
  if (values.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000)) {
    throw new Error(`${label}：数值绝对值不能超过 10000`);
  }
  if (uniform && values.length === 1) return defaults.map(() => values[0]);
  return defaults.map((v, i) => values[i] ?? v);
}
function positive(values, label) {
  if (values.some((v) => v < 0.0001)) throw new Error(`${label}：数值至少为 0.0001`);
}
function sequence(source, depth = 0) {
  if (depth > LIMITS.depth) throw new Error(`嵌套不能超过 ${LIMITS.depth} 层`);
  let nesting = 0;
  let start = 0;
  const tokens = [];
  for (let i = 0; i <= source.length; i++) {
    if (source[i] === '{') nesting++;
    if (source[i] === '}') nesting--;
    if (nesting < 0) throw new Error('多余的右花括号');
    if (nesting + depth > LIMITS.depth) throw new Error(`嵌套不能超过 ${LIMITS.depth} 层`);
    if ((source[i] === ';' && nesting === 0) || i === source.length) {
      const token = source.slice(start, i).trim();
      if (!token) throw new Error('节点不能为空，检查多余的分号');
      tokens.push(token);
      start = i + 1;
    }
  }
  if (nesting !== 0) throw new Error('花括号没有闭合');
  return tokens.map((token) => {
    const type = token[0];
    if (type === 'A' || type === 'L') {
      const opening = token.indexOf('{');
      if (opening < 1 || !token.endsWith('}')) throw new Error('阵列必须包含 {子谱}');
      const [count, distance] = numbers(token.slice(1, opening), [6, type === 'A' ? 1 : 0.5], '阵列');
      if (!Number.isInteger(count) || count < 1 || count > LIMITS.repeat) throw new Error(`阵列数量必须是 1–${LIMITS.repeat} 的整数`);
      positive([distance], '阵列距离');
      return { type, count, distance, children: sequence(token.slice(opening + 1, -1).trim(), depth + 1) };
    }
    const known = SHAPES[type];
    if (!known) throw new Error(`K1 不认识节点 ${type}`);
    const order = '#!@/%';
    const fields = {};
    let previous = -1;
    let marker = 'dims';
    let begin = 1;
    for (let i = 1; i <= token.length; i++) {
      const rank = order.indexOf(token[i]);
      if (i < token.length && rank === -1) continue;
      const value = token.slice(begin, i).trim();
      if (marker !== 'dims' && value === '') throw new Error(`属性 ${marker} 不能留空`);
      fields[marker] = value;
      if (i < token.length) {
        if (rank <= previous) throw new Error('属性不可重复，顺序为 # ! @ / %');
        previous = rank;
        marker = token[i];
        begin = i + 1;
      }
    }
    const dims = numbers(fields.dims, known.dims, '尺寸');
    const scale = numbers(fields['%'] ?? '', [1, 1, 1], '缩放', true);
    positive(dims, '尺寸');
    positive(scale, '缩放');
    if (type === 't' && dims[1] >= dims[0]) throw new Error('圆环管半径必须小于主半径');
    const material = numbers(fields['!'] ?? '', [0.66, 0.06], '粗糙度、金属度');
    if (material.some((v) => v < 0 || v > 1)) throw new Error('材质参数必须在 0–1 之间');
    const color = fields['#'] ?? known.color;
    if (!/^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(color)) throw new Error('颜色必须是 3 位或 6 位十六进制');
    return { type, dims, scale, material, color, position: numbers(fields['@'] ?? '', [0, 0, 0], '位置'), rotation: numbers(fields['/'] ?? '', [0, 0, 0], '角度') };
  });
}
function countMeshes(nodes) {
  let count = 0;
  for (const n of nodes) {
    count += n.children ? n.count * countMeshes(n.children) : 1;
    if (count > LIMITS.meshes) throw new Error(`展开结果不能超过 ${LIMITS.meshes} 个对象`);
  }
  return count;
}
export function parseScore(input) {
  if (typeof input !== 'string') throw new Error('谱子必须是文本');
  const score = input.trim();
  if (byteLength(score) > LIMITS.bytes) throw new Error(`谱子不能超过 ${LIMITS.bytes} 字节`);
  if (!score.startsWith('K1|')) throw new Error('谱子必须以 K1| 开始');
  const nodes = sequence(score.slice(3).trim());
  return { score, nodes, count: countMeshes(nodes) };
}
function geometry(n) {
  const d = n.dims;
  let g;
  let lift = 0;
  if (n.type === 'b') { g = new THREE.BoxGeometry(...d); lift = d[1] / 2; }
  if (n.type === 's') { g = new THREE.SphereGeometry(d[0], 40, 24); lift = d[0]; }
  if (n.type === 'c') { g = new THREE.CylinderGeometry(d[0], d[0], d[1], 40); lift = d[1] / 2; }
  if (n.type === 'n') { g = new THREE.ConeGeometry(d[0], d[1], 40); lift = d[1] / 2; }
  if (n.type === 't') { g = new THREE.TorusGeometry(d[0], d[1], 20, 64); lift = d[0] + d[1]; }
  if (n.type === 'p') { g = new THREE.PlaneGeometry(...d); g.rotateX(-Math.PI / 2); }
  g.translate(0, lift, 0);
  g.computeBoundingBox();
  return g;
}
function perform(nodes, parent) {
  for (const n of nodes) {
    if (n.children) {
      for (let i = 0; i < n.count; i++) {
        const slot = new THREE.Group();
        if (n.type === 'A') {
          const angle = i * Math.PI * 2 / n.count;
          slot.position.set(Math.cos(angle) * n.distance, 0, Math.sin(angle) * n.distance);
          slot.rotation.y = -angle;
        } else slot.position.x = (i - (n.count - 1) / 2) * n.distance;
        parent.add(slot);
        perform(n.children, slot);
      }
    } else {
      const mesh = new THREE.Mesh(geometry(n), new THREE.MeshStandardMaterial({ color: `#${n.color}`, roughness: n.material[0], metalness: n.material[1], side: n.type === 'p' ? THREE.DoubleSide : THREE.FrontSide }));
      mesh.position.fromArray(n.position);
      mesh.rotation.set(...n.rotation.map(THREE.MathUtils.degToRad));
      mesh.scale.fromArray(n.scale);
      mesh.castShadow = n.type !== 'p';
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
}
export function buildScore(input) {
  const parsed = parseScore(input); // Validate the entire input and expansion budget before allocating meshes.
  const root = new THREE.Group();
  try {
    perform(parsed.nodes, root);
    root.updateMatrixWorld(true);
    return { root, score: parsed.score };
  } catch (error) { dispose(root); throw error; }
}
export function dispose(root) {
  root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
// Snapshot actual output buffers, not the input string, counts or random object IDs.
export function snapshot(root) {
  root.updateMatrixWorld(true);
  const chunks = [];
  const text = (v) => chunks.push(new TextEncoder().encode(JSON.stringify(v)));
  const array = (v) => chunks.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice());
  root.traverse((o) => {
    if (!o.isMesh) return;
    text(['mesh', o.visible]);
    array(new Float64Array(o.matrixWorld.elements));
    for (const name of Object.keys(o.geometry.attributes).sort()) {
      const a = o.geometry.attributes[name];
      text([name, a.itemSize, a.normalized, a.array.constructor.name, a.count]);
      array(a.array);
    }
    const index = o.geometry.index;
    text(['index', index?.array.constructor.name, index?.count ?? 0]);
    if (index) array(index.array);
    const m = o.material;
    text(['material', m.color.toArray(), m.roughness, m.metalness, m.side, m.opacity, m.transparent]);
  });
  return chunks;
}
export function equalSnapshots(a, b) {
  return a.length === b.length && a.every((chunk, i) => chunk.length === b[i].length && chunk.every((value, j) => value === b[i][j]));
}
export function fingerprint(chunks) {
  let hash = 0x811c9dc5;
  for (const chunk of chunks) {
    for (const v of new Uint8Array(new Uint32Array([chunk.length]).buffer)) hash = Math.imul(hash ^ v, 0x01000193);
    for (const v of chunk) hash = Math.imul(hash ^ v, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}
export function measure(root, score) {
  let objects = 0, vertices = 0, triangles = 0, geometryBytes = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    objects++;
    vertices += o.geometry.attributes.position.count;
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    for (const a of Object.values(o.geometry.attributes)) geometryBytes += a.array.byteLength;
    geometryBytes += o.geometry.index?.array.byteLength ?? 0;
  });
  return { bytes: byteLength(score), objects, vertices, triangles, geometryBytes, hash: fingerprint(snapshot(root)) };
}
