import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {create,update,setManual,setAutomatic,reset,snapshot,VERSION} from '../src/motion-cycle-r05.js';
const B=createRequire(import.meta.url)('../src/behavior.js');
const rows=[],failures=[];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex');
const check=(label,fn)=>{try{rows.push({label,pass:true,...fn()});console.log('PASS '+label);}catch(e){rows.push({label,pass:false,error:e.message});failures.push({label,error:e.message});console.log('FAIL '+label+': '+e.message);}};
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} ~= ${b}`);
const phaseDelta=(next,prior)=>(next-prior+Math.PI*2)%(Math.PI*2);
const active={playing:true,visible:true,loaded:true};
check('Default automatically visits four modes at exact active-time boundaries',()=>{
  const c=create();assert.equal(c.automatic,true);assert.equal(c.mode,'cruise');
  const visited=[c.mode];for(const [seconds,expected] of [[12,'hover'],[8,'burst'],[5,'turn'],[9,'cruise']]){
    const r=update(c,seconds,active);assert.equal(r.mode,expected);assert.equal(r.changed,true);assert.equal(r.elapsed,0);visited.push(r.mode);
  }assert.equal(c.transitionCount,4);assert.equal(c.activeTime,34);return {visited,durations:snapshot(c).durations};
});
check('Pause, hidden and unready frames accumulate no time or transition debt',()=>{
  const c=create();update(c,11.5,active);const initial=snapshot(c);
  for(const input of [{playing:false},{visible:false},{loaded:false},{playing:false,visible:false,loaded:false}]){
    for(let i=0;i<100;i++){assert.equal(update(c,100,input).changed,false);assert.deepEqual(snapshot(c),initial);}
  }update(c,.5,active);assert.equal(c.mode,'hover');assert.equal(c.elapsed,0);return {gatedCalls:400,resumeConsumesOnlyNewDelta:true};
});
check('Manual selection suspends automatic mode and auto resumes current dwell',()=>{
  const c=create();update(c,7);setManual(c,'burst');const held=snapshot(c);
  for(let i=0;i<120;i++)update(c,.1,active);assert.deepEqual(snapshot(c),held);
  assert.equal(setAutomatic(c,true).mode,'burst');assert.equal(c.elapsed,0);
  update(c,4.9);assert.equal(c.mode,'burst');near(c.elapsed,4.9);update(c,.1);assert.equal(c.mode,'turn');
  update(c,2);setAutomatic(c,false);const stopped=snapshot(c);update(c,90);assert.deepEqual(snapshot(c),stopped);
  setAutomatic(c,true);update(c,7);assert.equal(c.mode,'cruise');return {manualHoldExact:true,autoResumeWithoutImmediateModeJump:true};
});
check('Manual REST remains supported without inserting REST into default rolling loop',()=>{
  const c=create();setManual(c,'rest');assert.equal(c.automatic,false);setAutomatic(c,true);assert.equal(c.mode,'rest');
  update(c,2.5);assert.equal(c.mode,'rest');update(c,.5);assert.equal(c.mode,'cruise');assert.equal(c.elapsed,0);
  assert.ok(!c.order.includes('rest'));const optional=create({includeRest:true});update(optional,34);assert.equal(optional.mode,'rest');update(optional,3);assert.equal(optional.mode,'cruise');return {manualRestDwell:3,optionalCycleDuration:37};
});
check('Scheduler reset restores only its own deterministic initial state',()=>{
  const c=create({initialMode:'turn',automatic:false,includeRest:true,durations:{turn:4}}),initial=snapshot(c);
  setAutomatic(c,true);update(c,17);setManual(c,'rest');reset(c);assert.deepEqual(snapshot(c),initial);return {initialMode:'turn',initialAutomatic:false};
});
check('Fixed, irregular and one-shot simulation deltas give equivalent cycle positions',()=>{
  let maxTimeError=0;for(const options of [{},{includeRest:true},{initialMode:'burst'},{initialMode:'rest'},{durations:{cruise:3.2,hover:1.1,burst:.7,turn:2.3}}]){
    const a=create(options),b=create(options),c=create(options),total=237.625;
    for(let t=0;t<total-1e-10;){const dt=Math.min(1/60,total-t);update(a,dt);t+=dt;}
    for(let t=0,i=0;t<total-1e-10;i++){const dt=Math.min([1/24,1/120,.1,1/73][i%4],total-t);update(b,dt);t+=dt;}
    update(c,total);for(const q of [a,b]){assert.equal(q.mode,c.mode);assert.equal(q.transitionCount,c.transitionCount);near(q.elapsed,c.elapsed,1e-8);near(q.activeTime,c.activeTime,1e-8);maxTimeError=Math.max(maxTimeError,Math.abs(q.elapsed-c.elapsed));}
  }return {cases:5,secondsPerCase:237.625,maxElapsedError:maxTimeError};
});
check('Large accepted simulation delta is retained with bounded arithmetic work',()=>{
  const c=create(),seconds=34*100000000+17.25,start=performance.now(),r=update(c,seconds),cost=performance.now()-start;
  assert.equal(r.mode,'hover');assert.equal(r.transitionCount,400000001);assert.equal(r.elapsed,5.25);assert.equal(c.activeTime,seconds);
  assert.ok(cost<20,'no per-cycle loop');return {seconds,transitions:r.transitionCount,elapsed:r.elapsed,costMilliseconds:cost};
});
check('Invalid deltas and malformed mode/dwell cannot silently change controller state',()=>{
  const c=create(),initial=snapshot(c);for(const dt of [0,-1,NaN,Infinity,undefined]){assert.equal(update(c,dt).changed,false);assert.deepEqual(snapshot(c),initial);}
  assert.throws(()=>setManual(c,'invalid'));assert.deepEqual(snapshot(c),initial);assert.throws(()=>create({initialMode:'invalid'}));
  for(const value of [0,-1,Infinity,NaN])assert.throws(()=>create({durations:{burst:value}}));return {invalidDeltaNoOp:true,configurationFailsClosed:true};
});
check('Scheduling does not touch the continuous solver, actor identities or independent clocks',()=>{
  const cases=[];for(const id of Object.keys(B.profiles)){
    const c=create(),a=B.create(id,1,52),b=B.create(id,1,52),actor=a.actors[0],originalClock=actor.beatPhase;let maxPhaseStep=0,maxYawStep=0,priorPhase=originalClock,priorYaw=actor.yaw;
    for(let frame=0;frame<4080;frame++){
      const mode=update(c,1/60,active).mode;
      // Independent manual oracle at exact 12/20/25/34 second boundaries.
      const time=(frame+1)/60,cycle=time%34,expected=cycle<12?'cruise':cycle<20?'hover':cycle<25?'burst':'turn';
      assert.equal(mode,expected);B.update(a,1/60,{mode,centered:true});B.update(b,1/60,{mode:expected,centered:true});
      assert.equal(a.actors[0],actor);maxPhaseStep=Math.max(maxPhaseStep,phaseDelta(actor.beatPhase,priorPhase));
      maxYawStep=Math.max(maxYawStep,Math.abs(Math.atan2(Math.sin(actor.yaw-priorYaw),Math.cos(actor.yaw-priorYaw))));priorPhase=actor.beatPhase;priorYaw=actor.yaw;
    }
    assert.deepEqual(B.snapshot(a),B.snapshot(b));assert.notEqual(actor.beatPhase,originalClock);assert.ok(maxPhaseStep<1,'wrapped phase never resets or snaps');assert.ok(maxYawStep<=B.profiles[id].maxTurn/60+1e-9);
    cases.push({id,seconds:68,maxPhaseStep,maxYawStep,actorObjectPreserved:true,manualOracleStateExact:true});
  }return {cases};
});
for(const id of Object.keys(B.profiles))check(id+' 30-member rolling school retains strict contact and independent gait under variable delta',()=>{
  const c=create(),s=B.create(id,30,73),identities=[...s.actors],p=B.profiles[id];let time=0,frame=0,minClearance=Infinity,maxTurn=0,maxCorrectionRate=0,maxPhaseStep=0;
  while(time<68-1e-10){const dt=Math.min([1/60,1/30,1/90,1/48][frame%4],68-time),mode=update(c,dt,active).mode,phases=s.actors.map(a=>a.beatPhase);
    B.update(s,dt,{mode,pointer:time>21&&time<23?[0,0,0]:null});time+=dt;frame++;
    minClearance=Math.min(minClearance,s.contact.minimumClearance+s.shape.gap);maxCorrectionRate=Math.max(maxCorrectionRate,s.contact.maxCorrection/Math.min(dt,1/60));
    for(let i=0;i<30;i++){const a=s.actors[i];assert.equal(a,identities[i]);maxTurn=Math.max(maxTurn,Math.abs(a.turnRate));maxPhaseStep=Math.max(maxPhaseStep,phaseDelta(a.beatPhase,phases[i]));assert.ok([a.beatPhase,a.amplitude,a.frequency,a.speed,...a.position,...a.velocity,a.yaw,a.pitch,a.roll].every(Number.isFinite));}
  }
  assert.ok(minClearance>=s.shape.gap*.5,'strict source-enclosing boxes remain separated');assert.ok(maxCorrectionRate<=3.5+1e-8,'existing bounded positional correction gate');assert.ok(maxTurn<=p.maxTurn+1e-9);
  const independentPhases=new Set(s.actors.map(a=>a.beatPhase.toFixed(4))).size;assert.ok(independentPhases>20);assert.ok(maxPhaseStep<1);
  return {seconds:time,count:30,frames:frame,minSourceBoxClearance:minClearance,strictGate:s.shape.gap*.5,maxCorrectionRate,maxTurn,maxPhaseStep,independentPhases};
});
check('Scheduler overhead is bounded independently of fish count',()=>{
  const c=create(),n=200000,start=performance.now();for(let i=0;i<n;i++)update(c,1/60,active);const ms=performance.now()-start;
  assert.ok(ms/n<.01);return {calls:n,totalMilliseconds:ms,meanMicroseconds:ms*1000/n,scope:'Node CPU scheduler only; no browser FPS claim'};
});
const anchorFile=new URL('../TASK_ANCHOR_R05.json',import.meta.url),anchor=fs.existsSync(anchorFile)?JSON.parse(fs.readFileSync(anchorFile)):{taskId:'FISH_SCOREMAKER_EYE_FIT_AUTOCYCLE_R05_20261002',baseSha:'5263229e1ec5a04d6541b69f99f79e74e5fa1ba7'};
const report={schema:'fish.motion-cycle-r05/1',taskId:anchor.taskId,baseSha:anchor.baseSha,dispatchTime:anchor.dispatchTime,verifiedAt:new Date().toISOString(),version:VERSION,controllerSha256:sha('../src/motion-cycle-r05.js'),behaviorSha256:sha('../src/behavior.js'),pass:!failures.length,tests:rows,failures,defaultOrder:['cruise','hover','burst','turn'],modeDurationsMeaning:'Engineering demonstration dwell times; not species observations',scope:'Pure simulation-clock scheduling plus existing five-source locomotion/contact CPU integration. Legacy integration, visible transitions and standalone/public acceptance belong to the root verifier.',visualAcceptance:false,productionReady:false};
fs.mkdirSync(new URL('../evidence/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../evidence/R05_MOTION_CYCLE_REPORT.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,tests:rows.length,failures},null,2));if(failures.length)process.exitCode=1;
