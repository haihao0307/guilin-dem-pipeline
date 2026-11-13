// TEST_FIXTURE_ONLY: actual LifeWorld / WindowInteraction / Cannon, lightweight
// actor motion inputs. These tests establish data and command boundaries only.
// They do not certify native skin, visible contact, GPU frames or publication.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {LifeWorld} from '../LifeWorld.mjs';

const dt=1/120;
const paths=['../LifeWorld.mjs','../WindowInteraction.mjs','../StateSnapshot.mjs'];
const hashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex')]));
const sourceAtStart=hashes(),tests=[];
const actor=id=>({id,side:'L',pose:[0,1.05,-.15],
  handAnchor(){return this.pose.slice();},setReach(target){this.pose=target.slice();},
  rest(){this.pose=[0,1.05,-.15];this.recovering=null;},
  beginRest({duration}){this.recovering={remaining:duration};},
  updateRecovery(dt){if(!this.recovering)return true;this.recovering.remaining-=dt;if(this.recovering.remaining<=0){this.rest();return true;}return false;},
  hasRecovery(){return !!this.recovering;},reachability(){return{reachable:true,errorM:0};},
  measurements:{TEST_FIXTURE_ONLY:true,dimensions:{heightM:1.7}},
  identity:{presetId:'fixture-'+id,provenance:{reference:'fixture'}},
  binding:{report:{vertices:0,limitations:['fixture']}}});
const make=()=>new LifeWorld(['A','B','C'].map(actor));
const test=(name,fn)=>{try{tests.push({name,pass:true,measurements:fn()});}catch(error){tests.push({name,pass:false,error:error.stack});}};
const runUntil=(w,condition,seconds=35)=>{for(let i=0;i<Math.ceil(seconds/dt);i++){w.tick(dt);if(condition())return;}throw Error('Fixture deadline exceeded');};
const plain=value=>{if(value&&typeof value==='object'){assert([Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(value)));for(const child of Object.values(value))plain(child);}};
const finishPlan=()=>{const w=make();w.startIdentityPlan();runUntil(w,()=>w.review.checked&&['A','B'].every(id=>w.agents.get(id).phase==='done'&&!w.agents.get(id).retraction));return w;};

test('full and lightweight snapshots do not expose writable task or identity state',()=>{
  const w=make();assert(w.window.request('A','open'));assert(w.request('B'));
  for(const includeAudit of [true,false]){
    const before=w.snapshot();const s=w.snapshot({includeAudit});plain(s);
    s.window.agents.find(a=>a.id==='A').task.targetAngleRad=.123;
    s.agents.find(a=>a.id==='B').task.token='tampered';
    s.review.checked=true;s.target[0]=99;
    s.agents[0].measurements.dimensions.heightM=99;
    s.agents[0].identity.provenance.reference='tampered';
    s.agents[0].binding.limitations.push('tampered');
    s.events[0].type='tampered';s.window.events[0].type='tampered';
    if(includeAudit){s.audit.maxOwners=99;s.window.audit.maxOwners=99;}
    else {s.auditSummary.retained.tasks=99;s.window.auditSummary.retained.tasks=99;}
    assert.deepEqual(w.snapshot(),before);
  }
  return{activeWindowTarget:w.window.agents.get('A').task.targetAngleRad,fixtureOnly:true};
});

test('retained snapshots remain point-in-time data after tasks, ticks and reset',()=>{
  const w=make(),full=w.snapshot(),light=w.snapshot({includeAudit:false});
  const savedFull=JSON.stringify(full),savedLight=JSON.stringify(light);
  w.request('A');for(let i=0;i<8;i++)w.tick(dt);w.moveTarget();w.setSupport(false);w.reset();
  assert.equal(JSON.stringify(full),savedFull);assert.equal(JSON.stringify(light),savedLight);
  return{initialEvents:full.events.length,laterEvents:w.events.length};
});

test('light state omits diagnostic arrays and returns exactly the recent event window',()=>{
  const w=make();for(let i=0;i<25;i++){w.emit('fixture-event',null,{index:i});w.window.emit('fixture-event',null,{index:i});}
  const diagnostic={payload:'fixture'.repeat(10000)};
  w.audit.poses.push(diagnostic);w.window.audit.poses.push(diagnostic);
  const full=w.snapshot(),light=w.snapshot({includeAudit:false});
  assert(!Object.hasOwn(light,'audit'));assert(!Object.hasOwn(light.window,'audit'));
  assert.equal(light.auditSummary.retained.poses,1);assert.equal(light.window.auditSummary.retained.poses,1);
  assert.deepEqual(light.events,full.events.slice(-10));assert.deepEqual(light.window.events,full.window.events.slice(-10));
  assert.equal(light.events.length,10);assert.equal(light.window.events.length,10);
  assert.equal(light.auditSummary.eventsRetained,w.events.length);
  assert(!JSON.stringify(light).includes(diagnostic.payload));
  return{fixtureFullBytes:Buffer.byteLength(JSON.stringify(full)),fixtureLightBytes:Buffer.byteLength(JSON.stringify(light)),scope:'structural omission fixture, not a native browser memory benchmark'};
});

test('same-time bottle tasks have unique tokens and stale cancellation has no side effects',()=>{
  const w=make();assert(w.request('A'));const first=w.snapshot().agents[0].task;
  assert(w.cancel('A',{expectedTaskToken:first.token}));assert(w.request('A'));
  const second=w.snapshot().agents[0].task,before=w.snapshot();
  assert.equal(first.requestedAt,second.requestedAt);assert.notEqual(first.id,second.id);assert.notEqual(first.token,second.token);assert(second.generation>first.generation);
  assert.equal(w.cancel('A',{expectedTaskToken:first.token}),false);assert.deepEqual(w.snapshot(),before);
  assert(w.cancel('A',{expectedTaskToken:second.token}));assert.equal(w.agents.get('A').result.taskToken,second.token);
  w.reset();assert(w.request('A'));assert.notEqual(w.agents.get('A').task.token,second.token);
  return{first:first.token,second:second.token,afterReset:w.agents.get('A').task.token,physicalTime:w.time};
});

test('window cancellation and host routing reject an old task token',()=>{
  const w=make();assert(w.window.request('A','open'));const first=w.window.agents.get('A').task.token;
  assert(w.cancel('A',{expectedTaskToken:first}));assert(w.window.request('A','close'));
  const second=w.window.agents.get('A').task.token,before=w.snapshot();
  assert.notEqual(first,second);assert.equal(w.window.cancel('A',{expectedTaskToken:first}),false);
  assert.equal(w.cancel('A',{expectedTaskToken:first}),false);assert.deepEqual(w.snapshot(),before);
  assert(w.cancel('A',{expectedTaskToken:second}));assert.equal(w.window.agents.get('A').result.taskToken,second);
  return{first,second,physicalTime:w.time};
});

test('an old bottle cancel cannot cross into a new window task for the same actor',()=>{
  const w=make();w.request('A');const bottle=w.agents.get('A').task.token;w.cancel('A');
  w.window.request('A','open');const before=w.snapshot();
  assert.equal(w.cancel('A',{expectedTaskToken:bottle}),false);assert.deepEqual(w.snapshot(),before);
  return{staleBottleToken:bottle,activeWindowToken:w.window.agents.get('A').task.token};
});

test('physical completion and review record the same placement task and revisions',()=>{
  const w=finishPlan(),a=w.agents.get('A'),b=w.agents.get('B'),s=w.snapshot();
  assert.equal(a.result.result,'completed');assert.equal(b.result.result,'already-sorted');
  assert.equal(s.review.dependencies.taskToken,a.result.taskToken);
  assert.equal(s.review.dependencies.targetRevision,w.targetRevision);assert.equal(s.review.dependencies.supportRevision,w.supportRevision);
  assert.equal(a.result.dependencies.taskToken,a.result.taskToken);
  assert(s.audit.contacts.some(e=>e.taskToken===a.result.taskToken));
  assert(s.events.some(e=>e.type==='release'&&e.taskToken===a.result.taskToken));
  assert(s.events.some(e=>e.type==='hand-at-rest'&&e.taskToken===a.result.taskToken));
  const before=w.snapshot();s.agents[0].result.dependencies.targetRevision=999;s.review.dependencies.taskToken='tampered';
  assert.deepEqual(w.snapshot(),before);
  return{placementTaskToken:a.result.taskToken,reviewDependencies:w.review.dependencies,goal:w.goal()};
});

test('moving a target invalidates a completed review synchronously without a physics tick',()=>{
  const w=finishPlan(),before=w.snapshot(),time=w.time,steps=w.audit.physicsSteps;
  w.moveTarget();const after=w.snapshot();
  assert.equal(w.time,time);assert.equal(w.audit.physicsSteps,steps);assert.equal(after.review.checked,false);assert.equal(after.review.stable,0);
  assert.equal(after.targetRevision,before.targetRevision+1);assert.equal(after.review.dependencies,null);
  assert.deepEqual(after.review.invalidatedDependencies,before.review.dependencies);
  const event=after.events.findLast(e=>e.type==='review-invalidated');
  assert.equal(event.dependencies.targetRevision,after.targetRevision);assert.equal(event.previousDependencies.taskToken,before.review.dependencies.taskToken);
  assert.deepEqual(after.agents[0].result,before.agents[0].result,'Historical receipt remains historical');
  return{paused:true,time,targetRevision:after.targetRevision,review:after.review};
});

test('removing support invalidates a completed review synchronously and requires fresh stability',()=>{
  const w=finishPlan(),before=w.snapshot(),time=w.time,steps=w.audit.physicsSteps;
  w.setSupport(false);const after=w.snapshot();
  assert.equal(w.time,time);assert.equal(w.audit.physicsSteps,steps);assert.equal(after.review.checked,false);assert.equal(after.review.stable,0);
  assert.equal(after.supportRevision,before.supportRevision+1);assert.equal(after.object.supported,false);
  const event=after.events.findLast(e=>e.type==='review-invalidated');assert.equal(event.dependencies.supportRevision,after.supportRevision);
  w.setSupport(true);assert.equal(w.review.checked,false);w.tick(dt);assert.equal(w.review.checked,false);
  runUntil(w,()=>w.review.checked,3);assert.equal(w.review.dependencies.supportRevision,before.supportRevision+2);
  return{pausedCommandTime:time,reconfirmedTime:w.time,supportRevision:w.supportRevision};
});

const sourceHashes=hashes(),sourceUnchangedDuringTest=JSON.stringify(sourceHashes)===JSON.stringify(sourceAtStart);
const report={schema:'kaopu/state-boundary-qa@1',createdAt:new Date().toISOString(),fixtureOnly:true,
  scope:'Production data boundaries and command-token causality with motion fixtures; no native/GPU/browser/public claim',
  sourceAtStart,sourceHashes,sourceUnchangedDuringTest,tests,counts:{passed:tests.filter(t=>t.pass).length,total:tests.length},
  passed:sourceUnchangedDuringTest&&tests.every(t=>t.pass)};
writeFileSync(new URL('./state-boundary-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
