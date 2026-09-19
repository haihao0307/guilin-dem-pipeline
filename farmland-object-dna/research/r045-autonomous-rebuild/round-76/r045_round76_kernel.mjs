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
const NODE_CAP=.035,CLIFF_LIMIT=1.05,REPAIR_TARGET=1.02,DANGER_BASE=.96;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function coherentProfile(frac,step){const a=2*Math.PI*frac;return -.028*step*Math.sin(a)*(0.82+0.18*Math.cos(a))}
export function r76PairRepairAt(x,z){
 const base=R74.terraceDelta(x,z);let repair=0,worst=0,violations=0;
 for(const[xx,zz]of[[x+3,z],[x-3,z],[x,z+3],[x,z-3]]){
  const nb=R74.terraceDelta(xx,zz),d=base-nb,a=Math.abs(d);worst=Math.max(worst,a);
  if(a<=REPAIR_TARGET)continue;violations++;
  const desired=-Math.sign(d)*Math.min(NODE_CAP,.5*(a-REPAIR_TARGET));repair+=desired;
 }
 repair=C(repair,-NODE_CAP,NODE_CAP);
 return{repair,worst,violations,target:REPAIR_TARGET,dangerBase:DANGER_BASE,nodeCap:NODE_CAP,limit:CLIFF_LIMIT};
}
function compute(x,z){
 const prior=R74.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=R75.r75CarrierWeightAt(x,z);
 if(w<=1e-12||!safe(x,z))return{...prior,r76CarrierWeight:0,r76RawProfileCorrection:0,r76RawDelta:0,r76Delta:0,r76EnvelopeClamped:false,r76EnvelopeFeasible:true,r76SafetyRepair:0,r76WorstPrior3m:0};
 const rawCorr=coherentProfile(old.frac,old.step)*w,rawDd=C(.84*old.mask*rawCorr,-NODE_CAP,NODE_CAP),pair=r76PairRepairAt(x,z);
 // Coupled 3 m cliffs require coordinated motion of both endpoints. Near a pre-existing cliff, suppress the profile proposal and use the symmetric R74-derived repair only.
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
 method:'reuse only frozen R74-accepted carrier evidence and the same R75 zero-mean contour-cycle proposal. Where the inherited R74 terrace delta is locally calm (all four +/-3 m relations <=0.96 m), apply the bounded profile proposal. Where a 3 m relation is already near the cliff gate, suppress profile forcing and compute a symmetric pair repair from the R74 relation: each endpoint independently moves halfway toward a 1.02 m target, capped at +/-0.035 m. The known 1.1129 m inherited relation therefore has enough combined endpoint budget (up to 0.070 m) to fall below the unchanged 1.05 m gate. No new footprint, family, stair, carrier, parcel, drainage route or water state is created.',
 logicCorrection:'R75 exposed an absolute-bound-versus-Lipschitz-bound error: an absolute per-node height cap of 0.035 m does not imply a relative 3 m neighbor-difference cap. The first R76 repair then exposed two more constraint errors. Sequential clipping could undo the node cap, and a one-sided envelope treated the neighboring endpoint as fixed even though both endpoints are controlled and each has a +/-0.035 m budget; that manufactured an artificial infeasibility around an inherited R74 relation of 1.1129 m. R76 now treats the cliff as a coupled pair relation, shares the required correction across both endpoints, and suppresses profile forcing near inherited cliffs. It does not lower the 1.05 m QA gate, and passing the local relation still does not prove whole-slope visual acceptance.',
 constraint:'the 6 m authoritative lattice, 3 m probes, 1.05 m cliff gate, 0.035 m endpoint cap, 1.02 m repair target, 0.96 m danger threshold, R74 carrier gates and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: conservation, geometry, adjacency and continuity are necessary bookkeeping/evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership; allowed transfer is not proof of current connection.',
 mrRolordUse:'the saved MrRolord frame-study ordering is re-read and used only as a sequencing constraint: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision remain procedural tools, not agricultural truth.',
 referenceUse:'image(173).png was re-read this run: its useful evidence is the hillside-scale pattern of long curved contour benches, unequal widths, nested turns, concentrated dark riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic pair-repaired full-carrier profile over frozen R74 evidence; not surveyed terrace, parcel or hydraulic truth',
 priorAccepted:R74.VERSION,failedProposal:R75.VERSION}};