import * as R31 from '../round-31/r045_round31_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-31/r045_round31_kernel.mjs';

export const VERSION='R045.32';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G2=(x,z,cx,cz,sx,sz)=>Math.exp(-.5*(((x-cx)/sx)**2+((z-cz)/sz)**2));

// R32 consolidates the scattered R31 terrace pilot into three overlapping, nested terrace groups.
// It deliberately changes planform/support more than vertical amplitude. The groups remain synthetic,
// terrain-following morphology; drainage cores and the foreground receiver remain hard exclusions.
export const terraceGroups=[
  {id:'lower',z0:-130,z1:-67,c0:-104,sweep:34,w0:118,w1:142,bend:23,phase:.28},
  {id:'middle',z0:-113,z1:-26,c0:-76,sweep:43,w0:126,w1:136,bend:-18,phase:1.16},
  {id:'upper',z0:-86,z1:3,c0:-49,sweep:31,w0:112,w1:94,bend:16,phase:2.04}
];
function groupSupport(g,x,z){
  if(z<=g.z0||z>=g.z1)return 0;
  const t=C((z-g.z0)/(g.z1-g.z0),0,1);
  const env=S(g.z0,g.z0+14,z)*(1-S(g.z1-14,g.z1,z));
  const centre=g.c0+g.sweep*S(.05,.95,t)+g.bend*Math.sin(Math.PI*(.78*t)+g.phase)+8*Math.sin(Math.PI*(1.63*t)+.4*g.phase);
  const half=M(g.w0,g.w1,S(.04,.96,t))*(1+.10*Math.sin(Math.PI*(1.22*t)+g.phase));
  const lateral=1-S(.76,1.04,Math.abs((x-centre)/(half||1)));
  // weak morphological insets create local merges/skips without turning the support into disconnected islands
  const insetA=1-.34*G2(x,z,centre+.26*half,M(g.z0,g.z1,.44),.24*half,17);
  const insetB=1-.22*G2(x,z,centre-.38*half,M(g.z0,g.z1,.70),.20*half,14);
  return C(env*lateral*insetA*insetB,0,1);
}
export function terraceGroupWeights(x,z){return terraceGroups.map(g=>groupSupport(g,x,z))}
export function terraceGroupEnvelope(x,z){return Math.max(...terraceGroupWeights(x,z))}
export function dominantTerraceGroup(x,z){const w=terraceGroupWeights(x,z);let k=0;for(let i=1;i<w.length;i++)if(w[i]>w[k])k=i;return{index:k,id:terraceGroups[k].id,weight:w[k],weights:w}}

// R31 multiplied by the stricter R30 permission field, which produced visually tiny islands.
// R32 may bridge only small permission holes where the R30 substrate itself is still a plausible slope;
// it never bridges a drainage core. This is a morphology continuity rule, not a survey claim.
export function broadTerraceEligibility(x,z){
  if(z<-132||z>8||Math.abs(x)>214)return 0;
  const g=R30.gradient(x,z),s=g.mag;
  const slopeBand=S(.032,.068,s)*(1-S(.33,.46,s));
  const faceForward=1-S(.58,1.03,Math.abs(g.dx)/(Math.abs(g.dz)+.065));
  const curvatureSoft=1-S(.040,.105,Math.abs(R30.curvature(x,z)));
  const geom=S(-132,-116,z)*(1-S(-8,7,z));
  return C(slopeBand*(.54+.46*faceForward)*(.58+.42*curvatureSoft)*geom,0,1);
}
export function permissionBridge(x,z){
  const strict=S(.035,.24,R30.terracePermission(x,z));
  const broad=S(.16,.55,broadTerraceEligibility(x,z));
  return C(Math.max(strict,.62*broad),0,1);
}
export function terraceGroupMask(x,z){
  const group=terraceGroupEnvelope(x,z);if(group<=0)return 0;
  const drainClear=S(16,34,R30.nearestExtendedDrainageDistance(x,z));if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R30.riverZ(x));
  const riverClear=S(R30.riverW(x)+18,R30.riverW(x)+44,riverGap);if(riverClear<=0)return 0;
  return C(group*drainClear*riverClear*permissionBridge(x,z),0,1);
}

function stair01(f){return S(.385,.615,f)}
export function terraceStateAt(x,z){
  const base=R30.height(x,z);
  const grp=dominantTerraceGroup(x,z);
  // Keep the R31 elevation-coordinate method but add a slow group-dependent phase drift so neighboring
  // groups nest/merge rather than reading as one globally repeated stripe family.
  const step=R31.terraceStepHeight(x,z)*(1+[.04,-.025,.02][grp.index]);
  const phase=R31.terracePhaseWarp(x,z)+[.12,-.08,.05][grp.index]+.055*Math.sin((z+1.7*x)/39+grp.index*.9);
  const u=(base+phase)/step,n=Math.floor(u),f=u-n;
  const stair=(n+stair01(f))*step-phase;
  const mask=terraceGroupMask(x,z);
  const raw=stair-base;
  const delta=.91*mask*raw;
  const riserStrength=S(.33,.43,f)*(1-S(.57,.67,f));
  const benchStrength=Math.max(S(.40,.24,f),S(.60,.76,f));
  return{base,step,phase,u,index:n,frac:f,mask,raw,delta,riserStrength,benchStrength,target:base+delta,group:grp.id,groupIndex:grp.index,groupWeight:grp.weight};
}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

// This remains eligibility only. R32 creates no parcel identity, bund ownership, inlet/outlet, water depth or flow.
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={
  ...R31.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,
  round32:{
    scope:'consolidate the R31 localized bench+riser pilot into three overlapping nested terrace groups across the one-sided agricultural slope while preserving drainage corridors; parcels and hydraulics remain locked',
    method:'replace the fragmented strict-permission-only support with three unequal curved group envelopes plus a bounded soft eligibility bridge on the R30 substrate; quantize the same terrain-elevation coordinate with small group phase offsets so benches merge/split without global parallel repetition',
    logicCorrection:'R31 terraces being difficult to read in the whole-scene view does not prove that larger riser height is required. The R31 audit shows the stronger defect is fragmented support: enlarging vertical amplitude alone would make isolated terrace islands more obvious, not make the terrace system more coherent.',
    constraint:'a real terrace network cannot be recovered quickly from the current 12.5 m macro DEM and photographs because selected-field microtopography, measured bund/riser/channel sections, inlet/outlet sill elevations and event water-management records are still absent. R32 therefore tests synthetic morphology only.',
    xiaomaBoundary:'the Xiaoma learning record explicitly warns that conservation/continuous appearance is not sufficient for correct water head, exchange law or event state, and that same-datum field microtopography plus control-section calibration are still missing. R32 creates no hydraulic state.',
    mrRolordUse:'the saved study is used only for process ordering: drainage hierarchy -> accumulated terrain influence -> terrain-conforming land use/contour bands. Voronoi cells, Blender dimensions, shader displacement and adaptive subdivision are not treated as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R32 uses only its visible large connected contour-following terrace families, unequal widths, curved nesting, local merges and drainage interruptions; no metric terrace width, riser height, channel size or water depth is inferred.',
    evidenceClass:'synthetic nested terrace morphology on the verified R30 substrate; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
