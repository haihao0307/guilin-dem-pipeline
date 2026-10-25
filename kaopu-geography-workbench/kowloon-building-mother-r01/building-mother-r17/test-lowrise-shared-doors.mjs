import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveCaseIntegration} from './kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';
import {lowriseLevelRevision} from './lowrise-level-revision.mjs';
import {growBuilding} from './building-mother.mjs';
import {materialForRecord} from './facade-materials.mjs';
import {buildRegistry} from './kowloon-building-mother-r01/whole-building-facade-r01/semantic-registry.mjs';
import {deriveFloorMother,completeRoomRoute,validateCompleteFloorSystem} from './complete-floor-system.mjs';
import {createCompleteFloorPanel,routePose} from './complete-floor-panel.mjs';
import {createRoomDoorRuntime,updateRoomDoorState} from './room-door-runtime.mjs';
import {intersectAperturesRay} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {validateOpeningOwnership} from './opening-ownership.mjs';
import {validateOpeningHeadRelations} from './opening-head-relations.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const source = deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/B367642137201063C0.score.json'));
const official = read('./kowloon-building-mother-r01/r07/sources/official-footprints.json');
const openingEvidence = read('./evidence/lowrise-opening-proposal.json');
const controller = controllerFor('lowrise');
const whole = controller.derive(source, official, lowriseLevelRevision(source, official, openingEvidence).parameters);
const integration = deriveCaseIntegration('lowrise', whole, source, official, {doorOpenT:1});
const seed = {caseId:'lowrise',source,model:integration.model,openingEvidence,controller,whole};
const legacy = growBuilding(seed).model;
const shared = growBuilding(seed,{dimensions:{ordinaryDoorSystem:'shared-function'}}).model;
const closedSeed = growBuilding(seed,{dimensions:{ordinaryDoorSystem:'shared-function',doorOpenT:0}}).model;
let checks = 0;
const ok = (v,m) => {assert(v,m);checks++;};
const eq = (a,b,m) => {assert.deepEqual(a,b,m);checks++;};
const rooms = m => m.hostedComponents.apertures.filter(a=>a.bindingKey?.startsWith('door-'));
const frameShape = p => Object.fromEntries(Object.entries(p).filter(([key])=>key!=='semanticPartNodeId'));
const retained = m => m.hostedComponents.apertures.filter(a=>!a.bindingKey?.startsWith('door-'));
eq(legacy.doorSystem.status,'deferred');
ok(rooms(legacy).every(a=>a.config.leafEnabled===false&&!a.primitives.some(p=>p.part==='leaf')),'legacy default keeps omitted leaves');
eq(shared.doorSystem.status,'shared-function');
eq(rooms(shared).length,14);
eq(rooms(shared).map(a=>a.instanceId),[400,401,402,403,404,405,406,420,421,422,423,424,425,426]);
eq(shared.levels,legacy.levels,'original two storeys and elevations unchanged');
eq(shared.archetypes,legacy.archetypes,'no new host wall, hole, slab or structural geometry');
eq(shared.instances,legacy.instances,'no new geometry instance');
eq(shared.hostedComponents.sourceMasks,legacy.hostedComponents.sourceMasks,'original source masks unchanged');
eq(retained(shared),retained(legacy),'source entry and windows stay unchanged');
eq(shared.hostedComponents.apertures.map(a=>a.instanceId),legacy.hostedComponents.apertures.map(a=>a.instanceId),'no new global aperture slot');
ok(shared.hostedComponents.apertures.every(a=>a.instanceId>=0&&a.instanceId<=511),'original 512 slot bound');
for(const a of rooms(shared)){
 const old=rooms(legacy).find(b=>b.instanceId===a.instanceId);
 eq(a.host,old.host);eq(a.roughOpening,old.roughOpening);
 eq(a.primitives.find(p=>p.part==='frame'),old.primitives.find(p=>p.part==='frame'),'original frame kept byte-for-byte');
 eq(a.primitives.find(p=>p.part==='leaf').materialRole,5,'existing leaf material channel');
 eq(a.appearance.frameRole,4);eq(a.appearance.actualFinishKnown,false);
 eq(a.counts.modelTriangles,0,'existing analytic field, not a new mesh');
}
const renderedLeaves=buildRegistry(shared,source).filter(r=>r.classKey==='door'&&r.part==='leaf'&&r.instanceId>=400&&r.instanceId<=426);
eq(renderedLeaves.length,14,'all enabled leaves reach the existing scene registry');
for(const record of renderedLeaves){const finish=materialForRecord(record);eq(finish.color,'#8e6b4e','existing warm brown design finish');eq(finish.type,4,'existing fine-detail and sheen shader branch, not a new material implementation');}
ok(validateOpeningOwnership(shared.graph,shared.openingOwnership.chains).passed,'shared leaf ownership added to existing chain');
ok(validateOpeningHeadRelations(shared).passed,'retained headwall relations stay valid');
for(const floor of shared.completeFloorSystem.levels)for(const room of floor.rooms.filter(r=>r.doorId)){
 const get=()=>shared.hostedComponents.apertures.find(a=>a.host.nodeId===room.doorId);
 const origin=get().host.origin,normal=get().host.w,rayOrigin=origin.map((v,k)=>v-normal[k]*.6);
 const frame=get().primitives.find(p=>p.part==='frame'),width=get().config.width,height=get().config.height;
 for(const t of [0,.5,1]){
  updateRoomDoorState(shared,floor.id,room.key,t);
  eq(completeRoomRoute(shared,floor.id,room.key).doorGate.allowed,t===1,'runtime fraction, not original parameter, gates room route');
  eq(shared.graph.nodes.find(n=>n.id===room.doorId).walkLinkOpen,t===1);
  ok(shared.graph.edges.filter(e=>e.type==='walksTo'&&(e.from===room.doorId||e.to===room.doorId)).every(e=>e.enabled===(t===1)));
  eq(frameShape(get().primitives.find(p=>p.part==='frame')),frameShape(frame));eq(get().config.width,width);eq(get().config.height,height);
  if(t===0)ok(intersectAperturesRay([get()],rayOrigin,normal,{maxDistance:1.2}).hit,'closed physical leaf blocks doorway');
  if(t===1)ok(!intersectAperturesRay([get()],rayOrigin,normal,{maxDistance:1.2}).hit,'open physical doorway is clear');
 }
 eq(completeRoomRoute(closedSeed,floor.id,room.key).doorGate.allowed,false,'closed initial design leaves never get legacy permission');
}
const physical=validateCompleteFloorSystem(shared);
ok(physical.passed,JSON.stringify(physical.failures.slice(0,2)));
eq(physical.doorRays,14);ok(physical.routeSamples>4000,'both-storey stairs and all fourteen room paths checked');
assert.throws(()=>deriveFloorMother(seed.model,{ordinaryDoorSystem:'unknown'}),/ordinaryDoorSystem/);checks++;

// Minimal DOM contract test, not browser visual proof. Use the real queued
// runtime and presented-revision handshake, rather than a synchronous fake.
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.value='';this.hidden=false;this.disabled=false;this.classList={add(){},toggle(){}};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 setAttribute(key,value){this[key]=value;}
}
globalThis.document={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
const add=(a,b)=>a.map((v,k)=>v+b[k]),translation=[5,0,-3],ns=id=>'lowrise::'+id;
const local=structuredClone(shared),building={caseId:'lowrise',buildingId:source.sourceModelId,localModel:local,transform:{translation}};
const world=local.hostedComponents.apertures.map(a=>({...structuredClone(a),caseId:'lowrise',floorId:ns(a.floorId),host:{...a.host,nodeId:ns(a.host.nodeId),origin:add(a.host.origin,translation)},primitives:a.primitives.map(p=>({...p,objectId:p.objectId+1000000}))}));
const scene={buildings:[building],registry:world.flatMap(a=>a.primitives.map(p=>({objectId:p.objectId,bounds:p.bounds}))),model:{hostedComponents:{apertures:world},graph:{nodes:local.graph.nodes.map(n=>({...n,id:ns(n.id)})),edges:local.graph.edges.map(e=>({...e,from:ns(e.from),to:ns(e.to)}))}}};
let selected=building,renderRequests=0,views=[];
const renderer={busy:false,hostedVisibilityKey:null,staticPrimaryCache:{release(){}}};
const runtime=createRoomDoorRuntime({scene,renderer,getSelectedBuilding:()=>selected,requestRender:()=>renderRequests++});
runtime.selectBuilding(building);runtime.afterFrame(runtime.beforeFrame());
const pending=()=>{const s=runtime.snapshot();return s.pending.length>0||s.presentedRevision!==s.revision;};
const element=new Element('section');
const panel=createCompleteFloorPanel({element,getBuilding:id=>id==='lowrise'?building:null,getSelectedBuilding:()=>selected,onDoor:q=>runtime.set(q),getDoorFramePending:pending,onView:q=>views.push(q),onInspect:()=>{},onGraph:()=>{}});
const descendants=e=>[e,...e.children.flatMap(descendants)];
const openButton=descendants(element).find(e=>e.dataset.floorDoor==='open'),closeButton=descendants(element).find(e=>e.dataset.floorDoor==='close');
ok(openButton&&closeButton&&!closeButton.disabled,'real controls exposed for opt-in shared doors');
const close=panel.setDoor(0);ok(close.queued);eq(renderRequests,1);eq(panel.walk(1).reason,'door_frame_pending');
const frame=runtime.beforeFrame();eq(panel.walk(1).reason,'door_frame_pending','changed geometry still waits for completed render');
runtime.afterFrame(frame,{cancelled:true});eq(panel.walk(1).reason,'door_frame_pending','cancelled frame cannot authorize movement');
runtime.afterFrame(frame);panel.refresh();
ok(panel.walk(1).blocked,'closed selected leaf blocks actual panel route');eq(views.length,0);
ok(panel.setDoor(1).queued);const opened=runtime.beforeFrame();runtime.afterFrame(opened);panel.refresh();
panel.walk(1);eq(views.length,1,'fully open and presented route can reach the room');
eq(views.at(-1).routePose.progress,1);
panel.walk(0);ok(panel.setDoor(0).queued,'can close from a point outside the door zone');runtime.afterFrame(runtime.beforeFrame());panel.refresh();
updateRoomDoorState(local,'L01','living',.5);panel.refresh();ok(panel.walk(1).blocked,'half-open door blocked in actual panel');
updateRoomDoorState(local,'L01','living',1);
const route=panel.route(),door=local.hostedComponents.apertures.find(a=>a.bindingKey==='door-living'&&a.floorId==='L01');
let near=0,nearest=Infinity;for(let i=0;i<=1000;i++){const p=routePose(route,i/1000).foot,d=Math.hypot(p[0]-door.host.origin[0],p[2]-door.host.origin[2]);if(d<nearest){nearest=d;near=i/1000;}}
panel.walk(near);eq(panel.setDoor(0).reason,'passenger_in_door_zone','cannot close on the current route body near the door');
selected={caseId:'kcc',buildingId:'wrong'};panel.refresh();ok(panel.setDoor(1).blocked);ok(panel.walk(1).blocked);ok(openButton.disabled&&closeButton.disabled,'old controls disabled when building context changes');
const legacyBuilding={...building,localModel:legacy};selected=legacyBuilding;
const legacyPanel=createCompleteFloorPanel({element:new Element('section'),getBuilding:()=>legacyBuilding,getSelectedBuilding:()=>legacyBuilding,onView:()=>{},onInspect:()=>{},onGraph:()=>{}});
ok(legacyPanel.setDoor(1).blocked,'legacy panel does not silently enable deferred doors');
delete globalThis.document;
console.log(JSON.stringify({passed:true,checks,roomDoors:14,unchangedApertureIds:true,physicalRouteSamples:physical.routeSamples,doorRays:physical.doorRays,actualDoorSpecification:null,actualFinishKnown:false,browserQA:'not_run',legacyDefault:'deferred',enabledBy:"dimensions.ordinaryDoorSystem='shared-function'"}));
