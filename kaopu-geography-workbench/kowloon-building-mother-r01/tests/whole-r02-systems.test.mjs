import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {deriveMeasuredCase} from '../r07/cases.mjs';
import {ASSEMBLY_SCHEMA,queryAssemblyInside,packAssemblyDescriptors} from '../r07/assemblies.mjs';
import {profileFor,SOURCE_SHA256} from '../r07/profiles.mjs';
import {CASE_SYSTEM_SCHEMA,deriveCaseSystem,validateCaseSystem,queryCaseSystem,intersectCaseSystemRay,routeCaseSystem,loadingRouteCaseSystem,selectedCaseInstances,createLiftState,targetLift,advanceLift,liftDoorLinks,liftVisuals,packCaseSystemDescriptors} from '../whole-building-r02/case-systems.mjs';

const clone=x=>structuredClone(x),add=(a,b)=>a.map((v,i)=>v+b[i]);
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const official=JSON.parse(fs.readFileSync(new URL('../r07/sources/official-footprints.json',import.meta.url)));
const scores=Object.fromEntries(['lowrise','warehouse'].map(id=>{const profile=profileFor(id),bytes=fs.readFileSync(new URL('../../hk-three-buildings-r01/geometry/'+profile.modelId+'.score.json',import.meta.url));return[id,{bytes,score:JSON.parse(bytes)}];}));
const measured=Object.fromEntries(Object.entries(scores).map(([id,s])=>[id,deriveMeasuredCase(s.score)]));
const models=Object.fromEntries(Object.entries(measured).map(([id,m])=>[id,deriveCaseSystem(id,m,official)]));

test('the source models and exact official component rings remain immutable',()=>{
 const before=JSON.stringify({measured,official});for(const id of ['lowrise','warehouse']){const s=deriveCaseSystem(id,measured[id],official);assert.equal(s.schema,CASE_SYSTEM_SCHEMA);assert.equal(crypto.createHash('sha256').update(scores[id].bytes).digest('hex'),SOURCE_SHA256[profileFor(id).modelId]);assert.equal(s.sourceViewUnchanged,true);assert.equal(s.sourceTransformApplied,false);for(const c of s.components){const record=official.parts.find(p=>p.componentId===c.sourceComponentId),o=s.sourceGeoreference.originEastingNorthingHeight;assert.deepEqual(c.rings,record.ringsEPSG2326.map(r=>r.slice(0,-1).map(p=>[p[0]-o[0],o[1]-p[1]])));}}
 assert.equal(JSON.stringify({measured,official}),before);
});

test('lowrise is exactly two source-bound storeys, distinct shared gate and house entry, no invented elevator',()=>{
 const s=models.lowrise;assert.deepEqual(s.levels.map(l=>l.id),['L01','L02']);assert.deepEqual(s.levels.map(l=>l.actualFloorLabel),['G/F','1/F']);assert.deepEqual(s.sourceBinding.officialObjectIds,[47805]);assert.equal(s.interfaces.lifts.length,0);assert.equal(createLiftState(s),null);assert.notEqual(s.sharedGate.id,s.entry.id);assert.equal(s.sharedGate.routeToHouseVerified,false);assert.equal(s.entry.streetApproachGenerated,false);assert.notDeepEqual(s.sharedGate.point,s.entry.point);assert.equal(s.interfaces.stairs.length,1);assert.equal(s.rails.instances.length,1);assert.equal(s.fitReport.connectedFloors,2);assert.throws(()=>routeCaseSystem(s,'L02',{mode:'lift'}),/No invented lift/);
});

test('warehouse source scopes remain separate and its authored 14 levels are not a verified total',()=>{
 const s=models.warehouse;assert.equal(s.levels.length,14);assert.deepEqual(s.levels.map(l=>l.id),['P01','P02',...Array.from({length:12},(_,i)=>'W'+String(i+1).padStart(2,'0'))]);assert.deepEqual(s.sourceBinding.officialObjectIds,[237016,158577]);assert.equal(s.summary.officialTotalStoreysVerified,false);assert.equal(s.summary.basementGenerated,false);assert.equal(s.summary.unitCount,0);assert.equal(s.interfaces.lifts.length,1);assert.equal(s.interfaces.lifts[0].actualLiftCount,null);assert.match(s.interfaces.lifts[0].label,/DESIGN/);assert.equal(s.profile.storeys.podiumBasementRecord,2);near(s.components[0].topMpd,17.5);near(s.components[1].baseMpd,17.5);near(s.levels[2].elevationMpd,17.68);near(s.sourceBinding.mainRoofMpd,51.347997667163086);assert.ok(s.sourceBinding.officialMeasuredTopDifference>0);assert.ok(s.levels.at(-1).elevation+s.levels.at(-1).height<s.sourceBinding.mainRoofLocal);assert.equal(s.graph.nodes.some(n=>n.type==='unit'),false);
});

test('tall podium rises are subdivided into bounded physical stairs and real non-storey transfer platforms',()=>{
 const s=models.warehouse;assert.equal(s.interfaces.stairs.length,15);assert.equal(s.transferLevels.length,2);for(const pair of [['P01','P02'],['P02','W01']]){const stairs=s.interfaces.stairs.filter(t=>t.fromFloorId===pair[0]&&t.toFloorId===pair[1]);assert.equal(stairs.length,2);for(const t of stairs){near(t.rise,3.375);near(t.layout.floorHeight/(2*t.layout.risersPerFlight),.16875);assert.ok(t.layout.treadDepth>=.25);near(t.path[0][1],t.lowerElevation);near(t.path.at(-1)[1],t.upperElevation);}near(stairs[0].upperElevation,stairs[1].lowerElevation);assert.equal(stairs[0].toLandingId,stairs[1].fromLandingId);}
 for(const t of s.transferLevels){assert.equal(t.occupiedStorey,false);assert.ok(!s.levels.some(l=>l.id===t.id));const i=s.instances.find(i=>i.id===t.id+':instance');assert.equal(i.kind,'transfer');assert.equal(queryCaseSystem(s,[-10,t.elevation-.02,-.6],{instances:s.instances}).inside,true);}
 const bad=clone(s);bad.instances=bad.instances.filter(i=>i.kind!=='transfer');assert.throws(()=>validateCaseSystem(bad),/support|platform|Unsupported/i);
});

test('archetypes and inverse-translation instances remain finite-function descriptors, with no object meshes',()=>{
 for(const s of Object.values(models)){assert.equal(s.counts.modelTriangles,0);assert.equal(s.counts.modelVertexBuffers,0);for(const a of s.archetypes){assert.equal(a.schema,ASSEMBLY_SCHEMA);assert.equal(a.spec.primitives,a.primitives);assert.ok(a.primitives.every(p=>p.kind==='finite_polygon_prism'));assert.ok(packAssemblyDescriptors(a).data.length>0);}assert.equal(packCaseSystemDescriptors(s).flattened,false);assert.ok(s.rails.templates.every(t=>t.primitives.every(p=>['line','arc'].includes(p.kind))));}
 const s=models.warehouse;assert.equal(s.instances.filter(i=>i.archetypeId==='tower-floor').length,12);assert.ok(s.counts.primitives<s.counts.expandedPrimitiveCount);assert.equal(selectedCaseInstances(s,{floorIds:['W04']}).filter(i=>i.kind==='floor').length,1);
});

test('upper slabs preserve genuine independent stair and freight apertures; lower floor supports the first stair',()=>{
 for(const s of Object.values(models))for(const l of s.levels){const a=s.archetypes.find(a=>a.id===l.archetypeId),plate=a.primitives.find(p=>p.nodeId==='floor:slab');for(const hole of [a.holes.stair,...a.holes.lifts].filter(Boolean)){const center=hole.reduce((p,q)=>p.map((v,i)=>v+q[i]/hole.length),[0,0]);assert.equal(queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives:[plate]},[center[0],-.05,center[1]]),false);}}
 const low=models.lowrise,ground=low.levels[0];assert.equal(queryCaseSystem(low,[0,ground.elevation-.05,.5],{floorIds:[ground.id]}).inside,true);const s=models.warehouse,l=s.levels.find(l=>l.id==='W04'),h=intersectCaseSystemRay(s,[-10,l.elevation+.25,1],[0,-1,0],{floorIds:[l.id],maxDistance:.4});assert.equal(h.hit,false);const bad=clone(s);bad.archetypes.find(a=>a.id==='tower-floor').primitives[0].loops.pop();assert.throws(()=>validateCaseSystem(bad),/void/);
});

test('every rail has exact line/arc geometry and graph-owned supports embedded in real stair or platform fields',()=>{
 for(const s of Object.values(models)){const ids=new Set(s.graph.nodes.map(n=>n.id));for(const r of s.rails.instances){assert.ok(ids.has(r.id));for(const p of r.supports){assert.ok(ids.has(p.ownerId));assert.equal(queryCaseSystem(s,p.startWorld,{instances:s.instances}).inside,true);}}assert.equal(s.fitReport.railSupportsOnRealFields,true);assert.equal(s.fitReport.continuousVerticalClearanceRaysPassed,true);}
});

test('entry-to-top routes physically traverse every stair module and real intermediate landing',()=>{
 for(const s of Object.values(models)){const route=routeCaseSystem(s,s.levels.at(-1).id);assert.equal(route.segments.filter(p=>p.kind==='stairs').length,s.interfaces.stairs.length);assert.equal(route.targetFloorId,s.levels.at(-1).id);for(const part of route.segments.filter(p=>p.points&&p.kind!=='stairs'))for(let k=1;k<part.points.length;k++){const a=part.points[k-1],b=part.points[k],N=Math.max(1,Math.ceil(Math.hypot(...b.map((v,i)=>v-a[i]))/.3));for(let j=0;j<=N;j++){const p=a.map((v,i)=>v+(b[i]-v)*j/N);assert.ok(queryCaseSystem(s,add(p,[0,-.012,0]),{instances:s.instances}).distance<=1e-7);assert.equal(queryCaseSystem(s,add(p,[0,1.8,0]),{instances:s.instances}).inside,false);}}}
 const s=models.warehouse,route=routeCaseSystem(s,'W12');assert.equal(route.segments.filter(p=>p.kind==='transfer').length,2);const bad=clone(s);bad.interfaces.stairs[0].path.at(-1)[1]+=.1;assert.throws(()=>validateCaseSystem(bad),/join mismatch/);
});

test('warehouse pedestrian and loading routes are spatially separate, backed by a divider and loading field',()=>{
 const s=models.warehouse,r=loadingRouteCaseSystem(s);assert.notDeepEqual(s.loading.point,s.entry.point);assert.deepEqual(r.segments.map(p=>p.kind),['vehicle-to-loading-bay','goods-transfer-to-freight-interface']);assert.equal(r.vehicleStopsBeforeFreightDoor,true);assert.equal(r.freightBoardingRequiresArrival,true);assert.ok(s.fitReport.minimumPedestrianLoadingSeparation>7);assert.ok(s.instances.some(i=>i.kind==='circulation'));const y=s.levels[0].elevation;assert.equal(queryCaseSystem(s,[-17.1,y+.3,0],{instances:s.instances}).inside,true);assert.throws(()=>loadingRouteCaseSystem(models.lowrise),/No loading route/);
});

test('one DESIGN freight core shares authoritative floor stops and never opens absent or moving cabin doors',()=>{
 const s=models.warehouse,lift=s.interfaces.lifts[0];assert.deepEqual(lift.servedFloorIds,s.levels.map(l=>l.id));assert.deepEqual(lift.stopElevations,s.levels.map(l=>l.elevation));let state=createLiftState(s);assert.equal(liftDoorLinks(s,state).length,2);assert.equal(liftVisuals(s,state).instances.filter(i=>i.kind==='lift-door').length,13);const y=s.levels[0].elevation;assert.equal(queryCaseSystem(s,[3.5,y+1,5.4],{liftState:state}).inside,false);assert.equal(queryCaseSystem(s,[3.5,y-.02,5.53],{liftState:state}).inside,true);state=targetLift(s,state,'W12');assert.equal(state.doorOpen,false);assert.equal(liftDoorLinks(s,state).length,0);assert.equal(liftVisuals(s,state).instances.filter(i=>i.kind==='lift-door').length,14);assert.equal(queryCaseSystem(s,[3.5,y+1,5.4],{liftState:state}).inside,true);assert.equal(queryCaseSystem(s,[3.5,y-.02,5.53],{liftState:state}).inside,false);state=advanceLift(s,state,100);assert.equal(state.currentFloorId,'W12');near(state.currentElevation,s.levels.at(-1).elevation);assert.equal(liftDoorLinks(s,state).length,2);assert.throws(()=>liftDoorLinks(s,{...state,currentElevation:state.currentElevation-.1}),/coincide/);const route=routeCaseSystem(s,'W12',{mode:'freight'});assert.equal(route.segments.find(p=>p.kind==='board').condition,'arrived_and_door_link_open');
});

test('CPU point and exact ray queries return actual field and graph identities at requested floors',()=>{
 for(const s of Object.values(models)){const l=s.levels.at(-1),plan=s.caseId==='lowrise'?[-3,6]:[-13,-5],p=[plan[0],l.elevation+.8,plan[1]],h=intersectCaseSystemRay(s,p,[0,-1,0],{floorIds:[l.id],maxDistance:1});assert.equal(h.hit,true);near(h.point[1],l.elevation);assert.equal(h.floorId,l.id);assert.ok(s.graph.nodes.some(n=>n.id===h.nodeId));assert.equal(queryCaseSystem(s,add(h.point,[0,-.05,0]),{floorIds:[l.id]}).inside,true);assert.equal(h.method,'shared_archetype_exact_plane_domain_ray');}assert.throws(()=>queryCaseSystem(models.lowrise,[NaN,0,0]),/Finite/);
});

test('editable dimensions rebuild complete dependency chains while retaining existing field identities',()=>{
 const low=deriveCaseSystem('lowrise',measured.lowrise,official,{floorHeight:3.5,stairWidth:1.2,stairTreadDepth:.32});near(low.interfaces.stairs[0].rise,3.5);near(low.interfaces.stairs[0].layout.flightWidth,1.2);near(low.rails.templates[0].dimensions.treadDepth,.32);assert.equal(low.interfaces.stairs[0].id,models.lowrise.interfaces.stairs[0].id);
 const warehouse=deriveCaseSystem('warehouse',measured.warehouse,official,{podiumFloorHeights:[5.6,7.9]});assert.equal(warehouse.transferLevels.length,3);assert.equal(warehouse.interfaces.stairs.length,16);near(warehouse.levels[2].elevationMpd,17.68);assert.equal(new Set(warehouse.instances.map(i=>i.objectIdOffset)).size,warehouse.instances.length);const short=deriveCaseSystem('warehouse',measured.warehouse,official,{towerFloorCount:3,towerFloorHeight:3.5});assert.equal(short.levels.length,5);for(const i of short.instances){const same=models.warehouse.instances.find(x=>x.id===i.id);if(same)assert.equal(i.objectIdOffset,same.objectIdOffset);}assert.equal(short.components[1].officialStoreys,12);
});

test('invalid height, source cap, raw component, lift count and generic transformation edits fail without modifying sources',()=>{
 for(const edit of [{floorCount:3},{floorHeight:4},{stairWidth:4},{scale:1.1},{minimumHeadroom:4}])assert.throws(()=>deriveCaseSystem('lowrise',measured.lowrise,official,edit));for(const edit of [{towerFloorHeight:2.85},{podiumFloorHeights:[6,7]},{freightInterfaceCount:9},{towerFloorCount:13},{freightDoorHeight:2.3,wallHeight:2.3}])assert.throws(()=>deriveCaseSystem('warehouse',measured.warehouse,official,edit));const bad=clone(official);bad.parts.find(p=>p.attributes.OBJECTID===237016).attributes.TopHeight+=.5;assert.throws(()=>deriveCaseSystem('warehouse',measured.warehouse,bad),/datum mismatch/);assert.throws(()=>deriveCaseSystem('lowrise',measured.warehouse,official),/Matching/);
});

test('geometry validator rejects orphan graph links, missing physical rails/platforms and footprint edits',()=>{
 let s=clone(models.warehouse);s.graph.edges.push({type:'walksTo',from:s.entry.id,to:'not-a-real-node'});assert.throws(()=>validateCaseSystem(s),/Missing graph/);s=clone(models.lowrise);s.rails.instances[0].supports[0].startWorld=[1000,0,1000];assert.throws(()=>validateCaseSystem(s),/support/);s=clone(models.warehouse);s.archetypes.find(a=>a.id==='tower-floor').primitives[0].loops[0][0][0]+=.1;assert.throws(()=>validateCaseSystem(s),/footprint/);
});
