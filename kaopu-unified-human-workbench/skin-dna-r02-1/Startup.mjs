import {createLipTransport} from './specialists/lip-startup-r03/ChunkTransport.mjs';
import {transportConfig} from './StartupConfig.mjs';
window.LIP_P3_CONFIG=transportConfig;
/* Runs before the retained inline application. No profile or unrelated cache is cleared. */
(()=>{'use strict';
 const config=window.LIP_P3_CONFIG,base=config.assetBase;
 const P=window.__LIP_STARTUP__={version:'ET19-L3-P3',base,started:performance.now(),stage:'初始化原人物',events:[],networkBytes:0,cacheBytes:0,cacheHits:0,requests:0,warnings:[]};
 const R=window.__LIP_P3__={version:'P3',started:performance.now(),ready:false,appStarted:false,paused:false,errors:[],base};
 const box=document.createElement('section');box.id='lipP3Status';box.setAttribute('role','status');
 box.innerHTML='<strong>人物总台 R04 · 耳 R06 / 唇 ET19 / P3 恢复</strong><p data-phase></p><progress data-progress max="1" value="0"></progress><p data-size></p><p data-active></p><p data-error hidden></p><p data-warning hidden></p><div><button data-pause>暂停下载</button><button data-resume hidden>继续载入（复用已完成分块）</button><button data-copy>复制诊断</button><button data-close hidden>收起</button></div><details><summary>下载方式</summary><p>原模型分为不超过1 MiB的小块。每块与完整文件均做SHA-256校验；中断只重取未完成的小块。缓存不可用时仍能加载，但跨刷新恢复可能不可用。网络一直有新数据时，不因累计90秒或150秒而中止。30秒无新数据时有限重试，最多3次。</p></details>';
 box.style.cssText='position:fixed;z-index:1000;left:16px;right:16px;top:16px;max-width:640px;padding:18px;background:#13232ff5;border:1px solid #78969c;border-radius:10px;color:#edf3f4;font:14px/1.6 system-ui;max-height:88vh;overflow:auto';
 document.body.append(box);
 const phase=box.querySelector('[data-phase]'),size=box.querySelector('[data-size]'),active=box.querySelector('[data-active]'),error=box.querySelector('[data-error]'),warning=box.querySelector('[data-warning]'),progress=box.querySelector('[data-progress]');
 const chip=document.createElement('button');chip.id='lipP3Diagnostic';chip.textContent='加载诊断 · P3';chip.hidden=true;chip.style.cssText='font:12px system-ui;padding:5px 9px;min-height:32px;margin:4px 0';document.body.append(chip);chip.onclick=()=>{box.hidden=false;chip.hidden=true;};
 const attachChip=()=>{if(R.ready&&!document.getElementById('lip19Mother')?.contains(chip)){const host=document.getElementById('lip19Mother');if(host)host.prepend(chip);}};
 const observer=new MutationObserver(attachChip);observer.observe(document.body,{childList:true,subtree:true});
 let last=0;
 function refresh(force=false){const now=performance.now();if(!force&&now-last<120)return;last=now;const s=R.transport?.stats;
  phase.textContent=(R.paused?'已暂停，已校验分块保留':R.errors.length?'本轮载入已停止':R.ready?'原人物与完整材质已就绪':P.stage)+' · '+Math.floor((now-R.started)/1000)+'秒';
  if(s){progress.value=s.verifiedBytes/Math.max(1,s.totalBytes);size.textContent='已校验 '+(s.verifiedBytes/1048576).toFixed(1)+' / '+(s.totalBytes/1048576).toFixed(1)+' MiB · 复用缓存 '+(s.cacheBytes/1048576).toFixed(1)+' MiB · 重试 '+s.retries+'次';active.textContent=Object.values(s.active).map(x=>x.label+'：'+(100*x.received/x.expected).toFixed(0)+'%').join('；')||((s.verifiedBytes>=s.totalBytes&&!R.ready)?'模型数据完成，正在装配人物与完整皮肤。':'');warning.hidden=!s.warnings.length;warning.textContent=s.warnings.join(' ');P.cacheBytes=s.cacheBytes;P.cacheHits=s.cacheHits;P.networkBytes=s.networkBytes;P.requests=s.requests;}
 }
 R.transport=createLipTransport(config.manifest,{base,notify:()=>refresh()});P.notify=()=>refresh();P.cacheSettled=()=>R.transport.settled();
 R.snapshot=()=>({version:R.version,page:location.origin+location.pathname,elapsedSeconds:+((performance.now()-R.started)/1000).toFixed(1),stage:P.stage,ready:R.ready,paused:R.paused,errors:R.errors,transport:R.transport.snapshot()});
 function stop(message,paused=false){if(R.ready||R.errors.length||R.paused)return;R.paused=paused;if(!paused)R.errors.push(String(message));R.transport.cancel(new DOMException(String(message),'AbortError'));error.hidden=false;error.textContent=String(message);box.querySelector('[data-pause]').hidden=true;box.querySelector('[data-resume]').hidden=false;box.hidden=false;refresh(true);}
 R.fail=message=>stop(message);R.pause=()=>stop('已暂停。已完成并校验的小块保留；点击继续载入时复用它们。',true);
 // The host catches loader errors itself. Report at this boundary rather than
 // relying on unhandledrejection, which would miss a correctly handled failure.
 const readVerified=R.transport.loadVerified;R.transport.loadVerified=async(...args)=>{try{return await readVerified(...args);}catch(e){R.fail(e.message);throw e;}};
 box.querySelector('[data-pause]').onclick=R.pause;box.querySelector('[data-resume]').onclick=()=>location.reload();
 box.querySelector('[data-close]').onclick=()=>{box.hidden=true;chip.hidden=false;};
 box.querySelector('[data-copy]').onclick=async()=>{const text=JSON.stringify(R.snapshot(),null,2);try{await navigator.clipboard.writeText(text);box.querySelector('[data-copy]').textContent='诊断已复制';}catch{error.hidden=false;error.textContent=text;}};
 document.addEventListener('click',e=>{if((R.errors.length||R.paused)&&e.target.closest('#load-model')){e.preventDefault();e.stopImmediatePropagation();location.reload();}},true);
 addEventListener('error',e=>{if(e.message&&!R.ready)R.fail(e.message);});addEventListener('unhandledrejection',e=>{if(!R.ready)R.fail(e.reason?.message||e.reason);});
 let settled=false;const timer=setInterval(()=>{refresh();const d=window.fullCommonWorkbench?.diagnostics?.(),v=window.__IDENTITY_QA__?.viewer?.();if(!R.paused&&!R.errors.length&&!settled&&window.lipWorkbench&&d?.ready&&!d.busy&&v?.skin?.faceExtension?.ready&&v?.skin?.naturalEyeExtension?.ready&&v.startupFinalFrame){settled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(R.paused||R.errors.length)return;R.ready=true;R.readyMS=performance.now()-R.started;box.hidden=true;attachChip();chip.hidden=false;box.querySelector('[data-pause]').hidden=true;box.querySelector('[data-close]').hidden=false;P.stage='三维已就绪';refresh(true);clearInterval(timer);}));}if(P.error)R.fail(P.error);},250);
 addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect();R.transport.cancel();},{once:true});refresh(true);
})();
