// Test production GLSL's frame Jacobian against central differences in GPU float arithmetic.
module.exports=async page=>page.evaluate(()=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const gl=canvas.getContext('webgl2',{antialias:false});
 if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('Float framebuffer required for derivative fixture');
 const compile=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 const helpers=FS.slice(FS.indexOf('float bmH'),FS.indexOf('void main()'));
 const vs=compile(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=gl_VertexID==0?vec2(-1.,-1.):gl_VertexID==1?vec2(3.,-1.):vec2(-1.,3.);gl_Position=vec4(p,0.,1.);}');
 const fs=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;uniform vec3 probe;uniform int mode;out vec4 result;\n'+helpers+'\nvoid main(){vec3 f;mat3 J;mmFrameD(probe,f,J);result=mode==0?vec4(f,1.):mode==4?vec4(mmFrame(probe),1.):vec4(J[mode-1],1.);}');
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA32F,1,1);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,rb);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete float test target');gl.viewport(0,0,1,1);
 const probe=gl.getUniformLocation(program,'probe'),mode=gl.getUniformLocation(program,'mode');
 const sample=(p,m)=>{gl.uniform3fv(probe,p);gl.uniform1i(mode,m);gl.drawArrays(gl.TRIANGLES,0,3);const values=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,values);return [...values].slice(0,3)};
 let maxDerivativeError=0,maxOriginalFrameError=0,comparisons=0;
 for(const point of [[-5.22,25.47,11.36],[7,8,12],[-20,3,-14]]){
  const f=sample(point,0),original=sample(point,4);for(let i=0;i<3;i++)maxOriginalFrameError=Math.max(maxOriginalFrameError,Math.abs(f[i]-original[i]));
  for(let axis=0;axis<3;axis++){const a=point.slice(),b=point.slice(),epsilon=.01;a[axis]+=epsilon;b[axis]-=epsilon;const lo=sample(b,0),hi=sample(a,0),analytic=sample(point,axis+1);for(let i=0;i<3;i++){maxDerivativeError=Math.max(maxDerivativeError,Math.abs((hi[i]-lo[i])/(2*epsilon)-analytic[i]));comparisons++;}}
 }
 const error=gl.getError();gl.deleteFramebuffer(fb);gl.deleteRenderbuffer(rb);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();
 if(error!==0||maxDerivativeError>.002||maxOriginalFrameError>1e-5)throw Error(JSON.stringify({error,maxDerivativeError,maxOriginalFrameError}));
 return {comparisons,maxDerivativeError,maxOriginalFrameError,passed:true};
});
