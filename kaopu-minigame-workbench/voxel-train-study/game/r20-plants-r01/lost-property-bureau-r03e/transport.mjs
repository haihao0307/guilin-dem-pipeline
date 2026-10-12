import * as I from './inventory.mjs';
export const TRANSPORT = Object.freeze({version:1,itemId:'MACHINE-BAG-01',input:'BELT-IN-01',target:'R26-B01-L2-B',beltX:.5,beltTop:1.305,startZ:18.5,junctionZ:9.75,dockX:12.6,targetZ:8.48,shelfTop:1.495,dimensions:[.55,.36,.48],step:.02,friction:.6,gravity:9.81});
const C=TRANSPORT, clone=x=>structuredClone(x), near=(a,b)=>Math.abs(a-b)<1e-7;
const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
function record(s,type){s.machine.history.push({time:s.worldTime,type,stage:s.machine.stage,contact:s.machine.contact,position:position(s)});}
function axis(q){return {q,v:0};}
// Distance-derived trapezoidal servo travel. The axis owns acceleration, brake
// distance and encoder position; the item has no independently timed trajectory.
function servo(a,goal,vmax,accel,dt){
 if(near(a.q,goal)&&near(a.v,0)){a.q=goal;a.v=0;return true;}
 if(!a.plan||a.plan.goal!==goal){if(!near(a.v,0))fail('DRIVE_REPLAN','A new drive target requires a braked axis.');const distance=Math.abs(goal-a.q),ramp=Math.min(vmax/accel,Math.sqrt(distance/accel));a.plan={goal,start:a.q,direction:Math.sign(goal-a.q),accel,ramp,cruise:Math.max(0,(distance-accel*ramp*ramp)/(accel*ramp)),time:0};}
 const p=a.plan,total=2*p.ramp+p.cruise;p.time=Math.min(total,p.time+dt);const t=p.time,peak=p.accel*p.ramp;let q,v;
 if(t<p.ramp){q=.5*p.accel*t*t;v=p.accel*t;}else if(t<p.ramp+p.cruise){q=.5*p.accel*p.ramp*p.ramp+peak*(t-p.ramp);v=peak;}else{const rem=total-t;q=Math.abs(goal-p.start)-.5*p.accel*rem*rem;v=p.accel*rem;}
 a.q=p.start+p.direction*q;a.v=p.direction*v;if(t===total){a.q=goal;a.v=0;return true;}return false;
}
function itemHalf(s){const d=I.itemRenderDimensions(s.items[C.itemId]);return d.map(v=>v/2);}
export function position(s){const m=s.machine;if(!m)return null;if(m.custodyReleased)return I.itemPosition(s,m.itemId);const h=itemHalf(s);if(m.contact==='belt')return[C.beltX,C.beltTop+h[1],C.startZ-m.belt.q];if(m.contact==='shuttle')return[m.shuttle.q,C.beltTop+h[1],C.junctionZ];if(m.contact==='gripper')return[C.dockX,m.lift.q-h[1]-.11,m.reach.q];return[C.dockX,C.shelfTop+h[1],C.targetZ];}
function sync(s){const m=s.machine;if(!m)return;const t=s.tasks[m.taskId],carrier=s.carriers[t.carrierId];if(carrier.itemId)carrier.position=position(s);}
export function load(s){if(s.machine)fail('MACHINE_BUSY','This one-item machine already owns a task.');const d=clone(s),target=d.slots[C.target]||I.getSlot(C.target);if(target.occupiedBy||target.reservedBy||target.disabled)fail('TARGET_UNAVAILABLE','The reachable rack cell is not free.');
 I.intake(d,{commandId:'machine-intake',item:{itemId:C.itemId,label:'登记试运棕色行李箱',category:'baggage',dimensions:C.dimensions,receivedAt:d.worldTime,internalFeature:'内袋右缝双圈黄线',slotId:C.input},fromRef:'FICTIONAL-CLERK-BELT-LOADING'});
 I.inspectItem(d,{commandId:'machine-inspect',itemId:C.itemId,safeToStore:true,inspectorRef:'FICTIONAL-CLERK'});
 const t=I.requestMove(d,{commandId:'machine-reserve',itemId:C.itemId,targetSlotId:C.target,durationSeconds:0,carrierId:'MECHANISM-01'});d.tasks[t.taskId].motionDriver='belt-sort-arm-r01';
 d.machine={version:1,itemId:C.itemId,taskId:t.taskId,stage:'belt',contact:'belt',paused:false,elapsed:0,ticks:0,belt:axis(0),shuttle:axis(C.beltX),fence:axis(0),lift:axis(2.38),reach:axis(C.junctionZ),jaws:axis(.37),history:[],fault:null};
 I.advanceTask(d,{commandId:'machine-pickup',taskId:t.taskId,action:'pickup'});sync(d);record(d,'loaded-by-clerk-at-belt-receiving-position');assertTransport(d);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,d);return audit(s);
}
function transition(s,stage,contact=s.machine.contact){const m=s.machine,before=position(s);m.stage=stage;m.contact=contact;const after=position(s);if(Math.hypot(...before.map((v,i)=>v-after[i]))>1e-7)fail('HANDOFF_JUMP','Mechanical support handoff changed the item position.');record(s,'sensor-confirmed-'+stage);}
function tick(s,dt){let m=s.machine;if(m.paused||m.fault||m.stage==='stored')return;const h=itemHalf(s),gripY=C.beltTop+2*h[1]+.11,shelfGripY=C.shelfTop+2*h[1]+.11;
 const target=s.slots[C.target];if(m.stage!=='retract'&&(target.occupiedBy||target.reservedBy!==m.taskId||target.disabled))fail('TARGET_CONFLICT','Target cell lost its exclusive reservation.');
 m.elapsed+=dt;m.ticks++;s.worldTime+=dt*1000;
 switch(m.stage){
 case 'belt':if(servo(m.belt,C.startZ-C.junctionZ,.65,.35,dt))transition(s,'fence','shuttle');break;
 case 'fence':if(servo(m.fence,.18,.15,.25,dt))transition(s,'shuttle');break;
 case 'shuttle':if(servo(m.shuttle,C.dockX,.8,.4,dt))transition(s,'approach');break;
 case 'approach':if(servo(m.lift,gripY,.32,.4,dt))transition(s,'grip');break;
 case 'grip':if(servo(m.jaws,h[0]+.025,.08,.15,dt))transition(s,'lift','gripper');break;
 case 'lift':if(servo(m.lift,2.21,.3,.4,dt))transition(s,'insert');break;
 case 'insert':if(servo(m.reach,C.targetZ,.28,.35,dt))transition(s,'lower');break;
 case 'lower':if(servo(m.lift,shelfGripY,.2,.3,dt))transition(s,'release','shelf');break;
 case 'release':if(servo(m.jaws,.37,.08,.15,dt)){
   sync(s);const task=s.tasks[m.taskId];task.contactDelivered=true;demandSlotContact(s);s.items[C.itemId].mechanicalPlacement={slotId:C.target,supportY:C.shelfTop};I.advanceTask(s,{commandId:'machine-arrival',taskId:m.taskId,action:'arrive'});s.machine.custodyReleased=true;transition(s,'retract','shelf');m=s.machine;
  }break;
 case 'retract':if(servo(m.reach,C.junctionZ,.35,.4,dt))transition(s,'stored');break;
 default:fail('UNKNOWN_MACHINE_STAGE','Invalid machine state');
 }
 sync(s);
}
function demandSlotContact(s){const p=position(s),h=itemHalf(s);if(Math.abs(p[1]-h[1]-C.shelfTop)>1e-7||Math.abs(p[0]-C.dockX)>1e-7||Math.abs(p[2]-C.targetZ)>1e-7)fail('NO_SHELF_CONTACT','The physical item has not reached the reserved shelf.');}
export function advance(s,seconds){if(!s.machine)fail('MACHINE_NOT_LOADED','Register and load one bag first.');if(!Number.isFinite(seconds)||seconds<0||seconds>120)fail('INVALID_MACHINE_STEP','Use 0 to 120 simulation seconds.');const ticks=Math.round(seconds/C.step);if(Math.abs(ticks*C.step-seconds)>1e-8)fail('INVALID_MACHINE_STEP','Use fixed 20 ms simulation ticks.');if(s.machine.paused)return audit(s);for(let n=0;n<ticks;n++){tick(s,C.step);assertContact(s);}s.revision++;assertTransport(s);return audit(s);}
export function pause(s,value=true){if(!s.machine)fail('MACHINE_NOT_LOADED','No machine task');s.machine.paused=!!value;record(s,value?'paused-with-brakes-and-grip-retained':'resumed');return audit(s);}
function assertContact(s){const m=s.machine;if(m.custodyReleased)return;const h=itemHalf(s),p=position(s);if(!p.every(Number.isFinite))fail('BAD_POSITION','Nonfinite mechanical position');if(m.contact==='belt'||m.contact==='shuttle'){if(!near(p[1]-h[1],C.beltTop))fail('LOST_SUPPORT','Item lost conveyor contact');if(m.contact==='shuttle'&&(!near(p[0],m.shuttle.q)||!near(p[2],C.junctionZ)))fail('SHUTTLE_SLIP','Shuttle support slipped');}
 if(m.contact==='gripper'&&!near(m.jaws.q-.025,h[0]))fail('GRIP_LOST','Jaw pads do not contact the item');if(m.contact==='shelf')demandSlotContact(s);
 // Conservative envelope for the only reachable cell and its insertion corridor.
 if(m.contact==='gripper'&&p[2]<9.24){if(p[0]-h[0] <12.095||p[0]+h[0]>13.105||p[1]-h[1]<C.shelfTop-1e-8||m.lift.q+.04>2.555)fail('RACK_COLLISION','Item or tool crossed a shelf/post envelope');}
}
export function assertTransport(s){I.assertInvariants(s);if(!s.machine)return true;const m=s.machine,t=s.tasks[m.taskId],i=s.items[m.itemId];if(m.version!==1||!i||t?.itemId!==m.itemId||t.motionDriver!=='belt-sort-arm-r01')fail('BAD_MACHINE','Machine identity does not match custody task');assertContact(s);if(m.custodyReleased){if(t.status!=='completed'||s.carriers[t.carrierId].itemId)fail('RELEASE_LEDGER','Released mechanism still owns a custody object');return true;}if(['retract','stored'].includes(m.stage)){if(i.location.slotId!==C.target||s.slots[C.target].occupiedBy!==i.itemId)fail('LOST_ITEM','Stored machine item is not in its sole cell');}else{if(i.location.type!=='carrier'||s.carriers[t.carrierId].itemId!==i.itemId)fail('LOST_ITEM','Mechanical chain lost its sole custody object');const p=position(s);if(p.some((v,k)=>!near(v,s.carriers[t.carrierId].position[k])))fail('POSE_SPLIT','Ledger carrier and contact solver disagree');}return true;}
export function audit(s){if(!s.machine)return{loaded:false};const m=s.machine;return{loaded:true,stage:m.stage,contact:m.contact,paused:m.paused,position:position(s),elapsed:m.elapsed,beltDisplacement:m.belt.q,shuttleX:m.shuttle.q,liftY:m.lift.q,reachZ:m.reach.q,jawHalfGap:m.jaws.q-.025,target:C.target,worldTime:s.worldTime,history:clone(m.history),model:'acceleration-limited drives with analytic support/grasp constraints, not rigid-body or boiler thermodynamics'};}
export function uniforms(s){const m=s.machine;return m?[m.belt.q,m.shuttle.q,m.fence.q,1,m.lift.q,m.reach.q,m.jaws.q,m.contact==='gripper'?1:0]:[0,C.beltX,0,0,2.38,C.junctionZ,.37,0];}
