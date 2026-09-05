#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform vec4 uIsland;
uniform vec4 uWaves;
uniform vec4 uMedia;
uniform vec4 uOptics;
uniform vec4 uRocks;
uniform vec4 uExtra;
uniform int uFlags;
uniform int uMode;

#define PI 3.14159265359
float sat(float x){return clamp(x,0.,1.);} 
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);} 
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);} 
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1)),f.x),f.y);} 
float fbm(vec2 p){float a=.5,s=0.;mat2 m=mat2(1.62,1.18,-1.18,1.62);for(int i=0;i<5;i++){s+=a*noise2(p);p=m*p+.17;a*=.48;}return s;} 
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float n=mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);return n;} 

bool flag(int bit){return (uFlags & bit)!=0;}

float angleDelta(float a,float b){return atan(sin(a-b),cos(a-b));}
float angularLobe(float a,float c,float w){float d=angleDelta(a,c)/w;return exp(-d*d);}
mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smoothMin(float a,float b,float k){float h=sat(.5+.5*(b-a)/k);return mix(b,a,h)-k*h*(1.-h);}
float taperedSpit(vec2 p){
  vec2 a=vec2(27.,-17.),b=vec2(66.,-28.);
  vec2 pa=p-a,ba=b-a;
  float h=sat(dot(pa,ba)/dot(ba,ba));
  float width=mix(7.2,2.0,pow(h,.72));
  return length(pa-ba*h)-width;
}
float islandRadius(float a){
  float irr=uIsland.y;
  float r=45.5;
  r*=1.+irr*(.118*sin(a*2.+.38)+.071*sin(a*3.-1.18)+.046*sin(a*5.+2.06)+.031*sin(a*8.-.42)+.017*sin(a*13.+1.72));
  r+=uIsland.w*(8.8*angularLobe(a,-.54,.34)-8.0*angularLobe(a,1.94,.30)+5.9*angularLobe(a,2.76,.25)-5.0*angularLobe(a,.73,.22)+3.2*angularLobe(a,-2.18,.18));
  return r;
}
float shoreDistance(vec2 p){
  vec2 q=rot2(-.16)*p;
  vec2 e=q/vec2(1.16,.88);
  float a=atan(e.y,e.x);
  float d=length(e)-islandRadius(a);
  d+=(fbm(q*.052+vec2(3.1,-1.7))-.5)*4.0*uIsland.y;
  d+=(noise2(q*.19+4.3)-.5)*.95*uIsland.y;
  float spit=taperedSpit(q)+(1.12-uIsland.w)*3.2;
  d=smoothMin(d,spit,4.6);
  return d;
}

float cragOne(vec2 p,vec2 c,vec2 r,float h,float seed,float turn){
  vec2 q=rot2(turn)*(p-c)/r;
  if(any(greaterThanEqual(abs(q),vec2(1.))))return 0.;
  float superD=pow(pow(abs(q.x),1.42)+pow(abs(q.y),1.42),1./1.42);
  float core=sat(1.-superD);
  float a=atan(q.y,q.x);
  float facets=.88+.075*sin(a*5.+seed)+.045*sin(a*9.-seed*.63)+.022*sin(a*14.+seed*.31);
  float fracture=mix(.92,1.045,noise2(q*2.7+seed));
  float split=1.-.075*smoothstep(.50,.60,noise2(q*5.2+seed*1.7));
  float exponent=mix(.58,.28,sat(uRocks.x/1.6));
  return h*pow(core,exponent)*facets*fracture*split;
}
float rockField(vec2 p){
  float r=0.;
  r=max(r,cragOne(p,vec2(35.,-12.),vec2(9.5,6.2),8.2,1.1,.32));
  r=max(r,cragOne(p,vec2(28.,-24.),vec2(6.6,4.4),5.4,4.3,-.28));
  r=max(r,cragOne(p,vec2(-34.,10.),vec2(11.2,7.0),8.8,7.2,.18));
  r=max(r,cragOne(p,vec2(-42.,0.),vec2(6.5,4.2),5.1,9.7,-.55));
  r=max(r,cragOne(p,vec2(4.,31.),vec2(8.2,5.2),6.7,13.4,.46));
  r=max(r,cragOne(p,vec2(17.,27.),vec2(5.2,3.6),4.8,16.1,-.12));
  r=max(r,cragOne(p,vec2(-7.,-34.),vec2(7.1,4.3),4.7,19.3,.62));
  r=max(r,cragOne(p,vec2(-4.,4.),vec2(8.8,6.7),6.2,22.8,-.34));
  r=max(r,cragOne(p,vec2(10.,1.),vec2(5.0,3.7),4.1,25.6,.41));
  return r;
}
float ridged2(vec2 p){return 1.-abs(2.*fbm(p)-1.);}
float terrainHeight(vec2 p){
  float sd=shoreDistance(p);
  float inside=smoothstep(3.2,-3.8,sd);
  float offshore=max(sd,0.);
  float seabed=-.22-offshore*.046+(fbm(p*.035+vec2(5.2,1.4))-.5)*.62;
  float inland=max(-sd,0.);
  float upland=smoothstep(uIsland.z*.58,uIsland.z*1.34,inland);
  float shelf=.16+.052*min(inland,uIsland.z*1.25);
  float dunes=(fbm(p*.22+vec2(6.4,-2.1))-.5)*.62*(1.-upland);
  float core=sat((inland-uIsland.z*.42)/48.);
  float broad=uIsland.x*(.24*pow(core,.52)+.76*pow(core,1.38));
  float ridgeA=pow(ridged2(rot2(.58)*p*.052+vec2(1.3,-.7)),2.75);
  float ridgeB=pow(ridged2(rot2(-.47)*p*.083+vec2(4.2,2.1)),3.15);
  float relief=(ridgeA-.38)*4.7*pow(core,.58)+(ridgeB-.42)*2.35*pow(core,.44);
  float drainage=pow(sat(.50-ridged2(p*.068+vec2(8.1,-2.4))),2.1);
  float gullies=-3.1*drainage*pow(core,.72);
  vec2 pa=(p-vec2(-9.,6.))/vec2(24.,18.);
  vec2 pb=(p-vec2(13.,-3.))/vec2(19.,15.);
  float peaks=3.8*exp(-dot(pa,pa)*1.35)+2.6*exp(-dot(pb,pb)*1.55);
  float land=shelf+dunes+upland*(broad+relief+gullies+peaks)+rockField(p);
  return mix(seabed,land,inside);
}
float rockMaskAt(vec2 p){return smoothstep(.34,1.25,rockField(p));}

float swellExposure(vec2 p){
  vec2 dir=normalize(vec2(.78,.62));
  vec2 outward=normalize(p+vec2(.001));
  float d=dot(outward,dir);
  float incidence=smoothstep(-.04,.74,d);
  float shoulder=pow(max(0.,1.-abs(d)),2.2)*.16;
  float wrap=.025+.90*incidence+shoulder;
  float leePocket=1.-.72*angularLobe(atan(p.y,p.x),-2.28,.48);
  return sat(wrap*leePocket);
}
float breakerBandAt(vec2 p,float sd,float layer,float t,out float front){
  float a=atan(p.y,p.x);
  vec2 dir=normalize(vec2(.78,.62));
  float refraction=smoothstep(35.,3.,sd);
  float warp=1.25*sin(a*(2.2+layer*.20)+layer*1.77)+.56*sin(a*7.1-layer*.83)+(fbm(p*.072+vec2(layer*4.1,-layer*2.6))-.5)*2.65;
  float coord=dot(p,dir)*.70+refraction*sd*.56+warp-t*uWaves.y*4.25+layer*8.0;
  front=mod(coord+12.,24.)-12.;
  float width=.82+layer*.18;
  float line=exp(-front*front/(width*width));
  vec2 side=vec2(-dir.y,dir.x);
  float anchorCenter=6.2+layer*6.7;
  float anchorFront=sd-anchorCenter+.060*dot(p,side)+warp*.42;
  float anchored=exp(-anchorFront*anchorFront/(1.05+layer*.24));
  line=max(line,anchored*(.88-layer*.13));
  float segment=.18+.82*smoothstep(.40,.72,fbm(p*.135+vec2(layer*5.7,t*.018+layer)));
  float zone=smoothstep(-1.5,2.0,sd)*smoothstep(37.,18.,sd);
  return line*swellExposure(p)*segment*zone;
}
float breakerBand(vec2 p,float layer,float t,out float front){return breakerBandAt(p,shoreDistance(p),layer,t,front);}
float waterHeightAt(vec2 p,float sd){
  float t=uTime;
  vec2 dir=normalize(vec2(.78,.62));
  float swell=.48*sin(dot(p,dir)*.105-t*uWaves.y)+.21*sin(dot(p,vec2(-.42,.91))*.165-t*uWaves.y*1.31+1.3)+.11*sin(dot(p,vec2(.95,-.31))*.29-t*.67);
  float h=swell*uWaves.x;
  if(flag(2)){
    for(int i=0;i<3;i++){
      float front;
      float b=breakerBandAt(p,sd,float(i),t,front);
      float weight=1.08-float(i)*.18;
      float exposure=swellExposure(p);
      float shoulder=exp(-pow((front+1.02)/(1.52+float(i)*.13),2.))*exposure;
      float trough=exp(-pow((front-1.32)/(1.12+float(i)*.10),2.))*exposure;
      float crestLift=b*(1.03+uWaves.w*.14)+shoulder*uWaves.w*.31-trough*.09;
      h+=uWaves.z*weight*crestLift;
    }
  }
  h*=mix(.30,1.,smoothstep(-3.5,25.,sd));
  return h;
}
float waterHeight(vec2 p){return waterHeightAt(p,shoreDistance(p));}
float foamFilament(vec2 p,float scale,vec2 drift,float phase){
  vec2 q=rot2(.43+phase*.19)*p*scale+drift*uTime+vec2(phase,-phase*.63);
  float warp=(fbm(q*.47+vec2(2.7,-4.1))-.5)*1.75;
  q+=vec2(warp,-warp*.58);
  float n=(noise2(q)+.52*noise2(q*2.03+vec2(7.1,-3.4)))/1.52;
  float ridge=abs(n-.5);
  float aa=max(fwidth(n)*1.55,.0045);
  float thread=1.-smoothstep(.032-aa,.078+aa,ridge);
  float torn=smoothstep(.29,.73,fbm(q*.43+vec2(-2.3,5.8)));
  return thread*(.24+.76*torn);
}
float foamField(vec2 p){
  float sd=shoreDistance(p),a=atan(p.y,p.x),t=uTime;
  float fineA=foamFilament(p,.145,vec2(.020,-.011),.7);
  float fineB=foamFilament(p,.255,vec2(-.012,.019),2.2);
  float longStrand=foamFilament(rot2(.31)*p,.105,vec2(.027,.004),4.3);
  float macroGate=smoothstep(.20,.76,fbm(p*.072+vec2(t*.010,-t*.006)));
  float foam=0.;
  if(flag(1)){
    for(int i=0;i<3;i++){
      float front;
      float band=breakerBandAt(p,sd,float(i),t,front);
      float core=smoothstep(.018,.38,band);
      float trailing=exp(-pow(max(front,0.)/(4.0+float(i)*.35),2.))*exp(-pow(min(front,0.)/(1.25+float(i)*.14),2.));
      float phaseMix=fract(float(i)*.37+.18);
      float lace=mix(fineA,fineB,phaseMix);
      float wake=trailing*swellExposure(p)*(.10+.90*mix(longStrand,fineB,.45));
      float broken=(.18+.82*macroGate)*(.34+.66*lace);
      foam+=(core*broken+wake*.34)*uMedia.x*(1.-float(i)*.14);
    }
  }
  if(flag(8)){
    float shore=exp(-pow((sd+.28)/3.05,2.));
    float sweep=.5+.5*sin(a*4.7-t*uWaves.y*.95+fbm(p*.095)*5.2);
    float runupLace=mix(fineA,longStrand,.54)*smoothstep(.12,.82,macroGate);
    foam+=shore*pow(sweep,.90)*(.14+.86*runupLace)*uMedia.z*.62;
    float wetBand=smoothstep(-uIsland.z*1.12,-1.4,sd)*(1.-smoothstep(-1.4,.8,sd));
    foam+=wetBand*.055*(.18+.82*fineB)*uMedia.z;
  }
  return sat(pow(max(foam,0.),.92));
}

vec3 terrainNormal(vec2 p){float e=.28;float h=terrainHeight(p);return normalize(vec3(h-terrainHeight(p+vec2(e,0.)),e,h-terrainHeight(p+vec2(0,e))));}
vec3 waterNormal(vec2 p){float e=.38;float h=waterHeight(p);return normalize(vec3(h-waterHeight(p+vec2(e,0.)),e,h-waterHeight(p+vec2(0,e))));}

float traceTerrain(vec3 ro,vec3 rd,float maxT){
  if(rd.y>.08)return 1e5;
  float t=.4;
  for(int i=0;i<82;i++){
    vec3 p=ro+rd*t;
    float d=p.y-terrainHeight(p.xz);
    if(d<.025)return t;
    t+=clamp(d*.45,.11,4.8);
    if(t>maxT||length(p.xz)>420.)break;
  }
  return 1e5;
}
float traceWater(vec3 ro,vec3 rd){
  if(rd.y>=-.0008)return 1e5;
  float t=(0.-ro.y)/rd.y;
  if(t<0.)return 1e5;
  for(int i=0;i<7;i++){
    vec3 p=ro+rd*t;
    float h=waterHeight(p.xz);
    t+=(h-p.y)/rd.y;
  }
  return t>0.&&t<850.?t:1e5;
}

vec3 skyColor(vec3 rd,vec3 sunDir){
  float y=sat(rd.y*.58+.44);
  vec3 horizon=vec3(.47,.64,.68);
  vec3 zenith=vec3(.035,.135,.205);
  vec3 col=mix(horizon,zenith,pow(y,.72));
  float sun=pow(max(dot(rd,sunDir),0.),760.);
  float halo=pow(max(dot(rd,sunDir),0.),9.);
  col+=vec3(1.,.78,.49)*sun*4.2+vec3(.95,.68,.43)*halo*.18;
  float cloud=fbm(rd.xz*4.4+vec2(uTime*.002,0.));
  col=mix(col,col+vec3(.11,.13,.13),smoothstep(.58,.82,cloud)*smoothstep(.12,.5,rd.y)*.32);
  return col;
}

float curlDensity(vec3 p){
  if(!flag(4))return 0.;
  float maxWave=.80*abs(uWaves.x)+2.70*abs(uWaves.z)*(1.03+.45*abs(uWaves.w));
  if(abs(p.y)>maxWave+1.95)return 0.;
  float sd=shoreDistance(p.xz);
  if(sd<=-1.5||sd>=37.)return 0.;
  float localY=p.y-waterHeightAt(p.xz,sd);
  if(localY<=-.12||localY>=1.92)return 0.;
  float den=0.;
  for(int i=0;i<3;i++){
    float front;
    float band=breakerBandAt(p.xz,sd,float(i),uTime,front);
    float fi=float(i);
    float x=front*(.52+fi*.025);
    float radius=.64+uWaves.w*.28+fi*.055;
    float arch=abs(length(vec2((x+.30)*.94,localY-.22))-radius);
    float upper=smoothstep(-.12,.16,localY)*(1.-smoothstep(.92+fi*.08,1.72+fi*.10,localY));
    float lip=exp(-arch*(24.-fi*2.5))*upper;
    float falling=exp(-pow((x+.82)/(0.30+uWaves.w*.09),2.))*smoothstep(-.08,.18,localY)*(1.-smoothstep(.18,1.18+fi*.10,localY));
    float feather=.42+.58*smoothstep(.24,.78,noise3(p*.55+vec3(uTime*.12,fi*3.4,-uTime*.08)));
    den+=(lip*1.60+falling*.72)*sqrt(max(band,0.))*uWaves.w*(1.-fi*.17)*feather;
  }
  return den;
}
float sprayDensity(vec3 p){
  if(!flag(16)||p.y<=-.15)return 0.;
  float den=0.;
  for(int i=0;i<2;i++){
    float front;
    float band=breakerBand(p.xz,float(i),uTime,front);
    float heightFade=exp(-p.y/(2.1+uMedia.w*1.25))*smoothstep(-.15,.35,p.y);
    float n=noise3(p*.42+vec3(uTime*.20,uTime*.11,-uTime*.17)+float(i)*3.4);
    den+=sqrt(max(band,0.))*heightFade*smoothstep(.58,.84,n)*uMedia.w*(1.-float(i)*.25);
  }
  return den*1.35;
}
float smokeDensityAt(vec3 p){
  if(!flag(32)||p.y<1.3||p.y>uMedia.y+10.)return 0.;
  vec2 sources[4];
  sources[0]=vec2(-6.5,3.5);sources[1]=vec2(-1.0,-1.8);sources[2]=vec2(4.8,3.2);sources[3]=vec2(1.8,8.0);
  float den=0.;
  for(int i=0;i<4;i++){
    float h=p.y-1.9;
    vec2 windDir=normalize(vec2(.82,.36));
    vec2 curl=vec2(sin(h*.17+float(i)*1.7),cos(h*.13-float(i)*.9));
    vec2 drift=windDir*h*uOptics.w*.52+curl*(1.4+sat(h/28.)*1.7);
    vec2 q=p.xz-sources[i]-drift;
    float radius=1.55+h*.125+2.15*sat(h/max(uMedia.y,1.));
    float body=exp(-dot(q,q)/(radius*radius));
    float n=noise3(vec3(q*.17,h*.115-uTime*.095)+float(i)*5.7);
    float n2=noise3(vec3(q*.31+7.0,h*.21+uTime*.042)+float(i)*2.1);
    float billow=smoothstep(.29,.72,n*.72+n2*.36+.13*sin(h*.38+float(i)*2.2));
    float edge=body+(n-.5)*.36+(n2-.5)*.18;
    float envelope=smoothstep(.045,.48,edge);
    float fade=smoothstep(0.,2.0,h)*(1.-smoothstep(uMedia.y*.68,uMedia.y+8.,h));
    den+=body*envelope*(.22+1.26*billow)*fade;
  }
  return den*uExtra.x*1.30;
}

vec3 shadeTerrain(vec3 p,vec3 rd,vec3 sunDir){
  vec3 n=terrainNormal(p.xz);
  float sd=shoreDistance(p.xz),h=p.y;
  float inland=max(-sd,0.);
  float beach=1.-smoothstep(uIsland.z*.52,uIsland.z*1.20,inland);
  float wet=beach*(1.-smoothstep(.45,4.6,inland));
  float rock=rockMaskAt(p.xz);
  float slope=1.-n.y;
  float exposed=smoothstep(.20,.58,slope)*(1.-beach)*(1.-rock);
  rock=max(rock,smoothstep(.40,.74,slope)*smoothstep(5.0,11.0,h));
  float macro=fbm(p.xz*.12+vec2(3.5,-1.8));
  float grain=.68*fbm(p.xz*.54)+.32*noise2(p.xz*2.1);
  float drainage=smoothstep(.34,.58,ridged2(p.xz*.072+vec2(8.1,-2.4)));
  vec3 drySand=mix(vec3(.62,.54,.40),vec3(.88,.80,.62),sat(grain*.72+.18));
  vec3 wetSand=mix(vec3(.20,.185,.155),vec3(.34,.29,.22),grain*.34);
  vec3 scrub=mix(vec3(.10,.18,.075),vec3(.31,.36,.15),sat(macro*.92));
  scrub=mix(scrub,vec3(.22,.27,.11),drainage*.24);
  vec3 earth=mix(vec3(.25,.18,.115),vec3(.42,.31,.18),grain*.55);
  float rockMacro=fbm(p.xz*.21+vec2(-2.4,5.7));
  float rockMicro=noise2(p.xz*1.35+7.4);
  vec3 rockCol=mix(vec3(.205,.215,.195),vec3(.43,.39,.31),sat(rockMacro*.72+rockMicro*.22));
  float wetRock=rock*(1.-smoothstep(1.0,6.2,h))*(.45+.55*wet);
  rockCol=mix(rockCol,vec3(.075,.096,.098),wetRock*.72);
  rockCol=mix(vec3(.24),rockCol,sat(.55+uRocks.y*.34));
  vec3 col=mix(scrub,drySand,beach);
  col=mix(col,earth,exposed*.78);
  col=mix(col,wetSand,wet);
  col=mix(col,rockCol,rock);
  float ndl=max(dot(n,sunDir),0.);
  float skyFill=.32+.15*n.y;
  float diff=skyFill+.68*ndl;
  float back=max(dot(n,normalize(vec3(-sunDir.x,.28,-sunDir.z))),0.);
  col*=diff;
  col+=col*back*.08;
  float rim=pow(1.-max(dot(n,-rd),0.),3.0);
  col+=rim*mix(vec3(.025,.045,.05),vec3(.085,.115,.105),rock)*(.35+.65*ndl);
  col+=rock*vec3(.025,.030,.027)*(1.-ndl);
  float spec=pow(max(dot(reflect(-sunDir,n),-rd),0.),96.);
  col+=vec3(.32,.35,.33)*spec*(wet*.25+wetRock*.72);
  if(flag(64)){
    float fireGlow=0.;
    vec2 fs[4];fs[0]=vec2(-6.5,3.5);fs[1]=vec2(-1.,-1.8);fs[2]=vec2(4.8,3.2);fs[3]=vec2(1.8,8.);
    for(int i=0;i<4;i++){float d=length(p.xz-fs[i]);fireGlow+=exp(-d*d*.14)*uRocks.z;}
    col+=vec3(1.0,.22,.028)*fireGlow*(.78+.22*sin(uTime*7.3+p.x*1.7));
  }
  if(uMode==1)col=vec3(.48)*diff;
  if(uMode==3)col=mix(vec3(.13,.19,.20),vec3(.92,.34,.07),sat(rock+slope));
  return col;
}

vec3 shadeWater(vec3 p,vec3 rd,vec3 sunDir,vec3 sky){
  vec3 n=waterNormal(p.xz);
  float depth=max(.04,p.y-terrainHeight(p.xz));
  float shallow=exp(-depth*.17*uOptics.x);
  float fres=pow(1.-max(dot(n,-rd),0.),4.6);
  vec3 refl=skyColor(reflect(rd,n),sunDir);
  vec3 deep=vec3(.008,.105,.165);
  vec3 shelf=vec3(.025,.30,.35);
  vec3 lagoon=vec3(.105,.47,.43);
  vec3 seabed=vec3(.48,.39,.25);
  vec3 body=mix(deep,shelf,sat(shallow*.86));
  body=mix(body,lagoon,pow(shallow,1.8)*.54);
  body=mix(body,seabed,pow(shallow,3.2)*.19*uOptics.x);
  float spec=pow(max(dot(reflect(-sunDir,n),-rd),0.),210.);
  float broadSpec=pow(max(dot(reflect(-sunDir,n),-rd),0.),36.);
  float foam=foamField(p.xz);
  vec3 col=mix(body,refl,.12+.69*fres);
  col+=vec3(1.,.78,.48)*spec*2.25+vec3(.35,.54,.58)*broadSpec*.15;
  float foamBody=smoothstep(.095,.72,foam);
  float foamThread=smoothstep(.018,.24,foam)*(1.-smoothstep(.64,.96,foam));
  float foamWarm=.5+.5*noise2(p.xz*.17+vec2(uTime*.012,-uTime*.006));
  vec3 foamCol=mix(vec3(.77,.89,.88),vec3(.965,.945,.87),foamWarm*.42);
  col=mix(col,foamCol,foamBody*.76);
  col+=foamThread*vec3(.16,.22,.20)*(.35+.65*max(dot(n,sunDir),0.));
  float steep=smoothstep(.075,.34,1.-n.y)*(1.-foamBody);
  col+=steep*vec3(.035,.16,.19)*(.28+.72*shallow);
  if(flag(64)){
    vec2 fs[4];fs[0]=vec2(-6.5,3.5);fs[1]=vec2(-1.,-1.8);fs[2]=vec2(4.8,3.2);fs[3]=vec2(1.8,8.);
    float glow=0.;for(int i=0;i<4;i++){float d=length(p.xz-fs[i]);glow+=exp(-d*.14)/(1.+depth*.11);}
    col+=vec3(1.,.17,.018)*glow*uRocks.z*.14*(.58+.42*max(dot(n,normalize(vec3(-.4,.8,-.2))),0.));
  }
  if(uMode==2)col=mix(vec3(.05,.78,.68),vec3(.008,.035,.17),sat(depth/18.))+foam*vec3(1.,.22,.015);
  return col;
}

void main(){
  vec2 q=(gl_FragCoord.xy-.5*uResolution)/uResolution.y;
  vec3 rd=normalize(uCamForward+q.x*uCamRight*1.78+q.y*uCamUp*1.78);
  vec3 ro=uCamPos;
  vec3 sunDir=normalize(vec3(cos(uOptics.y)*.72,.64,sin(uOptics.y)*.72));
  vec3 sky=skyColor(rd,sunDir);
  float tw=traceWater(ro,rd);
  float maxTerrain=tw<9e4?tw:720.;
  float tt=traceTerrain(ro,rd,maxTerrain);
  float tHit=min(tt,tw);
  vec3 col=sky;
  if(tHit<9e4){
    vec3 p=ro+rd*tHit;
    bool waterHit=tw<tt;
    col=waterHit?shadeWater(p,rd,sunDir,sky):shadeTerrain(p,rd,sunDir);
    float fog=sat((tHit-120.)/430.);
    col=mix(col,sky,fog*fog*.76);
  }
  vec3 oc=ro-vec3(0.,16.,0.);
  float qb=dot(oc,rd);
  float qc=dot(oc,oc)-112.*112.;
  float disc=qb*qb-qc;
  float mediaStart=0.;
  float mediaEnd=0.;
  if(disc>0.){
    float root=sqrt(disc);
    mediaStart=max(.5,-qb-root);
    mediaEnd=min(tHit,-qb+root);
  }
  float mediaSpan=max(0.,mediaEnd-mediaStart);
  float trans=1.;
  vec3 mediaCol=vec3(0.);
  float jitter=hash21(gl_FragCoord.xy+fract(uTime)*31.);
  const int STEPS=22;
  for(int i=0;i<STEPS;i++){
    if(mediaSpan<=0.)break;
    float fi=(float(i)+jitter)/float(STEPS);
    float t=mediaStart+fi*mediaSpan;
    vec3 p=ro+rd*t;
    float curl=curlDensity(p);
    float spray=sprayDensity(p);
    float smoke=smokeDensityAt(p);
    float dens=curl*.22+spray*.085+smoke*.084;
    if(dens>.001){
      float stepLen=mediaSpan/float(STEPS);
      float a=1.-exp(-dens*stepLen);
      vec3 curlC=mix(vec3(.19,.61,.70),vec3(.84,.96,.95),sat(curl*.74));vec3 sprayC=vec3(.76,.91,.93);vec3 c=(curl*curlC+spray*sprayC)/(curl+spray+smoke+.001);
      vec3 smokeC=mix(vec3(.026,.032,.032),vec3(.285,.30,.30),sat(p.y/uMedia.y));
      c=mix(c,smokeC,smoke/(curl+spray+smoke+.001));
      if(flag(64)&&p.y<5.)c+=vec3(1.,.18,.015)*uOptics.z*.35;
      mediaCol+=trans*c*a;
      trans*=1.-a;
      if(trans<.03)break;
    }
  }
  col=mediaCol+col*trans;
  float vignette=1.-.18*dot(q,q);
  col*=vignette;
  col=1.-exp(-col*uOptics.z);
  col=pow(max(col,0.),vec3(.94));
  float contrast=1.03+.15*uRocks.y;
  col=(col-.5)*contrast+.5;
  fragColor=vec4(clamp(col,0.,1.),1.);
}