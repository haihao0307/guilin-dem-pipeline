import * as R84 from '../round-84/r045_round84_kernel.mjs';
import * as R81 from '../round-81/r045_round81_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-84/r045_round84_kernel.mjs';

export const VERSION='R045.85';
export const R85_CONTRACT='R045.85-query-safe-bench-plateau-redistribution-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const STEP=6,PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.012;
const QC=new Map(),SC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function carrierEligible(x,z){const old=R47.terraceStateAt(x,z);return safe(x,z)&&old.mask>.48&&R78.r78CarrierWeightAt(x,z)>1e-12}
function orientationAt(x,z){return R81.r81NodeDeltaAt(Math.round(x/STEP)*STEP,Math.round(z/STEP)*STEP).orientation||0}
// Residual from a linear phase ramp to a concentrated stair. It is zero at the
// band ends and at the riser centre, negative on the lower bench and positive on
// the upper bench. R85 spends its budget on plateau redistribution rather than on
// another narrow edge-only wave.
function plateauResidual(f){return C((S(.44,.56,f)-f)/.44,-1,1)}
function zero(){return{delta:0,requested:0,allowance:0,worstPrior3m:0,projected:false,orientation:0,frac:0,carrierWeight:0}}

export function r85PairEnvelopeAt(x,z){
 const c=R84.terraceDelta(x,z);let worst=0;
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R84.terraceDelta(xx,zz)));
 const allowance=C((PAIR_PROOF-worst)/2,0,ADDED_CAP);
 return{worstPrior3m:worst,allowance,pairProof:PAIR_PROOF,addedCap:ADDED_CAP};
}
export function r85CorrectionAt(x,z){
 const k=key(x,z);if(QC.has(k))return QC.get(k);
 if(!carrierEligible(x,z)){const r=zero();QC.set(k,r);return r}
 const old=R47.terraceStateAt(x,z),o=orientationAt(x,z),w=R78.r78CarrierWeightAt(x,z);
 if(!o||w<=1e-12){const r=zero();QC.set(k,r);return r}
 const requested=ADDED_CAP*o*plateauResidual(old.frac)*w,env=r85PairEnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance);
 const r={delta,requested,allowance:env.allowance,worstPrior3m:env.worstPrior3m,projected:Math.abs(delta-requested)>1e-12,orientation:o,frac:old.frac,carrierWeight:w};QC.set(k,r);return r;
}
function compute(x,z){
 const p=R84.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r85CorrectionAt(x,z).delta;
 if(Math.abs(d)<=1e-12)return{...p,r85Delta:0};
 const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;
 return{...p,raw,delta,target:p.base+delta,r85Delta:d};
}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R84.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round85:{
 scope:'flatten the visual reading of broad terrace benches by redistributing a bounded part of the inherited phase ramp into the already accepted riser transition; preserve R045.84 footprint, family, exact stair identity, drainage separators and foreground receiver.',
 method:'apply a zero-end stair-minus-ramp residual across the frozen accepted carrier on top of R045.84. The lower and upper bench receive opposite-signed corrections while the riser centre and band ends remain near zero. Every actual query coordinate must itself be an accepted carrier and is clipped by a predecessor-relative half-margin envelope built from R045.84 real +/-3 m neighbours.',
 logicCorrection:'R045.84 proved that a narrow riser wave can be machine-safe and fully realised, but 100% wave-target realisation and higher edge contrast did not make the fixed-camera hillside read as terraces. Increasing edge amplitude again would repeat the proxy-metric fallacy. R045.85 changes the broad bench-versus-riser height distribution and QA directly checks same-identity broad-bench 3 m pair gradients, distributed materiality and real off-grid safety. Browser success remains rendering evidence, not morphology acceptance.',
 constraint:'the 6 m carrier lattice, 3 m probes, 1.045/1.05 m safety gates, 12 mm redistribution cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, true parcel or management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, bench flattening, visible shared edges and mass-style balancing do not establish hydraulic connectivity, ownership, water head/depth/discharge, gate state, soil-water state or event state; unobserved state remains unknown.',
 mrRolordUse:'the latest retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video source remains unavailable for replay, so no replay is claimed and procedural displacement is not agricultural truth.',
 referenceUse:'image(173).png was reread as non-metric morphology evidence: long curved contour-aligned benches have broad readable plateau interiors, unequal widths, nested turns, concentrated darker riser edges and natural drainage interruptions. No terrace width, riser height, channel section or hydraulic parameter is inferred from the photograph.',
 predecessor:R84.VERSION,priorAccepted:R84.VERSION}};
