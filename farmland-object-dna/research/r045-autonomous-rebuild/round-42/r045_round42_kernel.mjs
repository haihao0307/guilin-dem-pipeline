import * as R41 from '../round-41/r045_round41_kernel.mjs';
import * as R40 from '../round-40/r045_round40_kernel.mjs';
import * as R39 from '../round-39/r045_round39_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-41/r045_round41_kernel.mjs';

export const VERSION='R045.42';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const CACHE41=new Map(),CACHE39=new Map(),CACHE42=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r41At(x,z){const k=keyOf(x,z);let v=CACHE41.get(k);if(v===undefined){v=R41.terraceStateAt(x,z);CACHE41.set(k,v)}return v}
function r39At(x,z){const k=keyOf(x,z);let v=CACHE39.get(k);if(v===undefined){v=R39.terraceStateAt(x,z);CACHE39.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.18,.24*step)&&Math.abs(a.index-b.index)<=3}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}

// R41 solved its materiality contradiction but introduced four additional row runs (82 vs R40's 78),
// so its fragmentation gate still failed. R42 does not weaken that gate and does not raise risers.
// It fills only short SAME-ROW gaps whose two R41 boundary ribbons already exist, are same-family/stair-compatible,
// and whose entire <=24 m weak interior is safe and has inherited R39 weak support. Because support comes only from
// the frozen R41 field, no R42 cell can recursively grow topology. Hard drainage and foreground receiver remain hard exclusions.
function gapSupportAt(x,z){
 const base=r41At(x,z);if(base.mask>.12)return null;const prior=r39At(x,z);if(prior.mask<.02||safetyAt(x,z)<=0)return null;
 let left=null,right=null;for(const d of [6,12,18,24]){if(!left){const q=r41At(x-d,z);if(q.mask>.12&&compatible(prior,q))left={d,q}}if(!right){const q=r41At(x+d,z);if(q.mask>.12&&compatible(prior,q))right={d,q}}}
 if(!left||!right||left.d+right.d>30||!compatible(left.q,right.q))return null;
 // Require the whole interior between frozen R41 boundary ribbons to be eligible. This prevents partial fills that create new runs.
 const xl=x-left.d,xr=x+right.d;let weakMin=1,safeMin=1,cells=0;
 for(let xi=xl+6;xi<=xr-6+1e-9;xi+=6){const p=r39At(xi,z),s=safetyAt(xi,z);if(p.mask<.02||s<=0||!compatible(prior,p))return null;weakMin=Math.min(weakMin,p.mask);safeMin=Math.min(safeMin,s);cells++}
 if(cells<1||cells>4)return null;
 return{leftDist:left.d,rightDist:right.d,gapCells:cells,leftMask:left.q.mask,rightMask:right.q.mask,weakMin,safeMin};
}
export function contourGapGain(x,z){const base=r41At(x,z);if(base.mask>.12)return 0;const sup=gapSupportAt(x,z);if(!sup)return 0;const shoulder=Math.min(sup.leftMask,sup.rightMask);const target=C(.142+.18*shoulder+.018*sup.safeMin,.148,.188);return C(Math.max(0,target-base.mask),0,.115)}
function computeTerraceState(x,z){const base=r41At(x,z),gain=contourGapGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?gapSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,contourGapGain:gain,gapSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE42.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE42.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r41At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R41.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round42:{
 scope:'repair R41 fragmentation without weakening its material/topology gates, raising risers, changing stair phase, or touching any already-active R41 terrace sample',
 method:'fill only short contour-row gaps bounded on both sides by frozen R41 active ribbons. Boundary ribbons and every interior weak sample must be same-family/stair-compatible; every interior sample must retain R39 weak provenance and pass agricultural-slope, family-envelope, drainage and foreground-receiver safety. Gap fill is non-recursive and limited to at most four 6 m weak cells.',
 logicCorrection:'R41 passing materiality/topology gates does not make its higher fragmentation acceptable. Lowering the fragmentation gate would conceal a measured regression; raising risers would change visibility rather than topology. R42 instead repairs only pre-existing short gaps between already-proven R41 ribbons while preserving the failed gate unchanged.',
 constraint:'the 6 m QA lattice, maximum four-cell contour-gap closure, 12 m hard-core exclusion and generated branch/merge organization are synthetic morphology parameters, not surveyed Yunnan terrace dimensions or measured connectivity. Current macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state or soil-water state without field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only for ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is used only for non-metric morphology: long curved contour-following ribbons, unequal widths, local branch/re-merge organization and drainage interruptions. No metric terrace width, closure length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic short-gap contour continuity repair on inherited R41 terrace organization; not surveyed terrace, parcel or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
