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
// Coordinate-warping R06 through its inherited lower-slope bend amplified curvature even when
// the absolute bend itself barely changed. That is a real logical error: changing the sampling
// coordinate is not a neutral way to phase-shift a pre-existing seam. Keep the phase edit away
// from the inherited high-curvature band with a broad quintic notch; R09 can then repair the
// inherited bend directly rather than hiding it inside another deformation.
function foothillWarpEnvelope(z){return Q(-36,-10,z)*(1-Q(44,116,z))}
function inheritedBendNotch(z){const band=Q(56,78,z)*(1-Q(100,122,z));return 1-.985*band}
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
// The previous seed selector silently accepted the first zero-score grid point when no candidate
// met all hard constraints; this produced an invalid pilot and then made several zero-valued QA
// metrics look harmless. Never fall back to an unqualified site. Use soft room preferences but
// hard safety bounds, and return an explicit invalid seed if no qualified point exists.
function seedScore(x,z){
  const p=terracePermission(x,z),d=nearestTerrainDrainageDistance(x,z),dv=nearestDivideDistance(x,z),s=slope(x,z);
  if(p<.55||d<16||dv<8||s<.09||s>.21)return -Infinity;
  const slopeFit=1-C(Math.abs(s-.145)/.065,0,1);
  const room=(.35+.65*S(18,40,d))*(.45+.55*S(8,24,dv))*(1-.35*S(165,205,Math.abs(x)));
  return p*(.50+.50*slopeFit)*room;
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
    if(Math.abs(x)>205||z<-154||z>2||p<.28||dd<13.5)break;
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
    {id:'PILOT-BENCH-A',offset:2.60,halfWidth:2.20,left:15,right:18,trimStart:0,trimEnd:0},
    {id:'PILOT-BENCH-B',offset:.80,halfWidth:3.30,left:18,right:16,trimStart:3,trimEnd:1},
    {id:'PILOT-BENCH-C',offset:-1.25,halfWidth:2.40,left:17,right:19,trimStart:1,trimEnd:4},
    {id:'PILOT-BENCH-D',offset:-3.65,halfWidth:3.60,left:20,right:18,trimStart:2,trimEnd:0}
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
  round08Correction:'phase warp excluded from inherited bend + qualified variable bench/riser pilot with explicit failure state'
};
