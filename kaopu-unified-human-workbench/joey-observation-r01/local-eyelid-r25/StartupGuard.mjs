// R25-only loading transport. Exact original URLs and asset-byte checks remain.
// No automatic telemetry, alternate host, model replacement, or quality change.
export function installStartupGuard(env, {idleMS=45000,onUpdate=()=>{}}={}) {
 const original=env.fetch.bind(env),records=[],active=new Set();let stopped=false,lastEmit=0;
 const now=()=>Date.now(),error=m=>Object.assign(new Error(m),{name:'LoadingTimeoutError'});
 const emit=(force=false)=>{if(force||now()-lastEmit>200){lastEmit=now();onUpdate({version:'R25-loading/2',requests:records.map(r=>({...r})),active:active.size,stopped});}};
 function request(input,init={}) {
  const url=typeof input==='string'?input:input.url||String(input),method=init.method||input.method||'GET';
  if(stopped)return Promise.reject(new Error('载入已取消'));
  const row={url,method,startedAt:now(),attempt:0,bytes:0,status:'waiting',idleMS};records.push(row);
  let controller,timer,response,reader,removed=false,bodyPromise=null;
  const abortSignal=init.signal||input.signal;
  const remove=()=>{if(!removed){removed=true;active.delete(cancel);abortSignal?.removeEventListener('abort',cancel);}};
  const cancel=()=>{controller?.abort(abortSignal?.reason||new DOMException('载入已取消','AbortError'));clearTimeout(timer);row.status='cancelled';row.finishedAt=now();remove();emit(true);};
  active.add(cancel);abortSignal?.addEventListener('abort',cancel,{once:true});
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{row.timeout=true;controller.abort(error('连续 '+Math.round(idleMS/1000)+' 秒未收到数据：'+url));},idleMS);};
  const retryable=e=>!stopped&&!abortSignal?.aborted&&method==='GET'&&row.attempt<2&&(e.name==='LoadingTimeoutError'||e.name==='TypeError'||[408,429,500,502,503,504].includes(e.httpStatus));
  async function headers(){
   row.attempt++;row.bytes=0;row.timeout=false;row.status=row.attempt===1?'waiting':'retrying';controller=new AbortController();
   if(abortSignal?.aborted){cancel();throw abortSignal.reason||new DOMException('Cancelled','AbortError');}
   arm();emit(true);
   try{response=await original(input,{...init,signal:controller.signal});row.httpStatus=response.status;if(!response.ok){const e=Error('HTTP '+response.status+'：'+url);e.httpStatus=response.status;throw e;}row.status='receiving';arm();emit(true);return response;}
   catch(e){clearTimeout(timer);if(controller.signal.aborted&&!abortSignal?.aborted&&!stopped)e=controller.signal.reason||e;if(retryable(e)){row.lastError=String(e.message||e);emit(true);return headers();}row.status=stopped||abortSignal?.aborted?'cancelled':'error';row.error=String(e.message||e);row.finishedAt=now();remove();emit(true);throw e;}
  }
  async function consume(){
   try{
    const chunks=[];let size=0;reader=response.body?.getReader();
    if(reader){while(true){const part=await reader.read();if(part.done)break;chunks.push(part.value);size+=part.value.byteLength;row.bytes=size;arm();emit();}}
    const out=new Uint8Array(size);let offset=0;for(const part of chunks){out.set(part,offset);offset+=part.byteLength;}
    clearTimeout(timer);row.status='complete';row.finishedAt=now();remove();emit(true);return out.buffer;
   }catch(e){clearTimeout(timer);try{await reader?.cancel();}catch{}if(controller.signal.aborted&&!abortSignal?.aborted&&!stopped)e=controller.signal.reason||e;
    if(retryable(e)){row.lastError=String(e.message||e);await headers();return consume();}
    row.status=stopped||abortSignal?.aborted?'cancelled':'error';row.error=String(e.message||e);row.finishedAt=now();remove();emit(true);throw e;
   }
  }
  return headers().then(r=>{const bytes=()=>bodyPromise||(bodyPromise=consume());Object.defineProperties(r,{arrayBuffer:{value:bytes},text:{value:async()=>new TextDecoder().decode(await bytes())},json:{value:async()=>JSON.parse(new TextDecoder().decode(await bytes()))},blob:{value:async()=>new Blob([await bytes()],{type:r.headers.get('content-type')||''})}});return r;});
 }
 env.fetch=request;
 return {report:()=>({version:'R25-loading/2',requests:records.map(r=>({...r})),active:active.size,stopped}),stop(){stopped=true;for(const cancel of [...active])cancel();emit(true);},restore(){this.stop();if(env.fetch===request)env.fetch=original;}};
}
