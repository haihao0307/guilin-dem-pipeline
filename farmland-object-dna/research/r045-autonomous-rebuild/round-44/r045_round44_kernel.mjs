import * as R43 from '../round-43/r045_round43_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-43/r045_round43_kernel.mjs';

export const VERSION='R045.44';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const CACHE43=new Map(),CACHE44=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r43At(x,z){const k=keyOf(x,z);let v=CACHE43.get(k);if(v===undefined){v=R43.terraceStateAt(x,z);CACHE43.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function pathSafe(x,z,ux,uz,n,sgn){for(let i=1;i<n;i++){if(safetyAt(x+sgn*ux*i,z+sgn*uz*i)<=.08)return false}return true}
function findAnchor(base,x,z,ux,uz,sgn,minN=2,maxN=6){for(let n=minN;n<=maxN;n++){const q=r43At(x+sgn*ux*n,z+sgn*uz*n);if(q.mask>.12&&compatible(base,q)&&pathSafe(x,z,ux,uz,n,sgn))return{q,n}}return null}
function bridgeSupportAt(x,z){const base=r43At(x,z);if(base.mask>.12||safetyAt(x,z)<=0)return null;let best=null;for(const [ux,uz,name] of [[6,0,'contour-x'],[0,6,'contour-z'],[6,6,'diag-down'],[6,-6,'diag-up']]){const a=findAnchor(base,x,z,ux,uz,-1,2,6),b=findAnchor(base,x,z,ux,uz,1,2,6);if(!a||!b||!compatible(a.q,b.q))continue;const span=(a.n+b.n)*Math.hypot(ux,uz),strength=Math.min(a.q.mask,b.q.mask)+.35*safetyAt(x,z)-.0025*span;if(!best||strength>best.strength)best={mode:'two-anchor-corridor',name,ux,uz,leftN:a.n,rightN:b.n,span,leftMask:a.q.mask,rightMask:b.q.mask,strength,groupIndex:a.q.groupIndex}}return best}
function extensionSupportAt(x,z){
 const base=r43At(x,z);if(base.mask>.12||safetyAt(x,z)<=0)return null;let best=null;
 for(const [ux,uz,name] of [[6,0,'contour-x'],[0,6,'contour-z'],[6,6,'diag-down'],[6,-6,'diag-up']])for(const sgn of [-1,1]){
  const q1=r43At(x-sgn*ux,z-sgn*uz),q2=r43At(x-2*sgn*ux,z-2*sgn*uz),q3=r43At(x-3*sgn*ux,z-3*sgn*uz);
  if(q1.mask<=.12||q2.mask<=.12||!compatible(base,q1)||!compatible(base,q2)||!compatible(q1,q2))continue;
  if(safetyAt(x-sgn*ux,z-sgn*uz)<=0||safetyAt(x-2*sgn*ux,z-2*sgn*uz)<=0)continue;
  const has3=q3.mask>.12&&compatible(base,q3)&&compatible(q2,q3),sourceMasks=has3?[q1.mask,q2.mask,q3.mask]:[q1.mask,q2.mask];
  const strength=Math.min(...sourceMasks)+.25*safetyAt(x,z)+(has3?.035:0);
  if(!best||strength>best.strength)best={mode:'stable-two-plus-anchor-extension',name,ux,uz,sgn,sourceMasks,anchorCount:has3?3:2,strength,groupIndex:q1.groupIndex};
 }
 return best;
}
export function macroCorridorSupportAt(x,z){return bridgeSupportAt(x,z)||extensionSupportAt(x,z)}
export function macroCorridorGain(x,z){const base=r43At(x,z);if(base.mask>.12)return 0;const sup=macroCorridorSupportAt(x,z);if(!sup)return 0;const safe=safetyAt(x,z);const target=sup.mode==='two-anchor-corridor'?C(.27+.05*safe+.05*Math.min(sup.leftMask,sup.rightMask),.28,.39):C(.19+.055*safe+.045*Math.min(...sup.sourceMasks),.215,.30);const rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.25/(.84*rawAbs):.32;return C(Math.max(0,target-base.mask),0,Math.min(.32,deltaBound))}
function computeTerraceState(x,z){const base=r43At(x,z);if(base.mask>.12)return{...base,macroCorridorGain:0,macroCorridorSupport:null};const gain=macroCorridorGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?macroCorridorSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,macroCorridorGain:gain,macroCorridorSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE44.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE44.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r43At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R43.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round44:{
 scope:'raise terrace organization from sparse one-cell branch repairs to frozen-R43 contour-ribbon continuations across the one-sided agricultural slope; retain vertical stair response and all hydrology protections',
 method:'existing R43 active terrace samples remain exact. Weak frozen-R43 samples may be promoted only by either same-family/stair-compatible anchors on both sides 12-36 m away with every intervening sample safe, or by a frozen two-or-three-active-cell same-family/stair-compatible chain that extends one cell along one of four QA-lattice contour directions. R44 cells never seed more R44 cells. The 0.84 multiplier, stair step, phase and raw response are inherited unchanged.',
 logicCorrection:'main-view terrace weakness does not imply risers should be amplified: visibility and topological organization are different variables. Likewise, longer ribbons alone do not prove agricultural correctness because an indiscriminate bridge can erase real drainage separators. A further QA correction is required: per-row run count and per-row longest-run length are not valid hard truth for curved or branching contour ribbons; R43 already established this. R44 therefore changes only frozen support organization, keeps vertical quantization fixed, and evaluates materiality with same-family/stair-compatible 2-D component growth while retaining row metrics only as diagnostics.',
 constraint:'the 6 m QA lattice, 12-36 m synthetic anchor search, four lattice directions, two-or-three frozen support cells, 12 m hard drainage core and generated continuations are morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured hydraulic connectivity. Current 12.5 m macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'the saved MrRolord frame audit is used as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Voronoi, Blender dimensions, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is reread only for non-metric morphology: long curved contour-following ribbons, unequal widths, nested organization, local branching/remerging and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-R43 contour-ribbon continuation; not surveyed terrace, parcel or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
