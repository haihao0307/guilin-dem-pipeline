export const vert=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec4 aField;layout(location=3) in vec2 aExtra;
uniform mat4 uVP;uniform float uTime,uTide,uLogFar;uniform int uWater;
out vec3 vWorld,vNormal;out vec4 vField;out vec2 vExtra;out float vDepth;
void main(){vec3 p=aPosition;float wave=.12*sin(p.x*.045+p.z*.027+uTime*.7)+.055*sin(-p.x*.071+p.z*.041+uTime*1.1);if(uWater==1){if(aField.x<1.5)p.y=uTide+wave*.9;else if(aField.x<2.5)p.y+=uTide*exp(-aField.y/22000.)+wave*.1;}vWorld=p;vNormal=aNormal;vField=aField;vExtra=aExtra;gl_Position=uVP*vec4(p,1.);vDepth=1.+gl_Position.w;gl_Position.z=(log2(max(.000001,vDepth))*uLogFar-1.)*gl_Position.w;}`;
export const frag=`#version 300 es
precision highp float;
in vec3 vWorld,vNormal;in vec4 vField;in vec2 vExtra;in float vDepth;
uniform float uTime,uTide,uMud,uMixStrength,uLogFar;uniform vec3 uEye;uniform int uWater,uCrop,uIslandsCount;uniform vec4 uBounds;uniform vec3 uIslands[24];out vec4 color;
float hash21(vec2 p){p=fract(p*vec2(.1031,.11369));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=mat2(1.72,-1.03,1.03,1.72)*p+5.37;a*=.5;}return s;}
void main(){if(uCrop==1&&vWorld.x>uBounds.x&&vWorld.z>uBounds.y&&vWorld.x<uBounds.z&&vWorld.z<uBounds.w)discard;float kind=vField.x;if(uWater==0&&(kind>.45||vExtra.x<.999))discard;if(uWater==1&&kind<.45)discard;float dist=length(uEye-vWorld);vec3 c;
if(uWater==0){vec3 n=normalize(vNormal);float slope=1.-max(n.y,0.),a=fbm(vWorld.xz*.0011),b=fbm(vWorld.xz*.011),grain=noise(vWorld.xz*1.3);c=mix(vec3(.10,.17,.08),vec3(.23,.32,.14),a);float rock=smoothstep(.20,.61,slope)*.7+smoothstep(780.,1450.,vWorld.y)*.38;c=mix(c,vec3(.36,.33,.25),clamp(rock,0.,.85));c*=.82+.23*b+.05*grain*(1.-smoothstep(40.,500.,dist));float light=.42+.74*max(dot(n,normalize(vec3(-.48,.82,-.30))),0.);c*=light;}
else{vec2 p=vWorld.xz,U=normalize(vec2(.88,-.47)),perp=vec2(-U.y,U.x),w=p;float island=0.;for(int i=0;i<24;i++){if(i>=uIslandsCount)break;vec2 r=p-uIslands[i].xy;float rad=uIslands[i].z,rr=max(dot(r,r),rad*rad*1.03),f=clamp(rad*rad/rr,0.,.9);w-=perp*dot(perp,r)*f*.8;w+=U*dot(U,r)*f*.28;island+=f;}vec2 q=w*.00075-U*uTime*.012;vec2 warp=vec2(fbm(q+2.1),fbm(q+13.7))-.5;float f=fbm(q+warp*2.6),stripes=.5+.5*sin(dot(perp,w)*.0023+fbm(q*1.7)*5.5-uTime*.06);float near=exp(-max(vField.y,0.)/7200.);float turbulent=clamp(island,0.,1.);float sediment=clamp(uMud*near*(.68+.22*f+.26*stripes*uMixStrength*turbulent),0.,.94);if(kind>2.5){float reach=mix(7000.,28000.,clamp((uTide+1.4)/2.8,0.,1.));float ingress=(1.-smoothstep(reach*.75,reach,vExtra.y));sediment=max(.12,uMud*ingress*.82);c=mix(vec3(.11,.23,.24),vec3(.39,.36,.23),sediment);c*=.91+.09*f;}
else{vec3 deep=mix(vec3(.025,.15,.24),vec3(.035,.24,.30),f*.4);vec3 mud=mix(vec3(.31,.34,.25),vec3(.43,.39,.24),f);c=mix(deep,mud,sediment);vec3 view=normalize(uEye-vWorld);float fres=.02+.98*pow(1.-clamp(view.y,0.,1.),5.);c=mix(c,vec3(.45,.59,.62),fres*.28);float small=noise(p*.07+uTime*.14)-.5;c+=small*.012*(1.-smoothstep(300.,6000.,dist));if(kind>1.5)c=mix(c,vec3(.38,.35,.24),.28);}}
float fog=smoothstep(130000.,340000.,dist);c=mix(c,vec3(.72,.79,.80),fog*.5);color=vec4(pow(clamp(c,0.,1.),vec3(.88)),1.);gl_FragDepth=log2(max(.000001,vDepth))*uLogFar*.5;}`;
