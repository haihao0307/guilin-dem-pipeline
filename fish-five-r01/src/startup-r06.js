// Runs before large inline/offline carriers and before the 3D bundle. The small
// online entry shows real source thumbnails, real download bytes and failures.
(()=>{
 const $=id=>document.getElementById(id),labels={barracuda:'海狼鱼',herring:'鲱鱼','tuna-yellow-label':'黄鳍标签金枪鱼','tuna-blue-label':'蓝鳍标签金枪鱼',colorful:'彩色珊瑚鱼',picasso:'毕加索标签鱼'};
 const boot=globalThis.__FISH_BOOT__={requested:'barracuda',phase:'shell',timeline:[{phase:'shell',at:performance.now()}],lastProgress:null};
 function mark(phase){boot.phase=phase;boot.timeline.push({phase,at:performance.now()});$('loading').dataset.phase=phase;}
 boot.start=id=>{boot.requested=id;boot.lastProgress=null;mark('starting');$('loadingRetry').hidden=true;$('loadingProgress').hidden=true;$('loading').classList.remove('failed');$('loadingText').textContent='准备加载 '+labels[id]+'…';};
 boot.fail=error=>{mark('failed');$('loading').classList.remove('done');$('loading').classList.add('failed');$('loadingRetry').hidden=false;$('loadingProgress').hidden=true;const message=String(error?.message||error||'启动失败');$('loadingText').textContent=/webgl|context|gpu/i.test(message)?'浏览器暂时无法启动三维绘制，请重新加载页面。':'加载未完成：'+message;};
 boot.ready=()=>{mark('ready');$('loadingRetry').hidden=true;$('loadingProgress').hidden=true;};
 document.addEventListener('fish-load-progress',({detail:d})=>{if(d.id!==boot.requested)return;boot.lastProgress=d;if(boot.phase!==d.phase)mark(d.phase);const label=labels[d.id]||'当前鱼型';if(d.phase==='download'){$('loadingProgress').hidden=false;$('loadingProgress').max=d.total;$('loadingProgress').value=d.loaded;$('loadingText').textContent=label+' · 正在下载原模型 '+(d.loaded/1048576).toFixed(1)+' / '+(d.total/1048576).toFixed(1)+' MB（'+Math.floor(d.loaded/d.total*100)+'%）';}else{$('loadingProgress').hidden=true;$('loadingText').textContent=label+' · '+({verify:'正在校验完整模型…',decode:'正在读取原表面与纹理…',prepare:'正在启动鱼体、材质与动画…'})[d.phase];}});
 $('loadingText').textContent='正在加载交互程序；随后只读取所选鱼型。';
 $('fishList').addEventListener('click',event=>{if(globalThis.__FIVE_FISH__)return;const button=event.target.closest('[data-fish]');if(button){boot.requested=button.dataset.fish;$('loadingText').textContent='准备 '+labels[boot.requested]+'；正在加载交互程序…';}});
 $('loadingRetry').onclick=()=>{const api=globalThis.__FIVE_FISH__;if(api?.retry)api.retry();else location.reload();};
 addEventListener('error',event=>{if(event.error)boot.fail(event.error);});
 addEventListener('unhandledrejection',event=>boot.fail(event.reason));
})();
