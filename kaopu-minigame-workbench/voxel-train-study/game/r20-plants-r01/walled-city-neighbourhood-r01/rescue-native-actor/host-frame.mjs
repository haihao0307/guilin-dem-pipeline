/** Host placement and monotonic clock only. No renderer, timer or geometry. */
export function validateActorFrame({worldSeconds,actor}={}) {
  if (!Number.isFinite(worldSeconds) || worldSeconds < 0) throw Error('Finite nonnegative worldSeconds required');
  if (!actor || typeof actor.id !== 'string' || !actor.id) throw Error('Actor id required');
  for (const key of ['position','direction']) if (!Array.isArray(actor[key]) || actor[key].length !== 3 || !actor[key].every(Number.isFinite)) throw Error('Finite actor.' + key + ' required');
  if (!['stand','walk'].includes(actor.pose)) throw Error('Only original stand/walk poses are available');
  if (typeof actor.moving !== 'boolean' || actor.moving !== (actor.pose === 'walk')) throw Error('Actor moving/pose mismatch');
  return {elapsed:worldSeconds,actor};
}
export function extractHorizontalRoot(frame) {
  if (!frame || !Array.isArray(frame.rootTranslation) || frame.rootTranslation.length !== 3 || !frame.rootTranslation.every(Number.isFinite)) throw Error('Native root translation required');
  const sourceRootTranslation = [...frame.rootTranslation], [x,y] = sourceRootTranslation;
  const copy = matrices => matrices.map(m => {const a=Float64Array.from(m);a[3]-=x;a[7]-=y;return a;});
  return {...frame,posedMatrices:copy(frame.posedMatrices),skinMatrices:copy(frame.skinMatrices),rootTranslation:[0,0,sourceRootTranslation[2]],sourceRootTranslation};
}
export function createHostFrameController({id,group,nativeBinding,selectPose,duration,readHeading}={}) {
  if (typeof id !== 'string' || !group?.position?.set || !group?.rotation || !nativeBinding?.update || typeof selectPose !== 'function' || !(duration > 0)) throw Error('Host actor dependencies required');
  let last=null,pose=null,start=0,lastInput=null;
  return {applyFrame(input) {
    const {elapsed,actor}=validateActorFrame(input);
    if(actor.id!==id)throw Error('Wrong actor identity');
    const signature=JSON.stringify(actor);
    if(last!==null && elapsed<last)throw Error('World rewind requires a new actor take');
    if(elapsed===last) {if(signature!==lastInput)throw Error('Actor state changed while host clock is paused');return this.report();}
    const nextStart=pose!==actor.pose?elapsed:start;
    const localTime=elapsed-nextStart;
    selectPose(actor.pose,localTime,{elapsed,actor});
    // Pose must evaluate successfully before changing placement or host bookkeeping.
    nativeBinding.update({elapsed});
    group.position.set(...actor.position);
    if(typeof readHeading==='function'){const heading=readHeading();if(!Number.isFinite(heading))throw Error('Finite native heading required');group.rotation.y=heading;}else if(Math.hypot(actor.direction[0],actor.direction[2])>1e-9)group.rotation.y=Math.atan2(actor.direction[0],actor.direction[2]);
    group.updateWorldMatrix(true,true);
    start=nextStart;pose=actor.pose;last=elapsed;lastInput=signature;
    return this.report();
  },report(){return {id,elapsed:last,pose,localTime:last===null?0:last-start,duration,walkExhausted:pose==='walk'&&last-start>=duration,loop:false,rootMotion:'native horizontal translation extracted; host controls planar route',grounding:'original neutral floor offset; no stair/contact solve',pausePreserved:true};}};
}
