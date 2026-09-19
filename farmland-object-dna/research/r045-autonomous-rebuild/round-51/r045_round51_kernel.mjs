import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-47/r045_round47_kernel.mjs';

export const VERSION='R045.51';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE47=new Map(),CACHE51=new Map(),SUPPORT_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r47At(x,z){const k=keyOf(x,z);let v=CACHE47.get(k);if(v===undefined){v=R47.terraceStateAt(x,z);CACHE47.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0,gm:m};return{tx:-gz/m,tz:gx/m,gm:m}}
function segmentSafe(ax,az,bx,bz){for(const t of [0,.25,.5,.75,1])if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false;return true}
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};
const angleDeg=c=>Math.acos(C(c,-1,1))*180/Math.PI;
const DIRS=[[6,0,'E'],[-6,0,'W'],[0,6,'S'],[0,-6,'N'],[6,6,'SE'],[-6,-6,'NW'],[6,-6,'NE'],[-6,6,'SW']];

// R50 disproved the previous diagnosis: allowing zero inherited mask but still demanding a second frozen
// support 12+ m away again produced only three promotions. The second-support condition was being treated as
// independent evidence, but direction is already independently observed from the R30 contour-tangent field.
// Requiring both an adjacent accepted cell AND a farther accepted cell selects already-complete runs and is a
// redundant-selection fallacy, not a field constraint. R51 removes only that redundant condition. A candidate
// must still touch frozen R47 in one 6 m/diagonal step, align with the local contour at BOTH ends, remain close
// in base elevation/stair family, and clear the full protected segment. New R51 cells never seed R51.
export function contourFrontShellSupportAt(x,z){
 const ck=keyOf(x,z);if(SUPPORT_CACHE.has(ck))return SUPPORT_CACHE.get(ck);
 const base=r47At(x,z);if(base.mask>ACTIVE||base.groupIndex<0||safetyAt(x,z)<=.10){SUPPORT_CACHE.set(ck,null);return null}
 const tc=contourTangent(x,z);let best=null;
 for(const [dx,dz,name] of DIRS){
  const dist=Math.hypot(dx,dz),qx=x+dx,qz=z+dz,q=r47At(qx,qz);if(q.mask<=ACTIVE||!compatible(base,q))continue;
  if(!segmentSafe(x,z,qx,qz))continue;
  const alignC=Math.abs((dx*tc.tx+dz*tc.tz)/dist);if(alignC<.50)continue;
  const tq=contourTangent(qx,qz),alignQ=Math.abs((dx*tq.tx+dz*tq.tz)/dist);if(alignQ<.44)continue;
  const tangentTurn=angleDeg(Math.abs(vdot(tc.tx,tc.tz,tq.tx,tq.tz)));if(tangentTurn>32)continue;
  const step=.5*(base.step+q.step),elevDelta=Math.abs(R30.height(x,z)-R30.height(qx,qz));if(elevDelta>Math.max(.38,.62*step))continue;
  const score=.88*alignC+.62*alignQ+.42*q.mask+.18*safetyAt(x,z)-.006*tangentTurn-.10*C(elevDelta/(step||1),0,1);
  if(!best||score>best.score)best={mode:'frozen-r47-contour-tangent-front-shell',direction:name,score,groupIndex:base.groupIndex,dx,dz,distance:dist,alignment:alignC,supportAlignment:alignQ,tangentTurnDeg:tangentTurn,elevationDelta:elevDelta,step,qx,qz,supportMask:q.mask,supportIndex:q.index,safety:safetyAt(x,z)};
 }
 SUPPORT_CACHE.set(ck,best);return best;
}
export function contourFrontShellGain(x,z){const base=r47At(x,z);if(base.mask>ACTIVE)return 0;const sup=contourFrontShellSupportAt(x,z);if(!sup)return 0;const target=C(.154+.030*sup.alignment+.020*sup.supportAlignment+.018*sup.safety+.016*sup.supportMask,.158,.215),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.145/(.84*rawAbs):.18;return C(Math.max(0,target-base.mask),0,Math.min(.18,deltaBound))}
function computeTerraceState(x,z){const base=r47At(x,z);if(base.mask>ACTIVE)return{...base,contourFrontShellGain:0,contourFrontShellSupport:null};const gain=contourFrontShellGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?contourFrontShellSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,contourFrontShellGain:gain,contourFrontShellSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE51.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE51.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r47At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R47.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round51:{
 scope:'replace R50 redundant farther-support selection with one non-recursive frozen-R47 contour-tangent front shell; preserve inherited active terrain, riser amplitude, hard drainage separators and all parcel/water locks',
 method:'start from accepted R47. A non-active candidate may be promoted only when one frozen R47 active cell lies exactly one 6 m/diagonal audit step away, candidate/support states are same-family and stair-compatible, their connecting vector follows the R30 contour tangent at both endpoints, tangent rotation stays bounded, base-elevation difference remains within a bounded fraction of the inherited terrace step, and the full segment clears agricultural, drainage and foreground-receiver safety. R51 cells never seed R51.',
 logicCorrection:'R50 showed that removing the inherited-positive-mask residue was not sufficient: gains remained exactly three. The remaining mistake was treating a second frozen support 12+ m away as necessary independent evidence even though local contour direction is already independently supplied by the R30 terrain gradient. That double requirement preferentially selects already-complete runs. R51 removes the redundant selection rather than lowering the materiality gate, while strengthening endpoint tangent agreement and keeping frozen adjacency so no isolated growth is rewarded.',
 constraint:'the 6 m audit lattice, 0.50/0.44 tangent-alignment gates, 32 degree local tangent-rotation gate, elevation/step tolerance and 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. Current 12.5 m macro DEM and photographs cannot provide field microtopography, real parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate states or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency, a contour-following front shell or conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'saved MrRolord frame audit is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> vegetation/paths/materials. Voronoi, Blender dimensions, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread for non-metric morphology only: long curved contour-following ribbons, unequal widths, nested organization, local junctions and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 failedPredecessor:'R045.50 persisted numeric QA was 28/29: gains=3, crossings=3, gainGroups=[1,1,1], while long/curved support, safety, exact inherited active surface and all drainage gates passed. R50 is preserved as a failed materiality diagnosis, not an accepted stage.',
 evidenceClass:'synthetic frozen-R47 contour-tangent one-shell continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
