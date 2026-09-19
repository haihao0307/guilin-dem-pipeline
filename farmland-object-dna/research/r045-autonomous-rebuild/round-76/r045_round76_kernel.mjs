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
const PROFILE_CAP=.035,SAFETY_REPAIR_CAP=.037,CLIFF_LIMIT=1.05,PROOF_BOUND=1.04,REPAIR_TARGET=1.02,DANGER_BASE=.96;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function coherentProfile(frac,step){const a=2*Math.PI*frac;return -.028*step*Math.sin(a)*(0.82+0.18*Math.cos(a))}
export function r76PairRepairAt(x,z){
 const base=R74.terraceDelta(x,z);let repair=0,worst=0,violations=0;
 for(const[xx,zz]of[[x+3,z],[x-3,z],[x,z+3],[x,z-3]]){
  const nb=R74.terraceDelta(xx,zz),d=base-nb,a=Math.abs(d);worst=Math.max(worst,a);
  if(a<=REPAIR_TARGET)continue;violations++;
  const desired=-Math.sign(d)*Math.min(SAFETY_REPAIR_CAP,.5*(a-REPAIR_TARGET));repair+=desired;
 }
 repair=C(repair,-SAFETY_REPAIR_CAP,SAFETY_REPAIR_CAP);
 return{repair,worst,violations,target:REPAIR_TARGET,dangerBase:DANGER_BASE,profileCap:PROFILE_CAP,safetyRepairCap:SAFETY_REPAIR_CAP,proofBound:PROOF_BOUND,limit:CLIFF_LIMIT};
}
function compute(x,z){
 const prior=R74.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=R75.r75CarrierWeightAt(x,z);
 if(w<=1e-12||!safe(x,z))return{...prior,r76CarrierWeight:0,r76RawProfileCorrection:0,r76RawDelta:0,r76Delta:0,r76EnvelopeClamped:false,r76EnvelopeFeasible:true,r76SafetyRepair:0,r76WorstPrior3m:0,r76DangerSuppressed:false};
 const rawCorr=coherentProfile(old.frac,old.step)*w,rawDd=C(.84*old.mask*rawCorr,-PROFILE_CAP,PROFILE_CAP),pair=r76PairRepairAt(x,z);
 // Near a pre-existing cliff, profile forcing is suppressed and a derived two-endpoint safety repair is allowed a narrowly larger cap.
 const dangerous=pair.worst>DANGER_BASE,dd=dangerous?pair.repair:rawDd,delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw,delta,target:prior.base+delta,r76CarrierWeight:w,r76RawProfileCorrection:rawCorr,r76RawDelta:rawDd,r76Delta:dd,r76EnvelopeClamped:dangerous&&Math.abs(dd-rawDd)>1e-10,r76EnvelopeFeasible:true,r76SafetyRepair:pair.repair,r76WorstPrior3m:pair.worst,r76DangerSuppressed:dangerous,r76RepairViolations:pair.violations};
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
 scope:'retain the R75 full-carrier coherence objective, reconstruct it from accepted R74, and explicitly repair inherited or proposal-amplified 3 m terrace cliffs without expanding the terrace footprint',
 method:'reuse only frozen R74-accepted carrier evidence and the same R75 zero-mean contour-cycle proposal. On calm carrier nodes, keep the original +/-0.035 m profile cap. Near inherited 3 m cliffs, suppress profile forcing and compute a symmetric pair repair from the R74 relation. The accepted baseline contains a 1.112919833 m / 3 m relation; the unchanged proof bound is 1.040 m, so the minimum equal endpoint budget is (1.112919833-1.040)/2 = 0.0364599165 m. R76 therefore uses a narrowly rounded 0.037 m cap only for safety repair, while profile shaping remains capped at 0.035 m. This tightens the relative cliff relation instead of relaxing its 1.05 m gate or the 1.04 m proof bound. No new footprint, family, stair, carrier, parcel, drainage route or water state is created.',
 logicCorrection:'R75 exposed an absolute-bound-versus-Lipschitz-bound error: an absolute per-node height cap of 0.035 m does not imply a relative 3 m neighbor-difference cap. The first R76 repair exposed a sequential constraint-composition error, and the second exposed a coupled-feasibility contradiction: with the inherited R74 pair at 1.112919833 m, requiring both endpoints to stay within +/-0.035 m can reduce the pair by at most 0.070 m, leaving 1.042919833 m, which can never satisfy the independently retained 1.040 m proof bound. Instead of deleting the proof bound, R76 derives the smallest rounded safety-only endpoint budget that can satisfy it. Ordinary profile changes remain under the original 0.035 m cap. Passing this local relation still does not prove whole-slope visual acceptance.',
 constraint:'the 6 m authoritative lattice, 3 m probes, 1.05 m cliff gate, 1.04 m proof bound, 0.035 m profile cap, 0.037 m safety-repair cap, 1.02 m repair target, 0.96 m danger threshold, R74 carrier gates and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: conservation, geometry, adjacency and continuity are necessary bookkeeping/evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership; allowed transfer is not proof of current connection.',
 mrRolordUse:'the saved MrRolord frame-study ordering is re-read and used only as a sequencing constraint: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision remain procedural tools, not agricultural truth.',
 referenceUse:'image(173).png was re-read this run: its useful evidence is the hillside-scale pattern of long curved contour benches, unequal widths, nested turns, concentrated dark riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic pair-repaired full-carrier profile over frozen R74 evidence; not surveyed terrace, parcel or hydraulic truth',
 priorAccepted:R74.VERSION,failedProposal:R75.VERSION}};