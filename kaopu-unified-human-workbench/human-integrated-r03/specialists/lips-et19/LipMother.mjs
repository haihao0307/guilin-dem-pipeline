import * as THREE from '../full/source/registration-vendor/three.module.js';
import {LipAnatomyDNA,validateDNA} from './LipAnatomyDNA.mjs';
import {LipRegionTopology} from './LipRegionTopology.mjs';
import {LipBiomechanics} from './LipBiomechanics.mjs';
import {LipPerformance,validatePerformance} from './LipPerformance.mjs';
import {attachLipOptics} from './LipOptics.mjs';
/** Reusable native-surface mother, not another character or an external mesh. */
export function installLipMother(model){const api=model.lipStructure;if(api.mother)return api.mother;
 api.anatomy=new LipAnatomyDNA(api.rails);api.performance=new LipPerformance(model);
 const surfaces=new Map(),archive=model.archive.bind(model),restore=model.restore.bind(model),attach=model.faceSurface.attachSkin;
 model.faceSurface.attachSkin=skin=>{attach(skin);const ids=model.headTransfer?.d?.oral_skin_ids;if(!ids)throw Error('原生口腔分区缺失');const set=new Set(ids),oral=new Float32Array(model.vertexCount);model.canonical.gnmRecipes.forEach(([a,b,t],h)=>{oral[model.bodyCount+h]=(set.has(a)?1-t:0)+(set.has(b)?t:0);});skin.viewer.geometry.setAttribute('l19Oral',new THREE.BufferAttribute(oral,1));attachLipOptics(skin,api);};
 model.archive=()=>({...archive(),lipAnatomyDNA:api.anatomy.archive(),lipPerformance:api.performance.archive(),lipPerformanceContext:{ownerBeforeJaw:api.performance.ownerBeforeJaw}});
 model.restore=o=>{const dna=validateDNA(o?.lipAnatomyDNA||{}),pose=validatePerformance(o?.lipPerformance||{}),oldDNA=api.anatomy.settings,oldPose=api.performance.settings,oldOwner=api.performance.ownerBeforeJaw;try{api.anatomy.settings=dna;api.performance.settings=pose;const owner=o?.lipPerformanceContext?.ownerBeforeJaw;if(owner!==undefined&&owner!==null&&!['gnm','anny','mhr'].includes(owner))throw Error('下颌来源恢复信息无效');api.performance.ownerBeforeJaw=owner||null;const result=restore(o);api.update();return result;}catch(e){api.anatomy.settings=oldDNA;api.performance.settings=oldPose;api.performance.ownerBeforeJaw=oldOwner;api.update();throw e;}};
 api.mother={version:'ET19-L3',surfaces,update(geometry){let item=surfaces.get(geometry);if(!item){const topology=new LipRegionTopology(geometry,api.rails);item=new LipBiomechanics(topology);surfaces.set(geometry,item);}return item.apply(model,api);},dispose(){surfaces.clear();}};return api.mother;
}
