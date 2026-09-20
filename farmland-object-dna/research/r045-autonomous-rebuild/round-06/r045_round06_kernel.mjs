import * as R5 from '../round-05/r045_round05_kernel.mjs';

export const VERSION='R045.06';
export const WORLD=R5.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));
function D(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return Math.hypot(px-x,pz-z)}
function DP(x,z,p){let d=1e9;for(let i=0;i<p.length-1;i++)d=Math.min(d,D(x,z,p[i],p[i+1]));return d}

export const mainRidge=R5.mainRidge;
export const saddleXs=R5.saddleXs;
export const naturalStreams=R5.naturalStreams;
export const divideLines=R5.divideLines;
export const riverZ=R5.riverZ;
export const riverW=R5.riverW;
export const fanHeads=R5.fanHeads;
export const nodes=R5.nodes;
export const edges=R5.edges;
export const ridgeCrestZ=R5.ridgeCrestZ;
export const secondaryCrests=R5.secondaryCrests;
export const branchSpurs=R5.branchSpurs;
export const headwaterHollows=R5.headwaterHollows;
export const rearCatchmentBays=R5.rearCatchmentBays;
export const middleShoulders=R5.middleShoulders;
export const middleSwales=R5.middleSwales;
export const obliqueShoulders=R5.obliqueShoulders;
export const foothillAprons=R5.foothillAprons;
export const foothillSwales=R5.foothillSwales;

// Round 06 correction 1:
// A visible excess incision is not fixed by globally smoothing or filling every hollow.
// Recover only the residual over-cut on A2 and C2, preserving positive cross-hollow relief.
const extraRecoveryById={'HOLLOW-A2':.62,'HOLLOW-C2':.72};
function headwaterSpecificRecovery(x,z){
  if(z>-198)return 0;
  const rear=S(-304,-280,z)*(1-S(-198,-184,z));
  let r=0;
  for(const h of headwaterHollows){const a=extraRecoveryById[h.id]??0;r+=a*G(DP(x,z,h.p),h.width*1.12)*rear;}
  return r;
}

// Round 06 correction 2:
// Three additive fans can be widened until they touch and still read as three designed cones.
// Use broad catchment-scale facet warps plus a single piedmont continuum instead.
export const basinFacets=[
  {id:'A-FACET',x:-154,z:-103,amp:.42,rx:96,rz:82,skew:-.18},
  {id:'B-FACET',x:-35,z:-112,amp:-.31,rx:82,rz:74,skew:.12},
  {id:'C-FACET',x:126,z:-96,amp:.27,rx:90,rz:78,skew:-.09}
];
function basinFacetDelta(x,z){
  if(z<-180||z>-28)return 0;
  const taper=S(-176,-154,z)*(1-S(-42,-22,z));
  let v=0;
  for(const f of basinFacets){const xx=(x-f.x-f.skew*(z-f.z))/f.rx,zz=(z-f.z)/f.rz;v+=f.amp*Math.exp(-.5*(xx*xx+zz*zz));}
  return v*taper;
}
function lateralMeanR5(x,z){
  const offsets=[-72,-48,-24,0,24,48,72],weights=[.055,.11,.20,.27,.20,.11,.055];
  let s=0,w=0;for(let i=0;i<offsets.length;i++){s+=weights[i]*R5.height(C(x+offsets[i],-228,228),z);w+=weights[i];}
  return s/w;
}
function outletPartitionWarp(x,z){
  const outlets=[[-118,.10,78,.16],[-18,-.035,92,-.10],[112,.07,82,.12]];
  const along=C((z+10)/100,0,1);let wsum=0,asum=0;
  for(const [ox,az,rad,amp] of outlets){const cx=ox+Math.tan(az)*Math.max(0,z+8),w=G(x-cx,rad*(.75+.35*along));wsum+=w;asum+=w*amp;}
  const partition=asum/(wsum||1);
  return partition*Math.exp(-1.35*along)*S(-20,2,z)*(1-S(86,108,z));
}
function piedmontPreDelta(x,z){
  if(z<-34||z>112)return 0;
  const taper=S(-34,-12,z)*(1-S(96,114,z));
  const counter=-.46*R5.fanField(x,z)*taper;
  const lowPass=.34*(lateralMeanR5(x,z)-R5.height(x,z))*taper;
  return counter+lowPass+outletPartitionWarp(x,z);
}
function preHeight(x,z){return R5.height(x,z)+headwaterSpecificRecovery(x,z)+basinFacetDelta(x,z)+piedmontPreDelta(x,z)}

// R03 inherited a hard slope/plain regime switch around z≈20. Fan relief hid the derivative seam.
// Replace that narrow band with a C1-like cubic Hermite bridge tied to the warped foothill line.
const footZ=x=>18+2.4*Math.sin((x+10)*.016)+.8*Math.sin(x*.049);
function hermite(y0,m0,y1,m1,t,L){const t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*y0+(t3-2*t2+t)*m0*L+(-2*t3+3*t2)*y1+(t3-t2)*m1*L}
function foothillSeamRepair(x,z){
  const center=footZ(x)+1.5*Math.sin((x+40)*.007),a=center-16,b=center+22;
  if(z<=a||z>=b)return 0;
  const e=1,y0=preHeight(x,a),y1=preHeight(x,b),m0=(preHeight(x,a+e)-preHeight(x,a-e))/(2*e),m1=(preHeight(x,b+e)-preHeight(x,b-e))/(2*e),t=(z-a)/(b-a);
  return hermite(y0,m0,y1,m1,t,b-a)-preHeight(x,z);
}

export function height(x,z){return preHeight(x,z)+foothillSeamRepair(x,z)}
export function slope(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return Math.hypot(dx,dz)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return R5.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R5.nearestDivideDistance(x,z)}
export function nearestTerrainDrainageDistance(x,z){return R5.nearestTerrainDrainageDistance(x,z)}
export function fanField(x,z){return R5.fanField(x,z)}
export function terracePermission(x,z){
  if(z<-158||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag,slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,nearestTerrainDrainageDistance(x,z)),divideClear=S(5,12,nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05)),curv=1-S(.018,.060,Math.abs(curvature(x,z))),geom=S(-152,-132,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s),src=z<-115?nearestTerrainDrainageDistance(x,z):999,sp=1-S(7,18,src),rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={...R5.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:false,waterStateKnown:false,round06Correction:'bounded A2/C2 recovery + broad basin asymmetry + single piedmont continuum + foothill derivative-seam repair'};
