#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uRes,uSurface;
uniform vec3 uLoop,uOccupancySize;uniform float uFastEmpty,uMicroFilter,uSolarDay;uniform vec4 uCyclone;
uniform sampler3D uOccupancy;uniform vec4 uLightning;
uniform sampler3D uDistance;uniform float uSkipEmpty;uniform sampler2D uIrisLUT,uBoltData;uniform vec4 uIris,uFlashNodes[4];uniform int uBoltCount;
float sampleFootprint=0.;
vec3 periodicSignal(){float t=6.28318530718*fract(uLoop.y);return vec3(cos(t)-1.,sin(t),sin(2.*t));}
vec3 cycleWarp(vec3 q,float t){return vec3(sin(q.z*.74+t)*cos(q.y*.61-2.*t),sin(q.x*.68+2.*t)*cos(q.z*.53+t),sin(q.y*.59-t)*cos(q.x*.67+2.*t));}

uniform vec3 uWindDirection;uniform vec4 uFlow;uniform float uEvolution,uTemporal;
uniform sampler3D uMacro,uOld,uNoise,uShadow,uOldShadow;
uniform vec3 uCamera,uTarget,uSun,uSunColor,uMoon,uWind,uMin,uMax,uLo[9],uHi[9];
uniform vec4 uOpt,uWeather,uEffects,uLight;
uniform float uBlend,uTime,uDay,uExposure,uCloudBase,uCloudTop,uFrame,uShear;
uniform int uSteps,uGroups,uKind;
layout(location=0) out vec4 fragColor;
layout(location=1) out vec4 fragInfo;
float sat(float x){return clamp(x,0.,1.);}
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float nv(vec3 p){return texture(uNoise,p/8.).r;}
float fb(vec3 p){return .57*nv(p)+.28*nv(p*2.03+vec3(11.7,3.4,5.2))+.15*nv(p*4.11-vec3(3.2,11.7,8.9));}
vec2 bounds(vec3 ro,vec3 rd,vec3 lo,vec3 hi){vec3 d=vec3(rd.x>=0.?max(rd.x,1e-6):min(rd.x,-1e-6),rd.y>=0.?max(rd.y,1e-6):min(rd.y,-1e-6),rd.z>=0.?max(rd.z,1e-6):min(rd.z,-1e-6));vec3 a=(lo-ro)/d,b=(hi-ro)/d,mn=min(a,b),mx=max(a,b);return vec2(max(mn.x,max(mn.y,mn.z)),min(mx.x,min(mx.y,mx.z)));}
float mountain(vec2 p){if(uEffects.x<.5)return 0.;vec2 a=(p-vec2(-6.,-2.))/vec2(3.2,5.),b=(p-vec2(5.,-6.))/vec2(4.,3.),c=(p-vec2(0.,-9.))/vec2(6.,4.);return 1.15*exp(-dot(a,a))+1.4*exp(-dot(b,b))+.7*exp(-dot(c,c));}
vec3 planePos(){return vec3(mod(uTime*.25+9.,30.)-15.,2.7,-.35);}
float shape(vec3 p){vec3 uv=(p-uMin)/(uMax-uMin);if(any(lessThan(uv,vec3(0)))||any(greaterThan(uv,vec3(1))))return 0.;float b=texture(uMacro,uv).r;if(uBlend<.999)b=mix(texture(uOld,uv).r,b,uBlend);return b;}
vec3 flowPos(vec3 p){vec3 q=p-uWind;if(uCyclone.x>.5){float r=length(q.xz),gate=smoothstep(uCyclone.z*.58,uCyclone.z*1.18,r)*(1.-smoothstep(11.8,15.2,r)),ang=gate*(uCyclone.y*uTime*.035+uCyclone.w*log(1.+r)*.78);float ca=cos(ang),sa=sin(ang);q.xz=mat2(ca,-sa,sa,ca)*q.xz;}float h=sat((p.y-uCloudBase)/max(uCloudTop-uCloudBase,.5));q-=uWindDirection*uShear*h*h*.9;float turbulence=uFlow.w*min(uFlow.x/30.,2.)*.16;vec3 curl=vec3(sin(q.z*.9+uEvolution*.10)*cos(q.y*.6),sin(q.x*.8-uEvolution*.07)*cos(q.z*.5),sin(q.y*.7+uEvolution*.08)*cos(q.x*.6));if(uLoop.x>.5){float t=6.28318530718*fract(uLoop.y);vec3 cy=cycleWarp(q,t),c0=cycleWarp(q,0.);q+=(cy-c0)*uLoop.z*(.34+turbulence*.65);}else q+=curl*turbulence;if(uEffects.x>.5){float m=mountain(p.xz),w=exp(-pow((p.y-m-.7)/1.6,2.));q.y-=m*w*.24*uWeather.w;q.x+=m*w*.10;}if(uEffects.y>.5){vec3 a=p-planePos();float wake=step(a.x,0.)*sat(-a.x/2.)*exp(min(a.x*.18,0.));q.yz+=vec2(-a.z,a.y)*wake*exp(-dot(a.yz,a.yz)*4.)*.45;}return q;}
// Conservative occupied-cell distance divided by a global bound on flowPos.
float emptyTravel(vec3 p){if(uSkipEmpty<.5||uBlend<.999||uEffects.x>.5||uEffects.y>.5)return 0.;vec3 q=flowPos(p),uv=(q-uMin)/(uMax-uMin);if(any(lessThan(uv,vec3(0)))||any(greaterThan(uv,vec3(1))))return 0.;ivec3 cell=ivec3(clamp(floor(uv*uOccupancySize),vec3(0),uOccupancySize-1.));float d=floor(texelFetch(uDistance,cell,0).r*255.+.5);if(d<2.)return 0.;vec3 spacing=(uMax-uMin)/uOccupancySize;float lower=max(0.,d-1.)*min(spacing.x,min(spacing.y,spacing.z));float turb=uFlow.w*min(uFlow.x/30.,2.)*.16,amp=uLoop.z*(.34+turb*.65),L=(1.+1.8*abs(uShear)/max(uCloudTop-uCloudBase,.5))*(uLoop.x>.5?1.+4.*amp:1.+2.*turb);return max(0.,lower-.0002)/max(L*1.02,1.);}
float densityAt(vec3 p,bool detail){vec3 q=flowPos(p);float b;
if(uFastEmpty>.5&&uBlend>.999){vec3 uv=(q-uMin)/(uMax-uMin);if(any(lessThan(uv,vec3(0)))||any(greaterThan(uv,vec3(1))))return 0.;ivec3 cell=ivec3(clamp(floor(uv*uOccupancySize),vec3(0),uOccupancySize-1.));if(texelFetch(uOccupancy,cell,0).r<.5)return 0.;}
if(!detail){b=shape(q);if(b<.002)return 0.;float n=fb(q*1.4);return smoothstep(.075,.39,b+(n-.5)*.23)*uOpt.x*.75;}
vec3 w=vec3(nv(q*1.15+3.),nv(q*1.11+17.),nv(q*1.21+vec3(31.,7.,19.)))-.5;vec3 wm=vec3(nv(q*3.9+9.),nv(q*4.1+23.),nv(q*3.7+37.))-.5;q+=w*(.55+.25*uOpt.y)+wm*(.18+.12*uOpt.y);b=shape(q);if(b<.002)return 0.;
vec3 evolve=uLoop.x>.5?periodicSignal()*vec3(.52,.38,.23)*uLoop.z:vec3(0.,-uEvolution*.004,0.);
float broad=fb(q*2.2+evolve),billow=.58*texture(uNoise,q*3.8/8.+.17).g+.28*texture(uNoise,q*8.2/8.+.53).g+.14*texture(uNoise,q*16.4/8.+.31).g,fine=mix(.5,fb(q*19.7+3.),mix(1.,1.-smoothstep(.04,.16,sampleFootprint),uMicroFilter)),edge=1.-smoothstep(.22,.76,b);
float d=b+(broad-.5)*.94-(1.-billow)*(.13+.15*uOpt.y)*edge-(1.-fine)*.065*uOpt.y*edge;
d=smoothstep(.012,.205,d)*mix(.65,1.18,broad)*uOpt.x;
if(uEffects.y>.5){vec3 a=p-planePos();float wake=step(a.x,0.)*exp(min(a.x*.18,0.))*exp(-dot(a.yz,a.yz)*14.);d*=1.-wake*.55;}return max(d,0.);}
float phaseHG(float g,float mu){return (1.-g*g)/pow(max(1.+g*g-2.*g*mu,.002),1.5);}
vec3 sky(vec3 d){float h=max(d.y,0.),mu=dot(d,uSun),sunUp=uSun.y,tw=1.-smoothstep(.025,.35,sunUp);float mass=1./(h+.10),haze=uLight.w;
vec3 zen=mix(vec3(.0018,.0035,.012),vec3(.055,.185,.48),uDay),hor=mix(vec3(.010,.017,.034),vec3(.38,.56,.76),uDay);vec3 col=mix(hor,zen,pow(h,.40));
float towards=.15+.85*pow(max(mu,0.),2.);col+=vec3(.76,.19,.038)*tw*exp(-h*7.)*towards*smoothstep(-.12,.03,sunUp);
float rayleigh=.75*(1.+mu*mu),mie=min(phaseHG(.78,mu),28.);col+=vec3(.026,.045,.091)*rayleigh*uDay;col+=uSunColor*mie*(.004+.014*haze)*uDay;
float aerosol=1.-exp(-haze*mass*.10);col=mix(col,vec3(.47,.55,.65)*uDay+vec3(.006,.009,.015),aerosol*.32);
col+=uSunColor*smoothstep(.999963,.999976,mu)*22.*smoothstep(-.012,.01,sunUp);
col+=vec3(.22,.32,.52)*smoothstep(.999970,.999985,dot(d,uMoon))*(1.-uDay)*3.;float stars=pow(hash(floor(d*950.)),340.)*smoothstep(.12,.5,h)*(1.-uDay);return max(col+stars*.55,vec3(.0002));}
vec2 shadowAt(vec3 p){vec3 q=flowPos(p),uv=(q-uMin)/(uMax-uMin);if(any(lessThan(uv,vec3(0)))||any(greaterThan(uv,vec3(1))))return vec2(0);vec2 s=texture(uShadow,uv).rg;if(uBlend<.999)s=mix(texture(uOldShadow,uv).rg,s,uBlend);return s*uOpt.x;}
vec3 irisTint(vec3 p,vec3 rd,float tau,float d){if(uIris.x<=0.||uSolarDay<=0.)return vec3(1);float angle=acos(clamp(dot(rd,uSun),-1.,1.)),gate=(1.-smoothstep(radians(24.),radians(39.),angle))*smoothstep(radians(.4),radians(1.7),angle);if(gate<=0.)return vec3(1);
vec3 q=flowPos(p);float r=clamp(uIris.y*(1.+.38*(nv(q*.66+uIris.w*.003)-.5)),1.,16.);vec3 rgb=texture(uIrisLUT,vec2(angle/radians(40.),(r-1.)/15.)).rgb;float uniformity=1.-uIris.z*.94,thin=exp(-tau*.60)*(1.-smoothstep(.60,1.4,d));float strength=clamp(uIris.x*gate*thin*uniformity,0.,.94);return mix(vec3(1),rgb,strength);}
vec3 incident(vec3 p,vec3 rd,float d){vec3 l=uSun.y>=0.?uSun:uMoon;vec2 sh=shadowAt(p);float tau=max(0.,sh.x*1.35-.19*d)+densityAt(p+l*.07,true)*.12+densityAt(p+l*.20,true)*.25,mu=dot(rd,uSun),mm=dot(rd,uMoon),h=sat((p.y-uCloudBase)/max(uCloudTop-uCloudBase,.5));
float ph=.78*min(phaseHG(.68,mu),16.)+.22*phaseHG(-.18,mu),pm=.78*min(phaseHG(.68,mm),16.)+.22*phaseHG(-.18,mm);
float direct=exp(-tau),m1=.23*exp(-tau*.24),m2=.075*exp(-tau*.064),ao=exp(-sh.y*.8);
vec3 ambient=mix(vec3(.048,.072,.12),sky(vec3(0,1,0))*.55,sqrt(h))*(.32+.68*ao)*uLight.y*(.06+.94*uDay);
vec3 sunlight=uSunColor*uLight.x*smoothstep(-.01,.04,uSun.y),moonlight=vec3(.055,.085,.15)*uLight.x*(1.-uDay)*smoothstep(-.01,.04,uMoon.y);
float powder=mix(.75,1.,1.-exp(-d*4.));
vec3 tint=irisTint(p,rd,tau,d);vec3 L=ambient+powder*(sunlight*(tint*direct*(.36+.58*ph)+uLight.z*(m1*(.48+.09*phaseHG(.30,mu))+m2*.62))+moonlight*(direct*(.27+.46*pm)+uLight.z*(m1*(.48+.09*phaseHG(.30,mm))+m2*.62)));
L+=sunlight*direct*pow(sat(mu),7.)*(1.-exp(-d*3.))*uSurface.x*.08;L+=vec3(.035,.036,.027)*(1.-h)*uDay*uLight.y*uSurface.y;if(uLightning.w>.001){for(int k=0;k<4;k++){vec3 delta=p-uWind-uFlashNodes[k].xyz;float falloff=exp(-length(delta)*.85)/(1.+dot(delta,delta)*.35);L+=vec3(1.25,1.40,1.65)*uLightning.w*falloff*uFlashNodes[k].w;}}return L;}
float sceneGround(vec3 ro,vec3 rd){if(rd.y>=-.0001)return 1e4;float t=max(0.,ro.y/-rd.y);if(uEffects.x<.5)return t;t=0.;for(int k=0;k<40;k++){vec3 p=ro+rd*t;float d=p.y-mountain(p.xz);if(d<.008)return t;t+=max(.035,d*.55);if(t>100.)break;}return 1e4;}
float boxHit(vec3 ro,vec3 rd,vec3 c,vec3 r){vec2 b=bounds(ro-c,rd,-r,r);return b.x<b.y&&b.y>0.?max(b.x,0.):1e4;}
float airplane(vec3 ro,vec3 rd){if(uEffects.y<.5)return 1e4;vec3 p=ro-planePos();float t=boxHit(p,rd,vec3(0),vec3(.22,.027,.029));t=min(t,boxHit(p,rd,vec3(-.02,0,0),vec3(.050,.011,.22)));t=min(t,boxHit(p,rd,vec3(-.165,.008,0),vec3(.04,.01,.09)));return min(t,boxHit(p,rd,vec3(-.16,.036,0),vec3(.036,.037,.008)));}
vec3 groundColor(vec3 ro,vec3 rd,float t){vec3 p=ro+rd*t;float n=fb(vec3(p.xz*.50,3.)),h=mountain(p.xz);vec3 normal=normalize(vec3(h-mountain(p.xz+vec2(.02,0)),.02,h-mountain(p.xz+vec2(0,.02))));vec3 gc=mix(vec3(.065,.095,.074),vec3(.105,.135,.090),n);gc=mix(gc,vec3(.67,.75,.81),uWeather.z*.85);float li=max(dot(normal,uSun),0.),shadow=shadowAt(p+vec3(0,.03,0)).x;gc*=.20+.85*li*exp(-shadow)*uLight.x;gc*=1.-uWeather.x*.22;vec3 hv=normalize(uSun-rd);gc+=uSunColor*pow(max(dot(normal,hv),0.),90.)*uWeather.x*.13;float haz=1.-exp(-t*(.018+uWeather.y*.05+uLight.w*.022));return mix(gc*(.07+.93*uDay),sky(normalize(vec3(rd.x,.025,rd.z))),haz);}
vec3 bow(vec3 rd,float tr){if(uEffects.z<.5||uSun.y<0.||uSun.y>.72||uWeather.x<.05)return vec3(0);float a=acos(clamp(dot(rd,-uSun),-1.,1.));vec3 primary=exp(-pow((vec3(a)-radians(vec3(42.4,41.4,40.5)))/.009,vec3(2.))),secondary=exp(-pow((vec3(a)-radians(vec3(50.5,52.,53.5)))/.014,vec3(2.)))*.18;return (primary+secondary)*uWeather.x*.8*tr*smoothstep(-.01,.12,rd.y)*uDay;}

vec4 boltRadiance(vec3 ro,vec3 rd,float opaque){float best=0.,distance=1e4;if(uLightning.w<.002)return vec4(0,0,0,1e4);vec2 region=bounds(ro,rd,uLightning.xyz+uWind-vec3(4.8,6.2,4.),uLightning.xyz+uWind+vec3(4.8,2.,4.));if(region.x>=region.y||region.y<0.)return vec4(0,0,0,1e4);
for(int k=0;k<160;k++){if(k>=uBoltCount)break;vec4 A=texelFetch(uBoltData,ivec2(k*2,0),0),B=texelFetch(uBoltData,ivec2(k*2+1,0),0);vec3 a=A.xyz+uWind,b=B.xyz+uWind,v=b-a,o=ro-a;float vv=dot(v,v),rv=dot(rd,v),s=clamp((dot(o,v)-rv*dot(o,rd))/max(vv-rv*rv,1e-7),0.,1.);vec3 p=a+s*v;float t=dot(p-ro,rd);if(t<=0.||t>=opaque)continue;float d=length(ro+rd*t-p),pixel=t*.96/uRes.y,w=max(.0001,pixel*.46),core=exp(-d*d/(w*w)),bloom=exp(-d*d/(w*w*12.))*.012,value=(core+bloom)*A.w; if(value>best){best=value;distance=t;}}
return vec4(vec3(5.0,5.35,5.9)*best*uLightning.w,distance);}

void main(){vec2 xy=(gl_FragCoord.xy*2.-uRes)/uRes.y;vec3 fw=normalize(uTarget-uCamera),right=normalize(cross(fw,vec3(0,1,0))),up=cross(right,fw),rd=normalize(fw+(right*xy.x+up*xy.y)*.48),ro=uCamera;float gt=sceneGround(ro,rd),pt=airplane(ro,rd),opaque=min(gt,pt);vec3 bg=gt<8000.?groundColor(ro,rd,gt):sky(rd);if(pt<gt)bg=vec3(.23,.27,.29)*(.1+.9*uDay);
vec2 seg[9];int ns=0;for(int k=0;k<9;k++){if(k>=uGroups)break;vec2 b=bounds(ro,rd,uLo[k]+uWind,uHi[k]+uWind);b=vec2(max(b.x,0.),min(b.y,opaque));if(b.y>b.x){seg[ns]=b;ns++;}}
for(int k=1;k<9;k++){if(k>=ns)break;vec2 s=seg[k];int j=k-1;for(int z=0;z<9;z++){if(j<0)break;if(seg[j].x<=s.x)break;seg[j+1]=seg[j];j--;}seg[j+1]=s;}
int nc=0;vec2 merged[9];for(int k=0;k<9;k++){if(k>=ns)break;if(nc==0){merged[0]=seg[k];nc=1;}else if(seg[k].x<=merged[nc-1].y)merged[nc-1].y=max(merged[nc-1].y,seg[k].y);else{merged[nc]=seg[k];nc++;}}
float total=0.;for(int k=0;k<9;k++){if(k>=nc)break;total+=merged[k].y-merged[k].x;}float tr=1.,moment=0.,boltTr=1.;bool boltCrossed=false;vec3 light=vec3(0);vec4 bolt=boltRadiance(ro,rd,opaque);
if(nc>0){float ds=total/float(uSteps),jitter=uTemporal>.5?fract(.754877666*gl_FragCoord.x+.569840296*gl_FragCoord.y+uFrame*.618033989):.5;int span=0;float cursor=0.,edge=merged[0].x;
for(int j=0;j<528;j++){if(span>=nc||tr<.004)break;edge=merged[span].x+cursor*ds;float len=min(ds,merged[span].y-edge);if(len<=1e-6){span++;cursor=0.;if(span<nc)edge=merged[span].x;continue;}float t=edge+len*(.2+.6*jitter);if(!boltCrossed&&t>=bolt.a){boltTr=tr;boltCrossed=true;}vec3 p=ro+rd*t;float safe=emptyTravel(p),jump=min(floor(safe/max(ds,1e-5)),floor((merged[span].y-edge)/max(ds,1e-5)));if(jump>=2.){cursor+=jump;continue;}sampleFootprint=max(t*.96/uRes.y,len*.35);float d=densityAt(p,true);if(d>.001){float alpha=1.-exp(-d*len*2.4);vec3 L=incident(p,rd,d);L=mix(L,sky(rd),1.-exp(-t*.006*(.6+uLight.w)));moment+=tr*alpha*t;light+=tr*alpha*L;tr*=1.-alpha;}cursor+=1.;edge+=len;if(edge>=merged[span].y-1e-5){span++;cursor=0.;if(span<nc)edge=merged[span].x;}}}

if(!boltCrossed)boltTr=tr;vec3 col=light+tr*bg+bow(rd,tr)+bolt.rgb*boltTr;if(uWeather.y>.03){float len=min(opaque,70.),k=rd.y/1.1,integral=abs(k)<.001?len:(1.-exp(clamp(-k*len,-30.,12.)))/k,tau=min(3.,uWeather.y*.06*exp(-ro.y/1.1)*integral);col=mix(col,sky(normalize(vec3(rd.x,.04,rd.z))),1.-exp(-tau));}
vec2 uv=gl_FragCoord.xy/uRes;float rain=0.;if(uWeather.x>.03){vec2 q=uv*vec2(260.,36.);q.x+=uTime*.4+q.y*dot(uWindDirection,right)*min(uFlow.x/60.,1.)*.38;vec2 cell=floor(q),f=fract(q+vec2(0,uTime*11.));rain=pow(1.-abs(f.x-.5)*2.,24.)*(1.-smoothstep(.32,.96,f.y))*step(.62,hash(vec3(cell,12.)))*uWeather.x*.13;}
if(uWeather.z>.05){vec2 q=uv*vec2(80.,42.)+vec2(sin(uTime*.3),uTime*1.4),cell=floor(q),f=fract(q)-.5;rain=(1.-smoothstep(.015,.065,length(f)))*step(.72,hash(vec3(cell,4.)))*uWeather.z*.32;}
col=mix(col,vec3(.8,.88,.96),rain);float depth=tr<.985?moment/max(1.-tr,.001):min(opaque,1000.);fragColor=vec4(max(col,0.),tr);fragInfo=vec4(depth,1.-tr,0.,1.);}
