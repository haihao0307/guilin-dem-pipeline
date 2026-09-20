import * as R9 from '../round-09/r045_round09_kernel.mjs';

export const VERSION='R045.10';
export const WORLD=R9.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

export const mainRidge=R9.mainRidge;
export const saddleXs=R9.saddleXs;
export const naturalStreams=R9.naturalStreams;
export const divideLines=R9.divideLines;
export const riverZ=R9.riverZ;
export const riverW=R9.riverW;
export const nodes=R9.nodes;
export const edges=R9.edges;
export const ridgeCrestZ=R9.ridgeCrestZ;
export const secondaryCrests=R9.secondaryCrests;
export const branchSpurs=R9.branchSpurs;
export const headwaterHollows=R9.headwaterHollows;
export const rearCatchmentBays=R9.rearCatchmentBays;
export const middleShoulders=R9.middleShoulders;
export const middleSwales=R9.middleSwales;
export const obliqueShoulders=R9.obliqueShoulders;
export const foothillAprons=R9.foothillAprons;
export const foothillSwales=R9.foothillSwales;
export const terracePilot=R9.terracePilot;

// R045.10 addresses the visual category error exposed by the R045.09 fixed-view audit:
// a drainage centreline is not a valley.  The drainage graph is therefore used as a terrain carrier
// for a bounded floor + shoulder morphology.  This remains synthetic morphology only.  It does not
// assert active flow, discharge, channel material, bank stability, ownership, or surveyed dimensions.
function signedNearestPolyline(x,z,p){
  let best={d:1e9,signed:1e9,seg:0,t:0,x:0,z:0};
  for(let i=0;i<p.length-1;i++){
    const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1;
    const t=C(((x-a[0])*dx+(z-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
    const d=Math.hypot(x-qx,z-qz);
    if(d<best.d){const l=Math.sqrt(l2),signed=(dx*(z-qz)-dz*(x-qx))/l;best={d,signed,seg:i,t,x:qx,z:qz};}
  }
  return best;
}
const idHash=id=>[...id].reduce((s,c)=>s+c.charCodeAt(0),0);

const primaryCarriers=naturalStreams
  .filter(s=>s.o===2 || /^G[123]$/.test(s.id))
  .map((s,i)=>({
    id:`N-${s.id}`,sourceId:s.id,kind:s.o===2?'trunk':'gully',p:s.p,
    floorWidth:s.o===2?6.4:4.8,
    depth:s.o===2?.74:.46,
    shoulderOffset:s.o===2?14.5:11.0,
    shoulderWidth:s.o===2?7.6:6.1,
    shoulderAmp:s.o===2?.24:.16,
    asym:(((idHash(s.id)%9)-4)/4)*.20,
    z0:s.o===2?-205:-178,z1:s.o===2?-58:-48
  }));
const lateralCarriers=middleSwales.map(s=>({
  id:`M-${s.id}`,sourceId:s.id,kind:'tributary',p:s.p,
  floorWidth:Math.max(3.8,s.width*.43),depth:.36+.06*((idHash(s.id)%5)/4),
  shoulderOffset:Math.max(8.5,s.width*.92),shoulderWidth:Math.max(4.8,s.width*.58),shoulderAmp:.14,
  asym:(((idHash(s.id)%7)-3)/3)*.18,z0:-174,z1:-88
}));
export const terrainChannels=[...primaryCarriers,...lateralCarriers];

function carrierEnvelope(c,z){
  const enter=c.kind==='trunk'?18:14,leave=c.kind==='trunk'?16:12;
  return S(c.z0,c.z0+enter,z)*(1-S(c.z1-leave,c.z1,z));
}
function carrierDelta(c,x,z){
  const env=carrierEnvelope(c,z);if(env<=0)return 0;
  const q=signedNearestPolyline(x,z,c.p),sd=q.signed;
  if(q.d>c.shoulderOffset+c.shoulderWidth*3.2)return 0;
  const floor=-c.depth*G(sd,c.floorWidth);
  const left=c.shoulderAmp*(1+c.asym)*G(sd-c.shoulderOffset,c.shoulderWidth);
  const right=c.shoulderAmp*(1-c.asym)*G(sd+c.shoulderOffset,c.shoulderWidth);
  // The weak outer relaxation prevents a pair of narrow positive berms from reading as engineered banks.
  const relax=-.035*c.shoulderAmp*G(Math.abs(sd)-c.shoulderOffset*1.85,c.shoulderWidth*1.55);
  return env*(floor+left+right+relax);
}
export function channelMorphDelta(x,z){
  if(z<=-214||z>=-42)return 0;
  let d=0;for(const c of terrainChannels)d+=carrierDelta(c,x,z);
  return d;
}

export function height(x,z){return R9.height(x,z)+channelMorphDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return R9.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R9.nearestDivideDistance(x,z)}
export function nearestTerrainDrainageDistance(x,z){return R9.nearestTerrainDrainageDistance(x,z)}
export function fanField(x,z){return R9.fanField(x,z)}
export function foothillShift(x,z){return R9.foothillShift(x,z)}
export function inheritedBendRepairDelta(x,z){return R9.inheritedBendRepairDelta(x,z)}

export function terracePermission(x,z){
  if(z<-158||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,nearestTerrainDrainageDistance(x,z));
  const divideClear=S(5,12,nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-152,-132,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<-115?nearestTerrainDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

function segDist(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return{d:Math.hypot(px-x,pz-z),t,x,z}}
function pilotNearest(x,z){let best={d:1e9,line:null};for(const line of terracePilot.lines){for(let i=0;i<line.points.length-1;i++){const q=segDist(x,z,line.points[i],line.points[i+1]);if(q.d<best.d)best={d:q.d,line};}}return best}
export function terracedPilotHeight(x,z){const base=height(x,z),q=pilotNearest(x,z);if(!q.line)return base;const hw=q.line.halfWidth;if(q.d>=hw*1.18||nearestTerrainDrainageDistance(x,z)<12)return base;const core=1-S(hw*.72,hw,q.d),shoulder=(1-S(hw,hw*1.18,q.d))*S(hw*.72,hw,q.d);return M(base,q.line.target,C(core+.38*shoulder,0,1))}
export function pilotInfluence(x,z){const q=pilotNearest(x,z);return q.line?C(1-q.d/(q.line.halfWidth*1.22),0,1):0}
export function pilotRiserInfluence(x,z){const q=pilotNearest(x,z);if(!q.line)return 0;const hw=q.line.halfWidth;return C(S(hw*.70,hw*.94,q.d)*(1-S(hw*.96,hw*1.22,q.d)),0,1)}

export const snapshot={
  ...R9.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  drainageMorphologyClass:'synthetic terrain carrier only; no active-flow or surveyed-channel claim',
  round10Correction:'bounded trunk/gully/tributary floor-and-shoulder morphology so drainage reads from terrain rather than a painted centreline'
};
