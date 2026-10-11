/** PLANT_FUNCTION_R04 adapter boundary, not a new native plant format.
 * One worker owns one original specimen. Only a validated plain render packet
 * crosses the boundary; each original ArrayBuffer is transferred exactly once.
 * Never reuse this worker: the mother's resource cache is detached on transfer.
 */
import {assertKnownNativeHashes} from './native78-equivalence.mjs';
export const GENERATION_WORKER_VERSION='native78-generation-worker/R04';
export const ORIGINAL_HEAD='d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122';
export const ORIGINAL_CLOSURE='086fc0161dda317ae706ab2752c7735253caccaf3dcb23c2076567606efd67f0';
const PROFILE=Object.freeze({condition76:'normal',habitatForm:'sheltered',leafNaturalismVersion:73,material:'wild-reference',productionSystemVersion:78,profileVersion:8,reproductive76:false,seed:761014,species:'ficus-microcarpa',stage:'juvenile',treeLeafVersion:75,tropicalLibraryVersion:76});
const now=()=>performance.now();
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function canonical(v){if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map(canonical);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));}
export function abortError(){const error=Error('Native Ficus generation aborted');error.name='AbortError';return error;}
const checkAbort=signal=>{if(signal?.aborted)throw abortError();};
export function assertNativeRecipeScope(recipe){
 if(!equal(recipe?.profile,PROFILE))throw Error('Operator release supports only the audited juvenile specimen');
 if(!equal(recipe?.source,{head:ORIGINAL_HEAD,closureSha256:ORIGINAL_CLOSURE}))throw Error('Native source closure mismatch');
 if(!Number.isFinite(recipe?.motion?.strength)||recipe.motion.strength<0||recipe.motion.strength>1)throw Error('Invalid native wind strength');
 if(!Array.isArray(recipe.resources)||recipe.resources.length!==8)throw Error('Native resource pins required');
 const ids=new Set();
 for(const pin of recipe.resources){if(typeof pin?.id!=='string'||ids.has(pin.id)||!Number.isSafeInteger(pin.bytes)||pin.bytes<1||!Number.isInteger(pin.width)||!Number.isInteger(pin.height)||pin.width<1||pin.width>1024||pin.height<1||pin.height>1024||pin.bytes!==pin.width*pin.height*4||!['srgb','linear'].includes(pin.colorSpace)||!/^([0-9a-f]{64})$/.test(pin.sha256))throw Error('Invalid native resource pin');ids.add(pin.id);}
}
/** Exact original views are retained. No .slice(), packing or geometry conversion. */
export function uniqueTransferBuffers(value){
 const buffers=new Set(),visited=new Set();
 const visit=x=>{
  if(x===null||x===undefined||['string','boolean','number'].includes(typeof x))return;
  if(typeof x!=='object')throw Error('Render packet must contain only plain data');
  if(ArrayBuffer.isView(x)){if(!(x.buffer instanceof ArrayBuffer)||x instanceof DataView||!x.byteLength)throw Error('Render packet requires attached unshared typed arrays');buffers.add(x.buffer);return;}
  if(x instanceof ArrayBuffer){if(!x.byteLength)throw Error('Render packet contains a detached buffer');buffers.add(x);return;}
  if(visited.has(x))return;visited.add(x);
  if(!Array.isArray(x)&&Object.getPrototypeOf(x)!==Object.prototype&&Object.getPrototypeOf(x)!==null)throw Error('Render packet must contain only plain objects');
  for(const key of Reflect.ownKeys(x)){if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key))throw Error('Invalid render packet property');const d=Object.getOwnPropertyDescriptor(x,key);if(!('value'in d))throw Error('Render packet cannot contain accessors');visit(d.value);}
 };
 visit(value);return [...buffers];
}
function resourceMap(surfaces,pins){
 if(!surfaces||surfaces.surfaceVersion!==76||surfaces.species!=='ficus-microcarpa'||surfaces.review!=='unreviewed'||!Array.isArray(surfaces.resources)||surfaces.resources.length!==pins.length||!Array.isArray(surfaces.bindings)||surfaces.bindings.map(b=>b.role).join(',')!=='wood,support,foliage')throw Error('Invalid native render surfaces');
 const map=Object.create(null),seen=new Set();
 for(const r of surfaces.resources){
  const p=pins.find(p=>p.id===r?.id);
  if(!p||seen.has(r.id)||!(r.bytes instanceof Uint8Array)||!(r.bytes.buffer instanceof ArrayBuffer)||r.bytes.byteLength!==p.bytes||r.width!==p.width||r.height!==p.height||r.colorSpace!==p.colorSpace||!equal(r.source,p.source))throw Error('Native resource shape or provenance mismatch');
  seen.add(r.id);map[r.id]=r.bytes;
 }
 for(const b of surfaces.bindings){for(const id of [b.albedo,b.normal,b.roughnessMap])if(!seen.has(id))throw Error('Missing native PBR resource');if(!Number.isFinite(b.roughness)||!(Number.isFinite(b.color)||typeof b.color==='string'&&/^#[0-9a-f]{6}$/i.test(b.color)))throw Error('Invalid native material binding');}
 return map;
}
/** Pins have already been authenticated to the local release by the .KaoPu codec.
 * Worker additionally hashes every original RGBA resource before any transfer.
 */
export async function verifyNativeRenderResources(surfaces,pins,{signal}={}){
 if(!globalThis.crypto?.subtle)throw Error('Native worker resource validation requires WebCrypto');
 const map=resourceMap(surfaces,pins);
 for(const pin of pins){checkAbort(signal);const digest=await crypto.subtle.digest('SHA-256',map[pin.id]),hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');if(hex!==pin.sha256)throw Error('Native resource hash mismatch: '+pin.id);}
 checkAbort(signal);return map;
}
/** Full original growth/geometry/material validation and complete paired native
 * hashes run here, BEFORE omitting method-bearing growth from the render packet.
 */
export async function generateNativeRenderPacket(recipe,{signal,onProgress=()=>{}}={}){
 assertNativeRecipeScope(recipe);checkAbort(signal);
 const heapBefore=performance.memory?.usedJSHeapSize??null;
 const started=now(),{profile78,generateTropical78,fixedAsset76}=await import('./native78-ficus-author.mjs');checkAbort(signal);
 const canonicalProfile=profile78(recipe.profile.species,recipe.profile);
 if(!equal(canonicalProfile,recipe.profile))throw Error('Native profile changed during construction');
 const generationStarted=now(),specimen=generateTropical78(canonicalProfile,{compactBlades76:true}),generated=now();onProgress({stage:'generated',elapsedMs:generated-started});checkAbort(signal);
 const asset=await fixedAsset76(specimen),equivalence=assertKnownNativeHashes(asset),hashed=now();checkAbort(signal);
 await verifyNativeRenderResources(specimen.surfaces,recipe.resources,{signal});onProgress({stage:'validated',elapsedMs:now()-started});
 // Keep precisely the original runtime reduction, including its initial 0 and clamp.
 const nativeWindHeight=Math.max(.1,specimen.growth.axes.reduce((h,a)=>Math.max(h,...a.path.map(p=>p.position[1])),0));
 const sourceGeometryBytes=Object.values(specimen.geometry).reduce((n,x)=>n+(ArrayBuffer.isView(x)?x.byteLength:0),0);
 const packet={version:GENERATION_WORKER_VERSION,sourceHead:ORIGINAL_HEAD,sourceClosureSha256:ORIGINAL_CLOSURE,profile:{...recipe.profile},geometryHash:asset.geometryHash,contentHash:asset.contentHash,equivalence,geometry:specimen.geometry,surfaces:specimen.surfaces,nativeWindHeight,productionGate:specimen.production.status,acceptance:{...specimen.acceptance},counts:{leaf:specimen.growth.blades.length,axis:specimen.growth.axes.length,branch:specimen.growth.axes.filter(a=>a.kind==='branch').length,aerialRoot:specimen.growth.axes.filter(a=>a.role==='aerial-root').length,groundedProp:specimen.growth.axes.filter(a=>a.role==='grounded-prop').length},sourceGeometryBytes,timing:{moduleLoadMs:generationStarted-started,generationMs:generated-generationStarted,contentValidationMs:hashed-generated,resourceValidationMs:now()-hashed,totalWorkerMs:now()-started,heapBefore,heapAfter:performance.memory?.usedJSHeapSize??null}};
 assertNativeRenderPacket(packet,recipe);checkAbort(signal);return packet;
}
/** Cheap receiving-side shape checks, in addition to the unchanged strict paired
 * hashes and resource rehash. This is not a substitute for worker growth validation.
 */
export function assertNativeRenderPacket(packet,recipe){
 assertNativeRecipeScope(recipe);
 if(packet?.version!==GENERATION_WORKER_VERSION||packet.sourceHead!==ORIGINAL_HEAD||packet.sourceClosureSha256!==ORIGINAL_CLOSURE||!equal(packet.profile,recipe.profile))throw Error('Native render packet source or profile mismatch');
 const equivalence=assertKnownNativeHashes(packet);if(!equal(packet.equivalence,equivalence))throw Error('Native render packet equivalence mismatch');
 if(packet.productionGate!=='passed'||!equal(packet.acceptance,{structure:'passed',surface:'pending-review',visual:'pending-user-review',hardware:'unmeasured'}))throw Error('Native render packet has no completed production validation');
 if(packet.counts?.leaf!==11284||packet.counts?.axis!==15453||packet.counts?.branch!==4164||![packet.counts.aerialRoot,packet.counts.groundedProp].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isFinite(packet.nativeWindHeight)||packet.nativeWindHeight<.1)throw Error('Native render packet organ or wind metadata mismatch');
 const g=packet.geometry,n=g?.positions?.length/3;
 if(!g||g.backendId!=='tropical-library-76/ficus-microcarpa/production-system-78'||!Number.isSafeInteger(n)||n<3||g.triangleCount!==307346||g.geometryCount!==26737||!(g.indices instanceof Uint32Array)||g.indices.length!==307346*3)throw Error('Invalid complete native render geometry');
 for(const [key,size] of [['positions',3],['normals',3],['colors',3],['uvs',2],['windAnchors',3],['windLeafAxes',3],['windLeafNormals',3],['windWeights',1]])if(!(g[key] instanceof Float32Array)||g[key].length!==n*size)throw Error('Invalid native render attribute: '+key);
 if(!(g.barkCoordinates69 instanceof Float32Array)||!g.barkCoordinates69.length||g.barkCoordinates69.length%4||g.barkCoordinates69.length>n*4||!(g.bladeRanges77 instanceof Uint32Array)||g.bladeRanges77.length!==11284*4)throw Error('Invalid native render bark or blade provenance');
 const channels=g.windChannelChunks77??[g.windChannels];
 if(g.windChannelChunks77&&g.windChannels!==undefined||!Array.isArray(channels)||!channels.length||channels.some(a=>!(a instanceof Float32Array)||!a.length||a.length%4)||channels.reduce((s,a)=>s+a.length,0)!==n*4)throw Error('Incomplete native wind channels');
 let indexCount=0;if(!Array.isArray(g.materialGroups)||!g.materialGroups.length)throw Error('Missing native render groups');
 for(const group of g.materialGroups){if(group.firstIndex!==indexCount||!Number.isSafeInteger(group.indexCount)||group.indexCount<0||group.indexCount%3||!Number.isSafeInteger(group.materialIndex)||group.materialIndex<0||group.materialIndex>=packet.surfaces?.bindings?.length)throw Error('Invalid native render group');indexCount+=group.indexCount;}
 if(indexCount!==g.indices.length)throw Error('Native render groups dropped triangles');
 const sourceGeometryBytes=Object.values(g).reduce((s,a)=>s+(ArrayBuffer.isView(a)?a.byteLength:0),0);if(packet.sourceGeometryBytes!==sourceGeometryBytes)throw Error('Native source byte accounting mismatch');
 resourceMap(packet.surfaces,recipe.resources);uniqueTransferBuffers(packet);
 if(!packet.timing||!['moduleLoadMs','generationMs','contentValidationMs','resourceValidationMs','totalWorkerMs'].every(k=>Number.isFinite(packet.timing[k])&&packet.timing[k]>=0))throw Error('Invalid native worker timings');
 return equivalence;
}
/** Single-use module-worker endpoint. Also exported for a real node:worker_threads
 * transport test; no production Node worker shim and no browser-main fallback.
 */
export function installNativeGenerationWorker(scope){
 let started=false;
 scope.onmessage=async event=>{
  if(started)return;started=true;
  const message=event.data;
  try{
   if(message?.type!=='generate'||message.version!==GENERATION_WORKER_VERSION||typeof message.requestId!=='string')throw Error('Invalid native worker request');
   const packet=await generateNativeRenderPacket(message.recipe,{onProgress:progress=>scope.postMessage({type:'progress',version:GENERATION_WORKER_VERSION,requestId:message.requestId,...progress})}),transfer=uniqueTransferBuffers(packet);
   const transferProof={bufferCount:transfer.length,byteLength:transfer.reduce((s,b)=>s+b.byteLength,0)};
   scope.postMessage({type:'result',version:GENERATION_WORKER_VERSION,requestId:message.requestId,packet,transferProof},transfer);
  }catch(error){scope.postMessage({type:'error',version:GENERATION_WORKER_VERSION,requestId:message?.requestId,error:{name:String(error?.name||'Error'),message:String(error?.message||error),stack:String(error?.stack||'')} });}
  finally{scope.onmessage=null;scope.close();}
 };
}
if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope)installNativeGenerationWorker(globalThis);
