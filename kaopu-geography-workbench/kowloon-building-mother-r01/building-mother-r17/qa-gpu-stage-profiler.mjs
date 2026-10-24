/** Opt-in QA only. No renderer, shader, resolution or geometry changes.
 * Wrap one explicitly supplied action, time its drawArrays commands if the
 * WebGL2 disjoint timer extension exists, then restore the context methods.
 * Query instrumentation adds overhead and can affect scheduling. These are
 * sums of instrumented draw-command GPU times, not uninstrumented frame times.
 */
const activeContexts=new WeakSet();
const stageNames=['source','assembly','rail','aperture','shade','present','empty','dynamic','optical','shadow','other'];
const properties={source:'sourceProgram',assembly:'assemblyProgram',rail:'railProgram',aperture:'apertureProgram',shade:'shadeProgram',present:'presentProgram',empty:'emptyProgram',dynamic:'dynamicLiftProgram',optical:'opticalRayProgram',shadow:'structuralShadowProgram'};
const namedStages={'source':'source','assembly':'assembly','continuous-rail':'rail','hosted-aperture':'aperture','semantic-flat-color-only':'shade','frame-presentation':'present','empty-field-initialization':'empty','host-bound-elevator':'dynamic','bounded-structural-shadow':'shadow'};
const now=()=>globalThis.performance?.now?.()??Date.now();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const errorText=error=>String(error?.stack??error?.message??error);
function describeProgram(renderer,program){
 const index=renderer.programs?.indexOf(program)??-1,name=index>=0?renderer.compileStats?.[index]?.name:null;
 for(const [stage,property]of Object.entries(properties))if(program&&renderer[property]===program)return{stage,name:name??property};
 return{stage:namedStages[name]??'other',name:name??(program?'unregistered-program':'no-program')};
}
function restoreMethod(gl,name,descriptor){if(descriptor)Object.defineProperty(gl,name,descriptor);else delete gl[name];}

/**
 * Example in page.evaluate:
 * const {profileRendererGpu}=await import('./qa-gpu-stage-profiler.mjs');
 * return await profileRendererGpu(semanticInspection.renderer,
 *   ()=>semanticInspection.render(), {label:'fixed-camera-warm-frame'});
 *
 * Await an action that actually completes its render. A fire-and-forget journey
 * or requestAnimationFrame loop is not a bounded profiling action. Normal
 * renderer busy state is awaited after the action, but future timers are not.
 * Action errors are rethrown with error.gpuProfile attached by default.
 */
export async function profileRendererGpu(renderer,action,{label='render',timeoutMs=30000,pollMs=8,maxQueries=4096,throwOnActionError=true}={}){
 if(!renderer?.gl||typeof action!=='function')throw new TypeError('Renderer and awaited action required');
 if(!Number.isFinite(timeoutMs)||timeoutMs<0||!Number.isFinite(pollMs)||pollMs<0||!Number.isInteger(maxQueries)||maxQueries<1||maxQueries>65536)throw new RangeError('Invalid bounded profiler options');
 const gl=renderer.gl;if(activeContexts.has(gl))throw Error('GPU profiler already active for this context');
 if(renderer.busy)throw Error('Start GPU profiling only after the renderer is idle');
 const start=now(),framesBefore=renderer.stats?.frames??null,queries=[],errors=[];
 const stages=Object.fromEntries(stageNames.map(stage=>[stage,{drawCalls:0,timedDraws:0,completedQueries:0,drawCallWallMs:0,gpuMs:null,programNames:[]} ]));
 const report={schemaVersion:1,label,backend:renderer.gpu??null,status:'pending',action:{completed:false,error:null,wallMs:null,framesCompleted:null},extension:{name:'EXT_disjoint_timer_query_webgl2',available:false},gpu:{valid:false,complete:false,totalMs:null,unit:'milliseconds'},coverage:{drawCalls:0,timedDraws:0,completedQueries:0,limitSkipped:0,activeQuerySkipped:0,allocationSkipped:0,timedOutQueries:0},stages,errors,notice:'GPU numbers sum instrumented draw-command queries, not end-to-end or uninstrumented frame time. Query instrumentation can change scheduling. drawCallWallMs is CPU/driver wall time and may contain stalls; it is not GPU time.'};
 let ext=null,current=null,disjoint=false,lost=false,actionError=null,waitTimedOut=false,instrumentationFailed=false;
 const original={useProgram:gl.useProgram,drawArrays:gl.drawArrays},descriptors={useProgram:Object.getOwnPropertyDescriptor(gl,'useProgram'),drawArrays:Object.getOwnPropertyDescriptor(gl,'drawArrays')};
 const contextLost=()=>{try{return gl.isContextLost?.()===true}catch(error){errors.push(errorText(error));return true}};
 const checkDisjoint=()=>{if(!ext)return false;try{if(gl.getParameter(ext.GPU_DISJOINT_EXT))disjoint=true}catch(error){errors.push(errorText(error));instrumentationFailed=true}return disjoint};
 activeContexts.add(gl);
 let hooksInstalled=false;
 try{
  lost=contextLost();
  if(!lost){try{ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');report.extension.available=!!ext;current=gl.getParameter(gl.CURRENT_PROGRAM);checkDisjoint()}catch(error){errors.push(errorText(error));instrumentationFailed=true}}
  const useProgram=function(program){const result=original.useProgram.call(gl,program);current=program;return result};
  const drawArrays=function(...args){
   const {stage,name}=describeProgram(renderer,current),entry=stages[stage];entry.drawCalls++;report.coverage.drawCalls++;if(!entry.programNames.includes(name))entry.programNames.push(name);
   let query=null,begun=false;
   if(ext&&!disjoint&&!instrumentationFailed&&!contextLost()){
    if(queries.length>=maxQueries)report.coverage.limitSkipped++;
    else try{
     // Do not close, nest or replace another consumer's active elapsed query.
     if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))report.coverage.activeQuerySkipped++;
     else{
      query=gl.createQuery();
      if(!query)report.coverage.allocationSkipped++;
      else{gl.beginQuery(ext.TIME_ELAPSED_EXT,query);begun=true;queries.push({query,stage,done:false,nanoseconds:null});entry.timedDraws++;report.coverage.timedDraws++;}
     }
    }catch(error){errors.push(errorText(error));instrumentationFailed=true;if(query&&!begun)try{gl.deleteQuery(query)}catch{}}
   }
   const submitted=now();
   try{return original.drawArrays.apply(gl,args)}
   finally{entry.drawCallWallMs+=now()-submitted;if(begun)try{gl.endQuery(ext.TIME_ELAPSED_EXT)}catch(error){errors.push(errorText(error));instrumentationFailed=true}}
  };
  try{gl.useProgram=useProgram;gl.drawArrays=drawArrays;if(gl.useProgram!==useProgram||gl.drawArrays!==drawArrays)throw Error('WebGL methods cannot be temporarily wrapped');hooksInstalled=true}
  catch(error){errors.push(errorText(error));instrumentationFailed=true;restoreMethod(gl,'useProgram',descriptors.useProgram);restoreMethod(gl,'drawArrays',descriptors.drawArrays)}
  const actionStart=now();
  try{
   await action();
   const deadline=now()+timeoutMs;
   while(renderer.busy&&!contextLost()){
    if(now()>=deadline){waitTimedOut=true;break}await sleep(pollMs);
   }
   report.action.completed=!renderer.busy;
   if(renderer.busy)report.action.error='Renderer remained busy after the bounded action wait';
  }catch(error){actionError=error;report.action.error=errorText(error)}
  finally{report.action.wallMs=now()-actionStart;if(hooksInstalled){restoreMethod(gl,'useProgram',descriptors.useProgram);restoreMethod(gl,'drawArrays',descriptors.drawArrays);hooksInstalled=false}}
  report.action.framesCompleted=Number.isFinite(framesBefore)&&Number.isFinite(renderer.stats?.frames)?renderer.stats.frames-framesBefore:null;
  const waitStart=now(),deadline=waitStart+timeoutMs;lost=contextLost();checkDisjoint();
  if(ext&&queries.length&&!lost&&!disjoint&&!instrumentationFailed){
   gl.flush();
   while(true){
    lost=contextLost();checkDisjoint();if(lost||disjoint||instrumentationFailed)break;
    let remaining=0;
    for(const record of queries){
     if(record.done)continue;
     if(gl.getQueryParameter(record.query,gl.QUERY_RESULT_AVAILABLE)){
      const value=gl.getQueryParameter(record.query,gl.QUERY_RESULT);
      if(!Number.isFinite(value)||value<0){errors.push('Invalid GPU timer result');instrumentationFailed=true;break}
      record.nanoseconds=value;record.done=true;
     }else remaining++;
    }
    if(instrumentationFailed||remaining===0)break;
    if(now()>=deadline){waitTimedOut=true;break}await sleep(pollMs);
   }
  }
  report.queryWaitWallMs=now()-waitStart;lost=contextLost();checkDisjoint();
  // A disjoint event invalidates the WHOLE capture, including already-read
  // results. Do not retain apparently precise partial stage timings.
  if(!lost&&!disjoint&&!instrumentationFailed){
   for(const record of queries)if(record.done){const entry=stages[record.stage];entry.completedQueries++;entry.gpuMs=(entry.gpuMs??0)+record.nanoseconds/1e6;report.coverage.completedQueries++}
   report.coverage.timedOutQueries=queries.filter(record=>!record.done).length;
   report.gpu.valid=report.coverage.completedQueries>0;
   if(report.gpu.valid)report.gpu.totalMs=Object.values(stages).reduce((sum,entry)=>sum+(entry.gpuMs??0),0);
  }
  report.gpu.complete=report.gpu.valid&&report.coverage.completedQueries===report.coverage.drawCalls&&!waitTimedOut&&report.action.completed;
  report.status=actionError?'action_error':lost?'context_lost':disjoint?'disjoint':instrumentationFailed?'instrumentation_error':!ext?'unsupported':waitTimedOut?'timeout':report.coverage.drawCalls===0?'no_draws':report.gpu.complete?'complete':'partial';
 }catch(error){errors.push(errorText(error));report.status='instrumentation_error';report.gpu={valid:false,complete:false,totalMs:null,unit:'milliseconds'};for(const stage of Object.values(stages)){stage.gpuMs=null;stage.completedQueries=0}report.coverage.completedQueries=0}
 finally{
  if(hooksInstalled){restoreMethod(gl,'useProgram',descriptors.useProgram);restoreMethod(gl,'drawArrays',descriptors.drawArrays)}
  for(const record of queries)try{gl.deleteQuery(record.query)}catch(error){errors.push(errorText(error))}
  activeContexts.delete(gl);report.totalWallMs=now()-start;
 }
 if(actionError&&throwOnActionError){const error=actionError instanceof Error?actionError:new Error(String(actionError));try{error.gpuProfile=report}catch{}throw error}
 return report;
}
