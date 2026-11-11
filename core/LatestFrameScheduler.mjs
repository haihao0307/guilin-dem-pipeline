// One in-flight evaluation and one latest pending request. No FIFO of old views.
export class LatestFrameScheduler{
 constructor(draw,{schedule=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id),now=()=>performance.now(),onError=()=>{},eagerWaiters=true}={}){
  this.draw=draw;this.schedule=schedule;this.cancelSchedule=cancel;this.now=now;this.onError=onError;this.eagerWaiters=eagerWaiters;this.requested=0;this.completed=0;this.frames=0;this.coalesced=0;this.coveredPendingCameraFrames=0;this.running=false;this.disposed=false;this.scheduled=null;this.pending=null;this.waiters=[];this.idleWaiters=[];this.history=[];
 }
 request(meta={},wait=true){
  if(this.disposed)return wait?Promise.reject(Error('Disposed frame scheduler')):undefined;
  const revision=++this.requested,requiresEvaluation=!!this.pending?.requiresEvaluation||wait||meta.reason!=='camera';if(this.pending)this.coalesced++;this.pending={...meta,revision,requestedAt:this.now(),requiresEvaluation};
  const promise=wait?new Promise((resolve,reject)=>this.waiters.push({revision,resolve,reject})):undefined;
  if(wait&&this.eagerWaiters&&!this.running){if(this.scheduled!==null)this.cancelSchedule(this.scheduled);this.scheduled=null;void this.run();}else this.arm();return promise;
 }
 arm(){if(this.running||this.scheduled!==null||!this.pending||this.disposed)return;this.scheduled=this.schedule(()=>{this.scheduled=null;void this.run();});}
 async run(){
  if(this.running||this.disposed||!this.pending)return;const request=this.pending;this.pending=null;this.running=true;const started=this.now();
  try{const value=await this.draw(request);let covered=request.revision;
   // Preparation can finish after many camera events. If the actual draw
   // already captured all of them, a second identical frame is unnecessary.
   if(this.pending&&!this.pending.requiresEvaluation&&Number.isFinite(value?.cameraRevision)&&Number.isFinite(this.pending.cameraRevision)&&this.pending.cameraRevision<=value.cameraRevision){covered=this.pending.revision;this.pending=null;this.coveredPendingCameraFrames++;}
   this.completed=covered;this.frames++;const record={revision:covered,sourceRequestRevision:request.revision,requestedAt:request.requestedAt,startedAt:started,presentedAt:this.now(),reason:request.reason||'render',cameraRevision:value?.cameraRevision??null,cameraInputAt:value?.cameraInputAt??null};this.history.push(record);if(this.history.length>120)this.history.shift();
   const done=this.waiters.filter(w=>w.revision<=covered);this.waiters=this.waiters.filter(w=>w.revision>covered);for(const w of done)w.resolve(value);
  }catch(error){this.pending=null;for(const w of this.waiters)w.reject(error);this.waiters=[];this.onError(error);}
  // A GPU-completed frame already yielded to input. Begin the newest pending
  // evaluation without paying for an additional display-refresh interval.
  finally{this.running=false;if(this.pending)queueMicrotask(()=>void this.run());else this.resolveIdle();}
 }
 whenIdle(){return !this.running&&!this.pending&&this.scheduled===null?Promise.resolve():new Promise(resolve=>this.idleWaiters.push(resolve));}
 resolveIdle(){if(!this.running&&!this.pending&&this.scheduled===null){for(const r of this.idleWaiters)r();this.idleWaiters=[];}}
 report(){return{requested:this.requested,completed:this.completed,frames:this.frames,coalesced:this.coalesced,coveredPendingCameraFrames:this.coveredPendingCameraFrames,inFlight:this.running?1:0,pending:this.pending?1:0,waitingCallers:this.waiters.length,history:this.history.map(x=>({...x}))};}
 dispose(){if(this.disposed)return;this.disposed=true;if(this.scheduled!==null)this.cancelSchedule(this.scheduled);this.scheduled=null;this.pending=null;for(const w of this.waiters)w.reject(Error('Disposed frame scheduler'));this.waiters=[];this.resolveIdle();}
}
