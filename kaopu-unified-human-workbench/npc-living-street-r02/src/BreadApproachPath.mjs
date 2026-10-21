const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
/** Raise the complete native hand outside the measured counter, approach
 * above it, then lower to the real loaf. Does not change the prop transform. */
export function breadApproachGoal(relaxed,source,progress,clearance){
  if(!clearance||!Number.isFinite(clearance.palmClearanceY))throw Error('Bread approach requires the actual counter and hand clearance');
  const height=Math.max(source[1],clearance.palmClearanceY),raised=[relaxed[0],height,relaxed[2]],above=[source[0],height,source[2]];
  if(progress<.15)return{goal:lerp(relaxed,raised,smooth(progress/.15)),stage:'raise-hand-before-counter'};
  if(progress<.25)return{goal:lerp(raised,above,smooth((progress-.15)/.10)),stage:'approach-above-counter'};
  return{goal:lerp(above,source,smooth((progress-.25)/.05)),stage:'lower-hand-to-loaf'};
}
