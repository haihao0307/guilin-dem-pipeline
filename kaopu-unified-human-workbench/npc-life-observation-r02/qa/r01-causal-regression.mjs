// R02 adds a permanent hinge; original bottle assertions count only bottle grips.
// TEST_FIXTURE_ONLY. These actor fixtures have no geometry and certify only
// the production LifeWorld's rigid-body/state causality. They do not certify
// native-person IK, skin contact, appearance, browser operation, or delivery.
// They also omit configureGrasp and native surface diagnostics, so they do not
// validate calibrated grasp admissibility or actual hand/prop penetration.
import {LifeWorld, DIM} from '../LifeWorld.mjs';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const dt=1/120;
const sourceHashAtStart=createHash('sha256').update(readFileSync(new URL('../LifeWorld.mjs',import.meta.url))).digest('hex');
const actor=(id,{offset=0}={})=>({id,pose:[0,1.05,-.15],visibleGrip:0,
  handAnchor(){return this.pose.slice();},
  setReach(target,grip){this.pose=target.map((x,i)=>x+(i===0?offset:0));this.visibleGrip=grip;},
  rest(){this.pose=[0,1.05,-.15];this.visibleGrip=0;},
  reachability(){return{reachable:true,errorM:0};},
  measurements:{TEST_FIXTURE_ONLY:true}});
const make=(options={})=>new LifeWorld(['A','B','C'].map(id=>actor(id,options)));
const near=(a,b,e)=>Math.abs(a-b)<=e;
const run=(w,until,{seconds=35,onStep=()=>{}}={})=>{
  const start=w.time;let maxHeight=w.bottle.position.y,maxOwners=0,maxConstraints=0,maxGripAxisForceN=0,maxGripForceNormN=0,maxGripAxisTorqueNm=0;
  const summary=timeout=>({elapsed:w.time-start,maxHeight,maxOwners,maxConstraints,maxGripAxisForceN,maxGripForceNormN,maxGripAxisTorqueNm,timeout});
  for(let i=0;i<Math.ceil(seconds/dt);i++){
    onStep(w,i);w.tick(dt);maxHeight=Math.max(maxHeight,w.bottle.position.y);
    maxOwners=Math.max(maxOwners,Number(!!w.heldBy));maxConstraints=Math.max(maxConstraints,w.gripConstraintCount());
    if(w.grip){
      const linear=w.grip.equations.slice(0,3).map(e=>Math.abs(e.multiplier));
      const angular=w.grip.equations.slice(3).map(e=>Math.abs(e.multiplier));
      maxGripAxisForceN=Math.max(maxGripAxisForceN,...linear);
      maxGripForceNormN=Math.max(maxGripForceNormN,Math.hypot(...linear));
      maxGripAxisTorqueNm=Math.max(maxGripAxisTorqueNm,...angular);
    }
    if(until(w))return summary(false);
  }
  return summary(true);
};
const terminal=a=>['done','failed','cancelled'].includes(a.phase);
const check=(truth,message,measurements)=>{if(!truth){const e=Error(message);e.measurements=measurements;throw e;}};
const tests=[];
async function test(name,fn){try{tests.push({name,pass:true,measurements:await fn()});}catch(e){tests.push({name,pass:false,error:e.stack,measurements:e.measurements});}}

await test('gravity and actual table support remain causal without any actor',()=>{
  const w=make();run(w,()=>w.support()&&w.bottle.velocity.length()<.01,{seconds:3});
  const supported={y:w.bottle.position.y,supported:w.support(),constraints:w.gripConstraintCount()};
  check(supported.supported&&near(supported.y,DIM.tableTop+DIM.height/2,.003),'Bottle failed to settle on the dimensioned table');
  w.setSupport(false);run(w,()=>w.bottle.position.y<.2,{seconds:3});
  const after={y:w.bottle.position.y,velocityY:w.bottle.velocity.y,supported:w.support(),goal:w.goal()};
  check(after.y<.2&&after.velocityY<-.3&&!after.supported&&!after.goal,'Removing support did not cause a real falling, non-success state');
  return{supported,after};
});

await test('no grip may be created with a palm that misses by 5 cm',()=>{
  const w=make({offset:.05});w.request('A');const outcome=run(w,()=>terminal(w.agents.get('A')));
  const a=w.agents.get('A');check(a.result?.result==='contact-failed'&&w.audit.contacts.length===0&&outcome.maxConstraints===0,'A missed contact was allowed to grip');
  return{outcome,result:a.result,contacts:w.audit.contacts.length};
});

await test('light object performs a physical lift, then release and supported settling',()=>{
  const w=make();w.request('A');const outcome=run(w,()=>terminal(w.agents.get('A')));
  const a=w.agents.get('A');check(a.result?.result==='completed'&&outcome.maxHeight>DIM.source[1]+.10,'Baseline did not execute a real lift and completion');
  check(w.goal()&&w.heldBy===null&&w.grip===null&&w.gripConstraintCount()===0,'Completed object did not end physically released and supported');
  return{outcome,result:a.result,position:w.bottle.position.toArray(),goal:w.goal()};
});

await test('finite assisted grip cannot carry a 100 kg object as an animated prop',()=>{
  const w=make();w.bottle.mass=100;w.bottle.updateMassProperties();w.request('A');
  const outcome=run(w,()=>terminal(w.agents.get('A')));
  const a=w.agents.get('A'),measurements={massKg:w.bottle.mass,outcome,result:a.result};
  check(a.result&&a.result.result!=='completed','Heavy object was carried despite the finite force constraint',measurements);
  check(outcome.maxHeight<DIM.source[1]+.03&&w.grip===null,'Heavy object was force-animated or retained a stale grip',measurements);
  return measurements;
});

await test('two requests share one physical item and preserve unique grip ownership',()=>{
  const w=make();w.request('A');w.request('B');
  const outcome=run(w,()=>terminal(w.agents.get('A'))&&terminal(w.agents.get('B')));
  const results=['A','B'].map(id=>w.agents.get(id).result);
  check(results[0]?.result==='completed'&&results[1]?.result==='already-sorted','Contention did not produce one completed and one satisfied-without-regrip result');
  check(outcome.maxConstraints===1&&w.audit.contacts.length===1,'One prop was gripped more than once or concurrently');
  return{outcome,results,contacts:w.audit.contacts};
});

await test('removing support during transport prevents successful placement',()=>{
  const w=make();w.request('A');let changed=false;
  const outcome=run(w,()=>terminal(w.agents.get('A')),{onStep(){if(!changed&&w.agents.get('A').phase==='transfer'){w.setSupport(false);changed=true;}}});
  const a=w.agents.get('A');check(changed&&a.result?.result==='world-result-failed'&&w.bottle.position.y<.2,'Support failure was not judged from the actual falling body');
  check(!w.heldBy&&!w.grip&&!w.reservedBy,'A failed placement leaked ownership');
  return{outcome,result:a.result,y:w.bottle.position.y};
});

await test('changing the placement zone during transfer is observed by the production task',()=>{
  const w=make();w.request('A');let changed=false;
  const outcome=run(w,()=>terminal(w.agents.get('A')),{onStep(){if(!changed&&w.agents.get('A').phase==='transfer'){w.moveTarget();changed=true;}}});
  const a=w.agents.get('A');check(changed&&a.result?.result==='completed'&&near(w.bottle.position.x,w.target[0],.052),'Placement used the initial target rather than the changed world target');
  return{outcome,result:a.result,x:w.bottle.position.x,target:w.target.slice()};
});

await test('cancelling a held item frees both the constraint and the visible grip',()=>{
  const w=make();w.request('A');run(w,()=>w.agents.get('A').phase==='lift');
  const a=w.agents.get('A');check(w.heldBy==='A','Cancellation setup did not reach a physical grip');
  w.cancel('A');run(w,()=>w.time-a.started>5,{seconds:5});
  const result={phase:a.phase,semanticGrip:a.gripValue,actorGrip:a.actor.visibleGrip,heldBy:w.heldBy,reservedBy:w.reservedBy,constraints:w.gripConstraintCount()};
  check(!result.heldBy&&!result.reservedBy&&result.constraints===0,'Cancellation leaked physical ownership');
  check(result.actorGrip===0,'Cancellation reports grip=0 but never sends the visible actor a release pose');
  return result;
});

await test('helper can acquire the physical item after holder cancellation',()=>{
  const w=make();w.request('A');w.request('B');let changed=false,cancelled;
  const outcome=run(w,()=>changed&&terminal(w.agents.get('B')),{onStep(){if(!changed&&w.agents.get('A').phase==='lift'){w.cancel('A');cancelled={heldBy:w.heldBy,reservedBy:w.reservedBy,constraints:w.gripConstraintCount()};changed=true;}}});
  check(cancelled?.constraints===0&&!cancelled.heldBy&&!cancelled.reservedBy,'Cancellation did not immediately free world state');
  check(w.agents.get('B').result?.result==='completed','Waiting helper could not finish after cancellation');
  return{outcome,cancelled,b:w.agents.get('B').result};
});

await test('review text invalidates its old success when physical support disappears',()=>{
  const w=make();w.startIdentityPlan();run(w,()=>w.review.checked);
  check(w.review.checked,'Review setup did not finish');w.setSupport(false);w.tick(dt);
  const result={...w.review};check(!result.checked,'Review success remained true after loss of support');
  check(result.phase!=='复核完成','The current UI review phase still says complete after its world predicate became false',result);
  return result;
});

const sourceHash=createHash('sha256').update(readFileSync(new URL('../LifeWorld.mjs',import.meta.url))).digest('hex');
const sourceUnchangedDuringTest=sourceHash===sourceHashAtStart;
const report={schema:'npc-independent-causal-qa/1',createdAt:new Date().toISOString(),sourceHash,sourceHashAtStart,sourceUnchangedDuringTest,
  scope:'TEST_FIXTURE_ONLY actor adapters; production LifeWorld and vendored Cannon execute unchanged',
  testsCoverage:['rigid-body gravity/support causality','finite grip force','ownership and cancellation state','world-result feedback'],
  doesNotProve:['native people or surface IK','configured native grasp admissibility','finger geometry or collisions','body/foot/table clearance','browser or mobile execution','public delivery','visual acceptance'],
  passed:sourceUnchangedDuringTest&&tests.every(t=>t.pass),counts:{passed:tests.filter(t=>t.pass).length,total:tests.length},tests};
writeFileSync(new URL('./r01-causal-regression-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,counts:report.counts,tests:tests.map(t=>({name:t.name,pass:t.pass,error:t.error?.split('\n')[0]}))},null,2));
if(!report.passed)process.exitCode=1;
