import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {growSketch,SKETCH_STAGES} from './sketch-model.mjs';
import {validateSupportProgram} from './frame-growth.mjs';
import {validateOpeningOwnership} from './opening-ownership.mjs';
import {ASSEMBLY_SCHEMA,queryAssemblyInside,packAssemblyDescriptors,intersectAssemblyRay} from './kowloon-building-mother-r01/r07/assemblies.mjs';
import {buildRegistry} from './kowloon-building-mother-r01/whole-building-facade-r01/semantic-registry.mjs';

let checks=0;const ok=(x,label)=>{assert(x,label);checks++;},equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const all=q=>q.model.archetypes.flatMap(a=>a.primitives),spec=ps=>({schema:ASSEMBLY_SCHEMA,primitives:ps}),inside=(ps,p)=>queryAssemblyInside(spec(ps),p);
const hash=p=>createHash('sha256').update(fs.readFileSync(new URL(p,import.meta.url))).digest('hex');
const sourceFiles=['frame-growth.mjs','kowloon-building-mother-r01/whole-building-floor-study-r01/floor-layout.mjs','kowloon-building-mother-r01/r07/assemblies.mjs'];
const before=sourceFiles.map(hash);
equal(SKETCH_STAGES.map(s=>s.stage),[1,2,3,4,5,6,7],'seven relationship-reveal stages');

for(const caseId of ['cell','vertical','connected']){
 let previous=0;
 for(let stage=1;stage<=7;stage++){
  const q=growSketch({caseId,stage}),ps=all(q),registry=buildRegistry(q.model,q.source);
  ok(q.checks.passed,caseId+' checks');ok(validateSupportProgram(q.supportProgram).passed,'support DAG');
  ok(validateOpeningOwnership(q.graph,q.model.openingOwnership.chains).passed,'full opening ownership chain');
  ok(ps.length>=previous,'stage reveal is additive');previous=ps.length;
  ok(ps.every(p=>p.kind==='finite_polygon_prism'&&p.stage<=stage),'only requested analytic solids');
  ok(q.model.archetypes.every(a=>a.primitives.length>0&&a.primitives.length<=64),'bounded GPU archetypes');
  for(const a of q.model.archetypes){const packed=packAssemblyDescriptors(a);ok(packed.data.every(Number.isFinite),'finite packed descriptors');}
  ok(q.model.instances.every(i=>i.objectIdOffset===10000&&i.translation.every(v=>v===0)),'compatible zero-translation instances');
  equal(q.model.interfaces.stairs,[],'renderer must not derive an unrelated legacy stair');
  equal(q.source.patches,[],'no fake measured source patches');equal(q.source.bounds,q.model.bounds,'finite source-only bounds contract');
  equal(new Set(ps.map(p=>p.objectId)).size,ps.length,'unique primitive IDs across archetypes');
  equal(new Set(registry.map(p=>p.objectId)).size,registry.length,'no render ID collisions');
  equal(q.counts.primitives,ps.length,'count comes from emitted fields');
  ok(q.model.bounds.min.every(Number.isFinite)&&q.model.bounds.max.every(Number.isFinite),'finite model bounds');
  ok(q.graph.nodes.every(n=>q.graph.nodes.filter(m=>m.id===n.id).length===1),'graph IDs unique');
  const order=new Map(validateSupportProgram(q.supportProgram).generationOrder.map((id,i)=>[id,i]));
  ok(q.graph.edges.filter(e=>e.type==='dependsOn').every(e=>order.get(e.to)<order.get(e.from)),'every support precedes its dependent in DAG');
  if(stage<5)ok(!ps.some(p=>p.semanticClass==='roof'),'roof absent before stage five');
 }
}
const connected=growSketch({caseId:'connected',doorOpen:1,liftOpen:1,liftLevel:1}),ps=all(connected);
equal([connected.counts.columnsPerStorey,connected.counts.beamsPerStorey],[6,7],'two bays share 6 columns and 7 beams');
equal([connected.counts.frameColumns,connected.counts.frameBeams],[12,14],'two-storey totals derive from shared grid');
equal(new Set(connected.grid.points.map(p=>p.join(','))).size,6,'shared grid points deduplicated');
equal(new Set(connected.grid.spans.map(s=>[...s].sort().join(','))).size,7,'shared grid edges deduplicated');
for(const portal of connected.portals){
 const host=ps.find(p=>p.nodeId===portal.hostId),point=h=>portal.origin.map((v,k)=>v+portal.u[k]*(portal.lo+portal.hi)/2+portal.v[k]*h);
 ok(!inside([host],point(1)),'door is a physical host void');ok(inside([host],point(portal.height+.08)),'door keeps real lintel');
 const owned=id=>connected.graph.edges.filter(e=>e.from===id&&e.type==='ownedBy').map(e=>e.to);
 equal(owned(portal.id),[portal.hostId],'opening belongs to wall');equal(owned(portal.infillId),[portal.id],'door assembly belongs to opening');
 for(const leafId of portal.leafIds)equal(owned(leafId),[portal.infillId],'leaf belongs to door assembly, not room or wall');
 const classes=connected.graph.nodes.find(n=>n.id===portal.hostId);equal(classes.hostRole,'wall','lift UI class keeps explicit wall role');
}
for(const l of connected.levels){
 const id=l.id+':wall:rooms-divider';equal(connected.graph.edges.filter(e=>e.from===id&&e.type==='ownedBy').map(e=>e.to),[l.nodeId],'shared divider belongs to floor');
 equal(connected.graph.edges.filter(e=>e.from===id&&e.type==='boundsRoom').length,2,'shared divider bounds both rooms without double ownership');
}

const stair=connected.stair,upperSlab=ps.find(p=>p.nodeId===stair.upperSlabId),h=connected.parameters.groundHeight;
for(const p of [[.95,h-.08,2.6],[2.15,h-.08,2.6],[1.6,h-.08,4.2]])ok(!inside([upperSlab],p),'upper slab is actually cut for flights and landing');
for(const p of [[2.15,h-.08,.8],[5.09,h-.08,2.7],[7.09,h-.08,2.7]])ok(inside([upperSlab],p),'corridor and rooms retain their upper floor');
for(const id of stair.treadIds){const p=ps.find(p=>p.nodeId===id),center=p.bounds.min.map((v,k)=>(v+p.bounds.max[k])/2);center[1]=p.bounds.max[1]-.01;ok(inside([p],center),'every tread is an actual finite solid');}
equal(stair.totalRisers,stair.stepsPerFlight*2,'riser count derived from floor height');
ok(Math.abs(stair.rise*stair.totalRisers-h)<1e-9,'stair reaches exact upper elevation');
const walkSurfaces=ps.filter(p=>['floor','stair'].includes(p.semanticClass));
const upperRoutes=connected.routes.filter(p=>p.type==='entry_to_room'&&p.floorId===connected.levels[1].id);
equal(upperRoutes.length,2,'ground-entry routes reach both upper rooms');
for(const route of upperRoutes){
 ok(route.traversable&&route.continuous,'open room doors make route usable');equal(route.waypoints[0],[.95,0,-.1],'route starts at ground entrance');equal(route.waypoints.at(-1)[1],h,'route ends at upper floor');
 for(let i=1;i<route.waypoints.length;i++){
  const a=route.waypoints[i-1],b=route.waypoints[i];if(Math.abs(a[1]-b[1])>1e-7)continue; // The vertical segment is the explicit stair riser.
  for(const t of [.2,.5,.8]){
   const p=a.map((v,k)=>v+(b[k]-v)*t);
   ok(inside(walkSurfaces,[p[0],p[1]-.025,p[2]]),'continuous solid support under route');
   for(const clearance of [.05,.9,1.95])ok(!inside(ps,[p[0],p[1]+clearance,p[2]]),'route body/head not blocked by slabs, beams, walls or open leaves');
  }
 }
}
// Upper lift arrival is separate from the stair route and has a real bridge.
for(let x=7.8;x<9.8;x+=.08){
 ok(inside(ps,[x,h-.04,.8]),'lift bridge and cabin floor meet');
 for(const y of [.1,1.1,1.95])ok(!inside(ps,[x,h+y,.8]),'opened landing path is not sealed by the main wall or lift host');
}

const input={caseId:'connected',groundHeight:3.6,typicalHeight:3,stage:7,doorOpen:1,liftOpen:1,liftLevel:1,roofVisible:false};
const inputBefore=JSON.stringify(input),a=growSketch(Object.freeze(input)),aJSON=JSON.stringify(a),raised=growSketch({...input,groundHeight:4}),restored=growSketch({...input});
equal(JSON.stringify(input),inputBefore,'caller parameters unchanged');equal(JSON.stringify(restored),aJSON,'height edit -> revert is deterministic');equal(JSON.stringify(a),aJSON,'later generation cannot mutate earlier output');
equal(raised.levels[1].elevation,4,'upper floor follows ground height');equal(raised.roofElevation,7,'roof follows both floor heights');
equal(raised.lift.elevation,4,'upper cabin follows actual parameter floor');ok(raised.stair.totalRisers>a.stair.totalRisers,'stair rebuild count follows changed height');
const tallerTop=growSketch({...input,typicalHeight:3.4});equal(tallerTop.roofElevation,7,'typical floor parameter changes roof');equal(tallerTop.levels[1].elevation,3.6,'typical parameter does not move ground-floor ceiling');
const noRoof=growSketch({caseId:'connected',roofVisible:false});ok(!all(noRoof).some(p=>p.semanticClass==='roof'),'roof visibility removes only its render primitive');
ok(noRoof.graph.nodes.some(n=>n.type==='roof_closure'&&!n.visible),'hidden roof remains in dependency graph');equal(noRoof.counts.frameColumns,connected.counts.frameColumns,'roof-off does not remove structure');
const noLift=growSketch({caseId:'connected',liftAttached:false});equal(noLift.lift,null,'lift can detach');ok(!all(noLift).some(p=>p.moduleId.endsWith(':lift')),'detached lift fields removed');
const frame=q=>all(q).filter(p=>p.stage<=5).map(p=>({id:p.nodeId,loops:p.loops,range:p.range,origin:p.origin,u:p.u,v:p.v,w:p.w}));
equal(frame(noLift),frame(growSketch({caseId:'connected'})),'detaching lift leaves original frame and slabs untouched');
const cabin0=growSketch({liftLevel:0}),cabin1=growSketch({liftLevel:1});equal(cabin1.lift.elevation-cabin0.lift.elevation,3.6,'lift has two verified discrete stop states');
const closed=growSketch({caseId:'connected',doorOpen:0}),opened=growSketch({caseId:'connected',doorOpen:1}),door=closed.portals.find(p=>p.from.includes('corridor')&&p.to.includes(':room:'));
const leafClosed=all(closed).find(p=>p.nodeId===door.leafIds[0]),leafOpen=all(opened).find(p=>p.nodeId===door.leafIds[0]);ok(JSON.stringify(leafClosed.u)!==JSON.stringify(leafOpen.u),'door setting changes its real leaf transform');
const hits=connected.model.archetypes.map(a=>intersectAssemblyRay(a,[5.1,12,3],[0,-1,0])).filter(h=>h.hit);ok(hits.length>0,'analytic ray hits the assembled sketch');
for(const bad of [{caseId:'real-building'},{stage:0},{stage:8},{stage:1.5},{groundHeight:NaN},{typicalHeight:2},{doorOpen:2},{liftOpen:-1},{liftLevel:2},{roofVisible:'yes'}]){assert.throws(()=>growSketch(bad));checks++;}
equal(sourceFiles.map(hash),before,'source generators and libraries remain byte-for-byte unchanged');
console.log(JSON.stringify({passed:true,checks,cases:3,stagesPerCase:7,geometry:'finite_polygon_prism',groundToUpperRoomRoutes:upperRoutes.length,sourceUnchanged:true,certified:false}));
