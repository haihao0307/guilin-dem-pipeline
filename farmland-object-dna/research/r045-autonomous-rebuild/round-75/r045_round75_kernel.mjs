import * as R74 from '../round-74/r045_round74_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-74/r045_round74_kernel.mjs';

export const VERSION='R045.75';
export const R75_CONTRACT='R045.75-full-carrier-profile-coherence-v1';
const X0=-216,X1=114,Z0=-126,Z1=6,STEP=6;
const CACHE=new Map(),EXACT=new Map();
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function sameIdentity(a,b){return a.groupIndex===b.groupIndex&&a.index===b.index}
function exactCarrierAt(x,z){
 const k=keyOf(x,z);let v=EXACT.get(k);if(v!==undefined)return v;
 const old=R47.terraceStateAt(x,z),r74=R74.r74CarrierAt(x,z),accepted=Boolean(r74.accepted),eligible=accepted&&old.mask>.12&&safe(x,z);
 v={accepted,eligible,old,component:r74.comp,seedDensity:r74.seedDensity};EXACT.set(k,v);return v;
}
function cornerContribution(x,z,q){const e=exactCarrierAt(x,z);return e.eligible&&sameIdentity(e.old,q)?1:0}
export function r75CarrierWeightAt(x,z){
 if(x<X0||x>X1||z<Z0||z>Z1||!safe(x,z))return 0;
 const q=R47.terraceStateAt(x,z);if(q.mask<=.12)return 0;
 const gx=(x-X0)/STEP,gz=(z-Z0)/STEP,i=Math.floor(gx),j=Math.floor(gz),tx=C(gx-i,0,1),tz=C(gz-j,0,1),xa=X0+i*STEP,za=Z0+j*STEP;
 return (1-tx)*(1-tz)*cornerContribution(xa,za,q)+tx*(1-tz)*cornerContribution(xa+STEP,za,q)+(1-tx)*tz*cornerContribution(xa,za+STEP,q)+tx*tz*cornerContribution(xa+STEP,za+STEP,q);
}
function coherentProfile(frac,step){
 const a=2*Math.PI*frac;
 // Full-carrier bench/riser coherence: one smooth, zero-mean contour-cycle correction.
 return -.028*step*Math.sin(a)*(0.82+0.18*Math.cos(a));
}
function compute(x,z){
 const prior=R74.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=r75CarrierWeightAt(x,z);
 if(w<=1e-12)return{...prior,r75CarrierWeight:0,r75ProfileCorrection:0,r75Delta:0};
 const rawCorr=coherentProfile(old.frac,old.step)*w;
 if(Math.abs(rawCorr)<=1e-12)return{...prior,r75CarrierWeight:w,r75ProfileCorrection:0,r75Delta:0};
 let dd=.84*old.mask*rawCorr;dd=C(dd,-.035,.035);
 const delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw,delta,target:prior.base+delta,r75CarrierWeight:w,r75ProfileCorrection:rawCorr,r75Delta:dd,r75PriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r75CarrierAt(x,z){return exactCarrierAt(x,z)}
export function terraceGroupMask(x,z){return R74.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R74.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round75:{
 scope:'turn the already-evidenced R74 contour carriers into physically coherent full-carrier bench/riser expression, instead of accumulating more isolated medium-support edits; footprint, stair identity and drainage separators remain frozen',
 method:'use only R74-accepted inherited carrier components. Apply one bounded zero-mean contour-cycle profile correction across every safe active node of each accepted carrier, including already-strong nodes, so the physical bench/riser expression is continuous along the evidence carrier. Off-grid interpolation is still clipped to frozen family+exact-index corners and rechecks drainage protection. No new carrier, footprint, stair or parcel identity is generated.',
 logicCorrection:'R74 proved evidence coverage and local safety, but many changed cells, all-three-family coverage, or a larger local delta do not logically imply whole-slope terrace organization. Those are proxy/composition errors. R75 therefore stops optimizing changed-cell count as the objective and tests a direct geometric consequence: whether an already-evidenced contour carrier receives a continuous bounded bench/riser profile over a long physical span. Changing strong cells is allowed only because they are part of the same already-evidenced carrier profile; the QA must show long same-identity continuity, not merely more orange points. A long changed run still does not by itself prove visual acceptance.',
 constraint:'the 6 m authoritative lattice, carrier gates inherited from R74, 0.028*step contour-cycle profile, 0.035 m added-node cap and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometry, adjacency, component continuity and conservation do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership; unobserved state remains unknown.',
 mrRolordUse:'saved MrRolord frame audit is used only for hydrology-first ordering: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision are tools, not agricultural truth.',
 referenceUse:'image(173).png was re-read this run and is used only as non-metric morphology evidence: long nested contour-following benches, unequal widths, curved turns, concentrated dark riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic full-carrier profile coherence over frozen R74 evidence carriers; not surveyed terrace, parcel or hydraulic truth',
 priorR74:R74.VERSION}};