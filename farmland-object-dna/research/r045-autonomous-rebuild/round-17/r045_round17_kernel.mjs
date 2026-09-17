import * as R16 from '../round-16/r045_round16_kernel.mjs';

export const VERSION='R045.17';
export const WORLD=R16.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

// R045.17 corrects another false shortcut: changing only channel width/depth or adding noise cannot
// make a one-sided agricultural slope read as a causal catchment. Parallel-looking valleys persist
// when the broad interfluve volumes keep the same transverse rhythm. This round therefore adds a
// low-frequency, carrier-tied nested-basin field whose shoulder centres drift differently along A/B/C.
// It changes basin-scale relief only; it does not modify the inherited water graph or assert flow.
export const mainRidge=R16.mainRidge;
export const saddleXs=R16.saddleXs;
export const naturalStreams=R16.naturalStreams;
export const divideLines=R16.divideLines;
export const riverZ=R16.riverZ;
export const riverW=R16.riverW;
export const nodes=R16.nodes;
export const edges=R16.edges;
export const ridgeCrestZ=R16.ridgeCrestZ;
export const secondaryCrests=R16.secondaryCrests;
export const branchSpurs=R16.branchSpurs;
export const headwaterHollows=R16.headwaterHollows;
export const rearCatchmentBays=R16.rearCatchmentBays;
export const middleShoulders=R16.middleShoulders;
export const middleSwales=R16.middleSwales;
export const obliqueShoulders=R16.obliqueShoulders;
export const foothillAprons=R16.foothillAprons;
export const foothillSwales=R16.foothillSwales;
export const terrainChannels=R16.terrainChannels;
export const outletContinuum=R16.outletContinuum;
export const terracePilot=R16.terracePilot;
export const nearestStreamDistance=R16.nearestStreamDistance;
export const nearestDivideDistance=R16.nearestDivideDistance;
export const nearestTerrainDrainageDistance=R16.nearestTerrainDrainageDistance;
export const nearestOutletDistance=R16.nearestOutletDistance;
export const nearestExtendedDrainageDistance=R16.nearestExtendedDrainageDistance;
export const channelMorphDelta=R16.channelMorphDelta;
export const inheritedUpperSlopeContinuityRepairDelta=R16.inheritedUpperSlopeContinuityRepairDelta;
export const interfluveDelta=R16.interfluveDelta;
export const headCatchmentDelta=R16.headCatchmentDelta;
export const outletContinuumDelta=R16.outletContinuumDelta;
export const catchmentMorphDelta=R16.catchmentMorphDelta;
export const fanField=R16.fanField;
export const foothillShift=R16.foothillShift;
export const inheritedBendRepairDelta=R16.inheritedBendRepairDelta;
export const carrierProfile=R16.carrierProfile;
export const continuityBand=R16.continuityBand;
export const continuityTarget=R16.continuityTarget;
export const interfluveContinuityDelta=R16.interfluveContinuityDelta;
export const basinProfiles=R16.basinProfiles;
export const basinShoulderDelta=R16.basinShoulderDelta;
export const foothillPlainProfiles=R16.foothillPlainProfiles;
export const foothillPlainComponent=R16.foothillPlainComponent;
export const foothillPlainDelta=R16.foothillPlainDelta;
export const catchmentHierarchyProfiles=R16.catchmentHierarchyProfiles;
export const catchmentHierarchyComponent=R16.catchmentHierarchyComponent;
export const catchmentHierarchyDelta=R16.catchmentHierarchyDelta;

function segFrame(px,pz,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
  const t=C(((px-a[0])*dx+(pz-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
  const rx=px-qx,rz=pz-qz;
  return{d:Math.hypot(rx,rz),signed:(dx*rz-dz*rx)/L,t,L,qx,qz};
}
function nearestPath(path,x,z){
  let best={d:1e9,signed:0,u:0};
  for(let i=0;i<path.p.length-1;i++){
    const q=segFrame(x,z,path.p[i],path.p[i+1]);
    const u=(path.cum[i]+q.L*q.t)/(path.total||1);
    if(q.d<best.d)best={d:q.d,signed:q.signed,u};
  }
  return best;
}

// Profile differences are deliberate basin identity, not random decoration. drift bends the broad
// shoulder centres across the slope as u advances so the three basin volumes cannot remain a family
// of parallel ribbons. span/width differences create unequal nested source and convergence bowls.
export const nestedBasinProfiles=R16.catchmentHierarchyProfiles.map((p,i)=>({
  id:p.id,
  path:p.path,
  amp:[.56,.68,.49][i]??.56,
  sourceSpan:[71,82,64][i]??70,
  transportSpan:[48,57,43][i]??50,
  width:[38,45,34][i]??39,
  skew:[-.24,.31,-.38][i]??0,
  drift:[28,-23,34][i]??20,
  phase:[.22,1.18,2.32][i]??0,
  sourceU:[.18,.22,.16][i]??.18,
  convergeU:[.43,.49,.39][i]??.44,
  transportU:[.66,.70,.61][i]??.65
}));

export function nestedBasinComponent(p,x,z){
  if(z<=-220||z>=-36)return 0;
  const q=nearestPath(p.path,x,z),u=q.u,sd=q.signed;
  if(q.d>145)return 0;

  // Broad entry/exit prevents the nested relief from becoming a new horizontal shoulder. The full
  // inherited drainage graph is protected exactly at its axes; deformation moves gradually onto
  // valley shoulders and interfluves instead of changing channel cross-sections.
  const env=S(-220,-170,z)*(1-S(-82,-36,z));
  const drainClear=S(12,62,R16.nearestExtendedDrainageDistance(x,z));
  if(env<=0||drainClear<=0)return 0;
  const divideEase=.78+.22*S(4,20,R16.nearestDivideDistance(x,z));

  const src=G(u-p.sourceU,.16),conv=G(u-p.convergeU,.22),tr=G(u-p.transportU,.20);
  const stage=.78*src+1.0*conv+.48*tr;
  const progress=S(.08,.76,u);
  const span=M(p.sourceSpan,p.transportSpan,progress);
  const drift=p.drift*(.62*Math.sin(Math.PI*(u*1.08)+p.phase)+.38*(u-.46));
  const wav=.92+.08*Math.cos(2*Math.PI*u+p.phase);
  const w=p.width*(1+.15*src-.07*tr)*wav;

  const leftCentre=span+drift;
  const rightCentre=span*.94-drift*.58;
  const leftAmp=p.amp*stage*(1+p.skew*(.72+.28*src));
  const rightAmp=p.amp*stage*(1-p.skew*(.72+.28*src));
  const left=leftAmp*G(sd-leftCentre,w);
  const right=rightAmp*G(sd+rightCentre,w*1.12);

  // Outer secondary lobes make source/convergence volumes nest rather than repeat one pair of bands.
  // They are intentionally weaker and disappear before the outlet/plain continuum dominates.
  const outerStage=.56*src+.72*conv+.18*tr;
  const outerLeft=.23*p.amp*outerStage*G(sd-(leftCentre+w*.92),w*1.32);
  const outerRight=.18*p.amp*outerStage*G(sd+(rightCentre+w*1.06),w*1.45);
  return env*drainClear*divideEase*(left+right+outerLeft+outerRight);
}

export function nestedBasinDelta(x,z){
  let d=0;
  for(const p of nestedBasinProfiles)d+=nestedBasinComponent(p,x,z);
  return C(d,0,1.32);
}

export function height(x,z){return R16.height(x,z)+nestedBasinDelta(x,z)}
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

export function terracedPilotHeight(x,z){return R16.terracedPilotHeight(x,z)}
export function pilotInfluence(x,z){return R16.pilotInfluence(x,z)}
export function pilotRiserInfluence(x,z){return R16.pilotRiserInfluence(x,z)}

export const snapshot={
  ...R16.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round17:{
    scope:'break the parallel macro-slope rhythm by adding unequal nested interfluve/source/convergence volumes tied to A/B/C carriers',
    method:'deterministic wide shoulder lobes with basin-specific transverse drift, nesting and asymmetry; complete inherited drainage skeleton protected; R16 outlet/plain continuum retained',
    referenceUse:'user terrace photographs constrain broad hierarchy, contour continuity and non-clone nesting only; no metric extraction',
    evidenceClass:'synthetic basin-scale morphology; not surveyed Yunnan terrain',
    forbiddenClaims:['surveyed catchment geometry','measured channel section','active flow','regional terrace dimensions','field microtopography truth','soil/sediment property','ownership']
  }
};
