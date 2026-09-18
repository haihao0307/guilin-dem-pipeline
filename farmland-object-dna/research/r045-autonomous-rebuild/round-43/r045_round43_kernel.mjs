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
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}

// The first R43 attempt preserved R42's assumption that fragmentation must be repaired by a two-sided
// same-row gap closure. Its persisted QA proved that assumption false as implemented: 0 gains, 0 crossings,
// and the same 82 row-runs. More importantly, R41 intentionally created adjacent-row branch shoulders; a
// legitimate new shoulder can increase per-row run count even when 2-D organization improves. Therefore
// "row-run count must fall" is not a valid necessary condition for a branch/re-merge pass.
//
// This revision repairs the actual weak point instead of lowering the fragmentation burden gate or raising
// risers. It lengthens only R41-created active branch/junction shoulders by ONE frozen-R42 same-row companion
// cell. The source must carry a real R41 familyRepairGain, the candidate must share family/stair frame, and all
// slope/family/drainage/receiver safety gates are reapplied. New R43 cells never seed more growth. Existing
// active R42 geometry, step, phase, raw response and the 0.84 vertical multiplier remain exact.
function branchCompanionSupportAt(x,z){
 const base=r42At(x,z);if(base.mask>.12||safetyAt(x,z)<=0)return null;
 let best=null;
 for(const [dx,dir] of [[-6,'L'],[6,'R']]){
  const q=r42At(x+dx,z),sourceGain=Number(q.familyRepairGain||0);
  if(q.mask<=.12||sourceGain<=.004||!compatible(base,q))continue;
  const strength=q.mask+.35*sourceGain;
  if(!best||strength>best.strength)best={dir,dx,sourceMask:q.mask,sourceGain,sourceMode:q.repairSupport?.mode||'r41-repair',strength,groupIndex:q.groupIndex};
 }
 return best;
}
export function branchCompanionGain(x,z){
 const base=r42At(x,z);if(base.mask>.12)return 0;const sup=branchCompanionSupportAt(x,z);if(!sup)return 0;
 const safe=safetyAt(x,z),target=C(.116+.24*sup.sourceMask+.020*safe,.148,.182);
 const rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.132/(.84*rawAbs):.16;
 return C(Math.max(0,target-base.mask),0,Math.min(.16,deltaBound));
}
function computeTerraceState(x,z){const base=r42At(x,z),gain=branchCompanionGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?branchCompanionSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,branchCompanionGain:gain,branchCompanionSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE43.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE43.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r42At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x-e,z))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R42.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round43:{
 scope:'repair the R41/R42 short-run reading by giving only already-proven R41 branch/junction shoulders one safe frozen-R42 same-row companion; no riser amplification, global dilation, parcel generation or hydraulic claims',
 method:'hold every already-active R42 sample, stair step, phase, raw response and 0.84 amplitude fixed. A weak candidate may be promoted only when its immediate +/-6 m same-row frozen R42 neighbour is an active R41-created family-repair sample (familyRepairGain > .004), is same-family/stair-compatible, and the candidate passes agricultural-slope, family-envelope, drainage and foreground-receiver safety. New R43 cells are non-recursive.',
 logicCorrection:'R42 browser success did not make its geometry successful: persisted QA shows zero incremental gain and unchanged fragmentation. The first R43 attempt also produced zero gain, proving that two-sided same-row gap closure was not an available repair class. In addition, requiring row-run count itself to fall is not a necessary condition after R41 deliberately introduced adjacent-row branch shoulders: a legitimate branch can add a row run. R43 therefore keeps the unchanged R40-normalized fragmentation-burden target, but repairs short branch shoulders by one frozen-source companion instead of hiding the regression, raising risers or globally closing the mask.',
 constraint:'the 6 m QA lattice, one-cell branch-companion rule, stair tolerances, 12 m hard drainage core and generated continuations are morphology/QA parameters, not surveyed Yunnan terrace dimensions or measured connectivity. Current macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'the saved MrRolord study is used only for ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is used only for non-metric morphology: long curved contour-following ribbons, unequal widths, nested organization and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-source branch-shoulder continuation on inherited R42/R41 terrace organization; not surveyed terrace, parcel or hydraulic truth',
 failedAttempts:['R42 persisted browser success but numeric QA 31/34: zero incremental geometry and unchanged fragmentation.','R43 attempt A used frozen two-sided same-row bridges; persisted QA 27/31 with zero incremental geometry. Both failures remain in Git history.'],
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};
