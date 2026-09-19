import * as R4 from '../round-04/r045_round04_kernel.mjs';

export const VERSION='R045.05';
export const WORLD=R4.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));
function D(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return Math.hypot(px-x,pz-z)}
function DP(x,z,p){let d=1e9;for(let i=0;i<p.length-1;i++)d=Math.min(d,D(x,z,p[i],p[i+1]));return d}

export const mainRidge=R4.mainRidge;
export const saddleXs=R4.saddleXs;
export const naturalStreams=R4.naturalStreams;
export const divideLines=R4.divideLines;
export const riverZ=R4.riverZ;
export const riverW=R4.riverW;
export const fanHeads=R4.fanHeads;
export const nodes=R4.nodes;
export const edges=R4.edges;
export const ridgeCrestZ=R4.ridgeCrestZ;
export const secondaryCrests=R4.secondaryCrests;
export const branchSpurs=R4.branchSpurs;
export const headwaterHollows=R4.headwaterHollows;
export const rearCatchmentBays=R4.rearCatchmentBays;
export const middleShoulders=R4.middleShoulders;

// Do not smooth the whole mountain. Recover only the excess cut introduced in R045.04.
// This preserves measurable convergent headwater hollows while removing the slot-groove failure.
const hollowRecoveryById={
  'HOLLOW-A1':0.0,'HOLLOW-A2':1.20,'HOLLOW-B1':0.70,'HOLLOW-B2':0.0,
  'HOLLOW-C1':0.40,'HOLLOW-C2':1.50,'HOLLOW-C3':0.20
};
function headwaterRecovery(x,z){
  if(z>-198)return 0;
  const rear=S(-304,-280,z)*(1-S(-198,-184,z));
  let r=0;
  for(const h of headwaterHollows){
    const a=hollowRecoveryById[h.id]??0;
    r+=a*G(DP(x,z,h.p),h.width*1.02)*rear;
  }
  return r;
}

// Oblique, catchment-tied middle-slope swales. These are terrain carriers, not claims of active flow.
export const middleSwales=[
  {id:'A-L1',catchment:'A',join:'A',p:[[-210,-156],[-190,-139],[-170,-124],[-151,-114],[-132,-107]],depth:1.35,width:10.5},
  {id:'A-R1',catchment:'A',join:'A',p:[[-92,-156],[-101,-140],[-112,-126],[-123,-115],[-132,-107]],depth:.95,width:9.0},
  {id:'B-L1',catchment:'B',join:'B',p:[[-91,-154],[-75,-140],[-60,-126],[-47,-115],[-35,-106]],depth:1.55,width:11.0},
  {id:'B-R1',catchment:'B',join:'B',p:[[15,-151],[2,-137],[-12,-124],[-25,-114],[-35,-106]],depth:1.10,width:9.5},
  {id:'C-L1',catchment:'C',join:'C',p:[[76,-152],[91,-139],[105,-126],[117,-115],[126,-106]],depth:1.25,width:10.0},
  {id:'C-R1',catchment:'C',join:'C',p:[[181,-147],[163,-134],[148,-123],[136,-114],[126,-106]],depth:.88,width:8.8}
];
function middleSwaleCut(x,z){
  if(z<-174||z>-72)return 0;
  const taper=S(-170,-150,z)*(1-S(-82,-68,z));
  let c=0;for(const s of middleSwales)c+=s.depth*G(DP(x,z,s.p),s.width)*taper;
  return c;
}

// Low, oblique interfluve shoulders stop the top view from reading as parallel vertical grooves.
export const obliqueShoulders=[
  {id:'AB-OB1',p:[[-164,-166],[-145,-146],[-124,-132],[-103,-122]],amp:.78,width:18},
  {id:'A-OUT-OB',p:[[-222,-126],[-205,-111],[-186,-98],[-166,-91]],amp:.62,width:16},
  {id:'B-OB1',p:[[-10,-169],[7,-151],[22,-136],[39,-127]],amp:.92,width:19},
  {id:'BC-OB1',p:[[72,-164],[88,-148],[104,-136],[121,-127]],amp:.72,width:17},
  {id:'C-OUT-OB',p:[[205,-126],[190,-112],[174,-101],[157,-93]],amp:.58,width:15}
];
function obliqueShoulderRelief(x,z){
  if(z<-206||z>-74)return 0;
  const taper=S(-202,-184,z)*(1-S(-84,-70,z));
  let r=0;for(const s of obliqueShoulders)r+=s.amp*G(DP(x,z,s.p),s.width)*taper;
  return r;
}

// Foothill transition proxies: broadening depositional ramps tied to the three catchment exits.
// They encode only relative shape (widening + decreasing relief downstream), not measured sediment truth.
export const foothillAprons=[
  {id:'TOE-A',x:-118,z:5,azimuth:.12,amp:1.32,length:72,width0:11,width1:43},
  {id:'TOE-B',x:-18,z:6,azimuth:-.05,amp:1.58,length:82,width0:13,width1:51},
  {id:'TOE-C',x:112,z:5,azimuth:.08,amp:1.18,length:68,width0:10,width1:40}
];
function apronContribution(x,z,f){
  const dz=z-f.z;if(dz<-18||dz>f.length)return 0;
  const along=Math.max(0,dz),t=C(along/f.length,0,1),cx=f.x+Math.tan(f.azimuth)*along;
  const width=M(f.width0,f.width1,S(0,1,t)),lat=Math.abs(x-cx);
  if(lat>width)return 0;
  const cross=Math.pow(1-lat/width,1.8),approach=S(-18,-2,dz);
  // concave-downstream relief: high at fan head, quickly diminishing into the plain
  const profile=f.amp*Math.exp(-2.1*t)*(1-.18*t);
  return approach*profile*cross;
}
function foothillApronRelief(x,z){let r=0;for(const f of foothillAprons)r+=apronContribution(x,z,f);return r;}

export const foothillSwales=[
  {id:'TOE-A1',p:[[-118,18],[-126,31],[-139,46],[-154,59]],depth:.28,width:5.5},
  {id:'TOE-A2',p:[[-118,18],[-108,33],[-97,48],[-86,62]],depth:.23,width:5.0},
  {id:'TOE-B1',p:[[-18,20],[-29,35],[-44,52],[-60,68]],depth:.32,width:6.0},
  {id:'TOE-B2',p:[[-18,20],[-5,36],[10,52],[27,67]],depth:.27,width:5.5},
  {id:'TOE-C1',p:[[112,18],[101,33],[89,48],[76,60]],depth:.25,width:5.2},
  {id:'TOE-C2',p:[[112,18],[124,32],[139,46],[155,58]],depth:.21,width:4.8}
];
function foothillSwaleCut(x,z){
  if(z<12||z>76)return 0;const taper=S(12,24,z)*(1-S(66,78,z));
  let c=0;for(const s of foothillSwales)c+=s.depth*G(DP(x,z,s.p),s.width)*taper;return c;
}

export function correctionDelta(x,z){
  return headwaterRecovery(x,z)+obliqueShoulderRelief(x,z)+foothillApronRelief(x,z)-middleSwaleCut(x,z)-foothillSwaleCut(x,z);
}
export function height(x,z){return R4.height(x,z)+correctionDelta(x,z)}
export function slope(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return Math.hypot(dx,dz)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return R4.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R4.nearestDivideDistance(x,z)}
export function nearestTerrainDrainageDistance(x,z){
  let d=nearestStreamDistance(x,z);
  for(const s of middleSwales)d=Math.min(d,DP(x,z,s.p));
  return d;
}
export function fanField(x,z){return R4.fanField(x,z)+foothillApronRelief(x,z)}
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

export const snapshot={...R4.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:false,waterStateKnown:false,round05Correction:'selective hollow recovery + oblique catchment swales/shoulders + exit-tied foothill spreading'};
