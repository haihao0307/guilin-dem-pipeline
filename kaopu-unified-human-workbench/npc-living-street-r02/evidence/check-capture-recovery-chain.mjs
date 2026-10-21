/** Actual deterministic navigation -> source pickup -> finite-force Cannon ->
 * logical receipt. No task, progress, object pose or receipt is synthesized.
 * The body/hand fixture is numerical; original GNM/display rendering and food
 * are expressly not certified by this pickup-only run.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {THREE} from '../src/NativeBinding.mjs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {LifeSimulation} from '../src/LifeSimulation.mjs';
import {ItemWorld,ITEM_PHYSICS} from '../src/ItemWorld.mjs';
import {STREET_LAYOUT} from '../src/WorldLayout.mjs';
const root=globalThis.__CAPTURE_QA_ROOT__,ids=(process.env.ACTOR_IDS||'D').split(','),tag=process.env.RUN_TAG||ids.join(''),dt=1/60;
const extra=Number(process.env.EXTRA_BOTTLES??(ids.length===6?1:0)),goal=ids.length+extra,maxSeconds=Number(process.env.MAX_SECONDS||45);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),copy=x=>JSON.parse(JSON.stringify(x));
const sourceHashes=globalThis.__CAPTURE_QA_SOURCE_HASHES__,actors=[],stances={};
for(const id of ids){const actor=await createMotionRecoveryFixture(id,{notify:console.log});stances[id]=actor.motion.assessPickupStance();if(!stances[id].passed)throw Error('No real contact stance for '+id);actors.push(actor);}
const defaults=new LifeSimulation(),sim=new LifeSimulation({seed:20261020,initialBottles:[],actors:defaults.actors.filter(a=>ids.includes(a.id))});
for(const actor of actors){sim.actor(actor.id).capabilities={pickup:true,pickupStance:stances[actor.id],bread:false,window:false,water:false};}
const scene=new THREE.Scene(),courtyard={colliders:STREET_LAYOUT.colliders,shop:{bread:[]},recycle:{top:.85}},items=new ItemWorld({THREE,scene,sim,courtyard,actors});
const reports={},receipts=[],spawned=[],trace=[],poses=new Map(),ownershipChanges=[],collectedTokens=new Set(),perActor=Object.fromEntries(ids.map(id=>[id,{pickupFrames:0,heldFrames:0,invalidFrames:0,invalidHeldFrames:0,minimumHandSDFM:Infinity,maximumPalmSurfaceM:0,maximumPalmPenetrationM:0,maximumConstraintErrorM:0,minimumSoleM:Infinity,maximumPlantedSoleM:-Infinity,maximumFootErrorM:0,maximumWristDegrees:0,maximumBoneLengthErrorM:0,maximumRootXZErrorM:0,maximumCarryClearanceM:0,maximumCarryClearanceSpeedMPS:0,maximumCarryClearanceStepM:0,maximumTransportPalmGoalSpeedMPS:0,maximumTransportPalmGoalStepM:0,finalCarryClearanceM:null,phaseFrames:{},sourcePairs:[],successfulReceipts:0}]));
let failure=null,extraSpawned=0,sourceFrameSamples=0;
const capture=(actor,state,report,frame)=>{
 const token=state.task?.token;if(!token||report.mode!=='pickup')return;
 const rows=poses.get(token)||[];rows.push({actor:actor.id,token,frame,time:sim.time,phase:report.stage,sourceFrame:report.capturedPickup.sourceFrame,attached:report.capturedPickup.acquisitionInput,
  skinMatrices:Float64Array.from(actor.rig.skinMatrices.flatMap(m=>Array.from(m))),posedMatrices:Float64Array.from(actor.rig.posedMatrices.flatMap(m=>Array.from(m))),
  rootMatrix:Float64Array.from(actor.root.matrixWorld.elements),rootWorld:actor.root.position.toArray(),rootQuaternion:actor.root.quaternion.toArray(),rootTranslation:actor.rig.rootTranslation.slice(),feet:copy(report.feet)});poses.set(token,rows);
};
const drop=id=>{const b=sim.spawnBottleNear(id);if(!b)throw Error('Public bottle spawn returned no available spot near '+id);spawned.push({requestedNear:id,time:sim.time,bottle:copy(b)});};
for(const actor of actors){const state=sim.actor(actor.id);reports[actor.id]=actor.motion.update({mode:'idle',dt:0,time:0,x:state.x,z:state.z,yaw:state.yaw});}
for(const id of ids)drop(id);
const initialInvariants=sim.checkInvariants();
for(let frame=0;frame<maxSeconds/dt;frame++){
 try{
  sim.update(dt);
  for(const actor of actors){
   const state=sim.actor(actor.id),task=state.task;let mode=state.moving?'walk':'idle',x=state.x,z=state.z,progress=task?.progress||0,seatY=.46;
   if(task?.kind==='rest'&&task.phase!=='approach'){const loc=sim.locations[task.targetId];x=loc.seat.x;z=loc.seat.z;seatY=loc.height;mode=task.phase==='interact'?'sit':task.phase==='depart'?'stand':'sitting';}
   else if(task?.phase==='interact')mode=task.kind==='collect'?'pickup':task.kind==='eat'?'eat':'trade';
   const input=items.motionInput(state),target=input.target||task?.contact||null;
   const report=actor.motion.update({dt,time:sim.time,x,z,yaw:state.yaw,mode,progress,target,seatY,seatApproachOffset:.65,standStartFactor:task?.kind==='rest'&&task.phase==='depart'?task.standStartFactor??1:null,grip:1,...input});
   reports[actor.id]=report;if(!report.finite)throw Error(actor.id+' non-finite motion');
   if(report.mode==='pickup'){
    const p=perActor[actor.id];p.pickupFrames++;if(!report.poseValid)p.invalidFrames++;
    p.maximumBoneLengthErrorM=Math.max(p.maximumBoneLengthErrorM,report.boneLengthErrorM);p.maximumRootXZErrorM=Math.max(p.maximumRootXZErrorM,Math.hypot(report.rootWorld[0]-state.x,report.rootWorld[2]-state.z));
    p.maximumFootErrorM=Math.max(p.maximumFootErrorM,report.footErrorM);for(const foot of Object.values(report.feet)){p.minimumSoleM=Math.min(p.minimumSoleM,foot.soleMinimumWorldYM);if(foot.planted)p.maximumPlantedSoleM=Math.max(p.maximumPlantedSoleM,foot.soleMinimumWorldYM);}
    if(report.capturedPickup.wristGateActive)p.maximumWristDegrees=Math.max(p.maximumWristDegrees,report.capturedPickup.wristDegrees||0);
    p.maximumCarryClearanceM=Math.max(p.maximumCarryClearanceM,report.capturedPickup.carryClearanceM||0);p.maximumCarryClearanceSpeedMPS=Math.max(p.maximumCarryClearanceSpeedMPS,Math.abs(report.capturedPickup.carryClearanceSpeedMPS||0));p.maximumCarryClearanceStepM=Math.max(p.maximumCarryClearanceStepM,Math.abs(report.capturedPickup.carryClearanceSpeedMPS||0)*dt);
    p.maximumTransportPalmGoalSpeedMPS=Math.max(p.maximumTransportPalmGoalSpeedMPS,report.capturedPickup.transportPalmGoalSpeedMPS||0);p.maximumTransportPalmGoalStepM=Math.max(p.maximumTransportPalmGoalStepM,(report.capturedPickup.transportPalmGoalSpeedMPS||0)*dt);if(report.stage==='at-bag')p.finalCarryClearanceM=report.capturedPickup.carryClearanceM;
    const phase=p.phaseFrames[report.stage]??={firstFrame:frame,lastFrame:frame,sourceFirst:report.capturedPickup.sourceFrame,sourceLast:report.capturedPickup.sourceFrame};phase.lastFrame=frame;phase.sourceLast=report.capturedPickup.sourceFrame;
    p.sourcePairs.push(report.motionSource.sourceFrames);sourceFrameSamples++;
    capture(actor,state,report,frame);
   }
   if(task?.kind==='rest'&&task.waitForAcknowledgement&&task.progress>=.999&&report.poseValid&&report.completed){const ack=sim.acknowledgeInteraction(actor.id,true,{token:task.token,evidence:{executor:'actual native seat pose',boneLengthErrorM:report.boneLengthErrorM,footErrorM:report.footErrorM}});trace.push({frame,actor:actor.id,kind:'seat-ack',ack});}
  }
  const before=sim.bottles.map(b=>({id:b.id,owner:b.owner,state:b.state})),emitted=items.update(dt,reports),after=sim.bottles.map(b=>({id:b.id,owner:b.owner,state:b.state}));
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Physical executor changed logical bottle ownership before receipt');
  for(const actor of actors){const state=sim.actor(actor.id),record=items.records.get(actor.id),report=reports[actor.id];
   if(report.mode!=='pickup')continue;
   const item=record&&items.items.get(record.items[record.index]),p=perActor[actor.id];let actualHand=null;
   if(record?.grasped&&item){
    const signed=items._surfaceDistance(item,report.palm),constraint=items._constraintError(record,item);p.heldFrames++;if(!report.poseValid)p.invalidHeldFrames++;
    actualHand=actor.diagnostics({prop:{kind:'bottle',position:item.body.position.toArray(),quaternion:item.body.quaternion.toArray(),radius:.032,height:.14}}).hand.R;
    p.minimumHandSDFM=Math.min(p.minimumHandSDFM,actualHand.minimumSignedDistanceM);p.maximumPalmSurfaceM=Math.max(p.maximumPalmSurfaceM,Math.abs(signed));p.maximumPalmPenetrationM=Math.max(p.maximumPalmPenetrationM,Math.max(0,-signed));p.maximumConstraintErrorM=Math.max(p.maximumConstraintErrorM,record.maximumConstraintErrorM||constraint);
   }
   trace.push({frame,time:sim.time,actor:actor.id,task:{kind:state.task?.kind,phase:state.task?.phase,token:state.task?.token},x:state.x,z:state.z,yaw:state.yaw,report,
    record:record&&{token:record.token,progress:record.progress,grasped:record.grasped,stage:record.stage,failure:record.failure,maximumConstraintErrorM:record.maximumConstraintErrorM,constraintFailure:record.constraintFailure},
    item:item&&{id:item.id,owner:item.owner,mode:item.mode,position:item.body.position.toArray(),quaternion:item.body.quaternion.toArray()},actualHand});
  }
  for(const receipt of emitted){
   const state=sim.actor(receipt.id),kind=state.task?.kind,previous=sim.bottles.map(b=>({id:b.id,owner:b.owner,state:b.state}));
   const ack=sim.acknowledgeInteraction(receipt.id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});
   const duplicate=sim.acknowledgeInteraction(receipt.id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});
   const row={frame,time:sim.time,kind,...receipt,ack,duplicate};receipts.push(row);console.log(JSON.stringify({time:sim.time,actor:receipt.id,kind,success:receipt.success,ack,reason:receipt.reason}));
   for(const old of previous){const b=sim.bottle(old.id);if(b.owner!==old.owner||b.state!==old.state)ownershipChanges.push({frame,time:sim.time,bottleId:b.id,from:old,to:{owner:b.owner,state:b.state},token:receipt.token,kind});}
   if(kind==='collect'&&receipt.success&&ack.committed){if(collectedTokens.has(receipt.token))throw Error('Duplicate collect token committed');collectedTokens.add(receipt.token);perActor[receipt.id].successfulReceipts++;}
   if(kind==='collect'&&(!receipt.success||!ack.committed))failure={frame,receipt:row};
  }
  if(failure)break;
  if(collectedTokens.size>=ids.length+extraSpawned&&extraSpawned<extra){const missing=ids.find(id=>perActor[id].successfulReceipts===0);drop(missing|| (ids.includes('B')?'B':ids[0]));extraSpawned++;}
  if(collectedTokens.size>=goal&&ids.every(id=>perActor[id].successfulReceipts>0))break;
  if(frame%240===0)console.log(JSON.stringify({time:sim.time,collected:collectedTokens.size,goal,actors:sim.actors.map(a=>({id:a.id,task:a.task?.kind,phase:a.task?.phase,stage:reports[a.id]?.stage}))}));
 }catch(error){failure={frame,time:sim.time,message:String(error.stack||error)};break;}
}
for(const p of Object.values(perActor)){p.coveredSourceFrames=[...new Set(p.sourcePairs.flat())].sort((a,b)=>a-b);delete p.sourcePairs;}
const successful=receipts.filter(r=>r.kind==='collect'&&r.success&&r.ack.committed),selected=[];
for(const id of ids){const success=successful.find(r=>r.id===id),rows=success&&poses.get(success.token);if(!rows?.length)continue;for(let k=0;k<49;k++){
 const i=Math.round(k*(rows.length-1)/48),r=rows[i];selected.push({...r,measurement:k,originalPhaseFrames:rows.length,skinMatrices:Array.from({length:104},(_,j)=>Array.from(r.skinMatrices.slice(j*16,j*16+16))),posedMatrices:Array.from({length:104},(_,j)=>Array.from(r.posedMatrices.slice(j*16,j*16+16))),rootMatrix:Array.from(r.rootMatrix)});
}}
const gates={sixOrRequestedActors:ids.every(id=>perActor[id].successfulReceipts>0),requestedBottleCount:successful.length>=goal,noPickupFailure:!failure,
 realReceipt:successful.every(r=>r.evidence.nativePalmRequired&&r.evidence.physicalTransportRequired&&!r.evidence.clockOnlyCompletion&&r.ack.committed),
 noDuplicateCommit:receipts.every(r=>!r.duplicate.accepted&&!r.duplicate.committed),
 oncePerBottle:successful.every(r=>ownershipChanges.filter(x=>x.kind==='collect'&&x.bottleId===r.evidence.itemId).length===1),
 fullSource357Retained:actors.every(a=>a.motionLibrary.pickup.frames.length===357),actualPhaseEndpoints:ids.every(id=>{const p=perActor[id];return p.phaseFrames['contact-hold']?.sourceFirst===99&&p.phaseFrames['at-bag']?.sourceLast===356;}),
 finiteNativeBones:ids.every(id=>perActor[id].maximumBoneLengthErrorM<=.00001),trueWorldRoot:ids.every(id=>perActor[id].maximumRootXZErrorM<=.001),
 strictOriginalWrist:ids.every(id=>perActor[id].maximumWristDegrees<65),heldPosesValid:ids.every(id=>perActor[id].invalidHeldFrames===0),
 completeSoleGate:ids.every(id=>perActor[id].minimumSoleM>=-.003&&perActor[id].maximumPlantedSoleM<=.003),
 originalForceAndGeometry:ITEM_PHYSICS.assistedMaximumForceN===16&&ITEM_PHYSICS.contactToleranceM===.012&&ITEM_PHYSICS.maximumAllowedPalmPenetrationM===.004&&ITEM_PHYSICS.transportToleranceM===.035&&ITEM_PHYSICS.bottleRadiusM===.032&&ITEM_PHYSICS.bottleHeightM===.14,
 measuredFiniteForce:items.metrics.maximumConstraintForceN<=ITEM_PHYSICS.assistedMaximumForceN+1e-8&&items.metrics.maximumConstraintTorqueNm<=ITEM_PHYSICS.assistedMaximumTorqueNm+1e-8,
 realPhysicalSubsteps:items.metrics.maximumSubstepSeconds<=ITEM_PHYSICS.fixedStepSeconds+1e-10,
 finitePhysicalContact:ids.every(id=>perActor[id].maximumConstraintErrorM<=.035&&perActor[id].maximumPalmSurfaceM<=.012&&perActor[id].maximumPalmPenetrationM<=.004),logicalInvariants:sim.checkInvariants().ok};
const stem=path.join(root,'evidence','CAPTURE_RECOVERY_CHAIN_'+tag),traceBytes=Buffer.from(JSON.stringify(trace)),poseBytes=Buffer.from(JSON.stringify({schema:'actual-captured-pickup-phase-cache/1',actorIds:ids,sourceHashes,source:'read from actual new runtime immediately before real physics step; no mocked acquisition',samples:selected,shoes:Object.fromEntries(actors.map(a=>[a.id,a.footwear]))}));
fs.writeFileSync(stem+'_TRACE.json',traceBytes);fs.writeFileSync(stem+'_POSES.json',poseBytes);
// Export the actual held-contact cache for independent body/cloth review. No
// source pose is re-evaluated here; only those measured matrices are restored.
const contactStates=[];
for(const actor of actors){const success=successful.find(r=>r.id===actor.id),rows=success&&poses.get(success.token),cached=rows?.find(r=>r.phase==='contact-hold');if(!cached)continue;
 for(let j=0;j<104;j++){actor.rig.skinMatrices[j].set(cached.skinMatrices.slice(j*16,j*16+16));actor.rig.posedMatrices[j].set(cached.posedMatrices.slice(j*16,j*16+16));}
 actor.rig.rootTranslation.splice(0,3,...cached.rootTranslation);const points=[];for(let v=0;v<actor.binding.N;v++)points.push(...actor.poseTools.sampleVertex(v));
 contactStates.push({id:actor.id+'-actual-contact-frame99',actor:actor.id,time:cached.time,frame:cached.frame,token:cached.token,phase:cached.phase,sourceFrame:cached.sourceFrame,rootWorld:cached.rootWorld,rootMatrix:Array.from(cached.rootMatrix),rootTranslation:cached.rootTranslation,
  positions:points,skinMatrices:actor.rig.skinMatrices.map(m=>Array.from(m)),posedMatrices:actor.rig.posedMatrices.map(m=>Array.from(m)),nativePose:actor.rig.exportNativePose(),feet:cached.feet});
}
const contactBytes=Buffer.from(JSON.stringify({schema:'actual-native-captured-contact-poses/1',bodyVertexCount:9253,faces:Array.from(actors[0].nativeSource.faces),sourceHashes,source:'actual successful transaction matrices, without re-evaluating or replacing the captured pose',headIncluded:false,states:contactStates}));
fs.writeFileSync(stem+'_CONTACT_POSES.json',contactBytes);
// Material continuity needs the actual preceding poses, not a cold jump or
// interpolated copies of the sparse shoe measurements. Keep the requested D
// segment from the same real transaction; full CSR can reconstruct its body.
const denseActors=(process.env.DENSE_POSE_ACTOR_IDS||'D').split(',').filter(id=>ids.includes(id)),denseStates=[];
for(const id of denseActors){const success=successful.find(r=>r.id===id),rows=success&&poses.get(success.token);if(!rows)continue;
 for(const r of rows.filter(r=>['entry','down','contact-hold'].includes(r.phase)))denseStates.push({...r,id:id+'-actual-'+r.phase+'-'+r.frame,
  skinMatrices:Array.from({length:104},(_,j)=>Array.from(r.skinMatrices.slice(j*16,j*16+16))),posedMatrices:Array.from({length:104},(_,j)=>Array.from(r.posedMatrices.slice(j*16,j*16+16))),rootMatrix:Array.from(r.rootMatrix)});
}
const denseBindingBytes=Buffer.from(JSON.stringify({schema:'native-actual-display-csr-set/1',actorIds:denseActors,sourceHashes,headIncluded:false,
 source:'Exact full displayed-body CSR including both neutral residual corrections, Float32 packed values and all native influences; use the actual cached row-major skin matrices.',
 bindings:Object.fromEntries(actors.filter(a=>denseActors.includes(a.id)).map(a=>[a.id,{bodyVertexCount:a.binding.N,faces:Array.from(a.nativeSource.faces),rigNames:a.rig.names,
  displayRange:Array.from(a.binding.displayRange),displayPacked:Array.from(a.binding.displayPacked)}]))}));
fs.writeFileSync(stem+'_DISPLAY_CSR.json',denseBindingBytes);
const denseBindingEvidence={path:path.basename(stem+'_DISPLAY_CSR.json'),bytes:denseBindingBytes.length,sha256:sha(denseBindingBytes),actorIds:denseActors};
const denseBytes=Buffer.from(JSON.stringify({schema:'actual-native-captured-entry-contact-poses/1',bodyVertexCount:9253,faces:Array.from(actors[0].nativeSource.faces),actorIds:denseActors,sourceHashes,
 source:'Every real simulation pose from entry through first contact99 of the successful transaction. No pose synthesis, sparse interpolation or new acquisition input.',headIncluded:false,binding:denseBindingEvidence,states:denseStates}));
fs.writeFileSync(stem+'_ENTRY_CONTACT_POSES.json',denseBytes);
const report={schema:'captured-pickup-recovery-physical-chain/1',actorIds:ids,requestedBottleCount:goal,successfulBottleCount:successful.length,release:false,rendered:false,
 scope:'real production LifeSimulation/NativeMotion/ItemWorld/Cannon path on complete canonical native body/hand and original shoes; GNM head/cloth/hair/browser and food excluded',
 fixtureCapabilities:{pickup:'actual measured geometry',bread:false,window:false,water:false,reason:'bounded pickup-only numerical verification; no fake food/mouth fixture'},
 sourceHashes,constants:ITEM_PHYSICS,stances,spawned,initialInvariants,finalInvariants:sim.checkInvariants(),time:sim.time,perActor,physics:items.metrics,gates,passed:Object.values(gates).every(Boolean),failure,receipts,ownershipChanges,
 evidence:{trace:{path:path.basename(stem+'_TRACE.json'),bytes:traceBytes.length,sha256:sha(traceBytes)},poses:{path:path.basename(stem+'_POSES.json'),bytes:poseBytes.length,sha256:sha(poseBytes),samples:selected.length},contactPoses:{path:path.basename(stem+'_CONTACT_POSES.json'),bytes:contactBytes.length,sha256:sha(contactBytes),states:contactStates.length},entryContactPoses:{path:path.basename(stem+'_ENTRY_CONTACT_POSES.json'),bytes:denseBytes.length,sha256:sha(denseBytes),states:denseStates.length,actorIds:denseActors},displayBindings:denseBindingEvidence},
 finalTasks:sim.actors.map(a=>({id:a.id,task:a.task,inventory:a.inventory,counters:a.counters})),finalBottles:sim.bottles};
fs.writeFileSync(stem+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,gates,failure,perActor:ids.map(id=>({actor:id,...perActor[id],coveredSourceFrames:perActor[id].coveredSourceFrames.length})),output:stem+'.json'}));
if(!report.passed)process.exitCode=2;
