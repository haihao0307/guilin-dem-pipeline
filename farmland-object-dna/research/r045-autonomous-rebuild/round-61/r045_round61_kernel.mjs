import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R60 from '../round-60/r045_round60_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.61';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE=new Map();
const SUPPORT_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const DIRS=[[1,0,'E'],[-1,0,'W'],[0,1,'S'],[0,-1,'N'],[1,1,'SE'],[-1,-1,'NW'],[1,-1,'NE'],[-1,1,'SW']];
const COMPANION_AXIS_STEPS=[6,12];
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0};return{tx:-gz/m,tz:gx/m}}
function aligned(x,z,dx,dz,min=.30){const t=contourTangent(x,z),m=Math.hypot(dx,dz)||1;return Math.abs((dx*t.tx+dz*t.tz)/m)>=min}
function segmentSafe(ax,az,bx,bz){const len=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(len/3));for(let i=0;i<=n;i++){const t=i/n;if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false}return true}

// R60 proved four safe frozen-R58 endpoint promotions across all three families, but four isolated
// promotions did not meet the unchanged materiality gate and were not visually legible. R61 does not
// lower that gate. It freezes the R58 field and turns each independently evidenced R60 endpoint into a
// local contour-support seed. Weak neighbours may become companions only when they can point directly
// back to such a frozen seed within 6/12 lattice-axis metres (physical distance is Math.hypot), remain
// same-family/stair compatible, stay contour-aligned at both ends and pass <=3 m path safety. R61 output
// is never queried as evidence, so this is a bounded frozen-support band, not recursive growth.
function directSeedAt(x,z){
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE||base.mask<=.001||safetyAt(x,z)<=.10)return null;
 const sup=R60.contourRunSupportAt(x,z);if(!sup)return null;
 return{mode:'direct-frozen-r58-r60-endpoint-seed',seedX:x,seedZ:z,seedDistance:0,seedPhysicalDistance:0,seedSupport:sup,groupIndex:base.groupIndex,safety:safetyAt(x,z),score:100+sup.score};
}
export function contourBandSupportAt(x,z){
 const k=keyOf(x,z);if(SUPPORT_CACHE.has(k))return SUPPORT_CACHE.get(k);
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE||base.mask<=.001||safetyAt(x,z)<=.10){SUPPORT_CACHE.set(k,null);return null}
 const direct=directSeedAt(x,z);if(direct){SUPPORT_CACHE.set(k,direct);return direct}
 let best=null;
 for(const[ux,uz,name]of DIRS){
   if(!aligned(x,z,ux,uz,.24))continue;
   for(const axisStep of COMPANION_AXIS_STEPS){
     const sx=x-ux*axisStep,sz=z-uz*axisStep,seed=directSeedAt(sx,sz);if(!seed)continue;
     const sb=R58.terraceStateAt(sx,sz);if(!compatible(base,sb)||!segmentSafe(x,z,sx,sz))continue;
     if(!aligned(sx,sz,ux,uz,.18))continue;
     const dist=Math.hypot(sx-x,sz-z),t0=contourTangent(x,z),t1=contourTangent(sx,sz),curve=Math.abs(vdot(t0.tx,t0.tz,t1.tx,t1.tz));
     if(curve<.55)continue;
     const score=1.8-.045*dist+.26*curve+.16*seed.safety+.06*sb.mask;
     if(!best||score>best.score)best={mode:'frozen-r58-contour-band-companion',direction:name,seedX:sx,seedZ:sz,axisStep,seedDistance:dist,seedPhysicalDistance:dist,curveAlignment:curve,seedSupport:seed.seedSupport,groupIndex:base.groupIndex,safety:safetyAt(x,z),score};
   }
 }
 SUPPORT_CACHE.set(k,best);return best;
}
export function contourBandGain(x,z){
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return 0;const sup=contourBandSupportAt(x,z);if(!sup)return 0;
 if(sup.mode==='direct-frozen-r58-r60-endpoint-seed')return R60.contourRunGain(x,z);
 const distanceWeight=C(1-sup.seedPhysicalDistance/26,0,1),target=C(.151+.010*distanceWeight+.010*sup.curveAlignment+.009*sup.safety,.150,.176),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.125/(.84*rawAbs):.16;
 return C(Math.max(0,target-base.mask),0,Math.min(.16,deltaBound));
}
function compute(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return{...base,contourBandGain:0,contourBandSupport:null};const gain=contourBandGain(x,z);if(gain<=0)return{...base,contourBandGain:0,contourBandSupport:null};const mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=contourBandSupportAt(x,z);return{...base,mask,delta,target:base.base+delta,contourBandGain:gain,contourBandSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R58.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round61:{
 scope:'convert sparse frozen-R58 endpoint evidence into bounded nonrecursive contour-support bands while preserving accepted R58 active geometry and drainage interruptions',
 method:'freeze every R58 state. Direct seeds are exactly independently evidenced R60 frozen-R58 endpoint supports. A weak companion may promote only by pointing directly to a frozen seed at 6/12 lattice-axis steps, with physical distance from Math.hypot, same family/stair compatibility, local contour alignment at both ends, tangent continuity and <=3 m safety sampling. R61 outputs never seed R61.',
 logicCorrection:'R60 showed that four safe promotions spread over three families can improve counts and long-run statistics yet still fail materiality and remain visually unreadable. More promoted cells or broad spatial spread is not equivalent to a coherent terrace band. R61 therefore keeps the numeric materiality gate and adds explicit new-promotion chain tests; browser startup remains only a renderability test, not geometric or agricultural correctness.',
 constraint:'the 6 m QA lattice, 6/12 lattice-axis companion reach, tangent gates and inherited 12 m hard drainage core are morphology/QA parameters, not surveyed Yunnan terrace dimensions. The current 12.5 m macro DEM and photographs cannot provide field/sub-metre microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay; Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png is used only as non-metric morphology evidence for long curved contour ribbons, unequal widths, nested bends, local branch/rejoin and drainage interruptions. No terrace width, extension length, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic nonrecursive frozen-R58 contour support band around independently evidenced endpoint seeds; not surveyed terrace, parcel or hydraulic truth',
 inheritedFailure:'R60 remains rejected because its authoritative result was 23/24: gains=4 and thresholdCross=4 against the unchanged >=8/>=6 materiality gate, despite Chrome success and safe topology.'
}};
