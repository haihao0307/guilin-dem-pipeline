import * as R86 from '../round-86/r045_round86_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-86/r045_round86_kernel.mjs';

export const VERSION='R045.87';
export const R87_CONTRACT='R045.87-monotone-bench-extremum-relaxation-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.006,RELAX=.30,PAIR_FRACTION=.45;
const QC=new Map(),SC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function side(f){return f<=.34?-1:f>=.66?1:0}
function sameBenchIdentity(a,b){return side(a.frac)!==0&&side(a.frac)===side(b.frac)&&a.groupIndex===b.groupIndex&&a.index===b.index}
function eligible(x,z){const a=R47.terraceStateAt(x,z);return safe(x,z)&&a.mask>.48&&side(a.frac)!==0&&R78.r78CarrierWeightAt(x,z)>1e-12}
function zero(reason='ineligible'){return{delta:0,requested:0,allowance:0,pairCap:0,worstPrior3m:0,neighborCount:0,neighborMean:0,localResidual:0,benchSide:0,projected:false,reason}}

export function r87EnvelopeAt(x,z){
 const c=R86.terraceDelta(x,z);let worst=0;
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R86.terraceDelta(xx,zz)));
 return{worstPrior3m:worst,allowance:C((PAIR_PROOF-worst)/2,0,ADDED_CAP)};
}

// R86 improved mean broad-bench roughness, but its accepted evidence still contained
// 24 same-identity broad-bench pairs that became rougher and one unrelated inherited
// global >1.05 m pair. It is a logical error to infer pairwise monotonic improvement
// from a lower mean. R87 therefore performs a second, stricter relaxation only at
// broad-bench local extrema: all same-identity +/-3 m neighbours must lie on the same
// side of the centre. Each endpoint may consume at most 45% of the smallest current
// pair gap and at most half of the remaining 1.045 m safety margin. Hence two moving
// endpoints cannot cross and turn a smoothing move into a new pairwise roughening.
export function r87CorrectionAt(x,z){
 const k=key(x,z);if(QC.has(k))return QC.get(k);
 if(!eligible(x,z)){const r=zero();QC.set(k,r);return r}
 const a=R47.terraceStateAt(x,z),bs=side(a.frac),center=R86.terraceDelta(x,z),vals=[];
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]]){
  if(!eligible(xx,zz))continue;const b=R47.terraceStateAt(xx,zz);if(!sameBenchIdentity(a,b))continue;vals.push(R86.terraceDelta(xx,zz));
 }
 if(vals.length<2){const r=zero('insufficient-neighbours');QC.set(k,r);return r}
 const mean=vals.reduce((s,v)=>s+v,0)/vals.length,residual=mean-center;if(Math.abs(residual)<=1e-12){const r=zero('flat');QC.set(k,r);return r}
 const dir=Math.sign(residual),gaps=vals.map(v=>v-center);if(!gaps.every(g=>Math.sign(g)===dir&&Math.abs(g)>1e-9)){const r=zero('not-local-extremum');QC.set(k,r);return r}
 const minGap=Math.min(...gaps.map(Math.abs)),w=R78.r78CarrierWeightAt(x,z),requested=C(RELAX*residual*w,-ADDED_CAP,ADDED_CAP),env=r87EnvelopeAt(x,z),pairCap=Math.min(ADDED_CAP,PAIR_FRACTION*minGap),cap=Math.min(pairCap,env.allowance),delta=C(requested,-cap,cap);
 const r={delta,requested,allowance:env.allowance,pairCap,worstPrior3m:env.worstPrior3m,neighborCount:vals.length,neighborMean:mean,localResidual:residual,benchSide:bs,projected:Math.abs(delta-requested)>1e-12,reason:Math.abs(delta)>1e-12?'monotone-extremum':'safety-projected-zero'};QC.set(k,r);return r;
}
function compute(x,z){const p=R86.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r87CorrectionAt(x,z).delta;if(Math.abs(d)<=1e-12)return{...p,r87Delta:0};const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;return{...p,raw,delta,target:p.base+delta,r87Delta:d}}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R86.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round87:{
 scope:'preserve accepted R045.86 while removing the remaining pairwise broad-bench roughening that a mean-only flattening metric can hide; do not reinterpret legitimate risers or predecessor debt as child-created failure.',
 method:'apply one additional identity-aware relaxation only at true broad-bench local extrema. All eligible same-family exact-stair +/-3 m neighbours must lie on one side of the centre; correction is capped at 6 mm, 45% of the smallest current pair gap, and half of the remaining 1.045 m predecessor safety margin.',
 logicCorrection:'a lower mean or RMS broad-bench gradient does not imply every local pair improved. R045.86 had a lower aggregate roughness while 24 measured same-identity broad-bench pairs worsened. R045.87 makes pairwise monotonicity an explicit construction rule instead of treating aggregate improvement as a sufficient condition. Likewise, an inherited >1.05 m pair is not automatically an error: its bench/riser semantics must be classified before geometry is changed.',
 constraint:'the 6 m carrier lattice, +/-3 m probes, 1.045/1.05 m safety gates, 6 mm added cap, 45% gap cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, shared-looking edges, flatter benches and conservation-style bookkeeping do not establish hydraulic connectivity, ownership, head, water depth, discharge, gate state, soil-water state, sediment state or event state; unobserved state remains unknown.',
 mrRolordUse:'the retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video remains unavailable for replay, so no replay is claimed and procedural smoothing is not agricultural truth.',
 referenceUse:'the saved user terrace reference is used non-metrically: long curved contour-following bench interiors should read calmer than concentrated risers, with unequal widths, nested turns and drainage interruptions. No measured width, riser height, channel section or hydraulic parameter is inferred from the photograph.',
 predecessor:R86.VERSION,priorAccepted:R86.VERSION}};