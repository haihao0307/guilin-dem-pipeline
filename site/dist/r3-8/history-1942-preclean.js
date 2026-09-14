const FLAG=Symbol.for('wenzhou.r3.10.history-1942-preclean-installed');
const MODE='1942-preclean-r1';
const MANIFEST_URL=new URL('../r3-5/data/osm/osm-context.json',location.href);
const OSM_BASE=new URL('../r3-5/data/osm/',location.href);
const DROP_CODES=new Set([1,2]); // motorway, motorway_link only

function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
async function digest(buffer){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)));}
function abortIfNeeded(signal){if(signal?.aborted)throw new DOMException('Aborted','AbortError');}
function normalizeUrl(input){try{return new URL(input instanceof Request?input.url:input instanceof URL?input.href:String(input),location.href).href;}catch{return '';}}
function filterRoadParts(buffer){
  if(buffer.byteLength%16)throw Error('1942 预清理：road parts 字节格式错误');
  const src=new DataView(buffer),kept=[];
  let motorway=0,motorwayLink=0,removedSegments=0,keptVertexRefs=0;
  for(let off=0;off<buffer.byteLength;off+=16){
    const start=src.getUint32(off,true),count=src.getUint32(off+4,true),code=src.getUint32(off+8,true),flags=src.getUint32(off+12,true);
    if(DROP_CODES.has(code)){
      if(code===1)motorway++;else motorwayLink++;
      removedSegments+=Math.max(0,count-1);
      continue;
    }
    kept.push(start,count,code,flags);keptVertexRefs+=count;
  }
  const out=new ArrayBuffer(kept.length*4),dst=new DataView(out);
  for(let i=0;i<kept.length;i++)dst.setUint32(i*4,kept[i],true);
  return{buffer:out,motorway,motorwayLink,removedSegments,keptParts:kept.length/4,keptVertexRefs};
}
function decorateUi(summary){
  const apply=()=>{
    document.documentElement.dataset.wenzhouHistoryMode=MODE;
    const canvas=document.getElementById('terrain');
    if(canvas){
      canvas.dataset.historyMode=MODE;
      canvas.dataset.historyRemovedMotorwayParts=String(summary.motorway);
      canvas.dataset.historyRemovedMotorwayLinkParts=String(summary.motorwayLink);
      canvas.dataset.historyRemovedRoadParts=String(summary.removedParts);
      canvas.dataset.historyRemovedRoadSegments=String(summary.removedSegments);
    }
    const brand=document.querySelector('.brand p');if(brand)brand.textContent='1942 预清理 · 第 1 轮';
    const panel=document.querySelector('.focus-panel');
    if(panel&&!document.getElementById('history-1942-card')){
      const card=document.createElement('div');card.id='history-1942-card';card.className='osm-card';card.hidden=false;
      card.innerHTML=`<strong>1942 预清理 · 高置信减法</strong><span>已隐藏 motorway ${summary.motorway.toLocaleString()} parts · motorway_link ${summary.motorwayLink.toLocaleString()} parts</span><small>当前 OSM 运行包没有铁路/高铁层；普通道路、桥梁、围垦、水库和建筑本轮不动，等待历史真图确认。</small>`;
      panel.prepend(card);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
}

export function installHistory1942Preclean(){
  if(window[FLAG]||new URLSearchParams(location.search).get('year')!=='1942')return false;
  window[FLAG]=true;
  const nativeFetch=window.fetch.bind(window),synthetic=new Map();
  const manifestPromise=(async()=>{
    const r=await nativeFetch(MANIFEST_URL);if(!r.ok)throw Error(`1942 预清理：OSM 索引读取失败 (${r.status})`);
    const manifest=await r.json();
    const summary={motorway:0,motorwayLink:0,removedParts:0,removedSegments:0,patches:[]};
    for(const patch of manifest.patches||[]){
      const item=patch.files?.roadParts;if(!item)continue;
      const originalUrl=new URL(item.path.split('/').at(-1),OSM_BASE);
      const pr=await nativeFetch(originalUrl);if(!pr.ok)throw Error(`1942 预清理：${patch.id} 道路 parts 读取失败 (${pr.status})`);
      const raw=await pr.arrayBuffer();
      if(raw.byteLength!==item.bytes||await digest(raw)!==item.sha256)throw Error(`1942 预清理：${patch.id} 原 OSM parts 校验失败`);
      const f=filterRoadParts(raw),name=`${patch.id}.roads.parts.h1942.u32le`,url=new URL(name,OSM_BASE).href,sha=await digest(f.buffer);
      synthetic.set(url,{buffer:f.buffer,sha,bytes:f.buffer.byteLength});
      patch.files.roadParts={path:`./data/osm/${name}`,bytes:f.buffer.byteLength,sha256:sha};
      const originalCounts={...(patch.roads.classPartCounts||{})};
      patch.roads.sourceModernClassPartCounts=originalCounts;
      patch.roads.classPartCounts={...originalCounts};delete patch.roads.classPartCounts.motorway;delete patch.roads.classPartCounts.motorway_link;
      patch.roads.sourcePartCount=patch.roads.partCount;
      patch.roads.partCount=f.keptParts;
      patch.roads.activeReferencedVertexCount=f.keptVertexRefs;
      patch.roads.history1942Preclean={removedMotorwayParts:f.motorway,removedMotorwayLinkParts:f.motorwayLink,removedSegments:f.removedSegments};
      summary.motorway+=f.motorway;summary.motorwayLink+=f.motorwayLink;summary.removedSegments+=f.removedSegments;
      summary.patches.push({id:patch.id,motorway:f.motorway,motorwayLink:f.motorwayLink,removedParts:f.motorway+f.motorwayLink});
    }
    summary.removedParts=summary.motorway+summary.motorwayLink;
    manifest.history1942Preclean={schema:'wenzhou-history-1942-preclean/r1',active:true,removedClasses:['motorway','motorway_link'],railwayAction:'none-current-runtime-has-no-railway-layer',deferred:['trunk','trunk_link','primary','secondary','tertiary','bridge-flagged-roads','buildings','reservoirs','reclamation'],summary};
    window.__wenzhouHistory1942Preclean=manifest.history1942Preclean;
    decorateUi(summary);
    return manifest;
  })();
  window.fetch=async(input,init)=>{
    abortIfNeeded(init?.signal);
    const url=normalizeUrl(input);
    if(url===MANIFEST_URL.href){
      const manifest=await manifestPromise;abortIfNeeded(init?.signal);
      return new Response(JSON.stringify(manifest),{status:200,headers:{'Content-Type':'application/json','X-Wenzhou-History-Mode':MODE}});
    }
    const hit=synthetic.get(url);
    if(hit){abortIfNeeded(init?.signal);return new Response(hit.buffer.slice(0),{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':String(hit.bytes),'X-Wenzhou-History-Mode':MODE}});}
    return nativeFetch(input,init);
  };
  return true;
}
