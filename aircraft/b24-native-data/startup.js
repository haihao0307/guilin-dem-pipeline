/* Classic-script supervisor. It can display errors even when a module import fails. */
(() => {
  'use strict';
  const revision='20260905-native-r1',start=performance.now(),root=new AbortController();
  let settled=false,lastTransfer=start,lastBytes=0,phase='module',snapshot={};
  window.__B24_BOOTSTRAP_MANAGED__=true;
  const state={revision,status:'loading',phase,startedAt:new Date().toISOString(),signal:root.signal};
  window.__B24_STARTUP__=state;
  const $=id=>document.getElementById(id);
  function terminal(error){
    if(settled)return;settled=true;clearInterval(heartbeat);clearTimeout(overall);
    root.abort(error);state.status='failed';state.error={code:error.code||'STARTUP_ERROR',message:String(error.message||error)};
    const api=window.__B24_WORKBENCH__;if(api){api.ready=false;api.mission?.pause?.();if(api.mission)api.mission.running=false;}
    $('loading').classList.remove('hidden');$('loadText').textContent='加载未完成，已停止等待';
    $('loadDetail').textContent=(error.message||String(error))+'。已校验完成的分段会保留，重新连接可继续使用。';
    $('loadActions').hidden=false;$('status').textContent='加载中断';$('loadDiagnostic').textContent=state.error.code+' · '+revision;
    $('loadRetry').disabled=false;
  }
  window.__B24_SHOW_LOAD_ERROR__=terminal;
  state.report=data=>{
    if(settled)return;snapshot={...snapshot,...data};state.phase=data.stage||state.phase;Object.assign(state,snapshot);
    if((data.receivedBytes||0)!==lastBytes){lastBytes=data.receivedBytes||0;lastTransfer=performance.now();}
    renderDetail();
  };
  function renderDetail(){
    if(settled)return;const age=Math.floor((performance.now()-start)/1000),s=snapshot;
    if(s.totalBytes){
      const mb=v=>(v/1048576).toFixed(2),waiting=Math.floor((performance.now()-lastTransfer)/1000);
      $('loadDetail').textContent=`已接收 ${mb(s.receivedBytes||0)} / ${mb(s.totalBytes)} MB · 校验 ${s.completedParts||0}/${s.totalParts} 段 · ${age} 秒`+
       (s.cachedParts?` · 复用 ${s.cachedParts} 段`:'')+(s.stage==='retry'?` · 正在第 ${s.nextAttempt} 次连接`:(s.stage==='download'&&waiting>=3?` · 等待响应 ${waiting} 秒`:''));
    }else $('loadDetail').textContent='连接三维程序 · '+age+' 秒';
  }
  const heartbeat=setInterval(renderDetail,1000);
  const overall=setTimeout(()=>terminal(Object.assign(new Error('启动超过 10 分钟，已终止本次连接'),{code:'STARTUP_TIMEOUT'})),600000);
  $('loadRetry').onclick=()=>{const u=new URL(location.href);u.searchParams.set('boot',revision);u.searchParams.set('retry',Date.now().toString());location.replace(u.href);};
  $('loadCopy').onclick=async()=>{
    const copy={revision,status:state.status,phase:state.phase,error:state.error,receivedBytes:state.receivedBytes,
      verifiedBytes:state.verifiedBytes,totalBytes:state.totalBytes,completedParts:state.completedParts,totalParts:state.totalParts,retries:state.retries,file:state.file};
    const text=JSON.stringify(copy,null,2);try{await navigator.clipboard.writeText(text);$('loadCopy').textContent='诊断已复制';}
    catch{$('loadDiagnostic').textContent=text;}
  };
  function deadline(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(label+'超时'),{code:'MODULE_TIMEOUT'})),ms);})]).finally(()=>clearTimeout(timer));}
  (async()=>{
    try{
      const app=await deadline(import('./app.js?boot='+revision),30000,'三维程序连接');if(settled)return;
      await app.main();if(settled)return;
      state.phase='effects';$('loadText').textContent='加载本轮显示效果';
      const effects=await deadline(import('./production-effects.js?boot='+revision),30000,'显示模块连接');if(settled)return;
      effects.install(window.__B24_WORKBENCH__);
      const api=window.__B24_WORKBENCH__,epoch=api.frameCount;
      await deadline(new Promise(resolve=>{const next=()=>{if(settled||api.frameCount>epoch)resolve();else requestAnimationFrame(next);};next();}),30000,'首帧绘制');
      if(settled)return;settled=true;clearInterval(heartbeat);clearTimeout(overall);
      state.status='ready';state.phase='ready';state.elapsedMs=performance.now()-start;state.signal=null;
      document.body.dataset.loaderRevision=revision;$('loading').classList.add('hidden');$('loadText').textContent='工作台就绪';
      $('play').disabled=false;$('reset').disabled=false;
    }catch(error){terminal(error);}
  })();
})();
