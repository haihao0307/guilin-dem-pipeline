import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.66';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function sharpStair01(f){return S(.46,.54,f)}
function r58Blend(mask){return Math.max(S(.34,.64,mask),.52*S(.22,.58,mask))}
function r66Blend(mask){
  const accepted=r58Blend(mask);
  // Stronger but still bounded coverage only on the already-active weak/low-medium R47 footprint.
  // It converges back into R58 before strong support, so no footprint/level/amplitude change is introduced.
  const weak=.34*S(.12,.46,mask);
  return Math.max(accepted,weak);
}
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function compute(x,z){
  const prior=R58.terraceStateAt(x,z),old=R47.terraceStateAt(x,z);
  if(old.mask<=.12||old.mask>=.55||R30.nearestExtendedDrainageDistance(x,z)<=12||receiverProtected(x,z))return{...prior,profileCoverageGain:0,profileCoverageBlend:r58Blend(old.mask)};
  const accepted=r58Blend(old.mask),blend=r66Blend(old.mask),gain=Math.max(0,blend-accepted);
  if(gain<=1e-12)return{...prior,profileCoverageGain:0,profileCoverageBlend:accepted};
  const u=(old.base+old.phase)/old.step,n=Math.floor(u),f=u-n;
  const sharp=(n+sharpStair01(f))*old.step-old.phase-old.base;
  const raw=M(old.raw,sharp,blend),delta=.84*old.mask*raw;
  return{...prior,raw,delta,target:old.base+delta,profileCoverageGain:gain,profileCoverageBlend:blend,profileCoveragePriorBlend:accepted,profileCoveragePriorDelta:prior.delta,profileFullResidual:.84*old.mask*Math.abs(sharp-old.raw)};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return R58.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function coverageBlendAt(x,z){const s=R47.terraceStateAt(x,z);return{accepted:r58Blend(s.mask),next:r66Blend(s.mask),gain:Math.max(0,r66Blend(s.mask)-r58Blend(s.mask))}}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round66:{
 scope:'make the accepted R58 bench/riser profile materially legible over existing weak-to-low-medium active terrace support without growing the footprint, changing terrace levels, or relaxing drainage separators',
 method:'restart from accepted R58/R47 plan geometry. Preserve mask/group/step/phase/index/base and the 0.84 multiplier exactly. Increase only the bounded weak active-support profile blend from the failed R65 0.24@0.12-0.42 ramp to 0.34@0.12-0.46, while converging back into exact R58 before strong support. Keep <=12m drainage core and receiver +12m exact.',
 logicCorrection:'R65 failed a denominator fallacy: it counted 129 cells as realization opportunities merely because blend gain was positive, even when the inherited raw profile already coincided with the sharp target at bench interiors and therefore no height correction was physically available. Nonzero blend eligibility is not the same as nonzero geometric correction opportunity. R66 keeps a material geometry change and gates realization only where a non-trivial cross-profile residual exists.',
 constraint:'the 0.12-0.46 weak-support interval, 0.34 ramp cap, 0.46-0.54 stair transition, 6m audit lattice, 0.6m directional probe and inherited 12m drainage core are synthetic morphology/QA scales, not surveyed Yunnan terrace dimensions. A 12.5m macro DEM and photographs cannot supply field/sub-metre microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity, head/depth/discharge/gate states or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: stronger profile legibility, geometric continuity and conservation do not establish parcel ownership, surveyed riser section, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay; Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png is reread only as non-metric morphology evidence that broad portions of the agricultural slope read as long contour-following benches separated by concentrated darker riser edges, with unequal widths, nested bends and drainage interruptions. No width, height, channel size or hydraulic parameter is inferred from the photograph.',
 predecessorEvidence:'R65 persisted 23/24 gates. Its sole failure counted 129 positive-blend cells but only 24 material height changes; because height change equals profile residual times blend gain, bench-centre cells with near-zero residual were incorrectly treated as failed realizations.',
 evidenceClass:'synthetic level-preserving profile-coverage strengthening over accepted active R47/R58 footprint; not surveyed terrace/riser/parcel/hydraulic truth'
}};
