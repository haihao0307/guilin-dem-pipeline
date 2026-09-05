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
float bedH(vec2 p){float s=p.y-shoreline(p),n=.025*sin(p.x*.27+p.y*.16)+.015*sin(p.x*.69-p.y*.24);if(s>=0.0)return-.035-.053*s-.00043*s*s+.14*exp(-pow((s-12.0)/5.6,2.0))-.06*exp(-pow((s-5.2)/2.6,2.0))+n;float d=-s;return.025+d*.066+.00065*d*d+.10*sin(p.x*.075-d*.12)*smoothstep(5.0,24.0,d)+n;}

float waveSurface(vec2 p,out float breaker){float d0=uSeaLevel-bedH(p),wet=smoothstep(-.12,.70,d0),shallow=1.0-smoothstep(.75,4.7,d0),ps=uPeriod/8.0,eta=uSeaLevel,primary=0.0,slope=0.0;vec4 w0=vec4(.06,-.998,20.5,.54),w1=vec4(-.24,-.971,11.2,.24),w2=vec4(.38,-.925,6.4,.12),w3=vec4(-.70,-.714,3.35,.054),w4=vec4(.88,-.475,1.65,.018);for(int i=0;i<5;i++){vec4 w=i==0?w0:(i==1?w1:(i==2?w2:(i==3?w3:w4)));float k=2.0*PI/(w.z*ps),omega=sqrt(9.81*k*tanh(k*3.5)),phase=k*dot(w.xy,p)-omega*uTime+(i==0?.1:(i==1?1.8:(i==2?3.25:(i==3?.72:2.3)))),shoal=.8+.28*shallow,amp=min(uSwell*w.w*shoal,max(.022,d0*.34))*wet,s=sin(phase),c=cos(phase),shape=i==0?s+.12*shallow*sin(2.0*phase):s,dshape=i==0?c+.24*shallow*cos(2.0*phase):c;eta+=amp*shape;slope+=abs(amp*k*dshape);if(i==0)primary=s;}float depth=eta-bedH(p);breaker=sat(smoothstep(.48,.94,primary)*(1.0-smoothstep(.65,2.5,d0))*smoothstep(.025,.32,depth)*smoothstep(.025,.16,slope));return eta;}
vec3 skyRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){float h=sat(rd.y*.5+.5),sun=max(dot(rd,sunDir),0.0);if(mode==1){vec3 n=mix(vec3(.49,.53,.54),vec3(.82,.84,.82),pow(h,.58));return n*exposure;}if(mode==2){vec3 s=mix(vec3(.23,.30,.32),vec3(.71,.76,.75),pow(h,.62));s+=vec3(1.0,.83,.58)*pow(sun,280.0)*2.0;return s*exposure;}vec3 horizon=vec3(.48,.66,.78),zenith=vec3(.045,.23,.49);vec3 c=mix(horizon,zenith,pow(sat(rd.y),.46));float cloud=fbm(rd.xz/max(.16,rd.y+.34)*.42+vec2(uTime*.002,-uTime*.001));float cloudBand=smoothstep(.58,.82,cloud)*(1.0-smoothstep(.80,.98,sat(rd.y)));c=mix(c,vec3(.92,.93,.89),cloudBand*.38);c+=vec3(1.0,.86,.63)*pow(sun,480.0)*1.8;c+=vec3(1.0,.72,.44)*pow(sun,18.0)*.13;float haze=pow(sat(1.0-abs(rd.y)),5.0);c=mix(c,vec3(.59,.71,.79),haze*.10);return c*exposure;}
vec3 farSeaRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){
 vec3 refl=skyRadiance(vec3(rd.x,abs(rd.y),rd.z),sunDir,mode,exposure);
 float f=.0204+.9796*pow(1.0-clamp(abs(rd.y),0.0,1.0),5.0);
 return mix(vec3(.024,.105,.145)*exposure,refl,f);
}
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
void main(){vec2 q=vUv*2.0-1.0;vec3 rd=normalize(uCamForward+q.x*uAspect*uTanFov*uCamRight+q.y*uTanFov*uCamUp);vec3 c=skyRadiance(rd,uSunDir,uMode,uExposure);if(rd.y<0.0)c=farSeaRadiance(rd,uSunDir,uMode,uExposure);outColor=vec4(c,1.0);}`;

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
uniform sampler2D uWet,uRockHeight;
uniform vec4 uDomain;
uniform int uMode;
vec2 fieldUv(vec2 p){return(p-uDomain.xy)/uDomain.zw;}
void main(){vec3 N=normalize(vNormal),V=normalize(uCamera-vWorld);float wetState=texture(uWet,fieldUv(vWorld.xz)).r,waterWet=1.0-smoothstep(-.28,.18,vWorld.y-uSeaLevel),wet=sat(max(wetState*.92,waterWet));float n1=fbm(vWorld.xz*(vKind<.5?.18:.34)+vWorld.y*.23),n2=noise2(vWorld.xz*(vKind<.5?2.9:1.55)+17.0);vec3 base;float rough;if(vKind<.5){base=mix(vec3(.39,.31,.21),vec3(.78,.67,.48),sat(n1*.78+n2*.20));float shell=smoothstep(.84,.96,noise2(vWorld.xz*5.4));base=mix(base,vec3(.86,.78,.62),shell*.16);base*=mix(1.0,.72,wet);rough=mix(.84,.44,wet);}else if(vKind<1.5){base=mix(vec3(.10,.115,.119),vec3(.40,.385,.34),sat(n1*.80+n2*.16));float strata=smoothstep(.68,.82,fbm(vec2(vWorld.x*.45+vWorld.y*.7,vWorld.z*.48)));base=mix(base,base*1.22,strata*.24);float mineral=noise2(vWorld.xz*14.0+vWorld.y*vec2(9.0,7.0));base*=.77+.46*mineral;
 float relief=.004*fbm(vWorld.xz*6.0+vWorld.y*vec2(3.1,4.7));
 vec3 px=dFdx(vWorld),py=dFdy(vWorld),rx=cross(py,N),ry=cross(N,px);float det=dot(px,rx);
 if(abs(det)>1e-8)N=normalize(abs(det)*N-sign(det)*(dFdx(relief)*rx+dFdy(relief)*ry));
 base*=mix(1.0,.66,wet);rough=mix(.72,.29,wet);}else{float grain=.5+.5*sin(vWorld.x*2.6+vWorld.z*3.1+n1*5.0);base=mix(vec3(.075,.029,.011),vec3(.31,.12,.035),grain*.45+n1*.35);base*=mix(1.0,.60,wet*.35);rough=.58;}float ndl=max(dot(N,uSunDir),0.0),hemi=.20+.25*sat(N.y*.5+.5);vec3 H=normalize(V+uSunDir);float spec=pow(max(dot(N,H),0.0),mix(18.0,135.0,1.0-rough))*mix(.018,.20,1.0-rough);float fireDist=length(vWorld.xz-uFirePos.xz),fireFall=exp(-fireDist*.26)*sat(1.0-abs(vWorld.y-uFirePos.y)*.20)*uFireIntensity;float visibility=1.0;
 for(int j=1;j<=10;j++){float distanceAlong=float(j)*.6;vec3 probe=vWorld+uSunDir*distanceAlong;
 float height=texture(uRockHeight,fieldUv(probe.xz)).r;
 visibility=min(visibility,smoothstep(-.08,.24,probe.y-height+.14));}
 vec3 lit=base*(hemi+1.08*ndl*mix(.12,1.0,visibility))+skyRadiance(N,uSunDir,uMode,uExposure)*base*.12+vec3(1.0,.88,.69)*spec*2.0+base*vec3(1.55,.33,.055)*fireFall*1.7;if(uMode==1)lit=base*(.43+.72*ndl)+vec3(spec*.25);else if(uMode==2){vec3 key=normalize(vec3(-.42,.76,-.50));float k=max(dot(N,key),0.0),rim=pow(1.0-max(dot(N,V),0.0),3.0);lit=base*(.24+.98*k)+vec3(.44,.58,.60)*rim*.24+base*vec3(1.35,.28,.04)*fireFall;}else if(uMode==3){lit=vKind<.5?mix(vec3(.47,.30,.15),vec3(.07,.52,.58),wet):vKind<1.5?vec3(.38,.42,.44):vec3(.58,.20,.045);}float fog=1.0-exp(-length(uCamera-vWorld)*.0085);lit=mix(lit,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),fog*.22);outColor=vec4(lit*uExposure,1.0);}`;

export const WATER_VS=`#version 300 es
${COMMON}
layout(location=0)in vec2 aXZ;
uniform mat4 uView,uProj;
out vec3 vWorld,vNormal;
out float vBreaker,vThickness;
void main(){vec2 p=aXZ;float d0=uSeaLevel-bedH(p),shallow=1.0-smoothstep(.85,3.8,d0),k=2.0*PI/(20.5*(uPeriod/8.0)),omega=sqrt(9.81*k*tanh(k*3.5)),phase=k*dot(vec2(.06,-.998),p)-omega*uTime+.1,q=(.12+.20*shallow)*uSwell*smoothstep(.035,.62,d0);float br=0.0,y=waveSurface(p,br),e=.17,bx=0.0,bz=0.0,yx=waveSurface(p+vec2(e,0.0),bx),yz=waveSurface(p+vec2(0.0,e),bz);vec3 tx=vec3(e,yx-y,0.0),tz=vec3(0.0,yz-y,e);vNormal=normalize(cross(tz,tx));vWorld=vec3(p.x,y,p.y);vBreaker=br;vThickness=max(0.0,y-bedH(p));gl_Position=uProj*uView*vec4(vWorld,1.0);}`;

export const WATER_FS=`#version 300 es
${COMMON}
in vec3 vWorld,vNormal;
in float vBreaker,vThickness;
out vec4 outColor;
uniform vec3 uCamera,uSunDir;
uniform vec2 uResolution;
uniform sampler2D uScene,uFoam,uSceneDepth,uRockHeight;
uniform vec4 uDomain;
uniform float uClarity,uFoamGain,uRefraction,uExposure;
uniform int uMode;
vec2 fieldUv(vec2 p){return(p-uDomain.xy)/uDomain.zw;}
vec3 fresnelSchlick(float c,vec3 f0){return f0+(1.0-f0)*pow(1.0-c,5.0);}
float Dggx(float ndh,float a){float a2=a*a,d=ndh*ndh*(a2-1.0)+1.0;return a2/(PI*d*d+.0001);}
float G1(float nd,float k){return nd/(nd*(1.0-k)+k);}
void main(){
 if(vThickness<.004)discard;
 vec3 N=normalize(vNormal),V=normalize(uCamera-vWorld);if(dot(N,V)<0.0)N=-N;
 float ndv=max(dot(N,V),.035),rock=texture(uRockHeight,fieldUv(vWorld.xz)).r;
 if(rock>vWorld.y+.04)discard;
 float thickness=vThickness;
 vec3 refrDir=refract(-V,N,1.0/1.333);float opticalPath=thickness/max(.30,abs(refrDir.y));
 vec2 uv=gl_FragCoord.xy/uResolution,bend=N.xz*.0045*sat(thickness/2.0)*uRefraction;
 vec2 refrUv=clamp(uv+bend,vec2(.001),vec2(.999));
 // Reject refraction samples that cross an opaque foreground silhouette.
 if(texture(uSceneDepth,refrUv).r<gl_FragCoord.z-.00005)refrUv=uv;
 vec3 behind=texture(uScene,refrUv).rgb,sigma=vec3(.32,.13,.075)/max(.5,uClarity),trans=exp(-sigma*opticalPath);
 vec3 F=fresnelSchlick(ndv,vec3(.0204)),reflected=skyRadiance(reflect(-V,N),uSunDir,uMode,uExposure);
 vec2 fp=vWorld.xz*.65+vec2(uTime*.018,-uTime*.025);
 float low=fbm(fp*.32),lace=smoothstep(.39,.70,noise2(fp*1.7)+low*.22);
 float foamState=texture(uFoam,fieldUv(vWorld.xz)).r;
 float foam=sat((foamState*(.28+.68*lace)+vBreaker*.14)*uFoamGain);
 float rough=mix(.23,.59,foam);vec3 H=normalize(V+uSunDir);
 float ndl=max(dot(N,uSunDir),0.0),ndh=max(dot(N,H),0.0),a=rough*rough,gk=a*.5;
 vec3 spec=fresnelSchlick(max(dot(V,H),0.0),vec3(.0204))*(Dggx(ndh,a)*G1(ndv,gk)*G1(ndl,gk)/max(.03,4.0*ndv*ndl))*ndl;
 spec=spec/(1.0+spec*1.8); // Finite solar-disc lobe proxy; no needle-bright stripes.
 vec3 water=(behind*trans+vec3(.048,.21,.24)*(1.0-trans))*(1.0-F)+reflected*F+spec*.65;
 vec3 foamColor=vec3(.74,.80,.77)*(.72+.28*ndl);
 water=mix(water,foamColor,foam);
 if(uMode==1)water=mix(vec3(.42,.57,.56),vec3(.83),foam);
 if(uMode==2)water*=vec3(.95,1.0,1.02);
 if(uMode==3)water=mix(mix(vec3(.60,.79,.65),vec3(.03,.28,.42),sat(thickness/3.0)),vec3(1.0,.63,.18),foam);
 float fog=1.0-exp(-length(uCamera-vWorld)*.003);
 water=mix(water,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),fog*.26);
 // Refraction already contains the opaque background. Only geometric edge coverage blends.
 float farBlend=smoothstep(24.0,49.0,vWorld.z);water=mix(water,farSeaRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),farBlend);
 float coverage=smoothstep(.004,.045,thickness);
 outColor=vec4(water*coverage,coverage);
}
`;

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
void main(){vec2 q=gl_PointCoord*2.0-1.0;float r=dot(q,q);if(r>1.0)discard;float soft=1.0-smoothstep(.18,1.0,r);if(vType<.5){float billow=soft*soft*(.45+.55*(1.0-r));float alpha=billow*smoothstep(0.0,.18,vLife)*(1.0-smoothstep(.54,1.0,vLife))*.34;vec3 c=mix(vec3(.10,.115,.12),vec3(.31,.33,.32),1.0-r);outColor=vec4(c*alpha*uExposure,alpha);}else if(vType<1.5){float flameY=clamp(1.0-gl_PointCoord.y,0.0,1.0),profile=sin(3.14159265*flameY);
 float tongue=pow(max(0.0,1.0-abs(q.x)/max(.03,profile*.70)),1.5)*profile;
 float core=exp(-r*5.0),edge=tongue;float alpha=edge*smoothstep(0.0,.14,vLife)*(1.0-smoothstep(.36,1.0,vLife))*.82;vec3 c=mix(vec3(2.9,.23,.012),vec3(3.8,1.35,.13),core);outColor=vec4(c*alpha*uExposure,alpha);}else{float alpha=soft*smoothstep(0.0,.12,vLife)*(1.0-smoothstep(.45,1.0,vLife))*.47;vec3 c=mix(vec3(.69,.79,.80),vec3(1.0,.99,.94),1.0-r);outColor=vec4(c*alpha*uExposure,alpha);}}`;

export const COPY_VS=SKY_VS;
export const COPY_FS=`#version 300 es
precision highp float;
in vec2 vUv;out vec4 outColor;uniform sampler2D uColor,uDepth;uniform int uFinal,uGlassCount;uniform vec4 uGlassRects[8];uniform vec2 uViewport;
void main(){vec3 c=texture(uColor,vUv).rgb;
 if(uFinal==1){
 for(int i=0;i<8;i++){
  if(i>=uGlassCount)break;vec4 r=uGlassRects[i];float rad=min(24.0,min(r.z,r.w)*.48);
  vec2 p=gl_FragCoord.xy-r.xy-r.zw*.5,q=abs(p)-(r.zw*.5-rad);
  float d=length(max(q,vec2(0)))+min(max(q.x,q.y),0.0)-rad;
  if(d<0.0){
   vec2 n=normalize(p/max(r.zw*.5,vec2(1.0))+vec2(.0001));float edge=exp(d*.19);
   vec2 offset=n*(edge*6.0)/uViewport;vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999));
   vec3 refr=texture(uColor,uv).rgb;
   refr+=texture(uColor,uv+vec2(1.8,0)/uViewport).rgb+texture(uColor,uv-vec2(1.8,0)/uViewport).rgb;
   refr/=3.0;
   c=mix(c,refr,smoothstep(0.0,2.0,-d));c+=vec3(.13,.15,.16)*edge*.16;break;
  }
 }
 c=max(c,vec3(0));c=c/(vec3(.72)+c);c=pow(c,vec3(1.0/2.2));}
 outColor=vec4(c,1);gl_FragDepth=uFinal==0?texture(uDepth,vUv).r:1.0;}`;
