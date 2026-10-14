/* Independently written GLSL. Fiber scattering equations follow Chiang et al.
 * and PBRT 4e §9.9: R, TT, TRT, internal tail; RGB instead of spectral.
 * Log-I0 approximation and eight-bin deep opacity are R02 approximations.
 * No copied film assets, hairstyle mesh, or AI-rendered texture. */
export const curveGLSL = `vec3 curve(float t) {
 float g=rootData.z, phase=g*.83, s=t*trait.x;
 float rootX=rootData.x, rootZ=rootData.y;
 float envelope=sin(3.14159265*s);
 float clump=sin(3.14159265*t)*sin(3.14159265*t);
 float x=rootX*(1.0-.28*t*t)+wave*.024*sin(6.0*s)*envelope;
 float y=.128-.268*s;
 float z=rootZ*(1.0-.18*t)+wave*.018*sin(7.2*s+.4)*envelope;
 x+=.0035*sin(8.0*s+phase)*clump;
 z+=.0055*sin(5.7*s+phase)*clump;
 float fine=(.00013+frizz*.00065)*(1.0+trait.w*8.0);
 x+=fine*(sin(19.0*s+trait.z)-sin(trait.z))*smoothstep(0.0,.10,t);
 z+=fine*(cos(23.0*s+trait.z)-cos(trait.z))*smoothstep(0.0,.10,t);
 x+=trait.w*frizz*.010*sin(4.6*t+trait.z)*t;
 z+=trait.w*frizz*.008*sin(5.2*t+trait.z)*t;
 return vec3(x,y,z);
}`;
export const positionFragment = `precision highp float;
uniform sampler2D rootMap,traitMap;
uniform float frizz,wave;
vec4 rootData,trait;
${curveGLSL}
void main(){
 int id=int(gl_FragCoord.x)+int(gl_FragCoord.y)*1024;
 int root=id/81;int node=id-root*81;
 if(root>=10000){gl_FragColor=vec4(0.);return;}
 ivec2 at=ivec2(root%128,root/128);
 rootData=texelFetch(rootMap,at,0);trait=texelFetch(traitMap,at,0);
 gl_FragColor=vec4(curve(float(node)/80.0),1.0);
}`;
export const vertex = `precision highp float;
attribute vec4 rootData;attribute vec4 trait;
uniform sampler2D positionMap;
uniform float diameter,ortho;
uniform vec3 orthoDir;
uniform vec2 viewport;
varying vec3 wPos,wTangent;
varying float sideCoord,coverageScale,seedValue,progress;
vec3 pointAt(int j){int id=gl_InstanceID*81+j;return texelFetch(positionMap,ivec2(id%1024,id/1024),0).xyz;}
void main(){
 float t=position.y;int node=int(t*80.0+.5);
 vec3 p=pointAt(node),tangent=normalize(pointAt(min(80,node+1))-pointAt(max(0,node-1)));
 vec4 wp=modelMatrix*vec4(p,1.0);vec3 wt=normalize(mat3(modelMatrix)*tangent);vec4 vp=viewMatrix*wp;
 vec3 eye=ortho>.5?orthoDir:normalize(cameraPosition-wp.xyz);
 vec3 widthAxis=normalize(cross(wt,eye));
 float pixelWorld=(ortho>.5?1.0:-vp.z)*2.0/(viewport.y*projectionMatrix[1][1]);
 float physical=diameter*trait.y*mix(1.0,.08,smoothstep(.72,1.0,t));
 float expanded=max(physical,pixelWorld*1.20);coverageScale=min(1.0,physical/expanded);
 gl_Position=projectionMatrix*viewMatrix*vec4(wp.xyz+widthAxis*position.x*expanded*.5,1.0);
 wPos=wp.xyz;wTangent=wt;sideCoord=position.x;seedValue=rootData.w;progress=t;
}`;
export const coverageFragment = `precision highp float;varying float sideCoord,coverageScale;
void main(){float aa=max(fwidth(sideCoord),.02);float a=coverageScale*(1.0-smoothstep(1.0-aa,1.0+aa,abs(sideCoord)));if(a<.012)discard;gl_FragColor=vec4(0.,0.,0.,a);}`;
export const fragment = `
precision highp float;
uniform vec3 sigmaA;
uniform float roughness, variation, exposure, shadowStrength, scatterBoost, mode;
uniform vec3 lightDirs[3],lightColors[3];
uniform mat4 shadowMatrices[3];
uniform sampler2D shadow0, shadow1, shadow2;
varying vec3 wPos,wTangent;
varying float sideCoord,coverageScale,seedValue,progress;
const float PI=3.14159265359;
float sq(float x){return x*x;}
float logI0(float x){
 if(x>10.0){float z=1.0/x;return x-.5*log(2.0*PI*x)+log(1.0+z*.125+z*z*.0703125+z*z*z*.07324219);}
 float term=1.0,s=1.0,y=x*x*.25;
 for(int k=1;k<=12;k++){term*=y/float(k*k);s+=term;}
 return log(s);
}
float longitudinal(float si,float ci,float so,float co,float v){
 float a=ci*co/v,b=si*so/v;
 // log(2*sinh(1/v)) = 1/v + log(1-exp(-2/v)).
 return exp(clamp(logI0(a)-b-1.0/v-log(v)-log(max(1e-8,1.0-exp(-2.0/v))),-60.0,12.0));
}
float fresnel(float c){
 float eta=1.55,sint=sqrt(max(0.0,1.0-c*c))/eta,ct=sqrt(max(0.0,1.0-sint*sint));
 float rs=(c-eta*ct)/(c+eta*ct),rp=(eta*c-ct)/(eta*c+ct);return .5*(rs*rs+rp*rp);
}
float azimuth(float phi,float center,float s){
 float x=mod(phi-center+PI,2.0*PI)-PI,e=exp(-abs(x)/s);
 return e/(s*sq(1.0+e)*(2.0/(1.0+exp(-PI/s))-1.0));
}
vec3 fiber(vec3 T,vec3 V,vec3 L,vec3 absorption){
 float so=clamp(dot(T,V),-.999,.999),co=sqrt(1.0-so*so),si=clamp(dot(T,L),-.999,.999),ci=sqrt(1.0-si*si);
 vec3 N=normalize(V-T*so),B=normalize(cross(T,N));
 float phi=atan(dot(L,B),dot(L,N));
 // Subpixel strands use a stable per-strand quadrature sample; not frame noise.
 float h=mix(seedValue*1.8-.9,clamp(sideCoord,-.96,.96),smoothstep(.60,1.0,coverageScale));
 float go=asin(h),etaP=sqrt(1.55*1.55-so*so)/co,gt=asin(clamp(h/etaP,-.99,.99));
 float ct=sqrt(1.0-sq(so/1.55));
 vec3 Tr=exp(-absorption*(2.0*cos(gt)/ct));
 float f=fresnel(co*sqrt(1.0-h*h));
 vec3 ar=vec3(f),att=sq(1.0-f)*Tr,atrt=att*Tr*f,tail=atrt*Tr*f/max(vec3(.0001),vec3(1.0)-Tr*f);
 float bm=clamp(roughness*(.93+.14*seedValue),.18,.58),bn=.43;
 float v=sq(.726*bm+.812*bm*bm+3.7*pow(bm,20.0));
 float s=.6266571*(.265*bn+1.194*bn*bn+5.372*pow(bn,22.0));
 float theta=asin(so),alpha=.035;
 float r=longitudinal(si,ci,sin(theta-2.0*alpha),abs(cos(theta-2.0*alpha)),v)*azimuth(phi,-2.0*go,s);
 float tt=longitudinal(si,ci,sin(theta+alpha),abs(cos(theta+alpha)),.25*v)*azimuth(phi,2.0*gt-2.0*go+PI,s);
 float trt=longitudinal(si,ci,sin(theta+4.0*alpha),abs(cos(theta+4.0*alpha)),4.0*v)*azimuth(phi,4.0*gt-2.0*go+2.0*PI,s);
 vec3 sum=ar*r+att*tt+atrt*trt+tail*longitudinal(si,ci,so,co,4.0*v)/(2.0*PI);
 if(mode>.5&&mode<1.5)return ar*r;
 if(mode>1.5&&mode<2.5)return att*tt+atrt*trt+tail*longitudinal(si,ci,so,co,4.0*v)/(2.0*PI);
 return sum;
}
float channel(vec4 v,int n){if(n==0)return v.r;if(n==1)return v.g;if(n==2)return v.b;return v.a;}
float opacityAt(sampler2D tex,vec3 uv){
 if(any(lessThan(uv,vec3(0.0)))||any(greaterThan(uv,vec3(1.0))))return 0.0;
 // Each half of a texture contains four cumulative opacity depths.
 vec4 a=texture2D(tex,vec2(uv.x*.5,uv.y));
 vec4 b=texture2D(tex,vec2(uv.x*.5+.5,uv.y));
 float p=clamp((uv.z-.004)*8.0,0.0,8.0);int k=int(floor(p));float frac=p-float(k);
 float prev=0.0,next=0.0;
 if(k>0)prev=k<=4?channel(a,k-1):channel(b,k-5);
 if(k<8)next=k<4?channel(a,k):channel(b,k-4);else next=prev;
 return max(0.0,mix(prev,next,frac));
}
void main(){
 vec3 V=normalize(cameraPosition-wPos),T=normalize(wTangent);
 float v=exp((seedValue-.5)*variation*2.0);
 vec3 absorption=sigmaA*v*mix(1.10,.82,progress);
 vec3 color=vec3(0.0),base=exp(-absorption*2.2);
 for(int i=0;i<3;i++){
   vec4 sc=shadowMatrices[i]*vec4(wPos,1.0);vec3 uv=sc.xyz/sc.w;
   float tau=0.0;
   if(i==0)tau=opacityAt(shadow0,uv);else if(i==1)tau=opacityAt(shadow1,uv);else tau=opacityAt(shadow2,uv);
   float visibility=exp(-tau*shadowStrength);
   vec3 direct=fiber(T,V,normalize(lightDirs[i]),absorption);
   // Deliberately labelled artistic multiple-scattering approximation, not path tracing.
   vec3 bounce=base*.045*scatterBoost*(1.0-exp(-tau*.5));
   if(mode>.5)bounce=vec3(0.0);
   color+=lightColors[i]*(direct*visibility+bounce);
 }
 if(mode<.5)color+=base*.016;
 if(mode>2.5)color=vec3(.32)*(.30+.7*abs(dot(normalize(cross(T,V)),normalize(lightDirs[0]))));
 gl_FragColor=vec4(color,1.0);
}`;
export const shadowFragment = `
precision highp float;
uniform float slab;
varying float sideCoord,coverageScale;
void main(){
 float aa=max(fwidth(sideCoord),.02),cov=coverageScale*(1.0-smoothstep(1.0-aa,1.0+aa,abs(sideCoord)));
 float z=gl_FragCoord.z;
 vec4 depths=slab<.5?vec4(.125,.25,.375,.5):vec4(.625,.75,.875,1.0);
 gl_FragColor=cov*clamp((depths-vec4(z))*128.0+.5,0.0,1.0);
}`;
export const fullscreenVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export const accumulateFragment = `precision highp float;uniform sampler2D currentFrame,history;uniform float sampleCount;varying vec2 vUv;void main(){vec4 c=texture2D(currentFrame,vUv);vec4 h=texture2D(history,vUv);gl_FragColor=sampleCount<1.5?c:mix(h,c,1./sampleCount);}`;
export const presentFragment = `precision highp float;uniform sampler2D image;uniform float exposure;varying vec2 vUv;vec3 linearToSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}void main(){vec3 x=texture2D(image,vUv).rgb*exposure;vec3 c=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);gl_FragColor=vec4(linearToSrgb(c),1.);}`;
