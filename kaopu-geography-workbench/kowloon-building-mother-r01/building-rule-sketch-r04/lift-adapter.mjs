/** Bind the EXISTING R02 elevator controller to the teaching sketch's floors.
 * The imported model/controls are byte-for-byte retained, not a replacement
 * state machine. The host supplies its R03 direct-threshold shaft/car geometry;
 * no R10 arrival bridge, second doorway, or new equipment geometry is emitted.
 * This is an authored teaching simulation, never a real safety controller.
 */
import {createLift,step,guards,DESIGN} from './kowloon-building-mother-r01/elevator-mother-r02/model.mjs';
import {command as retainedCommand,indicator,panelFields} from './kowloon-building-mother-r01/elevator-mother-r02/controls.mjs';

const copy=value=>structuredClone(value);
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const EPS=1e-8;
export const RETAINED_LIFT_SOURCES=Object.freeze([
 Object.freeze({file:'kowloon-building-mother-r01/elevator-mother-r02/model.mjs',sha256:'2431cc1ca4f1a5476175f8b963ff05c208b2c7491e75a80dcde092ceb461f70d'}),
 Object.freeze({file:'kowloon-building-mother-r01/elevator-mother-r02/controls.mjs',sha256:'8957a269f0f7d91e62d0736ec4e9def552025a43f890eecd88824976569d810c'})
]);
export const SKETCH_LIFT_DISCLOSURE=Object.freeze({
 kind:'authored_teaching_lift_simulation',
 controller:'unchanged elevator-mother-r02/model.mjs + controls.mjs',
 visibleControls:'unchanged R02 panelFields() descriptors adapted to a host-owned DOM panel; no second simulation clock',
 binding:'R10 building-owned stop-table binding pattern; original host floor IDs and elevations',
 geometry:'R03 teaching shaft, car, separate landing/car doors, direct slab-to-shaft sill, and pit boundary retained',
 copiedVisibleCarFromR10:false,
 arrivalBridgeAdded:false,
 actualInstallationKnown:false,
 lifeSafetyCertified:false,
 display:'continuous controller time, rendered as on-demand snapshots; not a frame-rate guarantee'
});

function hostBinding(result){
 if(!result?.lift?.attached)return null;
 const lift=result.lift,levels=result.levels;
 assert(Array.isArray(levels)&&levels.length>=2&&levels.length<=8,'Sketch lift needs its owned 2–8 floor table');
 const ids=new Set();
 const floors=levels.map(level=>{
  assert(typeof level.id==='string'&&level.id&&!ids.has(level.id)&&Number.isFinite(level.elevation),'Sketch lift floor IDs and elevations must be valid and unique');
  ids.add(level.id);
  return {id:level.id,label:String(level.label??level.id),elevation:level.elevation,served:true};
 });
 for(let i=1;i<floors.length;i++)assert(floors[i].elevation-floors[i-1].elevation>=2.6-EPS,'Owned storey must fit the retained teaching car');
 assert(lift.stops?.length===floors.length,'Sketch lift stop table must match owned floors');
 for(const [i,floor]of floors.entries()){
  const stop=lift.stops[i];
  assert(stop.floorId===floor.id&&Math.abs(stop.elevation-floor.elevation)<EPS,'Sketch lift stops must equal the host floor table');
 }
 assert(lift.directAttachment===true,'Adapter requires the retained direct shaft-to-slab interface');
 return {id:lift.id,buildingId:result.model.sourceModelId,floors,
  signature:JSON.stringify([result.model.sourceModelId,lift.id,floors]),
  initialLevel:Math.min(floors.length-1,Math.max(0,result.parameters.liftLevel??0)),
  initialDoor:result.parameters.liftOpen??0};
}

/** R02's demo factory limits (2–7 floors and >=3 m) belong to its own demo UI,
 * not the host's 2–8 floor / >=2.6 m contract. As in R10 lift-runtime.mjs, seed
 * the unmodified factory, then bind the validated owned floor table. All calls,
 * queueing, door/lock interlocks, quintic travel and arrival use its real code.
 */
function bindState(binding,{speed=DESIGN.speed}={}){
 const state=createLift([
  {id:'binding-seed-0',label:'seed',elevation:0,served:true},
  {id:'binding-seed-1',label:'seed',elevation:3,served:true}
 ],{speed});
 const floor=binding.floors[binding.initialLevel];
 Object.assign(state,{
  floors:copy(binding.floors),y:floor.elevation,current:floor.id,
  landingDoors:Object.fromEntries(binding.floors.map(f=>[f.id,0])),
  locks:Object.fromEntries(binding.floors.map(f=>[f.id,true])),
  lastMessage:'已接入保留的电梯控制器与本草图楼层表'
 });
 if(binding.initialDoor>0){
  assert(binding.initialDoor<=1,'Initial host door fraction must be within 0–1');
  retainedCommand(state,{kind:'door',value:'open'});
  let left=binding.initialDoor*DESIGN.doorSeconds;
  while(left>EPS){const dt=Math.min(.05,left);step(state,dt);left-=dt;}
 }
 return state;
}

/** Read-only invariant checker, also usable against a public snapshot. */
export function assertSketchLiftInvariant(state){
 const s=state,floors=s.floors,g=guards(s),ids=floors.map(f=>f.id);
 assert(floors.some(f=>f.id===s.current),'Lift current floor must remain owned by this sketch');
 assert(Number.isFinite(s.y)&&s.y>=floors[0].elevation-EPS&&s.y<=floors.at(-1).elevation+EPS,'Car must stay within the owned served run');
 assert(Number.isFinite(s.v)&&Number.isFinite(s.carDoor)&&s.carDoor>=0&&s.carDoor<=1,'Invalid car kinematics or door fraction');
 assert(JSON.stringify(Object.keys(s.landingDoors).sort())===JSON.stringify([...ids].sort()),'Every and only owned floor must have a landing door');
 assert(JSON.stringify(Object.keys(s.locks).sort())===JSON.stringify([...ids].sort()),'Every and only owned floor must have a landing lock');
 if(s.motion||Math.abs(s.v)>EPS)assert(g.closed&&g.locked,'Travel requires closed and locked car and all landing doors');
 for(const [id,open]of Object.entries(s.landingDoors)){
  assert(Number.isFinite(open)&&open>=0&&open<=1,'Landing door fraction must stay within 0–1');
  if(open>0)assert(id===s.current&&!s.motion&&g.leveled&&s.v===0,'Only the current stationary leveled landing can open');
 }
 if(s.carDoor>0)assert(!s.motion&&g.leveled&&s.landingDoors[s.current]===s.carDoor,'Car and occupied landing doors must synchronize');
 assert(s.queue.every(q=>ids.includes(q.id)),'Queue must not contain another building floor');
 assert(s.target===null||ids.includes(s.target),'Target must belong to this sketch');
 return true;
}

/**
 * Viewer contract:
 *   const lift=createSketchLift(result);
 *   lift.command({kind:'car',floor:result.levels[3].id});
 *   lift.advance(elapsedSeconds);
 *   result=growSketch({...inputs,...lift.geometryParameters()});
 *   lift.sync(result); // preserves state if this remains the same floor table
 * Rebuild/render only at a renderer boundary, not on every 50 ms substep.
 * sync() resets explicitly on a changed owned floor table, never teleports a
 * car because a different floor-call button was pressed.
 */
export function createSketchLift(result,options={}){
 let binding=null,state=null,revision=0,lastResetReason=null,lastAdvance={requestedSeconds:0,advancedSeconds:0};
 const active=()=>!!state&&!['FAULT','OBSTRUCTION_HOLD'].includes(state.state)&&(state.state!=='IDLE'||state.queue.length>0);
 function snapshot(){
  if(!state)return {available:false,reason:'本草图没有已接搭的电梯',revision,disclosure:copy(SKETCH_LIFT_DISCLOSURE)};
  const g=guards(state),boardable=state.carDoor===1&&!state.motion&&g.leveled&&state.landingDoors[state.current]===1;
  return {available:true,buildingId:binding.buildingId,liftId:binding.id,...copy(state),
   guards:g,indicator:indicator(state),boardableFloors:boardable?[state.current]:[],
   revision,lastResetReason,lastAdvance:copy(lastAdvance),hasActive:active(),disclosure:copy(SKETCH_LIFT_DISCLOSURE)};
 }
 function sync(nextResult){
  const next=hostBinding(nextResult);
  if(!next){
   const reset=!!state;binding=null;state=null;if(reset)revision++;
   lastResetReason='Lift detached or case has no lift';
   return {reset,reason:lastResetReason,state:snapshot()};
  }
  if(binding?.signature===next.signature){
   assertSketchLiftInvariant(state);
   return {reset:false,reason:null,state:snapshot()};
  }
  lastResetReason=state?'Owned floor table changed; initialized at selected valid stop':'Bound retained R02 controller to owned floor table';
  binding=next;state=bindState(binding,options);assertSketchLiftInvariant(state);revision++;
  return {reset:true,reason:lastResetReason,state:snapshot()};
 }
 function command(action){
  if(!state)return {accepted:false,message:'本草图没有已接搭的电梯',state:snapshot()};
  if(!action||!['car','hall','door','obstruction'].includes(action.kind))return {accepted:false,message:'未知电梯指令',state:snapshot()};
  if(action.buildingId&&action.buildingId!==binding.buildingId||action.liftId&&action.liftId!==binding.id)return {accepted:false,message:'拒绝其他建筑或电梯的指令',state:snapshot()};
  const accepted=retainedCommand(state,action);
  assertSketchLiftInvariant(state);revision++;
  return {accepted,message:state.lastMessage,state:snapshot()};
 }
 function advance(seconds){
  assert(Number.isFinite(seconds)&&seconds>=0&&seconds<=3600,'Simulation advance must be bounded to 0–3600 seconds');
  lastAdvance={requestedSeconds:seconds,advancedSeconds:0};
  if(!state)return snapshot();
  let left=seconds;
  while(left>EPS&&active()){
   const dt=Math.min(.05,left);
   step(state,dt);assertSketchLiftInvariant(state);left-=dt;
   lastAdvance.advancedSeconds+=dt;
  }
  if(lastAdvance.advancedSeconds>0)revision++;
  return snapshot();
 }
 function geometryParameters(){
  if(!state)return {};
  const liftLevel=state.floors.findIndex(f=>f.id===state.current);
  return {liftLevel,liftOpen:state.carDoor,liftRuntime:{
   y:state.y,current:state.current,carDoor:state.carDoor,
   landingDoors:copy(state.landingDoors),motion:!!state.motion,
   state:state.state,v:state.v,time:state.time,
   locks:copy(state.locks),carLock:state.carLock,
   controller:SKETCH_LIFT_DISCLOSURE.controller
  }};
 }
 sync(result);
 return {snapshot,sync,command,advance,geometryParameters,hasActive:active};
}

/** The original visible panel descriptor generator, not a parallel set of
 * authored floor-call rules. Its absolute 3D coordinates describe the R02 demo
 * car, so only its labels/actions/indicators/active states are used in this DOM
 * adapter. It does not claim an unscaled R02 3D panel fits the R03 teaching car.
 */
export function retainedSketchPanelFields(snapshot){
 return snapshot?.available?panelFields(snapshot):[];
}

/** Small DOM adaptation of retained R02 panelFields() and the R10 obstruction
 * toggle. Unlike R10 lift-panel.mjs, this has no KCC owner text, 0.60 m aperture
 * claim, passenger/camera controls, or independent 100 ms simulation timer.
 * The viewer remains the only clock and redraw owner.
 *
 * const panel=mountRetainedPanel(element,controller,()=>rebuild());
 * panel.refresh(controller); // once each renderer-boundary state update
 * panel.dispose();
 */
export function mountRetainedPanel(element,initialController,onChange=()=>{}){
 assert(element&&typeof element.replaceChildren==='function','Retained panel needs a DOM container');
 const doc=element.ownerDocument??document;
 let controller=initialController,selectedFloor=null,disposed=false;
 const make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const title=make('strong','现有电梯面板'),notice=make('p','复用 R02 的楼层、方向、选层与开关门按钮规则；由本草图统一计时。'),status=make('p'),hallLabel=make('label','层站呼梯 '),hall=make('select'),hallButtons=make('div'),carLabel=make('p','轿内选层'),carButtons=make('div'),doorButtons=make('div'),message=make('p');
 element.dataset.liftPanel='retained-r02-descriptors';
 notice.style.fontSize=message.style.fontSize='12px';status.style.fontWeight='700';
 hall.setAttribute('aria-label','层站呼梯楼层');hall.dataset.liftHallFloor='';hallLabel.append(hall);
 for(const row of[hallButtons,carButtons,doorButtons]){row.style.display='flex';row.style.flexWrap='wrap';row.style.gap='5px';row.style.margin='7px 0';}
 element.replaceChildren(title,notice,status,hallLabel,hallButtons,carLabel,carButtons,doorButtons,message);
 function send(action){
  if(disposed||!controller?.snapshot().available)return {accepted:false,message:'当前没有已绑定电梯'};
  const result=controller.command(action);refresh();onChange(result);return result;
 }
 function button(field){
  const b=make('button',field.label);b.type='button';b.dataset.retainedPanelField=field.id;
  b.dataset.liftAction=field.action.kind;
  if(field.action.kind==='car')b.dataset.liftCarFloor=field.action.floor;
  if(field.action.kind==='hall')b.dataset.liftCall=field.action.direction===1?'up':'down';
  if(field.action.kind==='door'){b.dataset.liftDoor=field.action.value;b.setAttribute('aria-label',field.action.value==='open'?'开门':'关门');}
  b.classList.toggle('active',!!field.active);b.setAttribute('aria-pressed',String(!!field.active));
  if(field.active){b.style.background='#366778';b.style.color='#fff';}
  b.onclick=()=>send(field.action);return b;
 }
 function refresh(nextController=controller){
  if(disposed)return null;
  controller=nextController;const s=controller?.snapshot()??{available:false};
  for(const e of[hallLabel,hallButtons,carLabel,carButtons,doorButtons])e.hidden=!s.available;
  if(!s.available){status.textContent='此原型没有已接搭电梯';message.textContent='';return s;}
  const fields=retainedSketchPanelFields(s);
  selectedFloor=s.floors.some(f=>f.id===selectedFloor)?selectedFloor:s.current;
  hall.replaceChildren(...s.floors.map(f=>{const option=make('option',f.label);option.value=f.id;return option;}));hall.value=selectedFloor;
  hallButtons.replaceChildren(...fields.filter(f=>f.action?.kind==='hall'&&f.action.floor===selectedFloor).map(button));
  carButtons.replaceChildren(...fields.filter(f=>f.action?.kind==='car').map(button));
  doorButtons.replaceChildren(...fields.filter(f=>f.action?.kind==='door').map(button));
  const obstruction=make('button',s.obstruction?'清除光幕障碍':'光幕测试');obstruction.type='button';obstruction.dataset.liftObstruction='';obstruction.classList.toggle('active',s.obstruction);obstruction.onclick=()=>send({kind:'obstruction'});doorButtons.append(obstruction);
  const display=fields.find(f=>f.id==='car-display');
  status.textContent=`${display?.label??s.indicator} · ${s.state} · ${s.y.toFixed(2)} m · 轿门 ${Math.round(s.carDoor*100)}%`;
  status.dataset.state=s.state;status.dataset.current=s.current;
  message.textContent=s.lastMessage;
  return s;
 }
 hall.onchange=()=>{selectedFloor=hall.value;refresh();};
 refresh();
 return {refresh,send,dispose(){disposed=true;element.replaceChildren();},get controller(){return controller;}};
}
