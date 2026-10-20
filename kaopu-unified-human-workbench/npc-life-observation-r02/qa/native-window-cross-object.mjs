/** Actual native people + production hinged window; the bottle remains a real
 * separate rigid body. No window pose writes, changed forces or actor scaling. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {LifeWorld} from '../LifeWorld.mjs';
process.env.NPC_NATIVE_FIXTURE_ONLY='1';
const {actors,source,qa,sourceHashes,geometrySourceHashes}=await import('./native-frame-recovery.mjs');
const startedAt=new Date().toISOString(),dt=1/120,results=[];
for(const actor of actors){
  for(const [i,a] of actors.entries()){a.rest();a.setSide('L');a.root.position.set(1.5+i*.6,a.floorOffset,-.13);}
  actor.root.position.set(-.12,actor.floorOffset,{A:.10,B:.05,C:.08}[actor.id]);
  const world=new LifeWorld(actors),window=world.window,a=window.agents.get(actor.id);
  for(const operation of ['open','close']){
    const r={actor:actor.id,operation,station:actor.root.position.toArray(),side:actor.side,samples:0,
      maxOtherSolidPenetrationM:0,maxOperatedHandlePenetrationM:0,minBottleSignedDistanceM:Infinity,
      maxBoneErrorM:0,maxFootJointErrorM:0,clampedOutsideApproach:0,approachClampedSamples:0,
      stages:{},worstOther:null,worstOperated:null};
    assert(window.request(actor.id,operation,'native-window-cross-object'));
    for(let step=0;step<4800;step++){
      world.tick(dt);const stage=a.recovery?(a.recovery.phase==='rest'?'rest':'withdraw'):a.phase;
      const operated=window.handleCylinder(),other=window.otherCylinders();
      const d=actor.diagnostics({bottle:operated,solidBoxes:window.solidBoxes(),solidCylinders:other});
      assert(d.finite);assert(d.boneLengthErrorM<1e-8);assert(d.footJointErrorM<1e-8);
      assert(d.solidByCylinder['bottle-01']?.sampleCount>0,'Real non-operated bottle surface must be evaluated');
      assert(d.solidParts.hand.sampleCount>0&&d.solidParts.forearm.sampleCount>0);
      r.samples++;r.stages[stage]=(r.stages[stage]||0)+1;r.maxBoneErrorM=Math.max(r.maxBoneErrorM,d.boneLengthErrorM);r.maxFootJointErrorM=Math.max(r.maxFootJointErrorM,d.footJointErrorM);
      r.minBottleSignedDistanceM=Math.min(r.minBottleSignedDistanceM,d.solidByCylinder['bottle-01'].minimumSignedDistanceM);
      if(d.reachClamped){if(stage==='approach')r.approachClampedSamples++;else r.clampedOutsideApproach++;}
      const evidence=()=>({stage,time:world.time,angleRad:window.angle(),heldBy:window.heldBy,palm:d.palm,otherCylinders:other,operatedCylinder:operated});
      if(d.solidMaxPenetrationM>r.maxOtherSolidPenetrationM){r.maxOtherSolidPenetrationM=d.solidMaxPenetrationM;r.worstOther={...evidence(),...d.solidDeepest,penetrationM:d.solidMaxPenetrationM};}
      if(d.bottleMaxPenetrationM>r.maxOperatedHandlePenetrationM){r.maxOperatedHandlePenetrationM=d.bottleMaxPenetrationM;r.worstOperated={...evidence(),pointWorld:d.bottleDeepestPointWorld,vertex:d.bottleDeepestVertex,penetrationM:d.bottleMaxPenetrationM};}
      if(['done','failed','cancelled'].includes(a.phase)&&!a.recovery&&!actor.hasRecovery()&&!actor.hasReachTransition())break;
    }
    r.result=a.result;r.finalPhase=a.phase;r.finalAngleDeg=window.angle()*180/Math.PI;r.finalRestPoseErrorRad=actor.diagnostics().restPoseErrorRad;
    r.ownership={heldBy:window.heldBy,reservedBy:window.reservedBy,gripPresent:!!window.grip,hingePresent:world.world.constraints.includes(window.hinge)};
    r.passed=a.phase==='done'&&r.maxOtherSolidPenetrationM<=.003&&r.maxOperatedHandlePenetrationM<=.005&&r.clampedOutsideApproach===0&&r.approachClampedSamples===0&&r.finalRestPoseErrorRad<1e-5&&
      !window.heldBy&&!window.reservedBy&&!window.grip&&r.ownership.hingePresent;
    results.push(r);console.log('WINDOW '+JSON.stringify(r));
  }
}
const report={schema:'npc-native-window-cross-object/1',rigBaselineHead:source.sourceHead,startedAt,completedAt:new Date().toISOString(),sourceHashes,geometrySourceHashes,
  passed:results.every(r=>r.passed),operatedObjectId:'window-handle-01',otherCylinderId:'bottle-01',tolerances:{otherSolidsM:.003,operatedHandleM:.005,boneAndFootJointM:1e-8},results,
  scope:'Three complete production open/close sequences in the real LifeWorld/Cannon world. All actual native weighted hand and forearm vertices sampled every 1/120s, including withdrawal and native rest. No window/body pose overrides or altered force limits. Full R07 head/material/GPU acceptance remains the independent Chromium gate.'};
fs.writeFileSync(path.join(qa,'native-window-cross-object.json'),JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify({passed:report.passed,cases:results.length}));
