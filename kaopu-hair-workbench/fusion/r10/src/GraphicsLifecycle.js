// Application-owned lifecycle; pinned Three, appearance and GPU formats are unchanged.
export function createGraphicsLifecycle({THREE, build, suspend, fail, success, progress}) {
  let renderer=null, canvas=null, controller=null, flight=null, wanted=false;
  let hidden=!!document.hidden, stopped=false, phase='idle', attempts=0, recoveries=0, losses=0;
  let timer=0, autoLossBudget=2, lastError=null, stage='idle';
  const history=[];
  const record=(event,detail={})=>{history.push({event,...detail});if(history.length>30)history.shift();};
  const mark=(next,detail={})=>{stage=next;record('stage',{stage,...detail});};
  const graphicsError=(message,code)=>Object.assign(new Error(message),{graphics:true,code,stage});
  function cancelled(){return new DOMException('Graphics session interrupted','AbortError');}
  function freshCanvas(){
    const old=document.getElementById('canvas'),next=old.cloneNode(false);
    // A failed Three constructor can leave internal listeners on the old canvas.
    next.width=1;next.height=1;old.replaceWith(next);return next;
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
    const failedAt=phase==='ready'?'running':stage;
    event.preventDefault();losses++;record('context-lost',{stage:failedAt});
    phase='suspended';release();
    const error=graphicsError('WebGL context lost','context-lost');error.stage=failedAt;
    lastError={code:error.code,stage:error.stage,message:error.message};fail(error);
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
      let gl,creationMessage='';
      const creationError=event=>{creationMessage=event.statusMessage||'';record('context-creation-error',{message:creationMessage});};
      canvas.addEventListener('webglcontextcreationerror',creationError);
      try{
        mark('context-request',{attempt:attempts,width:canvas.width,height:canvas.height});
        gl=canvas.getContext('webgl2',{alpha:true,depth:true,stencil:false,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance',failIfMajorPerformanceCaveat:false});
        if(!gl)throw graphicsError(creationMessage||'WebGL2 context request returned null','context-unavailable');
        if(gl.isContextLost())throw graphicsError('WebGL2 context was already lost','context-already-lost');
        const precision=(shader,level,label)=>{
          mark('precision-'+label);
          const value=gl.getShaderPrecisionFormat(shader,level);
          const contextLost=gl.isContextLost();
          record('precision-result',{shader:label,value:value?{precision:value.precision,rangeMin:value.rangeMin,rangeMax:value.rangeMax}:null,lost:contextLost});
          if(contextLost)throw graphicsError('WebGL context lost during precision query: '+label,'precision-context-lost');
          if(!value||!Number.isFinite(value.precision))throw graphicsError('WebGL precision query returned no result: '+label,'precision-unavailable');
          return value.precision>0;
        };
        // Follow the same short-circuit capability path as pinned Three r170.
        // A supported highp path does not need any mediump probe.
        const high=precision(gl.VERTEX_SHADER,gl.HIGH_FLOAT,'vertex-high')&&precision(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT,'fragment-high');
        if(!high)precision(gl.VERTEX_SHADER,gl.MEDIUM_FLOAT,'vertex-medium')&&precision(gl.FRAGMENT_SHADER,gl.MEDIUM_FLOAT,'fragment-medium');
        if(gl.isContextLost())throw graphicsError('WebGL context lost during precision query','precision-context-lost');
        mark('three-constructor');
        // Do not pass `context`: that changes Three's background alpha semantics.
        const result=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
        if(gl.isContextLost()){result.dispose();throw graphicsError('WebGL context lost during renderer creation','renderer-context-lost');}
        canvas.removeEventListener('webglcontextcreationerror',creationError);
        canvas.addEventListener('webglcontextlost',lost);
        canvas.addEventListener('webglcontextrestored',restored);
        record('renderer-created',{attempt:attempts});return result;
      }catch(e){
        // DOMException.code is read-only; copy native failures instead of mutating them.
        const code=e.graphics&&typeof e.code==='string'?e.code:(stage==='context-request'?'context-request-error':stage.startsWith('precision-')?'precision-query-error':'renderer-constructor');
        error=Object.assign(new Error(String(e.message||e)),{graphics:true,code,stage:e.stage||stage,nativeName:e.name||'Error'});
        canvas.removeEventListener('webglcontextcreationerror',creationError);
        record('renderer-rejected',{code:error.code,stage:error.stage,message:String(e.message||e)});
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
    const check=()=>{if(signal.aborted||hidden||stopped)throw cancelled();if(renderer?.getContext().isContextLost())throw graphicsError('WebGL context lost during initialization','context-lost');};
    phase='starting';progress();
    try{
      renderer=await createRenderer(signal);check();
      mark('application-build');await build({renderer,signal,check,mark});check();
      phase='ready';recoveries++;lastError=null;record('ready');success();
    }catch(e){
      const interrupted=signal.aborted||e.name==='AbortError';
      release();
      if(!interrupted){e.stage=e.stage||stage;phase='error';lastError={code:e.code||'asset-or-scene',stage:e.stage||stage,message:String(e.message||e)};record('failed',lastError);fail(e);if(e.code==='context-lost'&&!hidden&&!stopped&&autoLossBudget>0){autoLossBudget--;schedule();}}
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
    diagnostics(){return {phase,stage,attempts,recoveries,losses,lastError,autoLossBudget,activeContexts:renderer?1:0,history:[...history]};},
    dispose(){stopped=true;wanted=false;clearTimeout(timer);phase='disposed';release();removeEventListener('pagehide',pagehide);removeEventListener('pageshow',pageshow);document.removeEventListener('visibilitychange',visibility);}};
}

export function showGraphicsFailure(error,{container,loading,status,retry}){
  loading.hidden=true;container.hidden=false;container.replaceChildren();
  const title=document.createElement('h2'),text=document.createElement('p'),button=document.createElement('button');
  title.textContent=error.graphics?'三维画面暂时无法启动':'人物数据暂未载入';
  const stages={'running':'画面绘制','context-request':'图形环境申请','three-constructor':'渲染器初始化','application-build':'人物场景初始化','model-download':'人物数据下载','groom-build':'毛发建立','opacity-probe':'毛发投影初始化','first-frame':'首帧绘制','frame-confirmation':'首帧确认'};
  const where=stages[error.stage]||(String(error.stage||'').startsWith('precision-')?'着色精度查询':'图形恢复');
  text.textContent=error.graphics?where+'未完成（'+(error.code||'graphics-error')+'）。人物画面尚未成功显示。':'下载或校验尚未完成，请检查网络后重试。';
  button.id='graphicsRetry';button.textContent='重试三维画面';button.type='button';button.onclick=retry;
  container.append(title,text,button);
  const details=document.createElement('details'),summary=document.createElement('summary'),reason=document.createElement('p');summary.textContent='查看失败原因';reason.textContent=String(error.message||error).slice(0,400);details.append(summary,reason);container.append(details);
  status.textContent=error.graphics?'图形初始化／恢复未完成':'人物数据载入未完成';
}
