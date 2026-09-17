import * as R18 from '../round-18/r045_round18_kernel.mjs';
export * from '../round-18/r045_round18_kernel.mjs';

export const VERSION='R045.20';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R045.20 corrects the failed R045.19 acceptance logic and geometry together.
// The inherited z≈-202 wall is a FINAL-TERRAIN defect. A correction field must therefore be
// allowed to change sharply where it cancels a multi-metre baseline wall; constraining the
// derivative or amplitude of the correction itself is logically wrong. This round replaces the
// failed drain-masked repair with a band-wide profile projection that changes elevation only,
// while preserving every planimetric drainage carrier and all lower agricultural-slope geometry.
// Because water state is still unknown, preserving an inherited false uphill step on a drainage
// axis would be less defensible than repairing the longitudinal ground profile through it.
export const wallRepairBand={z0:-226,z1:-170,node0:-222,node1:-174,nodeStep:2,allowedRisePer2m:.24};

function isotonicNonIncreasing(values,weights){
  const blocks=[];
  for(let i=0;i<values.length;i++){
    blocks.push({start:i,end:i,w:weights[i],sum:values[i]*weights[i]});
    while(blocks.length>1){
      const b=blocks[blocks.length-1],a=blocks[blocks.length-2];
      if(a.sum/a.w>=b.sum/b.w)break;
      blocks.pop();blocks.pop();
      blocks.push({start:a.start,end:b.end,w:a.w+b.w,sum:a.sum+b.sum});
    }
  }
  const out=new Array(values.length);
  for(const b of blocks){const m=b.sum/b.w;for(let i=b.start;i<=b.end;i++)out[i]=m}
  return out;
}

const profileCache=new Map();
function constrainedProfile(x){
  const key=Number(x).toFixed(5);if(profileCache.has(key))return profileCache.get(key);
  const zs=[],base=[];
  for(let z=wallRepairBand.node0;z<=wallRepairBand.node1+1e-9;z+=wallRepairBand.nodeStep){zs.push(z);base.push(R18.height(x,z))}
  const limit=wallRepairBand.allowedRisePer2m;
  const transformed=base.map((h,i)=>h-i*limit);
  // Strong endpoint weights keep the projection tied to inherited macro elevations while the
  // interior is free to remove the false wall.
  const weights=base.map((_,i)=>i<4||i>base.length-5?12:1);
  const projected=isotonicNonIncreasing(transformed,weights).map((g,i)=>g+i*limit);
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
  if(z<=wallRepairBand.z0||z>=wallRepairBand.z1)return 0;
  // 12 m entry/exit ramps prevent a new horizontal seam. The inherited wall itself sits well
  // inside the full-strength zone. Do not amplitude-clamp the repair: that was the remaining R20
  // failure because a 5.2 m inherited false step cannot be cancelled by an arbitrary 3.6 m cap.
  // Acceptance is instead imposed on the FINAL terrain and spatial support in QA.
  const env=S(-226,-214,z)*(1-S(-182,-170,z));
  if(env<=0)return 0;
  const base=R18.height(x,z),target=projectedHeight(x,z);
  return (target-base)*env;
}

export function height(x,z){return R18.height(x,z)+upperWallContinuityRepairDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R18.terracePermission(x,z)}
export function suitability(x,z){return z>=-168?R18.suitability(x,z):0}

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
    scope:'replace failed R19 upper-wall repair with final-terrain longitudinal continuity projection; no terrace, parcel, irrigation, road or task work',
    method:'weighted isotonic projection of every x-profile over z=-222..-174 with <=0.48 m uphill rise per 4 m in the full-strength zone; 12 m longitudinal entry/exit ramps; planimetric drainage carriers unchanged; no arbitrary amplitude clamp',
    logicCorrection:'R19 and the first R20 attempt incorrectly constrained correction-field derivative/amplitude even though cancelling a multi-metre baseline wall necessarily requires a large opposite correction; R20 gates repaired final terrain plus spatial support instead',
    referenceUse:'user references and MrRolord hierarchy are used only to require continuous source-to-slope morphology and drainage-first landform logic; no dimensions are extracted',
    evidenceClass:'synthetic macro-landform continuity repair; not surveyed Yunnan microtopography, channel section or hydraulic state',
    forbiddenClaims:['surveyed upper-slope section','measured channel section','active flow','regional terrace dimensions','field microtopography truth','soil/sediment property','ownership']
  }
};
