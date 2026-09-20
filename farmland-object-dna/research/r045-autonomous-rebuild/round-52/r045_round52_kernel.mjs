import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-47/r045_round47_kernel.mjs';
export const VERSION='R045.52';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map();const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function sharpStair01(f){return S(.44,.56,f)}
function compute(x,z){
 const old=R47.terraceStateAt(x,z);if(old.mask<=0)return{...old,profileSharpenBlend:0,profileRaw:old.raw,profileDelta:old.delta};
 const u=(old.base+old.phase)/old.step,n=Math.floor(u),f=u-n,sharp=(n+sharpStair01(f))*old.step-old.phase-old.base;
 // Preserve weak footprint shoulders and concentrate the change where terrace geometry is already strongly
 // established. This changes bench/riser profile only; plan support, step, phase and vertical multiplier stay fixed.
 const blend=S(.24,.68,old.mask),raw=M(old.raw,sharp,blend),delta=.84*old.mask*raw;
 return{...old,raw,delta,target:old.base+delta,profileSharpenBlend:blend,profileRaw:raw,profileDelta:delta,profilePriorRaw:old.raw,profilePriorDelta:old.delta};
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
export const snapshot={...R47.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round52:{
 scope:'stop unsuccessful footprint growth and test the next terrace-geometry variable: bench/riser profile concentration inside the already accepted R47 support; plan footprint, drainage, step, phase and 0.84 amplitude remain fixed',
 method:'start from accepted R47 rather than compounding failed R49-R51 candidates. Preserve R47 mask, group, step and phase exactly. Recompute only the stair transition with the same lower/upper quantized terrace levels but a 0.44-0.56 smooth transition instead of the inherited 0.40-0.60 transition, blended in only where inherited support is strong (mask 0.24-0.68). The 0.84 vertical multiplier is unchanged; weak support shoulders and every zero-support/drainage cell remain identical.',
 logicCorrection:'R49, R50 and R51 independently tried larger support clouds, zero-mask activation and one-shell tangent growth yet produced only 3, 3 and 1 threshold crossings. Continuing to assume footprint continuity is the dominant visual defect after those falsifications would be confirmation bias. The accepted footprint is locally saturated under the current family/drainage/stair constraints. R52 therefore changes a different causal variable—profile concentration—without raising terrace step height or expanding footprint. A sharper riser is not evidence of the surveyed riser section, so it remains a visual morphology experiment and must pass a separate fixed-view gate.',
 constraint:'the 0.44-0.56 transition interval, strong-mask blend, 6 m QA lattice and inherited 12 m drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured riser geometry. Current 12.5 m macro DEM and photographs cannot provide field microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate states or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: a crisper visible bench/riser profile does not establish parcel ownership, surveyed riser section, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord frame audit remains ordering discipline only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> vegetation/paths/materials. Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread only for non-metric morphology: terrace benches read as broad contour-following bands separated by comparatively concentrated riser edges, while widths vary and drainage interruptions remain. No bench width, riser width/height, channel size or hydraulic parameter is inferred from the photograph.',
 failedPredecessors:'R49=33/34 with 3 crossings; R50=28/29 with 3 crossings; R51=25/29 with 1 crossing. All are preserved as failed support-expansion tests and are not compounded into R52.',
 evidenceClass:'synthetic profile-concentration test inside accepted R47 terrace footprint; not surveyed terrace, riser, parcel or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed riser profile','measured bench width','measured riser width','measured riser height','measured bund section','measured channel section','known hydraulic connectivity','known water depth','known discharge','known gate state','regional truth from photograph']
}};
