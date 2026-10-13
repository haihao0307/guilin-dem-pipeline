import * as THREE from '../full/source/registration-vendor/three.module.js';
/** Compose visibility into R05 skin. No painted crescent mask, albedo change,
 * disabled light or flattening of cartilage. Keep the existing surface pores. */
export function attachContinuityMaterial(skin){
 if(skin.earContinuity)return;
 const prior=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material),U={uE6Enabled:{value:1},uE6Debug:{value:0},uE6WorldDirections:{value:[new THREE.Vector3(-1,1,1).normalize(),new THREE.Vector3(1,1,-1).normalize(),new THREE.Vector3(-1,1,1).normalize()]}};
 const declaration=`uniform float uE6Enabled,uE6Debug;uniform vec3 uE6WorldDirections[3];varying vec3 vE6Direct,vE6Deep;varying float vE6Weight;
 vec2 e6Visibility(vec3 direction){float best=-2.;vec2 value=vec2(1.);for(int i=0;i<3;i++){vec3 d=normalize((viewMatrix*vec4(uE6WorldDirections[i],0.)).xyz);float agreement=dot(direction,d);if(agreement>best){best=agreement;value=vec2(vE6Direct[i],vE6Deep[i]);}}return mix(vec2(1.),clamp(value,0.,1.),clamp(vE6Weight,0.,1.)*uE6Enabled);}
 `;
 const patch=(s,a,b)=>{if(!s.includes(a))throw Error('R06 light integration anchor missing: '+a);return s.replace(a,()=>b)};
 skin.material.onBeforeCompile=shader=>{
  prior(shader);Object.assign(shader.uniforms,U);
  shader.vertexShader='attribute vec3 e6Direct,e6Deep;varying vec3 vE6Direct,vE6Deep;varying float vE6Weight;\n'+shader.vertexShader;
  shader.vertexShader=patch(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvE6Direct=e6Direct;vE6Deep=e6Deep;vE6Weight=eWeight;');
  shader.fragmentShader=declaration+'\n'+shader.fragmentShader;
  const from=shader.fragmentShader.indexOf('void RE_Direct_Physical('),to=shader.fragmentShader.indexOf('void RE_IndirectDiffuse_Physical',from);if(from<0||to<0)throw Error('R06 missing retained physical light function');let direct=shader.fragmentShader.slice(from,to);
  direct=patch(direct,'vec3 irradiance = dotNL * directLight.color;','vec2 e6V=e6Visibility(directLight.direction);\n vec3 irradiance = dotNL * directLight.color * e6V.x;');
  direct=patch(direct,'vec3 ccIrradiance = dotNLcc * directLight.color;','vec3 ccIrradiance = dotNLcc * directLight.color * e6V.x;');
  direct=patch(direct,'vec3 etLight=etWrap+etTransport(fNL,eaSetting(vFRest).w,etSoft);','vec3 etLight=etWrap*e6V.x+etTransport(fNL,eaSetting(vFRest).w,etSoft)*e6V.y;\n etOld*=e6V.x;');
  shader.fragmentShader=shader.fragmentShader.slice(0,from)+direct+shader.fragmentShader.slice(to);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`if(uE6Debug>.5&&uE6Debug<1.5)outgoingLight=mix(vec3(.05),vec3(vE6Direct.y),clamp(vE6Weight,0.,1.));if(uE6Debug>1.5)outgoingLight=mix(vec3(.05),vec3(vE6Deep.z),clamp(vE6Weight,0.,1.));\n#include <opaque_fragment>`);skin.earContinuity.compiles++;
 };
 skin.material.customProgramCacheKey=()=>key()+'/EAR-R06-head-occluded-surface-and-transport-v1';skin.earContinuity={version:'EAR-R06.0',compiles:0,paintedMask:false,changesGeometry:false,scopes:'bound pinna only',directAndBacksideVisibilitySeparated:true};
 skin.setEarVisibility=(field,directions,enabled=true)=>{U.uE6Enabled.value=enabled?1:0;directions.forEach((d,i)=>U.uE6WorldDirections.value[i].fromArray(d));skin.earContinuity.field=field.report;};skin.earContinuityDebug=n=>{U.uE6Debug.value=n;skin.viewer.render()};skin.material.needsUpdate=true;
}
