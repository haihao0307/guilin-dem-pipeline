import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auditMeshIntersections} from './mesh-intersections.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const asBytes = value => Buffer.from(value.buffer, value.byteOffset, value.byteLength);

/** Inspect the actual application Worker output with the native init body.
 * This consumes observation copies. It does not invoke the application solver,
 * generate a substitute body, mutate geometry, or make a yarn-level claim.
 */
export function auditObservedGeometry({body, snapshot, epsilon = 1e-7, sampleLimit = 64}) {
  assert.ok(body?.positions?.length > 3000 && body?.faces?.length > 3000,
    'Geometry acceptance requires the full current native init body');
  assert.ok(Array.isArray(snapshot?.rows) && snapshot.rows.length > 0,
    'Geometry acceptance requires a real Worker snapshot');
  assert.ok(Number.isInteger(snapshot.audit?.completedSteps));
  assert.ok(Number.isFinite(snapshot.audit?.simulationSeconds));
  const bodyPositions = Float32Array.from(body.positions), bodyIndices = Uint32Array.from(body.faces);
  const bodyID = '__actual_native_body__';
  assert.ok(snapshot.rows.every(row => row.id !== bodyID));
  const meshes = snapshot.rows.map(row => ({id: row.id, positions: row.positions, indices: row.indices}));
  const intersections = auditMeshIntersections([...meshes,
    {id: bodyID, positions: bodyPositions, indices: bodyIndices}], {epsilon, sampleLimit});
  const totals = pairs => ({
    properCrossingTrianglePairs: pairs.reduce((sum, row) => sum + row.properCrossingTrianglePairs, 0),
    boundaryCurveTrianglePairs: pairs.reduce((sum, row) => sum + row.boundaryCurveTrianglePairs, 0),
    coplanarOverlapTrianglePairs: pairs.reduce((sum, row) => sum + row.coplanarOverlapTrianglePairs, 0),
    touchingTrianglePairs: pairs.reduce((sum, row) => sum + row.touchingTrianglePairs, 0),
  });
  return {schema: 'kaopu-observed-world-geometry@1',
    source: 'Read-only copies of original Worker init body and actual response rows',
    requestID: snapshot.id, completedSteps: snapshot.audit.completedSteps,
    simulationSeconds: snapshot.audit.simulationSeconds,
    body: {vertices: bodyPositions.length / 3, triangles: bodyIndices.length / 3,
      positionsFloat32SHA256: sha256(asBytes(bodyPositions)), topologyUint32SHA256: sha256(asBytes(bodyIndices)),
      coordinateSystem: 'Y-up metres, [native x, native z, -native y], without a second ground shift',
      shaScope: 'Numeric observation re-encoded as Float32 positions and Uint32 indices; original native identity is recorded by baseline capture'},
    garmentIDs: meshes.map(mesh => mesh.id),
    garmentPairs: totals(intersections.pairs.filter(row => row.a !== bodyID && row.b !== bodyID)),
    bodyPairs: totals(intersections.pairs.filter(row => row.a === bodyID || row.b === bodyID)),
    intersections,
    scope: {currentNativeInitBody: true, independentTriangleChecker: true,
      bodyAndGarmentCrossings: true, wholeClothInsideBodyChecked: false,
      thicknessClearanceChecked: false, selfIntersectionsChecked: false,
      continuousTimeChecked: false, individualYarnsChecked: false,
      note: 'No reported surface crossings alone cannot rule out a fully enclosed cloth patch; combine with full vertex/body distance measurements and explicit material-envelope residuals.'}};
}

export function assertNoObservedCrossings(report) {
  assert.equal(report.intersections.degenerateTriangles, 0,
    'Degenerate input triangles prevent a complete discrete surface test');
  assert.equal(report.intersections.hasReportedIntersections, false,
    'Independent discrete geometry found cloth/cloth or cloth/body surface intersections');
  assert.equal(report.intersections.scope.allNondegenerateInputTrianglePairsCovered, true);
  return report;
}
