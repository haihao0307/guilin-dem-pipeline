// Diagnostic-only: captured actual shader; one fresh default-framebuffer context per stage.
async function runBoilerIsolatedProbes(input){
 const out={diagnosticOnly:true,wholeFrameAccepted:false,stages:[]};
 for(const name of ['constant','scalar','range','post_hit_shading','interval_search_only']){
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=400;document.body.append(canvas);
  const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true});if(!gl)throw Error('No WebGL2 for '+name);
  const ext=gl.getExtension('WEBGL_debug_renderer_info'),stage={name,nativeBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),contextLostEvent:false};canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stage.contextLostEvent=true});
  const started=performance.now(),emit=phase=>window.reportBoilerProbe({...stage,phase,elapsedMs:performance.now()-started});await emit('compile-start');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  const program=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,input.vertex),fs=shader(gl.FRAGMENT_SHADER,input.probes[name]);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));stage.linkedMs=performance.now()-started;await emit('linked');
  gl.useProgram(program);for(const [key,u] of Object.entries(input.firstDraw.uniforms)){const loc=gl.getUniformLocation(program,key);if(loc!==null)gl[u.method](loc,...u.args)}
  for(const [key,value]of Object.entries({probePoint:[0,3.3,3.11],probeLower:[-.001,3.299,3.109],probeUpper:[.001,3.301,3.111]})){const loc=gl.getUniformLocation(program,key);if(loc!==null)gl.uniform3fv(loc,value)}
  const hitLocation=gl.getUniformLocation(program,'probeHit');if(hitLocation!==null)gl.uniform1f(hitLocation,11.517797470092773);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindVertexArray(null);gl.viewport(...input.firstDraw.viewport);gl.disable(gl.SCISSOR_TEST);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.clearDepth(1);gl.clearColor(.075,.1,.14,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.SCISSOR_TEST);gl.scissor(...input.nativePixel,1,1);
  const clearPixel=new Uint8Array(4);gl.readPixels(...input.nativePixel,1,1,gl.RGBA,gl.UNSIGNED_BYTE,clearPixel);stage.clearRGBA=Array.from(clearPixel);
  await emit('before-draw');const drawStart=performance.now();gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();const rgba=new Uint8Array(4);gl.readPixels(...input.nativePixel,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);stage.finishAndReadMs=performance.now()-drawStart;stage.rgba=Array.from(rgba);stage.immediateError=gl.getError();stage.immediateContextLost=gl.isContextLost();await emit('after-finish');
  await new Promise(r=>setTimeout(r,500));stage.contextLostAfterTurn=gl.isContextLost();stage.elapsedMs=performance.now()-started;
  const valid=stage.immediateError===gl.NO_ERROR&&!stage.immediateContextLost&&!stage.contextLostEvent&&!stage.contextLostAfterTurn&&rgba[3]===255;
  const expected=name==='constant'?[64,128,191,255]:['scalar','range'].includes(name)?[255,255,0,255]:name==='interval_search_only'?[255,37,0,255]:null;
  stage.pixelChanged=rgba.slice(0,3).some((v,i)=>Math.abs(v-clearPixel[i])>1);stage.validReadback=valid;stage.expectedRGBA=expected;stage.expectedMatched=expected?rgba.every((v,i)=>Math.abs(v-expected[i])<=1):null;stage.passed=valid&&(expected===null?stage.pixelChanged:stage.expectedMatched);out.stages.push(stage);await emit('event-turn-checked');
  gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);canvas.remove();
  if(!stage.passed){out.status='DIAGNOSTIC_STAGE_FAILED';out.failedStage=name;return out}
 }
 out.status='DIAGNOSTIC_STAGES_RETURNED_NOT_WHOLE_FRAME';return out;
}
