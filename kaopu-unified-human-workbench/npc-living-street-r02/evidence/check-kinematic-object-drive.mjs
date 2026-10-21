/** Real Cannon integration test. The prescribed palm is a numerical fixture,
 * not a native human, a pickup receipt, or visual acceptance. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ItemWorld,ITEM_PHYSICS} from '../src/ItemWorld.mjs';
import {LifeSimulation} from '../src/LifeSimulation.mjs';

const THREE=globalThis.__ITEM_QA_THREE__,root=globalThis.__ITEM_QA_ROOT__;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
function fixture(){
  const sim=new LifeSimulation();sim.shop.stock=0;
  const state=sim.actor('A'),logical=sim.bottles[0];
  state.task={token:'numerical-driver-only',kind:'collect',targetId:logical.id,phase:'interact',duration:3};
  const world=new ItemWorld({THREE,scene:new THREE.Scene(),sim});
  const item=world.items.get(logical.id),record=world._newRecord(state),start=item.body.position.toArray();
  const palm=[start[0],start[1],start[2]-.032];
  const report={palm,palmNormal:[0,0,1],handCylinderAxis:[0,1,0],handForward:[-1,0,0],contactPhase:true,contactReady:true,finite:true,poseValid:true,contactErrorM:0,boneLengthErrorM:0};
  assert(world._grasp(record,item,report),'Fixture must begin at the actual cylinder surface');
  return {world,record,item,state,sim,start,palm,report};
}
const smooth=t=>t*t*(3-2*t),a=fixture();let elapsed=0,frames=0,maximumDriverErrorM=0,maximumDriverAngleErrorRad=0;
while(elapsed<2.4-1e-10){
  const dt=Math.min([1/30,1/48,1/60,1/90][frames%4],2.4-elapsed);elapsed+=dt;frames++;
  const t=smooth(elapsed/2.4),yaw=.62*t,palm=[a.palm[0]+.45*t,a.palm[1]+.58*t,a.palm[2]+.28*t];
  const pose=a.world._reportedHandPose({...a.report,palm,palmNormal:[Math.sin(yaw),0,Math.cos(yaw)],handForward:[-Math.cos(yaw),0,Math.sin(yaw)]});
  a.record.handTarget=pose;a.world._advancePhysics(dt);
  assert(!a.record.failure,'Smooth finite-force transport failed: '+JSON.stringify(a.record.constraintFailure));
  maximumDriverErrorM=Math.max(maximumDriverErrorM,Math.hypot(...a.record.hand.position.toArray().map((x,i)=>x-palm[i])));
  const q=a.record.hand.quaternion,target=pose.quaternion,dot=Math.min(1,Math.abs(q.x*target.x+q.y*target.y+q.z*target.z+q.w*target.w));
  maximumDriverAngleErrorRad=Math.max(maximumDriverAngleErrorRad,2*Math.acos(dot));
}
const actualLiftM=a.item.body.position.y-a.start[1];
assert(actualLiftM>.55,'The real dynamic cylinder must be lifted');
assert(a.item.body.mass===ITEM_PHYSICS.bottleMassKg&&a.record.constraint,'Object must stay dynamic and constrained');
assert(a.sim.actor('A').inventory.bottles.length===0,'A fixture must not grant inventory');
assert(a.world.metrics.maximumSubstepSeconds<=ITEM_PHYSICS.fixedStepSeconds+1e-12,'No physical step may exceed 1/120 s');
assert(a.world.metrics.maximumConstraintForceN<=ITEM_PHYSICS.assistedMaximumForceN+1e-8,'Actual reaction must stay within the stated vector force limit');
assert(a.world.metrics.maximumConstraintTorqueNm<=ITEM_PHYSICS.assistedMaximumTorqueNm+1e-8,'Actual rotational reaction must stay within the stated vector torque limit');
const b=fixture();b.record.handTarget=b.world._reportedHandPose({...b.report,palm:[b.palm[0]+1,b.palm[1],b.palm[2]]});b.world._advancePhysics(1/30);
assert(!!b.record.failure&&!b.record.hand&&!b.record.constraint&&!b.item.heldBy,'An abrupt impossible pull must release the real object: '+JSON.stringify({failure:b.record.failure,metrics:b.world.metrics}));
assert(b.sim.actor('A').inventory.bottles.length===0,'Rejected transport must not grant inventory');
const report={schema:'continuous-kinematic-object-drive-numerical/1',scope:'Real Cannon world, finite 16 N constraint and dynamic original-size cylinder; prescribed non-native palm; no animation, clothing, native pickup, browser or visual acceptance.',passed:true,rendered:false,nativeHuman:false,physicalReceipt:false,release:false,frames,elapsedSeconds:elapsed,actualLiftM,maximumDriverErrorM,maximumDriverAngleErrorRad,smooth:a.world.metrics,abruptPull:{rejected:true,evidence:b.record.constraintFailure},sourceFiles:Object.fromEntries(['src/ItemWorld.mjs','src/LifeSimulation.mjs','vendor/cannon-es.js','evidence/check-kinematic-object-drive.mjs'].map(p=>{const bytes=fs.readFileSync(root+'/'+p);return[p,{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}];}))};
fs.writeFileSync(root+'/evidence/CONTINUOUS_KINEMATIC_OBJECT_DRIVE.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
