/** Fixed failed bag endpoint geometry, no new transaction or parameter grid. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {fitCylinderGrasp} from '../src/ActorAdapter.mjs';
import {solveNativeObjectReach} from '../src/NativeObjectReach.mjs';
import {minimumBagTurn,hingeReach,minimumVerticalPalmClearance,limbMeasure} from '../src/PickupReachGeometry.mjs';
import {math} from '../src/NativeRig.mjs';
const {add,sub,scale,norm,pos,mv,axisRotation,rotation,unit,DEG}=math,root=globalThis.__CAPTURE_QA_ROOT__;
const input=path.join(root,'evidence/NATIVE_BREAD_TRANSPORT_D_SIDE_TRACE.json'),bytes=fs.readFileSync(input),trace=JSON.parse(bytes),failed=trace.at(-1);
const actor=await createMotionRecoveryFixture('D',{notify:console.log}),m=actor.motion,r=actor.rig,l=r.limbs.armR,shape={kind:'ellipsoid',halfExtentsM:[.045,.035,.075],gripHeight:0},sides={};
for(const side of ['L','R'])sides[side]=fitCylinderGrasp({rig:r,binding:actor.binding,fingers:actor.fixture.fingers,patch:actor.fixture.patches[side],handVertices:actor.fixture.handSurfaceVertices[side],side,shape});
actor.graspProfiles.bread={profile:'bread',shape,sides,admissible:['L','R'].every(s=>sides[s].admissible)};actor.selectGrasp('bread');m.reset();
const restore=s=>{for(let j=0;j<r.count;j++){r.posedMatrices[j].set(s.posed[j]);r.skinMatrices[j].set(s.skin[j]);}};
const rows=[];
for(const which of ['last-failed-measured-palm','exact-original-bag']){
 const progress=which==='exact-original-bag'?1:failed.report.progress;
 // Keep the already selected real bread fit. The transport planner is not
 // evaluated here: its actual final goal comes directly from the trace.
 // Passing no new profile avoids asking it to invent a missing clearance
 // record while retaining the identical production torso/feet posture.
 const bodyReport=m.update({dt:0,time:failed.time,x:failed.report.rootWorld[0],z:failed.report.rootWorld[2],yaw:Math.PI,mode:'trade',progress,grip:1,objectGripYaw:Math.PI/2,target:failed.report.sourceTarget});
 const world=which==='exact-original-bag'?m.bagAnchor():failed.report.palm,local=m._native(world),S=pos(r.posedMatrices[l.a]),B=sub(local,S),restOffset=sub(actor.poseTools.palmRest('R'),r.restP[l.c]),O=mv(m._contactHandRotation('R',0,1,true),restOffset),save={posed:r.posedMatrices.map(x=>x.slice()),skin:r.skinMatrices.map(x=>x.slice())};
 const measures=[];
 for(const base of [Math.PI/2,0,Math.PI]){
  const equation=minimumBagTurn(mv(axisRotation([0,0,1],-base),B),O,-1,l.upper,l.lower);let actual=null;
  if(equation.angle!==null){restore(save);actual=solveNativeObjectReach(m,world,{turn:base+equation.angle,orientationWeight:1,allowYaw:false});}
  measures.push({baseDegrees:base/DEG,absoluteIntervalDegrees:[(base-Math.PI/2)/DEG,(base+Math.PI/2)/DEG],equation,absoluteTurnDegrees:equation.angle===null?null:(base+equation.angle)/DEG,actual});
 }
 restore(save);const spine=r.index.get('spine05'),pivot=pos(r.posedMatrices[spine]),axis=unit(mv(rotation(r.skinMatrices[spine]),[1,0,0])),turn=Math.PI/2,handR=m._contactHandRotation('R',turn,1,true),offset=mv(handR,restOffset),F=unit(mv(handR,r.hand.R.forward));
 const fixed=limbMeasure(sub(B,offset),F,l.upper,l.lower),clearance=minimumVerticalPalmClearance(sub(B,offset),F,l.upper,l.lower);
 const hinge=hingeReach(sub(sub(local,offset),pivot),scale(sub(S,pivot),-1),axis,F,l.upper,l.lower,31*.88*DEG);let hingeActual=null,bagError=null;
 if(hinge.angle!==null){r.rotateSubtree(spine,axisRotation(axis,hinge.angle),pivot);hingeActual=solveNativeObjectReach(m,world,{turn,orientationWeight:1,allowYaw:false});bagError=norm(sub(m.bagAnchor(),bodyReport.bagTarget));}
 rows.push({which,progress,worldGoal:world,oldBag:failed.report.bagTarget,currentBag:bodyReport.bagTarget,rootWorld:bodyReport.rootWorld,sourceRootWorld:failed.report.rootWorld,shoulderNative:S,upperM:l.upper,lowerM:l.lower,palmOffsetNativeAtZeroYaw:O,shoulderToPalmNative:B,
  yawDomains:measures,atFixedSideYaw:fixed,diagnosticVerticalPalmClearance:clearance,
  sourceLowerSpine:{joint:'spine05',pivot,axis,maximumExistingCounterReachHingeDegrees:31*.88,minimumEquation:hinge,minimumHingeDegrees:hinge.angle===null?null:hinge.angle/DEG,actual:hingeActual,bagPointChangeM:bagError,
   scope:'Single analytic posture candidate using existing production lower-spine hinge within its full counter-reach amplitude; fixed goal/bag, bone lengths and legs. No production change.'}});
 restore(save);
}
const report={schema:'native-bread-bag-geometric-rca/1',actor:'D',release:false,rendered:false,physicalReceipt:false,sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,
 input:{path:path.relative(root,input),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),frame:failed.frame,time:failed.time},
 method:'The actual final measured failing palm and exact original bag only. The original report omitted requested activeGoal and measured 0.000112mm palm error, so no unrecorded goal is invented. Exact quartic boundaries in explicit yaw semicircles; no angle grid or object/bag/tolerance changes.',rows};
const file=path.join(root,'evidence/BREAD_BAG_D_FIXED_RCA.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file,rows:rows.map(x=>({which:x.which,upper:x.upperM,lower:x.lowerM,goal:x.worldGoal,shoulder:x.shoulderNative,yaw:x.yawDomains.map(q=>({base:q.baseDegrees,turn:q.absoluteTurnDegrees,wrist:q.actual?.wristBendDegrees})),fixedWrist:x.atFixedSideYaw.wristDegrees,clearance:x.diagnosticVerticalPalmClearance.liftM,hinge:x.sourceLowerSpine.minimumHingeDegrees,hingeWrist:x.sourceLowerSpine.actual?.wristBendDegrees,bagChange:x.sourceLowerSpine.bagPointChangeM}))}));
