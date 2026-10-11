// Direct invocation of the actual existing A4 function. No shader is rewritten,
// no clone loses its onBeforeCompile, and no image map is introduced.
import {material as originalTrainMaterial,RULE_VERSION} from '../native-a4/frozen/learned-shape/derived/train-shape-only.mjs';
import * as THREE from '../../../vendor/three.module.js';
import {createMaterialLibrary,MATERIAL_REVISION} from '../street/materials.mjs';
export function stationSurfaceCatalog(){
 const spec={
 'cast-iron':['iron','#577267'],'structural-iron':['steel','#83968c'],'roof-metal':['iron','#697d75'],
 'platform-stone':['wall','#bebbae'],'masonry-trim':['paint','#dacbac'],'masonry-joint':['iron','#807869'],
 'hall-brick':['brick','#a07459'],'tower-brick':['brick','#93705b'],'quay-stone':['wall','#8e958b'],
 'roof-copper':['iron','#7a9f91'],'window-glass':['glass','#92b5af'],'brass':['brass','#b8a16a'],
 'clock-face':['paint','#e9e1c4'],'clock-ink':['paint','#304139'],'paint-cream':['paint','#e5dac0'],
 'lamp-glass':['light','#ffdda1'],'sign-enamel':['paint','#3c5a4c'],'road':['coal','#68726a'],
 'mountain-near':['paint','#9baea8'],'mountain-mid':['paint','#adbbb1'],'mountain-far':['paint','#b9c3b8'],'water':['paint','#678e92'],'boat-white':['paint','#e8dfc5'],'boat-green':['paint','#36554c'],'boat-black':['iron','#304239']};
 const street=createMaterialLibrary(THREE,{appearance:{wetness:.06},performance:{limits:{maxMaterials:10}}}),streetRoles={'platform-stone':['concrete',{color:'#b6b3a6',age:.08,repair:.16,wetness:.025,roughness:.87}], 'quay-stone':['concrete',{color:'#9ca69e',age:.20,repair:.06,wetness:.13,roughness:.84}], 'hall-brick':['brick',{color:'#a97c62',age:.18,repair:.12,wetness:.025}], 'tower-brick':['brick',{color:'#a27b64',age:.25,repair:.09,wetness:.04}]};
 const materials=new Map(),compileCalls={},factoryCalls={},proof={source:'existing-A4/derived/train-shape-only.mjs',revision:RULE_VERSION,changedShaderFunctions:false,clonedMaterials:false,imageTextures:0,streetRevision:MATERIAL_REVISION,sourceFunctions:['originalTrainMaterial(role,color,19)','createMaterialLibrary.get(family,options)'],boundParameters:{},stoneMotherRecovered:false,brickMotherRecovered:false,surfaceScope:'existing-game-material-functions;station-art-review-pending',originalFactoryCalls:factoryCalls,originalCompileCalls:compileCalls};
 function get(role){
  if(materials.has(role))return materials.get(role);if(!spec[role])throw Error('Unknown station surface '+role);
  const [sourceRole,color]=spec[role],streetSpec=streetRoles[role];
  const m=streetSpec?street.get(streetSpec[0],{...streetSpec[1],seed:19,groundHeight:11.8,floorHeight:11.8,width:58.7,bays:8}):originalTrainMaterial(sourceRole,color,19);
  factoryCalls[role]=(factoryCalls[role]||0)+1;const original=m.onBeforeCompile;
  m.onBeforeCompile=function(shader,renderer){original.call(m,shader,renderer);compileCalls[role]=(compileCalls[role]||0)+1;if(!shader.fragmentShader.includes(streetSpec?'float stHash(':'float kfb('))throw Error('Original material field did not run');};
  if(role==='cast-iron'){m.metalness=.10;m.roughness=.58;}if(role==='structural-iron'){m.metalness=.40;m.roughness=.43;}if(role==='roof-metal'){m.metalness=.24;m.roughness=.60;}
  proof.boundParameters[role]={source:streetSpec?'KST1-surfaces-2':'A4-function-r01',role:streetSpec?.[0]||sourceRole,color:streetSpec?.[1].color||color,options:streetSpec?.[1]||{},seed:19,metalness:m.metalness,roughness:m.roughness};
  m.name='Station original '+role;m.userData.stationOriginalRole=sourceRole;m.userData.stationSource=streetSpec?'street':'A4';materials.set(role,m);return m;
 }
 return{get,proof,materials,spec,update(view){street.update(view.elapsed,{originOffset:[-68-view.distance,0,0]});}};
}
