/** Explicit A6 instance recipes over the fixed native master library. No vendor edits. */
import {createNativeMaterialLibrary} from '../../student-native-r01/src/native-materials.mjs';
export const A6_MATERIAL_VERSION='a6-native-master-instances/1.1-clear-canopy';
export const A6_INSTANCE_RECIPES=Object.freeze({
 gold:{base:'brushedMetal',color:'#d6af60',metalness:1,roughness:.32,envMapIntensity:.75},
 red:{base:'paint',color:'#a62b24',metalness:0,roughness:.43,envMapIntensity:.60},
 skin:{base:'interior',color:'#b98d72',metalness:0,roughness:.62,envMapIntensity:.50},
 uniform:{base:'interior',color:'#263847',metalness:0,roughness:.67,envMapIntensity:.40},
 seat:{base:'interior',color:'#223b32',metalness:0,roughness:.66,envMapIntensity:.40},
 lamp:{base:'glass',color:'#e8eee7',roughness:.08,envMapIntensity:.12,thicknessM:.008},
 glass:{base:'glass',color:'#eef5f0',roughness:.012,envMapIntensity:.035,transmission:1,ior:1.45},
});
export function createA6MaterialLibrary(T){
 const base=createNativeMaterialLibrary(T);
 return {create(role,options){
  const recipe=A6_INSTANCE_RECIPES[role];
  const material=base.create(recipe?.base??role,options);
  if(!recipe)return material;
  material.color.setStyle(recipe.color,T.SRGBColorSpace);
  for(const key of ['metalness','roughness','envMapIntensity','transmission','ior'])if(recipe[key]!==undefined)material[key]=recipe[key];
  const u=material.userData.uniforms;
  if(u?.uTrainSourceColor){u.uTrainSourceColor.value.set(material.color.r,material.color.g,material.color.b);u.uTrainSourceMetallic.value=material.metalness;u.uTrainSourceRoughness.value=material.roughness;}
  if(recipe.thicknessM!==undefined){material.thickness=recipe.thicknessM;material.userData.opticalThicknessM=recipe.thicknessM;}
  if(role==='glass'||role==='lamp'){material.opacity=1;material.transparent=false;material.depthWrite=true;material.clearcoat=0;}
  if(role==='glass'){
   const before='roughnessFactor=clamp(roughnessFactor+wgDeposit*.45,.045,.8);',after='roughnessFactor=clamp(roughnessFactor+wgDeposit*.45,.008,.8);',compile=material.onBeforeCompile.bind(material);
   material.onBeforeCompile=shader=>{compile(shader);if(shader.fragmentShader.split(before).length!==2)throw Error('A6 clear glazing master roughness clause drift');shader.fragmentShader=shader.fragmentShader.replace(before,after);};
   material.userData.a6GlassDerivative={originalR03VendorUnchanged:true,changes:[{before,after}],purpose:'Clear finite curved glazing instead of inherited demonstration minimum blur; keep full dielectric transmission and deposit field.'};
  }
  material.name=`A6 ${role} · ${A6_MATERIAL_VERSION}`;
  material.userData.a6Instance={version:A6_MATERIAL_VERSION,role,baseRecipe:recipe.base,parameters:{...recipe},shaderFactoryPreserved:true,notes:role==='skin'?'Seated scale/layout mannequin using authored master finish; not detailed skin or anatomical validation.':'Explicit instance override; not original-source pixel equality or final material approval.'};
  const key=material.customProgramCacheKey.bind(material);material.customProgramCacheKey=()=>key()+'|'+A6_MATERIAL_VERSION+'|'+role;
  return material;
 },dispose:()=>base.dispose()};
}
