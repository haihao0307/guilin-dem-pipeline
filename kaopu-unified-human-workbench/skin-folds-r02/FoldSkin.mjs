/** Surface finishing only. Folds never enter these color/normal adjustments. */
export function installFoldSkin(viewer){
 const mat=viewer.skin.material,prior=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat),U={uFoldMakeup:{value:0}};
 const patch=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Fold skin anchor changed: '+a);return s.replace(a,()=>b);};
 const report={compiles:0,textureWrinklePainting:false,makeup:'bounded color/roughness/micro-normal finishing; geometry retained',newTextureBytes:0,microNormalRetentionAtFullMakeup:.92,uniformRoughnessTarget:false,formulation:'R02 pore-preserving satin, not measured cosmetics'};
 mat.onBeforeCompile=shader=>{prior(shader);Object.assign(shader.uniforms,U);shader.fragmentShader='uniform float uFoldMakeup;\n'+shader.fragmentShader;
  const a='diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);';
  shader.fragmentShader=patch(shader.fragmentShader,a,`float foldFinishMask=clamp(vFA.x,0.,1.)*csCover*(1.-clamp(vFA.y*4.,0.,1.));
   csPaint=mix(csPaint,csTone*vec3(1.015,1.,.99),uFoldMakeup*foldFinishMask*.10);
   ${a}`);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`normal=normalize(mix(normal,nonPerturbedNormal,uFoldMakeup*foldFinishMask*.08));
   roughnessFactor=clamp(roughnessFactor+uFoldMakeup*foldFinishMask*(.035-.018*csT),.30,.90);
   cLobeWeight*=1.-uFoldMakeup*foldFinishMask*.5;
   #include <clearcoat_normal_fragment_maps>`);
  shader.fragmentShader=patch(shader.fragmentShader,'material.clearcoat*=1.-cSkinMask*.92;',`material.clearcoat*=1.-cSkinMask*.92;
   material.clearcoat*=1.-uFoldMakeup*foldFinishMask*.50;
   material.specularColor*=1.-uFoldMakeup*foldFinishMask*.12;`);
  shader.fragmentShader=patch(shader.fragmentShader,'mix(fPores(fMM),cPores(fMM)*uCPores*1.5,uCSkin)','(uCSkin>.5?cPores(fMM)*uCPores*1.5:fPores(fMM))');report.compiles++;
 };
 mat.customProgramCacheKey=()=>key()+'/ET21-r02-pore-preserving-finish';mat.needsUpdate=true;
 return{report,U,update(s){U.uFoldMakeup.value=s.makeup;},dispose(){mat.onBeforeCompile=prior;mat.customProgramCacheKey=key;}};
}
