import test from 'node:test';
import assert from 'node:assert/strict';
import * as original from '../r07/apertures.mjs';
import * as joinery from '../material-quality-r01/apertures.mjs';
const host={origin:[0,0,0],u:[1,0,0],v:[0,1,0],w:[0,0,1],nodeId:'unchanged-host',emitWall:false};
const create=(changes={})=>joinery.deriveAperture({instanceId:0,host,frontBevel:.0015,...changes});
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}; tolerance ${e}`);
const vnear=(a,b,e=1e-9)=>a.forEach((v,i)=>near(v,b[i],e));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
const world=(p,q)=>add(p.origin,add(mul(p.u,q[0]),add(mul(p.v,q[1]),mul(p.w,q[2]))));
const direction=(p,q)=>add(mul(p.u,q[0]),add(mul(p.v,q[1]),mul(p.w,q[2])));
const isolated=(s,p)=>({...s,primitives:[p]});
let seed=20261021;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function verifyFace(s,p,q,n){const scene=isolated(s,p),point=world(p,q),normal=direction(p,n),sample=joinery.queryApertures(scene,point);near(sample.distance,0,1e-10);vnear(sample.normal,normal,1e-8);const ray=joinery.intersectAperturesRay(scene,add(point,mul(normal,.01)),mul(normal,-1));assert.ok(ray.hit);near(ray.t,.01,1e-9);vnear(ray.normal,normal,1e-8);vnear(ray.local,q,1e-9);assert.equal(ray.objectId,p.objectId);assert.ok(joinery.queryApertures(scene,add(point,mul(normal,.00001))).distance>0);assert.ok(joinery.queryApertures(scene,sub(point,mul(normal,.00001))).distance<0);}

test('design-only 45 degree front chamfer removes material and has truthful outer and inner field normals',()=>{
 const s=create({leafEnabled:false}),p=s.primitives[0],b=p.frontBevel,z=p.halfDepth-b/2;
 verifyFace(s,p,[p.outer.half[0]-b/2,0,z],[Math.SQRT1_2,0,Math.SQRT1_2]);
 verifyFace(s,p,[p.inner.half[0]+b/2,0,z],[-Math.SQRT1_2,0,Math.SQRT1_2]);
 assert.ok(joinery.queryApertures(s,[p.outer.half[0]-.0002,0,p.halfDepth-.0002]).distance>0);
 assert.ok(original.queryApertures(original.deriveAperture({instanceId:0,host,leafEnabled:false}),[p.outer.half[0]-.0002,0,p.halfDepth-.0002]).distance<0);
 assert.equal(s.joineryProfile.sourceMeasured,false);assert.equal(s.joineryProfile.kind,'design_front_45_degree_chamfer');assert.equal(s.counts.modelTriangles,0);assert.equal(s.counts.modelVertexBuffers,0);
});

test('round XY corners produce real conical bands on outer and inner edges, not planar impostors',()=>{
 const s=create({roundRadius:.12,leafEnabled:false}),p=s.primitives[0],b=p.frontBevel,z=p.halfDepth-b/2;
 for(const a of [.19,.61,Math.PI/4,1.39]){const n=[Math.cos(a),Math.sin(a)],outer=p.outer,inner=p.inner;
  verifyFace(s,p,[outer.half[0]-outer.radius+(outer.radius-b/2)*n[0],outer.half[1]-outer.radius+(outer.radius-b/2)*n[1],z],[n[0]*Math.SQRT1_2,n[1]*Math.SQRT1_2,Math.SQRT1_2]);
  verifyFace(s,p,[inner.half[0]-inner.radius+(inner.radius+b/2)*n[0],inner.half[1]-inner.radius+(inner.radius+b/2)*n[1],z],[-n[0]*Math.SQRT1_2,-n[1]*Math.SQRT1_2,Math.SQRT1_2]);
 }
});

test('outer radii smaller than the bevel erode to a true inset box instead of negative-radius clipping',()=>{
 for(const roundRadius of [0,.0002,.0005,.001,.0015,.002]){const s=create({roundRadius,leafEnabled:false}),p=s.primitives[0],z=p.halfDepth-.00025,x=p.outer.half[0]-.00125;
  verifyFace(s,p,[x,0,z],[Math.SQRT1_2,0,Math.SQRT1_2]);
  const q=[p.outer.half[0]-.00124,p.outer.half[1]-.00124,z];assert.ok(joinery.queryApertures(s,q).distance>0);
  const ray=joinery.intersectAperturesRay(s,[...q.slice(0,2),.2],[0,0,-1]);assert.ok(ray.hit);near(joinery.queryApertures(s,ray.point).distance,0,1e-10);
 }
});

test('closed and open sash retain rigid identity, local charts, real chamfer and 4 mm clearance',()=>{
 for(const hingeOrSlider of ['hinge-left','hinge-right','slider-left','slider-right','fixed'])for(const openT of [0,.5,1]){
  const s=create({hingeOrSlider,openT}),p=s.primitives.find(p=>p.part==='leaf'),b=p.frontBevel,z=p.halfDepth-b/2;
  verifyFace(s,p,[p.outer.half[0]-b/2,0,z],[Math.SQRT1_2,0,Math.SQRT1_2]);
  verifyFace(s,p,[p.inner.half[0]+b/2,0,z],[-Math.SQRT1_2,0,Math.SQRT1_2]);
  assert.equal(p.objectId,4002);assert.equal(p.materialRole,5);near(s.config.clearance,.004);near(s.config.mountGap,.004);near(s.clearanceContract.minimumHostFrameGap,.004);
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])assert.ok(joinery.apertureWorldToLocal(s,world(p,[x*p.outer.half[0],y*p.outer.half[1],z*p.halfDepth]))[2]>=.094-1e-12);
 }
});

test('unchanged outer bounds, minimum aperture, source hole, 6 mm glass and seat; chamfer only subtracts material',()=>{
 for(const roundRadius of [0,.0005,.12]){const s=create({roundRadius}),b=joinery.updateAperture(s,{frontBevel:0});assert.deepEqual(s.roughOpening,b.roughOpening);assert.deepEqual(s.bounds,b.bounds);assert.deepEqual(s.primitives.find(p=>p.part==='glass'),b.primitives.find(p=>p.part==='glass'));near(s.config.glassThickness,.006);near(s.config.glassSeat,.006);
  for(let k=0;k<1500;k++){const q=[(rnd()-.5)*1.3,(rnd()-.5)*1.5,(rnd()-.5)*.4],now=joinery.queryApertures(s,q),before=joinery.queryApertures(b,q);if(now.distance<0)assert.ok(before.distance<=0);assert.equal(joinery.apertureMaskContains(s,q),joinery.apertureMaskContains(b,q));near(joinery.apertureOpeningDistance(s,q),joinery.apertureOpeningDistance(b,q));}
 }
 const s=create({host:{...host,emitWall:true,wallWidth:3,wallHeight:3}});assert.equal(s.primitives.find(p=>p.part==='host').frontBevel,0);assert.equal(s.primitives.find(p=>p.part==='glass').frontBevel,0);
 const g=s.primitives.find(p=>p.part==='glass'),iv=joinery.apertureGlassInterval(s,g.objectId,world(g,[0,0,.1]),mul(g.w,-1));near(iv.pathLength,.006);vnear(iv.exitNormal,[0,0,-1]);
});

test('invalid bevel designs reject before generation, with no implicit clamping or mutation',()=>{
 const s=create(),saved=structuredClone(s);for(const frontBevel of [NaN,Infinity,-.001,.00001,.00201,null,'0.0015'])assert.throws(()=>joinery.updateAperture(s,{frontBevel}),/frontBevel/);
 for(const change of [{frameWidth:.004},{frameDepth:.002},{sashWidth:.004,glassSeat:.001},{glassThickness:.034}])assert.throws(()=>joinery.updateAperture(s,change),/frontBevel/);
 assert.deepEqual(s,saved);assert.equal(create({frontBevel:0}).config.frontBevel,0);assert.equal(create({frontBevel:.0001}).config.frontBevel,.0001);assert.equal(create({frontBevel:.002}).config.frontBevel,.002);
});

test('zero bevel retains frozen R07 field, identity, normal and ray results',()=>{
 for(const roundRadius of [0,.0005,.12])for(const openT of [0,.37,1]){const input={instanceId:0,host,roundRadius,openT},old=original.deriveAperture(input),now=joinery.deriveAperture(input);for(let k=0;k<100;k++){
  const q=[(rnd()-.5)*2,(rnd()-.5)*2,(rnd()-.5)*2],a=original.queryApertures(old,q),b=joinery.queryApertures(now,q);near(a.distance,b.distance,1e-12);assert.equal(a.objectId,b.objectId);vnear(a.local,b.local,1e-12);vnear(a.normal,b.normal,1e-12);
  const rd=unit(sub([0,0,.1],q)),x=original.intersectAperturesRay(old,q,rd),y=joinery.intersectAperturesRay(now,q,rd);assert.equal(x.hit,y.hit);if(x.hit){near(x.t,y.t,1e-12);assert.equal(x.objectId,y.objectId);vnear(x.normal,y.normal,1e-12);}
 }}
});

test('grazing rounded corner retains all THREE disjoint solid spans and their real ray exits',()=>{
 const s=create({roundRadius:.12,leafEnabled:false}),ro=[-.6,.6398,.0585+.12*(-.6-.48-.0051)],rd=unit([1,0,.12]);
 const iv=joinery.aperturePartRayIntervals(s,4001,ro,rd);assert.equal(iv.length,3);for(const [a,b] of iv){assert.ok(b>a);near(joinery.queryApertures(s,add(ro,mul(rd,a))).distance,0,1e-9);near(joinery.queryApertures(s,add(ro,mul(rd,b))).distance,0,1e-9);const mid=(a+b)/2;assert.ok(joinery.queryApertures(s,add(ro,mul(rd,mid))).distance<0);const h=joinery.intersectAperturesRay(s,add(ro,mul(rd,mid)),rd);assert.ok(h.hit);near(h.t,b-mid,1e-9);}
});

test('random chamfer intervals match the authoritative field and stay 1-Lipschitz',()=>{
 let count=0;for(const roundRadius of [0,.0005,.12,.6]){const s=create({roundRadius,leafEnabled:false});for(let k=0;k<700;k++){
  const ro=[(rnd()-.5)*2,(rnd()-.5)*2,(rnd()-.5)*.3],rd=unit([rnd()-.5,rnd()-.5,rnd()-.5]),iv=joinery.aperturePartRayIntervals(s,4001,ro,rd);assert.ok(iv.length<=3);
  for(const span of iv){for(const t of span)near(joinery.queryApertures(s,add(ro,mul(rd,t))).distance,0,2e-8);if(span[1]-span[0]>1e-8){assert.ok(joinery.queryApertures(s,add(ro,mul(rd,(span[0]+span[1])/2))).distance<1e-9);count++;}}
  for(let j=0;j<8;j++){const t=(rnd()-.5)*2,q=add(ro,mul(rd,t)),f=joinery.queryApertures(s,q).distance,inside=iv.some(v=>t>=v[0]&&t<=v[1]);if(Math.abs(f)>1e-9)assert.equal(inside,f<0);const other=add(q,[(rnd()-.5)*.003,(rnd()-.5)*.003,(rnd()-.5)*.003]);assert.ok(Math.abs(joinery.queryApertures(s,other).distance-f)<=len(sub(q,other))+1e-12);}
 }}assert.ok(count>500);
});

test('GPU descriptor stride is unchanged and complete analytic intervals drive all ray/cover/light/glass paths',()=>{
 const s=create(),p=joinery.packApertureDescriptors(s);assert.equal(p.recordStride,9);for(let k=0;k<3;k++)near(p.data[4*(1+9*k+5)+3],k<2?.0015:0,1e-9);
 const glsl=joinery.buildAperturesGLSL(s);for(const token of ['struct ApertureIntervals{vec2 a;vec2 b;vec2 c;}','apertureAffinePlanInterval','apertureCone','apertureOccludesSegment','ApertureIntervals apertureIntervals','segment<3','apertureIntervals(p,ro,rd).a'])assert.ok(glsl.includes(token),token);
 assert.doesNotMatch(glsl,/vec4 apertureIntervals|rayT\s*\+=|minStep|sphere.?trac/i);
});


test('local light visibility checks occupancy spans, including starts inside and the third segment',()=>{
 const s=create({roundRadius:.12,leafEnabled:false}),p=s.primitives[0];assert.equal(joinery.apertureOccludesSegment(p,[.57,0,0],[0,0,1],.000008,.01),true);assert.equal(joinery.apertureOccludesSegment(p,[0,0,0],[0,0,1],.000008,.2),false);
 const ro=[-.6,.6398,.0585+.12*(-.6-.48-.0051)],rd=unit([1,0,.12]),iv=joinery.aperturePartRayIntervals(s,4001,ro,rd);assert.equal(joinery.apertureOccludesSegment(p,ro,rd,iv[2][0]+.00001,iv[2][1]-.00001),true);assert.equal(joinery.apertureOccludesSegment(p,ro,rd,iv[1][1]+.00001,iv[2][0]-.00001),false);
});

test('exported probes use current poses and give direct five-face verification',()=>{const s=create({roundRadius:.12,openT:.4}),probes=joinery.apertureBevelProbeRays(s);assert.equal(probes.length,10);for(const q of probes){const p=s.primitives.find(p=>p.objectId===q.objectId),h=joinery.intersectAperturesRay(isolated(s,p),q.origin,q.direction);assert.ok(h.hit);near(h.t,q.expectedT);vnear(h.normal,q.expectedNormal);vnear(h.point,q.expectedPoint);}});
