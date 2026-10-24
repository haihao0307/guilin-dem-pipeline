import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {growSketch} from './sketch-model.mjs';
import {createSketchLift,assertSketchLiftInvariant,retainedSketchPanelFields,mountRetainedPanel,RETAINED_LIFT_SOURCES,SKETCH_LIFT_DISCLOSURE} from './lift-adapter.mjs';
import {createLift,step} from './kowloon-building-mother-r01/elevator-mother-r02/model.mjs';
import {command as originalCommand,panelFields} from './kowloon-building-mother-r01/elevator-mother-r02/controls.mjs';

let checks=0,simulationSteps=0;
const ok=(value,message)=>{assert(value,message);checks++;};
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const close=(actual,expected,message)=>ok(Math.abs(actual-expected)<1e-7,message);
const all=result=>result.model.archetypes.flatMap(a=>a.primitives);
const hash=data=>createHash('sha256').update(data).digest('hex');
const initial={caseId:'connected',storeys:4,groundHeight:3.6,typicalHeight:3,roofVisible:false};
const host=growSketch(initial),floors=host.levels;
const digestBefore=hash(JSON.stringify(host));
const provenance=[];
for(const source of RETAINED_LIFT_SOURCES){
 const retained=fs.readFileSync(new URL(source.file,import.meta.url));
 equal(hash(retained),source.sha256,'retained dependency must be byte-for-byte unchanged: '+source.file);
 const original=new URL('../building-mother-r10/'+source.file,import.meta.url);
 if(fs.existsSync(original))equal(retained,fs.readFileSync(original),'R04 dependency equals its actual R10 source bytes');
 provenance.push({file:source.file,sha256:source.sha256,originalPresent:fs.existsSync(original)});
}
equal(SKETCH_LIFT_DISCLOSURE.copiedVisibleCarFromR10,false,'do not claim the R10 visible car was copied');
equal(SKETCH_LIFT_DISCLOSURE.arrivalBridgeAdded,false,'no R10 arrival bridge is added');

function inspect(lift,before=null,dt=.05){
 const s=lift.snapshot();ok(assertSketchLiftInvariant(s),'state respects owned floors and door interlocks');simulationSteps++;
 if(before)ok(Math.abs(s.y-before.y)<=s.design.speed*dt+1e-7,'retained speed limit excludes floor teleportation');
 if(s.motion||Math.abs(s.v)>1e-8){
  ok(s.guards.closed&&s.guards.locked,'every moving substep has all doors closed and locked');
  equal(s.boardableFloors,[],'no boarding while moving');
 }
 for(const [floor,open]of Object.entries(s.landingDoors))if(open>0)equal(floor,s.current,'wrong-floor landing never opens');
 return s;
}
function until(lift,predicate,label,limit=180){
 let s=inspect(lift);
 for(let t=0;t<limit&&!predicate(s);t+=.05){const before=s;lift.advance(.05);s=inspect(lift,before);}
 ok(predicate(s),label);return s;
}
function atOpen(lift,floor){return until(lift,s=>s.current===floor.id&&s.carDoor===1&&s.landingDoors[floor.id]===1&&!s.motion,'arrives leveled and opens both doors at '+floor.label);}

const lift=createSketchLift(host);
equal(lift.snapshot().floors.map(f=>[f.id,f.elevation]),floors.map(f=>[f.id,f.elevation]),'adapter uses every host floor without renaming or respacing');
equal(lift.snapshot().current,floors[0].id,'starts at owned ground stop');
equal(lift.hasActive(),false,'idle adapter does not request useless redraws');
equal(retainedSketchPanelFields(lift.snapshot()),panelFields(lift.snapshot()),'visible panel descriptors are produced by the actual unchanged R02 function');
equal(retainedSketchPanelFields(lift.snapshot()).filter(f=>f.action?.kind==='car').map(f=>f.label),['4F','3F','2F','1F'],'original visible car buttons retain owned floor labels');
equal(retainedSketchPanelFields(lift.snapshot()).filter(f=>f.action?.kind==='hall').length,6,'original panel generates two directions only on intermediate floors');
equal(retainedSketchPanelFields({available:false}),[],'unbound case has no actionable retained panel fields');
ok(!lift.command({kind:'car',floor:'another-building:L0'}).accepted,'cross-building floor requests rejected');
ok(!lift.command({kind:'car',floor:floors[1].id,buildingId:'another-building'}).accepted,'explicit other building rejected');
ok(!lift.command({kind:'car',floor:floors[1].id,liftId:'another-lift'}).accepted,'explicit other lift rejected');
ok(!lift.command({kind:'hall',floor:floors[0].id,direction:-1}).accepted,'bottom landing has no downward hall call');
ok(!lift.command({kind:'hall',floor:floors.at(-1).id,direction:1}).accepted,'top landing has no upward hall call');
ok(lift.command({kind:'hall',floor:floors[0].id,direction:1}).accepted,'retained hall command opens current landing');
atOpen(lift,floors[0]);

const arrivals=[];
for(const index of [3,1,2,0]){
 const floor=floors[index],oldY=lift.snapshot().y;
 ok(lift.command({kind:'car',floor:floor.id}).accepted,'retained car call accepted');
 close(lift.snapshot().y,oldY,'floor call enqueues without teleporting the car');
 const moving=until(lift,s=>!!s.motion&&Math.abs(s.v)>.01,'controller really moves toward '+floor.label);
 ok(!lift.command({kind:'door',value:'open'}).accepted,'open command is blocked during travel');
 close(lift.snapshot().y,moving.y,'blocked open cannot alter the travel position');
 const arrived=atOpen(lift,floor);
 close(arrived.y,floor.elevation,'arrival is exactly level with host floor');
 equal(arrived.boardableFloors,[floor.id],'only occupied landing is boardable');
 arrivals.push({floor:floor.label,elevation:arrived.y,time:arrived.time});
}
until(lift,s=>s.state==='IDLE'&&!s.queue.length,'automatic dwell, closing and lock confirmation settle to idle');
equal(lift.hasActive(),false,'no animation scheduling after final door/lock cycle');
ok(lift.snapshot().events.some(e=>e.state==='ACCELERATING'),'original acceleration phase executed');
ok(lift.snapshot().events.some(e=>e.state==='LEVELING'),'original leveling phase executed');

// Held doors cannot close or move until the original obstruction command clears.
ok(lift.command({kind:'door',value:'open'}).accepted,'stationary open command accepted');atOpen(lift,floors[0]);
ok(lift.command({kind:'obstruction'}).accepted,'retained obstruction toggle accepted');
ok(!lift.command({kind:'door',value:'close'}).accepted,'occupied light curtain blocks closing');
lift.advance(20);equal(lift.snapshot().state,'OBSTRUCTION_HOLD','obstruction hold reached');
ok(!lift.hasActive(),'held obstruction does not busy-loop');
ok(lift.command({kind:'car',floor:floors[3].id}).accepted,'call remains queued while held');
lift.advance(30);close(lift.snapshot().y,0,'queued call cannot move through an open held door');
equal(lift.snapshot().carDoor,1,'held car door remains open');
ok(lift.command({kind:'obstruction'}).accepted,'clear original obstruction command');
atOpen(lift,floors[3]);

// Repeated requests deduplicate; a large render gap is substepped, not jumped.
const gapLift=createSketchLift(host);
gapLift.command({kind:'car',floor:floors[3].id});gapLift.command({kind:'car',floor:floors[3].id});
equal(gapLift.snapshot().queue.length,1,'repeated call does not duplicate queue entry');
gapLift.advance(30);
equal(gapLift.snapshot().current,floors[3].id,'30-second renderer pause still reaches the actual target');
ok(assertSketchLiftInvariant(gapLift.snapshot()),'large advance preserves every invariant');
ok(gapLift.snapshot().events.some(e=>e.state==='OPENING'),'large advance passes through arrival, not direct state assignment');
equal(gapLift.snapshot().state,'IDLE','large gap includes opening, dwell, closing and lock confirmation');
for(const bad of [-1,Infinity,NaN,3601]){assert.throws(()=>gapLift.advance(bad));checks++;}

// Public snapshots are copies, and visual edits preserve controller progress.
const changed=gapLift.snapshot();changed.y=999;changed.landingDoors[floors[0].id]=1;
close(gapLift.snapshot().y,floors[3].elevation,'snapshot cannot mutate controller state');
equal(gapLift.sync(growSketch({...initial,stage:6})).reset,false,'stage edit does not reset lift');
close(gapLift.snapshot().y,floors[3].elevation,'stage edit keeps current continuous position');
equal(gapLift.sync(growSketch({...initial,groundHeight:4})).reset,true,'changed building elevations explicitly rebind, never use stale stops');
equal(gapLift.snapshot().current,floors[0].id,'changed geometry initializes at selected valid floor');
equal(gapLift.sync(growSketch({...initial,liftAttached:false})).reset,true,'detaching clears controller binding');
equal(gapLift.snapshot().available,false,'detached controller unavailable');
equal(gapLift.geometryParameters(),{},'detached controller emits no runtime geometry parameters');
ok(!gapLift.command({kind:'door',value:'open'}).accepted,'detached controller cannot open doors');
equal(gapLift.sync(host).reset,true,'reattaching binds owned floor table again');
equal(hash(JSON.stringify(host)),digestBefore,'adapter never mutates host geometry or source');

// Original demo factory limits do not silently truncate or respread host floors.
const eight=growSketch({...initial,storeys:8,groundHeight:2.6,typicalHeight:2.6}),eightLift=createSketchLift(eight);
equal(eightLift.snapshot().floors.length,8,'all eight owned floors survive binding');
equal(eightLift.snapshot().floors.map(f=>f.elevation),eight.levels.map(f=>f.elevation),'2.6 m host heights stay authoritative');
eightLift.command({kind:'car',floor:eight.levels.at(-1).id});eightLift.advance(60);
equal(eightLift.snapshot().current,eight.levels.at(-1).id,'original controller serves eighth host stop');

// Fault injection checks the retained controller itself, not an adapter imitation.
const fault=createLift();originalCommand(fault,{kind:'car',floor:fault.floors.at(-1).id});
for(let i=0;i<100&&!fault.motion;i++)step(fault,.05);
ok(!!fault.motion,'fault test starts actual retained motion');
fault.locks[fault.floors[0].id]=false;step(fault,.05);
equal(fault.state,'FAULT','original controller detects independently broken landing interlock');
equal([fault.motion,fault.v,fault.carDoor],[null,0,0],'interlock fault stops motion without opening');

// Lightweight DOM contract harness. This verifies handler wiring and lifecycle,
// not browser pixels, CSS, pointer targeting, or a physical device.
const dom={createElement(tag){return {tag,ownerDocument:dom,children:[],dataset:{},style:{},attributes:{},hidden:false,
 classList:{toggle(){}},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(key,value){this.attributes[key]=value;}};}};
const container=dom.createElement('div'),panelLift=createSketchLift(host);let panelChanges=0;
const panel=mountRetainedPanel(container,panelLift,()=>panelChanges++);
const descendants=e=>e.children.flatMap(c=>[c,...descendants(c)]),controls=()=>descendants(container);
equal(controls().filter(e=>'liftCarFloor' in e.dataset).length,4,'DOM adapter exposes all four original car controls');
controls().find(e=>e.dataset.liftCarFloor===floors[3].id).onclick();
equal(panelLift.snapshot().queue[0].id,floors[3].id,'panel car handler dispatches actual retained floor action');
panelLift.advance(4);panel.refresh();
ok(!controls().find(e=>e.dataset.liftDoor==='open').onclick().accepted,'panel open handler respects retained travel guard');
panelLift.advance(30);panel.refresh();controls().find(e=>e.dataset.liftDoor==='open').onclick();panelLift.advance(2);panel.refresh();
equal(panelLift.snapshot().carDoor,1,'panel open handler opens at leveled arrival');
const selector=controls().find(e=>e.tag==='select');selector.value=floors[3].id;selector.onchange();
equal(controls().filter(e=>'liftCall' in e.dataset).map(e=>e.dataset.liftCall),['down'],'panel reuses top-floor direction suppression');
controls().find(e=>'liftObstruction' in e.dataset).onclick();ok(panelLift.snapshot().obstruction,'adapted light curtain control uses retained obstruction action');
const panelTime=panelLift.snapshot().time;panel.refresh();panel.refresh();equal(panelLift.snapshot().time,panelTime,'refresh never advances simulation');
const replacement=createSketchLift(growSketch({...initial,storeys:2}));panel.refresh(replacement);
equal(controls().filter(e=>'liftCarFloor' in e.dataset).length,2,'refresh replaces controller and visible owned floors');
const staleButton=controls().find(e=>'liftCarFloor' in e.dataset);panel.dispose();
ok(!staleButton.onclick().accepted,'disposed panel rejects stale handlers');equal(replacement.snapshot().queue,[],'disposed handler cannot mutate replacement controller');
equal(panelChanges,4,'only requested panel commands notify viewer');

// Geometry integration checks are enabled by default; --controller-only is
// only for focused adapter work while the separate model change is in flight.
const geometryCheck=!process.argv.includes('--controller-only');
if(geometryCheck){
 const geometryLift=createSketchLift(host);
 geometryLift.command({kind:'car',floor:floors[3].id});geometryLift.advance(4);
 const runtime=geometryLift.geometryParameters(),moving=growSketch({...initial,...runtime});
 close(moving.lift.elevation,runtime.liftRuntime.y,'visible cabin follows continuous retained controller elevation');
 ok(!floors.some(f=>Math.abs(f.elevation-moving.lift.elevation)<.01),'mid-travel rendered geometry is not a discrete stop');
 const carFloor=all(moving).find(p=>p.nodeId===moving.lift.cabinId+':floor');
 close(carFloor.bounds.max[1],runtime.liftRuntime.y,'analytic car floor is physically at runtime height');
 equal(moving.graph.edges.filter(e=>e.from===moving.lift.carPortalId&&e.type==='coupledAtLanding').length,0,'moving car has no fabricated coupling edge');
 ok(moving.routes.filter(r=>['lift_connector','stair_to_lift'].includes(r.type)).every(r=>!r.traversable&&!r.continuous),'all boarding routes unavailable between floors');
 equal(moving.lift.shaftBounds,host.lift.shaftBounds,'continuous motion preserves original shaft and pit boundary');
 ok(!all(moving).some(p=>/bridge/.test(p.nodeId)),'adapter emits no remote bridge');
 const unchanged=q=>all(q).filter(p=>p.moduleId!==q.lift.id);
 equal(unchanged(moving),unchanged(host),'moving lift does not alter any main-building primitive');
 atOpen(geometryLift,floors[3]);
 const arrived=growSketch({...initial,...geometryLift.geometryParameters()});
 close(arrived.lift.elevation,floors[3].elevation,'fourth-floor rendered arrival is level');
 equal(arrived.portals.filter(p=>p.role==='lift_landing'&&p.open===1).map(p=>p.floorId),[floors[3].id],'rendered landing doors use original controller map');
 equal(arrived.portals.find(p=>p.role==='lift_car').open,1,'rendered car door follows original controller');
 ok(arrived.routes.filter(r=>r.type==='lift_connector').find(r=>r.floorId===floors[3].id).traversable,'direct fourth-floor route enabled only after coupled arrival');
 ok(arrived.checks.passed,'fourth-floor arrival retains all analytic geometry checks');
}

console.log(JSON.stringify({passed:true,checks,simulationSteps,geometryIntegrationChecked:geometryCheck,arrivals,retainedSources:provenance,sourceBytesUnchanged:true,realEquipmentClaim:false},null,2));
