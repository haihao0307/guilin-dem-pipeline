import * as R38 from '../round-38/r045_round38_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-38/r045_round38_kernel.mjs';

export const VERSION='R045.39';
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
function stableSide(x,z,dir,base){
  const n1=R38.terraceStateAt(x+6*dir,z),n2=R38.terraceStateAt(x+12*dir,z);
  const ok=n1.mask>.12&&n2.mask>.12&&compatible(base,n1)&&compatible(base,n2)&&compatible(n1,n2);
  return {ok,n1,n2,shoulder:ok?Math.min(n1.mask,n2.mask):0};
}

// R38 repaired short-run fragmentation by one non-recursive cell from an existing R37 end.
// R39 does not raise risers and does not globally dilate the terrace mask. It adds one further 6 m
// shell only when the R38 candidate is backed by TWO consecutive already-active, same-family,
// stair-compatible R38 cells. This converts stable short runs into longer contour ribbons while a
// weak or isolated neighbour cannot seed growth. The operation is again non-recursive and is
// re-gated by the inherited agricultural-slope, family, drainage and foreground-receiver safety.
export function stableRunContinuationGain(x,z){
  const base=R38.terraceStateAt(x,z);if(base.mask>.12)return 0;
  const safety=safetyAt(x,z);if(safety<=0)return 0;
  const left=stableSide(x,z,-1,base),right=stableSide(x,z,1,base);
  if(!left.ok&&!right.ok)return 0;
  const twoSided=left.ok&&right.ok;
  const shoulder=twoSided?Math.min(left.shoulder,right.shoulder):Math.max(left.shoulder,right.shoulder);
  const targetCore=C((twoSided?.034:.024)+(twoSided?.92:.80)*shoulder,.128,twoSided?.230:.190);
  const target=base.mask+(targetCore-base.mask)*safety;
  return C(Math.max(0,target-base.mask),0,.105);
}
export function terraceStateAt(x,z){
  const base=R38.terraceStateAt(x,z),gain=stableRunContinuationGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw;
  return {...base,mask,delta,target:base.base+delta,stableRunContinuationGain:gain};
}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R38.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R38.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round39:{
 scope:'lengthen already-stable same-family terrace ribbons by one additional safe non-recursive shell, without changing riser amplitude, stair frame, drainage breaks, parcel state or hydraulics state',
 method:'hold R38 step, phase, raw stair response and 0.84 amplitude fixed. A weak sample may gain support only when one side contains two consecutive already-active R38 samples that are same-family and stair-compatible. Re-gate every promoted sample by broad agricultural slope, family envelope, drainage clearance and foreground-receiver clearance; hard drainage <=12 m remains absolute zero.',
 logicCorrection:'Weak main-view readability does not imply that risers should be raised, and greater connectivity alone does not imply correct terrace topology. R39 therefore changes only the length of already-stable same-family runs; it cannot grow from a single weak neighbour, cannot cross the hard drainage core, and does not claim split/merge correctness from a lower fragmentation score.',
 constraint:'the 6 m audit step, the two-neighbour stability test and every promoted continuation are synthetic QA morphology, not surveyed Yunnan terrace dimensions or measured branch/merge locations. The current 12.5 m macro DEM and photographs still cannot provide field microtopography, parcel boundaries, bund/channel sections, inlet/outlet sill elevations or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO evidence boundaries remain active: field location/boundary, field microtopography, bund section, channel section and water-control elevation are unknown until field-scale evidence exists. Visual or surface continuity cannot establish ownership, hydraulic connectivity, head, water depth, discharge or gate state.',
 mrRolordUse:'the saved MrRolord study is used only for ordering and morphology discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R39 keeps drainage-first exclusions and deterministic world-space support; Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread this round only for visible morphology: long curved benches read as nested ribbons, local continuations remain subordinate to drainage interruptions, and repeated short islands are visually weak. No metric terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic stable-run terrace-continuation regularization on the verified R38/R35 substrate; not surveyed terrace geometry, parcel truth or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured continuation length','measured branch location','measured merge location','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
}};
