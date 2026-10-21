/** Numerical execution of original native people against the actual authored
 * moving window and valve. No GNM, cloth, browser or rendered acceptance. */
import fs from 'node:fs';
import {THREE} from '../src/NativeBinding.mjs';
import {math} from '../src/NativeRig.mjs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {createCourtyard} from '../src/Courtyard.mjs';
import {LifeSimulation} from '../src/LifeSimulation.mjs';
import {EnvironmentWorld} from '../src/EnvironmentWorld.mjs';
const {pos,rotation,mv,sub,unit,dot,clamp,DEG}=math;
const root=globalThis.__BREAD_QA_ROOT__,ids=(process.env.ACTOR_IDS||'A,B,C,D,E,F').split(','),tag=process.env.RUN_TAG||ids.join('');
const rows=[],trace=[],courtyard=createCourtyard(THREE);
for(const id of ids){
  const actor=await createMotionRecoveryFixture(id),capabilities=actor.motion.assessCapabilities({spots:courtyard.spots,getInteractionTarget:courtyard.getInteractionTarget});
  for(const scenario of ['close-window','open-window','water']){
    const kind=scenario==='water'?'water':'window',spot=courtyard.spots[kind==='window'?'windowA':'planterA'];
    if(!capabilities[kind]){rows.push({actor:id,scenario,eligible:false,assessment:actor.motionCapabilityReport.results[kind]});continue;}
    actor.motion.reset();const base=new LifeSimulation().actor(id);
    const sim=new LifeSimulation({initialBottles:[],actors:[{...base,x:spot.stand[0],z:spot.stand[2],yaw:spot.yaw,
      needs:{hunger:.05,fatigue:.05},capabilities:{pickup:false,bread:false,window:kind==='window',water:kind==='water'}}],
      colliders:courtyard.colliders,spots:courtyard.spots});
    // Explicit starting world conditions, before any autonomous choice.
    if(scenario==='close-window')sim.toggleWind();
    if(scenario==='open-window'){sim.environment.windowOpen=false;sim.environment.windowProgress=0;}
    if(kind==='water')sim.dryPlanter();
    const world=new EnvironmentWorld({sim,courtyard}),statistics={interactionFrames:0,contactFrames:0,maximumWristDegrees:0,
      minimumSoleM:Infinity,maximumPlantedSoleM:-Infinity,maximumVisibleHandleDisagreementM:0,invalidPoses:0};
    let receipt=null,ack=null,duplicate=null;
    for(let frame=0;frame<30*60;frame++){
      const dt=1/60;sim.update(dt);const state=sim.actor(id),task=state.task,input=world.motionInput(state);
      const report=actor.motion.update({dt,time:sim.time,x:state.x,z:state.z,yaw:state.yaw,
        mode:state.moving?'walk':'idle',progress:task?.progress||0,grip:1,...input});
      const replies=world.update(dt,{[id]:report});courtyard.update(sim,dt);
      if(task?.kind===kind&&task.phase==='interact'){
        statistics.interactionFrames++;if(!report.poseValid)statistics.invalidPoses++;
        if(report.contactReady){
          statistics.contactFrames++;
          const r=actor.rig,limb=r.limbs.armR,forearm=unit(sub(pos(r.posedMatrices[limb.c]),pos(r.posedMatrices[limb.b]))),hand=unit(mv(rotation(r.skinMatrices[limb.c]),r.hand.R.forward));
          statistics.maximumWristDegrees=Math.max(statistics.maximumWristDegrees,Math.acos(clamp(dot(forearm,hand),-1,1))/DEG);
        }
        for(const foot of Object.values(report.feet)){statistics.minimumSoleM=Math.min(statistics.minimumSoleM,foot.soleMinimumWorldYM);if(foot.planted)statistics.maximumPlantedSoleM=Math.max(statistics.maximumPlantedSoleM,foot.soleMinimumWorldYM);}
        const g=courtyard.environmentReport(),a=kind==='window'?g.windowHandle:g.valveHandle,b=kind==='window'?g.expectedWindowHandle:g.expectedValveHandle;
        statistics.maximumVisibleHandleDisagreementM=Math.max(statistics.maximumVisibleHandleDisagreementM,Math.hypot(...a.map((x,i)=>x-b[i])));
        if(frame%6===0||replies.length)trace.push({actor:id,scenario,frame,time:sim.time,report,geometry:g,record:world.records.get(id)});
      }
      if(replies.length){receipt=replies[0];ack=sim.acknowledgeInteraction(id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});duplicate=sim.acknowledgeInteraction(id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});break;}
    }
    const evidence=receipt?.evidence,finished=sim.environment,gates={actualNativeContactReceipt:receipt?.success===true&&ack?.committed===true,
      noDuplicateCommit:duplicate?.committed===false,actualMechanismGeometry:statistics.maximumVisibleHandleDisagreementM<1e-8,
      actualPalmContact:!!evidence?.nativePalmRequired&&evidence.maximumContactErrorM<=.020&&evidence.contactSamples>=3,
      finiteNativePoses:statistics.invalidPoses===0,contactWristBelow65Degrees:statistics.maximumWristDegrees<65,
      fullSoleAboveMinus3mm:statistics.minimumSoleM>=-.003,plantedSoleBelow3mm:statistics.maximumPlantedSoleM<=.003,
      expectedWorldResult:kind==='water'?finished.watering===0&&finished.plantMoisture===.95:
        finished.windowProgress===(scenario==='open-window'?1:0)&&finished.windowOpen===(scenario==='open-window'),
      logicalInvariants:sim.checkInvariants().ok};
    rows.push({actor:id,scenario,eligible:true,passed:Object.values(gates).every(Boolean),gates,statistics,receipt,ack,duplicate,
      finalEnvironment:{...finished},assessment:actor.motionCapabilityReport.results[kind]});
  }
}
const eligible=rows.filter(x=>x.eligible),output={schema:'actual-native-authored-mechanism-execution/1',sourceHashes:globalThis.__BREAD_QA_SOURCE_HASHES__,
  passed:eligible.length>0&&eligible.every(x=>x.passed),release:false,rendered:false,headIncluded:false,
  scope:'Complete canonical native body, all bones and CSR, exact moving Three scene handles, real LifeSimulation and EnvironmentWorld receipts. Kinematic assisted mechanisms; no fluid/hand friction claim. GNM, cloth, dynamic shoe-upper, materials and browser acceptance excluded.',rows};
fs.writeFileSync(root+'/evidence/NATIVE_ENVIRONMENT_'+tag+'_TRACE.json',JSON.stringify(trace));
fs.writeFileSync(root+'/evidence/NATIVE_ENVIRONMENT_'+tag+'.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:output.passed,rows:rows.map(x=>({actor:x.actor,scenario:x.scenario,eligible:x.eligible,passed:x.passed,gates:x.gates,statistics:x.statistics,reason:x.receipt?.reason}))}));
if(!output.passed)process.exitCode=2;
