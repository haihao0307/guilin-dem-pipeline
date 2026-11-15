/** Advance original physics only after its preceding native image has completed. */
export function createObservationClock({step=1/120,maxAdvanceSeconds=.12,now=()=>performance.now()}={}){
  let last=now(),carry=0,slowMode=false,physicsSteps=0,wallStarted=last,completedFrames=0,lastCompleted=null;const trace=[];
  function advance({canAdvance,paused=false,phaseKey,tick}){
    const current=now(),elapsed=Math.max(0,(current-last)/1000);last=current;
    if(paused){carry=0;return 0;}carry=Math.min(carry+elapsed,maxAdvanceSeconds);
    if(!canAdvance)return 0;const initial=phaseKey();let count=0;
    while(carry+1e-10>=step){tick(step);carry=Math.max(0,carry-step);count++;physicsSteps++;if(phaseKey()!==initial)break;}
    return count;
  }
  function complete(frame){const record={...frame,metadata:frame.metadata==null?null:structuredClone(frame.metadata)};completedFrames++;slowMode=frame.durationMS>120;lastCompleted=record;trace.push(record);if(trace.length>1500)trace.shift();}
  function reset(){carry=0;last=now();}
  function summary(){return{mode:'frame-acknowledged-observation',fixedPhysicsStep:step,maxAdvanceSeconds,slowMode,physicsSteps,completedFrames,wallElapsedMS:now()-wallStarted,lastCompleted,scope:'metadata captured at native render submission and retained only after actual GPU fence completion; slow rendering stretches wall time, never physics step size'};}
  function snapshot(){return{...summary(),completedFrameTrace:trace.map(f=>({...f,metadata:f.metadata==null?null:structuredClone(f.metadata)}))};}
  return{advance,complete,reset,summary,snapshot};
}
