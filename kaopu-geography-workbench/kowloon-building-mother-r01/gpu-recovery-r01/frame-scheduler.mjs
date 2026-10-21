// Latest-state, on-demand scheduling only. Render is a synchronous atomic dispatch:
// no continuation is allowed to submit an old camera/model after this call returns.
// GPU execution may still be pending; isReady supplies non-blocking backpressure.
export class LatestFrameScheduler {
 constructor({render,isReady=()=>true,requestFrame=globalThis.requestAnimationFrame?.bind(globalThis),cancelFrame=globalThis.cancelAnimationFrame?.bind(globalThis),setTimer=globalThis.setTimeout.bind(globalThis),clearTimer=globalThis.clearTimeout.bind(globalThis),now=()=>performance.now(),settleMs=300,pollMs=24,onError=e=>{throw e;}}={}){
  if(typeof render!=='function'||render.constructor.name==='AsyncFunction')throw Error('Frame dispatch must be synchronous and atomic');
  Object.assign(this,{render,isReady,requestFrame,cancelFrame,setTimer,clearTimer,now,settleMs,pollMs,onError});
  this.revision=0;this.latest=null;this.frame=null;this.poll=null;this.settle=null;this.interacting=false;this.rendering=false;this.disposed=false;this.faulted=false;
  this.stats={requests:0,dispatches:0,coalescedRequests:0,staleCallbacks:0,backpressurePolls:0,invalidations:0,maxPendingCallbacks:0,lastDispatch:null};
 }
 _count(){const n=Number(this.frame!==null)+Number(this.poll!==null)+Number(this.settle!==null);this.stats.maxPendingCallbacks=Math.max(this.stats.maxPendingCallbacks,n);return n;}
 _cancel(name,cancel){const token=this[name];this[name]=null;if(token!==null)cancel(token.id);}
 _cancelSettle(){this._cancel('settle',this.clearTimer);}
 _queue(){
  if(this.disposed||this.faulted||this.frame!==null||this.poll!==null||!this.latest)return;
  const token={id:null};this.frame=token;token.id=this.requestFrame(()=>{if(this.frame!==token){this.stats.staleCallbacks++;return;}this.frame=null;this._dispatch();});this._count();
 }
 _poll(){
  if(this.disposed||this.faulted||this.poll!==null)return;const token={id:null};this.poll=token;token.id=this.setTimer(()=>{if(this.poll!==token){this.stats.staleCallbacks++;return;}this.poll=null;this._queue();},this.pollMs);this._count();
 }
 _armSettle(){
  this._cancelSettle();if(this.interacting||!this.latest||this.latest.quality==='settled')return;
  const revision=this.revision,token={id:null};this.settle=token;
  token.id=this.setTimer(()=>{if(this.settle!==token||revision!==this.revision){this.stats.staleCallbacks++;return;}this.settle=null;this.request({quality:'settled',reason:'interaction-settled'});},this.settleMs);this._count();
 }
 request({quality='interaction',reason='change',settle=quality==='interaction'}={}){
  if(this.disposed||this.faulted)return this.revision;
  if(this.latest&&this.latest.revision>=(this.stats.lastDispatch?.revision??0)+1)this.stats.coalescedRequests++;
  this.stats.requests++;this.latest={revision:++this.revision,quality,reason,requestedAt:this.now()};this._cancelSettle();if(settle)this._armSettle();this._queue();return this.revision;
 }
 beginInteraction(){if(this.disposed||this.faulted)return;this.interacting=true;this._cancelSettle();
  // A settled frame waiting for GPU readiness must not start after a new drag.
  if(this.latest?.quality==='settled')this.request({quality:'interaction',reason:'interaction-start',settle:false});
 }
 endInteraction(){this.interacting=false;if(this.latest?.quality==='interaction')this._armSettle();}
 invalidate(reason='invalidated'){
  this.revision++;this.stats.invalidations++;this.stats.lastInvalidation=reason;this.latest=null;this.interacting=false;
  this._cancel('frame',this.cancelFrame);this._cancel('poll',this.clearTimer);this._cancelSettle();return this.revision;
 }
 _run(ticket){
  if(this.rendering)throw Error('Nested frame dispatch is not supported');
  this.rendering=true;const startedAt=this.now();
  try{
   const result=this.render({...ticket,isCurrent:()=>!this.disposed&&!this.faulted&&ticket.revision===this.revision});
   if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw Error('Async frame dispatch is unsupported; no further frames will be scheduled');}
   if(ticket.revision!==this.revision)throw Error('Scene revision changed inside an atomic frame dispatch');
   this.stats.dispatches++;this.stats.lastDispatch={revision:ticket.revision,quality:ticket.quality,reason:ticket.reason,requestToDispatchStartMs:startedAt-ticket.requestedAt,dispatchWallMs:this.now()-startedAt,result:result??null};
   return result;
  }finally{this.rendering=false;}
 }
 _dispatch(){
  if(!this.latest||this.disposed||this.faulted)return;
  try{if(!this.isReady()){this.stats.backpressurePolls++;this._poll();return;}if(this.disposed||this.faulted||!this.latest)return;const ticket=this.latest;if(ticket.revision===(this.stats.lastDispatch?.revision??-1))return;this._run(ticket);}
  catch(e){this.faulted=true;this.invalidate('dispatch-error');this.onError(e);}
 }
 flush({quality='manual',reason='explicit-render'}={}){
  if(this.disposed||this.faulted)throw Error('Frame scheduler is unavailable');this.invalidate(reason);
  const ticket=this.latest={revision:this.revision,quality,reason,requestedAt:this.now()};
  try{return this._run(ticket);}catch(e){this.faulted=true;this.invalidate('dispatch-error');throw e;}
 }
 snapshot(){return {mode:'on-demand latest-state coalescing; no animation loop or frame-rate claim',revision:this.revision,interacting:this.interacting,rendering:this.rendering,faulted:this.faulted,pendingFrame:this.frame!==null,pendingReadinessPoll:this.poll!==null,pendingSettle:this.settle!==null,pendingCallbacks:this._count(),pendingRevision:this.latest?.revision??null,pendingQuality:this.latest?.quality??null,settleDelayMs:this.settleMs,readinessPollDelayMs:this.pollMs,...structuredClone(this.stats),timingMeaning:'requestToDispatchStartMs is latest request to JavaScript dispatch start; dispatchWallMs is synchronous callback wall time, sometimes including driver work. Neither measures isolated GPU time or visible presentation latency.'};}
 dispose(){this.invalidate('disposed');this.disposed=true;}
}
