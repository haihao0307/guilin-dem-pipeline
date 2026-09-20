import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.63';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE=new Map(),SUPPORT_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);return m<1e-9?{tx:1,tz:0}:{tx:-gz/m,tz:gx/m}}
function segmentSafe(ax,az,bx,bz){const len=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(len/3));for(let i=0;i<=n;i++){const t=i/n;if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false}return true}

// R62 proved that changing exact lattice offsets to a continuous tube around only four R60 endpoints was not
// enough: authoritative QA still found only the same four promotions and zero companions. The diagnostic shows
// why: only 16 weak cells on the whole audit slope clear the inherited safety gates, only five lie within 30 m
// of any of those four endpoint seeds, and the only two same-family seed-neighbours are the two seeds themselves.
// Continuing to widen the seed tube would therefore be an evidence-free radius/threshold chase. R63 changes the
// causal support, not the gate: every accepted R58 active cell becomes a frozen contour-rail sample. A weak cell
// may promote only when TWO frozen, same-family/stair-compatible R58 rail samples support the local contour, with
// each candidate->rail path sampled at <=3 m for drainage/receiver safety. New R63 cells never become rail samples.
let RAILS=null;
function frozenRails(){
 if(RAILS)return RAILS;
 const out=[];
 for(let z=-132;z<=12;z+=6)for(let x=-222;x<=120;x+=6){const s=R58.terraceStateAt(x,z);if(s.mask<=ACTIVE)continue;out.push({x,z,state:s,tangent:contourTangent(x,z)})}
 RAILS=out;return out;
}
function railCandidate(x,z){
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE||safetyAt(x,z)<=.10)return null;
 const ct=contourTangent(x,z),near=[];
 for(const r of frozenRails()){
  if(!compatible(base,r.state))continue;
  const dx=r.x-x,dz=r.z-z,dist=Math.hypot(dx,dz);if(dist<4.5||dist>33)continue;
  const along=dx*ct.tx+dz*ct.tz,cross=Math.abs(-dx*ct.tz+dz*ct.tx);if(Math.abs(along)<3||cross>10.5)continue;
  const vectorAlignment=Math.abs(vdot(dx,dz,ct.tx,ct.tz));if(vectorAlignment<.52)continue;
  const tangentContinuity=Math.abs(vdot(ct.tx,ct.tz,r.tangent.tx,r.tangent.tz));if(tangentContinuity<.36)continue;
  if(!segmentSafe(x,z,r.x,r.z))continue;
  near.push({...r,dist,along,cross,vectorAlignment,tangentContinuity});
 }
 if(near.length<2)return null;
 let best=null;
 for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
  const a=near[i],b=near[j];if(!compatible(a.state,b.state))continue;
  const sep=Math.hypot(a.x-b.x,a.z-b.z);if(sep<5.5)continue;
  const sameSide=a.along*b.along>0;
  // On one side, two rails must form a genuine frozen run rather than nearly coincident support.
  if(sameSide&&Math.abs(Math.abs(a.along)-Math.abs(b.along))<4.5)continue;
  const pairTangent=Math.abs(vdot(b.x-a.x,b.z-a.z,ct.tx,ct.tz));if(pairTangent<.40)continue;
  const bracketBonus=sameSide?0:.16,runBonus=C(sep/30,0,1)*.10;
  const score=.34*(a.vectorAlignment+b.vectorAlignment)+.20*(a.tangentContinuity+b.tangentContinuity)-.018*(a.cross+b.cross)-.007*(a.dist+b.dist)+bracketBonus+runBonus;
  if(!best||score>best.score)best={mode:sameSide?'frozen-r58-two-rail-contour-extension':'frozen-r58-two-rail-contour-bracket',score,groupIndex:base.groupIndex,safety:safetyAt(x,z),supportA:{x:a.x,z:a.z,mask:a.state.mask,index:a.state.index,step:a.state.step,dist:a.dist,along:a.along,cross:a.cross,vectorAlignment:a.vectorAlignment,tangentContinuity:a.tangentContinuity},supportB:{x:b.x,z:b.z,mask:b.state.mask,index:b.state.index,step:b.state.step,dist:b.dist,along:b.along,cross:b.cross,vectorAlignment:b.vectorAlignment,tangentContinuity:b.tangentContinuity},pairSeparation:sep,pairTangent,sameSide};
 }
 return best;
}
export function frozenRailSupportAt(x,z){const k=keyOf(x,z);if(SUPPORT_CACHE.has(k))return SUPPORT_CACHE.get(k);const v=railCandidate(x,z);SUPPORT_CACHE.set(k,v);return v}
export function frozenRailGain(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return 0;const sup=frozenRailSupportAt(x,z);if(!sup)return 0;const align=.25*(sup.supportA.vectorAlignment+sup.supportB.vectorAlignment+sup.supportA.tangentContinuity+sup.supportB.tangentContinuity),crossPenalty=C((sup.supportA.cross+sup.supportB.cross)/21,0,1),target=C(.154+.022*align+.010*sup.safety+.006*(sup.sameSide?0:1)-.004*crossPenalty,.151,.184),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.130/(.84*rawAbs):.17;return C(Math.max(0,target-base.mask),0,Math.min(.17,deltaBound))}
function compute(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return{...base,frozenRailGain:0,frozenRailSupport:null};const gain=frozenRailGain(x,z);if(gain<=0)return{...base,frozenRailGain:0,frozenRailSupport:null};const mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=frozenRailSupportAt(x,z);return{...base,mask,delta,target:base.base+delta,frozenRailGain:gain,frozenRailSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R58.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function frozenRailCount(){return frozenRails().length}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round63:{
 scope:'replace the underdetermined four-endpoint R62 seed tube with a frozen R58 active contour rail; promote only weak cells supported by two safe same-family/stair-compatible frozen rail samples, while keeping accepted R58 active geometry and drainage separators exact',
 method:'derive the rail once from authoritative 6 m R58 active cells. For each weak but agriculturally safe cell, search frozen compatible rails within 4.5-33 m. Each rail vector must broadly follow the candidate local R30 contour tangent, remain within 10.5 m cross-contour, retain tangent continuity, and pass <=3 m path safety. Promotion requires two mutually compatible rails with real separation and a pair direction consistent with the local contour. Opposite-side rails bracket a short gap; same-side rails prove an extension. R63 outputs never seed R63.',
 logicCorrection:'R62 failed 24/27 while Chrome passed. Its diagnostic counted 16 safety-eligible weak cells, only five within 30 m of the four frozen R60 seeds, and only two same-family seed-neighbours; those two were the seeds themselves. Widening the seed radius or lowering family/safety gates would be threshold chasing, not new evidence. The correct inference is that four endpoint seeds are insufficient evidence for hillside-scale continuation, so R63 changes the frozen support source to the already accepted R58 active contour rail while keeping materiality and safety gates unchanged. Browser success remains renderability evidence only.',
 constraint:'the 6 m audit rail, 4.5-33 m rail reach, 10.5 m cross-contour cap, tangent gates and inherited 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. The 12.5 m macro DEM and photographs cannot provide field/sub-metre microtopography, parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity, head/depth/discharge/gate state or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency and conservation are necessary evidence only and do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay and Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png is reread only as non-metric morphology evidence for long curved contour ribbons, unequal widths, nested bends, local branch/rejoin and drainage interruptions. No terrace width, reach, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 inheritedFailure:'R62 is retained as failed evidence: 24/27 numeric gates, gains=4, crossings=4, companions=0; real Chrome passed, which does not rescue failed geometry.',
 evidenceClass:'synthetic nonrecursive frozen-R58 two-rail contour continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth'
}};
