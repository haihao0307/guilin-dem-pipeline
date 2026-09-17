import * as R15 from '../round-15/r045_round15_kernel.mjs';

export const VERSION='R045.16';
export const WORLD=R15.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-0.5*(x/s)*(x/s));

// R045.16 corrects a tempting but false inference: simply strengthening channels, shoulders,
// head hollows and foothill aprons independently does not produce a coherent catchment.  It can
// instead emboss three unrelated procedural systems on the same slope.  This round adds one broad
// longitudinal hierarchy field tied to the already inherited A/B/C trunk carriers so source
// amphitheatre, convergence shoulder, transport valley context and lower outlet read as stages of
// the same basin.  It does NOT change the water graph, assert active flow, or introduce surveyed
// Yunnan geometry.  All dimensions below remain synthetic generation parameters.
export const mainRidge=R15.mainRidge;
export const saddleXs=R15.saddleXs;
export const naturalStreams=R15.naturalStreams;
export const divideLines=R15.divideLines;
export const riverZ=R15.riverZ;
export const riverW=R15.riverW;
export const nodes=R15.nodes;
export const edges=R15.edges;
export const ridgeCrestZ=R15.ridgeCrestZ;
export const secondaryCrests=R15.secondaryCrests;
export const branchSpurs=R15.branchSpurs;
export const headwaterHollows=R15.headwaterHollows;
export const rearCatchmentBays=R15.rearCatchmentBays;
export const middleShoulders=R15.middleShoulders;
export const middleSwales=R15.middleSwales;
export const obliqueShoulders=R15.obliqueShoulders;
export const foothillAprons=R15.foothillAprons;
export const foothillSwales=R15.foothillSwales;
export const terrainChannels=R15.terrainChannels;
export const outletContinuum=R15.outletContinuum;
export const terracePilot=R15.terracePilot;
export const nearestStreamDistance=R15.nearestStreamDistance;
export const nearestDivideDistance=R15.nearestDivideDistance;
export const nearestTerrainDrainageDistance=R15.nearestTerrainDrainageDistance;
export const nearestOutletDistance=R15.nearestOutletDistance;
export const nearestExtendedDrainageDistance=R15.nearestExtendedDrainageDistance;
export const channelMorphDelta=R15.channelMorphDelta;
export const inheritedUpperSlopeContinuityRepairDelta=R15.inheritedUpperSlopeContinuityRepairDelta;
export const interfluveDelta=R15.interfluveDelta;
export const headCatchmentDelta=R15.headCatchmentDelta;
export const outletContinuumDelta=R15.outletContinuumDelta;
export const catchmentMorphDelta=R15.catchmentMorphDelta;
export const fanField=R15.fanField;
export const foothillShift=R15.foothillShift;
export const inheritedBendRepairDelta=R15.inheritedBendRepairDelta;
export const carrierProfile=R15.carrierProfile;
export const continuityBand=R15.continuityBand;
export const continuityTarget=R15.continuityTarget;
export const interfluveContinuityDelta=R15.interfluveContinuityDelta;
export const basinProfiles=R15.basinProfiles;
export const basinShoulderDelta=R15.basinShoulderDelta;
export const foothillPlainProfiles=R15.foothillPlainProfiles;
export const foothillPlainComponent=R15.foothillPlainComponent;
export const foothillPlainDelta=R15.foothillPlainDelta;

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

// Each profile is intentionally different.  A single shared parameter set would merely create
// three scaled clones.  sourceOffset->midOffset contracts the broad amphitheatre toward the
// transport reach; source/mid/tail weights provide longitudinal hierarchy instead of free noise.
export const catchmentHierarchyProfiles=R15.basinProfiles.map((b,i)=>({
  id:b.id,
  path:b.path,
  amp:[.78,.94,.69][i]??.78,
  sourceOffset:[55,61,50][i]??55,
  midOffset:[39,44,36][i]??40,
  width:[30,34,27][i]??30,
  bias:[-.27,.34,-.40][i]??0,
  sourceU:[.16,.20,.14][i]??.17,
  convergenceU:[.40,.46,.37][i]??.41,
  transportU:[.63,.67,.59][i]??.63,
  phase:[.25,1.45,2.62][i]??0
}));

export function catchmentHierarchyComponent(p,x,z){
  // Keep the rear ridge/control area and the R15 foothill/plain field intact. The first draft used
  // an 18 m source-side fade and produced a measurable artificial shoulder at z≈-208. Widening the
  // envelope is a geometry correction, not a relaxed QA threshold: source morphology now enters over
  // 46 m and exits over 42 m, while z<=-220 and the lower R15 foothill/plain controls stay untouched.
  if(z<=-220||z>=-34)return 0;
  const q=nearestPath(p.path,x,z),u=q.u,sd=q.signed;
  if(q.d>118)return 0;
  const env=S(-220,-174,z)*(1-S(-76,-34,z));
  if(env<=0)return 0;

  // Protect the complete inherited drainage skeleton.  The 12..42 m ramp is deliberately broad;
  // a narrow ring would create a false berm around tributaries.  This is morphology around a basin,
  // not a second water channel.
  const drainageClear=S(12,42,R15.nearestExtendedDrainageDistance(x,z));
  if(drainageClear<=0)return 0;
  const divideEase=.62+.38*S(5,18,R15.nearestDivideDistance(x,z));

  const source=G(u-p.sourceU,.135);
  const convergence=G(u-p.convergenceU,.205);
  const transport=G(u-p.transportU,.19);
  const hierarchy=.62*source+.88*convergence+.46*transport;
  const contraction=S(.10,.70,u);
  const off=M(p.sourceOffset,p.midOffset,contraction);
  const w=p.width*(1+.12*source-.08*transport);
  const leftAmp=p.amp*hierarchy*(1+p.bias*(.72+.28*source));
  const rightAmp=p.amp*hierarchy*(1-p.bias*(.72+.28*source));

  // Unequal broad shoulders define the catchment volume.  A very shallow central concavity links
  // the shoulders perceptually but cannot cut the protected drainage axis because drainageClear=0
  // there.  Slow phase changes are basin identity, not stochastic detail.
  const left=leftAmp*G(sd-off,w);
  const right=rightAmp*G(sd+off*1.04,w*1.08);
  const centre=-.15*p.amp*(.86*source+.58*convergence+.24*transport)*G(sd+p.bias*8,w*1.45);
  const outer=.11*p.amp*(.64+.36*Math.cos(Math.PI*u+p.phase))*G(sd-p.bias*18,w*2.25)*(1-S(.72,.94,u));
  return env*drainageClear*divideEase*(left+right+centre+outer);
}

export function catchmentHierarchyDelta(x,z){
  let d=0;
  for(const p of catchmentHierarchyProfiles)d+=catchmentHierarchyComponent(p,x,z);
  return C(d,-.42,1.24);
}

export function height(x,z){return R15.height(x,z)+catchmentHierarchyDelta(x,z)}
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

export function terracedPilotHeight(x,z){return R15.terracedPilotHeight(x,z)}
export function pilotInfluence(x,z){return R15.pilotInfluence(x,z)}
export function pilotRiserInfluence(x,z){return R15.pilotRiserInfluence(x,z)}

export const snapshot={
  ...R15.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round16:{
    scope:'couple source amphitheatre, convergence shoulders and transport context into one A/B/C basin hierarchy before terrace generation',
    method:'broad deterministic carrier-tied hierarchy field with 46 m source entry and 42 m lower fade; complete inherited drainage skeleton protected; R15 foothill/plain field retained; no new water graph',
    referenceUse:'user terrace photographs constrain hierarchy/continuity/irregular nesting only; no metric extraction',
    evidenceClass:'synthetic catchment-scale morphology; not surveyed Yunnan terrain',
    forbiddenClaims:['surveyed catchment geometry','measured channel section','active flow','regional terrace dimensions','field microtopography truth','soil/sediment property','ownership']
  }
};
