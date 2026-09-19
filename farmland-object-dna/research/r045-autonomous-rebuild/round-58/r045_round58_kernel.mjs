import * as R56 from '../round-56/r045_round56_kernel.mjs';
import * as R54 from '../round-54/r045_round54_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-56/r045_round56_kernel.mjs';
export const VERSION='R045.58';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map();const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function sharpStair01(f){return S(.46,.54,f)}
function coverageBlend(mask){
  const prior=S(.34,.64,mask);
  // R57 used 0.82 and the authoritative 6 m audit exposed a 1.1129 m / 3 m local increment.
  // R58 reduces only the new medium-support spread; the accepted strong-support profile stays exact.
  const spread=.52*S(.22,.58,mask);
  return Math.max(prior,spread);
}
function compute(x,z){
  const old=R47.terraceStateAt(x,z);
  if(old.mask<=.22)return{...old,coverageProfileBlend:0,coverageProfileGain:0,coverageProfilePriorDelta:R56.terraceDelta(x,z)};
  const u=(old.base+old.phase)/old.step,n=Math.floor(u),f=u-n;
  const sharp=(n+sharpStair01(f))*old.step-old.phase-old.base;
  const priorBlend=S(.34,.64,old.mask),blend=coverageBlend(old.mask),raw=M(old.raw,sharp,blend),delta=.84*old.mask*raw;
  return{...old,raw,delta,target:old.base+delta,coverageProfileBlend:blend,coverageProfileGain:Math.max(0,blend-priorBlend),coverageProfilePriorDelta:R56.terraceDelta(x,z)};
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

export const snapshot={...R56.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round58:{
 scope:'retain the R57 idea of extending the accepted R54/R56 bench-riser profile into existing medium R47 terrace support, but cap that new coverage so the original 6 m / 3 m cliff gate is respected instead of hiding the extremum with a coarser audit lattice',
 method:'freeze the R47 mask/group/step/phase/index/base and the 0.84 vertical multiplier. Keep the accepted R54/R56 0.46-0.54 strong-support profile exactly. Change only the extra medium-support blend cap from the failed R57 value 0.82 to 0.52; no new footprint, no level shift, no drainage relaxation.',
 logicCorrection:'R57 first failed the original 6 m audit because a local 3 m increment reached 1.112919833351231 m, above the fixed 1.05 m gate. A later 12 m audit missed that extremum and therefore produced an apparent pass. Treating the coarser pass as proof would be a measurement-coarsening fallacy. R58 restores the 6 m whole-slope change search and evaluates 3 m neighbors at every changed 6 m cell; it fixes the geometry rather than weakening or spatially skipping the safety gate.',
 constraint:'the 0.22/0.58 support thresholds, 0.52 spread cap, 0.46-0.54 transition, 6 m audit lattice and inherited 12 m drainage hard core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM and photographs cannot provide field microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate state or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric adjacency and a more legible terrace profile do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay in this run; Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is reread only as non-metric morphology evidence: long contour-following benches separated by concentrated darker riser edges over broad portions of the agricultural slope, unequal widths, nested bends and drainage interruptions. No width, height, channel size or hydraulic parameter is inferred from it.',
 evidenceClass:'synthetic medium-support profile-coverage correction on the accepted R47 footprint; not surveyed terrace/riser/parcel/hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed riser profile','measured bench width','measured riser width','measured riser height','measured bund section','measured channel section','known hydraulic connectivity','known water depth','known discharge','known gate state','regional truth from photograph']
}};
