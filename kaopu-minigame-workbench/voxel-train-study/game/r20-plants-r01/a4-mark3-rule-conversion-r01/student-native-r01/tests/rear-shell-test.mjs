import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRearShell, defaultRearShellParameters } from '../src/rear-shell.mjs';

const subtract = (a, b) => Array.from(a, (value, axis) => value - b[axis]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const position = (mesh, i) => Array.from(mesh.positions.slice(i * 3, i * 3 + 3));
const normal = (mesh, i) => Array.from(mesh.normals.slice(i * 3, i * 3 + 3));
const close = (actual, expected, tolerance = 5e-6) => assert.ok(
  Math.abs(actual - expected) <= tolerance,
  `Expected ${actual} to equal ${expected} within ${tolerance}`,
);

function validateGeometry(mesh) {
  assert.ok(mesh.positions instanceof Float32Array);
  assert.ok(mesh.normals instanceof Float32Array);
  assert.ok(mesh.uvs instanceof Float32Array);
  assert.ok(mesh.indices instanceof Uint32Array);
  const vertexCount = mesh.positions.length / 3;
  assert.equal(mesh.normals.length, mesh.positions.length);
  assert.equal(mesh.uvs.length, vertexCount * 2);
  assert.equal(mesh.indices.length % 3, 0);
  for (const buffer of [mesh.positions, mesh.normals, mesh.uvs]) {
    assert.ok(buffer.every(Number.isFinite), 'All generated attributes must be finite.');
  }
  for (let i = 0; i < vertexCount; i += 1) close(Math.hypot(...normal(mesh, i)), 1, 1e-6);

  let signedVolume = 0;
  const weldedEdges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = Array.from(mesh.indices.slice(i, i + 3));
    assert.ok(ids.every((id) => Number.isInteger(id) && id >= 0 && id < vertexCount));
    const [a, b, c] = ids.map((id) => position(mesh, id));
    const points = [a, b, c].map((point) => point.join(','));
    for (let edge = 0; edge < 3; edge += 1) {
      const from = points[edge];
      const to = points[(edge + 1) % 3];
      const key = [from, to].sort().join('|');
      const prior = weldedEdges.get(key) ?? { count: 0, direction: 0 };
      prior.count += 1;
      prior.direction += from < to ? 1 : -1;
      weldedEdges.set(key, prior);
    }
    const triangleCross = cross(subtract(b, a), subtract(c, a));
    const doubleArea = Math.hypot(...triangleCross);
    assert.ok(doubleArea > 1e-10, `Triangle ${i / 3} must have positive area.`);
    for (const id of ids) assert.ok(dot(triangleCross, normal(mesh, id)) / doubleArea > .98, 'Smooth analytic normals must agree with sampled triangle winding.');
    const [uvA, uvB, uvC] = ids.map((id) => Array.from(mesh.uvs.slice(id * 2, id * 2 + 2)));
    const uvAB = subtract(uvB, uvA);
    const uvAC = subtract(uvC, uvA);
    const doubleUvArea = uvAB[0] * uvAC[1] - uvAB[1] * uvAC[0];
    assert.ok(doubleUvArea > 0, 'Planar UV triangles must preserve winding.');
    assert.ok(Number.isFinite(doubleUvArea / doubleArea), 'Curve-domain UV must be nondegenerate, not falsely claimed isometric.');
    signedVolume += dot(a, cross(b, c)) / 6;
  }
  for (const { count, direction } of weldedEdges.values()) {
    assert.equal(count, 2, 'Panel seams must geometrically weld without holes or T-junctions.');
    assert.equal(direction, 0, 'Neighboring triangles must have consistent outward winding.');
  }

  const p = mesh.metadata.parameters;
  close(signedVolume, mesh.metadata.analyticWallVolume, .004 * mesh.metadata.analyticWallVolume);

  assert.equal(mesh.groups.length, 2);
  let nextStart = 0;
  for (const [i, group] of mesh.groups.entries()) {
    assert.equal(group.start, nextStart);
    assert.equal(group.materialIndex, i);
    assert.ok(group.count > 0 && group.count % 3 === 0);
    nextStart += group.count;
  }
  assert.equal(nextStart, mesh.indices.length, 'Groups must cover every index exactly once.');
  assert.equal(mesh.metadata.surfaces.length, 48);
  assert.equal(mesh.metadata.vertexCount, vertexCount);
  assert.equal(mesh.metadata.triangleCount, mesh.indices.length / 3);

  const xs = [], ys = [], zs = [];
  for (let i = 0; i < vertexCount; i += 1) {
    const [x, y, z] = position(mesh, i);
    xs.push(x); ys.push(y); zs.push(z);
  }
  close(Math.min(...xs), -p.width / 2);
  close(Math.max(...xs), p.width / 2);
  close(Math.min(...ys), p.bottom);
  close(Math.max(...ys), p.top);
  close(Math.min(...zs), p.zStart);
  close(Math.max(...zs), p.zStart + p.length);
  assert.ok(Math.min(...ys) >= p.bottom - 5e-6, 'No shell occupies mechanical space below bottom.');
}

function rayHits(mesh, origin, direction) {
  const hits = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = position(mesh, mesh.indices[i]);
    const b = position(mesh, mesh.indices[i + 1]);
    const c = position(mesh, mesh.indices[i + 2]);
    const ab = subtract(b, a);
    const ac = subtract(c, a);
    const h = cross(direction, ac);
    const determinant = dot(ab, h);
    if (Math.abs(determinant) < 1e-10) continue;
    const inverse = 1 / determinant;
    const relative = subtract(origin, a);
    const u = inverse * dot(relative, h);
    if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = cross(relative, ab);
    const v = inverse * dot(direction, q);
    if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const t = inverse * dot(ac, q);
    if (t >= 0 && !hits.some((hit) => Math.abs(hit - t) < 1e-5)) hits.push(t);
  }
  return hits.sort((a, b) => a - b);
}

const mesh = createRearShell();
validateGeometry(mesh);
assert.equal(mesh.metadata.dimensionalStatus, 'PARTIALLY_VERIFIED');
assert.equal(mesh.metadata.dimensionStatus, 'partial');
assert.equal(mesh.metadata.units, 'm; silhouette dimensions provisional');
assert.match(mesh.metadata.dimensionEvidence.width.applicability, /tender-specific fit remains provisional/);
assert.equal(mesh.metadata.parameters.width, 2.743);
assert.equal(mesh.metadata.parameters.zStart, 12.9);
assert.equal(mesh.metadata.sourceGeometryUsed, false);
assert.equal(mesh.metadata.sourceResidualsUsed, false);
assert.equal(mesh.metadata.containsCoal, false);
assert.deepEqual(mesh.metadata.sourceRuntimeDependencies, []);assert.deepEqual(mesh.metadata.runtimeDependencies, ['./surface-builder.mjs','./dimensions.mjs']);
assert.deepEqual(mesh.metadata.materialSlots, ['paint', 'black-rim']);
assert.deepEqual(mesh.metadata.materials, ['paint', 'blackPaint']);
assert.ok(mesh.metadata.openings.top && mesh.metadata.openings.bottom);
assert.ok(Object.isFrozen(defaultRearShellParameters));
assert.deepEqual(createRearShell(), mesh, 'Identical inputs must generate deterministic attributes.');

const p = mesh.metadata.parameters;
const centerZ = p.zStart + p.length / 2;
assert.equal(rayHits(mesh, [0, p.top + 1, centerZ], [0, -1, 0]).length, 0,
  'The center must remain open from above through the underside.');
const rimX = p.width / 2 - p.bevelInset - p.wallThickness / 2;
assert.ok(rayHits(mesh, [rimX, p.top + 1, centerZ], [0, -1, 0]).length > 0,
  'The top wall rim must be a visible geometric surface.');
assert.equal(rayHits(mesh, [0.11, p.bottom + 0.4, p.zStart - 1], [0, 0, 1]).length, 4,
  'Front and rear panels must have both outer and inset inner surfaces.');
assert.equal(rayHits(mesh, [-p.width, p.bottom + 0.4, centerZ + 0.03], [1, 0, 0]).length, 4,
  'Both sidewalls must have outer and inset inner surfaces.');

const expectedAxisNormals = {
  'outer-lower-0': [-1, 0, 0], 'outer-lower-4': [1, 0, 0],
  'outer-lower-6': [0, 0, -1], 'outer-lower-2': [0, 0, 1],
  'inner-lower-0': [1, 0, 0], 'inner-lower-4': [-1, 0, 0],
  'inner-lower-6': [0, 0, 1], 'inner-lower-2': [0, 0, -1],
};
for (const surface of mesh.metadata.surfaces) {
  const n = normal(mesh, surface.vertexStart);
  if (expectedAxisNormals[surface.name]) {
    expectedAxisNormals[surface.name].forEach((value, axis) => close(n[axis], value));
  }
  if (surface.name.startsWith('rolled-upper-rim-')) close(normal(mesh,surface.vertexStart+surface.vSegments/2)[1],1);
  if (surface.name.startsWith('bottom-wall-edge-')) close(n[1], -1);
  if (surface.name.startsWith('outer-bevel-')) assert.ok(n[1] > 0);
  if (surface.name.startsWith('inner-bevel-')) assert.ok(n[1] < 0);
}

// Every editable nominal dimension must drive actual generated geometry.
for (const [name, value] of Object.entries(defaultRearShellParameters)) {
  const edited = createRearShell({ [name]: value + 0.035 });
  validateGeometry(edited);
  assert.notDeepEqual(edited.positions, mesh.positions, `${name} must change positions.`);
  assert.deepEqual(edited.indices, mesh.indices, `${name} must preserve the fixed sampling topology.`);
  if (name !== 'zStart') assert.notDeepEqual(edited.uvs, mesh.uvs, `${name} must update planar UV extents.`);
  if (name === 'bevelHeight' || name === 'bevelInset') {
    assert.notDeepEqual(edited.normals, mesh.normals, `${name} must update bevel normals.`);
  }
}

const translated = createRearShell({ zStart: p.zStart + 2 });
assert.deepEqual(translated.normals, mesh.normals);
for (let i = 0; i < mesh.uvs.length; i += 1) close(translated.uvs[i], mesh.uvs[i], 1e-6);
const extremeButValid = createRearShell({ length: 9, width: 3.1, top: 4.6, bevelInset: 0.34, bevelHeight: 0.8, wallThickness: 0.09, cornerRadius:.52 });
validateGeometry(extremeButValid);
validateGeometry(createRearShell({ bevelInset: 0 }));
const overrides = { width: 3.0 };
assert.equal(createRearShell(overrides).metadata.dimensionStatus, 'unverified');
assert.deepEqual(overrides, { width: 3.0 }, 'Input parameter objects must not be mutated.');

for (const invalid of [
  null, [], { width: '3' }, { width: NaN }, { zStart: Infinity }, { width: 0 },
  { length: -1 }, { top: 1.6 }, { bevelHeight: 0 }, { bevelInset: -0.1 },
  { wallThickness: 0 }, { wallThickness: 1.3 }, { width: 0.4 }, { length: 0.4 },
  { unknownDimension: 1 }, { zStart: 1e30 },
]) {
  assert.throws(() => createRearShell(invalid), undefined, `Invalid parameters must reject: ${JSON.stringify(invalid)}`);
}

const runtimeSource = await readFile(new URL('../src/rear-shell.mjs', import.meta.url), 'utf8');
assert.match(runtimeSource,/surface-builder\.mjs/,'Native surfaces must share own sampler code.');
assert.doesNotMatch(runtimeSource, /\b(?:fetch|XMLHttpRequest|WebSocket|require)\s*\(/,
  'Runtime shell must not load source geometry or assets.');
assert.doesNotMatch(runtimeSource, /\b(?:readFile|readFileSync)\s*\(/);

console.log(JSON.stringify({
  passed: true,
  suite: 'student-native rear shell',
  vertices: mesh.metadata.vertexCount,
  triangles: mesh.metadata.triangleCount,
  analyticSurfacePatches: mesh.metadata.surfaces.length,
  materialGroups: mesh.groups,
  dimensionalStatus: mesh.metadata.dimensionalStatus,
  checks: [
    'finite typed attributes', 'valid nonzero triangles', 'unit analytic normals and winding',
    'nondegenerate analytic curve-domain UVs', 'welded wall-edge topology', 'signed volume versus independently integrated rounded/rolled wall formula', 'material coverage', 'parameter bounds',
    'open top and underbody', 'inner and outer walls', 'all dimension edits',
    'changed bevel normals', 'translation-stable UVs', 'invalid-input rejection',
    'zero source-data dependencies; shared native sampler/dimension modules only',
  ],
}, null, 2));
