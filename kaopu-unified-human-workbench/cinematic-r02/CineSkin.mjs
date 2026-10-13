import {paintTraitMaps} from '../identity-lab/TraitMaps.mjs';
/** Pigment/makeup are optical layers; wrinkle shape is exclusively FoldSurface.
 * Existing identity maps stay untouched. A second, cached NON-WRINKLE trait field
 * supplies freckles, a mole's pigmentation and flat post-acne pigmentation. */
const WRINKLES=['forehead','frown','crowsFeet','underEye','nasolabial','lipLines'];
export function installCineSkin(viewer){
 const mat=viewer.skin.material,previous=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat),api=viewer.model.identityLab;
 const U={uR2Skin:{value:1},uR2Pore:{value:.82},uR2Meso:{value:.5},uR2Makeup:{value:0},uR2Rough:{value:.035},uR2Spec:{value:.78},uR2Lobe:{value:.2},uR2Color:{value:api.maps.color},uR2Height:{value:api.maps.height},uR2Inspect:{value:0}};
 let maps=null,signature='',disposed=false;
 const report={version:'ET21-SKIN-FOLD-R02.0',compiled:0,paintedWrinkleChannels:0,wrinkleHeightTextures:false,independentPigmentFields:true,makeup:'surface color coverage and roughness; never screen-space face blur'};
 const patch=(s,a,b)=>{if(s.split(a).length!==2)throw Error('R02 skin anchor changed: '+a);return s.replace(a,()=>b);};
 mat.customProgramCacheKey=()=>key()+'/R02-optical-skin-no-painted-folds';
 mat.onBeforeCompile=shader=>{
  previous(shader);Object.assign(shader.uniforms,U);report.compiled++;
  // Replace uniforms by reference without overwriting the saved legacy textures.
  shader.uniforms.uIColor=U.uR2Color;shader.uniforms.uIHeight=U.uR2Height;
  shader.fragmentShader='uniform float uR2Skin,uR2Pore,uR2Meso,uR2Makeup,uR2Rough,uR2Spec,uR2Lobe,uR2Inspect;\n'+shader.fragmentShader;
  shader.fragmentShader=patch(shader.fragmentShader,'(fData.r-.5)*.000032*uFDetail','(fData.r-.5)*.000032*uFDetail*mix(1.,uR2Pore*(1.-.72*uR2Makeup),uR2Skin)');
  shader.fragmentShader=patch(shader.fragmentShader,'(fData.g-.5)*.000090*uFMeso','(fData.g-.5)*.000090*uFMeso*mix(1.,uR2Meso*(1.-.80*uR2Makeup),uR2Skin)');
  shader.fragmentShader=patch(shader.fragmentShader,'fPores(fMM)*.000006*uFDetail','fPores(fMM)*.000006*uFDetail*mix(1.,uR2Pore*(1.-.60*uR2Makeup),uR2Skin)');
  shader.fragmentShader=patch(shader.fragmentShader,'float iHeight=(iRelief.r-iRelief.g)*.001*iMask*clamp(csDetail/.72,0.,2.1);','float iHeight=(iRelief.r-iRelief.g)*.001*iMask*clamp(csDetail/.72,0.,2.1)*(1.-uR2Skin);');
  // Disable inherited expression-linked wrinkle contrast. Geometry follows the
  // existing expression basis instead; it is not an extra normal-map crease.
  shader.fragmentShader=patch(shader.fragmentShader,'uIdleWrinkle*(.16*uIdleBlink*vFA.z+.28*uIdleSmile*vFB.y)','uIdleWrinkle*(.16*uIdleBlink*vFA.z+.28*uIdleSmile*vFB.y)*(1.-uR2Skin)');
  shader.fragmentShader=patch(shader.fragmentShader,'diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);',`
   float r2Coverage=uR2Skin*uR2Makeup*fMask*(1.-lpMask)*(1.-vFA.z*.45);
   vec3 r2Foundation=csTone*(1.+csMacro*.026);
   r2Foundation*=vec3(1.+csCheek*.018,1.-csCheek*.014,1.-csCheek*.010);
   csPaint=mix(csPaint,r2Foundation,r2Coverage*.76);
   diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);`);
  // lpMask is defined by the inherited lip material before final color assignment.
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   float r2Skin=fMask*(1.-lpMask)*uR2Skin;
   roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor+uR2Rough,.32,.86),r2Skin);
   roughnessFactor=mix(roughnessFactor,.58-vFA.w*.045,r2Skin*uR2Makeup*.8);
   #include <clearcoat_normal_fragment_maps>`);
  const end='material.clearcoatRoughness=mix(material.clearcoatRoughness,clamp(material.clearcoatRoughness+.065,.20,.65),uIdleSurface*idleDrySkin);';
  shader.fragmentShader=patch(shader.fragmentShader,end,end+`
   material.specularColor=mix(material.specularColor,vec3(.030*uR2Spec),r2Skin);
   material.clearcoat*=1.-r2Skin*.65;
  `);
  const direct='reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
  shader.fragmentShader=patch(shader.fragmentShader,direct,`PhysicalMaterial r2Narrow=material;r2Narrow.roughness=max(.25,material.roughness*.65);float r2Weight=uR2Skin*uR2Lobe*vFA.x*(1.-vFA.y);reflectedLight.directSpecular+=irradiance*mix(BRDF_GGX(directLight.direction,geometryViewDir,geometryNormal,material),BRDF_GGX(directLight.direction,geometryViewDir,geometryNormal,r2Narrow),r2Weight);`);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`
   if(uR2Inspect>3.5&&uR2Inspect<4.5)outgoingLight=diffuseColor.rgb;
   if(uR2Inspect>4.5&&uR2Inspect<5.5)outgoingLight=vec3(roughnessFactor);
   #include <opaque_fragment>`);
 };
 mat.needsUpdate=true;
 return{U,report,update(s,before=false,inspect=0){
  U.uR2Skin.value=s.skin&&!before?1:0;U.uR2Pore.value=s.poreGain;U.uR2Meso.value=s.mesoGain;U.uR2Makeup.value=s.makeup;U.uR2Rough.value=s.roughnessOffset;U.uR2Spec.value=s.specular;U.uR2Lobe.value=s.lobeMix;U.uR2Inspect.value=inspect;
  const traits={...api.traits};for(const k of WRINKLES)traits[k]=0;
  for(const k of ['freckles','acneMarks','moles'])traits[k]=Math.max(traits[k],s[k]);
  if(s.freckles>0){traits.freckleSize=s.freckleSize;traits.freckleContrast=s.freckleContrast;}
  if(s.moles>0){traits.moleX=s.moleX;traits.moleY=s.moleY;traits.moleSize=s.moleSize;}
  traits.seed=s.seed;const next=JSON.stringify(traits);if(next!==signature){const old=maps;maps=paintTraitMaps(traits);signature=next;old?.dispose();report.field=maps.report;}
  U.uR2Color.value=before?api.maps.color:maps.color;U.uR2Height.value=before?api.maps.height:maps.height;
 },dispose(){if(disposed)return;disposed=true;maps?.dispose();mat.onBeforeCompile=previous;mat.customProgramCacheKey=key;mat.needsUpdate=true;}};
}
