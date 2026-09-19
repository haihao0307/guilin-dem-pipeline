import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.60';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12, SHOULDER=.075;
const CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
// d values below are lattice-axis step magnitudes, not physical metres for diagonals. Physical distances are
// computed explicitly with hypot() and are the only values used by QA/reporting.
const DIRS=[[1,0,'E'],[-1,0,'W'],[0,1,'S'],[0,-1,'N'],[1,1,'SE'],[-1,-1,'NW'],[1,-1,'NE'],[-1,1,'SW']];
const FIRST=[6,12,18,24];
const SECOND=[6,12,18];
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};

function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0};return{tx:-gz/m,tz:gx/m}}
function aligned(x,z,dx,dz,min=.42){const t=contourTangent(x,z),m=Math.hypot(dx,dz)||1;return Math.abs((dx*t.tx+dz*t.tz)/m)>=min}
function segmentSafe(ax,az,bx,bz){const len=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(len/3));for(let i=0;i<=n;i++){const t=i/n;if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false}return true}

// R59 proved an important negative: an opposed-support bridge search produced zero changes. The first R60
// attempt then proved the endpoint diagnosis but remained under-material (4 promotions vs the fixed >=8 gate).
// Inspection showed that requiring BOTH inward frozen supports to exceed the active threshold discarded valid
// frozen endpoint shoulders. R60 now requires a monotone frozen run instead: q1 must be a materially stronger
// inherited R58 shoulder and q2 behind it must be active. This still cannot recurse, cannot cross drainage, and
// cannot use an R60-created cell as evidence. It therefore extends a pre-existing contour run rather than growing
// a free morphology. Browser success and cell count remain insufficient on their own; topology/run QA stays hard.
export function contourRunSupportAt(x,z){
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE||base.mask<=.001||safetyAt(x,z)<=.10)return null;
 let best=null;
 for(const [ux,uz,name] of DIRS){
   const ulen=Math.hypot(ux,uz);if(!aligned(x,z,ux,uz,.38))continue;
   for(const d1 of FIRST){
     const q1x=x-ux*d1,q1z=z-uz*d1,q1=R58.terraceStateAt(q1x,q1z);
     if(q1.mask<=Math.max(SHOULDER,base.mask+.012)||!compatible(base,q1)||!segmentSafe(x,z,q1x,q1z))continue;
     if(!aligned(q1x,q1z,ux,uz,.34))continue;
     for(const [vx,vz,name2] of DIRS){
       const turn=vdot(ux,uz,vx,vz);if(turn<.70)continue;
       const vlen=Math.hypot(vx,vz);
       for(const d2 of SECOND){
         const q2x=q1x-vx*d2,q2z=q1z-vz*d2,q2=R58.terraceStateAt(q2x,q2z);
         if(q2.mask<=ACTIVE||!compatible(base,q2)||!compatible(q1,q2)||!segmentSafe(q1x,q1z,q2x,q2z))continue;
         if(!aligned(q2x,q2z,vx,vz,.30))continue;
         const firstDistance=d1*ulen,secondDistance=d2*vlen,spanDistance=firstDistance+secondDistance;
         const turnDeg=Math.acos(C(turn,-1,1))*180/Math.PI,source=Math.min(q1.mask,q2.mask),forwardCells=firstDistance/6;
         const score=.026*spanDistance+.30*source+.18*safetyAt(x,z)+.10*forwardCells-.002*turnDeg;
         if(!best||score>best.score)best={mode:'frozen-r58-contour-endpoint-shoulder-to-active-anchor',direction:`${name}<-${name2}`,d1AxisStep:d1,d2AxisStep:d2,firstDistance,secondDistance,spanDistance,forwardCells,turnDeg,score,groupIndex:base.groupIndex,sourceMasks:[q1.mask,q2.mask],sourceIndices:[q1.index,q2.index],safety:safetyAt(x,z)};
       }
     }
   }
 }
 return best;
}
export function contourRunGain(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return 0;const sup=contourRunSupportAt(x,z);if(!sup)return 0;const target=C(.158+.012*Math.min(sup.forwardCells,3)+.012*Math.min(sup.spanDistance/24,1)+.012*sup.safety,.160,.205),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.135/(.84*rawAbs):.16;return C(Math.max(0,target-base.mask),0,Math.min(.16,deltaBound))}
function compute(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return{...base,contourRunGain:0,contourRunSupport:null};const gain=contourRunGain(x,z);if(gain<=0)return{...base,contourRunGain:0,contourRunSupport:null};const mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=contourRunSupportAt(x,z);return{...base,mask,delta,target:base.base+delta,contourRunGain:gain,contourRunSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R58.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round60:{
 scope:'replace R59 zero-change opposed-gap search with material frozen-R58 contour endpoint continuation; preserve accepted profile amplitude and protected drainage interruptions',
 method:'freeze every R58 state. A weak candidate may promote only when a materially stronger frozen R58 shoulder lies inward along a locally contour-aligned direction and a second frozen R58 ACTIVE anchor lies behind that shoulder with the same family/stair compatibility. Candidate-to-shoulder uses 6/12/18/24 lattice-axis steps, shoulder-to-anchor uses 6/12/18; physical distances are computed explicitly (diagonals are longer than cardinal steps). Every <=3 m path sample must pass agricultural/drainage/receiver safety. R60 cells never seed R60.',
 logicCorrection:'R59 rendered successfully but changed zero terrace cells, so browser success did not imply geometric progress. The first R60 attempt found four safe endpoint promotions across all three families but failed the unchanged >=8 materiality gate. It also exposed a unit-label bug: diagonal lattice steps had been described as metres. The revised R60 retains the materiality gate, reports physical distances explicitly, and replaces the over-strong two-active-support premise with a frozen shoulder -> active anchor run. More cells alone is still not accepted as proof of correct terraces.',
 constraint:'the 6 m QA lattice, synthetic shoulder/anchor search, tangent-alignment gates and inherited 12 m hard drainage core are morphology/QA parameters, not surveyed Yunnan terrace dimensions. The current 12.5 m macro DEM and photographs cannot provide field/sub-metre microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay; Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png was reread this run and is used only as non-metric morphology evidence for long curved contour ribbons, unequal widths, nested bends, local branch/rejoin and drainage interruptions. No terrace width, extension length, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic nonrecursive frozen-R58 contour endpoint continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth',
 failedAttempt:'The first R60 workflow passed Chrome but failed numeric materiality 23/24: gains=4, thresholdCross=4 versus the fixed >=8/>=6 gate. It is retained in Git history and is not an accepted geometry round.'
}};
