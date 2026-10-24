const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

/** Clear the real counter and the measured hand envelope before lowering.
 * This only proposes a palm path. NativeMotion's immutable-bone solver and
 * ItemWorld's finite-force object constraints still decide actual success.
 */
export function breadTransportGoal(source,bag,progress,clearance) {
  if(!clearance||!Number.isFinite(clearance.palmClearanceY)||
    !Array.isArray(clearance.exitPoint)||clearance.exitPoint.some(v=>!Number.isFinite(v)))
    throw Error('Bread transport requires measured scene and native hand clearance');
  const raised=[source[0],Math.max(source[1],clearance.palmClearanceY),source[2]],
    outside=[clearance.exitPoint[0],raised[1],clearance.exitPoint[2]];
  if(progress<.69)return {goal:lerp(source,raised,smooth((progress-.55)/.14)),stage:'lift-clear-of-counter'};
  if(progress<.84)return {goal:lerp(raised,outside,smooth((progress-.69)/.15)),stage:'clear-counter-edge'};
  return {goal:lerp(outside,bag,smooth((progress-.84)/.16)),stage:progress<.98?'lower-to-bag':'at-bag'};
}
