import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R43 from '../round-43/r045_round43_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-47/r045_round47_kernel.mjs';

export const VERSION='R045.48';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE47=new Map(),CACHE48=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r47At(x,z){const k=keyOf(x,z);let v=CACHE47.get(k);if(v===undefined){v=R47.terraceStateAt(x,z);CACHE47.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0,gm:m};return{tx:-gz/m,tz:gx/m,gm:m}}
function segmentSafe(ax,az,bx,bz){for(const t of [0,.25,.5,.75,1])if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false;return true}
const DIRS=[[1,0,'E'],[-1,0,'W'],[0,1,'S'],[0,-1,'N'],[1,1,'SE'],[-1,-1,'NW'],[1,-1,'NE'],[-1,1,'SW']];
const DIST=[6,12,18];
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};

// R47 proved that curvature-aware continuation is safe, but five promoted lattice samples are still too local
// to establish a hillside-scale terrace family. R48 changes one causal variable only: support reach. A weak
// candidate may look back to frozen R47 active support at 6/12/18 m, and the second frozen support may lie a
// further 6/12/18 m along the same or one-sector-turn contour arc. Every segment is sampled for safety; R48
// cells never seed R48. Existing R47 active geometry, stair frame, raw response and 0.84 amplitude remain exact.
export function contourReachSupportAt(x,z){
 const base=r47At(x,z);if(base.mask>ACTIVE||base.mask<=.004||safetyAt(x,z)<=.10)return null;
 const tan0=contourTangent(x,z);let best=null;
 for(const [ux1,uz1,name1] of DIRS)for(const d1 of DIST){
  const dx1=ux1*d1,dz1=uz1*d1,q1x=x-dx1,q1z=z-dz1,q1=r47At(q1x,q1z);if(q1.mask<=ACTIVE||!compatible(base,q1))continue;
  const len1=Math.hypot(dx1,dz1),align0=Math.abs((dx1*tan0.tx+dz1*tan0.tz)/len1);if(align0<.42||!segmentSafe(x,z,q1x,q1z))continue;
  const tan1=contourTangent(q1x,q1z);
  for(const [ux2,uz2,name2] of DIRS)for(const d2 of DIST){
   const dx2=ux2*d2,dz2=uz2*d2,q2x=q1x-dx2,q2z=q1z-dz2;if(Math.hypot(q2x-x,q2z-z)<5)continue;
   const q2=r47At(q2x,q2z);if(q2.mask<=ACTIVE||!compatible(base,q2)||!compatible(q1,q2))continue;
   const turnCos=vdot(dx1,dz1,dx2,dz2);if(turnCos<.70)continue;
   const len2=Math.hypot(dx2,dz2),align1=Math.abs((dx2*tan1.tx+dz2*tan1.tz)/len2);if(align1<.38||!segmentSafe(q1x,q1z,q2x,q2z))continue;
   const turnDeg=Math.acos(C(turnCos,-1,1))*180/Math.PI,totalReach=len1+len2;
   const score=.84*align0+.52*align1+.42*Math.min(q1.mask,q2.mask)+.12*safetyAt(x,z)-.0045*totalReach-.0015*turnDeg;
   if(!best||score>best.score)best={mode:'frozen-r47-multiscale-contour-reach',direction:`${name1}${d1}<-${name2}${d2}`,dx1,dz1,dx2,dz2,d1,d2,totalReach,alignment:align0,secondAlignment:align1,turnDeg,score,groupIndex:base.groupIndex,sourceMasks:[q1.mask,q2.mask],sourceIndices:[q1.index,q2.index],safety:safetyAt(x,z)};
  }
 }
 return best;
}
export function contourReachGain(x,z){const base=r47At(x,z);if(base.mask>ACTIVE)return 0;const sup=contourReachSupportAt(x,z);if(!sup)return 0;const reachBonus=C((sup.totalReach-12)/24,0,1),target=C(.146+.030*sup.alignment+.018*sup.secondAlignment+.016*sup.safety+.015*Math.min(...sup.sourceMasks)+.008*reachBonus,.151,.205),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.145/(.84*rawAbs):.18;return C(Math.max(0,target-base.mask),0,Math.min(.18,deltaBound))}
function computeTerraceState(x,z){const base=r47At(x,z);if(base.mask>ACTIVE)return{...base,contourReachGain:0,contourReachSupport:null};const gain=contourReachGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?contourReachSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,contourReachGain:gain,contourReachSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE48.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE48.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r47At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R47.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round48:{
 scope:'replace five-cell-local R47 continuation with a materially broader frozen-R47 multiscale contour-reach pass while keeping inherited active geometry, riser amplitude and hydrology fixed',
 method:'start from successful R47. Only weak positive-support candidates may promote. Search frozen R47 active supports at 6/12/18 m along the local R30 contour tangent, then a second frozen support another 6/12/18 m away with at most one 45-degree turn. Candidate/support family and stair frame must remain compatible; both arc segments are sampled at quarter points for agricultural/drainage/receiver safety; R48 gains are non-recursive and bounded by unchanged 0.84 raw stair response.',
 logicCorrection:'R47 passing 31/31 numeric and Chrome gates does not prove hillside-scale terrace organization: persisted evidence shows only five promotions and unchanged global component count. Conversely, forcing global component count downward would erase legitimate drainage-separated families. R48 therefore asks for materially broader contour-following support reach inside existing separators, while requiring inherited active surface, compatible fragmentation and drainage cores to remain exact/non-worse.',
 constraint:'the 6 m QA lattice, 6/12/18 m search radii, 0.42/0.38 tangent gates, one-sector turn allowance, stair tolerances and 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. Current 12.5 m macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundary remains active: one continuous surface or a longer contour ribbon does not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread for non-metric morphology only: long curved contour-following ribbons, unequal widths, nested organization, local junctions and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-R47 multiscale contour reach under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
