import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-30/r045_round30_kernel.mjs';

export const VERSION='R045.31';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-.5*(x/s)*(x/s));
const G2=(x,z,cx,cz,sx,sz)=>Math.exp(-.5*(((x-cx)/sx)**2+((z-cz)/sz)**2));

// R31 is the first localized synthetic bench+riser pilot. It is deliberately NOT a survey/truth layer.
// The pilot follows the R30 surface/elevation field, not screen-space stripes. Drainage carrier cores stay untouched.
export function terraceStepHeight(x,z){
  return C(1.28 + .18*Math.sin((z+112)/31) + .11*Math.sin((x+58)/43) + .06*Math.sin((x-.42*z)/29),.96,1.62);
}
export function terracePhaseWarp(x,z){
  return .23*Math.sin((x+.54*z)/48)+.13*Math.sin((x-.31*z)/27)+.07*Math.sin((z+84)/19);
}
export function pilotCentre(z){
  const t=C((z+126)/124,0,1);
  return -70 + 32*Math.sin(Math.PI*(.82*t+.08)) + 12*Math.sin(Math.PI*(1.71*t+.31));
}
export function pilotHalfWidth(z){
  const t=C((z+126)/124,0,1);
  return 116 - 28*S(.56,.96,t) + 14*Math.sin(Math.PI*(1.18*t+.17));
}
export function pilotNotchFactor(x,z){
  const cx=-8+18*Math.sin((z+72)/38);
  return 1-.72*G2(x,z,cx,-63,28,25);
}
export function terracePilotMask(x,z){
  const zEnv=S(-130,-116,z)*(1-S(-10,4,z));
  if(zEnv<=0)return 0;
  const c=pilotCentre(z),w=Math.max(42,pilotHalfWidth(z));
  const lateral=1-S(.76,1.04,Math.abs((x-c)/w));
  if(lateral<=0)return 0;
  const drainClear=S(16,34,R30.nearestExtendedDrainageDistance(x,z));
  if(drainClear<=0)return 0;
  const p=R30.terracePermission(x,z),permissionGate=S(.055,.28,p);
  return C(zEnv*lateral*drainClear*permissionGate*pilotNotchFactor(x,z),0,1);
}
function stair01(f){return S(.40,.60,f)}
export function terraceStateAt(x,z){
  const base=R30.height(x,z),step=terraceStepHeight(x,z),phase=terracePhaseWarp(x,z);
  const u=(base+phase)/step,n=Math.floor(u),f=u-n;
  const stair=(n+stair01(f))*step-phase;
  const mask=terracePilotMask(x,z);
  const raw=stair-base;
  const delta=.88*mask*raw;
  const riserStrength=S(.34,.43,f)*(1-S(.57,.66,f));
  const benchStrength=Math.max(S(.39,.25,f),S(.61,.75,f));
  return{base,step,phase,u,index:n,frac:f,mask,raw,delta,riserStrength,benchStrength,target:base+delta};
}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

// Permission remains an eligibility field, but geometry now consumes only a bounded local subset of it.
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={
  ...R30.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,
  round31:{
    scope:'first localized synthetic bench+riser terrace pilot on the verified R30 one-sided agricultural slope; parcels and hydraulics remain locked',
    method:'quantize a warped R30 terrain-elevation coordinate into smooth staircase benches and risers inside one irregular pilot envelope; step height and phase vary slowly so contour envelopes are non-parallel, while drainage cores and the foreground receiver are excluded',
    logicCorrection:'R30 numeric/browser success does not prove the lower-slope stage is visually accepted, and weak whole-scene change does not imply that vertical amplitude should be increased. After reopening the R30 fixed view, the substrate is stable enough for a bounded terrace morphology experiment, not for declaring terrain truth.',
    stageAdvanceReason:'R30 fixed-view evidence was actually reopened before this implementation. It shows no new seam, wall or receiver break, but still reads broad and smooth. Continuing indefinite substrate amplitude tuning would confound shape with visibility; R31 therefore advances one priority step with a localized reversible pilot while global visualAcceptance remains false.',
    xiaomaBoundary:'the Xiaoma/TLO checkpoint still lacks selected-field microtopography, surveyed bund/channel sections and water-control elevations. Therefore R31 bench spacing, riser transition and pilot footprint are synthetic morphology only and cannot be treated as Yunnan engineering dimensions or hydraulic truth.',
    mrRolordUse:'the saved frame audit is reread for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming land use. Voronoi cells, Blender dimensions, shader displacement and adaptive subdivision are not copied as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. Only visible irregular nested bench envelopes, varying widths, non-parallel curves and local skips/merges motivate the morphology; no metric terrace width, riser height, channel dimension or water depth is inferred.',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
