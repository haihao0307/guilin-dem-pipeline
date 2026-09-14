import {abortable,throwIfAborted,sha256,checkedGzip,retryableIndex,sharedPool,fetchInfo,scopedName} from './checked-transport.js';
const INDEX_URL=new URL('./data/evidence-gzip/index.json',import.meta.url);
const DIRECTORIES={wrb:new URL('./data/wrb/',import.meta.url),water:new URL('./data/water/',import.meta.url)};
const FLAG=Symbol.for('wenzhou.r3.9.evidence-gzip-loader-installed');
function validate(m){
  if(m?.schema!=='wenzhou-r3.9-evidence-gzip/v1'||m.lossless!==true||m.records?.length!==41)throw Error('环境压缩索引身份不符');
  const keys=new Set();let total=0;
  for(const r of m.records){
    const key=r.family+'/'+r.logicalPath;
    if(keys.has(key)||!DIRECTORIES[r.family]||!/^[a-z0-9-]+\.(u8|u16le)$/.test(r.logicalPath)||r.packedPath!==key+'.gz'||r.codec!=='gzip-v1'||![r.rawSha256,r.packedSha256].every(h=>/^[a-f0-9]{64}$/.test(h))||![r.rawBytes,r.packedBytes].every(n=>Number.isSafeInteger(n)&&n>0&&n<=8*1024*1024))throw Error('环境载荷索引条目不完整');
    keys.add(key);total+=r.packedBytes;
  }
  if(total!==m.packedBytes)throw Error('环境压缩总字节数不符');
}
export function installEvidenceGzipLoader(){
  if(window[FLAG])return;window[FLAG]=true;
  const nativeFetch=window.fetch.bind(window),pool=sharedPool(4),index=retryableIndex(nativeFetch,INDEX_URL,validate);
  window.wenzhouTransportDiagnostics??={};window.wenzhouTransportDiagnostics.environment=pool.stats;
  window.fetch=async(input,init)=>{
    const {url,signal,method}=fetchInfo(input,init);
    let family,name;
    for(const [f,base]of Object.entries(DIRECTORIES)){const n=scopedName(url,[base]);if(n&&/\.(u8|u16le)$/.test(n)){family=f;name=n;break;}}
    if(!family||method!=='GET')return nativeFetch(input,init);
    throwIfAborted(signal);const m=await abortable(index(),signal);
    const rec=m.records.find(r=>r.family===family&&r.logicalPath===name);
    if(!rec)throw Error('环境压缩条目缺失；未请求旧大文件');
    const raw=await pool.get(rec.packedSha256,async s=>{
      const bytes=await checkedGzip(nativeFetch,new URL(rec.packedPath,INDEX_URL),rec.packedBytes,rec.packedSha256,rec.rawBytes,s);
      if(await sha256(bytes)!==rec.rawSha256)throw Error('环境解码原始 SHA-256 不符');
      throwIfAborted(s);return bytes;
    },signal);throwIfAborted(signal);
    const c=document.getElementById('terrain');if(c){c.dataset.environmentPayloadTransport='gzip';c.dataset.environmentPayloadCodec=rec.codec;c.dataset.environmentPayloadPackedBytes=String(rec.packedBytes);c.dataset.environmentPayloadLogicalPath=`${rec.family}/${rec.logicalPath}`;c.dataset.environmentTransportCacheEntries=String(pool.stats().cacheEntries);}
    return new Response(raw,{headers:{'Content-Type':'application/octet-stream','X-Wenzhou-Evidence-Transport':'gzip'}});
  };
  document.documentElement.dataset.wenzhouEvidenceGzipLoader='true';
}
