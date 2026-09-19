import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.64';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12,CACHE=new Map(),SUPPORT_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return(ax*bx+az*bz)/(am*bm)};
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);return m<1e-9?{tx:1,tz:0}:{tx:-gz/m,tz:gx/m}}
function segmentSafe(ax,az,bx,bz){const len=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(len/3));for(let i=0;i<=n;i++){const t=i/n;if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false}return true}
const DIR8=[[6,0,'E'],[-6,0,'W'],[0,6,'S'],[0,-6,'N'],[6,6,'SE'],[-6,-6,'NW'],[6,-6,'NE'],[-6,6,'SW']];
const BACK=[6,12,18,24];

// R63 improved support quality but still failed 23/27: five promotions only, and one promotion created a new
// orphan component because its frozen rails were 13-25 m away. That exposes a stronger topological condition:
// a continuation cell should attach to an accepted component at the moment it is promoted, not merely be near
// two distant samples from that component. R64 therefore performs one frozen frontier step. A weak safe cell
// must touch an accepted R58 active 8-neighbour anchor, follow the local contour direction into that anchor, and
// the anchor must itself have a second frozen R58 active witness farther behind along the same/one-turn contour
// run. This is nonrecursive: only R58 can be anchor or witness, so every R64 promotion is attached by construction.
function frontierSupport(x,z){
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE||safetyAt(x,z)<=.10)return null;
 const ct=contourTangent(x,z);let best=null;
 for(const[dx,dz,name]of DIR8){
  const ax=x-dx,az=z-dz,a=R58.terraceStateAt(ax,az);if(a.mask<=ACTIVE||!compatible(base,a))continue;
  const len=Math.hypot(dx,dz),align=Math.abs(vdot(dx,dz,ct.tx,ct.tz));if(align<.42||!segmentSafe(x,z,ax,az))continue;
  const at=contourTangent(ax,az);
  for(const[ux,uz,bname]of DIR8){
   const unitLen=Math.hypot(ux,uz),uxn=ux/unitLen,uzn=uz/unitLen;
   // Anchor->witness should continue away from candidate. Candidate->anchor is (-dx,-dz) in anchor coordinates.
   const continuation=vdot(-dx,-dz,uxn,uzn);if(continuation<.48)continue;
   for(const reach of BACK){
    const bx=ax+uxn*reach,bz=az+uzn*reach;if(Math.hypot(bx-x,bz-z)<5)continue;
    const b=R58.terraceStateAt(bx,bz);if(b.mask<=ACTIVE||!compatible(base,b)||!compatible(a,b))continue;
    const anchorAlign=Math.abs(vdot(uxn,uzn,at.tx,at.tz));if(anchorAlign<.34)continue;
    const turnCos=vdot(-dx,-dz,uxn,uzn);if(turnCos<.48)continue;
    if(!segmentSafe(ax,az,bx,bz))continue;
    const score=.52*align+.36*anchorAlign+.25*Math.min(a.mask,b.mask)+.12*safetyAt(x,z)+.08*C(reach/24,0,1)+.08*turnCos;
    if(!best||score>best.score)best={mode:'frozen-r58-attached-frontier-continuation',score,groupIndex:base.groupIndex,safety:safetyAt(x,z),direction:`${name}<-${bname}${reach}`,candidateToAnchor:{dx:-dx,dz:-dz,dist:len,alignment:align},anchor:{x:ax,z:az,mask:a.mask,index:a.index,step:a.step},witness:{x:bx,z:bz,mask:b.mask,index:b.index,step:b.step,reach,alignment:anchorAlign},turnCos};
   }
  }
 }
 return best;
}
export function frontierSupportAt(x,z){const k=keyOf(x,z);if(SUPPORT_CACHE.has(k))return SUPPORT_CACHE.get(k);const v=frontierSupport(x,z);SUPPORT_CACHE.set(k,v);return v}
export function frontierGain(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return 0;const sup=frontierSupportAt(x,z);if(!sup)return 0;const target=C(.156+.024*sup.candidateToAnchor.alignment+.014*sup.witness.alignment+.010*sup.safety+.008*sup.turnCos,.153,.190),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.130/(.84*rawAbs):.17;return C(Math.max(0,target-base.mask),0,Math.min(.17,deltaBound))}
function compute(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return{...base,frontierGain:0,frontierSupport:null};const gain=frontierGain(x,z);if(gain<=0)return{...base,frontierGain:0,frontierSupport:null};const mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=frontierSupportAt(x,z);return{...base,mask,delta,target:base.base+delta,frontierGain:gain,frontierSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R58.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round64:{
 scope:'replace R63 distant two-rail support with a one-step frozen R58 component frontier: every new cell must attach directly to an accepted active 8-neighbour anchor whose contour direction is corroborated by a second frozen active witness behind it',
 method:'start from accepted R58 only. A weak but safe candidate must be same-family/stair compatible with an adjacent frozen R58 active anchor at 6 or sqrt(72) m. Candidate->anchor must follow the local contour tangent and pass <=3 m safety samples. The anchor must have a second mutually compatible frozen active R58 witness 6/12/18/24 m farther along a same/one-turn contour continuation, with anchor tangent alignment and full segment safety. R64 output never acts as anchor or witness.',
 logicCorrection:'R63 generated five supported promotions, but its 23/27 QA also created one orphan component because two distant rails do not imply immediate topological attachment. Treating proximity to a component as membership in that component is a graph-connectivity fallacy. R64 therefore requires direct frozen R58 8-neighbour attachment before promotion, while retaining the same materiality, drainage, cliff and nonrecursive gates. The change is topological evidence, not a lowered QA threshold.',
 constraint:'the 6 m audit lattice, 8-neighbour frontier, 6/12/18/24 m frozen witness reach, tangent thresholds and inherited 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. Current 12.5 m macro DEM and photographs cannot provide field/sub-metre microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity, head/depth/discharge/gate state or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric attachment, continuity and conservation are necessary evidence only and do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay; Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png is reread only as non-metric morphology evidence for long curved contour ribbons, unequal widths, nested bends, local branch/rejoin and drainage interruptions. No terrace width, reach, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 inheritedFailure:'R63 is retained as failed evidence: 23/27 gates, gains=5/crossings=5, one new orphan component despite safe local height increments.',
 evidenceClass:'synthetic nonrecursive frozen-R58 attached frontier continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth'
}};
