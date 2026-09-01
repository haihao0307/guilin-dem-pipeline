'use strict';
const $=id=>document.getElementById(id),canvas=$('world'),gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});
const S=window.__LANDSCAPE={version:'B3.1',ready:false,error:null,audit:null,textureAllocations:0,geometryUploads:0,frames:0,plantDisplay:false,gray:false};
if(!gl){S.error='WebGL2 unavailable';$('loadingText').textContent='当前浏览器未提供 WebGL2，未启用降精度替代。';throw Error('WebGL2 unavailable')}
const vs=`#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec3 normal;layout(location=2)in vec4 attributes;layout(location=3)in vec3 rest;uniform mat4 vp;out vec3 P;out vec3 N;out vec4 A;out vec3 Q;void main(){P=position;Q=rest;N=normal;A=attributes;gl_Position=vp*vec4(position,1.);}`;
const fs=`#version 300 es
precision highp float;precision highp int;
in vec3 P;in vec3 Q;in vec3 N;in vec4 A;uniform vec3 eye;uniform bool gray;uniform float exposure;out vec4 outColor;
float hash3(ivec3 p){uint h=uint(p.x)*374761393u^uint(p.y)*668265263u^uint(p.z)*2246822519u;h=(h^(h>>13u))*1274126177u;return float(h^(h>>16u))/4294967295.;}
float noise3(vec3 p){ivec3 i=ivec3(floor(p));vec3 f=fract(p);f=f*f*(3.-2.*f);float a=mix(hash3(i),hash3(i+ivec3(1,0,0)),f.x);float b=mix(hash3(i+ivec3(0,1,0)),hash3(i+ivec3(1,1,0)),f.x);float c=mix(hash3(i+ivec3(0,0,1)),hash3(i+ivec3(1,0,1)),f.x);float d=mix(hash3(i+ivec3(0,1,1)),hash3(i+ivec3(1,1,1)),f.x);return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);}
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
vec3 film(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 bump(vec3 n, float h){vec3 dx=dFdx(P),dy=dFdy(P),r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);vec3 grad=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(abs(det)*n-grad);}
void main(){vec3 n=normalize(N);if(!gl_FrontFacing)n=-n;float kind=A.z;vec3 albedo;float rough=.86,ao=clamp(A.x,.1,1.),shadow=clamp(A.y,0.,1.);
float macro=noise3(Q*vec3(.27,.21,.27)),grain=noise3(Q*20.7),fleck=noise3(Q*76.3);
if(kind<.5){
 float lane=noise3(Q*vec3(2.65,.092,2.65)+vec3(3.,5.,7.));
 float thread=noise3(Q*vec3(13.7,.52,13.7)+vec3(8.,3.,2.));
 float wide=noise3(Q*vec3(.36,.29,.39)+vec3(2.,1.,6.));
 float damp=smoothstep(.51,.65,lane*.75+thread*.25)*smoothstep(.23,.65,wide);
 float pale=smoothstep(.24,.71,noise3(Q*vec3(.70,.47,.69)));
 albedo=mix(lin(vec3(.46,.47,.435)),lin(vec3(.67,.668,.611)),pale*.44+.20);
 albedo=mix(albedo,lin(vec3(.18,.218,.213)),damp*.56);
 float ochre=smoothstep(.58,.76,noise3(Q*vec3(.26,.28,.31)+vec3(21.,7.,3.)))*smoothstep(.32,.68,thread);
 albedo=mix(albedo,lin(vec3(.62,.47,.31)),ochre*.33);
 float sedimentCoord=Q.y+.048*Q.x-.038*Q.z+.035*noise3(Q*.87);
 float lamina=1.-smoothstep(.035,.18,abs(sin(sedimentCoord*19.7+.32*noise3(Q*vec3(.7,.1,.8)))));
 lamina*=smoothstep(.30,.61,noise3(Q*vec3(.39,.51,.42)));
 float pores=smoothstep(.64,.88,noise3(Q*7.3))*smoothstep(.45,.73,grain);
 float mineral=smoothstep(.79,.89,fleck);albedo*=.96+.085*grain-.15*lamina-.16*pores;albedo+=mineral*.006;
 albedo=mix(albedo,lin(vec3(.11,.125,.119)),(1.-ao)*.12);
 n=bump(n,(grain-.5)*.0048+(fleck-.5)*.0015-lamina*.005-pores*.011);rough=mix(.77,.96,macro);
}else if(kind<1.5){
 albedo=mix(lin(vec3(.19,.158,.12)),lin(vec3(.285,.241,.181)),macro);
 albedo*=.85+grain*.28;n=bump(n,(grain-.5)*.008);rough=.98;
}else{
 float deposit=smoothstep(.23,.74,noise3(P*.22+vec3(2.,0.,1.)));
 albedo=mix(lin(vec3(.40,.35,.26)),lin(vec3(.32,.31,.26)),deposit);
 albedo*=.91+grain*.17;n=bump(n,(grain-.5)*.005);rough=.99;
}
if(gray)albedo=vec3(.42);
vec3 l=normalize(vec3(-.58,.84,.62)),v=normalize(eye-P),h=normalize(l+v);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.05),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
float alpha=rough*rough,a2=alpha*alpha,den=nh*nh*(a2-1.)+1.;float D=a2/(3.141593*den*den+.0001);float k=(rough+1.)*(rough+1.)*.125;float G=nl/(nl*(1.-k)+k)*nv/(nv*(1.-k)+k);vec3 F=vec3(.035)+(1.-vec3(.035))*pow(1.-vh,5.);
vec3 ambient=albedo*mix(vec3(.245,.27,.28),vec3(.35,.38,.39),n.y*.5+.5)*pow(ao,1.7);
vec3 direct=(albedo/3.141593+F*D*G/(4.*nl*nv+.0001))*nl*vec3(2.25,2.18,2.02)*shadow;
vec3 backlight=vec3(0.);if(kind>2.5)backlight=albedo*max(dot(-n,l),0.)*.37;
vec3 col=pow(film((ambient+direct+backlight)*exposure),vec3(1./2.2));
if(kind>1.5&&kind<2.5){float radius=length(P.xz/vec2(22.,20.));col=mix(col,vec3(.70,.75,.76),smoothstep(.83,1.08,radius));}
float fog=1.-exp(-max(0.,length(eye-P)-48.)*.005);col=mix(col,vec3(.70,.75,.76),fog);outColor=vec4(col,1.);}`;
function shader(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));const u=Object.fromEntries(['vp','eye','gray','exposure'].map(x=>[x,gl.getUniformLocation(program,x)]));
const norm=a=>{let d=Math.hypot(...a)||1;return a.map(v=>v/d)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
function mul(a,b){const r=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[i*4+j]+=a[k*4+j]*b[i*4+k];return r}
let meshes=[],target=[0,6,0],distance=40,yaw=.45,pitch=.25,exposure=1.02,pending=false,right=[1,0,0],up=[0,1,0],worker;
function camera(){const eye=[target[0]+distance*Math.cos(pitch)*Math.sin(yaw),target[1]+distance*Math.sin(pitch),target[2]+distance*Math.cos(pitch)*Math.cos(yaw)],z=norm(sub(eye,target));right=norm(cross([0,1,0],z));up=cross(z,right);const v=[right[0],up[0],z[0],0,right[1],up[1],z[1],0,right[2],up[2],z[2],0,-dot(right,eye),-dot(up,eye),-dot(z,eye),1],near=.025,far=350,f=1/Math.tan(.70/2),asp=canvas.width/canvas.height,p=[f/asp,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];return {vp:mul(p,v),eye}}
function request(){if(!pending){pending=true;requestAnimationFrame(draw)}}
let fence=null;function draw(){pending=false;if(fence){const done=gl.clientWaitSync(fence,0,0);if(done===gl.TIMEOUT_EXPIRED){request();return}gl.deleteSync(fence);fence=null;}const dpr=window.devicePixelRatio||1,w=Math.max(1,Math.round(innerWidth*dpr)),h=Math.max(1,Math.round(innerHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(.70,.75,.76,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!meshes.length)return;gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.useProgram(program);let c=camera();gl.uniformMatrix4fv(u.vp,false,c.vp);gl.uniform3fv(u.eye,c.eye);gl.uniform1i(u.gray,S.gray?1:0);gl.uniform1f(u.exposure,exposure);
 for(const m of meshes){if(m.kind==='ground'&&S.isUnderside)continue;if(m.kind==='growth'&&!S.plantDisplay)continue;if(m.kind==='growth')gl.disable(gl.CULL_FACE);else{gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK)}gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0)}gl.bindVertexArray(null);fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();S.frames++;S.lastCamera={target:[...target],distance,yaw,pitch};}
function upload(m){const vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);for(const [loc,data,size]of [[0,m.positions,3],[1,m.normals,3],[2,m.attributes,4],[3,m.rest??m.positions,3]]){let b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0)}let b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);gl.bindVertexArray(null);S.geometryUploads+=5;return {kind:m.kind,vao,buffers,count:m.indices.length}}
function view(name){S.isUnderside=name==='underside';for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===name);if(name==='overview'){target=[0,6.3,0];distance=40;yaw=.44;pitch=.24;}else if(name==='detail'){target=[-1,6.7,5.2];distance=11.5;yaw=.08;pitch=.08;}else if(name==='side'){target=[0,6.3,0];distance=34;yaw=1.66;pitch=.18;}else if(name==='underside'){target=[0,5,0];distance=31;yaw=.5;pitch=-.8;}else if(name==='back'){target=[0,6.3,0];distance=35;yaw=3.55;pitch=.27;}else if(name==='crown'){target=[0,12.7,0];distance=25;yaw=.50;pitch=.77;}else if(name==='base'){target=[2,1.6,9.7];distance=17;yaw=.5;pitch=.23;}if(innerWidth<650&&name==='overview')distance*=1.55;request()}
S.bookmark=view;S.snapshot=()=>({geometryUploads:S.geometryUploads,frames:S.frames,counts:meshes.map(m=>m.count),camera:S.lastCamera,textureAllocations:S.textureAllocations,glError:gl.getError()});
let drag=null,pointers=new Map();canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;const prev=pointers.get(e.pointerId);if(!prev)return;if(pointers.size===2){let other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1],old=Math.hypot(prev.x-other.x,prev.y-other.y),next=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(old>0&&next>0)distance=Math.max(1,Math.min(100,distance*old/next));}else{let dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.button===2){camera();const scale=distance*.65/innerHeight;target=target.map((v,i)=>v-dx*scale*right[i]+dy*scale*up[i]);}else{yaw-=dx*.005;pitch=Math.max(-1.45,Math.min(1.48,pitch+dy*.005));}}drag.x=e.clientX;drag.y=e.clientY;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});request()};canvas.onpointerup=e=>{pointers.delete(e.pointerId);if(!pointers.size)drag=null};canvas.onpointercancel=canvas.onpointerup;canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(1.5,Math.min(120,distance*Math.exp(e.deltaY*.001)));request()},{passive:false});window.addEventListener('resize',request);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>view(b.dataset.view);$('gray').onclick=()=>{S.gray=!S.gray;$('gray').classList.toggle('active',S.gray);request()};$('info').onclick=()=>$('panel').hidden=!$('panel').hidden;$('closePanel').onclick=()=>$('panel').hidden=true;$('exposure').oninput=e=>{exposure=Number(e.target.value);request()};$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});};window.addEventListener('keydown',e=>{if(e.code==='KeyR')view('overview');if(e.code==='KeyH'){document.body.classList.toggle('clean');request()}});
function download(name,obj){const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('anchors').onclick=()=>S.anchors&&download('Landscape_Mother_B31_Growth_Anchors.json',{schema:'landscape-mother/growth-sites-v1',units:'authored-metres',sites:S.anchors,notACompleteVegetationSystem:true});
async function start(){try{const blob=new Blob(['('+GeneratorRuntime.toString()+')();'],{type:'text/javascript'}),url=URL.createObjectURL(blob);worker=new Worker(url);worker.onerror=e=>fail(e.message);worker.onmessage=({data})=>{if(data.type==='error'){fail(data.message);return}if(data.type==='progress'){$('bar').style.width=Math.round(data.value*100)+'%';return}if(data.type==='complete'){S.audit=data.audit;S.referenceScope='visible-photo-features; no reference mesh rebuilt in this release';S.anchors=data.anchors;S.rockMeta=data.rockMeta;meshes=data.meshes.map(upload);S.ready=true;S.cpuMeshData=data.meshes;S.contactReports=data.contactReports;S.actualPixels={width:canvas.width,height:canvas.height};$('loading').hidden=true;$('facts').innerHTML='<div><span>主岩体</span><b>闭合三维实体</b></div><div><span>主岩体边界</span><b>'+data.audit.body.boundaryEdges+'</b></div><div><span>固定采样</span><b>0.115 m</b></div><div><span>几何三角面</span><b>'+data.audit.totals.triangles.toLocaleString()+'</b></div><div><span>积土生长位</span><b>'+data.audit.growthAnchors+'</b></div><div><span>同族碎岩</span><b>'+data.audit.detachedRockCount+'</b></div>';worker.terminate();URL.revokeObjectURL(url);view('overview');}};worker.postMessage({seed:9031})}catch(e){fail(e.message)}}
function fail(message){worker?.terminate();S.ready=false;S.error=message;$('loading').hidden=false;$('loadingTitle').textContent='样板未通过运行检查';$('loadingText').textContent=message;console.error(message)}
start();
