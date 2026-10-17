/** Thin instance transport of the actual, unchanged own R08 physical paint factory.
 * No paint shader is authored here. Source maps/UV and full Standard state are borrowed.
 */
import {createTrainMatter} from './vendor/train-r08/materials/matter.mjs';
export const ORIGINAL_PAINT_TRANSPORT_VERSION='kaopu.original-r08-paint-source-instance/1.1';
export function validateBodyClearcoatCandidate(value){
 if(!value||typeof value!=='object'||!Number.isFinite(value.clearcoat)||value.clearcoat<0||value.clearcoat>1||!Number.isFinite(value.clearcoatRoughness??.20)||(value.clearcoatRoughness??.20)<0||(value.clearcoatRoughness??.20)>1||typeof value.reason!=='string'||!value.reason.trim())throw Error('Body clearcoat candidate requires clearcoat 0..1, optional roughness 0..1 and an explicit nonempty reason.');
 return {clearcoat:value.clearcoat,clearcoatRoughness:value.clearcoatRoughness??.20,reason:value.reason.trim()};
}
export function makeOriginalPaintInstance(T,definition,sourceMaterial,options={}){
 if(!sourceMaterial?.isMeshStandardMaterial||sourceMaterial.isMeshPhysicalMaterial)throw Error('Current paint transport supports source Standard glTF semantics only; physical extensions require separate review.');
 if(definition.extensions&&Object.keys(definition.extensions).length)throw Error('Uninterpreted source material extensions cannot be copied as implemented paint behavior.');
 const p=definition.pbrMetallicRoughness??{};
 if(options.paintFinish!==undefined&&options.paintGroup!=='body')throw Error('Optional clearcoat is limited to explicitly selected Body candidates; Roof keeps the source-absence default.');
 const finish=options.paintFinish===undefined?{clearcoat:0,clearcoatRoughness:.20,reason:'No explicit source clearcoat. Preserve source single-layer dielectric semantics by default.'}:validateBodyClearcoatCandidate(options.paintFinish);
 if((p.metallicFactor??1)!==0)throw Error('Paint selection requires source dielectric metallic=0.');
 const all=createTrainMatter(T),material=all.paint;
 for(const m of Object.values(all))if(m?.isMaterial&&m!==material)m.dispose();
 const originalFinish={clearcoat:material.clearcoat,clearcoatRoughness:material.clearcoatRoughness,envMapIntensity:material.envMapIntensity,metalness:material.metalness,roughness:material.roughness,colorLinear:material.color.toArray()};
 const defines={...material.defines},callback=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material),provenance=structuredClone(material.userData.provenance);
 // Call the Standard prototype, not Physical.copy(Standard): keep every normal
 // map/alpha/blend/depth/single-pass flag without inventing missing physical fields.
 T.MeshStandardMaterial.prototype.copy.call(material,sourceMaterial);
 material.defines=defines;material.onBeforeCompile=callback;
 // Existing factory has no public finish argument. These are ordinary instance
 // properties, not edits to the original callback, kernel or material library.
 material.clearcoat=finish.clearcoat;material.clearcoatRoughness=finish.clearcoatRoughness;
 const clearcoatPolicy={sourceExplicitClearcoat:false,paintGroup:options.paintGroup??'unspecified',selection:options.paintFinish===undefined?'source-absence-default':'explicit-per-use-body-candidate',originalFactoryValue:originalFinish.clearcoat,appliedValue:material.clearcoat,appliedRoughness:material.clearcoatRoughness,reason:finish.reason,physicalLayerMeasured:false,instancePropertyOverride:true,fragmentCallbackChanged:false};
 material.customProgramCacheKey=()=>cacheKey()+'|'+ORIGINAL_PAINT_TRANSPORT_VERSION;
 material.userData.sourceRecipe={version:ORIGINAL_PAINT_TRANSPORT_VERSION,kind:'paint',factory:'vendor/train-r08/materials/matter.mjs#createTrainMatter(T).paint',originalFactoryCalled:true,originalFactoryFilesUnchanged:true,paintFragmentShaderRewritten:false,originalProvenance:provenance,originalFinish,clearcoatPolicy,sourcePbr:{baseColorLinear:(p.baseColorFactor??[1,1,1,1]).slice(0,3),alpha:(p.baseColorFactor??[1,1,1,1])[3],metallic:p.metallicFactor??1,roughness:p.roughnessFactor??1},actualInstance:{colorLinear:material.color.toArray(),metalness:material.metalness,roughness:material.roughness,opacity:material.opacity,clearcoat:material.clearcoat,clearcoatRoughness:material.clearcoatRoughness,envMapIntensity:material.envMapIntensity},sourceTextureObjectsBorrowed:true,sourceAlphaAndRenderFlagsCopied:true,addedPhysicalFinish:{clearcoat:material.clearcoat,clearcoatRoughness:material.clearcoatRoughness,active:material.clearcoat>0,measuredOnSource:false},microRelief:{coefficient:.000020,domain:'uncalibrated source-rest reference units',sourceMeasured:false,originalExistingTransportCoefficient:true},roughnessField:{sourceScalarRetained:true,originalNoiseRangeApproximately:[-.06,.06],originalFinalClamp:[.08,.99],sourceZeroAndVerySmoothValuesCanChange:true},colorField:{sourceLinearFactorAndMapRetained:true,originalRgbMultiplierRange:[.94,1.03],sourcePixelEquivalent:false},inferredWeathering:false,visualAcceptance:false};
 return material;
}
