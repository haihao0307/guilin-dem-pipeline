/** Preserve the native renderer while bounding submitted GPU work to one frame.
 * Camera and world changes coalesce; the next frame uses their latest state.
 * WebGL2 fences acknowledge real completed GPU work without blocking the UI.
 */
export function manageRendering(viewer){
  const draw=viewer.render.bind(viewer),gl=viewer.renderer.getContext();
  if(typeof gl.fenceSync!=='function')throw Error('完整人物观察需要 WebGL2 帧同步');
  let requested=0,submitted=0,completed=0,completedRequest=0,dirty=false,pending=null,failure=null,managedInFlight=0,maxManagedInFlight=0,outsideBatchRenderPasses=0;
  const waiters=[],beforeListeners=new Set(),listeners=new Set(),durations=[];
  let pumpCount=0,lastPumpAtMS=null;
  const appearancePreparation={batches:0,lastCPUms:0,maxCPUms:0,lastRenderPasses:0,totalRenderPasses:0,
    measurement:'actual renderer.info.render.frame increments during synchronous before-render hooks'};
  const managedSince=new Date().toISOString(),startupDrain={completed:false,durationMS:null,priorNativeFrame:viewer.renderer.info.render.frame};
  const status=()=>({requested,submitted,completed,completedRequest,inFlight:managedInFlight,maxInFlight:maxManagedInFlight,maxManagedInFlight,
    pendingRequest:pending?.request??null,pendingAgeMS:pending?performance.now()-pending.started:null,
    waiterTargets:waiters.map(w=>w.target),pumpCount,lastPumpAtMS,
    managedSince,startupDrain:{...startupDrain},scope:'one submission batch includes synchronous appearance preparation and native beauty; earlier startup GPU commands are drained before the first managed draw',
    dirty,lastGPUFrameMS:durations.at(-1)??null,gpuFrameDurationsMS:durations.slice(),
    appearancePreparation:{...appearancePreparation},outsideBatchRenderPasses,
    measurement:'native render submission through actual GPU fence completion; includes CPU submission and compilation',
    coalescedRequests:Math.max(0,requested-submitted),failure:failure?.message||null});
  function request(){if(failure)throw failure;dirty=true;return ++requested;}
  viewer.render=request;
  const initialFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!initialFence)throw Error('无法等待原生初始化绘制完成');
  pending={fence:initialFence,started:performance.now(),serial:0,request:0,startup:true};gl.flush();
  function reject(error){failure=error;for(const w of waiters.splice(0))w.reject(error);throw error;}
  function pump(){
    pumpCount++;lastPumpAtMS=performance.now();
    if(failure)return;
    if(pending){
      if(!pending.startup){const nowFrame=viewer.renderer.info.render.frame;
        outsideBatchRenderPasses+=Math.max(0,nowFrame-pending.lastNativeFrame);pending.lastNativeFrame=nowFrame;}
      const state=gl.clientWaitSync(pending.fence,0,0);
      if(state===gl.WAIT_FAILED)return reject(Error('GPU 帧同步失败，观察已停止'));
      if(state===gl.TIMEOUT_EXPIRED)return;
      gl.deleteSync(pending.fence);
      const elapsed=performance.now()-pending.started;
      if(pending.startup){startupDrain.completed=true;startupDrain.durationMS=elapsed;}
      else{durations.push(elapsed);if(durations.length>180)durations.shift();completed=pending.serial;completedRequest=pending.request;managedInFlight--;}
      pending=null;
      let readers=false;
      for(let i=waiters.length-1;i>=0;i--)if(waiters[i].target<=completedRequest){readers=true;waiters.splice(i,1)[0].resolve(status());}
      // Let completed-frame readers and screenshots run before submitting again.
      if(readers)return;
    }
    if(!dirty)return;
    dirty=false;const started=performance.now(),serial=++submitted,target=requested;
    try{
      // Native yarn/seam atlases render into real GPU targets. Preparing them
      // outside this window would bypass the beauty fence and grow a queue
      // while its preceding frame was still in flight. Both phases belong to
      // this same batch; appearance reads the latest pose/camera only here.
      const preparationStart=performance.now(),renderFrameBefore=viewer.renderer.info.render.frame;
      for(const listener of [...beforeListeners])listener({renderer:viewer.renderer,gl,serial});
      appearancePreparation.batches++;appearancePreparation.lastCPUms=performance.now()-preparationStart;
      appearancePreparation.maxCPUms=Math.max(appearancePreparation.maxCPUms,appearancePreparation.lastCPUms);
      appearancePreparation.lastRenderPasses=viewer.renderer.info.render.frame-renderFrameBefore;
      appearancePreparation.totalRenderPasses+=appearancePreparation.lastRenderPasses;
      draw();
      for(const listener of [...listeners])listener({renderer:viewer.renderer,gl,serial});
      const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
      if(!fence)return reject(Error('无法取得真实 GPU 帧回执'));
      pending={fence,started,serial,request:target,lastNativeFrame:viewer.renderer.info.render.frame};managedInFlight++;maxManagedInFlight=Math.max(maxManagedInFlight,managedInFlight);gl.flush();
    }catch(error){reject(error);}
  }
  return{pump,request,status,
    onBeforeRender(callback){beforeListeners.add(callback);return()=>beforeListeners.delete(callback);},
    onRender(callback){listeners.add(callback);return()=>listeners.delete(callback);},
    awaitFrame({fresh=true}={}){
      if(failure)return Promise.reject(failure);
      const target=fresh?request():requested;
      if(target<=completedRequest)return Promise.resolve(status());
      return new Promise((resolve,reject)=>waiters.push({target,resolve,reject}));
    }
  };
}
