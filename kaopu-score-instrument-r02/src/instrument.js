import * as THREE from 'three';

// KAOPU K2 instrument: geometry grammar only.
// It intentionally contains no camera, page, controls, example scores or project-specific scene.
export { THREE };
export const VERSION = 'K2.0.0';
export const LIMITS = Object.freeze({ bytes: 8192, depth: 10, repeat: 512, meshes: 2500 });

const SHAPES = Object.freeze({
  b: { dims: [1, 1, 1], color: 'd69a5a' },
  s: { dims: [0.5], color: '5b9bd5' },
  c: { dims: [0.5, 1], color: '6ea870' },
  n: { dims: [0.5, 1], color: 'b98a62' },
  t: { dims: [0.65, 0.18], color: 'c87883' },
  p: { dims: [1, 1], color: '6f7d8c' }
});

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const DEG = Math.PI / 180;
export const byteLength = (text) => new TextEncoder().encode(text).length;

function numericList(text, label, { min = 0, max = Infinity, defaults = [], exact = null } = {}) {
  const source = text.trim();
  if (source === '') return [...defaults];
  const parts = source.split(',').map((part) => part.trim());
  if (parts.some((part) => !NUMBER.test(part))) throw new Error(`${label}：存在无效数字或空参数`);
  if (exact !== null && !exact.includes(parts.length)) throw new Error(`${label}：参数数量应为 ${exact.join(' 或 ')}`);
  if (parts.length < min || parts.length > max) throw new Error(`${label}：参数数量应为 ${min}–${max}`);
  const values = parts.map(Number);
  if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > 10000)) {
    throw new Error(`${label}：数值绝对值不能超过 10000`);
  }
  return values;
}

function fill(values, defaults, uniform = false) {
  if (uniform && values.length === 1) return defaults.map(() => values[0]);
  return defaults.map((value, index) => values[index] ?? value);
}

function requirePositive(values, label) {
  if (values.some((value) => value < 0.0001)) throw new Error(`${label}：数值至少为 0.0001`);
}

function requireNonNegative(values, label) {
  if (values.some((value) => value < 0)) throw new Error(`${label}：数值不能为负数`);
}

function requireCount(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > LIMITS.repeat) {
    throw new Error(`${label}：必须是 1–${LIMITS.repeat} 的整数`);
  }
  return value;
}

function propertyFields(source, order, label) {
  const fields = {};
  let marker = 'head';
  let previous = -1;
  let begin = 0;
  for (let index = 0; index <= source.length; index += 1) {
    const rank = order.indexOf(source[index]);
    if (index < source.length && rank === -1) continue;
    const value = source.slice(begin, index).trim();
    if (marker !== 'head' && value === '') throw new Error(`${label}：属性 ${marker} 不能留空`);
    fields[marker] = value;
    if (index < source.length) {
      if (rank <= previous) throw new Error(`${label}：属性不能重复，顺序必须为 ${order.split('').join(' ')}`);
      previous = rank;
      marker = source[index];
      begin = index + 1;
    }
  }
  return fields;
}

function transformFromFields(fields, label) {
  const position = fill(numericList(fields['@'] ?? '', `${label}位置`, { min: 1, max: 3 }), [0, 0, 0]);
  const rotation = fill(numericList(fields['/'] ?? '', `${label}角度`, { min: 1, max: 3 }), [0, 0, 0]);
  const scale = fill(numericList(fields['%'] ?? '', `${label}缩放`, { min: 1, max: 3 }), [1, 1, 1], true);
  requirePositive(scale, `${label}缩放`);
  return { position, rotation, scale };
}

function splitSequence(source, depth = 0) {
  if (depth > LIMITS.depth) throw new Error(`嵌套不能超过 ${LIMITS.depth} 层`);
  if (!source.trim()) throw new Error('子谱不能为空');
  const tokens = [];
  let nesting = 0;
  let start = 0;
  for (let index = 0; index <= source.length; index += 1) {
    const char = source[index];
    if (char === '{') nesting += 1;
    if (char === '}') nesting -= 1;
    if (nesting < 0) throw new Error('多余的右花括号');
    if (depth + nesting > LIMITS.depth) throw new Error(`嵌套不能超过 ${LIMITS.depth} 层`);
    if ((char === ';' && nesting === 0) || index === source.length) {
      const token = source.slice(start, index).trim();
      if (!token) throw new Error('节点不能为空，检查多余的分号');
      tokens.push(token);
      start = index + 1;
    }
  }
  if (nesting !== 0) throw new Error('花括号没有闭合');
  return tokens.map((token) => parseNode(token, depth));
}

function containerParts(token, label) {
  const opening = token.indexOf('{');
  if (opening < 1 || !token.endsWith('}')) throw new Error(`${label}：必须包含 {子谱}`);
  return {
    header: token.slice(1, opening).trim(),
    childrenSource: token.slice(opening + 1, -1).trim()
  };
}

function parseGroup(token, depth) {
  const { header, childrenSource } = containerParts(token, 'G 组');
  const fields = propertyFields(header, '@/%', 'G 组');
  if (fields.head !== '') throw new Error('G 组：G 后只允许 @ / % 变换属性');
  return { kind: 'group', ...transformFromFields(fields, 'G 组'), children: splitSequence(childrenSource, depth + 1) };
}

function parseArray(token, depth) {
  const type = token[0];
  const { header, childrenSource } = containerParts(token, `${type} 算子`);
  const children = splitSequence(childrenSource, depth + 1);

  if (type === 'A') {
    const values = numericList(header, 'A 环阵', { min: 2, max: 4 });
    const count = requireCount(values[0], 'A 环阵数量');
    const radius = values[1];
    requireNonNegative([radius], 'A 环阵半径');
    return { kind: 'array', type, count, radius, start: values[2] ?? 0, facing: values[3] ?? 0, children };
  }

  if (type === 'L') {
    const values = numericList(header, 'L 线阵', { exact: [2, 4] });
    const count = requireCount(values[0], 'L 线阵数量');
    const vector = values.length === 2 ? [values[1], 0, 0] : values.slice(1);
    if (count > 1 && vector.every((value) => value === 0)) throw new Error('L 线阵：重复数量大于 1 时，步进向量不能全为零');
    return { kind: 'array', type, count, vector, children };
  }

  if (type === 'X') {
    const values = numericList(header, 'X 三维阵列', { exact: [6] });
    const counts = values.slice(0, 3).map((value, index) => requireCount(value, `X ${['X', 'Y', 'Z'][index]} 数量`));
    const spacing = values.slice(3);
    requireNonNegative(spacing, 'X 三维阵列间距');
    counts.forEach((count, index) => {
      if (count > 1 && spacing[index] === 0) throw new Error(`X 三维阵列：${['X', 'Y', 'Z'][index]} 数量大于 1 时，对应间距不能为零`);
    });
    return { kind: 'array', type, counts, spacing, children };
  }

  if (type === 'H') {
    const values = numericList(header, 'H 螺旋阵列', { exact: [4, 5] });
    const count = requireCount(values[0], 'H 螺旋阵列数量');
    const radius = values[1];
    requireNonNegative([radius], 'H 螺旋阵列半径');
    if (count > 1 && radius === 0 && values[2] === 0) throw new Error('H 螺旋阵列：必须具有半径或高度');
    return { kind: 'array', type, count, radius, height: values[2], turns: values[3], start: values[4] ?? 0, children };
  }

  throw new Error(`K2 不认识阵列 ${type}`);
}

function parsePrimitive(token) {
  const type = token[0];
  const known = SHAPES[type];
  if (!known) throw new Error(`K2 不认识节点 ${type}`);
  const fields = propertyFields(token.slice(1), '#!@/%', `${type} 几何`);
  const dims = fill(numericList(fields.head, `${type} 尺寸`, { min: 1, max: known.dims.length }), known.dims);
  requirePositive(dims, `${type} 尺寸`);
  if (type === 't' && dims[1] >= dims[0]) throw new Error('圆环管半径必须小于主半径');

  const material = fill(numericList(fields['!'] ?? '', '材质', { min: 1, max: 2 }), [0.66, 0.06]);
  if (material.some((value) => value < 0 || value > 1)) throw new Error('材质参数必须在 0–1 之间');
  const color = fields['#'] ?? known.color;
  if (!/^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(color)) throw new Error('颜色必须是 3 位或 6 位十六进制');

  return {
    kind: 'primitive',
    type,
    dims,
    material,
    color,
    ...transformFromFields(fields, `${type} 几何`)
  };
}

function parseNode(token, depth) {
  const type = token[0];
  if (type === 'G') return parseGroup(token, depth);
  if (type === 'A' || type === 'L' || type === 'X' || type === 'H') return parseArray(token, depth);
  return parsePrimitive(token);
}

function expandedCount(nodes) {
  let total = 0;
  for (const node of nodes) {
    if (node.kind === 'primitive') total += 1;
    if (node.kind === 'group') total += expandedCount(node.children);
    if (node.kind === 'array') {
      const multiplier = node.type === 'X'
        ? node.counts[0] * node.counts[1] * node.counts[2]
        : node.count;
      total += multiplier * expandedCount(node.children);
    }
    if (total > LIMITS.meshes) throw new Error(`展开结果不能超过 ${LIMITS.meshes} 个对象`);
  }
  return total;
}

export function parseScore(input) {
  if (typeof input !== 'string') throw new Error('谱子必须是文本');
  const score = input.trim();
  if (byteLength(score) > LIMITS.bytes) throw new Error(`谱子不能超过 ${LIMITS.bytes} 字节`);
  if (!score.startsWith('K2|')) throw new Error('谱子必须以 K2| 开始');
  const nodes = splitSequence(score.slice(3));
  return { score, nodes, count: expandedCount(nodes) };
}

function geometryFor(node) {
  const d = node.dims;
  let geometry;
  let lift = 0;
  if (node.type === 'b') { geometry = new THREE.BoxGeometry(...d); lift = d[1] / 2; }
  if (node.type === 's') { geometry = new THREE.SphereGeometry(d[0], 40, 24); lift = d[0]; }
  if (node.type === 'c') { geometry = new THREE.CylinderGeometry(d[0], d[0], d[1], 40); lift = d[1] / 2; }
  if (node.type === 'n') { geometry = new THREE.ConeGeometry(d[0], d[1], 40); lift = d[1] / 2; }
  if (node.type === 't') {
    geometry = new THREE.TorusGeometry(d[0], d[1], 20, 64);
    geometry.rotateX(Math.PI / 2);
    lift = d[1];
  }
  if (node.type === 'p') {
    geometry = new THREE.PlaneGeometry(...d);
    geometry.rotateX(-Math.PI / 2);
  }
  geometry.translate(0, lift, 0);
  geometry.computeBoundingBox();
  return geometry;
}

function applyTransform(object, node) {
  object.position.fromArray(node.position);
  object.rotation.set(...node.rotation.map((value) => value * DEG));
  object.scale.fromArray(node.scale);
}

function perform(nodes, parent) {
  for (const node of nodes) {
    if (node.kind === 'primitive') {
      const material = new THREE.MeshStandardMaterial({
        color: `#${node.color}`,
        roughness: node.material[0],
        metalness: node.material[1],
        side: node.type === 'p' ? THREE.DoubleSide : THREE.FrontSide
      });
      const mesh = new THREE.Mesh(geometryFor(node), material);
      applyTransform(mesh, node);
      mesh.castShadow = node.type !== 'p';
      mesh.receiveShadow = true;
      parent.add(mesh);
      continue;
    }

    if (node.kind === 'group') {
      const group = new THREE.Group();
      applyTransform(group, node);
      parent.add(group);
      perform(node.children, group);
      continue;
    }

    if (node.type === 'A') {
      for (let index = 0; index < node.count; index += 1) {
        const angle = (node.start + index * 360 / node.count) * DEG;
        const slot = new THREE.Group();
        slot.position.set(Math.cos(angle) * node.radius, 0, Math.sin(angle) * node.radius);
        slot.rotation.y = -angle + node.facing * DEG;
        parent.add(slot);
        perform(node.children, slot);
      }
      continue;
    }

    if (node.type === 'L') {
      const center = (node.count - 1) / 2;
      for (let index = 0; index < node.count; index += 1) {
        const offset = index - center;
        const slot = new THREE.Group();
        slot.position.set(node.vector[0] * offset, node.vector[1] * offset, node.vector[2] * offset);
        parent.add(slot);
        perform(node.children, slot);
      }
      continue;
    }

    if (node.type === 'X') {
      const centers = node.counts.map((count) => (count - 1) / 2);
      for (let x = 0; x < node.counts[0]; x += 1) {
        for (let y = 0; y < node.counts[1]; y += 1) {
          for (let z = 0; z < node.counts[2]; z += 1) {
            const slot = new THREE.Group();
            slot.position.set(
              (x - centers[0]) * node.spacing[0],
              (y - centers[1]) * node.spacing[1],
              (z - centers[2]) * node.spacing[2]
            );
            parent.add(slot);
            perform(node.children, slot);
          }
        }
      }
      continue;
    }

    if (node.type === 'H') {
      for (let index = 0; index < node.count; index += 1) {
        const ratio = node.count === 1 ? 0 : index / (node.count - 1);
        const angle = (node.start + ratio * node.turns * 360) * DEG;
        const slot = new THREE.Group();
        slot.position.set(Math.cos(angle) * node.radius, ratio * node.height, Math.sin(angle) * node.radius);
        slot.rotation.y = -angle;
        parent.add(slot);
        perform(node.children, slot);
      }
    }
  }
}

export function buildScore(input) {
  const parsed = parseScore(input);
  const root = new THREE.Group();
  root.name = `KAOPU_${VERSION}`;
  try {
    perform(parsed.nodes, root);
    root.updateMatrixWorld(true);
    return { root, score: parsed.score, ast: parsed.nodes };
  } catch (error) {
    dispose(root);
    throw error;
  }
}

export function dispose(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material?.dispose();
  });
}

export function snapshot(root) {
  root.updateMatrixWorld(true);
  const chunks = [];
  const encode = (value) => chunks.push(new TextEncoder().encode(JSON.stringify(value)));
  const copyArray = (value) => chunks.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice());
  root.traverse((object) => {
    if (!object.isMesh) return;
    encode(['mesh', object.visible]);
    copyArray(new Float64Array(object.matrixWorld.elements));
    for (const name of Object.keys(object.geometry.attributes).sort()) {
      const attribute = object.geometry.attributes[name];
      encode([name, attribute.itemSize, attribute.normalized, attribute.array.constructor.name, attribute.count]);
      copyArray(attribute.array);
    }
    const index = object.geometry.index;
    encode(['index', index?.array.constructor.name ?? null, index?.count ?? 0]);
    if (index) copyArray(index.array);
    const material = object.material;
    encode(['material', material.color.toArray(), material.roughness, material.metalness, material.side, material.opacity, material.transparent]);
  });
  return chunks;
}

export function equalSnapshots(left, right) {
  return left.length === right.length && left.every((chunk, index) => {
    const other = right[index];
    return chunk.length === other.length && chunk.every((value, byteIndex) => value === other[byteIndex]);
  });
}

export function fingerprint(chunks) {
  let hash = 0x811c9dc5;
  for (const chunk of chunks) {
    for (const value of new Uint8Array(new Uint32Array([chunk.length]).buffer)) hash = Math.imul(hash ^ value, 0x01000193);
    for (const value of chunk) hash = Math.imul(hash ^ value, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function measure(root, score) {
  let objects = 0;
  let groups = 0;
  let vertices = 0;
  let triangles = 0;
  let geometryBytes = 0;
  root.traverse((object) => {
    if (object.isGroup) groups += 1;
    if (!object.isMesh) return;
    objects += 1;
    const position = object.geometry.attributes.position;
    vertices += position.count;
    triangles += (object.geometry.index?.count ?? position.count) / 3;
    for (const attribute of Object.values(object.geometry.attributes)) geometryBytes += attribute.array.byteLength;
    geometryBytes += object.geometry.index?.array.byteLength ?? 0;
  });
  return {
    bytes: byteLength(score),
    objects,
    groups,
    vertices,
    triangles,
    geometryBytes,
    hash: fingerprint(snapshot(root))
  };
}
