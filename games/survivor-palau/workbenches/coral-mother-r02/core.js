'use strict';

const TAU=Math.PI*2, PI=Math.PI;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const v3=(x=0,y=0,z=0)=>[x,y,z];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const d=len(a)||1;return [a[0]/d,a[1]/d,a[2]/d]};
const lerp3=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
const c4=(hex,a=1)=>{hex=hex.replace('#','');if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');return [parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255,a]};
const cmix=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t),mix(a[3]??1,b[3]??1,t)];
function rng32(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function hash3(x,y,z){return Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453%1}

function mat4Perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o}
function mat4LookAt(eye,target,up){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x),o=new Float32Array(16);o[0]=x[0];o[1]=y[0];o[2]=z[0];o[3]=0;o[4]=x[1];o[5]=y[1];o[6]=z[1];o[7]=0;o[8]=x[2];o[9]=y[2];o[10]=z[2];o[11]=0;o[12]=-dot(x,eye);o[13]=-dot(y,eye);o[14]=-dot(z,eye);o[15]=1;return o}

const canvas=$('gl');
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'})||canvas.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl',{antialias:true,alpha:false,premultipliedAlpha:false});
const isWebGL2=!!(gl&&typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext);
const qa={version:'coral-mother-r02/0.2.1',ready:false,errors:[],sharedObjectIdentity:false,noExternalAssets:true,externalModels:0,externalTextures:0,traditionalLod:false,webglVersion:isWebGL2?2:1,morphology:'table',objectId:null,triangleCount:0,collisionProbeCount:0,hideNodeCount:0,lineContact:false,fishHideSource:null,lineQuerySource:null,renderSource:null};
let habitat=null;
window.CoralMotherR02={qa,get habitat(){return habitat?.contract?.()||null},getGameAdapter(){if(!habitat)return null;return{objectId:habitat.objectId,definitionRevision:habitat.definitionRevision,hideNodes:habitat.hideNodes.map(x=>({...x})),nearestHide:(position,index=0)=>habitat.nearestHide(position,index),snagAt:(lineStart,lineEnd,worldTime=0)=>habitat.snagAt(lineStart,lineEnd,worldTime)}}};
function fail(e){const err=e instanceof Error?e:new Error(String(e));qa.errors.push(err.stack||err.message);$('error').style.display='block';$('error').textContent=qa.errors.at(-1);$('loading').classList.add('done');console.error(err)}
addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));
if(!gl)throw new Error('当前浏览器未提供可用的 WebGL 上下文。')

const VS300=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
uniform mat4 uView,uProj;
uniform float uTime;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vColor;
void main(){vWorld=aPosition;vNormal=aNormal;vColor=aColor;gl_Position=uProj*uView*vec4(aPosition,1.0);}`;
const FS300=`#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec4 vColor;
uniform vec3 uCamera;
uniform float uTime;
out vec4 outColor;
void main(){
 vec3 n=normalize(vNormal);
 vec3 l=normalize(vec3(-.42,.78,.36));
 float nd=max(dot(n,l),0.0), back=max(dot(n,-l),0.0);
 float ca=pow(max(0.0,sin(vWorld.x*1.7+uTime*1.15)*sin(vWorld.z*1.35-uTime*.72)),3.0);
 float up=clamp(n.y*.5+.5,0.0,1.0);
 vec3 col=vColor.rgb*(.28+.67*nd+.08*back)+vec3(.05,.19,.18)*up+vec3(.18,.13,.05)*ca*(.14+.22*up);
 float dist=distance(vWorld,uCamera);
 float fog=smoothstep(12.0,54.0,dist);
 vec3 fogCol=mix(vec3(.018,.17,.22),vec3(.018,.31,.37),clamp((vWorld.y+2.0)/10.0,0.0,1.0));
 col=mix(col,fogCol,fog*.72);
 float rim=pow(1.0-max(dot(normalize(uCamera-vWorld),n),0.0),2.5);
 col+=rim*vec3(.02,.12,.13);
 outColor=vec4(col,vColor.a);
}`;
const VS100=VS300.replace('#version 300 es\n','').replace(/layout\(location=\d+\) in/g,'attribute').replace(/\nout vec3 vWorld;/,'\nvarying vec3 vWorld;').replace(/\nout vec3 vNormal;/,'\nvarying vec3 vNormal;').replace(/\nout vec4 vColor;/,'\nvarying vec4 vColor;');
const FS100=FS300.replace('#version 300 es\n','').replace(/\nin vec3 vWorld;/,'\nvarying vec3 vWorld;').replace(/\nin vec3 vNormal;/,'\nvarying vec3 vNormal;').replace(/\nin vec4 vColor;/,'\nvarying vec4 vColor;').replace(/\nout vec4 outColor;/,'').replace(/outColor=/g,'gl_FragColor=');
const VS=isWebGL2?VS300:VS100, FS=isWebGL2?FS300:FS100;
function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function makeProgram(){const p=gl.createProgram(),a=compile(gl.VERTEX_SHADER,VS),b=compile(gl.FRAGMENT_SHADER,FS);gl.attachShader(p,a);gl.attachShader(p,b);gl.bindAttribLocation(p,0,'aPosition');gl.bindAttribLocation(p,1,'aNormal');gl.bindAttribLocation(p,2,'aColor');gl.linkProgram(p);gl.deleteShader(a);gl.deleteShader(b);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
const program=makeProgram();
const U={view:gl.getUniformLocation(program,'uView'),proj:gl.getUniformLocation(program,'uProj'),time:gl.getUniformLocation(program,'uTime'),camera:gl.getUniformLocation(program,'uCamera')};
function makeGpuMesh(){return{vbo:gl.createBuffer(),count:0}}
function bindGpu(gpu){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.vbo);const stride=10*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,3*4);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,stride,6*4)}
const staticGpu=makeGpuMesh(),dynamicGpu=makeGpuMesh();
function upload(gpu,data,usage=gl.STATIC_DRAW){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),usage);gpu.count=data.length/10}

class MeshBuilder{
 constructor(){this.data=[];this.triangles=0}
 vertex(p,n,c){this.data.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],c[3]??1)}
 tri(a,b,c,ca,cb=ca,cc=ca,na=null,nb=null,nc=null){const fn=norm(cross(sub(b,a),sub(c,a)));this.vertex(a,na||fn,ca);this.vertex(b,nb||fn,cb);this.vertex(c,nc||fn,cc);this.triangles++}
 quad(a,b,c,d,ca,cb=ca,cc=ca,cd=ca,na=null,nb=null,nc=null,nd=null){this.tri(a,b,c,ca,cb,cc,na,nb,nc);this.tri(a,c,d,ca,cc,cd,na,nc,nd)}
}
