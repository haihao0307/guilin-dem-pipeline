import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SCALP_LOCK, fiberSection, opticalPathBudget, xpbdDistance, linearAnisotropicDrag, allocationWeight, readF03Attachment } from '../fiber-probes.mjs';
const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const props = { diameterM: 70e-6, lengthM: .1, youngPa: 3e9, densityKgM3: 1300 }; // chosen fixture, NOT measured hair
const opticalSum = q => q.R + q.TT + q.TRT + q.higher;
test('scalar path model: lossless fiber conserves energy', () => {
  for (const f of [0, .04, .5, .99, 1]) near(opticalSum(opticalPathBudget(f, 0)), 1);
});
test('scalar path model: absorptive cases remain nonnegative and bounded', () => {
  for (const f of [0, .04, .5, .999999, 1]) for (const tau of [0, .2, 2, 80, 1000]) {
    const q = opticalPathBudget(f, tau);
    assert.ok(Object.values(q).every(x => Number.isFinite(x) && x >= 0));
    assert.ok(opticalSum(q) <= 1 + 1e-12); near(opticalSum(q) + q.absorbed, 1);
  }
});
test('absorption attenuates internal paths, not prescribed surface R', () => {
  const a = opticalPathBudget(.04, .1), b = opticalPathBudget(.04, 2);
  near(a.R, b.R); assert.ok(b.TT < a.TT && b.TRT < a.TRT && b.absorbed > a.absorbed);
});
test('optical probe rejects invalid inputs', () => {
  for (const [f, tau] of [[-1, 0], [2, 0], [NaN, 0], [.04, -1], [.04, Infinity]]) assert.throws(() => opticalPathBudget(f, tau));
});
test('circular section: doubling diameter multiplies EI by 16 and mass by 4', () => {
  const a = fiberSection(props), b = fiberSection({ ...props, diameterM: props.diameterM * 2 });
  near(b.bendingRigidityNm2 / a.bendingRigidityNm2, 16); near(b.massKg / a.massKg, 4);
});
test('section length changes mass/compliance, not cross-section EI', () => {
  const a = fiberSection(props), b = fiberSection({ ...props, lengthM: props.lengthM * 2 });
  near(b.massKg / a.massKg, 2); near(b.axialComplianceMPerN / a.axialComplianceMPerN, 2);
  near(b.bendingRigidityNm2 / a.bendingRigidityNm2, 1);
});
test('section refuses zero diameter and unphysical input', () => {
  for (const [key, value] of [['diameterM', 0], ['youngPa', -1], ['lengthM', NaN], ['densityKgM3', Infinity]]) assert.throws(() => fiberSection({ ...props, [key]: value }));
});
test('XPBD isolated hard constraint keeps pinned root exactly fixed', () => {
  const q = xpbdDistance([0, 0, 0], [2, 0, 0], 0, 1, 1, 0, 1 / 120);
  assert.deepEqual(q.a, [0, 0, 0]); near(q.b[0], 1); near(q.residualM, 0);
});
test('XPBD isolated projection gives symmetric corrections for equal masses', () => {
  const q = xpbdDistance([0, 0, 0], [2, 0, 0], 1, 1, 1, 0, 1 / 120);
  near(q.a[0], .5); near(q.b[0], 1.5);
});
test('XPBD compliance uses dt squared; isolated analytic residual agrees', () => {
  for (const dt of [1 / 60, 1 / 120, 1 / 240]) {
    const alpha = 1e-4, scaled = alpha / dt ** 2;
    const q = xpbdDistance([0, 0, 0], [2, 0, 0], 0, 1, 1, alpha, dt);
    near(q.residualM, scaled / (1 + scaled));
  }
});
test('XPBD retains multiplier between iterations of the SAME projection step', () => {
  const a = xpbdDistance([0, 0, 0], [2, 0, 0], 0, 1, 1, 1e-4, 1 / 120);
  const b = xpbdDistance(a.a, a.b, 0, 1, 1, 1e-4, 1 / 120, a.lambda);
  near(a.b[0], b.b[0]); near(a.lambda, b.lambda);
});
test('XPBD both pinned reports unsolved residual, not a fabricated correction', () => {
  const q = xpbdDistance([0, 0, 0], [2, 0, 0], 0, 0, 1, 0, 1 / 120);
  assert.equal(q.constrained, false); near(q.residualM, 1);
});
test('XPBD rejects zero timestep and degenerate direction', () => {
  assert.throws(() => xpbdDistance([0, 0, 0], [1, 0, 0], 0, 1, 1, 0, 0));
  assert.throws(() => xpbdDistance([0, 0, 0], [0, 0, 0], 0, 1, 1, 0, .01));
});
test('linear diagnostic drag distinguishes longitudinal and transverse motion', () => {
  near(linearAnisotropicDrag([1, 0, 0], [1, 0, 0], 1, 3)[0], -1);
  near(linearAnisotropicDrag([0, 1, 0], [1, 0, 0], 1, 3)[1], -3);
});
test('linear diagnostic drag cannot add energy in the relative-velocity frame', () => {
  for (const v of [[1, 2, 3], [-2, .1, 0], [0, 0, 0]]) {
    const f = linearAnisotropicDrag(v, [1, 1, 0], .1, 2);
    assert.ok(f.reduce((sum, x, i) => sum + x * v[i], 0) <= 1e-12);
  }
});
test('drag rejects degenerate tangent and negative damping', () => {
  assert.throws(() => linearAnisotropicDrag([1, 0, 0], [0, 0, 0], 1, 1));
  assert.throws(() => linearAnisotropicDrag([1, 0, 0], [1, 0, 0], -1, 1));
});
test('continuous importance response is monotone and bounded', () => {
  const values = [0, .001, .01, 1, 10, 1000].map(x => allocationWeight(x, 1));
  near(values[0], 0); assert.ok(values.every(x => x >= 0 && x < 1));
  assert.ok(values.slice(1).every((x, i) => x > values[i]));
  assert.ok(allocationWeight(1, 2) < allocationWeight(1, 1));
});
test('F03 synthetic adapter fixture preserves input without moving roots', () => {
  const g = { rootId: 7, face: 10, barycentric: [.2, .3, .5] }, before = JSON.stringify(g);
  const q = readF03Attachment(g, SCALP_LOCK);
  assert.equal(JSON.stringify(g), before); assert.deepEqual(q.barycentric, g.barycentric);
  assert.notEqual(q.barycentric, g.barycentric); assert.ok(Object.isFrozen(q));
});
test('F03 adapter refuses changed scalp and invalid root binding', () => {
  assert.throws(() => readF03Attachment({ rootId: 0, face: 1, barycentric: [.2, .2, .2] }, SCALP_LOCK));
  assert.throws(() => readF03Attachment({ rootId: 0, face: 1, barycentric: [0, 0, 1] }, 'wrong'));
});
test('example dense position/velocity memory accounting excludes all other buffers', () => {
  near(100000 * 32 * 2 * 4 * 4 / 1024 ** 2, 97.65625);
});
const locks = {
  'BoundaryKernel.mjs': '63f14cd5309644dd648fce8ed049aa534498c251d6526daf7747591659d113ff',
  'EarClearance.mjs': '5f75a237e85141345b5361329e803d9cb375bb9a2e2865eb06c1b1a44c2ff52d',
  'F02Boundary.mjs': 'cab4578bddbe13c3c27437f664c9a6deede7eb7e8697e3b625aa7090cf9106bc',
  'LegacyFoundation.mjs': '29696d709c9cda1d7c0680ee5674e111b3d8dc27d4251163d09db9f2965582db'
};
for (const [file, expected] of Object.entries(locks)) {
  const url = new URL(`../../../foundation/f03/src/approved/${file}`, import.meta.url);
  const missing = !existsSync(url);
  test(`approved F02.1 source hash: ${file}`, { skip: missing && process.env.REQUIRE_BASELINE !== '1' ? 'requires repository baseline checkout; mandatory in CI' : false }, () => {
    assert.equal(createHash('sha256').update(readFileSync(url)).digest('hex'), expected);
  });
}
