import * as R21 from '../round-21/r045_round21_kernel.mjs';
export * from '../round-21/r045_round21_kernel.mjs';

export const VERSION='R045.22';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R045.22 addresses the remaining macro-shape error from R045.21: the lower agricultural face
// gained asymmetry, but several valley/shoulder masses still read as long near-parallel ribbons.
// Merely increasing their amplitude would magnify that artifact. This round therefore changes the
// *plan-form occupancy and direction* of the lower-slope masses with broad rotated 2-D footprints.
// The field is terrain-only. It creates no terrace bench, parcel, irrigation edge, road or actor.
export const directionalFaceBand={z0:-132,z1:96,enter0:-132,enter1:-92,leave0:50,leave1:96};

function ellipseG(x,z,cx,cz,longAxis,crossAxis,deg){
  const a=deg*Math.PI/180,dx=x-cx,dz=z-cz;
  const u=dx*Math.cos(a)+dz*Math.sin(a);
  const v=-dx*Math.sin(a)+dz*Math.cos(a);
  return Math.exp(-.5*((u/longAxis)**2+(v/crossAxis)**2));
}

export function directionalFaceEnvelope(z){
  if(z<=directionalFaceBand.z0||z>=directionalFaceBand.z1)return 0;
  return S(directionalFaceBand.enter0,directionalFaceBand.enter1,z)*(1-S(directionalFaceBand.leave0,directionalFaceBand.leave1,z));
}

export function directionalFaceDelta(x,z){
  const env=directionalFaceEnvelope(z);if(env<=0)return 0;
  const d=R21.nearestExtendedDrainageDistance(x,z);
  // Keep the inherited drainage axes exact. A deliberately wide fade prevents the broad 2-D field
  // from turning the protection boundary into a new longitudinal wall.
  const drainClear=S(12,58,d);if(drainClear<=0)return 0;
  const divideEase=.86+.14*S(5,24,R21.nearestDivideDistance(x,z));

  // These are broad occupancy masses, not contour stripes. Their long axes point in different
  // directions and their centres sit at different downslope positions, so the visible hierarchy is
  // bay -> interfluve shoulder -> counter shoulder rather than three parallel ribbons.
  const obliqueBay=-.62*ellipseG(x,z,-82,-28,165,86,64);
  const crossShoulder=.76*ellipseG(x,z,102,-8,150,58,112);
  const counterShoulder=.26*ellipseG(x,z,-150,28,96,50,36);
  const toeFan=.16*ellipseG(x,z,-10,52,125,75,78);

  return C(env*drainClear*divideEase*(obliqueBay+crossShoulder+counterShoulder+toeFan),-.82,.86);
}

export function height(x,z){return R21.height(x,z)+directionalFaceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R21.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R21.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R21.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R21.riverW(x)+4,R21.riverW(x)+18,Math.abs(z-R21.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R21.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round22:{
    scope:'re-orient the one-sided agricultural face with non-parallel 2-D basin/shoulder occupancy while preserving drainage, foothill and receiver continuity; terraces remain locked',
    method:'four broad rotated elliptical morphology fields with unequal centres, axis ratios and directions; wide exact drainage protection fade; zero support outside the inherited lower-slope band',
    logicCorrection:'increasing the amplitude of R21 long shoulders would magnify the near-parallel-ribbon artifact. R22 changes occupancy and direction before adding any terrace pattern',
    xiaomaBoundary:'a visually continuous terrain and protected drainage geometry still do not establish hydraulic connectivity, water depth, discharge, gate state, soil water or sediment state',
    mrRolordUse:'reuse only the saved drainage-first hierarchy (topology/carriers -> terrain influence -> land use); no fresh original-video viewing is claimed in this round',
    referenceUse:'the retained terrace photograph is used only as a visual hierarchy check for unequal nested masses and contour-following occupation; no bench width, riser height or hydraulic dimension is extracted',
    evidenceClass:'synthetic directional macro-morphology for a one-sided agricultural slope; not surveyed Yunnan field geometry',
    forbiddenClaims:['surveyed basin footprint','measured terrace bench','measured riser or bund section','active irrigation connectivity','field water depth','discharge','soil or sediment property','ownership or cadastral boundary','regional terrace dimensions']
  }
};
