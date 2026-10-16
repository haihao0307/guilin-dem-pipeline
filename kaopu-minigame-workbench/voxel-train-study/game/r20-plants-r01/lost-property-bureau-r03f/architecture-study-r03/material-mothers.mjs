import {MOTHER_FIELDS_GLSL} from './mothers/all-fields.mjs';
export const MATERIAL_PORT={source:'Source-locked bureau mother leaves',mathFunctions:105,port:'WGSL field algebra → GLSL ES 3',compiledOffscreen:true,webglBrowserVerified:false,frame:'Per primitive centered metres; longest axis becomes grain x. Oblique rod frames remain approximate.',notYetEquivalent:['Vertex macro-displacement and camera-ray parallax are not applied','Weather/event history remains untouched in the original; no new wet overlay','GPU/CPU visual parity and browser runtime are pending']};
export function applyMaterialMothers(materials){
 for(const name of['wood','woodLight','brick','stone','roof','plaster']){
  const m=materials[name];if(!m)continue;
  m.onBeforeCompile=s=>{
   s.vertexShader='attribute vec3 kpLocal;attribute vec3 kpLocalNormal;varying vec3 vKpLocal;varying vec3 vKpNormal;varying vec3 vKpWorld;varying vec3 vKpWorldN;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvKpLocal=kpLocal;vKpNormal=kpLocalNormal;vKpWorld=(modelMatrix*vec4(position,1.)).xyz;vKpWorldN=normalize(mat3(modelMatrix)*normal);');
   s.fragmentShader='varying vec3 vKpLocal;varying vec3 vKpNormal;varying vec3 vKpWorld;varying vec3 vKpWorldN;\n'+MOTHER_FIELDS_GLSL+'\n'+s.fragmentShader;
   let sample='float kpFp=max(length(dFdx(vKpLocal)),length(dFdy(vKpLocal)));float kpH=0.;float kpR=roughness;vec3 kpC=diffuseColor.rgb;';
   if(name==='wood'||name==='woodLight')sample+=`KpWoodParams kpP=kpWoodDefaultParams();kpP.textureScale=.70;kpP.roughness=${name==='wood'?'.31':'.63'};kpP.clearcoat=${name==='wood'?'.48':'.08'};KpWoodSample kpS=kpWoodOriginalSample(vKpLocal,normalize(vKpNormal),abs(vKpNormal.x)>.7?1.:0.,kpP,kpFp,length(vViewPosition));kpH=kpS.surface.height;kpR=kpS.surface.roughness;kpC=kpS.surface.albedo*kpS.cavity;`;
   if(name==='brick')sample+='vec2 kpQ=abs(vKpWorldN.x)>abs(vKpWorldN.z)?vKpWorld.zy:vKpWorld.xy;float kpRow=floor(kpQ.y/.075);kpQ.x+=mod(kpRow,2.)*.13;vec2 kpCell=floor(kpQ/vec2(.26,.075));vec2 kpUV=(fract(kpQ/vec2(.26,.075))-.5)*vec2(.26,.075);float kpSeed=br_h11(dot(kpCell,vec2(17.3,31.7)))*113.;KpSurface kpS=kpBrickOriginalSurface(vec3(kpUV.x,kpUV.y,.053),kpSeed,0,.65,kpFp);float kpEdge=min(.13-abs(kpUV.x),.0375-abs(kpUV.y));float kpJoint=1.-smoothstep(.003,.006+kpFp,kpEdge);kpC=mix(kpS.albedo,vec3(.30,.27,.22),kpJoint);kpR=mix(kpS.roughness,.96,kpJoint);kpH=mix(kpS.height,-.002,kpJoint);';
   if(name==='stone')sample+='KpSurface kpS=kpStoneSurface(vKpLocal,0.12,0.,0.,kpFp);kpC=kpS.albedo*vec3(1.32,1.15,.87);kpR=kpS.roughness;kpH=kpS.height;';
   if(name==='roof')sample+='KpStoneSlateParams kpP=kpStoneSlateDefaultParams();KpSurface kpS=kpStoneSlateSurface(vKpWorld,kpP,.12,0.,0.,kpFp);kpC=kpS.albedo;kpR=kpS.roughness;kpH=kpS.height;';
   if(name==='plaster')sample+='KpPlasterParams kpP=KpPlasterParams(vec2(0.),vec2(6.,4.),.025,.002,.0006,.018,.035,.00012,vec3(.46,.42,.32),vec3(.78,.73,.59),.003,.00004,.014);KpPlasterField kpS=kpPlasterOriginalField(vKpLocal,kpP,kpFp);kpC=kpS.surface.albedo;kpR=kpS.surface.roughness;kpH=kpS.surface.height;';
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+sample+'diffuseColor.rgb=kpC;');
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=kpR;');
   s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 kpDx=dFdx(-vViewPosition),kpDy=dFdy(-vViewPosition),kpR1=cross(kpDy,normal),kpR2=cross(normal,kpDx);float kpDet=dot(kpDx,kpR1);normal=normalize(abs(kpDet)*normal-sign(kpDet)*(dFdx(kpH)*kpR1+dFdy(kpH)*kpR2));');
  };m.customProgramCacheKey=()=>name+'-retained-mother-r03';m.needsUpdate=true;
 }
}
