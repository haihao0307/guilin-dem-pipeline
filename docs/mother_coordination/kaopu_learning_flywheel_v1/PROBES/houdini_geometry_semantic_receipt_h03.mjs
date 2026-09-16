#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
}

function rotateToSmallest(values) {
  if (values.length === 0) return [];
  let best = values;
  for (let i = 1; i < values.length; i += 1) {
    const candidate = [...values.slice(i), ...values.slice(0, i)];
    if (stable(candidate) < stable(best)) best = candidate;
  }
  return best;
}

function normalizeSchema(schema) {
  return Object.fromEntries(Object.entries(schema).sort(([a], [b]) => a.localeCompare(b)));
}

function semanticGeometryReceipt(geometry) {
  if (geometry.coordinateFrame !== 'RH_Y_UP_METERS') throw new Error('coordinate-frame-required');
  if (!geometry.schemas) throw new Error('attribute-schemas-required');

  const pointIds = geometry.points.map((point) => point.id);
  if (pointIds.some((id) => typeof id !== 'string' || id.length === 0)) throw new Error('stable-point-id-required');
  if (new Set(pointIds).size !== pointIds.length) throw new Error('duplicate-point-id');
  const pointIdSet = new Set(pointIds);

  const primIds = geometry.primitives.map((prim) => prim.id);
  if (primIds.some((id) => typeof id !== 'string' || id.length === 0)) throw new Error('stable-primitive-id-required');
  if (new Set(primIds).size !== primIds.length) throw new Error('duplicate-primitive-id');
  const primIdSet = new Set(primIds);

  const points = geometry.points
    .map((point) => ({ id: point.id, P: point.P, attrs: point.attrs ?? {} }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const primitives = geometry.primitives.map((prim) => {
    if (!Array.isArray(prim.vertices) || prim.vertices.length === 0) throw new Error('primitive-vertices-required');
    for (const vertex of prim.vertices) {
      if (!pointIdSet.has(vertex.pointId)) throw new Error(`unknown-point-id:${vertex.pointId}`);
    }
    const vertices = prim.closed ? rotateToSmallest(prim.vertices) : prim.vertices;
    return {
      id: prim.id,
      type: prim.type,
      closed: Boolean(prim.closed),
      vertices,
      attrs: prim.attrs ?? {}
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const normalizeGroups = (groups = {}, validIds) => Object.fromEntries(
    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) => {
      if (!Array.isArray(group.members)) throw new Error(`group-members-required:${name}`);
      if (group.members.some((id) => !validIds.has(id))) throw new Error(`unknown-group-member:${name}`);
      return [name, {
        ordered: Boolean(group.ordered),
        members: group.ordered ? group.members : [...group.members].sort()
      }];
    })
  );

  const canonical = {
    coordinateFrame: geometry.coordinateFrame,
    schemas: {
      point: normalizeSchema(geometry.schemas.point ?? {}),
      vertex: normalizeSchema(geometry.schemas.vertex ?? {}),
      primitive: normalizeSchema(geometry.schemas.primitive ?? {}),
      detail: normalizeSchema(geometry.schemas.detail ?? {})
    },
    points,
    primitives,
    detailAttrs: geometry.detailAttrs ?? {},
    groups: {
      point: normalizeGroups(geometry.groups?.point, pointIdSet),
      primitive: normalizeGroups(geometry.groups?.primitive, primIdSet)
    }
  };
  return { sha256: sha256(canonical), canonical };
}

function weakMetrics(geometry) {
  const positions = geometry.points.map((point) => point.P);
  return {
    pointCount: geometry.points.length,
    primitiveCount: geometry.primitives.length,
    bounds: [0, 1, 2].flatMap((axis) => [
      Math.min(...positions.map((position) => position[axis])),
      Math.max(...positions.map((position) => position[axis]))
    ])
  };
}

const schemas = {
  point: {
    P: { owner: 'point', dataType: 'float', numericDataType: 'float32', size: 3, qualifier: 'position' },
    id: { owner: 'point', dataType: 'string', size: 1 }
  },
  vertex: {
    uv: { owner: 'vertex', dataType: 'float', numericDataType: 'float32', size: 3, qualifier: 'texturecoord' }
  },
  primitive: {
    id: { owner: 'primitive', dataType: 'string', size: 1 },
    material: { owner: 'primitive', dataType: 'string', size: 1 }
  },
  detail: {
    units: { owner: 'detail', dataType: 'string', size: 1 }
  }
};

const base = {
  coordinateFrame: 'RH_Y_UP_METERS',
  schemas,
  points: [
    { id: 'p0', P: [0, 0, 0] },
    { id: 'p1', P: [1, 0, 0] },
    { id: 'p2', P: [1, 1, 0] },
    { id: 'p3', P: [0, 1, 0] }
  ],
  primitives: [
    { id: 'f0', type: 'polygon', closed: true, attrs: { material: 'stone' }, vertices: [
      { pointId: 'p0', attrs: { uv: [0, 0, 0] } },
      { pointId: 'p1', attrs: { uv: [1, 0, 0] } },
      { pointId: 'p2', attrs: { uv: [1, 1, 0] } }
    ] },
    { id: 'f1', type: 'polygon', closed: true, attrs: { material: 'stone' }, vertices: [
      { pointId: 'p0', attrs: { uv: [0, 0, 0] } },
      { pointId: 'p2', attrs: { uv: [1, 1, 0] } },
      { pointId: 'p3', attrs: { uv: [0, 1, 0] } }
    ] }
  ],
  detailAttrs: { units: 'meters' },
  groups: {
    point: { anchors: { ordered: false, members: ['p0', 'p3'] } },
    primitive: { shell: { ordered: false, members: ['f0', 'f1'] } }
  },
  transientDataIds: { topology: 7, primitiveIntrinsics: 11 }
};

const checks = [];
function check(name, pass, detail = null) {
  checks.push({ name, pass: Boolean(pass), detail });
}

const baseReceipt = semanticGeometryReceipt(base);

const permuted = structuredClone(base);
permuted.points = [permuted.points[2], permuted.points[0], permuted.points[3], permuted.points[1]];
permuted.primitives.reverse();
permuted.primitives[0].vertices = [permuted.primitives[0].vertices[1], permuted.primitives[0].vertices[2], permuted.primitives[0].vertices[0]];
permuted.groups.point.anchors.members.reverse();
check('stable IDs remove point, primitive, cyclic-start and unordered-group enumeration noise',
  semanticGeometryReceipt(permuted).sha256 === baseReceipt.sha256,
  { base: baseReceipt.sha256, permuted: semanticGeometryReceipt(permuted).sha256 });
check('naive order-sensitive serialization changes under harmless enumeration changes',
  sha256(base) !== sha256(permuted), { baseRaw: sha256(base), permutedRaw: sha256(permuted) });

const otherTopology = structuredClone(base);
otherTopology.primitives[0].vertices = [
  { pointId: 'p0', attrs: { uv: [0, 0, 0] } },
  { pointId: 'p1', attrs: { uv: [1, 0, 0] } },
  { pointId: 'p3', attrs: { uv: [0, 1, 0] } }
];
otherTopology.primitives[1].vertices = [
  { pointId: 'p1', attrs: { uv: [1, 0, 0] } },
  { pointId: 'p2', attrs: { uv: [1, 1, 0] } },
  { pointId: 'p3', attrs: { uv: [0, 1, 0] } }
];
check('bbox and counts can match while topology differs',
  stable(weakMetrics(base)) === stable(weakMetrics(otherTopology)) && semanticGeometryReceipt(otherTopology).sha256 !== baseReceipt.sha256,
  { weakMetrics: weakMetrics(base), base: baseReceipt.sha256, otherTopology: semanticGeometryReceipt(otherTopology).sha256 });

const uvChanged = structuredClone(base);
uvChanged.primitives[1].vertices[0].attrs.uv = [0.25, 0, 0];
check('vertex-owned UV change changes semantic receipt', semanticGeometryReceipt(uvChanged).sha256 !== baseReceipt.sha256, null);

const windingChanged = structuredClone(base);
windingChanged.primitives[0].vertices.reverse();
check('polygon winding reversal is not erased by cyclic normalization', semanticGeometryReceipt(windingChanged).sha256 !== baseReceipt.sha256, null);

const detailChanged = structuredClone(base);
detailChanged.detailAttrs.units = 'centimeters';
check('detail attribute change changes semantic receipt', semanticGeometryReceipt(detailChanged).sha256 !== baseReceipt.sha256, null);

const groupChanged = structuredClone(base);
groupChanged.groups.point.anchors.members = ['p0', 'p2'];
check('group membership change changes semantic receipt', semanticGeometryReceipt(groupChanged).sha256 !== baseReceipt.sha256, null);

const precisionChanged = structuredClone(base);
precisionChanged.schemas.point.P.numericDataType = 'float64';
check('attribute storage precision is part of schema identity', semanticGeometryReceipt(precisionChanged).sha256 !== baseReceipt.sha256, null);

const differentDataIds = structuredClone(base);
differentDataIds.transientDataIds = { topology: 700, primitiveIntrinsics: 1100 };
check('transient change counters do not change content receipt', semanticGeometryReceipt(differentDataIds).sha256 === baseReceipt.sha256, null);

const sameDataIdsDifferentContent = structuredClone(otherTopology);
sameDataIdsDifferentContent.transientDataIds = structuredClone(base.transientDataIds);
check('equal synthetic data IDs do not substitute for content comparison',
  stable(sameDataIdsDifferentContent.transientDataIds) === stable(base.transientDataIds)
    && semanticGeometryReceipt(sameDataIdsDifferentContent).sha256 !== baseReceipt.sha256,
  null);

let missingIdRejected = false;
try {
  const missing = structuredClone(base);
  delete missing.points[0].id;
  missing.points[1].P = [0, 0, 0];
  semanticGeometryReceipt(missing);
} catch (error) {
  missingIdRejected = error.message === 'stable-point-id-required';
}
check('position-only canonicalization with coincident points is rejected without stable IDs', missingIdRejected, null);

let duplicateIdRejected = false;
try {
  const duplicate = structuredClone(base);
  duplicate.points[1].id = 'p0';
  semanticGeometryReceipt(duplicate);
} catch (error) {
  duplicateIdRejected = error.message === 'duplicate-point-id';
}
check('duplicate stable point IDs are rejected', duplicateIdRejected, null);

const orderedGroupA = structuredClone(base);
orderedGroupA.groups.point.path = { ordered: true, members: ['p0', 'p1', 'p2'] };
const orderedGroupB = structuredClone(orderedGroupA);
orderedGroupB.groups.point.path.members.reverse();
check('ordered group sequence remains semantic', semanticGeometryReceipt(orderedGroupA).sha256 !== semanticGeometryReceipt(orderedGroupB).sha256, null);

const passed = checks.filter((item) => item.pass).length;
const result = {
  schema: 'kaopu-houdini-geometry-semantic-receipt-result/h03',
  status: passed === checks.length ? 'pass' : 'fail',
  evidenceClass: 'official-source-contract plus synthetic CPU counterexamples',
  observationRoot: 'one official SideFX documentation lineage plus Node.js synthetic fixtures; not Houdini runtime',
  summary: {
    checks: checks.length,
    passed,
    failed: checks.length - passed,
    baseSemanticReceipt: baseReceipt.sha256,
    baseWeakMetrics: weakMetrics(base),
    baseNaiveOrderHash: sha256(base),
    permutedNaiveOrderHash: sha256(permuted)
  },
  currentBestView: 'Bind cooked-geometry receipts to coordinate frame, stable semantic IDs, topology, owner-specific typed attribute schemas and values, groups and detail metadata. Keep raw transport hashes and quality metrics separate.',
  boundary: 'This is a conservative polygonal fixture contract, not a universal Houdini geometry canonicalizer, renderer equivalence test or cross-machine cook determinism result.',
  checks
};

const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exitCode = 1;
