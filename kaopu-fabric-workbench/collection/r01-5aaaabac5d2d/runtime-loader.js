/* Native runtime isolation. No shader/physics replacement. AES assets unlock only in this browser. */
const te=new TextEncoder(),td=new TextDecoder();
const imports=/((?:import|export)\s+(?:[^;]*?\s+from\s*)?)(['"])([^'"\n]+)\2/g;
const VIRTUAL='https://fabric.invalid/';
export const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
export async function unlock(url,record,key,signal,onProgress){
 const response=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error('运行包请求失败：'+response.status);
 const reader=response.body.getReader(),parts=[];let n=0;
 while(true){const {done,value}=await reader.read();if(done)break;parts.push(value);n+=value.length;onProgress?.(n,record.bytes);}
 if(n!==record.bytes)throw Error('运行包长度不符，已停止加载。');
 const packed=new Uint8Array(n);let offset=0;for(const p of parts){packed.set(p,offset);offset+=p.length;}
 if(hex(await crypto.subtle.digest('SHA-256',packed))!==record.sha256)throw Error('运行包校验失败。');
 const decoded=key.replace(/-/g,'+').replace(/_/g,'/'),raw=Uint8Array.from(atob(decoded),x=>x.charCodeAt(0));
 if(raw.length!==32)throw Error('访问密钥不正确。');
 const aes=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 let gz;try{gz=await crypto.subtle.decrypt({name:'AES-GCM',iv:packed.subarray(0,12),additionalData:te.encode('KAOPU/FABRIC-COLLECTION/R01/'+record.id)},aes,packed.subarray(12));}catch{throw Error('私有运行资源未解锁，请使用完整验收链接。');}
 const bytes=new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 const length=new DataView(bytes.buffer).getUint32(0,true),table=JSON.parse(td.decode(bytes.subarray(4,4+length))),files=new Map();
 for(const row of table.files){const start=4+length+row.offset,end=start+row.bytes;if(start<4+length||end>bytes.length)throw Error('运行包目录错误。');files.set(row.path,{...row,data:bytes.subarray(start,end)});}
 return {id:record.id,files,table,byteLength:bytes.length};
}
const escapeScript=s=>s.replace(/<\/script/gi,'<\\/script');
function mime(path){return /\.(mjs|js)$/.test(path)?'text/javascript':path.endsWith('.wasm')?'application/wasm':path.endsWith('.json')?'application/json':path.endsWith('.css')?'text/css':'application/octet-stream';}
function resolve(spec,from,base){if(spec==='three')return base+'vendor/three.module.js';if(spec==='three/addons/controls/OrbitControls.js')return base+'vendor/OrbitControls.js';return new URL(spec,new URL(from,base)).href;}
export function prepareRuntime(pack,query,bridgeText){
 const base=VIRTUAL+pack.id+'/',urls=[],asset={},text=p=>{const f=pack.files.get(p);if(!f)throw Error('缺失运行文件：'+p);return td.decode(f.data);};
 const blob=(value,type)=>{const u=URL.createObjectURL(new Blob([value],{type}));urls.push(u);return u;};
 for(const [p,f]of pack.files)asset[base+p]=blob(f.data,mime(p));
 function bootstrap(a,b){return `(()=>{const assets=${JSON.stringify(a)},base=${JSON.stringify(b)},original=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url||input.href,base).href;const path=assets[u];if(path)return original(path,init);if(u.startsWith('blob:')||u.startsWith('data:'))return original(input,init);return Promise.reject(Error('未登记的原生资源：'+u));};})();`;}
 let html=text('index.html'),moduleMap={},workers={},workerStack=new Set();
 const patchCode=(code,path,mode)=>code.replace(imports,(match,begin,q,spec)=>{
  if(!spec.startsWith('.')&&spec!=='three'&&!spec.startsWith('three/addons/'))return match;
  const full=resolve(spec,path,base),target=full.slice(base.length);
  return begin+q+(mode==='worker'?workerModule(target):full)+q;
 }).replaceAll('import.meta.url',JSON.stringify(base+path)).replace(/\blocation\.search\b/g,'(globalThis.__FABRIC_QUERY__ || "")');
 function workerModule(path){
  if(workers[path])return workers[path];if(workerStack.has(path))throw Error('原生 Worker 出现未支持的循环依赖：'+path);
  workerStack.add(path);let s=patchCode(text(path),path,'worker');
  if(path==='src/physics-worker.mjs')s=bootstrap(asset,base+'src/')+'\n'+s;
  const u=blob(s,'text/javascript');workers[path]=u;workerStack.delete(path);return u;
 }
 if(pack.id==='raywave'){
  for(const p of pack.files.keys())if(/\.(mjs|js)$/.test(p)&&p!=='eb1.js')moduleMap[base+p]=blob(patchCode(text(p),p,'main'),'text/javascript');
  workerModule('src/physics-worker.mjs');
  html=html.replace(/<script\s+type="importmap">[\s\S]*?<\/script>/,'<script type="importmap">'+JSON.stringify({imports:moduleMap})+'</script>');
  html=html.replace('<script type="module" src="./src/app.mjs"></script>','<script type="module">import '+JSON.stringify(base+'src/app.mjs')+';</script>');
  html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+text('style.css')+'</style>');
  html=html.replace('<script src="./eb1.js"></script>','<script>'+escapeScript(text('eb1.js'))+'</script>');
 }
 const workerAlias={};if(pack.id==='raywave')workerAlias[base+'src/physics-worker.mjs']=workers['src/physics-worker.mjs'];
 const lifecycle=`(()=>{const original=window.Worker,active=new Set(),alias=${JSON.stringify(workerAlias)};window.Worker=class extends original{constructor(url,options){const resolved=new URL(String(url),${JSON.stringify(base)}).href;super(alias[resolved]||url,options);active.add(this);}terminate(){active.delete(this);return super.terminate();}};window.__FABRIC_LIFECYCLE__={count:()=>active.size,dispose:()=>{for(const w of active)w.terminate();active.clear();}};})();`;
 const before='<meta name="referrer" content="no-referrer"><script>'+escapeScript('globalThis.__FABRIC_BOOT_ERRORS__=[];addEventListener("error",e=>__FABRIC_BOOT_ERRORS__.push(e.message));addEventListener("unhandledrejection",e=>__FABRIC_BOOT_ERRORS__.push(String(e.reason)));globalThis.__FABRIC_QUERY__='+JSON.stringify(query)+';'+bootstrap(asset,base)+lifecycle)+'</script>';
 html=html.replace('<head>','<head>'+before);
 if(pack.id==='legacy')html=html.replace(/\blocation\.search\b/g,'(globalThis.__FABRIC_QUERY__ || "")');
 html=html.replace('</body>','<script>'+escapeScript(bridgeText)+'</script></body>');
 return {html,dispose(){for(const u of urls)URL.revokeObjectURL(u);urls.length=0;},assetCount:pack.files.size};
}
