// Application-owned lifecycle; pinned Three, appearance and GPU formats are unchanged.
export function createGraphicsLifecycle({THREE, build, suspend, fail, success, progress}) {
  let renderer=null, canvas=null, controller=null, flight=null, wanted=false;
  let hidden=!!document.hidden, stopped=false, phase='idle', attempts=0, recoveries=0, losses=0;
  let timer=0, autoLossBudget=2, lastError=null;
  const history=[];
  const record=(event,detail={})=>{history.push({event,...detail});if(history.length>30)history.shift();};
  function cancelled(){return new DOMException('Graphics session interrupted','AbortError');}
  function freshCanvas(){
    const old=document.getElementById('canvas'),next=old.cloneNode(false);
    // A failed Three constructor can leave internal listeners on the old canvas.
    old.replaceWith(next);return next;
  }
  function release(){
    controller?.abort();
    suspend();
    if(canvas){canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);}
    const old=renderer;renderer=null;
    if(old){try{old.dispose();}catch{}try{old.forceContextLoss();}catch{}}
    if(canvas){canvas.width=1;canvas.height=1;canvas=null;}
  }
  function lost(event){
    event.preventDefault();losses++;record('context-lost');
    phase='suspended';release();
    const error=Object.assign(new Error('WebGL context lost'),{graphics:true,code:'context-lost'});
    lastError={code:error.code,message:error.message};fail(error);
    if(!hidden&&!stopped&&autoLossBudget>0){autoLossBudget--;schedule();}
  }
  function restored(){if(!hidden&&!stopped)schedule();}
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>start(),300);}
  async function createRenderer(signal){
    let error;
    for(let i=0;i<2;i++){
      if(signal.aborted||hidden||stopped)throw cancelled();
      canvas=freshCanvas();attempts++;
      // Match Three r170's original context attributes, including physical alpha.
      let gl;
      try{
        gl=canvas.getContext('webgl2',{alpha:true,depth:true,stencil:false,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance',failIfMajorPerformanceCaveat:false});
        if(!gl||gl.isContextLost())throw Error('WebGL2 context unavailable');
        for(const shader of [gl.VERTEX_SHADER,gl.FRAGMENT_SHADER])for(const level of [gl.HIGH_FLOAT,gl.MEDIUM_FLOAT]){
          const value=gl.getShaderPrecisionFormat(shader,level);
          if(!value||!Number.isFinite(value.precision))throw Error('WebGL precision query unavailable');
        }
        if(gl.isContextLost())throw Error('WebGL context lost during precision query');
        // Do not pass `context`: that changes Three's background alpha semantics.
        const result=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
        if(gl.isContextLost()){result.dispose();throw Error('WebGL context lost during renderer creation');}
        canvas.addEventListener('webglcontextlost',lost);
        canvas.addEventListener('webglcontextrestored',restored);
        record('renderer-created',{attempt:attempts});return result;
      }catch(e){
        error=Object.assign(e,{graphics:true,code:'graphics-init'});
        record('renderer-rejected',{message:String(e.message||e)});
        // No renderer reference exists after a constructor throw. Release raw GL.
        try{gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
        canvas.width=1;canvas.height=1;
        if(i===0)await new Promise(resolve=>setTimeout(resolve,250));
      }
    }
    throw error;
  }
  async function run(){
    controller=new AbortController();const signal=controller.signal;
    const check=()=>{if(signal.aborted||hidden||stopped)throw cancelled();if(renderer?.getContext().isContextLost())throw Object.assign(new Error('WebGL context lost during initialization'),{graphics:true,code:'context-lost'});};
    phase='starting';progress();
    try{
      renderer=await createRenderer(signal);check();
      await build({renderer,signal,check});check();
      phase='ready';recoveries++;lastError=null;record('ready');success();
    }catch(e){
      const interrupted=signal.aborted||e.name==='AbortError';
      release();
      if(!interrupted){phase='error';lastError={code:e.code||'asset-or-scene',message:String(e.message||e)};record('failed',lastError);fail(e);if(e.code==='context-lost'&&!hidden&&!stopped&&autoLossBudget>0){autoLossBudget--;schedule();}}
    }
  }
  function start(){
    if(stopped||hidden)return flight||Promise.resolve();
    if(flight){if(controller?.signal.aborted)wanted=true;return flight;}
    if(phase==='ready')return Promise.resolve();
    wanted=false;
    flight=run().finally(()=>{flight=null;if(wanted&&!hidden&&!stopped){wanted=false;start();}});
    return flight;
  }
  function retry(){if(stopped)return Promise.resolve();autoLossBudget=2;return start();}
  function pagehide(){hidden=true;wanted=false;clearTimeout(timer);phase='suspended';record('pagehide');release();}
  function pageshow(){hidden=false;record('pageshow');start();}
  function visibility(){if(document.hidden)pagehide();else pageshow();}
  addEventListener('pagehide',pagehide);addEventListener('pageshow',pageshow);
  document.addEventListener('visibilitychange',visibility);
  return {start,retry,get usable(){return !!renderer&&!hidden&&!stopped&&!renderer.getContext().isContextLost();},
    diagnostics(){return {phase,attempts,recoveries,losses,lastError,autoLossBudget,activeContexts:renderer?1:0,history:[...history]};},
    dispose(){stopped=true;wanted=false;clearTimeout(timer);phase='disposed';release();removeEventListener('pagehide',pagehide);removeEventListener('pageshow',pageshow);document.removeEventListener('visibilitychange',visibility);}};
}

export function showGraphicsFailure(error,{container,loading,status,retry}){
  loading.hidden=true;container.hidden=false;container.replaceChildren();
  const title=document.createElement('h2'),text=document.createElement('p'),button=document.createElement('button');
  title.textContent=error.graphics?'三维画面暂时无法启动':'人物数据暂未载入';
  text.textContent=error.graphics?'浏览器未提供可用的图形环境。可点重试；若仍失败，请关闭其他三维页面后重试。':'下载或校验尚未完成，请检查网络后重试。';
  button.id='graphicsRetry';button.textContent='重试三维画面';button.type='button';button.onclick=retry;
  container.append(title,text,button);status.textContent=error.graphics?'图形初始化／恢复未完成':'人物数据载入未完成';
}
