import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultFieldConfig,deriveField,queryField,fieldNormal,buildFieldGLSL,railPointAt,railDistance,filletPath,closestOnArc,stairProfileDistance,traceField,traceFieldAnalytic,queryStructure} from '../r06/field.mjs';
import {createHostRecord,transformLocalToHost,transformHostToLocal,validateHostDomain} from '../r06/host.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} ≠ ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const plus=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>a.map(v=>v/Math.hypot(...a));
const spec=deriveField();
test('same R05 tower source boundary and exact first two floor design dimensions',()=>{
 assert.equal(spec.config.footprint2D.length,20);assert.equal(spec.config.serviceVoid2D.length,4);
 near(spec.config.floorHeight,3.2);near(spec.dimensions.rise,.16);near(spec.dimensions.runLength,2.52);near(spec.dimensions.z0,1.2);near(spec.dimensions.z1,3.72);
 assert.equal(spec.dimensions.treadsPerFlight,9);assert.equal(spec.modelRepresentation,'analytic_fields_only_no_object_meshes');
 assert.equal(spec.semantics.interiorEvidence,'editable_design_not_measured');assert.equal(spec.structuralCertification,false);
 const host=createHostRecord();for(let i=0;i<20;i++){const p=transformLocalToHost([spec.config.footprint2D[i][0],0,spec.config.footprint2D[i][1]]);near(p[0],host.measuredExterior.footprintEastNorth[i][0]);near(-p[2],host.measuredExterior.footprintEastNorth[i][1]);}
 assert.equal(validateHostDomain([[-1.3,0],[1.3,0],[1.3,4.92],[-1.3,4.92]]).valid,true);
});
test('lower and upper slab interiors are solid but their service reserve stays empty',()=>{
 const a=queryField(spec,[2,-.1,0]),b=queryField(spec,[2,3.1,0]);assert.equal(a.objectId,101);assert.ok(a.inside);assert.equal(b.objectId,102);assert.ok(b.inside);
 const sv=spec.config.serviceVoid2D.reduce((a,p)=>plus(a,p,.25),[0,0]);
 for(const y of [-.1,3.1])assert.ok(queryField(spec,[sv[0],y,sv[1]]).distance>.8);
});
test('upper stair opening remains genuinely empty over both lower flight and center gap',()=>{
 for(const p of [[-.7,3.1,2],[0,3.1,2],[.7,3.1,2.5],[0,3.1,4.5]])assert.ok(queryField(spec,p).distance>.05,JSON.stringify(p));
 assert.ok(queryField(spec,[1.4,3.1,2]).inside);assert.ok(queryField(spec,[0,3.1,1]).inside);
});
test('host wall preserves full-height doorway and assigns cut reveals wall material',()=>{
 assert.ok(queryField(spec,[0,4.1,0]).distance>.4);assert.ok(queryField(spec,[.7,4.1,0]).inside);
 near(queryField(spec,[.45,4.1,0]).distance,0);assert.equal(queryField(spec,[.45,4.1,0]).objectId,301);assert.equal(queryField(spec,[.45,4.1,0]).materialRole,2);
 assert.ok(queryField(spec,[0,5.5,0]).inside);assert.ok(queryField(spec,[0,3.2001,0]).distance>0);
});
test('closed stair function gives correct treads, risers, underside and plate signs',()=>{
 const c=spec.config;
 near(stairProfileDistance(.14,.16,c),0);assert.ok(stairProfileDistance(.14,.1,c)<0);assert.ok(stairProfileDistance(.14,.20,c)>0);
 near(stairProfileDistance(.28,.24,c),0);assert.ok(stairProfileDistance(.28-1e-5,.24,c)>0);assert.ok(stairProfileDistance(.28+1e-5,.24,c)<0);
 near(stairProfileDistance(1.4,.6,c),0);assert.ok(stairProfileDistance(1.4,.59,c)>0);assert.ok(stairProfileDistance(1.4,.65,c)<0);
 assert.ok(stairProfileDistance(-.01,.08,c)>0);assert.ok(stairProfileDistance(2.53,1.3,c)>0);
});
test('each nine-tread flight has correct analytic surfaces and stable semantic IDs',()=>{
 for(let k=0;k<9;k++){
  const z=1.2+(k+.5)*.28,y=(k+1)*.16;
  near(queryField(spec,[-.7,y,z]).distance,0,1e-8);assert.equal(queryField(spec,[-.7,y-.02,z]).objectId,201);
  near(queryField(spec,[.7,1.6+y,3.72-(k+.5)*.28]).distance,0,1e-8);assert.equal(queryField(spec,[.7,1.6+y-.02,3.72-(k+.5)*.28]).objectId,202);
 }
});
test('plate faces physically complete final risers and adjoining fields do not leave gaps',()=>{
 for(const [x,z,y]of [[-.7,3.72,1.42],[.7,1.2,3.02]]){
  assert.ok(queryField(spec,[x,y,z-1e-6]).distance<1e-5);assert.ok(queryField(spec,[x,y,z+1e-6]).distance<1e-5);
 }
 assert.ok(queryField(spec,[0,1.5,4.3]).inside);assert.equal(queryField(spec,[0,1.5,4.3]).objectId,203);
});
test('rounded rail is one continuous nine-piece analytic line/arc path with G1 joins',()=>{
 assert.equal(spec.rail.pieces.length,9);assert.equal(spec.rail.pieces.filter(p=>p.kind==='arc').length,4);assert.equal(spec.rail.tangentContinuous,true);
 for(let i=1;i<spec.rail.pieces.length;i++){const a=spec.rail.pieces[i-1],b=spec.rail.pieces[i];near(distance(a.end,b.start),0);near(dot(a.tangentEnd,b.tangentStart),1);near(a.pathOffset+a.length,b.pathOffset);}
 for(const p of spec.rail.pieces.filter(p=>p.kind==='arc')){near(distance(p.start,p.center),spec.config.railBendRadius);near(distance(p.end,p.center),spec.config.railBendRadius);assert.ok(p.radius>spec.config.railRadius*2);}
});
test('finite arc closest point handles sweep interior, both endpoints and center axis',()=>{
 const a=spec.rail.pieces.find(p=>p.kind==='arc'),mid=railPointAt(spec.rail,a.pathOffset+a.length/2).point;
 near(closestOnArc(mid,a).distance,0);near(closestOnArc(a.start,a).distance,0);near(closestOnArc(a.end,a).distance,0);
 near(closestOnArc(a.center,a).distance,a.radius);near(closestOnArc(plus(a.center,a.planeNormal,.3),a).distance,Math.hypot(a.radius,.3));
 const before=plus(a.start,a.tangentStart,-.1);near(closestOnArc(before,a).t,0);
});
test('rail tube surface and normals remain continuous across curved joins',()=>{
 for(let i=1;i<spec.rail.pieces.length;i++){
  const join=spec.rail.pieces[i].pathOffset,at=railPointAt(spec.rail,join),radial=unit(cross(at.tangent,[0,1,.137]));
  const p=plus(at.point,radial,spec.config.railRadius);near(railDistance(spec.rail,p).distance,spec.config.railRadius,1e-7);
  const n=fieldNormal(spec,p);assert.ok(dot(n,radial)>.999);
  const left=railPointAt(spec.rail,join-1e-5),right=railPointAt(spec.rail,join+1e-5);assert.ok(dot(left.tangent,right.tangent)>.999999);
 }
});
test('rail centerline and all rounded bends stay outside the step walking surface',()=>{
 const without=deriveField({...spec.config,railsEnabled:false});let minimum=Infinity;
 for(let i=0;i<=500;i++){const p=railPointAt(spec.rail,spec.rail.length*i/500).point;minimum=Math.min(minimum,queryField(without,p).distance-spec.config.railRadius);}
 near(minimum,.025,1e-6); // 60 mm center inset minus 35 mm rail radius at the upper slab hole edge.
});
test('angular mode is honestly labeled C0 and does not falsely claim smooth joins',()=>{
 const a=deriveField({...spec.config,railCornerMode:'angular'});assert.equal(a.rail.tangentContinuous,false);assert.equal(a.rail.pieces.length,5);assert.ok(a.rail.pieces.every(p=>p.kind==='line'));assert.match(a.rail.junctionRule,/C0/);
});
test('invalid dimensions, unsafe bend radius, reversal and overlapping trims are rejected',()=>{
 for(const bad of [null,{unknown:1},{footprint2D:[[0,0],[1,1],[0,1],[1,0]]},{floorHeight:NaN},{doorWidth:2},{wallHeight:2.25,doorHeight:2.2},{railRadius:.05,railBendRadius:.08},{risersPerFlight:9.2},{railCornerMode:'magic'}])assert.throws(()=>deriveField(bad));
 assert.throws(()=>filletPath([[0,0,0],[1,0,0],[0,0,0]],.1),/reversal/);
 assert.throws(()=>filletPath([[0,0,0],[.1,0,0],[.1,0,.1],[.2,0,.1]],.2),/overlap/);
 assert.throws(()=>filletPath([[0,0,0],[0,0,0]],.1),/Duplicate/);
});
test('straight rail path has no artificial arc or division by zero',()=>{
 const p=filletPath([[0,0,0],[0,0,1],[0,0,2]],.2);assert.equal(p.pieces.filter(q=>q.kind==='arc').length,0);near(p.length,2);near(railDistance(p,[.3,0,1]).distance,.3);
});
test('signed field obeys sampled 1-Lipschitz bound across noses, holes and rail turns',()=>{
 let seed=1234567;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<5000;i++){const p=[(random()-.5)*4,random()*6-.3,random()*7-1],q=plus(p,[random()-.5,random()-.5,random()-.5],.1);
 const delta=Math.abs(queryField(spec,p).distance-queryField(spec,q).distance);assert.ok(delta<=distance(p,q)+1e-8,`Lipschitz failure ${JSON.stringify({p,q,delta})}`);}
});
test('rigid host transform preserves metre-valued field and material coordinates',()=>{
 const frame=createHostRecord().designFrame;for(const p of [[-.7,.16,1.34],[.7,2.4,2.3],[.45,4.2,0]]){
 const roundtrip=transformHostToLocal(transformLocalToHost(p,frame),frame),a=queryField(spec,p),b=queryField(spec,roundtrip);near(a.distance,b.distance);near(distance(a.local,b.local),0);assert.equal(a.materialRole,b.materialRole);}
});
test('reference ray marcher hits thin rail, wall, tread and can exit from inside solid',()=>{
 const c=railPointAt(spec.rail,spec.rail.length*.16),rd=unit(cross(c.tangent,[0,1,0])),origin=plus(c.point,rd,.3),hit=traceField(spec,origin,rd.map(v=>-v));assert.ok(hit.hit);assert.equal(hit.objectId,401);near(hit.t,.3-spec.config.railRadius,.001);
 const wall=traceField(spec,[.8,4.2,-1],[0,0,1]);assert.ok(wall.hit);assert.equal(wall.objectId,301);
 const floor=traceField(spec,[2,-.1,0],[0,1,0]);assert.ok(floor.hit);near(floor.point[1],0,.001);
 const hole=traceField(spec,[0,4.2,-1],[0,0,1],{maxDistance:1.5});assert.equal(hole.hit,false);assert.equal(hole.reason,'range');
});
test('step budget exhaustion is unresolved, never silently a geometric miss',()=>{
 const r=traceField(spec,[0,4.2,-1],[0,0,1],{maxSteps:1,maxDistance:100});assert.equal(r.hit,false);assert.equal(r.reason,'step_budget');
});
test('same configuration is deterministic and no model mesh constructors or buffers exist',()=>{
 assert.deepEqual(deriveField(),deriveField());assert.equal(buildFieldGLSL(spec),buildFieldGLSL(deriveField()));
 const source=readFileSync(new URL('../r06/field.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/new\s+(?:THREE\.)?(?:Mesh|BufferGeometry|CylinderGeometry|BoxGeometry|Float32Array|Uint16Array|Uint32Array)\s*\(/);
 assert.doesNotMatch(source,/marching.?cubes|createVertexArray|bufferData|drawElements/i);
 const glsl=buildFieldGLSL(spec);assert.match(glsl,/struct FieldHit/);assert.match(glsl,/float mapDistance\(vec3 p\)/);assert.match(glsl,/vec3 fieldNormal\(vec3 p\)/);
});

test('analytic bounding-field pruning leaves every value and semantic winner unchanged',()=>{
 let seed=61;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<2000;i++){const p=[(random()-.5)*8,random()*7-1,random()*10-2];assert.deepEqual(queryField(spec,p),queryField(spec,p,{useBounds:false}));}
});

test('analytic plane domain tracing preserves door, stair and service apertures',()=>{
 const wall=traceFieldAnalytic(spec,[.8,4.2,-1],[0,0,1]);near(wall.t,.94,1e-8);assert.equal(wall.objectId,301);assert.equal(wall.reason,'analytic_structural_boundary');
 const open=traceFieldAnalytic(spec,[0,4.2,-1],[0,0,1]);assert.equal(open.status,2);
 const holeSide=traceFieldAnalytic(spec,[0,3.1,2],[1,0,0]);near(holeSide.t,1.3);assert.equal(holeSide.objectId,102);
 const sv=spec.config.serviceVoid2D.reduce((a,p)=>plus(a,p,.25),[0,0]);const side=traceFieldAnalytic(spec,[sv[0],3.1,sv[1]],[1,0,0]);assert.equal(side.objectId,102);assert.ok(side.t>.8&&side.t<1.5);
});
test('analytic trace rejects touching internal flight/platform and flight/floor faces',()=>{
 const landing=traceFieldAnalytic(spec,[-.7,1.42,3.71],[0,0,1]);near(landing.t,1.21,1e-7);assert.equal(landing.objectId,203);
 const upstairs=traceFieldAnalytic(spec,[.7,3.02,1.21],[0,0,-1]);assert.ok(upstairs.t>1);assert.equal(upstairs.objectId,102);
});
test('analytic structural trace directly solves nearly tangent floor rays',()=>{
 // This ray stays near the underside for metres. A distance marcher converges
 // slowly; the exact slab-plane equation is independent of that grazing angle.
 const hit=traceFieldAnalytic(spec,[2,2.99999,-2],[0,.000002,1]);assert.equal(hit.status,1);assert.equal(hit.objectId,102);near(hit.point[1],3,1e-8);assert.equal(hit.reason,'analytic_structural_boundary');
 assert.equal(hit.steps,0);
});
test('analytic ray can leave a solid and return an explicit inspection cut face',()=>{
 const inside=traceFieldAnalytic(spec,[2,-.1,0],[0,1,0]);near(inside.t,.1);assert.equal(inside.status,1);
 const cut=traceFieldAnalytic(spec,[-2,3.1,.5],[1,0,0],{clipX:-.2});near(cut.t,1.8);near(cut.point[0],-.2);assert.equal(cut.objectId,102);assert.ok(cut.distance<0);
 const full=queryField(spec,cut.point);assert.ok(full.inside,'Cut changes only display trace, not the authoritative field');
});
test('analytic trace confines rail marching before the closest structural hit',()=>{
 const q=railPointAt(spec.rail,spec.rail.length*.16),radial=unit(cross(q.tangent,[0,1,0])),origin=plus(q.point,radial,.3);
 const r=traceFieldAnalytic(spec,origin,radial.map(n=>-n));assert.equal(r.objectId,401);assert.equal(r.reason,'rail_field');assert.ok(r.steps>0&&r.steps<50);near(r.t,.3-spec.config.railRadius,.001);
 assert.equal(traceFieldAnalytic(spec,origin,radial.map(n=>-n),{maxSteps:0}).status,3);
});
test('under-stair view grid has no unresolved distant structural grazing pixels',()=>{
 const eye=[5,.35,6.5],target=[0,1.3,2.8],forward=unit(target.map((v,i)=>v-eye[i])),right=unit(cross(forward,[0,1,0])),up=cross(right,forward),scale=Math.tan(42*Math.PI/360);
 let hits=0,rail=0,maxSteps=0;
 for(let y=0;y<14;y++)for(let x=0;x<20;x++){
  const u=((x+.5)/20*2-1)*20/14,v=(1-(y+.5)/14*2),rd=unit(plus(plus(forward,right,u*scale),up,v*scale)),r=traceFieldAnalytic(spec,eye,rd);
  assert.notEqual(r.status,3,JSON.stringify({x,y,r}));maxSteps=Math.max(maxSteps,r.steps);if(r.hit){hits++;if(r.objectId===401)rail++;near(Math.max(queryField(spec,r.point).distance,0),0,.001);}
 }
 assert.ok(hits>60);assert.ok(maxSteps<512);
});
test('emitted analytic trace contains only plane equations and bounded field queries',()=>{
 assert.ok(spec.structurePlanes.length>60&&spec.structurePlanes.length<100);const glsl=buildFieldGLSL(spec);assert.match(glsl,/bool fieldTraceRayClipped/);assert.match(glsl,/bool fieldTraceRay\(/);assert.match(glsl,/FieldHit mapStructure/);assert.match(glsl,/FIELD_BOUNDARY_EQUATIONS/);
 for(const p of spec.structurePlanes){near(Math.hypot(...p.normal),1);assert.ok(Number.isFinite(p.offset));}
});
