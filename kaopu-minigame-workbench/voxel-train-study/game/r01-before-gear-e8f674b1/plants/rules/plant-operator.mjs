/** PLANT_FUNCTION_MUSA_R04: pinned native78 generation in a single-use module Worker.
 * Main thread only verifies the plain packet and constructs the original renderer.
 * This adapter does not simplify geometry, remove leaves or replace native materials.
 */
import * as THREE from '../vendor/three.module.min.js';
import {createFixedMesh76,installWind76} from './native78-runtime.mjs';
import {GENERATION_WORKER_VERSION,ORIGINAL_HEAD,ORIGINAL_CLOSURE,abortError,assertNativeRecipeScope,assertNativeRenderPacket,uniqueTransferBuffers,verifyNativeRenderResources,generateNativeRenderPacket} from './native78-generation-worker.mjs';
export const OPERATOR_VERSION='PLANT_FUNCTION_MUSA_R04';
const now=()=>performance.now();
const checkAbort=signal=>{if(signal?.aborted)throw abortError();};
let requestSerial=0;
/** Exported transport boundary permits a real worker_threads facade in Node tests.
 * buildNativeMusa always uses the platform Worker in browsers, with no fallback.
 */
export async function requestNativeRenderPacket(recipe,{signal,onProgress=()=>{},WorkerClass=globalThis.Worker}={}){
 assertNativeRecipeScope(recipe);checkAbort(signal);
 if(typeof WorkerClass!=='function'){
  if(typeof window!=='undefined'||typeof document!=='undefined'||!globalThis.process?.versions?.node)throw Error('Native Musa requires module Worker support in the browser');
  const packet=await generateNativeRenderPacket(recipe,{signal,onProgress});checkAbort(signal);
  return{packet,execution:'node-main-thread-fallback',transferProof:null};
 }
 return new Promise((resolve,reject)=>{
  let worker,settled=false;
  const requestId='native-musa-r04-'+(++requestSerial);
  const cleanup=()=>{signal?.removeEventListener('abort',onAbort);if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();worker=null;}};
  const fail=error=>{if(settled)return;settled=true;cleanup();reject(error);};
  const finish=result=>{if(settled)return;settled=true;cleanup();resolve(result);};
  const onAbort=()=>fail(abortError());
  try{
   worker=new WorkerClass(new URL('./native78-generation-worker.mjs',import.meta.url),{type:'module',name:'native-musa-r04-'+requestSerial});
   worker.onerror=event=>{event.preventDefault?.();fail(Error('Native generation worker failed: '+(event.message||'script error')));};
   worker.onmessageerror=()=>fail(Error('Native generation worker message could not be decoded'));
   worker.onmessage=event=>{
    if(settled)return;
    try{
     const m=event.data;if(m?.version!==GENERATION_WORKER_VERSION||m.requestId!==requestId)throw Error('Native generation worker response identity mismatch');
     if(m.type==='progress'){if(!['generated','validated'].includes(m.stage)||!Number.isFinite(m.elapsedMs)||m.elapsedMs<0)throw Error('Invalid native worker progress');onProgress({stage:m.stage,elapsedMs:m.elapsedMs});return;}
     if(m.type==='error'){const error=Error(String(m.error?.message||'Native generation worker failed'));error.name=String(m.error?.name||'Error');if(m.error?.stack)error.workerStack=String(m.error.stack);throw error;}
     if(m.type!=='result')throw Error('Unexpected native generation worker response');
     const buffers=uniqueTransferBuffers(m.packet);
     if(m.transferProof?.bufferCount!==buffers.length||m.transferProof?.byteLength!==buffers.reduce((s,b)=>s+b.byteLength,0))throw Error('Native generation transfer accounting mismatch');
     checkAbort(signal);onProgress({stage:'transferred',elapsedMs:m.packet?.timing?.totalWorkerMs??null});finish({packet:m.packet,execution:'module-worker',transferProof:m.transferProof});
    }catch(error){fail(error);}
   };
   signal?.addEventListener('abort',onAbort,{once:true});checkAbort(signal);
   worker.postMessage({type:'generate',version:GENERATION_WORKER_VERSION,requestId,recipe});
  }catch(error){fail(error);}
 });
}
function uniqueBytes(root){
 const buffers=new Set(),geometries=new Set(),materials=new Set(),textures=new Set(),pixelBuffers=new Set();let triangles=0,groups=0;
 root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;geometries.add(g);triangles+=(g.index?.count||g.attributes.position.count)/3;groups+=g.groups.length||1;for(const a of Object.values(g.attributes))buffers.add(a.array.buffer);if(g.index)buffers.add(g.index.array.buffer);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture){textures.add(v);if(v.image?.data?.buffer)pixelBuffers.add(v.image.data.buffer);}}});
 return{geometryBytes:[...buffers].reduce((s,b)=>s+b.byteLength,0),geometryBuffers:buffers.size,geometries:geometries.size,materials:materials.size,textures:textures.size,texturePixelBuffers:pixelBuffers.size,texturePixelBytes:[...pixelBuffers].reduce((s,b)=>s+b.byteLength,0),triangles,colorDrawGroups:groups};
}
function sameTextureValue(a,b){
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return false;
 // Pixel data or a custom class cannot be silently treated as equal by value.
 if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b))return false;
 const ak=Reflect.ownKeys(a),bk=Reflect.ownKeys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&sameTextureValue(a[k],b[k]));
}
/** Conservative full configuration comparison. Only identity keys are excluded;
 * callback, transform, filtering, color-space, mipmap and unknown fields must match.
 */
export function equivalentNativeTextures(a,b){
 if(!a?.isDataTexture||!b?.isDataTexture||a.image?.data!==b.image?.data||a.image?.width!==b.image?.width||a.image?.height!==b.image?.height)return false;
 const exclude=new Set(['id','uuid','source']),ak=Reflect.ownKeys(a).filter(k=>!exclude.has(k)),bk=Reflect.ownKeys(b).filter(k=>!exclude.has(k));
 const sourceKeys=x=>Reflect.ownKeys(x.source).filter(k=>k!=='id'&&k!=='uuid'&&k!=='data');
 const as=sourceKeys(a),bs=sourceKeys(b);
 return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&sameTextureValue(a[k],b[k]))&&as.length===bs.length&&as.every(k=>Object.hasOwn(b.source,k)&&sameTextureValue(a.source[k],b.source[k]))&&sameTextureValue(a.image,b.image);
}
/** The original fixed.dispose owns every original texture object exactly once,
 * including the unused alias. Replacement only avoids duplicate GPU uploads.
 */
export function shareIdenticalNativeTextures(group){
 const unique=[],seenMaterials=new Set();let reused=0;
 group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(seenMaterials.has(m))continue;seenMaterials.add(m);for(const [key,t] of Object.entries(m)){if(!t?.isTexture)continue;const original=unique.find(a=>equivalentNativeTextures(a,t));if(original){if(original!==t){m[key]=original;reused++;}}else unique.push(t);}}});
 return{activeTextures:unique.length,reusedTextureBindings:reused};
}
export async function buildNativeMusa(recipe,{verifyResources,signal,onProgress=()=>{}}={}){
 assertNativeRecipeScope(recipe);checkAbort(signal);
 const p=recipe.profile,started=now(),heapBefore=performance.memory?.usedJSHeapSize??null;
 let fixed=null,packet=null,sourceWindHeight=null;const shadowMaterials=[];
 try{
  const result=await requestNativeRenderPacket(recipe,{signal,onProgress});packet=result.packet;const received=now();checkAbort(signal);
  const validationStarted=now(),equivalence=assertNativeRenderPacket(packet,recipe),mainThreadPacketValidationMs=now()-validationStarted;
  const resourceStarted=now();
  if(verifyResources)await verifyResources(Object.fromEntries(packet.surfaces.resources.map(r=>[r.id,r.bytes])));
  else await verifyNativeRenderResources(packet.surfaces,recipe.resources,{signal});
  const mainThreadResourceValidationMs=now()-resourceStarted;checkAbort(signal);
  const meshStarted=now();let sentinelDelay=null;
  const sentinel=new Promise(resolve=>setTimeout(()=>{sentinelDelay=now()-meshStarted;resolve();},0));
  // This is a renderer-only stub. Original full growth was validated and hashed
  // in the worker. The untouched runtime reduces this one point to the exact
  // scalar produced by its original full-axis algorithm; no botanical claim.
  sourceWindHeight=packet.nativeWindHeight;
  fixed=createFixedMesh76({specimen:{geometry:packet.geometry,surfaces:packet.surfaces,growth:{profile:packet.profile,axes:[{path:[{position:[0,sourceWindHeight,0]}]}]}}});
  if(fixed.wind.height.value!==sourceWindHeight)throw Error('Native wind height changed across worker boundary');
  const textureSharing=shareIdenticalNativeTextures(fixed.group);
  fixed.group.name='原生芭蕉 · 建立株761014';fixed.wind.strength.value=recipe.motion.strength;
  fixed.group.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});installWind76(depth,fixed.wind);o.customDepthMaterial=depth;shadowMaterials.push(depth);});
  fixed.group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(fixed.group),renderResources=uniqueBytes(fixed.group),built=now();
  if(renderResources.triangles!==36330)throw Error('Native renderer dropped or duplicated saved triangles');
  const workerTiming={...packet.timing},generationMode=result.execution;
  const proofData={operator:OPERATOR_VERSION,sourceHead:ORIGINAL_HEAD,sourceClosureSha256:ORIGINAL_CLOSURE,threeGeneratorRevision:THREE.REVISION,hostRendererRevision:'170; actual WebGL compatibility must be tested',species:p.species,developmentStage:p.stage,seed:p.seed,profile:{...p},units:'metre',rootScale:[1,1,1],sourceGeometryHash:packet.geometryHash,sourceContentHash:packet.contentHash,sourceEquivalent:true,equivalence,productionGate:packet.productionGate,visualAcceptance:false,hardwareMeasured:false,leafCount:packet.counts.leaf,shootCount:packet.counts.shoot,axisCount:packet.counts.axis,branchCount:packet.counts.branch,aerialRootCount:packet.counts.aerialRoot,groundedPropCount:packet.counts.groundedProp,bounds:{min:box.min.toArray(),max:box.max.toArray()},triangles:renderResources.triangles,sourceGeometryBytes:packet.sourceGeometryBytes,renderResources,textureSharing,resourceIds:packet.surfaces.resources.map(r=>r.id),materialsIncludeImages:true,externalModels:false,geometrySampling:'full native78; no simplification, LOD or leaf removal',generation:{mode:generationMode,workerVersion:GENERATION_WORKER_VERSION,singleUseWorker:generationMode==='module-worker',sourceAndInputVerifiedBeforeWorker:true,fullOriginalValidationBeforeTransfer:true,plainPacket:true,zeroCopyGeometryAndPixels:generationMode==='module-worker',transfer:result.transferProof},wind:{model:'native76',timeSource:'host.elapsed',strength:recipe.motion.strength,height:sourceWindHeight,leafMaximumAngleRadians:recipe.motion.strength*.06,shadowUsesSameWind:true}};
  // Do not retain unused channels/provenance or worker packet through the update
  // closure. Render BufferAttributes retain the original transferred views.
  packet=null;result.packet=null;
  await sentinel;checkAbort(signal);
  const proof=Object.freeze({...proofData,timing:{generationMode,worker:workerTiming,mainThreadGenerationMs:generationMode==='module-worker'?0:workerTiming.generationMs,contentValidationMs:workerTiming.contentValidationMs,workerRoundTripMs:generationMode==='module-worker'?received-started:null,mainThreadPacketValidationMs,mainThreadResourceValidationMs,mainThreadMeshConstructionMs:built-meshStarted,totalBuildMs:now()-started,eventLoopSentinelDelayMs:sentinelDelay,heapBefore,heapAfter:performance.memory?.usedJSHeapSize??null,peakHeapBytes:null}});
  const root=fixed.group;let disposed=false,elapsed=0;
  return{root,proof,update(timeSeconds){if(disposed)return;if(!Number.isFinite(timeSeconds)||timeSeconds<0)throw Error('Finite nonnegative host seconds required');elapsed=timeSeconds;fixed.wind.time.value=timeSeconds;},snapshot(){return{...proof,elapsed,disposed};},dispose(){if(disposed)return;disposed=true;root.removeFromParent();fixed.dispose();fixed=null;for(const m of shadowMaterials)m.dispose();shadowMaterials.length=0;}};
 }catch(error){packet=null;fixed?.group.removeFromParent();fixed?.dispose();fixed=null;for(const m of shadowMaterials)m.dispose();shadowMaterials.length=0;throw error;}
}
