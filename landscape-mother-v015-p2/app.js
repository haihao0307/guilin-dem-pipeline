(()=>{'use strict';

const $=id=>document.getElementById(id);
const canvas=$('gl'),subtitle=$('subtitle'),toast=$('toast'),sheet=$('sheet'),hub=$('hub');
const errorPanel=$('error'),errorText=$('errorText'),scalePanel=$('scalePanel');
const query=new URLSearchParams(location.search);

let gl,isGL2=false;
const contextOptions={alpha:true,antialias:true,powerPreference:'high-performance',premultipliedAlpha:false,preserveDrawingBuffer:false};
try{
  gl=canvas.getContext('webgl2',contextOptions);
  isGL2=!!gl;
  if(!gl)gl=canvas.getContext('webgl',contextOptions)||canvas.getContext('experimental-webgl',contextOptions);
}catch(_){}
if(!gl){fail('当前窗口没有可用的 WebGL。请通过 Safari、Chrome 或 Edge 打开在线页面。');return}
const derivatives=isGL2||gl.getExtension('OES_standard_derivatives');
const uintIndices=isGL2||gl.getExtension('OES_element_index_uint');
if(!derivatives||!uintIndices){fail('当前浏览器缺少固定高精度峰林需要的 WebGL 扩展。');return}
const vaoExt=isGL2?null:gl.getExtension('OES_vertex_array_object');
const makeVAO=()=>isGL2?gl.createVertexArray():(vaoExt?vaoExt.createVertexArrayOES():null);
const bindVAO=vao=>{if(isGL2)gl.bindVertexArray(vao);else if(vaoExt)vaoExt.bindVertexArrayOES(vao)};

function fail(message){
  errorPanel.classList.remove('hidden');
  errorText.textContent=message;
}
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const V={
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}
};

const defaults={
  tour:true,vivid:1.08,clarity:1.06,rockLight:.94,plainLight:1.06,
  limestone:1.02,warmth:.48,fresh:.82,micro:.58,
  vegetation:.80,moss:.72,lichen:.58,plainGreen:.94,
  waterStain:1.18,iron:.62,wet:.22,cavity:.90,
  sun:3.45,sky:.94,inspect:.32,exposure:.96,mode:0
};
const state={...defaults};
let mesh=null,meta=null,stats=null;
let towerUniforms=new Float32Array(24*4),towerCount=0;

const VS2=`#version 300 es
layout(location=0)in vec3 aQ;
layout(location=1)in vec3 aN;
layout(location=2)in vec4 aF1;
layout(location=3)in vec4 aF2;
layout(location=4)in vec4 aF3;
layout(location=5)in vec4 aF4;
uniform mat4 uVP;
uniform vec3 uMin,uMax;
out vec3 P,N;
out vec4 F1,F2,F3,F4;
void main(){
  P=mix(uMin,uMax,aQ);
  N=aN;F1=aF1;F2=aF2;F3=aF3;F4=aF4;
  gl_Position=uVP*vec4(P,1.0);
}`;
const VS1=`attribute vec3 aQ;
attribute vec3 aN;
attribute vec4 aF1;
attribute vec4 aF2;
attribute vec4 aF3;
attribute vec4 aF4;
uniform mat4 uVP;
uniform vec3 uMin,uMax;
varying vec3 P,N;
varying vec4 F1,F2,F3,F4;
void main(){
  P=mix(uMin,uMax,aQ);
  N=aN;F1=aF1;F2=aF2;F3=aF3;F4=aF4;
  gl_Position=uVP*vec4(P,1.0);
}`;

const UNIFORMS=`uniform vec3 uEye,uSunDir,uMin,uMax;
uniform float uSun,uSky,uExposure,uVivid,uClarity,uRockLight,uPlainLight,uLimestone,uWarmth,uFresh,uMicro,uVegetation,uMoss,uLichen,uPlainGreen,uWaterStain,uIron,uWet,uCavity,uInspect;
uniform int uMode,uTowerCount;
uniform vec4 uTowerData[24];`;

const BODY=`precision highp float;
varying vec3 P,N;
varying vec4 F1,F2,F3,F4;
${UNIFORMS}

float hash31(vec3 p){
  p=fract(p*.1031);
  p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){return .58*noise3(p)+.28*noise3(p*2.03+11.7)+.14*noise3(p*4.11+29.3);}
float s2lf(float c){return c<=.04045?c/12.92:pow((c+.055)/1.055,2.4);}
vec3 s2l(vec3 c){return vec3(s2lf(c.r),s2lf(c.g),s2lf(c.b));}
float l2sf(float c){return c<=.0031308?c*12.92:1.055*pow(max(c,0.0),1.0/2.4)-.055;}
vec3 l2s(vec3 c){return vec3(l2sf(c.r),l2sf(c.g),l2sf(c.b));}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}
vec3 safeNorm(vec3 x){return x/max(length(x),1e-6);}

float segmentDistance(vec2 p,vec2 a,vec2 b,out float t){
  vec2 v=b-a;
  t=clamp(dot(p-a,v)/max(dot(v,v),1e-5),0.0,1.0);
  return length(p-(a+t*v));
}
float groundShadow(vec2 xz){
  float shadow=0.0;
  for(int i=0;i<24;i++){
    if(i>=uTowerCount)break;
    vec4 d=uTowerData[i];
    vec2 a=d.xy;
    vec2 ray=-uSunDir.xz/max(uSunDir.y,.18)*d.w*.72;
    vec2 b=a+ray;
    float t;
    float dist=segmentDistance(xz,a,b,t);
    float radius=d.z*mix(1.04,.16,t);
    float s=1.0-smoothstep(radius*.72,radius*1.34,dist);
    shadow=max(shadow,s*(1.0-t*.58));
  }
  return clamp(shadow,0.0,1.0);
}

void main(){
  float material=floor(F1.x*255.0+.5);
  float vegetationField=F1.y;
  float rockExposure=F1.z;
  float waterField=F1.w;
  float wetField=F2.x;
  float ironField=F2.y;
  float lichenField=F2.z;
  float mossField=F2.w;
  float cavityField=F3.x;
  float rough=clamp(F3.y,.26,.99);
  float slope=F3.z;
  float relHeight=F3.w;
  float verticality=F4.x;
  float curvature=F4.y;
  float sourceConfidence=F4.z;
  float towerId=floor(F4.w*255.0+.5);

  vec3 dpx=dFdx(P),dpy=dFdy(P);
  vec3 face=safeNorm(cross(dpx,dpy));
  if(dot(face,N)<0.0)face=-face;
  vec3 n=safeNorm(mix(safeNorm(N),face,.10+.12*curvature));

  float macro=fbm(P*.0014+vec3(towerId*.19,2.1,7.3));
  float meso=fbm(P*.010+vec3(3.4,towerId*.27,8.6));
  float grain=fbm(P*.090+vec3(13.2,4.7,towerId*.41));
  float grainFine=noise3(P*.245+vec3(21.7,towerId*.61,3.8));

  vec3 base;
  float waterMask=0.0;
  float caveDark=0.0;

  if(material<.5){
    float fieldPattern=.62*fbm(vec3(P.x*.00115,3.7,P.z*.00115))+.38*fbm(vec3(P.x*.0038,8.2,P.z*.0038));
    float cultivation=.5+.5*sin(P.x*.0063+sin(P.z*.0031)*1.8);
    vec3 grassDeep=s2l(vec3(.036,.130,.034));
    vec3 grassMid=s2l(vec3(.090,.305,.060));
    vec3 grassSun=s2l(vec3(.225,.465,.095));
    vec3 earth=s2l(vec3(.330,.245,.125));
    base=mix(grassDeep,grassMid,smoothstep(.20,.72,fieldPattern));
    base=mix(base,grassSun,smoothstep(.58,.87,fieldPattern)*.50);
    base=mix(base,earth,smoothstep(.82,.95,cultivation)*smoothstep(.32,.68,1.0-fieldPattern)*.20);
    base*=uPlainLight;
    float lum=dot(base,vec3(.2126,.7152,.0722));
    base=mix(vec3(lum),base,uPlainGreen);
    rough=clamp(rough+.05,.74,.99);
  }else{
    float warmMix=clamp(.18+.46*macro+.22*meso+(uWarmth-.5)*.42,0.0,1.0);
    vec3 limestoneCool=s2l(vec3(.255,.285,.280));
    vec3 limestoneWarm=s2l(vec3(.445,.408,.325));
    vec3 limestonePale=s2l(vec3(.600,.620,.575));
    vec3 weathered=s2l(vec3(.335,.300,.235));
    vec3 calcite=s2l(vec3(.690,.710,.670));
    vec3 rock=mix(limestoneCool,limestoneWarm,warmMix);
    rock=mix(rock,weathered,smoothstep(.64,.89,meso)*.22);
    rock=mix(rock,limestonePale,smoothstep(.58,.88,grain)*.16*uLimestone);
    float fracture=clamp(curvature*uFresh*(.55+.45*grain),0.0,.68);
    rock=mix(rock,calcite,fracture*.42);

    float veg=clamp(vegetationField*uVegetation,0.0,1.0);
    veg*=1.0-verticality*.84;
    float vegPatch=smoothstep(.30,.68,macro*.56+meso*.44);
    veg=clamp(veg*(.42+.62*vegPatch),0.0,.82);
    vec3 foliageDeep=s2l(vec3(.018,.105,.028));
    vec3 foliageMid=s2l(vec3(.042,.245,.042));
    vec3 foliageBright=s2l(vec3(.120,.355,.060));
    vec3 foliage=mix(foliageDeep,foliageMid,smoothstep(.22,.70,meso));
    foliage=mix(foliage,foliageBright,smoothstep(.62,.88,macro)*.42);

    float lichen=clamp(lichenField*uLichen*(1.0-veg*.76),0.0,.62);
    float moss=clamp(mossField*uMoss*(.36+.64*wetField)*(1.0-verticality*.45),0.0,.68);
    vec3 lichenColor=s2l(vec3(.405,.445,.235));
    vec3 mossColor=s2l(vec3(.025,.175,.030));

    float meander=.5+.5*sin(P.y*.026+towerId*.73);
    float streakNoise=.68*noise3(vec3(P.x*.031+meander*.31,towerId*.19,P.z*.031))+.32*noise3(vec3(P.x*.071,towerId*.43,P.z*.071));
    float narrow=smoothstep(.73,.92,streakNoise);
    waterMask=clamp(waterField*uWaterStain*(.42+.78*narrow),0.0,.94);
    waterMask*=rockExposure*(.42+.58*verticality);
    float ironMask=clamp(ironField*uIron*(1.0-waterMask*.52),0.0,.58);
    float wet=clamp(wetField*uWet,0.0,.72);
    caveDark=clamp(cavityField*uCavity,0.0,.88);

    vec3 ironColor=s2l(vec3(.435,.225,.075));
    vec3 waterBlack=s2l(vec3(.010,.016,.013));
    base=rock*uRockLight;
    base=mix(base,lichenColor,lichen);
    base=mix(base,mossColor,moss);
    base=mix(base,foliage,veg);
    base=mix(base,ironColor,ironMask);
    base=mix(base,waterBlack,waterMask*.88);
    base*=mix(1.0,.82,wet);
    base*=mix(1.0,.78,caveDark*.42);
    rough=clamp(rough+.10*lichen+.12*moss+.06*grainFine-.25*wet-.07*fracture,.32,.98);
  }

  float lum=dot(base,vec3(.2126,.7152,.0722));
  base=mix(vec3(lum),base,uVivid);
  base=mix(vec3(.5),base,uClarity);
  base=clamp(base,0.0,1.0);

  float microMask=material<.5?.18:clamp(.12+.55*rockExposure+.22*waterMask+.18*curvature,0.0,1.0);
  float microHeight=(.57*grain+.30*grainFine+.13*meso)*microMask;
  float hx=dFdx(microHeight),hy=dFdy(microHeight);
  vec3 r1=cross(dpy,n),r2=cross(n,dpx);
  float det=dot(dpx,r1);
  vec3 grad=(r1*hx+r2*hy)/max(abs(det),.0001);
  n=safeNorm(n-sign(det)*grad*uMicro*(material<.5?.018:.076));

  if(uMode==1){OUT=vec4(l2s(base),1.0);return;}
  if(uMode==2){
    float h=clamp((P.y-uMin.y)/max(uMax.y-uMin.y,1.0),0.0,1.0);
    OUT=vec4(mix(vec3(.045,.20,.12),mix(vec3(.18,.56,.20),vec3(.96,.72,.20),h),h),1.0);return;
  }
  if(uMode==3){OUT=vec4(mix(vec3(.07,.24,.55),mix(vec3(.16,.82,.34),vec3(.96,.28,.08),slope),slope),1.0);return;}
  if(uMode==4){OUT=vec4(mix(vec3(.025,.045,.07),vec3(1.0,.72,.12),verticality),1.0);return;}
  if(uMode==5){OUT=vec4(mix(vec3(.18,.20,.13),vec3(.04,.68,.08),vegetationField),1.0);return;}
  if(uMode==6){OUT=vec4(mix(vec3(.75,.72,.58),vec3(.005,.010,.008),waterMask),1.0);return;}
  if(uMode==7){OUT=vec4(mix(vec3(.68,.70,.64),vec3(.02,.025,.022),cavityField),1.0);return;}
  if(uMode==8){OUT=vec4(n*.5+.5,1.0);return;}
  if(uMode==9){OUT=vec4(mix(vec3(.70,.20,.08),vec3(.08,.82,.38),sourceConfidence),1.0);return;}

  vec3 view=safeNorm(uEye-P);
  vec3 light=safeNorm(uSunDir);
  vec3 halfVector=safeNorm(view+light);
  float nl=max(dot(n,light),0.0);
  float nv=max(dot(n,view),.025);
  float nh=max(dot(n,halfVector),0.0);
  float vh=max(dot(view,halfVector),0.0);
  float a=rough*rough,a2=a*a;
  float den=nh*nh*(a2-1.0)+1.0;
  float D=a2/(3.14159265*den*den+.0001);
  float k=(rough+1.0)*(rough+1.0)/8.0;
  float G=(nl/(nl*(1.0-k)+k))*(nv/(nv*(1.0-k)+k));
  vec3 F=vec3(.04)+(vec3(.96))*pow(1.0-vh,5.0);
  vec3 diffuse=(1.0-F)*base/3.14159265;
  vec3 specular=D*G*F/max(4.0*nl*nv,.01);

  vec3 sunColor=s2l(vec3(1.0,.955,.835));
  vec3 skyColor=s2l(vec3(.42,.61,.72));
  vec3 groundColor=s2l(vec3(.34,.33,.19));
  float up=clamp(n.y*.5+.5,0.0,1.0);
  float castShadow=material<.5?groundShadow(P.xz):0.0;
  float directVisibility=mix(1.0,.46,castShadow*.78);
  vec3 direct=(diffuse+specular)*sunColor*uSun*nl*directVisibility;
  float ambientAccess=mix(1.0,.30,caveDark);
  vec3 hemi=base*mix(groundColor,skyColor,up)*uSky*ambientAccess*(.62+.38*up);
  vec3 fill=base*s2l(vec3(.28,.42,.47))*.16*max(dot(n,safeNorm(vec3(-.72,.38,-.28))),0.0);
  vec3 inspect=base*s2l(vec3(.78,.84,.82))*uInspect*max(dot(n,view),0.0)*(.32+.68*rockExposure);
  vec3 wetSpark=specular*s2l(vec3(.72,.86,.89))*wetField*uWet*.52;
  vec3 linear=(direct+hemi+fill+inspect+wetSpark)*uExposure;
  OUT=vec4(l2s(aces(linear)),1.0);
}`;

const FS2=`#version 300 es
precision highp float;
in vec3 P,N;
in vec4 F1,F2,F3,F4;
${UNIFORMS}
out vec4 frag;
#define OUT frag
`+BODY.replace(`precision highp float;
varying vec3 P,N;
varying vec4 F1,F2,F3,F4;
${UNIFORMS}`,'');
const FS1=`#extension GL_OES_standard_derivatives : enable
#define OUT gl_FragColor
`+BODY;

function compileShader(type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'shader compile failed');
  return shader;
}
const program=gl.createProgram();
gl.attachShader(program,compileShader(gl.VERTEX_SHADER,isGL2?VS2:VS1));
gl.attachShader(program,compileShader(gl.FRAGMENT_SHADER,isGL2?FS2:FS1));
if(!isGL2)['aQ','aN','aF1','aF2','aF3','aF4'].forEach((name,index)=>gl.bindAttribLocation(program,index,name));
gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'program link failed');

const uniformNames=['uVP','uMin','uMax','uEye','uSunDir','uSun','uSky','uExposure','uVivid','uClarity','uRockLight','uPlainLight','uLimestone','uWarmth','uFresh','uMicro','uVegetation','uMoss','uLichen','uPlainGreen','uWaterStain','uIron','uWet','uCavity','uInspect','uMode','uTowerCount','uTowerData[0]'];
const U=Object.fromEntries(uniformNames.map(name=>[name,gl.getUniformLocation(program,name)]));

function makeMesh(buffer,vertexOffset,vertexCount,indexOffset,indexCount,min,max,stride){
  const vao=makeVAO(),vbo=gl.createBuffer(),ibo=gl.createBuffer();
  bindVAO(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(buffer,vertexOffset,vertexCount*stride),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(buffer,indexOffset,indexCount),gl.STATIC_DRAW);
  const attrs=[
    [0,3,gl.UNSIGNED_SHORT,true,0],
    [1,3,gl.SHORT,true,6],
    [2,4,gl.UNSIGNED_BYTE,true,12],
    [3,4,gl.UNSIGNED_BYTE,true,16],
    [4,4,gl.UNSIGNED_BYTE,true,20],
    [5,4,gl.UNSIGNED_BYTE,true,24]
  ];
  for(const [loc,size,type,norm,offset] of attrs){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,norm,stride,offset)}
  bindVAO(null);
  return{vao,vbo,ibo,count:indexCount,min,max,stride};
}
function bindMesh(m){
  if(vaoExt||isGL2){bindVAO(m.vao);return}
  gl.bindBuffer(gl.ARRAY_BUFFER,m.vbo);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ibo);
  const attrs=[[0,3,gl.UNSIGNED_SHORT,true,0],[1,3,gl.SHORT,true,6],[2,4,gl.UNSIGNED_BYTE,true,12],[3,4,gl.UNSIGNED_BYTE,true,16],[4,4,gl.UNSIGNED_BYTE,true,20],[5,4,gl.UNSIGNED_BYTE,true,24]];
  for(const [loc,size,type,norm,offset] of attrs){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,norm,m.stride,offset)}
}

async function fetchJSON(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error(url+' 请求失败 '+response.status);
  return response.json();
}
async function fetchBuffer(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error(url+' 请求失败 '+response.status);
  const total=+(response.headers.get('content-length')||0);
  if(!response.body||!total)return response.arrayBuffer();
  const reader=response.body.getReader(),parts=[];let got=0;
  for(;;){
    const item=await reader.read();if(item.done)break;
    parts.push(item.value);got+=item.value.byteLength;
    subtitle.textContent='正在读取 4 公里峰林 · '+Math.round(got/total*100)+'%';
  }
  const all=new Uint8Array(got);let offset=0;
  for(const part of parts){all.set(part,offset);offset+=part.byteLength}
  return all.buffer;
}

function setupMeta(m){
  meta=m;
  const scene=m.scene;
  const source=m.source;
  $('scaleChipValue').textContent=(source.cropSizeM[0]/1000).toFixed(1)+' km';
  $('metricDomain').textContent=source.cropSizeM[0].toLocaleString()+' × '+source.cropSizeM[1].toLocaleString()+' m';
  $('metricMeanSlope').textContent=scene.areaWeightedMeanSlopeDeg.toFixed(1)+'°';
  $('metricVertical').textContent=(scene.areaRatioSlope87Plus*100).toFixed(1)+'% ≥87°';
  towerCount=Math.min(24,m.towers.length);
  towerUniforms.fill(0);
  for(let i=0;i<towerCount;i++){
    const t=m.towers[i],p=t.sourcePeakPositionM;
    towerUniforms[i*4]=p[0];towerUniforms[i*4+1]=p[1];
    towerUniforms[i*4+2]=Math.max(32,t.sourceMaximumInteriorDistanceM*1.20);
    towerUniforms[i*4+3]=t.renderRelativeHeightM;
  }
}

async function load(){
  const [m,buffer]=await Promise.all([fetchJSON('SCENE_META.json'),fetchBuffer('scene.bin')]);
  setupMeta(m);
  const view=new DataView(buffer);
  if(String.fromCharCode(...new Uint8Array(buffer,0,4))!=='LMF5')throw Error('数值峰林格式错误');
  const version=view.getUint32(4,true),stride=view.getUint32(8,true),vertexCount=view.getUint32(12,true),indexCount=view.getUint32(16,true);
  const f=offset=>view.getFloat32(offset,true);
  const min=[f(20),f(24),f(28)],max=[f(32),f(36),f(40)];
  const vertexOffset=view.getUint32(44,true),indexOffset=view.getUint32(48,true),towerN=view.getUint32(52,true);
  if(version!==5||stride!==32||vertexOffset!==128)throw Error('数值峰林版本不兼容');
  mesh=makeMesh(buffer,vertexOffset,vertexCount,indexOffset,indexCount,min,max,stride);
  stats={
    version:'V015P2',vertices:vertexCount,triangles:indexCount/3,binaryBytes:buffer.byteLength,
    towerCount:towerN,webgl:isGL2?2:1,textureSampling:false,images:document.images.length,
    externalModels:0,fog:false,distantMountains:false,runtimeLOD:false,deviceDependentGeometry:false,
    worldUnit:'metre',sourceSpacingM:12.5
  };
  window.__LANDSCAPE_STATS__=stats;
  buildViews();
  subtitle.textContent='V015 P2 · '+m.scene.towerCount+' 座窄体塔峰 · 已进入峰林内部观察';
  showToast('<b>桂林葡萄峰林 V015 P2</b> · 窄峰、陡壁和石灰岩综合色彩已载入');
  window.__LANDSCAPE_READY__=true;
  requestDraw();
}

const perspective=(fov,aspect,near,far)=>{
  const t=1/Math.tan(fov/2),q=1/(near-far);
  return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0]);
};
function lookAt(eye,target){
  const z=V.norm(V.sub(eye,target)),x=V.norm(V.cross([0,1,0],z)),y=V.cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1]);
}
function multiply(a,b){
  const out=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return out;
}

let views={},camera={yaw:.82,pitch:.04,dist:2150,target:[-350,160,-260]},activeView='hero';
function buildViews(){
  const towers=[...meta.towers].sort((a,b)=>b.renderRelativeHeightM-a.renderRelativeHeightM);
  const tallest=towers[0],second=towers[Math.min(3,towers.length-1)];
  const p=tallest.sourcePeakPositionM,q=second.sourcePeakPositionM;
  const width=meta.source.cropSizeM[0];
  views={
    hero:{yaw:.82,pitch:.04,dist:width*.54,target:[-350,160,-260]},
    forest:{yaw:1.02,pitch:.025,dist:width*.39,target:[-390,160,-330]},
    cliff:{yaw:1.48,pitch:.055,dist:Math.max(330,tallest.renderRelativeHeightM*2.55),target:[p[0],tallest.sourceBaseElevationM+tallest.renderRelativeHeightM*.48,p[1]]},
    cave:{yaw:.25,pitch:.08,dist:Math.max(240,tallest.renderRelativeHeightM*1.65),target:[p[0],tallest.sourceBaseElevationM+Math.min(24,tallest.renderRelativeHeightM*.12),p[1]]},
    top:{yaw:.70,pitch:1.29,dist:width*1.22,target:[0,90,0]}
  };
  camera=JSON.parse(JSON.stringify(views.hero));
}
function setView(name){
  if(!views[name])return;
  activeView=name;camera=JSON.parse(JSON.stringify(views[name]));
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('on',button.dataset.view===name));
  setTour(false);requestDraw();
}
function resize(){
  const cap=innerWidth<720?1.30:1.72,dpr=Math.min(devicePixelRatio||1,cap);
  const width=Math.max(1,Math.round(canvas.clientWidth*dpr)),height=Math.max(1,Math.round(canvas.clientHeight*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}
}
let raf=0,last=performance.now();
function draw(){
  raf=0;if(!mesh||!meta)return;
  resize();
  const cp=Math.cos(camera.pitch);
  const eye=[
    camera.target[0]+Math.sin(camera.yaw)*cp*camera.dist,
    camera.target[1]+Math.sin(camera.pitch)*camera.dist,
    camera.target[2]+Math.cos(camera.yaw)*cp*camera.dist
  ];
  const fov=innerWidth<720?.78:.62;
  const vp=multiply(perspective(fov,canvas.width/canvas.height,2,30000),lookAt(eye,camera.target));
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  gl.useProgram(program);
  gl.uniformMatrix4fv(U.uVP,false,vp);
  gl.uniform3f(U.uMin,...mesh.min);gl.uniform3f(U.uMax,...mesh.max);gl.uniform3f(U.uEye,...eye);
  gl.uniform3f(U.uSunDir,.48,.76,.42);
  const map={
    uSun:'sun',uSky:'sky',uExposure:'exposure',uVivid:'vivid',uClarity:'clarity',
    uRockLight:'rockLight',uPlainLight:'plainLight',uLimestone:'limestone',uWarmth:'warmth',
    uFresh:'fresh',uMicro:'micro',uVegetation:'vegetation',uMoss:'moss',uLichen:'lichen',
    uPlainGreen:'plainGreen',uWaterStain:'waterStain',uIron:'iron',uWet:'wet',
    uCavity:'cavity',uInspect:'inspect'
  };
  for(const [uniform,key] of Object.entries(map))gl.uniform1f(U[uniform],state[key]);
  gl.uniform1i(U.uMode,state.mode);gl.uniform1i(U.uTowerCount,towerCount);gl.uniform4fv(U['uTowerData[0]'],towerUniforms);
  bindMesh(mesh);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);bindVAO(null);
  window.__LANDSCAPE_GL_ERROR__=gl.getError();
}
function requestDraw(){if(!raf)raf=requestAnimationFrame(draw)}
function loop(now){
  const dt=Math.min(.05,(now-last)/1000||0);last=now;
  if(state.tour&&!document.hidden&&mesh&&hub.classList.contains('hidden')){
    camera.yaw+=dt*.045;requestDraw();
  }
  requestAnimationFrame(loop);
}

let pointers=new Map(),gesture=null;
function pointerSnapshot(){
  const items=[...pointers.values()];
  if(items.length===1)return{mode:1,x:items[0].x,y:items[0].y,yaw:camera.yaw,pitch:camera.pitch};
  if(items.length>=2){
    const x=(items[0].x+items[1].x)/2,y=(items[0].y+items[1].y)/2;
    return{mode:2,x,y,distance:Math.hypot(items[0].x-items[1].x,items[0].y-items[1].y),dist:camera.dist,target:[...camera.target]};
  }
  return null;
}
canvas.addEventListener('pointerdown',event=>{
  try{canvas.setPointerCapture(event.pointerId)}catch(_){}
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  gesture=pointerSnapshot();setTour(false);
},{passive:false});
canvas.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;
  event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const current=pointerSnapshot();if(!gesture||!current){gesture=current;return}
  if(current.mode===1&&gesture.mode===1){
    camera.yaw=gesture.yaw-(current.x-gesture.x)*.0054;
    camera.pitch=clamp(gesture.pitch-(current.y-gesture.y)*.0048,-.03,1.42);
  }else if(current.mode===2&&gesture.mode===2){
    camera.dist=clamp(gesture.dist*gesture.distance/Math.max(12,current.distance),120,10000);
    const pan=gesture.dist*.00145,rx=Math.cos(camera.yaw),rz=-Math.sin(camera.yaw);
    camera.target=[
      gesture.target[0]-(current.x-gesture.x)*rx*pan,
      gesture.target[1]+(current.y-gesture.y)*pan,
      gesture.target[2]-(current.x-gesture.x)*rz*pan
    ];
  }
  requestDraw();
},{passive:false});
function endPointer(event){pointers.delete(event.pointerId);gesture=pointerSnapshot()}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('wheel',event=>{event.preventDefault();setTour(false);camera.dist=clamp(camera.dist*Math.exp(event.deltaY*.001),120,10000);requestDraw()},{passive:false});

function setTour(value){
  state.tour=!!value;
  $('tour').classList.toggle('on',state.tour);
  $('tour').textContent=state.tour?'暂停':'巡览';
}
function showToast(html){
  toast.innerHTML=html;toast.classList.remove('hidden');
  clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.add('hidden'),3800);
}

$('tour').onclick=()=>setTour(!state.tour);
$('settings').onclick=()=>sheet.classList.remove('hidden');
$('closeSheet').onclick=()=>sheet.classList.add('hidden');
$('home').onclick=()=>{hub.classList.remove('hidden');sheet.classList.add('hidden');setTour(false)};
$('enterScene').onclick=()=>{hub.classList.add('hidden');requestDraw()};
$('scaleOpen').onclick=()=>scalePanel.classList.remove('hidden');
$('scaleClose').onclick=()=>scalePanel.classList.add('hidden');
scalePanel.addEventListener('click',event=>{if(event.target===scalePanel)scalePanel.classList.add('hidden')});

document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('[data-tab]').forEach(q=>q.classList.toggle('on',q===button));
  document.querySelectorAll('[data-panel]').forEach(panel=>panel.classList.toggle('on',panel.dataset.panel===button.dataset.tab));
});
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{
  state.mode=+button.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(q=>q.classList.toggle('on',q===button));
  requestDraw();
});

const controlKeys=['vivid','clarity','rockLight','plainLight','limestone','warmth','fresh','micro','vegetation','moss','lichen','plainGreen','waterStain','iron','wet','cavity','sun','sky','inspect','exposure'];
function bindControl(key){
  const input=$(key),output=$(key+'V');
  input.oninput=()=>{state[key]=+input.value;output.textContent=state[key].toFixed(2);requestDraw()};
}
controlKeys.forEach(bindControl);
$('reset').onclick=()=>{
  const tour=state.tour,mode=state.mode;Object.assign(state,defaults,{tour,mode});
  for(const key of controlKeys){$(key).value=state[key];$(key+'V').textContent=state[key].toFixed(2)}
  requestDraw();showToast('<b>推荐状态已恢复</b>');
};

addEventListener('resize',requestDraw);
document.addEventListener('visibilitychange',()=>{last=performance.now();requestDraw()});

window.__setLandscapeView__=setView;
window.__setLandscapeTour__=setTour;
window.__setLandscapeMode__=mode=>{state.mode=mode;requestDraw()};
window.__setLandscapeCamera__=value=>{Object.assign(camera,value);requestDraw()};
window.__getLandscapeCamera__=()=>JSON.parse(JSON.stringify(camera));
window.__drawLandscapeNow__=draw;
window.__requestLandscapeFrameMetrics__=()=>{
  draw();
  const width=Math.min(canvas.width,560),height=Math.min(canvas.height,380);
  const x=Math.max(0,(canvas.width-width)>>1),y=Math.max(0,(canvas.height-height)>>1);
  const pixels=new Uint8Array(width*height*4);gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let count=0,lum=0,chroma=0,dark=0,bright=0;
  for(let i=0;i<pixels.length;i+=20){
    const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255;
    if(pixels[i+3]===0)continue;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=.2126*r+.7152*g+.0722*b;
    count++;lum+=l;chroma+=mx-mn;dark+=l<.055;bright+=l>.96;
  }
  return{
    count,meanLuminance:lum/Math.max(count,1),meanChroma:chroma/Math.max(count,1),
    darkRatio:dark/Math.max(count,1),brightRatio:bright/Math.max(count,1),
    glError:gl.getError(),stats,state:{...state},activeView,
    hubVisible:!hub.classList.contains('hidden'),sheetVisible:!sheet.classList.contains('hidden')
  };
};

if(query.get('hub')==='1')hub.classList.remove('hidden');
try{
  load().catch(reason=>{console.error(reason);fail('数值峰林读取失败：'+reason.message)});
  setTour(true);requestAnimationFrame(loop);
}catch(reason){
  console.error(reason);fail('工作台启动失败：'+reason.message);
}
})();