import * as R43 from '../round-43/r045_round43_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-43/r045_round43_kernel.mjs';

export const VERSION='R045.47';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE43=new Map(),CACHE47=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r43At(x,z){const k=keyOf(x,z);let v=CACHE43.get(k);if(v===undefined){v=R43.terraceStateAt(x,z);CACHE43.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0,gm:m};return{tx:-gz/m,tz:gx/m,gm:m}}
function segmentSafe(ax,az,bx,bz){return safetyAt(ax,az)>.10&&safetyAt(.5*(ax+bx),.5*(az+bz))>.10&&safetyAt(bx,bz)>.10}
const DIRS=[[6,0,'E'],[-6,0,'W'],[0,6,'S'],[0,-6,'N'],[6,6,'SE'],[-6,-6,'NW'],[6,-6,'NE'],[-6,6,'SW']];
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};

// R46 proved that a straight two-cell frozen run can be extended safely, but it produced only three promotions
// on the full 6 m slope audit. Treating that as sufficient would repeat the same small-patch fallacy seen in
// R43-R46: more endpoint cells are not the same thing as a hillside-scale nested terrace organization.
// R47 therefore advances one causal level: a weak endpoint may extend from TWO frozen R43 cells that form a
// locally smooth contour arc. The second support cell may turn by one 45-degree lattice sector, so a real curved
// terrace ribbon can continue without forcing it into a globally straight row. New R47 cells never seed R47.
export function contourArcSupportAt(x,z){
 const base=r43At(x,z);if(base.mask>ACTIVE||base.mask<=.006||safetyAt(x,z)<=.10)return null;
 const tan0=contourTangent(x,z);let best=null;
 for(const [dx1,dz1,name1] of DIRS){
  const q1x=x-dx1,q1z=z-dz1,q1=r43At(q1x,q1z);if(q1.mask<=ACTIVE||!compatible(base,q1))continue;
  const len1=Math.hypot(dx1,dz1),align0=Math.abs((dx1*tan0.tx+dz1*tan0.tz)/len1);if(align0<.50)continue;
  if(!segmentSafe(x,z,q1x,q1z))continue;
  const tan1=contourTangent(q1x,q1z);
  for(const [dx2,dz2,name2] of DIRS){
   const q2x=q1x-dx2,q2z=q1z-dz2;if(Math.abs(q2x-x)<1e-9&&Math.abs(q2z-z)<1e-9)continue;
   const q2=r43At(q2x,q2z);if(q2.mask<=ACTIVE||!compatible(base,q2)||!compatible(q1,q2))continue;
   const turnCos=vdot(dx1,dz1,dx2,dz2);if(turnCos<.70)continue;
   const len2=Math.hypot(dx2,dz2),align1=Math.abs((dx2*tan1.tx+dz2*tan1.tz)/len2);if(align1<.45)continue;
   if(!segmentSafe(q1x,q1z,q2x,q2z))continue;
   const turnDeg=Math.acos(C(turnCos,-1,1))*180/Math.PI;
   const score=.85*align0+.55*align1+.45*Math.min(q1.mask,q2.mask)+.10*safetyAt(x,z)-.002*turnDeg;
   if(!best||score>best.score)best={mode:'frozen-r43-contour-arc-extension',direction:`${name1}<-${name2}`,dx1,dz1,dx2,dz2,alignment:align0,secondAlignment:align1,turnDeg,score,groupIndex:base.groupIndex,sourceMasks:[q1.mask,q2.mask],sourceIndices:[q1.index,q2.index],safety:safetyAt(x,z)};
  }
 }
 return best;
}
export function contourArcGain(x,z){const base=r43At(x,z);if(base.mask>ACTIVE)return 0;const sup=contourArcSupportAt(x,z);if(!sup)return 0;const target=C(.145+.032*sup.alignment+.018*sup.secondAlignment+.018*sup.safety+.016*Math.min(...sup.sourceMasks),.152,.208),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.150/(.84*rawAbs):.18;return C(Math.max(0,target-base.mask),0,Math.min(.18,deltaBound))}
function computeTerraceState(x,z){const base=r43At(x,z);if(base.mask>ACTIVE)return{...base,contourArcGain:0,contourArcSupport:null};const gain=contourArcGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?contourArcSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,contourArcGain:gain,contourArcSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE47.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE47.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r43At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R43.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round47:{
 scope:'replace the under-material straight R46 endpoint extension with curvature-aware frozen-R43 contour-arc continuation; keep riser amplitude, inherited active surface and hard drainage separators fixed',
 method:'start from accepted R43. A weak candidate may be promoted only when two frozen R43 active supports form a locally smooth same-family/stair-compatible arc behind it. Candidate-to-support alignment must follow the local R30 contour tangent, the second support may turn by at most one 45-degree lattice sector, both segments and their midpoints must clear agricultural, drainage and foreground-receiver safety, and new R47 cells never seed new growth.',
 logicCorrection:'R46 browser success did not make its geometry sufficient: persisted QA recorded only three promotions. Conversely, demanding fewer global components is also not a terrace truth because protected drainage corridors are legitimate separators. R47 therefore tests material contour-arc continuation inside separators while requiring compatible component/orphan/tiny-fragment topology to be no worse.',
 constraint:'the 6 m QA lattice, 0.50/0.45 tangent-alignment gates, one-sector curvature allowance, stair tolerances and 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured connectivity. Current 12.5 m macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread for non-metric morphology only: long curved contour-following ribbons, unequal widths, nested organization and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-R43 curvature-aware contour continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth',
 failedPredecessor:'R045.46 persisted QA was 28/30 despite a successful Chrome render: only three endpoint promotions were material, so R46 remains a failed geometry round rather than an accepted visual stage.',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
