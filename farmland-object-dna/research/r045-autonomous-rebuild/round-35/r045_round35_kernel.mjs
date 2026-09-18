import * as R34 from '../round-34/r045_round34_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-34/r045_round34_kernel.mjs';

export const VERSION='R045.35';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R35 isolates one remaining terrace-morphology variable: short gaps between already established R34
// contour ribbons. It does not raise risers and it does not globally dilate support. A bridge can turn on
// only when inherited support exists on both sides of the candidate along either the local R30 contour
// tangent or the canonical cross-slope-row axis already used by the R34 fragmentation audit. Hard drainage
// and foreground-receiver exclusions remain authoritative.
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
function compatibleFacingPair(old,x,z,ax,az,d){
  const a=R34.terraceStateAt(x-ax*d,z-az*d),b=R34.terraceStateAt(x+ax*d,z+az*d);
  if(a.mask<.075||b.mask<.075)return 0;
  if(a.groupIndex!==b.groupIndex)return 0;
  const step=.5*(a.step+b.step);
  if(Math.abs(a.step-b.step)>Math.max(.16,.22*step))return 0;
  if(Math.abs(a.index-b.index)>3)return 0;
  // The centre keeps its inherited stair frame. Reject a pair if both shoulders belong to a stair index
  // materially different from that centre frame; this prevents a bridge from inventing a new riser level.
  if(Math.abs(a.index-old.index)>3||Math.abs(b.index-old.index)>3)return 0;
  return Math.min(a.mask,b.mask);
}
function facingSupport(old,x,z){
  const t=contourTangent(x,z),axes=[[t.tx,t.tz],[1,0]],dist=[12,18,24,30,36];
  let best=0;
  for(const [ax,az] of axes)for(const d of dist)best=Math.max(best,compatibleFacingPair(old,x,z,ax,az,d));
  return best;
}
export function shortGapBridgeStrength(x,z){
  const old=R34.terraceStateAt(x,z);
  if(old.mask>=.34)return 0;
  const dd=R30.nearestExtendedDrainageDistance(x,z);
  if(dd<=12)return 0;
  const group=R34.terraceGroupEnvelope(x,z);
  if(group<.045)return 0;
  const broad=R34.broadTerraceEligibility(x,z);
  if(broad<.035)return 0;
  const drain=R34.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);
  if(drain<=.035||river<=.035)return 0;
  const facing=facingSupport(old,x,z);
  if(facing<=Math.max(.11,old.mask+.012))return 0;
  const slopeSafety=.45+.55*C((broad-.035)/.24,0,1);
  const familySafety=.45+.55*C((group-.045)/.28,0,1);
  const drainSafety=.45+.55*C((drain-.035)/.55,0,1);
  const riverSafety=.45+.55*C((river-.035)/.55,0,1);
  const safety=Math.min(slopeSafety,familySafety,drainSafety,riverSafety);
  // Interpolate toward the weaker facing shoulder instead of filling to 1.0. A real bridge is therefore
  // measurable at the support topology level while its elevation response stays bounded by the unchanged raw
  // stair response and unchanged 0.84 vertical multiplier.
  const target=old.mask+.78*(facing-old.mask)*safety;
  return C(target,0,.50);
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
    scope:'reduce the remaining R34 terrace-island reading by closing only short inherited-support gaps with support on both sides while keeping parcels and hydraulics locked',
    method:'hold R34 terrace step, phase, raw stair response and 0.84 vertical amplitude exactly fixed. At low-support samples, test inherited R34 shoulders on both sides at 12-36 m along the local R30 contour tangent and the canonical row axis used by the existing fragmentation audit. A bounded bridge is accepted only when the facing shoulders are materially stronger than the centre, belong to the same inherited terrace family, remain close in stair index/step, broad agricultural-slope/family eligibility is present, and hard drainage/receiver clearances remain open.',
    logicCorrection:'R34 longer ribbons do not prove that the remaining separated-family reading can be solved by higher risers or by globally inflating the mask. Support strength and support topology are different variables: a stronger island remains an island. Conversely, unrestricted morphological closing would erase meaningful drainage interruptions. R35 therefore tests only short two-sided inherited-support bridges, preserves the inherited stair frame and amplitude, and keeps every <=12 m drainage core untouched.',
    failedAttempt:'The first R35 machine run failed 3 of 37 numeric gates because the proposed bridge was over-constrained: sampled R35-R34 change was exactly 0, bridgeCells=0 and thresholdCross=0. Its first real Chrome audit also timed out under overly dense sampling. A second run proved the lighter audit/browser gate itself, but still produced no bridge. Both failures are retained in Git history. The final formulation does not relax the requirement that a material topology change must occur: it searches a bounded 12-36 m two-sided inherited-support window on the local contour tangent plus the already-audited canonical row axis, while retaining family/stair compatibility and hard drainage/receiver exclusions.',
    constraint:'real terrace branch/merge locations cannot be reconstructed quickly from the current 12.5 m macro DEM and photographs. The selected-field microtopography, surveyed riser/bund/channel sections, management boundaries, inlet/outlet sill elevations and event water-management records needed to distinguish a farmed join from a drainage break are absent. R35 bridges are synthetic morphology candidates, not measured Yunnan terrace junctions.',
    xiaomaBoundary:'the Xiaoma/TLO intake still records field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown. A visually continuous bench does not establish ownership, hydraulic connectivity, head, water depth or discharge. R35 creates none of those states.',
    mrRolordUse:'the saved MrRolord frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R35 keeps hydrology-first hard exclusions and adds only deterministic world-space short-gap morphology; it does not copy Blender dimensions, Voronoi cells, shader displacement or adaptive subdivision as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R35 uses only the visible morphology that long contour-following benches can locally reconnect and nest while narrow drainage interruptions remain legible. No metric terrace width, bridge length, riser height, channel size or water depth is inferred from the image.',
    evidenceClass:'synthetic short-gap terrace continuity refinement on the verified R30/R34 substrate; not surveyed Yunnan terrace geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured bridge length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
