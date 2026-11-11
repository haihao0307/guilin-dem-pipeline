// Shader-source identity and link failure are unchanged. On browsers with
// KHR_parallel_shader_compile, poll completion without blocking the UI task;
// otherwise use the ordinary synchronous link-status check.
export async function waitForGpuPrograms(gl,programs,shaders,{yieldControl=()=>new Promise(resolve=>setTimeout(resolve,16)),now=()=>performance.now(),timeoutMs=300000}={}){
 const started=now(),extension=gl.getExtension('KHR_parallel_shader_compile');let polls=0;
 if(extension){for(;;){if(gl.isContextLost())throw Error('WebGL context lost while compiling programs');if(programs.every(p=>gl.getProgramParameter(p,extension.COMPLETION_STATUS_KHR)))break;if(now()-started>timeoutMs)throw Error('GPU program compilation timed out');polls++;await yieldControl();}}
 for(const p of programs)if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const details=shaders.filter(s=>!gl.getShaderParameter(s,gl.COMPILE_STATUS)).map(s=>gl.getShaderInfoLog(s)).filter(Boolean);throw Error('GPU program link failed: '+gl.getProgramInfoLog(p)+' '+details.join(' '));}
 return{parallelPolling:!!extension,polls,waitMs:now()-started,programs:programs.length,worldFramesPresented:0};
}
