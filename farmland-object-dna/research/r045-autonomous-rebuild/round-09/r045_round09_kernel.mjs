import * as R8 from '../round-08/r045_round08_kernel.mjs';

export const VERSION='R045.09';
export const WORLD=R8.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const Q=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*t*(t*(t*6-15)+10)};

export const mainRidge=R8.mainRidge;
export const saddleXs=R8.saddleXs;
export const naturalStreams=R8.naturalStreams;
export const divideLines=R8.divideLines;
export const riverZ=R8.riverZ;
export const riverW=R8.riverW;
export const nodes=R8.nodes;
export const edges=R8.edges;
export const ridgeCrestZ=R8.ridgeCrestZ;
export const secondaryCrests=R8.secondaryCrests;
export const branchSpurs=R8.branchSpurs;
export const headwaterHollows=R8.headwaterHollows;
export const rearCatchmentBays=R8.rearCatchmentBays;
export const middleShoulders=R8.middleShoulders;
export const middleSwales=R8.middleSwales;
export const obliqueShoulders=R8.obliqueShoulders;
export const foothillAprons=R8.foothillAprons;
export const foothillSwales=R8.foothillSwales;
export const terracePilot=R8.terracePilot;

// R045.09 fixes a specific unresolved macro defect from R045.08: the inherited lower-piedmont
// bend around z~70..110. Merely warping coordinates around it, adding noise, or widening terrace
// bands would hide the belt without repairing its longitudinal derivative. We reconstruct only the
// broad lateral common-mode component and retain the local x-residual (swales/spurs). This is still
// synthetic morphology, not a surveyed depositional surface.
const COMMON_OFFSETS=[-66,-42,-21,0,21,42,66];
const COMMON_WEIGHTS=[.055,.105,.19,.30,.19,.105,.055];
function commonHeight(x,z){
  let s=0,w=0;
  for(let i=0;i<COMMON_OFFSETS.length;i++){
    const xx=C(x+COMMON_OFFSETS[i],-228,228),ww=COMMON_WEIGHTS[i];
    s+=ww*R8.height(xx,z);w+=ww;
  }
  return s/w;
}
function hermite(y0,m0,y1,m1,t,L){const t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*y0+(t3-2*t2+t)*m0*L+(-2*t3+3*t2)*y1+(t3-t2)*m1*L}
function bendBounds(x){
  // Slightly de-synchronise the repair boundary so the correction itself cannot become a new
  // perfectly horizontal contour belt. The phase is deliberately small relative to the 54 m span.
  const phase=2.6*Math.sin((x+37)*.013)+1.0*Math.sin((x-19)*.031);
  return{a:58+phase,b:116+phase*.55};
}
export function inheritedBendRepairDelta(x,z){
  const {a,b}=bendBounds(x);if(z<=a||z>=b)return 0;
  const e=1.5;
  const y0=commonHeight(x,a),y1=commonHeight(x,b);
  const m0=(commonHeight(x,a+e)-commonHeight(x,a-e))/(2*e);
  const m1=(commonHeight(x,b+e)-commonHeight(x,b-e))/(2*e);
  const t=(z-a)/(b-a),target=hermite(y0,m0,y1,m1,t,b-a),raw=commonHeight(x,z);
  // Preserve more of the original surface close to drainage axes; the correction is aimed at the
  // cross-basin common bend, not at erasing channel relief. Quintic edge taper keeps the multiplier
  // smooth where drainage clearance changes.
  const d=R8.nearestTerrainDrainageDistance(x,z);
  const drainageProtect=.48+.52*Q(5.5,18,d);
  const sideProtect=1-.18*S(185,224,Math.abs(x));
  return (target-raw)*drainageProtect*sideProtect;
}

export function height(x,z){return R8.height(x,z)+inheritedBendRepairDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return R8.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R8.nearestDivideDistance(x,z)}
export function nearestTerrainDrainageDistance(x,z){return R8.nearestTerrainDrainageDistance(x,z)}
export function fanField(x,z){return R8.fanField(x,z)}
export function foothillShift(x,z){return R8.foothillShift(x,z)}

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

// R08 terrace pilot lies well upslope of the repaired lower-piedmont belt. Keep its synthetic
// footprint frozen in this macro round rather than claiming new terrace progress. The preview
// height is evaluated relative to the R09 macro surface so later audits compare like with like.
function segDist(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return{d:Math.hypot(px-x,pz-z),t,x,z}}
function pilotNearest(x,z){let best={d:1e9,line:null};for(const line of terracePilot.lines){for(let i=0;i<line.points.length-1;i++){const q=segDist(x,z,line.points[i],line.points[i+1]);if(q.d<best.d)best={d:q.d,line};}}return best}
export function terracedPilotHeight(x,z){const base=height(x,z),q=pilotNearest(x,z);if(!q.line)return base;const hw=q.line.halfWidth;if(q.d>=hw*1.18||nearestTerrainDrainageDistance(x,z)<12)return base;const core=1-S(hw*.72,hw,q.d),shoulder=(1-S(hw,hw*1.18,q.d))*S(hw*.72,hw,q.d);return M(base,q.line.target,C(core+.38*shoulder,0,1))}
export function pilotInfluence(x,z){const q=pilotNearest(x,z);return q.line?C(1-q.d/(q.line.halfWidth*1.22),0,1):0}
export function pilotRiserInfluence(x,z){const q=pilotNearest(x,z);if(!q.line)return 0;const hw=q.line.halfWidth;return C(S(hw*.70,hw*.94,q.d)*(1-S(hw*.96,hw*1.22,q.d)),0,1)}

export const snapshot={
  ...R8.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:true,
  waterStateKnown:false,
  round09Correction:'direct common-mode reconstruction of inherited lower-piedmont bend; local drainage residual retained; R08 terrace pilot frozen'
};
