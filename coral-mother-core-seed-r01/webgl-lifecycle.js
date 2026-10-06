/* Generic WebGL lifetime guards. No artwork source or assets. */
(()=>{'use strict';const state=window.CoralGLState={version:'coral-gl-lifecycle-r05',created:0,released:0,lost:0,active:0,peak:0,events:[]},known=new WeakSet();
function note(type,label,detail=''){state.events.push({type,label,detail,time:Date.now()});if(state.events.length>32)state.events.shift()}
function problem(message,stage,detail={}){const e=new Error('['+stage+'] '+message);e.gpuRecoverable=true;e.stage=stage;if(stage==='context-lost')e.contextLost=true;Object.assign(e,detail);return e}
function check(gl,stage){if(!gl||gl.isContextLost())throw problem('图形上下文已失效',stage,{contextLost:true});const code=gl.getError();if(code!==gl.NO_ERROR)throw problem('WebGL '+code,stage,{contextLost:false,glError:code})}
function context(canvas,label){
 let detail='';canvas.addEventListener('webglcontextcreationerror',e=>{detail=e.statusMessage||'';note('creation-error',label,detail)},{once:true});
 const options={alpha:false,antialias:false,preserveDrawingBuffer:true},gl=canvas.getContext('webgl2',options);
 const unavailable=()=>{const contextLost=gl?gl.isContextLost():null,extra={contextLost,providerStatus:detail,contextResult:gl?'lost':'null'};note('creation-failed',label,extra);return problem('WebGL2 未就绪'+(detail?'：'+detail:''),'context-create',extra)};
 if(!gl)throw unavailable();
 known.add(gl);state.created++;state.active++;state.peak=Math.max(state.peak,state.active);note('created',label);
 // Register retirement guards before any capability query can fail. Replacement owners never request restoration.
 canvas.addEventListener('webglcontextlost',()=>{state.lost++;note(known.has(gl)?'unexpected-lost':'retired-lost',label)});
 canvas.addEventListener('webglcontextrestored',()=>{if(!known.has(gl)){try{const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();canvas.width=canvas.height=1;note('retired-context-restored-and-released',label)}catch(_){}}});
 try{if(gl.isContextLost())throw unavailable();const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);if(!precision)throw problem('WebGL2 精度查询未返回有效结果','context-capability',{contextLost:gl.isContextLost(),providerStatus:detail});return gl}catch(e){dispose(gl,label);throw e}
}
function shader(gl,type,source){check(gl,'before-create-shader');const s=gl.createShader(type);if(!s)throw problem('着色器资源创建失败；等待图形上下文恢复','create-shader');try{gl.shaderSource(s,source);gl.compileShader(s);if(gl.isContextLost())throw problem('编译期间图形上下文失效','compile');if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'着色器编译失败');return s}catch(e){if(!gl.isContextLost())gl.deleteShader(s);throw e}}
function dispose(gl,label){if(!gl||!known.has(gl))return;known.delete(gl);state.active=Math.max(0,state.active-1);state.released++;note('released',label);try{gl.canvas.width=gl.canvas.height=1}catch(_){}if(!gl.isContextLost()){try{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindVertexArray(null);gl.useProgram(null);const ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext()}catch(_){}}}
function fresh(canvas){const replacement=canvas.cloneNode(false);replacement.width=replacement.height=1;canvas.replaceWith(replacement);return replacement}
function recovery(owner){
 const delays=[1000,3000,7000],data=owner.recovery={limit:delays.length,budget:delays.length,attempts:0,episode:0,status:'idle',nextDelayMs:null,healthySince:null,healthyFrames:0,episodeFirstFailure:null};
 owner.failureHistory=[];
 const now=()=>performance.now();
 function reset(reason){data.budget=delays.length;data.attempts=0;data.episode++;data.status='idle';data.nextDelayMs=null;data.healthySince=null;data.healthyFrames=0;data.episodeFirstFailure=null;data.resetReason=reason;data.resetAt=Date.now()}
 function failed(error,details={}){const record={time:Date.now(),monotonicMs:now(),stage:error?.stage||'javascript',message:String(error?.message||error),glError:error?.glError??null,contextLost:error?.contextLost??null,providerStatus:error?.providerStatus??null,contextResult:error?.contextResult??null,episode:data.episode,retryAttempt:data.attempts,...details};owner.firstFailure??=record;owner.lastFailure=record;owner.failureHistory.push(record);if(owner.failureHistory.length>16)owner.failureHistory.shift();data.episodeFirstFailure??=record;data.healthySince=null;data.healthyFrames=0;data.status='failed';data.nextDelayMs=null;return record}
 function next(){if(data.budget<=0){data.status='exhausted';return null}const delay=delays[data.attempts];data.budget--;data.attempts++;data.status='waiting';data.nextDelayMs=delay;return delay}
 function attempting(){data.status='rebuilding';data.nextDelayMs=null}
 function cancel(){data.status='suspended';data.nextDelayMs=null;data.healthySince=null;data.healthyFrames=0}
 function completed(){const t=now();if(data.healthySince===null)data.healthySince=t;data.healthyFrames++;data.status='healthy';if(data.budget<delays.length&&t-data.healthySince>=30000&&data.healthyFrames>=30){const frames=data.healthyFrames,since=data.healthySince;reset('healthy-30s-30frames');data.status='healthy';data.lastHealthyWindow={since,until:t,completedFrames:frames}}}
 function message(){const first=data.episodeFirstFailure,last=owner.lastFailure;return first&&last&&first!==last?first.message+'；最近恢复失败：'+last.message:last?.message||''}
 return{data,reset,failed,next,attempting,cancel,completed,message};
}
window.CoralGL={state,check,context,shader,dispose,fresh,problem,recovery,alive:gl=>known.has(gl)};
})();
