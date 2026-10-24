/** One autonomous original-native bottle -> recycling -> bread -> mouth chain.
 * The user-facing bottle spawn, production decisions, actual native motion,
 * finite-force physics and receipts execute without synthesized acknowledgements.
 * Exact browser-exported refined lips are used; rendering is a separate gate. */
import fs from 'node:fs';
import {THREE} from '../src/NativeBinding.mjs';
import {math} from '../src/NativeRig.mjs';
import {fitCylinderGrasp,createNativeGraspShape} from '../src/ActorAdapter.mjs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {LifeSimulation} from '../src/LifeSimulation.mjs';
import {ItemWorld,ITEM_PHYSICS,ellipsoidSurfaceDistance} from '../src/ItemWorld.mjs';
import {STREET_LAYOUT} from '../src/WorldLayout.mjs';
import {attachExactNativeMouth} from './ExactNativeMouthFixture.mjs';
const {pos,rotation,mv,sub,unit,dot,clamp,DEG}=math,root=globalThis.__BREAD_QA_ROOT__;
const ids=(process.env.ACTOR_IDS||'A').split(','),tag=process.env.RUN_TAG||ids.join(''),rows=[],trace=[];
for(const id of ids){
  const actor=await createMotionRecoveryFixture(id);
  const mouthFixture=attachExactNativeMouth(actor,process.env.NATIVE_MOUTH_FIXTURE);
  const shape=createNativeGraspShape({profile:'bread',halfExtentsM:ITEM_PHYSICS.breadHalfExtentsM}),sides={};
  for(const side of ['L','R'])sides[side]=fitCylinderGrasp({rig:actor.rig,binding:actor.binding,fingers:actor.fixture.fingers,patch:actor.fixture.patches[side],handVertices:actor.fixture.handSurfaceVertices[side],side,shape});
  const fit={profile:'bread',shape,sides,admissible:['L','R'].every(s=>sides[s].admissible)};actor.graspProfiles.bread=fit;
  actor.selectGrasp=function(profile='bottle'){const selected=this.graspProfiles[profile];if(!selected?.admissible)throw Error('No actual '+profile+' grip for '+id);this.graspReport=selected;return selected;};
  actor.selectGrasp('bottle');actor.motion.reset();
  if(!fit.admissible){rows.push({actor:id,passed:false,reason:'actual native bread hand fit failed',fit});continue;}
  const stance=actor.motion.assessPickupStance();if(!stance.passed)throw Error('Original native pickup stance failed for '+id);
  actor.motion.reset();
  const base=new LifeSimulation().actor(id),start={...base,money:1,needs:{hunger:.95,fatigue:.05},capabilities:{pickup:true,pickupStance:stance,bread:true,window:false,water:false}};
  const sim=new LifeSimulation({initialBottles:[],actors:[start]}),world=new ItemWorld({THREE,scene:new THREE.Scene(),sim,courtyard:{colliders:STREET_LAYOUT.colliders,shop:{bread:[]},recycle:{top:.85}},actors:[actor]});
  actor.motion.update({mode:'idle',dt:0,time:0,x:start.x,z:start.z,yaw:start.yaw});
  const spawned=sim.spawnBottleNear(id);if(!spawned)throw Error('Public bottle spawn failed');
  const statistics={interactionFrames:0,heldFrames:0,maximumHandPenetrationM:0,maximumFixturePenetrationM:0,maximumWristDegrees:0,maximumAllActionWristDegrees:0,minimumSoleM:Infinity,maximumPlantedSoleM:-Infinity,invalidHeldPoses:0,stages:{}};
  let receipt=null,ack=null,duplicate=null,failure=null,eatSourceGrasp=null;const transactions=[];
  for(let frame=0;frame<120*60;frame++){
    const dt=1/60;sim.update(dt);const state=sim.actor(id),task=state.task,input=world.motionInput(state);
    const mode=state.moving?'walk':task?.phase==='interact'&&task.kind==='buy'?'trade':task?.phase==='interact'&&task.kind==='eat'?'eat':'idle';
    const report=actor.motion.update({dt,time:sim.time,x:state.x,z:state.z,yaw:state.yaw,mode,progress:task?.progress||0,grip:1,...input});
    const before={money:state.money,bread:state.inventory.bread,stock:sim.shop.stock},bottlesBefore=JSON.stringify(sim.bottles.map(b=>[b.id,b.state,b.owner])),receipts=world.update(dt,{[id]:report});
    if(bottlesBefore!==JSON.stringify(sim.bottles.map(b=>[b.id,b.state,b.owner])))throw Error('Physical executor modified logical bottle ownership before receipt');
    if(JSON.stringify(before)!==JSON.stringify({money:state.money,bread:state.inventory.bread,stock:sim.shop.stock}))throw Error('Physical executor changed money or bread without a logical receipt');
    const record=world.records.get(id),item=record&&world.items.get(record.items[record.index]);
    if(['collect','recycle','buy','eat'].includes(task?.kind)&&task.phase==='interact'){
      statistics.interactionFrames++;statistics.stages[task.kind+':'+report.stage]=(statistics.stages[task.kind+':'+report.stage]||0)+1;
      const fixtures=world.world.bodies.filter(b=>task.kind==='buy'?/^bakery-(counter|tray|serving-board)$/.test(b._itemFixture||''):task.kind==='recycle'?b._itemFixture==='recycling-counter':false);for(const b of fixtures)b.updateAABB();
      let minProp=Infinity,maxFixture=0,deepestHand=null,deepestFixture=null;
      const q=item&&new THREE.Quaternion(...item.body.quaternion.toArray()).invert(),p=item&&new THREE.Vector3(...item.body.position.toArray());
      for(const vertex of actor.fixture.handSurfaceVertices.R){
        const v=actor.poseTools.toWorld(actor.poseTools.sampleVertex(vertex));
        if(item){const signed=world._surfaceDistance(item,v.toArray());if(signed<minProp){minProp=signed;deepestHand=vertex;}}
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
    if(!eatSourceGrasp&&record?.kind==='eat'&&record.grasped&&record.progress>=.55){eatSourceGrasp={token:record.token,itemId:item.id,owner:item.owner,inputProgress:report.progress,recordProgress:record.progress,contactEvidence:record.contactEvidence,maximumConstraintErrorM:record.maximumConstraintErrorM};}
    if(receipts.length){receipt=receipts[0];ack=sim.acknowledgeInteraction(id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});duplicate=sim.acknowledgeInteraction(id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});transactions.push({receipt,ack,duplicate});if(!receipt.success){failure=receipt.reason;break;}if(receipt.evidence.kind==='eat')break;
      if(!['collect','recycle','buy'].includes(receipt.evidence.kind))throw Error('Unexpected native transaction');}
  }
  const state=sim.actor(id),gates={realBuyReceipt:transactions.some(x=>x.receipt.success&&x.receipt.evidence.kind==='buy'&&x.ack.committed),realEatSourceGrasp:!!eatSourceGrasp,samePurchasedObject:eatSourceGrasp?.itemId===transactions.find(x=>x.receipt.evidence?.kind==='buy')?.receipt.evidence.itemId,actualMouthReceipt:transactions.some(x=>x.receipt.success&&x.receipt.evidence.kind==='eat'&&x.ack.committed&&x.receipt.evidence.breadToMouthSurfaceM>=-.004&&x.receipt.evidence.breadToMouthSurfaceM<=.025&&x.receipt.evidence.verifiedMouthSamples>=3),conservedFullCycle:state.money===0&&state.inventory.bread===0&&state.inventory.bottles.length===0&&sim.shop.stock===5&&state.counters.collected===1&&state.counters.recycled===1&&state.counters.bought===1&&state.counters.eaten===1&&sim.recycling.count===1&&sim.bottle(spawned.id)?.state==='recycled'&&sim.bottle(spawned.id)?.owner==='recycling',causalActualSequence:JSON.stringify(transactions.filter(x=>x.receipt.success&&x.ack.committed).map(x=>x.receipt.evidence.kind))===JSON.stringify(['collect','recycle','buy','eat']),actualCounterRecycling:transactions.some(x=>x.receipt.evidence?.kind==='recycle'&&x.receipt.evidence.everyBottlePhysicallyOnCounter&&x.receipt.evidence.deliveries.length===1&&x.receipt.evidence.deliveries.every(d=>d.actualCounterContact&&Math.abs(d.bottomY-d.counterTopY)<.018&&d.speedMps<.14)),noDuplicateCommit:transactions.length>0&&transactions.every(x=>x.duplicate?.committed===false),finiteNativeHeldPose:statistics.invalidHeldPoses===0,originalHandInside4mm:statistics.maximumHandPenetrationM<=.004,originalHandClearsCounter:statistics.maximumFixturePenetrationM<=.004,wristBelow65Degrees:statistics.maximumWristDegrees<65,allActionWristsBelow65Degrees:statistics.maximumAllActionWristDegrees<65,actualForceBound:world.metrics.maximumConstraintForceN<=ITEM_PHYSICS.assistedMaximumForceN+1e-8,actualTorqueBound:world.metrics.maximumConstraintTorqueNm<=ITEM_PHYSICS.assistedMaximumTorqueNm+1e-8,actualSubstepBound:world.metrics.maximumSubstepSeconds<=ITEM_PHYSICS.fixedStepSeconds+1e-12,actualSoleAboveMinus3mm:statistics.minimumSoleM>=-.003,plantedSoleBelow3mm:statistics.maximumPlantedSoleM<=.003,logicalInvariants:sim.checkInvariants().ok};
  rows.push({actor:id,passed:Object.values(gates).every(Boolean),mouthFixture,stance,spawned,fit,statistics,physics:world.metrics,gates,receipt,ack,duplicate,failure,transactions,eatSourceGrasp,final:{time:sim.time,money:state.money,bread:state.inventory.bread,stock:sim.shop.stock,counters:state.counters,task:state.task,bottles:sim.bottles,events:sim.events.slice(-16)}});
}
const output={schema:'native-autonomous-bottle-to-meal-numerical/1',scope:'Original canonical complete native body, all 104 bones, full equivalent displayed hand subset, actual original-size ellipsoid bread and conservative Cannon box; original fixtures. Original selected GNM refined lip vertices and full CSR verified against the exact CI browser export; public bottle spawn, actual physical pickup, counter recycling, conserved earnings, same-object purchase, bag reacquisition, finite-force transport and mouth receipt. No full-head collision mesh, teeth, cloth, skin materials, current browser or visual acceptance.',passed:rows.every(x=>x.passed),release:false,rendered:false,exactOriginalMouthIncluded:true,wholeHeadIncluded:false,sourceHashes:globalThis.__BREAD_QA_SOURCE_HASHES__,rows};
fs.writeFileSync(root+'/evidence/NATIVE_BOTTLE_TO_MEAL_'+tag+'_TRACE.json',JSON.stringify(trace));fs.writeFileSync(root+'/evidence/NATIVE_BOTTLE_TO_MEAL_'+tag+'.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:output.passed,rows:rows.map(x=>({actor:x.actor,passed:x.passed,gates:x.gates,statistics:x.statistics,failure:x.failure,receipt:x.receipt?.success}))}));if(!output.passed)process.exitCode=2;
