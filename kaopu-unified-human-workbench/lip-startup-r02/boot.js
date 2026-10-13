/* P2 uses ordinary same-origin JS, never HTMLPreview, .js.gz or Blob execution.
 * Only this page's resource requests are wrapped. No account/profile storage is cleared. */
(()=>{'use strict';
const config=window.LIP_P2_CONFIG,base=new URL('.',location.href).href;
const P=window.__LIP_STARTUP__={version:'ET19-L3-P2',base,started:performance.now(),stage:'载入人物程序',events:[],networkBytes:0,cacheBytes:0,cacheHits:0,requests:0,warnings:[]};
const R=window.__LIP_P2__={version:'P2',mode:config.mode,started:performance.now(),receivedBytes:0,requests:0,retries:0,ready:false,errors:[],active:new Set()};
const box=document.createElement('section');box.id='lipP2Status';box.setAttribute('role','status');box.innerHTML='<strong>正在打开唇部工作台</strong><p data-phase></p><p data-size></p><p data-error hidden></p><div><button data-retry hidden>重新载入</button><a data-compat>内置程序方式打开</a><button data-copy>复制诊断</button></div>';
box.style.cssText='position:fixed;z-index:1000;left:16px;right:16px;top:16px;max-width:620px;padding:18px;background:#13232ff5;border:1px solid #78969c;border-radius:10px;color:#edf3f4;font:14px/1.6 system-ui';document.body.append(box);
const phase=box.querySelector('[data-phase]'),size=box.querySelector('[data-size]'),err=box.querySelector('[data-error]'),retry=box.querySelector('[data-retry]'),compat=box.querySelector('[data-compat]');compat.href=new URL('compat.html',base).href;
R.snapshot=()=>({version:R.version,mode:R.mode,page:location.href,elapsedSeconds:+((performance.now()-R.started)/1000).toFixed(1),stage:P.stage,ready:R.ready,receivedBytes:R.receivedBytes,modelCacheHits:P.cacheHits,active:Array.from(R.active),errors:R.errors});
box.querySelector('[data-copy]').onclick=async()=>{const text=JSON.stringify(R.snapshot(),null,2);try{await navigator.clipboard.writeText(text);box.querySelector('[data-copy]').textContent='已复制诊断';}catch{err.hidden=false;err.textContent=text;}};retry.onclick=()=>location.reload();
const fail=(message)=>{if(R.ready)return;message=String(message);if(!R.errors.includes(message))R.errors.push(message);err.hidden=false;err.textContent='未能完成载入：'+message;retry.hidden=false;box.hidden=false;};R.fail=fail;
R.programFailed=()=>{if(config.mode==='external'&&!R.fallingBack){R.fallingBack=true;phase.textContent='程序文件未能载入，自动切换内置程序入口…';location.replace(new URL('compat.html',base).href);}else fail('人物程序无法执行。可重新载入，人物档案未清除。');};
P.notify=()=>{phase.textContent=(R.appStarted?P.stage:'正在载入程序文件；尚未开始模型下载')+' · '+Math.floor((performance.now()-R.started)/1000)+' 秒';size.textContent=R.appStarted?'已读取资源 '+(R.receivedBytes/1048576).toFixed(1)+' MiB · 已复用模型缓存 '+(P.cacheBytes/1048576).toFixed(1)+' MiB':'程序采用普通网页脚本载入，不再使用压缩程序中转。';};P.notify();
// Bound stalled headers and stalled body reads; retry one HTTP/connection error.
// Keep all original asset digest checks and original caller AbortSignals intact.
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,options={})=>{
 const u=new URL(input instanceof Request?input.url:String(input),location.href);
 if(u.origin!==location.origin||!u.href.startsWith(base))return nativeFetch(input,options);
 const label=u.pathname.split('/').pop(),caller=options.signal||(input instanceof Request?input.signal:null);
 for(let attempt=0;attempt<2;attempt++){
  if(caller?.aborted)throw caller.reason||new DOMException('Cancelled','AbortError');
  const ctrl=new AbortController;let timer;const cancel=()=>ctrl.abort(caller.reason),arm=()=>{clearTimeout(timer);timer=setTimeout(()=>ctrl.abort(new DOMException('资源无响应超过15秒：'+label,'TimeoutError')),15000);};caller?.addEventListener('abort',cancel,{once:true});
  const cleanup=()=>{clearTimeout(timer);caller?.removeEventListener('abort',cancel);R.active.delete(label);};
  R.requests++;R.active.add(label);arm();
  try{
   const response=await nativeFetch(input,{...options,signal:ctrl.signal,...(attempt?{cache:'reload'}:{})});
   if(!response.ok){await response.body?.cancel();throw Error(label+' · HTTP '+response.status);}
   if(!response.body){cleanup();return response;}
   const reader=response.body.getReader();
   const stream=new ReadableStream({async pull(c){try{arm();const {done,value}=await reader.read();if(done){cleanup();c.close();return;}R.receivedBytes+=value.byteLength;c.enqueue(value);}catch(e){cleanup();fail(label+' · '+e.message);c.error(e);}},async cancel(reason){cleanup();await reader.cancel(reason);}});
   return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(e){cleanup();if(caller?.aborted)throw e;if(attempt===0){R.retries++;P.stage='资源重试：'+label;await new Promise(r=>setTimeout(r,500));continue;}fail(e.message);throw e;}
 }
};
addEventListener('error',e=>{if(e.message)fail(e.message);},false);addEventListener('unhandledrejection',e=>fail(e.reason?.message||e.reason));
let settled=false;const tick=setInterval(()=>{
 P.notify();if(config.mode==='external'&&!R.appStarted&&performance.now()-R.started>20000){R.programFailed();return;}
 const d=window.fullCommonWorkbench?.diagnostics?.(),v=window.__IDENTITY_QA__?.viewer?.();
 if(!settled&&window.lipWorkbench&&d?.ready&&!d.busy&&v?.skin?.faceExtension?.ready&&v?.skin?.naturalEyeExtension?.ready&&v.startupFinalFrame){settled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{R.ready=true;R.readyMS=performance.now()-R.started;box.hidden=true;clearInterval(tick);}));}
 if(P.error)fail(P.error);
 if(!R.ready&&performance.now()-R.started>150000){fail('超过150秒仍未完成。请查看本框中的资源或错误信息后重试。');clearInterval(tick);}
},250);
addEventListener('pagehide',()=>clearInterval(tick),{once:true});
})();
