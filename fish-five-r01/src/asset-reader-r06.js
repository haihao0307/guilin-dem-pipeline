// R10 reads selected adopted products. A bounded disk cache avoids downloading
// immutable products again; live decoded geometry remains selected-fish only.
import {decodeRadix85} from './radix85-r07.js';
const active = new Map(),failed = new Set();
export function loadPhase(id,phase,detail={}){
 document.dispatchEvent(new CustomEvent('fish-load-progress',{detail:{id,phase,...detail}}));
}
export function cancelPendingAssets(keepId){
 for(const [id,controller] of active)if(id!==keepId)controller.abort();
}
export async function readCarrierBytes(el,id,{signal}={}){
 if(!el)throw Error('鱼体成品数据未找到');
 if(!el.dataset.url){if(el.dataset.inlineEncoding==='radix85-r07'){loadPhase(id,'decode');return decodeRadix85(el.textContent.trim(),Number(el.dataset.bytes),signal);}const binary=atob(el.textContent.trim()),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
 const url=new URL(el.dataset.url,document.baseURI);
 if(url.origin!==location.origin)throw Error('鱼体成品数据地址不属于当前网站');
 const expected=Number(el.dataset.bytes),hash=el.dataset.sha256;
 if(!Number.isSafeInteger(expected)||expected<=0||!/^[0-9a-f]{64}$/.test(hash||''))throw Error('鱼体成品完整性记录缺失');
 const controller=new AbortController();active.set(id,controller);
 const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 let timer,stalled=false;const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>{stalled=true;controller.abort();},30000);};
 try{
  loadPhase(id,'download',{loaded:0,total:expected});heartbeat();
  let productCache=null,response=null;
  if(/^FCP10/.test(el.dataset.format)&&globalThis.caches){try{productCache=await caches.open('fish-compact-products-r10');if(failed.has(id))await productCache.delete(url.href);else response=await productCache.match(url.href);}catch{productCache=null;}}
  const diskHit=!!response;
  if(diskHit)loadPhase(id,'cache',{loaded:0,total:expected});
  else response=await fetch(url,{signal:controller.signal,cache:failed.has(id)?'reload':'default'});
  if(!response.ok)throw Error('鱼体成品加载失败（'+response.status+'）');
  if(!response.body)throw Error('浏览器无法读取模型下载流');
  const reader=response.body.getReader(),bytes=new Uint8Array(expected);let loaded=0,last=-Infinity;
  while(true){const {done,value}=await reader.read();if(done)break;heartbeat();if(loaded+value.length>expected){await reader.cancel();throw Error('模型数据长度与版本不符');}bytes.set(value,loaded);loaded+=value.length;if(performance.now()-last>100||loaded===expected){loadPhase(id,diskHit?'cache':'download',{loaded,total:expected});last=performance.now();}}
  clearTimeout(timer);if(loaded!==expected)throw Error('模型没有下载完整，请重试');
  loadPhase(id,'verify',{loaded,total:expected});
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==hash){await productCache?.delete(url.href);throw Error('鱼体成品校验未通过，请重试');}
  if(productCache&&!diskHit){try{
    // Same-fish previous generations are obsolete; the immutable URL contains its hash.
    for(const key of await productCache.keys())if(key.url!==url.href&&new URL(key.url).pathname.split('/').at(-1).startsWith(id+'.'))await productCache.delete(key);
    await productCache.put(url.href,new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(expected)}}));
    let total=0;const keys=await productCache.keys();for(const key of keys){const r=await productCache.match(key);total+=Number(r.headers.get('Content-Length'))||0;}for(const key of keys){if(total<=67108864)break;if(key.url===url.href)continue;const r=await productCache.match(key);total-=Number(r.headers.get('Content-Length'))||0;await productCache.delete(key);}
  }catch{/* Browser storage denial does not block an already verified product. */}}
  failed.delete(id);return bytes;
 }catch(error){if(error.name!=='AbortError'||stalled)failed.add(id);if(stalled)throw Error('模型下载已30秒没有进展，请重试');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(active.get(id)===controller)active.delete(id);}
}
