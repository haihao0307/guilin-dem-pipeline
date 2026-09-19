import * as R83 from '../round-83/r045_round83_kernel.mjs';
import * as R81 from '../round-81/r045_round81_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-83/r045_round83_kernel.mjs';

export const VERSION='R045.84';
export const R84_CONTRACT='R045.84-query-safe-riser-normal-concentration-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const STEP=6,PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.012;
const QC=new Map(),SC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function carrierEligible(x,z){const old=R47.terraceStateAt(x,z);return safe(x,z)&&old.mask>.48&&R78.r78CarrierWeightAt(x,z)>1e-12}
function orientationAt(x,z){return R81.r81NodeDeltaAt(Math.round(x/STEP)*STEP,Math.round(z/STEP)*STEP).orientation||0}
function gaussian(x,mu,s){const q=(x-mu)/s;return Math.exp(-.5*q*q)}
// Anti-symmetric toe/crest couple around the inherited riser. It is essentially
// zero on the broad benches, so this round concentrates curvature/normals rather
// than merely increasing the whole terrace vertical range.
function riserCouple(f){return C(gaussian(f,.545,.034)-gaussian(f,.455,.034),-1,1)}
function zero(){return{delta:0,requested:0,allowance:0,worstPrior3m:0,projected:false,orientation:0,frac:0,carrierWeight:0}}

export function r84PairEnvelopeAt(x,z){
 const c=R83.terraceDelta(x,z);let worst=0;
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R83.terraceDelta(xx,zz)));
 const allowance=C((PAIR_PROOF-worst)/2,0,ADDED_CAP);
 return{worstPrior3m:worst,allowance,pairProof:PAIR_PROOF,addedCap:ADDED_CAP};
}
export function r84CorrectionAt(x,z){
 const k=key(x,z);if(QC.has(k))return QC.get(k);
 if(!carrierEligible(x,z)){const r=zero();QC.set(k,r);return r}
 const old=R47.terraceStateAt(x,z),o=orientationAt(x,z),w=R78.r78CarrierWeightAt(x,z);
 if(!o||w<=1e-12){const r=zero();QC.set(k,r);return r}
 const requested=ADDED_CAP*o*riserCouple(old.frac)*w,env=r84PairEnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance);
 const r={delta,requested,allowance:env.allowance,worstPrior3m:env.worstPrior3m,projected:Math.abs(delta-requested)>1e-12,orientation:o,frac:old.frac,carrierWeight:w};QC.set(k,r);return r;
}
export function r84RiserWeightAt(x,z){const f=R47.terraceStateAt(x,z).frac;return C(Math.abs(riserCouple(f)),0,1)}
function compute(x,z){
 const p=R83.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r84CorrectionAt(x,z).delta;
 if(Math.abs(d)<=1e-12)return{...p,r84Delta:0};
 const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;
 return{...p,raw,delta,target:p.base+delta,r84Delta:d};
}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R83.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round84:{
 scope:'improve hillside-scale riser readability on top of accepted R045.83 without widening terrace footprint, changing family/stair identity, increasing the inherited broad bench range, or weakening the query-safe 3 m envelope',
 method:'add a narrow zero-mean toe/crest micro-profile around frac 0.455/0.545 on the already accepted carrier. The field is evaluated at the actual query coordinate, remains almost zero on broad benches, and every query is clipped by a predecessor-relative half-margin envelope computed from R045.83 real +/-3 m neighbours.',
 logicCorrection:'A larger maximum height or a higher changed-cell count is not evidence of better fixed-camera terrace readability. R045.83 already has distributed amplitude but remains visually weak. R045.84 changes curvature concentration at the riser itself, and QA measures off-grid riser response and shared-scale hillshade instead of treating numeric amplitude as a visual proxy. Likewise a browser pass proves rendering, not morphology.',
 constraint:'the 6 m carrier lattice, 3 m probes, 1.045/1.05 m safety gates, 12 mm micro-profile cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, true parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, visible shared edges, mass conservation and a sharper riser normal do not establish hydraulic connectivity, ownership, water head/depth/discharge, gate state, soil-water state or event state; unobserved state remains unknown.',
 mrRolordUse:'the retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video source is still unavailable for replay, so no replay is claimed and procedural displacement is not agricultural truth.',
 referenceUse:'image(173).png was reread as non-metric morphology evidence: broad light benches are separated by concentrated dark contour-following riser edges, with unequal widths, nested turns and drainage interruptions. No terrace width, riser height, channel section or hydraulic parameter is inferred from the photograph.',
 predecessor:R83.VERSION,priorAccepted:R83.VERSION}};
