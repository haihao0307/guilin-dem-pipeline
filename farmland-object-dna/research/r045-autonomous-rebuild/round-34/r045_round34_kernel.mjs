import * as R33 from '../round-33/r045_round33_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-33/r045_round33_kernel.mjs';

export const VERSION='R045.34';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R34 isolates one variable: support continuity inside the already verified R33 terrace mask.
// Two broader formulations were rejected: an off-axis contour probe was too expensive to verify, and a
// duplicated-permission formulation remained unnecessarily slow. A stronger cheap remap was also rejected
// after measurement: it created four extra threshold-level row runs. Final R34 therefore returns to the weaker
// remap that lengthened existing ribbons with no increase in row-run count. No inherited zero-support cell can
// turn on. Step, phase, raw stair response and the 0.84 vertical amplitude remain exactly R33.
export const terraceGroups=R33.terraceGroups;
export function terraceGroupWeights(x,z){return R33.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){return R33.terraceGroupEnvelope(x,z)}
export function dominantTerraceGroup(x,z){return R33.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R33.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R33.permissionBridge(x,z)}
export function terraceDrainageClearance(x,z){return R33.terraceDrainageClearance(x,z)}

export function familyOverlapStrength(x,z){
  const w=R33.terraceGroupWeights(x,z);
  return C(Math.max(Math.sqrt(w[0]*w[1]),Math.sqrt(w[1]*w[2])),0,1);
}
export function familySupportExponent(x,z){return 1.20+.20*S(.06,.42,familyOverlapStrength(x,z))}
function remapInheritedMask(oldMask,x,z){
  if(oldMask<=0)return 0;
  const e=familySupportExponent(x,z);
  return C(1-Math.pow(1-C(oldMask,0,1),e),0,1);
}
export function familyContinuityMask(x,z){const old=R33.terraceStateAt(x,z);return remapInheritedMask(old.mask,x,z)}
export function terraceGroupMask(x,z){return familyContinuityMask(x,z)}

export function terraceFrameAt(x,z){const old=R33.terraceStateAt(x,z);return{step:old.step,phase:old.phase}}
export function terraceStateAt(x,z){
  const old=R33.terraceStateAt(x,z),mask=remapInheritedMask(old.mask,x,z),delta=.84*mask*old.raw;
  return{...old,mask,delta,target:old.base+delta};
}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={
  ...R33.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,
  round34:{
    scope:'reduce the remaining R33 terrace-cluster reading by strengthening weak positive support inside already-existing terrace families and their overlaps, while retaining every inherited zero-support interruption; parcels and hydraulics remain locked',
    method:'hold R33 footprint zeros, step, phase, raw stair response and 0.84 vertical amplitude exactly fixed; apply a bounded monotone remap only to positive R33 mask values, with inherited adjacent-family overlap varying the exponent from 1.20 to 1.40. The measured 39/40 run lengthened the median longest row ribbon from 48 m to 54 m while keeping total row runs at 76; final QA evaluates that monotone connectivity directly rather than using a non-monotone short-gap bucket.',
    logicCorrection:'R33 remaining cluster visibility does not prove that risers are too low or that terrace amplitude should increase, and it does not justify unrestricted dilation into new terrain. Computational sophistication is also not evidence of a better model: the first two R34 formulations were too expensive to verify. Finally, counting only gaps shorter than an arbitrary threshold is not a monotone fragmentation measure: partially closing a five-cell gap into a four-cell gap makes that count rise even though continuity improved. Final R34 therefore uses the smallest causal variable—positive inherited support strength—and judges it by zero-footprint preservation, row-run count, ribbon length and fragmentation burden.',
    failedAttempt:'the first R34 implementation used local R30 gradient tangents plus six off-axis permission probes per terrace query; a second formulation still recomputed duplicated permission fields. Both kept numeric generation running for minutes. The first cheap 1.20-1.40 remap passed 39/40: row runs stayed 76 and median longest ribbon rose 48->54 m, but a flawed <=4-cell gap bucket rose 4->20 because partially closed longer gaps entered that bucket. A stronger 1.55-1.80 remap was then tested rather than merely relaxing QA; it worsened actual row runs 76->80 and was rejected. All attempts remain in Git history.',
    constraint:'real branch, merge and continuation of terraces cannot be reconstructed quickly from the current 12.5 m macro DEM and photographs because selected-field microtopography, surveyed riser/bund/channel sections, management boundaries, inlet/outlet sill elevations and event water-management records are absent. This positive-mask remap is synthetic QA morphology, not Yunnan survey or engineering truth.',
    xiaomaBoundary:'the Xiaoma/TLO intake still records field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown. Geometric continuity is not sufficient evidence for ownership, hydraulic connectivity, head, water depth or discharge. R34 creates none of those states.',
    mrRolordUse:'the saved frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R34 keeps the inherited hydrology-first exclusions and changes only deterministic world-space terrace support strength; it does not copy Blender dimensions, Voronoi cells, shader displacement or adaptive subdivision as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R34 uses only visible morphology: long contour-following terrace ribbons read as coherent families with local joins and nesting while narrow drainage interruptions remain. No metric terrace width, merge distance, riser height, channel size or water depth is inferred.',
    evidenceClass:'synthetic inherited-mask continuity refinement on the verified R30/R33 substrate; not surveyed Yunnan terrace geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
