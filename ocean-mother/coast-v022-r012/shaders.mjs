export const COMMON=`
precision highp float;
const float PI=3.141592653589793;
uniform float uTime;
uniform float uSeaLevel;
uniform float uSwell;
uniform float uPeriod;
uniform float uWind;
float sat(float x){return clamp(x,0.0,1.0);}
float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=.5;mat2 r=mat2(.80,.60,-.60,.80);for(int i=0;i<5;i++){v+=a*noise2(p);p=r*p*2.03+17.1;a*=.5;}return v;}
float shoreline(vec2 p){return-8.8+2.65*sin(p.x*.038+.32)+1.08*sin(p.x*.115+1.3)+.42*sin(p.x*.31-.8);}
float bedH(vec2 p){float s=p.y-shoreline(p);float n=.035*sin(p.x*.27+p.y*.16)+.022*sin(p.x*.69-p.y*.24)+.026*(fbm(p*.12+9.0)-.48);if(s>=0.0){float bar=.18*exp(-pow((s-12.0)/5.6,2.0))*(.62+.38*sin(p.x*.10+s*.25));float trough=-.10*exp(-pow((s-5.2)/2.6,2.0));return-.055-.045*s-.00046*s*s+bar+trough+n;}float inland=-s;float dune=.18*sin(p.x*.075-inland*.12)*smoothstep(5.0,24.0,inland)+.10*(fbm(vec2(p.x*.055,inland*.08)+21.0)-.48)*smoothstep(4.0,30.0,inland);return.02+inland*.066+.00115*inland*inland+dune+n;}
float waveSurface(vec2 p,out float breaker){float d0=uSeaLevel-bedH(p),wet=smoothstep(.012,.62,d0),shallow=1.0-smoothstep(.75,4.7,d0),ps=uPeriod/8.0,eta=uSeaLevel,primary=0.0,slope=0.0;vec4 w0=vec4(.06,-.998,20.5,.54),w1=vec4(-.24,-.971,11.2,.24),w2=vec4(.38,-.925,6.4,.12),w3=vec4(-.70,-.714,3.35,.054),w4=vec4(.88,-.475,1.65,.018);for(int i=0;i<5;i++){vec4 w=i==0?w0:(i==1?w1:(i==2?w2:(i==3?w3:w4)));float k=2.0*PI/(w.z*ps),omega=sqrt(9.81*k*tanh(k*max(d0,.12))),phase=k*dot(w.xy,p)-omega*uTime+(i==0?.1:(i==1?1.8:(i==2?3.25:(i==3?.72:2.3)))),shoal=.72+.67*shallow,amp=uSwell*w.w*shoal*wet,s=sin(phase),c=cos(phase),shape=i==0?s+shallow*(.21*sin(2.0*phase+.18)+.072*sin(3.0*phase+.42)):s,dshape=i==0?c+shallow*(.42*cos(2.0*phase+.18)+.216*cos(3.0*phase+.42)):c;eta+=amp*shape;slope+=abs(amp*k*dshape);if(i==0)primary=s;}float depth=eta-bedH(p);breaker=sat(smoothstep(.34,.94,primary)*(1.0-smoothstep(.68,2.9,d0))*smoothstep(.055,.62,depth)*smoothstep(.18,.57,slope));return eta;}
vec3 skyRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){float h=sat(rd.y*.5+.5),sun=max(dot(rd,sunDir),0.0);if(mode==1){vec3 n=mix(vec3(.49,.53,.54),vec3(.82,.84,.82),pow(h,.58));return n*exposure;}if(mode==2){vec3 s=mix(vec3(.23,.30,.32),vec3(.71,.76,.75),pow(h,.62));s+=vec3(1.0,.83,.58)*pow(sun,280.0)*2.0;return s*exposure;}vec3 horizon=vec3(.69,.78,.79),zenith=vec3(.12,.39,.56);vec3 c=mix(horizon,zenith,pow(sat(rd.y),.46));float cloud=fbm(rd.xz/max(.16,rd.y+.34)*.42+vec2(uTime*.002,-uTime*.001));float cloudBand=smoothstep(.58,.82,cloud)*(1.0-smoothstep(.80,.98,sat(rd.y)));c=mix(c,vec3(.92,.93,.89),cloudBand*.38);c+=vec3(1.0,.86,.63)*pow(sun,900.0)*8.5;c+=vec3(1.0,.72,.44)*pow(sun,18.0)*.13;float haze=pow(1.0-abs(rd.y),5.0);c=mix(c,vec3(.73,.78,.76),haze*.26);return c*exposure;}
`;

export const SKY_VS=`#version 300 es
precision highp float;
out vec2 vUv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;

export const SKY_FS=`#version 300 es
${COMMON}
in vec2 vUv;
out vec4 outColor;
uniform vec3 uCamForward,uCamRight,uCamUp,uSunDir;
uniform float uAspect,uTanFov,uExposure;
uniform int uMode;
void main(){vec2 q=vUv*2.0-1.0;vec3 rd=normalize(uCamForward+q.x*uAspect*uTanFov*uCamRight+q.y*uTanFov*uCamUp);vec3 c=skyRadiance(rd,uSunDir,uMode,uExposure);outColor=vec4(c,1.0);}`;

export const SOLID_VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;
layout(location=1)in vec3 aNormal;
layout(location=2)in float aKind;
uniform mat4 uView,uProj;
out vec3 vWorld,vNormal;
out float vKind;
void main(){vWorld=aPosition;vNormal=aNormal;vKind=aKind;gl_Position=uProj*uView*vec4(aPosition,1.0);}`;

export const SOLID_FS=`#version 300 es
${COMMON}
in vec3 vWorld,vNormal;
in float vKind;
out vec4 outColor;
uniform vec3 uCamera,uSunDir,uFirePos;
uniform float uFireIntensity,uExposure;
uniform sampler2D uWet;
uniform vec4 uDomain;
uniform int uMode;
vec2 fieldUv(vec2 p){return(p-uDomain.xy)/uDomain.zw;}
void main(){vec3 N=normalize(vNormal),V=normalize(uCamera-vWorld);float wetState=texture(uWet,fieldUv(vWorld.xz)).r,waterWet=1.0-smoothstep(-.28,.18,vWorld.y-uSeaLevel),wet=sat(max(wetState*.92,waterWet));float n1=fbm(vWorld.xz*(vKind<.5?.18:.34)+vWorld.y*.23),n2=noise2(vWorld.xz*(vKind<.5?2.9:1.55)+17.0);vec3 base;float rough;if(vKind<.5){base=mix(vec3(.39,.31,.21),vec3(.78,.67,.48),sat(n1*.78+n2*.20));float shell=smoothstep(.84,.96,noise2(vWorld.xz*5.4));base=mix(base,vec3(.86,.78,.62),shell*.16);base*=mix(1.0,.57,wet);rough=mix(.84,.44,wet);}else if(vKind<1.5){base=mix(vec3(.105,.112,.108),vec3(.39,.37,.32),sat(n1*.80+n2*.16));float strata=smoothstep(.68,.82,fbm(vec2(vWorld.x*.45+vWorld.y*.7,vWorld.z*.48)));base=mix(base,base*1.22,strata*.24);base*=mix(1.0,.48,wet);rough=mix(.72,.29,wet);}else{float grain=.5+.5*sin(vWorld.x*2.6+vWorld.z*3.1+n1*5.0);base=mix(vec3(.075,.029,.011),vec3(.31,.12,.035),grain*.45+n1*.35);base*=mix(1.0,.60,wet*.35);rough=.58;}float ndl=max(dot(N,uSunDir),0.0),hemi=.22+.30*sat(N.y*.5+.5);vec3 H=normalize(V+uSunDir);float spec=pow(max(dot(N,H),0.0),mix(18.0,135.0,1.0-rough))*mix(.018,.20,1.0-rough);float fireDist=length(vWorld.xz-uFirePos.xz),fireFall=exp(-fireDist*.26)*sat(1.0-abs(vWorld.y-uFirePos.y)*.20)*uFireIntensity;vec3 lit=base*(hemi+.96*ndl)+skyRadiance(N,uSunDir,uMode,uExposure)*base*.12+vec3(1.0,.88,.69)*spec*2.0+base*vec3(1.55,.33,.055)*fireFall*1.7;if(uMode==1)lit=base*(.43+.72*ndl)+vec3(spec*.25);else if(uMode==2){vec3 key=normalize(vec3(-.42,.76,-.50));float k=max(dot(N,key),0.0),rim=pow(1.0-max(dot(N,V),0.0),3.0);lit=base*(.24+.98*k)+vec3(.44,.58,.60)*rim*.24+base*vec3(1.35,.28,.04)*fireFall;}else if(uMode==3){lit=vKind<.5?mix(vec3(.47,.30,.15),vec3(.07,.52,.58),wet):vKind<1.5?vec3(.38,.42,.44):vec3(.58,.20,.045);}float fog=1.0-exp(-length(uCamera-vWorld)*.0085);lit=mix(lit,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),fog*.22);outColor=vec4(lit*uExposure,1.0);}`;

export const WATER_VS=`#version 300 es
${COMMON}
layout(location=0)in vec2 aXZ;
uniform mat4 uView,uProj;
out vec3 vWorld,vNormal;
out float vBreaker,vThickness;
void main(){vec2 p=aXZ;float d0=uSeaLevel-bedH(p),shallow=1.0-smoothstep(.85,3.8,d0),k=2.0*PI/(20.5*(uPeriod/8.0)),omega=sqrt(9.81*k*tanh(k*max(d0,.12))),phase=k*dot(vec2(.06,-.998),p)-omega*uTime+.1,q=(.12+.20*shallow)*uSwell*smoothstep(.035,.62,d0);p+=vec2(.06,-.998)*q*cos(phase);float br=0.0,y=waveSurface(p,br),e=.17,bx=0.0,bz=0.0,yx=waveSurface(p+vec2(e,0.0),bx),yz=waveSurface(p+vec2(0.0,e),bz);vec3 tx=vec3(e,yx-y,0.0),tz=vec3(0.0,yz-y,e);vNormal=normalize(cross(tz,tx));vWorld=vec3(p.x,y,p.y);vBreaker=br;vThickness=max(0.0,y-bedH(p));gl_Position=uProj*uView*vec4(vWorld,1.0);}`;

export const WATER_FS=`#version 300 es
${COMMON}
in vec3 vWorld,vNormal;
in float vBreaker,vThickness;
out vec4 outColor;
uniform vec3 uCamera,uSunDir;
uniform vec2 uResolution;
uniform sampler2D uScene,uFoam;
uniform vec4 uDomain;
uniform float uClarity,uFoamGain,uRefraction,uExposure;
uniform int uMode;
vec2 fieldUv(vec2 p){return(p-uDomain.xy)/uDomain.zw;}
vec3 fresnelSchlick(float c,vec3 f0){return f0+(1.0-f0)*pow(1.0-c,5.0);}
float Dggx(float ndh,float a){float a2=a*a,d=ndh*ndh*(a2-1.0)+1.0;return a2/(PI*d*d+.0001);}
float G1(float nd,float k){return nd/(nd*(1.0-k)+k);}
void main(){if(vThickness<.0035)discard;vec3 N=normalize(vNormal),V=normalize(uCamera-vWorld);float ndv=max(dot(N,V),.001);vec3 refractedDir=refract(-V,N,1.0/1.333);float opticalPath=vThickness/max(.22,abs(refractedDir.y));vec2 uv=gl_FragCoord.xy/uResolution,bend=N.xz*(.0022+.0105*sat(vThickness/2.4))*uRefraction,refrUv=clamp(uv+bend,vec2(.001),vec2(.999));vec3 behind=texture(uScene,refrUv).rgb,sigma=vec3(.58,.19,.105)/max(.42,uClarity),trans=exp(-sigma*opticalPath),scatter=vec3(.032,.185,.235)*(1.0-trans);vec3 R=reflect(-V,N),reflected=skyRadiance(R,uSunDir,uMode,uExposure),F=fresnelSchlick(ndv,vec3(.0204));float foamState=texture(uFoam,fieldUv(vWorld.xz)).r;vec2 fp=vWorld.xz*.20+vec2(uTime*.014,-uTime*.041);float low=fbm(fp),cell=1.0-abs(2.0*noise2(fp*3.3+9.0)-1.0),lace=smoothstep(.51,.77,low+.21*cell),fleck=smoothstep(.63,.86,fbm(fp*6.2-5.0));float foam=sat((foamState*(.36+.82*lace)+vBreaker*(.22+.41*fleck))*uFoamGain);float rough=mix(.065,.51,foam),a=max(.024,rough*rough);vec3 H=normalize(V+uSunDir);float ndl=max(dot(N,uSunDir),0.0),ndh=max(dot(N,H),0.0),vdh=max(dot(V,H),0.0),gk=a*.5;vec3 Fs=fresnelSchlick(vdh,vec3(.0204));vec3 spec=Fs*(Dggx(ndh,a)*G1(ndv,gk)*G1(ndl,gk)/max(.02,4.0*ndv*ndl))*ndl*vec3(1.0,.91,.77)*2.65;vec3 water=behind*trans+scatter+reflected*F+spec;vec3 foamColor=mix(vec3(.73,.80,.79),vec3(.98,.98,.93),smoothstep(.15,.9,ndl));foamColor*=.79+.21*skyRadiance(N,uSunDir,uMode,uExposure);water=mix(water,foamColor,foam*.90);float alphaBase=1.0-max(trans.r,max(trans.g,trans.b)),alpha=sat(alphaBase*.93+dot(F,vec3(.333))*.50+foam*.78);alpha=max(alpha,.010+dot(F,vec3(.333))*.31);alpha*=smoothstep(.0035,.055,vThickness);if(uMode==1){water=mix(vec3(.49,.59,.60),vec3(.90,.92,.87),foam);alpha=sat(.13+alpha*.78);}else if(uMode==2){water=mix(water,vec3(.59,.72,.73),.07);alpha=sat(alpha*.94+.025);}else if(uMode==3){water=mix(vec3(.33,.77,.75),vec3(.035,.19,.38),sat(vThickness/3.8));water=mix(water,vec3(.98,.91,.62),foam);alpha=.90;}float fog=1.0-exp(-length(uCamera-vWorld)*.0075);water=mix(water,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),fog*.16);outColor=vec4(water*alpha*uExposure,alpha);}`;

export const MEDIA_VS=`#version 300 es
precision highp float;
layout(location=0)in vec4 aPositionLife;
layout(location=1)in vec2 aSizeType;
uniform mat4 uView,uProj;
uniform vec2 uResolution;
out float vLife,vType,vDepth;
void main(){vec4 view=uView*vec4(aPositionLife.xyz,1.0);gl_Position=uProj*view;float size=aSizeType.x*uResolution.y/max(5.0,-view.z);gl_PointSize=clamp(size,1.0,aSizeType.y<.5?130.0:46.0);vLife=aPositionLife.w;vType=aSizeType.y;vDepth=-view.z;}`;

export const MEDIA_FS=`#version 300 es
precision highp float;
in float vLife,vType,vDepth;
out vec4 outColor;
uniform float uExposure;
void main(){vec2 q=gl_PointCoord*2.0-1.0;float r=dot(q,q);if(r>1.0)discard;float soft=1.0-smoothstep(.18,1.0,r);if(vType<.5){float billow=soft*soft*(.45+.55*(1.0-r));float alpha=billow*smoothstep(0.0,.18,vLife)*smoothstep(1.0,.54,vLife)*.34;vec3 c=mix(vec3(.18,.20,.20),vec3(.47,.49,.47),1.0-r);outColor=vec4(c*alpha*uExposure,alpha);}else if(vType<1.5){float core=exp(-r*5.0),edge=soft;float alpha=edge*smoothstep(0.0,.14,vLife)*smoothstep(1.0,.36,vLife)*.82;vec3 c=mix(vec3(2.9,.23,.012),vec3(3.8,1.35,.13),core);outColor=vec4(c*alpha*uExposure,alpha);}else{float alpha=soft*smoothstep(0.0,.12,vLife)*smoothstep(1.0,.45,vLife)*.47;vec3 c=mix(vec3(.69,.79,.80),vec3(1.0,.99,.94),1.0-r);outColor=vec4(c*alpha*uExposure,alpha);}}`;
