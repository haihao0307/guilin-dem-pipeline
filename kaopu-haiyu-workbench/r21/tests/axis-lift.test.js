'use strict';
const assert=require('node:assert/strict');
const lift=require('../src/axis-lift.js'),reference=require('./reference-core.js');
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
function close(a,b,eps=1e-8){assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`)}
function samePoint(a,b,eps=1e-8){for(let i=0;i<3;i++)close(a[i],b[i],eps)}
function verify(m,topology=true){
 assert.ok(m.positions.length<8000,'vertex budget');assert.equal(m.positions.length,m.vertexS.length);assert.equal(m.faces.length,m.faceKinds.length);assert.equal(m.faces.length,m.faceComponents.length);
 assert.ok(m.positions.every(p=>p.length===3&&p.every(Number.isFinite)),'finite geometry');assert.ok(m.components.every(c=>c.signedVolume>0),'all closed solids have positive signed volume');
 if(topology){const edges=new Map();for(const face of m.faces){assert.equal(new Set(face).size,3);for(const v of face)assert.ok(Number.isInteger(v)&&v>=0&&v<m.positions.length);for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b),entry=edges.get(key)||[0,0];entry[0]++;entry[1]+=a<b?1:-1;edges.set(key,entry)}}for(const e of edges.values()){assert.equal(e[0],2,'closed two-manifold edge');assert.equal(e[1],0,'consistent outward winding')}}
 assert.equal(m.diagnostics.vertebraCount,24);assert.equal(m.diagnostics.ribPairs,16);assert.ok(m.components.every(c=>c.kind!=='body-envelope'),'failed extra soft envelope excluded from bone-only candidate');assert.ok(m.diagnostics.canalClearance>0,'marrow has a real surrounding canal');
 const ids=new Set(m.components.map(c=>c.id));for(const j of m.junctions){assert.ok(j.radius>0);assert.ok(j.center.every(Number.isFinite));for(const id of j.components)assert.ok(ids.has(id));assert.equal(j.components.length,2)}
 for(const section of m.sections){
  const {origin,T,L,V}=section;for(const v of [T,L,V])close(dot(v,v),1,1e-9);close(dot(T,L),0);close(dot(T,V),0);close(dot(L,V),0);
  assert.ok(section.widths.left>0&&section.widths.right>0&&section.widths.ventral>0);
  const local=points=>points.map(p=>{const d=sub(p,origin);return [dot(d,T),dot(d,L),dot(d,V)]});
  const left=local(section.ribLeft),right=local(section.ribRight);
  assert.ok(Math.min(...left.map(p=>p[1]))<-3,'left rib wraps sideways');assert.ok(Math.max(...right.map(p=>p[1]))>3,'right rib wraps sideways');
  assert.ok(Math.max(...left.map(p=>p[2]))>5,'rib surrounds real dorsal/ventral volume');for(const p of [...left,...right])close(p[0],0,1e-8);
  samePoint(section.ribLeft.at(-1),section.sternumPoint);samePoint(section.ribRight.at(-1),section.sternumPoint);samePoint(section.ribLeft[0],section.dorsalRootLeft);samePoint(section.ribRight[0],section.dorsalRootRight);
  for(const p of section.marrow)assert.ok(Math.hypot(...sub(p,origin))<m.diagnostics.canalRadius*.7,'marrow lies inside vertebral canal');
  assert.equal(section.vertebraOuter.length,section.vertebraInner.length);assert.equal(section.envelope,undefined);
 }
}
for(const [kind,stage]of [['multifrequency',4],['biomotion',5]]){
 for(const t of [0,3.17,19.2,47])for(let i=0;i<20000;i+=31){const p=lift.sourcePointByIndex(kind,i,t),q=reference.point(stage,i,t);samePoint(p,[q[0],q[1],0],3e-10)}
 const a=lift.evaluate(kind,3.17);verify(a);assert.deepEqual(a,lift.evaluate(kind,3.17));assert.deepEqual(a,lift.evaluate(kind,3.17,{camera:{yaw:7}}));
 const frozen=lift.evaluate(kind,21,{motion:0}),rest=lift.evaluate(kind,0,{motion:0});assert.deepEqual(frozen.positions,rest.positions);assert.deepEqual(frozen.faces,rest.faces);
 const repeat=lift.evaluate(kind,3.17+lift.AUTHOR_PERIOD);for(let i=0;i<a.positions.length;i++)samePoint(a.positions[i],repeat.positions[i],2e-6);
 const section=lift.crossSection(kind,3.17,{},.42);assert.equal(section.s,a.section.s);assert.deepEqual(section.ribLeft,a.section.ribLeft);assert.deepEqual(section.marrow,a.section.marrow);assert.equal(section.snapped,true);
 verify(lift.evaluate(kind,2.1598449493429825,{detail:1,depth:1,thickness:1}));verify(lift.evaluate(kind,0,{detail:0,depth:0,thickness:0}));
 console.log('PASS first sanity:',kind,'closed skeletal solids, real canal, rib enclosure, actual section, contact domains, camera independence, source reference, freeze/loop; vertices',a.positions.length);
}
if(!process.argv.includes('--sanity')){
 for(const kind of ['multifrequency','biomotion']){for(let i=0;i<480;i++)verify(lift.evaluate(kind,i*lift.AUTHOR_STEP,{detail:0}),false);console.log('PASS full 480-frame skeleton:',kind)}
}
console.log('ALL R21 NUMERICAL TESTS PASSED');
