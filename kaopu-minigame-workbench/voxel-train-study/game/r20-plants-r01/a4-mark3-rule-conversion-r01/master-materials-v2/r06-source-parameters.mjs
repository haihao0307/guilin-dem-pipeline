/** Train-only R06 source-surface recipe v2. Original vendored file is unchanged.
 * The derived METAL_FIELDS IS CHANGED: exact, guarded substitutions are below.
 * Noise, analytic gradients, phase/damage/footprint equations retain their source.
 * No zinc assignment is used. Default state has no inferred oil, wear or corrosion.
 */
import {makeMetalMaterial,METAL_FIELDS} from './vendor/material-master-r06/metal-surface.mjs';
export const SOURCE_RECIPE_VERSION='kaopu.r06-source-surface-recipe/2';
export const FIELD_SUBSTITUTIONS=Object.freeze([
 ['uniform float uWear,uHistory,uWet,uRepair,uMode,uVariant,uRack;',
  'uniform float uWear,uHistory,uWet,uRepair,uMode,uVariant,uRack;\nuniform vec3 uTrainSourceColor;uniform float uTrainSourceMetallic,uTrainSourceRoughness,uTrainRoughnessMin,uTrainRoughnessMax,uTrainMicroReliefM;'],
 ['vec3 coat=vec3(.085,.12,.105),undercoat=vec3(.17,.087,.040),steel=vec3(.30,.32,.31);',
  'vec3 coat=uTrainSourceColor,undercoat=vec3(.17,.087,.040),steel=vec3(.30,.32,.31);'],
 ['vec3 coverageDiffuse=coat*intact+undercoat*primer+rust*oxide;',
  'vec3 coverageDiffuse=coat*(1.-uTrainSourceMetallic)*intact+undercoat*primer+rust*oxide;'],
 ['vec3 coverageF0=steel*bare+vec3(.04)*(intact+primer+oxide);',
  'vec3 coverageF0=mix(vec3(.04),coat,uTrainSourceMetallic)*intact+steel*bare+vec3(.04)*(primer+oxide);'],
 ['float metal=bare;', 'float metal=uTrainSourceMetallic*intact+bare;'],
 ['float rough=.43*intact+.72*primer+(.35+.18*pits)*bare+(.78+.17*porous+.045*(1.-fineGate))*oxide;',
  'float rough=uTrainSourceRoughness*intact+.72*primer+(.35+.18*pits)*bare+(.78+.17*porous+.045*(1.-fineGate))*oxide;'],
 ['height+=(micro-.5)*(.000012*(1.-exposed)+.000065*oxide*(.4+.6*porous));',
  'height+=(micro-.5)*(uTrainMicroReliefM*(1.-exposed)+.000065*oxide*(.4+.6*porous));'],
 ['rough=mix(clamp(rough+.10*stain,.16,.98),.22,wet);',
  'rough=mix(clamp(rough+.10*stain,uTrainRoughnessMin,uTrainRoughnessMax),.22,wet);'],
]);
let fields=METAL_FIELDS;
for(const [before,after] of FIELD_SUBSTITUTIONS){
 if(fields.split(before).length!==2)throw Error('Locked R06 token drift in source-surface parameterization: '+before);
 fields=fields.replace(before,after);
}
export const PARAMETERIZED_METAL_FIELDS=fields;
export function sourcePbrParameters(definition){
 const p=definition.pbrMetallicRoughness??{},c=p.baseColorFactor??[1,1,1,1],m=p.metallicFactor??1,r=p.roughnessFactor??1;
 if(c.length!==4||c.some(v=>!Number.isFinite(v)||v<0||v>1)||![m,r].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid source linear PBR factors.');
 return {baseColorLinear:c.slice(0,3),alpha:c[3],metallic:m,roughness:r,roughnessExplicit:'roughnessFactor'in p};
}
/** CPU reference for the inactive-damage source surface; tests the SAME PBR algebra. */
export function intactCoverage(p){
 const coverageDiffuse=p.baseColorLinear.map(c=>c*(1-p.metallic));
 const coverageF0=p.baseColorLinear.map(c=>.04*(1-p.metallic)+c*p.metallic);
 return {coverageDiffuse,coverageF0,metallic:p.metallic,roughness:p.roughness,color:coverageDiffuse.map((d,i)=>d+coverageF0[i]-.04*(1-p.metallic))};
}
export function makeSourceParameterMetalMaterial(T,definition,{kind,microReliefM=.000012}={}){
 if(!['black-painted-steel','dark-iron','bare-metal'].includes(kind))throw Error('Explicit v2 surface interpretation is required.');
 const p=sourcePbrParameters(definition);
 if(kind==='black-painted-steel'&&p.metallic!==0)throw Error('Paint dielectric binding requires source metallic=0.');
 if(kind!=='black-painted-steel'&&p.metallic<=0)throw Error('Metal surface binding requires positive source metallic.');
 if(!Number.isFinite(microReliefM)||microReliefM<0||microReliefM>.000012)throw Error('microReliefM must be 0..0.000012 reference-domain units.');
 // No zinc branch. No exposed substrate or weathering is invented by this v2.
 const material=makeMetalMaterial(T,{family:'sign',variant:0,origin:[0,0,0],state:{wear:0,history:0,wet:0,repair:0,mode:0},jointOrigins:[]});
 const u=material.userData.uniforms;
 Object.assign(u,{uTrainSourceColor:{value:new T.Vector3(...p.baseColorLinear)},uTrainSourceMetallic:{value:p.metallic},uTrainSourceRoughness:{value:p.roughness},uTrainRoughnessMin:{value:0},uTrainRoughnessMax:{value:1},uTrainMicroReliefM:{value:microReliefM}});
 material.color.setRGB(...p.baseColorLinear,T.LinearSRGBColorSpace);material.metalness=p.metallic;material.roughness=p.roughness;
 const original=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=shader=>{original(shader);if(!shader.fragmentShader.startsWith(METAL_FIELDS))throw Error('Locked original R06 prefix drift.');shader.fragmentShader=PARAMETERIZED_METAL_FIELDS+shader.fragmentShader.slice(METAL_FIELDS.length);};
 material.customProgramCacheKey=()=>SOURCE_RECIPE_VERSION+'|'+kind;
 // Do not expose a partially reviewed weathering API through the original update.
 material.userData.update=state=>{if(Object.keys(state).some(k=>k!=='mode'))throw Error('v2 source-surface weathering is locked off; no inferred wear, oil or corrosion.');if(!Number.isFinite(state.mode)||state.mode<0||state.mode>5)throw Error('Diagnostic mode must be 0..5.');u.uMode.value=state.mode;};
 material.userData.sourceRecipe={version:SOURCE_RECIPE_VERSION,kind,sourcePbr:p,intactCoverage:intactCoverage(p),originalFieldByteIdentical:false,substitutionCount:FIELD_SUBSTITUTIONS.length,originalNoiseAndGradientPreserved:true,zincBranchUsed:false,phaseInterpretation:'Generalized intact source surface; substrate alloy is not identified by source appearance.',weathering:{wear:0,history:0,wet:0,repair:0,variant:0,inferredOil:false,editable:false},roughnessLimits:{originalR06:[.16,.98],v2:[0,1],reason:'Source scalar roughness retained; Three r170 inherent BRDF/geometry roughness processing still applies equally to source and candidate.'},microRelief:{coefficient:microReliefM,source:'Existing R06 intact-surface analytic microheight coefficient; exposed as bounded candidate uniform.',calibratedMetres:false,sourceMeasured:false,changesNormals:microReliefM!==0}};
 return material;
}
