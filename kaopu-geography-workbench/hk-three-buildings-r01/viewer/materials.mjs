import * as THREE from './vendor/three.module.js';
export const MATERIAL_NAMES=['砖 / R3.12','石灰抹灰 / R3.12','混凝土 / KST1'];
export function brickIdentity(x,y,seed=19){const row=Math.floor(y/.073),shift=((row%2)+2)%2*.125,phase=(x+shift)/.25,column=Math.floor(phase);return {row,column,seed:seed+row*13+column,q:[(phase-column)*.25-.125,((y/.073)-row)*.073-.0365,.055384616]};}
const RECEIVER=String.raw`
uniform float uMaterialKind,uAge,uWet,uSeed,uGrain,uWindows,uBuildingHeight,uPlain;
varying vec3 vMetricPosition,vMetricNormal;
// Analytic box/footprint overlap, adapted from the existing hair coverage idea.
// Radius is physical; widening the filter never creates a minimum opaque seam.
float trialCoverage(float d,float radius,float footprint){
 float f=max(footprint,.000001),lo=max(d-f*.5,-radius),hi=min(d+f*.5,radius);
 return clamp((hi-lo)/f,0.,1.);
}
KpSurface trialSurface(vec3 p,vec3 n,float footprint){
 if(uPlain>.5)return KpSurface(0.,vec3(.57,.57,.53),.91);
 vec2 tangent=normalize(vec2(n.z,-n.x)+vec2(0.0000001));
 vec2 uv=vec2(dot(p.xz,tangent),p.y);
 if(abs(n.y)>.65)uv=p.xz;
 float fp=max(footprint,0.000001);
 KpSurface s=KpSurface(0.,vec3(.5),.9);
 if(uMaterialKind<.5){
  float row=floor(uv.y/.073),shift=mod(row,2.)*.125;
  float phase=(uv.x+shift)/.25,column=floor(phase),seed=uSeed+row*13.+column;
  vec3 q=vec3(fract(phase)*.25-.125,fract(uv.y/.073)*.073-.0365,.055384616);
  // Same metric cell determines all seed, variant, geometry coordinates.
  int variant=int(abs(seed))%4;
  s=kpBrickOriginalSurface(q,seed,variant,.42,fp);
  float edge=max(abs(q.x)-.119,abs(q.y)-.030576923);
  float body=trialCoverage(q.x,.119,fp)*trialCoverage(q.y,.030576923,fp);
  // Evaluate the fitted original brick inside its front face to avoid a false
  // half-coverage result across the entire flat SDF zero-level face.
  if(fp<.004){edge=max(edge,kpBrickBaseDistance(vec3(q.xy,.052),seed,variant,.42));body*=1.-smoothstep(-max(fp*.65,.00012),max(fp*.65,.00012),edge);}
  float resolve=1.-smoothstep(.009,.048,fp);
  body=mix(.8042,body,resolve);
  // Large-footprint receiver approximation. Keeps the mother itself unchanged.
  s.albedo=mix(vec3(.344,.077,.038),s.albedo,1.-smoothstep(.012,.075,fp));
  float mortarGrain=(br_noise3_(vec3(uv*180.,7.))-0.5)*(1.-smoothstep(.002,.01,fp));
  vec3 mortar=vec3(.28,.26,.21)*(1.+mortarGrain*.06);
  s.albedo=mix(mortar,s.albedo,body);
  s.height=mix(-.0025,s.height*uGrain,body)*resolve;
  s.roughness=mix(.94,s.roughness,body);
 }else if(uMaterialKind<1.5){
  KpPlasterParams a=KpPlasterParams(vec2(0.,1.35),vec2(2.,1.5),.0165,.0014,0.,.013,.02,.0001,vec3(.48,.44,.35),vec3(.82,.76,.64),.0008,.000008*uGrain,.018);
  s=kpPlasterOriginalField(vec3(uv,0.),a,fp).surface;
  s.height*=uGrain;
 }else{
  s=kpConcreteStation(vec3(uv,0.),uAge,uWet,.04,fp);
  s.height*=uGrain;
 }
 // Authored gravity/drainage receiver, reused continuous mother noise basis.
 // This is neither a surveyed water map nor photograph-baked lighting.
 float low=br_noise3_(vec3(uv.x*.16,uv.y*.025,uSeed*.031));
 float stream=pow(smoothstep(.34,.83,br_noise3_(vec3(uv.x*1.7,uv.y*.055+low*.7,uSeed*.07))),3.);
 float topRun=(.28+.72*smoothstep(0.,uBuildingHeight*.7,uv.y));
 float footDamp=exp(-max(uv.y,0.)*1.6)*(.35+.65*low);
 float water=clamp(uWet*(stream*topRun*.8+footDamp*.6),0.,.8);
 float patina=clamp(uAge*(stream*.32+footDamp*.27),0.,.6);
 s.albedo*=1.-water*.32-patina*.28;
 s.albedo=mix(s.albedo,s.albedo*vec3(.79,.88,.72),patina*.3);
 s.roughness=clamp(s.roughness-water*.34,.2,.99);
 if(uWindows>.5&&abs(n.y)<.25){
  // Creative facade study only: no holes, apertures, rooms or storeys are inferred.
  vec2 win=abs(fract((uv+vec2(.6,.1))/vec2(2.7,3.1))-.5)*vec2(2.7,3.1);
  float wd=max(win.x-.64,win.y-.85),wa=max(fp,.003);
  float glass=(1.-smoothstep(-wa,wa,wd))*smoothstep(.8,1.2,p.y)*(1.-smoothstep(uBuildingHeight-1.,uBuildingHeight-.4,p.y));
  float mullion=1.-smoothstep(.035,.035+wa,min(win.x,win.y));
  vec3 windowColor=mix(vec3(.055,.095,.105),vec3(.23,.25,.24),mullion);
  s.albedo=mix(s.albedo,windowColor,glass);
  s.roughness=mix(s.roughness,.24,glass*(1.-mullion));
  s.height=mix(s.height,-.003,glass);
 }
 return s;
}
vec3 trialBump(vec3 eyeP,vec3 surfN,float height){
 vec3 dx=dFdx(eyeP),dy=dFdy(eyeP),r1=cross(dy,surfN),r2=cross(surfN,dx);
 float det=dot(dx,r1);vec3 g=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);
 return normalize(abs(det)*surfN-g);
}
`;
export function makeMaterial(source,{kind=0,height=30,seed=19,age=.32,wet=.24,grain=1,windows=0,plain=0}={}){
 const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,metalness:0,side:THREE.DoubleSide});
 const uniforms={uMaterialKind:{value:kind},uBuildingHeight:{value:height},uSeed:{value:seed},uAge:{value:age},uWet:{value:wet},uGrain:{value:grain},uWindows:{value:windows},uPlain:{value:plain}};
 mat.userData.uniforms=uniforms;
 mat.customProgramCacheKey=()=> 'kaopu-three-measured-buildings-r01-mother-B';
 mat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vMetricPosition,vMetricNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMetricPosition=position;vMetricNormal=normal;');
  shader.fragmentShader=source+'\n'+RECEIVER+'\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float trialFootprint=max(length(dFdx(vMetricPosition)),length(dFdy(vMetricPosition)));
   KpSurface trial=trialSurface(vMetricPosition,normalize(vMetricNormal),trialFootprint);
   diffuseColor.rgb*=trial.albedo;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=trial.roughness;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=trialBump(-vViewPosition,normal,trial.height);');
 };
 return mat;
}
