import * as R12 from '../round-12/r045_round12_kernel.mjs';

export const VERSION='R045.13';
export const WORLD=R12.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// Preserve the entire R045.12 identity graph and morphology inventory. R045.13 addresses one
// failed numeric/visual class only: the inherited broad longitudinal reversal on interfluves near
// z≈-174. A browser pass is not a terrain pass, and 20/21 numeric gates is not acceptance.
export const mainRidge=R12.mainRidge;
export const saddleXs=R12.saddleXs;
export const naturalStreams=R12.naturalStreams;
export const divideLines=R12.divideLines;
export const riverZ=R12.riverZ;
export const riverW=R12.riverW;
export const nodes=R12.nodes;
export const edges=R12.edges;
export const ridgeCrestZ=R12.ridgeCrestZ;
export const secondaryCrests=R12.secondaryCrests;
export const branchSpurs=R12.branchSpurs;
export const headwaterHollows=R12.headwaterHollows;
export const rearCatchmentBays=R12.rearCatchmentBays;
export const middleShoulders=R12.middleShoulders;
export const middleSwales=R12.middleSwales;
export const obliqueShoulders=R12.obliqueShoulders;
export const foothillAprons=R12.foothillAprons;
export const foothillSwales=R12.foothillSwales;
export const terrainChannels=R12.terrainChannels;
export const outletContinuum=R12.outletContinuum;
export const terracePilot=R12.terracePilot;
export const nearestStreamDistance=R12.nearestStreamDistance;
export const nearestDivideDistance=R12.nearestDivideDistance;
export const nearestTerrainDrainageDistance=R12.nearestTerrainDrainageDistance;
export const nearestOutletDistance=R12.nearestOutletDistance;
export const nearestExtendedDrainageDistance=R12.nearestExtendedDrainageDistance;
export const channelMorphDelta=R12.channelMorphDelta;
export const inheritedUpperSlopeContinuityRepairDelta=R12.inheritedUpperSlopeContinuityRepairDelta;
export const interfluveDelta=R12.interfluveDelta;
export const headCatchmentDelta=R12.headCatchmentDelta;
export const outletContinuumDelta=R12.outletContinuumDelta;
export const catchmentMorphDelta=R12.catchmentMorphDelta;
export const fanField=R12.fanField;
export const foothillShift=R12.foothillShift;
export const inheritedBendRepairDelta=R12.inheritedBendRepairDelta;
export const carrierProfile=R12.carrierProfile;

// R045.12 evidence shows a broad interfluve reversal centred near z=-174: 40% of eligible
// cross-slope samples rise >0.55 m per 4 m. The mistake would be to add noise, deepen channels, or
// relax the gate. Instead, construct a monotone longitudinal bridge only on land that is clear of
// the drainage carriers. The bridge uses the inherited surface at two anchors; it does not invent a
// surveyed profile, channel section, discharge, soil strength, terrace dimension or active flow.
export const continuityBand={z0:-190,z1:-146,fade:8,drainageProtect0:14,drainageProtect1:32};
function endpointSlope(x,z,side){
  const e=4;
  return side<0?(R12.height(x,z)-R12.height(x,z-e))/e:(R12.height(x,z+e)-R12.height(x,z))/e;
}
function monotoneSlopes(h0,h1,d0,d1,L){
  const m=(h1-h0)/L;
  if(Math.abs(m)<1e-9)return{m,d0:0,d1:0};
  let a=d0/m,b=d1/m;
  if(a<0)a=0;if(b<0)b=0;
  const q=a*a+b*b;
  if(q>9){const t=3/Math.sqrt(q);a*=t;b*=t;}
  return{m,d0:a*m,d1:b*m};
}
export function continuityTarget(x,z){
  const {z0,z1}=continuityBand,L=z1-z0;
  const h0=R12.height(x,z0),h1=R12.height(x,z1);
  const lim=monotoneSlopes(h0,h1,endpointSlope(x,z0,-1),endpointSlope(x,z1,1),L);
  const t=C((z-z0)/L,0,1),t2=t*t,t3=t2*t;
  const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
  return h00*h0+h10*L*lim.d0+h01*h1+h11*L*lim.d1;
}
export function interfluveContinuityDelta(x,z){
  const {z0,z1,fade,drainageProtect0,drainageProtect1}=continuityBand;
  if(z<=z0||z>=z1)return 0;
  const dr=R12.nearestExtendedDrainageDistance(x,z);
  const clear=S(drainageProtect0,drainageProtect1,dr);
  if(clear<=0)return 0;
  const band=S(z0,z0+fade,z)*(1-S(z1-fade,z1,z));
  const raw=continuityTarget(x,z)-R12.height(x,z);
  return C(raw,-3.4,3.4)*clear*band;
}

export function height(x,z){return R12.height(x,z)+interfluveContinuityDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

// Keep the R045.12 candidate logic, but recompute slope/curvature against the repaired surface.
export function terracePermission(x,z){
  if(z<-158||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-152,-132,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

// R08 terrace pilot remains frozen failure evidence only.
export function terracedPilotHeight(x,z){return R12.terracedPilotHeight(x,z)}
export function pilotInfluence(x,z){return R12.pilotInfluence(x,z)}
export function pilotRiserInfluence(x,z){return R12.pilotRiserInfluence(x,z)}

export const snapshot={
  ...R12.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round13:{
    scope:'repair inherited interfluve longitudinal reversal before any terrace generation',
    continuityBand,
    method:'monotone Hermite bridge blended only >=14..32 m from drainage carriers',
    evidenceClass:'synthetic continuity repair; not surveyed Yunnan terrain',
    forbiddenClaims:['surveyed profile','measured channel section','active flow','regional terrace dimension','soil strength']
  }
};
