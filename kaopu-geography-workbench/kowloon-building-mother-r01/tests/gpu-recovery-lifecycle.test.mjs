import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuLifecycle} from '../gpu-recovery-r01/gpu-lifecycle.mjs';

// Independent deterministic protocol tests. No real browser, GPU, or renderer
// is involved; these cannot establish device reliability or visual parity.
function harness(options={}){
 let time=0,next=0;
 const calls=[],valid=new Set(),completed=[],stopped=[],errors=[],statuses=[];
 const gl={
  NO_ERROR:0,INVALID_OPERATION:1282,CONTEXT_LOST_WEBGL:37442,
  SYNC_GPU_COMMANDS_COMPLETE:37143,ALREADY_SIGNALED:37146,TIMEOUT_EXPIRED:37147,CONDITION_SATISFIED:37148,WAIT_FAILED:37149,
  lost:false,
  isContextLost(){calls.push(['isContextLost']);return this.lost;},
  fenceSync(condition,flags){calls.push(['fenceSync',condition,flags]);const handle={id:++next};valid.add(handle);return handle;},
  flush(){calls.push(['flush']);},
  getError(){calls.push(['getError']);return errors.shift()??this.NO_ERROR;},
  isSync(handle){calls.push(['isSync',handle]);return valid.has(handle);},
  clientWaitSync(handle,flags,timeout){calls.push(['clientWaitSync',handle,flags,timeout]);return statuses.shift()??this.TIMEOUT_EXPIRED;},
  deleteSync(handle){calls.push(['deleteSync',handle]);valid.delete(handle);}
 };
 const gate=new GpuLifecycle({gl,now:()=>time,onStop:detail=>stopped.push(detail),onComplete:detail=>completed.push(detail),...options});
 return {gate,gl,calls,valid,errors,statuses,completed,stopped,tick:ms=>{time+=ms;},count:name=>calls.filter(call=>call[0]===name).length};
}

test('submission fences only after the caller draw, then flushes and validates creation',()=>{
 const h=harness();h.calls.push(['draw']);
 const metadata={revision:7,quality:'conservative',resolution:{width:160,height:112}};
 assert.equal(h.gate.generation,1);assert.equal(h.gate.state,'active');assert.equal(h.gate.submit(metadata),true);
 assert.ok(h.calls.findIndex(x=>x[0]==='draw')<h.calls.findIndex(x=>x[0]==='fenceSync'));
 assert.ok(h.calls.findIndex(x=>x[0]==='fenceSync')<h.calls.findIndex(x=>x[0]==='flush'));
 assert.equal(h.gate.pending.generation,1);assert.equal(h.gate.pending.gl,h.gl);
 metadata.resolution.width=999;assert.equal(h.gate.pending.metadata.resolution.width,160);
 assert.equal(h.gate.snapshot().stats.submitted,1);assert.equal(h.gate.snapshot().stats.completed,0);
});

test('empty readiness neither calls completion nor invents a completed frame',()=>{
 const h=harness();assert.equal(h.gate.poll(),true);assert.equal(h.gate.pending,null);
 assert.equal(h.completed.length,0);assert.equal(h.gate.snapshot().stats.completed,0);assert.equal(h.count('clientWaitSync'),0);
});

for(const signal of ['ALREADY_SIGNALED','CONDITION_SATISFIED'])test(`${signal} completes once and deletes its owned fence once`,()=>{
 const h=harness();h.gate.submit({revision:2});h.tick(27);h.statuses.push(h.gl[signal]);
 assert.equal(h.gate.poll(),true);assert.equal(h.gate.pending,null);assert.equal(h.count('deleteSync'),1);
 assert.equal(h.completed.length,1);assert.equal(h.completed[0].elapsedMs,27);assert.deepEqual(h.completed[0].metadata,{revision:2});
 assert.equal(h.gate.poll(),true);h.gate.release('again');assert.equal(h.count('deleteSync'),1);assert.equal(h.completed.length,1);
});

test('TIMEOUT_EXPIRED retains one handle and prevents a second submission',()=>{
 const h=harness();h.gate.submit({revision:1});const pending=h.gate.pending;
 for(let i=0;i<20;i++){h.tick(24);assert.equal(h.gate.poll(),false);assert.equal(h.gate.submit({revision:2}),false);assert.equal(h.gate.pending,pending);}
 assert.equal(h.count('fenceSync'),1);assert.equal(h.count('deleteSync'),0);assert.equal(h.completed.length,0);assert.equal(h.stopped.length,0);
 assert.ok(h.calls.filter(x=>x[0]==='clientWaitSync').every(x=>x[2]===0&&x[3]===0));
});

test('total elapsed wait is bounded and timeout backlog cannot be retried',()=>{
 const h=harness({maxWaitMs:100});h.gate.submit();h.tick(99);assert.equal(h.gate.poll(),false);h.tick(1);
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.state,'failed');assert.equal(h.gate.snapshot().lastFailure.reason,'fence-timeout');
 assert.equal(h.count('clientWaitSync'),1);assert.equal(h.count('deleteSync'),1);assert.equal(h.completed.length,0);
 assert.throws(()=>h.gate.beginRecovery({manual:true}),/not eligible/);assert.equal(h.gate.recoveryAttempts,0);
 h.gate.poll();h.gate.submit();assert.equal(h.stopped.length,1);assert.equal(h.count('fenceSync'),1);
});

test('time elapsed during a wait call also counts toward the total bound',()=>{
 const h=harness({maxWaitMs:100});h.gate.submit();h.gl.clientWaitSync=()=>{h.tick(100);return h.gl.TIMEOUT_EXPIRED;};
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.snapshot().lastFailure.reason,'fence-timeout');assert.equal(h.completed.length,0);
});

test('WAIT_FAILED captures live context, errors, and validity before disposal',()=>{
 const h=harness();h.gate.submit({revision:9,quality:'high',resolution:{width:840,height:667}});const pending=h.gate.pending;
 h.valid.delete(pending.handle);h.errors.push(h.gl.INVALID_OPERATION);h.statuses.push(h.gl.WAIT_FAILED);h.calls.length=0;
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.state,'failed');assert.equal(h.completed.length,0);
 const detail=h.gate.snapshot().lastFailure;
 assert.equal(detail.reason,'wait-failed-invalid-sync');assert.equal(detail.contextLost,false);assert.equal(detail.syncValid,false);assert.deepEqual(detail.errors,[h.gl.INVALID_OPERATION]);
 assert.equal(detail.metadata.revision,9);assert.equal(detail.generation,1);
 const deleted=h.calls.findIndex(x=>x[0]==='deleteSync');
 for(const method of ['isContextLost','getError','isSync'])assert.ok(h.calls.findIndex(x=>x[0]===method)<deleted,method+' must be captured before deletion');
 assert.equal(h.gate.snapshot().manualRetryAllowed,true);assert.equal(h.count('deleteSync'),1);assert.equal(h.stopped.length,1);
});

test('WAIT_FAILED with a valid live sync fails closed and is not retry eligible',()=>{
 const h=harness();h.gate.submit();h.statuses.push(h.gl.WAIT_FAILED);assert.equal(h.gate.poll(),false);
 assert.equal(h.gate.snapshot().lastFailure.syncValid,true);assert.equal(h.gate.snapshot().manualRetryAllowed,false);
 assert.throws(()=>h.gate.beginRecovery({manual:true}),/not eligible/);assert.equal(h.completed.length,0);
});

test('unknown wait status is never counted as completion or retryable',()=>{
 const h=harness();h.gate.submit();h.statuses.push(0x1234);assert.equal(h.gate.poll(),false);
 assert.equal(h.gate.snapshot().lastFailure.reason,'unknown-wait-status');assert.equal(h.count('deleteSync'),1);assert.equal(h.completed.length,0);
 assert.throws(()=>h.gate.beginRecovery({manual:true}),/not eligible/);
});

test('loss before rendering/submission prevents any fence or wait',()=>{
 const h=harness();h.gl.lost=true;assert.equal(h.gate.canRender(),false);assert.equal(h.gate.submit(),false);assert.equal(h.gate.poll(),false);
 assert.equal(h.gate.state,'lost');assert.equal(h.gate.generation,2);assert.equal(h.count('fenceSync'),0);assert.equal(h.count('clientWaitSync'),0);assert.equal(h.stopped.length,1);
 h.gate.contextLost('duplicate-event');assert.equal(h.gate.generation,2);assert.equal(h.stopped.length,1);assert.equal(h.gate.highQualityDisabled,true);
});

test('loss inside fence creation does not flush or delete a stale sync',()=>{
 const h=harness();h.gl.fenceSync=()=>{h.gl.lost=true;return {id:10};};assert.equal(h.gate.submit(),false);
 assert.equal(h.gate.state,'lost');assert.equal(h.count('flush'),0);assert.equal(h.count('deleteSync'),0);assert.equal(h.gate.pending,null);
});

test('loss during flush invalidates the handle without deleting it',()=>{
 const h=harness();h.gl.flush=()=>{h.gl.lost=true;};assert.equal(h.gate.submit({revision:4}),false);
 assert.equal(h.gate.state,'lost');assert.equal(h.gate.pending,null);assert.equal(h.count('deleteSync'),0);assert.equal(h.gate.snapshot().stats.submitted,0);
});

test('loss after submission is detected before any wait or stale deletion',()=>{
 const h=harness();h.gate.submit();h.gl.lost=true;assert.equal(h.gate.poll(),false);
 assert.equal(h.count('clientWaitSync'),0);assert.equal(h.count('deleteSync'),0);assert.equal(h.gate.pending,null);assert.equal(h.completed.length,0);
});

for(const status of ['WAIT_FAILED','CONDITION_SATISFIED'])test(`loss during ${status} wait overrides the returned status`,()=>{
 const h=harness();h.gate.submit();h.gl.clientWaitSync=()=>{h.gl.lost=true;return h.gl[status];};
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.state,'lost');assert.equal(h.gate.generation,2);
 assert.equal(h.count('deleteSync'),0);assert.equal(h.completed.length,0);
});

test('context loss during failure diagnostics is captured before any delete',()=>{
 const h=harness();h.gate.submit();h.statuses.push(h.gl.WAIT_FAILED);h.gl.getError=()=>{h.gl.lost=true;return h.gl.CONTEXT_LOST_WEBGL;};
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.state,'lost');assert.equal(h.count('deleteSync'),0);assert.equal(h.completed.length,0);
});

test('stale pending generation is discarded without wait or delete',()=>{
 const h=harness();h.gate.submit();h.gate.pending.generation=0;
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.state,'failed');assert.equal(h.count('clientWaitSync'),0);assert.equal(h.count('deleteSync'),0);
 assert.equal(h.gate.snapshot().stats.staleDiscarded,1);assert.equal(h.completed.length,0);
});

test('release is idempotent, generation/owner guarded, and never a completion',()=>{
 const h=harness();h.gate.submit();assert.equal(h.gate.release('explicit-work'),true);assert.equal(h.gate.release('again'),false);
 assert.equal(h.count('deleteSync'),1);assert.equal(h.completed.length,0);
 h.gate.submit();h.gate.pending.gl={};assert.equal(h.gate.release('wrong-owner'),true);assert.equal(h.count('deleteSync'),1);
});

test('reentrant context-loss event during wait cannot touch a new generation',()=>{
 const h=harness();h.gate.submit();h.gl.clientWaitSync=()=>{h.gate.contextLost('loss-event');return h.gl.CONDITION_SATISFIED;};
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.generation,2);assert.equal(h.count('deleteSync'),0);assert.equal(h.completed.length,0);
});

test('restoration requires a live browser context and a fresh resource attachment',()=>{
 const h=harness();const oldToken=h.gate.generation;h.gate.submit();h.gl.lost=true;h.gate.contextLost('loss-event');
 assert.throws(()=>h.gate.beginRecovery(),/restore/);assert.equal(h.gate.recoveryAttempts,0);assert.equal(h.gate.state,'lost');
 h.gl.lost=false;h.valid.clear();const token=h.gate.beginRecovery();assert.equal(token,2);assert.equal(h.gate.state,'recovering');
 assert.equal(h.gate.canRender(),false);assert.equal(h.gate.submit(),false);assert.equal(h.gate.poll(),false);assert.equal(h.gate.assertCurrent(token),true);
 assert.throws(()=>h.gate.assertCurrent(oldToken),{name:'AbortError'});assert.throws(()=>h.gate.attach(h.gl,oldToken),{name:'AbortError'});
 assert.equal(h.gate.attach(h.gl,token),true);assert.equal(h.gate.canRender(),true);assert.equal(h.gate.poll(),true);
 assert.equal(h.gate.state,'recovering');assert.equal(h.completed.length,0);assert.equal(h.count('deleteSync'),0);
 h.gate.submit({quality:'conservative'});h.statuses.push(h.gl.CONDITION_SATISFIED);assert.equal(h.gate.poll(),true);
 assert.equal(h.gate.state,'active');assert.equal(h.gate.snapshot().stats.recovered,1);assert.equal(h.gate.highQualityDisabled,true);
 assert.throws(()=>h.gate.attach(h.gl,token),{name:'AbortError'});
});

test('explicit invalid-sync retry uses the same single shared recovery budget',()=>{
 const h=harness();h.gate.submit();h.valid.clear();h.statuses.push(h.gl.WAIT_FAILED);h.gate.poll();
 assert.throws(()=>h.gate.beginRecovery(),/manual retry/);const token=h.gate.beginRecovery({manual:true});assert.equal(token,2);
 h.gate.attach(h.gl,token);h.gate.submit();h.statuses.push(h.gl.ALREADY_SIGNALED);h.gate.poll();
 h.gl.lost=true;h.gate.contextLost('subsequent-loss');h.gl.lost=false;
 assert.throws(()=>h.gate.beginRecovery(),/budget/);assert.equal(h.gate.recoveryAttempts,1);assert.equal(h.gate.canRender(),false);
});

test('failed renderer reconstruction stops once and cannot retry indefinitely',()=>{
 const h=harness();h.gate.contextLost();const token=h.gate.beginRecovery();
 h.gate.fail('renderer-rebuild-failed',{message:'Required float target extension unavailable'});h.gate.fail('duplicate');
 assert.equal(h.gate.state,'failed');assert.equal(h.stopped.length,2);assert.equal(h.gate.recoveryAttempts,1);
 assert.throws(()=>h.gate.attach(h.gl,token),{name:'AbortError'});assert.throws(()=>h.gate.assertCurrent(token),{name:'AbortError'});
 assert.throws(()=>h.gate.beginRecovery({manual:true}),/budget/);assert.equal(h.gate.canRender(),false);
});

test('loss during resource reconstruction invalidates its token and uses the attempt',()=>{
 const h=harness();h.gate.contextLost();const token=h.gate.beginRecovery();h.gate.contextLost('lost-during-rebuild');
 assert.equal(h.gate.generation,3);assert.throws(()=>h.gate.attach(h.gl,token),{name:'AbortError'});assert.throws(()=>h.gate.beginRecovery(),/budget/);
 assert.equal(h.gate.recoveryAttempts,1);assert.equal(h.completed.length,0);
});

test('attachment rejects a context already lost during renderer construction',()=>{
 const h=harness();h.gate.contextLost();const token=h.gate.beginRecovery();h.gl.lost=true;
 assert.throws(()=>h.gate.attach(h.gl,token),{name:'AbortError'});assert.equal(h.gate.state,'lost');assert.equal(h.gate.canRender(),false);
});

test('null fence, flush exception, and GL error all fail closed',()=>{
 const nullFence=harness();nullFence.gl.fenceSync=()=>null;assert.equal(nullFence.gate.submit(),false);assert.equal(nullFence.gate.state,'failed');assert.equal(nullFence.count('flush'),0);
 const thrown=harness();thrown.gl.flush=()=>{throw Error('flush failed');};assert.equal(thrown.gate.submit(),false);assert.equal(thrown.gate.state,'failed');assert.equal(thrown.count('deleteSync'),1);
 const errored=harness();errored.errors.push(errored.gl.INVALID_OPERATION);assert.equal(errored.gate.submit(),false);assert.equal(errored.gate.snapshot().lastFailure.reason,'fence-flush-error');assert.equal(errored.gate.snapshot().stats.submitted,0);
});

test('failure diagnostic queries are bounded even when GL repeatedly reports errors',()=>{
 const h=harness();h.gate.submit();h.gl.getError=()=>{h.calls.push(['getError']);return h.gl.INVALID_OPERATION;};h.statuses.push(h.gl.WAIT_FAILED);h.calls.length=0;h.gate.poll();
 assert.equal(h.count('getError'),4);assert.equal(h.gate.snapshot().lastFailure.errors.length,4);assert.equal(h.count('deleteSync'),1);
});

test('unknown diagnostic results cannot authorize live manual retry',()=>{
 const h=harness();h.gate.submit();h.valid.clear();h.gl.getError=()=>{throw Error('cannot query errors');};h.statuses.push(h.gl.WAIT_FAILED);h.gate.poll();
 assert.equal(h.gate.snapshot().manualRetryAllowed,false);assert.throws(()=>h.gate.beginRecovery({manual:true}),/not eligible/);
});

test('delete exception stops the gate without false completion',()=>{
 const h=harness();h.gate.submit();h.gl.deleteSync=()=>{throw Error('delete failed');};h.statuses.push(h.gl.CONDITION_SATISFIED);
 assert.equal(h.gate.poll(),false);assert.equal(h.gate.state,'failed');assert.equal(h.completed.length,0);
});

test('snapshot is detached, serializable, and contains bounded useful metadata',()=>{
 const h=harness(),metadata={revision:3,text:'x'.repeat(2000)};metadata.circular=metadata;h.gate.submit(metadata);
 const first=h.gate.snapshot();assert.doesNotThrow(()=>JSON.stringify(first));assert.equal(first.pending.metadata.text.length,512);
 assert.equal(first.pending.metadata.circular,'[circular]');assert.equal('handle' in first.pending,false);assert.equal('gl' in first.pending,false);
 first.stats.completed=999;first.pending.metadata.revision=88;assert.equal(h.gate.snapshot().stats.completed,0);assert.equal(h.gate.pending.metadata.revision,3);
 h.statuses.push(h.gl.CONDITION_SATISFIED);h.gate.poll();for(let i=0;i<25;i++){h.gate.submit({revision:i});h.statuses.push(h.gl.CONDITION_SATISFIED);h.gate.poll();}
 const snapshot=h.gate.snapshot();assert.ok(snapshot.events.length<=16);assert.equal(snapshot.events.at(-1).metadata.revision,24);
});

test('malformed configuration and active recovery attempts are rejected',()=>{
 assert.throws(()=>new GpuLifecycle(),TypeError);assert.throws(()=>harness({maxWaitMs:0}),RangeError);assert.throws(()=>harness({maxRecoveryAttempts:-1}),RangeError);
 const h=harness();assert.throws(()=>h.gate.beginRecovery(),/stopped/);assert.equal(h.gate.recoveryAttempts,0);
 const disabled=harness({maxRecoveryAttempts:0});disabled.gate.contextLost();assert.throws(()=>disabled.gate.beginRecovery(),/budget/);
});

test('a lost context can terminally fail its restoration deadline without any GL call',()=>{
 const h=harness();h.gate.submit();h.gl.lost=true;h.gate.contextLost('lost-event');h.calls.length=0;
 h.gate.fail('restoration-deadline',{elapsedMs:15000});
 assert.equal(h.gate.state,'failed');assert.equal(h.gate.pending,null);assert.equal(h.gate.generation,2);assert.equal(h.gate.recoveryAttempts,0);
 assert.equal(h.gate.snapshot().lastFailure.reason,'restoration-deadline');assert.equal(h.calls.length,0);assert.equal(h.stopped.length,1);
 h.gl.lost=false;assert.equal(h.gate.canRender(),false);assert.equal(h.gate.poll(),false);assert.equal(h.gate.submit(),false);
 h.gate.contextLost('duplicate-loss-event-after-deadline');assert.equal(h.gate.state,'failed');assert.equal(h.gate.generation,2);
 assert.throws(()=>h.gate.beginRecovery(),/not eligible/);assert.throws(()=>h.gate.beginRecovery({manual:true}),/not eligible/);assert.equal(h.completed.length,0);
});

test('a second loss after one recovery can terminally fail the consumed budget',()=>{
 const h=harness();h.gate.contextLost();const token=h.gate.beginRecovery();h.gate.attach(h.gl,token);h.gate.submit();h.statuses.push(h.gl.CONDITION_SATISFIED);h.gate.poll();
 h.gate.contextLost('second-loss');assert.throws(()=>h.gate.beginRecovery(),/budget/);h.calls.length=0;h.gate.fail('recovery-budget-exhausted');
 assert.equal(h.gate.state,'failed');assert.equal(h.gate.recoveryAttempts,1);assert.equal(h.gate.generation,3);assert.equal(h.calls.length,0);
 assert.throws(()=>h.gate.beginRecovery(),/budget/);assert.equal(h.gate.snapshot().stats.completed,1);assert.equal(h.stopped.length,2);
});

test('diagnostic aliases retain the failure code, errors, validity, and injected-frame marker',()=>{
 const h=harness();h.gate.submit({revision:8,injected:'invalid-sync'});assert.equal(h.gate.snapshot().pendingFence,true);
 h.valid.clear();h.errors.push(h.gl.INVALID_OPERATION);h.statuses.push(h.gl.WAIT_FAILED);h.gate.poll();const snapshot=h.gate.snapshot();
 assert.equal(snapshot.pendingFence,false);assert.equal(snapshot.lastFailure.kind,snapshot.lastFailure.reason);assert.equal(snapshot.lastFailure.code,snapshot.lastFailure.reason);
 assert.deepEqual(snapshot.lastFailure.glErrors,[h.gl.INVALID_OPERATION]);assert.equal(snapshot.lastFailure.isSync,false);assert.equal(snapshot.lastFailure.injected,'invalid-sync');
});

test('WAIT_FAILED loss diagnostics retain the status and bounded error evidence',()=>{
 const h=harness();h.gate.submit({revision:44});h.gl.clientWaitSync=()=>{h.gl.lost=true;h.errors.push(h.gl.CONTEXT_LOST_WEBGL);return h.gl.WAIT_FAILED;};
 assert.equal(h.gate.poll(),false);const failure=h.gate.snapshot().lastFailure;
 assert.equal(failure.status,h.gl.WAIT_FAILED);assert.deepEqual(failure.glErrors,[h.gl.CONTEXT_LOST_WEBGL]);assert.equal(failure.metadata.revision,44);
 assert.equal(h.count('deleteSync'),0);assert.equal(h.completed.length,0);
});

test('unknown context or sync query values fail closed without retry classification',()=>{
 const unknownContext=harness();unknownContext.gl.isContextLost=()=>undefined;
 assert.equal(unknownContext.gate.canRender(),false);assert.equal(unknownContext.gate.state,'failed');assert.equal(unknownContext.count('fenceSync'),0);
 const unknownSync=harness();unknownSync.gate.submit();unknownSync.gl.isSync=()=>undefined;unknownSync.statuses.push(unknownSync.gl.WAIT_FAILED);unknownSync.gate.poll();
 assert.equal(unknownSync.gate.snapshot().manualRetryAllowed,false);assert.equal(unknownSync.gate.snapshot().lastFailure.syncValid,null);
});
