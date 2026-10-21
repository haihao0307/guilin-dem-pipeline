import fs from 'node:fs';
import path from 'node:path';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {math} from '../src/NativeRig.mjs';
import {minimumBagTurn,hingeReach,limbMeasure,PICKUP_REACH_RULES} from '../src/PickupReachGeometry.mjs';
const {add,sub,scale,lerp,pos,mv,axisRotation,DEG}=math;
const root=globalThis.__CAPTURE_QA_ROOT__,trace=JSON.parse(fs.readFileSync(path.join(root,'evidence/CAPTURE_RECOVERY_CHAIN_D_FIRST_TRACE.json')));
const actor=await createMotionRecoveryFixture('D',{notify:console.log}),m=actor.motion;const stance=m.assessPickupStance(),h=m.pickup,r=actor.rig,T=h.template,l=r.limbs.armR,rows=[];
m.soleLift=Math.max(0,actor.footwear.soleLiftM);m.floorOffset=m.baseFloorOffset+m.soleLift;
function minimumVerticalClearance(V,F){
 const old=limbMeasure(V,F,l.upper,l.lower);if(old.valid)return{liftM:0,measure:old};
 const beta=PICKUP_REACH_RULES.planningWristDegrees*DEG,a=l.upper,b=l.lower,cb=Math.cos(beta),sb=Math.sin(beta),u=V[0]*F[0]+V[1]*F[1],horizontal=V[0]**2+V[1]**2,rad=a*a-(u-b*cb)**2;
 if(rad<0)return{liftM:null,reason:'fixed horizontal goal is outside cone envelope'};
 const boundary=a*a-b*b+2*b*cb*u+2*b*b*sb*sb+2*b*sb*Math.sqrt(rad),maxD2=Math.min(((a+b)*.974)**2,boundary);
 if(maxD2<horizontal)return{liftM:null,reason:'no vertical point satisfies the fixed horizontal goal'};
 const z=-Math.sqrt(maxD2-horizontal),lift=Math.max(0,z-V[2]),proposed=[V[0],V[1],V[2]+lift];
 return{liftM:lift,measure:limbMeasure(proposed,F,a,b),boundaryD2:boundary,maximumD2:maxD2,method:'upper quadratic wrist-cone/length boundary; only minimum nonnegative vertical palm clearance'};
}
for(const frame of [211,221,222,223,224,225,226,227,230,234,246,300,339,340]){
 const old=trace.find(x=>x.frame===frame&&x.actor==='D'),report=old.report;h._root(old.x,old.z,old.yaw);const s=h._groundedSource(report.capturedPickup.sourceFrame,old.yaw);h._fingers(1);
 const hip=h._hips(),P=m.tools.samplePalm('R'),S=pos(r.posedMatrices[l.a]),bag=m._native(m.bagAnchor()),target=m._native(report.sourceTarget),c=report.capturedPickup.carryWeight;
 const goal=lerp(add(target,sub(P,T.contactSourcePalm)),bag,c),atSource=minimumBagTurn(sub(goal,S),T.offset,-1,l.upper,l.lower);
 const chosen=atSource.angle??report.capturedPickup.bagTurnDegrees*DEG,F=mv(axisRotation([0,0,1],chosen),[-1,0,0]);
 const A=sub(scale(sub(target,T.contactSourcePalm),1-c),mv(h._handRotation(chosen),sub(m.tools.palmRest('R'),r.restP[l.c]))),B=sub(lerp(P,bag,c),S),hinge=hingeReach(A,B,hip.axis,F,l.upper,l.lower);
 let actual=null;if(hinge.angle!==null){h._hinge(hinge.angle);const g=lerp(add(target,sub(m.tools.samplePalm('R'),T.contactSourcePalm)),m._native(m.bagAnchor()),c);actual=h._reach(g,chosen,1);}
 h._groundedSource(report.capturedPickup.sourceFrame,old.yaw);h._fingers(1);const sourceHinge=T.hinge*(1-c),sourceTurn=T.turn*c;h._hinge(sourceHinge);
 const naturalGoal=lerp(add(target,sub(m.tools.samplePalm('R'),T.contactSourcePalm)),m._native(m.bagAnchor()),c),actualShoulder=pos(r.posedMatrices[l.a]),offset=mv(h._handRotation(sourceTurn),sub(m.tools.palmRest('R'),r.restP[l.c])),wristV=sub(sub(naturalGoal,actualShoulder),offset),handF=mv(axisRotation([0,0,1],sourceTurn),[-1,0,0]),clearance=minimumVerticalClearance(wristV,handF);
 let clearanceActual=null;if(clearance.liftM!==null)clearanceActual=h._reach(add(naturalGoal,[0,0,clearance.liftM]),sourceTurn,1);
 rows.push({frame,sourceFrame:report.capturedPickup.sourceFrame,carry:c,old:{hingeDegrees:report.capturedPickup.hingeDegrees,turnDegrees:report.capturedPickup.bagTurnDegrees,wristDegrees:report.capturedPickup.wristDegrees,feasible:report.capturedPickup.reachGeometryFeasible},
  actualSourceShoulder:S,actualSourceBag:bag,actualSourceGoal:goal,zeroHingeTurn:atSource,chosenDegrees:chosen/DEG,requiredHinge:hinge,actual,continuousOriginalHingeDegrees:sourceHinge/DEG,continuousTurnDegrees:sourceTurn/DEG,clearance,clearanceActual});
 console.log(JSON.stringify({frame,sourceFrame:report.capturedPickup.sourceFrame,zeroHingeMinTurn:atSource.angle===null?null:atSource.angle/DEG,requiredHinge:hinge.angle===null?null:hinge.angle/DEG,wrist:actual?.wristBendDegrees,minimumVerticalClearanceM:clearance.liftM,clearanceWrist:clearanceActual?.wristBendDegrees,clearancePalmError:clearanceActual?.actualPalmErrorM}));
}
fs.writeFileSync(path.join(root,'evidence/CAPTURE_RECOVERY_WRIST_RCA_D.json'),JSON.stringify({schema:'captured-pickup-wrist-rca/1',sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,source:'fixed frames from first actual failed trace, without a new chain or angular grid',rows},null,2)+'\n');
