// Identity marks compose AFTER the existing ET12 skin extension. The native
// complexion, lip color, roughness and all previous layers remain authoritative.
export function installIdentitySkin(model){
 const old=model.faceSurface.attachSkin,api=model.identityLab;
 model.faceSurface.attachSkin=skin=>{old(skin);attachIdentitySkin(skin,api);};
}
function attachIdentitySkin(skin,api){
 if(skin.identityExtension)return;const before=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material),U={uIColor:{value:api.maps.color},uIHeight:{value:api.maps.height},uIEnabled:{value:api.traits.enabled?1:0}};
 const ext={version:'ET13-I1',shaderCompiles:0,source:'deterministic fixed-rest trait fields',silhouetteDisplacement:false};skin.identityExtension=ext;api.skins.add(skin);
 const replace=(s,a,b)=>{if(!s.includes(a))throw Error('原皮肤接口不匹配：'+a);return s.replace(a,()=>b);};
 skin.material.customProgramCacheKey=()=>key()+'/ET13-identity-marks-v1';
 skin.material.onBeforeCompile=shader=>{
  before(shader);Object.assign(shader.uniforms,U);ext.shaderCompiles++;
  shader.fragmentShader=replace(shader.fragmentShader,'#include <common>','#include <common>\nuniform sampler2D uIColor,uIHeight;uniform float uIEnabled;');
  shader.fragmentShader=replace(shader.fragmentShader,'diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);',`
   vec2 iUV=(vFRest.xy*1000.-vec2(-90.,180.))/vec2(180.,225.);
   float iInside=step(0.,iUV.x)*step(iUV.x,1.)*step(0.,iUV.y)*step(iUV.y,1.);
   float iMask=clamp(vFA.x,0.,1.)*csCover*uIEnabled*iInside;
   vec4 iPigment=texture2D(uIColor,clamp(iUV,0.,1.)),iRelief=texture2D(uIHeight,clamp(iUV,0.,1.));
   vec3 iPaint=csPaint*exp(-iPigment.r*vec3(1.05,1.36,1.72));
   iPaint*=vec3(1.+iPigment.g*.18,1.-iPigment.g*.45,1.-iPigment.g*.31);
   iPaint=mix(iPaint,csPaint*1.30+vec3(.045),iPigment.b*.68);
   iPaint=mix(iPaint,vec3(.67,.60,.45),iPigment.a*.65);
   csPaint=mix(csPaint,iPaint,iMask);
   diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);
  `);
  shader.fragmentShader=replace(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   float iHeight=(iRelief.r-iRelief.g)*.001*iMask*clamp(csDetail/.72,0.,2.1);
   vec3 iDX=dFdx(-vViewPosition),iDY=dFdy(-vViewPosition),iR1=cross(iDY,normal),iR2=cross(normal,iDX);float iDet=dot(iDX,iR1);
   if(abs(iDet)>1e-14)normal=normalize(abs(iDet)*normal-sign(iDet)*(dFdx(iHeight)*iR1+dFdy(iHeight)*iR2));
   roughnessFactor=clamp(roughnessFactor+iRelief.b*.12*iMask-iPigment.a*.04*iMask,.24,.95);
   #include <clearcoat_normal_fragment_maps>
  `);
 };
 const previousUpdate=skin.updateFace?.bind(skin),previousDispose=skin.dispose.bind(skin);
 skin.updateIdentity=()=>{U.uIColor.value=api.maps.color;U.uIHeight.value=api.maps.height;U.uIEnabled.value=api.traits.enabled?1:0;ext.fieldHash=api.maps.report.colorHash+'/'+api.maps.report.heightHash;};
 skin.updateFace=()=>{previousUpdate?.();skin.updateIdentity();};skin.dispose=()=>{api.skins.delete(skin);previousDispose();};skin.updateIdentity();skin.material.needsUpdate=true;
}
