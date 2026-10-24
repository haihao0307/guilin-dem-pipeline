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
for(const bad of [{caseId:'real-building'},{stage:0},{stage:8},{stage:1.5},{groundHeight:NaN},{typicalHeight:2},{doorOpen:2},{liftOpen:-1},{liftLevel:2},{roofVisible:'yes'},{waistThickness:.04},{waistThickness:.5}]){assert.throws(()=>growSketch(bad));checks++;}

// R02 regressions from the actual user screenshots. Do not let transparency,
// a visible slab, or thicker columns conceal a disconnected frame joint.
for(const groundHeight of [3.6,4])for(const caseId of ['cell','vertical','connected'])for(let stage=1;stage<=7;stage++){
 const q=growSketch({caseId,groundHeight,stage}),p=all(q),columns=p.filter(p=>p.semanticClass==='column');
 ok(q.checks.passed,'R02 every stage regenerates at both requested heights');
 if(stage<3){equal(columns.length,0,'columns wait for their stage');continue;}
 for(const joint of q.columnJoints){
  // Occupancy is strict interior: the exact shared end-cap is checked by
  // equality below, while these probes check both sides without an overlap.
  for(const dy of[-.159,-.12,-.04,-.001,.001,.08])ok(inside(columns,[joint.position[0],joint.position[1]+dy,joint.position[2]]),'actual column joint continuous even with no visible slab');
  const lower=columns.find(p=>p.nodeId===joint.lowerId),upper=columns.find(p=>p.nodeId===joint.upperId);
  equal(lower.bounds.max[1],upper.bounds.min[1],'column end derives from next column start');
  ok(Math.abs(lower.bounds.max[0]-lower.bounds.min[0]-.28)<1e-8&&Math.abs(upper.bounds.max[2]-upper.bounds.min[2]-.28)<1e-8,'column continuity does not fatten the section');
  ok(q.graph.edges.some(e=>e.from===joint.upperId&&e.to===joint.lowerId&&e.type==='supportedBy'),'upper column directly supported by lower column');
 }
}

function inspectRoute(q,route){
 const p=all(q),surfaces=p.filter(p=>['floor','stair','elevator'].includes(p.semanticClass));
 for(let i=1;i<route.waypoints.length;i++){
  const a=route.waypoints[i-1],b=route.waypoints[i];if(Math.abs(a[1]-b[1])>1e-7)continue;
  for(const t of[.2,.5,.8]){const pnt=a.map((v,k)=>v+(b[k]-v)*t);
   ok(inside(surfaces,[pnt[0],pnt[1]-.025,pnt[2]]),'R02 route retains actual underfoot support');
   for(const y of[.05,.9,1.95])ok(!inside(p,[pnt[0],pnt[1]+y,pnt[2]]),'R02 route clears thin waist, slabs, walls and opened doors');
  }
 }
}
for(const groundHeight of[3.6,4,3.6])for(const waistThickness of[.10,.14,.24]){
 const q=growSketch({caseId:'connected',groundHeight,waistThickness,doorOpen:1,liftOpen:1,liftLevel:1,roofVisible:false}),p=all(q),s=q.stair,stairFields=p.filter(p=>p.moduleId===s.id),byId=id=>p.find(p=>p.nodeId===id);
 equal(s.flights.length,2,'one shared section function generates two flights');equal(s.waistThickness,waistThickness,'normal waist thickness is a real parameter');
 for(const f of s.flights){
  const waist=byId(f.waistId),len=Math.hypot(1,f.slope),normal=[-f.slope/len,1/len];
  for(const t of[.5,.7,.9]){
   const at=[f.x0+f.width/2,f.base+f.rise*t-f.waistVerticalDepth-.08,f.z0+f.direction*f.run*t];
   ok(!inside(stairFields,at),'former solid wedge volume is now genuinely empty');
   ok(!inside(p,at),'empty underflight volume is not refilled by a different component');
  }
  const localPoint=depth=>[f.run*.5-normal[0]*depth,f.rise*.5-normal[1]*depth];
  const world=q=>[f.x0+f.width/2,f.base+q[1],f.z0+f.direction*q[0]];
  ok(inside([waist],world(localPoint(waistThickness*.5))),'mid-thickness normal probe is inside inclined slab');
  ok(!inside([waist],world(localPoint(waistThickness+.02))),'probe past specified normal thickness is empty');
  for(const id of f.treadIds){const step=byId(id);equal(step.loops[0].length,3,'tread is a step wedge, not a full-height box');ok(q.graph.edges.some(e=>e.from===id&&e.to===f.waistId&&e.type==='supportedBy'),'every step rests on its waist');}
 }
 const y=groundHeight/2,lower=byId(s.flights[0].waistId),upper=byId(s.flights[1].waistId),landing=byId(s.landingId),slab=byId(s.upperSlabId),eps=.00001;
 ok(inside([lower],[.95,y-.05,3.8-eps])&&inside([landing],[.95,y-.05,3.8+eps]),'lower flight physically joins landing');
 ok(inside([upper],[2.15,y-.05,3.8-eps])&&inside([landing],[2.15,y-.05,3.8+eps]),'upper flight physically joins landing');
 ok(inside([upper],[2.15,groundHeight-.05,1.4+eps])&&inside([slab],[2.15,groundHeight-.05,1.4-eps]),'upper flight physically joins the upper slab edge');
 for(const route of q.routes.filter(r=>r.type==='entry_to_room'&&r.floorId===q.levels[1].id||r.type==='stair_to_lift'))inspectRoute(q,route);
 for(const facing of q.lift.facing){
  ok(facing.doorCentersAligned&&facing.opposedNormals&&facing.mainFacesBridge&&facing.liftFacesBridge,'actual door normals face the connecting bridge');
  equal(facing.mainDoorFacing,[1,0,0],'main doorway faces out along +X');equal(facing.liftDoorFacing,[-1,0,0],'lift doorway faces corridor along -X');
  ok(Math.abs(facing.mainDoorCenter[2]-.8)<1e-8&&Math.abs(facing.liftDoorCenter[2]-.8)<1e-8,'top-view doorway centers share the corridor axis');
  ok(Math.abs(facing.bridgeLength-.65)<1e-8,'bridge spans the actual facing-door separation');
 }
}
const thin=growSketch({waistThickness:.10}),thick=growSketch({waistThickness:.24});
equal(thin.routes.find(r=>r.type==='stair').waypoints,thick.routes.find(r=>r.type==='stair').waypoints,'waist thickness edits preserve all walk-top coordinates');
ok(JSON.stringify(all(thin).find(p=>p.nodeId.endsWith(':lower-waist')).loops)!==JSON.stringify(all(thick).find(p=>p.nodeId.endsWith(':lower-waist')).loops),'waist thickness changes real analytic geometry');

// Added storeys are full semantic/structural generations, not a scaled shell.
for(const storeys of[2,3,4,5])for(const groundHeight of[3.6,4]){
 for(let stage=1;stage<=7;stage++){
  const q=growSketch({storeys,groundHeight,stage,liftLevel:storeys-1});
  ok(q.checks.passed,'all multi-storey stages validate');equal(q.levels.length,storeys,'requested level count');
  equal(q.levels.map(l=>l.elevation),Array.from({length:storeys},(_,i)=>i?groundHeight+(i-1)*3:0),'levels derive from ground plus typical heights');
  equal(q.counts.frameColumns,storeys*6,'shared frame count grows by distinct storey');equal(q.counts.frameBeams,storeys*7,'shared beam count grows by distinct storey');
  equal(q.stair.connections.length,storeys-1,'every adjacent level has one stair connection');
  ok(q.model.archetypes.every(a=>a.primitives.length<=64),'multi-storey descriptor batches remain bounded');
  ok(q.model.archetypes.every(a=>q.model.instances.filter(i=>i.archetypeId===a.id).length<=32),'per-archetype instance count stays within renderer budget');
  const ids=all(q).map(p=>p.objectId);equal(new Set(ids).size,ids.length,'multi-storey render IDs remain unique');
  if(stage>=3)for(const joint of q.columnJoints){const a=all(q).find(p=>p.nodeId===joint.lowerId),b=all(q).find(p=>p.nodeId===joint.upperId);equal(a.bounds.max[1],b.bounds.min[1],'every new-storey column joint meets exactly');}
 }
 const q=growSketch({storeys,groundHeight,doorOpen:1,liftOpen:1,liftLevel:storeys-1,roofVisible:false}),p=all(q),upperRooms=q.routes.filter(r=>r.type==='entry_to_room'&&r.floorId!==q.levels[0].id);
 equal(upperRooms.length,(storeys-1)*2,'ground entry reaches both rooms on every upper storey');
 for(const route of upperRooms){equal(route.waypoints[0],[.95,0,-.1],'every full room route starts at the same ground entry');equal(route.waypoints.at(-1)[1],q.levels.find(l=>l.id===route.floorId).elevation,'full route terminates at the requested storey');inspectRoute(q,route);}
 for(const c of q.stair.connections){
  const slab=p.find(p=>p.nodeId===c.upperSlabId),y=c.baseElevation+c.height;
  for(const [x,z]of[[.95,2.6],[2.15,2.6],[1.6,4.2]])ok(!inside([slab],[x,y-.08,z]),'every upper slab has its real stair hole');
  ok(inside([slab],[5.09,y-.08,2.7]),'upper room slab was not hidden to fake access');
  const start=q.levels.find(l=>l.id===c.fromFloorId),end=q.levels.find(l=>l.id===c.toFloorId);equal(c.baseElevation,start.elevation,'stair lower port matches floor');equal(c.baseElevation+c.height,end.elevation,'stair upper port matches floor');
 }
 equal(q.lift.shaftBottom,-1.2,'pit extends downward from ground datum');equal(q.lift.shaftTop,q.roofElevation+1,'shaft top follows building roof and assumed overhead');equal(q.lift.shaftAxis,[0,1,0],'shaft remains vertical, not tilted');equal(q.lift.machineRoom,'unknown_not_generated','no unsupported machine-room claim');
 ok(!inside(p,[9.65,-.6,1]),'pit interior remains a real empty cavity');ok(inside(p,[9.65,-1.1,1]),'pit has a real bottom slab');
 equal(q.lift.attachments.length,storeys,'each floor gets a dock and bridge');equal(q.lift.elevation,q.levels.at(-1).elevation,'cabin can reach highest stop');
 for(const [i,a]of q.lift.attachments.entries()){equal(a.position[1],q.levels[i].elevation,'landing door height follows floor');ok(q.lift.facing[i].mainFacesBridge&&q.lift.facing[i].liftFacesBridge,'added-floor doors face one another');}
 const topLiftRoute=q.routes.find(r=>r.type==='stair_to_lift'&&r.floorId===q.levels.at(-1).id);ok(topLiftRoute.traversable,'top landing route becomes usable when cabin and doors agree');inspectRoute(q,topLiftRoute);
}
for(let liftLevel=0;liftLevel<5;liftLevel++){
 const q=growSketch({storeys:5,liftLevel,liftOpen:1,doorOpen:1}),p=all(q),car=p.find(p=>p.nodeId===q.lift.cabinId+':floor');
 equal(car.bounds.max[1],q.levels[liftLevel].elevation,'five-stop cabin floor aligns with landing');ok(car.bounds.min[1]>q.lift.pitFloorTop,'cabin never enters pit bottom slab');
 equal(q.portals.filter(p=>p.moduleId===q.lift.id&&p.open===1).length,1,'only occupied landing opens its lift doors');
 const approach=q.lift.facing[liftLevel].bridgeRoute;inspectRoute(q,{waypoints:approach});
}
const twoBefore=JSON.stringify(growSketch({storeys:2}));growSketch({storeys:4});equal(JSON.stringify(growSketch({storeys:2})),twoBefore,'storeys 2 -> 4 -> 2 has no residual nodes or geometry');
equal(growSketch({caseId:'cell',storeys:5}).levels.length,1,'single-cell study remains one storey');
const alteredPit=growSketch({storeys:4,pitDepth:1.6,overhead:1.4});equal(alteredPit.lift.shaftBottom,-1.6,'pit-depth parameter changes actual bottom');equal(alteredPit.lift.shaftTop,alteredPit.roofElevation+1.4,'overhead parameter changes actual shaft top');
for(const args of[{storeys:1},{storeys:6},{storeys:2.5},{storeys:5,liftLevel:5},{pitDepth:.1},{overhead:0}]){assert.throws(()=>growSketch(args));checks++;}
equal(sourceFiles.map(hash),before,'source generators and libraries remain byte-for-byte unchanged');
console.log(JSON.stringify({passed:true,checks,revision:'R02',cases:3,stagesPerCase:7,storeys:[2,3,4,5],geometry:'finite_polygon_prism',columnJointsContinuous:true,thinWaistAndStepWedges:true,underFlightsHollow:true,liftDoorFacingVerified:true,allFloorRoutesVerified:true,pitVerified:true,sourceUnchanged:true,certified:false}));
