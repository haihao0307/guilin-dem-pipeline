import * as THREE from '../full/source/registration-vendor/three.module.js';
const patch=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Exit visibility anchor drift: '+a.slice(0,90));return s.replace(a,()=>b);};
const exitLookup=`
float lfExitShadow(sampler2D map,vec2 size,vec4 coord){
 vec3 p=coord.xyz/coord.w;
 if(coord.w<=0.||p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z<=0.||p.z>=1.)return 0.;
 float result=0.;for(int k=0;k<4;k++){
  vec2 offset=vec2((k==0||k==2)?-.65:.65,k<2?-.65:.65)/size;
  float depth=unpackRGBAToDepth(texture2D(map,p.xy+offset));result+=step(p.z-.000022,depth);
 }return result*.25;
}
`;
/** Transmission exit is estimated from the retained pinna thickness and a
 * directional shadow lookup. Not a ray-traced boundary intersection or a
 * measured volumetric solver. Surface diffuse/specular use receiver shadows. */
export function patchExitVisibility(shader){
 let s=shader.fragmentShader;
 s='vec3 lfTransmissionLight=vec3(0.);\n#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0\nuniform mat4 directionalShadowMatrix[NUM_DIR_LIGHT_SHADOWS];\n#endif\n'+s;
 s=patch(s,'vec2 cubeToUV',exitLookup+'\nvec2 cubeToUV');
 let lights=THREE.ShaderChunk.lights_fragment_begin;
 const info='getDirectionalLightInfo( directionalLight, directLight );';
 lights=patch(lights,info,info+`
  lfTransmissionLight=directLight.color;
  if(uLFShadowActive>.5)lfTransmissionLight=vec3(0.);
 `);
 const assignment='directionalLightShadow = directionalLightShadows[ i ];';
 lights=patch(lights,assignment,assignment+`
  if(uLFShadowActive>.5&&lfEar>.001&&vETissue.w>.25){
   vec3 lfWorldLight=inverseTransformDirection(directLight.direction,viewMatrix);
   float lfTravel=clamp(vETissue.x*.001/max(abs(dot(nonPerturbedNormal,directLight.direction)),.40),.00015,.020);
   vec3 lfExit=vCWorld+lfWorldLight*(lfTravel+.00025);
   vec4 lfExitCoord=directionalShadowMatrix[i]*vec4(lfExit,1.);
   lfTransmissionLight=directLight.color*lfExitShadow(directionalShadowMap[i],directionalLightShadow.shadowMapSize,lfExitCoord);
  }
 `);
 s=patch(s,'#include <lights_fragment_begin>',lights);
 s=patch(s,'lfAngular=mix(lfAngular,vec3(max(fNL,0.))+lfTransmit,lfEar*uLFGuard);','lfAngular=mix(lfAngular,vec3(max(fNL,0.)),lfEar*uLFGuard);');
 const apply='reflectedLight.directDiffuse+=lfAngular*directLight.color*BRDF_Lambert(material.diffuseColor);';
 s=patch(s,apply,apply+'\nreflectedLight.directDiffuse+=lfTransmit*lfTransmissionLight*BRDF_Lambert(material.diffuseColor)*lfEar*uLFGuard;');
 s=patch(s,'if(abs(lfDet)>1e-14){','if(abs(lfDet)>1e-14&&lfEye>.0001){');
 shader.fragmentShader=s;
}
