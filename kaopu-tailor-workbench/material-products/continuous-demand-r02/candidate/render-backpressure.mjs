/** GPU submission backpressure. Submission only; explicit material detail policy documented separately.
 * Uses WebGL2 zero-timeout sync polling, never gl.finish or a busy wait.
 */
export function installRenderBackpressure(viewer){
 const draw=viewer.render.bind(viewer),gl=viewer.renderer.getContext(),queries=[];let gpuTimer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 let pending=false,inFlight=false,sync=null,raf=0,timer=0,disposed=false,requested=0,submitted=0;
 let waiters=[];
 const stats={submitted:0,completed:0,coalesced:0,maxInFlight:0,pollCount:0,lastCompletionMS:0,failed:false,gpuMS:null,gpuTimerAvailable:!!gpuTimer,gpuSamples:0,gpuDisjointSamples:0,gpuRecentMS:[]};
 function readTimers(){if(!gpuTimer)return;for(let i=queries.length-1;i>=0;i--){const q=queries[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;if(gl.getParameter(gpuTimer.GPU_DISJOINT_EXT))stats.gpuDisjointSamples++;else{stats.gpuMS=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;stats.gpuSamples++;stats.gpuRecentMS.push(stats.gpuMS);if(stats.gpuRecentMS.length>180)stats.gpuRecentMS.shift();}gl.deleteQuery(q);queries.splice(i,1);}}
 const settle=(upto,value)=>{const rest=[];for(const w of waiters){if(w.id<=upto)w.resolve(value);else rest.push(w);}waiters=rest;};
 function schedule(){if(!disposed&&!inFlight&&!raf&&pending)raf=requestAnimationFrame(run);}
 function clearSync(){if(sync){gl.deleteSync(sync);sync=null;}}
 function finish(ok,start){clearSync();inFlight=false;stats.lastCompletionMS=performance.now()-start;if(ok)stats.completed++;else stats.failed=true;readTimers();settle(submitted,ok);schedule();}
 function poll(start){
  timer=0;if(disposed)return;
  if(gl.isContextLost()){finish(false,start);return;}
  const state=gl.clientWaitSync(sync,0,0);stats.pollCount++;
  if(state===gl.TIMEOUT_EXPIRED){timer=setTimeout(()=>poll(start),2);return;}
  finish(state!==gl.WAIT_FAILED,start);
 }
 function run(){
  raf=0;if(disposed||inFlight||!pending)return;
  pending=false;submitted=requested;
  if(!viewer.active||viewer.lost||gl.isContextLost()){settle(submitted,false);return;}
  const start=performance.now();inFlight=true;stats.maxInFlight=Math.max(stats.maxInFlight,1);
  let query=null;try{if(gpuTimer){query=gl.createQuery();gl.beginQuery(gpuTimer.TIME_ELAPSED_EXT,query);}draw();if(query){gl.endQuery(gpuTimer.TIME_ELAPSED_EXT);queries.push(query);}stats.submitted++;sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('GPU frame sync unavailable');gl.flush();timer=setTimeout(()=>poll(start),0);}
  catch(error){stats.error=String(error);finish(false,start);viewer.onStatus?.('画面提交失败，已保留人物与配方');}
 }
 viewer.render=()=>{
  if(disposed)return Promise.resolve(false);
  const id=++requested;if(pending||inFlight)stats.coalesced++;
  pending=true;const result=new Promise(resolve=>waiters.push({id,resolve}));schedule();return result;
 };
 const idle=()=>{if(disposed||(!pending&&!inFlight))return Promise.resolve(!stats.failed);return new Promise(resolve=>waiters.push({id:requested,resolve}));};
 const stop=()=>{disposed=true;if(raf)cancelAnimationFrame(raf);if(timer)clearTimeout(timer);clearSync();for(const q of queries)gl.deleteQuery(q);queries.length=0;inFlight=false;pending=false;settle(Infinity,false);};
 viewer.canvas.addEventListener('webglcontextlost',()=>{if(timer)clearTimeout(timer);if(raf)cancelAnimationFrame(raf);timer=raf=0;sync=null;queries.length=0;inFlight=pending=false;settle(Infinity,false);});
 viewer.canvas.addEventListener('webglcontextrestored',()=>{gpuTimer=gl.getExtension('EXT_disjoint_timer_query_webgl2');stats.gpuTimerAvailable=!!gpuTimer;stats.failed=false;});
 const priorDispose=viewer.dispose.bind(viewer);viewer.dispose=()=>{stop();priorDispose();};
 viewer.frameGate={idle,isBusy:()=>pending||inFlight,audit:()=>({...stats,inFlight:inFlight?1:0,pending:pending?1:0,queuedSnapshots:pending?1:0,submissionControlOnly:true}),dispose:stop};
 return viewer.frameGate;
}
