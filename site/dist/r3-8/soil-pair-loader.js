const INDEX_URL=new URL('./data/soil-pairs/soil-pairs.json',import.meta.url);
const FLAG=Symbol.for('wenzhou.r3.8.soil-pair-loader-installed');

function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
async function digest(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
function parseLayer(url){
  let name;
  try{name=new URL(url,location.href).pathname.split('/').pop();}catch{return null;}
  const m=/^([a-z0-9]+)-(\d+-\d+cm)-(q05|uncertainty)\.i16le$/i.exec(name||'');
  return m?{property:m[1],depth:m[2],channel:m[3]}:null;
}

async function decodePair(rec,nativeFetch,signal){
  const r=await nativeFetch(new URL(rec.path,INDEX_URL),{signal});
  if(!r.ok)throw Error(`R3.8 双通道土壤载荷读取失败 (${r.status})`);
  const packed=await r.arrayBuffer();
  if(packed.byteLength!==rec.compressedBytes)throw Error('R3.8 双通道土壤载荷字节数不符');
  if(await digest(packed)!==rec.compressedSha256)throw Error('R3.8 双通道土壤载荷 SHA-256 不符');
  const ds=new DecompressionStream('gzip');
  const raw=await new Response(new Blob([packed]).stream().pipeThrough(ds)).arrayBuffer();
  const bytes=new Uint8Array(raw),n=rec.samples;
  if(bytes.length!==n*4)throw Error('R3.8 双通道土壤解压长度不符');
  const value=new Uint8Array(n*2),uncertainty=new Uint8Array(n*2);
  value.set(bytes.subarray(0,n),0);value.set(bytes.subarray(n,2*n),n);
  uncertainty.set(bytes.subarray(2*n,3*n),0);uncertainty.set(bytes.subarray(3*n,4*n),n);
  const valueLE=new Uint8Array(n*2),uncLE=new Uint8Array(n*2);
  for(let i=0;i<n;i++){
    valueLE[i*2]=value[i];valueLE[i*2+1]=value[n+i];
    uncLE[i*2]=uncertainty[i];uncLE[i*2+1]=uncertainty[n+i];
  }
  if(await digest(valueLE)!==rec.valueSha256)throw Error('R3.8 双通道 value 解码哈希不符');
  if(await digest(uncLE)!==rec.uncertaintySha256)throw Error('R3.8 双通道 uncertainty 解码哈希不符');
  return {value:valueLE,uncertainty:uncLE,rec};
}

export function installSoilPairLoader(){
  if(window[FLAG])return;window[FLAG]=true;
  if(typeof DecompressionStream!=='function')return;
  const nativeFetch=window.fetch.bind(window),cache=new Map();
  let indexPromise=null;
  const index=()=>indexPromise??=(nativeFetch(INDEX_URL).then(r=>r.ok?r.json():null).then(m=>m?.schema==='wenzhou-soil-pair-payloads/v1'&&m?.lossless===true?m:null).catch(()=>null));
  window.fetch=async(input,init)=>{
    const url=input instanceof Request?input.url:input instanceof URL?input.href:String(input);
    const parsed=parseLayer(url);if(!parsed)return nativeFetch(input,init);
    const manifest=await index();if(!manifest)return nativeFetch(input,init);
    const rec=manifest.pairs.find(x=>x.property===parsed.property&&x.depth===parsed.depth);if(!rec)return nativeFetch(input,init);
    const key=rec.compressedSha256;
    let pending=cache.get(key);
    if(!pending){pending=decodePair(rec,nativeFetch,init?.signal).catch(e=>{cache.delete(key);throw e;});cache.set(key,pending);while(cache.size>2)cache.delete(cache.keys().next().value);}
    const pair=await pending;if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
    const data=parsed.channel==='q05'?pair.value:pair.uncertainty;
    const canvas=document.getElementById('terrain');if(canvas){canvas.dataset.soilContextPayloadTransport='dual-channel-gzip';canvas.dataset.soilContextPairCompressedBytes=String(rec.compressedBytes);canvas.dataset.soilContextPairCodec=rec.codec;}
    return new Response(data,{status:200,headers:{'Content-Type':'application/octet-stream','X-Wenzhou-Soil-Transport':'dual-channel-gzip'}});
  };
  document.documentElement.dataset.wenzhouSoilPairLoader='true';
}
