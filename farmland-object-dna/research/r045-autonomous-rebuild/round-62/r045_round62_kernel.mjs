import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R60 from '../round-60/r045_round60_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-58/r045_round58_kernel.mjs';

export const VERSION='R045.62';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12;
const CACHE=new Map();
const SUPPORT_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const vdot=(ax,az,bx,bz)=>{const am=Math.hypot(ax,az)||1,bm=Math.hypot(bx,bz)||1;return (ax*bx+az*bz)/(am*bm)};
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function contourTangent(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);if(m<1e-9)return{tx:1,tz:0};return{tx:-gz/m,tz:gx/m}}
function segmentSafe(ax,az,bx,bz){const len=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(len/3));for(let i=0;i<=n;i++){const t=i/n;if(safetyAt(ax+(bx-ax)*t,az+(bz-az)*t)<=.10)return false}return true}

// R61 persisted a real failure: only the same four R60 endpoint promotions survived and zero companions
// were created. The hidden assumption was that a valid companion must lie at one of eight exact 6/12 m
// lattice offsets from a seed and already have non-trivial R58 mask. That confuses an audit lattice with
// a continuous contour ribbon. R62 keeps the four independently evidenced R60 seeds frozen, but searches
// a continuous local contour tube around those seeds. A candidate may have zero R58 mask, yet must still
// belong to the same frozen terrace family/stair, lie mainly along the seed contour tangent with small
// cross-contour offset, retain tangent continuity, and pass <=3 m drainage/receiver safety samples. R62
// outputs never become evidence, so this remains bounded and nonrecursive.
let SEEDS=null;
function frozenSeeds(){
 if(SEEDS)return SEEDS;
 const out=[];
 for(let z=-132;z<=12;z+=6)for(let x=-222;x<=120;x+=6){
   const b=R58.terraceStateAt(x,z);if(b.mask>ACTIVE||safetyAt(x,z)<=.10)continue;
   const sup=R60.contourRunSupportAt(x,z);if(!sup)continue;
   out.push({x,z,state:b,support:sup,tangent:contourTangent(x,z),safety:safetyAt(x,z)});
 }
 SEEDS=out;return out;
}
function directSeedAt(x,z){
 const b=R58.terraceStateAt(x,z);if(b.mask>ACTIVE||safetyAt(x,z)<=.10)return null;
 for(const s of frozenSeeds())if(Math.abs(s.x-x)<1e-9&&Math.abs(s.z-z)<1e-9)return{mode:'direct-frozen-r58-r60-endpoint-seed',seedX:x,seedZ:z,seedDistance:0,along:0,cross:0,groupIndex:b.groupIndex,safety:s.safety,score:100+s.support.score};
 return null;
}
export function contourTubeSupportAt(x,z){
 const k=keyOf(x,z);if(SUPPORT_CACHE.has(k))return SUPPORT_CACHE.get(k);
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE||safetyAt(x,z)<=.10){SUPPORT_CACHE.set(k,null);return null}
 const direct=directSeedAt(x,z);if(direct){SUPPORT_CACHE.set(k,direct);return direct}
 const ct=contourTangent(x,z);let best=null;
 for(const seed of frozenSeeds()){
   if(!compatible(base,seed.state))continue;
   const dx=x-seed.x,dz=z-seed.z,dist=Math.hypot(dx,dz);if(dist<3||dist>30)continue;
   const st=seed.tangent,along=Math.abs(dx*st.tx+dz*st.tz),cross=Math.abs(-dx*st.tz+dz*st.tx);
   if(along<3||along>27||cross>8.5)continue;
   const tangentContinuity=Math.abs(vdot(ct.tx,ct.tz,st.tx,st.tz));if(tangentContinuity<.42)continue;
   const vectorAlignment=Math.abs(vdot(dx,dz,st.tx,st.tz));if(vectorAlignment<.72)continue;
   if(!segmentSafe(x,z,seed.x,seed.z))continue;
   const score=2.4-.035*along-.075*cross+.34*tangentContinuity+.22*vectorAlignment+.14*seed.safety+.08*seed.state.mask;
   if(!best||score>best.score)best={mode:'frozen-r58-contour-tube-companion',seedX:seed.x,seedZ:seed.z,seedDistance:dist,along,cross,tangentContinuity,vectorAlignment,groupIndex:base.groupIndex,safety:safetyAt(x,z),score};
 }
 SUPPORT_CACHE.set(k,best);return best;
}
export function contourTubeGain(x,z){
 const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return 0;const sup=contourTubeSupportAt(x,z);if(!sup)return 0;
 if(sup.mode==='direct-frozen-r58-r60-endpoint-seed')return R60.contourRunGain(x,z);
 const near=C(1-sup.along/32,0,1),center=C(1-sup.cross/10,0,1),target=C(.150+.014*near+.012*center+.010*sup.tangentContinuity+.008*sup.safety,.151,.178),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.125/(.84*rawAbs):.16;
 return C(Math.max(0,target-base.mask),0,Math.min(.16,deltaBound));
}
function compute(x,z){const base=R58.terraceStateAt(x,z);if(base.mask>ACTIVE)return{...base,contourTubeGain:0,contourTubeSupport:null};const gain=contourTubeGain(x,z);if(gain<=0)return{...base,contourTubeGain:0,contourTubeSupport:null};const mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=contourTubeSupportAt(x,z);return{...base,mask,delta,target:base.base+delta,contourTubeGain:gain,contourTubeSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R58.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function frozenContourSeeds(){return frozenSeeds().map(s=>({x:s.x,z:s.z,groupIndex:s.state.groupIndex,mask:s.state.mask,safety:s.safety}))}

export const snapshot={...R58.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round62:{
 scope:'replace R61 exact-offset companion search with a bounded continuous contour-tube around frozen R60 endpoint evidence while preserving accepted R58 active geometry and drainage interruptions',
 method:'freeze R58 everywhere and derive the seed set once from the authoritative 6 m audit lattice wherever the frozen R60 endpoint test succeeds. A weak candidate may promote only if it is same-family/stair compatible with a frozen seed, lies 3-27 m mainly along that seed contour tangent with <=8.5 m cross-contour offset, retains local tangent continuity, and every <=3 m path sample passes agricultural/drainage/receiver safety. Zero-mask candidates are not excluded solely because the audit lattice missed the ribbon. R62 output never seeds R62.',
 logicCorrection:'R61 failed 22/25 with gains=4, threshold crossings=4 and companions=0. Its exact 8-direction 6/12 lattice-offset premise treated the audit lattice as if it were the continuous terrace-support domain; that is a discretization fallacy. R62 keeps the unchanged materiality and chain gates and changes only the support geometry. Browser startup remains renderability evidence, not terrace correctness.',
 constraint:'the 6 m QA lattice, 3-27 m contour-tube reach, 8.5 m cross-contour cap, tangent gates and inherited 12 m hard drainage core are synthetic morphology/QA parameters, not surveyed Yunnan terrace dimensions. The current 12.5 m macro DEM and photographs cannot provide field/sub-metre microtopography, real parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay; Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png is reread as non-metric morphology evidence for long curved contour ribbons, unequal widths, nested bends, local branch/rejoin and drainage interruptions. No terrace width, extension length, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic nonrecursive frozen-seed contour tube extending accepted R58 morphology; not surveyed terrace, parcel or hydraulic truth',
 inheritedFailure:'R61 is retained as a failed candidate: its persisted authoritative result passed Chrome but failed numeric materiality, frozen-seed-plus-companion and new-chain gates (22/25).'
}};
