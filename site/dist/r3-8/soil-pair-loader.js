import {abortable,throwIfAborted,sha256,checkedGzip,retryableIndex,sharedPool,fetchInfo,scopedName} from './checked-transport.js';
const INDEX_URL=new URL('./data/soil-pairs/soil-pairs.json',import.meta.url);
const DIRECTORIES=[new URL('./data/soil/',import.meta.url),new URL('../r3-7/data/soil/',import.meta.url)];
const FLAG=Symbol.for('wenzhou.r3.8.soil-pair-loader-installed');
const CODEC='i16le-pair-byte-shuffle-gzip-v1';
function validate(m){
  if(m?.schema!=='wenzhou-soil-pair-payloads/v1'||m.lossless!==true||m.codec!==CODEC||m.pairCount!==48||m.pairs?.length!==48)throw Error('土壤压缩索引身份不符');
  const keys=new Set();let total=0;
  for(const r of m.pairs){
    const key=r.property+'/'+r.depth;
    if(keys.has(key)||r.rows!==1003||r.columns!==884||r.samples!==r.rows*r.columns||r.decodedBytes!==r.samples*4||r.codec!==CODEC||!/^[a-z0-9-]+\.s2gz$/i.test(r.path)||!Number.isSafeInteger(r.compressedBytes)||r.compressedBytes<=0||r.compressedBytes>8*1024*1024||![r.compressedSha256,r.valueSha256,r.uncertaintySha256].every(h=>/^[a-f0-9]{64}$/.test(h)))throw Error('土壤双通道条目不完整');
    keys.add(key);total+=r.compressedBytes;
  }
  if(total!==m.compressedBytes)throw Error('土壤总字节数不符');
}
async function decode(rec,fetcher,signal){
  const raw=await checkedGzip(fetcher,new URL(rec.path,INDEX_URL),rec.compressedBytes,rec.compressedSha256,rec.decodedBytes,signal);
  const n=rec.samples,value=new Uint8Array(n*2),uncertainty=new Uint8Array(n*2);
  // Directly unshuffle into the two final channels; no redundant scratch pair.
  for(let i=0;i<n;i++){value[i*2]=raw[i];value[i*2+1]=raw[n+i];uncertainty[i*2]=raw[2*n+i];uncertainty[i*2+1]=raw[3*n+i];}
  const [q,u]=await Promise.all([sha256(value),sha256(uncertainty)]);
  if(q!==rec.valueSha256||u!==rec.uncertaintySha256)throw Error('土壤解码原始 SHA-256 不符');
  throwIfAborted(signal);return{value,uncertainty};
}
export function installSoilPairLoader(){
  if(window[FLAG])return;window[FLAG]=true;
  const nativeFetch=window.fetch.bind(window),pool=sharedPool(2),index=retryableIndex(nativeFetch,INDEX_URL,validate);
  window.wenzhouTransportDiagnostics??={};window.wenzhouTransportDiagnostics.soil=pool.stats;
  window.fetch=async(input,init)=>{
    const {url,signal,method}=fetchInfo(input,init),name=scopedName(url,DIRECTORIES);
    const match=name&&/^([a-z0-9]+)-(\d+-\d+cm)-(q05|uncertainty)\.i16le$/i.exec(name);
    if(!match||method!=='GET')return nativeFetch(input,init);
    throwIfAborted(signal);
    const manifest=await abortable(index(),signal);
    const rec=manifest.pairs.find(r=>r.property===match[1]&&r.depth===match[2]);
    if(!rec)throw Error('当前属性与深度没有压缩载荷；未请求旧大文件');
    const pair=await pool.get(rec.compressedSha256,s=>decode(rec,nativeFetch,s),signal);throwIfAborted(signal);
    const c=document.getElementById('terrain');if(c){c.dataset.soilContextPayloadTransport='dual-channel-gzip';c.dataset.soilContextPairCompressedBytes=String(rec.compressedBytes);c.dataset.soilContextPairCodec=rec.codec;c.dataset.soilTransportCacheEntries=String(pool.stats().cacheEntries);}
    return new Response(match[3]==='q05'?pair.value:pair.uncertainty,{headers:{'Content-Type':'application/octet-stream','X-Wenzhou-Soil-Transport':'dual-channel-gzip'}});
  };
  document.documentElement.dataset.wenzhouSoilPairLoader='true';
  document.documentElement.dataset.wenzhouTransportRevision='R3.9.1';
}
