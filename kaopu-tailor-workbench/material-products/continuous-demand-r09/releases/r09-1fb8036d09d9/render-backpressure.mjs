/** Bounded, two-frame WebGL presentation queue. The cloth clock is independent.
 * A single pending snapshot coalesces stale display work. At most two submitted
 * draws exist, allowing one frame of CPU/GPU overlap without an unbounded queue.
 */
export function installRenderBackpressure(viewer){
 const draw=viewer.render.bind(viewer),gl=viewer.renderer.getContext(),queries=[],queue=[];let gpuTimer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 let pending=false,raf=0,timer=0,disposed=false,requested=0,submitted=0,waiters=[];
 const LIMIT=2,stats={submitted:0,completed:0,coalesced:0,maxInFlight:0,pollCount:0,lastCompletionMS:0,failed:false,gpuMS:null,gpuTimerAvailable:!!gpuTimer,gpuSamples:0,gpuDisjointSamples:0,gpuRecentMS:[]};
 function readTimers(){if(!gpuTimer)return;for(let i=queries.length-1;i>=0;i--){const q=queries[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;if(gl.getParameter(gpuTimer.GPU_DISJOINT_EXT))stats.gpuDisjointSamples++;else{stats.gpuMS=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;stats.gpuSamples++;stats.gpuRecentMS.push(stats.gpuMS);if(stats.gpuRecentMS.length>180)stats.gpuRecentMS.shift();}gl.deleteQuery(q);queries.splice(i,1);}}
 const settle=(upto,value)=>{const rest=[];for(const w of waiters){if(w.id<=upto)w.resolve(value);else rest.push(w);}waiters=rest;};
 function schedule(){if(!disposed&&queue.length<LIMIT&&!raf&&pending)raf=requestAnimationFrame(run);}
 function poll(){timer=0;if(disposed)return;while(queue.length){const f=queue[0],state=gl.isContextLost()?gl.WAIT_FAILED:gl.clientWaitSync(f.sync,0,0);stats.pollCount++;if(state===gl.TIMEOUT_EXPIRED)break;queue.shift();gl.deleteSync(f.sync);const ok=state!==gl.WAIT_FAILED;stats.lastCompletionMS=performance.now()-f.start;if(ok)stats.completed++;else stats.failed=true;readTimers();settle(f.id,ok);}schedule();if(queue.length&&!timer)timer=setTimeout(poll,1);}
 function run(){raf=0;if(disposed||queue.length>=LIMIT||!pending)return;pending=false;submitted=requested;if(!viewer.active||viewer.lost||gl.isContextLost()){settle(submitted,false);return;}const start=performance.now();let query=null;try{if(gpuTimer){query=gl.createQuery();gl.beginQuery(gpuTimer.TIME_ELAPSED_EXT,query);}draw();if(query){gl.endQuery(gpuTimer.TIME_ELAPSED_EXT);queries.push(query);}const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('GPU frame sync unavailable');queue.push({sync,start,id:submitted});stats.submitted++;stats.maxInFlight=Math.max(stats.maxInFlight,queue.length);gl.flush();if(!timer)timer=setTimeout(poll,0);schedule();}catch(error){stats.error=String(error);stats.failed=true;settle(submitted,false);viewer.onStatus?.('画面提交失败，已保留人物与配方');}}
 viewer.render=()=>{if(disposed)return Promise.resolve(false);const id=++requested;if(pending||queue.length)stats.coalesced++;pending=true;const result=new Promise(resolve=>waiters.push({id,resolve}));schedule();return result;};
 const idle=()=>{if(disposed||(!pending&&!queue.length))return Promise.resolve(!stats.failed);return new Promise(resolve=>waiters.push({id:requested,resolve}));};
 const clear=()=>{if(raf)cancelAnimationFrame(raf);if(timer)clearTimeout(timer);raf=timer=0;for(const f of queue)if(!gl.isContextLost())gl.deleteSync(f.sync);queue.length=0;for(const q of queries)if(!gl.isContextLost())gl.deleteQuery(q);queries.length=0;pending=false;settle(Infinity,false);};
 viewer.canvas.addEventListener('webglcontextlost',clear);viewer.canvas.addEventListener('webglcontextrestored',()=>{gpuTimer=gl.getExtension('EXT_disjoint_timer_query_webgl2');stats.gpuTimerAvailable=!!gpuTimer;stats.failed=false;});
 const priorDispose=viewer.dispose.bind(viewer);viewer.dispose=()=>{disposed=true;clear();priorDispose();};
 viewer.frameGate={idle,isBusy:()=>pending||queue.length>=LIMIT,audit:()=>({...stats,inFlight:queue.length,pending:pending?1:0,queuedSnapshots:pending?1:0,inFlightLimit:LIMIT,submissionControlOnly:true}),dispose:()=>{disposed=true;clear();}};return viewer.frameGate;
}
