/** Actual native sitting, safe rain interruption, standing and shelter choice.
 * Original whole canonical body and soles; no garment/head/material claim. */
import fs from 'node:fs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {LifeSimulation} from '../src/LifeSimulation.mjs';
import {STREET_LAYOUT} from '../src/WorldLayout.mjs';
const root=globalThis.__BREAD_QA_ROOT__,ids=(process.env.ACTOR_IDS||'B').split(','),tag=process.env.RUN_TAG||ids.join(''),rows=[],trace=[];
for(const id of ids){
  const actor=await createMotionRecoveryFixture(id),base=new LifeSimulation().actor(id),spot=STREET_LAYOUT.spots[base.preferredSeat];
  const sim=new LifeSimulation({initialBottles:[],actors:[{...base,x:spot.stand[0],z:spot.stand[2],yaw:spot.yaw,
    needs:{hunger:.05,fatigue:.98},capabilities:{pickup:false,bread:false,water:false,window:false}}]});
  let seated=null,stood=null,rainAt=null,seatId=null,shelter=null,failure=null;
  const statistics={sitFrames:0,seatedFrames:0,standFrames:0,invalidTransitionFrames:0,
    maximumBoneLengthErrorM:0,maximumFootSurfaceErrorM:0,minimumFullSoleM:Infinity,maximumPlantedSoleM:-Infinity,
    maximumSeatedSupportErrorM:0,maximumRootMismatchM:0,seatReleasedBeforeStand:false};
  for(let frame=0;frame<60*60;frame++){
    const dt=1/60;sim.update(dt);const state=sim.actor(id),task=state.task;
    let mode=state.moving?'walk':'idle',x=state.x,z=state.z,seatY=.46;
    if(task?.kind==='rest'&&task.phase!=='approach'){
      const loc=sim.locations[task.targetId];x=loc.seat.x;z=loc.seat.z;seatY=loc.height;
      mode=task.phase==='interact'?'sit':task.phase==='depart'?'stand':'sitting';seatId=task.targetId;
    }
    const report=actor.motion.update({dt,time:sim.time,x,z,yaw:state.yaw,mode,progress:task?.progress||0,seatY,
      seatApproachOffset:.65,standStartFactor:task?.kind==='rest'&&task.phase==='depart'?task.standStartFactor??1:null,grip:1});
    if(['sit','sitting','stand'].includes(mode)){
      if(mode==='sit')statistics.sitFrames++;if(mode==='sitting')statistics.seatedFrames++;if(mode==='stand')statistics.standFrames++;
      if(!report.poseValid)statistics.invalidTransitionFrames++;
      statistics.maximumBoneLengthErrorM=Math.max(statistics.maximumBoneLengthErrorM,report.boneLengthErrorM);
      statistics.maximumFootSurfaceErrorM=Math.max(statistics.maximumFootSurfaceErrorM,report.footErrorM);
      statistics.maximumRootMismatchM=Math.max(statistics.maximumRootMismatchM,Math.hypot(report.rootWorld[0]-state.x,report.rootWorld[2]-state.z));
      if(mode==='sitting')statistics.maximumSeatedSupportErrorM=Math.max(statistics.maximumSeatedSupportErrorM,report.seatErrorM);
      for(const foot of Object.values(report.feet)){
        statistics.minimumFullSoleM=Math.min(statistics.minimumFullSoleM,foot.soleMinimumWorldYM);
        if(foot.planted)statistics.maximumPlantedSoleM=Math.max(statistics.maximumPlantedSoleM,foot.soleMinimumWorldYM);
      }
      if(mode==='stand'&&!stood&&sim.resources[seatId]!==id)statistics.seatReleasedBeforeStand=true;
      if(frame%6===0||task?.progress>=.999)trace.push({actor:id,frame,time:sim.time,task:structuredClone(task),report});
      if(task?.waitForAcknowledgement&&task.progress>=.999&&report.finite&&report.poseValid&&report.completed){
        const token=task.token,phase=task.phase,ack=sim.acknowledgeInteraction(id,true,{token,evidence:{executor:'native-104-bone-seat',...report}}),
          duplicate=sim.acknowledgeInteraction(id,true,{token,evidence:{executor:'native-104-bone-seat',...report}});
        const receipt={time:sim.time,phase,token,ack,duplicate,report};
        if(phase==='interact')seated=receipt;else stood=receipt;
      }
    }
    if(seated&&!rainAt&&sim.time-seated.time>=.4){
      rainAt=sim.time;sim.toggleRain(true);
      if(sim.resources[seatId]!==id||sim.actor(id).task?.phase!=='depart'){failure='Rain did not preserve the occupied seat while standing';break;}
    }
    if(stood&&state.task?.kind==='shelter'&&state.task.phase==='rest'){shelter={time:sim.time,targetId:state.task.targetId,x:state.x,z:state.z};break;}
  }
  const gates={actualNativeSitCommitted:seated?.ack?.committed===true,actualNativeStandCommitted:stood?.ack?.committed===true,
    noDuplicateReceipt:seated?.duplicate?.committed===false&&stood?.duplicate?.committed===false,
    actualRainTriggeredDeparture:rainAt!==null&&stood?.time>rainAt,seatOccupiedUntilStanding:!statistics.seatReleasedBeforeStand,
    seatReleasedAfterStanding:!!stood&&sim.resources[seatId]!==id,actualShelterArrival:!!shelter,
    originalBoneLengths:statistics.maximumBoneLengthErrorM<=.00001,finiteNativeTransition:statistics.invalidTransitionFrames===0,
    originalFullSoleAboveMinus3mm:statistics.minimumFullSoleM>=-.003,plantedSoleBelow3mm:statistics.maximumPlantedSoleM<=.003,
    originalSeatSupportWithin12mm:statistics.seatedFrames>0&&statistics.maximumSeatedSupportErrorM<=.012,
    footSurfaceWithin15mm:statistics.maximumFootSurfaceErrorM<=.015,rootMatchesSweptNavigation:statistics.maximumRootMismatchM<=.001,
    logicalInvariants:sim.checkInvariants().ok};
  rows.push({actor:id,passed:Object.values(gates).every(Boolean),gates,statistics,seated,stood,rainAt,shelter,failure,
    final:{time:sim.time,actor:structuredClone(sim.actor(id)),events:sim.events.slice(-12)},
    source:{bones:actor.rig.count,canonicalBodyVertices:actor.binding.N,fullSoleVerticesPerSide:actor.footwear.perSide.R.solePointsNative?.length??null}});
}
const output={schema:'native-seat-rain-departure-numerical/1',passed:rows.every(r=>r.passed),sourceHashes:globalThis.__BREAD_QA_SOURCE_HASHES__,
  release:false,rendered:false,scope:'Original full canonical body, 104 native bones and all complete original sole samples; actual LifeSimulation seat reservation and rain/shelter transitions. Native sampled posterior support, not full body-seat collision, cloth or browser acceptance.',rows};
fs.writeFileSync(root+'/evidence/NATIVE_SEAT_'+tag+'_TRACE.json',JSON.stringify(trace));
fs.writeFileSync(root+'/evidence/NATIVE_SEAT_'+tag+'.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:output.passed,rows:rows.map(r=>({actor:r.actor,passed:r.passed,gates:r.gates,statistics:r.statistics,failure:r.failure}))}));
if(!output.passed)process.exitCode=2;
