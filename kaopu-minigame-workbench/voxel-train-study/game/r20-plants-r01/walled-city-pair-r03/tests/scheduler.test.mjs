import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {CooperativeScheduler,immutableSnapshot,planCandidateBatches,candidateRoundWindows,CANDIDATE_STAGE_GROUPS,COUNTER_INTERVAL_ROUNDS} from '../runtime/scheduler.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('mock scheduler did not reach expected checkpoint');}
const create=options=>new CooperativeScheduler({yieldControl:tick,...options});
const world=()=>({view:'overall',camera:{eye:[-40,25,-56]},worldId:'fixed-world',snapshotId:'fixed-snapshot',hostSeconds:43200,year:1981,rect:[0,0,16,16]});

test('snapshot is cloned and deeply immutable before any work starts',async()=>{
 const s=create();s.pause();const input=world(),job=s.enqueue(input,ctx=>ctx.snapshot);input.camera.eye[0]=999;input.rect[2]=99;
 assert.equal(job.snapshot.camera.eye[0],-40);assert.equal(job.snapshot.rect[2],16);assert.throws(()=>{job.snapshot.camera.eye[0]=0;},TypeError);
 assert.deepEqual(immutableSnapshot({a:[1,{b:2}]}),{a:[1,{b:2}]});s.resume();const result=await job.done;assert.equal(result.status,'completed');assert.strictEqual(result.value,job.snapshot);assert.ok(Object.isFrozen(result));
});

test('pause drains only the in-flight stage, preserves context, resumes exact next stage',async()=>{
 const gpu=deferred(),events=[],s=create();let persistent={candidate:0};
 const job=s.enqueue(world(),async ctx=>{ctx.deferCleanup(()=>events.push('cleanup'));await ctx.submit('geo0',async()=>{events.push('geo0');await gpu.promise;persistent.candidate=7;});await ctx.submit('query',async()=>{events.push('query');assert.equal(persistent.candidate,7);});return ctx.snapshot;});
 await until(()=>s.state.active?.inFlight);s.pause();s.pause();assert.equal(s.state.active.pendingStage.label,'geo0');gpu.resolve();await until(()=>s.state.active?.status==='paused');
 const paused=s.state;assert.equal(paused.active.inFlight,false);assert.equal(paused.active.submissionCount,1);assert.equal(paused.active.completionCount,1);assert.equal(persistent.candidate,7);
 await tick();await tick();assert.deepEqual(s.state.active.snapshot,paused.active.snapshot);assert.equal(s.state.active.submissionCount,1);assert.deepEqual(events,['geo0']);
 s.resume();s.resume();const result=await job.done;assert.equal(result.status,'completed');assert.deepEqual(events,['geo0','query','cleanup']);assert.equal(result.metrics.submissionCount,2);assert.equal(s.state.active,null);
});

test('cancel during GPU work waits for actual completion and cleans up exactly once',async()=>{
 const gpu=deferred(),events=[],s=create();
 const job=s.enqueue(world(),async ctx=>{ctx.deferCleanup(()=>events.push('target.destroy'));await ctx.submit('material',async()=>{events.push('material');await gpu.promise;events.push('gpu.complete');});await ctx.submit('present',async()=>events.push('BAD present'));});
 await until(()=>s.state.active?.inFlight);job.cancel();job.cancel();s.pause();assert.deepEqual(events,['material']);assert.equal(s.state.active.inFlight,true);gpu.resolve();const result=await job.done;
 assert.equal(result.status,'cancelled');assert.equal(result.reason,'host-cancel');assert.equal(result.metrics.completionCount,1);assert.deepEqual(events,['material','gpu.complete','target.destroy']);assert.equal(s.state.active,null);
});

test('newest camera epoch replaces active and queued jobs without stale presentation or shared-arena overlap',async()=>{
 const gpu=deferred(),events=[],s=create();let owner=null;
 const old=s.enqueue({...world(),view:'pair-cut'},async ctx=>{owner=ctx.epoch;ctx.deferCleanup(()=>{events.push('old-cleanup');owner=null;});await ctx.submit('geo6',async()=>{events.push('old-stage');await gpu.promise;});await ctx.submit('present',async()=>events.push('BAD old-present'));});
 await until(()=>s.state.active?.inFlight);
 const middle=s.enqueue({...world(),view:'borrow'},async()=>events.push('BAD middle-run'));
 const latest=s.enqueue(world(),async ctx=>{assert.equal(owner,null);owner=ctx.epoch;ctx.deferCleanup(()=>{events.push('new-cleanup');owner=null;});await ctx.submit('init',async()=>events.push('new-stage'));await ctx.submit('present',async()=>{assert.equal(ctx.isCurrent(),true);events.push('present-'+ctx.epoch);});return 'latest';});
 assert.ok(latest.epoch>middle.epoch&&middle.epoch>old.epoch);assert.equal((await middle.done).reason,'superseded');await tick();assert.deepEqual(events,['old-stage']);gpu.resolve();
 assert.equal((await old.done).reason,'superseded');const result=await latest.done;assert.equal(result.status,'completed');assert.equal(result.value,'latest');assert.deepEqual(events,['old-stage','old-cleanup','new-stage','present-'+latest.epoch,'new-cleanup']);assert.equal(owner,null);
});

test('finite diagnostic limit cannot submit an extra stage and reports soft-budget overruns honestly',async()=>{
 let time=0;const events=[],s=create({now:()=>time});
 const job=s.enqueue(world(),async ctx=>{ctx.deferCleanup(()=>events.push('cleanup'));for(let i=0;i<5;i++)await ctx.submit('geo0',async()=>{events.push(i);time+=i===0?30:8;});},{maxSubmissions:2,targetSubmissionMs:12});
 const result=await job.done;assert.equal(result.status,'cancelled');assert.equal(result.reason,'submission-limit');assert.deepEqual(events,[0,1,'cleanup']);assert.equal(result.metrics.submissionCount,2);assert.equal(result.metrics.completionCount,2);assert.equal(result.metrics.maximumSubmissionCompletionMs,30);assert.equal(result.metrics.maximumOverBudgetMs,18);assert.equal(result.metrics.overBudgetSubmissions,1);assert.equal(result.metrics.lastCompletion.completionMs,8);assert.equal(result.metrics.stageTotals.geo0.totalCompletionMs,38);
});

test('cancel paused/queued work and repeated controls leave no cleanup or waiter leak',async()=>{
 const s=create(),events=[];s.pause();const first=s.enqueue(world(),async()=>events.push('BAD paused execution'));await until(()=>s.state.active?.status==='paused');s.cancel();s.cancel();assert.equal((await first.done).status,'cancelled');
 const pending=s.enqueue(world(),async()=>events.push('BAD queued execution'));pending.cancel('queued-cancel');assert.equal((await pending.done).reason,'queued-cancel');s.resume();s.resume();
 for(let i=0;i<3;i++){const job=s.enqueue(world(),async ctx=>{ctx.deferCleanup(()=>events.push('cleanup-'+i));await ctx.submit('stage',async()=>events.push('stage-'+i));});assert.equal((await job.done).status,'completed');}
 assert.deepEqual(events,['stage-0','cleanup-0','stage-1','cleanup-1','stage-2','cleanup-2']);s.dispose();s.dispose();assert.equal(s.state.disposed,true);assert.throws(()=>s.enqueue(world(),()=>{}),/disposed/);
});

test('completion failure releases resources in reverse order before newer work starts',async()=>{
 const s=create(),events=[];
 const failed=s.enqueue(world(),async ctx=>{ctx.deferCleanup(()=>events.push('color'));ctx.deferCleanup(()=>events.push('depth'));await ctx.submit('gpu',async()=>{throw Error('device lost');});});
 const result=await failed.done;assert.equal(result.status,'failed');assert.equal(result.error.message,'device lost');assert.deepEqual(events,['depth','color']);assert.equal(result.metrics.inFlight,false);
 const next=s.enqueue(world(),async ctx=>ctx.submit('next',async()=>events.push('next')));assert.equal((await next.done).status,'completed');assert.deepEqual(events,['depth','color','next']);
});

test('paused callback can synchronously resume without losing the wake',async()=>{
 let s;let resumed=false;s=create({onState:state=>{if(state.active?.status==='paused'&&!resumed){resumed=true;s.resume();}}});s.pause();const job=s.enqueue(world(),ctx=>ctx.submit('stage',async()=>1));assert.equal((await job.done).status,'completed');assert.equal(resumed,true);
});

test('runtime wiring keeps bounded-batch completions, frozen time, isolated targets and a guarded final presentation',()=>{
 const code=fs.readFileSync(new URL('../runtime/app.mjs',import.meta.url),'utf8');
 assert.match(code,/import \{CooperativeScheduler,planCandidateBatches/);assert.doesNotMatch(code,/requestAnimationFrame|setInterval|if\(busy\)/);
 assert.match(code,/hostSeconds:12\*3600/);assert.match(code,/for\(const batch of batchPlan\)await computeBatch/);assert.match(code,/candidateRoundWindows\(maxIterations\)/);assert.match(code,/for\(const name of batch.stages\)dispatchCompute/);
 assert.match(code,/await device\.queue\.onSubmittedWorkDone\(\)/);assert.match(code,/job\.deferCleanup\(\(\)=>color\.destroy\(\)\)/);assert.match(code,/job\.deferCleanup\(\(\)=>depth\.destroy\(\)\)/);
 assert.match(code,/if\(!job\.isCurrent\(\)\)throw Error\('stale presentation blocked'\)/);assert.equal((code.match(/copyTextureToTexture/g)||[]).length,1);assert.match(code,/state:\(\)=>scheduler\.state/);
});

// CPU-only integration of the actual host state callback; no browser or GPU.
test('successful latest frame keeps its completed UI state after an older cancellation',()=>{
 const code=fs.readFileSync(new URL('../runtime/app.mjs',import.meta.url),'utf8'),callbackSource=code.slice(code.indexOf("let schedulerUIKey=''"),code.indexOf('proof.limits.scheduler='));
 const proof={ready:true,status:'rendered-for-review',presentedEpoch:2},status={textContent:'complete'},previous={status:'cancelled'};let notify;
 vm.runInNewContext(callbackSource,{CooperativeScheduler:class{constructor(options){notify=options.onState;}},proof,status,controlsEnabled:true,updateControls:()=>{}});
 notify({active:{epoch:2,status:'cleaning',snapshot:{view:'overall'}},pending:null,paused:false,lastResult:previous});assert.equal(proof.status,'rendered-for-review');assert.equal(status.textContent,'complete');
 notify({active:null,pending:null,paused:false,lastResult:{status:'completed'}});assert.equal(proof.status,'rendered-for-review');assert.equal(proof.rendering,false);assert.equal(proof.ready,true);
});

test('stage progress remains queryable without repeating DOM updates',()=>{
 const code=fs.readFileSync(new URL('../runtime/app.mjs',import.meta.url),'utf8'),callbackSource=code.slice(code.indexOf("let schedulerUIKey=''"),code.indexOf('proof.limits.scheduler='));
 const proof={},status={textContent:''};let notify,updates=0;
 vm.runInNewContext(callbackSource,{CooperativeScheduler:class{constructor(options){notify=options.onState;}},proof,status,controlsEnabled:true,updateControls:()=>updates++});
 const state={epoch:1,active:{id:1,epoch:1,status:'running',snapshot:{view:'overall'},submissionCount:1},pending:null,paused:false,lastResult:null};notify(state);
 for(let i=2;i<=100;i++)notify({...state,active:{...state.active,submissionCount:i}});
 assert.equal(updates,1);assert.equal(proof.scheduler.active.submissionCount,100);
 notify({...state,paused:true,active:{...state.active,status:'paused'}});assert.equal(updates,2);assert.equal(proof.status,'paused');
 assert.match(code,/maxSubmissions:options.maxSubmissions\?\?2000000/);
});


test('measured light-stage grouping preserves order and respects soft prediction and hard four-stage cap',()=>{
 const expected=['geo0','geo1','geo2','geo3','geo4','geo5','geo6','query','material'],defaults=planCandidateBatches();
 assert.deepEqual(defaults.map(batch=>batch.stages),CANDIDATE_STAGE_GROUPS);assert.deepEqual(defaults.flatMap(batch=>batch.stages),expected);
 assert.ok(Math.abs(defaults[0].predictedCompletionMs-10.35)<1e-8);assert.ok(Math.abs(defaults[1].predictedCompletionMs-5.19)<1e-8);assert.ok(Math.abs(defaults[2].predictedCompletionMs-9.24)<1e-8);
 for(const targetSubmissionMs of [1,6,12,100])for(const maxStagesPerSubmission of [1,2,3,4]){
  const batches=planCandidateBatches({targetSubmissionMs,maxStagesPerSubmission});assert.deepEqual(batches.flatMap(batch=>batch.stages),expected);
  for(const batch of batches){assert.ok(batch.stages.length<=maxStagesPerSubmission);assert.ok(batch.predictedCompletionMs<=targetSubmissionMs||batch.stages.length===1);if(batch.stages.includes('geo4'))assert.deepEqual(batch.stages,['geo4']);}
 }
 assert.throws(()=>planCandidateBatches({maxStagesPerSubmission:5}),/1 to 4/);assert.throws(()=>planCandidateBatches({targetSubmissionMs:0}),/positive/);
});

test('counter windows contain complete unchanged rounds and at most fifteen inactive tail rounds',()=>{
 assert.equal(COUNTER_INTERVAL_ROUNDS,16);assert.deepEqual([...candidateRoundWindows(34)],[{offset:0,count:16},{offset:16,count:16},{offset:32,count:2}]);
 const originalRound=CANDIDATE_STAGE_GROUPS.flat(),plan=planCandidateBatches();
 for(const activeRounds of [1,15,16,17,31,32,33,34]){
  let completedRounds=0,activeMutations=0,polls=0;const dispatched=[];
  for(const window of candidateRoundWindows(34)){
   for(let i=0;i<window.count;i++){
    for(const batch of plan)for(const stage of batch.stages){dispatched.push(stage);if(completedRounds<activeRounds)activeMutations++;}
    completedRounds++;
   }
   polls++;if(completedRounds>=activeRounds)break;
  }
  assert.equal(activeMutations,activeRounds*9);assert.ok(completedRounds-activeRounds>=0&&completedRounds-activeRounds<=15);assert.equal(polls,Math.ceil(activeRounds/16));
  assert.deepEqual(dispatched,Array.from({length:completedRounds},()=>originalRound).flat());
 }
 const cap=4096*32+32,windows=[...candidateRoundWindows(cap)];assert.equal(windows.reduce((sum,window)=>sum+window.count,0),cap);assert.equal(windows.length,cap/16);
});

test('pause and cancel are honored between bounded GPU groups without partial-round reinitialization',async()=>{
 const firstGPU=deferred(),secondGPU=deferred(),events=[],s=create(),plan=planCandidateBatches();let persistentStage=0;
 const job=s.enqueue(world(),async ctx=>{ctx.deferCleanup(()=>events.push('cleanup'));for(let i=0;i<plan.length;i++){const batch=plan[i];await ctx.submit(batch.label,async()=>{events.push(batch.label);await (i===0?firstGPU.promise:i===1?secondGPU.promise:Promise.resolve());persistentStage+=batch.stages.length;},{stages:batch.stages});}events.push('BAD completed round');});
 await until(()=>s.state.active?.inFlight);s.pause();firstGPU.resolve();await until(()=>s.state.active?.status==='paused');
 assert.equal(persistentStage,4);assert.equal(s.state.active.submissionCount,1);assert.equal(s.state.active.submittedStageCount,4);const frozen=s.state.active.snapshot;await tick();assert.deepEqual(events,['geo0+geo1+geo2+geo3']);
 s.resume();await until(()=>s.state.active?.pendingStage?.label==='geo4');job.cancel();assert.equal(persistentStage,4);secondGPU.resolve();const outcome=await job.done;
 assert.equal(outcome.status,'cancelled');assert.equal(persistentStage,5);assert.deepEqual(outcome.snapshot,frozen);assert.deepEqual(events,['geo0+geo1+geo2+geo3','geo4','cleanup']);assert.equal(outcome.metrics.maximumStagesPerSubmissionObserved,4);
});

test('scheduler enforces declared group cap before operation and records actual group overruns',async()=>{
 let time=0;const s=create({now:()=>time}),events=[];
 const invalid=s.enqueue(world(),ctx=>ctx.submit('oversized',async()=>events.push('BAD operation'),{stages:['a','b','c','d','e']}));
 const bad=await invalid.done;assert.equal(bad.status,'failed');assert.match(bad.error.message,/maxStagesPerSubmission/);assert.equal(bad.metrics.submissionCount,0);assert.deepEqual(events,[]);
 const batch=planCandidateBatches()[0],job=s.enqueue(world(),ctx=>ctx.submit(batch.label,async()=>{time+=19;},{stages:batch.stages,predictedCompletionMs:batch.predictedCompletionMs}));
 const outcome=await job.done,group=outcome.metrics.stageTotals[batch.label];assert.equal(outcome.status,'completed');assert.equal(outcome.metrics.submittedStageCount,4);assert.equal(group.maximumCompletionMs,19);assert.equal(group.maximumOverBudgetMs,7);assert.equal(group.overBudgetSubmissions,1);assert.deepEqual(group.stages,batch.stages);assert.equal(outcome.metrics.lastCompletion.predictedCompletionMs,batch.predictedCompletionMs);
 assert.throws(()=>s.enqueue(world(),()=>{},{maxStagesPerSubmission:5}),/1 to 4/);
});

test('actual host batch encoding retains nine separate compute passes and only three queue completions',async()=>{
 const code=fs.readFileSync(new URL('../runtime/app.mjs',import.meta.url),'utf8'),source=code.slice(code.indexOf('function dispatchCompute('),code.indexOf('async function readBuffer('));
 const submitted=[],completed=[],metadata=[],pipelines=Object.fromEntries(CANDIDATE_STAGE_GROUPS.flat().map(name=>[name,name]));
 const device={createCommandEncoder:()=>{const passes=[];return {beginComputePass:()=>({setPipeline:name=>passes.push(name),setBindGroup:()=>{},dispatchWorkgroups:()=>{},end:()=>{}}),finish:()=>passes};},queue:{submit:commands=>submitted.push(commands[0]),onSubmittedWorkDone:async()=>completed.push(true)}};
 const context={device,pipelines,bind:{}};vm.createContext(context);vm.runInContext(source,context);
 const job={submit:async(label,operation,meta)=>{metadata.push({label,...meta});return operation();}};
 for(const batch of planCandidateBatches())await context.computeBatch(job,batch,4,{phase:'primary',iteration:0});
 assert.deepEqual(submitted,CANDIDATE_STAGE_GROUPS);assert.equal(completed.length,3);assert.deepEqual(submitted.flat(),CANDIDATE_STAGE_GROUPS.flat());assert.deepEqual(metadata.map(m=>m.stages.length),[4,1,4]);
});
