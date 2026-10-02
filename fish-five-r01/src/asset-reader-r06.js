// Online mirror reads only selected, content-addressed source bytes. Standalone
// uses its inline carriers. Neither path changes any source sample or pixel.
const active = new Map(),failed = new Set();
export function loadPhase(id,phase,detail={}){
 document.dispatchEvent(new CustomEvent('fish-load-progress',{detail:{id,phase,...detail}}));
}
export function cancelPendingAssets(keepId){
 for(const [id,controller] of active)if(id!==keepId)controller.abort();
}
export async function readCarrierBytes(el,id){
 if(!el)throw Error('原模型数据未找到');
 if(!el.dataset.url){const binary=atob(el.textContent.trim()),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
 const url=new URL(el.dataset.url,document.baseURI);
 if(url.origin!==location.origin)throw Error('原模型数据地址不属于当前网站');
 const expected=Number(el.dataset.bytes),hash=el.dataset.sha256;
 if(!Number.isSafeInteger(expected)||expected<=0||!/^[0-9a-f]{64}$/.test(hash||''))throw Error('原模型完整性记录缺失');
 const controller=new AbortController();active.set(id,controller);
 let timer,stalled=false;const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>{stalled=true;controller.abort();},30000);};
 try{
  loadPhase(id,'download',{loaded:0,total:expected});heartbeat();
  const response=await fetch(url,{signal:controller.signal,cache:failed.has(id)?'reload':'default'});
  if(!response.ok)throw Error('原模型下载失败（'+response.status+'）');
  if(!response.body)throw Error('浏览器无法读取模型下载流');
  const reader=response.body.getReader(),bytes=new Uint8Array(expected);let loaded=0,last=-Infinity;
  while(true){const {done,value}=await reader.read();if(done)break;heartbeat();if(loaded+value.length>expected){await reader.cancel();throw Error('模型数据长度与版本不符');}bytes.set(value,loaded);loaded+=value.length;if(performance.now()-last>100||loaded===expected){loadPhase(id,'download',{loaded,total:expected});last=performance.now();}}
  clearTimeout(timer);if(loaded!==expected)throw Error('模型没有下载完整，请重试');
  loadPhase(id,'verify',{loaded,total:expected});
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==hash)throw Error('模型校验未通过，请重新下载');
  failed.delete(id);return bytes;
 }catch(error){if(error.name!=='AbortError'||stalled)failed.add(id);if(stalled)throw Error('模型下载已30秒没有进展，请重试');throw error;}
 finally{clearTimeout(timer);if(active.get(id)===controller)active.delete(id);}
}
