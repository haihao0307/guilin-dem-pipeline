// A single-owner, non-blocking WebGL2 fence gate. The application must call
// canRender/assertCurrent BEFORE drawing and submit AFTER the complete draw.
// A completed fence proves command completion, not visible presentation.
const EVENT_LIMIT=16,ERROR_LIMIT=4;
const abort=message=>Object.assign(new Error(message),{name:'AbortError'});
const invalid=message=>Object.assign(new Error(message),{name:'InvalidStateError'});

function serializable(value,depth=0,seen=new WeakSet()){
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value==='string')return value.slice(0,512);
 if(typeof value!=='object')return String(value).slice(0,128);
 if(depth>=4)return '[depth limit]';
 if(seen.has(value))return '[circular]';
 seen.add(value);
 if(value instanceof Error){seen.delete(value);return {name:value.name,message:value.message.slice(0,512)};}
 if(Array.isArray(value)){const result=value.slice(0,16).map(item=>serializable(item,depth+1,seen));seen.delete(value);return result;}
 const result={};
 for(const key of Object.keys(value).slice(0,24)){
  try{Object.defineProperty(result,key,{value:serializable(value[key],depth+1,seen),enumerable:true,writable:true,configurable:true});}
  catch{Object.defineProperty(result,key,{value:'[unreadable]',enumerable:true,writable:true,configurable:true});}
 }
 seen.delete(value);return result;
}

export class GpuLifecycle {
 constructor({gl,now=()=>performance.now(),onStop=()=>{},onComplete=()=>{},maxWaitMs=15000,maxInitializationMs=60000,maxRecoveryAttempts=1}={}){
  if(!gl||typeof gl.isContextLost!=='function')throw new TypeError('GpuLifecycle requires a WebGL2 context');
  if(typeof now!=='function'||typeof onStop!=='function'||typeof onComplete!=='function')throw new TypeError('Lifecycle callbacks must be functions');
  if(!Number.isFinite(maxWaitMs)||maxWaitMs<=0)throw new RangeError('maxWaitMs must be finite and positive');
  if(!Number.isFinite(maxInitializationMs)||maxInitializationMs<=0)throw new RangeError('maxInitializationMs must be finite and positive');
  if(!Number.isSafeInteger(maxRecoveryAttempts)||maxRecoveryAttempts<0)throw new RangeError('maxRecoveryAttempts must be a nonnegative integer');
  Object.assign(this,{gl,now,onStop,onComplete,maxWaitMs,maxInitializationMs,maxRecoveryAttempts});
  this.state='active';this.generation=1;this.pending=null;this.highQualityDisabled=false;
  this.recoveryAttempts=0;this.lastFailure=null;this.lastCompletion=null;this.events=[];
  this.stats={submitted:0,completed:0,polls:0,waitTimeouts:0,released:0,staleDiscarded:0,failures:0,contextLosses:0,recovered:0};
  this._attached=true;this._recoveryToken=null;this._stopNotified=false;this._manualRetryAllowed=false;this._terminalAfterLoss=false;
 }
 _time(){const value=this.now();if(!Number.isFinite(value))throw new RangeError('Lifecycle clock must return finite milliseconds');return value;}
 _event(detail){const result=serializable(detail);this.events.push(result);if(this.events.length>EVENT_LIMIT)this.events.shift();return result;}
 _notify(callback,detail){try{callback(serializable(detail));}catch(error){this._event({reason:'lifecycle-callback-error',error});}}
 _owns(pending){return !!pending&&pending===this.pending&&pending.gl===this.gl&&pending.generation===this.generation;}
 _live(){
  try{
   const lost=this.gl.isContextLost();
   if(lost===false)return true;
   if(lost===true)this.contextLost('context-lost-observed');
   else this.fail('context-status-query-failed',{message:'isContextLost returned an unknown value'});
  }
  catch(error){this.fail('context-status-query-failed',{error});}
  return false;
 }
 canRender(){return (this.state==='active'||this.state==='recovering')&&this._attached&&this._live();}
 assertCurrent(token){
  if(token!==this.generation||(this.state!=='active'&&this.state!=='recovering')||!this._live())throw abort('GPU work belongs to a stale or stopped context generation');
  return true;
 }
 _diagnostics(pending,status=null){
  const gl=pending?.gl??this.gl,detail={status,generation:pending?.generation??this.generation,contextLost:null,errors:[],error:null,syncValid:null,diagnosticErrors:[]};
  const current=()=>gl===this.gl&&(!pending||this._owns(pending));
  if(!current()){detail.stale=true;return detail;}
  try{const lost=gl.isContextLost();if(typeof lost!=='boolean')throw new TypeError('Unknown context-loss query result');detail.contextLost=lost;}catch(error){detail.diagnosticErrors.push(String(error).slice(0,256));}
  if(!current())return detail;
  // Keep evidence collection bounded, and always do it before deleting a sync.
  try{
   for(let i=0;i<ERROR_LIMIT&&current();i++){
    const code=gl.getError();if(code===gl.NO_ERROR)break;
    detail.errors.push(Number.isFinite(code)?code:null);
    if(code===gl.CONTEXT_LOST_WEBGL)break;
   }
  }catch(error){detail.diagnosticErrors.push(String(error).slice(0,256));}
  detail.error=detail.errors[0]??null;
  if(current()&&pending?.handle&&!detail.contextLost){
   try{const valid=gl.isSync(pending.handle);if(typeof valid!=='boolean')throw new TypeError('Unknown sync-validity query result');detail.syncValid=valid;}catch(error){detail.diagnosticErrors.push(String(error).slice(0,256));}
  }
  if(current()){
   try{const lost=gl.isContextLost();if(typeof lost!=='boolean')throw new TypeError('Unknown context-loss query result');detail.contextLost=detail.contextLost||lost;}catch(error){detail.diagnosticErrors.push(String(error).slice(0,256));}
  }
  return detail;
 }
 _stop(detail){
  this.lastFailure=this._event({...detail,kind:detail.kind??detail.reason,code:detail.code??detail.reason,
   glErrors:[...(detail.errors??[])],isSync:detail.syncValid??null,injected:detail.injected??detail.metadata?.injected??false,state:this.state,generation:this.generation});
  if(!this._stopNotified){this._stopNotified=true;this._notify(this.onStop,this.lastFailure);}
  return false;
 }
 contextLost(reason='context-lost',details={}){
  if(this.state==='lost'||(this.state==='failed'&&this._terminalAfterLoss))return false;
  const pending=this.pending;
  // Loss invalidates every GL object. Forget the handle without deleting it in
  // the lost or subsequently restored context, even when JS identity is equal.
  this.pending=null;this.generation++;this.state='lost';this._attached=false;this._recoveryToken=null;
  this.highQualityDisabled=true;this._manualRetryAllowed=false;this.stats.contextLosses++;
  return this._stop({...serializable(details),reason,contextLost:true,interruptedGeneration:pending?.generation??this.generation-1,metadata:pending?.metadata??null});
 }
 release(reason='released'){
  const pending=this.pending;if(!pending)return false;
  const owned=this._owns(pending);this.pending=null;
  this.stats.released++;
  if(!owned){this.stats.staleDiscarded++;return true;}
  // Clear ownership before delete, so even reentrant loss/release cannot delete
  // a handle twice. No stale-generation GL object is sent into a new context.
  if(this.state!=='lost'){
   try{
    if(pending.gl.isContextLost())this.contextLost('context-lost-during-release',{releaseReason:reason});
    else if(pending.generation===this.generation&&pending.gl===this.gl)pending.gl.deleteSync(pending.handle);
   }catch(error){this.fail('fence-release-error',{releaseReason:reason,error,generation:pending.generation});}
  }
  return true;
 }
 fail(reason='gpu-failed',details={}){
  if(this.state==='failed')return false;
  const wasLost=this.state==='lost';
  const pending=this.pending,metadata=pending?.metadata??details.metadata??null;
  this.state='failed';this._attached=false;this._recoveryToken=null;this.highQualityDisabled=true;this.stats.failures++;
  if(wasLost)this._terminalAfterLoss=true;
  this._manualRetryAllowed=!wasLost&&reason==='wait-failed-invalid-sync'&&details.contextLost===false&&details.syncValid===false&&details.diagnosticErrors?.length===0;
  // A restoration deadline/exhausted budget may terminally stop a lost gate.
  // Do not query or delete anything in a context already known to be lost.
  if(wasLost)this.pending=null;else this.release(reason);
  if(this.state==='lost')return false;
  return this._stop({...serializable(details),reason,metadata});
 }
 _rejectPending(reason,pending,status,extra={}){
  const detail={...this._diagnostics(pending,status),...extra,metadata:pending?.metadata??null,elapsedMs:pending?Math.max(0,this._time()-pending.submittedAt):0,waitBudgetMs:pending?.waitBudgetMs??null,phase:pending?.phase??null};
  if(!this._owns(pending)&&pending)return false;
  if(detail.contextLost)return this.contextLost(reason+'-context-lost',detail);
  if(reason==='wait-failed'&&detail.syncValid===false&&detail.contextLost===false&&detail.diagnosticErrors.length===0&&!detail.errors.includes(this.gl.CONTEXT_LOST_WEBGL))reason='wait-failed-invalid-sync';
  return this.fail(reason,detail);
 }
 submit(metadata={}){
  if(!this.canRender()||this.pending)return false;
  const gl=this.gl,generation=this.generation,submittedAt=this._time();
  let handle;
  try{handle=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);}
  catch(error){if(!this._live())return false;return this.fail('fence-create-threw',{error,metadata:serializable(metadata)});}
  if(generation!==this.generation||gl!==this.gl||!this.canRender())return false;
  if(!handle){
   const detail={...this._diagnostics(null),metadata:serializable(metadata)};
   if(detail.contextLost)return this.contextLost('context-lost-during-fence-create',detail);
   return this.fail('fence-create-failed',detail);
  }
  const phase=metadata.phase==='initialization'?'initialization':'frame',waitBudgetMs=phase==='initialization'?this.maxInitializationMs:this.maxWaitMs;
  const pending=this.pending={handle,gl,generation,submittedAt,phase,waitBudgetMs,metadata:serializable(metadata)};
  try{gl.flush();}
  catch(error){return this._rejectPending('fence-flush-threw',pending,null,{error});}
  if(!this._owns(pending)||!this.canRender())return false;
  const detail=this._diagnostics(pending);
  if(!this._owns(pending))return false;
  if(detail.contextLost)return this.contextLost('context-lost-after-fence',detail);
  if(detail.errors.length||detail.diagnosticErrors.length)return this.fail('fence-flush-error',detail);
  if(detail.syncValid!==true)return this.fail('fence-create-invalid-sync',detail);
  this.stats.submitted++;return true;
 }
 poll(){
  if(!this.canRender())return false;
  const pending=this.pending;
  // Readiness is not completion. In particular an empty gate must never invoke
  // onComplete, increment completed, or certify a recovered renderer.
  if(!pending)return true;
  if(!this._owns(pending)){this.release('stale-fence');return this.fail('stale-fence-generation');}
  if(this._time()-pending.submittedAt>=pending.waitBudgetMs)return this._rejectPending(pending.phase==='initialization'?'initialization-timeout':'fence-timeout',pending,null);
  const gl=pending.gl;let status;
  this.stats.polls++;
  try{status=gl.clientWaitSync(pending.handle,0,0);}
  catch(error){return this._rejectPending('fence-wait-threw',pending,null,{error});}
  if(!this._owns(pending))return false;
  // Preserve WAIT_FAILED evidence even when the query observes loss. A loss
  // event which already invalidated ownership takes the no-GL path above.
  if(status===gl.WAIT_FAILED)return this._rejectPending('wait-failed',pending,status);
  if(!this._live())return false;
  if(status===gl.TIMEOUT_EXPIRED){
   this.stats.waitTimeouts++;
   if(this._time()-pending.submittedAt>=pending.waitBudgetMs)return this._rejectPending(pending.phase==='initialization'?'initialization-timeout':'fence-timeout',pending,status);
   return false;
  }
  if(status!==gl.ALREADY_SIGNALED&&status!==gl.CONDITION_SATISFIED)return this._rejectPending(status===gl.WAIT_FAILED?'wait-failed':'unknown-wait-status',pending,status);
  const elapsedMs=Math.max(0,this._time()-pending.submittedAt);
  this.release('completed');
  if(pending.generation!==this.generation||!this.canRender())return false;
  this.stats.completed++;
  if(this.state==='recovering'&&pending.phase!=='initialization'){this.state='active';this._recoveryToken=null;this.stats.recovered++;}
  this.lastCompletion=this._event({reason:pending.phase==='initialization'?'initialization-completed':'fence-completed',phase:pending.phase,status,generation:this.generation,elapsedMs,metadata:pending.metadata});
  this._notify(this.onComplete,this.lastCompletion);return true;
 }
 beginRecovery({manual=false}={}){
  if(this.state!=='lost'&&this.state!=='failed')throw invalid('GPU recovery requires a stopped lifecycle');
  if(this.recoveryAttempts>=this.maxRecoveryAttempts)throw invalid('GPU recovery attempt budget is exhausted');
  // A live WAIT_FAILED is retryable only with positive invalid-sync evidence.
  // Timeout/unknown backlog and valid-but-failing syncs must not be resubmitted.
  if(this.state==='failed'&&(!manual||!this._manualRetryAllowed))throw invalid('This GPU failure is not eligible for a safe manual retry');
  let lost;
  try{lost=this.gl.isContextLost();if(typeof lost!=='boolean')throw new TypeError('Unknown context-loss query result');}catch{throw invalid('Cannot establish that the GPU context is restored');}
  if(lost)throw invalid('Wait for the browser to restore the WebGL context');
  if(this.state==='failed')this.generation++;
  this.recoveryAttempts++;this._stopNotified=false;this._manualRetryAllowed=false;this._attached=false;
  this.state='recovering';this._recoveryToken=this.generation;this.pending=null;
  this._event({reason:'recovery-started',generation:this.generation,manual:!!manual,attempt:this.recoveryAttempts});
  return this.generation;
 }
 attach(gl,token){
  if(token!==this.generation||token!==this._recoveryToken||this.state!=='recovering'||this._attached)throw abort('Rebuilt GPU resources belong to a stale or completed recovery');
  if(!gl||typeof gl.isContextLost!=='function')throw new TypeError('attach requires a rebuilt WebGL2 renderer context');
  if(gl.isContextLost()){this.contextLost('context-lost-during-attach');throw abort('The rebuilt GPU context is already lost');}
  this.gl=gl;this._attached=true;this.state='recovering';
  this._event({reason:'recovery-resources-attached',generation:token});return true;
 }
 snapshot(){
  return serializable({state:this.state,generation:this.generation,highQualityDisabled:this.highQualityDisabled,recoveryAttempts:this.recoveryAttempts,maxRecoveryAttempts:this.maxRecoveryAttempts,
   manualRetryAllowed:this.state==='failed'&&this._manualRetryAllowed&&this.recoveryAttempts<this.maxRecoveryAttempts,recoveryAttached:this._attached,maxWaitMs:this.maxWaitMs,maxInitializationMs:this.maxInitializationMs,
   pendingFence:!!this.pending,pending:this.pending?{phase:this.pending.phase,waitBudgetMs:this.pending.waitBudgetMs,generation:this.pending.generation,submittedAt:this.pending.submittedAt,elapsedMs:Math.max(0,this._time()-this.pending.submittedAt),metadata:this.pending.metadata}:null,
   stats:{...this.stats},lastFailure:this.lastFailure,lastCompletion:this.lastCompletion,events:this.events});
 }
}
