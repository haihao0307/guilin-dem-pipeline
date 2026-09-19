import * as R77 from '../round-77/r045_round77_kernel.mjs';
import * as R74 from '../round-74/r045_round74_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-77/r045_round77_kernel.mjs';

export const VERSION='R045.78';
export const R78_CONTRACT='R045.78-safety-projected-concentrated-riser-v1';
const CACHE=new Map();
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const ADDED_CAP=.018,PAIR_PROOF=1.045,CLIFF_LIMIT=1.05;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function concentratedProfile(frac,step){
 const a=2*Math.PI*frac;
 // Zero-mean first+second harmonic: less sinusoidal shoulder, more concentrated riser transition.
 return -.020*step*(Math.sin(a)+.28*Math.sin(2*a));
}
export function r78PairEnvelopeAt(x,z){
 const c=R77.terraceDelta(x,z);let worst=0;
 for(const[xx,zz]of[[x+3,z],[x-3,z],[x,z+3],[x,z-3]])worst=Math.max(worst,Math.abs(c-R77.terraceDelta(xx,zz)));
 // Each endpoint receives at most half the predecessor pair margin. For any pair,
 // allowance(a)+allowance(b) <= PAIR_PROOF-|d77|, so independent endpoint forcing
 // cannot exceed the retained 1.045 m construction proof bound.
 const allowance=C((PAIR_PROOF-worst)/2,0,ADDED_CAP);
 return{worstPrior3m:worst,allowance,pairProof:PAIR_PROOF,addedCap:ADDED_CAP,limit:CLIFF_LIMIT};
}
function compute(x,z){
 const prior=R77.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=R77.r77CarrierWeightAt(x,z);
 if(w<=1e-12||!safe(x,z))return{...prior,r78CarrierWeight:0,r78RawRequested:0,r78Allowance:0,r78Delta:0,r78WorstPrior3m:0,r78Projected:false};
 const raw=concentratedProfile(old.frac,old.step)*w;
 const requested=C(.84*old.mask*raw,-ADDED_CAP,ADDED_CAP);
 const env=r78PairEnvelopeAt(x,z),dd=C(requested,-env.allowance,env.allowance);
 if(Math.abs(dd)<=1e-12)return{...prior,r78CarrierWeight:w,r78RawRequested:requested,r78Allowance:env.allowance,r78Delta:0,r78WorstPrior3m:env.worstPrior3m,r78Projected:Math.abs(requested)>env.allowance+1e-12};
 const delta=prior.delta+dd,rawState=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw:rawState,delta,target:prior.base+delta,r78CarrierWeight:w,r78RawRequested:requested,r78Allowance:env.allowance,r78Delta:dd,r78WorstPrior3m:env.worstPrior3m,r78Projected:Math.abs(dd-requested)>1e-12};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r78CarrierAt(x,z){return R77.r77CarrierAt(x,z)}
export function r78CarrierWeightAt(x,z){return R77.r77CarrierWeightAt(x,z)}
export function terraceGroupMask(x,z){return R74.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R77.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round78:{
 scope:'convert the already-continuous frozen terrace carrier into a more bench/riser-readable physical profile without adding footprint, parcel identity or drainage crossings; every extra endpoint move is projected into a predecessor-relative 3 m safety envelope',
 method:'reuse the R77/R74 evidence carrier and frozen R47 family+stair identity. Add a zero-mean first+second-harmonic contour-cycle correction that concentrates the riser transition, then cap each endpoint by half of its actual R77 local margin to a 1.045 m / 3 m proof target, with an absolute R77-relative cap of 0.018 m. Because each endpoint budget is derived from the same predecessor pair relation, two independent endpoint moves cannot consume more than the pair margin. Drainage and receiver protection remain hard zero-change regions.',
 logicCorrection:'The previous rounds exposed a proxy error: more changed cells, family coverage, or a passing browser page do not imply hillside-scale terrace readability. R78 therefore changes the physical carrier profile itself and measures the predecessor-relative geometric consequence. It also avoids another invalid inference: a per-node absolute cap alone cannot prove a neighbor-difference cap. The new endpoint allowance is derived from the actual R77 3 m predecessor relation, not from subtracting unrelated nominal caps. Passing this construction bound still does not prove visual acceptance.',
 constraint:'the 6 m authoritative lattice, 3 m probes, 1.045 m construction proof target, 1.05 m cliff gate, 0.018 m added cap, inherited carrier gates and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: conservation, geometry, adjacency and visual continuity are necessary evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership; allowed transfer is not proof of current connection.',
 mrRolordUse:'the saved MrRolord ordering was re-read through the latest retained Farmland method record and is used only as a sequencing constraint: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. No original named video source was available to replay this run; procedural displacement remains a tool, not agricultural truth.',
 referenceUse:'image(173).png was re-opened this run. It supports hillside-scale long curved contour benches, unequal widths, nested turns, concentrated dark riser edges and drainage interruptions. It is non-metric evidence; no field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic safety-projected full-carrier riser concentration over frozen inherited terrace evidence; not surveyed terrace, parcel or hydraulic truth',
 predecessor:R77.VERSION,priorAccepted:R74.VERSION}};
