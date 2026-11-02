'use strict';
/** Independent checks of the submitted metadata retained only after GPU fences.
 * Does not call production scheduling/physics and cannot advance a browser.
 */
const assert=require('node:assert/strict');
const STEP=1/120, MAX_ADVANCE=.12;
const finite=(n,label)=>assert(Number.isFinite(n),label+' must be finite');
const position=(a,b,label,tolerance=1e-8)=>{
  assert(Array.isArray(a)&&a.length===3&&Array.isArray(b)&&b.length===3,label+' requires two 3D positions');
  a.forEach((n,i)=>{finite(n,label);finite(b[i],label);assert(Math.abs(n-b[i])<=tolerance,label+' disagrees at axis '+i);});
};
function assertContinuousRun({label,kind,actorId='A',operation,before,after,ui}){
  assert(['bottle','window'].includes(kind),'Known physical interaction kind required');
  assert.equal(ui?.usedPause,false,'Intermediate pause is forbidden');
  assert.equal(ui?.usedExternalTick,false,'External ticks are forbidden');
  assert.equal(ui?.buttonId,kind==='bottle'?'npc-pick':'npc-window-'+operation,'Real requested action button is recorded');
  finite(ui.actionStartedAtMS,'UI start');finite(ui.actionFinishedAtMS,'UI finish');
  assert(ui.actionFinishedAtMS>ui.actionStartedAtMS,'UI action has a positive wall duration');
  const prior=before?.renderStatus?.completed,current=after?.renderStatus?.completed;
  assert(Number.isInteger(prior)&&Number.isInteger(current)&&current>prior,'New GPU-completed frames are required');
  assert.equal(after.renderStatus.failure,null,'Rendering must not fail');
  assert.equal(after.renderStatus.inFlight,0,'Final state is read at a completed-frame barrier');
  assert.equal(after.renderStatus.maxManagedInFlight,1,'Only one managed native frame may be in flight');
  const trace=after?.observation?.completedFrameTrace;
  assert(Array.isArray(trace)&&trace.length>0,'GPU-completed trace is required');
  assert.equal(after.observation.lastCompleted?.serial,current,'Observation summary and trace share the same completed serial');
  const frames=trace.filter(f=>f.serial>prior&&f.serial<=current);
  assert.equal(frames.length,current-prior,'Completed-frame trace must not omit any intervening frame');
  let previous=null;
  for(let i=0;i<frames.length;i++){
    const f=frames[i];assert.equal(f.serial,prior+i+1,'Frame serials are contiguous');
    assert(Number.isInteger(f.request)&&f.request>0,'Actual requested draw number required');
    for(const key of ['submittedAtMS','completedAtMS','durationMS'])finite(f[key],key);
    assert(f.completedAtMS>=f.submittedAtMS,'GPU completion cannot precede submission');
    assert(Math.abs((f.completedAtMS-f.submittedAtMS)-f.durationMS)<1e-6,'Duration equals the measured submit/completion interval');
    if(previous){assert(f.submittedAtMS+1e-6>=previous.completedAtMS,'GPU submissions cannot overlap');assert(f.request>=previous.request,'Request numbers cannot go backwards');}
    assert(f.completedAtMS<=ui.actionFinishedAtMS+1,'Final observation was captured after its completed frames');
    assert(f.metadata&&typeof f.metadata.phaseKey==='string'&&f.metadata.phaseKey.length,'Actual submission state is required');
    assert(Number.isInteger(f.metadata.sceneEpoch),'Scene epoch is required');
    finite(f.metadata.simulationTime,'Submitted simulation time');
    previous=f;
  }
  const list=m=>kind==='bottle'?m.agents:m.windowAgents;
  const actor=f=>list(f.metadata)?.find(a=>a.id===actorId);
  const waitingIndex=frames.findIndex(f=>f.submittedAtMS+1e-6>=ui.actionStartedAtMS&&actor(f)?.phase==='waiting');
  assert(waitingIndex>=0,'Actual waiting phase must appear in a completed frame after the UI request');
  const startFrame=frames[waitingIndex],startActor=actor(startFrame),epoch=startFrame.metadata.sceneEpoch;
  finite(startActor.taskStarted,'Actual actor task start');
  assert(Math.abs(startActor.taskStarted-startFrame.metadata.simulationTime)<1e-8,'Waiting is displayed before physics can advance the task');
  const token=kind==='window'?startActor.taskToken:null;
  if(kind==='window')assert(typeof token==='string'&&token.startsWith(actorId+':window:'),'Window task has a distinct task token');
  const endIndex=frames.findIndex((f,i)=>i>waitingIndex&&actor(f)?.phase==='done'&&actor(f)?.recovery===null&&
    actor(f)?.taskStarted===startActor.taskStarted&&(kind!=='window'||actor(f)?.taskToken===token));
  assert(endIndex>=0,'Actual done/restored state must be completed by the GPU');
  const taskFrames=frames.slice(waitingIndex,endIndex+1),expected=kind==='bottle'?
    ['waiting','approach','close','lift','transfer','lower','verify','done:rest','done:restored']:
    ['waiting','approach','close-grip','swing','verify','done:withdraw','done:rest','done:restored'];
  const sequence=[];
  let last=null,largestAdvance=0;
  for(const f of taskFrames){
    const m=f.metadata,a=actor(f);
    assert(a,'Actor must exist in every task frame');
    assert.equal(m.mode,'observation','Accelerated numerical verification is not continuous visual evidence');
    assert.equal(m.paused,false,'No paused frame may occur during the task');
    assert.equal(m.sceneEpoch,epoch,'A station reset cannot stand in for an action');
    assert.equal(a.taskStarted,startActor.taskStarted,'A different task cannot stand in for this action');
    if(kind==='window')assert.equal(a.taskToken,token,'The same window task token must survive through recovery');
    const state=a.phase==='done'?'done:'+(a.recovery||'restored'):a.phase;
    assert(expected.includes(state),'Unexpected success/recovery phase '+state);
    if(sequence.at(-1)!==state)sequence.push(state);
    if(last){
      const advance=m.simulationTime-last.metadata.simulationTime;
      assert(advance>=-1e-9&&advance<=MAX_ADVANCE+1e-9,'Physics may advance at most 0.12 seconds between displayed active-task frames');
      assert(Math.abs(advance/STEP-Math.round(advance/STEP))<1e-6,'Observation does not change the fixed 1/120-second physics step');
      const prevActor=actor(last);
      if(prevActor.phase!==a.phase||prevActor.recovery!==a.recovery)assert.notEqual(m.phaseKey,last.metadata.phaseKey,'Phase transitions must change the display barrier');
      largestAdvance=Math.max(largestAdvance,advance);
    }
    last=f;
  }
  assert.deepEqual(sequence,expected,'Every actual success phase and native recovery must be displayed in order');
  const final=after.snapshot,finalActor=(kind==='bottle'?final?.agents:final?.window?.agents)?.find(a=>a.id===actorId);
  assert.equal(finalActor?.phase,'done');assert.equal(finalActor.recovery,null);
  assert.equal(finalActor.result?.result,'completed','A real successful result is required');
  assert(Array.isArray(finalActor.result.phases),'Authoritative result includes actual phase history');
  const requiredPhases=kind==='bottle'?['waiting','approach','close','lift','transfer','lower','verify']:['waiting','approach','close-grip','swing','verify'];
  assert.deepEqual(finalActor.result.phases,requiredPhases,'Authoritative task phases agree with the visible sequence');
  const lastFrame=frames.at(-1),lastActor=actor(lastFrame);
  assert.equal(lastActor?.phase,'done');assert.equal(lastActor.recovery,null);
  assert.equal(lastFrame.metadata.sceneEpoch,epoch);assert.equal(lastActor.taskStarted,startActor.taskStarted);
  assert.equal(lastFrame.metadata.mode,'observation');assert.equal(lastFrame.metadata.paused,false);
  assert(Math.abs(lastFrame.metadata.simulationTime-final.time)<=.0005001,'Authoritative state and completed framebuffer refer to the same physics time');
  if(kind==='bottle'){
    assert.equal(final.object.heldBy,null);assert.equal(final.object.reservedBy,null);assert.equal(final.object.constraintCount,0);
    assert.equal(final.object.supported,true);assert.equal(final.object.settled,true);assert.equal(final.object.insideTarget,true);
    assert.equal(lastFrame.metadata.bottle.heldBy,null);position(lastFrame.metadata.bottle.position,final.object.position,'Final bottle framebuffer/world pose');
    assert(taskFrames.some(f=>f.metadata.bottle.heldBy===actorId&&actor(f)?.phase==='lift'),'Visible lift includes actual bottle ownership');
    assert(taskFrames.some(f=>f.metadata.bottle.heldBy===null&&actor(f)?.phase==='verify'),'Visible verify includes an actually released bottle');
  }else{
    assert(['open','close'].includes(operation));
    assert.equal(finalActor.result.operation,operation);assert.equal(finalActor.result.taskToken,token);assert.equal(lastActor.taskToken,token);
    const object=final.window.object;assert.equal(object.heldBy,null);assert.equal(object.reservedBy,null);assert.equal(object.gripConstraintCount,0);assert.equal(object.hingeConstraintCount,1);
    assert.equal(object[operation==='open'?'goalOpen':'goalClosed'],true);assert.equal(object.settled,true);
    assert(Math.abs(object.angleDeg-(operation==='open'?-35:0))<2,'Physical window reaches the requested angle');
    assert.equal(lastFrame.metadata.window.heldBy,null);finite(lastFrame.metadata.window.angleDeg,'Rendered window angle');
    assert(Math.abs(lastFrame.metadata.window.angleDeg-object.angleDeg)<1e-8,'Final window framebuffer/world pose agrees');
    assert(taskFrames.some(f=>f.metadata.window.heldBy===actorId&&actor(f)?.phase==='swing'),'Visible swing includes actual handle ownership');
    assert(taskFrames.some(f=>f.metadata.window.heldBy===null&&actor(f)?.phase==='verify'),'Visible verify includes an actually released handle');
  }
  return {accepted:true,label,kind,actorId,operation:operation||null,actualUI:true,usedPause:false,usedExternalTick:false,
    firstSerial:startFrame.serial,lastSerial:lastFrame.serial,taskFrames:taskFrames.length,allNewFrames:frames.length,
    phaseSequence:sequence,sceneEpoch:epoch,taskStarted:startActor.taskStarted,taskToken:token,
    maxSimulationAdvanceSeconds:largestAdvance,physicsStepSeconds:STEP,
    simulationDurationSeconds:taskFrames.at(-1).metadata.simulationTime-startFrame.metadata.simulationTime,
    wallDurationMS:ui.actionFinishedAtMS-ui.actionStartedAtMS,
    scope:'Actual completed native GPU frames in an uninterrupted UI action; software-renderer speed is not a user-device performance claim'};
}
module.exports={assertContinuousRun};
