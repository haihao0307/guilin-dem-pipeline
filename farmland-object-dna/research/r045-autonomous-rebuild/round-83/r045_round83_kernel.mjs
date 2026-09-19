import * as R81 from '../round-81/r045_round81_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-81/r045_round81_kernel.mjs';

export const VERSION='R045.83';
export const R83_CONTRACT='R045.83-query-safe-3m-envelope-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const STEP=6,PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.040;
const NC=new Map(),RC=new Map(),QC=new Map(),SC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function profile(f){return C((S(.44,.56,f)-f)/.44,-1,1)}
function zero(){return{delta:0,requested:0,allowance:0,orientation:0,carrierWeight:0,worstPrior3m:0,projected:false}}

// R82 failed because only authoritative 6 m nodes were pair-budgeted while the
// rendered 3 m midpoint was produced by a renormalized interpolation. A midpoint
// could therefore spend a different budget and push a real 3 m pair above 1.05 m.
// R83 computes an unnormalised same-identity request field first, then applies the
// same predecessor-relative half-margin envelope at EVERY queried coordinate.
export function r83PairEnvelopeAt(x,z){
 const c=R81.terraceDelta(x,z);let worst=0;
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R81.terraceDelta(xx,zz)));
 const allowance=C((PAIR_PROOF-worst)/2,0,ADDED_CAP);
 return{worstPrior3m:worst,allowance,pairProof:PAIR_PROOF,addedCap:ADDED_CAP};
}
function nodeRequest(x,z){
 const k=key(x,z);if(NC.has(k))return NC.get(k);
 const old=R47.terraceStateAt(x,z),w=R78.r78CarrierWeightAt(x,z);
 if(old.mask<=.48||w<=1e-12||!safe(x,z)){const r={requested:0,orientation:0,carrierWeight:0};NC.set(k,r);return r}
 const r81=R81.r81NodeDeltaAt(x,z),o=r81.orientation||0;
 if(o===0){const r={requested:0,orientation:0,carrierWeight:w};NC.set(k,r);return r}
 const r={requested:ADDED_CAP*o*profile(old.frac)*w,orientation:o,carrierWeight:w};NC.set(k,r);return r;
}
export function r83RequestedFieldAt(x,z){
 const k=key(x,z);if(RC.has(k))return RC.get(k);
 if(!safe(x,z)){RC.set(k,0);return 0}
 const old=R47.terraceStateAt(x,z),x0=Math.floor(x/STEP)*STEP,z0=Math.floor(z/STEP)*STEP,tx=(x-x0)/STEP,tz=(z-z0)/STEP;
 const cs=[[x0,z0,(1-tx)*(1-tz)],[x0+STEP,z0,tx*(1-tz)],[x0,z0+STEP,(1-tx)*tz],[x0+STEP,z0+STEP,tx*tz]];
 let s=0;
 for(const[xx,zz,ww]of cs){
  if(ww<=0)continue;
  const c=R47.terraceStateAt(xx,zz);
  if(c.groupIndex!==old.groupIndex||c.index!==old.index)continue;
  // Deliberately do NOT renormalise after identity/safety exclusions. Missing or
  // zero corners contribute zero with their original bilinear weight, so an
  // off-grid point cannot amplify a surviving node request.
  s+=ww*nodeRequest(xx,zz).requested;
 }
 const r=C(s,-ADDED_CAP,ADDED_CAP);RC.set(k,r);return r;
}
function queryCorrection(x,z){
 const k=key(x,z);if(QC.has(k))return QC.get(k);
 if(!safe(x,z)){const r=zero();QC.set(k,r);return r}
 const requested=r83RequestedFieldAt(x,z),env=r83PairEnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance),old=R47.terraceStateAt(x,z),nr=nodeRequest(Math.round(x/STEP)*STEP,Math.round(z/STEP)*STEP);
 const r={delta,requested,allowance:env.allowance,orientation:nr.orientation||0,carrierWeight:R78.r78CarrierWeightAt(x,z),worstPrior3m:env.worstPrior3m,projected:Math.abs(delta-requested)>1e-12,mask:old.mask};QC.set(k,r);return r;
}
export function r83NodeDeltaAt(x,z){return queryCorrection(x,z)}
function compute(x,z){
 const p=R81.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=queryCorrection(x,z).delta;
 if(Math.abs(d)<=1e-12)return{...p,r83Delta:0};
 const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;
 return{...p,raw,delta,target:p.base+delta,r83Delta:d};
}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R81.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round83:{
 scope:'repair the failed R82 real 3 m cliff proof without widening the accepted R81 terrace footprint or weakening the visual-amplitude objective',
 method:'build the stronger stair-minus-ramp request from frozen R78/R81 carrier nodes with ordinary bilinear weights including zero/excluded corners, then apply the predecessor-relative half-margin safety envelope at every queried coordinate, including 3 m midpoints used by rendering and QA',
 logicCorrection:'R82 incorrectly inferred that pair-budgeting 6 m authoritative endpoints was sufficient for off-grid safety. Its renormalized interpolation could amplify a surviving request at a 3 m midpoint, producing 1.0537467306 m and failing both the 1.045 construction proof and the 1.05 cliff gate. R83 removes renormalization and makes the pair budget query-local; node caps alone are not a proof of neighbor safety.',
 constraint:'the 6 m lattice, 3 m probes, 1.045 m construction target, 1.05 m cliff gate, 0.040 m request cap, inherited carrier and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcels/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency, shared-bund appearance and conservation do not establish hydraulic connectivity, ownership, head, depth, discharge, gate state, soil-water state or event state; unobserved state stays unknown.',
 mrRolordUse:'the retained MrRolord method record is used only for sequencing: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video source was not available to replay; no replay is claimed and procedural displacement is not agricultural truth.',
 referenceUse:'image(173).png remains a non-metric visual hierarchy constraint for long curved contour benches, unequal widths, nested turns, concentrated riser edges and drainage interruptions; it does not supply field width, riser height, channel section or hydraulic parameters.',
 predecessor:R81.VERSION,failedCandidate:'R045.82',priorAccepted:R81.VERSION}};
