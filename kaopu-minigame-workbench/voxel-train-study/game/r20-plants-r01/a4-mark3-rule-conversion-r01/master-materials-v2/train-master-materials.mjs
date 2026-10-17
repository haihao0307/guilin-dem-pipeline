/** Train-only v2 adapter. Original vendor bytes and checkpoint04 remain unchanged.
 * Metal shader recipe is explicitly parameterized in r06-source-parameters.mjs;
 * this is NOT the byte-identical METAL_FIELDS claim made by v1.
 * Source exact remains default; candidates require separate visual acceptance.
 */
import {makeSourceParameterMetalMaterial,PARAMETERIZED_METAL_FIELDS,SOURCE_RECIPE_VERSION} from './r06-source-parameters.mjs';
import {buildGlassCase,GLASS_RECIPE} from './vendor/material-master-r03/wood-glass.mjs';
export const TRAIN_MASTER_VERSION='kaopu.train-master-material-adapter/2';
export const MASTER_RELEASE=Object.freeze({commit:'7577ae37c8bc13bc3f7c0204c1857e83074c257a',threeRevision:'170',metalFieldsFileSha256:'eb41a40ac4960ec3e2b55bc4637ac4dba641f602d6c1f30909778160b1dc029f',selection:'User-selected existing R06 baseline. Individual family/train acceptance remains separately recorded.'});
const METAL_ASSIGNMENT='vRestM=(modelMatrix*vec4(position,1.)).xyz-uOrigin;vSurfaceN=normalize(mat3(modelMatrix)*normal);';
const METAL_REPLACEMENT='vRestM=(uTrainRestDomain*vec4(position,1.)).xyz;vSurfaceN=normalize(uTrainRestNormal*normal);';
const GLASS_ASSIGNMENT='wgGlassPosition=position;';
const GLASS_REPLACEMENT='wgGlassPosition=(uTrainRestDomain*vec4(position,1.)).xyz;';
function domainFor(T,options){
  const a=options.sourceToMaterialMatrix;
  if(!Array.isArray(a)||a.length!==16||a.some(x=>!Number.isFinite(x)))throw Error('sourceToMaterialMatrix must explicitly supply 16 finite column-major numbers.');
  if(!Number.isFinite(options.referenceScale)||options.referenceScale<=0)throw Error('referenceScale must explicitly record positive material-domain units per source unit.');
  if(!['calibrated-metres','uncalibrated-reference'].includes(options.scaleStatus))throw Error('scaleStatus must explicitly be calibrated-metres or uncalibrated-reference.');
  if(options.scaleStatus==='calibrated-metres'&&!options.scaleEvidence)throw Error('Calibrated metre claim requires actual scale evidence.');
  const matrix=new T.Matrix4().fromArray(a);
  if(Math.abs(matrix.determinant())<1e-18)throw Error('Material domain matrix must be invertible.');
  // This is a FIXED source-rest domain, never current mesh.matrixWorld.
  const normal=new T.Matrix3().getNormalMatrix(matrix);
  return {matrix,normal,record:{matrixColumnMajor:[...a],referenceScale:options.referenceScale,scaleStatus:options.scaleStatus,scaleEvidence:options.scaleEvidence??null,frameEvidence:options.frameEvidence??'explicit caller-selected source rest frame; no measured material grain orientation inferred',geometryScaled:false,worldMovementAffectsPattern:false,normalTransform:'inverse transpose of source-to-material matrix',physicalCertification:false}};
}
function wrapDomain(T,material,domain,kind){
  const original=material.onBeforeCompile.bind(material),originalKey=material.customProgramCacheKey.bind(material),old=kind==='glass'?GLASS_ASSIGNMENT:METAL_ASSIGNMENT,replacement=kind==='glass'?GLASS_REPLACEMENT:METAL_REPLACEMENT;
  material.onBeforeCompile=shader=>{
    original(shader);
    if(shader.vertexShader.split(old).length!==2)throw Error('Master coordinate assignment changed; review the wrapper against the locked release.');
    shader.uniforms.uTrainRestDomain={value:domain.matrix};shader.uniforms.uTrainRestNormal={value:domain.normal};
    shader.vertexShader='uniform mat4 uTrainRestDomain;uniform mat3 uTrainRestNormal;\n'+shader.vertexShader.replace(old,replacement);
    // Verify the explicitly versioned DERIVED recipe, not original field equality.
    if(kind!=='glass'&&!shader.fragmentShader.startsWith(PARAMETERIZED_METAL_FIELDS))throw Error('Locked R06 field body changed unexpectedly.');
  };
  material.customProgramCacheKey=()=>originalKey()+'|'+TRAIN_MASTER_VERSION+'|rest-domain';
  return {stage:kind==='glass'?'vertex coordinate assignment only':'vertex rest domain plus explicitly parameterized R06 source-surface recipe',original:old,replacement,coreFieldRewritten:kind!=='glass',originalField:kind==='glass'?'R03 glassGLSL unchanged':'R06 METAL_FIELDS changed by eight guarded substitutions; original vendor unchanged',recipeVersion:kind==='glass'?null:SOURCE_RECIPE_VERSION,fixedRestDomain:true};
}
function extractExistingGlass(T,options){
  const opts={variant:options.variant??0,wear:options.state?.wear??0,strength:options.glassStrength??1,mode:options.state?.mode??0,thickness:options.glassThickness??GLASS_RECIPE.thickness,compareThickness:options.glassThickness??GLASS_RECIPE.thickness};
  const group=buildGlassCase(T,opts),keep=group.userData.materials[0],materials=new Set();
  group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
  for(const m of materials)if(m!==keep)m.dispose();group.clear();
  if(options.glassHalfSize){if(options.glassHalfSize.length!==3||options.glassHalfSize.some(x=>!Number.isFinite(x)||x<=0))throw Error('glassHalfSize requires three positive material-domain lengths.');keep.userData.uniforms.wgHalfSize.value.fromArray(options.glassHalfSize);}
  return keep;
}
export function createTrainMasterMaterial(T,sourceDefinition,sourceMaterial,options={}){
  if(!sourceMaterial)throw Error('Pass the existing source material so exact mode can be restored without reconstruction.');
  const mode=options.mode??'source-exact',sourceLock=structuredClone(sourceDefinition);
  if(mode==='source-exact')return {material:sourceMaterial,originalMaterial:sourceMaterial,mode,sourceLock,differences:[],ownsMaterial:false,dispose(){}};
  if(mode!=='master-upgrade')throw Error('Unknown train material mode');
  if(String(T.REVISION)!==MASTER_RELEASE.threeRevision)throw Error('Existing master uses Three r170. Different engine version requires independent shader validation.');
  const kind=options.kind;if(!['black-painted-steel','dark-iron','bare-metal','glass'].includes(kind))throw Error('Explicit v2 kind required: black-painted-steel, dark-iron, bare-metal, or glass.');
  const domain=domainFor(T,options),state={wear:0,history:0,wet:0,repair:0,mode:0,...options.state};
  for(const k of ['wear','history','wet','repair','mode'])if(!Number.isFinite(state[k]))throw Error('Invalid master state '+k);
  if((options.jointOrigins??[]).some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x))))throw Error('Invalid joint origin in material domain');
  let material,differences;
  if(kind==='glass'){
    material=extractExistingGlass(T,{...options,state});
    // Borrow the original binding objects, preserving UV channels, transforms,
    // sampler and texture color-space state. Do not dispose borrowed textures.
    for(const key of ['map','normalMap','normalMapType','normalScale','aoMap','aoMapIntensity','emissiveMap','emissive','emissiveIntensity']){
      if(sourceMaterial[key]!==undefined&&sourceMaterial[key]!==null){const v=sourceMaterial[key];material[key]=v?.isVector2||v?.isColor?v.clone():v;}
    }
    if((sourceDefinition.alphaMode??'OPAQUE')==='MASK')material.alphaTest=sourceDefinition.alphaCutoff??.5;
    differences=['Existing R03 finite glass recipe replaces source alpha-glass optical behavior: transmission, IOR, attenuation and optical thickness are active.','Source primitive geometry is unchanged. Closed volume, physical thickness and optical-thickness agreement are not established.','Original source map/UV/sampler references and MASK cutoff are retained. BLEND opacity is replaced by the existing physical transmission recipe.','Existing R03 tint/roughness are used; this is an explicit upgrade, not source-equivalent appearance.','Optional deposit field stays in the fixed caller-selected source-rest domain.'];
  }else{
    if(['wear','history','wet','repair'].some(k=>state[k]!==0))throw Error('v2 source-surface weathering remains locked off.');
    material=makeSourceParameterMetalMaterial(T,sourceDefinition,{kind,microReliefM:options.microReliefM??.000012});
    for(const key of ['normalMap','normalMapType','normalScale','aoMap','aoMapIntensity','emissiveMap','emissive','emissiveIntensity']){
      if(sourceMaterial[key]!==undefined&&sourceMaterial[key]!==null){const v=sourceMaterial[key];material[key]=v?.isVector2||v?.isColor?v.clone():v;}
    }
    differences=['Train v2 parameterizes the intact R06 phase using exact source linear RGB, metallic and roughness; this is a changed shader recipe, not original METAL_FIELDS equality.',
      'Diffuse coverage C*(1-M), conductor/dielectric F0 mix(.04,C,M), metallic and roughness are changed coherently. No zinc branch is used.',
      'Original R06 roughness clamp [.16,.98] is parameterized to [0,1] to retain source R=0 and other factors. The same Three r170 BRDF processing still applies.',
      'Default wear/history/wet/repair/variant are zero; no oil, corrosion or aging is inferred. These controls are locked off in v2.',
      'Existing analytic microheight coefficient remains .000012 in an uncalibrated reference domain; its normal effect is an explicit, unmeasured candidate detail, not source equivalence.',
      'Original source definition, geometry and texture binding objects remain available for exact restoration.'];
  }
  material.side=sourceMaterial.side;
  // Do not accidentally adopt source blending for the master physical glass.
  if(kind!=='glass'){
    material.transparent=sourceMaterial.transparent;material.opacity=sourceMaterial.opacity;material.alphaTest=sourceMaterial.alphaTest;material.depthWrite=sourceMaterial.depthWrite;
    // Keep alpha masks if present; color is knowingly governed by master field.
    if(sourceMaterial.map)material.map=sourceMaterial.map;
  }
  const wrapper=wrapDomain(T,material,domain,kind);
  material.name=(sourceDefinition.name??sourceMaterial.name??'material')+' · master v2 candidate';
  material.userData.trainMaster={version:TRAIN_MASTER_VERSION,release:MASTER_RELEASE,kind,sourceLock,sourceRecipe:material.userData.sourceRecipe??null,domain:domain.record,wrapper,differences,sourceEquivalent:false,visualAcceptance:false,sourceTexturesBorrowed:true};
  material.needsUpdate=true;
  return {material,originalMaterial:sourceMaterial,mode,kind,sourceLock,domain:domain.record,wrapper,differences,ownsMaterial:true,dispose(){material.dispose();}};
}
