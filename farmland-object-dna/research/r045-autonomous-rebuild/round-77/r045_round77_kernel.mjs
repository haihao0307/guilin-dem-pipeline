import * as R75 from '../round-75/r045_round75_kernel.mjs';
import * as R76 from '../round-76/r045_round76_kernel.mjs';
import * as R74 from '../round-74/r045_round74_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-74/r045_round74_kernel.mjs';

export const VERSION='R045.77';
export const R77_CONTRACT='R045.77-feasible-margin-cliff-safe-full-carrier-v1';
const CACHE=new Map();
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
// Keep the aesthetic/profile forcing at the already-tested R76 amplitude. Only the
// safety repair is allowed a slightly larger endpoint budget, because R76 proved
// that +/-0.035 m at both endpoints cannot create a 0.010 m construction margin
// for the inherited 1.1129198 m / 3 m relation: 1.1129198 - 2*0.035 = 1.0429198.
const PROFILE_CAP=.035,REPAIR_CAP=.045,CLIFF_LIMIT=1.05,PROOF_BOUND=1.03,REPAIR_TARGET=1.00,DANGER_BASE=.96;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function coherentProfile(frac,step){const a=2*Math.PI*frac;return -.028*step*Math.sin(a)*(0.82+0.18*Math.cos(a))}
export function r77PairRepairAt(x,z){
 const base=R74.terraceDelta(x,z);let repair=0,worst=0,violations=0;
 for(const[xx,zz]of[[x+3,z],[x-3,z],[x,z+3],[x,z-3]]){
  const nb=R74.terraceDelta(xx,zz),d=base-nb,a=Math.abs(d);worst=Math.max(worst,a);
  if(a<=REPAIR_TARGET)continue;violations++;
  const desired=-Math.sign(d)*Math.min(REPAIR_CAP,.5*(a-REPAIR_TARGET));repair+=desired;
 }
 repair=C(repair,-REPAIR_CAP,REPAIR_CAP);
 return{repair,worst,violations,target:REPAIR_TARGET,dangerBase:DANGER_BASE,profileCap:PROFILE_CAP,repairCap:REPAIR_CAP,proofBound:PROOF_BOUND,limit:CLIFF_LIMIT};
}
function compute(x,z){
 const prior=R74.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=R75.r75CarrierWeightAt(x,z);
 if(w<=1e-12||!safe(x,z))return{...prior,r77CarrierWeight:0,r77RawProfileCorrection:0,r77RawDelta:0,r77Delta:0,r77EnvelopeClamped:false,r77EnvelopeFeasible:true,r77SafetyRepair:0,r77WorstPrior3m:0};
 const rawCorr=coherentProfile(old.frac,old.step)*w,rawDd=C(.84*old.mask*rawCorr,-PROFILE_CAP,PROFILE_CAP),pair=r77PairRepairAt(x,z);
 // Near a pre-existing high 3 m relation, suppress visual profile forcing and spend
 // the dedicated repair budget on the coupled relation. Everywhere else the R76/R75
 // full-carrier proposal is unchanged.
 const dangerous=pair.worst>DANGER_BASE,dd=dangerous?pair.repair:rawDd,delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw,delta,target:prior.base+delta,r77CarrierWeight:w,r77RawProfileCorrection:rawCorr,r77RawDelta:rawDd,r77Delta:dd,r77EnvelopeClamped:dangerous&&Math.abs(dd-rawDd)>1e-10,r77EnvelopeFeasible:true,r77SafetyRepair:pair.repair,r77WorstPrior3m:pair.worst,r77DangerSuppressed:dangerous,r77RepairViolations:pair.violations};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r77CarrierAt(x,z){return R75.r75CarrierAt(x,z)}
export function r77CarrierWeightAt(x,z){return R75.r75CarrierWeightAt(x,z)}
export function terraceGroupMask(x,z){return R74.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R74.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round77:{
 scope:'retain the R75/R76 whole-carrier contour profile over frozen R74 evidence, but make the unchanged 1.05 m / 3 m cliff gate carry a real construction margin instead of merely scraping underneath it',
 method:'reuse only frozen R74-accepted carrier evidence and the same zero-mean contour-cycle profile. Calm carrier nodes keep the existing +/-0.035 m profile cap. Only nodes participating in an inherited high 3 m relation suppress profile forcing and receive a dedicated coupled safety-repair budget up to +/-0.045 m, computed from the frozen R74 relation. This separates morphology amplitude from safety correction and preserves footprint, family, stair, carrier and drainage identities.',
 logicCorrection:'R76 exposed a direct infeasible-constraint contradiction. Its inherited worst 3 m relation was 1.112919833 m while each endpoint was capped at 0.035 m, so even perfect symmetric repair could do no better than 1.042919833 m. Demanding <=1.040 m at the same time was mathematically impossible. R77 does not lower the 1.05 m cliff gate and does not amplify normal terrace styling; it gives only the safety repair a 0.045 m endpoint budget, sufficient in principle to reach 1.022919833 m for that pair and therefore establish a visible margin. Passing this local construction proof still does not imply whole-slope visual acceptance.',
 constraint:'the 6 m authoritative lattice, 3 m probes, 1.05 m cliff gate, 0.035 m profile cap, 0.045 m repair cap, 1.03 m proof bound, 12 m drainage core and carrier gates are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: conservation, geometry, adjacency and continuity are necessary bookkeeping/evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership; allowed transfer is not proof of current connection.',
 mrRolordUse:'the latest saved MrRolord frame-study ordering was re-read and is used only as a sequencing constraint: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. No original named video source was available to replay this run; Voronoi, shader displacement and adaptive subdivision remain procedural tools, not agricultural truth.',
 referenceUse:'image(173).png was re-opened this run. It supports long curved contour benches, unequal widths, nested turns, concentrated dark riser edges and drainage interruptions at hillside scale. It is non-metric evidence; no field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic feasible-margin full-carrier profile over frozen R74 evidence; not surveyed terrace, parcel or hydraulic truth',
 priorAccepted:R74.VERSION,failedMarginProposal:R76.VERSION}};
