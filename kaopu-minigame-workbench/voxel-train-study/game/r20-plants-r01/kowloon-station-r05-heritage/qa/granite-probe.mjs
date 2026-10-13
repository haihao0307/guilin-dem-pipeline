// Actual GPU comparison only. Original GLSL and port run in separate programs.
const result={status:'running',phase:'loading',errors:[],scope:'finite original-kind2 source fidelity and footprint response; not visual acceptance'};window.__graniteProbe=result;
const stage=name=>{result.phase=name;console.log('GRANITE_PROBE_STAGE '+name);};
const vertex='#version 300 es\nprecision highp float;void main(){vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));gl_Position=vec4(p[gl_VertexID],0,1);}';
async function get(name,json=false){const r=await fetch('./granite-probe-generated/'+name);if(!r.ok)throw Error(name+': HTTP '+r.status);return json?r.json():r.text();}
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s;}
async function program(gl,fragment,label){
 const p=gl.createProgram(),v=shader(gl,gl.VERTEX_SHADER,vertex),f=shader(gl,gl.FRAGMENT_SHADER,fragment);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
 const started=performance.now(),parallel=gl.getExtension('KHR_parallel_shader_compile');if(parallel)while(!gl.getProgramParameter(p,parallel.COMPLETION_STATUS_KHR)){if(performance.now()-started>240000)throw Error(label+' compile exceeded240000ms');await new Promise(r=>setTimeout(r,25));}
 const log={label,vertexOK:gl.getShaderParameter(v,gl.COMPILE_STATUS),fragmentOK:gl.getShaderParameter(f,gl.COMPILE_STATUS),linkOK:gl.getProgramParameter(p,gl.LINK_STATUS),vertexLog:gl.getShaderInfoLog(v),fragmentLog:gl.getShaderInfoLog(f),linkLog:gl.getProgramInfoLog(p)};
 result.compilation.push(log);if(!log.vertexOK||!log.fragmentOK||!log.linkOK)throw Error(JSON.stringify(log));gl.deleteShader(v);gl.deleteShader(f);return p;
}
function draw(gl,p,width,height,reference){
 gl.useProgram(p);const blocks=gl.getProgramParameter(p,gl.ACTIVE_UNIFORM_BLOCKS);let ub;
 if(blocks){if(blocks!==1||gl.getActiveUniformBlockParameter(p,0,gl.UNIFORM_BLOCK_DATA_SIZE)!==80)throw Error('Unexpected uniform block');ub=gl.createBuffer();gl.bindBuffer(gl.UNIFORM_BUFFER,ub);gl.bufferData(gl.UNIFORM_BUFFER,new Float32Array(20),gl.STATIC_DRAW);gl.uniformBlockBinding(p,0,0);gl.bindBufferBase(gl.UNIFORM_BUFFER,0,ub);}
 if(reference){const loc=n=>gl.getUniformLocation(p,n);gl.uniform1f(loc('uColorSeed'),8632);gl.uniform1f(loc('uPoreSeed'),8538);gl.uniform1f(loc('uWeatherSeed'),8832);gl.uniform1i(loc('sKind'),2);gl.uniform1i(loc('uEventCount'),0);gl.uniform4f(loc('sSurface'),1,.7,.13,-.01);gl.uniform4f(loc('sDisplay'),0,0,0,1);gl.uniform1f(loc('sRelief'),1);}
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,height);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Float framebuffer incomplete');gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.clearColor(-999,-999,-999,-999);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);const data=new Float32Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,data);if(gl.getError())throw Error('GPU readback error');gl.deleteVertexArray(vao);gl.deleteFramebuffer(fbo);gl.deleteTexture(texture);if(ub)gl.deleteBuffer(ub);return data;
}
async function main(){
 const manifest=await get('manifest.json',true),[port,original]=await Promise.all([get('probe.frag'),get('reference.frag')]);result.manifest=manifest;result.compilation=[];
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{antialias:false});if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 RGBA32F unavailable');const debug=gl.getExtension('WEBGL_debug_renderer_info');result.backend={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
 stage('compile');const ref=await program(gl,original,'original-GLSL-kind2'),candidate=await program(gl,port,'WGSL-kind2-port');stage('readback');
 const {width,height,referenceHeight}=manifest,a=draw(gl,ref,width,referenceHeight,true),b=draw(gl,candidate,width,height,false);gl.deleteProgram(ref);gl.deleteProgram(candidate);result.reference=Array.from(a);result.port=Array.from(b);
 if(!a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('Nonfinite material sample');const row=(data,y,x)=>Array.from(data.slice((y*width+x)*4,(y*width+x+1)*4));
 let maxColorRoughError=0,maxHeightError=0,maxGeometryHeightError=0,maxZeroFootprintError=0,farShift=0,nearShift=0,dispatchMismatchedChannels=0;
 for(let x=0;x<width;x++){
  const ref0=row(a,0,x),port0=row(b,0,x),ref1=row(a,1,x),port1=row(b,1,x),zero=row(b,3,x);
  maxColorRoughError=Math.max(maxColorRoughError,...ref0.map((v,j)=>Math.abs(v-port0[j])));maxHeightError=Math.max(maxHeightError,Math.abs(ref1[0]-port1[0]));maxGeometryHeightError=Math.max(maxGeometryHeightError,Math.abs(port1[0]-port1[1]));maxZeroFootprintError=Math.max(maxZeroFootprintError,Math.abs(zero[0]-zero[1]),zero[2],zero[3]);
  for(let y=0;y<12;y++)if(y!==1&&y!==3){const s=row(b,y,x);if(s.some(v=>v<0||v>1)||s[3]<.12)result.errors.push('Invalid reflectance/roughness '+x+'/'+y);}
  for(let y=12;y<16;y++)dispatchMismatchedChannels+=row(b,y,x).filter(v=>v!==0).length;
  for(let j=0;j<3;j++){farShift+=Math.abs(row(b,9,x)[j]-row(b,10,x)[j]);nearShift+=Math.abs(row(b,4,x)[j]-row(b,11,x)[j]);}
 }
 result.numeric={dispatchCases:width,dispatchMismatchedChannels,maxColorRoughError,maxHeightErrorM:maxHeightError,maxGeometryHeightErrorM:maxGeometryHeightError,maxZeroFootprintError,meanNearShift:nearShift/(width*3),meanFarShift:farShift/(width*3),farToNearShiftRatio:farShift/Math.max(nearShift,1e-20)};
 if(maxColorRoughError>2e-4)result.errors.push('Original GLSL/port color or roughness mismatch');if(maxHeightError>5e-8||maxGeometryHeightError>1e-8)result.errors.push('Original/geometry height mismatch');if(maxZeroFootprintError>1e-6)result.errors.push('Zero footprint changed original mother');
 if(dispatchMismatchedChannels)result.errors.push('Candidate dispatch differs from original C resolver or breaks its metadata contract');
 if(farShift>=nearShift)result.errors.push('Far footprint does not attenuate sampled small spatial shifts');
 result.status=result.errors.length?'failed':'passed';stage('complete');document.querySelector('#status').textContent=result.status;
}
main().catch(e=>{result.failure=e.stack||String(e);result.status='failed';console.error(result.failure);});
