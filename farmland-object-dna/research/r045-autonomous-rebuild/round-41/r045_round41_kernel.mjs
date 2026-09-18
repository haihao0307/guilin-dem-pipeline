import * as R40 from '../round-40/r045_round40_kernel.mjs';
import * as R39 from '../round-39/r045_round39_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-40/r045_round40_kernel.mjs';

export const VERSION='R045.41';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const CACHE40=new Map();
function r40At(x,z){const k=`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;let v=CACHE40.get(k);if(v===undefined){v=R40.terraceStateAt(x,z);CACHE40.set(k,v)}return v}
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
const OFFSETS=[
  [6,0,'E'],[-6,0,'W'],[0,6,'N'],[0,-6,'S'],
  [6,6,'NE'],[-6,6,'NW'],[6,-6,'SE'],[-6,-6,'SW'],
  [12,0,'EE'],[-12,0,'WW'],[0,12,'NN'],[0,-12,'SS'],
  [12,6,'ENE'],[-12,6,'WNW'],[12,-6,'ESE'],[-12,-6,'WSW'],
  [6,12,'NNE'],[-6,12,'NNW'],[6,-12,'SSE'],[-6,-12,'SSW']
];
function supportAt(x,z,base){
  const active=[];
  for(const [dx,dz,dir] of OFFSETS){
    const n=r40At(x+dx,z+dz);
    if(n.mask>.12&&compatible(base,n))active.push({dx,dz,dir,n,r:Math.hypot(dx,dz)});
  }
  const immediate=active.filter(s=>s.r<=8.6),extended=active.filter(s=>s.r<=13.5),upper=extended.filter(s=>s.dz>0),lower=extended.filter(s=>s.dz<0),row=extended.filter(s=>s.dz===0);
  const sectors=new Set(extended.map(s=>s.dz>0?'U':s.dz<0?'D':s.dx>0?'R':'L'));
  const crossRow=upper.length+lower.length;
  const strong=immediate.length>=1&&extended.length>=3&&crossRow>=1&&sectors.size>=2;
  let opposite=false;
  for(let i=0;i<extended.length;i++)for(let j=i+1;j<extended.length;j++){
    const a=extended[i],b=extended[j];if(a.r&&b.r&&(a.dx*b.dx+a.dz*b.dz)/(a.r*b.r)<-.25)opposite=true;
  }
  const shoulder=extended.length?[...extended].sort((a,b)=>b.n.mask-a.n.mask).slice(0,3).reduce((m,s)=>Math.min(m,s.n.mask),1):0;
  return {active,immediate,extended,upper,lower,row,sectors,crossRow,strong,opposite,shoulder};
}

// R41 repairs the measured under-powered R40 junction pass without lowering R40's original materiality gates.
// Every R40-active terrace sample remains exact. Only R40-weak samples may be promoted, and only from already-active
// compatible R40 support: one immediate neighbour plus at least three compatible neighbours within 13.5 m spanning
// multiple sectors including an adjacent contour row. New R41 cells never support further R41 growth.
export function familyRepairGain(x,z){
  const base=r40At(x,z);if(base.mask>.12)return 0;
  const safety=safetyAt(x,z);if(safety<=0)return 0;
  const sup=supportAt(x,z,base);if(!sup.strong)return 0;
  const topology=(sup.opposite?.96:.84)*(sup.upper.length&&sup.lower.length?1:.94)*(sup.sectors.size>=3?1:.96);
  const targetCore=C(.045+.74*sup.shoulder,.145,sup.opposite?.232:.214);
  const target=base.mask+(targetCore-base.mask)*safety*topology;
  return C(Math.max(0,target-base.mask),0,.090);
}
export function terraceStateAt(x,z){
  const base=r40At(x,z),gain=familyRepairGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw;
  const sup=gain>0?supportAt(x,z,base):null;
  return {...base,mask,delta,target:base.base+delta,familyRepairGain:gain,repairSupport:sup?{count:sup.extended.length,immediate:sup.immediate.length,row:sup.row.length,upper:sup.upper.length,lower:sup.lower.length,sectors:sup.sectors.size,opposite:sup.opposite}:null};
}
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
 scope:'repair the measured R40 adjacent-row organization deficit while keeping every R40-active terrace sample exact and without raising risers',
 method:'promote only R40-weak samples supported by one immediate and at least three same-family stair-compatible already-active R40 neighbours within 13.5 m spanning multiple sectors including an adjacent contour row; re-gate slope/family/drainage/receiver safety; never recurse from new R41 cells.',
 logicCorrection:'A successful browser render does not prove terrace topology, and lower fragmentation does not prove an agricultural branch or merge is true. R41 therefore fixes the measured R40 materiality deficit without weakening the original total-organization gates or increasing riser amplitude.',
 constraint:'the 6 m QA lattice, 13.5 m support radius, neighbour-sector rule and 12 m hard-core exclusion are synthetic morphology parameters, not surveyed Yunnan terrace dimensions or measured branch/merge locations. Current macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state or soil-water state without the missing field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only for ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread this round only for non-metric morphology: long curved contour-following ribbons, unequal widths, local branch/re-merge organization and drainage interruptions. No metric terrace width, junction length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic constrained repair of underpowered higher-order terrace organization; not surveyed terrace topology, parcel truth or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
