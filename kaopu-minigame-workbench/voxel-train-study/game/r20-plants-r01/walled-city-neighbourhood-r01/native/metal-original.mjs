// Original FH88 material closure. Only THREE namespace injection/export wrapper added.
export function bindOriginalTrainMaterials(T){
const RULE_VERSION='RAIL_FUNCTION_RULES_R01';
const noiseGLSL=`
varying vec3 vKP;
varying vec3 vKN;
float kh(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float kn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(kh(i),kh(i+vec3(1,0,0)),f.x),mix(kh(i+vec3(0,1,0)),kh(i+vec3(1,1,0)),f.x),f.y),mix(mix(kh(i+vec3(0,0,1)),kh(i+vec3(1,0,1)),f.x),mix(kh(i+vec3(0,1,1)),kh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float kfb(vec3 p){return .57*kn(p)+.28*kn(p*2.13)+.15*kn(p*4.17);}
`;
function material(role,color,seed=1){
 const metal={steel:.86,brass:.78,iron:.6,paint:0,wall:0,brick:0,wood:0,glass:.12,coal:.05,light:.05};
 const rough={steel:.29,brass:.31,iron:.53,paint:.34,wall:.85,brick:.81,wood:.78,glass:.12,coal:.92,light:.2};
 const m=new T.MeshStandardMaterial({color,metalness:metal[role]??0,roughness:rough[role]??.75});m.name=role;
 if(role==='glass'){m.transparent=true;m.opacity=.42;m.depthWrite=false}
 if(role==='light'){m.emissive.set(color);m.emissiveIntensity=2.2}
 m.onBeforeCompile=s=>{
  s.uniforms.kpDomain={value:new T.Matrix4()};s.uniforms.kpUseDomain={value:m.userData.domainRoot?1:0};m.userData.shader=s;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 kpDomain;\nuniform float kpUseDomain;\nvarying vec3 vKP;\nvarying vec3 vKN;').replace('#include <begin_vertex>',`#include <begin_vertex>\nvec4 kpos=vec4(position,1.);vec3 knorm=normal;\n#ifdef USE_INSTANCING\nkpos=instanceMatrix*kpos;knorm=mat3(instanceMatrix)*knorm;\n#endif\nvKP=mix(position,(kpDomain*modelMatrix*kpos).xyz,kpUseDomain);vKN=mix(normal,mat3(kpDomain*modelMatrix)*knorm,kpUseDomain);`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+noiseGLSL);
  let pattern='';
  if(role==='brick')pattern=`vec2 chart=abs(vKN.y)>.7?vec2(vKP.x,vKP.z):abs(vKN.x)>abs(vKN.z)?vec2(vKP.z,vKP.y):vec2(vKP.x,vKP.y);vec2 b=vec2(chart.x*5.5+step(.5,fract(chart.y*7.))*0.5,chart.y*7.);vec2 f=fract(b);vec2 fw=max(fwidth(b),vec2(.001));float joint=max(1.-smoothstep(.04,.04+fw.x,f.x),1.-smoothstep(.045,.045+fw.y,f.y));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.49,.46,.4),joint*.7);`;
  if(role==='wall')pattern=`float stain=smoothstep(.43,.72,kfb(vec3(vKP.x*.8,vKP.y*.24,vKP.z*.8)+${seed.toFixed(2)}));diffuseColor.rgb*=1.-stain*.29;`;
  if(role==='wood')pattern=`float grain=sin(vKP.z*58.+kn(vKP*vec3(3,2,.4))*12.);diffuseColor.rgb*=.92+.08*grain*(1.-smoothstep(.4,2.,length(fwidth(vKP))*58.));`;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nvec3 kq=vKP+vec3(${seed.toFixed(2)});float kp=kfb(kq*3.1);diffuseColor.rgb*=.94+.09*kp;${pattern}`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(kn(kq*9.)-.5)*.12,.08,.99);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nfloat footprint=length(fwidth(kq))*65.;float h=(kn(kq*65.)-.5)*${role==='wall'||role==='brick'?'.004':'.00025'}*(1.-smoothstep(.4,1.6,footprint));vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);vec3 aa=cross(dy,normal),bb=cross(normal,dx);float det=dot(dx,aa);normal=normalize(max(abs(det),1.e-8)*normal-sign(det)*(dFdx(h)*aa+dFdy(h)*bb));`);
 };m.customProgramCacheKey=()=>RULE_VERSION+role+seed;return m;
}
return material;
}
