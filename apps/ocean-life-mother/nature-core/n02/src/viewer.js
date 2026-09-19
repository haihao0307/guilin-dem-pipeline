/* N02 view: analytic implicit surfaces evaluated in a fragment shader.
   4 screen-coverage vertices per draw; no fish/coral triangle topology or source assets.
   This is an authored visual prototype, not a calibrated natural-species reconstruction. */
(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('gl'),gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
if(!gl){$('bootText').textContent='需要支持 WebGL2 的浏览器。';return;}
const V=`#version 300 es
precision highp float;uniform vec4 rect;out vec2 uv;void main(){vec2 q=vec2(float(gl_VertexID%2),float(gl_VertexID/2));uv=q;gl_Position=vec4(mix(rect.xy,rect.zw,q),0.,1.);}`;
const common=`precision highp float;precision highp int;uniform vec3 eye;uniform mat3 camera;uniform mat4 vp;uniform vec2 resolution;uniform float focal,time;out vec4 frag;
vec3 ray(){return normalize(camera*vec3((gl_FragCoord.xy-resolution*.5)/focal,-1.));}
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float bed(float x,float z){return -2.55+.12*sin(.5*x)+.08*cos(.6*z)+.015*x;}
vec3 tone(vec3 x){x=max(x,0.);return pow(clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.),vec3(1./2.2));}
void depth(vec3 p){vec4 q=vp*vec4(p,1.);gl_FragDepth=q.z/q.w*.5+.5;}
vec3 waterFog(vec3 c,float d){return mix(c,vec3(.012,.14,.20),1.-exp(-d*.065));}
`;
const BG=`#version 300 es
${common}
void main(){vec3 rd=ray();float up=clamp(rd.y*.5+.5,0.,1.);vec3 c=mix(vec3(.002,.034,.067),vec3(.025,.155,.205),up);float shaft=pow(max(0.,sin(rd.x*18.+rd.z*6.+time*.018)),18.);c+=shaft*.024*pow(up,2.);gl_FragDepth=1.;
if(rd.y<-.018){float t=(-2.55-eye.y)/rd.y;for(int i=0;i<7;i++){vec3 p=eye+rd*t;t+=(bed(p.x,p.z)-p.y)/rd.y;}if(t>0.&&t<65.){vec3 p=eye+rd*t;float rip=sin(p.x*20.+sin(p.z*2.)*2.),grain=hash(floor(p*300.));float ca=pow(.5+.5*sin(p.x*3.2+sin(p.z*2.9+time*.2)),14.)+pow(.5+.5*sin(p.z*3.7+sin(p.x*3.+time*.14)),18.);c=vec3(.25,.30,.27)*(1.+rip*.045+grain*.06)+vec3(.11,.17,.13)*ca;float vign=exp(-length(p.xz)*.03);c*=.75+.25*vign;for(int j=0;j<3;j++){vec2 cp=j==0?vec2(-3.3,1.1):j==1?vec2(.2,1.2):vec2(3.3,-.7);c*=1.-.38*exp(-dot(p.xz-cp,p.xz-cp)/1.4);}c=waterFog(c,t);depth(p);}}
frag=vec4(tone(c),1.);}`;
const FS=`#version 300 es
${common}
uniform vec3 origin;uniform float objScale,yaw,phase,bodyH,bodyW,tailH,dorsal,forkDepth;uniform int kind,palette,shape;
float ell(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/max(k1,.00001);}
float cap(vec3 p,vec3 a,vec3 b,float ra,float rb){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}
vec2 hitmin(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec3 unbend(vec3 q){float t=clamp((.26-q.x)/1.03,0.,1.);q.z-=.077*t*t*sin(phase-t*4.1);return q;}
vec2 fish(vec3 src){vec3 p=unbend(src);float power=3.4;vec3 r=vec3(.50,bodyH,bodyW);vec3 z=abs(p/r);float k=shape==4?pow(pow(z.x,power)+pow(z.y,power)+pow(z.z,power),1./power):length(z);float d=(k-1.)*min(bodyW,bodyH)*.74;vec2 res=vec2(d,0.);
if(shape==1){d=ell(p-vec3(.45,-.01,0.),vec3(.155,.059,.049));res=hitmin(res,vec2(d,0.));}
float mouthX=shape==1?.57:.478;float open=.008+.006*(.5+.5*sin(phase*.47));float mouth=ell(p-vec3(mouthX,-.026,0.),vec3(.069,open,.049));res.x=max(res.x,-mouth);if(mouth<.008&&p.x>mouthX-.065)res.y=4.;
float t=clamp((-.44-p.x)/.38,0.,1.);float h=mix(.024,tailH,pow(t,.9));float fork=forkDepth;float tailEnd=-.82+fork*(1.-clamp(abs(p.y)/max(tailH,.01),0.,1.));d=max(max(abs(p.z)-.009,abs(p.y)-h),max(p.x+.42,tailEnd-p.x));res=hitmin(res,vec2(d,1.));
// Fins are bounded analytic sheets. Curved profiles and fin-ray material share coordinates.
float fx=(p.x+.07)/.38;float edge=sqrt(max(0.,1.-fx*fx));float root=bodyH*sqrt(max(.01,1.-p.x*p.x/.25));float top=root+dorsal*edge;float finZ=p.z-.012*sin(phase*.8+p.x*4.);d=max(max(abs(finZ)-.007,abs(fx)-1.),max(root*.85-p.y,p.y-top));res=hitmin(res,vec2(d,1.));
float bot=root+dorsal*.50*edge;d=max(max(abs(finZ)-.007,abs(fx)-1.),max(p.y+root*.85,-p.y-bot));res=hitmin(res,vec2(d,1.));
// Paired pectoral fins have independent local phase, not whole-body translation.
vec3 fp=vec3(p.x-.045,p.y+.06,abs(p.z)-bodyW*.84);float flap=.27*sin(phase*.53);vec3 f=vec3(fp.x*cos(flap)-fp.z*sin(flap),fp.y,fp.x*sin(flap)+fp.z*cos(flap));d=ell(f-vec3(-.087,-.014,.056),vec3(.12,.075,.011));res=hitmin(res,vec2(d,1.));
vec3 ec=vec3(.345,bodyH*.24,bodyW*.74);vec3 ep=vec3(p.x-ec.x,p.y-ec.y,abs(p.z)-ec.z);res=hitmin(res,vec2(ell(ep,vec3(.037,.037,.028)),2.));res=hitmin(res,vec2(ell(ep-vec3(.006,0.,.025),vec3(.022,.024,.013)),3.));return res;}
float folds(vec3 q){float x=q.x*18.,y=q.y*18.,z=q.z*18.;float g=sin(x+.3*sin(z*2.))*cos(y)+sin(y)*cos(z)+sin(z)*cos(x);return exp(-g*g*7.);}
vec2 coral(vec3 p){float d;
if(shape==0){vec3 q=p/vec3(.83,.53,.75);float f=folds(normalize(q));d=ell(p,vec3(.83,.53,.75))-.024*f;return vec2(d,5.+f*.7);}
if(shape==1){d=ell(p-vec3(0.,-.18,0.),vec3(.20,.39,.19));d=min(d,ell(p-vec3(0.,.20,0.),vec3(.90,.074,.75)));d=min(d,ell(p-vec3(.06,.03,.03),vec3(.68,.065,.66)));return vec2(d,6.);}
d=cap(p,vec3(0.,-.57,0.),vec3(0.,.68,0.),.13,.027);
for(int i=0;i<9;i++){float k=float(i),a=k*2.4;vec3 b=vec3(0.,-.37+k*.064,0.),e=b+vec3(cos(a)*(.44-.012*k),.39,sin(a)*(.44-.012*k));d=min(d,cap(p,b,e,.069,.016));vec3 mid=mix(b,e,.68);d=min(d,cap(p,mid,mid+vec3(cos(a+1.4)*.16,.25,sin(a+1.4)*.16),.035,.009));}return vec2(d,6.);}
vec2 scene(vec3 p){return kind==0?fish(p):coral(p);}
vec3 colour(vec3 q,float material){if(kind==1){float f=folds(normalize(q+vec3(.01)));vec3 low=palette==0?vec3(.18,.30,.065):palette==1?vec3(.30,.08,.20):palette==2?vec3(.38,.18,.073):vec3(.06,.28,.29);vec3 high=palette==0?vec3(.55,.67,.20):palette==1?vec3(.65,.33,.59):palette==2?vec3(.72,.55,.32):vec3(.20,.61,.60);return mix(low,high,shape==0?f*.8:clamp(q.y+.5,0.,1.));}
if(material>2.5&&material<3.5)return vec3(.006,.009,.012);if(material>1.5&&material<2.5)return vec3(.53,.41,.16);if(material>3.5)return vec3(.12,.035,.026);
vec3 p=unbend(q);float u=p.x,v=p.y;vec3 c;
if(palette==0){c=mix(vec3(.018,.038,.30),vec3(1.,.60,.025),smoothstep(-.28,.22,u));if(v>bodyH*.65)c=vec3(.035,.13,.60);}
else if(palette==1){float b=smoothstep(.10,.16,abs(sin((u+.13)*13.)));c=mix(vec3(.013,.022,.033),vec3(.9,.87,.60),b);if(u>.33||u<-.47)c=vec3(.94,.64,.016);}
else if(palette==2){c=mix(vec3(.60,.74,.77),vec3(.012,.12,.26),smoothstep(-.05,bodyH*.6,v));if(material>.5)c=mix(c,vec3(.92,.68,.09),.65);}
else if(palette==3){c=vec3(.94,.22,.014);float stripe=1.-smoothstep(.048,.070,min(abs(u-.20),min(abs(u+.09),abs(u+.36))));c=mix(c,vec3(.90,.91,.82),stripe);}
else if(palette==4){c=mix(vec3(.12,.52,.29),vec3(.025,.37,.60),smoothstep(-bodyH,bodyH,v));float row=floor((v+1.)*36.);float band=abs(fract((u+.012*mod(row,2.))*42.)-.5);c=mix(c,vec3(.65,.22,.15),1.-smoothstep(.02,.065,band));}
else if(palette==5){c=vec3(.028,.26,.94);float dash=1.-smoothstep(.075,.11,abs(v-.055-.06*sin(u*7.)));c=mix(c,vec3(.01,.034,.12),dash*smoothstep(-.37,-.1,u));if(u<-.47||v>bodyH*.73)c=vec3(.92,.73,.015);}
else if(palette==6){c=vec3(.96,.64,.025);vec2 cell=fract(vec2(u*29.,v*32.))-.5;float spot=1.-smoothstep(.18,.25,length(cell));c=mix(c,vec3(.32,.74,.71),spot);}
else{float t=smoothstep(-.15,.2,sin(v*93.+sin(u*8.)*1.6));c=mix(vec3(.16,.025,.52),vec3(.96,.75,.09),t);}
float scales=sin((u+floor((v+.5)*100.)*.008)*235.);float sf=.96+.04*scales;c*=sf;
if(material>.5&&material<1.5){float rays=.86+.14*sin(atan(p.y,p.x+.43)*68.);c*=rays;}
// A shallow crease, not substituted for the gill structure (independent articulation not yet implemented).
float g=abs(p.x-(.19-.32*p.y*p.y));if(g<.004&&abs(p.y)<bodyH*.62&&material<.5)c*=.78;
return c;}
void main(){vec3 rd=ray();float cs=cos(yaw),sn=sin(yaw);mat3 R=mat3(cs,0.,sn,0.,1.,0.,-sn,0.,cs);vec3 ro=transpose(R)*(eye-origin)/objScale,dr=transpose(R)*rd;vec3 lim=kind==0?vec3(.93,.65,.36):vec3(1.04,.90,1.04);vec3 invD=1./dr;vec3 lo=(-lim-ro)*invD,hi=(lim-ro)*invD;vec3 mn=min(lo,hi),mx=max(lo,hi);float t=max(0.,max(mn.x,max(mn.y,mn.z))),end=min(mx.x,min(mx.y,mx.z));if(t>end)discard;vec2 m;bool found=false;vec3 p;
for(int i=0;i<72;i++){p=ro+dr*t;m=scene(p);if(m.x<.0013){found=true;break;}t+=max(.0006,m.x*.70);if(t>end)break;}if(!found)discard;
float e=.0015;vec3 n=normalize(vec3(scene(p+vec3(e,0,0)).x-scene(p-vec3(e,0,0)).x,scene(p+vec3(0,e,0)).x-scene(p-vec3(0,e,0)).x,scene(p+vec3(0,0,e)).x-scene(p-vec3(0,0,e)).x));vec3 N=normalize(R*n),world=origin+R*p*objScale;vec3 L=normalize(vec3(-.45,1.,.62)),W=normalize(eye-world),H=normalize(W+L);float nl=max(0.,dot(N,L)),nv=max(.001,dot(N,W)),nh=max(0.,dot(N,H)),vh=max(0.,dot(W,H));float rough=kind==1?.75:m.y>1.5&&m.y<3.5?.19:.39;float a=rough*rough,a2=a*a,D=a2/(3.14159*pow(nh*nh*(a2-1.)+1.,2.));float k=(rough+1.)*(rough+1.)/8.;float G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);vec3 F=vec3(.04)+(1.-.04)*pow(1.-vh,5.);vec3 col=colour(p,m.y),spec=D*G*F/max(.003,4.*nl*nv);vec3 c=col*(.34+.92*nl)+spec*1.35*nl;float ca=pow(.5+.5*sin(world.x*3.1+sin(world.z*3.+time*.23)),19.);c+=col*ca*.17*max(N.y,0.);c=waterFog(c,length(world-eye));depth(world);frag=vec4(tone(c),1.);}`;
function program(fs){const p=gl.createProgram();for(const[type,src]of[[gl.VERTEX_SHADER,V],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));const u={};for(const k of ['rect','eye','camera','vp','resolution','focal','time','origin','objScale','yaw','phase','bodyH','bodyW','tailH','dorsal','forkDepth','kind','palette','shape'])u[k]=gl.getUniformLocation(p,k);return{p,u};}
try{
const bg=program(BG),objects=program(FS);gl.bindVertexArray(gl.createVertexArray());
let world=LifeCore.create(24),mode='scene',selected=0,palette=-1,size=1,paused=false,acc=0,last=null,fps=0,frames=0,stamp=0,renderCount=0;
const cameraState={yaw:.17,pitch:.21,distance:12.0,target:[0,-.70,0]},original={};let drag=null,contacts=new Map(),pinch=0;const defaultView=()=>{cameraState.yaw=mode==='scene'?.17:.18;cameraState.pitch=mode==='scene'?.21:.04;cameraState.distance=mode==='scene'?12.0:mode==='single'?2.3:3.5;cameraState.target=mode==='scene'?[0,-.70,0]:[-.18,0,0];};
const norm=a=>{const n=Math.hypot(...a);return a.map(x=>x/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function cam(){const mobile=innerWidth<750,offset=mode==='scene'?0:mobile?0:.18,aspect=canvas.width/canvas.height,d=cameraState.distance*(mobile?(mode==='scene'?1.20:Math.max(1,1/aspect)):1),target=cameraState.target;const eye=[target[0]+d*Math.sin(cameraState.yaw)*Math.cos(cameraState.pitch),target[1]+d*Math.sin(cameraState.pitch),target[2]+d*Math.cos(cameraState.yaw)*Math.cos(cameraState.pitch)],z=norm(eye.map((x,i)=>x-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x),view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);const f=1/Math.tan(.67/2),near=.035,far=80,proj=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),vp=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)vp[c*4+r]+=proj[k*4+r]*view[c*4+k];return{eye,vp,basis:new Float32Array([...x,...y,...z]),x,y,z,focal:canvas.height*f*.5};}
function base(P,C){gl.useProgram(P.p);const u=P.u;gl.uniform3fv(u.eye,C.eye);gl.uniformMatrix3fv(u.camera,false,C.basis);gl.uniformMatrix4fv(u.vp,false,C.vp);gl.uniform2f(u.resolution,canvas.width,canvas.height);gl.uniform1f(u.focal,C.focal);gl.uniform1f(u.time,world.time);}
let picks=[];function drawObj(C,pos,s,yaw,phase,kind,pal,shape,recipe){const rel=pos.map((x,i)=>x-C.eye[i]),dep=-dot(rel,C.z);if(dep<=s*1.12)return;const px=dot(rel,C.x)*C.focal/dep+canvas.width*.5,py=dot(rel,C.y)*C.focal/dep+canvas.height*.5,r=s*1.13*C.focal/(dep-s*1.13);if(px+r<0||px-r>canvas.width||py+r<0||py-r>canvas.height)return;
const u=objects.u;gl.uniform4f(u.rect,(px-r)/canvas.width*2-1,(py-r)/canvas.height*2-1,(px+r)/canvas.width*2-1,(py+r)/canvas.height*2-1);gl.uniform3fv(u.origin,pos);gl.uniform1f(u.objScale,s);gl.uniform1f(u.yaw,yaw);gl.uniform1f(u.phase,phase);gl.uniform1i(u.kind,kind);gl.uniform1i(u.palette,pal);gl.uniform1i(u.shape,shape);gl.uniform1f(u.bodyH,recipe?.depth||.3);gl.uniform1f(u.bodyW,recipe?.width||.1);gl.uniform1f(u.tailH,recipe?.tail||.2);gl.uniform1f(u.dorsal,recipe?.dorsal||.15);gl.uniform1f(u.forkDepth,(recipe?.shape===2||recipe?.id==='blue-yellow')?.11:0.);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return{px,py,r,dep};}
function render(now){const elapsed=last===null?0:(now-last)/1000;last=now;
if(!paused){if(elapsed>2){paused=true;$('pause').textContent='继续';notice('页面中断较久，已暂停；继续时保留生命状态。');}else{acc+=elapsed;while(acc>=1/60){LifeCore.step(world,1/60);acc-=1/60;}}}
const ratio=Math.min(devicePixelRatio,innerWidth<750?1.10:.78);const w=Math.min(1100,Math.round(innerWidth*ratio)),h=Math.round(innerHeight*w/innerWidth);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const C=cam();base(bg,C);gl.uniform4f(bg.u.rect,-1,-1,1,1);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);base(objects,C);picks=[];
if(mode==='scene'){
 for(const c of LifeCore.corals)drawObj(C,[c.x,c.y,c.z],c.r,0,0,1,c.palette,c.type);
 for(const f of world.fish){const p=LifeCore.recipes[f.recipe],pick=drawObj(C,[f.x,f.y,f.z],f.length/1.4,f.yaw,f.phase,0,palette<0?p.palette:palette,p.shape,p);if(pick)picks.push({...pick,recipe:f.recipe});}
}else if(mode==='single'){const p=LifeCore.recipes[selected];drawObj(C,[0,0,0],.70*size,.09,world.time*6.,0,palette<0?p.palette:palette,p.shape,p);}
else{const k=selected%3;drawObj(C,[0,0,0],1.02*size,world.time*.015,0,1,palette<0?k:Math.max(0,palette)%4,k);}
renderCount++;frames++;if(now-stamp>800){fps=frames*1000/(now-stamp);stamp=now;frames=0;$('fps').textContent=fps.toFixed(0);$('events').textContent=world.metrics.flees+' / '+world.metrics.returns;$('fishCount').textContent=mode==='scene'?world.fish.length:'1';}
requestAnimationFrame(render);}
let timer;function notice(s){$('notice').textContent=s;$('notice').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('notice').classList.remove('show'),4500)}
function info(){const p=LifeCore.recipes[selected];$('infoKicker').textContent=mode==='scene'?'SHARED CORE / LIVING STUDIES':mode==='single'?'RECIPE '+String(selected+1).padStart(2,'0')+' / 08':'CORAL FORM / STUDY';$('infoTitle').textContent=mode==='scene'?'先看得见，再逐项做准。':mode==='single'?p.name:['脑纹群体','层片桌状','鹿角分枝'][selected%3];$('infoBody').innerHTML=mode==='scene'?'8份实验配方，按局部邻居活动。<br>点击鱼近看，或使用“靠近”观察避让。':mode==='single'?'连续形体 · 独立色区 · 细纹与反光<br>眼睛、口腔和鱼鳍可见；解剖动态尚未验收。':'独立数学形态，无外部网格或贴图。<br>形态与材质候选，不是已鉴定珊瑚物种。';}
function setMode(m){if(!['scene','single','coral'].includes(m))throw Error('Unknown view');mode=m;$('legacy').style.display='none';['scene','single','coral'].forEach(k=>$(k+'Btn').classList.toggle('active',m===k));defaultView();info();}
const colors=['#eed459','#e1e6b1','#82c1d9','#ed804a','#7bc6a0','#5388db','#e7bb51','#a585d5'];
LifeCore.recipes.forEach((p,i)=>{const b=document.createElement('button');b.textContent=p.name;const dot=document.createElement('span');dot.className='dot';dot.style.background=colors[i];b.prepend(dot);b.dataset.recipe=i;b.onclick=()=>{selected=i;setMode('single');document.querySelectorAll('[data-recipe]').forEach(x=>x.classList.toggle('active',+x.dataset.recipe===i));if(innerWidth<750)$('panel').classList.remove('open');};$('recipes').append(b)});
$('sceneBtn').onclick=()=>setMode('scene');$('singleBtn').onclick=()=>setMode('single');$('coralBtn').onclick=()=>{selected=(mode==='coral'?selected+1:0)%3;setMode('coral')};$('home').onclick=defaultView;$('toggle').onclick=()=>$('panel').classList.toggle('open');$('palette').onchange=e=>palette=+e.target.value;$('size').oninput=e=>{size=+e.target.value;if(mode==='scene'){setMode('single');notice('尺寸实验在单鱼视图中展示；不改写群体碰撞尺寸。');}};
$('pause').onclick=()=>{paused=!paused;last=null;$('pause').textContent=paused?'继续':'暂停';};
$('approach').onclick=()=>{setMode('scene');const f=world.fish.find(f=>f.recipe===selected)||world.fish[0];LifeCore.disturb(world,[f.x+.55,f.y,f.z+.15]);notice('观察者已靠近选中鱼的附近，留意局部避让。');if(innerWidth<750)$('panel').classList.remove('open');};$('leave').onclick=()=>{LifeCore.disturb(world,null);notice('观察者已离开。警戒结束后逐步游回原活动区域。');};
$('count').onchange=e=>{world=LifeCore.create(+e.target.value);acc=0;notice('已重置为 '+world.fish.length+' 个实验个体。');};
$('legacyBtn').onclick=()=>{paused=true;$('pause').textContent='继续';let f=$('legacy').querySelector('iframe');if(!f){f=document.createElement('iframe');f.title='原 Ocean Life R02 生态与 Bird 回归工作台';f.src='../../r02/index.html';$('legacy').append(f);}$('legacy').style.display='block';};$('closeLegacy').onclick=()=>$('legacy').style.display='none';
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);contacts.set(e.pointerId,[e.clientX,e.clientY]);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};if(contacts.size===2){const p=[...contacts.values()];pinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);}});
canvas.addEventListener('pointermove',e=>{if(!contacts.has(e.pointerId))return;contacts.set(e.pointerId,[e.clientX,e.clientY]);if(contacts.size===2){const p=[...contacts.values()],d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(pinch>0)cameraState.distance=Math.max(1.15,Math.min(25,cameraState.distance*pinch/d));pinch=d;}else if(drag){cameraState.yaw-=(e.clientX-drag.x)*.006;cameraState.pitch=Math.max(-.15,Math.min(1.10,cameraState.pitch+(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;}});
function pointerUp(e){if(drag&&contacts.size===1&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5&&mode==='scene'){const x=e.clientX*canvas.width/innerWidth,y=(innerHeight-e.clientY)*canvas.height/innerHeight;const p=picks.filter(p=>Math.hypot(x-p.px,y-p.py)<p.r*.70).sort((a,b)=>a.dep-b.dep)[0];if(p){selected=p.recipe;setMode('single');}}contacts.delete(e.pointerId);drag=null;pinch=0;}
canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',e=>{e.preventDefault();cameraState.distance=Math.max(1.15,Math.min(25,cameraState.distance*Math.exp(e.deltaY*.001)));},{passive:false});
window.OceanLifeN02={version:'OLM-N02-20260919',setMode,select:i=>{if(!Number.isInteger(i)||i<0||i>=8)throw Error('Invalid recipe');selected=i;setMode('single')},setCoral:i=>{selected=i;setMode('coral')},state:()=>({version:'OLM-N02-20260919',mode,selected,palette,time:world.time,metrics:{...world.metrics},count:world.fish.length,paused,fps,frames:renderCount,webglError:gl.getError(),sourceAssetsLoaded:0,fieldCalibration:false}),world:()=>LifeCore.snapshot(world),freeze:()=>{paused=true;last=null;},advance:seconds=>{if(!Number.isFinite(seconds)||seconds<0||seconds>120)throw Error('QA seconds outside range');paused=true;for(let i=0;i<Math.ceil(seconds*60);i++)LifeCore.step(world,1/60);return LifeCore.snapshot(world)},approach:()=>{const f=world.fish[0];LifeCore.disturb(world,[f.x+.55,f.y,f.z+.15])},leave:()=>LifeCore.disturb(world,null)};
info();$('boot').remove();requestAnimationFrame(render);
}catch(e){$('bootText').textContent='启动失败：'+e.message;console.error(e);}
})();
