import test from 'node:test';
import assert from 'node:assert/strict';
import {LatestFrameScheduler} from '../r06/frame-scheduler.mjs';
function harness(render=()=>{}){
 let time=0,next=0;const frames=new Map(),timers=new Map(),cancelled=[];
 const s=new LatestFrameScheduler({render,now:()=>time,requestFrame:f=>{const id=++next;frames.set(id,f);return id;},cancelFrame:id=>{cancelled.push(frames.get(id));frames.delete(id);},setTimer:(f,ms)=>{const id=++next;timers.set(id,{f,at:time+ms});return id;},clearTimer:id=>{cancelled.push(timers.get(id)?.f);timers.delete(id);},onError:e=>{s.error=e;}});
 return {s,frames,timers,cancelled,frame(){const a=[...frames];frames.clear();a.forEach(([,f])=>f());},advance(ms){time+=ms;const a=[...timers].filter(([,v])=>v.at<=time);a.forEach(([id])=>timers.delete(id));a.forEach(([,v])=>v.f());},tick(ms){time+=ms;},get time(){return time;}};
}
test('coalesces a burst to one latest camera dispatch and one settled dispatch',()=>{
 let camera=0;const seen=[],h=harness(t=>seen.push({camera,quality:t.quality,revision:t.revision}));
 for(let i=1;i<=200;i++){camera=i;h.s.request({reason:'pointermove'});}
 assert.equal(h.frames.size,1);assert.equal(h.timers.size,1);assert.equal(h.s.snapshot().maxPendingCallbacks,2);h.frame();
 assert.deepEqual(seen.map(x=>[x.camera,x.quality]),[[200,'interaction']]);assert.equal(h.frames.size,0);h.advance(300);h.frame();
 assert.deepEqual(seen.map(x=>[x.camera,x.quality]),[[200,'interaction'],[200,'settled']]);assert.equal(h.s.snapshot().pendingCallbacks,0);
});
test('held pointer suppresses full resolution and release settles once',()=>{
 const seen=[],h=harness(t=>seen.push(t.quality));h.s.beginInteraction();h.s.request();h.frame();h.advance(5000);assert.deepEqual(seen,['interaction']);assert.equal(h.timers.size,0);h.s.endInteraction();h.advance(300);h.frame();assert.deepEqual(seen,['interaction','settled']);
});
test('old callbacks cannot consume or overwrite a new model, resize or camera revision',()=>{
 const seen=[],h=harness(t=>seen.push(t.reason));h.s.request({reason:'old-model'});const oldFrame=[...h.frames.values()][0],oldSettle=[...h.timers.values()][0].f;
 h.s.invalidate('model-changed');h.s.request({reason:'new-model'});oldFrame();oldSettle();assert.equal(h.frames.size,1);assert.equal(h.timers.size,1);h.frame();assert.deepEqual(seen,['new-model']);
 h.s.request({reason:'resize'});const oldResizeTimer=[...h.timers.values()][0].f;h.s.flush({reason:'qa-resolution'});oldResizeTimer();h.advance(5000);h.frame();assert.deepEqual(seen,['new-model','qa-resolution']);assert.equal(h.s.snapshot().pendingCallbacks,0);
});
test('GPU backpressure preserves latest intent without another screen dispatch or unbounded callbacks',()=>{
 let ready=true,camera=1;const seen=[],h=harness(t=>{seen.push([camera,t.quality]);ready=false;});h.s.isReady=()=>ready;
 h.s.request();h.frame();for(let i=2;i<=100;i++){camera=i;h.s.request();h.frame();h.advance(24);}assert.equal(seen.length,1);assert.ok(h.s.snapshot().pendingCallbacks<=2);assert.equal(h.s.snapshot().maxPendingCallbacks,2);
 ready=true;h.frame();assert.deepEqual(seen,[[1,'interaction'],[100,'interaction']]);
});
test('new drag downgrades a pending settled frame while GPU is still busy',()=>{
 let ready=false;const seen=[],h=harness(t=>seen.push(t.quality));h.s.isReady=()=>ready;h.s.request();h.advance(300);h.frame();h.s.beginInteraction();ready=true;h.advance(24);h.frame();assert.deepEqual(seen,['interaction']);assert.equal(h.s.snapshot().pendingSettle,false);
});
test('manual flush cancels all pending work and remains deterministic across elapsed time',()=>{
 const seen=[],h=harness(t=>seen.push(t.quality));h.s.request();h.frame();h.s.flush();h.advance(10000);h.frame();assert.deepEqual(seen,['interaction','manual']);assert.equal(h.s.snapshot().pendingCallbacks,0);
});
test('idle scheduler does not enqueue an animation loop',()=>{const h=harness();h.s.request({quality:'settled'});h.frame();h.advance(60000);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.s.snapshot().dispatches,1);});
test('latencies are explicit JS dispatch measurements rather than GPU or presentation claims',()=>{
 let h;h=harness(()=>{h.tick(5);return {width:160,height:112};});h.s.request();h.tick(20);h.frame();const d=h.s.snapshot();assert.equal(d.lastDispatch.requestToDispatchStartMs,20);assert.equal(d.lastDispatch.dispatchWallMs,5);assert.deepEqual(d.lastDispatch.result,{width:160,height:112});assert.match(d.timingMeaning,/Neither measures isolated GPU time or visible presentation latency/);
});
test('async and reentrant frame implementations fail closed instead of scheduling mixed continuations',()=>{
 assert.throws(()=>new LatestFrameScheduler({render:async()=>{}}),/synchronous/);
 const h=harness(()=>Promise.resolve());h.s.request();h.frame();assert.equal(h.s.snapshot().faulted,true);assert.equal(h.s.snapshot().pendingCallbacks,0);assert.match(h.s.error.message,/Async/);
 const n=harness(()=>n.s.request());n.s.request();n.frame();assert.equal(n.s.snapshot().faulted,true);assert.equal(n.s.snapshot().pendingCallbacks,0);assert.match(n.s.error.message,/revision changed/);
});
test('disposing cancels all work and cannot be revived by a stale callback',()=>{const seen=[],h=harness(()=>seen.push(1));h.s.request();const old=[...h.frames.values()][0];h.s.dispose();old();h.s.request();h.frame();h.advance(1000);assert.deepEqual(seen,[]);assert.equal(h.s.snapshot().pendingCallbacks,0);});
