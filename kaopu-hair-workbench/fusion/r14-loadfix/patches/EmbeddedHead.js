/** R14.2-L01: exact original GNM bytes, bundled with the document.
 * No fetch, CDN, telemetry, replacement model or relaxed integrity checks.
 */
export const HEAD_SIZE=34937952;
export const HEAD_SHA='fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const abort=signal=>{if(signal?.aborted)throw signal.reason||new DOMException('已取消','AbortError');};
const failure=(code,message)=>Object.assign(new Error(message),{code});
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export async function unpackVerified({base64,compressedSize,size,sha256,signal,onProgress=()=>{}}){
 abort(signal);
 if(!base64||typeof base64!=='string')throw failure('HEAD_PAYLOAD_MISSING','本页未收到完整人物数据，请重新载入本页。');
 if(!Number.isSafeInteger(size)||size<1||size>40000000||!Number.isSafeInteger(compressedSize)||compressedSize<1||compressedSize>15000000)throw failure('HEAD_MANIFEST_INVALID','人物数据清单无效。');
 if(base64.length!==4*Math.ceil(compressedSize/3))throw failure('HEAD_PAYLOAD_TRUNCATED','本页人物数据传输不完整，请重新载入本页。');
 const packed=new Uint8Array(compressedSize);let offset=0;
 for(let i=0;i<base64.length;i+=262144){
  abort(signal);let decoded;try{decoded=atob(base64.slice(i,i+262144));}catch{throw failure('HEAD_BASE64_INVALID','本页人物数据编码损坏。');}
  if(offset+decoded.length>packed.length)throw failure('HEAD_SIZE_MISMATCH','人物压缩数据体积不符。');
  for(let j=0;j<decoded.length;j++)packed[offset++]=decoded.charCodeAt(j);
  onProgress('decode',offset,compressedSize);await pause();
 }
 if(offset!==compressedSize)throw failure('HEAD_SIZE_MISMATCH','人物压缩数据不完整。');
 if(typeof DecompressionStream==='undefined')throw failure('HEAD_DECOMPRESSION_UNSUPPORTED','此浏览器缺少 gzip 解压支持，尚未生成人物。请使用更新的浏览器。');
 const reader=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const output=new Uint8Array(size);let length=0;
 const cancel=()=>{void reader.cancel(signal.reason).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
  for(;;){abort(signal);const {value,done}=await reader.read();abort(signal);if(done)break;
   if(length+value.byteLength>size)throw failure('HEAD_SIZE_MISMATCH','解压后人物体积超出固定清单。');
   output.set(value,length);length+=value.byteLength;onProgress('inflate',length,size);
  }
 }catch(e){void reader.cancel(e).catch(()=>{});throw e;}finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
 if(length!==size)throw failure('HEAD_SIZE_MISMATCH','解压后人物数据不完整。');
 onProgress('verify',length,size);await pause();abort(signal);
 if(await hash(output)!==sha256)throw failure('HEAD_HASH_MISMATCH','人物 SHA-256 校验失败，未使用损坏数据。');
 abort(signal);onProgress('ready',size,size);return output.buffer;
}
let cached=null;
export function loadEmbeddedHead({signal,onProgress}={}){
 if(cached)return cached;
 const el=document.getElementById('gnmHeadPayload');
 cached=unpackVerified({base64:el?.content?.textContent.trim(),compressedSize:Number(el?.dataset.bytes),size:HEAD_SIZE,sha256:HEAD_SHA,signal,onProgress})
  .then(buffer=>({buffer,transport:'embedded-verified-gzip',compressedBytes:Number(el.dataset.bytes)}))
  .catch(error=>{cached=null;throw error;});
 return cached;
}
