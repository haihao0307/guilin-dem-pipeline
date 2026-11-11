// Nonblocking completion polling. A message task separates timer polls so the
// display loop yields to the browser rather than spinning or queuing fake frames.
export class GpuFenceScheduler{
 constructor(){this.channel=new MessageChannel();this.queue=[];this.closed=false;this.polls=0;this.waits=0;this.channel.port1.onmessage=()=>{const entry=this.queue.shift();if(entry)setTimeout(()=>this.closed?entry.reject(Error('GPU scheduler disposed')):entry.resolve(),1);};}
 yield(){if(this.closed)return Promise.reject(Error('GPU scheduler disposed'));return new Promise((resolve,reject)=>{this.queue.push({resolve,reject});this.channel.port2.postMessage(0);});}
 async wait(gl,timeoutMs=90000){if(this.closed)throw Error('GPU scheduler disposed');const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('GPU completion fence unavailable');gl.flush();const started=performance.now();this.waits++;try{for(;;){this.polls++;const status=gl.clientWaitSync(sync,0,0);if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;if(status===gl.WAIT_FAILED||gl.isContextLost())throw Error('GPU completion fence failed');if(performance.now()-started>timeoutMs)throw Error('GPU completion timeout');await this.yield();}}finally{gl.deleteSync(sync);}}
 report(){return{waits:this.waits,polls:this.polls,mode:'message-separated-timer',blockingSpin:false,countsGpuCompletedFrames:true};}
 dispose(){this.closed=true;for(const entry of this.queue)entry.reject(Error('GPU scheduler disposed'));this.queue=[];this.channel.port1.close();this.channel.port2.close();}
}
