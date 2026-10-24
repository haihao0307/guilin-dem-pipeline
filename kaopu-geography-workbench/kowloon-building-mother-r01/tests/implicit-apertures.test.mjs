import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APERTURE_SCHEMA,APERTURE_ROLES,deriveAperture,updateAperture,resetAperture,queryApertures,queryAperture,apertureNormal,intersectAperturesRay,intersectApertureRay,apertureGlassInterval,apertureLocalToWorld,apertureWorldToLocal,apertureOpeningDistance,apertureMaskContains,apertureMaterialDirection,buildAperturesGLSL,packApertureDescriptors} from '../r07/apertures.mjs';
const host={origin:[0,0,0],u:[1,0,0],v:[0,1,0],w:[0,0,1],nodeId:'actual-case:host',sourcePatchId:120,emitWall:false};
const create=(changes={})=>deriveAperture({instanceId:0,host,...changes});
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const vnear=(a,b,e=1e-8)=>a.forEach((v,i)=>near(v,b[i],e));
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,t)=>a.map(x=>x*t),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
const world=(p,q)=>add(p.origin,add(mul(p.u,q[0]),add(mul(p.v,q[1]),mul(p.w,q[2]))));
const worldDirection=(p,q)=>add(mul(p.u,q[0]),add(mul(p.v,q[1]),mul(p.w,q[2])));
let seed=20261021;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('one original function spec contains stable IDs, roles, dependency and no model geometry',()=>{
 const s=create();assert.equal(s.schema,APERTURE_SCHEMA);assert.deepEqual(s.primitives.map(p=>[p.part,p.objectId,p.materialRole]),[['frame',4001,4],['leaf',4002,5],['glass',4003,6]]);assert.equal(APERTURE_ROLES.host,2);assert.equal(s.host.sourcePatchId,120);assert.deepEqual(s.dependencies,[{type:'hostedBy',nodeId:host.nodeId}]);assert.equal(s.counts.modelTriangles,0);assert.equal(s.counts.modelVertexBuffers,0);assert.equal(s.hardware.frictionStay,false);assert.equal(s.distanceContract.stepBudgetRequired,false);
 const source=readFileSync(new URL('../r07/apertures.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/new\s+\w*(?:Mesh|Geometry)\s*\(|createBuffer\s*\(|drawElements\s*\(|marching.?cubes/i);
});
test('invalid dimensions, consumed openings and nonrigid hosts reject before generation',()=>{
 for(const [key,value] of Object.entries({width:-1,height:0,frameDepth:-1,wallThickness:NaN,frameWidth:1,roundRadius:.8,openT:1.01,leafThickness:0,glassThickness:0,maxAngleRadians:Math.PI,thresholdHeight:.021,slideDistance:-1,clearance:1}))assert.throws(()=>create({[key]:value}),key);
 assert.throws(()=>create({kind:'door',width:1,height:.5,frameWidth:.001,thresholdHeight:.02,roundRadius:.25,leafEnabled:false}),/radius/);
 assert.throws(()=>create({kind:'window',glassThickness:.2}),/Glass/);assert.throws(()=>create({kind:'window',sashWidth:.7}),/Glass/);assert.throws(()=>create({host:{...host,u:[2,0,0]}}),/orthonormal/);assert.throws(()=>create({host:{...host,v:[1,0,0]}}),/orthonormal/);assert.throws(()=>create({instanceId:-1}),/instanceId/);assert.throws(()=>create({host:{...host,emitWall:true,wallWidth:1,wallHeight:3}}),/contain/);
});
test('closed pane is a finite solid; frame, sash and glass have distinct truthful fields',()=>{
 const s=create(),g=s.primitives.find(p=>p.part==='glass'),l=s.primitives.find(p=>p.part==='leaf');
 for(const [point,id,role] of [[[.57,0,0],4001,4],[world(l,[.52,0,0]),4002,5],[world(g,[0,0,0]),4003,6]]){const q=queryAperture(s,point);assert.equal(q.objectId,id);assert.equal(q.materialRole,role);assert.ok(q.distance<0);assert.equal(q.inside,true);near(len(q.normal),1);}
 const z=g.origin[2];assert.ok(queryAperture(s,[0,0,z+.0031]).distance>0);assert.ok(queryAperture(s,[0,0,z-.0031]).distance>0);near(queryAperture(s,[0,0,z]).distance,-.003);
 const front=intersectApertureRay(s,[0,0,1],[0,0,-1]);assert.equal(front.objectId,4003);near(front.t,1-z-.003);vnear(front.normal,[0,0,1]);vnear(front.local,[0,0,.003]);
 const back=intersectApertureRay(s,[0,0,-1],[0,0,1]);assert.equal(back.objectId,4003);near(back.t,1+z-.003);vnear(back.normal,[0,0,-1]);
 assert.equal(intersectApertureRay(s,[0,0,1],[0,0,-1],{skipGlass:true}).hit,false);
 assert.equal(intersectApertureRay(s,[0,0,1],[0,0,-1],{skipObjectId:4003}).hit,false);
});
test('thin glass has physical edge and exact angle-dependent finite optical interval',()=>{
 const s=create({glassThickness:.0002}),g=s.primitives.find(p=>p.part==='glass'),front=world(g,[0,0,.0001]);
 const normal=apertureGlassInterval(s,4003,front,[0,0,-1]);assert.equal(normal.hit,true);near(normal.pathLength,.0002,1e-12);vnear(normal.exitNormal,[0,0,-1]);
 const angle=apertureGlassInterval(s,4003,front,unit([1,0,-1]));near(angle.pathLength,.0002*Math.SQRT2,1e-11);
 const edgeOrigin=world(g,[g.outer.half[0]-.00005,0,0]),edge=apertureGlassInterval(s,4003,edgeOrigin,[1,0,0]);near(edge.pathLength,.00005,1e-11);vnear(edge.exitNormal,[1,0,0]);
 const edgeRay=intersectApertureRay(s,world(g,[g.outer.half[0]+.00005,0,0]),[-1,0,0],{skipObjectId:4002});assert.equal(edgeRay.objectId,4003);near(edgeRay.t,.00005,1e-11);
 assert.equal(apertureGlassInterval(s,4001,[0,0,1],[0,0,-1]).status,'unknown_glass');
});
test('rounded corners actually remove solid field and alter exact ray events',()=>{
 const square=create({leafEnabled:false}),round=create({leafEnabled:false,roundRadius:.12}),p=[.59,.69,0];assert.ok(queryAperture(square,p).distance<0);assert.ok(queryAperture(round,p).distance>0);assert.equal(intersectApertureRay(square,[...p.slice(0,2),1],[0,0,-1]).hit,true);assert.equal(intersectApertureRay(round,[...p.slice(0,2),1],[0,0,-1]).hit,false);
 const r=.12,theta=.61,at=[.6-r+r*Math.cos(theta),.7-r+r*Math.sin(theta),0],n=[Math.cos(theta),Math.sin(theta),0],hit=intersectApertureRay(round,add(at,mul(n,.25)),mul(n,-1));assert.equal(hit.hit,true);near(hit.t,.25,1e-9);vnear(hit.point,at,1e-9);vnear(hit.normal,n,1e-9);near(queryAperture(round,hit.point).distance,0,1e-10);
});
test('door frame has three sides and no invented floor-height crossbar',()=>{
 const door=create({kind:'door',width:.95,height:2.1,leafEnabled:false});assert.equal(queryAperture(door,[0,-1.04,0]).inside,false);assert.equal(intersectApertureRay(door,[0,-1.04,1],[0,0,-1]).hit,false);assert.ok(queryAperture(door,[.45,0,0]).inside);assert.ok(queryAperture(door,[0,1.03,0]).inside);
 const threshold=create({kind:'door',width:.95,height:2.1,leafEnabled:false,thresholdHeight:.01});assert.equal(queryAperture(threshold,[0,-1.045,0]).inside,true);
 const leaf=create({kind:'door',width:.95,height:2.1}),p=leaf.primitives.find(p=>p.part==='leaf');near(p.origin[1]-p.outer.half[1],-1.05+leaf.config.clearance);assert.equal(leaf.primitives.some(p=>p.part==='glass'),false);
});
test('optional finite host is truly cut; host omission retains dependency and source mask depth',()=>{
 const s=create({host:{...host,emitWall:true,wallWidth:3,wallHeight:3},leafEnabled:false});assert.equal(queryAperture(s,[0,0,0]).inside,false);assert.equal(intersectApertureRay(s,[0,0,1],[0,0,-1]).hit,false);assert.equal(queryAperture(s,[1,0,0]).objectId,4000);assert.equal(queryAperture(s,[1,0,0]).inside,true);
 assert.equal(apertureMaskContains(s,[0,0,0]),true);assert.equal(apertureMaskContains(s,[0,0,.2]),false);assert.equal(apertureMaskContains(s,[.7,0,0]),false);assert.ok(apertureOpeningDistance(s,[0,0,0])<0);
 const no=updateAperture(s,{host:{emitWall:false}});assert.equal(no.primitives.some(p=>p.part==='host'),false);assert.deepEqual(no.dependencies,s.dependencies);assert.equal(queryAperture(no,[1,0,0]).inside,false);
});
test('mid/open transforms leaf and pane rigidly together, while frame and axis remain fixed',()=>{
 for(const mode of ['hinge-left','hinge-right','slider-left','slider-right','fixed']){
  const s=create({hingeOrSlider:mode}),frame=s.primitives[0],axis=s.pose.pivotWorld;
  for(const t of [0,.5,1]){const n=updateAperture(s,{openT:t}),leaf=n.primitives.find(p=>p.part==='leaf'),glass=n.primitives.find(p=>p.part==='glass');assert.deepEqual(n.primitives[0],frame);vnear(n.pose.pivotWorld,axis);assert.deepEqual(leaf.origin,glass.origin);assert.deepEqual(leaf.u,glass.u);assert.deepEqual(leaf.w,glass.w);assert.deepEqual(n.primitives.map(p=>p.objectId),s.primitives.map(p=>p.objectId));const p=world(glass,[0,0,0]);assert.equal(queryAperture(n,p).objectId,4003);const hit=intersectApertureRay(n,world(glass,[0,0,.1]),mul(glass.w,-1));assert.equal(hit.objectId,4003);near(hit.t,.097,1e-8);}
 }
});
test('continuous half-space clearance is an algebraic contract; 101 sampled poses are only regression coverage',()=>{
 for(const mode of ['hinge-left','hinge-right']){const s=create({hingeOrSlider:mode});assert.equal(s.clearanceContract.kind,'continuous_front_halfspace_separation');assert.equal(s.clearanceContract.doesNotCertifySurroundingObjects,true);
  for(let i=0;i<=100;i++){const n=updateAperture(s,{openT:i/100}),p=n.primitives.find(p=>p.part==='leaf');for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const q=apertureWorldToLocal(n,world(p,[x*p.outer.half[0],y*p.outer.half[1],z*p.halfDepth]));assert.ok(q[2]>=Math.max(n.config.wallThickness,n.config.frameDepth)/2+n.config.mountGap-1e-12);}}}
});
test('host rotations preserve metres, ray distance, local coordinates, normals and material directions',()=>{
 const a=.71,b=.43,u=[Math.cos(a),0,Math.sin(a)],v=[-Math.sin(a)*Math.sin(b),Math.cos(b),Math.cos(a)*Math.sin(b)],w=[-Math.sin(a)*Math.cos(b),-Math.sin(b),Math.cos(a)*Math.cos(b)],h={...host,origin:[10,4,-7],u,v,w};
 for(const t of [0,.5,1]){const local=create({openT:t,roundRadius:.1}),rot=create({openT:t,roundRadius:.1,host:h});for(const p of [[.57,0,0],[.3,.5,.3],[0,0,.11]]){const q=queryAperture(local,p),r=queryAperture(rot,world(h,p));near(q.distance,r.distance);vnear(q.local,r.local);assert.equal(q.objectId,r.objectId);vnear(r.normal,worldDirection(h,q.normal));}
  const g=local.primitives.find(p=>p.part==='glass'),ro=world(g,[0,0,.2]),rd=mul(g.w,-1),one=intersectApertureRay(local,ro,rd),two=intersectApertureRay(rot,world(h,ro),worldDirection(h,rd));assert.equal(one.objectId,two.objectId);near(one.t,two.t);vnear(two.normal,worldDirection(h,one.normal));vnear(apertureMaterialDirection(rot,two.objectId,two.normal),apertureMaterialDirection(local,one.objectId,one.normal));vnear(apertureWorldToLocal(rot,world(h,[.1,.2,.3])),[.1,.2,.3]);}
});
test('parameter propagation, disabled no-op, reset and clear unknown mechanism remain truthful',()=>{
 const first=create({openT:.2}),next=updateAperture(first,{width:1.6,height:1.8,frameWidth:.08,frameDepth:.2,wallThickness:.3,roundRadius:.1,openT:.8});assert.deepEqual(first.config.width,1.2);assert.ok(next.primitives[0].outer.half[0]>first.primitives[0].outer.half[0]);assert.ok(next.primitives[1].outer.half[0]>first.primitives[1].outer.half[0]);assert.ok(next.primitives[2].outer.half[0]>first.primitives[2].outer.half[0]);near(next.primitives[0].halfDepth,.1);near(next.pose.frontPlane,.154);assert.deepEqual(resetAperture(next),first);
 const off=updateAperture(first,{enabled:false});assert.equal(off.primitives.length,0);assert.equal(queryApertures(off,[0,0,0]).distance,Infinity);assert.equal(intersectAperturesRay(off,[0,0,1],[0,0,-1]).hit,false);assert.equal(apertureMaskContains(off,[0,0,0]),false);
 const unknown=create({kind:'door',width:4.6,height:3.7,leafEnabled:false});assert.deepEqual(unknown.primitives.map(p=>p.part),['frame']);assert.equal(intersectApertureRay(unknown,[0,0,10],[0,0,-1]).hit,false);
 assert.equal(intersectAperturesRay([],[0,0,1],[0,0,-1]).hit,false);assert.throws(()=>queryApertures([first,first],[0,0,0]),/Duplicate/);
});
test('exact finite interval pass does not invent a hit beyond maxDistance and reports grazing honestly',()=>{
 const s=create({leafEnabled:false,roundRadius:.1});const miss=intersectApertureRay(s,[.57,0,1],[0,0,-1],{maxDistance:.1});assert.equal(miss.hit,false);assert.equal(miss.status,'miss');
 const tangent=intersectApertureRay(s,[.6,.8,0],[0,-1,0]);assert.equal(tangent.hit,true);assert.equal(tangent.status,'grazing');near(tangent.point[0],.6);near(tangent.point[1],.6);assert.ok(Number.isFinite(tangent.t));
});
test('random analytic hits lie on the same authoritative surface and lower-bound field stays 1-Lipschitz',()=>{
 let hits=0;for(const t of [0,.37,1]){const s=create({openT:t,roundRadius:.09});for(let i=0;i<160;i++){const ro=[(rnd()-.5)*3,(rnd()-.5)*3,(rnd()-.5)*3],target=[(rnd()-.5),rnd()-.5,.1],rd=unit(sub(target,ro)),h=intersectApertureRay(s,ro,rd);if(h.hit){hits++;near(queryAperture(s,h.point).distance,0,3e-8);near(len(h.normal),1);assert.ok(h.t>=0);const outward=add(h.point,mul(h.normal,1e-6));assert.ok(queryAperture(s,outward).distance>=-1e-9);}
 const a=[rnd()*2-1,rnd()*2-1,rnd()-.5],b=add(a,[(rnd()-.5)*.01,(rnd()-.5)*.01,(rnd()-.5)*.01]);assert.ok(Math.abs(queryAperture(s,a).distance-queryAperture(s,b).distance)<=len(sub(a,b))+1e-10);}}
 assert.ok(hits>100);
});
test('GPU records and generated program share complete finite field contract including glass and filtering',()=>{
 const s=create(),p=packApertureDescriptors(s);assert.ok(p.data instanceof Float32Array);assert.equal(p.data[0],3);assert.equal(p.data[4*(1+1)+3],4001);assert.equal(p.data[4*(1+9*2+2)+3],6);assert.equal(p.recordStride,9);const empty=packApertureDescriptors([]);assert.equal(empty.data[0],0);assert.ok(empty.width>0&&empty.height>0);
 const g=buildAperturesGLSL([s]);assert.equal(g.split('struct FieldHit{').length,2);for(const token of ['uApertureDescriptors','aperturePlanInterval','apertureDisc','apertureOutwardCovered','apertureTraceRayFiltered','apertureGlassExit','apertureMaterialDirection','apertureRayGrazing','bool caseTraceRay'])assert.ok(g.includes(token),token);assert.doesNotMatch(g,/for\s*\(.*step|rayT\s*\+=|sphere.?trac|marching/i);assert.equal(buildAperturesGLSL([]),g);
});
