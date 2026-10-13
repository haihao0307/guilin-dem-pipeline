import {EYE_SURFACE_VERSION,validateEyeSurface} from './EyeSurfaceMath.mjs';

// Three caches programs per material/key and skips onBeforeCompile on reuse.
// Each removable closure owns fresh uniforms, so a new installation needs a key.
let installationSerial=0;
const declarations=`
// Original R54 surface adapter. No sampler, replacement chart or geometry field.
uniform float uR54EyeEnabled,uR54PupilFeather,uR54LimbusSoftness;
uniform float uR54AngularWidth,uR54ReflectionStrength,uR54Wetness;
float r54FiniteSourceReflection(vec3 n,vec3 lightDirection){
 vec3 V=normalize(vViewPosition),L=normalize(lightDirection),R=reflect(-V,n);
 vec3 X=normalize(cross(abs(L.y)>.98?vec3(1.,0.,0.):vec3(0.,1.,0.),L)),Y=cross(L,X);
 float forward=dot(R,L);vec2 q=vec2(dot(R,X),dot(R,Y))/max(forward,.001);
 float a=uR54AngularWidth,soft=max(fwidth(q.x)+fwidth(q.y),.012);
 float box=(1.-smoothstep(a-soft,a+soft,abs(q.x)))*(1.-smoothstep(1.8*a-soft,1.8*a+soft,abs(q.y)))*step(0.,forward);
 return box*(.025+.975*pow(1.-clamp(dot(V,n),0.,1.),5.));
}
`;
const EDGE='float iris=1.-smoothstep(1.-aa,1.+aa,r),pupil=1.-smoothstep(pupilR-aa,pupilR+aa,r);';
const CLEARCOAT='material.clearcoat=.52;material.clearcoatRoughness=uE1WetRoughness;';
function replaceExactlyOnce(source,anchor,replacement){
 if(source.split(anchor).length!==2)throw Error('R54 eye surface contract changed: '+anchor);
 return source.replace(anchor,()=>replacement);
}
/** Run after the unchanged R05EyeBridge + NativeEyeOptics hooks. Fail atomically. */
export function patchNativeEyeSurface(shader,uniforms){
 let fragment=shader.fragmentShader;
 for(const token of ['uniform sampler2D uE1Atlas;','float irisMM=mix(uE1IrisRadiusMM.x,uE1IrisRadiusMM.y,step(.5,vFEye.w));','e1OuterNormal=normal;','uniform float csLipMix'])if(!fragment.includes(token))throw Error('R54 requires the pinned R05/E1 eye shader: '+token);
 fragment=replaceExactlyOnce(fragment,'vec3 e1IrisColor(){',declarations+'\nvec3 e1IrisColor(){');
 fragment=replaceExactlyOnce(fragment,EDGE,`float irisAA=max(aa,uR54EyeEnabled*uR54LimbusSoftness),pupilAA=max(aa,uR54EyeEnabled*uR54PupilFeather);
 float iris=1.-smoothstep(1.-irisAA,1.+irisAA,r),pupil=1.-smoothstep(pupilR-pupilAA,pupilR+pupilAA,r);`);
 // Replace E1's extra tear clearcoat while the finite-source surface is enabled.
 // The native base BRDF, iris tissue response and all skin material remain intact.
 fragment=replaceExactlyOnce(fragment,CLEARCOAT,'material.clearcoat=.52*(1.-uR54EyeEnabled);material.clearcoatRoughness=uE1WetRoughness;');
 fragment=replaceExactlyOnce(fragment,'#include <opaque_fragment>',`
 // Derivatives run across the whole quad, before the varying eye-only gate.
 vec3 r54Reflection=vec3(0.);
 #if NUM_DIR_LIGHTS > 0
 for(int r54Light=0;r54Light<NUM_DIR_LIGHTS;r54Light++){
  r54Reflection+=directionalLights[r54Light].color*r54FiniteSourceReflection(normalize(e1OuterNormal),directionalLights[r54Light].direction);
 }
 #endif
 if(uE1Enabled>.5&&uR54EyeEnabled>.5&&vFEye.z>.01&&vCSType>3.5&&csLayer<.5){
  float r54Cornea=1.-smoothstep(1.,1.28,length(vFEye.xy));
  outgoingLight+=r54Reflection*uR54ReflectionStrength*uR54Wetness*mix(.20,1.,r54Cornea)*vFEye.z;
 }
 #include <opaque_fragment>
 `);
 Object.assign(shader.uniforms,uniforms);shader.fragmentShader=fragment;return shader;
}

/** Install immediately after attachAppearanceR52. No THREE import is required.
 * Returns a removable layer; owning E1 disposal also removes this layer first. */
export function attachNativeEyeSurfaceR54(skin,{parameters={},deferInitialRender=false}={}){
 if(skin?.nativeEyeSurfaceR54)return skin.nativeEyeSurfaceR54;
 if(skin?.faceExtension?.version!=='R05-eye-chart-only/1'||!skin.eyeOptics)throw Error('Attach the frozen R05EyeBridge before R54 eye surface');
 let p=validateEyeSurface(parameters),disposed=false,compiles=0;const installation=++installationSerial;
 const mat=skin.material,eye=skin.eyeOptics,previousCompile=mat.onBeforeCompile,previousKey=mat.customProgramCacheKey,previousEyeDispose=eye.dispose;
 const U={uR54EyeEnabled:{value:0},uR54PupilFeather:{value:0},uR54LimbusSoftness:{value:0},uR54AngularWidth:{value:0},uR54ReflectionStrength:{value:0},uR54Wetness:{value:0}};
 function sync(){for(const[k,n]of Object.entries({enabled:'uR54EyeEnabled',pupilFeather:'uR54PupilFeather',limbusSoftness:'uR54LimbusSoftness',angularWidth:'uR54AngularWidth',reflectionStrength:'uR54ReflectionStrength',wetness:'uR54Wetness'}))U[n].value=k==='enabled'?(p[k]?1:0):p[k];}
 const compile=function(shader,...args){previousCompile.call(this,shader,...args);patchNativeEyeSurface(shader,U);compiles++;};
 const cacheKey=function(){return previousKey.call(this)+'/'+EYE_SURFACE_VERSION+'/installation-'+installation;};
 const wrappedDispose=function(...args){api.dispose();return previousEyeDispose.apply(this,args);};
 const api={uniforms:U,report(){return {version:EYE_SURFACE_VERSION,installation,parameters:{...p},compiles,disposed,geometryChanged:false,eyeAxisChanged:false,eyelidsChanged:false,irisSource:'unchanged original procedural IrisField/E1',edgeUnits:'fraction of fixed bind iris radius, not millimetres on the deformed eye',newImages:0,newTextures:0,reflection:'actual Three directionalLights view-space direction and linear color; finite rectangular source approximation',contactShading:false,contactReason:'R05 has no verified eyeSurface intersection field; no painted socket or seam shadow is introduced',refraction:false,clinicalMeasurement:false,visualAcceptance:false};},set(patch={}){if(disposed)throw Error('R54 eye surface disposed');if(!patch||typeof patch!=='object'||Array.isArray(patch))throw TypeError('Eye surface patch must be an object');p=validateEyeSurface({...p,...patch});sync();skin.viewer.render();return api.report();},enabled(value){return api.set({enabled:value});},dispose(){if(disposed)return;if(mat.onBeforeCompile!==compile||mat.customProgramCacheKey!==cacheKey||eye.dispose!==wrappedDispose)throw Error('Dispose later eye material extensions before R54');mat.onBeforeCompile=previousCompile;mat.customProgramCacheKey=previousKey;eye.dispose=previousEyeDispose;delete skin.nativeEyeSurfaceR54;disposed=true;mat.needsUpdate=true;}};
 sync();mat.onBeforeCompile=compile;mat.customProgramCacheKey=cacheKey;eye.dispose=wrappedDispose;skin.nativeEyeSurfaceR54=api;mat.needsUpdate=true;if(!deferInitialRender)skin.viewer.render();return api;
}
