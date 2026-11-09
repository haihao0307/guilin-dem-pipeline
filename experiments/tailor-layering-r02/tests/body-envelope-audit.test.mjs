import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {auditBodyEnvelope, createBodyEnvelopeAudit, pointTriangleDistance, finiteSegmentDistance} from './body-envelope-audit.mjs';

const close = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const surface = (positions, thickness = .006) => ({id: 'cloth', positions: Float64Array.from(positions), triangles: new Uint32Array([0, 1, 2]), thickness});
const body = positions => ({positions: Float64Array.from(positions), faces: new Uint32Array([0, 1, 2])});

test('independent point/triangle distance includes interior and finite edge regions', () => {
  const triangle = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  const interior = pointTriangleDistance([.2, .3, .003], triangle);
  close(Math.sqrt(interior.distanceSquared), .003);
  interior.bary.forEach((b, i) => close(b, [.5, .2, .3][i]));
  close(Math.sqrt(pointTriangleDistance([2, 0, 0], triangle).distanceSquared), 1);
});

test('independent finite segment distance covers interior, parallel, endpoint and degenerate cases', () => {
  const cases = [
    [[-1, 0, 0], [1, 0, 0], [0, -1, .002], [0, 1, .002], .002],
    [[0, 0, 0], [1, 0, 0], [.2, .001, 0], [.8, .001, 0], .001],
    [[0, 0, 0], [1, 0, 0], [2, 1, 0], [2, 2, 0], Math.sqrt(2)],
    [[0, 0, 0], [0, 0, 0], [-1, 0, .003], [1, 0, .003], .003],
    [[-1, 0, 0], [1, 0, 0], [-1, -1e-8, .001], [1, 1e-8, .001], .001],
  ];
  for (const [a, b, c, d, expected] of cases) close(Math.sqrt(finiteSegmentDistance(a, b, c, d).distanceSquared), expected);
});

test('reverse body vertex to cloth interior exposes a half-thickness violation missed by seven sample points', () => {
  const cloth = surface([-1, -1, .010, 1, -1, .010, 0, 1, .010]);
  const actualBody = body([0, 0, .008, -1, -1, 0, 1, -1, 0]);
  const triangle = Array.from({length: 3}, (_, i) => Array.from(actualBody.positions.slice(i * 3, i * 3 + 3)));
  const seven = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1 / 3, 1 / 3, 1 / 3]];
  for (const bary of seven) {
    const p = [0, 1, 2].map(d => bary.reduce((sum, b, i) => sum + b * cloth.positions[i * 3 + d], 0));
    assert.ok(Math.sqrt(pointTriangleDistance(p, triangle).distanceSquared) > cloth.thickness / 2);
  }
  const before = cloth.positions.slice(), audit = auditBodyEnvelope([cloth], actualBody);
  assert.deepEqual(cloth.positions, before);
  assert.equal(audit.hasHalfThicknessOverlap, true); close(audit.maxHalfThicknessOverlapMM, 1);
  assert.equal(audit.samples[0].kind, 'body-vertex/cloth-face');
});

test('all six unmodified actual-native VF and EE witnesses retain their independently measured distances', async () => {
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/body-envelope-native-witnesses.json', import.meta.url)));
  for (const c of fixture.cases) {
    const cloth = {...c.cloth, id: c.name}, before = JSON.stringify(cloth);
    const audit = auditBodyEnvelope([cloth], c.body);
    close(audit.garments[0].minimumDistanceWithinEnvelopeMM, c.expected.distanceMM, 1e-8);
    close(audit.maxHalfThicknessOverlapMM, c.expected.envelopeOverlapMM, 1e-8);
    assert.equal(audit.violatingClothTriangles, 1);
    assert.equal(audit.scope.completeForInputTriangles, true);
    assert.equal(JSON.stringify(cloth), before);
  }
});

test('crossing triangle interiors have zero distance even when the intersection is not a vertex', () => {
  const cloth = surface([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
  const actualBody = body([0, -.5, -.03, 0, -.5, .03, 0, .5, .03]);
  const audit = auditBodyEnvelope([cloth], actualBody);
  close(audit.maxHalfThicknessOverlapMM, 3);
  assert.equal(audit.samples[0].kind, 'middle-surface-intersection');
  close(audit.garments[0].minimumDistanceWithinEnvelopeMM, 0);
});

test('static body snapshot prevents stale BVH after input mutation and searches multiple leaves', () => {
  const actualBody = {positions: new Float64Array([20, 20, 20, 21, 20, 20, 20, 21, 20, 0, 0, .008, -1, -1, 0, 1, -1, 0]), faces: new Uint32Array([0, 1, 2, 3, 4, 5])};
  const auditor = createBodyEnvelopeAudit(actualBody, {leafSize: 1});
  const cloth = surface([-1, -1, .010, 1, -1, .010, 0, 1, .010]);
  const before = auditor.measure([cloth]); actualBody.positions.fill(999); actualBody.faces.fill(0);
  const after = auditor.measure([cloth], {sampleLimit: 0});
  assert.equal(before.samples[0].bodyTriangle, 1);
  close(before.maxHalfThicknessOverlapMM, after.maxHalfThicknessOverlapMM);
  assert.equal(after.violatingClothTriangles, 1); assert.deepEqual(after.samples, []);
  for (let i = 2; i < cloth.positions.length; i += 3) cloth.positions[i] = 10;
  const far = auditor.measure([cloth]);
  assert.equal(far.hasHalfThicknessOverlap, false); assert.equal(far.maxHalfThicknessOverlapMM, 0);
  assert.equal(far.garments[0].minimumDistanceWithinEnvelopeMM, null);
  assert.equal(far.scope.minimumOutsideSearchRadiusCertified, false);
});

test('degenerate geometry prevents a complete certificate and invalid indices are not truncated', () => {
  const cloth = surface([0, 0, .001, 0, 0, .001, 0, 0, .001]);
  const audit = auditBodyEnvelope([cloth], body([-1, -1, 0, 1, -1, 0, 0, 1, 0]));
  assert.equal(audit.degenerateTriangles, 1); assert.equal(audit.scope.completeForInputTriangles, false);
  assert.throws(() => createBodyEnvelopeAudit({positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], faces: [0, .5, 2]}), /invalid triangle index/);
  assert.throws(() => createBodyEnvelopeAudit({positions: [], faces: []}), /Nonempty actual body/);
});
