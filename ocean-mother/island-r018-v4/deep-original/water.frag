precision highp float;
in vec3 wPos,nBase;in float compression,crest;
uniform sampler2D envA,envB;uniform float envMix,encodedEnv;
uniform float tSea,rough,waterTint,foamGain,windSpeed,exposure,doFoam,doReflection;
uniform vec2 windTo;uniform vec3 camera;out vec4 O;
const float PI=3.14159265359;
vec4 environment(vec3 d){float angle=atan(d.x,-d.z)/6.28318530718+.5;float v=sqrt(clamp(asin(clamp(d.y,0.,1.))/1.57079632679,0.,1.));vec4 a=texture(envA,vec2(angle,v)),b=texture(envB,vec2(angle,v));if(encodedEnv>.5){a.rgb=a.rgb/max(1.-a.rgb,vec3(.001));b.rgb=b.rgb/max(1.-b.rgb,vec3(.001));}return mix(a,b,envMix);}
vec3 visibleSky(vec3 d){vec4 v=environment(d);return v.rgb+v.a*sky(d);}
float h2(vec2 p){vec3 v=fract(vec3(p.xyx)*.1031);v+=dot(v,v.yzx+33.33);return fract((v.x+v.y)*v.z);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
vec3 film(vec3 c){c=max(c*exposure,0.);c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);return pow(clamp(c,0.,1.),vec3(1./2.2));}
void main(){vec3 V=normalize(camera-wPos);float dist=length(camera-wPos);vec2 slopes=vec2(0);float footprint=max(length(dFdx(wPos.xz)),length(dFdy(wPos.xz)));
for(int i=0;i<12;i++){float a=float(i)*2.39996+.37;vec2 d=normalize(windTo*1.25+vec2(cos(a),sin(a)));float k=5.4*pow(1.34,float(i)),f=1.-smoothstep(.65,2.7,footprint*k);float phase=dot(d,wPos.xz)*k-sqrt(9.81*k)*tSea+float(i)*1.731;slopes+=d*cos(phase)*(.014+windSpeed*.0013)*pow(.83,float(i))*f;}
vec3 N=normalize(nBase-vec3(slopes.x,0.,slopes.y));if(dot(N,V)<.02)N=normalize(N+V*(.02-dot(N,V)));float nv=max(dot(N,V),.015),F=.02037+.97963*pow(1.-nv,5.);vec3 R=reflect(-V,N);R.y=max(R.y,.008);R=normalize(R);vec4 env=environment(R);vec3 reflection=mix(sky(R),env.rgb+env.a*sky(R),doReflection);
float r=clamp(rough+min(.08,footprint*.006),.035,.5),alpha=r*r;
vec3 L=uSun.y>=0.?uSun:uMoon,H=normalize(L+V);float nl=max(dot(N,L),.0),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.),a2=alpha*alpha,D=a2/(PI*pow(nh*nh*(a2-1.)+1.,2.));float gv=2.*nv/(nv+sqrt(a2+(1.-a2)*nv*nv)),gl=2.*nl/(nl+sqrt(a2+(1.-a2)*nl*nl));float fres=.02037+.97963*pow(1.-vh,5.);vec4 overhead=environment(normalize(vec3(wPos.x*.00001+.01,.8,wPos.z*.00001+.1)));float transmission=clamp(overhead.a+.18,.22,1.);
vec3 lightColor=uSun.y>=0.?uSunColor*uDay:vec3(.06,.10,.19)*(1.-uDay);vec3 spec=lightColor*(D*gv*gl*fres/(max(4.*nv,0.01)))*transmission*uLight.x;
vec3 water=mix(vec3(.0035,.023,.040),vec3(.012,.132,.126),waterTint);float scatter=pow(max(dot(-L,V),0.),5.)*pow(1.-nv,1.4)*max(crest,0.)*.16;water*=((.20+.80*uDay)*uLight.y);water+=vec3(.011,.12,.11)*scatter*transmission*uDay;
vec3 col=reflection*F+water*(1.-F)+min(spec,vec3(18.));float froth=0.;if(doFoam>.5){float foamPattern=noise2(wPos.xz*1.5+tSea*.09)*.62+noise2(wPos.xz*5.7-tSea*.13)*.38;float white=(1.-smoothstep(.01,.28,compression-.51-foamGain*.22))*smoothstep(.38,.72,foamPattern);float breakup=noise2(wPos.xz*22.);froth=white*foamGain*(.4+.6*breakup)*(1.-smoothstep(700.,1900.,dist));col=mix(col,vec3(.73,.83,.83)*(.15+.85*uDay)*(.55+.45*transmission),clamp(froth,0.,.85));}
float haze=1.-exp(-dist*(.000025+uWeather.y*.00010+uLight.w*.000018));vec3 horizon=visibleSky(normalize(vec3(R.x,.006,R.z)));col=mix(col,horizon,haze);
O=vec4(film(col),1.);}
