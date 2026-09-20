import * as R3 from '../round-03/r045_round03_kernel.mjs';

export const VERSION='R045.04';
export const WORLD=R3.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));
function D(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return Math.hypot(px-x,pz-z)}
function DP(x,z,p){let d=1e9;for(let i=0;i<p.length-1;i++)d=Math.min(d,D(x,z,p[i],p[i+1]));return d}

export const mainRidge=R3.mainRidge;
export const saddleXs=R3.saddleXs;
export const naturalStreams=R3.naturalStreams;
export const divideLines=R3.divideLines;
export const riverZ=R3.riverZ;
export const riverW=R3.riverW;
export const fanHeads=R3.fanHeads;
export const nodes=R3.nodes;
export const edges=R3.edges;
export const ridgeCrestZ=R3.ridgeCrestZ;

// Round 04 correction: more hierarchy is not automatically more natural.
// These carriers are unequal, tied to drainage/divide structure, and terminate at different depths.
export const secondaryCrests=[
  {id:'A-WEST',p:[[-226,-289],[-213,-277],[-198,-263],[-183,-248],[-170,-232]],amp:8.4,width:22},
  {id:'A-INNER',p:[[-132,-296],[-127,-278],[-121,-260],[-114,-239],[-108,-216],[-102,-194]],amp:6.2,width:18},
  {id:'B-WEST',p:[[-86,-306],[-78,-286],[-71,-266],[-64,-244],[-59,-220],[-55,-198]],amp:9.7,width:21},
  {id:'B-EAST',p:[[6,-309],[-5,-291],[-17,-273],[-29,-252]],amp:5.6,width:17},
  {id:'C-INNER',p:[[104,-300],[111,-282],[118,-263],[125,-243],[132,-226],[136,-205]],amp:8.8,width:20},
  {id:'C-EAST',p:[[204,-289],[193,-276],[181,-261],[166,-246]],amp:6.6,width:19}
];

export const branchSpurs=[
  {id:'A-W1',p:[[-184,-249],[-177,-221],[-169,-191],[-160,-158]],amp:2.4,width:17},
  {id:'A-I1',p:[[-111,-238],[-106,-210],[-101,-179],[-95,-145],[-89,-111],[-85,-78]],amp:3.15,width:16},
  {id:'B-W1',p:[[-63,-246],[-58,-216],[-53,-182],[-48,-146],[-43,-109],[-40,-70]],amp:3.55,width:17},
  {id:'B-E1',p:[[-26,-250],[-18,-224],[-8,-194],[3,-160]],amp:2.05,width:15},
  {id:'C-I1',p:[[126,-245],[123,-216],[121,-184],[119,-149],[116,-111],[114,-74]],amp:3.05,width:17},
  {id:'C-E1',p:[[170,-247],[168,-218],[165,-185],[160,-151]],amp:2.35,width:16}
];

const headStreams=naturalStreams.filter(s=>s.o===1 && /^[ABC]\d$/.test(s.id));
export const headwaterHollows=headStreams.map((s,i)=>({
  id:`HOLLOW-${s.id}`,
  streamId:s.id,
  p:s.p.slice(0,Math.min(5,s.p.length)),
  depth:[8.5,3.5,8.5,4.2,10.5,4.5,8.0][i]??4.5,
  width:[18,15,18,17,17,18,16][i]??17
}));

export const rearCatchmentBays=[
  {id:'BAY-A',x:-158,z:-235,depth:7.1,rx:52,rz:46},
  {id:'BAY-B',x:-49,z:-244,depth:8.6,rx:48,rz:50},
  {id:'BAY-C',x:132,z:-239,depth:6.8,rx:55,rz:47}
];

function secondaryCrestRelief(x,z){
  const rear=S(-312,-276,z)*(1-S(-205,-177,z));
  let r=0;for(const c of secondaryCrests)r+=c.amp*G(DP(x,z,c.p),c.width)*rear;return r;
}
function branchSpurRelief(x,z){
  const t=S(-270,-236,z)*(1-S(-96,-70,z));
  let r=0;for(const s of branchSpurs)r+=s.amp*G(DP(x,z,s.p),s.width)*t;return r;
}
function headwaterHollowCut(x,z){
  if(z>-200)return 0;const rear=S(-304,-280,z)*(1-S(-198,-184,z));
  let cut=0;for(const h of headwaterHollows)cut+=h.depth*G(DP(x,z,h.p),h.width)*rear;return cut;
}
function rearBayCut(x,z){
  if(z>-170)return 0;let cut=0;
  for(const b of rearCatchmentBays){const q=Math.sqrt(((x-b.x)/b.rx)**2+((z-b.z)/b.rz)**2);cut+=b.depth*Math.exp(-.5*q*q);}
  return cut*S(-304,-270,z)*(1-S(-180,-160,z));
}

export const middleShoulders=[
  {id:'A-S1',p:[[-193,-171],[-184,-145],[-173,-116],[-160,-87]],amp:1.20,width:24},
  {id:'A-S2',p:[[-109,-164],[-102,-138],[-95,-108],[-87,-78]],amp:.74,width:20},
  {id:'B-S1',p:[[-55,-176],[-50,-148],[-44,-116],[-37,-82]],amp:1.46,width:26},
  {id:'B-S2',p:[[10,-153],[18,-127],[29,-98],[40,-69]],amp:.66,width:18},
  {id:'C-S1',p:[[91,-170],[98,-143],[104,-112],[110,-78]],amp:1.05,width:23},
  {id:'C-S2',p:[[174,-157],[166,-131],[157,-101],[147,-70]],amp:.82,width:19}
];
function middleShoulderRelief(x,z){
  if(z<-188||z>5)return 0;const taper=S(-184,-158,z)*(1-S(-20,8,z));
  let r=0;for(const s of middleShoulders)r+=s.amp*G(DP(x,z,s.p),s.width)*taper;return r;
}

function curtainReduction(x,z){
  if(z<-305||z>-172)return 0;
  const dMain=DP(x,z,mainRidge),broad=G(dMain,70)*S(-300,-270,z)*(1-S(-185,-166,z));
  let support=0;for(const c of secondaryCrests)support=Math.max(support,G(DP(x,z,c.p),c.width*1.45));
  const unsupported=1-C(support,0,1),lateral=.72+.28*Math.sin((x+35)*.027)**2;
  return 8.8*broad*(.20+.80*unsupported)*lateral;
}

export function hierarchyDelta(x,z){
  return secondaryCrestRelief(x,z)+branchSpurRelief(x,z)+middleShoulderRelief(x,z)-headwaterHollowCut(x,z)-rearBayCut(x,z)-curtainReduction(x,z);
}
export function height(x,z){return R3.height(x,z)+hierarchyDelta(x,z)}
export function slope(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return Math.hypot(dx,dz)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return R3.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R3.nearestDivideDistance(x,z)}
export function fanField(x,z){return R3.fanField(x,z)}
export function terracePermission(x,z){
  if(z<-158||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s)),streamClear=S(7,16,nearestStreamDistance(x,z)),divideClear=S(5,12,nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05)),curv=1-S(.018,.060,Math.abs(curvature(x,z))),geom=S(-152,-132,z)*(1-S(0,12,z));
  return C(slopeBand*streamClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s),src=z<-115?nearestStreamDistance(x,z):999,sp=1-S(7,18,src),rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={...R3.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:false,waterStateKnown:false,mountainHierarchy:'main crest -> unequal secondary crests -> branching spurs -> headwater hollows -> middle shoulders'};
