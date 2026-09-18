import * as R42 from '../round-42/r045_round42_kernel.mjs';
import * as R41 from '../round-41/r045_round41_kernel.mjs';
import * as R40 from '../round-40/r045_round40_kernel.mjs';
import * as R39 from '../round-39/r045_round39_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-42/r045_round42_kernel.mjs';

export const VERSION='R045.43';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const CACHE42=new Map(),CACHE43=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r42At(x,z){const k=keyOf(x,z);let v=CACHE42.get(k);if(v===undefined){v=R42.terraceStateAt(x,z);CACHE42.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.18,.24*step)&&Math.abs(a.index-b.index)<=3}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function latentCompatible(c,l,r){
 if(c.groupIndex!==l.groupIndex||c.groupIndex!==r.groupIndex)return false;
 const step=.5*(l.step+r.step),tol=Math.max(.22,.30*step);
 if(Math.abs(c.step-step)>tol)return false;
 const lo=Math.min(l.index,r.index)-4,hi=Math.max(l.index,r.index)+4;
 return c.index>=lo&&c.index<=hi;
}

// R42 proved that requiring every gap cell to carry R39 weak-mask provenance was too restrictive: the
// entire pass became a no-op (0 incremental cells) while the R41 fragmentation regression remained.
// R43 keeps the failed fragmentation gate unchanged, keeps every already-active R42 sample bit-exact,
// and replaces only that impossible provenance condition with a latent-stair condition already encoded
// by the frozen R42 field. A short same-row gap may close only when both frozen R42 boundary ribbons are
// active, same-family and stair-compatible; every interior cell must have the same latent family, a
// compatible step/index frame, pass slope/family/drainage/receiver safety, and the whole gap is <= 42 m.
// New R43 cells never seed additional growth. Hard drainage <=12 m remains absolute zero.
function bridgeSupportAt(x,z){
 const base=r42At(x,z);if(base.mask>.12||safetyAt(x,z)<=0)return null;
 let left=null,right=null;
 for(const d of [6,12,18,24,30,36]){
  if(!left){const q=r42At(x-d,z);if(q.mask>.12)left={d,q}}
  if(!right){const q=r42At(x+d,z);if(q.mask>.12)right={d,q}}
 }
 if(!left||!right||left.d+right.d>42||!compatible(left.q,right.q)||!latentCompatible(base,left.q,right.q))return null;
 const xl=x-left.d,xr=x+right.d;let safeMin=1,cells=0;
 for(let xi=xl+6;xi<=xr-6+1e-9;xi+=6){
  const q=r42At(xi,z),s=safetyAt(xi,z);if(q.mask>.12||s<=0||!latentCompatible(q,left.q,right.q))return null;
  safeMin=Math.min(safeMin,s);cells++;
 }
 if(cells<1||cells>6)return null;
 return{leftDist:left.d,rightDist:right.d,gapCells:cells,leftMask:left.q.mask,rightMask:right.q.mask,safeMin,groupIndex:left.q.groupIndex};
}
export function contourBridgeGain(x,z){
 const base=r42At(x,z);if(base.mask>.12)return 0;const sup=bridgeSupportAt(x,z);if(!sup)return 0;
 const shoulder=Math.min(sup.leftMask,sup.rightMask);const target=C(.120+.22*shoulder+.018*sup.safeMin,.146,.178);
 const rawAbs=Math.abs(base.raw);const deltaBound=rawAbs>1e-9?.132/(.84*rawAbs):.16;
 return C(Math.max(0,target-base.mask),0,Math.min(.16,deltaBound));
}
function computeTerraceState(x,z){const base=r42At(x,z),gain=contourBridgeGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?bridgeSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,contourBridgeGain:gain,bridgeSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE43.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE43.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r42At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R42.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round43:{
 scope:'repair the failed R42 no-op and R41 fragmentation regression by closing only frozen-R42 bounded short same-row contour gaps; no riser amplification, global dilation, parcel generation or hydraulic claims',
 method:'hold every already-active R42 sample, stair step, phase, raw response and 0.84 amplitude fixed. Search only same-row gaps bounded by frozen active R42 ribbons that are mutually same-family/stair-compatible. Each interior cell must retain the same latent family and compatible step/index frame from R42 and pass agricultural-slope, family-envelope, drainage and foreground-receiver safety. Entire gaps are <=42 m and the operation is non-recursive.',
 logicCorrection:'R42 browser success did not make its geometry successful: its persisted QA shows zero incremental gain and unchanged fragmentation. Lowering the fragmentation gate or calling the no-op a pass would confuse renderability with topology. The R39 weak-mask provenance requirement was also not a necessary condition for a latent terrace-frame gap, so R43 replaces that impossible condition with frozen-boundary plus latent-stair compatibility while leaving the fragmentation target unchanged.',
 constraint:'the 6 m QA lattice, 42 m synthetic gap ceiling, latent step/index tolerances, 12 m hard drainage core and generated closures are morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured connectivity. Current macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only for ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is used only for non-metric morphology: long curved contour-following ribbons, unequal widths, nested organization and drainage interruptions. No terrace width, closure length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-boundary contour-gap repair on inherited R42/R41 terrace organization; not surveyed terrace, parcel or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured closure length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
