import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BodyEnvelope} from '../src/body-envelope.mjs';
import {BodyEnvelope as R02Envelope} from '../../tailor-layering-r02/src/body-envelope.mjs';

// TEST_FIXTURE_ONLY. These finite triangles exercise the collision kernel;
// they are never installed as people, garments, or public visual substitutes.
function mesh(p,faces=[0,1,2]) {
 const positions=Float64Array.from(p),triangles=Int32Array.from(faces),normals=new Float64Array(p.length),box=new Float64Array([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
 for(let i=0;i<p.length;i+=3)for(let d=0;d<3;d++){box[d]=Math.min(box[d],p[i+d]);box[d+3]=Math.max(box[d+3],p[i+d]);}
 for(let f=0;f<faces.length;f+=3){const a=faces[f]*3,b=faces[f+1]*3,c=faces[f+2]*3,u=[0,1,2].map(d=>p[b+d]-p[a+d]),v=[0,1,2].map(d=>p[c+d]-p[a+d]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(let j=0;j<3;j++)for(let d=0;d<3;d++)normals[faces[f+j]*3+d]+=n[d];}
 return{p:positions,faces:triangles,normals,tri:Int32Array.from({length:faces.length/3},(_,i)=>i*3),nodes:[{lo:0,hi:faces.length/3,left:-1,right:-1,box}]};
}
function surface(p,faces=[0,1,2],weights) {
 return{id:'fixture',positions:Float64Array.from(p),triangles:Uint32Array.from(faces),inverseMass:Float64Array.from(weights||new Array(p.length/3).fill(1)),thickness:.008};
}
const report=r=>{const {work,...physical}=r;return physical;};
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/body-envelope-native-witnesses.json',import.meta.url))).cases;

test('six measured native witnesses match frozen R02 and disabled path exactly across repeated corrections',()=>{
 for(const item of fixtures){
  const make=()=>surface(item.cloth.positions,item.cloth.triangles,item.cloth.inverseMass);
  const actual=make(),legacy=make(),disabled=make();actual.thickness=legacy.thickness=disabled.thickness=item.cloth.thickness;
  const a=new BodyEnvelope(mesh(item.body.positions,item.body.faces)),b=new R02Envelope(mesh(item.body.positions,item.body.faces)),c=new BodyEnvelope(mesh(item.body.positions,item.body.faces),{optimizationEnabled:false});
  for(let pass=0;pass<12;pass++){
   const reference=b.solve(legacy);assert.deepEqual(report(a.solve(actual)),reference,item.name+' enabled pass '+pass);assert.deepEqual(report(c.solve(disabled)),reference,item.name+' disabled pass '+pass);
   assert.deepEqual(actual.positions,legacy.positions);assert.deepEqual(disabled.positions,legacy.positions);
  }
 }
});

test('exact triangle signatures reuse unchanged queries and wake all triangles sharing a moved vertex',()=>{
 const body=mesh([0,0,0,-1,-1,-1,1,-1,-1]);
 const garment=surface([-1,-1,.003,1,-1,.003,0,1,.003,2,2,.05,3,2,.05,2,3,.05],[0,1,2,1,3,2,3,4,5]);
 const a=new BodyEnvelope(body),reference=new R02Envelope(body);
 const initial=a.measure(garment);assert.deepEqual(report(initial),reference.measure(garment));assert.equal(initial.work.cacheHits,0);
 const repeat=a.measure(garment);assert.equal(repeat.work.cacheHits,3);assert.equal(repeat.work.bvhNodeVisits,0);assert.equal(repeat.work.vertexFaceTests+repeat.work.edgeEdgeTests,0);assert.deepEqual(report(repeat),report(initial));
 garment.positions[1*3+2]+=.0001;
 const moved=a.measure(garment);assert.equal(moved.work.cacheHits,1);assert.deepEqual(report(moved),reference.measure(garment));
 garment.triangles[1]=0;
 const reindexed=a.measure(garment);assert.equal(reindexed.work.cacheHits,2);assert.deepEqual(report(reindexed),reference.measure(garment));
 const radius=a.measure(garment,{clearance:.006});assert.equal(radius.work.cacheHits,0);assert.deepEqual(report(radius),reference.measure(garment,{clearance:.006}));
 a.setOptimizationEnabled(false);assert.equal(a.measure(garment).work.cacheHits,0);
 a.setOptimizationEnabled(true);assert.equal(a.measure(garment).work.cacheHits,0);
});

test('cached geometric query does not freeze changed mass or allow callers to corrupt its barycentric data',()=>{
 const body=mesh([0,0,0,-1,-1,-1,1,-1,-1]),garment=surface([-1,-1,.003,1,-1,.003,0,1,.003]);
 const a=new BodyEnvelope(body),b=new R02Envelope(body),result=a.measure(garment),expected=b.measure(garment);
 result.samples[0].bary.fill(999);result.samples[0].point.fill(999);result.samples[0].bodyPoint.fill(999);
 assert.deepEqual(report(a.measure(garment)),expected);
 garment.inverseMass.fill(0);const immovable=a.solve(garment);assert.equal(immovable.work.cacheHits,1);assert.equal(immovable.correctionCount,0);assert.equal(immovable.immovableViolations,1);
 garment.inverseMass[2]=2;const original=surface(garment.positions,garment.triangles,garment.inverseMass);
 assert.deepEqual(report(a.solve(garment)),b.solve(original));assert.deepEqual(garment.positions,original.positions);
});

test('unannounced body changes fail closed; explicit refit and invalidation rebuild bounds and clear stale queries',()=>{
 const body=mesh([0,0,0,-1,-1,-1,1,-1,-1]),garment=surface([-1,-1,.003,1,-1,.003,0,1,.003]),a=new BodyEnvelope(body);
 a.measure(garment);body.p[2]+=.001;
 assert.throws(()=>a.measure(garment),/explicitly invalidate/);
 const refitted=mesh(body.p,body.faces);body.normals=refitted.normals;body.nodes=refitted.nodes;a.invalidateBody();
 const fresh=a.measure(garment);assert.equal(fresh.work.cacheHits,0);assert.deepEqual(report(fresh),new R02Envelope(body).measure(garment));
 body.normals[0]+=.001;assert.throws(()=>a.measure(garment),/explicitly invalidate/);
});

test('conservative finite-feature bounds preserve exact R02 answers over deterministic oblique and near-parallel cases',()=>{
 let seed=19547;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 let vf=0,ee=0,pruned=0;
 for(let sample=0;sample<320;sample++){
  const bodyPositions=[],bodyFaces=[];
  for(let f=0;f<8;f++){
   const x=(rand()-.5)*.10,y=(rand()-.5)*.10,z=(rand()-.5)*.002;
   bodyFaces.push(f*3,f*3+1,f*3+2);bodyPositions.push(x,y,z,x+.02+rand()*.04,y+(rand()-.5)*.01,z+(rand()-.5)*.001,x+(rand()-.5)*.01,y+.02+rand()*.04,z+(rand()-.5)*.001);
  }
  const z=.001+rand()*.005,positions=[-.05,-.04,z,.06,-.04,z+(rand()-.5)*.002,-.03,.06,z+(rand()-.5)*.002,.06,.06,z];
  const actual=surface(positions,[0,1,2,1,3,2],[sample%3===0?0:1,1,2,1]),legacy=surface(positions,[0,1,2,1,3,2],actual.inverseMass);
  const a=new BodyEnvelope(mesh(bodyPositions,bodyFaces)),b=new R02Envelope(mesh(bodyPositions,bodyFaces));
  for(let pass=0;pass<3;pass++){
   const got=a.solve(actual),expected=b.solve(legacy);assert.deepEqual(report(got),expected,'case '+sample+' pass '+pass);assert.deepEqual(actual.positions,legacy.positions);
   vf+=got.work.vertexFaceCandidates;ee+=got.work.edgeEdgeCandidates;pruned+=got.work.prunedVertexFaceTests+got.work.prunedEdgeEdgeTests;
  }
 }
 assert.ok(vf>0&&ee>0&&pruned>0);assert.ok(pruned/(vf+ee)>.15,'finite-feature tests measurably skipped, not only instrumented');
});
