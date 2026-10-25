/* Optional integrated-scene diagnostic. No standalone viewer, object mesh, or clock.
 * Call only after ordinary whole-scene screenshots/rendering are finished.
 * Uses the ACTUAL installed source, field names, D.argument and D.valveFrame.
 */
(function(root,factory){const probe=factory();if(typeof module==='object'&&module.exports)module.exports=probe;else root.runOuterCrossheadGPUParity=probe;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
return async function runOuterCrossheadGPUParity(options={}){
 const S=options.scene||globalThis.SCENE,D=options.dynamic||globalThis.DYNAMIC,packet=options.packet,tolerance=options.tolerance??packet?.readbackTolerance_m??4e-6;
 const report={status:'NOT_RUN',probe:'actual integrated outsideJoint scalar readback',independentContext:true,objectMesh:false,glError:null,gpuExecuted:false,sampleCount:0,nearZeroSignDifferences:0,unsafeSignDifferences:0,maxGPUvsCPUError_m:0,maxGPUvsEmulatedFloat32Error_m:0,maxPacketCPUDrift_m:0,errors:[]};
 let gl,program,vertex,fragment,texture,fbo,vao;
 try{
  if(!S||!D||!D.outerCrossheadCandidate||!packet?.samples?.length){report.reason='Installed whole scene and explicit GPU sample packet are required.';return report;}
  const C=D.outerCrossheadCandidate,source=S.sources.outsideJoint;
  if(source!==C.source||C.version!==packet.version){report.status='FAIL';report.reason='Installed candidate source/version differs from the sample packet.';return report;}
  report.version=C.version;report.sourceStringMatchesInstalledCandidate=true;
  if(globalThis.crypto?.subtle){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));report.sourceSHA256=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');if(report.sourceSHA256!==packet.sourceSHA256){report.status='FAIL';report.reason='Actual scene source SHA does not match the expected sample source.';return report;}}
  else{report.reason='Secure SHA-256 API unavailable; source-packet identity cannot be fully checked.';return report;}
  const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
  gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
  if(!gl){report.reason='WebGL2 is unavailable.';return report;}
  const ext=gl.getExtension('EXT_color_buffer_float');report.extensionColorBufferFloat=Boolean(ext);
  if(!ext){report.reason='EXT_color_buffer_float is unavailable; scalar float readback was not run.';report.glError=gl.getError();return report;}
  texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
  fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  report.framebufferStatus=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if(report.framebufferStatus!==gl.FRAMEBUFFER_COMPLETE){report.reason='RGBA32F framebuffer is incomplete; scalar readback was not run.';report.glError=gl.getError();return report;}
  const parts=S.parts.filter(p=>p.source==='outsideJoint'),index=new Map(parts.map((p,i)=>[p.id,i]));
  const dispatch=parts.map((p,i)=>`if(partId==${i})return ${p.glsl_function}(${D.argument(p,'samplePoint')});`).join('\n');
  const vs='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}';
  const fs=`#version 300 es\nprecision highp float;precision highp int;\nuniform vec3 samplePoint;uniform int partId;out vec4 valueOut;\n${D.glsl}\n${source}\nfloat probeField(){${dispatch}return 1e20;}\nvoid main(){valueOut=vec4(probeField(),0.,0.,1.);}`;
  function compile(type,code){const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'Shader compilation failed');return shader;}
  vertex=compile(gl.VERTEX_SHADER,vs);fragment=compile(gl.FRAGMENT_SHADER,fs);program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Program linking failed');
  report.actualSourceProgramCompiled=true;report.compiledFieldCount=parts.length;
  gl.useProgram(program);vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.viewport(0,0,1,1);gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  const u=n=>gl.getUniformLocation(program,n),uniforms=Object.fromEntries(['samplePoint','partId','valveInverseRow0','valveInverseRow1','timeTheta','middleInclination','installationCandidate'].map(n=>[n,u(n)]));
  const inst=D.snapshot(packet.installation),pixel=new Float32Array(4),failures=[];
  report.installation=inst;report.readbackTolerance_m=tolerance;
  for(let i=0;i<packet.samples.length;i++){
   const sample=packet.samples[i],part=parts[index.get(sample.id)];if(!part)throw Error('Sample field is not installed: '+sample.id);
   if(part.glsl_function!==sample.glslFunction||D.argument(part)!==sample.scalarArgument)throw Error('Actual scalar function/argument changed: '+sample.id);
   const matrix=D.valveFrame(part,sample.theta,inst)?.inverseYZ||[1,0,0,0,1,0];
   if(matrix.some((v,j)=>Math.abs(v-sample.valveInverseYZ[j])>1e-12))throw Error('Actual same-theta inverse differs from sample: '+sample.id);
   const expected=C.worldScalar(part.id,sample.worldPoint,sample.theta,inst),drift=Math.abs(expected-sample.expectedCPU);report.maxPacketCPUDrift_m=Math.max(report.maxPacketCPUDrift_m,drift);
   if(drift>1e-12)throw Error('CPU sample drift: '+sample.id);
   gl.uniform3fv(uniforms.samplePoint,sample.worldPoint);gl.uniform1i(uniforms.partId,index.get(part.id));gl.uniform3fv(uniforms.valveInverseRow0,matrix.slice(0,3));gl.uniform3fv(uniforms.valveInverseRow1,matrix.slice(3,6));gl.uniform1f(uniforms.timeTheta,sample.theta);gl.uniform1f(uniforms.middleInclination,inst.beta);gl.uniform1i(uniforms.installationCandidate,inst.mode==='candidate'?1:0);
   gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,pixel);const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('WebGL error '+error+' at sample '+i);
   const actual=pixel[0];if(!Number.isFinite(actual)||pixel[3]!==1)throw Error('Invalid scalar readback at sample '+i);
   const delta=Math.abs(actual-expected),floatDelta=Number.isFinite(sample.expectedFloat32)?Math.abs(actual-sample.expectedFloat32):null;
   report.maxGPUvsCPUError_m=Math.max(report.maxGPUvsCPUError_m,delta);if(floatDelta!==null)report.maxGPUvsEmulatedFloat32Error_m=Math.max(report.maxGPUvsEmulatedFloat32Error_m,floatDelta);else report.float32ReferenceMissing=true;
   if((actual<0)!==(expected<0)){if(Math.max(Math.abs(actual),Math.abs(expected))<=tolerance)report.nearZeroSignDifferences++;else report.unsafeSignDifferences++;}
   if(delta>tolerance||floatDelta!==null&&floatDelta>tolerance)failures.push({sample:i,id:part.id,theta:sample.theta,worldPoint:sample.worldPoint,expectedCPU:expected,expectedFloat32:sample.expectedFloat32,actual,error:delta});
   report.sampleCount++;report.gpuExecuted=true;if(i%64===63)await new Promise(resolve=>setTimeout(resolve,0));
  }
  report.glError=gl.getError();report.failures=failures;report.status=report.glError===0&&failures.length===0&&report.unsafeSignDifferences===0&&!report.float32ReferenceMissing?'PASS':'FAIL';
  report.scope='Actual float GPU scalar readback of the installed candidate source and same-theta transforms only. Not whole mechanical acceptance, image fidelity, or continuous collision certification.';
  return report;
 }catch(error){report.status='FAIL';report.errors.push(String(error));if(gl)report.glError=gl.getError();return report;}
 finally{if(gl){if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);if(fbo)gl.deleteFramebuffer(fbo);if(texture)gl.deleteTexture(texture);}}
};
});
