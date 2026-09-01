// Presentation-only extension. densityAt and source objects are inherited unchanged.
uniform int mode,diag;
uniform vec3 lightDir[3],lightColor[3];uniform float lightPower[3],lightSize[3];
uniform float studioExposure;
vec3 palette(float q){q=clamp(q,0.,1.);return mix(mix(vec3(.018,.05,.25),vec3(.025,.55,.48),min(q*2.,1.)),vec3(.88,.76,.075),max(q*2.-1.,0.));}
vec3 neutralIllumination(vec3 p,vec3 rd){vec3 result=vec3(.04);for(int k=0;k<3;k++){if(lightPower[k]<=0.)continue;vec3 L=normalize(lightDir[k]);float tau=0.;for(int j=0;j<6;j++)tau+=densityAt(p+L*(.15+float(j)*.31),false)*.31*2.4;float mu=dot(rd,L),direct=exp(-tau),multi=.16*exp(-tau*.20);result+=lightColor[k]*lightPower[k]*(direct*(.26+.20*min(phaseHG(.45,mu),7.))+multi);}return result;}
// Fine contact attenuation plus a deterministic cone through the scalar source field.
// Coarse transport is an appearance approximation, not calibrated multiple scattering.
float studioDepth(vec3 p,vec3 L,float size){vec3 tangent=normalize(cross(L,abs(L.y)>.97?vec3(1,0,0):vec3(0,1,0))),bitangent=cross(L,tangent);float tau=(densityAt(p+L*.025,true)+densityAt(p+L*.075,false))*.05*2.4;for(int j=0;j<12;j++){float a=float(j)/12.,b=float(j+1)/12.,nearD=.10+6.*a*a,farD=.10+6.*b*b,ds=farD-nearD,t=(farD+nearD)*.5,angle=float(j)*2.399963;vec3 cone=(cos(angle)*tangent+sin(angle)*bitangent)*(t*tan(size)*.5);float b0=shape(p+L*t+cone-uWind);tau+=smoothstep(.075,.39,b0)*uOpt.x*.75*ds*2.4;}return tau;}
vec3 studioIllumination(vec3 p,vec3 rd){float h=smoothstep(1.2,4.4,p.y-uWind.y);vec3 result=mix(vec3(.012,.019,.032),vec3(.024,.030,.041),h);for(int k=0;k<3;k++){if(lightPower[k]<=0.)continue;vec3 L=normalize(lightDir[k]);float tau=studioDepth(p,L,lightSize[k]),mu=dot(rd,L);float ph=.72*phaseHG(.64,mu)+.28*phaseHG(-.18,mu);float direct=exp(-tau),multiple=.11*exp(-tau*.32)+.045*exp(-tau*.10);result+=lightColor[k]*lightPower[k]*(direct*(.28+.17*min(ph,7.))+multiple);}return result;}
vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){vec2 xy=(2.*gl_FragCoord.xy-uRes)/uRes.y;
if(mode==2&&diag==2){vec3 p=vec3(xy.x*6.,3.+xy.y*6.,0.);float d=densityAt(p+uWind,true);fragColor=vec4(srgb(palette(d/1.2)),1);return;}
vec3 fw=normalize(uTarget-uCamera),ri=normalize(cross(fw,vec3(0,1,0))),up=cross(ri,fw),rd=normalize(fw+(ri*xy.x+up*xy.y)*.48);
vec2 hit=bounds(uCamera,rd,uLo[0]+uWind,uHi[0]+uWind);hit.x=max(hit.x,0.);float T=1.,tau=0.,moment=0.;vec3 C=vec3(0);if(hit.y>hit.x){float ds=(hit.y-hit.x)/float(uSteps);for(int k=0;k<512;k++){if(k>=uSteps||T<.003)break;float t=hit.x+(float(k)+.5)*ds;vec3 p=uCamera+rd*t;sampleFootprint=max(t*.96/uRes.y,ds*.35);float d=densityAt(p,true);if(d>.0001){float dtau=d*ds*2.4,alpha=1.-exp(-dtau);if(mode==0)C+=T*alpha*neutralIllumination(p,rd);else if(mode==1)C+=T*alpha*studioIllumination(p,rd);moment+=T*alpha*t;T*=1.-alpha;tau+=dtau;}}}
if(mode==2){float q=diag==3?(1.-T>.002?moment/max(1.-T,.001)/25.:0.):tau/4.;fragColor=vec4(srgb(palette(q)),1);return;}
vec3 bg=mode==0?vec3(.16):mix(vec3(.009,.014,.024),vec3(.027,.040,.059),smoothstep(-.65,.7,xy.y));C+=T*bg;if(mode==1){C*=studioExposure;C=C*(2.51*C+.03)/(C*(2.43*C+.59)+.14);}else C=clamp(C,0.,1.);fragColor=vec4(srgb(clamp(C,0.,1.)),1.);}
