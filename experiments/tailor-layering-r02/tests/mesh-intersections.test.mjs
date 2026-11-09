import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMeshIntersections} from './mesh-intersections.mjs';

const mesh = (id, points, indices = [0, 1, 2]) => ({id, positions: new Float64Array(points.flat()), indices: Uint32Array.from(indices)});

test('independent segment/triangle audit detects crossings without a vertex containment test', () => {
  const a = mesh('inner', [[-2, -1, 0], [2, -1, 0], [0, 2, 0]]);
  const b = mesh('outer', [[0, -3, -2], [0, 3, -2], [0, 0, 3]]);
  const before = [a.positions.slice(), b.positions.slice(), a.indices.slice(), b.indices.slice()];
  const result = auditMeshIntersections([a, b]);
  assert.equal(result.properCrossingTrianglePairs, 1);
  assert.equal(result.coplanarOverlapTrianglePairs, 0);
  assert.equal(result.hasReportedIntersections, true);
  assert.ok(result.samples[0].points.length >= 2);
  assert.ok(result.samples[0].witnesses.some(row => row.direction === 'a-to-b'));
  assert.ok(result.samples[0].witnesses.some(row => row.direction === 'b-to-a'));
  assert.deepEqual(a.positions, before[0]); assert.deepEqual(b.positions, before[1]);
  assert.deepEqual(a.indices, before[2]); assert.deepEqual(b.indices, before[3]);
});

test('parallel separated sheets remain distinct and thickness is not falsely certified', () => {
  const a = mesh('inner', [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  const b = mesh('outer', [[0, 0, .001], [1, 0, .001], [0, 1, .001]]);
  const result = auditMeshIntersections([a, b]);
  assert.equal(result.hasReportedIntersections, false);
  assert.equal(result.touchingTrianglePairs, 0);
  assert.equal(result.scope.thicknessClearanceChecked, false);
});

test('a transverse intersection aligned with an existing shared mesh edge is not silently treated as free', () => {
  const a = mesh('a', [[0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0]], [0, 1, 2, 1, 0, 3]);
  const b = mesh('b', [[0, -2, -1], [0, 2, -1], [0, 0, 2]]);
  const result = auditMeshIntersections([a, b]);
  assert.equal(result.properCrossingTrianglePairs, 0);
  assert.equal(result.boundaryCurveTrianglePairs, 2);
  assert.equal(result.hasReportedIntersections, true);
  assert.equal(result.scope.noncoplanarBoundaryCurvesIncluded, true);
});

test('positive-area coplanar overlap is included even with reversed triangle winding', () => {
  const a = mesh('a', [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  const b = mesh('b', [[.2, .2, 0], [1.2, .2, 0], [.2, 1.2, 0]], [0, 2, 1]);
  const result = auditMeshIntersections([a, b]);
  assert.equal(result.properCrossingTrianglePairs, 0);
  assert.equal(result.coplanarOverlapTrianglePairs, 1);
  assert.ok(Math.abs(result.samples[0].areaM2 - .18) < 1e-10);
  assert.equal(result.scope.coplanarPositiveAreaOverlapIncluded, true);
});

test('boundary-only touching is reported separately from a through-surface crossing', () => {
  const a = mesh('a', [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  const b = mesh('b', [[1, 0, 0], [2, 0, 0], [1, 1, 0]]);
  const result = auditMeshIntersections([a, b]);
  assert.equal(result.properCrossingTrianglePairs, 0);
  assert.equal(result.coplanarOverlapTrianglePairs, 0);
  assert.equal(result.touchingTrianglePairs, 1);
});

test('degenerate triangles cannot silently produce a complete no-intersection claim', () => {
  const a = mesh('degenerate', [[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
  const b = mesh('other', [[0, 0, -1], [0, 1, 0], [0, 0, 1]]);
  const result = auditMeshIntersections([a, b]);
  assert.equal(result.degenerateTriangles, 1);
  assert.equal(result.scope.completeForInputTriangles, false);
  assert.equal(result.scope.degenerateTrianglesExcluded, true);
});

test('separate AABB tree reaches every crossing across leaves and bounds samples', () => {
  const aPoints = [], bPoints = [], indices = [];
  for (let i = 0; i < 18; i++) {
    const x = i * 10;
    aPoints.push([x - 2, -1, 0], [x + 2, -1, 0], [x, 2, 0]);
    bPoints.push([x, -3, -2], [x, 3, -2], [x, 0, 3]);
    indices.push(i * 3, i * 3 + 1, i * 3 + 2);
  }
  const result = auditMeshIntersections([mesh('a', aPoints, indices), mesh('b', bPoints, indices)], {sampleLimit: 4, leafSize: 2});
  assert.equal(result.properCrossingTrianglePairs, 18);
  assert.equal(result.samples.length, 4);
  assert.equal(result.candidateTrianglePairs, 18);
  const reversed = auditMeshIntersections([mesh('b', bPoints, indices), mesh('a', aPoints, indices)], {sampleLimit: 0});
  assert.equal(reversed.properCrossingTrianglePairs, 18);
  assert.equal(reversed.samples.length, 0);
});
