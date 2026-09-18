import * as R33 from '../round-33/r045_round33_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-33/r045_round33_kernel.mjs';

export const VERSION='R045.34';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// The first R34 attempt sampled R30 gradients plus six off-axis permission probes for every terrace query.
// Numeric QA did not complete in a practical browser/runner budget, so that implementation is retained in
// Git history but rejected. Final R34 isolates a cheaper and more testable hypothesis: weak positive support
// inside already-existing contour families is being thresholded into clusters. Elevation quantization remains
// exactly R33; only existing family overlap and existing positive permission are strengthened.
export const terraceGroups=R33.terraceGroups;
export function terraceGroupWeights(x,z){return R33.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){return R33.terraceGroupEnvelope(x,z)}
export function dominantTerraceGroup(x,z){return R33.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R33.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R33.permissionBridge(x,z)}
export function terraceDrainageClearance(x,z){return R33.terraceDrainageClearance(x,z)}

// Probabilistic union only strengthens places where one or more verified R33 family envelopes already exist.
// It cannot create a new family footprint where all inherited family weights are zero.
export function terraceGroupUnionEnvelope(x,z){
  const w=R33.terraceGroupWeights(x,z);
  const u=1-w.reduce((p,v)=>p*(1-.84*C(v,0,1)),1);
  return C(Math.max(R33.terraceGroupEnvelope(x,z),u),0,1);
}

// Continuity is a bounded remap of already-positive R33 permission. Zero stays zero, so this is not an
// unrestricted dilation. Adjacent-family overlaps receive a little more lift so branch/merge junctions stop
// being weakened by max-only support, while single-family ribbons receive a smaller lift.
export function familyContinuityPermission(x,z){
  const p=R33.permissionBridge(x,z);if(p<=0)return 0;
  const w=R33.terraceGroupWeights(x,z),ov=Math.max(Math.sqrt(w[0]*w[1]),Math.sqrt(w[1]*w[2]));
  const exponent=1.22+.24*S(.06,.42,ov);
  return C(Math.max(p,1-Math.pow(1-p,exponent)),0,1);
}

export function terraceGroupMask(x,z){
  const group=terraceGroupUnionEnvelope(x,z);if(group<=0)return 0;
  const drainClear=R33.terraceDrainageClearance(x,z);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R30.riverZ(x));
  const riverClear=S(R30.riverW(x)+18,R30.riverW(x)+44,riverGap);if(riverClear<=0)return 0;
  return C(group*drainClear*riverClear*familyContinuityPermission(x,z),0,1);
}

// Preserve R33 quantization exactly. R34 tests support-family continuity only.
export function terraceFrameAt(x,z){const old=R33.terraceStateAt(x,z);return{step:old.step,phase:old.phase}}
export function terraceStateAt(x,z){
  const old=R33.terraceStateAt(x,z),mask=terraceGroupMask(x,z),delta=.84*mask*old.raw;
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
    scope:'reduce the remaining R33 terrace-cluster reading by strengthening weak support inside already-existing contour families and their overlaps while retaining hard drainage interruptions; parcels and hydraulics remain locked',
    method:'hold R33 step, phase, raw stair response and 0.84 vertical amplitude exactly fixed; use a bounded union only where inherited family envelopes already exist and a monotone remap of already-positive R33 permission, with a modest extra lift at adjacent-family overlaps; then reapply the unchanged <=12 m drainage-core veto and foreground-river exclusion',
    logicCorrection:'R33 remaining cluster visibility does not prove that risers are too low or that terrace amplitude should increase. It also does not justify unrestricted dilation into new terrain. The first R34 tangent-probe implementation additionally confused geometric sophistication with useful computation: repeated off-axis field queries made verification impractically slow. Final R34 keeps zero support at zero, strengthens only inherited positive support, and leaves elevation quantization unchanged.',
    failedAttempt:'the first R34 implementation used local R30 gradient tangents plus six off-axis permission probes per terrace query. Numeric QA remained in the generation step for minutes instead of completing in the normal round budget, so that implementation was rejected rather than treating computational cost as irrelevant.',
    constraint:'real branch, merge and continuation of terraces cannot be reconstructed quickly from the current 12.5 m macro DEM and photographs because selected-field microtopography, surveyed riser/bund/channel sections, management boundaries, inlet/outlet sill elevations and event water-management records are absent. The support remap is a synthetic QA morphology, not a Yunnan engineering dimension or survey.',
    xiaomaBoundary:'the Xiaoma/TLO intake still records field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown. Geometric continuity is not sufficient evidence for ownership, hydraulic connectivity, head, water depth or discharge. R34 creates none of those states.',
    mrRolordUse:'the saved frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R34 translates that into deterministic world-space support continuity; it does not copy Blender dimensions, Voronoi cells, shader displacement or adaptive subdivision as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R34 uses only visible morphology: long contour-following terrace ribbons locally join, split and nest while narrow drainage interruptions remain. No metric terrace width, merge distance, riser height, channel size or water depth is inferred.',
    evidenceClass:'synthetic contour-family continuity refinement on the verified R30/R33 substrate; not surveyed Yunnan terrace geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
