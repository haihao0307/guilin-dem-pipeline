/** Coalesce native requests and acknowledge actual completed GPU frames. */
export function manageRendering(viewer,{now=()=>performance.now(),frameTimeoutMS=45000,onFailure=()=>{},onSubmitMetadata=()=>null,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const draw=viewer.render.bind(viewer),gl=viewer.renderer.getContext();
  if(typeof gl.fenceSync!=='function')throw Error('完整人物观察需要 WebGL2 帧同步');
  let requested=0,submitted=0,completed=0,completedRequest=0,dirty=false,pending=null,failure=null,managedInFlight=0,maxManagedInFlight=0;
  const waiters=[],listeners=new Set(),completionListeners=new Set(),durations=[];
  const managedSince=new Date().toISOString(),startupDrain={completed:false,durationMS:null,priorNativeFrame:viewer.renderer.info.render.frame};
  function status(){return{requested,submitted,completed,inFlight:managedInFlight,maxInFlight:maxManagedInFlight,maxManagedInFlight,managedSince,startupDrain:{...startupDrain},scope:'managed native-render submissions; original startup GPU commands drain before first managed draw',dirty,pending:!!pending,canAdvance:!pending&&!dirty&&!failure&&startupDrain.completed,lastGPUFrameMS:durations.at(-1)??null,gpuFrameDurationsMS:durations.slice(),measurement:'native render submission through actual GPU fence completion; includes CPU submission and compilation',coalescedRequests:Math.max(0,requested-submitted),frameTimeoutMS,failure:failure?.message||null};}
  function request(){if(failure)throw failure;dirty=true;return ++requested;}
  function reject(error){
    if(failure)return failure;failure=error instanceof Error?error:Error(String(error));dirty=false;
    if(pending){try{gl.deleteSync(pending.fence);}catch{}pending=null;}managedInFlight=0;
    for(const w of waiters.splice(0)){clearTimer(w.timer);w.reject(failure);}onFailure(failure);return failure;
  }
  viewer.render=request;
  const initialFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!initialFence)throw Error('无法等待原生初始化绘制完成');
  pending={fence:initialFence,started:now(),serial:0,request:0,startup:true};gl.flush();
  function pump(){
    if(failure)return;
    try{
      if(gl.isContextLost?.())throw Error('GPU 上下文已丢失，观察已停止');
      if(pending){
        const state=gl.clientWaitSync(pending.fence,0,0);
        if(state===gl.WAIT_FAILED)throw Error('GPU 帧同步失败，观察已停止');
        if(state===gl.TIMEOUT_EXPIRED){if(now()-pending.started>=frameTimeoutMS)throw Error('完整人物 GPU 帧等待超过 '+frameTimeoutMS+' ms，观察已停止');return;}
        const frame=pending;gl.deleteSync(frame.fence);pending=null;
        const completedAt=now(),elapsed=completedAt-frame.started;
        if(frame.startup){startupDrain.completed=true;startupDrain.durationMS=elapsed;}
        else{durations.push(elapsed);if(durations.length>180)durations.shift();completed=frame.serial;completedRequest=frame.request;managedInFlight--;const info={serial:frame.serial,request:frame.request,submittedAtMS:frame.started,completedAtMS:completedAt,durationMS:elapsed,metadata:frame.metadata};for(const listener of [...completionListeners])listener(info);}
        let readers=false;
        for(let i=waiters.length-1;i>=0;i--)if(waiters[i].target<=completedRequest){readers=true;const w=waiters.splice(i,1)[0];clearTimer(w.timer);w.resolve(status());}
        // Caller must yield before changing CPU state when completed-frame readers exist.
        return{completed:true,readers};
      }
      if(!dirty)return;
      dirty=false;const started=now(),serial=++submitted,target=requested,metadata=structuredClone(onSubmitMetadata());
      draw();for(const listener of [...listeners])listener({renderer:viewer.renderer,gl,serial,metadata});
      const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence)throw Error('无法取得真实 GPU 帧回执');
      pending={fence,started,serial,request:target,metadata};managedInFlight++;maxManagedInFlight=Math.max(maxManagedInFlight,managedInFlight);gl.flush();
    }catch(error){throw reject(error);}
  }
  function awaitFrame({fresh=true,timeoutMS=frameTimeoutMS}={}){
    if(failure)return Promise.reject(failure);let target;try{target=fresh?request():requested;}catch(error){return Promise.reject(error);}
    if(target<=completedRequest)return Promise.resolve(status());
    return new Promise((resolve,rejectPromise)=>{const w={target,resolve,reject:rejectPromise,timer:null};w.timer=setTimer(()=>reject(Error('等待完整 GPU 画面超过 '+timeoutMS+' ms，观察已停止')),timeoutMS);waiters.push(w);});
  }
  return{pump,request,status,awaitFrame,onRender(callback){listeners.add(callback);return()=>listeners.delete(callback);},onComplete(callback){completionListeners.add(callback);return()=>completionListeners.delete(callback);}};
}
