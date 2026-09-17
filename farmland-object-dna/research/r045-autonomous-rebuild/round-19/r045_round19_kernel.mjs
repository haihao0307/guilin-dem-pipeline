import * as R18 from '../round-18/r045_round18_kernel.mjs';
export * from '../round-18/r045_round18_kernel.mjs';

export const VERSION='R045.19';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R045.19 rejects the tempting QA-overfit shortcut "smooth the z≈-202 row". A row patch could
// make one sampled wall disappear while creating a new horizontal band or erasing source/drainage
// structure. Instead this round detects the inherited positive longitudinal-rise debt over a broad
// upper-slope band, smooths its cross-slope activation, and blends only affected interfluves toward
// a continuous endpoint chord. The complete drainage skeleton remains protected.
export const wallRepairBand={z0:-218,z1:-182,anchor0:-216,anchor1:-184};

function forwardRise4(x,z){return R18.height(x,z+4)-R18.height(x,z)}
function rawWallDebt(x){
  let e=0;
  for(let z=-214;z<=-190;z+=4)e=Math.max(e,forwardRise4(x,z)-.24);
  return C(e,0,1.25);
}
export function wallDebtWeight(x){
  const offsets=[-24,-12,0,12,24],weights=[1,2,3,2,1];
  let s=0,w=0;
  for(let i=0;i<offsets.length;i++){s+=rawWallDebt(x+offsets[i])*weights[i];w+=weights[i]}
  return S(.055,.38,s/(w||1));
}
function continuityChord(x,z){
  const a=wallRepairBand.anchor0,b=wallRepairBand.anchor1;
  const y0=R18.height(x,a),y1=R18.height(x,b),t=C((z-a)/(b-a),0,1);
  return M(y0,y1,t);
}
export function upperWallContinuityRepairDelta(x,z){
  if(z<=wallRepairBand.z0||z>=wallRepairBand.z1)return 0;
  const debt=wallDebtWeight(x);if(debt<=0)return 0;
  const env=S(-218,-210,z)*(1-S(-192,-182,z));
  if(env<=0)return 0;
  const drainClear=S(11.5,42,R18.nearestExtendedDrainageDistance(x,z));
  if(drainClear<=0)return 0;
  const base=R18.height(x,z),target=continuityChord(x,z);
  return C((target-base)*.80*debt*env*drainClear,-.78,.78);
}

export function height(x,z){return R18.height(x,z)+upperWallContinuityRepairDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R18.terracePermission(x,z)}
export function suitability(x,z){
  if(z>=-180)return R18.suitability(x,z);
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R18.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R18.riverW(x)+4,R18.riverW(x)+18,Math.abs(z-R18.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

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
    method:'broad debt-detected interfluve continuity blend over z=-218..-182; activation smoothed across x; full drainage skeleton protected inside 11.5 m and eased to 42 m',
    logicCorrection:'a single z≈-202 row smoothing would overfit the QA sampling grid and can manufacture a new horizontal band; this repair responds to a band-wide baseline rise field instead',
    referenceUse:'user references constrain continuous source-to-slope hierarchy and non-banded morphology only; no metric extraction',
    evidenceClass:'synthetic macro-landform continuity repair; not surveyed Yunnan microtopography or hydraulic geometry',
    forbiddenClaims:['surveyed upper-slope section','measured channel section','active flow','regional terrace dimensions','field microtopography truth','soil/sediment property','ownership']
  }
};
