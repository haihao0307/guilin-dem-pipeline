import * as R6 from '../round-06/r045_round06_kernel.mjs';

export const VERSION='R045.07';
export const WORLD=R6.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const len=(x,z)=>Math.hypot(x,z)||1;
function D(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return{d:Math.hypot(px-x,pz-z),t,x,z}}
function DP(x,z,p){let q={d:1e9,t:0,seg:0,x:0,z:0};for(let i=0;i<p.length-1;i++){const r=D(x,z,p[i],p[i+1]);if(r.d<q.d)q={...r,seg:i};}return q}
function polyLength(p){let s=0;for(let i=0;i<p.length-1;i++)s+=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]);return s}

export const mainRidge=R6.mainRidge;
export const saddleXs=R6.saddleXs;
export const naturalStreams=R6.naturalStreams;
export const divideLines=R6.divideLines;
export const riverZ=R6.riverZ;
export const riverW=R6.riverW;
export const nodes=R6.nodes;
export const edges=R6.edges;
export const ridgeCrestZ=R6.ridgeCrestZ;
export const secondaryCrests=R6.secondaryCrests;
export const branchSpurs=R6.branchSpurs;
export const headwaterHollows=R6.headwaterHollows;
export const rearCatchmentBays=R6.rearCatchmentBays;
export const middleShoulders=R6.middleShoulders;
export const middleSwales=R6.middleSwales;
export const obliqueShoulders=R6.obliqueShoulders;
export const foothillAprons=R6.foothillAprons;
export const foothillSwales=R6.foothillSwales;

// R07 logic correction 1:
// A long foothill bench is not fixed by adding high-frequency noise. Noise changes texture,
// not the lateral phase of the slope-to-plain transition. Instead, smoothly stagger the
// transition in z across x while damping the warp near inherited drainage carriers.
function foothillWarpEnvelope(z){return S(-34,-10,z)*(1-S(92,116,z))}
function foothillPhase(x){return 6.2*Math.sin((x+24)*.014)+2.4*Math.sin((x-31)*.041)+1.1*Math.sin((x+80)*.0065)}
export function foothillShift(x,z){
  const env=foothillWarpEnvelope(z);
  if(env<=0)return 0;
  const d=R6.nearestTerrainDrainageDistance(x,z);
  const drainageDamp=.30+.70*S(6,19,d);
  const edgeDamp=1-.25*S(170,228,Math.abs(x));
  return foothillPhase(x)*env*drainageDamp*edgeDamp;
}
function macroHeight(x,z){return R6.height(x,z+foothillShift(x,z))}

export function height(x,z){return macroHeight(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return R6.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R6.nearestDivideDistance(x,z)}
export function nearestTerrainDrainageDistance(x,z){return R6.nearestTerrainDrainageDistance(x,z)}
export function fanField(x,z){return R6.fanField(x,z)}

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

// R07 logic correction 2:
// A contour trace is not yet an irrigable rice terrace. This is only a bounded geometry pilot:
// three synthetic near-level bench strips, deliberately kept far from drainage and out of the
// production height field. The numeric interval/width are preview parameters, not Yunnan survey truth.
function seedScore(x,z){
  const p=terracePermission(x,z),d=nearestTerrainDrainageDistance(x,z),dv=nearestDivideDistance(x,z),s=slope(x,z);
  const slopeFit=1-C(Math.abs(s-.145)/.095,0,1);
  const room=S(18,32,d)*S(10,20,dv)*(1-S(175,205,Math.abs(x)));
  return p*(.68+.32*slopeFit)*room;
}
function choosePilotSeed(){
  let best={x:-120,z:-96,score:-1};
  for(let x=-190;x<=185;x+=5)for(let z=-145;z<=-52;z+=5){const score=seedScore(x,z);if(score>best.score)best={x,z,score};}
  return {...best,y:height(best.x,best.z),permission:terracePermission(best.x,best.z),drainageDistance:nearestTerrainDrainageDistance(best.x,best.z),divideDistance:nearestDivideDistance(best.x,best.z),slope:slope(best.x,best.z)};
}
function projectToHeight(x,z,target){
  for(let i=0;i<12;i++){
    const g=gradient(x,z),den=g.dx*g.dx+g.dz*g.dz+1e-8,err=height(x,z)-target;
    if(Math.abs(err)<2e-4)break;
    x-=err*g.dx/den;z-=err*g.dz/den;
  }
  return[x,z];
}
function traceHalf(start,target,dir){
  const pts=[];let [x,z]=start;
  for(let k=0;k<24;k++){
    const g=gradient(x,z),L=len(g.dx,g.dz);let tx=g.dz/L,tz=-g.dx/L;
    if(tx*dir<0){tx=-tx;tz=-tz;}
    x+=tx*4.0;z+=tz*4.0;[x,z]=projectToHeight(x,z,target);
    const p=terracePermission(x,z),dd=nearestTerrainDrainageDistance(x,z);
    if(Math.abs(x)>205||z<-154||z>2||p<.38||dd<13.5)break;
    pts.push([x,z]);
  }
  return pts;
}
function contourAt(seed,target){
  const s=projectToHeight(seed.x,seed.z,target);
  if(Math.abs(s[0])>205||s[1]<-154||s[1]>2)return[];
  const left=traceHalf(s,target,-1).reverse(),right=traceHalf(s,target,1);
  return [...left,s,...right];
}

export const terracePilot=(()=>{
  const seed=choosePilotSeed();
  const verticalInterval=.62; // synthetic pilot parameter; not a local measured standard
  const targets=[seed.y+verticalInterval,seed.y,seed.y-verticalInterval];
  const lines=targets.map((target,i)=>{
    const points=contourAt(seed,target);
    return{id:`PILOT-BENCH-${i+1}`,target,points,length:polyLength(points)};
  });
  return{
    status:'preview-only',
    evidenceClass:'synthetic geometry pilot; dimensions are not Yunnan survey truth',
    seed,
    verticalInterval,
    benchHalfWidth:1.55,
    lines
  };
})();

function pilotNearest(x,z){
  let best={d:1e9,line:null,proj:null};
  for(const line of terracePilot.lines){if(line.points.length<2)continue;const q=DP(x,z,line.points);if(q.d<best.d)best={d:q.d,line,proj:q};}
  return best;
}
export function terracedPilotHeight(x,z){
  const base=height(x,z),q=pilotNearest(x,z);
  if(!q.line)return base;
  const hw=terracePilot.benchHalfWidth;
  if(q.d>=hw||nearestTerrainDrainageDistance(x,z)<12)return base;
  const w=1-S(hw*.68,hw,q.d);
  return M(base,q.line.target,w);
}
export function pilotInfluence(x,z){const q=pilotNearest(x,z);return q.line?C(1-q.d/(terracePilot.benchHalfWidth*1.25),0,1):0}

export const snapshot={
  ...R6.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:true,
  waterStateKnown:false,
  round07Correction:'drainage-damped lateral phase staggering of foothill transition + bounded contour-following terrace bench/riser pilot'
};
