import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker as NodeWorker} from 'node:worker_threads';
import * as NativeTHREE from './vendor/three.module.min.js';
import {createNativePlantSegment,PLANT_PLACEMENTS} from './segment.mjs';
const workerURL=new URL('./rules/native78-generation-worker.mjs',import.meta.url);
class NodeModuleWorkerFacade{
 static instances=[];
 constructor(url,options){assert.equal(url.href,workerURL.href);assert.equal(options.type,'module');this.terminationCount=0;NodeModuleWorkerFacade.instances.push(this);this.worker=new NodeWorker(`const {parentPort}=require('node:worker_threads');(async()=>{const {installNativeGenerationWorker}=await import(${JSON.stringify(workerURL.href)});const scope={onmessage:null,close(){parentPort.close()},postMessage(message,transfer){parentPort.postMessage(message,transfer)}};installNativeGenerationWorker(scope);parentPort.on('message',data=>scope.onmessage?.({data}));})();`,{eval:true});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.({message:error.message,preventDefault(){}}));}
 postMessage(message){this.worker.postMessage(message);}
 terminate(){this.terminationCount++;this.worker.terminate();}
}
test('real SQLite -> pinned dependencies -> one worker -> two original shared Musa instances -> single resource disposal',async()=>{
 const old=globalThis.Worker,gd=NativeTHREE.BufferGeometry.prototype.dispose,md=NativeTHREE.Material.prototype.dispose,td=NativeTHREE.Texture.prototype.dispose,disposals=new Map();let sourceGenerations=0,segment;
 const record=(kind,object)=>{const key=kind+'/'+object.uuid;disposals.set(key,(disposals.get(key)||0)+1);};
 globalThis.Worker=NodeModuleWorkerFacade;NativeTHREE.BufferGeometry.prototype.dispose=function(){record('geometry',this);return gd.call(this)};NativeTHREE.Material.prototype.dispose=function(){record('material',this);return md.call(this)};NativeTHREE.Texture.prototype.dispose=function(){record('texture',this);return td.call(this)};
 try{
  segment=createNativePlantSegment({readBytes:async url=>new Uint8Array(await readFile(url)),loadOperator:async()=>{const operator=await import('./rules/plant-operator.mjs');return{buildNativeMusa(...args){sourceGenerations++;return operator.buildNativeMusa(...args)}}}});
  const result=await segment.initialize();assert.equal(sourceGenerations,1);assert.equal(NodeModuleWorkerFacade.instances.length,1);assert.equal(result.count,2);assert.equal(result.generationCount,1);assert.equal(result.loadProof.instanceCount,2);assert.equal(result.loadProof.sharedWindUniforms,true);assert.equal(result.plants[0].chainage,PLANT_PLACEMENTS[0].chainage);
  const [first,second]=segment.root.children,[a,b]=[first.children[0],second.children[0]];assert.strictEqual(a.geometry,b.geometry);assert(a.material.every((m,i)=>m===b.material[i]));assert.strictEqual(a.customDepthMaterial,b.customDepthMaterial);assert.deepEqual(first.scale.toArray(),[1,1,1]);assert.equal(first.rotation.y,PLANT_PLACEMENTS[0].yaw);assert.equal(first.position.z,PLANT_PLACEMENTS[0].z);assert.deepEqual(second.scale.toArray(),[1,1,1]);
  segment.update({distance:405.24741793906245,elapsed:123.25});assert(segment.snapshot().plants.every(p=>p.proof.elapsed===123.25));assert.equal(segment.snapshot().active,1);assert.equal(segment.snapshot().plants[1].visible,true);assert.equal(segment.snapshot().plants[0].proof.triangles,36330);assert.equal(segment.snapshot().plants[0].proof.renderResources.texturePixelBytes,835584);
  await assert.rejects(segment.replaceFromBytes(new Uint8Array([0])));assert.equal(sourceGenerations,1);assert.equal(segment.root.children[0],first);assert.equal(disposals.size,0);
  segment.dispose();segment.dispose();assert.equal(segment.root.children.length,0);assert.equal(disposals.size,10);assert([...disposals.values()].every(n=>n===1));assert.equal(NodeModuleWorkerFacade.instances[0].terminationCount,1);
 }finally{segment?.dispose();globalThis.Worker=old;NativeTHREE.BufferGeometry.prototype.dispose=gd;NativeTHREE.Material.prototype.dispose=md;NativeTHREE.Texture.prototype.dispose=td;}
});
