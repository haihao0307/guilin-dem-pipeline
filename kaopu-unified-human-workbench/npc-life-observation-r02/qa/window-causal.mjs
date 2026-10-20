// TEST_FIXTURE_ONLY: production WindowInteraction and vendored Cannon execute.
// Actors below are motion inputs with no native geometry. Passing this file
// cannot certify native human skin/IK/feet, the browser, or public delivery.
import * as CANNON from '../vendor/cannon-es.js';
import {WindowInteraction,WINDOW_DIM} from '../WindowInteraction.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

const sha=file=>createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex');
const sourceAtStart=sha('../WindowInteraction.mjs'),cannonHash=sha('../vendor/cannon-es.js');
const check=(truth,message,measurements)=>{if(!truth){const e=Error(message);e.measurements=measurements;throw e;}};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
const tests=[];
const test=async(name,fn)=>{try{tests.push({name,pass:true,measurements:await fn()});}
  catch(e){tests.push({name,pass:false,error:e.stack,measurements:e.measurements});}};

function fixture(id,{missM=0,reachable=true}={}){
  return {id,side:id==='B'?'R':'L',pose:[-.1,1.16,.03],grip:0,recovering:null,restBegins:[],
    handAnchor(){return this.pose.slice();},
    setReach(p,grip,side,frame){this.pose=p.map((v,i)=>v+(i===0?missM:0));this.grip=grip;this.lastFrame=frame;this.side=side;},
    reachability(){return{reachable,errorM:reachable?0:.2};},
    rest(){this.pose=[-.1,1.16,.03];this.grip=0;this.recovering=null;},
    beginRest({duration}){this.restBegins.push({at:this.host.time,palm:this.pose.slice()});this.recovering={from:this.pose.slice(),t:0,duration};},
    updateRecovery(dt){if(!this.recovering)return true;const r=this.recovering;r.t+=dt;
      this.pose=r.from.map((x,i)=>x+([- .1,1.16,.03][i]-x)*Math.min(1,r.t/r.duration));
      if(r.t>=r.duration){this.rest();return true;}return false;},
    hasRecovery(){return !!this.recovering;},measurements:{TEST_FIXTURE_ONLY:true}};
}
function make(options={}){
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0)});
  world.solver.iterations=24;world.solver.tolerance=1e-7;
  const table=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(.62,.035,.23)),position:new CANNON.Vec3(0,.985,.52)});
  const floor=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(4,.05,3)),position:new CANNON.Vec3(0,-.05,0)});
  const bottle=new CANNON.Body({mass:.22,shape:new CANNON.Cylinder(.032,.032,.14,24),position:new CANNON.Vec3(0,1.0908,.37)});
  world.addBody(table);world.addBody(floor);world.addBody(bottle);
  const actors=['A','B','C'].map(id=>fixture(id,options));
  const host={world,actors,time:0,events:[],agents:new Map(),handBodies:new Map(),busyActors:new Set(),
    actorBusy(id){return this.busyActors.has(id);},
    emit(type,id,data){this.events.push({type,actor:id,time:this.time,...data});}};
  for(const actor of actors){actor.host=host;const hand=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,
    collisionFilterGroup:0,collisionFilterMask:0,shape:new CANNON.Sphere(.009)});world.addBody(hand);host.handBodies.set(actor.id,hand);}
  host.window=new WindowInteraction(host);host.table=table;host.bottle=bottle;
  host.tick=dt=>{host.time+=dt;host.window.preStep(dt);world.step(dt);host.window.postStep(dt);};return host;
}
function run(h,until,{seconds=24,dt=1/120,onStep=()=>{}}={}){
  const start=h.time;let maxGrip=0,maxForce=0,maxContacts=0,maxBlockForce=0,minAngle=Infinity,maxAngle=-Infinity;
  const outcome=timeout=>({elapsed:h.time-start,timeout,maxGrip,maxForce,maxContacts,maxBlockForce,minAngle,maxAngle});
  for(let i=0;i<Math.ceil(seconds/dt);i++){
    onStep(h,i);h.tick(dt);const s=h.window.snapshot().object;
    maxGrip=Math.max(maxGrip,s.gripConstraintCount);maxForce=Math.max(maxForce,...s.forcePerAxisN.map(Math.abs));
    maxContacts=Math.max(maxContacts,s.obstruction.contactCount);maxBlockForce=Math.max(maxBlockForce,s.obstruction.forceN);
    minAngle=Math.min(minAngle,s.angleDeg);maxAngle=Math.max(maxAngle,s.angleDeg);
    if(until(h))return outcome(false);
  }return outcome(true);
}
const finished=(h,id)=>!!h.window.agents.get(id).result&&!h.window.ownsActor(id);

await test('one actual hinge supports a resting rigid leaf without an interaction',()=>{
  const h=make();run(h,()=>h.time>=2);const s=h.window.snapshot().object;
  check(s.hingeConstraintCount===1&&s.gripConstraintCount===0&&Math.abs(s.angleDeg)<.5,'Unactuated leaf or structural hinge is unstable',s);
  check(h.world.constraints.length===1&&h.bottle.position.y>1.08,'Initial window fixture conflicts with the original supported bottle',s);
  return {object:s,bottlePosition:h.bottle.position.toArray(),leafParts:WINDOW_DIM.leafParts.length};
});

await test('the same leaf physically opens and closes after contact, then settles without a hand constraint',()=>{
  const h=make(),w=h.window;w.request('A','open');const opening=run(h,h=>finished(h,'A'));
  const openResult=w.agents.get('A').result,openPose=w.snapshot().object;
  check(openResult?.result==='completed'&&!opening.timeout&&openPose.goalOpen,'Opening did not finish from the actual released body', {opening,openResult,openPose});
  check(w.request('A','close'),'A completed recovered actor could not request close');
  const closing=run(h,h=>finished(h,'A'));const closeResult=w.agents.get('A').result,closePose=w.snapshot().object;
  check(closeResult?.result==='completed'&&!closing.timeout&&closePose.goalClosed,'Closing did not finish from the actual released body',{closing,closeResult,closePose});
  check(w.audit.contacts.length===2&&opening.maxGrip===1&&closing.maxGrip===1&&h.world.constraints.length===1,'Interaction/hinge accounting differs from real constraints');
  check(Math.max(opening.maxForce,closing.maxForce)<=24.000001,'P2P grip exceeded its declared force per axis');
  return {opening,openResult,openAngle:openPose.angleDeg,closing,closeResult,closeAngle:closePose.angleDeg,contacts:w.audit.contacts};
});

await test('a palm missing by five centimetres cannot attach or open the window',()=>{
  const h=make({missM:.05});h.window.request('A','open');const outcome=run(h,h=>finished(h,'A'));
  const result=h.window.agents.get('A').result,s=h.window.snapshot().object;
  check(result?.result==='contact-failed'&&outcome.maxGrip===0&&Math.abs(s.angleDeg)<.5,'Missing real input contact still actuated the window',{outcome,result,s});
  return{outcome,result,angleDeg:s.angleDeg};
});

await test('an independent rigid blocker physically prevents opening and removing it permits the same task',()=>{
  const h=make(),w=h.window;w.setBlocked(true);w.request('A','open');const blocked=run(h,h=>finished(h,'A'));
  const blockedResult=w.agents.get('A').result,blockedPose=w.snapshot().object;
  check(blockedResult?.result==='blocked'&&blocked.maxContacts>0&&blocked.maxBlockForce>0&&!blockedPose.goalOpen,
    'Blocker did not cause a measured rigid-contact failure',{blocked,blockedResult,blockedPose,obstructions:w.audit.obstructions});
  check(w.audit.obstructions.length===1&&h.world.constraints.length===1,'Blocked task did not release only its interaction');
  w.setBlocked(false);w.request('A','open');const retry=run(h,h=>finished(h,'A'));
  check(w.agents.get('A').result?.result==='completed'&&w.snapshot().object.goalOpen,'Removing the actual obstruction did not permit opening from the retained physical angle',{retry,result:w.agents.get('A').result});
  return{blocked,blockedResult,obstruction:w.audit.obstructions[0],retry,result:w.agents.get('A').result};
});

await test('cancel during actual rotation removes only the grip and preserves angular motion before withdrawal and rest',()=>{
  const h=make(),w=h.window;w.request('A','open');run(h,()=>w.heldBy==='A'&&Math.abs(w.snapshot().object.angleDeg)>8);
  const before=w.snapshot().object;check(before.gripConstraintCount===1&&Math.abs(before.angleDeg)<28,'Cancellation did not occur in a genuine mid-swing');
  const at=h.time;check(w.cancel('A'),'Mid-swing cancel was rejected');const immediate=w.snapshot().object;
  check(immediate.gripConstraintCount===0&&immediate.hingeConstraintCount===1&&!immediate.heldBy&&!immediate.reservedBy,'Cancellation removed hinge or leaked interaction',immediate);
  check(near(immediate.angleDeg,before.angleDeg)&&near(immediate.angularVelocityRadS,before.angularVelocityRadS),'Cancel rewrote the rigid pose or velocity',{before,immediate});
  const recovery=run(h,h=>finished(h,'A'),{seconds:4});const actor=h.actors[0],after=w.snapshot().object;
  check(actor.restBegins.length===1&&actor.restBegins[0].at-at>=WINDOW_DIM.withdrawSeconds-1e-7,'Native rest began before the required visible withdrawal',{at,restBegins:actor.restBegins});
  check(!w.ownsActor('A')&&!w.agents.get('A').recovery&&!w.grip&&!w.heldBy&&!w.reservedBy&&h.world.constraints.length===1,'Recovery left a stale grip or actor owner',{after});
  return{before,immediate,recovery,after,restBegins:actor.restBegins};
});

await test('two actors requesting the same angle use one grip and the helper observes the released goal',()=>{
  const h=make(),w=h.window;check(w.request('A','open')&&w.request('B','open'),'Same-resource requests were not accepted into the shared queue');
  const outcome=run(h,h=>finished(h,'A')&&finished(h,'B'));
  const results=['A','B'].map(id=>w.agents.get(id).result);
  check(results[0]?.result==='completed'&&results[1]?.result==='already-at-target','Contention did not preserve a single physical execution',{outcome,results});
  check(outcome.maxGrip===1&&w.audit.contacts.length===1&&w.audit.maxOwners===1&&h.world.constraints.length===1,'Shared window ownership is not unique');
  const aResult=h.events.find(e=>e.type==='window-task-result'&&e.actor==='A');
  const bReserve=h.events.find(e=>e.type==='window-reserved'&&e.actor==='B');
  const bVerify=h.events.find(e=>e.type==='window-phase'&&e.actor==='B'&&e.phase==='verify');
  check(aResult&&bReserve&&bVerify&&aResult.windowEventSeq<bReserve.windowEventSeq&&bReserve.windowEventSeq<bVerify.windowEventSeq,
    'Helper bypassed the first task reservation while its released goal was still being verified',{aResult,bReserve,bVerify});
  check(bReserve.taskToken===results[1].taskToken&&bVerify.taskToken===results[1].taskToken,
    'Queued helper evidence used a different task token',{bReserve,bVerify,result:results[1]});
  return{outcome,results,contacts:w.audit.contacts.length,reservationOrder:{aResult:aResult.windowEventSeq,bReserve:bReserve.windowEventSeq,bVerify:bVerify.windowEventSeq},helperTaskToken:results[1].taskToken};
});

await test('a waiting helper can take over a cancelled moving leaf while the previous actor withdraws',()=>{
  const h=make(),w=h.window;w.request('A','open');w.request('B','open');let cancelled=false,immediate;
  const outcome=run(h,h=>cancelled&&finished(h,'A')&&finished(h,'B'),{onStep(){
    if(!cancelled&&w.heldBy==='A'&&Math.abs(w.snapshot().object.angleDeg)>8){w.cancel('A');immediate=w.snapshot().object;cancelled=true;}
  }});
  check(cancelled&&immediate.gripConstraintCount===0&&!immediate.reservedBy&&immediate.hingeConstraintCount===1,'Cancel did not immediately free the window resource',immediate);
  check(w.agents.get('B').result?.result==='completed'&&w.audit.contacts.length===2,'Waiting helper could not complete from the retained physical state',{outcome,result:w.agents.get('B').result});
  check(w.audit.maxOwners===1&&w.audit.maxGripConstraints===1,'Takeover created multiple holders');
  return{outcome,immediate,result:w.agents.get('B').result};
});

await test('host bottle ownership refuses a window task without falsely claiming unrelated actor recovery',()=>{
  const h=make(),w=h.window;h.busyActors.add('A');h.actors[0].beginRest({duration:.65});
  check(!w.request('A','open')&&!w.ownsActor('A')&&!w.busy(),'Window stole or deadlocked a host-owned bottle recovery');
  h.busyActors.delete('A');h.actors[0].rest();check(w.request('A','open')&&w.ownsActor('A'),'Free actor did not acquire a window task');
  check(!w.request('A','close'),'Same actor received two simultaneous window tasks');w.cancel('A');
  return{windowPhase:w.agents.get('A').phase,temporaryGrips:w.grip?1:0,permanentHinges:w.world.constraints.includes(w.hinge)?1:0};
});

const sourceHash=sha('../WindowInteraction.mjs');
const report={schema:'kaopu/window-causal-qa@1',createdAt:new Date().toISOString(),sourceHash,sourceAtStart,
  sourceUnchangedDuringTest:sourceHash===sourceAtStart,cannonSHA256:cannonHash,
  scope:'TEST_FIXTURE_ONLY actors; actual production WindowInteraction and Cannon bodies/constraints, dimensioned R01 table and source bottle',
  doesNotProve:['native IK and full hand/skin geometry','foot or body collisions','native pose recovery correctness','browser performance/visual acceptance','public publication'],
  passed:sourceHash===sourceAtStart&&tests.every(t=>t.pass),counts:{passed:tests.filter(t=>t.pass).length,total:tests.length},tests};
writeFileSync(new URL('./window-causal-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,counts:report.counts,tests:tests.map(t=>({name:t.name,pass:t.pass,error:t.error?.split('\n')[0]}))},null,2));
if(!report.passed)process.exitCode=1;
