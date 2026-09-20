import * as R11 from '../round-11/r045_round11_kernel.mjs';

export const VERSION='R045.12';
export const WORLD=R11.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

export const mainRidge=R11.mainRidge;
export const saddleXs=R11.saddleXs;
export const naturalStreams=R11.naturalStreams;
export const divideLines=R11.divideLines;
export const riverZ=R11.riverZ;
export const riverW=R11.riverW;
export const nodes=R11.nodes;
export const edges=R11.edges;
export const ridgeCrestZ=R11.ridgeCrestZ;
export const secondaryCrests=R11.secondaryCrests;
export const branchSpurs=R11.branchSpurs;
export const headwaterHollows=R11.headwaterHollows;
export const rearCatchmentBays=R11.rearCatchmentBays;
export const middleShoulders=R11.middleShoulders;
export const middleSwales=R11.middleSwales;
export const obliqueShoulders=R11.obliqueShoulders;
export const foothillAprons=R11.foothillAprons;
export const foothillSwales=R11.foothillSwales;
export const terrainChannels=R11.terrainChannels;
export const terracePilot=R11.terracePilot;

// R045.12 corrects a remaining category error from R045.11: varying channel width/depth alone
// cannot make a natural catchment. Interfluves, source hollows, convergence shoulders and the
// foothill-to-plain outlet continuum must co-vary with the drainage hierarchy. The additions below
// are deterministic synthetic morphology. They do not assert surveyed Yunnan cross-sections,
// discharge, active flow, soil strength, sediment calibre, ownership or irrigation state.

function segFrame(px,pz,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
  const t=C(((px-a[0])*dx+(pz-a[1])*dz)/l2,0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);
  return{d:Math.hypot(px-x,pz-z),signed:(dx*(pz-z)-dz*(px-x))/L,t,x,z,tx:dx/L,tz:dz/L,nx:-dz/L,nz:dx/L,L};
}
function prepPath(p){let total=0;const cum=[0];for(let i=0;i<p.length-1;i++){total+=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]);cum.push(total)}return{p,cum,total}}
function nearestPath(path,x,z){
  let best={d:1e9,signed:0,u:0,x:0,z:0,tx:0,tz:1,nx:-1,nz:0};
  for(let i=0;i<path.p.length-1;i++){
    const q=segFrame(x,z,path.p[i],path.p[i+1]);
    if(q.d<best.d){const u=(path.cum[i]+q.L*q.t)/(path.total||1);best={...q,u};}
  }
  return best;
}
function pathDistance(points,x,z){let d=1e9;for(let i=0;i<points.length-1;i++)d=Math.min(d,segFrame(x,z,points[i],points[i+1]).d);return d}
function frameAt(c,u){
  const target=C(u,0,1)*(c.total||1);let i=0;while(i<c.cum.length-2&&c.cum[i+1]<target)i++;
  const a=c.p[i],b=c.p[i+1],L=(c.cum[i+1]-c.cum[i])||1,t=C((target-c.cum[i])/L,0,1),dx=b[0]-a[0],dz=b[1]-a[1],ll=Math.hypot(dx,dz)||1;
  return{x:M(a[0],b[0],t),z:M(a[1],b[1],t),tx:dx/ll,tz:dz/ll,nx:-dz/ll,nz:dx/ll};
}
function pointAtZ(c,targetZ){
  for(let i=0;i<c.p.length-1;i++){
    const a=c.p[i],b=c.p[i+1];
    if((a[1]-targetZ)*(b[1]-targetZ)<=0 && Math.abs(b[1]-a[1])>1e-6){const t=C((targetZ-a[1])/(b[1]-a[1]),0,1);return{x:M(a[0],b[0],t),z:targetZ};}
  }
  const f=frameAt(c,.88);return{x:f.x,z:f.z};
}

// 0) Inherited upper-slope continuity repair.
// R045.04 contained two hard early-return cutoffs that contradicted their own smooth fade terms:
// rearBayCut() stopped at z>-170 although its taper continued to -160, and curtainReduction()
// stopped at z>-172 although its taper continued to -166. Those cutoffs generated a broad
// downstream-facing step that survived R05-R11. Rather than loosening the QA threshold or smoothing
// the entire slope, R045.12 restores only the missing tails of those original causal fields.
// This preserves the old versions while making the intended taper continuous in the current model.
function rearBayMissingTail(x,z){
  if(z<=-170||z>=-160)return 0;
  let cut=0;
  for(const b of rearCatchmentBays){
    const q=Math.sqrt(((x-b.x)/b.rx)**2+((z-b.z)/b.rz)**2);
    cut+=b.depth*Math.exp(-.5*q*q);
  }
  return -cut*(1-S(-180,-160,z));
}
function curtainMissingTail(x,z){
  if(z<=-172||z>=-166)return 0;
  const dMain=pathDistance(mainRidge,x,z);
  const broad=G(dMain,70)*S(-300,-270,z)*(1-S(-185,-166,z));
  let support=0;
  for(const c of secondaryCrests)support=Math.max(support,G(pathDistance(c.p,x,z),c.width*1.45));
  const unsupported=1-C(support,0,1),lateral=.72+.28*Math.sin((x+35)*.027)**2;
  return -8.8*broad*(.20+.80*unsupported)*lateral;
}
export function inheritedUpperSlopeContinuityRepairDelta(x,z){return rearBayMissingTail(x,z)+curtainMissingTail(x,z)}

// 1) Interfluve relief: broad, low-amplitude divide shoulders whose strength changes with basin
// position. This works away from drainage axes, so it cannot become another channel/berm overlay.
export function interfluveDelta(x,z){
  if(z<=-208||z>=-68)return 0;
  const dd=R11.nearestDivideDistance(x,z),dr=R11.nearestTerrainDrainageDistance(x,z);
  const env=S(-208,-188,z)*(1-S(-88,-68,z));
  const clear=S(10,24,dr),core=G(dd,10.5),broad=G(dd,24);
  const basinPhase=.58+.42*Math.sin(x*.018+z*.010+.72*Math.sin(z*.019));
  const shoulderPhase=.5+.5*Math.sin(x*.031-z*.013+1.1);
  const ridge=.20*core*(.78+.28*basinPhase);
  const shoulder=.12*broad*(basinPhase-.38)+.055*G(dd-17,9)*(shoulderPhase-.5);
  return env*clear*(ridge+shoulder);
}

// 2) Source amphitheatres: a shallow bowl plus unequal, broad shoulders around primary source
// frames. This changes the source catchment, not merely the centreline slot.
const headFrames=terrainChannels.filter(c=>c.kind!=='tributary').map((c,i)=>({c,i,f:frameAt(c,.115)}));
export function headCatchmentDelta(x,z){
  let sum=0;
  for(const h of headFrames){
    const rx=x-h.f.x,rz=z-h.f.z,along=rx*h.f.tx+rz*h.f.tz,cross=rx*h.f.nx+rz*h.f.nz;
    if(Math.abs(along)>34||Math.abs(cross)>38)continue;
    const bowl=-.16*Math.exp(-.5*((along/20)**2+(cross/18)**2));
    const side=h.c.localSign||((h.i&1)?1:-1),shoulderCenter=side*20;
    const shoulder=.105*Math.exp(-.5*((along/24)**2+((cross-shoulderCenter)/11)**2));
    const opposite=.045*Math.exp(-.5*((along/27)**2+((cross+shoulderCenter*.82)/14)**2));
    const downstreamFade=1-S(18,32,along);
    sum+=(bowl+shoulder+opposite)*downstreamFade;
  }
  return sum;
}

// 3) Foothill/plain continuum: extend only the three trunk terrain carriers as broad, shallow
// convergence swales from the upper foothill into the plain. The geometry fades before the front
// receiver and leaves its bed/control samples unchanged. Existing graph identity is preserved;
// active water state remains unknown.
const trunks=terrainChannels.filter(c=>c.kind==='trunk');
export const outletContinuum=trunks.map((c,i)=>{
  const s=pointAtZ(c,-62),sgn=c.localSign||((i&1)?1:-1),phase=(i-1)*5;
  const p=[[s.x,-64],[s.x+sgn*(7+2*i),-24],[s.x+sgn*(10-2*i)+phase,18],[s.x+sgn*(7+3*i)+phase,62],[s.x+sgn*(3+i)+phase,106],[s.x+phase,132]];
  return{id:`OUTLET-${c.sourceId}`,sourceId:c.sourceId,path:prepPath(p),phase:sgn};
});
export function nearestOutletDistance(x,z){let d=1e9;for(const o of outletContinuum)d=Math.min(d,nearestPath(o.path,x,z).d);return d}
function outletDeltaOne(o,x,z){
  if(z<=-70||z>=140)return 0;
  const q=nearestPath(o.path,x,z),u=q.u;
  const enter=S(-70,-54,z),leave=1-S(124,140,z),env=enter*leave;
  const width=9+15*S(.10,.82,u),depth=.16*(1-S(.58,.98,u))+.035;
  if(q.d>width*3.0)return 0;
  const floor=-depth*G(q.signed,width);
  const shoulderAmp=.040*(1-S(.52,.96,u));
  const shoulder=shoulderAmp*(G(q.signed-width*1.35,width*.72)+G(q.signed+width*1.35,width*.72));
  return env*(floor+shoulder);
}
export function outletContinuumDelta(x,z){let d=0;for(const o of outletContinuum)d+=outletDeltaOne(o,x,z);return d}

export function catchmentMorphDelta(x,z){return interfluveDelta(x,z)+headCatchmentDelta(x,z)+outletContinuumDelta(x,z)}
export function channelMorphDelta(x,z){return R11.channelMorphDelta(x,z)}
export function height(x,z){return R11.height(x,z)+inheritedUpperSlopeContinuityRepairDelta(x,z)+catchmentMorphDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function nearestStreamDistance(x,z){return R11.nearestStreamDistance(x,z)}
export function nearestDivideDistance(x,z){return R11.nearestDivideDistance(x,z)}
export function nearestTerrainDrainageDistance(x,z){return R11.nearestTerrainDrainageDistance(x,z)}
export function nearestExtendedDrainageDistance(x,z){return Math.min(R11.nearestTerrainDrainageDistance(x,z),nearestOutletDistance(x,z))}
export function fanField(x,z){return R11.fanField(x,z)}
export function foothillShift(x,z){return R11.foothillShift(x,z)}
export function inheritedBendRepairDelta(x,z){return R11.inheritedBendRepairDelta(x,z)}
export function carrierProfile(c,u){return R11.carrierProfile(c,u)}

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

// The R08 pilot is retained only as frozen failure evidence. It is not rendered or promoted.
function segDist(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=C(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz||1),0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);return{d:Math.hypot(px-x,pz-z),t,x,z}}
function pilotNearest(x,z){let best={d:1e9,line:null};for(const line of terracePilot.lines){for(let i=0;i<line.points.length-1;i++){const q=segDist(x,z,line.points[i],line.points[i+1]);if(q.d<best.d)best={d:q.d,line};}}return best}
export function terracedPilotHeight(x,z){const base=height(x,z),q=pilotNearest(x,z);if(!q.line)return base;const hw=q.line.halfWidth;if(q.d>=hw*1.18||nearestExtendedDrainageDistance(x,z)<12)return base;const core=1-S(hw*.72,hw,q.d),shoulder=(1-S(hw,hw*1.18,q.d))*S(hw*.72,hw,q.d);return M(base,q.line.target,C(core+.38*shoulder,0,1))}
export function pilotInfluence(x,z){const q=pilotNearest(x,z);return q.line?C(1-q.d/(q.line.halfWidth*1.22),0,1):0}
export function pilotRiserInfluence(x,z){const q=pilotNearest(x,z);if(!q.line)return 0;const hw=q.line.halfWidth;return C(S(hw*.70,hw*.94,q.d)*(1-S(hw*.96,hw*1.22,q.d)),0,1)}

export const snapshot={
  ...R11.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  catchmentMorphologyClass:'synthetic divide/source/outlet terrain morphology aligned to existing drainage identity; no surveyed-dimension or active-flow claim',
  round12Correction:'restore inherited R04 upper-slope taper tails + asymmetric interfluve shoulders + source amphitheatres + broad trunk outlet continuum; terraces remain locked'
};
