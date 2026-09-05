/* Weather Mother 0.6.2. Data-only periodic evolution and measured performance.
   Looping applies to material-space morphology. Wind, day cycle and precipitation
   retain their own clocks. No image assets and no synthetic FPS counters. */
(function(root){'use strict';
 const TAU=Math.PI*2, mod=x=>((x%1)+1)%1;
 function phaseAdvance(p,dt,seconds,rate=1){if(!Number.isFinite(dt)||dt<0||!Number.isFinite(seconds)||seconds<=0)throw Error('Invalid loop clock');return mod(p+dt*rate/seconds);}
 function loopSignal(phase){const t=TAU*mod(phase);return [Math.cos(t)-1,Math.sin(t),Math.sin(2*t)];}
 function hash(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967296;}
 function pulse(age){if(age<0||age>.65)return 0;return Math.exp(-Math.pow((age-.045)/.026,2))+.64*Math.exp(-Math.pow((age-.16)/.045,2))+.22*Math.exp(-Math.pow((age-.31)/.072,2));}
 function lightning(time,seed,rate,power,enabled,trigger=-1e9){
  let age=time-trigger,eventId=0,hit=age>=0&&age<.65;
  if(!hit&&enabled&&rate>0){const interval=Math.max(2,60/rate),slot=Math.floor(time/interval),start=(slot+.20+.38*hash(seed+slot*1171))*interval;age=time-start;eventId=slot+1;hit=age>=0&&age<.65;}
  const strength=hit?pulse(age)*power:0;
  return{strength,eventId,age,origin:[(hash(seed+eventId*77)-.5)*1.3,4.6+hash(seed+eventId*107)*.7,(hash(seed+eventId*311)-.5)*1.2]};
 }
 function boltSegments(seed,eventId,origin){let segments=[],p=[...origin];const salt=(seed^Math.imul(eventId+1,19349663))>>>0;
  for(let k=0;k<12;k++){const t=(k+1)/12,q=[origin[0]+(hash(salt+k*71)-.5)*.52+t*.22,Math.max(.015,origin[1]*(1-t)),origin[2]+(hash(salt+k*197)-.5)*.38];segments.push([...p,...q,1]);if(k===3||k===6||k===8){let b=[q[0]+(hash(salt+k)-.5)*1.4,q[1]-.55,q[2]+.25];segments.push([...q,...b,.38]);}p=q;}return segments;
 }
 function percentile(a,q){if(!a.length)return null;const v=[...a].sort((x,y)=>x-y);return v[Math.min(v.length-1,Math.floor(q*(v.length-1)))];}
 class FrameStats{
  constructor(gl){this.gl=gl;this.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.queue=[];this.active=null;this.gpu=[];this.cpu=[];this.intervals=[];this.lastComplete=null;this.frames=0;this.disjointSamples=0;this.beginCpu=0;}
  begin(){this.beginCpu=performance.now();if(this.ext&&!this.active&&this.queue.length<4){this.active=this.gl.createQuery();this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,this.active);}}
  end(){this.cpu.push(performance.now()-this.beginCpu);if(this.cpu.length>120)this.cpu.shift();if(this.active){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.queue.push(this.active);this.active=null;}}
  complete(now){this.frames++;if(this.lastComplete!==null){const dt=now-this.lastComplete;if(dt>0&&dt<5000){this.intervals.push(dt);if(this.intervals.length>120)this.intervals.shift();}}this.lastComplete=now;}
  reset(){this.lastComplete=null;this.intervals=[];this.gpu=[];this.cpu=[];}
  poll(){if(!this.ext)return;const g=this.gl;if(g.getParameter(this.ext.GPU_DISJOINT_EXT)){for(const q of this.queue)g.deleteQuery(q);this.disjointSamples+=this.queue.length;this.queue=[];this.gpu=[];return;}while(this.queue.length&&g.getQueryParameter(this.queue[0],g.QUERY_RESULT_AVAILABLE)){const q=this.queue.shift(),ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);if(Number.isFinite(ms)&&ms>0){this.gpu.push(ms);if(this.gpu.length>120)this.gpu.shift();}}}
  read(){let mean=this.intervals.length?this.intervals.reduce((a,b)=>a+b,0)/this.intervals.length:null;return{completedFrames:this.frames,samples:this.intervals.length,renderedFPS:mean?1000/mean:null,frameP50ms:percentile(this.intervals,.5),frameP95ms:percentile(this.intervals,.95),gpuP50ms:percentile(this.gpu,.5),gpuP95ms:percentile(this.gpu,.95),cpuSubmissionP50ms:percentile(this.cpu,.5),gpuTimerAvailable:!!this.ext,discardedDisjointSamples:this.disjointSamples,method:'completed GPU-frame cadence; optional disjoint timer query, never RAF callback FPS'};}
 }
 const api={phaseAdvance,loopSignal,lightning,boltSegments,pulse,percentile,FrameStats};root.WeatherMotion=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
