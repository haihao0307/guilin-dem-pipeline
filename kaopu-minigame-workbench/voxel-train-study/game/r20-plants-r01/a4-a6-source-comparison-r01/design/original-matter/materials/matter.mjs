/** Reusable train transport of verified KAOPU mothers. Units: metres. */
import {bindOriginalTrainMaterials} from '../source-audit/metal-original.mjs';
import {createWood,WALNUT_PRESET,woodMacroHeight} from './wood-adapter.mjs';
import {createLeather,LEATHER_RECIPE,leatherField} from './leather-adapter.mjs';
export {WALNUT_PRESET,LEATHER_RECIPE,woodMacroHeight,leatherField};
export function createTrainMatter(T){
 const fh88=bindOriginalTrainMaterials(T);
 function physical(role,color,seed,extra={}){const original=fh88(role,color,seed),m=new T.MeshPhysicalMaterial({color,metalness:original.metalness,roughness:original.roughness,...extra});m.name='FH88 / '+role;m.onBeforeCompile=s=>{original.onBeforeCompile(s);if(role==='paint'){const token='(kn(kq*65.)-.5)*.00025';if(!s.fragmentShader.includes(token))throw Error('FH88_ENAMEL_BINDING_SOURCE_DRIFT');s.uniforms.fh88FinishReliefM={value:.000020};s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float fh88FinishReliefM;').replace(token,'(kn(kq*65.)-.5)*fh88FinishReliefM');}};m.customProgramCacheKey=()=>original.customProgramCacheKey()+'/physical-transport-r02-'+(role==='paint'?'20um':'original');m.userData.provenance={mother:'source-audit/metal-original.mjs',rule:'RAIL_FUNCTION_RULES_R01',transport:'Three MeshPhysicalMaterial with original FH88 colour, roughness and normal field callback',finish:extra,normalReliefM:role==='paint'?.000020:.00025,normalReliefTransport:role==='paint'?'Original FH88 kernel, explicit 20 micrometre enamel amplitude binding':'Original FH88 amplitude',ageLaw:'no new universal aging field'};return m;}
 const paint=physical('paint','#103e35',11,{roughness:.245,clearcoat:.84,clearcoatRoughness:.20,metalness:0});
 const brass=physical('brass','#c89849',21,{metalness:.94,roughness:.255,clearcoat:.10,clearcoatRoughness:.29});
 const steel=physical('steel','#b9c2c6',31,{metalness:.92,roughness:.27});
 const iron=physical('iron','#262a2a',41,{metalness:.69,roughness:.50});
 const {material:wood,geometry:woodGeometry}=createWood(T),{material:leather,geometry:leatherGeometry}=createLeather(T);
 const glass=new T.MeshPhysicalMaterial({color:'#e0eee8',metalness:0,roughness:.045,transmission:.91,thickness:.014,ior:1.52,attenuationColor:'#b5cfbd',attenuationDistance:3.5,transparent:true,opacity:1,side:T.FrontSide});glass.name='Finite carriage glass / limited new transport';glass.userData.provenance={mother:null,status:'new limited dielectric transport, not recovered mature glass',geometryRequirement:'closed finite-thickness pane geometry; positive 14 mm optical thickness',limitations:'Three screen-space transmission; no architectural multiple-reflection certification'};
 const black=physical('iron','#121719',61,{roughness:.43,metalness:.48});
 const emissive=new T.MeshPhysicalMaterial({color:'#ffdaa0',emissive:'#ffd29a',emissiveIntensity:2.7,roughness:.28,metalness:0});emissive.name='Warm carriage lamp diffuser';
 paint.envMapIntensity=.20;brass.envMapIntensity=2.5;steel.envMapIntensity=1.3;iron.envMapIntensity=.9;black.envMapIntensity=.7;wood.envMapIntensity=.7;leather.envMapIntensity=.65;glass.envMapIntensity=1.0;return {paint,brass,steel,iron,wood,leather,glass,black,emissive,woodGeometry,leatherGeometry};
}
