import * as R43 from '../round-43/r045_round43_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-43/r045_round43_kernel.mjs';

export const VERSION='R045.46';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE43=new Map(),CACHE46=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r43At(x,z){const k=keyOf(x,z);let v=CACHE43.get(k);if(v===undefined){v=R43.terraceStateAt(x,z);CACHE43.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0,gm:m};return{tx:-gz/m,tz:gx/m,gm:m}}
function segmentSafe(ax,az,bx,bz){return safetyAt(ax,az)>.08&&safetyAt(.5*(ax+bx),.5*(az+bz))>.08&&safetyAt(bx,bz)>.08}
const DIRS=[[6,0,'E'],[-6,0,'W'],[0,6,'S'],[0,-6,'N'],[6,6,'SE'],[-6,-6,'NW'],[6,-6,'NE'],[-6,6,'SW']];

// R45 exposed a validation fallacy: fewer global compatible components is not a necessary terrace truth when
// hard drainage corridors are supposed to remain separators. R46 therefore returns to the last accepted R43
// surface and performs one non-recursive, contour-tangent continuation beyond a frozen two-cell accepted run.
// This can lengthen nested contour ribbons inside a drainage-bounded agricultural slope cell, but it is never
// allowed to use a new R46 cell as a seed or to cross the <=12 m hard drainage core.
export function contourContinuationSupportAt(x,z){
 const base=r43At(x,z);if(base.mask>.12||base.mask<=.015||safetyAt(x,z)<=.08)return null;
 const tan=contourTangent(x,z);let best=null;
 for(const [dx,dz,name] of DIRS){
  const len=Math.hypot(dx,dz),alignment=Math.abs((dx*tan.tx+dz*tan.tz)/len);if(alignment<.55)continue;
  const q1=r43At(x-dx,z-dz),q2=r43At(x-2*dx,z-2*dz);if(q1.mask<=ACTIVE||q2.mask<=ACTIVE)continue;
  if(!compatible(base,q1)||!compatible(base,q2)||!compatible(q1,q2))continue;
  if(!segmentSafe(x,z,x-dx,z-dz)||!segmentSafe(x-dx,z-dz,x-2*dx,z-2*dz))continue;
  const score=alignment+.55*Math.min(q1.mask,q2.mask)+.12*safetyAt(x,z);
  if(!best||score>best.score)best={mode:'frozen-r43-contour-run-extension',direction:name,dx,dz,alignment,score,groupIndex:base.groupIndex,sourceMasks:[q1.mask,q2.mask],sourceIndices:[q1.index,q2.index],safety:safetyAt(x,z)};
 }
 return best;
}
export function contourContinuationGain(x,z){const base=r43At(x,z);if(base.mask>ACTIVE)return 0;const sup=contourContinuationSupportAt(x,z);if(!sup)return 0;const target=C(.144+.030*sup.alignment+.022*sup.safety+.020*Math.min(...sup.sourceMasks),.151,.205),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.145/(.84*rawAbs):.17;return C(Math.max(0,target-base.mask),0,Math.min(.17,deltaBound))}
function computeTerraceState(x,z){const base=r43At(x,z);if(base.mask>ACTIVE)return{...base,contourContinuationGain:0,contourContinuationSupport:null};const gain=contourContinuationGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?contourContinuationSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,contourContinuationGain:gain,contourContinuationSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE46.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE46.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r43At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R43.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round46:{
 scope:'lengthen accepted terrace organization at a larger causal scale than branch-companion patches: extend only frozen R43 two-cell contour runs by one safe non-recursive cell; preserve riser amplitude and hard drainage separators',
 method:'start from accepted R43, not failed R44/R45 geometry. A weak candidate may be promoted only when two consecutive frozen R43 active cells exist directly behind it along one of eight 6 m lattice directions, all three states are same-family/stair-compatible, that direction aligns with the local R30 contour tangent by at least 0.55, and candidate/segment midpoints clear agricultural, drainage and foreground-receiver safety. R46 cells never seed R46 cells.',
 logicCorrection:'R45 incorrectly treated a reduction in global compatible-component count as a necessary improvement. Protected drainage corridors can legitimately split terrace support into separate components, so forcing fewer global components can reward crossing a separator. R46 instead verifies local contour-run continuation inside the protected domain and requires compatible components/orphans/tiny fragments to be no worse; browser rendering cannot compensate for failed numeric geometry.',
 constraint:'the 6 m QA lattice, one-cell frozen-run continuation, 0.55 tangent alignment, stair tolerances and 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured connectivity. Current 12.5 m macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is reread only for non-metric morphology: long curved contour-following ribbons, unequal widths, nested organization and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-R43 contour-run continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth',
 failedPredecessor:'R045.45 workflow run 35400674951 failed numeric/cache/browser readiness; its global component-merge target is not carried forward as a success criterion.',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
