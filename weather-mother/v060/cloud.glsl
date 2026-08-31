#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uRes;
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
vec3 flowPos(vec3 p){vec3 q=p-uWind;float h=sat((p.y-uCloudBase)/max(uCloudTop-uCloudBase,.5));q.x-=uShear*h*h*.9;if(uEffects.x>.5){float m=mountain(p.xz),w=exp(-pow((p.y-m-.7)/1.6,2.));q.y-=m*w*.24*uWeather.w;q.x+=m*w*.10;}if(uEffects.y>.5){vec3 a=p-planePos();float wake=step(a.x,0.)*sat(-a.x/2.)*exp(min(a.x*.18,0.));q.yz+=vec2(-a.z,a.y)*wake*exp(-dot(a.yz,a.yz)*4.)*.45;}return q;}
float densityAt(vec3 p,bool detail){vec3 q=flowPos(p);float b=shape(q);if(b<.002)return 0.;if(!detail){float n=fb(q*1.4);return smoothstep(.075,.39,b+(n-.5)*.23)*uOpt.x*.75;}
vec3 w=vec3(nv(q*1.15+3.),nv(q*1.11+17.),nv(q*1.21+vec3(31.,7.,19.)))-.5;q+=w*(.33+.19*uOpt.y);b=shape(q);if(b<.002)return 0.;
float broad=fb(q*1.8+vec3(0.,-uTime*.004,0.)),billow=texture(uNoise,q*5.1/8.+.17).g,fine=fb(q*15.7+3.),edge=1.-smoothstep(.20,.66,b);
float d=b+(broad-.5)*.48-(1.-billow)*(.075+.085*uOpt.y)*edge-(1.-fine)*.055*uOpt.y*edge;
d=smoothstep(.018,.185,d)*mix(.86,1.12,broad)*uOpt.x;
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
vec3 incident(vec3 p,vec3 rd,float d){vec3 l=uSun.y>=0.?uSun:uMoon;vec2 sh=shadowAt(p);float tau=max(0.,sh.x*1.45-.16*d)+densityAt(p+l*.12,true)*.28,mu=dot(rd,uSun),mm=dot(rd,uMoon),h=sat((p.y-uCloudBase)/max(uCloudTop-uCloudBase,.5));
float ph=.78*min(phaseHG(.68,mu),16.)+.22*phaseHG(-.18,mu),pm=.78*min(phaseHG(.68,mm),16.)+.22*phaseHG(-.18,mm);
float direct=exp(-tau),m1=.22*exp(-tau*.28),m2=.075*exp(-tau*.075),ao=exp(-sh.y*.8);
vec3 ambient=mix(vec3(.048,.072,.12),sky(vec3(0,1,0))*.55,sqrt(h))*(.32+.68*ao)*uLight.y*(.06+.94*uDay);
vec3 sunlight=uSunColor*uLight.x*smoothstep(-.01,.04,uSun.y),moonlight=vec3(.055,.085,.15)*uLight.x*(1.-uDay)*smoothstep(-.01,.04,uMoon.y);
float powder=mix(.75,1.,1.-exp(-d*4.));
vec3 L=ambient+powder*(sunlight*(direct*(.27+.46*ph)+uLight.z*(m1*(.48+.09*phaseHG(.30,mu))+m2*.62))+moonlight*(direct*(.27+.46*pm)+uLight.z*(m1*(.48+.09*phaseHG(.30,mm))+m2*.62)));
L+=vec3(.035,.036,.027)*(1.-h)*uDay*uLight.y;float flash=uEffects.w*exp(-pow(fract(uTime*.11)-.30,2.)/.00006);L+=vec3(.6,.76,1.2)*flash*exp(-dot(p-vec3(.7,4.8,0.),p-vec3(.7,4.8,0.))*.09);return L;}
float sceneGround(vec3 ro,vec3 rd){if(rd.y>=-.0001)return 1e4;float t=max(0.,ro.y/-rd.y);if(uEffects.x<.5)return t;t=0.;for(int k=0;k<40;k++){vec3 p=ro+rd*t;float d=p.y-mountain(p.xz);if(d<.008)return t;t+=max(.035,d*.55);if(t>100.)break;}return 1e4;}
float boxHit(vec3 ro,vec3 rd,vec3 c,vec3 r){vec2 b=bounds(ro-c,rd,-r,r);return b.x<b.y&&b.y>0.?max(b.x,0.):1e4;}
float airplane(vec3 ro,vec3 rd){if(uEffects.y<.5)return 1e4;vec3 p=ro-planePos();float t=boxHit(p,rd,vec3(0),vec3(.22,.027,.029));t=min(t,boxHit(p,rd,vec3(-.02,0,0),vec3(.050,.011,.22)));t=min(t,boxHit(p,rd,vec3(-.165,.008,0),vec3(.04,.01,.09)));return min(t,boxHit(p,rd,vec3(-.16,.036,0),vec3(.036,.037,.008)));}
vec3 groundColor(vec3 ro,vec3 rd,float t){vec3 p=ro+rd*t;float n=fb(vec3(p.xz*.50,3.)),h=mountain(p.xz);vec3 normal=normalize(vec3(h-mountain(p.xz+vec2(.02,0)),.02,h-mountain(p.xz+vec2(0,.02))));vec3 gc=mix(vec3(.065,.095,.074),vec3(.105,.135,.090),n);gc=mix(gc,vec3(.67,.75,.81),uWeather.z*.85);float li=max(dot(normal,uSun),0.),shadow=shadowAt(p+vec3(0,.03,0)).x;gc*=.20+.85*li*exp(-shadow)*uLight.x;gc*=1.-uWeather.x*.22;vec3 hv=normalize(uSun-rd);gc+=uSunColor*pow(max(dot(normal,hv),0.),90.)*uWeather.x*.13;float haz=1.-exp(-t*(.018+uWeather.y*.05+uLight.w*.022));return mix(gc*(.07+.93*uDay),sky(normalize(vec3(rd.x,.025,rd.z))),haz);}
vec3 bow(vec3 rd,float tr){if(uEffects.z<.5||uSun.y<0.||uSun.y>.72||uWeather.x<.05)return vec3(0);float a=acos(clamp(dot(rd,-uSun),-1.,1.));vec3 primary=exp(-pow((vec3(a)-radians(vec3(42.4,41.4,40.5)))/.009,vec3(2.))),secondary=exp(-pow((vec3(a)-radians(vec3(50.5,52.,53.5)))/.014,vec3(2.)))*.18;return (primary+secondary)*uWeather.x*.8*tr*smoothstep(-.01,.12,rd.y)*uDay;}
void main(){vec2 xy=(gl_FragCoord.xy*2.-uRes)/uRes.y;vec3 fw=normalize(uTarget-uCamera),right=normalize(cross(fw,vec3(0,1,0))),up=cross(right,fw),rd=normalize(fw+(right*xy.x+up*xy.y)*.48),ro=uCamera;float gt=sceneGround(ro,rd),pt=airplane(ro,rd),opaque=min(gt,pt);vec3 bg=gt<8000.?groundColor(ro,rd,gt):sky(rd);if(pt<gt)bg=vec3(.23,.27,.29)*(.1+.9*uDay);
vec2 seg[9];int ns=0;for(int k=0;k<9;k++){if(k>=uGroups)break;vec2 b=bounds(ro,rd,uLo[k]+uWind,uHi[k]+uWind);b=vec2(max(b.x,0.),min(b.y,opaque));if(b.y>b.x){seg[ns]=b;ns++;}}
for(int k=1;k<9;k++){if(k>=ns)break;vec2 s=seg[k];int j=k-1;for(int z=0;z<9;z++){if(j<0)break;if(seg[j].x<=s.x)break;seg[j+1]=seg[j];j--;}seg[j+1]=s;}
int nc=0;vec2 merged[9];for(int k=0;k<9;k++){if(k>=ns)break;if(nc==0){merged[0]=seg[k];nc=1;}else if(seg[k].x<=merged[nc-1].y)merged[nc-1].y=max(merged[nc-1].y,seg[k].y);else{merged[nc]=seg[k];nc++;}}
float total=0.;for(int k=0;k<9;k++){if(k>=nc)break;total+=merged[k].y-merged[k].x;}float tr=1.,moment=0.;vec3 light=vec3(0);
if(nc>0){float ds=total/float(uSteps);float jitter=fract(.754877666*gl_FragCoord.x+.569840296*gl_FragCoord.y+uFrame*.618033989);float t=merged[0].x+ds*jitter;int span=0;
for(int j=0;j<224;j++){if(j>=uSteps||span>=nc||tr<.005)break;for(int k=0;k<9;k++){if(span>=nc)break;if(t<=merged[span].y)break;float extra=t-merged[span].y;span++;if(span<nc)t=merged[span].x+extra;}if(span>=nc)break;vec3 p=ro+rd*t;float d=densityAt(p,true);if(d>.001){float alpha=1.-exp(-d*ds*2.4);vec3 L=incident(p,rd,d);L=mix(L,sky(rd),1.-exp(-t*.006*(.6+uLight.w)));moment+=tr*alpha*t;light+=tr*alpha*L;tr*=1.-alpha;}t+=ds;}}
vec3 col=light+tr*bg+bow(rd,tr);if(uWeather.y>.03){float len=min(opaque,70.),k=rd.y/1.1,integral=abs(k)<.001?len:(1.-exp(clamp(-k*len,-30.,12.)))/k,tau=min(3.,uWeather.y*.06*exp(-ro.y/1.1)*integral);col=mix(col,sky(normalize(vec3(rd.x,.04,rd.z))),1.-exp(-tau));}
vec2 uv=gl_FragCoord.xy/uRes;float rain=0.;if(uWeather.x>.03){vec2 q=uv*vec2(260.,36.);q.x+=uTime*.4+q.y*.16;vec2 cell=floor(q),f=fract(q+vec2(0,uTime*11.));rain=pow(1.-abs(f.x-.5)*2.,24.)*(1.-smoothstep(.32,.96,f.y))*step(.62,hash(vec3(cell,12.)))*uWeather.x*.13;}
if(uWeather.z>.05){vec2 q=uv*vec2(80.,42.)+vec2(sin(uTime*.3),uTime*1.4),cell=floor(q),f=fract(q)-.5;rain=(1.-smoothstep(.015,.065,length(f)))*step(.72,hash(vec3(cell,4.)))*uWeather.z*.32;}
col=mix(col,vec3(.8,.88,.96),rain);float depth=tr<.985?moment/max(1.-tr,.001):min(opaque,1000.);fragColor=vec4(max(col,0.),tr);fragInfo=vec4(depth,1.-tr,0.,1.);}
