import * as R13 from '../round-13/r045_round13_kernel.mjs';

export const VERSION='R045.14';
export const WORLD=R13.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

// Preserve the entire R045.13 graph and previously verified terrain inventory.  R045.14 makes one
// substantive change only: broad basin-scale shoulder mass is coupled to the three second-order
// trunk carriers.  This is deliberately NOT extra channel incision, noise, a texture trick, a
// surveyed cross-section, or an active-flow claim.  The purpose is to make the interfluves and
// convergence shoulders read as parts of catchments instead of smooth land between parallel slots.
export const mainRidge=R13.mainRidge;
export const saddleXs=R13.saddleXs;
export const naturalStreams=R13.naturalStreams;
export const divideLines=R13.divideLines;
export const riverZ=R13.riverZ;
export const riverW=R13.riverW;
export const nodes=R13.nodes;
export const edges=R13.edges;
export const ridgeCrestZ=R13.ridgeCrestZ;
export const secondaryCrests=R13.secondaryCrests;
export const branchSpurs=R13.branchSpurs;
export const headwaterHollows=R13.headwaterHollows;
export const rearCatchmentBays=R13.rearCatchmentBays;
export const middleShoulders=R13.middleShoulders;
export const middleSwales=R13.middleSwales;
export const obliqueShoulders=R13.obliqueShoulders;
export const foothillAprons=R13.foothillAprons;
export const foothillSwales=R13.foothillSwales;
export const terrainChannels=R13.terrainChannels;
export const outletContinuum=R13.outletContinuum;
export const terracePilot=R13.terracePilot;
export const nearestStreamDistance=R13.nearestStreamDistance;
export const nearestDivideDistance=R13.nearestDivideDistance;
export const nearestTerrainDrainageDistance=R13.nearestTerrainDrainageDistance;
export const nearestOutletDistance=R13.nearestOutletDistance;
export const nearestExtendedDrainageDistance=R13.nearestExtendedDrainageDistance;
export const channelMorphDelta=R13.channelMorphDelta;
export const inheritedUpperSlopeContinuityRepairDelta=R13.inheritedUpperSlopeContinuityRepairDelta;
export const interfluveDelta=R13.interfluveDelta;
export const headCatchmentDelta=R13.headCatchmentDelta;
export const outletContinuumDelta=R13.outletContinuumDelta;
export const catchmentMorphDelta=R13.catchmentMorphDelta;
export const fanField=R13.fanField;
export const foothillShift=R13.foothillShift;
export const inheritedBendRepairDelta=R13.inheritedBendRepairDelta;
export const carrierProfile=R13.carrierProfile;
export const continuityBand=R13.continuityBand;
export const continuityTarget=R13.continuityTarget;
export const interfluveContinuityDelta=R13.interfluveContinuityDelta;

function segFrame(px,pz,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
  const t=C(((px-a[0])*dx+(pz-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
  const rx=px-qx,rz=pz-qz;
  return{d:Math.hypot(rx,rz),signed:(dx*rz-dz*rx)/L,t,L,qx,qz};
}
function prepPath(p){let total=0;const cum=[0];for(let i=0;i<p.length-1;i++){total+=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]);cum.push(total)}return{p,cum,total}}
function nearestPath(path,x,z){
  let best={d:1e9,signed:0,u:0};
  for(let i=0;i<path.p.length-1;i++){
    const q=segFrame(x,z,path.p[i],path.p[i+1]);
    if(q.d<best.d){const u=(path.cum[i]+q.L*q.t)/(path.total||1);best={d:q.d,signed:q.signed,u};}
  }
  return best;
}

const trunkById=id=>naturalStreams.find(s=>s.id===id);
export const basinProfiles=[
  {id:'A',path:prepPath(trunkById('A').p),amp:.46,offset:42,width:25,bias:-.24,phase:.35},
  {id:'B',path:prepPath(trunkById('B').p),amp:.56,offset:47,width:29,bias:.31,phase:1.55},
  {id:'C',path:prepPath(trunkById('C').p),amp:.41,offset:39,width:23,bias:-.38,phase:2.70}
];

// Broad shoulder field.  ALL inherited drainage axes remain untouched, not only the three trunk
// centre lines.  The two shoulders are intentionally unequal and their strength changes slowly
// along the basin.  This adds catchment mass at 20..80 m scale without creating a new painted
// stream, narrow berm, or camera-dependent detail layer.
function basinOne(b,x,z){
  if(z<=-208||z>=-20)return 0;
  const q=nearestPath(b.path,x,z),sd=q.signed,u=q.u;
  if(q.d>92)return 0;
  const drainageClear=S(10,20,R13.nearestExtendedDrainageDistance(x,z));
  const divideClear=.38+.62*S(4,15,R13.nearestDivideDistance(x,z));
  const longitudinal=S(.03,.16,u)*(1-S(.78,.98,u));
  const slow=.86+.14*Math.sin(Math.PI*2*u+b.phase);
  const sourceBoost=1+.18*(1-S(.18,.48,u));
  const leftAmp=b.amp*(1+b.bias),rightAmp=b.amp*(1-b.bias);
  const left=leftAmp*G(sd-b.offset,b.width);
  const right=rightAmp*G(sd+b.offset,b.width*1.08);
  const inner=-.12*b.amp*(G(sd-b.offset*.48,b.width*.62)+G(sd+b.offset*.44,b.width*.68));
  const broad=.11*b.amp*G(sd,b.width*2.55);
  return drainageClear*divideClear*longitudinal*slow*sourceBoost*(left+right+inner+broad);
}
export function basinShoulderDelta(x,z){
  let d=0;for(const b of basinProfiles)d+=basinOne(b,x,z);
  return C(d,-.55,1.20);
}

export function height(x,z){return R13.height(x,z)+basinShoulderDelta(x,z)}
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

export function terracedPilotHeight(x,z){return R13.terracedPilotHeight(x,z)}
export function pilotInfluence(x,z){return R13.pilotInfluence(x,z)}
export function pilotRiserInfluence(x,z){return R13.pilotRiserInfluence(x,z)}

export const snapshot={
  ...R13.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round14:{
    scope:'couple broad asymmetric interfluve shoulders to A/B/C trunk catchments before terrace generation',
    basinProfiles:basinProfiles.map(({id,amp,offset,width,bias,phase})=>({id,amp,offset,width,bias,phase})),
    method:'deterministic basin-scale shoulder field; full inherited drainage network protected; slow longitudinal variation; foothill fade',
    evidenceClass:'synthetic catchment morphology; not surveyed Yunnan terrain',
    forbiddenClaims:['surveyed cross-section','measured soil or sediment','active flow','regional terrace dimension','ownership']
  }
};
