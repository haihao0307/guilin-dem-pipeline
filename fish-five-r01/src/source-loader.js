import {readCarrierBytes,loadPhase} from './asset-reader-r06.js';
import {decodeSourceR07,restoreSourceTexturesR07} from './source-codec-r07.js';
function sourceWorkerMain(decode){
  self.onmessage=async({data:{token,id,bytes,format}})=>{try{
    const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const result=decode(raw,format);
    if(result.score.id!==id)throw Error('Source identity disagrees with carrier');
    const transfer=new Set();
    for(const p of result.score.primitives)for(const v of Object.values(p))if(ArrayBuffer.isView(v))transfer.add(v.buffer);
    for(const image of result.images || [])transfer.add(image.encodedBytes.buffer);
    self.postMessage({token,id,...result},[...transfer]);
  }catch(error){self.postMessage({token,id,error:String(error.message||error)});}};
}
export function createSourceLoader(){
  const url=URL.createObjectURL(new Blob(['('+sourceWorkerMain.toString()+')('+decodeSourceR07.toString()+')'],{type:'text/javascript'}));
  const pending=new Map(),cache=new Map();let sequence=0,disposed=false,cancelled=0,decoded=0;
  const abortError=()=>new DOMException('Source loading cancelled','AbortError');
  const isCurrent=job=>!disposed&&!job.controller.signal.aborted&&pending.get(job.id)===job;
  function finish(job){
    job.worker?.terminate();job.worker=null;
    if(pending.get(job.id)===job)pending.delete(job.id);
    if(job.signal&&job.abortListener)job.signal.removeEventListener('abort',job.abortListener);
  }
  function cancel(job){if(pending.get(job.id)!==job)return;job.controller.abort();finish(job);cancelled++;job.reject(abortError());}
  function clear(){for(const job of [...pending.values()])cancel(job);cache.clear();}
  function cancelPendingExcept(id){for(const job of [...pending.values()])if(job.id!==id)cancel(job);}
  function stats(){
    const buffers=new Set(),formats={};let numericBytes=0,encodedImageBytes=0;
    for(const[id,entry]of cache){formats[id]=entry.format;for(const p of entry.score.primitives)for(const v of Object.values(p))if(ArrayBuffer.isView(v)){buffers.add(v.buffer);numericBytes+=v.byteLength;}for(const t of entry.score.textures || [])if(t.encodedBytes){buffers.add(t.encodedBytes.buffer);encodedImageBytes+=t.encodedBytes.byteLength;}}
    return{cachedIds:[...cache.keys()],pendingIds:[...pending.keys()],pendingTokens:[...pending.values()].map(j=>j.token),workers:[...pending.values()].filter(j=>j.worker).length,typedBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),numericBytes,encodedImageBytes,formats,decoded,cancelled,disposed};
  }
  return{
    load(id,{signal}={}){
      if(disposed)return Promise.reject(Error('Source loader disposed'));
      if(signal?.aborted)return Promise.reject(abortError());
      if(cache.has(id))return Promise.resolve(cache.get(id).score);
      if(pending.has(id))return pending.get(id).promise;
      const el=document.getElementById('score-'+id);if(!el)return Promise.reject(Error('缺少原表面数据 '+id));
      const job={id,token:++sequence,controller:new AbortController(),worker:null,signal};
      job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});pending.set(id,job);
      if(signal){job.abortListener=()=>cancel(job);signal.addEventListener('abort',job.abortListener,{once:true});}
      readCarrierBytes(el,id,{signal:job.controller.signal}).then(bytes=>{
        if(!isCurrent(job))return;loadPhase(id,'decode');const worker=job.worker=new Worker(url);
        worker.onmessage=({data})=>{
          if(!isCurrent(job)||data.token!==job.token||data.id!==id)return;finish(job);
          if(data.error)job.reject(Error(data.error));else{try{restoreSourceTexturesR07(data.score,data.images);cache.set(id,{score:data.score,format:data.format});decoded++;job.resolve(data.score);}catch(error){job.reject(error);}}
        };
        worker.onerror=event=>{if(!isCurrent(job))return;finish(job);job.reject(Error(event.message||'Source decoder failed'));};
        worker.postMessage({token:job.token,id,bytes,format:el.dataset.format||''},[bytes.buffer]);
      }).catch(error=>{if(pending.get(id)!==job)return;finish(job);job.reject(error);});
      return job.promise;
    },
    releaseExcept(id){for(const job of [...pending.values()])if(job.id!==id)cancel(job);for(const key of [...cache.keys()])if(key!==id)cache.delete(key);},
    clear,cancelPendingExcept,stats,stat:stats,
    dispose(){if(disposed)return;clear();disposed=true;URL.revokeObjectURL(url);}
  };
}
