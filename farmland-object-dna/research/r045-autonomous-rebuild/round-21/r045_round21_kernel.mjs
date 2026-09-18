import * as R20 from '../round-20/r045_round20_kernel.mjs';
export * from '../round-20/r045_round20_kernel.mjs';

export const VERSION='R045.21';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

// R045.21 moves one priority step forward after the R20 upper-slope wall repair: establish one
// dominant agricultural face and a readable foothill transition without drawing terraces.  A common
// shortcut would be to flatten the candidate area or paint terrace stripes; both would hide rather
// than solve the macro landform.  Instead this round adds a low-frequency asymmetric shoulder/bay
// field on the lower slope only.  It is zero in the repaired headwater band, zero at the foreground
// receiver, and fades to zero on every inherited drainage axis.  No water edge, parcel, road or
// actor state is created.
export const agriculturalFaceBand={z0:-136,z1:92,enter0:-136,enter1:-76,leave0:36,leave1:92};

export function agriculturalFaceEnvelope(z){
  if(z<=agriculturalFaceBand.z0||z>=agriculturalFaceBand.z1)return 0;
  return S(agriculturalFaceBand.enter0,agriculturalFaceBand.enter1,z)*(1-S(agriculturalFaceBand.leave0,agriculturalFaceBand.leave1,z));
}

export function agriculturalFaceDelta(x,z){
  const env=agriculturalFaceEnvelope(z);if(env<=0)return 0;
  const d=R20.nearestExtendedDrainageDistance(x,z);
  const drainClear=S(12,54,d);if(drainClear<=0)return 0;
  const divideEase=.82+.18*S(5,22,R20.nearestDivideDistance(x,z));
  const u=C((z-agriculturalFaceBand.enter1)/(agriculturalFaceBand.leave0-agriculturalFaceBand.enter1),0,1);

  // Broad camera-independent massing. The main agricultural face is a shallow concave bay shifted
  // off centre; the opposite interfluve carries a stronger convex shoulder.  Their centres drift
  // slightly downslope so the result is not another pair of parallel ribbons.
  const bayCx=-58+24*u;
  const shoulderCx=112-18*u;
  const counterCx=-172+10*u;
  const bay=-.78*G(x-bayCx,118)*( .92+.08*Math.cos(Math.PI*u) );
  const shoulder=.96*G(x-shoulderCx,72)*( .84+.16*Math.sin(Math.PI*(u+.18)) );
  const counter=.28*G(x-counterCx,58)*(1-.35*u);

  // A very broad downstream toe term makes the one-sided face roll into the inherited plain rather
  // than stop as a geometric patch.  It remains small and exits before the receiver zone.
  const toe=.22*S(-18,54,z)*G(x+22,160);
  return C(env*drainClear*divideEase*(bay+shoulder+counter+toe),-1.05,1.18);
}

export function height(x,z){return R20.height(x,z)+agriculturalFaceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R20.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R20.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  // Candidate permission follows the new ground but remains only a future mask. No terrace geometry
  // is enabled in this round.
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R20.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R20.riverW(x)+4,R20.riverW(x)+18,Math.abs(z-R20.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R20.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round21:{
    scope:'reshape the lower macro slope into one dominant asymmetric agricultural face coupled to the foothill/plain; no terrace geometry, parcels, irrigation, roads or actors',
    method:'broad lower-slope bay plus unequal interfluve shoulders with slow downslope centre drift; exact drainage-axis fade; zero support in R20 wall-repair/headwater band and foreground receiver',
    logicCorrection:'flattening the candidate area or adding terrace stripes would confuse a land-use pattern with a causal landform. R21 changes the macro ground first and keeps agricultural geometry locked',
    xiaomaBoundary:'geometry and water state remain separate; visual continuity or a conserved display does not establish hydraulic connectivity, field microtopography, soil state or discharge',
    mrRolordUse:'reuse only the saved drainage-first hierarchy: topology/carriers before land use; this round does not claim a fresh viewing of the original video',
    referenceUse:'user terrace photographs are used only for the hierarchy of one broad hillside rolling into lower ground and for unequal contour-scale masses; no dimensions are extracted',
    evidenceClass:'synthetic one-sided agricultural-slope/foothill morphology; not surveyed Yunnan field geometry',
    forbiddenClaims:['surveyed agricultural slope','measured terrace bench','measured bund section','active irrigation','field water depth','soil/sediment property','ownership','regional terrace dimensions']
  }
};
