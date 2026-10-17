/** Bounded streaming transport; content still must pass cryptographic locks. */
export async function getBytes(url,onProgress=()=>{},{timeoutMs=120000,attempts=2}={}){
 let error;
 for(let attempt=1;attempt<=attempts;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error(timeoutMs+'ms download deadline')),timeoutMs);
  try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status+' '+url);const reader=response.body.getReader(),chunks=[];let size=0;const total=Number(response.headers.get('content-length'))||0;
   for(;;){const{value,done}=await reader.read();if(done)break;chunks.push(value);size+=value.length;onProgress({loaded:size,total,attempt});}
   const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;
  }catch(e){error=e;onProgress({phase:'重试/失败',attempt,error:e.message});}finally{clearTimeout(timer);}
 }throw Error('Download failed after '+attempts+' attempts: '+url+' '+error.message);
}
export async function unpack(bytes){return bytes[0]===31&&bytes[1]===139?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()):bytes;}
