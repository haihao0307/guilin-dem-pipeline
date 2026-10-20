import test from 'node:test';
import assert from 'node:assert/strict';
import { LayerContact } from '../src/layer-contact.mjs';

const options = { contactMargin: 0, searchMargin: 0.02, maxCorrection: 0.1, cellSize: 0.05 };
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

function fixture({ pointMass = 1, triangleMass = [1, 1, 1], z = 0.002 } = {}) {
  return [
    { id: 'shirt', positions: new Float64Array([0.25, 0.25, z]), triangles: new Uint32Array(), inverseMass: new Float64Array([pointMass]), thickness: 0.01 },
    { id: 'coat', positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), triangles: new Uint32Array([0, 1, 2]), inverseMass: new Float64Array(triangleMass), thickness: 0.01 },
  ];
}

test('mass-weighted contact distributes reaction across both independent garments', () => {
  const [a, b] = fixture({ pointMass: 2, triangleMass: [1, 0.5, 0.25] });
  const initialA = a.positions.slice(), initialB = b.positions.slice();
  const bary = [0.5, 0.25, 0.25];
  const denominator = 2 + 0.5 ** 2 + 0.25 ** 2 * 0.5 + 0.25 ** 2 * 0.25;
  const multiplier = 0.008 / denominator;
  const out = new LayerContact(options).solve([a, b], { passes: 1 });
  near(a.positions[2] - initialA[2], 2 * multiplier);
  for (let i = 0; i < 3; i++) near(b.positions[i * 3 + 2] - initialB[i * 3 + 2], -b.inverseMass[i] * bary[i] * multiplier);
  near(out.maxCorrectedPenetration, 0.008);
  assert.equal(out.contactCount, 1);
  assert.equal(out.correctionCount, 1);
  assert.notEqual(a.positions.buffer, b.positions.buffer);
  const beforeSampleMutation = a.positions.slice();
  out.sampleContactPoints[0].pointA[2] = 99;
  assert.deepEqual(a.positions, beforeSampleMutation);
  assert.throws(() => new LayerContact(options).solve([a, { ...a, id: 'aliased' }]), /share mutable positions/);
});

test('fixed points remain fixed; fully immovable penetration is reported as residual', () => {
  const [a, b] = fixture({ pointMass: 0 });
  const initialA = a.positions.slice();
  new LayerContact(options).solve([a, b], { passes: 1 });
  assert.deepEqual(a.positions, initialA);
  assert.ok(b.positions.some((value, index) => index % 3 === 2 && value < 0));

  const fixed = fixture({ pointMass: 0, triangleMass: [0, 0, 0] });
  const out = new LayerContact(options).solve(fixed, { passes: 1 });
  assert.equal(out.correctionCount, 0);
  assert.equal(out.immovableContactCount, 1);
  assert.equal(out.residualCount, 1);
  near(out.residualMaxPenetration, 0.008);
});

test('previous surface side restores a shallow crossed vertex without global layer offsets', () => {
  const [a, b] = fixture({ triangleMass: [0, 0, 0], z: -0.002 });
  a.previous = new Float64Array([0.25, 0.25, 0.004]);
  const previousCopy = a.previous.slice();
  const out = new LayerContact(options).solve([a, b], { passes: 1 });
  near(a.positions[2], 0.01);
  assert.deepEqual(a.previous, previousCopy);
  assert.equal(out.residualCount, 0);
  assert.equal(out.continuousCollision, false);
  assert.equal(out.edgeEdgeCollision, false);
});

test('disabling or removing a garment produces no ghost collisions; reset clears side history', () => {
  const solver = new LayerContact(options), [a, b] = fixture({ triangleMass: [0, 0, 0] });
  solver.solve([a, b]);
  a.positions[2] = -0.002;
  const removed = solver.solve([a]);
  near(a.positions[2], -0.002);
  assert.equal(removed.contactCount, 0);
  assert.equal(removed.residualCount, 0);
  const disabled = solver.solve([a, { ...b, enabled: false }]);
  near(a.positions[2], -0.002);
  assert.equal(disabled.contactCount, 0);
  solver.reset();
  solver.solve([a, b], { passes: 1 });
  near(a.positions[2], -0.01);
});

test('friction damps tangential relative displacement and preserves prior state', () => {
  const still = fixture({ triangleMass: [0, 0, 0] });
  const frictional = fixture({ triangleMass: [0, 0, 0] });
  for (const [a] of [still, frictional]) {
    a.previous = a.positions.slice();
    a.positions[0] += 0.003;
  }
  new LayerContact(options).solve(still, { passes: 1, friction: 0 });
  new LayerContact(options).solve(frictional, { passes: 1, friction: 1 });
  near(still[0].positions[0], 0.253);
  near(frictional[0].positions[0], 0.25);
  near(frictional[0].previous[0], 0.25);
});

test('surface contact responds where vertex-only distance would miss, with finite state and balanced displacement', () => {
  const a = { id: 'inner', positions: new Float32Array([0.2, 0.2, 0.002, 0.6, 0.2, 0.002, 0.2, 0.6, 0.002]), triangles: new Uint32Array([0, 1, 2]), thickness: 0.01 };
  const b = { id: 'outer', positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), triangles: new Uint32Array([0, 1, 2]), thickness: 0.01 };
  const solver = new LayerContact(options);
  const sumZ = () => [...a.positions, ...b.positions].reduce((sum, value, i) => sum + (i % 3 === 2 ? value : 0), 0);
  const before = sumZ();
  const first = solver.solve([a, b], { passes: 2 });
  assert.ok(first.contactCount > 0);
  near(sumZ(), before, 1e-8);
  assert.ok(b.positions.some((value, i) => i % 3 === 2 && value !== 0));
  for (let i = 0; i < 25; i++) {
    const result = solver.solve([a, b], { passes: 2 });
    assert.ok(Number.isFinite(result.residualMaxPenetration));
    assert.ok([...a.positions, ...b.positions].every(Number.isFinite));
  }
  const invalid = { ...a, id: 'invalid', positions: new Float64Array([NaN, 0, 0]), triangles: new Uint32Array() };
  assert.throws(() => solver.solve([invalid, b]), /nonfinite/);
  assert.throws(() => solver.solve([a, { ...b, id: a.id }]), /Duplicate/);
});

test('finite search neighbourhood deliberately makes no deep-intersection claim', () => {
  const [a, b] = fixture({ triangleMass: [0, 0, 0], z: -0.1 });
  a.previous = new Float64Array([0.25, 0.25, 0.1]);
  const out = new LayerContact(options).solve([a, b]);
  near(a.positions[2], -0.1);
  assert.equal(out.contactCount, 0);
  assert.match(out.residualScope, /bounded discrete/);
  assert.equal(out.continuousCollision, false);
});

test('read-only measurement observes real residual without changing cloth or previous state', () => {
  const rows = fixture();
  rows[0].previous = rows[0].positions.slice();
  const before = rows.map(row => row.positions.slice());
  const previous = rows[0].previous.slice();
  const solver = new LayerContact(options);
  const out = solver.measure(rows);
  near(out.residualMaxPenetration, 0.008);
  assert.equal(out.residualCount, 1);
  assert.equal(out.correctionCount, 0);
  assert.equal(out.measurementOnly, true);
  rows.forEach((row, i) => assert.deepEqual(row.positions, before[i]));
  assert.deepEqual(rows[0].previous, previous);
});
