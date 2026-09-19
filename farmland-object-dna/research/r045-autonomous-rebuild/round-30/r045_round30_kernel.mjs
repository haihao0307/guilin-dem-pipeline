import * as R29 from '../round-29/r045_round29_kernel.mjs';
export * from '../round-29/r045_round29_kernel.mjs';

export const VERSION='R045.30';
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
function smoothPathFrame(path,x,z){
  let minD=1e9,ws=0,ss=0,us=0;
  for(let i=0;i<path.p.length-1;i++){
    const q=segFrame(x,z,path.p[i],path.p[i+1]);
    const u=(path.cum[i]+q.L*q.t)/(path.total||1);
    minD=Math.min(minD,q.d);
    const w=Math.exp(-.5*(q.d/42)*(q.d/42))+1e-7;
    ws+=w;ss+=w*q.signed;us+=w*u;
  }
  return{d:minD,signed:ss/(ws||1),u:us/(ws||1)};
}

// R30 does not add terrace relief. It changes lower-slope ASPECT so the agricultural slope,
// footslope and receiving plain no longer read as one broad coplanar sheet. Each outlet family gets
// a broad anti-symmetric torsion field: one flank is gently raised while the opposite flank is
// lowered. Segment frames are distance-blended so carrier bends cannot create a nearest-segment seam.
export const aspectProfiles=R29.breakProfiles.map((p,i)=>({
  id:p.id,path:p.path,scaleClass:p.scaleClass,
  zStart:[-92,-78,-60][i],zEnd:[94,82,68][i],
  width0:[88,68,52][i],width1:[166,120,88][i],
  centre0:[-18,20,-10][i],sweep:[52,-44,30][i],bend:[24,-19,14][i],
  twist:[.43,-.345,.27][i],counter:[-.115,.098,-.074][i],phase:[.24,1.12,2.18][i]
}));
function aspectEnvelope(p,z){
  if(z<=p.zStart||z>=p.zEnd)return 0;
  return S(p.zStart,p.zStart+24,z)*(1-S(p.zEnd-26,p.zEnd,z));
}
export function aspectComponent(p,x,z){
  const env=aspectEnvelope(p,z);if(env<=0)return 0;
  const q=smoothPathFrame(p.path,x,z),u=q.u;
  const along=S(.08,.25,u)*(1-S(.88,.994,u));if(along<=0)return 0;
  const d=R29.nearestExtendedDrainageDistance(x,z),drainClear=S(14,48,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R29.riverZ(x));
  const riverClear=S(R29.riverW(x)+16,R29.riverW(x)+48,riverGap);if(riverClear<=0)return 0;
  const zt=C((z-p.zStart)/(p.zEnd-p.zStart),0,1);
  const width=M(p.width0,p.width1,S(.05,.95,zt))*(1+.12*Math.sin(Math.PI*(1.18*zt)+p.phase));
  const centre=p.centre0+p.sweep*S(.08,.92,zt)+p.bend*Math.sin(Math.PI*(.72*u)+p.phase)+7*Math.sin(Math.PI*(1.31*zt)+p.phase);
  const r=(q.signed-centre)/(width||1);
  const antisym=1.70*r*G(r,.82);
  const shoulder=G(r-1.34,.42)-G(r+1.10,.50);
  const longitudinal=.80+.20*Math.sin(Math.PI*(1.16*zt)+p.phase);
  return env*along*drainClear*riverClear*longitudinal*(p.twist*antisym+p.counter*shoulder);
}
export function aspectDelta(x,z){
  let d=0;for(const p of aspectProfiles)d+=aspectComponent(p,x,z);
  return C(d,-.85,.85);
}
export function height(x,z){return R29.height(x,z)+aspectDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R29.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R29.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R29.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R29.riverW(x)+4,R29.riverW(x)+18,Math.abs(z-R29.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R29.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:false,terracePilotPreviewEnabled:false,waterStateKnown:false,
  round30:{
    scope:'articulate the one-sided agricultural slope and footslope receiving plain with three unequal carrier-tied cross-slope aspect fields; terraces remain locked',
    method:'broad anti-symmetric torsion around each outlet family rotates local slope aspect and separates catchment-facing masses while preserving inherited drainage-axis cores and the foreground receiver; carrier segment frames are smoothly blended to prevent artificial seams at bends',
    logicCorrection:'R29 being subtle in the whole-scene view does not imply that more vertical amplitude or terrace stripes are the missing cause. A broad sheet can remain visually flat because adjacent lower-slope masses share nearly the same aspect; R30 changes aspect before terrace geometry.',
    failedAttemptCorrection:'R30 preserved two failed machine-evidence iterations rather than weakening gates: the first was 40/42 with a 0.417 m per 4 m longitudinal delta jump and 47.5 degree sampled aspect rotation; smooth segment-frame blending fixed the jump, but the second remained 41/42 because peak rotation was 37.75 degrees against the unchanged <35 degree gate. This revision retains smooth frames and reduces torsion amplitude while keeping the QA thresholds unchanged.',
    permissionCorrection:'R30 changes local gradient and curvature inside the future candidate zone, so terrace permission is recomputed from the R30 surface; no bench, riser, parcel, inlet, outlet or hydraulic state is generated.',
    xiaomaBoundary:'the Xiaoma/TLO checkpoint still has no selected parcel and explicitly lists field microtopography, bund sections, channel sections and water-control elevations as unknown; R30 aspect articulation is synthetic substrate geometry, not survey truth.',
    mrRolordUse:'the saved frame audit is reread for ordering only: river hierarchy -> accumulated terrain influence -> terrain-conforming land use. Its Voronoi experiment, Blender dimensions, shader displacement and adaptive subdivision are not copied as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. Only the visible unequal nested hillside masses, non-parallel contour envelopes and changing local face directions are used; no terrace width, riser height, channel dimension, water depth or regional metric is inferred.',
    evidenceClass:'synthetic carrier-tied macro aspect articulation for substrate and visual QA; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed slope aspect','surveyed breakline position','surveyed terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
