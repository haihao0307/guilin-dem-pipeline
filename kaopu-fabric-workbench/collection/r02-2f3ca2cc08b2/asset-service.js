/* Reuse the original authenticated loader; workers receive decoded bytes only, never keys. */
import {unlock as decodeNativePack} from './runtime-loader.js';
import {wasCached,evictCiphertext} from './cipher-cache.js';
const pending=new Map(),memory=new Map(),stats=[],workers=new Set();let residentBytes=0;
const BUDGET=96*1024*1024;
function restoreBytes(pack,signal){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./decode-worker.js',import.meta.url));workers.add(worker);
 const finish=()=>{signal?.removeEventListener('abort',cancel);worker.terminate();workers.delete(worker);};
 const cancel=()=>{finish();reject(new DOMException('Cancelled','AbortError'));};
 worker.onmessage=({data:m})=>{finish();if(m.ok){m.pack.files=new Map(m.pack.files.map(f=>[f.path,f]));resolve(m.pack);}else reject(Error(m.error));};
 worker.onerror=e=>{finish();reject(Error(e.message));};signal?.addEventListener('abort',cancel,{once:true});
 const files=Array.from(pack.files.values()),buffers=[...new Set(files.map(f=>f.data.buffer))];worker.postMessage({...pack,files},buffers);
});}
export async function loadPack(url,record,key,signal,onProgress){
 signal?.throwIfAborted();const cacheKey=record.sha256;
 if(memory.has(cacheKey)){const p=memory.get(cacheKey);memory.delete(cacheKey);memory.set(cacheKey,p);stats.push({id:record.id,memoryHit:true,networkBytes:0,totalMs:0});return p;}
 if(pending.has(cacheKey)){try{return await pending.get(cacheKey);}catch(e){if(e.name!=='AbortError'||signal?.aborted)throw e;}}
 const operation=(async()=>{const start=performance.now();let p;
  try{p=await decodeNativePack(url,record,key,signal,onProgress);}catch(e){if(!wasCached(record)||e.name==='AbortError')throw e;await evictCiphertext(record);p=await decodeNativePack(url,record,key,signal,onProgress);}
  signal?.throwIfAborted();const decode=performance.now();p=await restoreBytes(p,signal);signal?.throwIfAborted();
  stats.push({id:record.id,cacheHit:wasCached(record),networkBytes:wasCached(record)?0:record.bytes,authenticatedLoadMs:decode-start,restoreMs:performance.now()-decode,totalMs:performance.now()-start});if(stats.length>80)stats.shift();
  memory.set(cacheKey,p);residentBytes+=p.byteLength;while(residentBytes>BUDGET&&memory.size>1){const k=memory.keys().next().value;residentBytes-=memory.get(k).byteLength;memory.delete(k);}return p;
 })();pending.set(cacheKey,operation);try{return await operation;}finally{if(pending.get(cacheKey)===operation)pending.delete(cacheKey);}
}
export function assetMetrics(){return {residentBytes,budgetBytes:BUDGET,decoderWorkers:workers.size,pending:pending.size,loads:stats.slice()};}
export function installAssets(man,key,getSignal,onProgress){globalThis.__FABRIC_ASSETS__=async url=>{
 const prefix='https://fabric.invalid/raywave/';if(!url.startsWith(prefix))throw Error('资源来源不正确');const path=url.slice(prefix.length),id=man.remoteFiles?.[path];if(!id)throw Error('未登记资源 '+path);
 const record=man.bundles[id],p=await loadPack(new URL(record.url,location.href),record,key,getSignal(),onProgress);const file=p.files.get(path);if(!file)throw Error('运行包缺少 '+path);return new Response(file.data,{headers:{'Content-Type':path.endsWith('.json')?'application/json':'application/octet-stream'}});
};}
export function disposeAssets(){for(const w of workers)w.terminate();workers.clear();memory.clear();residentBytes=0;}
