const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = require('../src/policy.js');
const platform = JSON.parse(fs.readFileSync(path.join(__dirname, '../platform.json'), 'utf8'));
function fixture() {
  return {
    runtime: {topology: 'fixed-full-grid', triangleStride: 1, materialMultiplier: 1, maxDpr: 1},
    rules: {lodEnabled: false, textureSamplingEnabled: false, geometryCameraDependent: false,
            geometryDeviceDependent: false, motionQualitySwitching: false},
    sample: {fixedSubdivision: 1},
    displacementBudget: {sourceNodeMaxErrorM: 0, peakShiftMaxM: 0}
  };
}
const seg = (x0, x1, y0=0, y1=0) => ({x0, y0, z0: 0, x1, y1, z1: 0});
test('valid fixed numeric contract', () => assert.equal(p.validateContract(fixture()), true));
test('each prohibited runtime flag is rejected', () => {
  for (const k of Object.keys(fixture().rules)) {
    const c=fixture(); c.rules[k]=true; assert.throws(() => p.validateContract(c), /PURE_NUMERIC_GATE/);
  }
});
test('quality tiers cannot return', () => {
  const c=fixture(); c.runtimeTiers={}; assert.throws(() => p.validateContract(c));
});
test('device-dependent geometry cannot return', () => {
  for (const k of ['desktopSubdivision','mobileSubdivision','desktopRenderGrid','mobileRenderGrid']) {
    const c=fixture(); c.sample[k]=2; assert.throws(() => p.validateContract(c));
  }
});
test('source anchors and peak position stay protected', () => {
  for (const k of ['sourceNodeMaxErrorM','peakShiftMaxM']) {
    const c=fixture(); c.displacementBudget[k]=1e-9; assert.throws(() => p.validateContract(c));
  }
});
test('every grid cell has two triangles', () => {
  for (const n of [2,3,17,33]) {
    const a=p.buildGridIndices(n); assert.equal(a.length, 6*(n-1)**2);
    assert.equal(new Set(a).size,n*n);
  }
});
test('over-budget grid throws without a lower-resolution fallback', () => {
  assert.throws(() => p.buildGridIndices(10000), /budget/);
  for (const n of [0,1,2.5,NaN]) assert.throws(() => p.buildGridIndices(n));
});
test('identical numeric indices give identical signatures', () => {
  assert.equal(p.indexSignature(p.buildGridIndices(33)),p.indexSignature(p.buildGridIndices(33)));
});
test('128 explicitly simulated observations stay fixed', () => {
  const a=p.buildGridIndices(17);
  const f={grid:17,spacing:1,indexSignature:p.indexSignature(a),triangleCount:a.length/3,materialMultiplier:1,maxDpr:1};
  assert.equal(p.checkFrameInvariants(Array.from({length:128},()=>({...f}))),true);
});
test('any changed frame invariant is rejected', () => {
  const f={grid:17,spacing:1,indexSignature:'fixture',triangleCount:512,materialMultiplier:1,maxDpr:1};
  for (const k of Object.keys(f)) {const b={...f,[k]:k==='indexSignature'?'different':f[k]+1};
    assert.throws(()=>p.checkFrameInvariants([f,b]));}
});
test('separate river components remain separate', () => {
  const data=[seg(-50,-10),seg(10,50)],before=JSON.stringify(data);
  const r=p.auditRiverSegments(data,100);
  assert.equal(r.componentCount,2); assert.equal(r.internalDegreeOneEndpoints.length,2);
  assert.equal(JSON.stringify(data),before); assert.equal(r.continuityPass,false);
});
test('near endpoints are never silently snapped', () => {
  assert.equal(p.auditRiverSegments([seg(-50,0),seg(1e-8,50)],100).componentCount,2);
});
test('connected centerlines do not approve the final water surface', () => {
  const r=p.auditRiverSegments([seg(-50,0),seg(0,50)],100);
  assert.equal(r.componentCount,1); assert.equal(r.visualGapCount,null);
  assert.equal(r.sourceIdsAndTerminiVerified,false); assert.equal(r.finalMeshContinuityVerified,false);
});
test('invalid values and inconsistent heights are exposed', () => {
  const r=p.auditRiverSegments([seg(-50,0),seg(0,50,1,1),seg(NaN,20)],100);
  assert.equal(r.invalidSegments,1); assert.equal(r.heightDisagreementCount,1);
});
test('independent core loads no regional datasets or old runtime', () => {
  assert.equal(platform.scope.independentProject,true);
  assert.equal(platform.scope.regionalDataAutoImport,false);
  assert.deepEqual(platform.scope.boundSourceAssets,[]);
  assert.equal(platform.asset.runtimeEntry,null); assert.equal(platform.asset.publicationEnabled,false);
});
test('no scene approval is inferred from cleanup or unit tests', () => {
  for (const v of Object.values(platform.approvals)) assert.equal(v,false);
  for (const k of ['realDemBuilt','browserExecuted','performanceMeasured','riverContinuityVerified'])
    assert.equal(platform.evidence[k],false);
});
