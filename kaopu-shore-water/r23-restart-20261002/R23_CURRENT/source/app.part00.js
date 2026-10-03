'use strict';
(()=>{
const D=window.SHORE_OBSERVATIONS,root=document.getElementById('replica'),status=document.getElementById('state'),cv=document.getElementById('scene');
const $=id=>document.getElementById(id);
const report=window.QA={build:'R23_RESTART',ready:false,frames:0,errors:[],oldCodeDependencies:[],teacherTextureOn3D:false};
function fail(e){report.errors.push(String(e));status.textContent='运行失败';$('error').hidden=false;$('error').textContent=String(e);}
window.addEventListener('error',e=>fail(e.message));window.addEventListener('unhandledrejection',e=>fail(e.reason));
const gl=cv.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true});if(!gl){fail('未取得 WebGL2 context；没有把失败显示成完成。');return;}
report.renderer=gl.getParameter(gl.RENDERER);const debugExt=gl.getExtension('WEBGL_debug_renderer_info');report.unmaskedRenderer=debugExt?gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL):'unavailable';report.version=gl.getParameter(gl.VERSION);
const V=`#version 300 es
precision highp float;
in vec3 aPosition,aNormal;in vec4 aData;
uniform mat4 uVP;out vec3 vP,vN;out vec4 vD;
void main(){vP=aPosition;vN=aNormal;vD=aData;gl_Position=uVP*vec4(aPosition,1.);}`;
const F=`#version 300 es
precision highp float;
in vec3 vP,vN;in vec4 vD;out vec4 outColor;
uniform vec3 uEye;uniform float uTime,uMode,uFoam,uWet;uniform int uKind;uniform sampler2D uCoverage;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){return .55*noise(p)+.27*noise(p*2.03+13.2)+.125*noise(p*4.17-7.1)+.055*noise(p*8.23);}
float cellular(vec2 p){vec2 ip=floor(p),f=fract(p);float a=8.,b=8.;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(i,j),o=vec2(hash(ip+g),hash(ip+g+31.7));float d=length(g+o-f);if(d<a){b=a;a=d;}else b=min(b,d);}return b-a;}
vec3 sandColor(vec2 p,float wet){float n=fbm(p*3.1);float drain=sin(p.y*29.+2.3*noise(p*.85)+.7*sin(p.x*2.8));float detail=1.-smoothstep(.04,.28,length(fwidth(p)));float grain=noise(p*145.)-.5;vec3 dry=vec3(.84,.814,.766);vec3 damp=vec3(.60,.626,.612);return mix(dry,damp,wet)*(.96+.08*n+.028*drain*detail)+grain*.055*detail;}
void main(){
vec3 N=normalize(vN),V=normalize(uEye-vP),L=normalize(vec3(-.45,.9,-.26));float diff=.62+.38*max(dot(N,L),0.);vec3 c=vec3(.5);float alpha=1.;
if(uKind==0){float sd=vD.x,gm=vD.y;float wet=(1.-smoothstep(-.02,1.5,sd))*uWet;
 c=sandColor(vP.xz,wet);vec3 g=mix(vec3(.26,.286,.088),vec3(.50,.49,.16),fbm(vP.xz*.8));g=mix(g,vec3(.63,.584,.28),smoothstep(.56,.80,noise(vP.xz*6.3))*.45);c=mix(c,g,gm);
 float contact=0.;for(int i=0;i<1;i++){contact=vD.z;}c*=mix(1.,.76,contact);c*=diff;
 if(uMode>.5&&uMode<1.5)c=mix(vec3(.92,.85,.65),vec3(.42,.53,.19),step(.5,gm));
 if(uMode>1.5)c=mix(vec3(.26,.39,.53),vec3(.94,.80,.42),clamp((vP.y+3.)/6.,0.,1.));
}
else if(uKind==1){
 float dep=max(vD.x,0.);if(dep<.003)discard;
 vec2 p=vP.xz;float small=noise(p*7.4+uTime*vec2(.09,-.14));
 vec2 dd=vec2(dFdx(small),dFdy(small));float a=noise(p*1.12+vec2(-uTime*.12,0.));float b=noise(p*3.7+vec2(uTime*.19,0.));
 N=normalize(vec3((a-.5)*.14+(small-.5)*.08,1.,(b-.5)*.15));
 float fres=.018+.982*pow(1.-max(dot(N,V),0.),5.);
 vec3 sand=sandColor(p,1.);float trans=exp(-.55*dep);vec3 deep=vec3(.23,.45,.52);vec3 water=mix(deep,sand,trans*.56);
 float ripple=sin(p.x*3.7+p.y*.31-uTime)*.45+sin(p.x*8.6-p.y*1.1-uTime*1.2)*.25+noise(p*15.)*.30;
 water+=ripple*.019;vec3 sky=vec3(.58,.66,.69);c=mix(water,sky,min(.54,fres));
 vec4 cov=texture(uCoverage,vec2((p.x+16.)/32.,(p.y+26.2003716)/52.4007432));
 vec2 flow=p+vec2(uTime*.10,0.);vec2 warp=vec2(fbm(p*1.7),fbm(p*1.7+28.3))-.5;
 float edge=cellular(flow*4.2+warp*1.8),aa=max(fwidth(edge),.016);float lace=1.-smoothstep(.026-aa,.049+aa,edge);
 float tiny=1.-smoothstep(.016,.055,cellular(flow*12.5+warp));float foam=clamp(cov.r*(.09+.81*lace+.26*tiny)*uFoam,0.,1.);
 c=mix(c,vec3(.93,.955,.944),foam*.93);if(uMode>.5&&uMode<1.5)c=vec3(.24,.58,.67);if(uMode>1.5)c=mix(vec3(.30,.68,.70),vec3(.04,.16,.29),clamp(dep/3.,0.,1.));
}
else if(uKind==2){
 vec3 p=vP;float nf=fbm(p.xz*1.8+p.y*.4);float strata=sin(p.y*16.+p.x*4.6+p.z*.32+noise(p.xz*2.8)*2.4);float cr=noise(vec2(p.x*10.+p.y*5.,p.z*4.));
 c=mix(vec3(.35,.18,.085),vec3(.78,.52,.27),nf);c*=.91+.16*strata;
 c=mix(c,vec3(.11,.073,.043),smoothstep(.73,.91,cr)*.48);c*=diff;float low=1.-smoothstep(.02,.23,p.y);c*=1.-.24*low;
 if(uMode>.5&&uMode<1.5)c=vec3(.71,.40,.18);if(uMode>1.5)c=vec3(.72,.46,.30);
}
else if(uKind==3){float t=vD.x,rand=vD.y;c=mix(vec3(.28,.31,.083),vec3(.64,.61,.27),rand)*mix(.6,1.1,t);c*=.75+.25*abs(dot(N,L));if(uMode>.5)c=vec3(.40,.58,.15);}
else if(uKind==4){c=vec3(.98,.40,.075)*(.38+.62*max(dot(N,L),0.));c+=pow(max(dot(reflect(-L,N),V),0.),35.)*.19;}
else if(uKind==5){float st=.65*fbm(vec2(vP.x*.8+vP.z*.57,vP.y*4.3))+.25*noise(vec2(vP.x*5.7+vP.z*5.,vP.y*9.2));c=mix(vec3(.025,.018,.013),vec3(.19,.13,.075),st)*(.22+.43*max(dot(N,L),0.));}
else if(uKind==6){float d=max(vD.x,0.);float tr=exp(-d*.55);c=mix(vec3(.05,.20,.23),vec3(.30,.57,.64),tr);}
else {c=vec3(.05,.054,.066);}
outColor=vec4(c,alpha);
}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,V));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,F));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}catch(e){fail(e);return;}
const locations={};for(const s of ['uVP','uEye','uKind','uTime','uMode','uFoam','uWet','uCoverage'])locations[s]=gl.getUniformLocation(program,s);
const A={p:gl.getAttribLocation(program,'aPosition'),n:gl.getAttribLocation(program,'aNormal'),d:gl.getAttribLocation(program,'aData')};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const ss=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((t,v,i)=>t+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/(Math.hypot(...a)||1));
function rnd(x,z=0){let f=Math.sin(x*127.1+z*311.7)*43758.5453;return f-Math.floor(f);}
