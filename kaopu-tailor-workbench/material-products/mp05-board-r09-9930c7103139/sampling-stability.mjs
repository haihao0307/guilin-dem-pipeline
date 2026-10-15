/** Screen-error hysteresis. Animation may refine, but never repeatedly coarsens
 * the same stationary view. Camera changes and paused inspection still release
 * excess samples after settling. Original intervals and plies are untouched.
 */
export function stableSampling(chunk,target,{now,moving,cameraChangedAt}){
 const current=chunk.current;chunk.samplingWakeAt=null;
 if(!chunk.samplingInitialized){chunk.samplingInitialized=true;return target;}
 if(chunk.previous)return null;
 const finer=target.segments>current.segments*1.15||target.sides>current.sides*1.15;
 const coarser=target.segments<current.segments*.72||target.sides<current.sides*.72;
 const quietCamera=now-cameraChangedAt>280;
 if(finer){
  chunk.refineSince??=now;
  if(now-chunk.refineSince<100){chunk.samplingWakeAt=chunk.refineSince+100;return null;}
  chunk.refineSince=null;
  // No simultaneous coarsening of the other axis during an animated refine.
  return {...target,segments:Math.max(target.segments,current.segments),sides:Math.max(target.sides,current.sides)};
 }
 chunk.refineSince=null;
 if(coarser&&!quietCamera&&(!moving||chunk.cameraSamplingDirty))chunk.samplingWakeAt=cameraChangedAt+285;
 if(coarser&&quietCamera&&(!moving||chunk.cameraSamplingDirty)){
  chunk.cameraSamplingDirty=false;return target;
 }
 return null;
}
