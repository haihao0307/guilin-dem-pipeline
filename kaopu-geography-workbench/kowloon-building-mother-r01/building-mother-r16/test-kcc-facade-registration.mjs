import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {deriveKccFacadeRegistration,KCC_GENERALIZED_PLAN_OUTLINES} from './kcc-facade-registration.mjs';
import {KCC_OBSERVED_WINDOW_FAMILIES} from './kcc-observed-windows.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('./hk-three-buildings-r01/geometry/B359971994401063C0.score.json',import.meta.url))),source=deriveMeasuredCase(raw),before=JSON.stringify(source),registration=deriveKccFacadeRegistration(source),near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
assert.equal(JSON.stringify(source),before,'registration must not alter any source geometry');
assert.equal(source.sourceBounds.max[1],70.20300293);
assert.equal(registration.orientationVerified,false);assert.equal(registration.actualFFLVerified,false);assert.equal(registration.verticalGeometryAssigned,false);assert.equal(registration.sourceGeometryChanged,false);
assert.deepEqual(registration.candidates.map(c=>c.id),['R0','R180']);
const expected={R0:{lower:.3092713020452075,upper:.2981381266382793},R180:{lower:.4956114444446946,upper:.5007862235866678}};
let count=0;
for(const candidate of registration.candidates)for(const family of ['lower','upper']){
 const transform=candidate.transform[family],m=transform.matrixRow;
 near(candidate.residual[family].rmsM,expected[candidate.id][family]);
 near((m[0][0]*m[1][1]-m[0][1]*m[1][0])/transform.scaleMPerViewPixel**2,1);
 assert.equal(candidate.windowsByFamily[family].length,8);
 assert.equal(KCC_GENERALIZED_PLAN_OUTLINES[family].length,20);
 for(const w of candidate.windowsByFamily[family]){
  assert.equal(w.actualVerticalRangeM,null);assert.equal(w.actualWidthM,null);assert.ok(w.usable);
  assert.ok(w.startU>=w.hostURange[0]&&w.endU<=w.hostURange[1]&&w.endU>w.startU);
  assert.ok(w.projectionResidualM>=0&&w.projectionResidualM<.7);
  const observation=KCC_OBSERVED_WINDOW_FAMILIES[family].windows.find(o=>o.id===w.observationId);assert.ok(observation);
  const segment=observation.hostProjectedSegment,px=Math.hypot(segment[1][0]-segment[0][0],segment[1][1]-segment[0][1]);
  near(w.rawEndU-w.rawStartU,px*transform.scaleMPerViewPixel*Math.cos(w.angleDeg*Math.PI/180));
  const patch=source.patches.find(p=>p.sourcePatchId===w.sourcePatchId);
  for(const u of[w.startU,w.endU]){const p=patch.origin.map((x,i)=>x+patch.u[i]*u+patch.v[i]*12),distance=p.reduce((s,x,i)=>s+(x-patch.origin[i])*patch.n[i],0);near(distance,0);}
  count++;
 }
 assert.equal(candidate.generalizedEdges.length,20);
 assert.ok(candidate.unitWallEdgesByFamily[family].some(e=>!e.acceptedAsCoarseBoundaryProjection),'Interior/chamfer edges must not silently all become exterior walls');
}
const [a,b]=registration.candidates;
assert.ok(a.residual.lower.rmsM<b.residual.lower.rmsM);
assert.ok(a.residual.lower.concaveOnlyFit.rmsM>b.residual.lower.concaveOnlyFit.rmsM,'Control choice reverses best orientation');
near(a.residual.upper.concaveOnlyFit.rmsM,b.residual.upper.concaveOnlyFit.rmsM);
assert.notDeepEqual(a.transform.lower,a.transform.upper,'Independent floor-family registrations required');
assert.ok(b.windowsByFamily.lower.some(w=>w.endpointClippedM>.4),'Material projection clipping must remain disclosed');
assert.throws(()=>deriveKccFacadeRegistration({...source,sourceModelId:'wrong'}),/KCC/);
const damaged=structuredClone(source);damaged.patches[0].loops[0].push([0,0]);assert.throws(()=>deriveKccFacadeRegistration(damaged),/20-point/);
console.log(JSON.stringify({passed:true,windowProjectionCases:count,sourceHeightUnchanged:source.sourceBounds.max[1],candidates:2,familiesIndependentlyFitted:2,orientationUnresolved:true,actualVerticalGeometryAssigned:false,modelTriangles:0}));
