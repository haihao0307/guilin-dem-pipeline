import fs from 'node:fs';
import path from 'node:path';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
const root=globalThis.__CAPTURE_QA_ROOT__,ids=(process.env.ACTOR_IDS||'D').split(',');
const rows=[];
for(const id of ids){
 const started=performance.now(),actor=await createMotionRecoveryFixture(id,{notify:console.log}),stance=actor.motion.assessPickupStance();
 rows.push({actor:id,stance,grasp:actor.graspReport,fixture:{...actor.fixture,geometry:undefined,patches:undefined,fingers:undefined,handSurfaceVertices:undefined,shoeFits:undefined},
  shoes:{soleLiftM:actor.footwear.soleLiftM,styleId:actor.footwear.styleId,sides:Object.fromEntries(['L','R'].map(s=>[s,{...actor.footwear.perSide[s],solePointsNative:undefined,soleVertexCount:actor.footwear.perSide[s].solePointsNative.length}]))},elapsedMS:performance.now()-started});
 console.log(JSON.stringify({actor:id,passed:stance.passed,error:stance.error,rootOffsetXZ:stance.rootOffsetXZ,hip:stance.measured?.hipHingeDegrees,wrist:stance.measured?.wristBendDegrees,palm:stance.measured?.errorM,bagWrist:stance.measured?.bagWristDegrees,bagError:stance.measured?.bagPalmErrorM,bagTurn:stance.measured?.bagTurnDegrees,feet:stance.measured?.feet}));
}
const output=path.join(root,'evidence','CAPTURE_RECOVERY_STANCE_'+ids.join('')+'.json');
fs.writeFileSync(output,JSON.stringify({schema:'captured-pickup-recovery-stance/1',actorIds:ids,sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,release:false,rendered:false,physicalReceipt:false,rows},null,2)+'\n');
if(rows.some(r=>!r.stance.passed))process.exitCode=2;
