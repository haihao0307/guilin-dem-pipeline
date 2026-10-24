/** Actual native body/hands and real Cannon buy transaction. The fixture
 * deliberately excludes GNM lips, eating, clothing and browser acceptance. */
import fs from 'node:fs';
import {THREE} from '../src/NativeBinding.mjs';
import {math} from '../src/NativeRig.mjs';
import {fitCylinderGrasp,createNativeGraspShape} from '../src/ActorAdapter.mjs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {LifeSimulation} from '../src/LifeSimulation.mjs';
import {ItemWorld,ITEM_PHYSICS,ellipsoidSurfaceDistance} from '../src/ItemWorld.mjs';
import {STREET_LAYOUT} from '../src/WorldLayout.mjs';
const {pos,rotation,mv,sub,unit,dot,clamp,DEG}=math,root=globalThis.__BREAD_QA_ROOT__;
const ids=(process.env.ACTOR_IDS||'D').split(','),tag=process.env.RUN_TAG||ids.join(''),rows=[],trace=[];
for(const id of ids){
  const actor=await createMotionRecoveryFixture(id),shape=createNativeGraspShape({profile:'bread',halfExtentsM:ITEM_PHYSICS.breadHalfExtentsM}),sides={};
  for(const side of ['L','R'])sides[side]=fitCylinderGrasp({rig:actor.rig,binding:actor.binding,fingers:actor.fixture.fingers,patch:actor.fixture.patches[side],handVertices:actor.fixture.handSurfaceVertices[side],side,shape});
  const fit={profile:'bread',shape,sides,admissible:['L','R'].every(s=>sides[s].admissible)};actor.graspProfiles.bread=fit;
  actor.selectGrasp=function(profile='bottle'){const selected=this.graspProfiles[profile];if(!selected?.admissible)throw Error('No actual '+profile+' grip for '+id);this.graspReport=selected;return selected;};
  actor.selectGrasp('bottle');actor.motion.reset();
  if(!fit.admissible){rows.push({actor:id,passed:false,reason:'actual native bread hand fit failed',fit});continue;}
  const base=new LifeSimulation().actor(id),start={...base,x:3.4,z:1.3,yaw:Math.PI,money:4,needs:{hunger:.95,fatigue:.05},capabilities:{pickup:false,bread:true,window:false,water:false}};
  const sim=new LifeSimulation({initialBottles:[],actors:[start]}),world=new ItemWorld({THREE,scene:new THREE.Scene(),sim,courtyard:{colliders:STREET_LAYOUT.colliders,shop:{bread:[]},recycle:{top:.85}},actors:[actor]});
  const statistics={interactionFrames:0,heldFrames:0,maximumHandPenetrationM:0,maximumFixturePenetrationM:0,maximumWristDegrees:0,maximumAllActionWristDegrees:0,minimumSoleM:Infinity,maximumPlantedSoleM:-Infinity,invalidHeldPoses:0,stages:{}};
  let receipt=null,ack=null,duplicate=null,failure=null;
  for(let frame=0;frame<18*60;frame++){
    const dt=1/60;sim.update(dt);const state=sim.actor(id),task=state.task,input=world.motionInput(state);
    const mode=state.moving?'walk':task?.kind==='buy'&&task.phase==='interact'?'trade':'idle';
    const report=actor.motion.update({dt,time:sim.time,x:state.x,z:state.z,yaw:state.yaw,mode,progress:task?.progress||0,grip:1,...input});
    const before={money:state.money,bread:state.inventory.bread,stock:sim.shop.stock},receipts=world.update(dt,{[id]:report});
    if(JSON.stringify(before)!==JSON.stringify({money:state.money,bread:state.inventory.bread,stock:sim.shop.stock}))throw Error('Physical executor changed money or bread without a logical receipt');
    const record=world.records.get(id),item=record&&world.items.get(record.items[record.index]);
    if(task?.kind==='buy'&&task.phase==='interact'){
      statistics.interactionFrames++;statistics.stages[report.stage]=(statistics.stages[report.stage]||0)+1;
      const fixtures=world.world.bodies.filter(b=>/^bakery-(counter|tray|serving-board)$/.test(b._itemFixture||''));for(const b of fixtures)b.updateAABB();
      let minProp=Infinity,maxFixture=0,deepestHand=null,deepestFixture=null;
      const q=item&&new THREE.Quaternion(...item.body.quaternion.toArray()).invert(),p=item&&new THREE.Vector3(...item.body.position.toArray());
      for(const vertex of actor.fixture.handSurfaceVertices.R){
        const v=actor.poseTools.toWorld(actor.poseTools.sampleVertex(vertex));
        if(item){const local=v.clone().sub(p).applyQuaternion(q),signed=ellipsoidSurfaceDistance(local.toArray());if(signed<minProp){minProp=signed;deepestHand=vertex;}}
        for(const b of fixtures){const lo=b.aabb.lowerBound,hi=b.aabb.upperBound;
          if(v.x>lo.x&&v.x<hi.x&&v.y>lo.y&&v.y<hi.y&&v.z>lo.z&&v.z<hi.z){const depth=Math.min(v.x-lo.x,hi.x-v.x,v.y-lo.y,hi.y-v.y,v.z-lo.z,hi.z-v.z);if(depth>maxFixture){maxFixture=depth;deepestFixture={fixture:b._itemFixture,vertex,point:v.toArray()};}}
        }
      }
      const rig=actor.rig,limb=rig.limbs.armR,forearm=unit(sub(pos(rig.posedMatrices[limb.c]),pos(rig.posedMatrices[limb.b]))),hand=unit(mv(rotation(rig.skinMatrices[limb.c]),rig.hand.R.forward));
      const wrist=Math.acos(clamp(dot(forearm,hand),-1,1))/DEG;
      statistics.maximumFixturePenetrationM=Math.max(statistics.maximumFixturePenetrationM,maxFixture);
      statistics.maximumAllActionWristDegrees=Math.max(statistics.maximumAllActionWristDegrees,wrist);
      if(record?.grasped){statistics.heldFrames++;statistics.maximumHandPenetrationM=Math.max(statistics.maximumHandPenetrationM,Math.max(0,-minProp));statistics.maximumWristDegrees=Math.max(statistics.maximumWristDegrees,wrist);if(!report.poseValid)statistics.invalidHeldPoses++;}
      for(const foot of Object.values(report.feet)){statistics.minimumSoleM=Math.min(statistics.minimumSoleM,foot.soleMinimumWorldYM);if(foot.planted)statistics.maximumPlantedSoleM=Math.max(statistics.maximumPlantedSoleM,foot.soleMinimumWorldYM);}
      trace.push({actor:id,frame,time:sim.time,report,record:record&&{progress:record.progress,stage:record.stage,grasped:record.grasped,failure:record.failure,constraintFailure:record.constraintFailure,poseFailure:record.poseFailure},geometry:{handVertices:actor.fixture.handSurfaceVertices.R.length,minProp,maxFixture,wrist,deepestHand,deepestFixture},item:item&&{position:item.body.position.toArray(),quaternion:item.body.quaternion.toArray()}});
    }
    if(receipts.length){receipt=receipts[0];ack=sim.acknowledgeInteraction(id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});duplicate=sim.acknowledgeInteraction(id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});if(!receipt.success)failure=receipt.reason;break;}
  }
  const state=sim.actor(id),gates={realBuyReceipt:receipt?.success===true&&ack?.committed===true,conservedPurchase:state.money===2&&state.inventory.bread===1&&sim.shop.stock===5,noDuplicateCommit:duplicate?.committed===false,finiteNativeHeldPose:statistics.invalidHeldPoses===0,originalHandInside4mm:statistics.maximumHandPenetrationM<=.004,originalHandClearsCounter:statistics.maximumFixturePenetrationM<=.004,wristBelow65Degrees:statistics.maximumWristDegrees<65,allActionWristsBelow65Degrees:statistics.maximumAllActionWristDegrees<65,actualForceBound:world.metrics.maximumConstraintForceN<=ITEM_PHYSICS.assistedMaximumForceN+1e-8,actualTorqueBound:world.metrics.maximumConstraintTorqueNm<=ITEM_PHYSICS.assistedMaximumTorqueNm+1e-8,actualSubstepBound:world.metrics.maximumSubstepSeconds<=ITEM_PHYSICS.fixedStepSeconds+1e-12,actualSoleAboveMinus3mm:statistics.minimumSoleM>=-.003,plantedSoleBelow3mm:statistics.maximumPlantedSoleM<=.003,logicalInvariants:sim.checkInvariants().ok};
  rows.push({actor:id,passed:Object.values(gates).every(Boolean),fit,statistics,physics:world.metrics,gates,receipt,ack,duplicate,failure,final:{money:state.money,bread:state.inventory.bread,stock:sim.shop.stock}});
}
const output={schema:'native-bread-transport-numerical/1',scope:'Original canonical complete native body, all 104 bones, full equivalent displayed hand subset, actual original-size ellipsoid bread and conservative Cannon box; original fixtures. No GNM lips, eating, cloth, skin materials, browser or visual acceptance.',passed:rows.every(x=>x.passed),release:false,rendered:false,headOrMouthIncluded:false,sourceHashes:globalThis.__BREAD_QA_SOURCE_HASHES__,rows};
fs.writeFileSync(root+'/evidence/NATIVE_BREAD_TRANSPORT_'+tag+'_TRACE.json',JSON.stringify(trace));fs.writeFileSync(root+'/evidence/NATIVE_BREAD_TRANSPORT_'+tag+'.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:output.passed,rows:rows.map(x=>({actor:x.actor,passed:x.passed,gates:x.gates,statistics:x.statistics,failure:x.failure,receipt:x.receipt?.success}))}));if(!output.passed)process.exitCode=2;
