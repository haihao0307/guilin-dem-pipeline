import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.59';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const DIRS=[[1,0,'E-W'],[0,1,'N-S'],[1,1,'SE-NW'],[1,-1,'NE-SW']];
const DISTS=[6,12,18,24,30];

function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0};return{tx:-gz/m,tz:gx/m}}
function aligned(x,z,dx,dz,min=.48){const t=contourTangent(x,z),m=Math.hypot(dx,dz)||1;return Math.abs((dx*t.tx+dz*t.tz)/m)>=min}
function segmentSafe(ax,az,bx,bz){const len=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(len/3));for(let i=0;i<=n;i++){const t=i/n;if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false}return true}

// R58 made the vertical profile safe, but its plan footprint is still the R47 footprint.
// Raising risers cannot solve missing hillside-scale organization, and simply adding active cells cannot prove
// better terraces. R59 changes only the plan topology: weak cells may join two FROZEN R58 active supports on
// opposite sides of a locally contour-aligned chord. Every candidate is evaluated independently against R58;
// R59 cells never seed other R59 cells, so a bridge cannot recursively grow across the slope.
export function contourGapSupportAt(x,z){
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE||base.mask<=.006||safetyAt(x,z)<=.10)return null;
 let best=null;
 for(const [ux,uz,name] of DIRS){
   const sx=6*ux,sz=6*uz;if(!aligned(x,z,sx,sz,.52))continue;
   for(const dp of DISTS){
     const px=x+ux*dp,pz=z+uz*dp,p=R58.terraceStateAt(px,pz);if(p.mask<=ACTIVE||!compatible(base,p)||!aligned(px,pz,sx,sz,.42)||!segmentSafe(x,z,px,pz))continue;
     for(const dn of DISTS){
       const nx=x-ux*dn,nz=z-uz*dn,n=R58.terraceStateAt(nx,nz);if(n.mask<=ACTIVE||!compatible(base,n)||!compatible(p,n)||!aligned(nx,nz,sx,sz,.42)||!segmentSafe(x,z,nx,nz))continue;
       const span=dp+dn;if(span<18||span>60)continue;
       const balance=Math.min(dp,dn)/Math.max(dp,dn),source=Math.min(p.mask,n.mask),score=.015*span+.28*balance+.38*source+.16*safetyAt(x,z);
       if(!best||score>best.score)best={mode:'frozen-r58-opposed-contour-gap',direction:name,dp,dn,span,balance,score,groupIndex:base.groupIndex,sourceMasks:[p.mask,n.mask],sourceIndices:[p.index,n.index],safety:safetyAt(x,z)};
     }
   }
 }
 return best;
}
export function contourGapGain(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return 0;const sup=contourGapSupportAt(x,z);if(!sup)return 0;const target=C(.154+.018*Math.min(sup.span/30,1)+.014*sup.balance+.012*sup.safety,.158,.196),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.135/(.84*rawAbs):.16;return C(Math.max(0,target-base.mask),0,Math.min(.16,deltaBound))}
function compute(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return{...base,contourGapGain:0,contourGapSupport:null};const gain=contourGapGain(x,z);if(gain<=0)return{...base,contourGapGain:0,contourGapSupport:null};const mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=contourGapSupportAt(x,z);return{...base,mask,delta,target:base.base+delta,contourGapGain:gain,contourGapSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R58.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round59:{
 scope:'improve whole-slope terrace plan legibility after R58 without raising risers: bridge only bounded weak gaps between frozen R58 same-family/stair-compatible contour supports while preserving protected drainage interruptions',
 method:'freeze every R58 already-active cell and its vertical profile exactly. A weak R58 cell can be promoted only when frozen active supports exist on opposite sides along a locally contour-aligned 6 m lattice chord, with total frozen support span 18-60 m. Candidate-to-support segments are sampled at <=3 m for agricultural/drainage/receiver safety. Every candidate reads only frozen R58; R59 cells never seed R59.',
 logicCorrection:'R58 browser safety and profile correctness do not imply hillside-scale terrace organization, and increasing riser amplitude cannot repair missing plan topology. Likewise, a larger active-cell count alone is not evidence of better terraces. R59 therefore requires long-run/topology improvement while preserving legitimate drainage separators and all prior active geometry.',
 constraint:'the 6 m QA lattice, 18-60 m synthetic bridge search, tangent-alignment gates and inherited 12 m hard drainage core are morphology/QA parameters, not surveyed Yunnan terrace dimensions. The current 12.5 m macro DEM and photographs cannot supply field/sub-metre microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay; Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png is used only as non-metric morphology evidence for long curved contour ribbons, unequal widths, nested bends, local branch/rejoin and drainage interruptions. No terrace width, bridge length, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic nonrecursive frozen-R58 contour-gap continuation under inherited drainage protection; not surveyed terrace, parcel or hydraulic truth'
}};
