export const terrainVS=`#version 300 es
precision highp float;
layout(location=0) in float aHeight;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aData;
layout(location=3) in vec2 aLight;
uniform mat4 uVP;
uniform vec2 uOrigin;
out vec3 vPosition;out vec3 vNormal;out vec4 vData;out vec2 vLight;
void main(){float x=float(gl_VertexID%129),z=float(gl_VertexID/129);vPosition=vec3(uOrigin.x+x,aHeight,uOrigin.y+z);vNormal=aNormal;vData=aData;vLight=aLight;gl_Position=uVP*vec4(vPosition,1.);}`;
const common=`
precision highp float;
uniform vec3 uEye;uniform float uColor;uniform float uWet;uniform float uGray;
out vec4 fragColor;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){return .55*vn(p)+.28*vn(p*2.07+4.1)+.12*vn(p*4.19-3.7)+.05*vn(p*8.31+1.7);}
vec3 finish(vec3 col,vec3 pos){float distanceToEye=length(uEye-pos);vec3 haze=vec3(.66,.75,.78);col=mix(col,haze,1.-exp(-distanceToEye*.000052));col=clamp(col,0.,1.);return pow(col,vec3(1./2.2));}
`;
export const terrainFS=`#version 300 es
${common}
in vec3 vPosition;in vec3 vNormal;in vec4 vData;in vec2 vLight;
void main(){
 vec3 p=vPosition,n=normalize(vNormal),view=normalize(uEye-p),sun=normalize(vec3(-2.,1.9,-1.));
 float exposure=smoothstep(.22,.68,1.-n.y),rock=clamp(vData.r*.78+exposure*.62,0.,1.);
 float layer=sin(p.y*.39+fb(p.xz*.022)*4.8+p.x*.008);
 float grain=fb(vec2(p.x*.31+p.z*.17,p.y*.43+p.z*.19));
 vec3 weights=abs(n);weights/=max(.001,weights.x+weights.y+weights.z);
 float grit=fb(p.zy*.92)*weights.x+fb(p.xz*.92)*weights.y+fb(p.xy*.92)*weights.z;
 float mineral=fb(vec2(p.x*.026+p.z*.019,p.y*.044+p.z*.020));
 float fissure=1.-smoothstep(.018,.080,abs(vn(vec2(p.x*.05+p.z*.022,p.y*.013+p.z*.004))-.5));
 float damp=clamp(vData.g*uWet+(1.-n.y)*.10,0.,1.);
 vec3 limestone=mix(vec3(.16,.186,.188),vec3(.53,.535,.482),smoothstep(.28,.71,mineral));
 limestone*=.52+.52*grain+.30*grit+.025*layer;
 limestone=mix(limestone,vec3(.15,.165,.146),fissure*.44);
 limestone=mix(limestone,vec3(.27,.232,.158),smoothstep(.55,.84,mineral)*.19);
 vec3 earth=mix(vec3(.245,.173,.108),vec3(.34,.282,.177),smoothstep(.32,.69,vData.a));
 earth*=.58+.28*fb(p.xz*.27)+.24*grit+.18*fb(p.xz*.018);
 earth=mix(earth,vec3(.135,.157,.13),damp*.53);
 earth=mix(earth,vec3(.135,.108,.068),vData.b*.55);
 vec3 base=mix(earth,limestone,rock);
 base=mix(base,base*vec3(.66,.72,.73),damp*.21);
 float gray=dot(base,vec3(.2126,.7152,.0722));base=mix(vec3(gray),base,uColor);base=mix(base,vec3(.37),uGray);
 // Surface gradient from the same numeric grain field. No normal or albedo images.
 float relief=mix(.023,.17,rock)*(grit-.5)+rock*.07*(grain-.5);
 vec3 dp1=dFdx(p),dp2=dFdy(p),r1=cross(dp2,n),r2=cross(n,dp1);float det=dot(dp1,r1);
 if(abs(det)>1e-8)n=normalize(abs(det)*n-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));
 float ndl=max(dot(n,sun),0.),shadow=vLight.x,ao=vLight.y;
 vec3 ambient=mix(vec3(.19,.23,.26),vec3(.30,.325,.34),clamp(n.y*.65+.35,0.,1.));
 vec3 radiance=base*(ambient*ao+vec3(1.08,.96,.78)*ndl*(.20+.8*shadow));
 vec3 halfV=normalize(view+sun);float spec=pow(max(dot(n,halfV),0.),mix(8.,28.,damp))*.035*damp*shadow;
 radiance+=spec;fragColor=vec4(finish(radiance,p),1.);
}`;
export const waterVS=`#version 300 es
precision highp float;layout(location=0) in vec3 aPosition;layout(location=1) in float aDepth;uniform mat4 uVP;out vec3 vPosition;out float vDepth;
void main(){vPosition=aPosition;vDepth=aDepth;gl_Position=uVP*vec4(aPosition,1.);}`;
export const waterFS=`#version 300 es
${common}
in vec3 vPosition;in float vDepth;uniform float uPond;
void main(){vec3 p=vPosition,view=normalize(uEye-p);vec3 n=vec3(0.,1.,0.);
 float fre=pow(1.-max(dot(view,n),0.),4.);float depth=smoothstep(.04,3.4,vDepth);
 vec3 water=mix(vec3(.20,.30,.238),vec3(.035,.139,.145),depth);
 water=mix(water,vec3(.285,.33,.288),uPond*.35);water=mix(water,vec3(.64,.72,.77),fre*.65);
 vec3 sun=normalize(vec3(-2.,1.9,-1.));float spec=pow(max(dot(normalize(view+sun),n),0.),170.)*.54;
 water+=vec3(.93,.79,.55)*spec;water=mix(water,vec3(.32,.37,.4),uGray);fragColor=vec4(finish(water,p),1.);}`;
export const skyVS=`#version 300 es
precision highp float;out vec2 vUV;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.-1.,.9999,1.);}`;
export const skyFS=`#version 300 es
precision highp float;in vec2 vUV;out vec4 fragColor;void main(){float t=clamp(vUV.y,0.,1.);vec3 c=mix(vec3(.84,.84,.78),vec3(.58,.70,.79),pow(t,.72));fragColor=vec4(c,1.);}`;
