import * as R66 from '../round-66/r045_round66_kernel.mjs';
import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-66/r045_round66_kernel.mjs';

export const VERSION='R045.67';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map(),RUN_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function sharpStair01(f){return S(.46,.54,f)}
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);return m<1e-9?{tx:1,tz:0}:{tx:-gz/m,tz:gx/m}}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.18,.22*step)&&Math.abs(a.index-b.index)<=1}
function safeFrozen(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function runEvidence(x,z){
 const k=keyOf(x,z);let q=RUN_CACHE.get(k);if(q!==undefined)return q;
 const base=R47.terraceStateAt(x,z);
 if(base.mask<=.12||!safeFrozen(x,z)){q={coherence:0,span:0,supports:0,left:0,right:0};RUN_CACHE.set(k,q);return q}
 const t=contourTangent(x,z);let left=0,right=0,supports=0,weighted=0;
 for(const side of [-1,1]){
  let reach=0;
  for(const d of [6,12,18]){
   const xx=x+side*d*t.tx,zz=z+side*d*t.tz,s=R47.terraceStateAt(xx,zz);
   if(!safeFrozen(xx,zz)||s.mask<=.12||!compatible(base,s))break;
   reach=d;supports++;weighted+=d===6?1:d===12?.85:.7;
  }
  if(side<0)left=reach;else right=reach;
 }
 const bilateral=Math.min(left,right),span=left+right;
 const coverage=C(weighted/5.1,0,1),bilateralScore=S(5,18,bilateral),spanScore=S(12,36,span);
 const coherence=C(.40*coverage+.36*bilateralScore+.24*spanScore,0,1);
 q={coherence,span,supports,left,right};RUN_CACHE.set(k,q);return q;
}
function runBlendAt(x,z,old){
 const prior=R66.coverageBlendAt(x,z).next,ev=runEvidence(x,z);
 if(old.mask<=.12||old.mask>=.82||ev.coherence<=.18)return{prior,next:prior,gain:0,...ev};
 const maskWindow=S(.12,.28,old.mask)*(1-S(.68,.82,old.mask));
 const gain=.20*ev.coherence*maskWindow;
 return{prior,next:C(prior+gain,0,1),gain,...ev};
}
function compute(x,z){
 const prior=R66.terraceStateAt(x,z),old=R47.terraceStateAt(x,z);
 if(old.mask<=.12||old.mask>=.82||!safeFrozen(x,z))return{...prior,runCoherenceGain:0,runCoherence:0,runSpan:0};
 const rb=runBlendAt(x,z,old);if(rb.gain<=1e-12)return{...prior,runCoherenceGain:0,runCoherence:rb.coherence,runSpan:rb.span};
 const u=(old.base+old.phase)/old.step,n=Math.floor(u),f=u-n,sharp=(n+sharpStair01(f))*old.step-old.phase-old.base;
 let raw=M(old.raw,sharp,rb.next),delta=.84*old.mask*raw;
 const dd=delta-prior.delta,cap=.045;if(Math.abs(dd)>cap){delta=prior.delta+C(dd,-cap,cap);raw=old.mask>1e-9?delta/(.84*old.mask):old.raw}
 return{...prior,raw,delta,target:old.base+delta,runCoherenceGain:rb.gain,runCoherence:rb.coherence,runSpan:rb.span,runSupports:rb.supports,runLeft:rb.left,runRight:rb.right,runPriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function contourRunEvidenceAt(x,z){return runEvidence(x,z)}
export function contourRunBlendAt(x,z){return runBlendAt(x,z,R47.terraceStateAt(x,z))}
export function terraceGroupMask(x,z){return R66.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R66.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round67:{
 scope:'advance from sparse local residual correction to slope-scale readability by sharpening only frozen, bilateral, same-family/same-level contour runs inside the already accepted R47/R58 footprint; do not grow footprint, move levels, raise riser amplitude globally, or relax drainage separators',
 method:'use only frozen R47 evidence. At each existing active cell, sample 6/12/18 m in both local R30 contour-tangent directions. Same family, compatible step/index, inherited active support and drainage/receiver clearance are required at every sampled support. Convert bilateral span/support into a bounded coherence weight, then add at most 0.20 profile-blend coverage and cap the R67-R66 local delta change at 0.045 m. R67 output never seeds its own evidence.',
 logicCorrection:'R66 proving 28 physically real local corrections does not imply the hillside reads as a coherent terrace system. Counting changed cells is a materiality check, not a macro-organization proof. R67 therefore requires frozen bilateral contour-run evidence before changing a profile and will gate the result by connected changed runs and physical span, not by point count alone.',
 constraint:'the 6/12/18 m support probes, 0.18 coherence floor, 0.20 blend cap, 0.045 m per-point change cap, 6 m audit lattice and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity, head/depth/discharge/gate states or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: a longer continuous contour ribbon, geometric adjacency and conservation are not evidence of parcel ownership, surveyed riser section, hydraulic exchange, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available in the current run to replay, and Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'the retained user terrace reference is used only as non-metric morphology evidence: broad portions of one agricultural slope should read as long curved contour-following benches, unequal widths, nested bends and drainage interruptions. No terrace width, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-run profile-coherence strengthening over accepted terrace footprint; not surveyed terrace, parcel or hydraulic truth'
}};
