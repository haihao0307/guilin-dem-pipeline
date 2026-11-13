// TEST_FIXTURE_ONLY motion adapters. The actual production LifeWorld and its
// WindowInteraction execute. This verifies resource/recovery dispatch, not
// native-human geometry, native quaternion interpolation, or browser output.
import {LifeWorld} from '../LifeWorld.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const files=['../LifeWorld.mjs','../WindowInteraction.mjs','../vendor/cannon-es.js'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex')]));
const sourceAtStart=hashes(),dt=1/120,tests=[];
const check=(ok,message,evidence)=>{if(!ok){const e=Error(message);e.evidence=evidence;throw e;}};
const test=async(name,fn)=>{try{tests.push({name,pass:true,evidence:await fn()});}catch(e){tests.push({name,pass:false,error:e.stack,evidence:e.evidence});}};
function actor(id){return {id,side:'L',pose:[0,1.05,-.15],visibleGrip:0,recovery:null,reaching:null,restStarted:0,restUpdated:0,reachCalls:0,
  handAnchor(){return this.pose.slice();},setReach(p,g){this.reaching=null;this.reachCalls++;this.pose=p.slice();this.visibleGrip=g;},
  // Linear TEST_FIXTURE_ONLY input; the native adapter owns real pose blending.
  beginReachTransition(p,{duration}){this.reaching={from:this.pose.slice(),to:p.slice(),elapsed:0,duration};},
  updateReachTransition(delta){const r=this.reaching;if(!r)return true;r.elapsed+=delta;const done=r.elapsed+1e-10>=r.duration,t=done?1:r.elapsed/r.duration;
    this.pose=r.from.map((v,i)=>v+(r.to[i]-v)*t);if(done)this.reaching=null;return done;},
  hasReachTransition(){return !!this.reaching;},
  rest(){this.pose=[0,1.05,-.15];this.visibleGrip=0;this.recovery=null;this.reaching=null;},
  reachability(){return {reachable:true,errorM:0};},
  beginRest({duration}){this.reaching=null;this.restStarted++;this.recovery={elapsed:0,duration,from:this.pose.slice()};},
  updateRecovery(delta){this.restUpdated++;const r=this.recovery;if(!r)return true;r.elapsed+=delta;
    const t=Math.min(1,r.elapsed/r.duration);this.pose=r.from.map((x,i)=>x+([0,1.05,-.15][i]-x)*t);
    if(t>=1){this.rest();return true;}return false;},
  hasRecovery(){return !!this.recovery;},measurements:{TEST_FIXTURE_ONLY:true}};}
const make=()=>new LifeWorld(['A','B','C'].map(actor));
function run(w,predicate,{seconds=30,onStep=()=>{}}={}){const start=w.time;for(let i=0;i<seconds/dt;i++){
  onStep(w,i);w.tick(dt);if(predicate(w))return {elapsed:w.time-start,steps:i+1,timeout:false};}
  return {elapsed:w.time-start,timeout:true};}

await test('a completed bottle task advances the real host recovery and permits a subsequent window request',()=>{
  const w=make(),a=w.actors[0];w.request('A');let observedNativeRecovery=false;
  const outcome=run(w,()=>w.agents.get('A').result&& !w.actorBusy('A'),{onStep(){observedNativeRecovery ||= a.hasRecovery();}});
  const bottle=w.agents.get('A').result;
  check(!outcome.timeout&&bottle?.result==='completed'&&observedNativeRecovery&&a.restUpdated>0&&!a.hasRecovery(),
    'Actual LifeWorld stopped advancing bottle-owned actor recovery',{outcome,bottle,observedNativeRecovery,restUpdated:a.restUpdated});
  check(!w.window.ownsActor('A')&&w.window.request('A','open'),'Recovered bottle actor could not enter window ownership');
  const nextTask=w.window.agents.get('A').task;w.cancel('A');
  return {outcome,bottle,observedNativeRecovery,restUpdates:a.restUpdated,nextTask};
});

await test('one actor cannot cross from bottle or window execution/recovery until the owning recovery finishes',()=>{
  const w=make(),a=w.actors[0];check(w.request('A'),'Bottle request was rejected');
  const bottleExecutionRejected=!w.window.request('A','open');
  run(w,()=>w.heldBy==='A'&&w.agents.get('A').phase==='lift');w.cancel('A');
  const bottleWithdrawalRejected=!w.window.request('A','open');
  run(w,()=>a.hasRecovery());const bottleRestRejected=!w.window.request('A','open');
  const bottleRecovery=run(w,()=>!w.actorBusy('A'));
  check(w.window.request('A','open'),'Window request was rejected after bottle recovery completed');
  const windowExecutionRejected=!w.request('A');
  run(w,()=>w.window.heldBy==='A'&&Math.abs(w.window.snapshot().object.angleDeg)>8);w.cancel('A');
  const windowWithdrawalRejected=!w.request('A');run(w,()=>a.hasRecovery());const windowRestRejected=!w.request('A');
  const windowRecovery=run(w,()=>!w.window.ownsActor('A'));const acceptedAfterRecovery=w.request('A');
  const evidence={bottleExecutionRejected,bottleWithdrawalRejected,bottleRestRejected,bottleRecovery,
    windowExecutionRejected,windowWithdrawalRejected,windowRestRejected,windowRecovery,acceptedAfterRecovery};
  check(bottleExecutionRejected&&bottleWithdrawalRejected&&bottleRestRejected&&windowExecutionRejected&&windowWithdrawalRejected&&windowRestRejected&&acceptedAfterRecovery
    &&!bottleRecovery.timeout&&!windowRecovery.timeout,'Cross-resource exclusivity or recovery release failed',evidence);
  return evidence;
});

await test('host.cancel routes an actual moving window to immediate grip release while preserving its hinge and later freeing the actor',()=>{
  const w=make();w.window.request('A','open');const setup=run(w,()=>w.window.heldBy==='A'&&Math.abs(w.window.snapshot().object.angleDeg)>8);
  const before=w.window.snapshot().object;check(!setup.timeout&&before.gripConstraintCount===1,'Host cancel setup never reached a moving physical grip');
  check(w.cancel('A'),'Host cancel was not routed to WindowInteraction');const immediate=w.snapshot();
  check(immediate.constraints.total===1&&immediate.constraints.structural===1&&immediate.constraints.bottleGrip===0&&immediate.constraints.windowGrip===0,
    'Host cancel removed the hinge or retained a temporary grip',immediate.constraints);
  check(!immediate.window.object.reservedBy&&!immediate.window.object.heldBy&&near(before.angleDeg,immediate.window.object.angleDeg)
    &&near(before.angularVelocityRadS,immediate.window.object.angularVelocityRadS),'Host cancel rewrote the body or retained owner',{before,immediate:immediate.window.object});
  const movingAgent=immediate.window.agents.find(a=>a.id==='A');
  check(movingAgent.result.firstContactErrorM===0&&movingAgent.recovery?.mode==='withdraw-then-rest'&&movingAgent.recovery.noContact===false,
    'A real zero-error contact was mistaken for no contact during mid-swing cancellation',movingAgent);
  const recovery=run(w,()=>!w.window.ownsActor('A'));
  check(!recovery.timeout&&!w.actors[0].hasRecovery()&&!w.window.agents.get('A').recovery&&w.request('A'),
    'Window recovery failed to release the actor back to the actual host');
  const earlyCancellations=[];
  for(const supportEnabled of [true,false]){
    const e=make(),a=e.actors[0];e.setSupport(supportEnabled);check(e.window.request('A','open'),'Early-cancel setup request failed');
    const approach=run(e,()=>e.window.agents.get('A').phase==='approach'&&e.window.agents.get('A').phaseTime>=.1-1e-10,{seconds:1});
    const task=e.window.agents.get('A').task,palm=a.handAnchor(),reachCalls=a.reachCalls;
    check(!approach.timeout&&e.window.agents.get('A').firstContactErrorM===null&&a.hasReachTransition(),
      'Early-cancel setup was not in an uncontacted native pose transition');
    check(e.cancel('A'),'Actual host rejected the early cancellation');
    const cancelled=e.snapshot(),agent=cancelled.window.agents.find(a=>a.id==='A'),r=agent.recovery;
    check(r?.phase==='rest'&&r.mode==='direct-rest-no-contact'&&r.noContact===true&&r.sourcePhase==='approach'&&r.reason==='cancelled'
      &&r.target===null&&near(r.tableRearZ,.29)&&near(r.safePalmZ,.14)&&palm[2]<=r.safePalmZ,
      'A safe uncontacted hand did not enter an honest native-pose recovery', {supportEnabled,palm,agent});
    check(a.reachCalls===reachCalls&&a.hasRecovery()&&!a.hasReachTransition()&&cancelled.constraints.total===1&&!cancelled.window.object.reservedBy&&!cancelled.window.object.heldBy,
      'Early cancel issued an extra Cartesian reach or retained a resource', {reachCalls,after:a.reachCalls,counts:cancelled.constraints});
    check(!e.request('A'),'Bottle task stole an actor during direct native rest');
    const recovered=run(e,()=>!e.window.ownsActor('A'),{seconds:1}),events=e.events.filter(x=>x.taskToken===task.token);
    check(!recovered.timeout&&!a.hasRecovery()&&a.reachCalls===reachCalls&&e.request('A'),
      'Direct native rest failed to finish or kept driving the Cartesian hand target', {recovered,reachCalls,after:a.reachCalls});
    check(events.some(x=>x.type==='window-direct-rest'&&x.noContact===true&&x.sourcePhase==='approach'&&x.target===null)
      &&events.some(x=>x.type==='window-restored'&&x.mode==='direct-rest-no-contact')
      &&!events.some(x=>['window-withdrawal-planned','window-hand-withdrawn'].includes(x.type)),
      'Direct rest fabricated a withdrawal or lost its task-bound recovery evidence',events);
    earlyCancellations.push({supportEnabled,approach,palm,taskToken:task.token,recovery:r,recovered,reachCallsUnchanged:true,
      counts:cancelled.constraints,events:events.map(x=>({type:x.type,taskToken:x.taskToken,mode:x.mode,noContact:x.noContact,sourcePhase:x.sourcePhase,reason:x.reason}))});
  }
  return {setup,before,immediate:immediate.window.object,counts:immediate.constraints,recovery,bottleNextAccepted:true,earlyCancellations};
});
function near(a,b){return Math.abs(a-b)<1e-9;}
const sourceHashes=hashes(),sourceUnchangedDuringTest=JSON.stringify(sourceAtStart)===JSON.stringify(sourceHashes);
const report={schema:'kaopu/window-host-integration-qa@1',createdAt:new Date().toISOString(),sourceAtStart,sourceHashes,
  sourceUnchangedDuringTest,scope:'Actual production LifeWorld + WindowInteraction + Cannon; TEST_FIXTURE_ONLY actor motion/recovery inputs',
  doesNotProve:['native geometry or IK','true local-quaternion recovery correctness','browser or public delivery'],
  passed:sourceUnchangedDuringTest&&tests.every(t=>t.pass),counts:{passed:tests.filter(t=>t.pass).length,total:tests.length},tests};
writeFileSync(new URL('./window-host-integration-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,counts:report.counts,tests:tests.map(t=>({name:t.name,pass:t.pass,error:t.error?.split('\n')[0]}))},null,2));
if(!report.passed)process.exitCode=1;
