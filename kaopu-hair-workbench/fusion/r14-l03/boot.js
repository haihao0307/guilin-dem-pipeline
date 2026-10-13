/* R14.2-L03 native-page loader. Lossless payloads, integrity and bounded retries.
 * No service-worker scope, telemetry, external model host, or quality fallback. */
(()=>{
 const manifest=JSON.parse(document.getElementById('assetManifest').textContent),$=id=>document.getElementById(id),cacheName='kaopu-hair-r14-l02-verified-v1';
 const stats=window.__HAIR_LOAD={version:manifest.version,source:manifest.source,shellMs:performance.now(),networkBytes:0,cacheBytes:0,cacheHits:0,retries:0,cacheWarnings:[],phase:'assets',firstPaintMs:null,fullyRenderedMs:null};
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.name==='first-contentful-paint')stats.firstPaintMs=e.startTime;}).observe({type:'paint',buffered:true});}catch{}
 let running=null,appStarted=false,generation=0,completed=0,cachePromise;
 const inFlight=new Map(),blobs=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
 const hex=a=>Array.from(new Uint8Array(a),v=>v.toString(16).padStart(2,'0')).join(''),sha=async a=>hex(await crypto.subtle.digest('SHA-256',a));
 const abortError=()=>new DOMException('已取消','AbortError');
 async function checked(bytes,expected){if(bytes.byteLength!==expected.bytes||await sha(bytes)!==expected.sha256)throw Error('资源完整性校验失败：'+(expected.path||expected.name||'数据'));return bytes;}
 async function cache(){if(!cachePromise)cachePromise=(async()=>{try{return await Promise.race([caches.open(cacheName),wait(1500).then(()=>null)]);}catch(e){stats.cacheWarnings.push(String(e));return null;}})();return cachePromise;}
 const semaphore={active:0,queue:[],async acquire(){if(this.active>=4)await new Promise(r=>this.queue.push(r));else this.active++;},release(){if(this.queue.length)this.queue.shift()();else this.active--;}};
 function progress(token){if(token!==generation||appStarted)return;const partial=Array.from(inFlight.values()).reduce((a,b)=>a+b,0);$('progressText').textContent='原质量资源 · '+((completed+partial)/1e6).toFixed(2)+' / '+(manifest.startupBytes/1e6).toFixed(2)+' MB'+(stats.cacheHits?' · 复用缓存':'');$('progress').value=Math.min(.98,(completed+partial)/manifest.startupBytes);}
 async function network(part,signal,token){
  await semaphore.acquire();const url=new URL(part.path,document.baseURI).href;
  try{
   if(signal?.aborted)throw abortError();
   for(let attempt=0;attempt<3;attempt++){
    const control=new AbortController();let idle;const cancel=()=>control.abort(signal.reason||abortError()),kick=()=>{clearTimeout(idle);idle=setTimeout(()=>control.abort(Error('分块读取暂停，请重试')),45000);};signal?.addEventListener('abort',cancel,{once:true});
    const deadline=setTimeout(()=>control.abort(Error('分块读取超时')),120000);kick();
    try{
     const response=await fetch(url,{signal:control.signal,cache:attempt?'reload':'default'});if(!response.ok)throw Error('HTTP '+response.status+'：'+part.path);if(!response.body)throw Error('资源响应为空');
     const result=new Uint8Array(part.bytes),reader=response.body.getReader();let n=0;
     try{for(;;){const item=await reader.read();if(control.signal.aborted)throw control.signal.reason;if(item.done)break;n+=item.value.length;stats.networkBytes+=item.value.length;if(n>part.bytes)throw Error('资源体积超过固定清单');result.set(item.value,n-item.value.length);inFlight.set(url,n);kick();progress(token);}}
     catch(e){await reader.cancel(e).catch(()=>{});throw e;}finally{reader.releaseLock();}
     await checked(result,part);const c=await cache();if(c)try{await c.put(url,new Response(result,{headers:{'Content-Type':'application/octet-stream'}}));}catch(e){stats.cacheWarnings.push(String(e));}
     return result;
    }catch(e){if(signal?.aborted)throw abortError();if(attempt===2)throw e;stats.retries++;await wait(250*(attempt+1));}
    finally{clearTimeout(idle);clearTimeout(deadline);signal?.removeEventListener('abort',cancel);inFlight.delete(url);}
   }
  }finally{semaphore.release();}
 }
 async function partBytes(part,signal,token){
  const url=new URL(part.path,document.baseURI).href,c=await cache();let bytes;
  if(c){try{const hit=await c.match(url);if(hit){bytes=new Uint8Array(await hit.arrayBuffer());await checked(bytes,part);stats.cacheBytes+=bytes.length;stats.cacheHits++;}}catch(e){stats.cacheWarnings.push('缓存重新校验：'+part.path);await c.delete(url).catch(()=>{});bytes=null;}}
  if(!bytes)bytes=await network(part,signal,token);if(token===generation){completed+=bytes.length;progress(token);}return bytes;
 }
 async function asset(spec,signal,token){
  const parts=await Promise.all(spec.chunks.map(p=>partBytes(p,signal,token))),packed=new Uint8Array(spec.packedBytes);let o=0;for(const b of parts){packed.set(b,o);o+=b.length;}
  let result=packed;
  if(spec.gzip){
   if(typeof DecompressionStream==='undefined')throw Error('此浏览器缺少无损解压支持；不会换用低质量模型。');
   const reader=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();result=new Uint8Array(spec.bytes);let n=0;
   try{for(;;){if(signal?.aborted)throw abortError();const {done,value}=await reader.read();if(done)break;if(n+value.length>result.length)throw Error('解压体积超过固定清单');result.set(value,n);n+=value.length;}if(n!==result.length)throw Error('解压数据不完整');}
   catch(e){await reader.cancel(e).catch(()=>{});throw e;}finally{reader.releaseLock();}
  }
  await checked(result,spec);return result.buffer;
 }
 const constructors={float32:Float32Array,int8:Int8Array,uint8:Uint8Array,uint16:Uint16Array,int32:Int32Array};
 function parse(buffer){const n=new DataView(buffer).getUint32(8,true),h=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,12,n))),sections={};for(const s of h.sections){const C=constructors[s.dtype];sections[s.name]=new C(buffer,12+n+s.offset,s.byteLength/C.BYTES_PER_ELEMENT);}return{meta:h.meta,sections};}
 function urlFor(buffer,type){const u=URL.createObjectURL(new Blob([buffer],{type}));blobs.push(u);return u;}
 function setupRuntime(core){
  let model,basesReady=false,basesPromise=null;
  const runtime=window.__HAIR_RUNTIME={coreResult:{buffer:core,sha256:manifest.assets.core.sha256,compressedBytes:manifest.assets.core.packedBytes,transport:'verified-core-sections'},attachModel(m){model=m;for(const name of ['setIdentityParam','setExpressionParam','setIdentityVector','setExpressionVector','beginIdentityBlend','beginExpressionBlend']){const fn=m[name];m[name]=function(...a){if(!basesReady)throw Error('原始脸型/表情基底尚未加载；先 await lengthGroom.loadOriginalBases()。');return fn.apply(this,a);};}},async loadOriginalBases(){
   if(basesReady)return{ready:true,sha256:manifest.original.sha256};if(basesPromise)return basesPromise;
   basesPromise=(async()=>{
    const deferred=await asset(manifest.assets.deferred,null,generation),parts={...parse(core).sections,...parse(deferred).sections},full=new Uint8Array(manifest.original.bytes),prefix=atob(manifest.original.prefix);
    for(let i=0;i<prefix.length;i++)full[i]=prefix.charCodeAt(i);for(const s of manifest.original.sections){const b=parts[s.name];full.set(new Uint8Array(b.buffer,b.byteOffset,b.byteLength),prefix.length+s.offset);}
    await checked(full,manifest.original);const restored=parse(full.buffer);if(!model)throw Error('原模型尚未建立');model.identityBasis=restored.sections.identity_basis;model.expressionBasis=restored.sections.expression_basis;basesReady=true;stats.fullOriginalVerified=true;return{ready:true,sha256:manifest.original.sha256};
   })().catch(e=>{basesPromise=null;throw e;});return basesPromise;
  }};return runtime;
 }
 async function start(){
  if(running||appStarted)return running;const token=++generation,control=new AbortController();completed=0;inFlight.clear();$('error').hidden=true;$('startupRecovery').hidden=true;$('busy').hidden=false;document.getElementById('controls').inert=true;
  running=(async()=>{
   const textureSpecs=Object.values(manifest.assets).filter(a=>a.texture),items=[manifest.assets.core,manifest.assets.module,...textureSpecs];
   const results=await Promise.all(items.map(s=>asset(s,control.signal,token)));if(token!==generation)return;
   setupRuntime(results[0]);window.__HAIR_TEXTURES={};for(let i=0;i<textureSpecs.length;i++)window.__HAIR_TEXTURES[textureSpecs[i].name]=urlFor(results[i+2],'image/png');
   stats.navigation=performance.getEntriesByType('navigation')[0]?.toJSON();stats.assetsReadyMs=performance.now();stats.phase='original-groom';$('progressText').textContent='原质量资源已就绪 · 建立人物与毛发…';
   const u=urlFor(results[1],'text/javascript');appStarted=true;document.getElementById('controls').inert=false;await import(u);URL.revokeObjectURL(u);
  })().catch(e=>{control.abort(e);stats.failure=String(e.message||e);stats.phase='error';$('error').hidden=false;$('error').textContent='启动未完成：'+stats.failure+'\n已校验的分块已保留，重试不必全部重下。';$('startupRecovery').hidden=false;$('busy').hidden=true;console.error(e);if(appStarted){$('retryStartup').textContent='重新载入本页';$('retryStartup').onclick=()=>location.reload();}}).finally(()=>{running=null;});return running;
 }
 $('retryStartup').onclick=()=>start();$('copyStartupLog').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(stats,null,2));$('copyStartupLog').textContent='诊断已复制';}catch{$('startupLog').hidden=false;$('startupLog').textContent=JSON.stringify(stats,null,2);}};
 $('panelToggle').onclick=()=>document.body.classList.toggle('controls-open');window.__HAIR_BOOT={start,manifest,cacheName,dispose(){generation++;for(const u of blobs)URL.revokeObjectURL(u);blobs.length=0;window.__HAIR_TEXTURES=null;window.__HAIR_RUNTIME=null;}};
 requestAnimationFrame(()=>setTimeout(start,0));
})();
