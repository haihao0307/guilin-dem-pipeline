// One immutable program set per renderer/context. Readiness does not represent
// a world frame, geometry preparation, or permission to reduce display detail.
export class GpuProgramReadiness{
 constructor(){this.ready=false;this.pending=null;this.runs=0;this.warmupMs=0;this.disposed=false;}
 async run(warm){if(this.disposed)throw Error('Disposed GPU program set');if(this.ready)return this.report();if(this.pending)return this.pending;const begin=performance.now();this.runs++;
  this.pending=(async()=>{try{await warm();if(this.disposed)throw Error('Disposed during GPU program preparation');this.ready=true;this.warmupMs=performance.now()-begin;return this.report();}finally{this.pending=null;}})();return this.pending;
 }
 report(){return{ready:this.ready,pending:!this.ready&&!!this.pending,runs:this.runs,warmupMs:this.warmupMs,worldFramesPresented:0,geometryAuthorityChanged:false};}
 dispose(){this.disposed=true;this.ready=false;}
}
