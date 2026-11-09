import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {manageRendering} from '../src/RenderQueue.mjs';

// Scheduling fixture only. Renderer/frame and fence states are test doubles;
// the separate current-source Chromium gate must measure actual GPU work.
const fences=[],trace=[];
const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,
  ALREADY_SIGNALED:4,CONDITION_SATISFIED:5,
  fenceSync(){const f={state:2};fences.push(f);return f;},
  clientWaitSync(f){return f.state;},deleteSync(){},flush(){}};
const renderer={info:{render:{frame:0}},getContext:()=>gl};
let pose=0,preparedPose=null,prepares=0,beauties=0;
const viewer={renderer,render(){beauties++;renderer.info.render.frame++;trace.push('beauty:'+preparedPose);}};
const queue=manageRendering(viewer);
queue.onBeforeRender(()=>{prepares++;preparedPose=pose;renderer.info.render.frame+=3;trace.push('appearance:'+pose);});
queue.request();queue.pump();assert.equal(prepares,0,'startup drain must finish before appearance');
fences[0].state=gl.ALREADY_SIGNALED;queue.pump();
assert.equal(prepares,1);assert.equal(beauties,1);
for(let i=1;i<=100;i++){pose=i;queue.request();queue.pump();}
assert.equal(prepares,1,'no appearance work while the earlier batch fence is pending');
assert.equal(beauties,1);assert.equal(renderer.info.render.frame,4);
fences[1].state=gl.CONDITION_SATISFIED;queue.pump();
assert.equal(prepares,2);assert.equal(beauties,2);assert.equal(preparedPose,100,'coalesced frame uses newest pose');
assert.deepEqual(trace,['appearance:0','beauty:0','appearance:100','beauty:100']);
const complete=queue.awaitFrame({fresh:false});fences[2].state=gl.ALREADY_SIGNALED;queue.pump();
const status=await complete;
assert.equal(status.inFlight,0);assert.equal(status.submitted,status.completed);
assert.equal(status.appearancePreparation.lastRenderPasses,3);
assert.equal(status.appearancePreparation.totalRenderPasses,6);
assert.equal(status.outsideBatchRenderPasses,0);
queue.request();queue.pump();renderer.info.render.frame++;queue.pump();
assert.equal(queue.status().outsideBatchRenderPasses,1,'instrumentation detects an intentionally escaped renderer pass');
const source=fs.readFileSync(new URL('../src/RenderQueue.mjs',import.meta.url));
const result={schema:'npc-render-submission-fixture/1',passed:true,
  scope:'CPU scheduling with explicit renderer/fence test doubles; not a real GPU or performance acceptance',
  sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),
  pendingRequestsCoalesced:100,appearanceHookBlockedWhilePending:true,newestPosePrepared:true,
  completeFrameWaiterResolved:true,realCounterContractTested:true,intentionalEscapedPassDetected:true,
  realBrowserValidated:false,performanceAcceptance:false,visualAcceptance:false};
fs.writeFileSync(new URL('./RENDER_SUBMISSION_FIXTURE.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
