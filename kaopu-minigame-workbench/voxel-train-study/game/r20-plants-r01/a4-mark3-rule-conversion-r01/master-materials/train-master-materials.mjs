/**
 * A4/Mark3 explicit two-mode adapter to the EXISTING KAOPU master release.
 * Vendored master files are byte-identical. Only the coordinate assignment of
 * each original callback is wrapped; original material field equations remain.
 * Source exact mode is the default. Upgrade is a different, reviewable recipe.
 */
import {makeMetalMaterial,METAL_FIELDS} from './vendor/material-master-r06/metal-surface.mjs';
import {buildGlassCase,GLASS_RECIPE} from './vendor/material-master-r03/wood-glass.mjs';
export const TRAIN_MASTER_VERSION='kaopu.train-master-material-adapter/1';
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
    // Integrity check: all metal field mathematics must remain verbatim.
    if(kind!=='glass'&&!shader.fragmentShader.startsWith(METAL_FIELDS))throw Error('Locked R06 field body changed unexpectedly.');
  };
  material.customProgramCacheKey=()=>originalKey()+'|'+TRAIN_MASTER_VERSION+'|rest-domain';
  return {stage:'vertex coordinate assignment only',original:old,replacement,coreFieldRewritten:false,originalField:'R06 METAL_FIELDS unchanged; R03 glassGLSL unchanged',fixedRestDomain:true};
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
  const kind=options.kind;if(!['coated-steel','zinc','glass'].includes(kind))throw Error('Explicit master kind required: coated-steel, zinc, or glass.');
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
    material=makeMetalMaterial(T,{family:kind==='zinc'?'rack':'sign',variant:options.variant??1,origin:[0,0,0],state,jointOrigins:options.jointOrigins??[]});
    differences=['Existing R06 phase palettes, roughness, metallic coverage and microheight replace the source scalar PBR values.','The original R06 shader overrides baseColor RGB and metallic/roughness fields. It cannot preserve arbitrary source baseColor artwork in the upgraded material.','Metre-labelled field constants operate in the explicitly chosen reference domain. Uncalibrated domain is not physical scale certification.','Wear/history/wet/repair are master static controls, not recovered source weathering or simulated lifetime.'];
  }
  material.side=sourceMaterial.side;
  // Do not accidentally adopt source blending for the master physical glass.
  if(kind!=='glass'){
    material.transparent=sourceMaterial.transparent;material.opacity=sourceMaterial.opacity;material.alphaTest=sourceMaterial.alphaTest;material.depthWrite=sourceMaterial.depthWrite;
    // Keep alpha masks if present; color is knowingly governed by master field.
    if(sourceMaterial.map)material.map=sourceMaterial.map;
  }
  const wrapper=wrapDomain(T,material,domain,kind);
  material.name=(sourceDefinition.name??sourceMaterial.name??'material')+' · master upgrade';
  material.userData.trainMaster={version:TRAIN_MASTER_VERSION,release:MASTER_RELEASE,kind,sourceLock,domain:domain.record,wrapper,differences,sourceEquivalent:false,visualAcceptance:false,sourceTexturesBorrowed:true};
  material.needsUpdate=true;
  return {material,originalMaterial:sourceMaterial,mode,kind,sourceLock,domain:domain.record,wrapper,differences,ownsMaterial:true,dispose(){material.dispose();}};
}
