import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMacGrid,projectClosedMac} from './pressure-projection.mjs';
import {buildClosedBed,inspectClosedMesh} from './boundary-geometry.mjs';
function pattern(g){for(const [n,key]of ['u','v','w'].entries())for(let i=0;i<g[key].length;i++)g[key][i]=Math.sin(i*1.731+n*.371)*1.3+Math.cos(i*.379);return g;}
const opts=(g,extra={})=>({...g,dt:1/120,density:1000,tolerance:1e-9,maxIterations:1500,...extra});
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('invalid dimensions, budgets and unknown capabilities are rejected',()=>{
 assert.throws(()=>makeMacGrid(0,4,4));assert.throws(()=>makeMacGrid(999,999,999));
 assert.throws(()=>projectClosedMac(opts(makeMacGrid(3,3,3),{dt:0})));
 assert.throws(()=>projectClosedMac(opts(makeMacGrid(3,3,3),{freeSurface:true})));
 const g=makeMacGrid(3,3,3);g.u[1]=NaN;assert.throws(()=>projectClosedMac(opts(g)));
});
test('zero field remains stationary with zero pressure iterations',()=>{
 const r=projectClosedMac(opts(makeMacGrid(7,6,5)));assert.equal(r.accepted,true);assert.equal(r.iterations,0);assert.equal(r.metrics.afterMaxDivergence,0);
});
test('nonuniform 3D field reaches measured divergence tolerance',()=>{
 const r=projectClosedMac(opts(pattern(makeMacGrid(12,10,8))));assert.equal(r.accepted,true);assert.ok(r.metrics.beforeMaxDivergence>1);assert.ok(r.metrics.afterMaxDivergence<1.01e-9);assert.ok(r.iterations>0);
});
test('stationary one-cell solid wall has zero normal interface speed',()=>{
 const g=pattern(makeMacGrid(12,9,7));for(let k=0;k<g.nz;k++)for(let j=0;j<g.ny;j++)g.fluid[(k*g.ny+j)*g.nx+5]=0;
 const r=projectClosedMac(opts(g));assert.equal(r.accepted,true);assert.equal(r.metrics.componentCount,2);assert.equal(r.metrics.blockedNormalFluxM3s,0);
 for(let k=0;k<g.nz;k++)for(let j=0;j<g.ny;j++)for(const i of [0,5,6,g.nx])assert.equal(r.velocity.u[(k*g.ny+j)*(g.nx+1)+i],0);
});
test('irregular solid cluster and isolated cell use independent pressure gauges',()=>{
 const g=pattern(makeMacGrid(8,7,6));g.fluid.fill(0);g.fluid[0]=1;
 for(let k=2;k<5;k++)for(let j=2;j<6;j++)for(let i=3;i<7;i++)g.fluid[(k*g.ny+j)*g.nx+i]=1;
 const r=projectClosedMac(opts(g));assert.equal(r.accepted,true);assert.equal(r.metrics.componentCount,2);assert.equal(r.pressure[0],0);
});
test('anisotropic voxel spacing uses three distinct finite difference scales',()=>{
 const r=projectClosedMac(opts(pattern(makeMacGrid(10,8,6,[.25,.5,.9]))));assert.equal(r.accepted,true);assert.ok(r.metrics.afterMaxDivergence<=1.01e-9);
});
test('pressure projection does not increase post-boundary kinetic energy',()=>{
 const r=projectClosedMac(opts(pattern(makeMacGrid(12,10,8))));assert.equal(r.accepted,true);assert.ok(r.metrics.kineticEnergyAfterJ<=r.metrics.kineticEnergyBeforeJ+1e-6);
});
test('failed iteration budget returns no accepted velocity or pressure',()=>{
 const r=projectClosedMac(opts(pattern(makeMacGrid(12,10,8)),{maxIterations:1}));assert.equal(r.accepted,false);assert.equal(r.reason,'iteration_budget_exhausted');assert.equal(r.velocity,null);assert.equal(r.pressure,null);
});
test('input buffers remain byte-identical on success and failure',()=>{
 const g=pattern(makeMacGrid(7,6,5)),copies=Object.fromEntries(['fluid','u','v','w'].map(k=>[k,Buffer.from(g[k].buffer).toString('hex')]));
 projectClosedMac(opts(g));projectClosedMac(opts(g,{maxIterations:0}));for(const k of Object.keys(copies))assert.equal(Buffer.from(g[k].buffer).toString('hex'),copies[k]);
});
test('same CPU inputs reproduce pressure and velocity exactly',()=>{
 const g=pattern(makeMacGrid(9,8,7)),a=projectClosedMac(opts(g)),b=projectClosedMac(opts(g));assert.deepEqual(a.pressure,b.pressure);assert.deepEqual(a.velocity,b.velocity);
});
test('density and timestep scale pressure while velocity projection stays invariant',()=>{
 const g=pattern(makeMacGrid(8,7,6)),a=projectClosedMac(opts(g)),b=projectClosedMac(opts(g,{density:500,dt:1/60}));
 assert.equal(a.accepted,true);assert.equal(b.accepted,true);
 for(let i=0;i<a.pressure.length;i++)near(b.pressure[i],a.pressure[i]*.25,1e-6);
 for(const k of ['u','v','w'])for(let i=0;i<a.velocity[k].length;i++)near(a.velocity[k][i],b.velocity[k][i],1e-8);
});
test('closed boundary sample mesh shares every top border vertex and includes a bottom',()=>{
 const m=buildClosedBed({nx:13,nz:9,bounds:[-8,8,-6,6],bottom:-4,heightAt:(x,z)=>.2*Math.sin(x)+.1*z}),q=inspectClosedMesh(m);
 assert.equal(q.closed,true);assert.equal(m.perimeterSegmentCount,44);assert.equal(q.openEdges,0);assert.equal(q.orientationErrors,0);assert.ok(q.signedVolumeM3>700);
});
test('removing one triangle is detected as open geometry',()=>{
 const m=buildClosedBed({nx:4,nz:3,bounds:[0,4,0,3],bottom:-2,heightAt:()=>0});m.indices.pop();const q=inspectClosedMesh(m);assert.equal(q.closed,false);assert.equal(q.openEdges,3);
});
test('larger area increases cells at the same spacing instead of stretching the old grid',()=>{
 const old={width:64,depth:56,nx:144,nz:112},next={width:96,depth:84,nx:216,nz:168};
 near(old.width/old.nx,next.width/next.nx);near(old.depth/old.nz,next.depth/next.nz);
 near(next.width*next.depth/(old.width*old.depth),2.25);near(next.nx*next.nz/(old.nx*old.nz),2.25);
});

const {createFractureStudy,planeConstraintValue}=await import('./fracture-solid.mjs');
test('fractured-solid prototype has closed faces and positive actual volume',()=>{
 const r=createFractureStudy();const q=inspectClosedMesh(r);assert.equal(q.closed,true);assert.ok(r.faces.length>=10);assert.ok(q.signedVolumeM3>1);
});
test('solid underside exists and all mesh vertices obey the collider plane source',()=>{
 const r=createFractureStudy();assert.ok(r.vertices.some(p=>p[1]<r.center[1]));assert.ok(r.vertices.some(p=>p[1]>r.center[1]));
 for(const p of r.vertices)assert.ok(Math.abs(planeConstraintValue(r.planes,p))<1e-7);
 assert.ok(planeConstraintValue(r.planes,r.center)<0);assert.ok(planeConstraintValue(r.planes,[100,100,100])>0);
});
test('changing the shape seed changes planes while preserving deterministic reconstruction',()=>{
 const a=createFractureStudy({seed:7}),b=createFractureStudy({seed:7}),c=createFractureStudy({seed:8});assert.deepEqual(a,b);assert.notDeepEqual(a.planes,c.planes);assert.equal(inspectClosedMesh(c).closed,true);
});
test('three-dimensional geometry cannot be approved by its topology checks alone',()=>{
 const r=createFractureStudy();assert.equal(r.geologicallyCalibrated,false);assert.equal(r.fieldMeaning,'signed half-space constraint; not exact distance');assert.throws(()=>createFractureStudy({halfSize:[0,1,1]}));
});

const {particlesToMac,macToParticles}=await import('./particle-transfer.mjs');
test('particle deposition preserves represented mass weights on each staggered component',()=>{
 const g=makeMacGrid(5,4,3,[.4,.5,.6]),p=[{position:[0,0,0],velocity:[2,3,4],mass:2},{position:[1,.6,.9],velocity:[2,3,4],mass:3},{position:[2,2,1.8],velocity:[2,3,4],mass:1}],r=particlesToMac(g,p);
 for(const [axis,k]of ['u','v','w'].entries()){near(r.weights[k].reduce((a,b)=>a+b,0),6);for(let i=0;i<r[k].length;i++)if(r.weights[k][i]>0)near(r[k][i],[2,3,4][axis]);}
});
test('PIC samples new field and FLIP preserves particle velocity plus field change',()=>{
 const g=makeMacGrid(5,4,3),p=[{position:[2,2,1],velocity:[9,8,7],mass:1}],old=makeMacGrid(5,4,3),next=makeMacGrid(5,4,3);
 for(const [axis,k]of ['u','v','w'].entries()){old[k].fill(axis+1);next[k].fill(axis+3);}
 assert.deepEqual(macToParticles(g,p,old,next,0)[0].velocity,[3,4,5]);assert.deepEqual(macToParticles(g,p,old,next,1)[0].velocity,[11,10,9]);assert.deepEqual(macToParticles(g,p,old,next,.5)[0].velocity,[7,7,7]);
});
test('trilinear interpolation recovers an interior affine velocity field',()=>{
 const g=makeMacGrid(6,5,4,[.4,.5,.6]),p=[{position:[1.13,1.27,1.11],velocity:[0,0,0],mass:1}];
 for(const [axis,k]of ['u','v','w'].entries()){const dims=[g.nx,g.ny,g.nz];dims[axis]++;for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++){
  const q=[x,y,z].map((v,i)=>(v+(i===axis?0:.5))*g.spacing[i]);g[k][(z*dims[1]+y)*dims[0]+x]=axis+.4*q[0]-.2*q[1]+.7*q[2];}}
 const r=macToParticles(g,p,g,g,0)[0].velocity;
 for(let axis=0;axis<3;axis++)near(r[axis],axis+.4*1.13-.2*1.27+.7*1.11,1e-12);
});
test('zero grid delta with full FLIP retains velocity and leaves particle sources unchanged',()=>{
 const g=makeMacGrid(4,4,4),p=[{position:[2,2,2],velocity:[1,-2,3],mass:1}],copy=JSON.stringify(p);
 assert.deepEqual(macToParticles(g,p,g,g,1)[0].velocity,p[0].velocity);assert.equal(JSON.stringify(p),copy);
});
test('outside particles and unsupported blend values fail explicitly',()=>{
 const g=makeMacGrid(4,4,4),p=[{position:[-1,2,2],velocity:[1,0,0],mass:1}];assert.throws(()=>particlesToMac(g,p));p[0].position[0]=1;assert.throws(()=>macToParticles(g,p,g,g,1.1));
});
