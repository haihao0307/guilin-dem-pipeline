// Every attempt has a total deadline, including streamed response bodies.
export async function fetchSourceBytes(url,{onProgress=()=>{},timeoutMs=90000,retries=2,fetchImpl=globalThis.fetch}={}){
 for(let attempt=1;attempt<=retries+1;attempt++){
  const controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('SOURCE_TIMEOUT '+url+' after '+timeoutMs+'ms'));},timeoutMs)});
  try{return await Promise.race([(async()=>{
   onProgress({phase:'download',url:String(url),attempt,loaded:0,total:0});
   const r=await fetchImpl(url,{signal:controller.signal,cache:attempt>1?'reload':'default'});if(!r.ok)throw Error('SOURCE_HTTP_'+r.status+' '+url);
   const total=Number(r.headers.get('content-length'))||0;let loaded=0;const chunks=[];
   if(!r.body){const b=await r.arrayBuffer();onProgress({phase:'download',url:String(url),attempt,loaded:b.byteLength,total});return b;}
   const reader=r.body.getReader();while(true){const{done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;onProgress({phase:'download',url:String(url),attempt,loaded,total});}
   const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes.buffer;
  })(),deadline]);}catch(e){if(attempt>retries+1-1)throw e;onProgress({phase:'retry',url:String(url),attempt,error:e.message});await new Promise(r=>setTimeout(r,Math.min(attempt*500,1500)));}finally{clearTimeout(timer);}
 }
}
export async function withDeadline(promise,label,ms=90000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SOURCE_STAGE_TIMEOUT '+label)),ms)})]);}finally{clearTimeout(timer);}}
