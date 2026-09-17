import * as R10 from '../round-10/r045_round10_kernel.mjs';
import * as R9 from '../round-09/r045_round09_kernel.mjs';

export const VERSION='R045.11';
export const WORLD=R10.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

export const mainRidge=R10.mainRidge;
export const saddleXs=R10.saddleXs;
export const naturalStreams=R10.naturalStreams;
export const divideLines=R10.divideLines;
export const riverZ=R10.riverZ;
export const riverW=R10.riverW;
export const nodes=R10.nodes;
export const edges=R10.edges;
export const ridgeCrestZ=R10.ridgeCrestZ;
export const secondaryCrests=R10.secondaryCrests;
export const branchSpurs=R10.branchSpurs;
export const headwaterHollows=R10.headwaterHollows;
export const rearCatchmentBays=R10.rearCatchmentBays;
export const middleShoulders=R10.middleShoulders;
export const middleSwales=R10.middleSwales;
export const obliqueShoulders=R10.obliqueShoulders;
export const foothillAprons=R10.foothillAprons;
export const foothillSwales=R10.foothillSwales;
export const terracePilot=R10.terracePilot;

// R045.11 corrects the R045.10 "clean continuous slot" failure.
// A drainage carrier is segmented longitudinally into head hollow, convergence,
// transfer valley and outlet fade.  Width/depth therefore change along the carrier.
// The values remain synthetic morphology parameters, not surveyed channel geometry.
const hash=id=>[...id].reduce((s,c)=>((s*33+c.charCodeAt(0))>>>0),5381);
function prepCarrier(c){
  const cum=[0];let total=0;
  for(let i=0;i<c.p.length-1;i++){total+=Math.hypot(c.p[i+1][0]-c.p[i][0],c.p[i+1][1]-c.p[i][1]);cum.push(total)}
  const h=hash(c.id),focus=.34+((h%31)/100),spread=.10+(((h>>4)%8)/100),sign=(h&1)?1:-1;
  return {...c,cum,total,focus,spread,localSign:sign};
}
export const terrainChannels=R10.terrainChannels.map(prepCarrier);

function nearestFrame(c,x,z){
  let best={d:1e9,signed:1e9,seg:0,t:0,u:0,qx:0,qz:0,nx:0,nz:0};
  for(let i=0;i<c.p.length-1;i++){
    const a=c.p[i],b=c.p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
    const t=C(((x-a[0])*dx+(z-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
    const rx=x-qx,rz=z-qz,d=Math.hypot(rx,rz);
    if(d<best.d){const signed=(dx*rz-dz*rx)/L,u=(c.cum[i]+L*t)/(c.total||1);best={d,signed,seg:i,t,u,qx,qz,nx:-dz/L,nz:dx/L};}
  }
  return best;
}

export function carrierProfile(c,u){
  const head=1-S(.07,.26,u),conv=S(.10,.40,u)*(1-S(.70,.90,u)),out=S(.76,.98,u);
  const local=G(u-c.focus,c.spread),after=G(u-(c.focus+.20),c.spread*.85);
  const widthScale=1+.34*head-.08*conv+.13*out+.10*local-.05*after;
  const depthScale=.48+.52*S(.06,.34,u)-.12*out+.08*local-.07*after;
  const shoulderScale=.48+.52*S(.08,.32,u)-.52*out+.08*local;
  const shoulderSpread=1+.16*head+.10*out+.06*c.localSign*local;
  return {
    u,
    floorWidth:c.floorWidth*widthScale,
    depth:c.depth*depthScale,
    shoulderOffset:c.shoulderOffset*shoulderSpread,
    shoulderWidth:c.shoulderWidth*(1+.08*head+.07*out),
    shoulderAmp:c.shoulderAmp*shoulderScale,
    phase:head>.55?'head-hollow':out>.55?'outlet-fade':conv>.35?'convergence':'transfer'
  };
}
function carrierEnvelope(c,z){
  const enter=c.kind==='trunk'?18:14,leave=c.kind==='trunk'?18:13;
  return S(c.z0,c.z0+enter,z)*(1-S(c.z1-leave,c.z1,z));
}
function bankBalance(c,q,p){
  const r=p.shoulderOffset;
  const left=R9.height(q.qx+q.nx*r,q.qz+q.nz*r),right=R9.height(q.qx-q.nx*r,q.qz-q.nz*r);
  return C((left-right)*.040,-.13,.13);
}
function carrierDelta(c,x,z){
  const env=carrierEnvelope(c,z);if(env<=0)return 0;
  const q=nearestFrame(c,x,z),p=carrierProfile(c,q.u),sd=q.signed;
  if(q.d>p.shoulderOffset+p.shoulderWidth*3.2)return 0;
  const floor=-p.depth*G(sd,p.floorWidth);
  // Keep natural side-to-side difference, but damp the extreme single-bank bias seen in R045.10.
  const asym=c.asym*.58;
  const left=p.shoulderAmp*(1+asym)*G(sd-p.shoulderOffset,p.shoulderWidth);
  const right=p.shoulderAmp*(1-asym)*G(sd+p.shoulderOffset,p.shoulderWidth);
  const balance=bankBalance(c,q,p);
  const balanceTerm=-balance*G(sd-p.shoulderOffset,p.shoulderWidth*1.08)+balance*G(sd+p.shoulderOffset,p.shoulderWidth*1.08);
  const relax=-.028*p.shoulderAmp*G(Math.abs(sd)-p.shoulderOffset*1.90,p.shoulderWidth*1.65);
  return env*(floor+left+right+balanceTerm+relax);
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
export function nearestStreamDistance(x,z){return R10.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R10.nearestDivideDistance(x,z)}
export function nearestTerrainDrainageDistance(x,z){return R10.nearestTerrainDrainageDistance(x,z)}
export function fanField(x,z){return R10.fanField(x,z)}
export function foothillShift(x,z){return R10.foothillShift(x,z)}
export function inheritedBendRepairDelta(x,z){return R10.inheritedBendRepairDelta(x,z)}

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
  ...R10.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  drainageMorphologyClass:'synthetic segmented terrain carrier only; no active-flow or surveyed-channel claim',
  round11Correction:'longitudinal head-hollow/convergence/transfer/outlet profiles plus bounded bank-bias damping; no painted stream overlay required'
};
