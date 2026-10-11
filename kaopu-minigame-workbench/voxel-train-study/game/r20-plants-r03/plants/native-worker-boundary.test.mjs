import assert from 'node:assert/strict';
import test from 'node:test';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import * as THREE from './vendor/three.module.min.js';
import {createPlantRecipe,verifyResourceBytes} from './native-codec/codec.mjs';
import {KNOWN_NATIVE_HASH_PAIRS} from './rules/native78-equivalence.mjs';
import {GENERATION_WORKER_VERSION,assertNativeRenderPacket,uniqueTransferBuffers,verifyNativeRenderResources} from './rules/native78-generation-worker.mjs';
import {requestNativeRenderPacket,buildNativeMusa,equivalentNativeTextures} from './rules/plant-operator.mjs';
const workerURL=new URL('./rules/native78-generation-worker.mjs',import.meta.url);
const recipe=createPlantRecipe();
const wrapper=`
const {parentPort}=require('node:worker_threads');
const {createHash}=require('node:crypto');
(async()=>{
 const {installNativeGenerationWorker}=await import(${JSON.stringify(workerURL.href)});
 const scope={onmessage:null,close(){parentPort.close();},postMessage(message,transfer){
  if(message.type==='result'&&process.env.NATIVE_TRANSFER_AUDIT==='1'){
   const before=transfer.map(b=>({bytes:b.byteLength,sha256:createHash('sha256').update(new Uint8Array(b)).digest('hex')}));
   parentPort.postMessage({...message,testAudit:{before,unique:new Set(transfer).size===transfer.length}},transfer);
   parentPort.postMessage({type:'test-detached',byteLengths:transfer.map(b=>b.byteLength)});
  }else parentPort.postMessage(message,transfer);
 }};
 installNativeGenerationWorker(scope);parentPort.on('message',data=>scope.onmessage?.({data}));
})().catch(error=>{throw error});
`;
class NodeModuleWorkerFacade{
 static instances=[];
 constructor(url,options){
  assert.equal(url.href,workerURL.href);assert.equal(options.type,'module');
  this.worker=new NodeWorker(wrapper,{eval:true});this.terminationCount=0;NodeModuleWorkerFacade.instances.push(this);
  this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.({message:error.message,preventDefault(){}}));
 }
 postMessage(value){this.worker.postMessage(value);}
 terminate(){this.terminationCount++;this.worker.terminate();}
}
let packet;
test('real worker_threads transport transfers every original buffer once with no lost bytes or plain fields',async()=>{
 const worker=new NodeWorker(wrapper,{eval:true,env:{...process.env,NATIVE_TRANSFER_AUDIT:'1'}}),messages=[];
 const done=new Promise((resolve,reject)=>{worker.on('message',m=>messages.push(m));worker.on('error',reject);worker.on('exit',code=>code===0?resolve():reject(Error('worker exit '+code)));});
 worker.postMessage({type:'generate',version:GENERATION_WORKER_VERSION,requestId:'test-zero-copy',recipe});await done;
 const result=messages.find(m=>m.type==='result');assert(result,JSON.stringify(messages));packet=result.packet;
 const expectedPair={22:'node24-reference',24:'node24-reference'}[Number(process.versions.node.split('.')[0])];
 assert(expectedPair,'This boundary test requires one of the qualified Node22 or Node24 engine');
 assert.equal(assertNativeRenderPacket(packet,recipe).matchedPair,expectedPair);
 assert.equal(result.testAudit.unique,true);
 const transferred=uniqueTransferBuffers(packet);assert.equal(transferred.length,result.transferProof.bufferCount);
 assert.equal(transferred.length,result.testAudit.before.length);
 for(let i=0;i<transferred.length;i++){assert.equal(transferred[i].byteLength,result.testAudit.before[i].bytes);assert.equal(createHash('sha256').update(new Uint8Array(transferred[i])).digest('hex'),result.testAudit.before[i].sha256);}
 assert(messages.find(m=>m.type==='test-detached').byteLengths.every(n=>n===0));
 assert.deepEqual(messages.filter(m=>m.type==='progress').map(m=>m.stage),['generated','validated']);
 assert.equal(packet.geometry.triangleCount,36330);assert.equal(packet.counts.leaf,28);
 const {profile78,generateTropical78}=await import('./rules/native78-musa-author.mjs');
 const original=generateTropical78(profile78(recipe.profile.species,recipe.profile),{compactBlades76:true});
 assert.equal(packet.nativeWindHeight,Math.max(.1,original.growth.axes.reduce((h,a)=>Math.max(h,...a.path.map(p=>p.position[1])),0)));
 assert.deepEqual(packet.geometry,original.geometry);assert.deepEqual(packet.surfaces,original.surfaces);
 assert.equal(packet.sourceGeometryBytes,2499608);assert.doesNotThrow(()=>structuredClone(packet));
 await verifyNativeRenderResources(packet.surfaces,recipe.resources);
});
test('shared views use a unique transfer entry; detached source and recipient aliases are preserved',()=>{
 const buffer=new ArrayBuffer(32),a=new Uint8Array(buffer,0,16),b=new Float32Array(buffer,16,4);a[0]=76;b[0]=78;
 const fixture={a,b,same:a},transfer=uniqueTransferBuffers(fixture);assert.equal(transfer.length,1);
 const received=structuredClone(fixture,{transfer});assert.equal(buffer.byteLength,0);assert.equal(received.a[0],76);assert.equal(received.b[0],78);assert.strictEqual(received.a,received.same);assert.strictEqual(received.a.buffer,received.b.buffer);
 assert.throws(()=>uniqueTransferBuffers(fixture),/attached/);
 assert.throws(()=>uniqueTransferBuffers({method(){}}),/plain data/);
 assert.throws(()=>uniqueTransferBuffers({get data(){return 1;}}),/accessors/);
});
test('wrong and mixed native hashes, source closure, growth counts, shape, provenance and pixels reject',async()=>{
 assert(packet);
 assert.throws(()=>assertNativeRenderPacket({...packet,contentHash:'0'.repeat(64)},recipe),/Unqualified/);
 const otherPairs=KNOWN_NATIVE_HASH_PAIRS.filter(p=>p.content!==packet.contentHash);assert.equal(otherPairs.length,KNOWN_NATIVE_HASH_PAIRS.length-1);for(const other of otherPairs){const combinationIsKnown=KNOWN_NATIVE_HASH_PAIRS.some(p=>p.geometry===packet.geometryHash&&p.content===other.content);if(combinationIsKnown)assert.equal(other.geometry,packet.geometryHash);else assert.throws(()=>assertNativeRenderPacket({...packet,contentHash:other.content},recipe),/Unqualified/);}
 assert.throws(()=>assertNativeRenderPacket({...packet,sourceClosureSha256:'0'.repeat(64)},recipe),/source/);
 assert.throws(()=>assertNativeRenderPacket({...packet,counts:{...packet.counts,leaf:27}},recipe),/organ/);
 assert.throws(()=>assertNativeRenderPacket({...packet,geometry:{...packet.geometry,normals:new Float32Array(3)}},recipe),/attribute/);
 assert.throws(()=>assertNativeRenderPacket({...packet,productionGate:'failed'},recipe),/production/);
 assert.throws(()=>assertNativeRenderPacket({...packet,bounds:{min:[0,0,0],max:[1,1,1]}},recipe),/bounds/);
 assert.throws(()=>assertNativeRenderPacket({...packet,geometry:{...packet.geometry,barkCoordinates69:new Float32Array(4)}},recipe),/bark/);
 const r=packet.surfaces.resources[0],old=r.bytes[0];r.bytes[0]^=1;
 try{await assert.rejects(verifyNativeRenderResources(packet.surfaces,recipe.resources),/resource hash mismatch/);}finally{r.bytes[0]=old;}
 const source=r.source;r.source={...source,license:'unlicensed'};
 try{assert.throws(()=>assertNativeRenderPacket(packet,recipe),/provenance/);}finally{r.source=source;}
});
class FakeWorker{
 static instances=[];
 constructor(url,options){this.url=url;this.options=options;this.terminationCount=0;this.sent=[];FakeWorker.instances.push(this);}
 postMessage(message){this.sent.push(message);}
 terminate(){this.terminationCount++;}
}
async function pending(options={}){const promise=requestNativeRenderPacket(recipe,{WorkerClass:FakeWorker,...options});return{promise,worker:FakeWorker.instances.at(-1)};}
test('abort before worker creation and while generating is immediate and terminates exactly once',async()=>{
 const before=FakeWorker.instances.length,a=new AbortController();a.abort();await assert.rejects(requestNativeRenderPacket(recipe,{signal:a.signal,WorkerClass:FakeWorker}),{name:'AbortError'});assert.equal(FakeWorker.instances.length,before);
 const b=new AbortController(),{promise,worker}=await pending({signal:b.signal});const late=worker.onmessage;b.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(worker.terminationCount,1);assert.equal(worker.onmessage,null);
 late({data:{type:'result'}});assert.equal(worker.terminationCount,1);
});
test('worker exceptions, message decoding, corrupt response identity and postMessage failures propagate and terminate',async()=>{
 for(const mode of ['error','messageerror','identity','remote-error']){
  const {promise,worker}=await pending(),request=worker.sent[0];
  if(mode==='error')worker.onerror({message:'test worker failed'});
  if(mode==='messageerror')worker.onmessageerror();
  if(mode==='identity')worker.onmessage({data:{type:'result',version:'bad',requestId:request.requestId}});
  if(mode==='remote-error')worker.onmessage({data:{type:'error',version:GENERATION_WORKER_VERSION,requestId:request.requestId,error:{name:'Error',message:'Unqualified native output hash pair'}}});
  await assert.rejects(promise);assert.equal(worker.terminationCount,1);assert.equal(worker.onmessage,null);
 }
 class PostFailure extends FakeWorker{postMessage(){throw Error('post failed');}}
 await assert.rejects(requestNativeRenderPacket(recipe,{WorkerClass:PostFailure}),/post failed/);assert.equal(FakeWorker.instances.at(-1).terminationCount,1);
 class InitFailure{constructor(){throw Error('constructor failed');}}
 await assert.rejects(requestNativeRenderPacket(recipe,{WorkerClass:InitFailure}),/constructor failed/);
});
test('successful transport validates unique transfer accounting then terminates its one-shot worker',async()=>{
 const {promise,worker}=await pending(),request=worker.sent[0],transfer=uniqueTransferBuffers(packet);
 worker.onmessage({data:{type:'result',version:GENERATION_WORKER_VERSION,requestId:request.requestId,packet,transferProof:{bufferCount:transfer.length,byteLength:transfer.reduce((n,b)=>n+b.byteLength,0)}}});
 const result=await promise;assert.equal(result.execution,'module-worker');assert.strictEqual(result.packet,packet);assert.equal(worker.terminationCount,1);
 const bad=await pending(),r=bad.worker.sent[0];bad.worker.onmessage({data:{type:'result',version:GENERATION_WORKER_VERSION,requestId:r.requestId,packet,transferProof:{bufferCount:1,byteLength:1}}});await assert.rejects(bad.promise,/accounting/);assert.equal(bad.worker.terminationCount,1);
});
test('texture sharing requires identical pixel identity and every texture setting',()=>{
 const bytes=new Uint8Array(4),a=new THREE.DataTexture(bytes,1,1),b=new THREE.DataTexture(bytes,1,1);
 assert(equivalentNativeTextures(a,b));b.channel=1;assert(!equivalentNativeTextures(a,b));b.channel=0;b.colorSpace=THREE.SRGBColorSpace;assert(!equivalentNativeTextures(a,b));b.colorSpace=a.colorSpace;b.repeat.x=2;assert(!equivalentNativeTextures(a,b));b.repeat.x=1;b.newUnknownSetting=true;assert(!equivalentNativeTextures(a,b));delete b.newUnknownSetting;b.image.data=Uint8Array.from(bytes);assert(!equivalentNativeTextures(a,b));
});
test('actual worker-backed adapter preserves native render buffers, exact wind height, native materials and releases once',async()=>{
 const originalWorker=globalThis.Worker,originalTextureDispose=THREE.Texture.prototype.dispose,disposeCounts=new Map();
 globalThis.Worker=NodeModuleWorkerFacade;
 THREE.Texture.prototype.dispose=function(){disposeCounts.set(this.uuid,(disposeCounts.get(this.uuid)||0)+1);return originalTextureDispose.call(this);};
 let plant;
 try{
  const stages=[];plant=await buildNativeMusa(recipe,{verifyResources:verifyResourceBytes,onProgress:p=>stages.push(p.stage)});
  assert.deepEqual(stages,['generated','validated','transferred']);assert.equal(plant.proof.generation.mode,'module-worker');assert.equal(plant.proof.timing.mainThreadGenerationMs,0);
  assert.equal(plant.proof.leafCount,28);assert.equal(plant.proof.triangles,36330);assert.equal(plant.proof.wind.height,packet.nativeWindHeight);assert.equal(plant.proof.sourceGeometryHash,packet.geometryHash);assert.equal(plant.proof.sourceContentHash,packet.contentHash);
  assert.equal(plant.proof.renderResources.textures,6);assert.equal(plant.proof.renderResources.texturePixelBytes,835584);assert.equal(plant.proof.textureSharing.reusedTextureBindings,0);
  const mesh=plant.root.children[0];assert.equal(mesh.material.length,2);assert.notStrictEqual(mesh.material[0].normalMap,mesh.material[0].roughnessMap);
  const attrs={position:'positions',normal:'normals',color:'colors',uv:'uvs',nativeAnchor76:'windAnchors',nativeLeafAxis76:'windLeafAxes',nativeLeafNormal76:'windLeafNormals',nativeWeight76:'windWeights'};
  for(const [name,key] of Object.entries(attrs))assert.deepEqual(mesh.geometry.attributes[name].array,packet.geometry[key]);assert.deepEqual(mesh.geometry.index.array,packet.geometry.indices);
  plant.update(12.5);assert.equal(plant.snapshot().elapsed,12.5);assert.throws(()=>plant.update(-1),/nonnegative/);
  plant.dispose();plant.dispose();assert.equal(plant.root.children.length,0);assert.equal(plant.snapshot().disposed,true);assert.equal(disposeCounts.size,6);assert([...disposeCounts.values()].every(n=>n===1));assert.equal(NodeModuleWorkerFacade.instances.at(-1).terminationCount,1);
 }finally{plant?.dispose();globalThis.Worker=originalWorker;THREE.Texture.prototype.dispose=originalTextureDispose;}
});
test('browser does not silently use synchronous generation without Worker, even on startup failure',async()=>{
 const oldWindow=globalThis.window;globalThis.window={};try{await assert.rejects(requestNativeRenderPacket(recipe,{WorkerClass:undefined}),/requires module Worker/);}finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});
test('real worker resource hash failure propagates without fallback or leaving a live worker',async()=>{
 const bad=structuredClone(recipe);bad.resources[0].sha256='0'.repeat(64);
 await assert.rejects(requestNativeRenderPacket(bad,{WorkerClass:NodeModuleWorkerFacade}),/Native resource hash mismatch/);
 assert.equal(NodeModuleWorkerFacade.instances.at(-1).terminationCount,1);
});
test('resource verification failures and cancellation after mesh creation release all original ownership',async()=>{
 class PacketWorker extends FakeWorker{postMessage(request){queueMicrotask(()=>{const b=uniqueTransferBuffers(packet);this.onmessage?.({data:{type:'result',version:GENERATION_WORKER_VERSION,requestId:request.requestId,packet,transferProof:{bufferCount:b.length,byteLength:b.reduce((n,a)=>n+a.byteLength,0)}}});});}}
 const old=globalThis.Worker,gd=THREE.BufferGeometry.prototype.dispose,md=THREE.Material.prototype.dispose,td=THREE.Texture.prototype.dispose;
 let geometryDisposes=0,materialDisposes=0,textureDisposes=0;
 globalThis.Worker=PacketWorker;
 THREE.BufferGeometry.prototype.dispose=function(){geometryDisposes++;return gd.call(this);};
 THREE.Material.prototype.dispose=function(){materialDisposes++;return md.call(this);};
 THREE.Texture.prototype.dispose=function(){textureDisposes++;return td.call(this);};
 try{
  await assert.rejects(buildNativeMusa(recipe,{verifyResources:async()=>{throw Error('main resource rejected');}}),/main resource rejected/);
  assert.equal(geometryDisposes,0);assert.equal(materialDisposes,0);assert.equal(textureDisposes,0);assert.equal(FakeWorker.instances.at(-1).terminationCount,1);
  const controller=new AbortController();
  await assert.rejects(buildNativeMusa(recipe,{signal:controller.signal,verifyResources:async()=>{setTimeout(()=>controller.abort(),0);}}),{name:'AbortError'});
  assert.equal(geometryDisposes,1);assert.equal(materialDisposes,3);assert.equal(textureDisposes,6);assert.equal(FakeWorker.instances.at(-1).terminationCount,1);
 }finally{globalThis.Worker=old;THREE.BufferGeometry.prototype.dispose=gd;THREE.Material.prototype.dispose=md;THREE.Texture.prototype.dispose=td;}
});
