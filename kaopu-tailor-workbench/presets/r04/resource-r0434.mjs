/** Bounded byte reads. Integrity checks belong to callers and are never retried or bypassed. */
export async function readBytes(url,{signal,attempts=3,timeoutMs=25000,fetchImpl=fetch,delayMs=250}={}){
 if(!Number.isInteger(attempts)||attempts<1||attempts>4||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new TypeError('Invalid resource policy');
 for(let attempt=0;attempt<attempts;attempt++){
  if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
  const controller=new AbortController();let timedOut=false;
  const abort=()=>controller.abort(signal.reason||new DOMException('Cancelled','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort(new DOMException('Resource timeout','TimeoutError'));},timeoutMs);
  try{
   const response=await fetchImpl(url,{signal:controller.signal,cache:attempt?'reload':'default'});
   if(!response.ok){const e=new Error('资源读取失败 HTTP '+response.status+'：'+url);e.status=response.status;throw e;}
   const data=await response.arrayBuffer();
   if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
   return data;
  }catch(error){
   if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
   const retryable=timedOut||error instanceof TypeError||[408,429].includes(error.status)||error.status>=500;
   if(!retryable||attempt+1===attempts){if(timedOut)throw new Error('资源读取超时：'+url);throw error;}
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  if(delayMs)await new Promise((resolve,reject)=>{
   const done=()=>{signal?.removeEventListener('abort',cancel);resolve();};
   const timer=setTimeout(done,delayMs*(attempt+1));
   const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(signal.reason||new DOMException('Cancelled','AbortError'));};
   signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  });
 }
 throw new Error('Unreachable resource state');
}
