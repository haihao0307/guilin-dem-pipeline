#version 300 es
precision highp float;
out vec4 outColor;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;

/*
"Wet stone" by Alexander Alekseev aka TDM - 2014
License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
Contact: tdmaav@gmail.com
*/

#define SMOOTH
//#define AA

const int NUM_STEPS = 32;
const int AO_SAMPLES = 4;
const vec2 AO_PARAM = vec2(1.2, 3.5);
const vec2 CORNER_PARAM = vec2(0.25, 40.0);
const float INV_AO_SAMPLES = 1.0 / float(AO_SAMPLES);
const float TRESHOLD = 0.1;
const float EPSILON = 1e-3;
const float LIGHT_INTENSITY = 0.25;
const vec3 RED = vec3(1.0,0.7,0.7) * LIGHT_INTENSITY;
const vec3 ORANGE = vec3(1.0,0.67,0.43) * LIGHT_INTENSITY;
const vec3 BLUE = vec3(0.54,0.77,1.0) * LIGHT_INTENSITY;
const vec3 WHITE = vec3(1.2,1.07,0.98) * LIGHT_INTENSITY;
const float DISPLACEMENT = 0.1;

mat3 fromEuler(vec3 ang) {
  vec2 a1 = vec2(sin(ang.x),cos(ang.x));
  vec2 a2 = vec2(sin(ang.y),cos(ang.y));
  vec2 a3 = vec2(sin(ang.z),cos(ang.z));
  mat3 m;
  m[0] = vec3(a1.y*a3.y+a1.x*a2.x*a3.x,a1.y*a2.x*a3.x+a3.y*a1.x,-a2.y*a3.x);
  m[1] = vec3(-a2.y*a1.x,a1.y*a2.y,a2.x);
  m[2] = vec3(a3.y*a1.x*a2.x+a1.y*a3.x,a1.x*a3.x-a1.y*a3.y*a2.x,a2.y*a3.y);
  return m;
}
vec3 saturation(vec3 c, float t) {return mix(vec3(dot(c,vec3(0.2126,0.7152,0.0722))),c,t);}
float hash11(float p) {return fract(sin(p * 727.1)*435.545);}
float hash12(vec2 p) {float h = dot(p,vec2(127.1,311.7));return fract(sin(h)*437.545);}
vec3 hash31(float p) {vec3 h = vec3(127.231,491.7,718.423) * p;return fract(sin(h)*435.543);}

float noise_3(in vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  vec2 ii = i.xy + i.z * vec2(5.0);
  float a = hash12(ii + vec2(0.0,0.0));
  float b = hash12(ii + vec2(1.0,0.0));
  float c = hash12(ii + vec2(0.0,1.0));
  float d = hash12(ii + vec2(1.0,1.0));
  float v1 = mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  ii += vec2(5.0);
  a = hash12(ii + vec2(0.0,0.0));
  b = hash12(ii + vec2(1.0,0.0));
  c = hash12(ii + vec2(0.0,1.0));
  d = hash12(ii + vec2(1.0,1.0));
  float v2 = mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  return max(mix(v1,v2,u.z),0.0);
}

float fbm3(vec3 p, float a, float f) {return noise_3(p);}
float fbm3_high(vec3 p, float a, float f) {
  float ret = 0.0;
  float amp = 1.0;
  float frq = 1.0;
  for(int i = 0; i < 5; i++) {
    float n = pow(noise_3(p * frq),2.0);
    ret += n * amp;
    frq *= f;
    amp *= a * (pow(n,0.2));
  }
  return ret;
}

float diffuse(vec3 n,vec3 l,float p) {return pow(max(dot(n,l),0.0),p);}
float specular(vec3 n,vec3 l,vec3 e,float s) {
  float nrm = (s + 8.0) / (3.1415 * 8.0);
  return pow(max(dot(reflect(e,n),l),0.0),s) * nrm;
}

float plane(vec3 gp, vec4 p) {return dot(p.xyz,gp+p.xyz*p.w);}
float sphere(vec3 p,float r) {return length(p)-r;}
float capsule(vec3 p,float r,float h) {p.y -= clamp(p.y,-h,h);return length(p)-r;}
float cylinder(vec3 p,float r,float h) {return max(abs(p.y/h),capsule(p,r,h));}
float box(vec3 p,vec3 s) {p = abs(p)-s;return max(max(p.x,p.y),p.z);}
float rbox(vec3 p,vec3 s) {p = abs(p)-s;return length(p-min(p,0.0));}
float quad(vec3 p,vec2 s) {p = abs(p) - vec3(s.x,0.0,s.y);return max(max(p.x,p.y),p.z);}

float boolUnion(float a,float b) {return min(a,b);}
float boolIntersect(float a,float b) {return max(a,b);}
float boolSub(float a,float b) {return max(a,-b);}
float boolSmoothIntersect(float a, float b, float k ) {
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(a,b,h) + k*h*(1.0-h);
}
float boolSmoothSub(float a, float b, float k ) {return boolSmoothIntersect(a,-b,k);}

float rock(vec3 p) {
  float d = sphere(p,1.0);
  for(int i = 0; i < 9; i++) {
    float ii = float(i);
    float r = 2.5 + hash11(ii);
    vec3 v = normalize(hash31(ii) * 2.0 - 1.0);
    #ifdef SMOOTH
    d = boolSmoothSub(d,sphere(p+v*r,r * 0.8), 0.03);
    #else
    d = boolSub(d,sphere(p+v*r,r * 0.8));
    #endif
  }
  return d;
}

float map(vec3 p) {
  float d = rock(p) + fbm3(p*4.0,0.4,2.96) * DISPLACEMENT;
  d = boolUnion(d,plane(p,vec4(0.0,1.0,0.0,1.0)));
  return d;
}
float map_detailed(vec3 p) {
  float d = rock(p) + fbm3_high(p*4.0,0.4,2.96) * DISPLACEMENT;
  d = boolUnion(d,plane(p,vec4(0.0,1.0,0.0,1.0)));
  return d;
}

vec3 getNormal(vec3 p, float dens) {
  vec3 n;
  n.x = map_detailed(vec3(p.x+EPSILON,p.y,p.z));
  n.y = map_detailed(vec3(p.x,p.y+EPSILON,p.z));
  n.z = map_detailed(vec3(p.x,p.y,p.z+EPSILON));
  return normalize(n-map_detailed(p));
}
vec2 getOcclusion(vec3 p, vec3 n) {
  vec2 r = vec2(0.0);
  for(int i = 0; i < AO_SAMPLES; i++) {
    float f = float(i)*INV_AO_SAMPLES;
    float hao = 0.01+f*AO_PARAM.x;
    float hc = 0.01+f*CORNER_PARAM.x;
    float dao = map(p + n * hao) - TRESHOLD;
    float dc = map(p - n * hc) - TRESHOLD;
    r.x += clamp(hao-dao,0.0,1.0) * (1.0-f);
    r.y += clamp(hc+dc,0.0,1.0) * (1.0-f);
  }
  r.x = clamp(1.0-r.x*INV_AO_SAMPLES*AO_PARAM.y,0.0,1.0);
  r.y = clamp(r.y*INV_AO_SAMPLES*CORNER_PARAM.y,0.0,1.0);
  return r;
}
vec2 spheretracing(vec3 ori, vec3 dir, out vec3 p) {
  vec2 td = vec2(0.0);
  for(int i = 0; i < NUM_STEPS; i++) {
    p = ori + dir * td.x;
    td.y = map(p);
    if(td.y < TRESHOLD) break;
    td.x += (td.y-TRESHOLD) * 0.9;
  }
  return td;
}

vec3 getStoneColor(vec3 p, float c, vec3 l, vec3 n, vec3 e) {
  c = min(c + pow(noise_3(vec3(p.x*20.0,0.0,p.z*20.0)),70.0) * 8.0, 1.0);
  float ic = pow(1.0-c,0.5);
  vec3 base = vec3(0.42,0.3,0.2) * 0.35;
  vec3 sand = vec3(0.51,0.41,0.32)*0.9;
  vec3 color = mix(base,sand,c);
  float f = pow(1.0 - max(dot(n,-e),0.0), 5.0) * 0.75 * ic;
  color += vec3(diffuse(n,l,0.5) * WHITE);
  color += vec3(specular(n,l,e,8.0) * WHITE * 1.5 * ic);
  n = normalize(n - normalize(p) * 0.4);
  color += vec3(specular(n,l,e,80.0) * WHITE * 1.5 * ic);
  color = mix(color,vec3(1.0),f);
  color *= sqrt(abs(p.y*0.5+0.5)) * 0.4 + 0.6;
  color *= (n.y * 0.5 + 0.5) * 0.4 + 0.6;
  return color;
}

vec3 getPixel(in vec2 coord, float time) {
  vec2 iuv = coord / iResolution.xy * 2.0 - 1.0;
  vec2 uv = iuv;
  uv.x *= iResolution.x / iResolution.y;
  vec3 ang = vec3(0.0,0.2,time);
  if(iMouse.z > 0.0) ang = vec3(0.0,clamp(2.0-iMouse.y*0.01,0.0,3.1415),iMouse.x*0.01);
  mat3 rot = fromEuler(ang);
  vec3 ori = vec3(0.0,0.0,2.8);
  vec3 dir = normalize(vec3(uv.xy,-2.0));
  ori = ori * rot;
  dir = dir * rot;
  vec3 p;
  vec2 td = spheretracing(ori,dir,p);
  vec3 n = getNormal(p,td.y);
  vec2 occ = getOcclusion(p,n);
  vec3 light = normalize(vec3(0.0,1.0,0.0));
  vec3 color = vec3(1.0);
  if(td.x < 3.5 && p.y > -0.89) color = getStoneColor(p,occ.y,light,n,dir);
  color *= occ.x;
  return color;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float time = iTime * 0.3;
  #ifdef AA
  vec3 color = vec3(0.0);
  for(int i = -1; i <= 1; i++)
  for(int j = -1; j <= 1; j++) {
    vec2 uv = fragCoord+vec2(i,j)/3.0;
    color += getPixel(uv, time);
  }
  color /= 9.0;
  #else
  vec3 color = getPixel(fragCoord, time);
  #endif
  color = sqrt(color);
  color = saturation(color,1.7);
  vec2 iuv = fragCoord / iResolution.xy * 2.0 - 1.0;
  float vgn = smoothstep(1.2,0.7,abs(iuv.y)) * smoothstep(1.1,0.8,abs(iuv.x));
  color *= 1.0 - (1.0 - vgn) * 0.15;
  fragColor = vec4(color,1.0);
}



// KAOPU Material Lab R04 — derived research shader, 2026-10-02.
// Composed with TDM Wet stone (2014), CC BY-NC-SA 3.0. Baseline stays separate.
// BRDF equations: Khronos glTF 2.0 Appendix B; Google Filament documentation.
// Procedural weather masks are artistic hypotheses, not a growth/fracture simulation.
uniform vec3 uBase;
uniform vec3 uGrain;
uniform float uRoughness;
uniform float uWet;
uniform float uCrack;
uniform float uCrackWidth;
uniform float uCrackScale;
uniform float uMoss;
uniform float uRelief;
uniform float uLichen;
uniform float uSeed;
uniform float uExposure;
uniform float uLight;
uniform float uZoom;
uniform int uView;
uniform int uPBR;
uniform int uBaseline;
const float KP_PI=3.14159265359;
struct SurfaceSample {vec3 baseColor;float roughness;float metallic;float occlusion;float coat;float coatRoughness;float crack;float moss;float lichen;float height;};
float sat(float x){return clamp(x,0.0,1.0);}
vec3 toLinear(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
vec3 toSRGB(vec3 c){c=max(c,vec3(0));return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
float detailNoise(vec3 p){return .57*noise_3(p)+.29*noise_3(p*2.03+7.1)+.14*noise_3(p*4.11-3.2);}
// Four warped fracture families in OBJECT coordinates. Never screen-space lines.
float crackMask(vec3 p){
 vec3 q=p*uCrackScale+vec3(uSeed*.137,0,uSeed*.073);
 float warp=(noise_3(q*2.7+11.0)-.5)*.29;
 float d=2.0;
 d=min(d,abs(sin(dot(q,normalize(vec3(1,.37,.62)))*4.2+warp*5.0)));
 d=min(d,abs(sin(dot(q,normalize(vec3(-.33,1,.24)))*3.4+warp*4.1+1.7)));
 d=min(d,abs(sin(dot(q,normalize(vec3(.4,-.2,1)))*3.8+warp*4.3+2.8)));
 float width=max(.009,uCrackWidth*8.0);
 return 1.0-smoothstep(0.0,width,d);
}
float mossMask(vec3 p){
 if(uMoss<=0.0)return 0.0;
 float patchValue=detailNoise(p*4.7+vec3(6.0+uSeed*.3,1.0,4.0));
 // Broad position/up-facing proxy; declared heuristic, not measured humidity.
 float shelter=.08*sat(.7-p.y)+.07*sat(p.z+.5);
 float threshold=.99-uMoss*.58;
 return smoothstep(threshold-.075,threshold+.075,patchValue+shelter)*smoothstep(-1.05,-.82,p.y);
}
float lichenMask(vec3 p){
 if(uLichen<=0.0)return 0.0;
 float v=detailNoise(p*14.0+uSeed);
 return smoothstep(.69-uLichen*.14,.77-uLichen*.14,v)*uLichen;
}
float heightDelta(vec3 p){
 float cracks=uCrack>0.0?uCrack*crackMask(p):0.0;
 float moss=uMoss>0.0?uRelief*mossMask(p)*(.55+.45*noise_3(p*75.0)):0.0;
 return moss-cracks;
}
// Teacher ray surface is the TRESHOLD isosurface. Keep it when adding relief.
float surfaceField(vec3 p){return rock(p)+noise_3(p*4.0)*DISPLACEMENT-TRESHOLD-heightDelta(p);}
float worldField(vec3 p){return min(surfaceField(p),p.y+.9);}
vec3 fieldNormal(vec3 p){
 vec2 e=vec2(.001,0.0);
 return normalize(vec3(worldField(p+e.xyy)-worldField(p-e.xyy),worldField(p+e.yxy)-worldField(p-e.yxy),worldField(p+e.yyx)-worldField(p-e.yyx)));
}
vec3 shadingNormal(vec3 p){
 // Original high-frequency normal layer retained; separately labeled from geometry.
 vec2 e=vec2(.001,0.0);vec3 g;
 g.x=map_detailed(p+e.xyy)-map_detailed(p-e.xyy)-heightDelta(p+e.xyy)+heightDelta(p-e.xyy);
 g.y=map_detailed(p+e.yxy)-map_detailed(p-e.yxy)-heightDelta(p+e.yxy)+heightDelta(p-e.yxy);
 g.z=map_detailed(p+e.yyx)-map_detailed(p-e.yyx)-heightDelta(p+e.yyx)+heightDelta(p-e.yyx);
 return normalize(g);
}
float traceSurface(vec3 ro,vec3 rd,out vec3 p){
 if(uCrack<=0.0&&(uMoss<=0.0||uRelief<=0.0)){vec2 td=spheretracing(ro,rd,p);return td.x;}
 float t=0.0;float previous=0.0;
 for(int i=0;i<112;i++){
  p=ro+rd*t;float d=worldField(p);
  if(d<.0007){
   if(d<0.0){float lo=previous,hi=t;for(int j=0;j<7;j++){float m=(lo+hi)*.5;if(worldField(ro+rd*m)>0.0)lo=m;else hi=m;}t=(lo+hi)*.5;p=ro+rd*t;}
   return t;
  }
  previous=t;t+=clamp(d*.43,.0003,.28);if(t>9.0)break;
 }
 p=ro+rd*t;return 99.0;
}
float localAO(vec3 p,vec3 n){float occ=0.0;for(int i=1;i<=4;i++){float h=.032*float(i*i);occ+=max(0.0,h-worldField(p+n*h))/float(i);}return sat(1.0-occ*.95);}
SurfaceSample evaluateMaterial(vec3 p,vec3 n,float cavity){
 SurfaceSample m;
 float grains=detailNoise(p*30.0)+.14*noise_3(p*160.0);
 float bands=detailNoise(p*4.3+7.0);
 float mixture=sat(.23+.5*grains+.25*cavity+.16*(bands-.5));
 m.baseColor=mix(uBase,uGrain,mixture);
 m.crack=uCrack>0.0?crackMask(p):0.0;
 m.moss=mossMask(p);m.lichen=lichenMask(p)*(1.0-m.moss);
 float wet=uWet*sat(.6+.4*bands+.18*m.crack);
 m.baseColor*=mix(1.0,.55,wet); // calibrated artist control, not a fluid simulation
 m.baseColor*=1.0-.36*m.crack;
 vec3 mossColor=mix(toLinear(vec3(.075,.15,.025)),toLinear(vec3(.36,.45,.115)),sat(grains));
 m.baseColor=mix(m.baseColor,mossColor,m.moss);
 m.baseColor=mix(m.baseColor,toLinear(vec3(.66,.7,.44))*(.65+.45*grains),m.lichen);
 m.roughness=clamp(uRoughness+.19*(grains-.5),.1,.98);
 m.roughness=mix(m.roughness,max(.16,m.roughness*.53),wet);
 m.roughness=mix(m.roughness,.93,m.moss);m.roughness=mix(m.roughness,.86,m.lichen);
 m.metallic=0.0; // stone, moss, lichen and water are not metallic conductors
 m.occlusion=localAO(p,n)*(1.0-.25*m.crack);
 m.coat=wet*(1.0-.72*m.moss)*(1.0-.5*m.lichen);m.coatRoughness=.12+.06*grains;
 m.height=heightDelta(p);return m;
}
vec3 fresnelSchlick(float hv,vec3 f0){return f0+(1.0-f0)*pow(1.0-hv,5.0);}
float Dggx(float nh,float alpha){float a2=alpha*alpha;float d=nh*nh*(a2-1.0)+1.0;return a2/max(KP_PI*d*d,1e-6);}
float Vsmith(float nv,float nl,float alpha){float a2=alpha*alpha;return .5/max(nl*sqrt(nv*nv*(1.0-a2)+a2)+nv*sqrt(nl*nl*(1.0-a2)+a2),1e-5);}
vec3 lightBRDF(SurfaceSample m,vec3 n,vec3 v,vec3 l,vec3 radiance){
 float nv=max(dot(n,v),.001),nl=max(dot(n,l),0.0);vec3 h=normalize(v+l);float nh=max(dot(n,h),0.0),hv=max(dot(h,v),0.0);
 vec3 F=fresnelSchlick(hv,mix(vec3(.04),m.baseColor,m.metallic));float a=m.roughness*m.roughness;
 vec3 spec=Dggx(nh,a)*Vsmith(nv,nl,a)*F;
 vec3 diff=(1.0-F)*(1.0-m.metallic)*m.baseColor/KP_PI;
 // Water-like thin coat, IOR 1.333 gives F0 about 0.0204; attenuate underlying layer.
 float Fc=.0204+.9796*pow(1.0-hv,5.0);
 float coat=Dggx(nh,m.coatRoughness*m.coatRoughness)*Vsmith(nv,nl,m.coatRoughness*m.coatRoughness)*Fc;
 return ((diff+spec)*(1.0-m.coat*Fc)+vec3(coat*m.coat))*radiance*nl;
}
vec3 shadePBR(SurfaceSample m,vec3 n,vec3 v){
 float a=uLight;vec3 l=normalize(vec3(sin(a)*.85,.85,cos(a)*.85));
 vec3 color=lightBRDF(m,n,v,l,vec3(3.0,2.85,2.7));
 color+=lightBRDF(m,n,v,normalize(vec3(-.7,.3,-.7)),vec3(.65,.78,1.0));
 color+=lightBRDF(m,n,v,normalize(vec3(.7,.6,-.4)),vec3(.95,.96,1.0));
 // Analytic studio environment approximation; NOT a prefiltered HDRI/GI solution.
 vec3 ambient=mix(vec3(.14,.15,.17),vec3(.6,.67,.73),n.y*.5+.5);
 color+=m.baseColor*ambient*m.occlusion*.68;
 vec3 r=reflect(-v,n);float rough=mix(m.roughness,m.coatRoughness,m.coat);
 float softbox=pow(max(dot(r,normalize(vec3(-.6,1.0,.6))),0.0),mix(120.0,4.0,rough));
 vec3 envF=fresnelSchlick(max(dot(n,v),0.0),vec3(.04));
 color+=envF*(.12+softbox*.85)*(.6+.4*m.coat)*mix(.4,1.0,m.occlusion);
 return color;
}
vec3 shadeLegacy(SurfaceSample m,vec3 p,vec3 n,vec3 v,float cavity){
 // Original visual vocabulary, recolored; intentionally not labeled physical PBR.
 float c=sat(cavity);float ic=sqrt(1.0-c);vec3 l=vec3(0,1,0);
 vec3 color=m.baseColor*(.75+.45*c);
 color+=diffuse(n,l,.5)*WHITE;
 color+=specular(n,l,-v,8.0)*WHITE*1.5*ic;
 vec3 nn=normalize(n-normalize(p)*.4);
 color+=specular(nn,l,-v,80.0)*WHITE*1.5*ic;
 color=mix(color,vec3(1),pow(1.0-max(dot(n,v),0.0),5.0)*.75*ic);
 color*=sqrt(abs(p.y*.5+.5))*.4+.6;
 color*=(nn.y*.5+.5)*.4+.6;
 return color*m.occlusion;
}

uniform int uSharedRig;
uniform vec3 uKeyTint,uFillTint;
uniform vec2 uKeyAngles,uFillAngles;
uniform float uKeyPower,uFillPower;
uniform vec3 uBackground;
vec3 rotateLight(vec3 p,vec2 a){if(a.x==0.0&&a.y==0.0)return p;float c=cos(a.x),s=sin(a.x);p.xz=mat2(c,-s,s,c)*p.xz;c=cos(a.y);s=sin(a.y);p.yz=mat2(c,-s,s,c)*p.yz;return p;}

vec3 wetStudioLight(SurfaceSample m,vec3 p,vec3 n,vec3 v){
 vec3 lpos[2]=vec3[2](4.0*normalize(vec3(1.,.6,.1)),4.0*normalize(vec3(-1.,.3,-.3)));
 vec3 rad[2]=vec3[2](2.5*vec3(16.,12.,8.),.7*vec3(8.,12.,18.));
 lpos[0]=rotateLight(lpos[0],uKeyAngles);lpos[1]=rotateLight(lpos[1],uFillAngles);
 rad[0]*=uKeyTint*uKeyPower;rad[1]*=uFillTint*uFillPower;
 vec3 result=vec3(0.0);
 for(int i=0;i<2;i++){
  vec3 l=normalize(lpos[i]-p);
  float spot=pow(max(dot(l,normalize(lpos[i])),0.),12.0)*5.0/dot(lpos[i]-p,lpos[i]-p);
  // GGX/Smith/Schlick implementation is the inherited R04 material, not a new fake wet highlight.
  result+=lightBRDF(m,n,v,l,rad[i]*spot);
 }
 result+=.01*m.baseColor*m.occlusion*(.5-.5*n.y);
 return result;
}
vec3 studioBackdrop(vec3 ro,vec3 rd){
 vec3 col=uBackground;
 vec3 lpos[2]=vec3[2](4.0*normalize(vec3(1.,.6,.1)),4.0*normalize(vec3(-1.,.3,-.3)));
 vec3 rad[2]=vec3[2](2.5*vec3(16.,12.,8.),.7*vec3(8.,12.,18.));
 lpos[0]=rotateLight(lpos[0],uKeyAngles);lpos[1]=rotateLight(lpos[1],uFillAngles);
 rad[0]*=uKeyTint*uKeyPower;rad[1]*=uFillTint*uFillPower;
 for(int i=0;i<2;i++){vec3 l=normalize(lpos[i]-ro);float g=pow(max(0.0,dot(rd,l)),10.0);g*=exp2(5.0)/dot(lpos[i]-ro,lpos[i]-ro);col+=rad[i]*g*.0003;}
 return pow(col*1.2/(1.0+col),vec3(.4545));
}

void main(){
 if(uBaseline==1){mainImage(outColor,gl_FragCoord.xy);return;}
 vec2 uv=gl_FragCoord.xy/iResolution.xy*2.0-1.0;uv.x*=iResolution.x/iResolution.y;
 vec3 ang=vec3(0,.2,iTime*.3);if(iMouse.z>0.0)ang=vec3(0,clamp(2.0-iMouse.y*.01,0.0,3.1415),iMouse.x*.01);
 mat3 rot=fromEuler(ang);vec3 ro=vec3(0,0,2.8)*rot;vec3 rd=normalize(vec3(uv/uZoom,-2.0))*rot;
 vec3 p;float t=traceSurface(ro,rd,p);vec3 color=vec3(.965,.973,.98);
 if(t<3.5&&p.y>-.887){
  vec3 n=shadingNormal(p),v=-rd;float cavity=getOcclusion(p,n).y;
  SurfaceSample m=evaluateMaterial(p,n,cavity);
  if(uView==1)color=toSRGB(m.baseColor);
  else if(uView==2)color=vec3(m.roughness);
  else if(uView==3)color=n*.5+.5;
  else if(uView==4)color=mix(vec3(.18),mix(vec3(.85,.28,.07),vec3(.07,.75,.25),m.moss),max(m.crack,m.moss));
  else if(uView==5){vec3 gn=fieldNormal(p);color=vec3(.64)*(.24+.76*max(dot(gn,normalize(vec3(-.5,1,1))),0.0))*m.occlusion;}
  else if(uView==6)color=vec3(m.occlusion);
  else{vec3 linear=uSharedRig==1?wetStudioLight(m,p,n,v):(uPBR==1?shadePBR(m,n,v):shadeLegacy(m,p,n,v,cavity));linear*=uExposure;color=toSRGB(linear/(1.0+linear));}
 }else if(t<9.0){
  float ao=localAO(p,vec3(0,1,0));float shadow=1.0-.27*exp(-dot(p.xz,p.xz)*2.0);color*=mix(.52,1.0,ao)*shadow;
 }
 if(uSharedRig==1&&!(t<3.5&&p.y>-.887))color=studioBackdrop(ro,rd);
 outColor=vec4(clamp(color,0.0,1.0),1.0);
}
