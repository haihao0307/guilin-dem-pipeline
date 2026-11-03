import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BodyEnvelope} from '../src/body-envelope.mjs';

function mesh(p,faces=[0,1,2]) {
 const positions=Float64Array.from(p),triangles=Int32Array.from(faces),normals=new Float64Array(p.length),box=new Float64Array([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
 for(let i=0;i<p.length;i+=3)for(let d=0;d<3;d++){box[d]=Math.min(box[d],p[i+d]);box[d+3]=Math.max(box[d+3],p[i+d]);}
 for(let f=0;f<faces.length;f+=3){const a=faces[f]*3,b=faces[f+1]*3,c=faces[f+2]*3,u=[0,1,2].map(d=>p[b+d]-p[a+d]),v=[0,1,2].map(d=>p[c+d]-p[a+d]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(let j=0;j<3;j++)for(let d=0;d<3;d++)normals[faces[f+j]*3+d]+=n[d];}
 return{p:positions,faces:triangles,normals,tri:Int32Array.from({length:faces.length/3},(_,i)=>i*3),nodes:[{lo:0,hi:faces.length/3,left:-1,right:-1,box}]};
}
const near=(actual,expected,epsilon=1e-10)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`);

test('a body vertex constrains the cloth interior with barycentric mass response and fixed cloth vertices',()=>{
 const body=mesh([0,0,0,-1,-1,-1,1,-1,-1]),solver=new BodyEnvelope(body,{maxCorrection:.01});
 const garment={id:'cloth',positions:new Float64Array([-1,-1,.003,1,-1,.003,0,1,.003]),triangles:new Uint32Array([0,1,2]),inverseMass:new Float64Array([0,2,1]),thickness:.008};
 const bodyBefore=body.p.slice(),before=garment.positions.slice(),measured=solver.measure(garment,{clearance:.004});
 assert.deepEqual(garment.positions,before);assert.deepEqual(body.p,bodyBefore);
 assert.equal(measured.samples[0].kind,'body-vertex/cloth-face');near(measured.maxHalfThicknessOverlapM,.001);
 const result=solver.solve(garment,{clearance:.004}),sample=result.samples[0],bary=sample.bary,denominator=bary[1]**2*2+bary[2]**2;
 near(garment.positions[2],before[2]);near(garment.positions[5]-before[5],2*bary[1]*.001/denominator);near(garment.positions[8]-before[8],bary[2]*.001/denominator);
 assert.deepEqual(body.p,bodyBefore);assert.equal(result.correctionCount,1);
 for(let i=0;i<6;i++)solver.solve(garment,{clearance:.004});
 assert.ok(solver.measure(garment,{clearance:.004}).maxHalfThicknessOverlapM<1e-8);
});

test('six exact current-native VF/EE witnesses retain their measured deficits and are corrected without moving fixed mass',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/body-envelope-native-witnesses.json',import.meta.url)));
 for(const item of fixture.cases){
  const body=mesh(item.body.positions,item.body.faces),solver=new BodyEnvelope(body),surface={id:item.name,positions:Float64Array.from(item.cloth.positions),triangles:Uint32Array.from(item.cloth.triangles),inverseMass:Float64Array.from(item.cloth.inverseMass),thickness:item.cloth.thickness};
  const measured=solver.measure(surface);near(Math.abs(measured.samples[0].distanceM)*1000,item.expected.distanceMM,1e-8);near(measured.maxHalfThicknessOverlapM*1000,item.expected.envelopeOverlapMM,1e-8);
  surface.inverseMass[0]=0;const fixed=surface.positions.slice(0,3),bodyBefore=body.p.slice();
  for(let i=0;i<12;i++)solver.solve(surface);assert.deepEqual(surface.positions.slice(0,3),fixed);assert.deepEqual(body.p,bodyBefore);assert.ok(solver.measure(surface).maxHalfThicknessOverlapM<1e-8);
  surface.positions.set(item.cloth.positions);surface.inverseMass.fill(0);const before=surface.positions.slice(),result=solver.solve(surface);
  assert.equal(result.immovableViolations,1);assert.equal(result.correctionCount,0);assert.deepEqual(surface.positions,before);assert.ok(result.maxHalfThicknessOverlapM>0);
 }
});

test('edge interiors are measured even when no nearest body or cloth vertex is the closest feature',()=>{
 const body=mesh([0,-1,0,0,1,0,1,1,0],[0,2,1]),solver=new BodyEnvelope(body);
 const garment={id:'cloth',positions:new Float64Array([-1,0,.002,1,0,.002,-1,-1,.002]),triangles:new Uint32Array([0,1,2]),inverseMass:new Float64Array(3),thickness:.008};
 const before=garment.positions.slice(),measured=solver.measure(garment,{clearance:.004});
 assert.equal(measured.samples[0].kind,'edge-edge');near(measured.maxHalfThicknessOverlapM,.002);
 const result=solver.solve(garment,{clearance:.004});assert.equal(result.immovableViolations,1);assert.equal(result.correctionCount,0);assert.deepEqual(garment.positions,before);
});

test('body BVH pruning includes a close triangle in a nonfirst leaf and leaves distant geometry untouched',()=>{
 const body=mesh([20,20,20,21,20,20,20,21,20,0,0,0,-1,-1,-1,1,-1,-1],[0,1,2,3,4,5]);
 body.nodes=[{lo:0,hi:2,left:1,right:2,box:Float64Array.from([-1,-1,-1,21,21,20])},{lo:0,hi:1,left:-1,right:-1,box:Float64Array.from([20,20,20,21,21,20])},{lo:1,hi:2,left:-1,right:-1,box:Float64Array.from([-1,-1,-1,1,0,0])}];
 const solver=new BodyEnvelope(body),garment={id:'cloth',positions:new Float64Array([-1,-1,.003,1,-1,.003,0,1,.003]),triangles:new Uint32Array([0,1,2]),thickness:.008};
 const measured=solver.measure(garment);assert.equal(measured.samples[0].bodyTriangle,1);near(measured.maxHalfThicknessOverlapM,.001);
 for(let i=2;i<garment.positions.length;i+=3)garment.positions[i]=2;
 const before=garment.positions.slice();assert.equal(solver.solve(garment).correctionCount,0);assert.deepEqual(garment.positions,before);
});
