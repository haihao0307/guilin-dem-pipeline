import * as R33 from '../round-33/r045_round33_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-33/r045_round33_kernel.mjs';

export const VERSION='R045.34';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R33 proved that a narrower synthetic drainage shoulder can reconnect terrace support without moving the
// verified quantization frame, but the fixed-view audit still reads as several terrace clusters. R34 isolates
// the next hypothesis: small eligibility holes inside a contour-following family are fragmenting the planform.
// Riser amplitude, terrace step, phase and raw stair response remain exactly R33. Only the support mask is
// morphologically closed along the local contour tangent, and the <=12 m drainage core remains a hard veto.
export const terraceGroups=R33.terraceGroups;
export function terraceGroupWeights(x,z){return R33.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){return R33.terraceGroupEnvelope(x,z)}
export function dominantTerraceGroup(x,z){return R33.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R33.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R33.permissionBridge(x,z)}
export function terraceDrainageClearance(x,z){return R33.terraceDrainageClearance(x,z)}

// Strengthen only overlaps that already exist between the three R32/R33 family envelopes. This does not
// create a new family footprint on its own; it prevents max() seams from weakening branch/merge junctions.
export function terraceGroupUnionEnvelope(x,z){
  const w=R33.terraceGroupWeights(x,z);
  const u=1-w.reduce((p,v)=>p*(1-.86*C(v,0,1)),1);
  return C(Math.max(R33.terraceGroupEnvelope(x,z),u),0,1);
}

function contourTangent(x,z){
  const g=R30.gradient(x,z),m=Math.hypot(g.dx,g.dz)||1;
  return{tx:-g.dz/m,tz:g.dx/m};
}

// Bilateral closing is deliberately contour-tangent, not axis-aligned. A hole is eligible for stitching only
// when permission exists on both sides along the local contour direction. One-sided dilation is forbidden so
// the operation cannot simply grow terraces outward into new terrain.
export function contourBridgePermission(x,z){
  const p0=R33.permissionBridge(x,z),t=contourTangent(x,z),D=[8,16,24];
  let left=0,right=0;
  for(const d of D){
    left=Math.max(left,R33.permissionBridge(x-d*t.tx,z-d*t.tz));
    right=Math.max(right,R33.permissionBridge(x+d*t.tx,z+d*t.tz));
  }
  const bilateral=Math.min(left,right);
  return C(Math.max(p0,.78*bilateral),0,1);
}

export function terraceGroupMask(x,z){
  const group=terraceGroupUnionEnvelope(x,z);if(group<=0)return 0;
  const drainClear=R33.terraceDrainageClearance(x,z);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R30.riverZ(x));
  const riverClear=S(R30.riverW(x)+18,R30.riverW(x)+44,riverGap);if(riverClear<=0)return 0;
  return C(group*drainClear*riverClear*contourBridgePermission(x,z),0,1);
}

// Preserve R33 quantization exactly. R34 tests only contour-family connectivity.
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
    scope:'reduce the remaining R33 terrace-cluster reading by closing small support holes along local contour tangents while retaining hard drainage interruptions; parcels and hydraulics remain locked',
    method:'hold R33 step, phase, raw stair response and 0.84 vertical amplitude exactly fixed; replace max-only family overlap with a bounded union at existing overlaps and add bilateral contour-tangent permission closing at 8/16/24 m, then reapply the unchanged <=12 m drainage-core veto and foreground-river exclusion',
    logicCorrection:'R33 remaining cluster visibility does not prove that risers are too low or that terrace amplitude should increase. It also does not justify indiscriminate dilation: outward growth can fabricate new agricultural footprint. R34 therefore requires support on both sides along the local contour tangent before a small eligibility hole can be stitched, and keeps the elevation quantization exactly unchanged.',
    constraint:'real branch, merge and continuation of terraces cannot be reconstructed quickly from the current 12.5 m macro DEM and photographs because selected-field microtopography, surveyed riser/bund/channel sections, management boundaries, inlet/outlet sill elevations and event water-management records are absent. The 8/16/24 m closing distances are synthetic QA parameters, not Yunnan engineering dimensions.',
    xiaomaBoundary:'the Xiaoma/TLO intake still records field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown. Geometric continuity is not sufficient evidence for ownership, hydraulic connectivity, head, water depth or discharge. R34 creates none of those states.',
    mrRolordUse:'the saved frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R34 translates that into deterministic world-space contour-tangent support closing; it does not copy Blender dimensions, Voronoi cells, shader displacement or adaptive subdivision as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R34 uses only visible morphology: long contour-following terrace ribbons locally join, split and nest while narrow drainage interruptions remain. No metric terrace width, closing distance, riser height, channel size or water depth is inferred.',
    evidenceClass:'synthetic contour-family continuity refinement on the verified R30/R33 substrate; not surveyed Yunnan terrace geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
