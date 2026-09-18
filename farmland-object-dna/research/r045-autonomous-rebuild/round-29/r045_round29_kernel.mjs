import * as R28 from '../round-28/r045_round28_kernel.mjs';
export * from '../round-28/r045_round28_kernel.mjs';

export const VERSION='R045.29';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-.5*(x/s)*(x/s));

function segFrame(px,pz,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
  const t=C(((px-a[0])*dx+(pz-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
  const rx=px-qx,rz=pz-qz;
  return{d:Math.hypot(rx,rz),signed:(dx*rz-dz*rx)/L,t,L};
}
function nearestPath(path,x,z){
  let best={d:1e9,signed:0,u:0};
  for(let i=0;i<path.p.length-1;i++){
    const q=segFrame(x,z,path.p[i],path.p[i+1]);
    const u=(path.cum[i]+q.L*q.t)/(path.total||1);
    if(q.d<best.d)best={d:q.d,signed:q.signed,u};
  }
  return best;
}

// R29 changes the *position* of the slope-foot break, not merely its relief amplitude.
// The previous contact fields were measurable in plan view but still read as one broad sheet in the
// fixed perspective. Three carrier-tied low-frequency phase-warp fields now migrate the lower-slope
// breakline forward/backward by different amounts and directions. The warp is suppressed on drainage
// axes and around the foreground receiving river. This is still synthetic macro morphology: it does
// not claim surveyed terrace/bund/channel geometry and it does not enable terrace generation.
export const breakProfiles=R28.contactProfiles.map((p,i)=>({
  id:p.id,path:p.path,scaleClass:p.scaleClass,
  zStart:[-20,-12,-4][i],zEnd:[126,108,92][i],
  width0:[92,70,52][i],width1:[178,128,94][i],
  centre0:[-8,18,-14][i],sweep:[46,-36,28][i],bend:[31,-24,19][i],
  shift:[28,-23,17][i],secondary:[-11,9,-7][i],phase:[.18,1.04,2.08][i]
}));

function breakEnvelope(p,z){
  if(z<=p.zStart||z>=p.zEnd)return 0;
  return S(p.zStart,p.zStart+24,z)*(1-S(p.zEnd-30,p.zEnd,z));
}

export function breakShiftComponent(p,x,z){
  const env=breakEnvelope(p,z);if(env<=0)return 0;
  const q=nearestPath(p.path,x,z),u=q.u;
  const along=S(.10,.28,u)*(1-S(.88,.992,u));if(along<=0)return 0;
  const d=R28.nearestExtendedDrainageDistance(x,z),drainClear=S(12,46,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R28.riverZ(x));
  const riverClear=S(R28.riverW(x)+15,R28.riverW(x)+46,riverGap);if(riverClear<=0)return 0;
  const zt=C((z-p.zStart)/(p.zEnd-p.zStart),0,1);
  const width=M(p.width0,p.width1,S(.04,.96,zt))*(1+.16*Math.sin(Math.PI*(1.24*zt)+p.phase));
  const centre=p.centre0+p.sweep*S(.10,.90,zt)+p.bend*Math.sin(Math.PI*(.74*u)+p.phase)+8*Math.sin(Math.PI*(1.42*zt)+p.phase);
  const local=q.signed-centre;
  const primary=p.shift*G(local,width*.72)*(0.68+0.32*G(zt-.53,.27));
  const secondary=p.secondary*G(local-(Math.sign(p.shift)||1)*width*.92,width*.38)*G(zt-.62,.29);
  return env*along*drainClear*riverClear*(primary+secondary);
}

export function breakShift(x,z){
  let s=0;for(const p of breakProfiles)s+=breakShiftComponent(p,x,z);
  return C(s,-30,34);
}

export function breakWarpDelta(x,z){
  const sh=breakShift(x,z);if(Math.abs(sh)<1e-9)return 0;
  // Sample the inherited surface at a displaced downslope coordinate. Multiplying the displacement
  // by 0.72 avoids simply translating all local relief; it migrates the broad break while retaining
  // inherited fine structure. The final vertical correction is bounded independently of shift size.
  const sampled=R28.height(x,z+sh*.72);
  const raw=(sampled-R28.height(x,z))*.62;
  return C(raw,-.78,.78);
}

export function height(x,z){return R28.height(x,z)+breakWarpDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

// Candidate permission must follow the changed substrate, but remains a suitability field only.
export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R28.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R28.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R28.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R28.riverW(x)+4,R28.riverW(x)+18,Math.abs(z-R28.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R28.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:false,terracePilotPreviewEnabled:false,waterStateKnown:false,
  round29:{
    scope:'migrate the one-sided agricultural slope-foot breakline in plan using three unequal carrier-tied phase-warp fields so the slope -> footslope -> receiving bodies relation becomes visible at whole-scene scale; terraces remain locked',
    method:'three unequal low-frequency carrier-tied z-phase displacement fields; displacement changes where the inherited broad slope break occurs, while drainage-axis cores and the foreground receiver are protected and vertical correction is separately bounded',
    logicCorrection:'R28 being subtle in perspective does not imply that relief amplitude is the missing cause. Visibility can fail because the breakline occupies nearly the same plan position; R29 therefore changes breakline position before adding terrace relief.',
    permissionCorrection:'R29 changes the lowest candidate substrate, so terrace permission is recomputed from the R29 surface; no bench, riser, parcel or hydraulic state is generated.',
    xiaomaBoundary:'12.5 m macro DEM continuity and a plausible warped slope-foot do not establish surveyed field boundaries, bund/channel sections, inlet/outlet sill elevations, hydraulic connectivity, centimetric water depth, discharge, gate state, soil-water state or sediment state; common-datum field evidence remains required.',
    mrRolordUse:'the saved video-frame study is reused only for process ordering: river hierarchy -> accumulated terrain influence -> land-use pattern. Blender dimensions, Voronoi parcel appearance and adaptive-subdivision choices are not copied as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. Only its visibly non-parallel contour envelopes, unequal nested terrace masses and changing slope-foot plan positions are used; no terrace width, riser height, channel dimension, water depth or regional metric is inferred.',
    evidenceClass:'synthetic carrier-tied macro breakline migration for substrate and visual QA; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed breakline position','surveyed terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
