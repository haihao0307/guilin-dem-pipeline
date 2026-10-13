/** Surface finishing only. Folds never enter these color/normal adjustments. */
export function installFoldSkin(viewer){
 const mat=viewer.skin.material,prior=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat),U={uFoldMakeup:{value:0}};
 const patch=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Fold skin anchor changed: '+a);return s.replace(a,()=>b);};
 const report={compiles:0,textureWrinklePainting:false,makeup:'bounded color/roughness/micro-normal finishing; geometry retained',newTextureBytes:0};
 mat.onBeforeCompile=shader=>{prior(shader);Object.assign(shader.uniforms,U);shader.fragmentShader='uniform float uFoldMakeup;\n'+shader.fragmentShader;
  const a='diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);';
  shader.fragmentShader=patch(shader.fragmentShader,a,`float foldFinishMask=clamp(vFA.x,0.,1.)*csCover*(1.-clamp(vFA.y*4.,0.,1.));
   csPaint=mix(csPaint,csTone*vec3(1.015,1.,.99),uFoldMakeup*foldFinishMask*.26);
   ${a}`);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`normal=normalize(mix(normal,nonPerturbedNormal,uFoldMakeup*foldFinishMask*.42));
   roughnessFactor=mix(roughnessFactor,.48,uFoldMakeup*foldFinishMask*.65);
   #include <clearcoat_normal_fragment_maps>`);
  shader.fragmentShader=patch(shader.fragmentShader,'mix(fPores(fMM),cPores(fMM)*uCPores*1.5,uCSkin)','(uCSkin>.5?cPores(fMM)*uCPores*1.5:fPores(fMM))');report.compiles++;
 };
 mat.customProgramCacheKey=()=>key()+'/ET21-geometry-folds-surface-finish';mat.needsUpdate=true;
 return{report,U,update(s){U.uFoldMakeup.value=s.makeup;},dispose(){mat.onBeforeCompile=prior;mat.customProgramCacheKey=key;}};
}
