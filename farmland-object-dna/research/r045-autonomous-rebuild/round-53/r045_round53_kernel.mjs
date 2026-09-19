import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-47/r045_round47_kernel.mjs';
export const VERSION='R045.53';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map();const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;

// R52 proved that merely narrowing the smooth staircase transition is not a world-space profile control:
// on the fixed R47 footprint it increased the measured shoulder gradient and reduced the measured central-riser
// gradient. R53 therefore starts again from R47 and applies a zero-endpoint antisymmetric correction in the
// inherited phase coordinate. Its derivative is negative over both transition shoulders and positive through
// the central riser, which directly targets the sampled world-space failure while leaving terrace levels,
// footprint, step, phase and the 0.84 vertical multiplier unchanged.
function profileCorrection(f,step){
  const A=.045*step;
  if(f<=.34||f>=.66)return 0;
  if(f<.44)return -A*S(.34,.44,f);
  if(f<.46)return -A;
  if(f<.54)return M(-A,A,S(.46,.54,f));
  if(f<.56)return A;
  return A*(1-S(.56,.66,f));
}
function compute(x,z){
  const old=R47.terraceStateAt(x,z);
  if(old.mask<=.24)return{...old,profileDerivativeBlend:0,profileCorrection:0,profileRaw:old.raw,profileDelta:old.delta};
  const blend=S(.24,.62,old.mask),corr=blend*profileCorrection(old.frac,old.step),raw=old.raw+corr,delta=.84*old.mask*raw;
  return{...old,raw,delta,target:old.base+delta,profileDerivativeBlend:blend,profileCorrection:corr,profileRaw:raw,profileDelta:delta,profilePriorRaw:old.raw,profilePriorDelta:old.delta};
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

export const snapshot={...R47.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round53:{
  scope:'correct the failed R52 bench/riser profile experiment on the exact accepted R47 terrace footprint; no plan-footprint growth, no step/phase change, no terrace-height increase and no parcel/water advance',
  method:'restart from R47, not failed R52. Add a zero-endpoint antisymmetric raw-profile correction in inherited terrace phase: negative derivative across the two transition shoulders, positive derivative through the central riser, zero on established bench interiors. Blend only where inherited mask exceeds 0.24. Keep the R47 mask/group/step/phase/index/base and 0.84 multiplier exact.',
  logicCorrection:'R52 assumed that a narrower 0.44-0.56 smoothstep would automatically produce flatter world-space shoulders and a steeper sampled riser. The persisted QA falsified that assumption: median shoulder gradient rose while median central-riser gradient fell. That was a coordinate-to-world fallacy: changing transition width in phase space is not sufficient evidence for the desired finite-difference terrain gradient after base slope, mask modulation and phase warp are composed. R53 therefore controls the sign of the profile-correction derivative in the exact bands that failed and must still pass independent numeric and fixed-view gates.',
  constraint:'the 0.34-0.66 phase window, 0.045*step correction scale, strong-mask blend, 6 m QA lattice and inherited 12 m drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured riser geometry. Current 12.5 m macro DEM and photographs cannot provide field microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate states or event water-management records.',
  xiaomaBoundary:'Xiaoma/TLO remains binding: conservation or a visually cleaner profile does not establish correct water head, exchange law, parcel ownership, surveyed riser section, hydraulic connectivity, water depth, discharge, gate state, soil-water state or sediment state.',
  mrRolordUse:'the saved MrRolord study is reread as ordering discipline only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> vegetation/paths/materials. The original named video was not available to replay in this run; Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
  referenceUse:'image(173).png was reopened this run only for non-metric morphology: broad contour-following benches, comparatively concentrated dark riser edges, unequal widths, nested bends and drainage interruptions. No bench width, riser width/height, channel size or hydraulic parameter is inferred from the photograph.',
  failedPredecessor:'R52 persisted 27/29 numeric gates: shoulder median 0.40970->0.43568 (wrong direction) and riser median 0.51076->0.46474 (wrong direction). R52 is preserved and is not compounded into R53.',
  evidenceClass:'synthetic derivative-shaped profile correction inside exact accepted R47 footprint; not surveyed terrace, riser, parcel or hydraulic truth',
  forbiddenClaims:['surveyed terrace footprint','surveyed riser profile','measured bench width','measured riser width','measured riser height','measured bund section','measured channel section','known hydraulic connectivity','known water depth','known discharge','known gate state','regional truth from photograph']
}};
