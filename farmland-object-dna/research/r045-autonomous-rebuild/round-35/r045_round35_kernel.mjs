import * as R34 from '../round-34/r045_round34_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-34/r045_round34_kernel.mjs';

export const VERSION='R045.35';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R35 isolates the next unresolved terrace-morphology variable: short contour-following gaps between
// already-established R34 ribbons. It does not raise risers and does not dilate support indiscriminately.
// A bridge may appear only when two inherited R34 terrace shoulders face each other along the local R30
// contour tangent, the current point remains inside a terrace-family envelope and broad agricultural-slope
// eligibility, and inherited drainage / foreground-river hard exclusions remain clear.
export const terraceGroups=R34.terraceGroups;
export function terraceGroupWeights(x,z){return R34.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){return R34.terraceGroupEnvelope(x,z)}
export function dominantTerraceGroup(x,z){return R34.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R34.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R34.permissionBridge(x,z)}
export function terraceDrainageClearance(x,z){return R34.terraceDrainageClearance(x,z)}
export function familyOverlapStrength(x,z){return R34.familyOverlapStrength(x,z)}

function contourTangent(x,z){
  const g=R30.gradient(x,z),m=Math.hypot(g.dx,g.dz);
  if(m<1e-8)return{tx:1,tz:0};
  return{tx:-g.dz/m,tz:g.dx/m};
}
function foregroundClearance(x,z){
  const gap=Math.abs(z-R30.riverZ(x));
  return S(R30.riverW(x)+18,R30.riverW(x)+44,gap);
}
function facingSupport(x,z,tx,tz,d){
  const a=R34.terraceStateAt(x-tx*d,z-tz*d),b=R34.terraceStateAt(x+tx*d,z+tz*d);
  if(a.mask<.055||b.mask<.055)return 0;
  const step=.5*(a.step+b.step);
  if(Math.abs(a.step-b.step)>Math.max(.12,.16*step))return 0;
  // Along a contour tangent a small index offset is allowed because the inherited surface is not perfectly flat.
  // More than two steps apart is treated as a different terrace transition, not a short join candidate.
  if(Math.abs(a.index-b.index)>2)return 0;
  if(Math.abs(a.phase-b.phase)>.95*step)return 0;
  return Math.min(a.mask,b.mask);
}
export function shortGapBridgeStrength(x,z){
  const old=R34.terraceStateAt(x,z);
  if(old.mask>=.32)return 0;
  const dd=R30.nearestExtendedDrainageDistance(x,z);
  if(dd<=12)return 0;
  const group=R34.terraceGroupEnvelope(x,z);
  if(group<.06)return 0;
  const broad=R34.broadTerraceEligibility(x,z);
  if(broad<.04)return 0;
  const drain=R34.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);
  if(drain<=.04||river<=.04)return 0;
  const {tx,tz}=contourTangent(x,z);
  const facing=Math.max(facingSupport(x,z,tx,tz,12),facingSupport(x,z,tx,tz,24));
  // A candidate is only a bridge when both shoulders are materially stronger than the centre gap.
  if(facing<=old.mask+.010)return 0;
  const slopeSafety=C((broad-.04)/.28,0,1),familySafety=C((group-.06)/.34,0,1),drainSafety=C((drain-.04)/.64,0,1),riverSafety=C((river-.04)/.64,0,1);
  const safety=.35+.65*Math.min(slopeSafety,familySafety,drainSafety,riverSafety);
  const target=old.mask+.82*(facing-old.mask)*safety;
  return C(target,0,.46);
}
export function familyContinuityMask(x,z){
  const old=R34.terraceStateAt(x,z),bridge=shortGapBridgeStrength(x,z);
  return Math.max(old.mask,bridge);
}
export function terraceGroupMask(x,z){return familyContinuityMask(x,z)}
export function terraceFrameAt(x,z){const old=R34.terraceStateAt(x,z);return{step:old.step,phase:old.phase}}
export function terraceStateAt(x,z){
  const old=R34.terraceStateAt(x,z),bridge=shortGapBridgeStrength(x,z),mask=Math.max(old.mask,bridge),delta=.84*mask*old.raw;
  return{...old,mask,delta,target:old.base+delta,bridgeStrength:bridge};
}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={
  ...R34.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,
  round35:{
    scope:'reduce the remaining R34 terrace-island reading by closing only short contour-following gaps whose two inherited R34 shoulders face one another inside the same terrain-conforming family zone; parcels and hydraulics remain locked',
    method:'hold R34 terrace step, phase, raw stair response and 0.84 vertical amplitude exactly fixed. At low-support samples only, derive the local contour tangent from the verified R30 substrate; probe inherited R34 support at plus/minus 12 m and 24 m; accept a bounded bridge only when both sides are stronger than the centre gap, their stair frames are compatible, broad agricultural-slope eligibility is positive, the family envelope is present, and hard drainage/receiver clearances remain open.',
    logicCorrection:'R34 longer ribbons do not prove that the remaining separated-family reading can be solved by higher risers or by globally inflating the mask. Support strength and support topology are different variables: a stronger island remains an island. Conversely, unrestricted morphological closing would erase meaningful drainage interruptions. R35 therefore tests only short contour-tangent bridges with inherited stair-frame compatibility and keeps every <=12 m drainage core untouched.',
    failedAttempt:'The first R35 machine run failed 3 of 37 numeric gates because the proposed bridge was over-constrained: sampled R35-R34 change was exactly 0, bridgeCells=0 and thresholdCross=0. Its real Chrome audit also timed out because every audit sample evaluated four expensive inherited support probes. That version is retained in Git history. The revision does not relax the requirement that a material topology change must occur; it broadens only the local facing-shoulder compatibility window and reduces the audit sampling density while retaining hard drainage and receiver exclusions.',
    constraint:'real terrace branch/merge locations cannot be reconstructed quickly from the current 12.5 m macro DEM and photographs. The selected-field microtopography, surveyed riser/bund/channel sections, management boundaries, inlet/outlet sill elevations and event water-management records needed to distinguish a farmed join from a drainage break are absent. R35 bridges are synthetic morphology candidates, not measured Yunnan terrace junctions.',
    xiaomaBoundary:'the Xiaoma/TLO intake still records field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown. A visually continuous bench does not establish ownership, hydraulic connectivity, head, water depth or discharge. R35 creates none of those states.',
    mrRolordUse:'the saved MrRolord frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R35 keeps hydrology-first hard exclusions and adds only deterministic world-space contour-tangent morphology; it does not copy Blender dimensions, Voronoi cells, shader displacement or adaptive subdivision as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R35 uses only the visible morphology that long contour-following benches can locally reconnect and nest while narrow drainage interruptions remain legible. No metric terrace width, bridge length, riser height, channel size or water depth is inferred from the image.',
    evidenceClass:'synthetic short-gap terrace continuity refinement on the verified R30/R34 substrate; not surveyed Yunnan terrace geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured bridge length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
