/** Focused real-controller cancellations required by the new native prepose:
 * first pose leg, entering leg and the existing moving held-window exit.
 * No source monkey patch, physics override or speculative cancellation grid. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {LifeWorld,DIM} from '../LifeWorld.mjs';
process.env.NPC_NATIVE_FIXTURE_ONLY='1';
const {actors,source,qa,sourceHashes,geometrySourceHashes}=await import('./native-frame-recovery.mjs');
const startedAt=new Date().toISOString(),dt=1/120,results=[];
const cases=[{id:'prepose-0.1s',actorId:'A',side:'L',approachTime:.1},{id:'prepose-0.1s-support-off',actorId:'A',side:'L',approachTime:.1,support:false},
  ...[{actorId:'A',side:'L'},{actorId:'B',side:'L'},{actorId:'C',side:'L'},{actorId:'A',side:'L',pair:true},{actorId:'B',side:'R',pair:true}]
    .map(s=>({...s,id:'entry-1.475s-'+s.actorId+(s.pair?'-pair':''),approachTime:1.15+.325})),
  {id:'held-minus8deg',actorId:'A',side:'L'}];
for(const test of cases){
  for(const [i,a] of actors.entries()){a.rest();a.setSide('L');a.root.position.set(1.5+i*.6,a.floorOffset,-.13);}
  const actor=actors.find(a=>a.id===test.actorId);actor.setSide(test.side);actor.root.position.set(test.pair&&test.actorId==='B'?.60:-.12,actor.floorOffset,{A:.10,B:.05,C:.08}[actor.id]);
  const world=new LifeWorld(actors),window=world.window,a=window.agents.get(actor.id);if(test.support===false)world.setSupport(false);
  const r={case:test,station:actor.root.position.toArray(),samples:0,stages:{},cancel:null,maxOtherSolidPenetrationM:0,maxOperatedHandlePenetrationM:0,
    maxBoneErrorM:0,maxFootJointErrorM:0,maxFootSurfaceErrorM:0,maxPalmErrorM:0,clampedSamples:0,
    minimumTableSignedDistanceM:Infinity,minimumBottleSignedDistanceM:Infinity,worstOther:null,worstOperated:null};
  assert(window.request(actor.id,'open','native-prepose-cancel-cross-object'));
  for(let step=0;step<4800;step++){
    world.tick(dt);const deg=window.angle()*180/Math.PI;
    const trigger=test.approachTime!==undefined?a.phase==='approach'&&a.phaseTime>=test.approachTime:window.heldBy===actor.id&&deg< -8&&deg> -30;
    if(!r.cancel&&trigger){
      const d=actor.diagnostics();r.cancel={time:world.time,phase:a.phase,phaseTime:a.phaseTime,angleDeg:deg,angularVelocity:window.leaf.angularVelocity.toArray(),
        actualPalm:d.palm,grip:d.grip01,firstContactErrorM:a.firstContactErrorM,nativeTransition:d.reachTransition};
      assert(window.cancel(actor.id));r.cancel.recoveryMode=a.recovery?.mode??null;r.cancel.recoveryPhase=a.recovery?.phase??null;
      r.cancel.after={heldBy:window.heldBy,reservedBy:window.reservedBy,gripPresent:!!window.grip,hingePresent:world.world.constraints.includes(window.hinge),nativeTransition:actor.hasReachTransition()};
    }
    world.table.updateAABB();const bounds=world.table.aabb,operated=window.handleCylinder(),others=window.otherCylinders();
    const d=actor.diagnostics({bottle:operated,solidBoxes:window.solidBoxes(),solidCylinders:others,tableTopY:DIM.tableTop,
      tableBounds:{minX:bounds.lowerBound.x,maxX:bounds.upperBound.x,minZ:bounds.lowerBound.z,maxZ:bounds.upperBound.z}});
    assert(d.finite&&d.boneLengthErrorM<1e-8&&d.footJointErrorM<1e-8);assert(d.solidByCylinder['bottle-01']?.sampleCount>0);
    const stage=a.recovery?a.recovery.phase:a.phase==='approach'?(d.reachTransition?'approach-native-prepose':'approach-entry'):a.phase;
    r.samples++;r.stages[stage]=(r.stages[stage]||0)+1;r.maxBoneErrorM=Math.max(r.maxBoneErrorM,d.boneLengthErrorM);r.maxFootJointErrorM=Math.max(r.maxFootJointErrorM,d.footJointErrorM);
    r.maxFootSurfaceErrorM=Math.max(r.maxFootSurfaceErrorM,d.footSurfaceErrorM);r.maxPalmErrorM=Math.max(r.maxPalmErrorM,d.handErrorM);if(d.reachClamped)r.clampedSamples++;
    const table=d.solidByBox['table-top'];if(table)r.minimumTableSignedDistanceM=Math.min(r.minimumTableSignedDistanceM,table.minimumSignedDistanceM);
    r.minimumBottleSignedDistanceM=Math.min(r.minimumBottleSignedDistanceM,d.solidByCylinder['bottle-01'].minimumSignedDistanceM);
    const evidence=()=>({stage,time:world.time,angleRad:window.angle(),actualPalm:d.palm,operatedCylinder:operated,otherCylinders:others,heldBy:window.heldBy,nativeTransition:d.reachTransition});
    if(d.solidMaxPenetrationM>r.maxOtherSolidPenetrationM){r.maxOtherSolidPenetrationM=d.solidMaxPenetrationM;r.worstOther={...evidence(),...d.solidDeepest,penetrationM:d.solidMaxPenetrationM};}
    if(d.bottleMaxPenetrationM>r.maxOperatedHandlePenetrationM){r.maxOperatedHandlePenetrationM=d.bottleMaxPenetrationM;r.worstOperated={...evidence(),pointWorld:d.bottleDeepestPointWorld,vertex:d.bottleDeepestVertex,penetrationM:d.bottleMaxPenetrationM};}
    if(r.cancel&&!a.recovery&&!actor.hasRecovery()&&!actor.hasReachTransition())break;
  }
  r.finalPhase=a.phase;r.finalRestPoseErrorRad=actor.diagnostics().restPoseErrorRad;r.finalAngleDeg=window.angle()*180/Math.PI;
  r.angularTravelAfterCancelDeg=r.cancel?r.finalAngleDeg-r.cancel.angleDeg:null;
  r.ownership={heldBy:window.heldBy,reservedBy:window.reservedBy,gripPresent:!!window.grip,hingePresent:world.world.constraints.includes(window.hinge)};
  r.completed=!!r.cancel&&!a.recovery&&!actor.hasRecovery()&&!actor.hasReachTransition();
  r.passed=r.completed&&a.phase==='cancelled'&&r.maxOtherSolidPenetrationM<=.003&&r.maxOperatedHandlePenetrationM<=.005&&r.clampedSamples===0&&r.finalRestPoseErrorRad<1e-5&&
    !window.heldBy&&!window.reservedBy&&!window.grip&&r.ownership.hingePresent;
  results.push(r);console.log('CANCEL '+JSON.stringify(r));
}
const report={schema:'npc-native-window-cancel-cross-object/1',rigBaselineHead:source.sourceHead,startedAt,completedAt:new Date().toISOString(),sourceHashes,geometrySourceHashes,
  passed:results.every(r=>r.passed),tolerances:{otherSolidsM:.003,operatedHandleM:.005,boneAndFootJointM:1e-8},results,
  scope:'Eight bounded actual production cancel paths with every 1/120s native weighted hand/forearm surface sample. Includes first-leg A cancellation with/without support, second-leg cancellation at the same 1.475s time at five fixed window workstations, and existing A held moving-leaf cancellation. All rigid bodies follow production Cannon without pose/force edits. This is not the complete R07 GPU/render proof.'};
fs.writeFileSync(path.join(qa,'native-window-cancel-cross-object.json'),JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify({passed:report.passed,cases:results.length}));
