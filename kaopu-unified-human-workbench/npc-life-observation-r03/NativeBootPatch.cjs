'use strict';
/** Preserve the full R07 renderer and shader chain while batching its startup
 * requests. No geometry, material, shader text or image data is replaced here. */
const NATIVE_RENDER_ANCHOR='render(){if(!this.inUnified)return super.render()}';
function nativeBootRuntime(){
  if(globalThis.__NPC_NATIVE_BOOT__)throw Error('原生启动渲染器重复安装');
  const states=new Map(),records=[],WAIT_MS=45000;
  const now=()=>performance.now();
  function fail(state,reason){
    if(state.failure)return state.failure;
    state.failure=reason instanceof Error?reason:Error(String(reason));
    state.dirty=false;
    if(state.raf){cancelAnimationFrame(state.raf);state.raf=0;}
    if(state.pending){try{state.gl.deleteSync(state.pending.fence);}catch(_){}state.pending=null;}
    state.inFlight=0;
    for(const waiter of state.waiters.splice(0)){clearTimeout(waiter.timer);waiter.reject(state.failure);}
    globalThis.__NPC_BOOT__?.fail(state.failure,{code:'NATIVE_GPU_STARTUP_FAILED'});
    return state.failure;
  }
  function check(state){
    globalThis.__NPC_BOOT__?.check();
    if(state.failure)throw state.failure;
    if(state.gl.isContextLost?.())throw fail(state,Error('原生 GPU 上下文丢失，启动已停止'));
  }
  function statusOf(state){return {
    requested:state.requested,submitted:state.submitted,completed:state.completed,
    nativeRendererCalls:state.nativeRendererCalls,skippedDraws:state.skippedDraws,
    coalescedRequests:Math.max(0,state.requested-state.submitted),
    held:state.held,inFlight:state.inFlight,maxInFlight:state.maxInFlight,
    released:state.released,pending:!!state.pending,failure:state.failure?.message||null,
    startupMS:now()-state.started,frames:state.frames.map(frame=>({...frame})),
    scope:'original complete R07 native render chain; completion requires an actual WebGL2 fence; skipped startup requests are not rendered frames'
  };}
  function wake(state){
    if(state.failure||state.released||state.raf)return;
    state.raf=requestAnimationFrame(()=>{state.raf=0;try{pump(state);}catch(error){fail(state,error);}});
  }
  function settled(state){
    for(let i=state.waiters.length-1;i>=0;i--){const waiter=state.waiters[i];if(waiter.target<=state.completed){state.waiters.splice(i,1);clearTimeout(waiter.timer);waiter.resolve(statusOf(state));}}
  }
  function pump(state,{force=false}={}){
    check(state);
    if(state.pending){
      const pending=state.pending,result=state.gl.clientWaitSync(pending.fence,0,0);
      if(result===state.gl.WAIT_FAILED)throw fail(state,Error('原生 GPU 帧同步失败'));
      if(result===state.gl.TIMEOUT_EXPIRED){
        if(now()-pending.submittedAtMS>=WAIT_MS)throw fail(state,Error('原生完整画面等待超过 45 秒'));
        wake(state);return;
      }
      state.gl.deleteSync(pending.fence);state.pending=null;state.inFlight=0;
      const completedAtMS=now();state.completed=pending.serial;
      state.frames.push({serial:pending.serial,submittedAtMS:pending.submittedAtMS,completedAtMS,durationMS:completedAtMS-pending.submittedAtMS,rendererFrameBefore:pending.before,rendererFrameAfter:pending.after});
      settled(state);
      // Allow synchronous readers to freeze the completed material state first.
      if(!force){if(state.dirty&&!state.held)wake(state);return;}
    }
    if(!state.dirty||state.held&&!force)return;
    state.dirty=false;
    const before=state.viewer.renderer.info.render.frame,submittedAtMS=now();
    state.draw();
    const after=state.viewer.renderer.info.render.frame;
    if(after===before){state.skippedDraws++;if(state.dirty&&!state.held)wake(state);return;}
    const serial=++state.submitted;
    state.nativeRendererCalls+=after-before;
    const fence=state.gl.fenceSync(state.gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(!fence)throw fail(state,Error('原生完整画面未取得 GPU 帧回执'));
    state.pending={fence,serial,submittedAtMS,before,after};state.inFlight=1;
    state.maxInFlight=Math.max(state.maxInFlight,state.inFlight);state.gl.flush();wake(state);
  }
  function stateFor(viewer,draw){
    let state=states.get(viewer);
    if(state){if(draw)state.draw=draw;return state;}
    const gl=viewer.renderer.getContext();
    if(typeof gl.fenceSync!=='function'||typeof gl.clientWaitSync!=='function')throw Error('完整人物启动需要 WebGL2 帧同步');
    state={viewer,draw,gl,started:now(),requested:0,submitted:0,completed:0,nativeRendererCalls:0,skippedDraws:0,dirty:false,held:0,released:false,raf:0,pending:null,failure:null,inFlight:0,maxInFlight:0,waiters:[],frames:[]};
    states.set(viewer,state);records.push(state);return state;
  }
  function awaitSerial(state,target){
    try{check(state);}catch(error){return Promise.reject(error);}
    if(target<=state.completed)return Promise.resolve(statusOf(state));
    return new Promise((resolve,reject)=>{
      const waiter={target,resolve,reject,timer:0};
      waiter.timer=setTimeout(()=>fail(state,Error('原生完整画面等待超过 45 秒')),WAIT_MS);
      state.waiters.push(waiter);wake(state);
    });
  }
  const api={
    request(viewer,draw){const state=stateFor(viewer,draw);check(state);if(state.released)return draw();state.requested++;state.dirty=true;if(!state.held)wake(state);},
    async begin(viewer,label='生成完整人物'){
      const state=states.get(viewer);if(!state)throw Error('原生启动渲染器未接入');check(state);
      state.held++;
      if(state.raf&&!state.pending){cancelAnimationFrame(state.raf);state.raf=0;}
      if(state.pending)await awaitSerial(state,state.pending.serial);check(state);
      globalThis.__NPC_BOOT__?.progress(label);return statusOf(state);
    },
    async flush(viewer,label='完整原生人物画面'){
      const state=states.get(viewer);if(!state||state.released)throw Error('原生启动事务未就绪');check(state);
      if(state.pending)await awaitSerial(state,state.pending.serial);check(state);
      state.dirty=true;const before=state.submitted;pump(state,{force:true});
      if(state.submitted===before)throw fail(state,Error(label+'：原生渲染尚未产生实际画面'));
      await awaitSerial(state,state.submitted);check(state);return statusOf(state);
    },
    async finish(viewer){
      const state=states.get(viewer);if(!state)throw Error('原生启动事务缺失');check(state);
      if(state.pending)await awaitSerial(state,state.pending.serial);check(state);
      state.held=0;state.dirty=false;state.released=true;
      if(state.raf){cancelAnimationFrame(state.raf);state.raf=0;}
      return statusOf(state);
    },
    fail(viewer,error){const state=states.get(viewer);if(state)return fail(state,error);globalThis.__NPC_BOOT__?.fail(error,{code:'NATIVE_GPU_STARTUP_FAILED'});return error;},
    status(){return records.map(statusOf);}
  };
  globalThis.__NPC_NATIVE_BOOT__=api;
}
function nativeBootScript(){return '('+nativeBootRuntime.toString()+')();';}
function patchNativeBoot(html){
  const count=html.split(NATIVE_RENDER_ANCHOR).length-1;
  if(count!==1)throw Error('R07 complete renderer hook must match exactly once; got '+count);
  return html.replace(NATIVE_RENDER_ANCHOR,'render(){if(!this.inUnified)return globalThis.__NPC_NATIVE_BOOT__.request(this,()=>super.render())}');
}
module.exports={patchNativeBoot,nativeBootScript,NATIVE_RENDER_ANCHOR};
