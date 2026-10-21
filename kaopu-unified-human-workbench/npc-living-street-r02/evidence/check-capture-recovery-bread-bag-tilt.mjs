/** One free-food roll at the exact original bag. Geometry only; no receipt. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {THREE} from '../src/NativeBinding.mjs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {fitCylinderGrasp} from '../src/ActorAdapter.mjs';
import {solveNativeObjectReach} from '../src/NativeObjectReach.mjs';
import {ITEM_PHYSICS,ellipsoidSurfaceDistance} from '../src/ItemWorld.mjs';
import {math} from '../src/NativeRig.mjs';
const {add,sub,scale,norm,rotation,mv,unit,mm3,axisRotation}=math,root=globalThis.__CAPTURE_QA_ROOT__;
const input=path.join(root,'evidence/NATIVE_BREAD_TRANSPORT_D_SIDE_TRACE.json'),bytes=fs.readFileSync(input),trace=JSON.parse(bytes),last=trace.at(-1),acquired=trace.find(x=>x.record?.grasped&&x.report.contactPhase);
const actor=await createMotionRecoveryFixture('D',{notify:console.log}),m=actor.motion,r=actor.rig,l=r.limbs.armR,shape={kind:'ellipsoid',halfExtentsM:[.045,.035,.075],gripHeight:0},sides={};
for(const side of ['L','R'])sides[side]=fitCylinderGrasp({rig:r,binding:actor.binding,fingers:actor.fixture.fingers,patch:actor.fixture.patches[side],handVertices:actor.fixture.handSurfaceVertices[side],side,shape});
actor.graspProfiles.bread={profile:'bread',shape,sides,admissible:['L','R'].every(s=>sides[s].admissible)};actor.selectGrasp('bread');m.reset();
const bodyReport=m.update({dt:0,time:last.time,x:last.report.rootWorld[0],z:last.report.rootWorld[2],yaw:Math.PI,mode:'trade',progress:1,grip:1,objectGripYaw:Math.PI/2,target:last.report.sourceTarget}),bag=m.bagAnchor(),before=r.posedMatrices.map(x=>x.slice());
const originalRotation=m._contactHandRotation,base=originalRotation.call(m,'R',Math.PI/2,1,true),normalNative=unit(mv(base,r.hand.R.palm)),tilt=Math.PI/2,desired=mm3(axisRotation(normalNative,tilt),base);
// Temporary evidence-only orientation injection, retaining the exact shared
// production coupled elbow/roll solver. No production file is altered.
m._contactHandRotation=function(side,turn,weight,object){return object?desired.slice():originalRotation.call(this,side,turn,weight,object);};
let solution;try{solution=solveNativeObjectReach(m,bag,{side:'R',turn:Math.PI/2,orientationWeight:1,allowYaw:false});}finally{m._contactHandRotation=originalRotation;}
actor.poseTools.commit({side:'R',grip:1,target:bag,solution});
const palm=actor.poseTools.toWorld(actor.poseTools.samplePalm('R')).toArray(),handRotation=rotation(r.skinMatrices[l.c]),normal=m._direction(unit(mv(handRotation,r.hand.R.palm)),Math.PI),forward=m._direction(unit(mv(handRotation,r.hand.R.forward)),Math.PI);
const objectCenter=add(palm,scale(normal,.075)),deltaQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...m._direction(normalNative,Math.PI)),tilt),q=deltaQ.multiply(new THREE.Quaternion(...acquired.item.quaternion)).normalize(),inverse=q.clone().invert();
let minimum=Infinity,deepest=null;for(const id of actor.fixture.handSurfaceVertices.R){const p=actor.poseTools.toWorld(actor.poseTools.sampleVertex(id)),local=p.clone().sub(new THREE.Vector3(...objectCenter)).applyQuaternion(inverse),d=ellipsoidSurfaceDistance(local.toArray(),ITEM_PHYSICS.breadHalfExtentsM);if(d<minimum){minimum=d;deepest={vertex:id,world:p.toArray(),actualObjectLocal:local.toArray()};}}
const arm=new Set(r.descendants[l.a]);let bodyChange=0;for(let j=0;j<r.count;j++)if(!arm.has(j))for(let k=0;k<16;k++)bodyChange=Math.max(bodyChange,Math.abs(before[j][k]-r.posedMatrices[j][k]));
const validation=r.validate(),gates={strictWrist:solution.wristBendDegrees<65&&!solution.clamped,originalHandEnvelope:minimum>=-.0011,palmAtExactBag:norm(sub(palm,bag))<=.012,bagUnchanged:norm(sub(m.bagAnchor(),bag))===0,bodyOutsideArmUnchanged:bodyChange===0,actualBoneLengths:validation.maxBoneLengthError<=.00001};
const output={schema:'native-bread-free-roll-bag-single-pose/1',actor:'D',release:false,physicalReceipt:false,rendered:false,sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,input:{path:path.relative(root,input),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),frame:last.frame},
 candidate:{body:'unchanged actual trade terminal torso/feet conditions',objectBaseYawRadians:Math.PI/2,rollAroundUnchangedPalmNormalRadians:tilt,desiredHandRotation:desired,normalNative,forward,normal},
 body:{rootWorld:bodyReport.rootWorld,pelvisWorld:bodyReport.pelvisWorld,bodyOutsideArmMatrixError:bodyChange,feet:bodyReport.feet,validation},
 hand:{vertices:actor.fixture.handSurfaceVertices.R.length,fit:actor.graspProfiles.bread,palm,target:bag,palmErrorM:norm(sub(palm,bag)),solution,minimumActualEllipsoidSDFM:minimum,deepest},
 object:{position:objectCenter,quaternion:q.toArray(),halfExtentsM:ITEM_PHYSICS.breadHalfExtentsM.slice(),candidateOnly:true,scope:'The original ellipsoid is rigidly rolled with the prescribed hand for this static geometry query. No production body transform or actual Cannon item was written.'},
 gates,passed:Object.values(gates).every(Boolean),limitations:['One exact bag endpoint only; continuous hand/body path and finite-force food rotation still require actual transaction','No GNM mouth, eating or visual acceptance']};
const file=path.join(root,'evidence/BREAD_BAG_D_FREE_ROLL_CANDIDATE.json');fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({file,passed:output.passed,gates,wristDegrees:solution.wristBendDegrees,handSDF:minimum,palmErrorM:output.hand.palmErrorM,forward,normal,bodyChange}));
