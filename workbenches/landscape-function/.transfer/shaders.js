'use strict';
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec3 aRest;layout(location=3) in vec4 aD;layout(location=4) in vec3 aE;
uniform mat4 uVP;out vec3 p;out vec3 n0;out vec3 q;out vec4 d;out vec3 e;out vec3 bmQ;out vec3 bmData;
float bmH(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float bmN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(bmH(i),bmH(i+vec3(1,0,0)),f.x),mix(bmH(i+vec3(0,1,0)),bmH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bmH(i+vec3(0,0,1)),bmH(i+vec3(1,0,1)),f.x),mix(bmH(i+vec3(0,1,1)),bmH(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 bmTwist(vec3 p,vec3 center,vec3 axis,float radius,float freq,float amp,float phase){vec3 v=p-center;axis=normalize(axis);float angle=amp*exp(-dot(v,v)/(radius*radius))*sin(freq*dot(axis,v)+phase);float c=cos(angle),s=sin(angle);return center+c*v+s*cross(axis,v)+(1.-c)*axis*dot(axis,v);}
vec3 bmCoordinates(vec3 p){p=bmTwist(p,vec3(.12,-.08,.04),vec3(.38,.82,.42),2.4,1.45,.65,.7);p=bmTwist(p,vec3(-.16,.13,-.06),vec3(-.67,.15,.73),2.1,4.1,.20,2.0);vec3 x=p*6.9+vec3(.7);p+=.050*(vec3(bmN(x),bmN(x+vec3(14.7,-6.3,4.2)),bmN(x+vec3(-3.7,17.2,12.4)))-.5);return p;}
uint bmHashU(ivec3 p,uint seed){uint h=uint(p.x)*374761393u^uint(p.y)*668265263u^uint(p.z)*1274126177u^seed;h=(h^(h>>13u))*1274126177u;return h^(h>>16u);}
float bmSeedNoise(vec3 p,uint seed){ivec3 i=ivec3(floor(p));vec3 f=fract(p);f=f*f*(3.-2.*f);float a=float(bmHashU(i,seed)),b=float(bmHashU(i+ivec3(1,0,0),seed)),c=float(bmHashU(i+ivec3(0,1,0),seed)),d=float(bmHashU(i+ivec3(1,1,0),seed)),e=float(bmHashU(i+ivec3(0,0,1),seed)),g=float(bmHashU(i+ivec3(1,0,1),seed)),h=float(bmHashU(i+ivec3(0,1,1),seed)),j=float(bmHashU(i+ivec3(1,1,1),seed));return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,j,f.x),f.y),f.z)/4294967295.;}
uint bmColorSeed(uint seed){seed=(seed^99u)*16777619u;seed=(seed^111u)*16777619u;seed=(seed^108u)*16777619u;seed=(seed^111u)*16777619u;return(seed^114u)*16777619u;}
void main(){vec3 z=aRest*.13;bmQ=bmCoordinates(z);uint seed=bmColorSeed(8231u);bmData=vec3(bmSeedNoise(z*2.2,seed),bmSeedNoise(z*7.5,seed+88u),bmSeedNoise(z*26.,seed+19u));p=aP;n0=aN;q=aRest;d=aD;e=aE;gl_Position=uVP*vec4(p,1.);}`;
const FS=`#version 300 es
precision highp float;
in vec3 p;in vec3 n0;in vec3 q;in vec4 d;in vec3 e;in vec3 bmQ;in vec3 bmData;out vec4 frag;
uniform vec3 uEye;uniform float uExposure,uWet,uMicro;uniform int uMode,uSection,uSelect;uniform float uStage;
float bmH(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float bmN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(bmH(i),bmH(i+vec3(1,0,0)),f.x),mix(bmH(i+vec3(0,1,0)),bmH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bmH(i+vec3(0,0,1)),bmH(i+vec3(1,0,1)),f.x),mix(bmH(i+vec3(0,1,1)),bmH(i+vec3(1,1,1)),f.x),f.y),f.z);}
float noise(vec3 p){return bmN(p);}
// Brick R4 finite microscope sum, same rotation, amplitudes and footprint filter.
float bmCell(vec3 p){vec3 c=cos(p);return cos(c.z*c.x+c.y*c.y+c.y*c.x);}
float bmSum(vec3 q){float footprint=max(length(dFdx(q)),length(dFdy(q))),sum=0.,freq=1.,amp=1.;const mat3 turn=mat3(.36,.48,-.80,-.80,.60,0.,.48,.64,.60);for(int j=0;j<4;j++){float w=1.-smoothstep(.24,1.1,footprint*freq);sum+=w*(bmCell(q)-.6556965)*amp;q=turn*q*2.07+vec3(7.13,-3.71,5.47);freq*=2.07;amp*=.43;}return sum;}
vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){bool cap=d.x>3.5&&d.x<5.5;if(uSection==1&&!cap&&p.z>.001)discard;vec3 N=normalize(n0);if(!gl_FrontFacing)N=-N;
 float g=noise(q*.95),b=noise(q*.069+vec3(27.,7.,19.)),f=noise(q*7.4),ao=d.y,sun=d.z,rough=.88;vec3 albedo;
 if(d.x<2.5||(d.x>3.5&&d.x<4.5)){
  // Brick R4's stone-only color/roughness/detail branch; metre scale is the adapter.
  int family=int(d.w+.1);if(cap)family=1;
  vec3 mq=bmQ+vec3(.329,-.217,.133);float a=bmData.x,b=bmData.y,c=bmData.z;
  float footprint=max(length(dFdx(mq)),length(dFdy(mq)));
  float field=bmSum(mq*(family==5?36.:family==6?38.4:33.6));
  float grain=bmN(mq*211.7+vec3(4.1,8.3,-2.1));float fineFilter=1.-smoothstep(.0015,.006,footprint);grain=mix(.5,grain,fineFilter);
  float drift=bmN(mq*4.3+vec3(7.8,-11.3,4.1)),mineral=smoothstep(.68,.86,grain+.2*(b-.5)),seams=0.;
  if(family==1){float domain=dot(mq,vec3(1.6,10.7,2.4))+drift*2.4;seams=smoothstep(.90,.994,sin(domain))*smoothstep(.50,.76,b)*.48;}
  float warm=smoothstep(.29,.76,a+.12*(drift-.5));
  albedo=mix(vec3(.32,.354,.365),vec3(.60,.565,.48),clamp(.46+(warm-.5)*1.12,0.,1.));
  albedo=mix(albedo,vec3(.40,.31,.215),smoothstep(.58,.77,drift)*.19);
  albedo=mix(albedo,vec3(.69,.686,.61),seams);
  float fresh=smoothstep(.35,.78,c);albedo=mix(albedo,vec3(.65,.646,.607),mineral*fresh*.23);
  albedo*=.975+.16*(grain-.5)+.045*field;
  float height=field*.013+(grain-.5)*.005;
  rough=clamp((family==1?.92:family==2?.91:family==5?.88:.80)+.12*(drift-.5)-mineral*fresh*.08,.62,.99);
  if(family==5){albedo=mix(albedo,vec3(.56,.516,.438),.24);height*=.87;}
  if(family==6){albedo=mix(vec3(.285,.31,.29),vec3(.565,.537,.456),clamp(.54+(a-.5)*1.4,0.,1.));albedo=mix(albedo,vec3(.70,.69,.626),mineral*.12);height=field*.0028+(grain-.5)*.0022;rough=clamp(.80+.07*(b-.5),.50,.96);}
  // Landscape-only environmental overlay. It never replaces the source mineral identity.
  float rain=clamp(e.z,0.,1.),stain=smoothstep(.34,.9,rain),retention=clamp(.65*rain+.20*(1.-sun)+.15*(1.-ao),0.,1.);
  float habitatNoise=bmN(q*.15+vec3(7,11,19))*.70+bmN(q*.82+vec3(3,9,5))*.30;
  float moss=smoothstep(.50,.71,habitatNoise)*smoothstep(.22,.64,retention)*smoothstep(-.12,.5,n0.y)*clamp(uStage/4.,0.,1.);
  albedo=mix(albedo,vec3(.205,.238,.204),stain*.22*(1.-smoothstep(.25,.85,n0.y)));
  albedo=mix(albedo,mix(vec3(.22,.265,.135),vec3(.30,.34,.17),bmN(q*1.8)),moss*.45);
  if(uMicro>0.&&uMode==0&&!cap){
   vec3 faceN=normalize(cross(dFdx(p),dFdy(p)));faceN*=sign(dot(faceN,N));N=normalize(mix(N,faceN,family==6?0.:.13));
   height*=.42/.13;vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);
   if(abs(det)>1e-9){vec3 grad=(r1*dFdx(height)+r2*dFdy(height))/det;grad*=min(1.,.82/max(length(grad),.001));N=normalize(N-uMicro*grad);}
  }
  float moisture=uWet*(.45+.55*rain);albedo*=1.-moisture*.24;rough=clamp(rough-moisture*.30,.30,1.);
 }else if(d.x<5.6){
  // Soil composition/stratification is an authored spatial proxy, not a surveyed horizon log.
  float depth=max(0.,d.w),t=max(.2,e.x),jitter=(noise(p*vec3(.3,.7,.3))-.5)*.3;
  vec3 humus=vec3(.29,.28,.18),clay=mix(vec3(.45,.28,.15),vec3(.56,.39,.23),b),saprolite=vec3(.52,.47,.34),bedrock=vec3(.39,.43,.38);
  float soilLevel=depth+jitter;albedo=mix(humus,clay,smoothstep(.08,.32,soilLevel));albedo=mix(albedo,saprolite,smoothstep(.6*t,1.1*t,soilLevel));albedo=mix(albedo,bedrock,smoothstep(t,t+.9,soilLevel));
  if((d.x>2.5&&d.x<3.5)&&n0.y>.35){float s=noise(p*.095+13.);albedo=mix(vec3(.35,.28,.18),vec3(.255,.29,.165),smoothstep(.3,.7,s)*clamp(uStage/4.,0.,1.));albedo*=.84+.22*noise(p*1.9);}
  float inclusion=smoothstep(.68,.82,noise(p*3.7))*smoothstep(.3,.65,noise(p*.9));albedo=mix(albedo,vec3(.49,.50,.44),inclusion*.30);
  float pores=smoothstep(.76,.85,noise(p*10.));albedo*=1.-pores*.16;albedo*=.90+.14*f;
  albedo*=mix(1.,.73,uWet);rough=.99;
 }else{albedo=mix(vec3(.20,.25,.12),vec3(.34,.36,.18),b);rough=1.;}
 if(uMode==1)albedo=vec3(.55,.57,.53);
 if(uMode==2){float ny=normalize(n0).y;albedo=ny<-.10?mix(vec3(.85,.37,.17),vec3(.66,.15,.08),clamp(-ny,0.,1.)):mix(vec3(.32,.46,.55),vec3(.56,.69,.39),clamp(ny,0.,1.));}
 if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}
 if(uSelect>0&&int(e.y+.1)==uSelect)albedo=mix(albedo,vec3(.84,.62,.27),.40);
 albedo=linearize(albedo);
 vec3 L=normalize(vec3(-.62,.78,.40)),V=normalize(uEye-p),H=normalize(L+V);float nl=max(0.,dot(N,L)),nv=max(.001,dot(N,V)),nh=max(0.,dot(N,H)),vh=max(0.,dot(V,H));
 // Brick R4 dielectric GGX and correlated Smith response, existing numeric visibility.
 float alpha=rough*rough,aa=alpha*alpha,den=nh*nh*(aa-1.)+1.;
 float D=aa/(3.14159265*den*den),gv=nl*sqrt(max(nv*nv*(1.-aa)+aa,0.)),glh=nv*sqrt(max(nl*nl*(1.-aa)+aa,0.)),vis=.5/max(gv+glh,1e-5);
 vec3 F=vec3(.04)+vec3(.96)*pow(1.-vh,5.),spec=D*vis*F;
 vec3 hemi=mix(vec3(.18,.174,.16),vec3(.44,.455,.47),N.y*.5+.5);
 vec3 color=albedo*hemi*ao+((1.-F)*albedo/3.14159265+spec)*vec3(3.6,3.4,3.17)*nl*mix(.15,1.,sun);
 color+=albedo*vec3(.29,.31,.34)*max(dot(N,normalize(vec3(3.,1.,-2.))),0.);
 if(cap)color=albedo*.86;
 color=max(color*uExposure*1.18,vec3(0));vec3 c=srgb(color/(1.+color));float fog=1.-exp(-max(0.,distance(uEye,p)-110.)*.0014);frag=vec4(mix(c,vec3(.74,.79,.76),fog),1.);
}`;
