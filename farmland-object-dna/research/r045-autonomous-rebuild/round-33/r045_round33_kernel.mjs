import * as R32 from '../round-32/r045_round32_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-32/r045_round32_kernel.mjs';

export const VERSION='R045.33';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R32's fixed-view plan still reads as separated terrace islands. The first R33 attempt changed both the
// drainage shoulder and the terrace quantization frame; QA showed a sampled R33-R32 surface change of 0.844 m.
// That mixed two causal variables and exceeded the bounded-change gate. Final R33 therefore isolates one
// hypothesis only: the synthetic 16->34 m soft drainage shoulder is too broad. All R32 family envelopes,
// terrace step/phase values and vertical amplitude are kept identical; only the soft shoulder becomes 12->24 m.
// The <=12 m inherited drainage carrier core remains completely untouched.
export const terraceGroups=R32.terraceGroups;
export function terraceGroupWeights(x,z){return R32.terraceGroupWeights(x,z)}
export function terraceGroupEnvelope(x,z){return R32.terraceGroupEnvelope(x,z)}
export function dominantTerraceGroup(x,z){return R32.dominantTerraceGroup(x,z)}
export function broadTerraceEligibility(x,z){return R32.broadTerraceEligibility(x,z)}
export function permissionBridge(x,z){return R32.permissionBridge(x,z)}

export function terraceDrainageClearance(x,z){return S(12,24,R30.nearestExtendedDrainageDistance(x,z))}
export function terraceGroupMask(x,z){
  const group=R32.terraceGroupEnvelope(x,z);if(group<=0)return 0;
  const drainClear=terraceDrainageClearance(x,z);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R30.riverZ(x));
  const riverClear=S(R30.riverW(x)+18,R30.riverW(x)+44,riverGap);if(riverClear<=0)return 0;
  return C(group*drainClear*riverClear*R32.permissionBridge(x,z),0,1);
}

// Preserve the verified R32 quantization family exactly, so this round tests support continuity rather than
// accidentally shifting terrace elevation bands. Only the mask is replaced.
export function terraceFrameAt(x,z){const old=R32.terraceStateAt(x,z);return{step:old.step,phase:old.phase}}
export function terraceStateAt(x,z){
  const old=R32.terraceStateAt(x,z),mask=terraceGroupMask(x,z),delta=.84*mask*old.raw;
  return{...old,mask,delta,target:old.base+delta};
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
    method:'hold the verified R32 family envelopes, terrace step/phase field and 0.84 vertical amplitude exactly fixed, and change only the synthetic drainage clearance from a 16-34 m soft shoulder to a 12-24 m taper while preserving zero terrace modification at <=12 m from inherited drainage carriers',
    logicCorrection:'R32 cluster-like terraces do not prove that risers are too low. Raising risers would amplify isolated islands. It is also invalid to equate protection of a drainage carrier with an arbitrarily wide blank agricultural setback when no surveyed bank/channel section exists. The first R33 attempt additionally mixed shoulder narrowing with a new phase frame, so its 0.844 m R33-R32 change could not be causally attributed. Final R33 isolates the drainage-shoulder variable and keeps R32 quantization unchanged.',
    failedAttempt:'the first R33 machine run passed 36/37 gates but failed the bounded-change gate: sampled max R33-R32 surface change was 0.8442125319815688 m versus the unchanged <0.65 m limit. The wide-support result was not accepted; phase/step blending and smooth-union support were removed instead of relaxing the gate.',
    constraint:'a real terrace-to-channel edge cannot be reconstructed quickly from the current 12.5 m macro DEM and photographs because selected-field microtopography, surveyed channel/bund/riser sections, bankfull width, inlet/outlet sill elevations and event water-management records are absent. The 12 m core and 24 m taper are synthetic QA parameters, not Yunnan engineering dimensions.',
    xiaomaBoundary:'the Xiaoma/TLO intake still lists field location/boundary, field microtopography, bund section, channel section and water-control elevation as unknown; continuity and conservation appearance are not sufficient to establish hydraulic state. R33 creates no water head, depth, discharge or exchange law.',
    mrRolordUse:'the saved frame audit is used for ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming land use/contour bands. R33 lets terraces approach drainage carriers as terrain-conforming land use but does not copy Blender dimensions, Voronoi cells, shader displacement or adaptive subdivision as agricultural truth.',
    referenceUse:'image(173).png was reopened this round. R33 uses only the visible relationship that large contour-following terrace families approach narrow drainage interruptions instead of becoming broad blank islands; no metric terrace width, drainage setback, riser height, channel size or water depth is inferred.',
    evidenceClass:'synthetic drainage-edge terrace stitching on the verified R30 substrate; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed terrace footprint','surveyed terrace width','measured drainage setback','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','known sediment state','regional truth from photograph']
  }
};
