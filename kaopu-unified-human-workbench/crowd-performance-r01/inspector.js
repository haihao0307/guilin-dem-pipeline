(async function () {
  'use strict';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const root = document.createElement('section');
  root.id = 'crowd-perf-inspector';
  root.style.cssText = 'position:fixed;z-index:99999;left:12px;top:68px;width:300px;max-height:75vh;overflow:auto;background:#fffef4ee;color:#192c29;border:1px solid #77948b;border-radius:12px;padding:14px;font:13px/1.5 system-ui;box-shadow:0 4px 18px #0002';
  root.innerHTML = '<strong>人物整合 · 原生负载初筛 R01</strong><p>此页测完整 P01＋F13 密发与已接入物理。衣服和鞋尚未接入此页；结果不能代表完整 NPC。</p><p id="cp-status">正在等待原生人物和发丝…</p><button id="cp-run" disabled>测身体＋头发 120 帧</button> <button id="cp-stop">停止</button><details><summary>测量结果</summary><pre id="cp-result" style="white-space:pre-wrap;word-break:break-word;font-size:11px">尚未执行</pre></details>';
  document.body.append(root);
  const out = document.getElementById('cp-result'), status = document.getElementById('cp-status');
  const result = {version:'CHARACTER-CROWD-PERF-R01',scope:'native-single-body-hair-component',sourceRuntimeSHA256:'cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790',clothes:false,shoes:false,crowd:false,fullIntegrationMeasured:false,errors:[]};
  let stop = false, running = false;
  const summary = values => { const a = values.slice().sort((x,y)=>x-y); return a.length ? {samples:a.length,mean:a.reduce((s,x)=>s+x,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)],min:a[0],max:a[a.length-1]} : null; };
  const publish = () => { if(!root.isConnected)document.body.append(root); out.textContent = JSON.stringify(result,null,2); document.documentElement.dataset.performanceProbe=result.version; };
  document.getElementById('cp-stop').onclick=()=>{stop=true;};
  try {
    const start=performance.now();
    while(!window.hairF13?.report().ready){if(performance.now()-start>360000)throw Error('原生F13启动超过360秒');await wait(200);}
    const native=window.hairF13._raw(),v=native.viewer,gl=v.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    result.environment={userAgent:navigator.userAgent,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,glVersion:gl.getParameter(gl.VERSION),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],dpr:devicePixelRatio,visibility:document.visibilityState};
    result.initial=window.hairF13.report();
    result.geometry={bodyVertices:v.geometry.attributes.position.count,bodyTriangles:v.geometry.index.count/3,hairInstances:native.fibers.count,hairTrianglesPerPass:native.fibers.count*96,hairPathTextureBytes:native.fibers.pathTexture.image.data.byteLength};
    result.ready=true;publish();status.textContent='原生人物与全部发丝已就绪；点按钮执行定步长测量。';document.getElementById('cp-run').disabled=false;
    document.getElementById('cp-run').onclick=async()=>{
      if(running)return;running=true;stop=false;document.getElementById('cp-run').disabled=true;
      const previousReset=v.renderer.info.autoReset,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[],gpu=[];
      let gpuDisjoint=false,activeQuery=null;
      const collectGPU=()=>{if(!ext)return;if(gl.getParameter(ext.GPU_DISJOINT_EXT))gpuDisjoint=true;for(let j=pending.length-1;j>=0;j--){const q=pending[j];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(j,1);}}};
      const frameTimes=[],cpu=[],calls=[],triangles=[];
      try {
        status.textContent='准备原生走路和头发求解器…';
        window.hairF13.setManual(true);await window.hairF13.setMotion('walk');window.hairF13.setSpeed(1);window.hairF13.setPhysics(true);window.hairF13.setView('body');
        v.renderer.info.autoReset=false;
        const initial=window.hairF13.report(),first=performance.now();let last=null,measuredStart=null,measuredSimStart=null,completed=0,warmed=0,warm=20;
        for(let i=0;i<warm+120&&!stop;i++){
          const timestamp=await new Promise(requestAnimationFrame);if(document.visibilityState!=='visible')throw Error('页面进入后台，测量停止');
          if(i===warm){measuredStart=timestamp;last=timestamp;measuredSimStart=native.motion.time;}
          if(i>warm){frameTimes.push(timestamp-last);last=timestamp;}
          collectGPU();
          const q=ext?gl.createQuery():null;v.renderer.info.reset();if(q){gl.beginQuery(ext.TIME_ELAPSED_EXT,q);activeQuery=q;}
          const t=performance.now();await window.hairF13._stepNoReport(1/60);const ms=performance.now()-t;if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);activeQuery=null;if(i>=warm)pending.push(q);else gl.deleteQuery(q);}
          if(i>=warm){cpu.push(ms);calls.push(v.renderer.info.render.calls);triangles.push(v.renderer.info.render.triangles);completed++;}else warmed++;
          if(i%10===0)status.textContent='定步长测量 '+Math.max(0,i-warm+1)+'/120；所有原生显示发丝保留。';
        }
        const ended=performance.now(),final=window.hairF13.report();
        status.textContent='采样完成，等待异步 GPU 查询…';
        while(pending.length&&performance.now()-ended<15000){await new Promise(requestAnimationFrame);collectGPU();}
        result.run={utc:new Date().toISOString(),requestedSamples:120,requestedWarmupFrames:20,warmupFrames:warmed,completed,cancelled:stop,dt:1/60,wallSeconds:(ended-first)/1000,measuredWallSeconds:measuredStart?(ended-measuredStart)/1000:null,totalSimulationSeconds:final.motionReport.time-initial.motionReport.time,measuredSimulationSeconds:measuredSimStart!==null?final.motionReport.time-measuredSimStart:0,requestedTotalSimulationSeconds:(warmed+completed)/60,frameIntervalMS:summary(frameTimes),cpuUpdateAndSubmitMS:summary(cpu),gpuMS:ext&&!gpuDisjoint&&!pending.length&&gpu.length===completed?summary(gpu):null,gpuQuerySupported:!!ext,gpuSamples:gpu.length,gpuPending:pending.length,gpuDisjoint,totalDrawCalls:summary(calls),submittedTriangles:summary(triangles),initial,final,notes:['fixed 1/60 simulation step; total simulation time includes warmup and measured simulation time excludes it','CPU includes original update and rendering submission with report/snapshot removed from each step; it is not GPU execution time','the no-report probe step preserves the original update/render/frame-increment order; diagnostic reports run before and after timing','all native rendering passes counted with autoReset=false','GPU summary is null if disjoint or any measured query is incomplete; query drain time is excluded from wall time','single body/hair baseline only; no clothing, shoes, crowd, world geometry or behavior AI']};
        status.textContent=stop?'已停止，保留实际完成的样本。':'测量完成。单人结果不外推多人帧率。';publish();
      }catch(e){result.errors.push(String(e.stack||e));status.textContent='测量未完成：'+e.message;publish();}
      finally{if(activeQuery){try{gl.endQuery(ext.TIME_ELAPSED_EXT);}catch{}gl.deleteQuery(activeQuery);}for(const q of pending)gl.deleteQuery(q);v.renderer.info.autoReset=previousReset;window.hairF13.setManual(false);window.hairF13.pause(true);running=false;document.getElementById('cp-run').disabled=false;}
    };
  }catch(e){result.errors.push(String(e.stack||e));status.textContent='初筛尚未就绪：'+e.message;publish();}
})();
