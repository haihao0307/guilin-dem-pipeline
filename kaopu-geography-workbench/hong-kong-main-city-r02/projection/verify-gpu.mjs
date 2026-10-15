// Deferred WebGL2 comparator. Importing this module does not open a GPU context.
// Run only in a later authorized browser/CI pass. This is NOT a full scene acceptance test.
import {PROJECTION} from './patch-plan.mjs';
import {regionCorners,depthStepM} from './camera.mjs';

const nearShader=source=>source.replace('near=.15,far=150000.','near=clipNear,far=clipFar');
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 point;
uniform vec3 camera,fw,right,up;
uniform float aspect,tanFov,clipNear,clipFar;
uniform mat4 viewMatrix,projectionMatrix;
out vec4 rawClip;
out vec4 matrixClip;
void main(){
 vec3 v=point-camera;float z=dot(v,fw),near=.15,far=150000.;
 rawClip=vec4(dot(v,right)/(tanFov*aspect),dot(v,up)/tanFov,(far+near)/(far-near)*z-2.*far*near/(far-near),z);
 matrixClip=projectionMatrix*(viewMatrix*vec4(point,1.));
 gl_Position=rawClip;
}`;
const FS=`#version 300 es
precision highp float;out vec4 color;void main(){color=vec4(1.);}`;
const RASTER_VS=`#version 300 es
precision highp float;
uniform float depthM,aspect,tanFov,clipNear,clipFar;uniform mat4 projectionMatrix;uniform bool useMatrix;
void main(){vec2 xy=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);vec3 p=vec3(xy.x*depthM*tanFov*aspect,xy.y*depthM*tanFov,-depthM);float z=depthM,near=.15,far=150000.;gl_Position=useMatrix?projectionMatrix*vec4(p,1.):vec4(p.x/(tanFov*aspect),p.y/tanFov,(far+near)/(far-near)*z-2.*far*near/(far-near),z);}`;
const RASTER_FS=`#version 300 es
precision highp float;uniform vec4 ink;out vec4 color;void main(){color=ink;}`;
function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl,vs,fs,varyings=null){const p=gl.createProgram(),v=compile(gl,gl.VERTEX_SHADER,vs),f=compile(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);if(varyings)gl.transformFeedbackVaryings(p,varyings,gl.INTERLEAVED_ATTRIBS);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function coefficients(gl,p,aspect,projection,near=.15){gl.useProgram(p);for(const [k,v]of Object.entries({aspect,tanFov:PROJECTION.tanFov,clipNear:near,clipFar:150000}))gl.uniform1f(gl.getUniformLocation(p,k),v);gl.uniformMatrix4fv(gl.getUniformLocation(p,'projectionMatrix'),false,new Float32Array(projection));}
function transform(gl,p,{points,camera,aspect,view,projection,width,height,near}){
 const vao=gl.createVertexArray(),input=gl.createBuffer(),output=gl.createBuffer(),tf=gl.createTransformFeedback();
 try{
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
  coefficients(gl,p,aspect,projection,near);for(const k of['camera','fw','right','up'])gl.uniform3fv(gl.getUniformLocation(p,k),new Float32Array(k==='camera'?camera.cam:camera[k]));gl.uniformMatrix4fv(gl.getUniformLocation(p,'viewMatrix'),false,new Float32Array(view));
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,points.length*8*4,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
  gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,points.length);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
  const values=new Float32Array(points.length*8);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);
  const result={points:points.length,maxNdcDifference:0,maxPixelDifference:0,maxDepth24LSBDifference:0,nonfinite:0,worst:null};
  for(let i=0;i<points.length;i++){const a=Array.from(values.subarray(i*8,i*8+4)),b=Array.from(values.subarray(i*8+4,i*8+8)),an=a.slice(0,3).map(x=>x/a[3]),bn=b.slice(0,3).map(x=>x/b[3]);if(![...an,...bn].every(Number.isFinite)){result.nonfinite++;continue;}const ndc=Math.max(...an.map((x,k)=>Math.abs(x-bn[k]))),px=Math.max(Math.abs(an[0]-bn[0])*width/2,Math.abs(an[1]-bn[1])*height/2),lsb=Math.abs(an[2]-bn[2])*.5*(2**24-1);if(ndc>result.maxNdcDifference)result.worst={point:points[i],rawClip:a,matrixClip:b};result.maxNdcDifference=Math.max(result.maxNdcDifference,ndc);result.maxPixelDifference=Math.max(result.maxPixelDifference,px);result.maxDepth24LSBDifference=Math.max(result.maxDepth24LSBDifference,lsb);}
  return result;
 }finally{gl.disable(gl.RASTERIZER_DISCARD);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindVertexArray(null);gl.deleteTransformFeedback(tf);gl.deleteBuffer(input);gl.deleteBuffer(output);gl.deleteVertexArray(vao);}
}
function rasterDepth(gl,projection,near){
 const p=program(gl,nearShader(RASTER_VS,near),RASTER_FS),vao=gl.createVertexArray(),fb=gl.createFramebuffer(),color=gl.createRenderbuffer(),depth=gl.createRenderbuffer(),size=8;
 try{
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.bindRenderbuffer(gl.RENDERBUFFER,color);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,size,size);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,color);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,size,size);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Depth24 test framebuffer incomplete');
  gl.viewport(0,0,size,size);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.LESS);gl.bindVertexArray(vao);coefficients(gl,p,1,projection,near);
  const cases=[];
  for(const z of[.3,1,10,100,1000,10000,30000,60000,100000].filter(z=>z>near)){
   const separation=Math.max(.00001,8*depthStepM(z,24,{near,far:PROJECTION.far}));
   for(const matrixFirst of[false,true])for(const matrixNear of[false,true]){
    gl.clearDepth(1);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    for(const useMatrix of(matrixFirst?[true,false]:[false,true])){
     const d=useMatrix?(matrixNear?z-separation:z+separation):z;
     gl.uniform1f(gl.getUniformLocation(p,'depthM'),d);gl.uniform1i(gl.getUniformLocation(p,'useMatrix'),useMatrix?1:0);gl.uniform4fv(gl.getUniformLocation(p,'ink'),useMatrix?[0,1,0,1]:[1,0,0,1]);gl.drawArrays(gl.TRIANGLES,0,3);
    }
    const pixel=new Uint8Array(4);gl.readPixels(4,4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const passed=matrixNear?pixel[1]===255&&pixel[0]===0:pixel[0]===255&&pixel[1]===0;cases.push({z,separationM:separation,matrixFirst,matrixNear,pixel:Array.from(pixel),passed});
   }
  }
  return {allPassed:cases.every(x=>x.passed),depthFormat:'DEPTH_COMPONENT24',cases};
 }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteRenderbuffer(color);gl.deleteRenderbuffer(depth);gl.deleteFramebuffer(fb);gl.deleteVertexArray(vao);gl.deleteProgram(p);}
}
function cornerDepthCoverage(gl,{camera:c,aspect,points,projection,view,label,near,testSeaSurface=false}){
 const vs=nearShader(VS,near).replace('out vec4 rawClip;','uniform bool useMatrix;out vec4 rawClip;').replace('gl_Position=rawClip;','vec4 q=useMatrix?matrixClip:rawClip;gl_Position=vec4(0.,0.,q.z,q.w);gl_PointSize=4.;');
 const p=program(gl,vs,RASTER_FS),vao=gl.createVertexArray(),input=gl.createBuffer(),fb=gl.createFramebuffer(),color=gl.createRenderbuffer(),depth=gl.createRenderbuffer();
 try{
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.bindRenderbuffer(gl.RENDERBUFFER,color);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,8,8);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,color);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,8,8);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Corner Depth24 framebuffer incomplete');
  gl.viewport(0,0,8,8);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.LESS);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
  coefficients(gl,p,aspect,projection,near);for(const k of['camera','fw','right','up'])gl.uniform3fv(gl.getUniformLocation(p,k),new Float32Array(k==='camera'?c.cam:c[k]));gl.uniformMatrix4fv(gl.getUniformLocation(p,'viewMatrix'),false,new Float32Array(view));
  const checks=[];gl.uniform4fv(gl.getUniformLocation(p,'ink'),[1,1,1,1]);
  for(let index=0;index<points.length;index++)for(const matrix of[false,true]){gl.clearColor(0,0,0,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1i(gl.getUniformLocation(p,'useMatrix'),matrix?1:0);gl.drawArrays(gl.POINTS,index,1);const pixel=new Uint8Array(4);gl.readPixels(4,4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const viewDepth=points[index].reduce((sum,x,i)=>sum+(x-c.cam[i])*c.fw[i],0),expectedVisible=viewDepth>=near&&viewDepth<=150000;checks.push({point:points[index],path:matrix?'three-matrix':'raw-shader',expectedVisible,survivedClearDepthLess:pixel[0]===255,expectedCoverageMatches:(pixel[0]===255)===expectedVisible,pixel:Array.from(pixel)});}
  const surfaceChecks=[];
  if(testSeaSurface){for(const x of[-37680,-1020,35640])for(const z of[-29720,775,31270])for(const height of[1,3])for(const matrix of[false,true]){
   gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([x,0,z,x,height,z]),gl.STATIC_DRAW);gl.clearColor(0,0,0,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1i(gl.getUniformLocation(p,'useMatrix'),matrix?1:0);
   gl.uniform4fv(gl.getUniformLocation(p,'ink'),[0,0,1,1]);gl.drawArrays(gl.POINTS,0,1);const seaPixel=new Uint8Array(4);gl.readPixels(4,4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,seaPixel);
   gl.uniform4fv(gl.getUniformLocation(p,'ink'),[0,1,0,1]);gl.drawArrays(gl.POINTS,1,1);const landPixel=new Uint8Array(4);gl.readPixels(4,4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,landPixel);surfaceChecks.push({xz:[x,z],heightM:height,path:matrix?'three-matrix':'raw-shader',seaDrawn:seaPixel[2]===255,landWinsLess:landPixel[1]===255,passed:seaPixel[2]===255&&landPixel[1]===255,seaPixel:Array.from(seaPixel),landPixel:Array.from(landPixel)});
  }}
  return {label,allPointsSurvived:checks.every(x=>x.survivedClearDepthLess),allExpectedDepthCoverage:checks.every(x=>x.expectedCoverageMatches),checks,seaSurfaceDepthOnlyTest:'Same X/Z at Y=0,+1,+3; projected XY forced to same framebuffer pixel, original clip Z/W preserved; sea drawn first with LESS',allSurfacesSeparated:surfaceChecks.every(x=>x.passed),surfaceChecks};
 }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteProgram(p);gl.deleteBuffer(input);gl.deleteVertexArray(vao);gl.deleteFramebuffer(fb);gl.deleteRenderbuffer(color);gl.deleteRenderbuffer(depth);}
}
export async function runProjectionGPUComparison({ThreePerspectiveCamera,cases,width=1920,height=1080,near=PROJECTION.near}={}){
 if(!ThreePerspectiveCamera)throw Error('Pass the actual hash-verified bundled Three camera constructor');
 if(!Number.isFinite(near)||near<.15||near>3000)throw Error('Invalid shared near plane');const spec={...PROJECTION,near};
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const gl=canvas.getContext('webgl2',{antialias:false,depth:true,preserveDrawingBuffer:true});
 if(!gl)return {gpuStatus:'UNAVAILABLE',passed:false,sceneApproval:false,reason:'WebGL2 context unavailable'};
 const p=program(gl,nearShader(VS,near),FS,['rawClip','matrixClip']);
 try{
  const baseCamera=new ThreePerspectiveCamera(55,1,near,150000),localPoints=[];
  for(const z of[near*1.001,near*2,1,10,100,1000,10000,60000,100000,149999].filter(z=>z>near))for(const x of[-.8,0,.8])for(const y of[-.8,0,.8])localPoints.push([x*z*PROJECTION.tanFov,y*z*PROJECTION.tanFov,-z]);
  const local=transform(gl,p,{points:localPoints,camera:{cam:[0,0,0],fw:[0,0,-1],right:[1,0,0],up:[0,1,0]},aspect:1,view:identity,projection:baseCamera.projectionMatrix.elements,width,height,near});
  const world=[],cornerCoverage=[];
  for(const {camera:c,aspect,points=regionCorners(),label='world',testSeaSurface=false}of cases||[]){const tc=new ThreePerspectiveCamera(55,aspect,near,150000);tc.position.set(...c.cam);tc.up.set(...c.up);tc.lookAt(...c.cam.map((x,i)=>x+c.fw[i]));tc.updateMatrixWorld(true);world.push({label,...transform(gl,p,{points,camera:c,aspect,view:tc.matrixWorldInverse.elements,projection:tc.projectionMatrix.elements,width,height,near})});cornerCoverage.push(cornerDepthCoverage(gl,{label,camera:c,aspect,points,projection:tc.projectionMatrix.elements,view:tc.matrixWorldInverse.elements,near,testSeaSurface}));}
  const occlusion=rasterDepth(gl,baseCamera.projectionMatrix.elements,near),error=gl.getError(),passed=local.nonfinite===0&&local.maxNdcDifference<2e-6&&occlusion.allPassed&&cornerCoverage.every(x=>x.allExpectedDepthCoverage&&x.allSurfacesSeparated)&&error===gl.NO_ERROR;
  return {gpuStatus:'EXECUTED',passed,projection:spec,sceneApproval:false,scope:'Dynamic shared clipNear/clipFar uniform perspective equation versus actual Three projection in Float32; shared Depth24 raster ordering and corner survival against clearDepth=1 with LESS; world-space roundoff diagnostics. Does not render the production terrain/train/material pipelines.',renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),vertexHighFloatPrecision:gl.getShaderPrecisionFormat(gl.VERTEX_SHADER,gl.HIGH_FLOAT).precision,glError:error,cameraSpace:local,worldSpaceDiagnostics:world,cornerDepth24Coverage:cornerCoverage,worldSpaceReviewRequired:world.some(x=>x.nonfinite||x.maxPixelDifference>.5||x.maxDepth24LSBDifference>2),occlusion};
 }finally{gl.deleteProgram(p);gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
