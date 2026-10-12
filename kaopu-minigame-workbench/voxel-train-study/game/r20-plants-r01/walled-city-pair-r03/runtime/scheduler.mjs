/**
 * DOM-free, single-owner cooperative queue for persistent GPU contexts.
 *
 * enqueue(snapshot, execute, {targetSubmissionMs=12, maxSubmissions=Infinity, maxStagesPerSubmission=4})
 * returns {id, epoch, snapshot, done, cancel}. New work replaces all older work.
 * done always resolves to completed/cancelled/failed, after reverse-order cleanup.
 * execute receives {snapshot, epoch, limits, checkpoint, submit, deferCleanup, isCurrent}.
 * submit(label, operation, metadata) must await REAL queue/readback completion;
 * operation must not launch unawaited work. A submitted GPU batch cannot be killed.
 * Batched operations declare metadata.stages; the 1..4 stage hard cap is checked
 * before submission. Per-batch totals report actual completion and overruns.
 * Pause/cancel apply before and after that completion. Pause retains resources and
 * the frozen world/camera snapshot; replacement cannot use shared buffers until
 * its predecessor finishes its submitted stage and cleanup. No rAF/world clock.
 * targetSubmissionMs is a measured wall-completion target, NOT a GPU deadline.
 * Finite maxSubmissions cancels before an extra submission, with submission-limit.
 */
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const immutableSnapshot=value=>freeze(structuredClone(value));
const yieldToHost=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>{
 const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);
});
// Rounded measured wall-completion priors from actual run 38246893383. These
// include the old queue round-trip floor; they predict grouping, not GPU time.
export const CANDIDATE_STAGE_PRIORS_MS=freeze({geo0:2.81,geo1:2.56,geo2:2.47,geo3:2.51,geo4:5.19,geo5:2.32,geo6:2.23,query:2.22,material:2.47});
export const CANDIDATE_STAGE_GROUPS=freeze([['geo0','geo1','geo2','geo3'],['geo4'],['geo5','geo6','query','material']]);
export const COUNTER_INTERVAL_ROUNDS=16;
function checkBatchLimits(targetSubmissionMs,maxStagesPerSubmission){
 if(!Number.isFinite(targetSubmissionMs)||targetSubmissionMs<=0)throw new RangeError('targetSubmissionMs must be positive');
 if(!Number.isInteger(maxStagesPerSubmission)||maxStagesPerSubmission<1||maxStagesPerSubmission>4)throw new RangeError('maxStagesPerSubmission must be an integer from 1 to 4');
}
export function planCandidateBatches({targetSubmissionMs=12,maxStagesPerSubmission=4}={}){
 checkBatchLimits(targetSubmissionMs,maxStagesPerSubmission);const batches=[];
 for(const group of CANDIDATE_STAGE_GROUPS){
  let stages=[],predictedCompletionMs=0;
  const flush=()=>{if(stages.length){batches.push({stages,label:stages.join('+'),predictedCompletionMs});stages=[];predictedCompletionMs=0;}};
  for(const stage of group){const estimate=CANDIDATE_STAGE_PRIORS_MS[stage];if(stages.length&&(stages.length===maxStagesPerSubmission||predictedCompletionMs+estimate>targetSubmissionMs))flush();stages.push(stage);predictedCompletionMs+=estimate;}
  flush();
 }
 return freeze(batches);
}
export function* candidateRoundWindows(maxIterations){
 if(!Number.isSafeInteger(maxIterations)||maxIterations<1)throw new RangeError('maxIterations must be a positive integer');
 for(let offset=0;offset<maxIterations;offset+=COUNTER_INTERVAL_ROUNDS)yield {offset,count:Math.min(COUNTER_INTERVAL_ROUNDS,maxIterations-offset)};
}

class Cancelled extends Error {constructor(reason){super(reason);this.reason=reason;}}
const publicError=e=>({name:e?.name??'Error',message:e?.message??String(e)});

export class CooperativeScheduler {
 #active=null;#pending=null;#epoch=0;#nextId=0;#paused=false;#disposed=false;#draining=false;#waiters=new Set();#lastResult=null;
 constructor({targetSubmissionMs=12,now=()=>performance.now(),yieldControl=yieldToHost,onState=()=>{}}={}){
  if(!Number.isFinite(targetSubmissionMs)||targetSubmissionMs<=0)throw new RangeError('targetSubmissionMs must be positive');
  this.targetSubmissionMs=targetSubmissionMs;this.now=now;this.yieldControl=yieldControl;this.onState=onState;
 }
 get state(){return {paused:this.#paused,disposed:this.#disposed,epoch:this.#epoch,active:this.#publicJob(this.#active),pending:this.#publicJob(this.#pending),lastResult:this.#lastResult};}
 #publicJob(job){return job?{id:job.id,epoch:job.epoch,snapshot:job.snapshot,status:job.status,cancelReason:job.cancelReason??null,...structuredClone(job.metrics)}:null;}
 #notify(){this.onState(this.state);}
 #wake(){for(const resolve of this.#waiters)resolve();this.#waiters.clear();}
 #current(job){return !this.#disposed&&!job.cancelReason&&job.epoch===this.#epoch;}
 #assert(job){if(!this.#current(job))throw new Cancelled(job.cancelReason??(this.#disposed?'disposed':'superseded'));}
 async #checkpoint(job){
  this.#assert(job);
  while(this.#paused){job.status='paused';this.#notify();this.#assert(job);if(!this.#paused)continue;await new Promise(resolve=>this.#waiters.add(resolve));this.#assert(job);}
  job.status='running';this.#assert(job);
 }
 #finish(job,status,extra={}){
  const result=freeze({id:job.id,epoch:job.epoch,status,snapshot:job.snapshot,metrics:structuredClone(job.metrics),...extra});
  this.#lastResult=result;job.resolve(result);return result;
 }
 enqueue(snapshot,execute,{targetSubmissionMs=this.targetSubmissionMs,maxSubmissions=Infinity,maxStagesPerSubmission=4}={}){
  if(this.#disposed)throw new Error('scheduler disposed');
  if(typeof execute!=='function')throw new TypeError('execute must be a function');
  checkBatchLimits(targetSubmissionMs,maxStagesPerSubmission);
  if(maxSubmissions!==Infinity&&(!Number.isSafeInteger(maxSubmissions)||maxSubmissions<1))throw new RangeError('maxSubmissions must be a positive integer');
  const frozen=immutableSnapshot(snapshot);
  if(this.#pending){this.#pending.cancelReason='superseded';this.#finish(this.#pending,'cancelled',{reason:'superseded'});}
  if(this.#active){this.#active.cancelReason='superseded';this.#active.status='cancelling';}
  const job={id:++this.#nextId,epoch:++this.#epoch,snapshot:frozen,execute,cleanups:[],status:'queued',maxSubmissions,limits:freeze({targetSubmissionMs,maxSubmissions,maxStagesPerSubmission}),metrics:{targetSubmissionMs,maxStagesPerSubmission,maximumStagesPerSubmissionObserved:0,submittedStageCount:0,pendingStage:null,inFlight:false,submissionCount:0,completionCount:0,lastCompletion:null,maximumSubmissionCompletionMs:0,maximumOverBudgetMs:0,overBudgetSubmissions:0,stageTotals:{}}};
  const done=new Promise(resolve=>{job.resolve=resolve;});this.#pending=job;this.#notify();this.#wake();
  if(!this.#draining){this.#draining=true;queueMicrotask(()=>this.#drain());}
  return Object.freeze({id:job.id,epoch:job.epoch,snapshot:frozen,done,cancel:(reason='host-cancel')=>this.cancel(reason,job.id)});
 }
 pause(){if(!this.#disposed){this.#paused=true;this.#notify();}return this.state;}
 resume(){if(!this.#disposed){this.#paused=false;this.#wake();this.#notify();}return this.state;}
 cancel(reason='host-cancel',id){
  reason=String(reason);let changed=false;
  if(this.#pending&&(id===undefined||this.#pending.id===id)){const job=this.#pending;job.cancelReason=reason;this.#pending=null;this.#finish(job,'cancelled',{reason});changed=true;}
  if(this.#active&&(id===undefined||this.#active.id===id)&&!this.#active.cancelReason){this.#active.cancelReason=reason;this.#active.status='cancelling';changed=true;}
  if(changed){this.#wake();this.#notify();}return this.state;
 }
 dispose(){if(!this.#disposed){this.cancel('disposed');this.#disposed=true;this.#wake();this.#notify();}return this.state;}
 async #submit(job,label,operation,metadata={}){
  await this.#checkpoint(job);this.#assert(job);
  if(job.metrics.submissionCount>=job.maxSubmissions)throw new Cancelled('submission-limit');
  if(job.metrics.inFlight)throw new Error('concurrent submissions are not supported');
  const stages=metadata.stages??[label];if(!Array.isArray(stages)||!stages.length||stages.some(stage=>typeof stage!=='string'))throw new TypeError('metadata.stages must be a nonempty array of stage names');
  if(stages.length>job.limits.maxStagesPerSubmission)throw new RangeError('submission exceeds maxStagesPerSubmission');
  const m=job.metrics,start=this.now();m.pendingStage={label,...structuredClone(metadata),stageCount:stages.length};m.inFlight=true;m.submissionCount++;m.submittedStageCount+=stages.length;m.maximumStagesPerSubmissionObserved=Math.max(m.maximumStagesPerSubmissionObserved,stages.length);this.#notify();
  let value,operationError;
  try{value=await operation();}catch(e){operationError=e;}
  const completionMs=Math.max(0,this.now()-start),overBudgetMs=Math.max(0,completionMs-m.targetSubmissionMs);
  m.inFlight=false;m.completionCount++;m.lastCompletion={...m.pendingStage,completionMs,overBudgetMs,submission:m.submissionCount};m.pendingStage=null;
  m.maximumSubmissionCompletionMs=Math.max(m.maximumSubmissionCompletionMs,completionMs);m.maximumOverBudgetMs=Math.max(m.maximumOverBudgetMs,overBudgetMs);if(overBudgetMs>0)m.overBudgetSubmissions++;
  const aggregate=m.stageTotals[label]??={stages:[...stages],submissions:0,totalCompletionMs:0,maximumCompletionMs:0,maximumOverBudgetMs:0,overBudgetSubmissions:0};aggregate.submissions++;aggregate.totalCompletionMs+=completionMs;aggregate.maximumCompletionMs=Math.max(aggregate.maximumCompletionMs,completionMs);aggregate.maximumOverBudgetMs=Math.max(aggregate.maximumOverBudgetMs,overBudgetMs);if(overBudgetMs>0)aggregate.overBudgetSubmissions++;
  this.#notify();if(operationError)throw operationError;
  this.#assert(job);await this.yieldControl();await this.#checkpoint(job);this.#assert(job);return value;
 }
 async #drain(){
  try{while(this.#pending){
   const job=this.#pending;this.#pending=null;this.#active=job;let status='completed',extra;
   this.#notify();
   try{
    await this.#checkpoint(job);this.#assert(job);
    const context=Object.freeze({id:job.id,epoch:job.epoch,snapshot:job.snapshot,limits:job.limits,isCurrent:()=>this.#current(job),checkpoint:()=>this.#checkpoint(job),submit:(label,operation,metadata)=>this.#submit(job,label,operation,metadata),deferCleanup:cleanup=>{if(typeof cleanup!=='function')throw new TypeError('cleanup must be a function');job.cleanups.push(cleanup);},metrics:()=>structuredClone(job.metrics)});
    const value=await job.execute(context);await this.#checkpoint(job);this.#assert(job);extra={value};
   }catch(e){if(e instanceof Cancelled){status='cancelled';extra={reason:e.reason};}else{status='failed';extra={error:publicError(e)};}}
   job.status='cleaning';this.#notify();const cleanupErrors=[];
   for(const cleanup of job.cleanups.reverse()){try{await cleanup();}catch(e){cleanupErrors.push(publicError(e));}}
   if(cleanupErrors.length){extra={...extra,cleanupErrors};if(status==='completed')status='failed';}
   this.#active=null;this.#finish(job,status,extra);this.#notify();
  }}finally{this.#draining=false;}
 }
}
