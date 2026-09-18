import * as R36 from '../round-36/r045_round36_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-36/r045_round36_kernel.mjs';

export const VERSION='R045.37';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R37 fixes a real R36 systems failure: the pointwise fan search passed numeric QA but the browser audit
// timed out. Merely extending the timeout would hide an evaluation-complexity defect. R37 therefore samples
// the already-verified R36 contour-stitch response on a deterministic control lattice and interpolates only
// compatible same-family gains. This is also a substantive morphology step: sparse point stitches become a
// short continuous support field without changing the inherited stair frame or vertical amplitude.
const X0=-210,Z0=-128,DX=16,DZ=10,XMIN=-230,XMAX=135,ZMIN=-150,ZMAX=25;
const seedCache=new Map();
function key(ix,iz){return `${ix},${iz}`}
function seed(ix,iz){
  const k=key(ix,iz); if(seedCache.has(k)) return seedCache.get(k);
  const x=X0+ix*DX,z=Z0+iz*DZ;
  if(x<XMIN||x>XMAX||z<ZMIN||z>ZMAX){const q={gain:0,groupIndex:-1,mask35:0,mask36:0};seedCache.set(k,q);return q}
  const a=R35.terraceStateAt(x,z),b=R36.terraceStateAt(x,z);
  const q={gain:Math.max(0,b.mask-a.mask),groupIndex:a.groupIndex,mask35:a.mask,mask36:b.mask};seedCache.set(k,q);return q;
}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
export function cachedStitchGain(x,z){
  if(x<XMIN||x>XMAX||z<ZMIN||z>ZMAX)return 0;
  const old=R35.terraceStateAt(x,z),fx=(x-X0)/DX,fz=(z-Z0)/DZ,ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz;
  const cs=[[ix,iz,(1-tx)*(1-tz)],[ix+1,iz,tx*(1-tz)],[ix,iz+1,(1-tx)*tz],[ix+1,iz+1,tx*tz]];
  let n=0,d=0; for(const [cx,cz,w] of cs){const s=seed(cx,cz);if(s.groupIndex===old.groupIndex&&s.gain>0){n+=w*s.gain;d+=w}}
  if(d<=1e-9)return 0;
  const dd=R30.nearestExtendedDrainageDistance(x,z); if(dd<=12)return 0;
  const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);
  if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;
  const safety=Math.min(.45+.55*C((broad-.03)/.24,0,1),.45+.55*C((group-.035)/.30,0,1),.40+.60*C((drain-.035)/.58,0,1),.40+.60*C((river-.035)/.58,0,1));
  return C((n/d)*.88*safety,0,.24);
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
 scope:'convert verified but expensive/sparse R36 point stitches into a cached same-family control-lattice continuity field so the morphology is renderable and short joins become spatially coherent',
 method:'hold R35 step, phase, raw stair response and 0.84 amplitude fixed. Sample R36-vs-R35 positive support gain on a deterministic 16 m x 10 m lattice, cache every control node, bilinearly interpolate only nodes belonging to the query point inherited terrace family, then reapply broad-slope, family, drainage and foreground-receiver safety. Hard drainage <=12 m remains absolute zero.',
 logicCorrection:'R36 numeric success does not imply visual acceptance, because its real Chrome audit timed out. Conversely, a timeout does not justify merely raising the timeout: pointwise fan search cost was part of the implementation defect. R37 changes both topology representation and evaluation architecture while preserving stair amplitude and hydrology.',
 constraint:'the lattice and interpolated joins are synthetic QA morphology. The 12.5 m macro DEM and photographs still cannot supply surveyed branch/merge locations, parcel boundaries, bund/channel sections, inlet/outlet sill elevations or event water management.',
 xiaomaBoundary:'Xiaoma/TLO unknowns remain field boundary/location, microtopography, bund section, channel section and water-control elevation. Surface continuity is not ownership or hydraulic connectivity.',
 mrRolordUse:'saved MrRolord research is used only for ordering: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. No Blender dimensions, Voronoi cells or shader displacement are treated as agricultural truth.',
 referenceUse:'image(173).png was reopened for visible nested, unequal-width, contour-following continuity and preserved drainage interruptions only; no metric dimensions or hydraulic state are inferred.',
 evidenceClass:'synthetic renderable terrace-continuity refinement; not surveyed Yunnan terrace geometry or hydraulic truth'
}};
