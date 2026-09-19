import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.65';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function sharpStair01(f){return S(.46,.54,f)}
function r58Blend(mask){return Math.max(S(.34,.64,mask),.52*S(.22,.58,mask))}
function r65Blend(mask){
  const accepted=r58Blend(mask);
  // Broaden profile coverage over already-active weak/low-medium R47 support without changing mask/levels.
  // This is not footprint growth. The weak ramp converges back into the accepted R58 coverage by ~0.42 mask.
  const weak=.24*S(.12,.42,mask);
  return Math.max(accepted,weak);
}
function receiverProtected(x,z){const gap=Math.abs(z-R30.riverZ(x));return gap<=R30.riverW(x)+12}
function compute(x,z){
  const prior=R58.terraceStateAt(x,z),old=R47.terraceStateAt(x,z);
  if(old.mask<=.12||R30.nearestExtendedDrainageDistance(x,z)<=12||receiverProtected(x,z))return{...prior,weakCoverageGain:0,weakCoverageBlend:r58Blend(old.mask)};
  const accepted=r58Blend(old.mask),blend=r65Blend(old.mask),gain=Math.max(0,blend-accepted);
  if(gain<=1e-12)return{...prior,weakCoverageGain:0,weakCoverageBlend:accepted};
  const u=(old.base+old.phase)/old.step,n=Math.floor(u),f=u-n;
  const sharp=(n+sharpStair01(f))*old.step-old.phase-old.base;
  const raw=M(old.raw,sharp,blend),delta=.84*old.mask*raw;
  return{...prior,raw,delta,target:old.base+delta,weakCoverageGain:gain,weakCoverageBlend:blend,weakCoveragePriorBlend:accepted,weakCoveragePriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return R58.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function coverageBlendAt(x,z){const s=R47.terraceStateAt(x,z);return{accepted:r58Blend(s.mask),next:r65Blend(s.mask),gain:Math.max(0,r65Blend(s.mask)-r58Blend(s.mask))}}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round65:{
 scope:'stop chasing a handful of new footprint cells and instead extend the already-accepted R58 level-preserving bench/riser profile across existing weak-to-low-medium active terrace support; keep footprint, terrace levels, hydrology and 0.84 amplitude fixed',
 method:'start from accepted R58/R47 plan geometry. Preserve mask/group/step/phase/index/base exactly and preserve the same 0.46-0.54 quantized stair target and 0.84 vertical multiplier. Add only a bounded 0.24 smooth coverage ramp from inherited active threshold 0.12 to mask 0.42, taking max with the exact R58 strong/medium blend. Never touch inactive cells, <=12m hard drainage, or the foreground receiver +12m band.',
 logicCorrection:'R62-R64 showed that local footprint growth is the wrong bottleneck for hillside-scale legibility: the authoritative 6m slope has 548 already-active terrace cells but only 16 inactive weak cells that even clear inherited safety, and only seven of those are directly adjacent to accepted active topology. Requiring ever more promoted cells would turn an arbitrary count gate into geometry truth and would pressure the algorithm to cross legitimate separators. R65 therefore changes the causal variable that actually controls broad visual reading—profile coverage on the 548 existing active cells—without adding one square metre of footprint. This is a wrong-bottleneck correction, not a relaxed drainage or topology gate.',
 constraint:'the 0.12-0.42 coverage interval, 0.24 weak-ramp cap, 0.46-0.54 stair transition, 6m audit lattice, 0.6m directional probe and inherited 12m drainage core are synthetic morphology/QA scales, not surveyed Yunnan terrace dimensions. A 12.5m macro DEM and photographs cannot supply field/sub-metre microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity, head/depth/discharge/gate states or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: a more legible bench/riser profile, geometric continuity and conservation do not establish parcel ownership, surveyed riser section, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay; Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png is reread only as non-metric morphology evidence that broad portions of the agricultural slope read as long contour-following benches separated by concentrated darker riser edges, with unequal widths, nested bends and drainage interruptions. No width, height, channel size or hydraulic parameter is inferred from the photograph.',
 failedLocalGrowthEvidence:'R62=24/27 with 4 gains; R63=23/27 with 5 gains plus one new orphan; R64=22/25 with 4 directly attached gains. R64 diagnostic counted only 16 safety-eligible inactive weak cells versus 548 accepted active cells, demonstrating that footprint promotion is not the materiality bottleneck.',
 evidenceClass:'synthetic level-preserving profile-coverage extension over accepted active R47/R58 footprint; not surveyed terrace/riser/parcel/hydraulic truth'
}};
