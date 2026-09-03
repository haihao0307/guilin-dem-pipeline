(()=>{'use strict';
const $=id=>document.getElementById(id), canvas=$('gl'), sub=$('sub'), toast=$('toast'), sheet=$('sheet'), hub=$('hub'), error=$('error'), errorText=$('errorText');
let gl,isGL2=false;
const contextOptions={alpha:true,antialias:true,powerPreference:'high-performance',premultipliedAlpha:false,preserveDrawingBuffer:false};
try{gl=canvas.getContext('webgl2',contextOptions);isGL2=!!gl;if(!gl)gl=canvas.getContext('webgl',contextOptions)||canvas.getContext('experimental-webgl',contextOptions)}catch(_){}
if(!gl){fail('当前窗口没有运行 WebGL。请使用 Safari、Chrome 或 Edge 打开在线页面。');return}
const derivatives=isGL2||gl.getExtension('OES_standard_derivatives');
const uintIndices=isGL2||gl.getExtension('OES_element_index_uint');
if(!derivatives||!uintIndices){fail('当前浏览器缺少三维岩体所需的 WebGL 扩展。');return}
const vaoExt=isGL2?null:gl.getExtension('OES_vertex_array_object');
const makeVAO=()=>isGL2?gl.createVertexArray():(vaoExt?vaoExt.createVertexArrayOES():null);
const bindVAO=v=>{if(isGL2)gl.bindVertexArray(v);else if(vaoExt)vaoExt.bindVertexArrayOES(v)};
function fail(message){error.classList.remove('hidden');errorText.textContent=message}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const vec={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{const n=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/n,a[1]/n,a[2]/n]}};
const defaults={tour:true,stoneLight:1.10,warmth:.56,clarity:1.08,fresh:.82,mineral:.92,wet:.54,runoff:.92,iron:.78,manganese:.64,cavity:.76,moss:.72,lichen:.86,bioCluster:.82,macro:1,meso:1.04,micro:.58,rough:0,sun:4.10,sky:.86,inspect:.62,exposure:1.08,mode:0};
const state={...defaults};
let mesh=null,stats=null;
const VS2=`#version 300 es
layout(location=0)in vec3 aQ;layout(location=1)in vec3 aN;layout(location=2)in vec4 aF1;layout(location=3)in vec4 aF2;layout(location=4)in vec4 aF3;
uniform mat4 uVP;uniform vec3 uMin,uMax;out vec3 P,N;out vec4 F1,F2,F3;
void main(){P=mix(uMin,uMax,aQ);N=aN;F1=aF1;F2=aF2;F3=aF3;gl_Position=uVP*vec4(P,1.);}`;
const VS1=`attribute vec3 aQ;attribute vec3 aN;attribute vec4 aF1;attribute vec4 aF2;attribute vec4 aF3;
uniform mat4 uVP;uniform vec3 uMin,uMax;varying vec3 P,N;varying vec4 F1,F2,F3;
void main(){P=mix(uMin,uMax,aQ);N=aN;F1=aF1;F2=aF2;F3=aF3;gl_Position=uVP*vec4(P,1.);}`;
const UNIFORM_DECL='uniform vec3 uEye,uSunDir;uniform float uSun,uSky,uExposure,uStoneLight,uWarmth,uClarity,uFresh,uMineral,uWet,uRunoff,uIron,uManganese,uCavity,uMoss,uLichen,uBioCluster,uMacro,uMeso,uMicro,uRough,uInspect;uniform int uMode;';
const BODY=`precision highp float;varying vec3 P,N;varying vec4 F1,F2,F3;${UNIFORM_DECL}
float h31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fb2(vec3 p){return .68*n3(p)+.32*n3(p*2.03+vec3(13.7,9.1,4.3));}
float s2lf(float c){return c<=.04045?c/12.92:pow((c+.055)/1.055,2.4);}vec3 s2l(vec3 c){return vec3(s2lf(c.r),s2lf(c.g),s2lf(c.b));}
float l2sf(float c){return c<=.0031308?c*12.92:1.055*pow(max(c,0.),1./2.4)-.055;}vec3 l2s(vec3 c){return vec3(l2sf(c.r),l2sf(c.g),l2sf(c.b));}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 safeNorm(vec3 x){return x/max(length(x),1e-5);}
void main(){
 float mat=floor(F1.x*255.+.5),wetInput=F1.y,bioInput=F1.z,runInput=F1.w;
 float freshInput=F2.x,skyAccess=F2.y,roughInput=F2.z,sunVis=F2.w;
 float ironInput=F3.x,mineralVar=F3.y,cavityInput=F3.z,manganeseInput=F3.w;
 vec3 dpdx=dFdx(P),dpdy=dFdy(P),face=safeNorm(cross(dpdx,dpdy));if(dot(face,N)<0.)face=-face;
 vec3 n=safeNorm(mix(safeNorm(N),face,.26+.22*freshInput));
 float macroN=fb2(P*.095+vec3(4.1,2.3,1.7));
 float mesoN=fb2(P*.43+vec3(13.2,4.9,8.4));
 float grain=fb2(P*3.25+vec3(2.7,7.1,11.6));
 float grain2=n3(P*8.8+vec3(21.4,3.2,9.7));
 float wetFilm=clamp(wetInput*uWet,0.,1.);
 float runoff=clamp(runInput*uRunoff,0.,1.);
 float cavity=clamp(cavityInput*uCavity,0.,1.);
 float iron=clamp(ironInput*uIron,0.,1.);
 float manganese=clamp(manganeseInput*uManganese,0.,.58);
 float fresh=clamp(freshInput*uFresh,0.,1.);
 float shelter=clamp(1.-skyAccess,0.,1.);
 float broadSpot=smoothstep(.28,.76,mix(mineralVar,macroN,.42));
 float flowEdge=smoothstep(.15,.46,runoff)*(1.-smoothstep(.66,.92,runoff));
 float pore=smoothstep(.79,.94,grain2)*clamp(.18+.52*cavity+.30*fresh,0.,1.);
 float moss=clamp(bioInput*wetFilm*uMoss*uBioCluster*smoothstep(.40,.72,mesoN)*(.42+.58*shelter),0.,.72);
 float lichen=clamp(bioInput*uLichen*(1.-moss*.65)*smoothstep(.30,.74,macroN)*(.70+.30*skyAccess),0.,.66);
 float ironWeight=clamp(iron*uMineral*(.38+.62*flowEdge),0.,.72);
 float manganeseWeight=clamp(manganese*(.34+.66*runoff)*(.38+.62*shelter),0.,.34);
 float freshWeight=clamp(fresh*(.55+.25*mesoN)*(1.-wetFilm*.32),0.,.62);
 vec3 base;
 float rough=clamp(roughInput+uRough,.28,.98);
 if(mat<.5){
   vec3 soilDry=s2l(vec3(.275,.235,.165)),soilWarm=s2l(vec3(.405,.335,.215)),soilWet=s2l(vec3(.175,.185,.125)),groundGreen=s2l(vec3(.135,.245,.095));
   base=mix(soilDry,soilWarm,clamp(.25+.65*macroN,0.,1.));
   float turf=clamp(bioInput*(.42+.58*wetInput)*smoothstep(.38,.69,mesoN),0.,.72);
   base=mix(base,groundGreen,turf*.66);base=mix(base,soilWet,wetFilm*.32);rough=clamp(rough+.08-.12*wetFilm,.52,.98);
 }else{
   vec3 cool=s2l(vec3(.43,.455,.445));
   vec3 warm=s2l(vec3(.615,.590,.505));
   vec3 ivory=s2l(vec3(.755,.735,.655));
   vec3 weathered=s2l(vec3(.475,.430,.335));
   vec3 ironC=s2l(vec3(.53,.315,.145));
   vec3 manganeseC=s2l(vec3(.115,.135,.125));
   vec3 lichenC=s2l(vec3(.455,.500,.335));
   vec3 mossC=s2l(vec3(.105,.255,.075));
   float warmMix=clamp(.16+.46*mineralVar+.22*macroN+(uWarmth-.5)*.42,0.,1.);
   vec3 limestone=mix(cool,warm,warmMix);limestone=mix(limestone,weathered,broadSpot*.20*uMineral);
   float eventSum=freshWeight+ironWeight+manganeseWeight+moss+lichen;
   float wBase=max(.36,1.-eventSum*.62),sum=wBase+freshWeight+ironWeight+manganeseWeight+moss+lichen;
   base=(limestone*wBase+ivory*freshWeight+ironC*ironWeight+manganeseC*manganeseWeight+mossC*moss+lichenC*lichen)/max(sum,.001);
   float lum=dot(base,vec3(.2126,.7152,.0722));base=clamp(mix(vec3(lum),base,uClarity),0.,1.);
   base*=uStoneLight*mix(.94,1.07,(macroN-.5)*uMacro+.5);
   base=mix(base,base*vec3(.91,1.00,1.035),wetFilm*.16);base*=mix(1.,.78,wetFilm);
   base*=mix(1.,.91,pore*.28);
   rough=clamp(rough+.08*lichen+.11*moss+.09*pore+.035*(mesoN-.5)*uMeso-.22*wetFilm-.08*fresh+.03*flowEdge,.31,.98);
 }
 float microMask=clamp(.12+.38*fresh+.25*flowEdge+.31*cavity+.18*pore,0.,1.);
 float microHeight=(.58*grain+.27*grain2+.15*mesoN)*microMask;
 float hx=dFdx(microHeight),hy=dFdy(microHeight);vec3 r1=cross(dpdy,n),r2=cross(n,dpdx);float det=dot(dpdx,r1);vec3 grad=(r1*hx+r2*hy)/max(abs(det),.0001);
 n=safeNorm(n-sign(det)*grad*uMicro*(mat<.5?.025:.105));
 if(uMode==1){OUT=vec4(l2s(clamp(base,0.,1.)),1.);return;}
 if(uMode==2){OUT=vec4(mix(vec3(.035,.055,.065),vec3(.95,.58,.10),runoff),1.);return;}
 if(uMode==3){OUT=vec4(mix(vec3(.72,.64,.43),vec3(.035,.32,.52),wetFilm),1.);return;}
 if(uMode==4){OUT=vec4(clamp(vec3(moss*.35,moss+lichen*.55,lichen*.34),0.,1.),1.);return;}
 if(uMode==5){OUT=vec4(clamp(vec3(cavity*.92,manganeseWeight*.55,cavity*.22+manganeseWeight),0.,1.),1.);return;}
 if(uMode==10){OUT=vec4(mat<.5?vec3(0.,1.,0.):vec3(1.,0.,0.),1.);return;}
 if(uMode==6){OUT=vec4(vec3(rough),1.);return;}
 if(uMode==7){OUT=vec4(n*.5+.5,1.);return;}
 if(uMode==8){OUT=vec4(vec3(skyAccess*mix(.18,1.,sunVis)),1.);return;}
 if(uMode==9){OUT=vec4(clamp(vec3(freshWeight+ironWeight*.6,moss+lichen*.7,flowEdge+manganeseWeight),0.,1.),1.);return;}
 vec3 v=safeNorm(uEye-P),l=safeNorm(uSunDir),h=safeNorm(v+l);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.02),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
 float a=rough*rough,a2=a*a,den=nh*nh*(a2-1.)+1.,D=a2/(3.14159265*den*den+.0001),k=(rough+1.)*(rough+1.)/8.,G=(nl/(nl*(1.-k)+k))*(nv/(nv*(1.-k)+k));
 vec3 F=vec3(.04)+(1.-vec3(.04))*pow(1.-vh,5.);vec3 diff=(1.-F)*base/3.14159265,spec=D*G*F/max(4.*nl*nv,.01);
 vec3 sunColor=s2l(vec3(1.,.955,.84)),skyColor=s2l(vec3(.48,.62,.66)),groundColor=s2l(vec3(.39,.315,.22));float up=clamp(n.y*.5+.5,0.,1.);
 float directVisibility=mix(.20,1.,sunVis);float ambientVisibility=mix(1.,skyAccess,uCavity);
 vec3 direct=(diff+spec)*sunColor*uSun*nl*directVisibility;
 vec3 hemi=base*mix(groundColor,skyColor,up)*uSky*ambientVisibility*(.68+.32*up);
 vec3 fill=base*s2l(vec3(.34,.43,.45))*.20*max(dot(n,safeNorm(vec3(-.72,.38,-.25))),0.);
 vec3 inspect=base*s2l(vec3(.78,.82,.78))*uInspect*max(dot(n,v),0.)*(.18+.82*cavity);
 vec3 wetSpark=spec*s2l(vec3(.72,.84,.86))*wetFilm*.55*(.35+.65*max(dot(n,v),0.));
 vec3 lit=(direct+hemi+fill+inspect+wetSpark)*uExposure;
 OUT=vec4(l2s(aces(lit)),1.);
}`;
const FS2=`#version 300 es
precision highp float;in vec3 P,N;in vec4 F1,F2,F3;${UNIFORM_DECL}out vec4 frag;
#define OUT frag
`+BODY.replace(`precision highp float;varying vec3 P,N;varying vec4 F1,F2,F3;${UNIFORM_DECL}`,'');
const FS1=`#extension GL_OES_standard_derivatives : enable
#define OUT gl_FragColor
`+BODY;
function compileShader(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'shader compile');return shader}
const program=gl.createProgram();gl.attachShader(program,compileShader(gl.VERTEX_SHADER,isGL2?VS2:VS1));gl.attachShader(program,compileShader(gl.FRAGMENT_SHADER,isGL2?FS2:FS1));
if(!isGL2)['aQ','aN','aF1','aF2','aF3'].forEach((name,index)=>gl.bindAttribLocation(program,index,name));
gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'program link');
const uniformNames=['uVP','uMin','uMax','uEye','uSunDir','uSun','uSky','uExposure','uStoneLight','uWarmth','uClarity','uFresh','uMineral','uWet','uRunoff','uIron','uManganese','uCavity','uMoss','uLichen','uBioCluster','uMacro','uMeso','uMicro','uRough','uInspect','uMode'];
const U=Object.fromEntries(uniformNames.map(name=>[name,gl.getUniformLocation(program,name)]));
function makeMesh(buffer,vertexOffset,vertexCount,indexOffset,indexCount,min,max){const vao=makeVAO(),vbo=gl.createBuffer(),ibo=gl.createBuffer();bindVAO(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(buffer,vertexOffset,vertexCount*24),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(buffer,indexOffset,indexCount),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.UNSIGNED_SHORT,true,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.SHORT,true,24,6);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.UNSIGNED_BYTE,true,24,12);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.UNSIGNED_BYTE,true,24,16);gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,4,gl.UNSIGNED_BYTE,true,24,20);bindVAO(null);return{vao,vbo,ibo,count:indexCount,min,max}}
function bindMesh(m){if(vaoExt||isGL2){bindVAO(m.vao);return}gl.bindBuffer(gl.ARRAY_BUFFER,m.vbo);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ibo);for(let i=0;i<5;i++)gl.enableVertexAttribArray(i);gl.vertexAttribPointer(0,3,gl.UNSIGNED_SHORT,true,24,0);gl.vertexAttribPointer(1,3,gl.SHORT,true,24,6);gl.vertexAttribPointer(2,4,gl.UNSIGNED_BYTE,true,24,12);gl.vertexAttribPointer(3,4,gl.UNSIGNED_BYTE,true,24,16);gl.vertexAttribPointer(4,4,gl.UNSIGNED_BYTE,true,24,20)}
async function getBuffer(){const response=await fetch('scene.bin',{cache:'no-store'});if(!response.ok)throw Error('数值岩体请求失败 '+response.status);const total=+(response.headers.get('content-length')||0);if(!response.body||!total)return response.arrayBuffer();const reader=response.body.getReader(),parts=[];let got=0;for(;;){const item=await reader.read();if(item.done)break;parts.push(item.value);got+=item.value.byteLength;sub.textContent='正在读取数值岩体 · '+Math.round(got/total*100)+'%'}const all=new Uint8Array(got);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.byteLength}return all.buffer}
async function load(){const buffer=await getBuffer(),view=new DataView(buffer);if(String.fromCharCode(...new Uint8Array(buffer,0,4))!=='LMK3')throw Error('数值岩体格式错误');const version=view.getUint32(4,true),stride=view.getUint32(8,true),vertexCount=view.getUint32(12,true),indexCount=view.getUint32(16,true),f=o=>view.getFloat32(o,true),min=[f(20),f(24),f(28)],max=[f(32),f(36),f(40)],vertexOffset=view.getUint32(44,true),indexOffset=view.getUint32(48,true),watertight=!!view.getUint32(52,true),euler=view.getInt32(56,true),seed=view.getUint32(60,true);if(version!==3||stride!==24||vertexOffset!==80)throw Error('数值岩体版本不兼容');mesh=makeMesh(buffer,vertexOffset,vertexCount,indexOffset,indexCount,min,max);stats={version:'V013',vertices:vertexCount,triangles:indexCount/3,binaryBytes:buffer.byteLength,watertight,euler,seed,webgl:isGL2?2:1,textureSampling:false,images:document.images.length,externalModels:0,fog:false,distantMountains:false,runtimeLOD:false,deviceDependentGeometry:false,materialMethod:'event-field-splat'};window.__LANDSCAPE_STATS__=stats;sub.textContent='V013 · 已就绪 · '+vertexCount.toLocaleString()+' 顶点 · '+(indexCount/3).toLocaleString()+' 三角面';toast.innerHTML='<b>喀斯特材质实验 V013</b> · 水迹、矿物与青苔已拆成独立事件场';toast.classList.remove('hide');setTimeout(()=>toast.classList.add('hide'),4200);window.__LANDSCAPE_READY__=true;requestDraw()}
const perspective=(fov,aspect,near,far)=>{const t=1/Math.tan(fov/2),q=1/(near-far);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0])};
function lookAt(eye,target){const z=vec.norm(vec.sub(eye,target)),x=vec.norm(vec.cross([0,1,0],z)),y=vec.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-vec.dot(x,eye),-vec.dot(y,eye),-vec.dot(z,eye),1])}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out}
const views={hero:{yaw:.82,pitch:.40,dist:82,target:[-1,6.5,0]},side:{yaw:1.50,pitch:.29,dist:76,target:[-1,6.5,0]},cliff:{yaw:1.55,pitch:.18,dist:45,target:[4.5,9.5,0]},cave:{yaw:.34,pitch:.16,dist:34,target:[-7.5,5.1,-3.5]},top:{yaw:.78,pitch:1.03,dist:72,target:[0,2.5,0]}};
let camera=JSON.parse(JSON.stringify(views.hero)),activeView='hero',raf=0,last=performance.now(),pointers=new Map(),gesture=null;
function setView(name){if(!views[name])return;activeView=name;camera=JSON.parse(JSON.stringify(views[name]));document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('on',button.dataset.view===name));requestDraw()}
function resize(){const cap=innerWidth<720?1.30:1.75,dpr=Math.min(devicePixelRatio||1,cap),width=Math.max(1,Math.round(canvas.clientWidth*dpr)),height=Math.max(1,Math.round(canvas.clientHeight*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}}
function draw(){raf=0;if(!mesh)return;resize();const cp=Math.cos(camera.pitch),eye=[camera.target[0]+Math.sin(camera.yaw)*cp*camera.dist,camera.target[1]+Math.sin(camera.pitch)*camera.dist,camera.target[2]+Math.cos(camera.yaw)*cp*camera.dist],vp=multiply(perspective(.67,canvas.width/canvas.height,.08,240),lookAt(eye,camera.target));gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.useProgram(program);gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform3f(U.uMin,...mesh.min);gl.uniform3f(U.uMax,...mesh.max);gl.uniform3f(U.uEye,...eye);gl.uniform3f(U.uSunDir,.50,.78,.37);const uniformMap={uSun:'sun',uSky:'sky',uExposure:'exposure',uStoneLight:'stoneLight',uWarmth:'warmth',uClarity:'clarity',uFresh:'fresh',uMineral:'mineral',uWet:'wet',uRunoff:'runoff',uIron:'iron',uManganese:'manganese',uCavity:'cavity',uMoss:'moss',uLichen:'lichen',uBioCluster:'bioCluster',uMacro:'macro',uMeso:'meso',uMicro:'micro',uRough:'rough',uInspect:'inspect'};for(const [uniform,key] of Object.entries(uniformMap))gl.uniform1f(U[uniform],state[key]);gl.uniform1i(U.uMode,state.mode);bindMesh(mesh);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);bindVAO(null);window.__LANDSCAPE_GL_ERROR__=gl.getError()}
function requestDraw(){if(!raf)raf=requestAnimationFrame(draw)}
function loop(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;if(state.tour&&!document.hidden&&mesh){camera.yaw+=dt*.050;requestDraw()}requestAnimationFrame(loop)}
function pointerSnapshot(){const items=[...pointers.values()];if(items.length===1)return{mode:1,x:items[0].x,y:items[0].y,yaw:camera.yaw,pitch:camera.pitch};if(items.length>=2){const x=(items[0].x+items[1].x)/2,y=(items[0].y+items[1].y)/2,distance=Math.hypot(items[0].x-items[1].x,items[0].y-items[1].y);return{mode:2,x,y,distance,dist:camera.dist,target:[...camera.target]}}return null}
canvas.addEventListener('pointerdown',event=>{try{canvas.setPointerCapture(event.pointerId)}catch(_){}pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});gesture=pointerSnapshot();setTour(false)},{passive:false});
canvas.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const current=pointerSnapshot();if(!gesture||!current){gesture=current;return}if(current.mode===1&&gesture.mode===1){camera.yaw=gesture.yaw-(current.x-gesture.x)*.006;camera.pitch=clamp(gesture.pitch-(current.y-gesture.y)*.0052,-.03,1.24)}else if(current.mode===2&&gesture.mode===2){camera.dist=clamp(gesture.dist*gesture.distance/Math.max(12,current.distance),8,105);const pan=gesture.dist*.0017,rx=Math.cos(camera.yaw),rz=-Math.sin(camera.yaw);camera.target=[gesture.target[0]-(current.x-gesture.x)*rx*pan,gesture.target[1]+(current.y-gesture.y)*pan,gesture.target[2]-(current.x-gesture.x)*rz*pan]}requestDraw()},{passive:false});
function endPointer(event){pointers.delete(event.pointerId);gesture=pointerSnapshot()}canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('wheel',event=>{event.preventDefault();setTour(false);camera.dist=clamp(camera.dist*Math.exp(event.deltaY*.001),8,105);requestDraw()},{passive:false});
function setTour(value){state.tour=!!value;$('tour').classList.toggle('on',state.tour);$('tour').textContent=state.tour?'暂停':'巡览'}
$('tour').onclick=()=>setTour(!state.tour);$('settings').onclick=()=>sheet.classList.remove('hidden');$('close').onclick=()=>sheet.classList.add('hidden');$('home').onclick=()=>hub.classList.remove('hidden');$('enterKarst').onclick=()=>hub.classList.add('hidden');
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(q=>q.classList.toggle('on',q===button));document.querySelectorAll('[data-panel]').forEach(panel=>panel.classList.toggle('on',panel.dataset.panel===button.dataset.tab))});
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{state.mode=+button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(q=>q.classList.toggle('on',q===button));requestDraw()});
const controlKeys=['stoneLight','warmth','clarity','fresh','mineral','wet','runoff','iron','manganese','cavity','moss','lichen','bioCluster','macro','meso','micro','rough','sun','sky','inspect','exposure'];
function bindControl(key){const input=$(key),output=$(key+'V');input.oninput=()=>{state[key]=+input.value;output.textContent=state[key].toFixed(2);requestDraw()}}
controlKeys.forEach(bindControl);
$('resetMaterial').onclick=()=>{Object.assign(state,defaults,{tour:state.tour,mode:state.mode});for(const key of controlKeys){$(key).value=state[key];$(key+'V').textContent=state[key].toFixed(2)}requestDraw();toast.innerHTML='<b>推荐材质状态已恢复</b>';toast.classList.remove('hide');setTimeout(()=>toast.classList.add('hide'),1800)};
addEventListener('resize',requestDraw);document.addEventListener('visibilitychange',()=>{last=performance.now();requestDraw()});
window.__setLandscapeView__=setView;window.__setLandscapeTour__=setTour;window.__setLandscapeMode__=mode=>{state.mode=mode;requestDraw()};window.__setLandscapeCamera__=value=>{Object.assign(camera,value);requestDraw()};
window.__requestLandscapeFrameMetrics__=()=>{draw();const width=Math.min(canvas.width,520),height=Math.min(canvas.height,360),x=Math.max(0,(canvas.width-width)>>1),y=Math.max(0,(canvas.height-height)>>1),pixels=new Uint8Array(width*height*4);gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let samples=0,luminance=0,chroma=0,dark=0,bright=0;for(let i=0;i<pixels.length;i+=20){const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,sky=b>.46&&g>.42&&b>r*1.10;if(sky)continue;const max=Math.max(r,g,b),min=Math.min(r,g,b),lum=.2126*r+.7152*g+.0722*b;samples++;luminance+=lum;chroma+=max-min;dark+=lum<.08;bright+=lum>.94}return{samples,meanLuminance:luminance/Math.max(samples,1),meanChroma:chroma/Math.max(samples,1),darkRatio:dark/Math.max(samples,1),brightRatio:bright/Math.max(samples,1),glError:gl.getError(),stats,state:{...state},activeView,hubVisible:!hub.classList.contains('hidden'),sheetVisible:!sheet.classList.contains('hidden')}};

// Navigation is presentation state; camera/material/geometry remain intact.
const onlineRelease='v013-online-20260903-r1';
window.__LANDSCAPE_RELEASE__=onlineRelease;
window.__LANDSCAPE_GET_CAMERA__=()=>JSON.parse(JSON.stringify(camera));
function applyRoute(){
  const scene=location.hash==='#karst'||(location.hash!=='#home'&&new URLSearchParams(location.search).get('scene')==='karst');
  hub.classList.toggle('hidden',scene);document.body.classList.toggle('hub-open',!scene);
  sheet.classList.add('hidden');setTour(false);requestDraw();
}
function goRoute(scene){history.pushState({scene},'',scene?'#karst':'#home');applyRoute()}
$('home').onclick=()=>goRoute(false);$('enterKarst').onclick=()=>goRoute(true);
addEventListener('popstate',applyRoute);addEventListener('hashchange',applyRoute);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();setTour(false);fail('三维绘图上下文已中断，请按重新载入。')});
window.__LANDSCAPE_ROCK_METRICS__=()=>{
  const mode=state.mode;state.mode=10;draw();
  const w=canvas.width,h=canvas.height,mask=new Uint8Array(w*h*4),pixels=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,mask);state.mode=mode;draw();
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let count=0,lum=0,chroma=0,dark=0,bright=0,hash=2166136261;
  for(let i=0;i<pixels.length;i+=16){
    if(mask[i]<200||mask[i+1]>40||mask[i+3]<200)continue;
    const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,y=.2126*r+.7152*g+.0722*b;
    count++;lum+=y;chroma+=Math.max(r,g,b)-Math.min(r,g,b);dark+=y<.08;bright+=y>.94;
    hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+1],16777619);hash=Math.imul(hash^pixels[i+2],16777619);
  }
  return {count,meanLuminance:lum/Math.max(1,count),meanChroma:chroma/Math.max(1,count),darkRatio:dark/Math.max(1,count),brightRatio:bright/Math.max(1,count),frameHash:(hash>>>0).toString(16),glError:gl.getError(),mask:'explicit-rock-material-id',width:w,height:h};
};

try{load().catch(reason=>{console.error(reason);fail('数值地貌读取失败：'+reason.message)});setView('hero');applyRoute();requestAnimationFrame(loop)}catch(reason){console.error(reason);fail('工作台启动失败：'+reason.message)}
})();
