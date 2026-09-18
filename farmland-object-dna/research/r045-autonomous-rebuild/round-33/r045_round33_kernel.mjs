import * as R32 from '../round-32/r045_round32_kernel.mjs';
import * as R31 from '../round-31/r045_round31_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-32/r045_round32_kernel.mjs';

export const VERSION='R045.33';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R32 proved that widening terrace-family envelopes alone is not sufficient: its fixed-view plan still reads
// as separated islands. The main synthetic cause is not insufficient riser height but the 16->34 m soft
// drainage setback applied on both sides of every inherited carrier. A carrier core must remain protected,
// but that does not logically require a very wide blank agricultural corridor. R33 therefore keeps a hard
// 12 m drainage core and lets terrace benches taper back toward the carrier between 12 and 24 m.
// This is a reversible morphology experiment, not a claim about surveyed channel/bund setbacks.
export const terraceGroups=R32.terraceGroups;
export function terraceGroupWeights(x,z){return R32.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){
  const w=terraceGroupWeights(x,z),mx=Math.max(...w),u=1-w.reduce((p,v)=>p*(1-C(v,0,1)),1);
  // Smooth union raises overlap shoulders without changing the nominal family extents.
  return C(.86*mx+.28*u,0,1);
}
export function dominantTerraceGroup(x,z){return R32.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R32.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R32.permissionBridge(x,z)}

export function terraceDrainageClearance(x,z){
  return S(12,24,R30.nearestExtendedDrainageDistance(x,z));
}
export function terraceGroupMask(x,z){
  const group=terraceGroupEnvelope(x,z);if(group<=0)return 0;
  const drainClear=terraceDrainageClearance(x,z);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R30.riverZ(x));
  const riverClear=S(R30.riverW(x)+18,R30.riverW(x)+44,riverGap);if(riverClear<=0)return 0;
  return C(group*drainClear*riverClear*permissionBridge(x,z),0,1);
}

function normalizedGroupWeights(x,z){
  const w=terraceGroupWeights(x,z).map(v=>Math.max(0,v));
  const sum=w.reduce((a,b)=>a+b,0);
  if(sum<1e-9){const d=R32.dominantTerraceGroup(x,z).index;return w.map((_,i)=>i===d?1:0)}
  return w.map(v=>v/sum);
}
export function terraceFrameAt(x,z){
  const w=normalizedGroupWeights(x,z);
  const stepScale=w[0]*1.008+w[1]*.996+w[2]*1.004;
  const phaseOffset=w[0]*.018+w[1]*(-.012)+w[2]*.010;
  const blendIndex=w[1]+2*w[2];
  const step=R31.terraceStepHeight(x,z)*stepScale;
  const phase=R31.terracePhaseWarp(x,z)+phaseOffset+.012*Math.sin((z+1.7*x)/52+blendIndex*.55);
  return{step,phase,weights:w,blendIndex};
}
function stair01(f){return S(.40,.60,f)}
export function terraceStateAt(x,z){
  const base=R30.height(x,z),grp=dominantTerraceGroup(x,z),frame=terraceFrameAt(x,z);
  const step=frame.step,phase=frame.phase,u=(base+phase)/step,n=Math.floor(u),f=u-n;
  const stair=(n+stair01(f))*step-phase;
  const mask=terraceGroupMask(x,z),raw=stair-base;
  // Slightly lower than R32: R33 must improve connectivity by planform/support logic, not vertical exaggeration.
  const delta=.82*mask*raw;
  const riserStrength=S(.34,.43,f)*(1-S(.57,.66,f));
  const benchStrength=Math.max(S(.39,.25,f),S(.61,.75,f));
  return{base,step,phase,u,index:n,frac:f,mask,raw,delta,riserStrength,benchStrength,target:base+delta,group:grp.id,groupIndex:grp.index,groupWeight:grp.weight,blendWeights:frame.weights};
}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={
  ...R32.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,
  round33:{
    scope:'reduce the remaining R32 terrace island/cluster reading by stitching benches back toward inherited drainage edges while retaining an untouched hard drainage core; parcels and hydraulics remain locked',
    method:'retain the three R32 unequal nested terrace families, replace max-only family support with a bounded smooth union, narrow only the synthetic soft drainage shoulder from 16-34 m to 12-24 m while keeping the <=12 m carrier core untouched, and phase-lock overlapping families with continuously blended step/phase frames rather than a hard dominant-group phase switch',
    logicCorrection:'R32 cluster-like terraces do not prove that risers are too low. Raising risers would amplify isolated islands. A second invalid shortcut is to equate protection of a drainage carrier with an arbitrarily wide blank setback: without surveyed channel and bank sections, the previous 16-34 m shoulder is synthetic. R33 therefore tests narrower tapering shoulders while preserving the hard carrier core and does not raise terrace amplitude.',
    constraint:'a real terrace-to-channel edge cannot be reconstructed quickly from the current 12.5 m macro DEM and photographs because selected-field microtopography, surveyed channel/bund/riser sections, bankfull width, inlet/outlet sill elevations and event water-management records are absent. The 12 m core and 24 m taper are synthetic QA parameters, not Yunnan engineering dimensions.',
    xiaomaBoundary:'the Xiaoma/TLO intake still lists field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown; continuity and conservation appearance are not sufficient to establish hydraulic state. R33 creates no water head, depth, discharge or exchange law.',
    mrRolordUse:'the saved frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming land use/contour bands. R33 lets terraces approach drainage carriers as terrain-conforming land use but does not copy Blender dimensions, Voronoi cells, shader displacement or adaptive subdivision as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R33 uses only the visible relationship that large contour-following terrace families approach narrow drainage interruptions instead of becoming broad blank islands; no metric terrace width, drainage setback, riser height, channel size or water depth is inferred.',
    evidenceClass:'synthetic drainage-edge terrace stitching on the verified R30 substrate; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured drainage setback','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
