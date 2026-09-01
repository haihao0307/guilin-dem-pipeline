// Original density functions are prepended after source-hash verification.
uniform int mode,diag;
uniform vec3 lightDir[3],lightColor[3];uniform float lightPower[3];
vec3 palette(float q){q=clamp(q,0.,1.);return mix(mix(vec3(.018,.05,.25),vec3(.025,.55,.48),min(q*2.,1.)),vec3(.88,.76,.075),max(q*2.-1.,0.));}
vec3 illumination(vec3 p,vec3 rd){vec3 result=vec3(.04);for(int k=0;k<3;k++){if(lightPower[k]<=0.)continue;vec3 L=normalize(lightDir[k]);float tau=0.;for(int j=0;j<6;j++)tau+=densityAt(p+L*(.15+float(j)*.31),false)*.31*2.4;float mu=dot(rd,L),direct=exp(-tau),multi=.16*exp(-tau*.20);result+=lightColor[k]*lightPower[k]*(direct*(.26+.20*min(phaseHG(.45,mu),7.))+multi);}return result;}
vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){vec2 xy=(2.*gl_FragCoord.xy-uRes)/uRes.y;
if(mode==2&&diag==2){vec3 p=vec3(xy.x*6.,3.+xy.y*6.,0.);float d=densityAt(p+uWind,true);fragColor=vec4(srgb(palette(d/1.2)),1);return;}
vec3 fw=normalize(uTarget-uCamera),ri=normalize(cross(fw,vec3(0,1,0))),up=cross(ri,fw),rd=normalize(fw+(ri*xy.x+up*xy.y)*.48);
vec2 hit=bounds(uCamera,rd,uLo[0]+uWind,uHi[0]+uWind);hit.x=max(hit.x,0.);float T=1.,tau=0.,moment=0.;vec3 C=vec3(0);if(hit.y>hit.x){float ds=(hit.y-hit.x)/float(uSteps);for(int k=0;k<192;k++){if(k>=uSteps||T<.003)break;float t=hit.x+(float(k)+.5)*ds;vec3 p=uCamera+rd*t;sampleFootprint=max(t*.96/uRes.y,ds*.35);float d=densityAt(p,true);if(d>.0001){float dtau=d*ds*2.4,alpha=1.-exp(-dtau);if(mode!=2)C+=T*alpha*illumination(p,rd);moment+=T*alpha*t;T*=1.-alpha;tau+=dtau;}}}
if(mode==2){float q=diag==3?(1.-T>.002?moment/max(1.-T,.001)/25.:0.):tau/4.;fragColor=vec4(srgb(palette(q)),1);return;}
vec3 bg=mode==0?vec3(.16):vec3(.021,.031,.044);C+=T*bg;if(mode==1)C=C/(1.+C);else C=clamp(C,0.,1.);fragColor=vec4(srgb(C),1.);}
