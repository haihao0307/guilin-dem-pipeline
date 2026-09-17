import * as R17 from '../round-17/r045_round17_kernel.mjs';

export const VERSION='R045.18';
export const WORLD=R17.WORLD;
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G2=(a,b)=>Math.exp(-0.5*(a*a+b*b));

// R045.18 corrects a second tempting shortcut: simply increasing the amplitude or transverse drift
// of R17's long basin shoulders would make the old ribbon rhythm louder, not more natural.
// This round changes one macro component only: headwater/source-catchment FOOTPRINT. Each A/B/C
// headwater receives a differently oriented, differently proportioned amphitheatre rim tied to its
// inherited trunk path. The complete drainage skeleton stays protected, and the new field is exactly
// zero at z>=-160 so the already delicate terrace-candidate slope is not altered in this round.
export const mainRidge=R17.mainRidge;
export const saddleXs=R17.saddleXs;
export const naturalStreams=R17.naturalStreams;
export const divideLines=R17.divideLines;
export const riverZ=R17.riverZ;
export const riverW=R17.riverW;
export const nodes=R17.nodes;
export const edges=R17.edges;
export const ridgeCrestZ=R17.ridgeCrestZ;
export const secondaryCrests=R17.secondaryCrests;
export const branchSpurs=R17.branchSpurs;
export const headwaterHollows=R17.headwaterHollows;
export const rearCatchmentBays=R17.rearCatchmentBays;
export const middleShoulders=R17.middleShoulders;
export const middleSwales=R17.middleSwales;
export const obliqueShoulders=R17.obliqueShoulders;
export const foothillAprons=R17.foothillAprons;
export const foothillSwales=R17.foothillSwales;
export const terrainChannels=R17.terrainChannels;
export const outletContinuum=R17.outletContinuum;
export const terracePilot=R17.terracePilot;
export const nearestStreamDistance=R17.nearestStreamDistance;
export const nearestDivideDistance=R17.nearestDivideDistance;
export const nearestTerrainDrainageDistance=R17.nearestTerrainDrainageDistance;
export const nearestOutletDistance=R17.nearestOutletDistance;
export const nearestExtendedDrainageDistance=R17.nearestExtendedDrainageDistance;
export const channelMorphDelta=R17.channelMorphDelta;
export const inheritedUpperSlopeContinuityRepairDelta=R17.inheritedUpperSlopeContinuityRepairDelta;
export const interfluveDelta=R17.interfluveDelta;
export const headCatchmentDelta=R17.headCatchmentDelta;
export const outletContinuumDelta=R17.outletContinuumDelta;
export const catchmentMorphDelta=R17.catchmentMorphDelta;
export const fanField=R17.fanField;
export const foothillShift=R17.foothillShift;
export const inheritedBendRepairDelta=R17.inheritedBendRepairDelta;
export const carrierProfile=R17.carrierProfile;
export const continuityBand=R17.continuityBand;
export const continuityTarget=R17.continuityTarget;
export const interfluveContinuityDelta=R17.interfluveContinuityDelta;
export const basinProfiles=R17.basinProfiles;
export const basinShoulderDelta=R17.basinShoulderDelta;
export const foothillPlainProfiles=R17.foothillPlainProfiles;
export const foothillPlainComponent=R17.foothillPlainComponent;
export const foothillPlainDelta=R17.foothillPlainDelta;
export const catchmentHierarchyProfiles=R17.catchmentHierarchyProfiles;
export const catchmentHierarchyComponent=R17.catchmentHierarchyComponent;
export const catchmentHierarchyDelta=R17.catchmentHierarchyDelta;
export const nestedBasinProfiles=R17.nestedBasinProfiles;
export const nestedBasinComponent=R17.nestedBasinComponent;
export const nestedBasinDelta=R17.nestedBasinDelta;

function frameAt(path,u){
  const target=C(u,0,1)*(path.total||1);
  let i=0;
  while(i<path.cum.length-2&&path.cum[i+1]<target)i++;
  const a=path.p[i],b=path.p[i+1],L=(path.cum[i+1]-path.cum[i])||1;
  const t=C((target-path.cum[i])/L,0,1),x=M(a[0],b[0],t),z=M(a[1],b[1],t);
  const dx=b[0]-a[0],dz=b[1]-a[1],ll=Math.hypot(dx,dz)||1;
  return{x,z,tx:dx/ll,tz:dz/ll,nx:-dz/ll,nz:dx/ll};
}
function ellipse(x,z,cx,cz,ux,uz,vx,vz,long,wide){
  const rx=x-cx,rz=z-cz;
  return G2((rx*ux+rz*uz)/long,(rx*vx+rz*vz)/wide);
}
function axes(frame,angleDeg){
  const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return{
    ux:frame.tx*c+frame.nx*s,uz:frame.tz*c+frame.nz*s,
    vx:-frame.tx*s+frame.nx*c,vz:-frame.tz*s+frame.nz*c
  };
}

// These are synthetic shape controls, intentionally not measurements. anchorU keeps each intervention
// in the upper source domain; angle/length/width/offset differ enough that A/B/C cannot be scaled clones.
export const headwaterFootprintProfiles=R17.nestedBasinProfiles.map((p,i)=>({
  id:p.id,path:p.path,
  anchorU:[.145,.155,.135][i]??.145,
  angleDeg:[-31,24,-46][i]??0,
  major:[68,82,59][i]??70,
  minor:[31,39,27][i]??32,
  rimOffset:[47,57,43][i]??48,
  rearShift:[-13,-21,-9][i]??-14,
  amplitude:[.42,.50,.36][i]??.42,
  sideBias:[-.22,.18,-.31][i]??0,
  rearScale:[.42,.34,.48][i]??.40
}));

export function headwaterFootprintComponent(p,x,z){
  if(z<=-220||z>=-160)return 0;
  const f=frameAt(p.path,p.anchorU);
  const drainClear=S(12,58,R17.nearestExtendedDrainageDistance(x,z));
  if(drainClear<=0)return 0;

  // Wide vertical fades avoid introducing a new horizontal band. The lower fade reaches exactly zero
  // by -160 m; R17's terrace-candidate domain begins at -158 m and is therefore untouched.
  const env=S(-220,-198,z)*(1-S(-190,-160,z));
  if(env<=0)return 0;
  const divideEase=.72+.28*S(4,18,R17.nearestDivideDistance(x,z));
  const ax=axes(f,p.angleDeg);

  // Paired asymmetric side rims plus a weak rear closure create an amphitheatre footprint rather than
  // another carrier-parallel ribbon. All lobes are broad; the protected drainage axis remains unchanged.
  const leftC={
    x:f.x+f.tx*p.rearShift+f.nx*p.rimOffset,
    z:f.z+f.tz*p.rearShift+f.nz*p.rimOffset
  };
  const rightC={
    x:f.x+f.tx*(p.rearShift*.72)-f.nx*(p.rimOffset*.91),
    z:f.z+f.tz*(p.rearShift*.72)-f.nz*(p.rimOffset*.91)
  };
  const rearC={
    x:f.x-f.tx*(p.major*.42)+f.nx*(p.sideBias*12),
    z:f.z-f.tz*(p.major*.42)+f.nz*(p.sideBias*12)
  };
  const leftAmp=p.amplitude*(1+p.sideBias);
  const rightAmp=p.amplitude*(1-p.sideBias);
  const left=leftAmp*ellipse(x,z,leftC.x,leftC.z,ax.ux,ax.uz,ax.vx,ax.vz,p.major,p.minor);
  const right=rightAmp*ellipse(x,z,rightC.x,rightC.z,ax.ux,ax.uz,ax.vx,ax.vz,p.major*.88,p.minor*1.08);
  const rear=p.amplitude*p.rearScale*ellipse(x,z,rearC.x,rearC.z,ax.ux,ax.uz,ax.vx,ax.vz,p.major*.72,p.minor*1.52);
  return env*drainClear*divideEase*(left+right+rear);
}
export function headwaterFootprintDelta(x,z){
  let d=0;
  for(const p of headwaterFootprintProfiles)d+=headwaterFootprintComponent(p,x,z);
  return C(d,0,.92);
}

export function height(x,z){return R17.height(x,z)+headwaterFootprintDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export function terracePermission(x,z){
  // The R18 footprint field is identically zero over the terrace-candidate domain, so permission is
  // deliberately inherited unchanged rather than recomputed against a geometry this round did not touch.
  return R17.terracePermission(x,z);
}
export function suitability(x,z){
  if(z>=-158)return R17.suitability(x,z);
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(riverW(x)+4,riverW(x)+18,Math.abs(z-riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export function terracedPilotHeight(x,z){return R17.terracedPilotHeight(x,z)}
export function pilotInfluence(x,z){return R17.pilotInfluence(x,z)}
export function pilotRiserInfluence(x,z){return R17.pilotRiserInfluence(x,z)}

export const snapshot={
  ...R17.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round18:{
    scope:'replace one remaining source-area ribbon symptom with three differently oriented headwater amphitheatre footprints; no terrace or parcel work',
    method:'carrier-anchored anisotropic source-rim ellipses with basin-specific angle/aspect/offset/asymmetry; complete drainage skeleton protected; field exactly zero by z=-160',
    referenceUse:'user reference images constrain source-to-slope hierarchy and non-clone contour turning only; no metric extraction',
    evidenceClass:'synthetic upper-catchment morphology; not surveyed Yunnan terrain',
    forbiddenClaims:['surveyed headwater geometry','measured channel section','active flow','regional terrace dimensions','field microtopography truth','soil/sediment property','ownership']
  }
};
