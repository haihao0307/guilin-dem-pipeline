/** Run only in the official Actions executor. Uses the same pinned source model
 * loader; no browser, replacement mesh, renderer, second clock or new asset URL. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import * as THREE from './sources/vendor/three.module.js';
import {loadNativeActorResources,createNativeActor,NATIVE_SOURCE_COMMIT} from './NativeActor.mjs';
import {makeBuildingRecipe} from '../building-plan.mjs';
import {makeRescueContract} from '../rescue-contract.mjs';
import {createCityRescueGame,makeRescueSupportSampler} from '../rescue-gameplay.mjs';
const OUT=process.env.NATIVE_ROUTE_OUT||process.env.NATIVE_ACTOR_OUT||'actual-native-actor-probe';fs.mkdirSync(OUT,{recursive:true});
const end=Number(process.env.NATIVE_PROBE_SECONDS||2.5),dt=Number(process.env.NATIVE_PROBE_DT||.05);
if(!Number.isFinite(end)||end<=0||end>180||!Number.isFinite(dt)||dt<=0||dt>.05)throw Error('Use 0 < NATIVE_PROBE_SECONDS <= 180 and 0 < DT <= .05');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={schema:'actual-native-route-probe/1',sourceCommit:NATIVE_SOURCE_COMMIT,coreSHA256:sha(fs.readFileSync(new URL('../rescue-gameplay.mjs',import.meta.url))),started:new Date().toISOString(),passed:false,contactPassed:true,modelLoaded:false,footFixtureSaved:false,frames:[],limits:{cpuOnly:true,noGpuClaim:true,fullCSRForOriginalFootVertices:true,syntheticCharacter:false,visualAcceptance:false}};
const write=(name,value)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(value,null,2));let actor,game;
try{
  const resources=await loadNativeActorResources({onProgress:p=>{report.progress=p;write('progress.json',report);}});
  report.modelLoaded=true;
  const contract=makeRescueContract(makeBuildingRecipe()),sampleSupport=makeRescueSupportSampler(contract);game=createCityRescueGame({contract});
  actor=await createNativeActor({THREE,resources,id:'crew',sampleSupport});
  const initial=game.snapshot().actors.find(a=>a.id==='crew');actor.reset({worldSeconds:0,actor:initial});
  report.initialProof=actor.proof;report.initialReport=actor.report();report.initialContacts=actor.inspectContacts({includeVertices:true});
  const fixture=actor.exportDiagnosticFixture(),fixtureBytes=JSON.stringify(fixture);fs.writeFileSync(path.join(OUT,'original-native-foot-fixture.json'),fixtureBytes);report.footFixtureSaved=true;report.fixture={filename:'original-native-foot-fixture.json',bytes:Buffer.byteLength(fixtureBytes),sha256:sha(fixtureBytes),footVertices:fixture.footCSR.length,scope:fixture.scope};
  write('progress.json',report);game.command({type:'start'});const command=game.command({type:'rescue',personId:'east-neighbour',anchorId:'half-7',mode:'front'});if(!command.accepted)throw Error('Original first route rejected: '+JSON.stringify(command));
  let t=0;while(t<end){t=Math.min(end,t+dt);const snapshot=game.update(t),state=snapshot.actors.find(a=>a.id==='crew');try{actor.applyFrame({worldSeconds:t,actor:state});}catch(error){report.failureState={snapshot,actorState:state,native:actor.inspectFailure(),lastAcceptedReport:actor.report(),lastAcceptedContacts:actor.inspectContacts({includeVertices:true})};throw error;}report.frames.push({elapsed:t,phase:snapshot.phase,actor:{id:state.id,position:state.position,direction:state.direction,moving:state.moving,pose:state.pose},native:actor.report().locomotion,contacts:actor.inspectContacts()});}
  report.contactPassed=report.initialContacts.candidateGate&&report.frames.every(f=>f.contacts.candidateGate);report.passed=report.contactPassed;if(!report.passed)process.exitCode=1;report.finalState=game.snapshot();
}catch(error){report.failure=String(error.stack||error);report.nativeFailure=actor?.inspectFailure?.()??null;process.exitCode=1;}
finally{report.finished=new Date().toISOString();write('actual-route-probe.json',report);actor?.dispose();console.log(JSON.stringify({passed:report.passed,modelLoaded:report.modelLoaded,frames:report.frames.length,failure:report.failure,fixture:report.fixture,out:OUT}));}
