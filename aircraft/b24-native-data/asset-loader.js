// Bounded transport of ONE hash-locked aircraft. No model/host/version fallback.
export class AssetLoadError extends Error {
  constructor(code,message){super(message);this.name='AssetLoadError';this.code=code;}
}
export async function sha256(bytes){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
export function bounded(promise,ms,code,signal){
  return new Promise((resolve,reject)=>{
    let timer;const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
    const abort=()=>{clean();reject(signal.reason||new AssetLoadError('CANCELLED','加载已取消'));};
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{clean();reject(new AssetLoadError(code,'连接或读取超时'));},ms);
    Promise.resolve(promise).then(value=>{clean();resolve(value);},error=>{clean();reject(error);});
  });
}
export function createAssetLoader(layout,options={}){
  const opt={fetchFn:globalThis.fetch.bind(globalThis),baseURL:import.meta.url,concurrency:3,
    attempts:3,idleMs:12000,partMs:90000,decodeMs:30000,retryMs:600,cacheMs:1500,
    onProgress:()=>{},...options};
  const controller=new AbortController(),signal=controller.signal;
  const externalAbort=()=>controller.abort(options.signal.reason);
  if(options.signal?.aborted)externalAbort();else options.signal?.addEventListener('abort',externalAbort,{once:true});
  const parts=layout.datasets.flatMap(d=>d.parts),total=parts.reduce((s,p)=>s+p.bytes,0),counts=new Map();
  let verified=0,cached=0,completed=0,retries=0,cache=null,activeCache=true;
  const started=performance.now();
  function emit(stage,extra={}){
    opt.onProgress({stage,verifiedBytes:verified,receivedBytes:verified+[...counts.values()].reduce((s,n)=>s+n,0),
      totalBytes:total,completedParts:completed,totalParts:parts.length,cachedParts:cached,retries,
      elapsedMs:performance.now()-started,...extra});
  }
  function alive(){if(signal.aborted)throw signal.reason||new AssetLoadError('CANCELLED','加载已取消');}
  async function cacheOp(work){
    if(!activeCache)return null;
    try{return await bounded(work(),opt.cacheMs,'CACHE_TIMEOUT',signal);}
    catch(e){alive();activeCache=false;return null;}
  }
  async function valid(data,p){return data.byteLength===p.bytes&&(await sha256(data))===p.sha256;}
  async function readPart(p){
    alive();const url=new URL(p.url,opt.baseURL).href;
    if(cache){
      const response=await cacheOp(()=>cache.match(url));
      if(response){
        const data=await cacheOp(()=>response.arrayBuffer());
        if(data&&await valid(data,p)){cached++;verified+=p.bytes;completed++;emit('download',{file:p.url,cacheHit:true});return new Uint8Array(data);}
        await cacheOp(()=>cache.delete(url));
      }
    }
    let failure;
    for(let attempt=1;attempt<=opt.attempts;attempt++){
      alive();const requestController=new AbortController();let reader;
      const abort=()=>requestController.abort(signal.reason);
      signal.addEventListener('abort',abort,{once:true});
      const deadline=setTimeout(()=>requestController.abort(new AssetLoadError('PART_TIMEOUT','分段传输超时')),opt.partMs);
      try{
        counts.set(p.url,0);emit('download',{file:p.url,attempt});
        // Body reads have their own idle deadline. A response header alone is not progress.
        const response=await bounded(opt.fetchFn(url+(attempt>1?'?retry='+attempt:''),
          {signal:requestController.signal,cache:attempt>1?'reload':'default'}),opt.idleMs,'HEADER_TIMEOUT',requestController.signal);
        if(!response.ok)throw new AssetLoadError('HTTP_'+response.status,'数据请求返回 HTTP '+response.status);
        if(!response.body?.getReader)throw new AssetLoadError('STREAM_UNAVAILABLE','浏览器未提供数据流读取接口');
        reader=response.body.getReader();const data=new Uint8Array(p.bytes);let offset=0;
        for(;;){
          const {done,value}=await bounded(reader.read(),opt.idleMs,'BODY_TIMEOUT',requestController.signal);
          if(done)break;
          if(offset+value.byteLength>p.bytes)throw new AssetLoadError('SIZE_MISMATCH','分段字节数不匹配');
          data.set(value,offset);offset+=value.byteLength;counts.set(p.url,offset);emit('download',{file:p.url,attempt});
        }
        if(!await valid(data,p))throw new AssetLoadError('INTEGRITY_MISMATCH','分段完整性校验失败');
        alive();counts.delete(p.url);verified+=p.bytes;completed++;
        if(cache)await cacheOp(()=>cache.put(url,new Response(data,{headers:{'Content-Type':'application/octet-stream'}})));
        emit('download',{file:p.url,attempt});return data;
      }catch(error){
        failure=error;requestController.abort(error);
        if(reader)reader.cancel(error).catch(()=>{});
        counts.delete(p.url);alive();
        if(attempt<opt.attempts){retries++;emit('retry',{file:p.url,attempt,nextAttempt:attempt+1,code:error.code||'NETWORK_ERROR'});
          await bounded(new Promise(r=>setTimeout(r,opt.retryMs*attempt)),opt.retryMs*attempt+1000,'RETRY_TIMEOUT',signal);}
      }finally{clearTimeout(deadline);signal.removeEventListener('abort',abort);}
    }
    throw new AssetLoadError(failure?.code||'NETWORK_ERROR',`${p.url.split('/').at(-1)}：${failure?.message||'连接失败'}；已尝试 ${opt.attempts} 次`);
  }
  async function load(){
    try{
      alive();
      if(!globalThis.crypto?.subtle)throw new AssetLoadError('SECURE_CONTEXT_REQUIRED','请通过 HTTPS 或本机 HTTP 打开工作台');
      if(typeof DecompressionStream!=='function')throw new AssetLoadError('GZIP_UNAVAILABLE','当前浏览器缺少 gzip 解压接口');
      if(opt.cacheStore!==undefined)cache=opt.cacheStore;
      else if(globalThis.caches)cache=await cacheOp(()=>caches.open('b24-verified-'+layout.payloadSha256.slice(0,16)+'-parts-r1'));
      emit('download');
      let cursor=0;const out=new Map();
      const worker=async()=>{while(cursor<parts.length){alive();const p=parts[cursor++];out.set(p.url,await readPart(p));}};
      await Promise.all(Array.from({length:Math.min(opt.concurrency,parts.length)},worker));
      const result={};
      for(const d of layout.datasets){
        alive();emit('verify-compressed',{dataset:d.id});const zipped=new Uint8Array(d.bytes);let offset=0;
        for(const p of d.parts){zipped.set(out.get(p.url),offset);offset+=p.bytes;}
        if(offset!==d.bytes||await sha256(zipped)!==d.sha256)throw new AssetLoadError('DATASET_MISMATCH','数据拼接校验失败');
        emit('decompress',{dataset:d.id});
        const stream=new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'));
        const decoded=await bounded(new Response(stream).arrayBuffer(),opt.decodeMs,'DECODE_TIMEOUT',signal);
        emit('verify-decoded',{dataset:d.id});
        if(decoded.byteLength!==d.decodedBytes||await sha256(decoded)!==d.decodedSha256)throw new AssetLoadError('PAYLOAD_MISMATCH','原始飞机数据校验失败');
        result[d.id]=decoded;
      }
      alive();emit('complete');return result;
    }catch(error){controller.abort(error);emit('failed',{code:error.code||'LOAD_ERROR',message:error.message});throw error;}
    finally{options.signal?.removeEventListener('abort',externalAbort);}
  }
  return {load,cancel:()=>controller.abort(new AssetLoadError('CANCELLED','加载已取消'))};
}
