import * as R84 from '../round-84/r045_round84_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-84/r045_round84_kernel.mjs';

export const VERSION='R045.86';
export const R86_CONTRACT='R045.86-query-safe-identity-bench-laplacian-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.012,RELAX=.55;
const QC=new Map(),SC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function carrierEligible(x,z){const old=R47.terraceStateAt(x,z);return safe(x,z)&&old.mask>.48&&R78.r78CarrierWeightAt(x,z)>1e-12}
function benchSide(f){return f<=.34?-1:f>=.66?1:0}
function sameBenchIdentity(a,b){return benchSide(a.frac)!==0&&benchSide(a.frac)===benchSide(b.frac)&&a.groupIndex===b.groupIndex&&a.index===b.index}
function zero(){return{delta:0,requested:0,allowance:0,worstPrior3m:0,projected:false,benchSide:0,neighborCount:0,neighborMean:0,centerBefore:0,localResidual:0,carrierWeight:0}}

export function r86PairEnvelopeAt(x,z){
 const c=R84.terraceDelta(x,z);let worst=0;
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R84.terraceDelta(xx,zz)));
 const allowance=C((PAIR_PROOF-worst)/2,0,ADDED_CAP);
 return{worstPrior3m:worst,allowance,pairProof:PAIR_PROOF,addedCap:ADDED_CAP};
}

// R85 failed because a phase-shaped plateau residual increased the measured
// same-identity broad-bench 3 m gradient. R86 does not inherit that failed field.
// Instead it performs one bounded Jacobi/Laplacian relaxation step on the accepted
// R84 broad benches themselves: each query moves only toward the mean of real
// +/-3 m neighbours that are safe, on the same broad-bench side, same family and
// exact stair. This directly targets the failed quantity rather than another proxy.
export function r86CorrectionAt(x,z){
 const k=key(x,z);if(QC.has(k))return QC.get(k);
 if(!carrierEligible(x,z)){const r=zero();QC.set(k,r);return r}
 const a=R47.terraceStateAt(x,z),side=benchSide(a.frac),w=R78.r78CarrierWeightAt(x,z);
 if(!side||w<=1e-12){const r=zero();QC.set(k,r);return r}
 const vals=[];
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]]){
   if(!carrierEligible(xx,zz))continue;
   const b=R47.terraceStateAt(xx,zz);
   if(!sameBenchIdentity(a,b))continue;
   vals.push(R84.terraceDelta(xx,zz));
 }
 if(vals.length<2){const r=zero();QC.set(k,r);return r}
 const centerBefore=R84.terraceDelta(x,z),neighborMean=vals.reduce((s,v)=>s+v,0)/vals.length,localResidual=neighborMean-centerBefore;
 const requested=C(RELAX*localResidual*w,-ADDED_CAP,ADDED_CAP),env=r86PairEnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance);
 const r={delta,requested,allowance:env.allowance,worstPrior3m:env.worstPrior3m,projected:Math.abs(delta-requested)>1e-12,benchSide:side,neighborCount:vals.length,neighborMean,centerBefore,localResidual,carrierWeight:w};QC.set(k,r);return r;
}
function compute(x,z){
 const p=R84.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r86CorrectionAt(x,z).delta;
 if(Math.abs(d)<=1e-12)return{...p,r86Delta:0};
 const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;
 return{...p,raw,delta,target:p.base+delta,r86Delta:d};
}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R84.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round86:{
 scope:'repair the failed R045.85 broad-bench objective on top of the last accepted R045.84 baseline; reduce real same-family exact-stair broad-bench 3 m roughness without widening terrace footprint, modifying riser identity, crossing drainage separators or weakening the fixed 3 m safety proof.',
 method:'discard the failed R045.85 phase residual and apply one bounded identity-aware Laplacian/Jacobi relaxation step directly to accepted R045.84 broad benches. A query may move only toward the mean of at least two real +/-3 m neighbours on the same lower/upper bench side, same family and exact stair; every query remains clipped by the predecessor-relative half-margin envelope.',
 logicCorrection:'R045.85 changed 247 audited queries and 96 nodes across all three families, yet its measured broad-bench mean gradient worsened from about 0.09263 m to 0.09360 m (ratio about 1.0104). More changed points, three-family coverage and a browser-open page therefore did not establish bench flattening. R045.86 returns to accepted R045.84 and directly relaxes the failed measured quantity instead of inheriting a failed candidate or substituting another amplitude proxy.',
 constraint:'the 6 m carrier lattice, real +/-3 m neighbour probes, 1.045/1.05 m safety gates, 12 mm correction cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, true parcel or management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, a flatter rendered bench, shared-looking edges and conservation-style bookkeeping do not establish hydraulic connectivity, ownership, water head/depth/discharge, gate state, soil-water state or event state; unobserved state remains unknown.',
 mrRolordUse:'the retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video source remains unavailable for replay, so no replay is claimed and procedural smoothing is not agricultural truth.',
 referenceUse:'image(173).png was reread as non-metric morphology evidence: broad light terrace interiors read as comparatively calm surfaces between concentrated dark contour-following risers, with unequal widths, nested turns and drainage interruptions. No terrace width, riser height, channel section or hydraulic parameter is inferred from the photograph.',
 predecessor:R84.VERSION,failedDiagnostic:'R045.85',priorAccepted:R84.VERSION}};
