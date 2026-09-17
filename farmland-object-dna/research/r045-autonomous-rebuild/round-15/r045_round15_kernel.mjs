import * as R14 from '../round-14/r045_round14_kernel.mjs';

export const VERSION='R045.15';
export const WORLD=R14.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

// Preserve the complete R045.14 hydrology/terrain identity.  R045.15 changes one macro relation:
// the three inherited trunk outlets are given broad, asymmetric toe-apron morphology across the
// foothill-to-plain transition.  This is NOT a new drainage graph, active flow, a surveyed fan,
// a terrace, or a texture trick.  The intent is to remove the visual category error in which
// "slope", "foothill", and "plain" read as adjacent layers rather than one continuous landform.
export const mainRidge=R14.mainRidge;
export const saddleXs=R14.saddleXs;
export const naturalStreams=R14.naturalStreams;
export const divideLines=R14.divideLines;
export const riverZ=R14.riverZ;
export const riverW=R14.riverW;
export const nodes=R14.nodes;
export const edges=R14.edges;
export const ridgeCrestZ=R14.ridgeCrestZ;
export const secondaryCrests=R14.secondaryCrests;
export const branchSpurs=R14.branchSpurs;
export const headwaterHollows=R14.headwaterHollows;
export const rearCatchmentBays=R14.rearCatchmentBays;
export const middleShoulders=R14.middleShoulders;
export const middleSwales=R14.middleSwales;
export const obliqueShoulders=R14.obliqueShoulders;
export const foothillAprons=R14.foothillAprons;
export const foothillSwales=R14.foothillSwales;
export const terrainChannels=R14.terrainChannels;
export const outletContinuum=R14.outletContinuum;
export const terracePilot=R14.terracePilot;
export const nearestStreamDistance=R14.nearestStreamDistance;
export const nearestDivideDistance=R14.nearestDivideDistance;
export const nearestTerrainDrainageDistance=R14.nearestTerrainDrainageDistance;
export const nearestOutletDistance=R14.nearestOutletDistance;
export const nearestExtendedDrainageDistance=R14.nearestExtendedDrainageDistance;
export const channelMorphDelta=R14.channelMorphDelta;
export const inheritedUpperSlopeContinuityRepairDelta=R14.inheritedUpperSlopeContinuityRepairDelta;
export const interfluveDelta=R14.interfluveDelta;
export const headCatchmentDelta=R14.headCatchmentDelta;
export const outletContinuumDelta=R14.outletContinuumDelta;
export const catchmentMorphDelta=R14.catchmentMorphDelta;
export const fanField=R14.fanField;
export const foothillShift=R14.foothillShift;
export const inheritedBendRepairDelta=R14.inheritedBendRepairDelta;
export const carrierProfile=R14.carrierProfile;
export const continuityBand=R14.continuityBand;
export const continuityTarget=R14.continuityTarget;
export const interfluveContinuityDelta=R14.interfluveContinuityDelta;
export const basinProfiles=R14.basinProfiles;
export const basinShoulderDelta=R14.basinShoulderDelta;

function segFrame(px,pz,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
  const t=C(((px-a[0])*dx+(pz-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
  const rx=px-qx,rz=pz-qz;
  return{d:Math.hypot(rx,rz),signed:(dx*rz-dz*rx)/L,t,L,qx,qz};
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

// The reference landscape shows a continuous agricultural hillside rolling into broader lower
// ground; it does not justify metric dimensions.  These per-outlet values are therefore synthetic
// generation parameters.  Width expands downslope, incision decays, and left/right toe mass differs
// by source identity so three outlets cannot collapse into clone-shaped fans.
export const foothillPlainProfiles=outletContinuum.map((o,i)=>({
  id:o.id,
  path:o.path,
  width0:[18,21,19][i]??19,
  width1:[42,49,45][i]??45,
  depth0:[.115,.135,.105][i]??.115,
  depth1:[.030,.038,.026][i]??.03,
  bias:[-.30,.24,-.18][i]??0,
  lobe:[.070,.082,.064][i]??.07,
  phase:[.18,1.36,2.42][i]??0
}));

export function foothillPlainComponent(p,x,z){
  // Deliberately starts after the upper agricultural-slope repair and fades before the receiver.
  // No hard cutoff is allowed inside the visible transition: both ends are smooth envelopes.
  if(z<=-76||z>=132)return 0;
  const q=nearestPath(p.path,x,z),u=q.u;
  const enter=S(-76,-58,z),leave=1-S(112,132,z),env=enter*leave;
  if(env<=0)return 0;
  const spread=S(.06,.88,u),width=M(p.width0,p.width1,spread);
  if(q.d>width*2.9)return 0;
  const depth=M(p.depth0,p.depth1,S(.10,.94,u));
  // Broad shallow receiver swale; the inherited R12 outlet slot remains the hydrologic centre.
  const floor=-depth*G(q.signed,width*.78);
  // Unequal toe shoulders/lobes make the foothill transition spatially readable without creating
  // three isolated radial fans. Their offsets expand with the same carrier and fade downstream.
  const side=1+p.bias,opp=1-p.bias;
  const lobeFade=1-.58*S(.56,.96,u);
  const left=p.lobe*side*lobeFade*G(q.signed-width*.98,width*.62);
  const right=p.lobe*opp*lobeFade*G(q.signed+width*1.10,width*.68);
  // A very low broad term couples the two shoulders to the plain. Slow longitudinal modulation is
  // deterministic and deliberately weak; it is morphology, not free noise or camera-dependent LOD.
  const broad=.026*(.78+.22*Math.sin(Math.PI*2*u+p.phase))*G(q.signed,width*1.85)*(1-S(.74,.98,u));
  return env*(floor+left+right+broad);
}

export function foothillPlainDelta(x,z){
  let d=0;
  for(const p of foothillPlainProfiles)d+=foothillPlainComponent(p,x,z);
  return C(d,-.30,.30);
}

export function height(x,z){return R14.height(x,z)+foothillPlainDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

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

export function terracedPilotHeight(x,z){return R14.terracedPilotHeight(x,z)}
export function pilotInfluence(x,z){return R14.pilotInfluence(x,z)}
export function pilotRiserInfluence(x,z){return R14.pilotRiserInfluence(x,z)}

export const snapshot={
  ...R14.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round15:{
    scope:'couple the three inherited trunk outlets into a continuous asymmetric foothill-to-plain transition',
    method:'broad expanding toe-apron fields tied only to inherited outlet carriers; smooth entry/receiver fade; no new water graph',
    referenceUse:'user terrace landscape is a visual hierarchy target only, not dimensional truth',
    evidenceClass:'synthetic foothill/plain morphology; not surveyed Yunnan terrain',
    forbiddenClaims:['surveyed fan geometry','measured channel section','active flow','regional terrace dimension','soil/sediment property','ownership']
  }
};
