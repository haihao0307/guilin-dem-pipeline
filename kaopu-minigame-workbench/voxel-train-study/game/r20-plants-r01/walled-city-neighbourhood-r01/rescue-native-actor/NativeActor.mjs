import * as NativeTHREE from './sources/vendor/three.module.js';
import {loadCommon} from './sources/full/ui/load-common.mjs';
import {defaultState} from './sources/full/src/State.mjs';
import {AnimatedHuman} from './sources/full/boxing/AnimatedHuman.mjs';
import {createCapturedActivityController} from './sources/full/activity-r01/CapturedActivityController.mjs';
import {createNativeActorHostBinding} from './sources/tests/native-actor-contract/hand-anchor-r02.mjs';
import {createHostFrameController,extractHorizontalRoot,validateActorFrame} from './host-frame.mjs';
import {createSupportWalker,nativeToWorld} from './SupportWalker.mjs';
import {summarizeFootContacts} from './contact-diagnostics.mjs';
import {originalGeometryProof} from './identity-proof.mjs';

export const NATIVE_SOURCE_COMMIT='30c5405cc9801e216e1155249a1b87232e4faccd';
export const NATIVE_ASSET_BASE=new URL(`https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/${NATIVE_SOURCE_COMMIT}/kaopu-unified-human-workbench/full/`);
export const NATIVE_TOPOLOGY='e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de';
export const NATIVE_ADAPTER='4ac1f6b9ffac5ab45d1a427a1eb5e9578af0e7f105d58bff4d48555e4e2027a5';
const walkSHA256='6456086df667e7778e3b1896f0ee968039b61bacb69f9ea1ab656fa85fceb2fe';
const walkBlob='5eaf0c4fe256e5272fd6935d1ef0a725f7a0c288';
const hash=async(bytes,algorithm='SHA-256')=>[...new Uint8Array(await crypto.subtle.digest(algorithm,bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
let resourcesPromise=null;
async function readWalkSource(signal){
  const response=await fetch(new URL('activity-r01/CMU-WALK-SOURCE.json',NATIVE_ASSET_BASE),{signal});
  if(!response.ok)throw Error('Original walk source HTTP '+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer()),prefix=new TextEncoder().encode(`blob ${bytes.length}\0`),gitBytes=new Uint8Array(prefix.length+bytes.length);gitBytes.set(prefix);gitBytes.set(bytes,prefix.length);
  if(await hash(bytes)!==walkSHA256||await hash(gitBytes,'SHA-1')!==walkBlob)throw Error('Original walk source Git blob mismatch');
  const source=JSON.parse(new TextDecoder().decode(bytes));
  if(source.schema!=='cmu16-33-source-positions/1'||source.fps!==120||source.points.length!==285)throw Error('Unexpected original captured walk');
  return source;
}
/** Loads the exact CommonPerson resources once. No viewer, scene or rAF. */
export function loadNativeActorResources({signal,onProgress=()=>{}}={}) {
  if(!resourcesPromise)resourcesPromise=Promise.all([loadCommon({signal,onProgress,base:NATIVE_ASSET_BASE}),readWalkSource(signal)]).then(([common,walkSource])=>{
    if(common.metadata.vertices!==25417||common.metadata.triangles!==50624||common.metadata.topologySha256!==NATIVE_TOPOLOGY||common.metadata.adapterFingerprint!==NATIVE_ADAPTER)throw Error('Original canonical identity mismatch');
    return {...common,walkSource,sourceCommit:NATIVE_SOURCE_COMMIT};
  }).catch(error=>{resourcesPromise=null;throw error;});
  return resourcesPromise;
}
/** Original full-CSR actor, placed in the caller's one Scene. The returned group
 * is grounded by feet: inner nativeRoot owns the original floor offset and mesh
 * owns the sole Z-up to Y-up rotation. No alternative head or body is created. */
export async function createNativeActor({THREE,resources,id='crew',state=defaultState(),color=0x328eab,tone=.64,sampleSupport}={}) {
  if(!THREE || THREE.Mesh!==NativeTHREE.Mesh || THREE.Group!==NativeTHREE.Group || THREE.REVISION!=='170')throw Error('Supply the host same-instance Three.js r170');
  if(!resources?.model||!resources?.walkSource||resources.sourceCommit!==NATIVE_SOURCE_COMMIT)throw Error('Pinned native actor resources required');
  if(state?.owners?.rig!=='anny'||['pose','translations'].some(k=>Object.values(state.anny?.[k]||{}).some(v=>v.some(x=>Math.abs(x)>1e-10))))throw Error('Original neutral Anny 104-bone body required');
  const model=resources.model;model.compute(structuredClone(state));
  const human=new AnimatedHuman(model,model.state,{color,tone});
  try {
    if(human.N!==25417||human.faces.length!==50624*3||human.names.length!==104||human.rig.source!=='anny')throw Error('Native actor topology/rig mismatch');
    const group=new THREE.Group();group.name=id+' · original-native-human';
    const nativeRoot=new THREE.Group();nativeRoot.name='native-floor-offset';nativeRoot.position.y=human.floorOffset;nativeRoot.add(human.mesh);group.add(nativeRoot);
    const actor={human,group,latest:null};
    const capture=createCapturedActivityController(human,resources.walkSource);
    const standing=extractHorizontalRoot(structuredClone(capture.evaluate(capture.duration)));capture.reset();
    const walker=sampleSupport?createSupportWalker({human,standingFrame:standing,soleIndices:capture.soleIndices,sampleSupport}):null;
    const archive=model.archive(),shapeFingerprint=await hash(new TextEncoder().encode(JSON.stringify({positions:Array.from(human.positions),rest:human.rig.restMatrices.map(m=>Array.from(m)),state:human.state})));
    const identity={topologySha256:archive.topologySha256,adapterFingerprint:archive.adapterFingerprint,shapeFingerprint};
    let pose='stand',localTime=0,previousPose=null,disposed=false,hostInput=null;
    const selectPose=(next,time,input)=>{hostInput=input;if(disposed)throw Error('Actor disposed');if(next!==previousPose&&next==='walk')capture.reset();previousPose=next;pose=next;localTime=time;};
    const bindingOptions={actor,readIdentity:()=>identity,isAutonomouslyPlaying:()=>false,evaluateFrame:()=>walker?walker.evaluate(hostInput):(pose==='walk'?extractHorizontalRoot(capture.evaluate(Math.min(localTime,capture.duration))):standing)};
    let binding=createNativeActorHostBinding(bindingOptions);
    const createHost=()=>createHostFrameController({id,group,nativeBinding:binding,selectPose,duration:capture.duration,readHeading:walker?()=>actor.latest.heading:undefined});
    let host=createHost();
    const proof=originalGeometryProof({human,nativeRoot,sourceCommit:resources.sourceCommit,expectedCommit:NATIVE_SOURCE_COMMIT});
    const result={id,group,nativeRoot,human,proof,applyFrame:input=>{const r=host.applyFrame(input);return walker?{...r,walkExhausted:false,loop:false,locomotion:walker.report()}:r;},readNativeFrame:()=>binding.readFrame(),
      report:()=>({schema:'native-rescue-actor-candidate/1',...identity,...human.report,...host.report(),walkExhausted:walker?false:host.report().walkExhausted,sourceCommit:NATIVE_SOURCE_COMMIT,sameHostThree:true,meshIsOriginal:human.mesh.parent===nativeRoot,canvasCreated:0,rafCreated:0,standSource:'original CMU16_33 captured stop final frame',walkSource:walker?'original NativeRig distance-driven support-foot IK adapter':'original CMU16_33 captured walk-stop, single playback',locomotion:walker?.report()||null,clothing:'existing shader color region only; no mature garment geometry or cloth simulation',seated:false,suspendedTransport:false,stairFootContactVerified:false,visualAcceptance:false}),
      reset(input){validateActorFrame(input);if(input.actor.id!==id)throw Error('Wrong actor identity');if(disposed)throw Error('Actor disposed');walker?.reset();capture.reset();previousPose=null;hostInput=null;binding=createNativeActorHostBinding(bindingOptions);host=createHost();return result.applyFrame(input);},
      inspectContacts({includeVertices=false}={}){if(!actor.latest||!sampleSupport)throw Error('An evaluated original native support frame is required');const heading=actor.latest.heading??group.rotation.y,root=group.position.toArray(),out={};for(const side of ['L','R']){const contact=actor.latest.footContacts?.[side],indices=walker?.calibration[side].soleBandIndices||capture.soleIndices[side],vertices=indices.map(index=>{const world=nativeToWorld(human.sampleVertex(index),root,heading,human.floorOffset),surface=sampleSupport({x:world[0],z:world[2],referenceY:contact?.worldSole?.[1]??root[1],maxRise:.23,maxDrop:.43});return{index,world,supportId:surface?.supportId??null,supportY:surface?.y??null,gapM:surface?world[1]-surface.y:null};});out[side]={...summarizeFootContacts(vertices,{planted:contact?.planted??false}),fullFootRegionVertexCount:capture.soleIndices[side].length,soleBand:'Original captured-standing full-CSR samples within 10mm of each foot minimum',...(includeVertices?{samples:vertices}:{})};}return{schema:'native-rescue-actual-sole-diagnostics/1',id,elapsed:host.report().elapsed,sourceCommit:NATIVE_SOURCE_COMMIT,feet:out,candidateGate:Object.values(out).every(f=>f.candidateGate)};},
      measureSoles(options){return result.inspectContacts(options);},
      dispose(){if(disposed)return;disposed=true;group.removeFromParent();human.dispose();}};
    group.userData.nativeActor={id,...proof};
    return result;
  } catch(error){human.dispose();throw error;}
}

/** Stable scene entry: one original model loader, three separately owned poses. */
export async function createNativeRescueActors({THREE,worldRoot,sampleSupport,onProgress,signal}={}) {
  if(!worldRoot?.isObject3D||typeof sampleSupport!=='function')throw Error('Existing worldRoot and actual floor/tread support sampler required');
  const resources=await loadNativeActorResources({signal,onProgress}),actors={};
  try{
    for(const [id,color]of [['crew',0x328eab],['east-neighbour',0x927550],['west-neighbour',0x796d91]]){
      actors[id]=await createNativeActor({THREE,resources,id,color,sampleSupport});worldRoot.add(actors[id].group);
    }
  }catch(error){for(const actor of Object.values(actors))actor.dispose();throw error;}
  return {actors,proof:{sourceCommit:NATIVE_SOURCE_COMMIT,originalActorCount:3,sharedModelLoad:true,verticesPerActor:25417,trianglesPerActor:50624,bonesPerActor:104,sameHostThree:true,canvasCreated:0,rafCreated:0,visualAcceptance:false,clothing:'original shader region only; no mature garments',suspendedTransport:false},dispose(){for(const actor of Object.values(actors))actor.dispose();}};
}
