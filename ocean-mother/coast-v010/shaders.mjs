export const meshVS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;layout(location=2)in vec4 aData;
uniform mat4 uVP;out vec3 P;out vec3 N;out vec4 D;
void main(){P=aPos;N=aNormal;D=aData;gl_Position=uVP*vec4(P,1.);}`;
export const fullVS=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;
export const common=`
precision highp float;
uniform vec3 uEye,uSun,uSunColor,uFire,uWind;uniform vec2 uSize;uniform mat4 uInvVP;uniform float uTime,uHeat,uMode,uMicro,uFoamGain,uExposure,uDay;
uniform vec3 uLightDir[3],uLightColor[3];uniform float uLightPower[3];
float sat(float x){return clamp(x,0.,1.);}
float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fb(vec3 p){return .58*noise3(p)+.28*noise3(p*2.03+7.1)+.14*noise3(p*4.07-5.3);}
vec3 ray(){vec2 uv=gl_FragCoord.xy/uSize;vec4 p=uInvVP*vec4(uv*2.-1.,1.,1.);return normalize(p.xyz/p.w-uEye);}
vec3 skyLight(vec3 d){if(uMode==1.)return mix(vec3(.36,.38,.4),vec3(.58,.61,.64),sat(d.y));if(uMode==2.){vec3 s=vec3(.035,.042,.055);for(int k=0;k<3;k++)s+=uLightColor[k]*uLightPower[k]*pow(max(dot(d,uLightDir[k]),0.),32.)*.7;return s;}if(uMode==3.)return vec3(.055,.067,.08);return frozenSky(d);}
vec3 direct(vec3 p,vec3 n,vec3 albedo){vec3 light;if(uMode==0.)light=vec3(.17,.23,.28)*(.08+.92*uDay)+uSunColor*max(dot(n,uSun),0.)*1.2*step(0.,uSun.y);else if(uMode==1.)light=vec3(.24)+vec3(.82)*max(dot(n,normalize(vec3(-.5,.8,.3))),0.);else{light=vec3(.08,.09,.11);for(int k=0;k<3;k++)light+=uLightColor[k]*uLightPower[k]*max(dot(n,uLightDir[k]),0.);}
 vec3 f=uFire+vec3(0,1.2,0)-p;float fire=uHeat*8./(1.+dot(f,f))*(.85+.15*sin(uTime*8.2));light+=vec3(1.4,.28,.032)*fire*max(dot(n,normalize(f)),0.);return albedo*light;}
vec3 displayColor(vec3 c){c=max(c*(uMode==1.?1.:uExposure),0.);c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);return pow(clamp(c,0.,1.),vec3(1./2.2));}
`;
export const landFS=`#version 300 es
__COMMON__
in vec3 P,N;in vec4 D;out vec4 O;
void main(){float tag=D.y,wet=D.x;vec3 n=normalize(N);float b=fb(P*.85),grain=noise3(P*58.);vec3 albedo;
if(tag<.5){float ripple=sin(P.z*10.+sin(P.x*1.4)*1.8);albedo=mix(vec3(.48,.34,.17),vec3(.73,.61,.39),b);albedo*=.96+.07*grain+.035*ripple;n=normalize(n+vec3(.008*cos(P.x*12.),0,.025*cos(P.z*10.)));albedo*=mix(1.,.52,wet);}
else if(tag<1.5){float layer=sin(P.y*11.+sin(P.x*1.7)+sin(P.z*1.4));float crack=1.-smoothstep(.012,.07,abs(sin(P.x*.82+P.y*.7+sin(P.z*1.3))));albedo=mix(vec3(.14,.155,.16),vec3(.36,.34,.29),b);albedo*=.93+.12*layer;albedo*=1.-crack*.28;n=normalize(n+vec3((noise3(P*7.)-.5)*.12,(grain-.5)*.055,(noise3(P*7.+31.)-.5)*.12));albedo*=mix(1.,.56,wet);}
else if(tag<2.5){albedo=vec3(.07,.085,.10)*(.78+.18*sin(P.y*15.+sin(P.z*.7)));}
else {float charred=fb(P*9.);albedo=mix(vec3(.018,.014,.012),vec3(.12,.06,.025),charred);}
if(uMode==3.){albedo=tag<.5?mix(vec3(.5,.34,.16),vec3(.04,.50,.58),wet):tag<1.5?vec3(.35,.4,.45):vec3(.11);O=vec4(albedo,1);return;}
vec3 col=direct(P,n,albedo);vec3 v=normalize(uEye-P),h=normalize(v+uSun);float spec=pow(max(dot(n,h),0.),mix(12.,105.,wet));col+=uSunColor*spec*wet*.09*step(0.,uSun.y);if(tag>2.5)col+=vec3(1.5,.08,.002)*pow(max(0.,.6-noise3(P*7.)),3.)*uHeat*2.;O=vec4(col,1);}`;
export const waterFS=`#version 300 es
__COMMON__
in vec3 P,N;in vec4 D;out vec4 O;
void main(){if(D.y<.006)discard;float shallow=sat(D.y/.3),a=uMicro*shallow;vec2 p=P.xz;vec2 slope=vec2(0.);for(int k=0;k<7;k++){float j=float(k),f=1.4*pow(1.67,j),ang=j*2.399;vec2 d=vec2(cos(ang),sin(ang));float amp=.058*pow(.57,j);slope+=d*amp*f*cos(dot(p,d)*f-uTime*sqrt(9.81*f)+j*4.7);}
vec3 n=normalize(N+vec3(slope.x,0,slope.y)*a*2.);vec3 v=normalize(uEye-P);if(dot(n,v)<0.)n=-n;float fres=.02+.98*pow(1.-max(dot(n,v),0.),5.);vec3 reflected=skyLight(reflect(-v,n));float path=min(25.,D.y/max(abs(v.y),.17));vec3 tr=exp(-vec3(.62,.115,.069)*path);float sandNoise=fb(vec3(p*.75,2.));vec3 bottom=mix(vec3(.43,.34,.20),vec3(.61,.51,.32),sandNoise);vec3 body=mix(vec3(.012,.155,.18),bottom,tr);body*=.55+.45*uDay;
vec3 col=mix(body,reflected,fres);vec3 h=normalize(v+uSun);float shin=pow(max(dot(n,h),0.),150.);col+=uSunColor*shin*.85*step(0.,uSun.y);
if(uMode==2.)for(int k=0;k<3;k++){vec3 h2=normalize(v+uLightDir[k]);col+=uLightColor[k]*uLightPower[k]*pow(max(dot(n,h2),0.),85.)*.5;}
float foamState=D.x*uFoamGain;float f1=fb(vec3(p*.83,uTime*.12)),f2=noise3(vec3(p*8.,uTime*.24)),lace=1.-smoothstep(.03,.19,abs(f1-.50));float coverage=sat(foamState*(.5+1.5*lace));coverage*=.74+.26*f2;coverage=max(coverage,(1.-smoothstep(.012,.065,D.y))*smoothstep(.006,.018,D.y)*min(1.,foamState*3.));
vec3 foamColor=direct(P,n,vec3(.9,.95,.96));col=mix(col,foamColor,coverage);vec3 flame=uFire+vec3(0,1,0)-P;col+=vec3(1.5,.22,.015)*uHeat*.7/(1.+dot(flame,flame))*(.3+fres);
if(uMode==3.)col=mix(mix(vec3(.02,.12,.45),vec3(.02,.78,.62),sat(D.y/2.)),vec3(1,.9,.6),sat(foamState));O=vec4(col,1.);}`;
export const skyFS=`#version 300 es
__COMMON__
out vec4 O;void main(){vec3 rd=ray();vec3 c=skyLight(rd);if(rd.y<0.){float t=(-5.1-uEye.y)/rd.y;vec3 p=uEye+rd*t;float grid=(1.-smoothstep(.015,.04,abs(fract(p.x/5.)-.5)))+(1.-smoothstep(.015,.04,abs(fract(p.z/5.)-.5)));if(uMode>0.)c=vec3(.07,.085,.10)+grid*.015;}O=vec4(c,1.);}`;
export const particleVS=`#version 300 es
precision highp float;layout(location=0)in vec4 aPos;uniform mat4 uVP;uniform float uPointScale;out float alpha;void main(){vec4 p=uVP*vec4(aPos.xyz,1);gl_Position=p;gl_PointSize=clamp(uPointScale*aPos.w/p.w,1.,12.);alpha=.65;}`;
export const particleFS=`#version 300 es
precision highp float;in float alpha;out vec4 O;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;O=vec4(vec3(.8,.91,.94),alpha*(1.-r*r));}`;
export const volumeFS=`#version 300 es
__COMMON__
uniform sampler2D uScene,uDepth;uniform vec4 uPuffs[28];uniform vec4 uPuffState[28];uniform int uCount;uniform vec3 uBoxLo,uBoxHi;out vec4 O;
vec2 box(vec3 ro,vec3 rd){vec3 a=(uBoxLo-ro)/rd,b=(uBoxHi-ro)/rd;vec3 n=min(a,b),f=max(a,b);return vec2(max(n.x,max(n.y,n.z)),min(f.x,min(f.y,f.z)));}
float smokeD(vec3 p){float d=0.;for(int k=0;k<28;k++){if(k>=uCount)break;vec3 q=(p-uPuffs[k].xyz)/uPuffs[k].w;float r=dot(q,q);if(r<4.84)d+=exp(-r*1.8)*(1.-smoothstep(3.,4.84,r))*uPuffState[k].x;}float n=fb(p*1.9+vec3(0,-uTime*.32,0));return d*smoothstep(.19,.76,n)*2.8;}
void main(){vec2 uv=gl_FragCoord.xy/uSize;vec3 col=texture(uScene,uv).rgb,rd=ray();float depth=texture(uDepth,uv).r;vec4 wp=uInvVP*vec4(uv*2.-1.,depth*2.-1.,1.);float opaque=depth>.999999?10000.:length(wp.xyz/wp.w-uEye);vec2 b=box(uEye,rd);float lo=max(0.,b.x),hi=min(opaque,b.y);if(hi>lo&&uHeat+float(uCount)>.0001){float ds=(hi-lo)/48.;float tr=1.;vec3 L=vec3(0);for(int j=0;j<48;j++){float t=lo+(float(j)+.5)*ds;vec3 p=uEye+rd*t;float d=smokeD(p);vec3 q=p-uFire;q.xz-=uWind.xz*q.y*q.y*.018;float f=0.;if(q.y>0.&&q.y<4.2){vec3 a=q/vec3(.9,2.5,.8);a.x+=sin(q.y*3.-uTime*5.)*.13;a.z+=cos(q.y*2.+uTime*4.)*.15;float shape=length(a.xz)/(1.-sat(q.y/4.2));f=exp(-shape*shape*2.)*smoothstep(.2,.8,fb(q*3.1+vec3(0,-uTime*3.2,0)))*uHeat*(1.-smoothstep(2.,4.2,q.y));}
float extinction=d+f*1.8,alpha=1.-exp(-extinction*ds);if(alpha>.0001){float shade=exp(-smokeD(p+uSun*.8)*.75);vec3 smoke=mix(vec3(.045,.049,.052),vec3(.46,.48,.49),shade)*(.4+.6*uDay);vec3 fdelta=p-(uFire+vec3(0,1.,0));smoke+=vec3(1.2,.17,.006)*uHeat*2./(1.+dot(fdelta,fdelta))*exp(-d*.2);vec3 fire=mix(vec3(3.4,.20,.012),vec3(6.5,3.1,.2),sat(f*1.8));vec3 emit=mix(smoke,fire,sat(f/(d+f+.001)));if(uMode==3.)emit=mix(vec3(.36,.39,.43),vec3(1,.23,.015),sat(f*3.));L+=tr*alpha*emit;tr*=1.-alpha;}if(tr<.009)break;}col=L+col*tr;}O=vec4(displayColor(col),1.);}`;
