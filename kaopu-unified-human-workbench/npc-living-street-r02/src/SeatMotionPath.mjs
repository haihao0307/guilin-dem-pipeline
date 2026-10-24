/** One seat-root trajectory shared by decisions and native execution.
 * This is the unchanged R02 NativeMotion two-step / lower-pelvis curve. Keeping
 * it here ensures navigation checks the position that is actually rendered.
 */
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function seatRootOffset(seatFactor,approachOffset=.65){
  const t=clamp(seatFactor),close=Math.min(.30,approachOffset);
  const shuffles=(smooth(t/.14)+smooth((t-.14)/.14))*.5,lower=smooth((t-.28)/.72);
  return (approachOffset+(close-approachOffset)*shuffles)*(1-lower);
}
export function taskSeatFactor(task,progress=task.progress){
  return task.phase==='rest'?1:task.phase==='depart'?(task.standStartFactor??1)*(1-clamp(progress)):clamp(progress);
}
