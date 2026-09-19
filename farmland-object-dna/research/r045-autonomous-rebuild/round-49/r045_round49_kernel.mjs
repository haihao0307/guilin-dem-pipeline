import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-47/r045_round47_kernel.mjs';

export const VERSION='R045.49';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE47=new Map(),CACHE49=new Map(),SUPPORT_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r47At(x,z){const k=keyOf(x,z);let v=CACHE47.get(k);if(v===undefined){v=R47.terraceStateAt(x,z);CACHE47.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0,gm:m};return{tx:-gz/m,tz:gx/m,gm:m}}
function segmentSafe(ax,az,bx,bz){for(const t of [0,.25,.5,.75,1])if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false;return true}
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};
const angleDeg=(c)=>Math.acos(C(c,-1,1))*180/Math.PI;

// R48 failed because extending support reach while keeping only eight quantized lattice directions still sampled
// almost the same straight local geometry: persisted evidence found one promotion, 16.97 m reach and no curvature.
// R49 changes that single causal variable. It searches a frozen R47 contour-aligned support cloud on the 6 m audit
// lattice out to 24 m, then accepts only a two-support extension or bridge whose complete segments remain safe.
// New R49 cells never seed R49. Existing R47 active geometry, stair frame and 0.84 raw amplitude remain exact.
export function contourCloudSupportAt(x,z){
 const ck=keyOf(x,z);if(SUPPORT_CACHE.has(ck))return SUPPORT_CACHE.get(ck);
 const base=r47At(x,z);if(base.mask>ACTIVE||base.mask<=.004||safetyAt(x,z)<=.10){SUPPORT_CACHE.set(ck,null);return null}
 const tan0=contourTangent(x,z),supports=[];
 for(let dx=-24;dx<=24;dx+=6)for(let dz=-24;dz<=24;dz+=6){
  if(dx===0&&dz===0)continue;const dist=Math.hypot(dx,dz);if(dist<5.9||dist>30.1)continue;
  const qx=x+dx,qz=z+dz,q=r47At(qx,qz);if(q.mask<=ACTIVE||!compatible(base,q)||!segmentSafe(x,z,qx,qz))continue;
  const align=Math.abs((dx*tan0.tx+dz*tan0.tz)/dist);if(align<.34)continue;
  const tq=contourTangent(qx,qz),tanTurn=angleDeg(Math.abs(vdot(tan0.tx,tan0.tz,tq.tx,tq.tz)));
  const side=Math.sign(dx*tan0.tx+dz*tan0.tz)||1;
  supports.push({dx,dz,qx,qz,dist,align,side,mask:q.mask,index:q.index,step:q.step,tangentTurnDeg:tanTurn});
 }
 let best=null;
 for(let i=0;i<supports.length;i++)for(let j=i+1;j<supports.length;j++){
  const a=supports[i],b=supports[j];if(!compatible(r47At(a.qx,a.qz),r47At(b.qx,b.qz)))continue;
  const dirCos=vdot(a.dx,a.dz,b.dx,b.dz),sameSide=a.side===b.side;
  let mode=null,pairSpan=0;
  if(sameSide){if(dirCos<.78||Math.abs(a.dist-b.dist)<5.5)continue;pairSpan=Math.max(a.dist,b.dist);if(pairSpan<12)continue;mode='frozen-r47-contour-cloud-extension'}
  else{if(dirCos>-.45)continue;pairSpan=a.dist+b.dist;if(pairSpan<18)continue;mode='frozen-r47-contour-cloud-bridge'}
  const minAlign=Math.min(a.align,b.align),minMask=Math.min(a.mask,b.mask),maxTurn=Math.max(a.tangentTurnDeg,b.tangentTurnDeg),maxDist=Math.max(a.dist,b.dist);
  const score=.82*minAlign+.40*minMask+.16*safetyAt(x,z)+.006*Math.min(pairSpan,36)+.004*Math.min(maxTurn,18)+.003*Math.min(maxDist,24);
  if(!best||score>best.score)best={mode,score,groupIndex:base.groupIndex,pairSpan,maxDistance:maxDist,minAlignment:minAlign,maxTangentTurnDeg:maxTurn,safety:safetyAt(x,z),supportA:a,supportB:b};
 }
 SUPPORT_CACHE.set(ck,best);return best;
}
export function contourCloudGain(x,z){const base=r47At(x,z);if(base.mask>ACTIVE)return 0;const sup=contourCloudSupportAt(x,z);if(!sup)return 0;const spanBonus=C((sup.pairSpan-18)/18,0,1),curveBonus=C(sup.maxTangentTurnDeg/14,0,1),target=C(.148+.030*sup.minAlignment+.018*sup.safety+.014*Math.min(sup.supportA.mask,sup.supportB.mask)+.012*spanBonus+.008*curveBonus,.153,.210),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.145/(.84*rawAbs):.18;return C(Math.max(0,target-base.mask),0,Math.min(.18,deltaBound))}
function computeTerraceState(x,z){const base=r47At(x,z);if(base.mask>ACTIVE)return{...base,contourCloudGain:0,contourCloudSupport:null};const gain=contourCloudGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?contourCloudSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,contourCloudGain:gain,contourCloudSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE49.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE49.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r47At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R47.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round49:{
 scope:'replace failed R48 eight-direction multiscale reach with frozen-R47 contour-aligned support-cloud continuation; preserve inherited active terrain, riser amplitude and drainage separators exactly',
 method:'start from accepted R47. For each weak positive-support candidate, search frozen R47 active supports on a 6 m world-space audit lattice inside 24 m. Supports must be same-family/stair-compatible, contour-aligned to the local R30 tangent, and connected by quarter-sampled safe segments. Promote only when two frozen supports form either a same-side continuation or an opposite-side short bridge. R49 gains are non-recursive and bounded by unchanged 0.84 raw stair response.',
 logicCorrection:'R48 assumed that a larger 6/12/18 m search radius would create hillside-scale curvature, but its eight quantized directions preserved the same directional aliasing; persisted QA found one promotion, no curved support and only 16.97 m reach. Merely lowering R48 materiality/curvature gates would hide that failure. R49 changes the sampling geometry rather than the acceptance threshold, while still refusing to merge legitimate drainage-separated families.',
 constraint:'the 6 m audit lattice, 24 m support window, 0.34 tangent gate, support-pair rules, stair tolerances and 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. Current 12.5 m macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency, a longer contour ribbon or conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'saved MrRolord frame audit is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> vegetation/paths/materials. Voronoi, Blender dimensions, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread for non-metric morphology only: long curved contour-following ribbons, unequal widths, nested organization, local junctions and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 failedPredecessor:'R045.48 persisted numeric QA was 29/34 while Chrome passed: gains=1, longReach=0, curved=0, gainSpan=0 and only one family gained. R48 is preserved as a failed geometry round, not an accepted visual stage.',
 evidenceClass:'synthetic frozen-R47 contour-aligned support-cloud continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
