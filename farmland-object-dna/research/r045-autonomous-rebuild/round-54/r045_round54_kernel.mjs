import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-47/r045_round47_kernel.mjs';
export const VERSION='R045.54';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map();const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;

// R53 proved that prescribing a correction derivative in phase coordinates is still not a reliable control
// of the physical riser/bench reading: total world-gradient magnitude is a vector quantity after R30 base slope,
// phase warp and support-mask gradients are composed. R54 therefore changes both the geometry variable and the
// measurement frame. Geometry returns to the explicit quantized stair family, but only inside strong frozen R47
// support, and narrows the transition without altering terrace levels, footprint, step, phase or amplitude.
// Verification is performed along the local R30 cross-contour normal, which is the physical direction in which a
// bench-to-riser profile is meant to sharpen; tangential terrain slope is not allowed to masquerade as riser slope.
function sharpStair01(f){return S(.46,.54,f)}
function compute(x,z){
  const old=R47.terraceStateAt(x,z);
  if(old.mask<=.24)return{...old,worldProfileBlend:0,worldProfileRaw:old.raw,worldProfileDelta:old.delta};
  const u=(old.base+old.phase)/old.step,n=Math.floor(u),f=u-n;
  const sharp=(n+sharpStair01(f))*old.step-old.phase-old.base;
  const blend=S(.34,.64,old.mask),raw=M(old.raw,sharp,blend),delta=.84*old.mask*raw;
  return{...old,raw,delta,target:old.base+delta,worldProfileBlend:blend,worldProfileRaw:raw,worldProfileDelta:delta,worldProfilePriorRaw:old.raw,worldProfilePriorDelta:old.delta};
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

export const snapshot={...R47.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round54:{
  scope:'replace failed phase-derivative profile correction with a physical cross-contour bench/riser concentration test on the exact accepted R47 footprint; no plan growth, no terrace-level increase, no parcel/water advance',
  method:'restart from accepted R47, not failed R52/R53. Preserve R47 mask/group/step/phase/index/base and the 0.84 vertical multiplier exactly. In inherited support above mask 0.24, blend toward the same quantized lower/upper terrace levels with a 0.46-0.54 transition, using only inherited mask strength. Numeric QA measures the resulting surface along the local R30 cross-contour normal rather than total gradient magnitude, so tangential hillside slope cannot be mistaken for bench/riser steepness.',
  logicCorrection:'R53 shows a second coordinate fallacy: even a correction with the intended derivative sign in terrace phase did not deliver the intended physical shoulder/riser slopes. The previous QA also used total gradient magnitude, which mixes cross-contour terrace profile with tangential terrain slope. R54 therefore separates the two: geometry uses an explicit level-preserving stair concentration, while acceptance measures the directional derivative along the physical macro-slope normal and independently locks footprint, drainage and terrace levels.',
  constraint:'the 0.46-0.54 transition interval, 0.34-0.64 strong-mask blend, 1.5 m directional finite difference, 6 m QA lattice and inherited 12 m drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured riser geometry. Current 12.5 m macro DEM and photographs cannot provide field microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate states or event water-management records.',
  xiaomaBoundary:'Xiaoma/TLO remains binding: a cleaner cross-contour profile or conservation-compatible geometry does not establish parcel ownership, surveyed riser section, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
  mrRolordUse:'the saved MrRolord study is reread as ordering discipline only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay in this run; Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
  referenceUse:'the available terrace reference is used only for non-metric morphology: broad contour-following benches separated by more concentrated riser edges, unequal widths, nested bends and drainage interruptions. No bench width, riser width/height, channel size or hydraulic parameter is inferred from the photograph.',
  failedPredecessors:'R52 persisted a world-gradient shoulder increase and riser decrease after a narrower phase transition. R53 persisted 20/22 numeric gates: shoulder total-gradient ratio 1.01899 and riser ratio 1.00598, so its signed phase correction is preserved as a failed candidate and is not compounded.',
  evidenceClass:'synthetic level-preserving strong-support profile concentration measured in a physical cross-contour frame; not surveyed terrace, riser, parcel or hydraulic truth',
  forbiddenClaims:['surveyed terrace footprint','surveyed riser profile','measured bench width','measured riser width','measured riser height','measured bund section','measured channel section','known hydraulic connectivity','known water depth','known discharge','known gate state','regional truth from photograph']
}};
