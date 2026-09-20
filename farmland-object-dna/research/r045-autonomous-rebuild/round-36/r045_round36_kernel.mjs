import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R34 from '../round-34/r045_round34_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-35/r045_round35_kernel.mjs';

export const VERSION='R045.36';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R36 changes continuity topology, not stair amplitude. R35 proved tiny safe joins but those were too sparse
// to reorganize whole-slope terrace families. The wider search below is a contour-tangent FAN, not a global
// morphological close: it samples nearby contour directions, requires same-family compatible shoulders on both
// sides, and keeps the inherited <=12 m drainage core and receiver exclusion hard-locked.
export const terraceGroups=R35.terraceGroups;
export function terraceGroupWeights(x,z){return R35.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){return R35.terraceGroupEnvelope(x,z)}
export function dominantTerraceGroup(x,z){return R35.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R35.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R35.permissionBridge(x,z)}
export function terraceDrainageClearance(x,z){return R35.terraceDrainageClearance(x,z)}
export function familyOverlapStrength(x,z){return R35.familyOverlapStrength(x,z)}

function contourTangent(x,z){const g=R30.gradient(x,z),m=Math.hypot(g.dx,g.dz);if(m<1e-8)return{tx:1,tz:0};return{tx:-g.dz/m,tz:g.dx/m}}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function rotate(ax,az,a){const c=Math.cos(a),s=Math.sin(a);return{ax:ax*c-az*s,az:ax*s+az*c}}
function compatiblePair(old,x,z,ax,az,d){
  const a=R34.terraceStateAt(x-ax*d,z-az*d),b=R34.terraceStateAt(x+ax*d,z+az*d);
  if(a.mask<.055||b.mask<.055)return null;
  if(a.groupIndex!==b.groupIndex||a.groupIndex!==old.groupIndex)return null;
  const step=.5*(a.step+b.step);
  if(Math.abs(a.step-b.step)>Math.max(.18,.25*step))return null;
  if(Math.abs(a.index-b.index)>4)return null;
  if(Math.abs(a.index-old.index)>4||Math.abs(b.index-old.index)>4)return null;
  return{strength:Math.min(a.mask,b.mask),distance:d,groupIndex:a.groupIndex,indexGap:Math.abs(a.index-b.index),stepGap:Math.abs(a.step-b.step)};
}
function bestPair(old,x,z){
  const t=contourTangent(x,z),dist=[12,18,24,30,36,42,48,54,60],angles=[0,-.18,.18,-.34,.34];let best=null;
  for(const ang of angles){const v=rotate(t.tx,t.tz,ang);for(const d of dist){const p=compatiblePair(old,x,z,v.ax,v.az,d);if(p){const score=p.strength*(1-.16*Math.abs(ang)/.34)*(1-.10*(d-12)/48);if(!best||score>best.score)best={...p,axis:'contour',angle:ang,score}}}}
  if(!best||best.strength<.13){for(const d of [12,18,24,30,36,42]){const p=compatiblePair(old,x,z,1,0,d);if(p){const score=.70*p.strength;if(!best||score>best.score)best={...p,axis:'row-fallback',angle:0,score}}}}
  return best;
}
export function contourPairAt(x,z){return bestPair(R35.terraceStateAt(x,z),x,z)}
function stitchInfoAt(x,z){
  const old=R35.terraceStateAt(x,z);if(old.mask>=.58)return{old,target:0,pair:null};
  const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return{old,target:0,pair:null};
  const group=R35.terraceGroupEnvelope(x,z),broad=R35.broadTerraceEligibility(x,z);if(group<.035||broad<.030)return{old,target:0,pair:null};
  const drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(drain<=.035||river<=.035)return{old,target:0,pair:null};
  const pair=bestPair(old,x,z);if(!pair||pair.strength<.06)return{old,target:0,pair:null};
  const slopeSafety=.40+.60*C((broad-.030)/.24,0,1),familySafety=.40+.60*C((group-.035)/.30,0,1),drainSafety=.38+.62*C((drain-.035)/.58,0,1),riverSafety=.38+.62*C((river-.035)/.58,0,1);
  const axisSafety=pair.axis==='contour'?1:.68,distanceSafety=C(1-(pair.distance-12)/110,.55,1),safety=Math.min(slopeSafety,familySafety,drainSafety,riverSafety)*axisSafety*distanceSafety;
  // Interpolate across a two-sided, same-family gap. The family term can promote weak-positive inherited support
  // above the active threshold, but the target remains capped well below core terrace support and never alters
  // the inherited stair step/phase/raw response.
  const interpolated=pair.strength*(.74+.26*safety)+.34*group*safety*C(1-old.mask/.58,0,1);
  const target=C(Math.max(old.mask,interpolated),0,.56);if(target<=old.mask+.002)return{old,target:0,pair:null};return{old,target,pair};
}
export function contourStitchStrength(x,z){return stitchInfoAt(x,z).target}
export function familyContinuityMask(x,z){const s=stitchInfoAt(x,z);return Math.max(s.old.mask,s.target)}
export function terraceGroupMask(x,z){return familyContinuityMask(x,z)}
export function terraceFrameAt(x,z){const old=R35.terraceStateAt(x,z);return{step:old.step,phase:old.phase}}
export function terraceStateAt(x,z){const s=stitchInfoAt(x,z),mask=Math.max(s.old.mask,s.target),delta=.84*mask*s.old.raw;return{...s.old,mask,delta,target:s.old.base+delta,stitchStrength:s.target,stitchPair:s.target>s.old.mask?s.pair:null}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R35.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round36:{
  scope:'scale the verified R35 short-gap idea into a wider contour-faithful terrace-family stitch while keeping stair geometry, hard drainage breaks, parcels and hydraulics locked',
  method:'hold R35 step, phase, raw stair response and 0.84 vertical amplitude fixed. Search same-family compatible shoulders on both sides from 12 to 60 m across a narrow local contour-tangent fan; use R34 shoulder support to avoid recursive R35 bridge evaluation; apply a distance/angle-damped bounded interpolation only when slope/family eligibility and drainage/receiver clearances remain open. Canonical row search is a reduced-strength fallback only.',
  logicCorrection:'The fact that R35 produced safe bridges does not imply that making those bridges taller will solve the visual cluster problem; amplitude and topology are different variables. It also does not justify global mask closing, because a visually convenient join may be a real drainage break. R36 therefore changes continuity scale only, keeps the inherited stair frame/amplitude fixed, and requires same-family two-sided contour support before any larger stitch can appear.',
  constraint:'real terrace continuation, branch and merge locations cannot be reconstructed quickly from the present 12.5 m macro DEM and photographs. Selected-field metre/sub-metre microtopography, surveyed riser/bund/channel sections, management boundaries, inlet/outlet sill elevations and event water-management records are still absent. These stitches are synthetic morphology candidates, not surveyed Yunnan terrace junctions.',
  xiaomaBoundary:'the Xiaoma/TLO intake still marks field location/boundary, sampling window, field microtopography, bund section, channel section and water-control elevation unknown. Contour continuity does not establish ownership, hydraulic connectivity, head, water depth, discharge or gate state; R36 creates none of those states.',
  mrRolordUse:'the saved MrRolord frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain valleys/benches -> terrain-conforming land use. R36 keeps the inherited hydrology-first hard exclusions and deterministic world-space geometry; Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not copied as agricultural truth.',
  referenceUse:'image(173).png was reopened this round. R36 uses only visible morphology: long curved contour-following benches form nested families, can reconnect locally, and still preserve narrow drainage interruptions. No metric terrace width, stitch length, riser height, channel size, water depth or hydraulic parameter is inferred from the image.',
  evidenceClass:'synthetic contour-faithful terrace continuity refinement on the verified R30/R35 substrate; not surveyed terrace geometry or hydraulic truth',
  forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured stitch length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
}};
