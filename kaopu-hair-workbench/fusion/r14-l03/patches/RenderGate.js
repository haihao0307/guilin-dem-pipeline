/** L03: one submitted WebGL2 frame, explicit pause/dispose and bounded metrics.
 * No quality, draw order, shader or pixel-ratio changes. Never gl.finish(). */
export class RenderGate {
 constructor({draw,getGL,canDraw=()=>true,onError=console.error,schedule=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id)}){Object.assign(this,{draw,getGL,canDraw,onError,schedule,cancel});this.requested=0;this.submitted=0;this.completed=0;this.draws=0;this.generation=0;this.ticket=null;this.fence=null;this.gl=null;this.failure=null;this.paused=false;this.disposed=false;this.history=[];}
 request(){if(this.disposed||!this.canDraw())return;this.requested++;this.queue();}
 queue(){if(!this.paused&&!this.disposed&&this.ticket===null)this.ticket=this.schedule(()=>{this.ticket=null;this.pump()});}
 pump(){try{
  if(this.disposed||this.paused)return;
  if(!this.canDraw()){this.reset();return;}
  const gl=this.getGL();if(!gl||gl.isContextLost())throw Error('WebGL context unavailable');
  if(this.fence){const status=gl.clientWaitSync(this.fence,0,0);if(status===gl.TIMEOUT_EXPIRED){this.queue();return;}if(status===gl.WAIT_FAILED)throw Error('GPU frame fence failed');gl.deleteSync(this.fence);this.fence=null;this.completed=this.submitted;const entry=this.history.at(-1);if(entry)entry.fenceObservedMs=performance.now();}
  if(this.completed>=this.requested)return;
  if(typeof gl.fenceSync!=='function')throw Error('WebGL2 frame synchronization unavailable');
  this.submitted=this.requested;const begin=performance.now();this.draw();this.draws++;
  this.history.push({frame:this.draws,beginMs:begin,submissionEndMs:performance.now(),fenceObservedMs:null});if(this.history.length>16)this.history.shift();
  if(!this.canDraw()||gl.isContextLost()){this.reset();return;}
  this.gl=gl;this.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!this.fence)throw Error('GPU frame fence creation failed');gl.flush();this.queue();
 }catch(error){this.failure=String(error.message||error);this.clearPending();if(!this.disposed)this.onError(error);}}
 clearPending(){if(this.ticket!==null)this.cancel(this.ticket);this.ticket=null;if(this.fence&&this.gl){try{this.gl.deleteSync(this.fence);}catch{}}this.fence=null;this.gl=null;}
 pause(){this.paused=true;if(this.ticket!==null)this.cancel(this.ticket);this.ticket=null;}
 resume(){if(this.disposed)return;this.paused=false;if(this.fence||this.completed<this.requested)this.queue();}
 reset(){this.clearPending();this.generation++;this.completed=this.requested;this.submitted=this.requested;this.failure=null;}
 dispose(){if(this.disposed)return;this.disposed=true;this.reset();}
 async wait(timeoutMs=180000){const goal=this.requested,generation=this.generation,start=Date.now();for(;;){if(this.disposed||this.generation!==generation)throw new DOMException('Render wait cancelled by graphics lifecycle','AbortError');if(this.failure)throw Error(this.failure);if(this.completed>=goal)return this.diagnostics();if(Date.now()-start>timeoutMs)throw Error('GPU render completion timeout');await new Promise(resolve=>setTimeout(resolve,16));}}
 diagnostics(){return{mode:'webgl2-fence-coalescing-lifecycle',requests:this.requested,submitted:this.submitted,completed:this.completed,draws:this.draws,pending:!!this.fence,generation:this.generation,failure:this.failure,paused:this.paused,disposed:this.disposed,frames:this.history.map(x=>({...x})),timingMeaning:'CPU submission and wall time until GPU fence observed, NOT GPU-only duration'};}
}
