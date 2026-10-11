import * as THREE from '../vendor/three.module.js';
import {CommonSkinLayer} from '../native-head/full/ui/skin/CommonSkinLayer.mjs';
import {installFaceSurface} from '../native-head/face-transfer/FaceSurface.mjs';
import {installFaceSkinBridge} from '../native-head/face-transfer/FaceSkin.mjs';
import {installIdentity} from '../native-head/identity-lab/IdentityModel.mjs';
import {installIdentitySkin} from '../native-head/identity-lab/IdentitySkin.mjs';
import {installNaturalEyes} from '../native-head/eye-materials/NaturalEyeState.mjs';
import {OcularRefinement} from '../native-head/eye-materials/OcularRefinement.mjs';
import {installLipStructure} from '../native-head/lip-structure/LipState.mjs';
import {LipSurface} from '../native-head/lip-structure/LipSurface.mjs';
export const NATIVE_HEAD_REVISION='99defb97123d8101fefddf5aa039991446f557a8';
/** Head-only adapter of the existing unified human result. Keep the very same
 * GNM identities/indices used by hair; do not put another face over a clay head.
 * The body model uses Z-up internally; this local head uses Y-up. Only
 * LipMath's display conversion is adapted in the copied module.
 */
export async function installNativeHead({gnm,positions,geometry,mesh,renderer,render}){
 const N=gnm.numVertices;
 const model={gnm,positions,faces:gnm.triangles,vertexCount:N,bodyCount:0,
  canonical:{gnmRecipes:Array.from({length:N},(_,i)=>[i,i,0]),annyRecipes:[],headTransform:{translation:[0,0,0]},topologySha256:'GNM-native-head/original-indices'},
  anny:{boneLabels:[]},neutral:{boneHeads:new Float32Array(0),vertices:new Float32Array(0)},state:{anny:{phenotypes:{age:.55}}},
  compute(input){this.state=input||this.state;gnm.computeVertices(positions);return positions;},archive(){return{headState:this.state};},restore(o){return this.compute(o?.headState||this.state);}
 };
 installFaceSurface(model);installFaceSkinBridge(model);installIdentity(model);installIdentitySkin(model);installNaturalEyes(model).preset('darkBrown');installLipStructure(model);
 model.faceSurface.set({diffusion:0});
 geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(N*3).fill(1),3));
 const viewer={model,geometry,mesh,material:mesh.material,renderer,render,band:false,wire:false};
 const skin=new CommonSkinLayer(viewer,{tone:.63,warmth:.48,roughness:.62,oil:.14,detail:.72,variation:.34,redness:.30,lipMix:.62});
 await Promise.all([skin.faceReady,skin.naturalEyesReady]);
 if(!skin.faceExtension?.ready||!skin.naturalEyeExtension?.ready)throw Error('人物总工作台皮肤或眼球资产未完成加载；不回退白模。');
 const ocular=new OcularRefinement(geometry),lips=new LipSurface(ocular.geometry,model.lipStructure),display=lips.update(model);mesh.geometry=display;mesh.material=skin.material;mesh.name='single-unified-native-head-ET18-adapter';
 const componentId=new Uint8Array(display.attributes.position.count),T=display.attributes.csType.array;for(let i=0;i<componentId.length;i++)componentId[i]=T[i]>3.5?(display.attributes.position.array[i*3]<0?1:2):0;
 const collisionModel={template:display.attributes.position.array,triangles:display.index.array,componentId,numVertices:componentId.length};
 return {model,skin,geometry:display,collisionModel,
  report(){return{sourceRevision:NATIVE_HEAD_REVISION,sourceModule:'kaopu-unified-human-workbench/lip-structure',nativeVersion:'ET18-L2',baseTopology:'same GNM native head as R13',visibleHeadMeshes:1,bodyLoaded:false,skin:skin.report(),face:skin.faceExtension,eyes:skin.naturalEyeExtension,lips:lips.stats,lipMaterial:skin.lipExtension,ocular:ocular.report(),faceDiffusionEnabled:false,coordinateAdapter:'native Y-up; no rescale or alternative skull',fullBodyViewerMigrated:false};},
  setTone(tone){skin.set({tone});render();},dispose(){lips.dispose();ocular.dispose();skin.dispose();model.identityLab?.dispose();}
 };
}
