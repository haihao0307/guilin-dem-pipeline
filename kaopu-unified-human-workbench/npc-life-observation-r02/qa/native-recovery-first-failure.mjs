/** Reproduce the rejected absolute-local-quaternion FK without reverting code. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.NPC_NATIVE_FIXTURE_ONLY='1';
const {actors,source,THREE,NativeRig,RigidPoseSampler,geometryAt,rotate,add,scale,qa,project,sourceHashes,hash}=await import('./native-frame-recovery.mjs');
const startedAt=new Date().toISOString(),legacyFile=path.join(project,'npc-life-observation-r01/NativeBinding.mjs');
const legacySource=fs.readFileSync(legacyFile,'utf8').replace(/^import .*;$/gm,'').replace('export {THREE};','').replaceAll('export class ','class ');
const LegacySampler=new Function('THREE',legacySource+';return RigidPoseSampler;')(THREE);
const actor=actors.find(a=>a.id==='A'),oldSampler=new LegacySampler(actor.binding.rig),fixedSampler=new RigidPoseSampler(actor.binding.rig);
actor.rest();actor.setSide('L');actor.root.position.set(-.12,actor.floorOffset,.10);
const oldRest=oldSampler.pack(actor.rig.posedMatrices),fixedRest=fixedSampler.pack(actor.rig.posedMatrices);
const shape=geometryAt(-35*Math.PI/180),frame={palm:shape.palm,forward:rotate([1,0,0],shape.q)};
const handle=add(shape.center,scale(shape.palm,-.032)),withdrawal=add(add(handle,scale(shape.palm,-.12)),[0,.03,0]);
actor.setReach(withdrawal,0,'L',frame);
const oldFrom=oldSampler.pack(actor.rig.posedMatrices),fixedFrom=fixedSampler.pack(actor.rig.posedMatrices),t=(1/120)/.65,ease=t*t*t*(10+t*(-15+6*t));
function evaluate(sampler,from,to){
  const rig=new NativeRig(actor.binding.rig);rig.applySkinMatrices(sampler.apply(sampler.interpolate(from,to,ease)));
  const p=m=>[m[3],m[7],m[11]],d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const boneErrors=rig.names.flatMap((name,j)=>{const parent=rig.parents[j];if(parent<0)return[];const restLengthM=d(rig.restP[j],rig.restP[parent]),posedLengthM=d(p(rig.posedMatrices[j]),p(rig.posedMatrices[parent]));
    return[{joint:name,parent:rig.names[parent],errorM:Math.abs(posedLengthM-restLengthM),restLengthM,posedLengthM}];}).sort((a,b)=>b.errorM-a.errorM);
  const footJointErrorsM=Object.fromEntries(['L','R'].map(s=>{const j=rig.index.get('foot.'+s);return[s,d(p(rig.posedMatrices[j]),rig.restP[j])];}));
  return{maxBoneLengthErrorM:rig.validate().maxBoneLengthError,footJointErrorsM,worstBones:boneErrors.slice(0,8)};
}
const legacy=evaluate(oldSampler,oldFrom,oldRest),fixed=evaluate(fixedSampler,fixedFrom,fixedRest);
const residuals=actor.binding.rig.restMatrices.map((m,j)=>{
  let e=0;for(let a=0;a<3;a++)for(let b=0;b<3;b++){let v=0;for(let k=0;k<3;k++)v+=m[a*4+k]*m[b*4+k];e=Math.max(e,Math.abs(v-(a===b?1:0)));}
  return{joint:actor.binding.rig.names[j],maxRotationOrthogonalityResidual:e};
}).sort((a,b)=>b.maxRotationOrthogonalityResidual-a.maxRotationOrthogonalityResidual);
assert(legacy.maxBoneLengthErrorM>1e-8,'The rejected method must reproduce the actual bone-length failure');
assert(fixed.maxBoneLengthErrorM<1e-8,'The repaired native-delta FK must retain the measured native bone lengths');
assert(Math.max(...Object.values(fixed.footJointErrorsM))<1e-8,'The repaired native-delta FK must retain exact planted foot joints');
const report={schema:'npc-native-recovery-first-failure/1',originalCandidatePassed:false,reproductionSucceeded:true,
  evidence:'The original assertion did not print its value. This artifact measures the same rejected absolute-local-quaternion FK using the retained R01 implementation; production R02 files are not reverted.',
  originalAssertion:'AssertionError [ERR_ASSERTION]: A fixed bone lengths at geometryCheck (first recovery update)',
  rigBaselineHead:source.sourceHead,actor:'A',side:'L',windowDegrees:-35,withdrawalM:.12,withdrawalUpM:.03,recoveryTimeS:1/120,recoveryDurationS:.65,
  sourceUnderTest:{sourceHashes,legacyAlgorithmSource:'npc-life-observation-r01/NativeBinding.mjs',legacyAlgorithmHash:hash(legacyFile),startedAt,completedAt:new Date().toISOString()},
  boneAndFootJointLimitM:1e-8,legacy,fixed,restRotationResiduals:residuals.slice(0,5),
  cause:'Generated original rest matrices contain tiny non-orthogonal residuals. Normalizing absolute parent-local rotations while retaining parent-local translations removes those residuals and changes the effective native bind-vector length. This is unrelated to window surface clearance.',
  fix:'Pack normalized relative skin rotation deltas (posedWorld * originalInverseBind), interpolate their local quaternions, then use the original world rest-joint pivots for FK exactly as NativeRig.fk. Preserve all original rest matrices, inverse binds, child translations, geometry and CSR weights.'};
fs.writeFileSync(path.join(qa,'native-recovery-first-failure.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
