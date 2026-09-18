import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-35/r045_round35_kernel.mjs';

export const VERSION='R045.36';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R36 changes one variable only: the scale of contour-faithful continuity. R35 proved that tiny two-sided
// joins can be made safely, but eight coarse bridge cells were too small to reorganize the hillslope visually.
// This round does NOT raise risers, globally dilate support, or cross the <=12 m drainage core. Instead it
// searches a wider bounded window along the local R30 contour tangent and accepts only same-family, stair-
// compatible shoulders on both sides. The inherited R35 stair frame/raw response/0.84 vertical amplitude stay fixed.
export const terraceGroups=R35.terraceGroups;
export function terraceGroupWeights(x,z){return R35.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){return R35.terraceGroupEnvelope(x,z)}
export function dominantTerraceGroup(x,z){return R35.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R35.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R35.permissionBridge(x,z)}
export function terraceDrainageClearance(x,z){return R35.terraceDrainageClearance(x,z)}
export function familyOverlapStrength(x,z){return R35.familyOverlapStrength(x,z)}

function contourTangent(x,z){
  const g=R30.gradient(x,z),m=Math.hypot(g.dx,g.dz);
  if(m<1e-8)return{tx:1,tz:0};
  return{tx:-g.dz/m,tz:g.dx/m};
}
function foregroundClearance(x,z){
  const gap=Math.abs(z-R30.riverZ(x));
  return S(R30.riverW(x)+18,R30.riverW(x)+44,gap);
}
function compatiblePair(old,x,z,ax,az,d){
  const a=R35.terraceStateAt(x-ax*d,z-az*d),b=R35.terraceStateAt(x+ax*d,z+az*d);
  if(a.mask<.075||b.mask<.075)return null;
  if(a.groupIndex!==b.groupIndex||a.groupIndex!==old.groupIndex)return null;
  const step=.5*(a.step+b.step);
  if(Math.abs(a.step-b.step)>Math.max(.16,.22*step))return null;
  if(Math.abs(a.index-b.index)>3)return null;
  if(Math.abs(a.index-old.index)>3||Math.abs(b.index-old.index)>3)return null;
  return{strength:Math.min(a.mask,b.mask),distance:d,groupIndex:a.groupIndex,indexGap:Math.abs(a.index-b.index),stepGap:Math.abs(a.step-b.step)};
}
export function contourPairAt(x,z){
  const old=R35.terraceStateAt(x,z),t=contourTangent(x,z),dist=[12,18,24,30,36,42,48,54];
  let best=null;
  // The local contour tangent is authoritative. The canonical x-axis is retained only as a weak fallback where
  // R30 gradients are nearly axis-aligned; it cannot outvote a stronger contour-tangent pair.
  for(const d of dist){const p=compatiblePair(old,x,z,t.tx,t.tz,d);if(p&&(!best||p.strength>best.strength))best={...p,axis:'contour'}}
  if(!best||best.strength<.16){for(const d of [12,18,24,30,36]){const p=compatiblePair(old,x,z,1,0,d);if(p&&(!best||p.strength>best.strength))best={...p,axis:'row-fallback'}}}
  return best;
}
export function contourStitchStrength(x,z){
  const old=R35.terraceStateAt(x,z);
  if(old.mask>=.58)return 0;
  const dd=R30.nearestExtendedDrainageDistance(x,z);
  if(dd<=12)return 0;
  const group=R35.terraceGroupEnvelope(x,z),broad=R35.broadTerraceEligibility(x,z);
  if(group<.045||broad<.035)return 0;
  const drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);
  if(drain<=.035||river<=.035)return 0;
  const pair=contourPairAt(x,z);if(!pair)return 0;
  if(pair.strength<=Math.max(.115,old.mask+.006))return 0;
  const slopeSafety=.42+.58*C((broad-.035)/.24,0,1);
  const familySafety=.42+.58*C((group-.045)/.30,0,1);
  const drainSafety=.40+.60*C((drain-.035)/.58,0,1);
  const riverSafety=.40+.60*C((river-.035)/.58,0,1);
  const axisSafety=pair.axis==='contour'?1:.72;
  // Longer two-sided gaps are accepted more cautiously. This makes the stitch scale larger than R35 without
  // converting the operation into unrestricted closing.
  const distanceSafety=C(1-(pair.distance-12)/96,.58,1);
  const safety=Math.min(slopeSafety,familySafety,drainSafety,riverSafety)*axisSafety*distanceSafety;
  const target=old.mask+.72*(pair.strength-old.mask)*safety;
  return C(target,0,.56);
}
export function familyContinuityMask(x,z){
  const old=R35.terraceStateAt(x,z),stitch=contourStitchStrength(x,z);
  return Math.max(old.mask,stitch);
}
export function terraceGroupMask(x,z){return familyContinuityMask(x,z)}
export function terraceFrameAt(x,z){const old=R35.terraceStateAt(x,z);return{step:old.step,phase:old.phase}}
export function terraceStateAt(x,z){
  const old=R35.terraceStateAt(x,z),stitch=contourStitchStrength(x,z),mask=Math.max(old.mask,stitch),delta=.84*mask*old.raw;
  return{...old,mask,delta,target:old.base+delta,stitchStrength:stitch,stitchPair:stitch>old.mask?contourPairAt(x,z):null};
}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={
  ...R35.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,
  round36:{
    scope:'scale the verified R35 short-gap idea into a wider contour-faithful terrace-family stitch while keeping stair geometry, hard drainage breaks, parcels and hydraulics locked',
    method:'hold the R35 step, phase, raw stair response and 0.84 vertical amplitude fixed. For weak/support-gap samples inside the inherited agricultural slope, search same-family compatible shoulders on both sides from 12 to 54 m primarily along the local R30 contour tangent. Apply a distance-damped bounded stitch only when broad slope/family eligibility and drainage/receiver clearances remain open; the canonical row axis is a reduced-strength fallback only.',
    logicCorrection:'The fact that R35 produced safe bridges does not imply that making those bridges taller will solve the visual cluster problem; amplitude and topology are different variables. It also does not justify global mask closing, because a visually convenient join may be a real drainage break. R36 therefore changes continuity scale only, keeps the inherited stair frame/amplitude fixed, and requires same-family two-sided contour support before any larger stitch can appear.',
    constraint:'real terrace continuation, branch and merge locations cannot be reconstructed quickly from the present 12.5 m macro DEM and photographs. Selected-field metre/sub-metre microtopography, surveyed riser/bund/channel sections, management boundaries, inlet/outlet sill elevations and event water-management records are still absent. These stitches are synthetic morphology candidates, not surveyed Yunnan terrace junctions.',
    xiaomaBoundary:'the Xiaoma/TLO intake still marks field location/boundary, sampling window, field microtopography, bund section, channel section and water-control elevation unknown. Contour continuity does not establish ownership, hydraulic connectivity, head, water depth, discharge or gate state; R36 creates none of those states.',
    mrRolordUse:'the saved MrRolord frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain valleys/benches -> terrain-conforming land use. R36 keeps the inherited hydrology-first hard exclusions and deterministic world-space geometry; Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not copied as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R36 uses only visible morphology: long curved contour-following benches form nested families, can reconnect locally, and still preserve narrow drainage interruptions. No metric terrace width, stitch length, riser height, channel size, water depth or hydraulic parameter is inferred from the image.',
    evidenceClass:'synthetic contour-faithful terrace continuity refinement on the verified R30/R35 substrate; not surveyed terrace geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured stitch length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
