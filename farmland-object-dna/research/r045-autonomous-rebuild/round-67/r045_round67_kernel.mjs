import * as R66 from '../round-66/r045_round66_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-66/r045_round66_kernel.mjs';

export const VERSION='R045.67';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const CACHE=new Map(),RUN_CACHE=new Map(),FROZEN=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const DIRS=[[6,0],[-6,0],[0,6],[0,-6],[6,6],[6,-6],[-6,6],[-6,-6]];
function frozenAt(x,z){const k=keyOf(x,z);let v=FROZEN.get(k);if(v===undefined){v=R47.terraceStateAt(x,z);FROZEN.set(k,v)}return v}
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);return m<1e-9?{tx:1,tz:0}:{tx:-gz/m,tz:gx/m}}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.18,.22*step)&&Math.abs(a.index-b.index)<=1}
function safeFrozen(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function bestLatticeDir(t,side){let best=null;for(const [dx,dz] of DIRS){const len=Math.hypot(dx,dz),dot=side*(dx*t.tx+dz*t.tz)/len;if(dot<=0)continue;if(!best||dot>best.align)best={dx,dz,align:dot,stepLength:len}}return best}
function runEvidence(x,z){
 const k=keyOf(x,z);let q=RUN_CACHE.get(k);if(q!==undefined)return q;
 const base=frozenAt(x,z);
 if(base.mask<=.12||!safeFrozen(x,z)){q={coherence:0,span:0,supports:0,left:0,right:0,leftAlign:0,rightAlign:0};RUN_CACHE.set(k,q);return q}
 const t=contourTangent(x,z);let left=0,right=0,supports=0,weighted=0,leftAlign=0,rightAlign=0;
 for(const side of [-1,1]){
  const dir=bestLatticeDir(t,side);let reach=0;if(!dir||dir.align<.70)continue;
  for(const n of [1,2,3]){
   const xx=x+n*dir.dx,zz=z+n*dir.dz,s=frozenAt(xx,zz);
   if(!safeFrozen(xx,zz)||s.mask<=.12||!compatible(base,s))break;
   reach=n*dir.stepLength;supports++;weighted+=n===1?1:n===2?.85:.7;
  }
  if(side<0){left=reach;leftAlign=dir.align}else{right=reach;rightAlign=dir.align}
 }
 const bilateral=Math.min(left,right),span=left+right;
 const coverage=C(weighted/5.1,0,1),bilateralScore=S(5,18,bilateral),spanScore=S(12,36,span),alignmentScore=.5*(leftAlign+rightAlign);
 const coherence=C(.34*coverage+.34*bilateralScore+.20*spanScore+.12*alignmentScore,0,1);
 q={coherence,span,supports,left,right,leftAlign,rightAlign};RUN_CACHE.set(k,q);return q;
}
function runProfileCorrection(f,step){
 const A=.018*step;
 if(f<=.32||f>=.68)return 0;
 if(f<.42)return -A*S(.32,.42,f);
 if(f<.46)return -A;
 if(f<.54)return M(-A,A,S(.46,.54,f));
 if(f<.58)return A;
 return A*(1-S(.58,.68,f));
}
function runBlendAt(x,z,old){
 const ev=runEvidence(x,z);
 if(old.mask<=.12||old.mask>=.82||ev.coherence<=.18)return{prior:0,next:0,gain:0,maskWindow:0,...ev};
 const maskWindow=S(.12,.28,old.mask)*(1-S(.68,.82,old.mask));
 const gain=ev.coherence*maskWindow;
 return{prior:0,next:gain,gain,maskWindow,...ev};
}
function compute(x,z){
 const prior=R66.terraceStateAt(x,z),old=frozenAt(x,z);
 if(old.mask<=.12||old.mask>=.82||!safeFrozen(x,z))return{...prior,runCoherenceGain:0,runCoherence:0,runSpan:0,runProfileCorrection:0,runPredictedDelta:0};
 const rb=runBlendAt(x,z,old);if(rb.gain<=1e-12)return{...prior,runCoherenceGain:0,runCoherence:rb.coherence,runSpan:rb.span,runProfileCorrection:0,runPredictedDelta:0};
 const f=old.frac,corr=runProfileCorrection(f,old.step)*rb.gain,predicted=.84*old.mask*corr;
 if(Math.abs(predicted)<.0005)return{...prior,runCoherenceGain:rb.gain,runCoherence:rb.coherence,runSpan:rb.span,runSupports:rb.supports,runLeft:rb.left,runRight:rb.right,runProfileCorrection:corr,runPredictedDelta:predicted,runSuppressedSubmillimetre:true};
 let raw=prior.raw+corr,delta=.84*old.mask*raw;
 const dd=delta-prior.delta,cap=.045;if(Math.abs(dd)>cap){delta=prior.delta+C(dd,-cap,cap);raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw}
 return{...prior,raw,delta,target:old.base+delta,runCoherenceGain:rb.gain,runCoherence:rb.coherence,runSpan:rb.span,runSupports:rb.supports,runLeft:rb.left,runRight:rb.right,runProfileCorrection:corr,runPredictedDelta:predicted,runPriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function contourRunEvidenceAt(x,z){return runEvidence(x,z)}
export function contourRunBlendAt(x,z){return runBlendAt(x,z,frozenAt(x,z))}
export function terraceGroupMask(x,z){return R66.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=frozenAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R66.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round67:{
 scope:'advance from sparse local residual correction to slope-scale readability by strengthening the bench-to-riser shoulder shape only along frozen, bilateral, same-family/same-level contour runs inside the accepted footprint; do not grow footprint, move levels, globally raise risers, or relax drainage separators',
 method:'use only frozen R47 evidence on the authoritative lattice. At each existing active cell, select the best of eight lattice directions for each sign of the local R30 contour tangent, then sample one/two/three frozen lattice steps. Every support must remain same-family, step/index compatible and clear the inherited drainage/receiver protection. Real physical reach uses hypot(), so diagonal steps are never mislabeled as 6 m. Convert bilateral reach/support/alignment into a bounded coherence weight. Where that evidence is material, apply a zero-endpoint antisymmetric shoulder/riser correction only over inherited phase 0.32-0.68, scaled by frozen-run coherence and mask support; suppress predicted changes below 0.0005 m as numerical/visual dust; cap R67-R66 local delta at 0.045 m. R67 output never seeds its own evidence.',
 logicCorrection:'R66 proving physically real local corrections does not imply the hillside reads as a coherent terrace system. Counting changed cells is a materiality check, not a macro-organization proof. The first R67 probe also exposed two issues: arbitrary floating contour probes test a different domain from the authoritative 6 m lattice, and merely adding more blend toward the already-used R66 sharp target leaves most long runs unchanged once that residual is exhausted. A later probe exposed a second denominator problem: sub-millimetre corrections were counted as changed cells and inflated the isolated-point denominator even though they are below meaningful terrain readability. R67 therefore uses frozen lattice evidence plus an independent zero-endpoint shoulder/riser correction, suppresses <0.5 mm output changes, and is accepted only if the remaining changed cells form physically extended compatible runs.',
 constraint:'the one/two/three lattice-step support probes, 0.70 tangent-alignment gate, 0.18 coherence floor, 0.018*step shoulder correction scale, 0.0005 m output deadband, 0.045 m per-point change cap, 6 m audit lattice and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity, head/depth/discharge/gate states or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: a longer continuous contour ribbon, geometric adjacency and conservation are not evidence of parcel ownership, surveyed riser section, hydraulic exchange, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available in the current run to replay, and Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'the retained reference boundary is non-metric morphology only: broad portions of one agricultural slope should read as long curved contour-following benches, unequal widths, nested bends and drainage interruptions. The exact original image(173).png asset was not re-resolved from the indexed file library in this run, so no new metric or visual claim is attributed to it.',
 evidenceClass:'synthetic frozen-run shoulder/riser profile-coherence strengthening over accepted terrace footprint; not surveyed terrace, parcel or hydraulic truth'
}};
