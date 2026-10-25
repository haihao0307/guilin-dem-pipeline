/** Bounded startup state. Absolute checks also cover synchronous work delaying timers. */
export function createBootLifecycle({now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,onChange=()=>{},totalMS=180000,stageMS=60000}={}){
  const started=now();let stageStarted=started,lastProgress=started,status='loading',code='document',label='正在读取页面与完整原生人物数据。',failureError=null,totalTimer=null,stageTimer=null;
  const steps=[{code,label,startedMS:0,endedMS:null}],waiters=new Set();
  function snapshot(){const t=now();return{status,code,label,elapsedMS:t-started,stageElapsedMS:t-stageStarted,lastProgressAgoMS:t-lastProgress,limits:{totalMS,stageMS},failure:failureError?{code:failureError.code||'BOOT_FAILED',message:failureError.message}:null,steps:steps.map(s=>({...s}))};}
  function changed(){onChange(snapshot());}
  function stopTimers(){if(totalTimer!==null)clearTimer(totalTimer);if(stageTimer!==null)clearTimer(stageTimer);totalTimer=stageTimer=null;}
  function endStep(){if(steps.at(-1)?.endedMS===null)steps.at(-1).endedMS=now()-started;}
  function fail(reason,{code:errorCode='BOOT_FAILED'}={}){
    if(failureError)return failureError;
    failureError=reason instanceof Error?reason:Error(String(reason));failureError.code=failureError.code||errorCode;
    status='failed';stopTimers();endStep();
    for(const cancel of [...waiters])cancel(failureError);waiters.clear();changed();return failureError;
  }
  function check(){
    if(failureError)throw failureError;
    if(status==='loading'){
      if(now()-started>=totalMS)throw fail(Error('完整人物启动超过限定时间，请重新加载。'),{code:'BOOT_TOTAL_TIMEOUT'});
      if(now()-stageStarted>=stageMS)throw fail(Error(label+'：超过阶段等待时间，请重试。'),{code:'BOOT_STAGE_TIMEOUT'});
    }
    return snapshot();
  }
  function armStage(){if(stageTimer!==null)clearTimer(stageTimer);stageTimer=setTimer(()=>fail(Error(label+'：超过阶段等待时间，请重试。'),{code:'BOOT_STAGE_TIMEOUT'}),stageMS);}
  function stage(nextCode,nextLabel){check();if(status!=='loading')return snapshot();if(nextCode!==code){endStep();code=nextCode;stageStarted=now();steps.push({code,label:nextLabel,startedMS:stageStarted-started,endedMS:null});armStage();}label=nextLabel;steps.at(-1).label=label;lastProgress=now();changed();return snapshot();}
  function progress(nextLabel){check();if(status!=='loading')return snapshot();label=nextLabel;lastProgress=now();changed();return snapshot();}
  function wait(promise,description,timeoutMS=stageMS){
    try{check();}catch(error){Promise.resolve(promise).catch(()=>{});return Promise.reject(error);}
    return new Promise((resolve,reject)=>{
      let settled=false,timer=null;
      const finish=(fn,value)=>{if(settled)return;settled=true;if(timer!==null)clearTimer(timer);waiters.delete(cancel);fn(value);};
      const cancel=error=>finish(reject,error);waiters.add(cancel);
      timer=setTimer(()=>fail(Error(description+'：等待超时，请重试。'),{code:'BOOT_WAIT_TIMEOUT'}),timeoutMS);
      Promise.resolve(promise).then(value=>{try{check();finish(resolve,value);}catch(error){finish(reject,error);}},error=>{const stopped=fail(error,{code:'BOOT_RESOURCE_OR_NATIVE_ERROR'});finish(reject,stopped);});
    });
  }
  function ready(){check();if(status!=='loading')return snapshot();status='ready';endStep();stopTimers();changed();return snapshot();}
  totalTimer=setTimer(()=>fail(Error('完整人物启动超过限定时间，请重新加载。'),{code:'BOOT_TOTAL_TIMEOUT'}),totalMS);armStage();changed();
  return{stage,progress,check,wait,fail,ready,snapshot};
}
