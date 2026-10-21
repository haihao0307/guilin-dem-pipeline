export const vertex=`#version 300 es
precision highp float;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}`;
export const fragment=`#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec3 uCamera,uForward,uRight,uUp;
uniform float uTanFov,uNear,uFar;
uniform int uKind,uSectionCount;
uniform vec3 uMin,uMax,uPos,uSize,uColor;
uniform float uRounding,uMetallic,uRoughness,uCoat,uSafety,uEpsilon,uGroundZ;
uniform int uProbe;
uniform vec3 uProbePoint;
uniform vec4 uSections[8];
uniform vec3 uSlopes[8];
out vec4 color;
float boxSDF(vec3 p,vec3 b,float r){vec3 q=abs(p)-(b-vec3(r));return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;}
vec3 profile(float x){int k=0;for(int i=0;i<6;i++){if(i<uSectionCount-2&&x>uSections[i+1].x)k=i+1;}vec4 a=uSections[k],b=uSections[k+1];float dx=b.x-a.x,t=clamp((x-a.x)/dx,0.0,1.0),t2=t*t,t3=t2*t;return (2.0*t3-3.0*t2+1.0)*a.yzw+(t3-2.0*t2+t)*dx*uSlopes[k]+(-2.0*t3+3.0*t2)*b.yzw+(t3-t2)*dx*uSlopes[k+1];}
float field(vec3 p){
 if(uKind==5){vec3 q=p-uPos;vec2 d=vec2(length(q.xz)-uSize.x,abs(q.y)-uSize.y);return min(max(d.x,d.y),0.0)+length(max(d,0.0));}
 if(uKind==9){vec3 q=p-uPos;float a=(length(q.yz/uSize.yz)-1.0)*uSize.z,b=(length(q.yz/(uSize.yz-.05))-1.0)*(uSize.z-.05);return max(max(a,-b),max(abs(q.x)-uSize.x,-q.z));}
 if(uKind==10){vec3 q=p-uPos;float top=3.50+.035*cos(p.x*18.0)*sin(p.y*17.0)+.025*sin(p.x*9.0+p.y*13.0);return max(max(abs(q.x)-uSize.x,abs(q.y)-uSize.y),max(3.15-p.z,p.z-top));}
 if(uKind==8){vec3 q=p-uPos;float a=(length(q.xy/uSize.xy)-1.0)*min(uSize.x,uSize.y),b=abs(q.z)-uSize.z;vec2 d=vec2(a,b);float outer=min(max(d.x,d.y),0.0)+length(max(d,0.0)),inner=(length(q.xy/(uSize.xy-.07))-1.0)*min(uSize.x-.07,uSize.y-.07);return max(outer,-inner);}
 if(uKind==1){vec3 a=profile(p.x);vec2 n=vec2(abs(p.y/a.x),abs((p.z-a.y)/a.z));float d=(pow(pow(n.x,2.4)+pow(n.y,2.4),1.0/2.4)-1.0)*min(a.x,a.z);d=max(d,max(-6.2-p.x,p.x-4.4));for(int i=0;i<3;i++)d=max(d,1.085-length(vec2(p.x+float(i)*2.2098,p.z-1.016)));return d;}
 vec3 q=p-uPos;float d=boxSDF(q,uSize,uRounding);
 if(uKind==6){d=abs(p.z-1.22)-.08;for(int i=0;i<3;i++)d=min(d,abs(length(vec2(p.x+float(i)*2.2098,p.z-1.016))-1.16)-.075);for(int i=0;i<3;i++)d=max(d,1.085-length(vec2(p.x+float(i)*2.2098,p.z-1.016)));d=max(d,max(max(abs(q.x)-uSize.x,abs(q.y)-uSize.y),1.11-p.z));}
 if(uKind==2){d=max(d,-boxSDF(q,vec3(1.15,1.17,1.02),max(.03,uRounding-.04)));d=max(d,-boxSDF(p-vec3(-7.41,0,3.155),vec3(.60,2,.335),.12));}
 if(uKind==3)d=max(d,-boxSDF(p-vec3(-10.65,0,3.8),vec3(1.05,1.08,.65),.16));
 if(uKind==4)d=max(d,1.245-abs(p.y));
 return d;
}
vec2 intersectBox(vec3 ro,vec3 rd){vec3 inv=1.0/rd;vec3 a=(uMin-ro)*inv,b=(uMax-ro)*inv;vec3 lo=min(a,b),hi=max(a,b);return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));}
vec3 normal(vec3 p){float e=uEpsilon*1.25;vec2 k=vec2(1,-1);return normalize(k.xyy*field(p+k.xyy*e)+k.yyx*field(p+k.yyx*e)+k.yxy*field(p+k.yxy*e)+k.xxx*field(p+k.xxx*e));}
vec3 environment(vec3 d,float rough){vec3 zen=vec3(.38,.53,.66),horizon=vec3(.81,.83,.80),floor=vec3(.22,.25,.25);vec3 c=mix(horizon,zen,smoothstep(0.0,1.0,d.z));c=mix(c,floor,(1.0-smoothstep(-.5,0.0,d.z)));float strip=exp(-pow((d.x+.32)/(.10+rough*.7),2.0))*exp(-pow((d.z-.65)/(.18+rough*.7),2.0));return c+vec3(.75)*strip;}
vec3 shade(vec3 p,vec3 n,vec3 v){
 vec3 l=normalize(vec3(.5,-.45,1.0)),h=normalize(v+l);float nl=max(dot(n,l),0.0),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.0),vh=max(dot(v,h),0.0);float r=max(.065,uRoughness),a=r*r,a2=a*a;float D=a2/(3.14159265*pow(nh*nh*(a2-1.0)+1.0,2.0));float k=pow(r+1.0,2.0)/8.0;float G=nl/(nl*(1.0-k)+k)*nv/(nv*(1.0-k)+k);vec3 F0=mix(vec3(.04),uColor,uMetallic),F=F0+(1.0-F0)*pow(1.0-vh,5.0);vec3 diffuse=(1.0-F)*(1.0-uMetallic)*uColor/3.14159265;vec3 spec=D*G*F/(4.0*nl*nv+.001);vec3 lit=(diffuse+spec)*nl*vec3(3.3,3.05,2.7);
 vec3 refl=reflect(-v,n);vec3 ambient=uColor*(1.0-uMetallic)*(.12+.18*max(n.z,0.0));vec3 fres=F0+(1.0-F0)*pow(1.0-nv,5.0);lit+=ambient+environment(refl,r)*fres*(1.0-r*.7);lit+=uCoat*environment(refl,.08)*(.025+.15*pow(1.0-nv,5.0));
 return lit;
}
void depthAt(vec3 p){float z=dot(p-uCamera,uForward);float n=(uFar+uNear)/(uFar-uNear)-2.0*uFar*uNear/((uFar-uNear)*z);gl_FragDepth=clamp(n*.5+.5,0.0,1.0);}
vec3 display(vec3 c){c=c/(1.0+c);return pow(max(c,0.0),vec3(1.0/2.2));}
void main(){
 if(uProbe==1){uint n=uint(round(clamp((field(uProbePoint)+8.0)/16.0,0.0,1.0)*16777215.0));color=vec4(float(n&255u),float((n>>8)&255u),float((n>>16)&255u),255.0)/255.0;gl_FragDepth=0.0;return;}
 vec2 uv=gl_FragCoord.xy/uResolution*2.0-1.0;vec3 rd=normalize(uForward+uv.x*(uResolution.x/uResolution.y)*uTanFov*uRight+uv.y*uTanFov*uUp);
 if(uKind==0){float t=(uGroundZ-uCamera.z)/rd.z;if(t>0.0&&t<150.0){vec3 p=uCamera+rd*t;float stripe=1.0-smoothstep(.008,.025,abs(fract(p.x+.5)-.5));float stripe2=1.0-smoothstep(.008,.025,abs(fract(p.y+.5)-.5));float grid=max(stripe,stripe2)*exp(-t*.035);vec3 c=mix(vec3(.37,.40,.39),vec3(.30,.34,.34),grid*.32);float blob=exp(-pow((p.x+5.6)/11.5,4.0)-pow(p.y/1.7,4.0));c*=1.0-.17*blob;color=vec4(display(c),1);depthAt(p);}else{color=vec4(display(environment(rd,.8)),1);gl_FragDepth=1.0;}return;}
 vec2 hit=intersectBox(uCamera,rd);float t=max(hit.x,uNear);if(hit.y<t)discard;bool found=false;
 for(int i=0;i<192;i++){vec3 p=uCamera+rd*t;float d=field(p);if(abs(d)<uEpsilon){found=true;break;}t+=max(abs(d)/uSafety,uEpsilon*.375);if(t>hit.y+.002)break;}
 if(!found)discard;vec3 p=uCamera+rd*t,n=normal(p);if(dot(n,rd)>0.0)n=-n;color=vec4(display(shade(p,n,-rd)),1);depthAt(p);
}`;
