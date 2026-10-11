/** Bounded lossless asset loading. No user files or telemetry leave the browser. */
export async function readStream(stream,{signal,maxBytes,onProgress=()=>{}}){
 const reader=stream.getReader(),chunks=[];let length=0;const cancelled=()=>{void reader.cancel(signal.reason).catch(()=>{})};signal?.addEventListener('abort',cancelled,{once:true});
 try{for(;;){if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');const item=await reader.read();if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');if(item.done)break;length+=item.value.byteLength;if(length>maxBytes)throw Error('资源体积超过固定清单');chunks.push(item.value);onProgress(length);}}
 catch(error){await reader.cancel(error).catch(()=>{});throw error}finally{signal?.removeEventListener('abort',cancelled);reader.releaseLock()}
 const out=new Uint8Array(length);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length}return out.buffer;
}
export async function checkedDownload(url,{signal,size,sha256,gzip=false,onProgress=()=>{},idleMs=20000,totalMs=90000,fetchImpl=fetch}){
 const controller=new AbortController();const cancel=()=>controller.abort(signal.reason||new DOMException('Cancelled','AbortError'));
 if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 let idle=0;const kick=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort(new Error('资源读取停滞，请重试')),idleMs)};const total=setTimeout(()=>controller.abort(new Error('资源读取超时，请重试')),totalMs);kick();
 try{const response=await fetchImpl(url,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);if(!response.body)throw Error('资源响应没有数据流');
 let bytes=await readStream(response.body,{signal:controller.signal,maxBytes:size+65536,onProgress:n=>{kick();onProgress(n,gzip?'compressed':'raw')}});
 if(gzip){if(typeof DecompressionStream==='undefined')throw Error('该浏览器不支持无损解压，尝试原数据');bytes=await readStream(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),{signal:controller.signal,maxBytes:size,onProgress:()=>kick()});}
 if(bytes.byteLength!==size)throw Error('模型数据不完整');const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(actual!==sha256)throw Error('模型 SHA-256 校验不符');return bytes;
 }finally{clearTimeout(idle);clearTimeout(total);signal?.removeEventListener('abort',cancel)}
}
export async function loadFixedAsset({primary,fallback,signal,size,sha256,onProgress,onFallback}){
 try{return {buffer:await checkedDownload(primary,{signal,size,sha256,gzip:true,onProgress}),transport:'lossless-gzip'}}catch(error){if(signal?.aborted)throw signal.reason||error;onFallback?.(String(error.message||error));return {buffer:await checkedDownload(fallback,{signal,size,sha256,onProgress}),transport:'original-raw-fallback'}}
}
