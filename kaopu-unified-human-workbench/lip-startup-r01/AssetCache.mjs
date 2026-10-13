/** Startup-only transport. Native bytes, facial materials and geometry are not
 * simplified. Only our own named cache is touched; archives/localStorage stay intact. */
export const CACHE_NAME='kaopu-lips-verified-assets-p1';
const LIMIT=128*1024*1024,MAX_ACTIVE=6,queue=[];let active=0,writes=Promise.resolve();
const P=globalThis.__LIP_STARTUP__||(globalThis.__LIP_STARTUP__={started:performance.now(),events:[],networkBytes:0,cacheBytes:0,cacheHits:0,requests:0,warnings:[]});
export const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export function mark(stage){P.stage=stage;P.events.push({stage,ms:performance.now()});P.notify?.();}
const alive=s=>{if(s?.aborted)throw new DOMException('载入已取消','AbortError');};
const slot=()=>new Promise(resolve=>{queue.push(resolve);pump();});
function pump(){while(active<MAX_ACTIVE&&queue.length){active++;queue.shift()();}}
async function store(cache,key,data){
 const work=async()=>{let bytes=0;const rows=[];for(const request of await cache.keys()){const r=await cache.match(request);const size=Number(r?.headers.get('x-kaopu-size')||0);rows.push({request,size});bytes+=size;}
  const previous=await cache.match(key);bytes-=Number(previous?.headers.get('x-kaopu-size')||0);
  for(const row of rows){if(bytes+data.byteLength<=LIMIT)break;if(row.request.url===key)continue;await cache.delete(row.request);bytes-=row.size;}
  if(data.byteLength<=LIMIT)await cache.put(key,new Response(data,{headers:{'content-type':'application/octet-stream','x-kaopu-size':String(data.byteLength)}}));
 };
 if(navigator.locks)await navigator.locks.request(CACHE_NAME+'-write',work);else await work();
}
export async function loadVerified(url,expected,signal){
 alive(signal);if(!/^[0-9a-f]{64}$/.test(expected||''))throw Error('资源缺少固定校验值：'+url);
 const key=new URL('/.kaopu-lips-verified/'+expected,location.origin).href;let cache;
 try{cache=await caches.open(CACHE_NAME);const r=await cache.match(key);if(r){const b=await r.arrayBuffer();alive(signal);if(await sha(b)===expected){P.cacheHits++;P.cacheBytes+=b.byteLength;P.notify?.();return b;}await cache.delete(key);P.warnings.push('损坏的资源缓存已单独重新获取');}}catch(e){if(e.name==='AbortError')throw e;P.warnings.push('缓存不可用，继续网络载入');cache=null;}
 await slot();const t=performance.now();P.requests++;
 try{
  alive(signal);const timed=AbortSignal.timeout(90000),sig=signal?AbortSignal.any([signal,timed]):timed;
  const response=await fetch(url,{signal:sig,cache:'force-cache'});if(!response.ok)throw Error('资源 HTTP '+response.status+': '+url);
  const parts=[];let size=0;const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.byteLength;P.networkBytes+=value.byteLength;P.notify?.();}
  const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}alive(signal);if(await sha(bytes)!==expected)throw Error('资源校验失败：'+url);
  P.events.push({stage:'asset',url,bytes:size,ms:performance.now(),duration:performance.now()-t});
  if(cache){writes=writes.then(()=>store(cache,key,bytes)).catch(e=>P.warnings.push('资源未写入缓存：'+e.name));P.cacheSettled=()=>writes;}
  return bytes.buffer;
 }finally{active--;pump();}
}
export async function inflate(data){return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
export async function loadParts(parts,prefix,expected,signal,resolve=x=>new URL(x,prefix).href){
 const buffers=await Promise.all(parts.map(part=>loadVerified(resolve(part.file||part.url.split('/').at(-1)),part.sha256,signal)));
 alive(signal);const raw=await inflate(new Blob(buffers));alive(signal);if(await sha(raw)!==expected)throw Error('原始权重校验失败');return raw;
}
P.cacheLimitBytes=LIMIT;P.maximumParallelRequests=MAX_ACTIVE;P.clearAssetCache=async()=>{await writes;await caches.delete(CACHE_NAME);return true;};
