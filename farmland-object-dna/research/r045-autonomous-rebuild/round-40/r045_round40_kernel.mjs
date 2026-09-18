import * as R39 from '../round-39/r045_round39_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-39/r045_round39_kernel.mjs';

export const VERSION='R045.40';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const CACHE=new Map();
function r39At(x,z){const k=`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;let v=CACHE.get(k);if(v===undefined){v=R39.terraceStateAt(x,z);CACHE.set(k,v)}return v}
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
  [12,0,'EE'],[-12,0,'WW'],[12,6,'ENE'],[-12,6,'WNW'],[12,-6,'ESE'],[-12,-6,'WSW']
];
function supportAt(x,z,base){
  const active=[];
  for(const [dx,dz,dir] of OFFSETS){
    const n=r39At(x+dx,z+dz);
    if(n.mask>.12&&compatible(base,n))active.push({dx,dz,dir,n});
  }
  const row=active.filter(s=>s.dz===0),upper=active.filter(s=>s.dz>0),lower=active.filter(s=>s.dz<0),near=active.filter(s=>Math.hypot(s.dx,s.dz)<=8.6);
  const cross=upper.length+lower.length;
  const spread=(row.length>0&&cross>0)||(upper.length>0&&lower.length>0);
  const strong=near.length>=2&&active.length>=2&&spread;
  let opposite=false;
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j],la=Math.hypot(a.dx,a.dz),lb=Math.hypot(b.dx,b.dz);
    if(la&&lb&&(a.dx*b.dx+a.dz*b.dz)/(la*lb)<-.25)opposite=true;
  }
  const shoulder=active.length?[...active].sort((a,b)=>b.n.mask-a.n.mask).slice(0,2).reduce((m,s)=>Math.min(m,s.n.mask),1):0;
  return {active,row,upper,lower,cross,near,spread,strong,opposite,shoulder};
}

// R40 moves from centimetre-scale run-end repair to a higher-order family-organization pass.
// Existing R39 active terrace geometry is bit-exact. A weak R39 sample can be promoted only where
// at least two already-active, same-family, stair-compatible near neighbours occupy more than one
// contour-row sector. This creates short diagonal/lateral junctions that allow nested ribbons to branch
// or re-merge between adjacent rows, while a single neighbour cannot grow a new island. The operation
// is non-recursive and all promoted samples are re-gated by slope/family/drainage/receiver safety;
// hard drainage <=12 m stays zero.
export function familyOrganizationGain(x,z){
  const base=r39At(x,z);if(base.mask>.12)return 0;
  const safety=safetyAt(x,z);if(safety<=0)return 0;
  const sup=supportAt(x,z,base);if(!sup.strong)return 0;
  const topology=(sup.opposite?.96:.82)*(sup.upper.length&&sup.lower.length?1:.93);
  const targetCore=C(.030+.78*sup.shoulder,.132,sup.opposite?.245:.220);
  const target=base.mask+(targetCore-base.mask)*safety*topology;
  return C(Math.max(0,target-base.mask),0,.112);
}
export function terraceStateAt(x,z){
  const base=r39At(x,z),gain=familyOrganizationGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw;
  const sup=gain>0?supportAt(x,z,base):null;
  return {...base,mask,delta,target:base.base+delta,familyOrganizationGain:gain,organizationSupport:sup?{count:sup.active.length,row:sup.row.length,upper:sup.upper.length,lower:sup.lower.length,opposite:sup.opposite}:null};
}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r39At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R39.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round40:{
 scope:'organize verified R39 terrace ribbons into limited same-family adjacent-row junctions so nesting, branching and re-merging can emerge without raising risers or erasing drainage breaks',
 method:'hold every already-active R39 sample, stair step, phase, raw response and 0.84 amplitude fixed. Promote only R39-weak samples with at least two near already-active same-family stair-compatible R39 neighbours spanning more than one contour-row sector; re-gate by agricultural slope, family envelope, drainage and foreground receiver; never recurse from new R40 cells.',
 logicCorrection:'Weak perspective readability does not imply insufficient riser amplitude. Lower fragmentation or greater connectedness also does not prove correct topology because an indiscriminate closing can erase legitimate drainage breaks. R40 therefore tests structured same-family junction evidence instead of height amplification or global mask closing.',
 constraint:'the 6 m organization lattice, neighbour sectors, 12 m hard-core rule and generated junctions are synthetic QA morphology, not surveyed Yunnan terrace branch/merge geometry. Current 12.5 m macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO evidence boundaries remain active: surface continuity cannot establish parcel ownership, hydraulic connectivity, head, water depth, discharge or gate state, and field geometry remains unknown without field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only for ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. R40 keeps drainage-first exclusions and world-space morphology; Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png was reread this round only for non-metric morphology: long curved nested ribbons, unequal widths, local branch/re-merge organization and drainage interruptions. No metric terrace width, junction length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic higher-order same-family terrace organization on verified R39 substrate; not surveyed terrace topology, parcel truth or hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
