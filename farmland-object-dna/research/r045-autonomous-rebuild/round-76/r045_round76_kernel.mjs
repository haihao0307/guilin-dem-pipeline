import * as R75 from '../round-75/r045_round75_kernel.mjs';
import * as R74 from '../round-74/r045_round74_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-74/r045_round74_kernel.mjs';

export const VERSION='R045.76';
export const R76_CONTRACT='R045.76-neighbor-aware-cliff-safe-carrier-profile-v1';
const X0=-216,X1=114,Z0=-126,Z1=6;
const CACHE=new Map();
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const NODE_CAP=.035,CLIFF_LIMIT=1.05,SAFETY_MARGIN=.010,ENVELOPE_RADIUS=CLIFF_LIMIT-NODE_CAP-SAFETY_MARGIN;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function coherentProfile(frac,step){const a=2*Math.PI*frac;return -.028*step*Math.sin(a)*(0.82+0.18*Math.cos(a))}
export function r76CliffEnvelopeAt(x,z){
 let lo=-Infinity,hi=Infinity;
 for(const[xx,zz]of[[x+3,z],[x-3,z],[x,z+3],[x,z-3]]){
  const b=R74.terraceDelta(xx,zz);lo=Math.max(lo,b-ENVELOPE_RADIUS);hi=Math.min(hi,b+ENVELOPE_RADIUS);
 }
 return{lo,hi,feasible:lo<=hi,radius:ENVELOPE_RADIUS,nodeCap:NODE_CAP,limit:CLIFF_LIMIT,margin:SAFETY_MARGIN};
}
function compute(x,z){
 const prior=R74.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=R75.r75CarrierWeightAt(x,z);
 if(w<=1e-12||!safe(x,z))return{...prior,r76CarrierWeight:0,r76RawProfileCorrection:0,r76RawDelta:0,r76Delta:0,r76EnvelopeClamped:false,r76EnvelopeFeasible:true};
 const rawCorr=coherentProfile(old.frac,old.step)*w;
 if(Math.abs(rawCorr)<=1e-12)return{...prior,r76CarrierWeight:w,r76RawProfileCorrection:0,r76RawDelta:0,r76Delta:0,r76EnvelopeClamped:false,r76EnvelopeFeasible:true};
 const rawDd=C(.84*old.mask*rawCorr,-NODE_CAP,NODE_CAP),candidate=prior.delta+rawDd,env=r76CliffEnvelopeAt(x,z);
 if(!env.feasible)return{...prior,r76CarrierWeight:w,r76RawProfileCorrection:rawCorr,r76RawDelta:rawDd,r76Delta:0,r76EnvelopeClamped:true,r76EnvelopeFeasible:false};
 const delta=C(candidate,env.lo,env.hi),dd=delta-prior.delta,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw,delta,target:prior.base+delta,r76CarrierWeight:w,r76RawProfileCorrection:rawCorr,r76RawDelta:rawDd,r76Delta:dd,r76EnvelopeClamped:Math.abs(dd-rawDd)>1e-10,r76EnvelopeFeasible:true,r76EnvelopeLo:env.lo,r76EnvelopeHi:env.hi};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r76CarrierAt(x,z){return R75.r75CarrierAt(x,z)}
export function r76CarrierWeightAt(x,z){return R75.r75CarrierWeightAt(x,z)}
export function terraceGroupMask(x,z){return R74.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R74.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round76:{
 scope:'retain the R75 full-carrier coherence objective, but reconstruct it from accepted R74 and add a direct 3 m neighbor-aware safety envelope so a bounded absolute node correction cannot create an excessive local terrace increment',
 method:'reuse only the frozen R74-accepted carrier evidence and the same R75 zero-mean contour-cycle proposal. For every query point, bound the final terrace delta against the four R74 +/-3 m neighbor deltas. The envelope radius is 1.05 - 0.035 - 0.010 = 1.005 m: because every R76 node is itself capped to 0.035 m relative to R74, this leaves a 0.010 m proof margin under the inherited 1.05 m / 3 m cliff gate. No new footprint, family, stair, carrier, parcel, drainage route or water state is created.',
 logicCorrection:'R75 exposed a precise inference error: an absolute per-node height cap of 0.035 m does not imply a relative 3 m neighbor-difference cap. The failed pair reached 1.126632809 m even though every node individually respected the absolute cap. This is an absolute-bound-versus-Lipschitz-bound error. R76 therefore constrains the actual local relation that failed, rather than lowering the 1.05 m QA threshold or merely reducing global amplitude. Passing this local gate still does not prove whole-slope visual acceptance.',
 constraint:'the 6 m authoritative lattice, 3 m probes, 1.05 m cliff gate, 0.035 m node cap, 0.010 m safety margin, R74 carrier gates and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: conservation, geometry, adjacency and continuity are necessary bookkeeping/evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership; allowed transfer is not proof of current connection.',
 mrRolordUse:'the saved MrRolord frame-study ordering is re-read and used only as a sequencing constraint: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision remain procedural tools, not agricultural truth.',
 referenceUse:'image(173).png was re-read this run: its useful evidence is the hillside-scale pattern of long curved contour benches, unequal widths, nested turns, concentrated dark riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic neighbor-safe full-carrier profile over frozen R74 evidence; not surveyed terrace, parcel or hydraulic truth',
 priorAccepted:R74.VERSION,failedProposal:R75.VERSION}};