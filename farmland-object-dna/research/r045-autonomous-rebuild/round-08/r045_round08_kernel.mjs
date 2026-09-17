import * as R6 from '../round-06/r045_round06_kernel.mjs';

export const VERSION='R045.08';
export const WORLD=R6.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const Q=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*t*(t*(t*6-15)+10)};
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

// Round 08 correction 1:
// Coordinate-warping a pre-existing high-curvature bend is not a neutral phase operation: even a
// small z shift can magnify the inherited kink. Earlier R08 attempts proved that numerically. The
// warp is now exactly zero across the inherited lower-slope bend (not merely 98.5% attenuated),
// with broad quintic shoulders. That preserves the useful lower-foothill lateral de-synchronizing
// experiment while leaving the inherited bend for a later direct reconstruction rather than
// disguising it inside another deformation.
function foothillWarpEnvelope(z){return Q(-36,-10,z)*(1-Q(44,116,z))}
function inheritedBendNotch(z){const band=Q(50,72,z)*(1-Q(104,126,z));return 1-band}
function foothillPhase(x){return 3.30*Math.sin((x+24)*.014)+1.15*Math.sin((x-31)*.041)+.52*Math.sin((x+80)*.0065)}
export function foothillShift(x,z){
  const env=foothillWarpEnvelope(z)*inheritedBendNotch(z);
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

// Round 08 correction 2:
// A valid centre point is not enough: the prior pilot chose a point only 16.6 m from drainage,
// then its contour traces immediately ran out of legal room. Seed selection now tests a short
// contour-direction corridor on both sides before accepting a site. This is a geometric test only;
// it does not imply field ownership, irrigation rights or surveyed terrace dimensions.
function seedScore(x,z){
  const p=terracePermission(x,z),d=nearestTerrainDrainageDistance(x,z),dv=nearestDivideDistance(x,z),g=gradient(x,z),s=g.mag;
  if(p<.55||d<22||dv<9||s<.09||s>.24)return -Infinity;
  const L=Math.hypot(g.dx,g.dz)||1,tx=g.dz/L,tz=-g.dx/L;
  let corridor=1;
  for(const q of [-24,-16,-8,8,16,24]){
    const xx=x+tx*q,zz=z+tz*q,dd=nearestTerrainDrainageDistance(xx,zz),pp=terracePermission(xx,zz);
    if(Math.abs(xx)>202||zz<-154||zz>2||dd<13.5||pp<.24){corridor=0;break;}
  }
  if(!corridor)return -Infinity;
  const slopeFit=1-C(Math.abs(s-.16)/.08,0,1);
  const room=(.35+.65*S(22,44,d))*(.45+.55*S(9,26,dv))*(1-.35*S(165,205,Math.abs(x)));
  return p*(.48+.52*slopeFit)*room;
}
function choosePilotSeed(){
  let best=null;
  for(let x=-190;x<=185;x+=5)for(let z=-145;z<=-52;z+=5){const score=seedScore(x,z);if(Number.isFinite(score)&&(!best||score>best.score))best={x,z,score};}
  if(!best)return{x:0,z:-90,score:-Infinity,valid:false,y:height(0,-90),permission:0,drainageDistance:0,divideDistance:0,slope:slope(0,-90)};
  return {...best,valid:true,y:height(best.x,best.z),permission:terracePermission(best.x,best.z),drainageDistance:nearestTerrainDrainageDistance(best.x,best.z),divideDistance:nearestDivideDistance(best.x,best.z),slope:slope(best.x,best.z)};
}
function projectToHeight(x,z,target){
  let error=height(x,z)-target;
  for(let i=0;i<42;i++){
    if(Math.abs(error)<1e-4)return{x,z,ok:true,error};
    const g=gradient(x,z),L=Math.hypot(g.dx,g.dz);
    if(L<1e-6)break;
    const move=C(error/L,-2.2,2.2);
    x-=move*g.dx/L;z-=move*g.dz/L;
    error=height(x,z)-target;
  }
  return{x,z,ok:Math.abs(error)<.003,error};
}
function traceHalf(start,target,dir,maxSteps){
  const pts=[];let x=start.x,z=start.z;
  for(let k=0;k<maxSteps;k++){
    const g=gradient(x,z),L=len(g.dx,g.dz);let tx=g.dz/L,tz=-g.dx/L;
    if(tx*dir<0){tx=-tx;tz=-tz;}
    x+=tx*3.6;z+=tz*3.6;
    const pr=projectToHeight(x,z,target);if(!pr.ok)break;x=pr.x;z=pr.z;
    const p=terracePermission(x,z),dd=nearestTerrainDrainageDistance(x,z);
    if(Math.abs(x)>205||z<-154||z>2||p<.22||dd<13.5)break;
    pts.push([x,z]);
  }
  return pts;
}
function contourAt(seed,target,leftSteps,rightSteps){
  if(!seed.valid)return[];
  const s=projectToHeight(seed.x,seed.z,target);
  if(!s.ok||Math.abs(s.x)>205||s.z<-154||s.z>2||nearestTerrainDrainageDistance(s.x,s.z)<13.5)return[];
  const left=traceHalf(s,target,-1,leftSteps).reverse(),right=traceHalf(s,target,1,rightSteps);
  return [...left,[s.x,s.z],...right];
}

export const terracePilot=(()=>{
  const seed=choosePilotSeed();
  const specs=[
    {id:'PILOT-BENCH-A',offset:.70,halfWidth:1.70,left:13,right:17,trimStart:0,trimEnd:0},
    {id:'PILOT-BENCH-B',offset:-.90,halfWidth:2.70,left:18,right:15,trimStart:2,trimEnd:0},
    {id:'PILOT-BENCH-C',offset:-2.60,halfWidth:2.00,left:15,right:19,trimStart:0,trimEnd:3},
    {id:'PILOT-BENCH-D',offset:-4.60,halfWidth:2.90,left:20,right:16,trimStart:1,trimEnd:0}
  ];
  const lines=specs.map(spec=>{
    const target=seed.y+spec.offset,raw=contourAt(seed,target,spec.left,spec.right);
    const end=Math.max(spec.trimStart+1,raw.length-spec.trimEnd);
    const points=raw.length?raw.slice(spec.trimStart,end):[];
    return{...spec,target,points,length:polyLength(points),fullWidth:spec.halfWidth*2};
  });
  return{
    status:seed.valid?'preview-only':'blocked-no-qualified-seed',
    evidenceClass:'synthetic morphology pilot; dimensions are not Yunnan survey truth',
    seed,
    lines,
    verticalOffsets:specs.map(s=>s.offset),
    widthRange:[Math.min(...specs.map(s=>s.halfWidth*2)),Math.max(...specs.map(s=>s.halfWidth*2))]
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
  const hw=q.line.halfWidth;
  if(q.d>=hw*1.18||nearestTerrainDrainageDistance(x,z)<12)return base;
  const core=1-S(hw*.72,hw,q.d);
  const shoulder=(1-S(hw,hw*1.18,q.d))*S(hw*.72,hw,q.d);
  return M(base,q.line.target,C(core+.38*shoulder,0,1));
}
export function pilotInfluence(x,z){const q=pilotNearest(x,z);return q.line?C(1-q.d/(q.line.halfWidth*1.22),0,1):0}
export function pilotRiserInfluence(x,z){const q=pilotNearest(x,z);if(!q.line)return 0;const hw=q.line.halfWidth;return C(S(hw*.70,hw*.94,q.d)*(1-S(hw*.96,hw*1.22,q.d)),0,1)}

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
  round08Correction:'exact exclusion of inherited bend from phase warp + corridor-qualified varied bench/riser pilot'
};
