import * as R56 from '../round-56/r045_round56_kernel.mjs';
import * as R54 from '../round-54/r045_round54_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-56/r045_round56_kernel.mjs';
export const VERSION='R045.57';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map();const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function sharpStair01(f){return S(.46,.54,f)}
function coverageBlend(mask){const prior=S(.34,.64,mask);const spread=.82*S(.22,.58,mask);return Math.max(prior,spread)}
function compute(x,z){
  const old=R47.terraceStateAt(x,z);
  if(old.mask<=.22)return{...old,coverageProfileBlend:0,coverageProfileGain:0,coverageProfilePriorDelta:old.delta};
  const u=(old.base+old.phase)/old.step,n=Math.floor(u),f=u-n;
  const sharp=(n+sharpStair01(f))*old.step-old.phase-old.base;
  const priorBlend=S(.34,.64,old.mask),blend=coverageBlend(old.mask),raw=M(old.raw,sharp,blend),delta=.84*old.mask*raw;
  return{...old,raw,delta,target:old.base+delta,coverageProfileBlend:blend,coverageProfileGain:Math.max(0,blend-priorBlend),coverageProfilePriorDelta:R54.terraceDelta(x,z)};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return R47.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R56.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round57:{
 scope:'extend the accepted R54/R56 bench-riser concentration from only the strongest R47 terrace support into the medium-support contour ribbons, without changing the R47 plan footprint, terrace levels, drainage separators or vertical multiplier',
 method:'keep the R47 mask/group/step/phase/index/base and the 0.84 vertical multiplier exact. Reuse the same level-preserving 0.46-0.54 stair transition as R54, but add a bounded medium-support profile blend that starts only above mask 0.22 and never exceeds the prior strong-support blend once the prior blend dominates. Cells at mask >=0.64 therefore remain exactly R56/R54. New QA measures how many medium-support cells actually change, whether at least two terrace families participate, whether the strong core is bitwise unchanged, and whether drainage/receiver locks and the 3 m cliff bound remain intact.',
 logicCorrection:'R56 proved the physical cross-contour bench/riser profile is valid on strong support, but that does not imply a whole hillside will read as terraced if the same profile is applied only to the strongest mask core. This would be a sampling-to-coverage fallacy: local profile validity is necessary but not sufficient for slope-scale legibility. R57 therefore changes only profile coverage inside already accepted R47 terrace support; it does not invent new terrace footprint or use higher risers as a substitute for organization.',
 constraint:'the 0.22/0.58 support thresholds, 0.82 spread cap, 0.46-0.54 transition, 6 m QA lattice and inherited 12 m drainage hard core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM and photographs cannot provide field microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate state or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric adjacency and a more legible terrace profile do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay in this run; Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is reread only as non-metric morphology evidence: long contour-following benches remain visibly separated by concentrated darker riser edges over broad portions of the agricultural slope, with unequal widths, nested bends and drainage interruptions. No width, height, channel size or hydraulic parameter is inferred from it.',
 evidenceClass:'synthetic medium-support profile-coverage extension on the accepted R47 footprint; not surveyed terrace/riser/parcel/hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed riser profile','measured bench width','measured riser width','measured riser height','measured bund section','measured channel section','known hydraulic connectivity','known water depth','known discharge','known gate state','regional truth from photograph']
}};
