const INDEX_URL=new URL('./data/evidence-gzip/index.json',import.meta.url);
const FLAG=Symbol.for('wenzhou.r3.9.evidence-gzip-loader-installed');
function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
async function digest(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
function logical(url){
  let p;try{p=new URL(url,location.href).pathname;}catch{return null;}
  const m=/\/data\/(wrb|water)\/([^/]+\.(?:u8|u16le))$/.exec(p);
  return m?{family:m[1],path:m[2]}:null;
}
async function decode(rec,nativeFetch,signal){
  const r=await nativeFetch(new URL(rec.packedPath,INDEX_URL),{signal});if(!r.ok)throw Error(`环境压缩载荷读取失败 (${r.status})`);
  const packed=await r.arrayBuffer();if(packed.byteLength!==rec.packedBytes)throw Error('环境压缩载荷字节数不符');
  if(await digest(packed)!==rec.packedSha256)throw Error('环境压缩载荷 SHA-256 不符');
  const raw=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==rec.rawBytes)throw Error('环境载荷解压长度不符');
  if(await digest(raw)!==rec.rawSha256)throw Error('环境载荷解码 SHA-256 不符');
  return raw;
}
export function installEvidenceGzipLoader(){
  if(window[FLAG])return;window[FLAG]=true;if(typeof DecompressionStream!=='function')return;
  const nativeFetch=window.fetch.bind(window),cache=new Map();let indexPromise=null;
  const index=()=>indexPromise??=nativeFetch(INDEX_URL).then(r=>r.ok?r.json():null).then(m=>m?.schema==='wenzhou-r3.9-evidence-gzip/v1'&&m?.lossless===true?m:null).catch(()=>null);
  window.fetch=async(input,init)=>{
    const url=input instanceof Request?input.url:input instanceof URL?input.href:String(input);const key=logical(url);if(!key)return nativeFetch(input,init);
    const m=await index();if(!m)return nativeFetch(input,init);const rec=m.records.find(x=>x.family===key.family&&x.logicalPath===key.path);if(!rec)return nativeFetch(input,init);
    const cacheKey=rec.packedSha256;let pending=cache.get(cacheKey);if(!pending){pending=decode(rec,nativeFetch,init?.signal).catch(e=>{cache.delete(cacheKey);throw e;});cache.set(cacheKey,pending);while(cache.size>4)cache.delete(cache.keys().next().value);}
    const raw=await pending;if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
    const canvas=document.getElementById('terrain');if(canvas){canvas.dataset.environmentPayloadTransport='gzip';canvas.dataset.environmentPayloadCodec=rec.codec;canvas.dataset.environmentPayloadPackedBytes=String(rec.packedBytes);canvas.dataset.environmentPayloadLogicalPath=`${rec.family}/${rec.logicalPath}`;}
    return new Response(raw,{status:200,headers:{'Content-Type':'application/octet-stream','X-Wenzhou-Evidence-Transport':'gzip'}});
  };
  document.documentElement.dataset.wenzhouEvidenceGzipLoader='true';
}
