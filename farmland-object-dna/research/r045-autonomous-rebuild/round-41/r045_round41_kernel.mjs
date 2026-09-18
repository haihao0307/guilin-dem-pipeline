import * as R40 from '../round-40/r045_round40_kernel.mjs';
import * as R39 from '../round-39/r045_round39_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-40/r045_round40_kernel.mjs';

export const VERSION='R045.41';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const CACHE40=new Map(),CACHE39=new Map(),CACHE41=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r40At(x,z){const k=keyOf(x,z);let v=CACHE40.get(k);if(v===undefined){v=R40.terraceStateAt(x,z);CACHE40.set(k,v)}return v}
function r39At(x,z){const k=keyOf(x,z);let v=CACHE39.get(k);if(v===undefined){v=R39.terraceStateAt(x,z);CACHE39.set(k,v)}return v}
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
const OFFSETS8=[[6,0,'E'],[-6,0,'W'],[0,6,'N'],[0,-6,'S'],[6,6,'NE'],[-6,6,'NW'],[6,-6,'SE'],[-6,-6,'SW']];
function support39At(x,z,base){
  const active=[];
  for(const [dx,dz,dir] of OFFSETS8){
    const n=r39At(x+dx,z+dz);
    if(n.mask>.12&&compatible(base,n))active.push({dx,dz,dir,n,r:Math.hypot(dx,dz)});
  }
  const row=active.filter(s=>s.dz===0),upper=active.filter(s=>s.dz>0),lower=active.filter(s=>s.dz<0),near=active.filter(s=>s.r<=8.6);
  const crossRow=upper.length+lower.length;
  const sectors=new Set(active.map(s=>s.dz>0?'U':s.dz<0?'D':s.dx>0?'R':'L'));
  const spread=(row.length>0&&crossRow>0)||(upper.length>0&&lower.length>0);
  const strong=near.length>=2&&active.length>=2&&spread&&crossRow>=1&&sectors.size>=2;
  let opposite=false;
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j];if(a.r&&b.r&&(a.dx*b.dx+a.dz*b.dz)/(a.r*b.r)<-.25)opposite=true;
  }
  const shoulder=active.length?[...active].sort((a,b)=>b.n.mask-a.n.mask).slice(0,2).reduce((m,s)=>Math.min(m,s.n.mask),1):0;
  return {active,row,upper,lower,near,sectors,crossRow,strong,opposite,shoulder};
}

// R41 repairs the measured R40 under-power without inventing a wider topology rule.
// Existing R40-active geometry is bit-exact. Weak R40 samples may be strengthened only when they already have the
// same immediate R39 support pattern that R40's original QA recognized: >=2 compatible near neighbours spanning
// row/cross-row sectors. This targets R40 candidates that were structurally supported but numerically too weak.
// No new R41 cell can support another R41 cell; drainage/receiver safety remains a hard gate and amplitude remains .84.
export function familyRepairGain(x,z){
  const base40=r40At(x,z);if(base40.mask>.12)return 0;
  const safety=safetyAt(x,z);if(safety<=0)return 0;
  const provenance=r39At(x,z),sup=support39At(x,z,provenance);if(!sup.strong)return 0;
  const topology=(sup.opposite?1:.94)*(sup.upper.length&&sup.lower.length?1:.97)*(sup.sectors.size>=3?1:.98);
  const targetCore=C(.090+.82*sup.shoulder,.220,sup.opposite?.290:.265);
  const blend=(.72+.28*safety)*topology;
  const target=base40.mask+(targetCore-base40.mask)*blend;
  return C(Math.max(0,target-base40.mask),0,.115);
}
function computeTerraceState(x,z){
  const base=r40At(x,z),gain=familyRepairGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw;
  const provenance=r39At(x,z),sup=gain>0?support39At(x,z,provenance):null;
  return {...base,mask,delta,target:base.base+delta,familyRepairGain:gain,repairSupport:sup?{count:sup.active.length,near:sup.near.length,row:sup.row.length,upper:sup.upper.length,lower:sup.lower.length,sectors:sup.sectors.size,opposite:sup.opposite}:null};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE41.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE41.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r40At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R40.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round41:{
 scope:'repair R40 terrace-family organization where immediate R39 topology evidence already existed but R40 promotion strength was insufficient; keep all R40-active geometry exact and do not raise risers',
 method:'hold every already-active R40 sample, stair step, phase, raw response and 0.84 amplitude fixed. Strengthen only R40-weak samples that already have at least two immediate same-family stair-compatible active R39 neighbours spanning row/cross-row sectors; re-gate by agricultural slope, family envelope, drainage and foreground receiver; never recurse from new R41 cells.',
 logicCorrection:'A successful browser render does not prove terrace topology, and lower fragmentation does not prove an agricultural branch or merge is true. R41 therefore repairs the measured R40 materiality deficit using R39-provenanced immediate support instead of weakening the original total-organization gates, increasing riser amplitude, or expanding topology from new cells.',
 constraint:'the 6 m QA lattice, immediate-neighbour sector rule and 12 m hard-core exclusion are synthetic morphology parameters, not surveyed Yunnan terrace dimensions or measured branch/merge locations. Current macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state or soil-water state without the missing field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only for ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread this round only for non-metric morphology: long curved contour-following ribbons, unequal widths, local branch/re-merge organization and drainage interruptions. No metric terrace width, junction length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic constrained repair of underpowered R40 higher-order terrace organization using immediate R39 topology provenance; not surveyed terrace topology, parcel truth or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
