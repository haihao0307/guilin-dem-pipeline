import * as R26 from '../round-26/r045_round26_kernel.mjs';
export * from '../round-26/r045_round26_kernel.mjs';

export const VERSION='R045.27';
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

// R27 fixes a planform-connectivity problem, not an amplitude problem. R26 proved three receiving
// bodies exist below the footslope, but the whole-scene view still reads the agricultural slope and
// lower receiving hierarchy as weakly related sheets. R27 therefore adds three broad, shallow,
// carrier-tied transition necks that overlap both the lower agricultural slope and the R26 hierarchy.
// They are morphology only: no terrace bench, parcel, canal, road or actor is created here.
export const transitionProfiles=R26.receivingHierarchy.map((p,i)=>({
  id:p.id,
  path:p.path,
  scaleClass:p.scaleClass,
  zStart:[-30,-22,-14][i],
  zEnd:[82,74,64][i],
  width0:[44,36,28][i],
  width1:[126,94,68][i],
  centre0:[-10,18,-14][i],
  sweep:[44,-35,27][i],
  bend:[24,19,-16][i],
  hollow:[.082,.064,.049][i],
  shoulder:[.048,.039,.031][i],
  nested:[.031,.025,.019][i],
  edgeSign:[1,-1,1][i],
  phase:[.31,1.27,2.12][i]
}));

function transitionEnvelope(p,z){
  if(z<=p.zStart||z>=p.zEnd)return 0;
  const enter1=Math.min(p.zStart+22,p.zEnd-16),leave0=Math.max(p.zStart+22,p.zEnd-22);
  return S(p.zStart,enter1,z)*(1-S(leave0,p.zEnd,z));
}

export function transitionComponent(p,x,z){
  const env=transitionEnvelope(p,z);if(env<=0)return 0;
  const q=nearestPath(p.path,x,z),u=q.u;
  const along=S(.10,.36,u)*(1-S(.84,.98,u));if(along<=0)return 0;
  const d=R26.nearestExtendedDrainageDistance(x,z),drainClear=S(12,52,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R26.riverZ(x));
  const riverClear=S(R26.riverW(x)+12,R26.riverW(x)+38,riverGap);if(riverClear<=0)return 0;
  const zt=C((z-p.zStart)/(p.zEnd-p.zStart),0,1);
  const width=M(p.width0,p.width1,S(.08,.92,zt));
  const centre=p.centre0+p.sweep*S(.12,.88,zt)+p.bend*Math.sin(Math.PI*(.76*u)+p.phase);
  const local=q.signed-centre;
  // Broad negative accommodation surface plus off-axis convex shoulder. Their unequal centres and
  // widths make a transition mass, not a symmetric trench or horizontal terrace stripe.
  const hollow=-p.hollow*G(local,width);
  const nested=-p.nested*G(local+p.edgeSign*width*.48,width*.34)*S(.28,.78,zt);
  const shoulder=p.shoulder*G(local-p.edgeSign*width*1.55,width*.44);
  const counter=.34*p.shoulder*G(local+p.edgeSign*width*1.82,width*.54);
  const taper=.90+.10*Math.sin(Math.PI*1.18*zt+p.phase);
  return env*along*drainClear*riverClear*taper*(hollow+nested+shoulder+counter);
}

export function transitionDelta(x,z){
  let d=0;for(const p of transitionProfiles)d+=transitionComponent(p,x,z);
  return C(d,-.30,.20);
}

export function height(x,z){return R26.height(x,z)+transitionDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

// Unlike R24-R26, R27 touches the lowest part of the future terrace-candidate zone. Reusing the old
// permission mask would therefore be logically stale. Recompute the same suitability-style permission
// from the R27 surface while keeping terrace geometry itself locked.
export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R26.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R26.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R26.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R26.riverW(x)+4,R26.riverW(x)+18,Math.abs(z-R26.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R26.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:false,terracePilotPreviewEnabled:false,waterStateKnown:false,
  round27:{
    scope:'connect the inherited one-sided agricultural slope into the R26 major/subordinate/local receiving hierarchy with broad shallow outlet-coupled transition necks; terraces remain locked',
    method:'three unequal carrier-coordinate transition fields overlapping the low agricultural slope and the upper edge of the receiving plain, with smooth longitudinal support, widening planform, lateral sweep, nested recess and outer shoulder; drainage axes and foreground receiver remain protected',
    logicCorrection:'R26 hierarchy being numerically real but visually weak does not justify simply increasing vertical amplitude or drawing terraces. Visibility is not causality; R27 changes the missing slope-to-receiver planform connection first.',
    permissionCorrection:'because R27 modifies the lowest part of the future terrace-candidate zone, inheriting the old terrace-permission mask would be stale. Permission is recomputed from the R27 surface while terrace geometry remains disabled.',
    xiaomaBoundary:'a continuous or visually connected ground surface does not establish hydraulic connectivity, water depth, discharge, gate state, soil-water state or sediment state; those require common-datum microtopography, control elevations, interface identity and time-resolved evidence.',
    mrRolordUse:'the previously saved drainage-first study is reused only for ordering: inherited river hierarchy/carriers -> accumulated terrain influence -> later land use. No Blender dimension, Voronoi parcel style or hydraulic truth is imported.',
    referenceUse:'image(173).png was reopened this round for unequal nested contour occupation, changing widths and curved slope-to-lower-field transitions only; no terrace width, riser height, channel size, water depth or regional metric is inferred.',
    evidenceClass:'synthetic outlet-coupled macro transition morphology for substrate and visual QA; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed transition footprint','measured terrace width','measured riser height','measured bund section','measured channel section','known control elevation','known hydraulic connectivity','known water depth','known discharge','known soil-water state','known sediment state','regional truth from photograph']
  }
};
