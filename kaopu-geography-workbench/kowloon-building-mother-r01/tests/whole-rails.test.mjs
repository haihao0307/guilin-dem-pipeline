import test from 'node:test';
import assert from 'node:assert/strict';
import {filletPath,railPointAt,railDistance} from '../r07/field.mjs';
import {STAIR_RAIL_MAX_PRIMITIVES,deriveStairRails,createRailInstance,railToWorld,railToLocal,stairRailSupportSurface,queryStairRailLocal,queryStairRails,traceStairRails,stairRailRayInterval,buildStairRailGLSL} from '../whole-building-r01/rails.mjs';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const pointNear=(a,b,e=1e-7)=>a.forEach((v,i)=>near(v,b[i],e));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const norm=a=>mul(a,1/Math.hypot(...a));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const base={floorHeight:2.844,flightWidth:1.1,centerGap:.2,runLength:2.2,landingDepth:1,accessLandingDepth:1.1,risersPerFlight:8,treadDepth:.275,slabThickness:.18,z0:0};
const yaw=.375,frame={origin:[-5.9*Math.sin(yaw),17.5,-5.9*Math.cos(yaw)],xAxis:[Math.cos(yaw),0,-Math.sin(yaw)],zAxis:[Math.sin(yaw),0,Math.cos(yaw)]};

// Independent float32 descriptor interpreter mirrors the single GPU algorithm.
function packedDistance(template,p) {
  const data=template.texture.data,get=(i,j)=>Array.from(data.slice((i*8+j)*4,(i*8+j+1)*4)); let best=Infinity;
  for(let i=0;i<template.texture.count;i++) {
    const k=get(i,0),a=get(i,1),b=get(i,2),sub=(a,b)=>a.slice(0,3).map((v,j)=>v-b[j]),len=a=>Math.hypot(...a); let distance;
    if(k[0]===0) {const ab=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/dot(ab,ab)));distance=len(sub(p,add(a.slice(0,3),mul(ab,t))));}
    else {const c=get(i,3),u=get(i,4).slice(0,3),v=get(i,5).slice(0,3),q=sub(p,c),x=dot(q,u),y=dot(q,v),rho=Math.hypot(x,y);
      if(rho>1e-9&&y>=0&&x*k[3]-y*a[3]>=0)distance=len(sub(q,mul(add(mul(u,x),mul(v,y)),k[2]/rho)));
      else distance=Math.min(len(sub(p,a)),len(sub(p,b)));
    }
    best=Math.min(best,distance-k[1]);
  }
  return best;
}

test('one exact filleted centerline traverses lower platform, both flights, midlanding and upper platform',()=>{
  const r=deriveStairRails(base);
  assert.equal(r.path.pieces.length,13);assert.equal(r.path.pieces.filter(p=>p.kind==='arc').length,6);
  assert.equal(r.path.mode,'rounded');assert.equal(r.path.tangentContinuous,true);
  assert.deepEqual(r.path,filletPath(r.path.controlPath,r.bendRadius));
  const P=r.path.controlPath; near(P[0][1],r.railHeight);near(P.at(-1)[1],base.floorHeight+r.railHeight);
  assert.ok(P[0][2]<0&&P.at(-1)[2]<0); assert.equal(P[3][1],P[4][1]);
  assert.match(r.representation,/exact_line_and_circular_arc/);assert.equal(r.structuralCertification,false);
  assert.ok(!('mesh' in r));
});

test('every rail join is positional and tangent-continuous with the authored circular radius',()=>{
  const r=deriveStairRails(base),pieces=r.path.pieces;
  for(let i=1;i<pieces.length;i++) {pointNear(pieces[i-1].end,pieces[i].start,1e-9);pointNear(pieces[i-1].tangentEnd,pieces[i].tangentStart,1e-9);}
  for(const p of pieces.filter(p=>p.kind==='arc')) {
    near(p.radius,r.bendRadius);near(Math.hypot(...p.start.map((v,i)=>v-p.center[i])),r.bendRadius);
    near(Math.hypot(...p.end.map((v,i)=>v-p.center[i])),r.bendRadius);near(dot(p.u,p.v),0);
    for(const t of [0,.2,.5,.8,1]) {const q=railPointAt(r.path,p.pathOffset+t*p.length);near(railDistance(r.path,q.point).distance,0,1e-9);near(Math.hypot(...q.tangent),1);}
  }
  assert.ok(r.bendRadius>2*r.radius);assert.ok(r.clearanceContract.supportEdgeClearance>r.supportRadius);
});

test('all eleven analytic struts embed in a specific real platform, landing or tread and meet the exact handrail',()=>{
  const r=deriveStairRails(base);assert.equal(r.supports.length,11);
  assert.deepEqual(new Set(r.supports.map(s=>s.ownerRole)),new Set(['lower-floor','upper-floor','first-flight','second-flight','midlanding']));
  for(const s of r.supports) {
    const surface=stairRailSupportSurface(r.dimensions,s.anchor,s.ownerRole);assert.ok(surface);
    near(s.anchor[1],surface.height);near(s.start[1],surface.height-s.embedDepth);assert.ok(s.embedDepth>0&&s.embedDepth<base.slabThickness);
    near(railDistance(r.path,s.end).distance,0,1e-9);assert.ok(s.end[1]>s.anchor[1]+.6);
    assert.equal(s.start[0],s.end[0]);assert.equal(s.start[2],s.end[2]);
    const middle=s.start.map((v,i)=>(v+s.end[i])/2);assert.ok(queryStairRailLocal(r,middle).distance<0);
    if(s.surfaceKind==='tread') {assert.equal(surface.treadIndex,s.treadIndex);assert.ok(s.treadIndex>=0&&s.treadIndex<base.risersPerFlight);}
  }
  assert.equal(stairRailSupportSurface(r.dimensions,[0,0,1],'first-flight'),null,'A support cannot float in the central flight gap');
  assert.equal(stairRailSupportSurface(r.dimensions,[2,0,-.2],'lower-floor'),null);
});

test('tube centerline keeps conservative clearance from treads and landing except the intentional supports',()=>{
  const r=deriveStairRails(base),d=r.dimensions;
  for(let i=0;i<=1500;i++) {
    const p=railPointAt(r.path,r.path.length*i/1500).point;
    const role=p[2]<d.z0?(p[1]<d.midHeight?'lower-floor':'upper-floor'):p[2]>=d.z1?'midlanding':p[0]<0?'first-flight':'second-flight';
    const surface=stairRailSupportSurface(d,p,role);assert.ok(surface);
    assert.ok(p[1]-r.radius-surface.height>=r.clearanceContract.minimumConservativeHeightAboveTread-1e-7);
    assert.ok(Math.abs(p[0])+r.radius<d.totalWidth/2);
  }
});

test('height and stair geometry changes regenerate every dependent path/support without changing semantic IDs',()=>{
  const a=deriveStairRails(base),b=deriveStairRails({...base,floorHeight:3.6,risersPerFlight:10,treadDepth:.22});
  assert.notEqual(a.railHeight,b.railHeight);assert.notEqual(a.radius,b.radius);
  assert.deepEqual(a.supports.map(s=>s.id),b.supports.map(s=>s.id));
  near(b.path.controlPath.at(-1)[1]-a.path.controlPath.at(-1)[1],3.6-2.844+b.railHeight-a.railHeight);
  for(const s of b.supports) near(s.anchor[1],stairRailSupportSurface(b.dimensions,s.anchor,s.ownerRole).height);
  assert.notDeepEqual(a.path.controlPath,b.path.controlPath);assert.notDeepEqual(a.texture.data,b.texture.data);
  const wide=deriveStairRails({...base,flightWidth:1.3,landingDepth:1.2});assert.ok(wide.path.controlPath[0][0]<a.path.controlPath[0][0]);
});

test('instances retain stable stair/floor ownership and share one template without 24 copies',()=>{
  const template=deriveStairRails(base),instances=Array.from({length:24},(_,i)=>createRailInstance(template,{stairId:`stair-${i}`,lowerFloorId:`floor-${i}`,upperFloorId:`floor-${i+1}`,landingId:`stair-${i}:landing`,frame:{...frame,origin:[frame.origin[0],i*base.floorHeight,frame.origin[2]]}}));
  for(let i=0;i<instances.length;i++) {
    const inst=instances[i];assert.equal(inst.template,template);assert.equal(inst.parentId,`stair-${i}`);
    assert.equal(inst.supports[0].ownerId,`floor-${i}`);assert.equal(inst.supports.at(-1).ownerId,`floor-${i+1}`);
    assert.equal(inst.graph.nodes[0].parentId,`stair-${i}`);
    for(const s of inst.supports) assert.ok(inst.graph.edges.some(e=>e.from===s.id&&e.to===s.ownerId&&e.relation==='embedded_in'));
    const q=railPointAt(template.path,template.path.length*.31).point,world=railToWorld(q,inst.frame);
    pointNear(railToLocal(world,inst.frame),q);near(queryStairRails(inst,world).distance,-template.radius);
  }
  assert.equal(new Set(instances.flatMap(i=>i.graph.nodes.map(n=>n.id))).size,24*(template.supports.length+1));
});

test('bounded CPU queries agree with full analytic line/arc sweeps and float32 packed descriptor evaluation',()=>{
  const r=deriveStairRails(base);let seed=93241;
  const rand=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  for(let i=0;i<1200;i++) {
    const p=[rand()*5-2.5,rand()*5-.5,rand()*5-1],full=queryStairRailLocal(r,p,{useBounds:false});
    near(queryStairRailLocal(r,p).distance,full.distance,1e-12);near(packedDistance(r,p),full.distance,2e-6);
  }
  for(const p of r.primitives) for(let i=0;i<=20;i++) {
    const q=p.kind==='line'?p.start.map((v,j)=>v+(p.end[j]-v)*i/20):railPointAt({pieces:[{...p,pathOffset:0}],length:p.length},p.length*i/20).point;
    for(let j=0;j<3;j++) assert.ok(q[j]>=p.bounds.min[j]-1e-8&&q[j]<=p.bounds.max[j]+1e-8);
  }
});

test('ray AABBs handle parallel rays, CPU rail hits are transformed correctly and budget exhaustion remains unresolved',()=>{
  const r=deriveStairRails(base),inst=createRailInstance(r,{stairId:'s-1',frame});
  const top=r.path.controlPath[0],ro=add(top,[-1,0,0]),rd=[1,0,0],worldRo=railToWorld(ro,frame),worldRd=frame.xAxis;
  const hit=traceStairRails(inst,worldRo,worldRd);assert.equal(hit.status,'hit');assert.equal(hit.hit,true);near(hit.t,1-r.radius,.0002);
  const empty=traceStairRails(inst,railToWorld([8,0,8],frame),[0,1,0]);assert.equal(empty.status,'miss');assert.equal(empty.reason,'outside_bounds');
  const unresolved=traceStairRails(inst,worldRo,worldRd,{maxSteps:0});assert.equal(unresolved.status,'unresolved');assert.equal(unresolved.hit,null);assert.equal(unresolved.reason,'step_budget');
  assert.equal(stairRailRayInterval([2,0,0],[0,1,0],{min:[-1,-1,-1],max:[1,1,1]}),null);
  assert.deepEqual(stairRailRayInterval([0,-2,0],[0,1,0],{min:[-1,-1,-1],max:[1,1,1]}),{near:1,far:3});
  const inside=traceStairRails(r,top,[1,0,0]);assert.equal(inside.status,'hit');assert.ok(inside.t>0);
});

test('one compact descriptor GLSL kernel is independent of floor count and contains no per-rail constant unrolling',()=>{
  const r=deriveStairRails(base),shader=buildStairRailGLSL();
  assert.equal(r.texture.width,8);assert.equal(r.texture.height,r.primitives.length);assert.ok(r.texture.count<STAIR_RAIL_MAX_PRIMITIVES);
  assert.equal(r.texture.data.length,r.texture.width*r.texture.height*4);
  assert.ok(shader.length<5000);assert.equal((shader.match(/float wholeRailArcSquared\(/g)??[]).length,1);
  assert.match(shader,/texelFetch/);assert.match(shader,/wholeRailRayInterval/);assert.match(shader,/if\(next==t\)return -1/);
  assert.equal(buildStairRailGLSL(),shader);assert.ok(!shader.includes(String(r.path.controlPath[0][0])));
  assert.equal(r.distanceContract.minimumPositiveStep,0);assert.equal(r.distanceContract.budgetExhaustion,'unresolved_never_geometric_miss');
});

test('unsupported dimensions and non-rigid instance transforms fail rather than producing floating rails',()=>{
  assert.throws(()=>deriveStairRails({...base,treadDepth:.28}),/complete equal-depth treads/);
  assert.throws(()=>deriveStairRails(base,{railBendRadius:.04}),/twice tube radius/);
  assert.throws(()=>deriveStairRails({...base,landingDepth:.12}),/clearance|twice tube radius/);
  assert.throws(()=>createRailInstance(deriveStairRails(base),{frame:{...frame,xAxis:[2,0,0]}}),/rigid/);
  assert.throws(()=>traceStairRails(deriveStairRails(base),[0,0,0],[0,0,0]),/nonzero/);
});
