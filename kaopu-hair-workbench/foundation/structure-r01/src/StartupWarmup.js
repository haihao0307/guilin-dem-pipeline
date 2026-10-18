// Schedule the retained kernel earlier; cache its exact default result.
// Kernel, resolution, parameters, shader and native geometry are unchanged.
(()=>{'use strict';
 if(window.__HAIR_STARTUP__)return;
 if(new URLSearchParams(location.hash.slice(1)).get('startup')==='serial'){window.__HAIR_STARTUP__={report:()=>({revision:'startup-12',disabled:true})};return;}
 const config=window.__HAIR_STARTUP_CONFIG__,options={seed:731,resolution:1024,period:12,density:1,width:1,poreWidth:1},key=o=>JSON.stringify(['seed','resolution','period','density','width','poreWidth'].map(k=>o[k])),cacheKey=config.kernelSHA256+'/'+key(options),database='kaopu-hair-startup-12';
 const metrics={revision:'startup-12',startedMS:performance.now(),kernelSHA256:config.kernelSHA256,workerStartedMS:null,workerCompletedMS:null,nativeReadyMS:null,consumedMS:null,consumers:0,matchedRequests:0,mismatchedRequests:0,cacheHit:false,cacheStored:false,cacheReadMS:null,cacheError:null,error:null},dispose=[];
 const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
 function arrays(out){
  if(out.resolution!==1024||out.period!==12||out.summary?.seed!==731)throw Error('Cached skin parameters differ');const result={};
  for(const name of ['pore','wrinkle']){
   const field=out[name+'Field'];if(!(field instanceof Float32Array)||field.length!==1024*1024)throw Error('Cached height layout differs');result[name+'Field']=field;
   const mips=out[name+'Map']?.mips;if(!Array.isArray(mips)||mips.length!==11)throw Error('Cached mip levels differ');for(let n=0;n<11;n++){const mip=mips[n],size=1024/2**n;if(mip.width!==size||mip.height!==size||!(mip.data instanceof Uint16Array)||mip.data.length!==size*size*4)throw Error('Cached mip layout differs');result[name+'/'+n]=mip.data;}
  }return result;
 }
 async function fingerprints(out){const result={};for(const[name,data]of Object.entries(arrays(out)))result[name]=hex(await crypto.subtle.digest('SHA-256',data));return result;}
 function openCache(){return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{done=true;reject(Error('Skin cache open timeout'));},500),request=indexedDB.open(database,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('skin'))request.result.createObjectStore('skin');};request.onsuccess=()=>{clearTimeout(timer);if(done)request.result.close();else{done=true;resolve(request.result);}};request.onerror=()=>{clearTimeout(timer);if(!done){done=true;reject(request.error||Error('Skin cache unavailable'));}};});}
 async function readCache(){
  const db=await openCache();let record;try{record=await new Promise((resolve,reject)=>{const tx=db.transaction('skin','readonly'),request=tx.objectStore('skin').get(cacheKey);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
  if(!record)return null;if(record.schema!=='kaopu/skin-startup-cache@1'||record.kernelSHA256!==config.kernelSHA256||record.optionsKey!==key(options))throw Error('Cached skin version differs');
  const actual=await fingerprints(record.field);if(JSON.stringify(actual)!==JSON.stringify(record.fingerprints))throw Error('Cached skin byte integrity differs');
  const field=record.field;field.summary={...field.summary,sourceGenerationMS:field.summary.generationMS,generationMS:0,cached:true};return field;
 }
 async function saveCache(field){
  const record={schema:'kaopu/skin-startup-cache@1',kernelSHA256:config.kernelSHA256,optionsKey:key(options),field,fingerprints:await fingerprints(field)},db=await openCache();try{await new Promise((resolve,reject)=>{const tx=db.transaction('skin','readwrite'),store=tx.objectStore('skin');store.clear();store.put(record,cacheKey);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Skin cache write aborted'));});metrics.cacheStored=true;}finally{db.close();}
 }
 function computeEarly(){return new Promise(resolve=>{
  try{
   const source=config.kernelSource+`\nself.onmessage=e=>{try{const f=SkinGraphKernel.build(e.data);const result={summary:f.summary,resolution:f.resolution,period:f.period,poreField:f.poreField,wrinkleField:f.wrinkleField,poreMap:f.poreMap,wrinkleMap:f.wrinkleMap};const buffers=[f.poreField.buffer,f.wrinkleField.buffer,...f.poreMap.mips.map(m=>m.data.buffer),...f.wrinkleMap.mips.map(m=>m.data.buffer)];self.postMessage({result},buffers);}catch(e){self.postMessage({error:String(e.stack||e)});}};`;
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);metrics.workerStartedMS=performance.now();let finished=false;
   const finish=(value,error)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();metrics.workerCompletedMS=performance.now();metrics.error=error||null;resolve(value);if(value)saveCache(value).catch(e=>{metrics.cacheError=String(e.message||e);});};
   const timer=setTimeout(()=>finish(null,'Early skin worker exceeded 45 seconds'),45000);worker.onmessage=e=>finish(e.data.result||null,e.data.error);worker.onerror=e=>finish(null,e.message||'Early skin worker failed');worker.postMessage(options);dispose.push(()=>finish(null,'Page closed'));
  }catch(e){metrics.error=String(e.message||e);resolve(null);}
 });}
 const promise=(async()=>{const start=performance.now();let cached=null;try{cached=await Promise.race([readCache(),new Promise(resolve=>setTimeout(()=>resolve(null),750))]);}catch(e){metrics.cacheError=String(e.message||e);}metrics.cacheReadMS=performance.now()-start;if(cached){metrics.cacheHit=true;return cached;}return computeEarly();})();
 const shared={key:key(options),kernelSHA256:config.kernelSHA256,async take(request){if(key(request)!==this.key){metrics.mismatchedRequests++;return null;}metrics.matchedRequests++;const out=await promise;if(out){metrics.consumedMS=performance.now();metrics.consumers++;}return out;}};
 window.__HAIR_STARTUP__={nativeReady:ms=>{metrics.nativeReadyMS=ms;},report:()=>({...metrics,overlapMS:metrics.workerCompletedMS&&metrics.nativeReadyMS?Math.max(0,Math.min(metrics.workerCompletedMS,metrics.nativeReadyMS)-metrics.workerStartedMS):null})};window.__HAIR_SKIN_WARMUP__=shared;
 window.addEventListener('pagehide',()=>dispose.forEach(f=>f()),{once:true});
})();
