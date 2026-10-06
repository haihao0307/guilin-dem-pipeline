import test from 'node:test';
import assert from 'node:assert/strict';
import {createExample,validate,cut,ClothLab,clone,fingerprint} from '../src/core.mjs';
const run=(lab,n)=>{for(let i=0;i<n;i++)lab.step();return lab.metrics();};
test('original flat material: 2 panels, immutable mm rest metric, allowances are material',()=>{
  const s=createExample(),r=validate(s),batch=cut(s),lab=new ClothLab(batch);
  assert.equal(r.panelCount,2);assert.equal(r.vertexCount,374);assert.equal(r.triangleCount,640);
  assert.ok(Object.isFrozen(batch.spec.panels[0].uvMm[0]));assert.equal(batch.spec.panels[0].seamAllowanceMm,10);
  assert.ok(lab.metrics().maxPrincipalStrain<1e-10);assert.equal(lab.positions.length,s.panels.reduce((n,p)=>n+p.uvMm.length,0));
});
for(const [id,error] of [['direction',/NOTCH_DIRECTION/],['ease',/EASE_LENGTH/],['reference',/MISSING_PANEL/]])test(`counterexample: ${id} rejected`,()=>assert.throws(()=>validate(createExample({invalid:id})),error));
test('equal length does not excuse wrong notch direction',()=>{const s=createExample({invalid:'direction'});assert.equal(s.seams[0].easeMm,0);assert.throws(()=>cut(s),/NOTCH_DIRECTION/);});
test('explicit ease keeps both original lengths',()=>{const s=createExample({ease:0.08}),r=validate(s);assert.equal(r.seams[0].lengthAMm,220);assert.ok(Math.abs(r.seams[0].lengthBMm-237.6)<1e-7);assert.ok(Math.abs(r.seams[0].easeMm-17.6)<1e-7);});
test('unknown units, pre-accepted garment and material Infinity rejected',()=>{let s=createExample();s.units='m';assert.throws(()=>validate(s),/UNITS/);s=createExample();s.acceptance.productionReady=true;assert.throws(()=>validate(s),/ACCEPTANCE/);s=createExample();s.materials[0].stretchCompliance=Infinity;assert.throws(()=>validate(s),/MATERIAL/);});
test('cyclic, dangling and multiply-owned seam stages rejected',()=>{let s=createExample();s.stages[0].requires=['join'];assert.throws(()=>validate(s),/STAGE_CYCLE/);s=createExample();s.stages[1].requires=['missing'];assert.throws(()=>validate(s),/STAGE_REFERENCE/);s=createExample();s.stages[1].seams.push('S1');assert.throws(()=>validate(s),/SEAM_OWNERSHIP/);});
test('missing source, degenerate material triangle and crossed cut contour rejected',()=>{let s=createExample();delete s.panels[0].source;assert.throws(()=>validate(s),/SOURCE/);s=createExample();s.panels[0].triangles[0]=[0,0,1];assert.throws(()=>validate(s),/TRIANGLE_AREA/);s=createExample();[s.panels[0].boundary[2],s.panels[0].boundary[40]]=[s.panels[0].boundary[40],s.panels[0].boundary[2]];assert.throws(()=>validate(s),/BOUNDARY_INTERSECTION/);});
test('revision/material edits invalidate frozen cut and old solve',()=>{const s=createExample(),lab=new ClothLab(cut(s)),changed=clone(s);changed.revision++;assert.throws(()=>lab.activate('join',changed),/STALE_CUT/);const other=clone(s);other.materials[0].stretchCompliance*=2;assert.throws(()=>lab.assertCurrent(other),/STALE_CUT/);});
test('seams actually converge; no rest or triangle changes, repeated activate idempotent',()=>{
  const s=createExample(),lab=new ClothLab(cut(s)),before=lab.metrics(),source=fingerprint(lab.spec);
  lab.gravity=false;lab.releasePins();lab.activate('join');const count=lab.seamConstraints.length;lab.activate('join');assert.equal(lab.seamConstraints.length,count);
  const after=run(lab,180);assert.equal(after.activeStitches,17);assert.ok(after.maxSeamGapMm<1.1,JSON.stringify(after));assert.ok(after.maxPrincipalStrain<0.02);assert.ok(after.maxSeamGapMm<before.maxSeamGapMm/50);assert.equal(fingerprint(lab.spec),source);assert.equal(after.vertexCount,before.vertexCount);assert.equal(after.triangleCount,before.triangleCount);
});
test('detaching removes stitches and outward load produces divergence',()=>{
  const s=createExample(),lab=new ClothLab(cut(s));lab.gravity=false;lab.releasePins();lab.activate('join');run(lab,120);const joined=lab.metrics().meanSeamGapMm;lab.detach();lab.pull=true;const after=run(lab,90);assert.equal(after.activeStitches,0);assert.ok(after.meanSeamGapMm>joined+30,JSON.stringify(after));
});
test('temporary support fully releases and gravity moves cloth; no hidden reset',()=>{
  const lab=new ClothLab(cut(createExample()));const initial=lab.positions[0][1];lab.releasePins();run(lab,15);assert.equal(lab.pins.size,0);assert.ok(lab.positions[0][1]<initial-0.05);assert.ok(lab.positions.every(p=>p[1]>=lab.floorY-1e-8));
});
test('vertex obstacle contact remains explicitly weaker than human/self collision',()=>{
  const lab=new ClothLab(cut(createExample()));lab.obstacle=true;lab.releasePins();lab.activate('join');const r=run(lab,120);assert.ok(r.finite);assert.ok(r.maxVertexSpherePenetrationMm<1e-7);assert.equal(r.bodyContact,'not_implemented');assert.equal(r.selfCollision,'not_implemented');assert.equal(r.productionReady,false);
});
test('export reconstructs source identity, does not assert ready garment',()=>{const l=new ClothLab(cut(createExample()));l.activate('join');const out=l.export(),rebuilt=new ClothLab(out.snapshot);assert.equal(out.snapshot.signature,rebuilt.snapshot.signature);assert.equal(out.positionsMm.length,rebuilt.positions.length);assert.equal(out.productionReady,false);assert.equal(out.solver.continuousCollision,false);});
test('different panel count does not become hardcoded garment topology',()=>{const s=createExample();s.panels.pop();s.seams=[];s.stages[1].seams=[];const l=new ClothLab(cut(s));assert.equal(l.positions.length,187);assert.equal(l.metrics().productionReady,false);});
test('orphan points, duplicate triangles and unmeshed seam jumps rejected',()=>{let s=createExample();s.panels[0].uvMm.push([3,3]);assert.throws(()=>validate(s),/UNUSED_MATERIAL_POINT/);s=createExample();s.panels[0].triangles.push(s.panels[0].triangles[0]);assert.throws(()=>validate(s),/DUPLICATE_TRIANGLE/);s=createExample();s.panels[0].edges.join.splice(2,1);assert.throws(()=>validate(s),/SEAM_NOT_ON_MATERIAL/);});
test('a deliberately altered cut contour cannot hide missing triangles',()=>{const s=createExample();s.panels[0].triangles.pop();assert.throws(()=>validate(s),/CUT_MESH_BOUNDARY/);});
test('unsupported timestep is rejected instead of silently changing dynamics',()=>{const l=new ClothLab(cut(createExample()));for(const dt of [0,-1,Infinity,.5])assert.throws(()=>l.step(dt),/TIMESTEP/);});
test('known loaded strain failure remains a failure at the fixed 5% gate',()=>{const l=new ClothLab(cut(createExample()));l.activate('join');const r=run(l,180);assert.ok(r.finite);assert.ok(r.maxPrincipalStrain>.05);assert.equal(r.productionReady,false);});
