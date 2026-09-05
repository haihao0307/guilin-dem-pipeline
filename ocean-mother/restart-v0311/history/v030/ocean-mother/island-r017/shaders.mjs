import {PARAM_GLSL} from './params.mjs';
export const COMMON=`
precision highp float;
${PARAM_GLSL}
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
float islandR(vec2 p){float theta=atan(p.y,p.x);return p_radius*(1.0+p_roundness*(.64*sin(theta*3.0+.4)+.36*sin(theta*5.0-1.2)));}
float bedH(vec2 p){
 float r=length(p),R=islandR(p),s=r-R;
 float n=p_bedRelief*(.60*sin(p.x*.37+p.y*.21)+.40*sin(p.x*.76-p.y*.33))*smoothstep(R*.7,R+8.0,r);
 if(s>=0.0){float q=s/p_shelfWidth;return -.065*s-.22*q*q-max(0.0,s-p_shelfWidth)*p_seaDepth/45.0+n;}
 float inland=-s,beach=.95*pow(clamp(inland/p_beachWidth,0.0,1.0),p_beachSlope);
 return beach+(p_islandHeight-.95)*smoothstep(0.0,max(2.0,R-p_beachWidth),inland-p_beachWidth)+n;
}
vec2 flowDir(float degrees){float a=degrees*PI/180.0;return vec2(-sin(a),cos(a));}
float waveSurface(vec2 p,out float breaker){
 float bed=bedH(p),level=uSeaLevel,d0=level-bed,r=length(p),s=r-islandR(p);
 float wet=smoothstep(-.12,.65,d0),shallow=1.0-smoothstep(.7,4.0,d0);
 vec2 d=flowDir(p_swellDir);float incidence=.40+.60*smoothstep(-.55,.5,-dot(p,d)/max(1.0,r));
 float eta=level,slope=0.0,primary=0.0;
 for(int i=0;i<5;i++){
  float fi=float(i),angle=i==0?p_swellDir:(i==1?p_secondaryDir:p_windDir+(fi-3.0)*34.0);
  vec2 dir=flowDir(angle);float per=i==0?p_period:(i==1?p_secondaryPeriod:2.1+(fi-2.0)*.66);
  float wavelength=i<2?1.56*per*per:2.2+(fi-2.0)*2.5,k=2.0*PI/wavelength,omega=2.0*PI/per;
  float phase=k*dot(dir,p)-omega*uTime+fi*1.73;
  float h=i==0?p_swell*.5:(i==1?p_secondary*.5:p_windWave*p_wind*.0025/(fi-1.0));
  float group=1.0+p_groupScale*.23*sin(phase*.22+uTime*.12);
  float amp=min(h*(.85+p_shoal*.32*shallow)*incidence*group,max(.016,d0*.34))*wet;
  float shape=sin(phase)+(i==0?p_crest*shallow*sin(2.0*phase):0.0);
  eta+=amp*shape;slope+=abs(amp*k*(cos(phase)+(i==0?2.0*p_crest*shallow*cos(2.0*phase):0.0)));
  if(i==0)primary=sin(phase);
 }
 eta+=p_runup*.10*sin(uTime*2.0*PI/p_period-r*.60)*exp(-s*s/10.0);
 float travel=fract(uTime/p_period),bands=0.0;
 for(int i=0;i<3;i++){
  float gain=i==0?p_curlOuter:(i==1?p_curlMiddle:p_curlInner);
  float radiusOffset=(3.0-float(i))*5.6-travel*5.6,dist=(s-radiusOffset)/p_breakWidth;
  float strength=exp(-dist*dist*1.8)*gain*incidence;
  bands+=strength;eta+=.14*p_swell*strength*wet;
 }
 float depth=eta-bed;
 breaker=clamp((bands*.68+smoothstep(p_breakThreshold,.99,primary)*slope*2.8)*smoothstep(.03,.22,depth),0.0,1.5);
 return eta;
}
vec3 skyRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){float h=sat(rd.y*.5+.5),sun=max(dot(rd,sunDir),0.0);if(mode==1){vec3 n=mix(vec3(.49,.53,.54),vec3(.82,.84,.82),pow(h,.58));return n*exposure;}if(mode==2){vec3 s=mix(vec3(.23,.30,.32),vec3(.71,.76,.75),pow(h,.62));s+=vec3(1.0,.83,.58)*pow(sun,280.0)*2.0;return s*exposure;}vec3 horizon=vec3(.48,.66,.78),zenith=vec3(.045,.23,.49);vec3 c=mix(horizon,zenith,pow(sat(rd.y),.46));float cloud=fbm(rd.xz/max(.16,rd.y+.34)*.42+vec2(uTime*.002*p_cloudSpeed,-uTime*.001*p_cloudSpeed));float cloudBand=smoothstep(.58,.82,cloud)*(1.0-smoothstep(.80,.98,sat(rd.y)));c=mix(c,vec3(.92,.93,.89),cloudBand*p_cloudiness);c+=vec3(1.0,.86,.63)*pow(sun,480.0)*1.8;c+=vec3(1.0,.72,.44)*pow(sun,18.0)*.13;float haze=pow(sat(1.0-abs(rd.y)),5.0);c=mix(c,vec3(.59,.71,.79),haze*.10);return c*exposure*p_skyLight;}
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
uniform vec3 uFirePositions[5];uniform int uFireCount;
uniform sampler2D uWet,uRockHeight;
uniform vec4 uDomain;
uniform int uMode;
vec2 fieldUv(vec2 p){return(p-uDomain.xy)/uDomain.zw;}
void main(){vec3 N=normalize(vNormal),V=normalize(uCamera-vWorld);float wetState=texture(uWet,fieldUv(vWorld.xz)).r,waterWet=1.0-smoothstep(-.28,.18,vWorld.y-uSeaLevel),wet=sat(max(wetState*.92,waterWet));float n1=fbm(vWorld.xz*(vKind<.5?.18:.34)+vWorld.y*.23),n2=noise2(vWorld.xz*(vKind<.5?2.9:1.55)+17.0);vec3 base;float rough;if(vKind<.5){base=mix(vec3(.50,.38,.23),vec3(.84,.74,.54),sat(n1*.78+n2*.20));float shell=smoothstep(.84,.96,noise2(vWorld.xz*5.4));base=mix(base,vec3(.86,.78,.62),shell*.16);base*=mix(1.0,.72,wet);rough=mix(.84,.44,wet);}else if(vKind<1.5){base=mix(vec3(.10,.115,.119),vec3(.40,.385,.34),sat(n1*.80+n2*.16));float strata=smoothstep(.68,.82,fbm(vec2(vWorld.x*.45+vWorld.y*.7,vWorld.z*.48)));base=mix(base,base*1.22,strata*.24);float mineral=noise2(vWorld.xz*14.0+vWorld.y*vec2(9.0,7.0));base*=.77+.46*mineral;
 float relief=.004*fbm(vWorld.xz*6.0+vWorld.y*vec2(3.1,4.7));
 vec3 px=dFdx(vWorld),py=dFdy(vWorld),rx=cross(py,N),ry=cross(N,px);float det=dot(px,rx);
 if(abs(det)>1e-8)N=normalize(abs(det)*N-sign(det)*(dFdx(relief)*rx+dFdy(relief)*ry));
 base*=mix(1.0,1.0-p_rockWet*.5,wet);rough=mix(p_rockRough,max(.18,p_rockRough*.5),wet);}else{float grain=.5+.5*sin(vWorld.x*2.6+vWorld.z*3.1+n1*5.0);base=mix(vec3(.075,.029,.011),vec3(.31,.12,.035),grain*.45+n1*.35);base*=mix(1.0,.60,wet*.35);rough=.58;}float ndl=max(dot(N,uSunDir),0.0),hemi=.20+.25*sat(N.y*.5+.5);vec3 H=normalize(V+uSunDir);float spec=pow(max(dot(N,H),0.0),mix(18.0,135.0,1.0-rough))*mix(.018,.20,1.0-rough);float fireFall=0.0;for(int k=0;k<5;k++){if(k>=uFireCount)break;float d=length(vWorld-uFirePositions[k]);fireFall+=exp(-d*.8)*uFireIntensity*.5;}float visibility=1.0;
 for(int j=1;j<=10;j++){float distanceAlong=float(j)*.6;vec3 probe=vWorld+uSunDir*distanceAlong;
 float height=texture(uRockHeight,fieldUv(probe.xz)).r;
 visibility=min(visibility,smoothstep(-.08,.24,probe.y-height+.14));}
 vec3 lit=base*(hemi+1.08*ndl*mix(.12,1.0,visibility))+skyRadiance(N,uSunDir,uMode,uExposure)*base*.12+vec3(1.0,.88,.69)*spec*2.0+base*vec3(1.55,.33,.055)*fireFall*1.7;if(uMode==1)lit=base*(.43+.72*ndl)+vec3(spec*.25);else if(uMode==2){vec3 key=normalize(vec3(-.42,.76,-.50));float k=max(dot(N,key),0.0),rim=pow(1.0-max(dot(N,V),0.0),3.0);lit=base*(.24+.98*k)+vec3(.44,.58,.60)*rim*.24+base*vec3(1.35,.28,.04)*fireFall;}else if(uMode==3){lit=vKind<.5?mix(vec3(.47,.30,.15),vec3(.07,.52,.58),wet):vKind<1.5?vec3(.38,.42,.44):vec3(.58,.20,.045);}float fog=1.0-exp(-length(uCamera-vWorld)*.0085*p_haze);lit=mix(lit,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),fog*.22);outColor=vec4(lit*uExposure,1.0);}`;

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
 vec3 behind=texture(uScene,refrUv).rgb,sigma=vec3(.32,.13,.075)*p_absorption/max(.5,uClarity),trans=exp(-sigma*opticalPath);
 vec3 F=fresnelSchlick(ndv,vec3(.0204)),reflected=skyRadiance(reflect(-V,N),uSunDir,uMode,uExposure);
 vec2 fp=vWorld.xz*.65+vec2(uTime*.018,-uTime*.025);
 float low=fbm(fp*.32),lace=mix(smoothstep(.39,.70,noise2(fp*1.7)+low*.22),smoothstep(.45,.72,noise2(fp*5.4)+low*.2),p_fineFoam);
 float foamState=texture(uFoam,fieldUv(vWorld.xz)).r;
 float foam=sat((foamState*(.28+.68*lace)+vBreaker*.14)*p_foamThickness);
 float rough=mix(p_waterRough,.59,foam);vec3 H=normalize(V+uSunDir);
 float ndl=max(dot(N,uSunDir),0.0),ndh=max(dot(N,H),0.0),a=rough*rough,gk=a*.5;
 vec3 spec=fresnelSchlick(max(dot(V,H),0.0),vec3(.0204))*(Dggx(ndh,a)*G1(ndv,gk)*G1(ndl,gk)/max(.03,4.0*ndv*ndl))*ndl;
 spec=spec/(1.0+spec*1.8); // Finite solar-disc lobe proxy; no needle-bright stripes.
 vec3 water=(behind*trans+vec3(.035,.23,.26)*(1.0-trans))*(1.0-F)+reflected*F+spec*.65;
 vec3 foamColor=vec3(.74,.80,.77)*(.72+.28*ndl);
 water=mix(water,foamColor,foam);
 if(uMode==1)water=mix(vec3(.42,.57,.56),vec3(.83),foam);
 if(uMode==2)water*=vec3(.95,1.0,1.02);
 if(uMode==3)water=mix(mix(vec3(.60,.79,.65),vec3(.03,.28,.42),sat(thickness/3.0)),vec3(1.0,.63,.18),foam);
 float fog=1.0-exp(-length(uCamera-vWorld)*.003*p_haze);
 water=mix(water,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),fog*.26);
 // Refraction already contains the opaque background. Only geometric edge coverage blends.
 float farBlend=smoothstep(78.0,99.0,length(vWorld.xz));water=mix(water,farSeaRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),farBlend);
 float coverage=smoothstep(.004,.045,thickness);
 outColor=vec4(water*coverage,coverage);
}
`;

export const MEDIA_VS=`#version 300 es
precision highp float;
layout(location=0)in vec4 aPositionLife;
layout(location=1)in vec4 aSizeType;
uniform mat4 uView,uProj;
uniform vec2 uResolution;
out float vLife,vType,vDepth,vSeed,vAge;
out vec2 vQ;
void main(){
 vec2 q=vec2(float(gl_VertexID&1)*2.0-1.0,float((gl_VertexID>>1)&1)*2.0-1.0);
 float kind=aSizeType.y,age=aSizeType.z;
 vec2 scale=kind<.5?vec2(1.0+.16*age,.72+.10*age):(kind<1.5?vec2(.58,1.45):vec2(.62));
 vec4 view=uView*vec4(aPositionLife.xyz,1.0);view.xy+=q*aSizeType.x*scale;
 gl_Position=uProj*view;vQ=q;vLife=aPositionLife.w;vType=kind;vDepth=-view.z;vAge=age;vSeed=aSizeType.w;
}`;
export const MEDIA_FS=`#version 300 es
precision highp float;
in float vLife,vType,vDepth,vSeed,vAge;in vec2 vQ;
out vec4 outColor;
uniform float uExposure,uTime;
${PARAM_GLSL}
float hashM(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nM(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hashM(a),hashM(a+vec2(1,0)),f.x),mix(hashM(a+vec2(0,1)),hashM(a+1.0),f.x),f.y);}
void main(){
 vec2 q=vQ;float r=dot(q,q);if(r>1.0)discard;
 float n=nM(q*3.6+vec2(vSeed,vAge*.22))+ .5*nM(q*8.2+vSeed*.31-vec2(vAge*.18,0));
 float feather=1.0-smoothstep(.16,.98,r);
 if(vType<.5){
  float density=feather*feather*smoothstep(.23,.92,n)*pow(max(.001,vLife),p_smokeFade)*smoothstep(0.0,.7,vAge);
  float alpha=(1.0-exp(-density*.32));
  float light=.5+.35*(q.y*.5+.5)+.15*n;
  vec3 c=mix(vec3(.13,.145,.16),vec3(.38,.40,.42),light);
  outColor=vec4(c*alpha*uExposure,alpha);
 }else if(vType<1.5){
  float y=clamp(q.y*.5+.5,0.0,1.0),w=max(.04,(1.0-y)*.8);
  float bend=sin(y*5.5+vSeed+uTime*p_fireSpeed)*p_fireTurb*.08;
  float tongue=pow(max(0.0,1.0-abs(q.x-bend)/w),1.25)*sin(3.14159265*y);
  float edge=smoothstep(.17,.67,n)*tongue;
  float alpha=edge*smoothstep(0.0,.12,vLife)*smoothstep(0.0,.06,vAge)*.80;
  float hot=clamp((p_fireTemp-1000.0)/1300.0,0.0,1.0);
  vec3 c=mix(vec3(2.1,.11,.007),vec3(3.5,1.30,.16),hot*(1.0-y*.55));
  outColor=vec4(c*alpha*uExposure,alpha);
 }else if(vType<2.5){
  float a=feather*min(1.0,vLife*4.0)*.43;vec3 c=vec3(.79,.86,.85);
  outColor=vec4(c*a*uExposure,a);
 }else{
  float a=feather*feather*min(1.0,vLife*5.0);outColor=vec4(vec3(2.6,.55,.035)*a,a);
 }
}`;

export const COPY_VS=SKY_VS;
export const COPY_FS=`#version 300 es
precision highp float;
in vec2 vUv;out vec4 outColor;uniform sampler2D uColor,uDepth;uniform int uFinal,uGlassCount;uniform vec4 uGlassRects[8];uniform vec2 uViewport;uniform float uUiTime;
${PARAM_GLSL}
void main(){vec3 c=texture(uColor,vUv).rgb;
 if(uFinal==1){
 for(int i=0;i<8;i++){
  if(i>=uGlassCount)break;vec4 r=uGlassRects[i];float rad=min(24.0,min(r.z,r.w)*.48);
  vec2 p=gl_FragCoord.xy-r.xy-r.zw*.5,q=abs(p)-(r.zw*.5-rad);
  float d=length(max(q,vec2(0)))+min(max(q.x,q.y),0.0)-rad;
  if(d<0.0){
   vec2 n=normalize(p/max(r.zw*.5,vec2(1.0))+vec2(.0001));float edge=exp(d*.19);
   float t=uUiTime*p_glassSpeed,phase=p.x*.029+p.y*.011-t*.73;
   float flow=sin(phase)+.45*sin(p.y*.023-p.x*.007+t*.52);
   vec2 offset=(n*edge*p_glassRefract+vec2(flow,cos(phase*.77))*.35*p_glassFlow)/uViewport;vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999));
   vec3 refr=texture(uColor,uv).rgb;
   refr+=texture(uColor,uv+vec2(1.8,0)/uViewport).rgb+texture(uColor,uv-vec2(1.8,0)/uViewport).rgb;
   refr/=3.0;
   c=mix(c,refr,smoothstep(0.0,2.0,-d));vec3 flowColor=.55+.45*cos(vec3(0.0,2.1,4.2)+p_glassHue*.01745);
   float caustic=pow(max(0.0,.5+.5*sin(phase+flow*.3)),7.0);
   c+=vec3(.13,.15,.16)*edge*.16*p_glassEdge;
   c+=flowColor*caustic*.042*p_glassFlow*smoothstep(0.0,7.0,-d);break;
  }
 }
 c=max(c,vec3(0));c=c/(vec3(.72)+c);c=pow(c,vec3(1.0/2.2));}
 outColor=vec4(c,1);gl_FragDepth=uFinal==0?texture(uDepth,vUv).r:1.0;}`;

export const CURL_VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;layout(location=1)in vec3 aNormal;layout(location=2)in vec2 aBreakDepth;
uniform mat4 uView,uProj;out vec3 vWorld,vNormal;out float vBreaker,vThickness;
void main(){vWorld=aPosition;vNormal=aNormal;vBreaker=aBreakDepth.x;vThickness=aBreakDepth.y;gl_Position=uProj*uView*vec4(aPosition,1.0);}`;
