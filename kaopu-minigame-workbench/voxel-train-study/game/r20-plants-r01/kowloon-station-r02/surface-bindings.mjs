// Direct invocation of the actual existing A4 function. No shader is rewritten,
// no clone loses its onBeforeCompile, and no image map is introduced.
import {material as originalTrainMaterial,RULE_VERSION} from '../native-a4/frozen/learned-shape/derived/train-shape-only.mjs';
export function stationSurfaceCatalog(){
 const spec={
 'cast-iron':['iron','#577267'],'structural-iron':['steel','#83968c'],'roof-metal':['iron','#697d75'],
 'platform-stone':['wall','#bebbae'],'masonry-trim':['paint','#dacbac'],'masonry-joint':['iron','#807869'],
 'hall-brick':['brick','#a07459'],'tower-brick':['brick','#93705b'],'quay-stone':['wall','#8e958b'],
 'roof-copper':['iron','#7a9f91'],'window-glass':['glass','#92b5af'],'brass':['brass','#b8a16a'],
 'clock-face':['paint','#e9e1c4'],'clock-ink':['paint','#304139'],'paint-cream':['paint','#e5dac0'],
 'lamp-glass':['light','#ffdda1'],'sign-enamel':['paint','#3c5a4c'],'road':['coal','#68726a'],
 'mountain-near':['paint','#9baea8'],'mountain-mid':['paint','#adbbb1'],'mountain-far':['paint','#b9c3b8'],'water':['paint','#678e92'],'boat-white':['paint','#e8dfc5'],'boat-green':['paint','#36554c'],'boat-black':['iron','#304239']};
 const materials=new Map(),compileCalls={},factoryCalls={},proof={source:'existing-A4/derived/train-shape-only.mjs',revision:RULE_VERSION,changedShaderFunctions:false,clonedMaterials:false,imageTextures:0,stoneMotherRecovered:false,brickMotherRecovered:false,surfaceScope:'existing-game-material-functions;station-art-review-pending',originalFactoryCalls:factoryCalls,originalCompileCalls:compileCalls};
 function get(role){if(materials.has(role))return materials.get(role);if(!spec[role])throw Error('Unknown station surface '+role);const [sourceRole,color]=spec[role],m=originalTrainMaterial(sourceRole,color,19);factoryCalls[role]=(factoryCalls[role]||0)+1;const original=m.onBeforeCompile;m.onBeforeCompile=function(shader,renderer){original.call(m,shader,renderer);compileCalls[role]=(compileCalls[role]||0)+1;if(!shader.fragmentShader.includes('float kfb('))throw Error('Original A4 field did not run');};m.name='Station original-A4 '+role;m.userData.stationOriginalRole=sourceRole;materials.set(role,m);return m;}
 return{get,proof,materials,spec};
}
