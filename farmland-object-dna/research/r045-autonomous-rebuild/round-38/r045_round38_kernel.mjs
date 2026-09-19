import * as R37 from '../round-37/r045_round37_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-37/r045_round37_kernel.mjs';

export const VERSION='R045.38';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){
  if(a.groupIndex!==b.groupIndex)return false;
  const step=.5*(a.step+b.step);
  if(Math.abs(a.step-b.step)>Math.max(.18,.24*step))return false;
  if(Math.abs(a.index-b.index)>3)return false;
  return true;
}
function safetyAt(x,z){
  const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;
  const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);
  if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;
  return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1));
}

// R37 proved that a cached world-space continuity field can render in real Chrome, but its row-run
// fragmentation burden rose slightly because some threshold crossings created new short runs. R38 does not
// raise risers or globally dilate support. It adds at most one 6 m audit-cell of same-family support at an
// existing R37 run end. Because every promoted cell must touch an already-active R37 neighbour, this operation
// can extend or close an existing run but cannot create a new isolated run. The operation is non-recursive.
export function runEndExtensionGain(x,z){
  const base=R37.terraceStateAt(x,z);if(base.mask>.12)return 0;
  const safety=safetyAt(x,z);if(safety<=0)return 0;
  const left=R37.terraceStateAt(x-6,z),right=R37.terraceStateAt(x+6,z);
  const lv=left.mask>.12&&compatible(base,left),rv=right.mask>.12&&compatible(base,right);
  if(!lv&&!rv)return 0;
  const shoulder=lv&&rv?Math.min(left.mask,right.mask):Math.max(lv?left.mask:0,rv?right.mask:0);
  const twoSided=lv&&rv;
  const targetCore=C((twoSided?.030:.020)+(twoSided?.90:.76)*shoulder,.125,twoSided?.225:.185);
  const target=base.mask+(targetCore-base.mask)*safety;
  return C(Math.max(0,target-base.mask),0,.12);
}
export function terraceStateAt(x,z){
  const base=R37.terraceStateAt(x,z),gain=runEndExtensionGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw;
  return {...base,mask,delta,target:base.base+delta,runEndExtensionGain:gain};
}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R37.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R37.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round38:{
 scope:'repair the slight R37 fragmentation regression by extending only existing terrace-run ends, while preserving the cached R37 field, stair geometry, drainage breaks, parcels and hydraulics locks',
 method:'hold R37 step, phase, raw stair response and 0.84 amplitude fixed. For weak samples only, inspect the immediate +/-6 m canonical row neighbours. Promote a sample only when at least one already-active R37 neighbour is same-family and stair-compatible; use a bounded one-cell, non-recursive extension re-gated by broad agricultural slope, family envelope, drainage clearance and foreground-receiver clearance. Hard drainage <=12 m remains absolute zero.',
 logicCorrection:'R37 browser success does not cancel its failed numeric topology gate: renderability and fragmentation are different claims. Conversely, weakening the fragmentation gate would only hide a real short-run regression. R38 therefore changes support topology itself, but only by extending an existing run end; it does not raise risers, increase the timeout, or globally close the terrace mask.',
 constraint:'the 6 m run-end sampling distance and promoted joins are synthetic QA morphology, not surveyed Yunnan terrace dimensions. The current 12.5 m macro DEM and photographs still cannot provide measured branch/merge locations, parcel boundaries, bund/channel sections, inlet/outlet sill elevations or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO still treats field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown. Surface continuity cannot establish ownership, hydraulic connectivity, head, water depth, discharge or gate state.',
 mrRolordUse:'the saved MrRolord frame audit is used only for ordering: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R38 keeps the hydrology-first exclusions and deterministic world-space terrace support; Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reopened this round. R38 uses only visible morphology: long curved benches form nested families and may reconnect locally while drainage interruptions remain legible. No metric terrace width, join length, riser height, channel size, water depth or hydraulic parameter is inferred.',
 evidenceClass:'synthetic run-end terrace continuity regularization on the verified R37/R35 substrate; not surveyed terrace geometry or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured branch location','measured merge location','measured join length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
}};
