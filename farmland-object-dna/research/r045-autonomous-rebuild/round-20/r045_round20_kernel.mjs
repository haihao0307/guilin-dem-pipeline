import * as R18 from '../round-18/r045_round18_kernel.mjs';
export * from '../round-18/r045_round18_kernel.mjs';

export const VERSION='R045.20';
const M=(a,b,t)=>a+(b-a)*t;

// R045.20 repairs the inherited z≈-202 cross-slope wall as a FINAL-TERRAIN problem.
// Earlier attempts exposed two logic errors: (1) a correction field need not itself be small when
// cancelling a multi-metre false wall; (2) blending back to an unchanged but still uphill lower
// profile merely relocates the barrier. The final method therefore uses a one-sided downstream
// barrier clip: it only lowers samples that would create >0.24 m uphill rise per 2 m, and carries
// that correction downstream until the inherited profile naturally catches the constrained one.
// Planimetric drainage topology, terrace permission, parcels and water state are not changed.
export const wallRepairBand={node0:-226,node1:-140,nodeStep:2,allowedRisePer2m:.24};

const profileCache=new Map();
function constrainedProfile(x){
  const key=Number(x).toFixed(5);if(profileCache.has(key))return profileCache.get(key);
  const zs=[],base=[];
  for(let z=wallRepairBand.node0;z<=wallRepairBand.node1+1e-9;z+=wallRepairBand.nodeStep){zs.push(z);base.push(R18.height(x,z))}
  const projected=[base[0]],limit=wallRepairBand.allowedRisePer2m;
  for(let i=1;i<base.length;i++) projected[i]=Math.min(base[i],projected[i-1]+limit);
  const p={zs,base,projected};profileCache.set(key,p);return p;
}
function projectedHeight(x,z){
  const p=constrainedProfile(x),step=wallRepairBand.nodeStep;
  if(z<=p.zs[0])return p.projected[0];
  if(z>=p.zs[p.zs.length-1])return p.projected[p.projected.length-1];
  const u=(z-p.zs[0])/step,i=Math.floor(u),t=u-i;
  return M(p.projected[i],p.projected[i+1],t);
}
export function upperWallContinuityRepairDelta(x,z){
  if(z<wallRepairBand.node0||z>wallRepairBand.node1)return 0;
  const base=R18.height(x,z),target=projectedHeight(x,z);
  return target-base;
}

export function height(x,z){return R18.height(x,z)+upperWallContinuityRepairDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R18.terracePermission(x,z)}
export function suitability(x,z){return z>=-138?R18.suitability(x,z):0}

export const snapshot={
  ...R18.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round20:{
    scope:'remove inherited upper-slope cross-slope barrier by final-terrain longitudinal constraint; no terrace, parcel, irrigation, road or task work',
    method:'for each x-profile from z=-226 to -140, preserve the upstream sample and only lower downstream samples that exceed +0.24 m rise per 2 m; correction propagates only until inherited terrain catches it; planimetric drainage carriers and terrace permission unchanged',
    logicCorrection:'R19 constrained the repair field instead of the repaired terrain; early R20 then returned too quickly to an inherited uphill profile and merely moved the barrier. Final R20 constrains the ground profile itself and lets the correction decay only when inherited terrain becomes compatible',
    referenceUse:'user terrace reference and MrRolord hierarchy are used only to require continuous source-to-slope morphology and drainage-first landform logic; no dimensions are extracted',
    evidenceClass:'synthetic macro-landform continuity repair; not surveyed Yunnan microtopography, channel section or hydraulic state',
    forbiddenClaims:['surveyed upper-slope section','measured channel section','active flow','regional terrace dimensions','field microtopography truth','soil/sediment property','ownership']
  }
};
