import * as THREE from '../../../vendor/three.module.js';
import {createPandanus} from './pandanus.mjs';

// Four individually authored placements only. Not tiled with the old terrain.
// Metres are the inherited source's engineering authoring units, not measured
// botanical specimen dimensions. Growth parameters alter native geometry.
export const PLANT_SEGMENT=Object.freeze({id:'native-pandanus-young-street-first-leg-r02',fromStation:0,toStation:1,sceneMetres:700,groundY:.081,railHalfClearance:1.6,breezeAnglesRadians:[.008,.013],breezeFrequenciesRadiansPerSecond:[1.1,1.35],visibilityRadius:175,sourceSpecies:'Pandanus',growthAgeIsChronologicalYears:false,selectedHeightRangeMetres:[2,3],sourceQuality:'KAOPU R05 research generator; not a botanical scan or final AAA certification'});
export const PLANT_PLACEMENTS=Object.freeze([
  Object.freeze({id:'kowloon-verge',chainage:-34,z:-4.55,yaw:0,seed:50721,params:Object.freeze({age:16,resource:.70,space:.55,leafDensity:.90})}),
  Object.freeze({id:'kowloon-exit',chainage:12,z:-4.55,yaw:0,seed:50731,params:Object.freeze({age:18,resource:.70,space:.55,leafDensity:.90})}),
  Object.freeze({id:'bridge-verge',chainage:365,z:-6.2,yaw:0,seed:50741,params:Object.freeze({age:20,resource:.70,space:.55,leafDensity:.90})}),
  Object.freeze({id:'yaumati-approach',chainage:666,z:-4.4,yaw:0,seed:50751,params:Object.freeze({age:16,resource:.70,space:.55,leafDensity:.90})}),
]);
export function createNativePlantSegment(){
  const root=new THREE.Group();root.name='Four young native Pandanus plants — street-scale R02';
  const items=PLANT_PLACEMENTS.map(spec=>{const plant=createPandanus({seed:spec.seed,params:spec.params});plant.root.name='Native Pandanus '+spec.id;plant.root.position.set(spec.chainage,PLANT_SEGMENT.groundY,spec.z);plant.root.rotation.y=spec.yaw;root.add(plant.root);return{spec,plant};});
  let disposed=false,distance=0,elapsed=0;
  function update(view){if(disposed)return;if(!Number.isFinite(view?.distance)||!Number.isFinite(view?.elapsed))throw Error('Plants need finite authoritative Session distance and elapsed');distance=view.distance;elapsed=view.elapsed;root.position.x=-distance;for(const {spec,plant}of items){plant.root.visible=Math.abs(spec.chainage-distance+8)<=PLANT_SEGMENT.visibilityRadius;if(plant.root.visible)plant.update(elapsed);}}
  function snapshot(){return{...PLANT_SEGMENT,disposed,distance,elapsed,count:items.length,active:items.filter(({plant})=>plant.root.visible).length,externalMeshes:false,externalTextures:false,ownAnimationLoop:false,worldGeometryScale:1,plants:items.map(({spec,plant})=>({id:spec.id,species:'Pandanus',chainage:spec.chainage,position:[spec.chainage-distance,PLANT_SEGMENT.groundY,spec.z],yaw:spec.yaw,visible:plant.root.visible,seed:spec.seed,params:{...spec.params},proof:plant.proof}))};}
  function dispose(){if(disposed)return;disposed=true;for(const {plant}of items)plant.dispose();root.clear();root.removeFromParent();}
  update({distance:0,elapsed:0});return{root,items,update,snapshot,dispose};
}
