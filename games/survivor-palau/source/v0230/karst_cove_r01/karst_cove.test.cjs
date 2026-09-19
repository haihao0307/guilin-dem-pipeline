'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const K=require('./karst_cove.cjs');
const tests=[];
function check(name,fn){fn();tests.push({name,pass:true});}
function finite3(v){return Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);}
function hashMesh(m){const h=crypto.createHash('sha256');h.update(JSON.stringify({step:m.step,positions:m.positions,normals:m.normals,indices:m.indices}));return h.digest('hex');}
check('metadata and candidate evidence boundary',()=>{assert.equal(K.CONFIG.units,'metre');assert.match(K.CONFIG.evidence,/candidate/);assert.ok(!K.VERSION.includes('sdf'));});
check('non-solid interior body points',()=>{
  for(const p of [[27,2.2,18.0],[27,2.3,16.0],[27,2.25,13.5],[26.6,2.1,11.2]])assert.equal(K.insideRock(...p),false,'expected void '+p);
});
check('side and back are rock',()=>{
  for(const p of [[23.1,2.4,14.0],[30.9,2.5,14.0],[27,2.4,9.45]])assert.equal(K.insideRock(...p),true,'expected rock '+p);
});
check('entrance clearance exceeds standing height',()=>{
  const c=K.clearanceAt(27,18.0,{step:.01});assert.equal(c.hit,true);assert.ok(c.clearance>2.45,JSON.stringify(c));
});
check('roof overhang contacts above open entrance',()=>{
  assert.equal(K.insideRock(27,3.65,18.0),false);assert.equal(K.insideRock(27,4.95,18.0),true);
  const q=K.contactAt([27,4.78,18.0],{radius:.24});assert.equal(q.contact,true);assert.ok(finite3(q.normal));
});
check('open entrance ray reaches interior',()=>{
  assert.equal(K.rayOccluded([27,2.25,20.2],[27,2.25,12.0],{step:.025}),false);
});
check('lateral ray is blocked by same rock field',()=>{
  assert.equal(K.rayOccluded([27,2.35,17.4],[22.5,2.35,13.6],{step:.025}),true);
});
check('roof ray is blocked',()=>{
  assert.equal(K.rayOccluded([27,5.95,16.0],[27,2.2,16.0],{step:.02}),true);
});
check('finite normals around representative surfaces',()=>{
  for(const p of [[23.2,2.6,14],[30.8,2.6,14],[27,4.7,16.5],[27,2.4,9.55]]){const n=K.normalAt(...p);assert.ok(finite3(n));assert.ok(Math.abs(Math.hypot(...n)-1)<1e-9);}
});
check('outside world is not rock',()=>{for(const p of [[27,3,22],[18,2,14],[36,2,14],[27,8,14]])assert.equal(K.insideRock(...p),false);});
check('floor remains below open cavity, without filling body volume',()=>{
  const f=K.floorAt(27,14);assert.ok(f>1.25&&f<1.45);assert.equal(K.insideRock(27,f-.15,14),true);assert.equal(K.insideRock(27,f+.75,14),false);
});
check('deterministic query values',()=>{
  const pts=[[27,2.2,18],[23.1,2.4,14],[27,4.95,18],[27,2.4,9.45]];const a=pts.map(p=>K.fieldAt(...p));const b=pts.map(p=>K.fieldAt(...p));assert.deepEqual(a,b);
});
check('diagnostic mesh is same-field, bounded and deterministic',()=>{
  const a=K.buildDiagnosticMesh({step:.42}),b=K.buildDiagnosticMesh({step:.42});assert.ok(a.triangles>500);assert.ok(a.triangles<50000);assert.equal(hashMesh(a),hashMesh(b));assert.equal(a.fieldId,K.CONFIG.id);tests.push({meshTriangles:a.triangles,meshHash:hashMesh(a)});
});
check('invalid numeric inputs fail closed',()=>{assert.throws(()=>K.fieldAt(NaN,2,3),/finite/);assert.throws(()=>K.rayOccluded([0,0,0],[1,1,NaN]),/finite/);});
const mesh=K.buildDiagnosticMesh({step:.30});
console.log(JSON.stringify({suite:'SMI Karst Cove R01',version:K.VERSION,passed:tests.filter(t=>t.pass).length,failed:0,mesh:{step:mesh.step,triangles:mesh.triangles,vertices:mesh.positions.length/3,sha256:hashMesh(mesh)},checks:tests,limitations:[
  'Implicit occupancy score is not a proven signed-distance function.',
  'Dimensions are authored candidates in the existing shelter frame, not Palau survey measurements.',
  'Voxel diagnostic mesh is an inspection surface, not production topology.',
  'No game scene integration, public URL, physical device or user visual acceptance is claimed.'
]},null,2));
