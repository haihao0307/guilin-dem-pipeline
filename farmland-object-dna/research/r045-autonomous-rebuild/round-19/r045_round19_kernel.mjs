import * as R18 from '../round-18/r045_round18_kernel.mjs';
export * from '../round-18/r045_round18_kernel.mjs';

export const VERSION='R045.19';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R045.19 rejects two shortcuts:
// 1) smoothing only the sampled z≈-202 row would overfit the QA grid and can create a new band;
// 2) demanding a tiny correction-field derivative while cancelling a 3 m baseline wall is
//    mathematically contradictory. Acceptance must be evaluated on the repaired terrain.
// The repair therefore projects each broad upper-slope longitudinal profile onto the nearest
// profile whose forward rise is capped, then applies that projection only outside the protected
// drainage core. This acts across a band, not on one QA row.
export const wallRepairBand={z0:-222,z1:-174,node0:-220,node1:-174,nodeStep:2,allowedRisePer2m:.24};

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
  const zs=[],base=[];for(let z=wallRepairBand.node0;z<=wallRepairBand.node1+1e-9;z+=wallRepairBand.nodeStep){zs.push(z);base.push(R18.height(x,z))}
  const limit=wallRepairBand.allowedRisePer2m;
  const transformed=base.map((h,i)=>h-i*limit);
  const weights=base.map((_,i)=>i<3||i>base.length-4?10:1);
  const projected=isotonicNonIncreasing(transformed,weights).map((g,i)=>g+i*limit);
  const p={zs,base,projected};profileCache.set(key,p);return p;
}
function projectedHeight(x,z){
  const p=constrainedProfile(x),step=wallRepairBand.nodeStep;
  if(z<=p.zs[0])return p.projected[0];if(z>=p.zs[p.zs.length-1])return p.projected[p.projected.length-1];
  const u=(z-p.zs[0])/step,i=Math.floor(u),t=u-i;
  return M(p.projected[i],p.projected[i+1],t);
}
export function wallDebtWeight(x){
  const p=constrainedProfile(x);let maxViolation=0;
  for(let i=0;i<p.base.length-2;i++)maxViolation=Math.max(maxViolation,p.base[i+2]-p.base[i]-.48);
  return S(.03,.55,maxViolation);
}
export function upperWallContinuityRepairDelta(x,z){
  if(z<=wallRepairBand.z0||z>=wallRepairBand.z1)return 0;
  const env=S(-222,-216,z)*(1-S(-180,-174,z));if(env<=0)return 0;
  const d=R18.nearestExtendedDrainageDistance(x,z),drainClear=S(11.5,16,d);if(drainClear<=0)return 0;
  const base=R18.height(x,z),target=projectedHeight(x,z);
  return C((target-base)*env*drainClear,-3.2,3.2);
}

export function height(x,z){return R18.height(x,z)+upperWallContinuityRepairDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R18.terracePermission(x,z)}
export function suitability(x,z){return R18.suitability(x,z)}

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
  round19:{
    scope:'repair inherited upper-slope longitudinal wall debt and source-hollow-to-convergence continuity only; no terrace/parcel/irrigation work',
    method:'weighted isotonic profile projection over z=-220..-174 with <=0.48 m forward rise per 4 m target; exact drainage core protection through 11.5 m and smooth transition to full repair by 16 m',
    logicCorrection:'a single z≈-202 row patch would overfit QA; additionally, requiring a tiny correction derivative while cancelling a multi-metre baseline wall confuses correction magnitude with final-terrain continuity',
    referenceUse:'user references constrain continuous source-to-slope hierarchy and non-banded morphology only; no metric extraction',
    evidenceClass:'synthetic macro-landform continuity repair; not surveyed Yunnan microtopography or hydraulic geometry',
    forbiddenClaims:['surveyed upper-slope section','measured channel section','active flow','regional terrace dimensions','field microtopography truth','soil/sediment property','ownership']
  }
};
