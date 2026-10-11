// GENERATED from source/original-r3.12.html; do not hand-edit original controller segments.
import {original} from './original-shaders.mjs';
import {validateOptions} from './r312-wall.mjs';
export const controllerProof={
  "sourceSha256": "1532ea02c31f014c23390fa028385338c3d2caa572f3a36511db81d6609e1581",
  "segments": {
    "compile": "8d916cbd656caa3060c839628a78469e9f46255f7e44ca21fd990bf6b5ad7300",
    "upload": "21da3f320e97dfcaa9f63c737f463729960a81c171c078daa4a55d4549c942ee",
    "counts": "f939b48719f7b4b601c2a576f9b087d25a4159172bf194d78e3d461b09ac69d0",
    "init": "bfaec7332de5890c02d2a57644dc8c0e4fb24036854d30032a966a7c14285942",
    "wallDraw": "642d0e4a2d7c860d04754c9c70d3a9e3c66b4febac4385826b3f19bdc68f2056"
  },
  "omissions": [
    "Source ground plane/UI/camera fitting/RAF are not part of wall baseline",
    "Host passes the exact matrices; original uniform binding mistakes preserved"
  ]
};
export function createR312RawBaseline({gl:context}={}){
 if(!context)throw Error('Supply existing raw WebGL2 context');
 const counters={drawArrays:0,drawArraysInstanced:0,instances:0,frames:0};
 const programs=[],shaders=[],vaos=[];
 const gl=new Proxy(context,{get(target,key){const fn=target[key];if(typeof fn!=='function')return fn;if(key==='drawArrays')return(...a)=>{counters.drawArrays++;return fn.apply(target,a)};if(key==='drawArraysInstanced')return(...a)=>{counters.drawArraysInstanced++;counters.instances+=a[3];return fn.apply(target,a)};if(['createProgram','createShader','createVertexArray'].includes(key))return(...a)=>{const value=fn.apply(target,a);(key==='createProgram'?programs:key==='createShader'?shaders:vaos).push(value);return value;};return fn.bind(target);}});
 const {brickVS,brickFS,soilVS,soilFS,plasterVS,plasterFS}=original;
 const {BRICK_H,BED,CAP_COUNT}=original.constants;
 let currentView='iso',scene='wall',activeCourse=43,brickSeed=312,materialFamily=0,rockType=0;
 const BRICK_VARIATION=original.constants.BRICK_VARIATION;
function baseBrickCount(n){return Math.ceil(n/2)*34+Math.floor(n/2)*32;}
function closureBrickCount(n){return Math.floor(n/2)*2;}
function capBrickCount(n){return n===43?CAP_COUNT:0;}
function activeBrickCount(n){return baseBrickCount(n)+closureBrickCount(n)+capBrickCount(n);}
function activeBrickHeight(n){return n*BRICK_H+(n-1)*BED;}

function compile(gl,type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;}function makeProgram(gl,vs,fs,names){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={};names.forEach(n=>u[n]=gl.getUniformLocation(p,n));return{p,u};}
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}function orthographic(hw,hh,near,far){return new Float32Array([1/hw,0,0,0,0,1/hh,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1]);}function lookAt(eye,center,up=[0,1,0]){let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2],l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);}function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function cameraPosition(){const cp=Math.cos(pitch);return[target[0]+distance*Math.sin(yaw)*cp,target[1]+distance*Math.sin(pitch),target[2]+distance*Math.cos(yaw)*cp];}function fitDistance(extra=1){const r=stage.getBoundingClientRect(),aspect=Math.max(.25,r.width/Math.max(1,r.height)),vfov=.62,hfov=2*Math.atan(Math.tan(vfov/2)*aspect);return Math.max(1.5/Math.tan(vfov/2),2/Math.tan(hfov/2))*1.16*extra;}function projectionForView(aspect){if(!currentView||['iso','plaster','core'].includes(currentView))return perspective(currentView==='plaster'?.43:currentView==='core'?.46:.62,aspect,.012,60);let hw,hh;if(scene==='mother'){hw=currentView==='end'?.072:.145;hh=currentView==='top'?.070:.052;}else{hw=currentView==='end'?.32:2.15;hh=currentView==='top'?.32:1.62;}hh=Math.max(hh,hw/aspect);return orthographic(hh*aspect,hh,.02,60);}

const brickProgram=makeProgram(gl,brickVS,brickFS,['uViewProj','uMotherMode','uBuiltCourses','uBatch','uSessionSeed','uCameraRight','uCameraUp','uCamera','uViewDir','uOrtho','uVariation','uMaterialFamily','uRockType']);const soilProgram=makeProgram(gl,soilVS,soilFS,['uViewProj','uCamera','uViewDir','uOrtho','uSoilTop','uCoreOffset','uCoreRelief','uCoreMicro','uLayerIndex','uLayerOut','uLayerReveal','uLayerColor','uSoilColor']);const plasterProgram=makeProgram(gl,plasterVS,plasterFS,['uViewProj','uCamera','uViewDir','uOrtho','uSoilTop','uCoreOffset','uCoreRelief','uCoreMicro','uLayerOuts[0]','uLayerReveals[0]','uPlasterCenter','uPlasterHalf','uPlasterRelief','uPlasterMicro']);gl.bindVertexArray(gl.createVertexArray());gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);

function uploadCommon(prog,u,vp,eye,vd){gl.useProgram(prog);if(u.uViewProj)gl.uniformMatrix4fv(u.uViewProj,false,vp);if(u.uCamera)gl.uniform3fv(u.uCamera,eye);if(u.uViewDir)gl.uniform3fv(u.uViewDir,vd);if(u.uOrtho)gl.uniform1i(u.uOrtho,currentView&& !['iso','plaster','core'].includes(currentView)?1:0);}
function drawBrickBatch(vp,eye,vd,right,camUp,batch,count,mother=0){if(count<=0)return;uploadCommon(brickProgram.p,brickProgram.u,vp,eye,vd);gl.uniform3fv(brickProgram.u.uCameraRight,right);gl.uniform3fv(brickProgram.u.uCameraUp,camUp);gl.uniform1i(brickProgram.u.uMotherMode,mother);gl.uniform1i(brickProgram.u.uBuiltCourses,mother?1:activeCourse);gl.uniform1i(brickProgram.u.uBatch,batch);gl.uniform1f(brickProgram.u.uSessionSeed,mother?0:brickSeed);gl.uniform1f(brickProgram.u.uVariation,mother?0:BRICK_VARIATION);gl.uniform1i(brickProgram.u.uMaterialFamily,materialFamily);gl.uniform1i(brickProgram.u.uRockType,rockType);gl.drawArraysInstanced(gl.TRIANGLES,0,6,count);}

 return {counters,proof:controllerProof,draw({viewProj,camera,viewDir,right,up,parameters={}}){
  const p=validateOptions(parameters);if(p.bindingMode!=='legacy'||p.door)throw Error('Raw source baseline has no repaired bindings or door adaptation');
  const vp=viewProj,eye=camera,vd=viewDir,camUp=up;scene=p.mode;activeCourse=p.activeCourse;brickSeed=p.seed;materialFamily=p.materialFamily;rockType=p.rockType;
  const coreOffset=p.coreOffset,coreRelief=p.coreRelief,coreMicro=p.coreMicro,soilColor=p.soilColor,layerOut=p.layerOut,layerReveal=p.layerReveal,layerColors=p.layerColors.map(h=>[1,3,5].map(i=>Math.pow(parseInt(h.slice(i,i+2),16)/255,2.2)));
  const plasterX=p.plasterCenter[0],plasterY=p.plasterCenter[1],plasterWidth=p.plasterSize[0],plasterHeight=p.plasterSize[1],plasterRelief=p.plasterRelief,plasterMicro=p.plasterMicro,showPlaster=p.showPlaster;
  // currentView only controls original orthographic uniform; caller explicitly supplies the matching projection and ray.
  currentView=parameters.orthographic?'front':'iso';
  const activeH=activeBrickHeight(activeCourse);counters.frames++;
if(scene==='mother')drawBrickBatch(vp,eye,vd,right,camUp,0,1,1);else if(scene!=='soil'){drawBrickBatch(vp,eye,vd,right,camUp,0,baseBrickCount(activeCourse));drawBrickBatch(vp,eye,vd,right,camUp,1,closureBrickCount(activeCourse));drawBrickBatch(vp,eye,vd,right,camUp,2,capBrickCount(activeCourse));}
if(scene==='wall'||scene==='soil'){uploadCommon(soilProgram.p,soilProgram.u,vp,eye,vd);gl.uniform1f(soilProgram.u.uSoilTop,activeH-.01);gl.uniform1f(soilProgram.u.uCoreOffset,coreOffset);gl.uniform1f(soilProgram.u.uCoreRelief,coreRelief);gl.uniform1f(soilProgram.u.uCoreMicro,coreMicro);gl.uniform1f(soilProgram.u.uSoilColor,soilColor);for(let i=0;i<5;i++){gl.uniform1i(soilProgram.u.uLayerIndex,i);gl.uniform1f(soilProgram.u.uLayerOut,layerOut[i]);gl.uniform1f(soilProgram.u.uLayerReveal,layerReveal[i]);gl.uniform3fv(soilProgram.u.uLayerColor,layerColors[i]);gl.drawArrays(gl.TRIANGLES,0,36);}}
if(scene==='wall'&&showPlaster){uploadCommon(plasterProgram.p,plasterProgram.u,vp,eye,vd);gl.uniform1f(plasterProgram.u.uSoilTop,activeH-.01);gl.uniform1f(plasterProgram.u.uCoreOffset,coreOffset);gl.uniform1f(plasterProgram.u.uCoreRelief,coreRelief);gl.uniform1f(plasterProgram.u.uCoreMicro,coreMicro);gl.uniform1fv(plasterProgram.u['uLayerOuts[0]'],layerOut);gl.uniform1fv(plasterProgram.u['uLayerReveals[0]'],layerReveal);gl.uniform2f(plasterProgram.u.uPlasterCenter,plasterX,plasterY);gl.uniform2f(plasterProgram.u.uPlasterHalf,plasterWidth*.5,plasterHeight*.5);gl.uniform1f(plasterProgram.u.uPlasterRelief,plasterRelief);gl.uniform1f(plasterProgram.u.uPlasterMicro,plasterMicro);gl.drawArrays(gl.TRIANGLES,0,36);}

 },dispose(){for(const p of programs)context.deleteProgram(p);for(const s of shaders)context.deleteShader(s);for(const v of vaos)context.deleteVertexArray(v);}};
}
