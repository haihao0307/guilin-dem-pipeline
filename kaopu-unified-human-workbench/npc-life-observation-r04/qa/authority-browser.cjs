'use strict';
/**
 * R04 independent browser acceptance helpers. These are called from the
 * existing isolated Playwright verifier, not from the user's browser.
 * Existing native actions provide the physical setup; no synthetic actor,
 * task shortcut, accelerated completion, or altered physical tolerance is used.
 */
const assert=require('node:assert/strict');

const putIf=(put,name,value)=>{if(put)put(name,value);return value;};
const STATE_EXPORT_MAX_BYTES=1024*1024;

async function pausedReviewInvalidation({page,evaluate,waitFor,put,frameMS=60000}) {
  const before=await evaluate('R04 read paused valid identity review',async()=>{
    const app=window.__NPC_OBSERVATION__;
    await app.awaitFrame({fresh:true});
    const s=app.snapshot();
    return {time:s.time,physicsSteps:s.audit.physicsSteps,target:s.target,targetRevision:s.targetRevision,
      review:s.review,authority:app.authority(),render:app.renderStatus(),
      paused:/继续/.test(document.querySelector('#npc-pause').textContent)};
  },undefined,frameMS);
  assert.equal(before.paused,true,'Identity review setup remains paused');
  assert.equal(before.review.checked,true,'The existing actual identity task supplied a valid review');
  assert.equal(before.authority.pendingCount,0,'Prior mutations completed before the invalidation check');
  assert.equal(before.render.inFlight,0,'The baseline comes from an actual completed GPU frame');
  await page.click('#npc-target');
  await waitFor('R04 target change applies without resuming physics',()=>{
    const app=window.__NPC_OBSERVATION__,a=app.authority();
    return app.errors.length||a.pendingCount===0&&a.lastReceipt?.type==='move-target'&&a.lastReceipt.status!=='queued';
  },undefined,{timeout:frameMS,polling:50});
  const after=await evaluate('R04 inspect immediate paused review invalidation',()=>{
    const app=window.__NPC_OBSERVATION__,s=app.snapshot();
    return {time:s.time,physicsSteps:s.audit.physicsSteps,target:s.target,targetRevision:s.targetRevision,
      review:s.review,object:s.object,events:s.events,authority:app.authority(),
      paused:/继续/.test(document.querySelector('#npc-pause').textContent),visibleReview:document.querySelector('#npc-agents').textContent};
  });
  assert.equal(after.paused,true,'Changing the environment must not silently resume observation');
  assert.equal(after.time,before.time,'Invalidating a stale result requires no simulated time advance');
  assert.equal(after.physicsSteps,before.physicsSteps,'No physics tick is used to revoke obsolete review evidence');
  assert.equal(after.authority.lastReceipt.status,'applied');
  assert.equal(after.authority.lastReceipt.type,'move-target');
  assert.equal(after.targetRevision,before.targetRevision+1);
  assert.notDeepEqual(after.target,before.target);
  assert.equal(after.review.checked,false,'A moved target immediately revokes the current review');
  assert.equal(after.object.insideTarget,false,'The previously placed object is outside the changed target');
  assert(after.events.some(e=>e.type==='review-invalidated'&&e.actor==='C'),'The real reviewer recorded invalidation');
  assert.match(after.visibleReview,/需重新复核/,'The visible review agrees with the changed world while paused');
  const receipt=after.authority.lastReceipt;
  assert.equal(receipt.detail.physicsStepsBefore,before.physicsSteps);
  assert.equal(receipt.detail.physicsStepsAfter,before.physicsSteps);
  return putIf(put,'authority-paused-review.json',{actualUI:true,physicsAdvanced:false,before,after});
}

async function snapshotIsolation({evaluate,put,label='window-contact'}) {
  const result=await evaluate('R04 returned snapshot cannot mutate the active native task',()=>{
    const app=window.__NPC_OBSERVATION__;
    if(!/继续/.test(document.querySelector('#npc-pause').textContent))throw Error('Snapshot isolation requires the existing paused contact');
    const read=app.snapshot(),actor=read.window.agents.find(a=>a.id==='A');
    if(!actor?.task||actor.task.operation!=='open')throw Error('The existing real window-open task must still be active');
    // Compare the exact fields whose references were writable in R03. Read
    // twice in one synchronous turn, so simulation and commands cannot advance.
    const project=s=>({time:s.time,object:s.object,target:s.target,targetRevision:s.targetRevision,
      agents:s.agents,review:s.review,audit:s.audit,events:s.events,window:s.window,constraints:s.constraints});
    const before=JSON.stringify(project(app.snapshot()));
    const sourceTask={token:actor.task.token,operation:actor.task.operation,targetAngleRad:actor.task.targetAngleRad};
    const attempts=[];
    const attempt=(name,fn)=>{let rejected=false;try{fn();}catch{rejected=true;}attempts.push({name,writeRejected:rejected});};
    attempt('window task target',()=>{actor.task.targetAngleRad=0;});
    attempt('review verdict',()=>{read.review.checked=!read.review.checked;});
    attempt('bottle audit',()=>{read.audit.tasks.push({testSentinel:'read-boundary-only'});});
    attempt('window audit',()=>{read.window.audit.tasks.push({testSentinel:'read-boundary-only'});});
    attempt('event history',()=>{read.events.push({type:'snapshot-only-sentinel'});});
    attempt('nested body position',()=>{read.object.position[1]=-100;});
    attempt('actor measurements',()=>{read.agents[0].measurements.heightM=-100;});
    const fresh=app.snapshot(),unchanged=before===JSON.stringify(project(fresh));
    const currentTask=fresh.window.agents.find(a=>a.id==='A').task;
    const compact=app.state(),compactBefore=JSON.stringify(compact),compactAttempts=[];
    const changeCompact=(name,fn)=>{let rejected=false;try{fn();}catch{rejected=true;}compactAttempts.push({name,writeRejected:rejected});};
    const liveCompactBefore=JSON.stringify(project(app.state()));
    changeCompact('compact task target',()=>{compact.window.agents.find(a=>a.id==='A').task.targetAngleRad=0;});
    changeCompact('compact review',()=>{compact.review.checked=!compact.review.checked;});
    const compactUnchanged=liveCompactBefore===JSON.stringify(project(app.state()));
    return {scope:'Actual current native window task, public full and compact read APIs; synchronous writes to returned data only',
      sourceTask,currentTask:{token:currentTask?.token,operation:currentTask?.operation,targetAngleRad:currentTask?.targetAngleRad},
      unchanged,compactUnchanged,attempts,compactAttempts,compactBytes:new TextEncoder().encode(compactBefore).length,
      errors:[...app.errors]};
  });
  assert.equal(result.errors.length,0);
  assert.equal(result.unchanged,true,'Mutating any returned full snapshot field must not alter the live world or evidence');
  assert.equal(result.compactUnchanged,true,'The routine compact state has the same ownership boundary');
  assert.deepEqual(result.currentTask,result.sourceTask,'The actual opening task survives observer edits');
  assert(result.compactBytes<STATE_EXPORT_MAX_BYTES,'Routine current state remains below the 1 MiB product budget');
  return putIf(put,'authority-snapshot-isolation-'+label+'.json',result);
}

async function queuedSingleSteps({page,evaluate,waitFor,put,pause,frameMS=60000}) {
  await pause(true);
  const before=await evaluate('R04 begin actual single-step frame trace',async()=>{
    const app=window.__NPC_OBSERVATION__;
    await app.awaitFrame({fresh:true});
    const s=app.snapshot(),q=app.renderStatus(),authority=app.authority();
    if(authority.pendingCount)throw Error('Single-step baseline contains pending commands');
    const trace={before:{time:s.time,physicsSteps:s.audit.physicsSteps,render:q,authority},events:[],clicks:[],unsubscribers:[]};
    trace.unsubscribers.push(app.onRender(frame=>trace.events.push({kind:'submit',serial:frame.serial,
      metadata:structuredClone(frame.metadata),precedingCompletedSerial:app.renderStatus().completed})));
    trace.unsubscribers.push(app.onComplete(frame=>trace.events.push({kind:'complete',serial:frame.serial,
      metadata:structuredClone(frame.metadata),completedAtMS:frame.completedAtMS})));
    trace.button=document.querySelector('#npc-step');
    trace.clickListener=()=>queueMicrotask(()=>{const a=app.authority();trace.clicks.push({pendingCount:a.pendingCount,
      receipt:a.lastReceipt,render:app.renderStatus()});});
    trace.button.addEventListener('click',trace.clickListener);
    window.__NPC_R04_STEP_QA__=trace;
    return trace.before;
  },undefined,frameMS);
  // Playwright emits three actual pointer clicks. No direct world.tick call,
  // no synthetic click handler, and no manually advanced clock are used.
  await page.locator('#npc-step').click({clickCount:3,delay:0});
  await waitFor('R04 three queued UI single steps complete',expected=>{
    const app=window.__NPC_OBSERVATION__,s=app.state();
    return app.errors.length||s.auditSummary.physicsSteps>=expected&&app.authority().pendingCount===0;
  },before.physicsSteps+3,{timeout:frameMS,polling:50});
  const after=await evaluate('R04 read completed actual single-step frames',async()=>{
    const app=window.__NPC_OBSERVATION__;
    await app.awaitFrame({fresh:true});
    const t=window.__NPC_R04_STEP_QA__,s=app.snapshot();
    t.unsubscribers.forEach(unsubscribe=>unsubscribe());t.button.removeEventListener('click',t.clickListener);
    const receipts=t.clicks.map(c=>app.commandReceipt(c.receipt.id));
    const result={before:t.before,events:t.events,clicks:t.clicks,receipts,
      after:{time:s.time,physicsSteps:s.audit.physicsSteps,render:app.renderStatus(),authority:app.authority(),
        paused:/继续/.test(document.querySelector('#npc-pause').textContent)},errors:[...app.errors]};
    delete window.__NPC_R04_STEP_QA__;return result;
  },undefined,frameMS);
  assert.equal(after.errors.length,0);
  assert.equal(after.clicks.length,3,'Three actual UI click events were delivered');
  assert.equal(after.receipts.length,3);
  assert.equal(new Set(after.receipts.map(r=>r?.id)).size,3,'Every click creates a distinct command');
  assert.equal(after.after.paused,true,'Single-step leaves automatic simulation paused');
  assert.equal(after.after.physicsSteps,before.physicsSteps+3,'Exactly three, not one or four, physical steps occurred');
  // World snapshot time is rounded to milliseconds; the step counter and
  // command detail below carry the exact count and unrounded simulated time.
  assert(Math.abs(after.after.time-before.time-3/120)<.0011,'Three fixed steps account for all simulated-time change');
  assert.equal(after.after.authority.pendingCount,0);
  assert.equal(after.after.render.inFlight,0);
  assert(after.after.render.maxInFlight<=1,'One actual managed GPU frame remains the upper bound');
  const submitted=after.events.filter(e=>e.kind==='submit'),completed=after.events.filter(e=>e.kind==='complete');
  let precedingFrame=before.render.completed;
  for(let i=0;i<3;i++) {
    const receipt=after.receipts[i],step=before.physicsSteps+i+1;
    assert.equal(receipt.status,'applied');assert.equal(receipt.type,'step');
    assert.equal(receipt.detail.physicsStepsBefore,step-1);assert.equal(receipt.detail.physicsStepsAfter,step);
    assert(Math.abs(receipt.detail.simulationTimeAfter-receipt.detail.simulationTimeBefore-1/120)<1e-9,
      'Each accepted command advances exactly the original 1/120 s physics step');
    const frame=submitted.find(e=>e.metadata.appliedCommandId===receipt.id&&e.metadata.physicsSteps===step);
    assert(frame,'Every individual step produced an actual native frame before the next step');
    assert(frame.precedingCompletedSerial>=precedingFrame,'This frame follows the previous GPU-completed step frame');
    assert(receipt.completedFrameSerial>=precedingFrame,'This step command applied after the preceding actual GPU completion');
    assert(completed.some(e=>e.serial===frame.serial),'This exact native step frame completed at a GPU fence');
    const submitIndex=after.events.indexOf(frame);
    if(i>0)assert(after.events.slice(0,submitIndex).some(e=>e.kind==='complete'&&e.serial===precedingFrame),
      'The recorded GPU completion precedes the next distinct step submission');
    precedingFrame=frame.serial;
  }
  return putIf(put,'authority-single-step.json',{actualUI:true,actualGPUCallbacks:true,...after});
}

async function verificationOwnership({evaluate,put}) {
  const result=await evaluate('R04 verification retains exclusive mutation authority',()=>{
    const app=window.__NPC_OBSERVATION__,before=app.authority(),summary=app.verification();
    if(before.activeMode!=='verification'||summary?.completed)throw Error('The original complete suite must already be running');
    const id='ci-verification-conflict-'+before.revision+'-'+before.epoch;
    const envelope={id,type:'move-target',expectedEpoch:before.epoch,payload:{}};
    const targetBefore=app.state().target;
    const receipt=app.command(envelope),after=app.authority(),targetAfter=app.state().target;
    return {scope:'Real running native numerical suite; supported public command boundary, no world mutation shortcut',
      before,summary,receipt,retainedReceipt:app.commandReceipt(id),after,targetBefore,targetAfter,
      controls:{manualDisabled:['npc-pick','npc-plan','npc-step','npc-target','npc-window-open','npc-run-qa'].every(id=>document.getElementById(id).disabled),
        resetEnabled:!document.querySelector('#npc-reset').disabled,stopEnabled:!document.querySelector('#npc-stop-qa').disabled},errors:[...app.errors]};
  });
  assert.equal(result.errors.length,0);
  assert.equal(result.receipt.status,'rejected');assert.equal(result.receipt.code,'verification-running');
  assert.equal(result.retainedReceipt.status,'rejected');
  assert.equal(result.before.activeMode,'verification');assert.equal(result.after.activeMode,'verification');
  assert.equal(result.after.revision,result.before.revision,'Rejected manual input does not acquire a state revision');
  assert.equal(result.after.pendingCount,result.before.pendingCount,'Rejected manual input never enters the mutation queue');
  assert.deepEqual(result.targetAfter,result.targetBefore,'Rejected manual input did not move the target');
  assert.equal(result.controls.manualDisabled,true,'Actual manual UI mutations are disabled while numerical verification owns the scene');
  assert.equal(result.controls.resetEnabled,true);assert.equal(result.controls.stopEnabled,true);
  return putIf(put,'authority-verification-ownership.json',result);
}

async function verificationAbort({page,evaluate,waitFor,put,frameMS=60000}) {
  await page.click('#npc-run-qa');
  await waitFor('R04 short numerical run owns the writer',()=>{
    const app=window.__NPC_OBSERVATION__;return app.errors.length||app.authority().activeMode==='verification';
  },undefined,{timeout:frameMS,polling:50});
  const before=await evaluate('R04 record numerical run before explicit reset',()=>{
    const app=window.__NPC_OBSERVATION__;return {authority:app.authority(),verification:app.verification()};
  });
  await page.click('#npc-reset');
  await waitFor('R04 explicit reset stops numerical ownership',()=>{
    const app=window.__NPC_OBSERVATION__,a=app.authority();
    return app.errors.length||a.activeMode==='observation'&&a.pendingCount===0&&a.lastReceipt?.type==='reset'&&a.lastReceipt.status!=='queued';
  },undefined,{timeout:frameMS,polling:50});
  const after=await evaluate('R04 numerical stop has a truthful terminal result',()=>{
    const app=window.__NPC_OBSERVATION__;return {authority:app.authority(),verification:app.verification(),state:app.state(),
      visibleReport:document.querySelector('#npc-qa').textContent,errors:[...app.errors]};
  });
  assert.equal(after.errors.length,0);
  assert.equal(after.authority.activeMode,'observation');assert.equal(after.authority.pendingCount,0);
  assert.equal(after.authority.lastReceipt.status,'applied');assert.equal(after.authority.lastReceipt.type,'reset');
  assert(after.authority.epoch>before.authority.epoch,'Reset explicitly starts a new scene epoch');
  assert.equal(after.verification.status,'aborted','An interrupted numerical report is explicitly aborted, never silently lost');
  assert.notEqual(after.verification.passed,true,'An interrupted report cannot be represented as passed');
  assert.match(after.visibleReport,/中止|中断|停止/,'The interrupted result remains visible');
  assert(after.state.agents.every(a=>a.phase==='idle'&&!a.recovery),'Reset clears current bottle task execution and recovery');
  assert(after.state.window.agents.every(a=>a.phase==='idle'&&!a.recovery),'Reset clears current window task execution and recovery');
  assert.equal(after.state.constraints.bottleGrip,0);assert.equal(after.state.constraints.windowGrip,0);
  assert.equal(after.state.constraints.structural,1,'The actual permanent hinge survives reset');
  return putIf(put,'authority-verification-abort.json',{actualUI:true,before,after});
}

function compactExport({exported,current,bytes,verificationSummary,put,label='window'}) {
  assert(Number.isSafeInteger(bytes)&&bytes>0,'Record actual downloaded bytes');
  assert(bytes<=STATE_EXPORT_MAX_BYTES,'Routine export must meet the explicit 1 MiB product budget');
  assert(!Object.hasOwn(exported,'audit'),'Routine state does not embed full world geometry audits');
  assert(!Object.hasOwn(exported.window,'audit'),'Routine state does not embed full window geometry audits');
  assert(exported.auditSummary&&exported.window.auditSummary,'Retained evidence counts remain discoverable');
  const summary=exported.verification;
  if(summary) {
    assert(!Object.hasOwn(summary,'detail'),'Routine export must not embed a full numerical report');
    assert(!Array.isArray(summary.tests)||summary.tests.every(t=>!Object.hasOwn(t,'detail')),
      'A summary may list compact outcomes but must not contain nested physical snapshots');
  }
  if(verificationSummary)assert.deepEqual(summary,verificationSummary,'Current numerical summary survives routine export');
  for(const key of ['time','object','target','targetRevision','agents','review','events','window','constraints','auditSummary'])
    assert.deepEqual(exported[key],current[key],'Routine export preserves every current authoritative field: '+key);
  return putIf(put,'authority-compact-export-'+label+'.json',{actualUI:true,bytes,maxBytes:STATE_EXPORT_MAX_BYTES,
    matchedCurrentState:true,containsFullVerification:false,
    worldEvidenceCounts:exported.auditSummary,windowEvidenceCounts:exported.window.auditSummary});
}

module.exports={pausedReviewInvalidation,snapshotIsolation,queuedSingleSteps,verificationOwnership,verificationAbort,
  compactExport,STATE_EXPORT_MAX_BYTES};
