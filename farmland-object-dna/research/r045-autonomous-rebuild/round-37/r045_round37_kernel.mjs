import * as R36 from '../round-36/r045_round36_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
import {SEEDS,META} from './r045_round37_seed_cache.mjs';
export * from '../round-36/r045_round36_kernel.mjs';

export const VERSION='R045.37';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const X0=-220,Z0=-138,DX=10,DZ=6,XMIN=-230,XMAX=135,ZMIN=-150,ZMAX=25;
const ZERO={gain:0,groupIndex:-1,mask35:0,mask36:0};
const seed=(ix,iz)=>SEEDS[`${ix},${iz}`]||ZERO;
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}

// Runtime never invokes R36's expensive fan search. Verified positive R36-vs-R35 stitch signals are
// precomputed once by r045_round37_build_seed_cache.mjs and persisted. A compact same-family kernel then
// turns sparse point joins into short continuous world-space support while keeping stair phase/step fixed.
export function cachedStitchGain(x,z){
  if(x<XMIN||x>XMAX||z<ZMIN||z>ZMAX||!META.generated)return 0;
  const old=R35.terraceStateAt(x,z),cx=Math.round((x-X0)/DX),cz=Math.round((z-Z0)/DZ);
  let n=0,d=0;
  for(let iz=cz-2;iz<=cz+2;iz++)for(let ix=cx-2;ix<=cx+2;ix++){
    const s=seed(ix,iz); if(s.groupIndex!==old.groupIndex||s.gain<=0)continue;
    const sx=X0+ix*DX,sz=Z0+iz*DZ,rx=(x-sx)/18,rz=(z-sz)/12,w=Math.exp(-.5*(rx*rx+rz*rz));
    if(w<.06)continue; n+=w*s.gain; d+=w;
  }
  if(d<=1e-9)return 0;
  const dd=R30.nearestExtendedDrainageDistance(x,z); if(dd<=12)return 0;
  const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);
  if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;
  const safety=Math.min(.45+.55*C((broad-.03)/.24,0,1),.45+.55*C((group-.035)/.30,0,1),.40+.60*C((drain-.035)/.58,0,1),.40+.60*C((river-.035)/.58,0,1));
  return C((n/d)*safety,0,.28);
}
export function terraceStateAt(x,z){
  const old=R35.terraceStateAt(x,z),gain=cachedStitchGain(x,z),mask=C(old.mask+gain,0,1),delta=.84*mask*old.raw;
  return {...old,mask,delta,target:old.base+delta,cachedStitchGain:gain};
}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R35.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R36.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round37:{
 scope:'convert verified but expensive/sparse R36 point stitches into a precomputed same-family control-lattice continuity field so the morphology is browser-renderable and short joins become spatially coherent',
 method:'hold R35 step, phase, raw stair response and 0.84 amplitude fixed. Precompute positive R36-vs-R35 support on a 10m x 6m lattice, persist it, blend only same-family seeds through a compact anisotropic kernel, then reapply broad-slope, family, drainage and foreground-receiver safety. Hard drainage <=12m remains absolute zero.',
 logicCorrection:'R36 numeric success does not imply visual acceptance because its real Chrome audit timed out. A timeout also does not justify raising the timeout: runtime pointwise fan-search cost was an implementation defect, so R37 moves that work to a one-time verified cache and keeps the browser path bounded.',
 constraint:'the lattice and interpolated joins are synthetic QA morphology. The 12.5 m macro DEM and photographs still cannot supply surveyed branch/merge locations, parcel boundaries, bund/channel sections, inlet/outlet sill elevations or event water management.',
 xiaomaBoundary:'Xiaoma/TLO unknowns remain field boundary/location, microtopography, bund section, channel section and water-control elevation. Surface continuity is not ownership or hydraulic connectivity.',
 mrRolordUse:'saved MrRolord research is used only for ordering: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. No Blender dimensions, Voronoi cells or shader displacement are treated as agricultural truth.',
 referenceUse:'image(173).png was reopened for visible nested, unequal-width, contour-following continuity and preserved drainage interruptions only; no metric dimensions or hydraulic state are inferred.',
 evidenceClass:'synthetic renderable terrace-continuity refinement; not surveyed Yunnan terrace geometry or hydraulic truth'
}};
