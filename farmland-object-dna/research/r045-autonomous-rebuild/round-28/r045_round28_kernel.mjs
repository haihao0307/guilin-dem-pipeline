import * as R27 from '../round-27/r045_round27_kernel.mjs';
export * from '../round-27/r045_round27_kernel.mjs';

export const VERSION='R045.28';
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

// R28 addresses the remaining planform-reading problem at the lower agricultural slope.
// R27 connected the slope to the three receiving bodies, but the whole-scene view still read the
// lower ground as one broad smooth sheet. R28 does NOT solve that by simply increasing vertical
// amplitude. It adds three unequal, carrier-tied scalloped contact lobes: shallow convex tongues
// interleave with broad re-entrant accommodation pockets, changing footprint and nesting while
// drainage axes, the foreground receiver and terrace generation stay protected/locked.
export const contactProfiles=R27.transitionProfiles.map((p,i)=>({
  id:p.id,path:p.path,scaleClass:p.scaleClass,
  zStart:[-6,0,8][i],zEnd:[108,90,74][i],
  width0:[66,46,34][i],width1:[144,100,74][i],
  centre0:[-18,24,-20][i],sweep:[52,-44,31][i],bend:[28,21,-18][i],
  pocket:[.118,.090,.068][i],tongue:[.094,.073,.055][i],notch:[.058,.044,.034][i],
  counter:[.038,.030,.022][i],edgeSign:[1,-1,1][i],phase:[.23,1.11,2.06][i]
}));

function contactEnvelope(p,z){
  if(z<=p.zStart||z>=p.zEnd)return 0;
  const e1=Math.min(p.zStart+22,p.zEnd-18),e2=Math.max(p.zStart+22,p.zEnd-24);
  return S(p.zStart,e1,z)*(1-S(e2,p.zEnd,z));
}

export function contactComponent(p,x,z){
  const env=contactEnvelope(p,z);if(env<=0)return 0;
  const q=nearestPath(p.path,x,z),u=q.u;
  const along=S(.12,.34,u)*(1-S(.86,.985,u));if(along<=0)return 0;
  const d=R27.nearestExtendedDrainageDistance(x,z),drainClear=S(12,50,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R27.riverZ(x));
  const riverClear=S(R27.riverW(x)+14,R27.riverW(x)+42,riverGap);if(riverClear<=0)return 0;
  const zt=C((z-p.zStart)/(p.zEnd-p.zStart),0,1);
  const bulge=1+.20*G(zt-.30,.14)-.13*G(zt-.58,.10)+.16*G(zt-.82,.12);
  const width=M(p.width0,p.width1,S(.06,.94,zt))*bulge;
  const centre=p.centre0+p.sweep*S(.10,.90,zt)+p.bend*Math.sin(Math.PI*(.68*u)+p.phase)+10*Math.sin(Math.PI*(1.35*zt)+p.phase);
  const local=q.signed-centre;
  const pocket=-p.pocket*G(local+p.edgeSign*width*.18,width*.78);
  const tongue=p.tongue*G(local-p.edgeSign*width*.76,width*.36)*(0.72+0.28*G(zt-.48,.22));
  const notch=-p.notch*G(local-p.edgeSign*width*1.18,width*.27)*G(zt-.69,.24);
  const counter=p.counter*G(local+p.edgeSign*width*1.40,width*.35)*G(zt-.38,.30);
  const taper=.90+.10*Math.cos(Math.PI*(1.12*zt)+p.phase);
  return env*along*drainClear*riverClear*taper*(pocket+tongue+notch+counter);
}

export function contactDelta(x,z){
  let d=0;for(const p of contactProfiles)d+=contactComponent(p,x,z);
  return C(d,-.32,.22);
}

export function height(x,z){return R27.height(x,z)+contactDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

// R28 again touches the lowest future terrace-candidate substrate, so permission must follow the
// modified surface. This remains a suitability field only; no bench/riser or parcel geometry exists.
export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R27.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R27.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R27.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R27.riverW(x)+4,R27.riverW(x)+18,Math.abs(z-R27.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R27.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:false,terracePilotPreviewEnabled:false,waterStateKnown:false,
  round28:{
    scope:'make the inherited one-sided agricultural slope -> footslope -> three receiving bodies readable as nested planform massing by adding low-relief scalloped carrier-tied contact lobes; terraces remain locked',
    method:'three unequal contact fields with non-periodic width bulges, lateral sweep, broad re-entrant pocket, off-axis convex tongue and secondary notch; geometry is deterministic world-space morphology and keeps inherited drainage axes and the foreground receiver protected',
    logicCorrection:'R27 being visually subtle does not imply that more vertical amplitude is the missing cause. Amplifying a weak or wrong footprint would only make the wrong landform louder; R28 changes footprint occupancy, nesting and oblique contact geometry before considering terrace benches.',
    permissionCorrection:'R28 alters candidate substrate near the lowest slope, so terrace permission is recomputed from the R28 surface; terrace geometry remains disabled.',
    xiaomaBoundary:'macro surface continuity and a visually plausible slope-foot contact do not establish surveyed field boundaries, bund/channel sections, control elevations, hydraulic connectivity, water depth, discharge, gate state, soil-water state or sediment state; those require common-datum field evidence.',
    mrRolordUse:'the saved video-frame audit is reused only for ordering: river hierarchy -> accumulated terrain influence -> land-use pattern. R28 does not copy Blender Geometry Nodes dimensions, Voronoi parcel style, adaptive subdivision or hydraulic claims.',
    referenceUse:'image(173).png was reopened this round for unequal contour occupation, changing terrace-envelope widths and interleaving concave/convex slope-foot planform only; no terrace width, riser height, channel dimension, water depth or regional metric is inferred.',
    evidenceClass:'synthetic outlet-coupled macro contact morphology for substrate and visual QA; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed footslope footprint','measured terrace width','measured riser height','measured bund section','measured channel section','known control elevation','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
