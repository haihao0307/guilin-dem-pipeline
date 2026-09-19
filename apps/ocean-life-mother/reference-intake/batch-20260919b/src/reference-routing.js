/* Additive source-intake adapter, not a replacement KAOPU format or renderer.
 * Source material slots, action states and biological colour changes are distinct.
 * No geometry/texture/rig/track arrays are returned as native assets. */
const ReferenceRouting = (() => {
'use strict';
function requireIndex(i,a,label){if(!Number.isInteger(i)||i<0||i>=a.length)throw Error('Unknown '+label);return a[i];}
function material(m={}){
 const ext=m.extensions||{},alpha=m.alphaMode||'OPAQUE';
 if(!['OPAQUE','MASK','BLEND'].includes(alpha))throw Error('Unknown alpha mode');
 const unlit=Object.hasOwn(ext,'KHR_materials_unlit'),sg=Object.hasOwn(ext,'KHR_materials_pbrSpecularGlossiness');
 if(unlit&&sg)throw Error('Conflicting unlit and specular-glossiness workflows');
 const allowed=new Set(['KHR_materials_unlit','KHR_materials_pbrSpecularGlossiness','KHR_materials_specular','KHR_materials_clearcoat']);
 const unsupported=Object.keys(ext).filter(k=>!allowed.has(k));
 if(unsupported.length)throw Error('Unobserved material extension: '+unsupported.join(','));
 const p=sg?ext.KHR_materials_pbrSpecularGlossiness:(m.pbrMetallicRoughness||{});
 return {workflow:unlit?'unlit':sg?'specular-glossiness':'metallic-roughness',
  sourceMaterialName:m.name||null,alphaMode:alpha,alphaCutoff:alpha==='MASK'?(m.alphaCutoff??.5):null,
  colourSource:{factor:p[sg?'diffuseFactor':'baseColorFactor']||[1,1,1,1],texture:p[sg?'diffuseTexture':'baseColorTexture']||null,vertexColourRequiredIfPresent:true},
  activeLightingChannels:unlit?[]:sg?['specularF0','glossiness','normal','occlusion','emission']:['metalness','roughness','normal','occlusion','emission'],
  originalDefinition:structuredClone(m),
  unknownPhysicalProperties:['measured-roughness','measured-reflectance','biological-colour-change'],
  measuredMaterial:false,relightablePBR:unlit?false:null};
}
function effectiveColour(m,textureRGBA=[1,1,1,1],vertexRGBA=[1,1,1,1]){
 const desc=material(m),factor=desc.colourSource.factor;
 if([textureRGBA,vertexRGBA,factor].some(a=>a.length!==4||a.some(v=>!Number.isFinite(v))))throw Error('Finite RGBA4 required');
 // Inputs already linear RGB; alpha is linear. No color-space conversion hidden here.
 const rgba=factor.map((v,i)=>v*textureRGBA[i]*vertexRGBA[i]);
 rgba[3]=desc.alphaMode==='OPAQUE'?1:desc.alphaMode==='MASK'?(rgba[3]>=desc.alphaCutoff?1:0):rgba[3];
 return rgba;
}
function variantMaterial(doc,meshIndex,primitiveIndex,variant=null){
 const mesh=requireIndex(meshIndex,doc.meshes||[],'mesh'),p=requireIndex(primitiveIndex,mesh.primitives,'primitive');
 const variants=doc.extensions?.KHR_materials_variants?.variants||[],maps=p.extensions?.KHR_materials_variants?.mappings||[],materials=doc.materials||[];
 const seen=new Set();for(const map of maps){requireIndex(map.material,materials,'material');for(const v of map.variants||[]){requireIndex(v,variants,'variant');if(seen.has(v))throw Error('Duplicate variant mapping');seen.add(v);}}
 let index=p.material??null;if(variant!==null){requireIndex(variant,variants,'variant');const mapping=maps.find(m=>m.variants.includes(variant));if(mapping)index=mapping.material;}
 if(index!==null)requireIndex(index,materials,'material');return index;
}
function describe(doc){
 const nodes=doc.nodes||[],meshes=doc.meshes||[],variants=doc.extensions?.KHR_materials_variants?.variants||[];
 const actions=(doc.animations||[]).map((a,index)=>{
  const paths=new Set();for(const c of a.channels||[])paths.add(c.target.path);
  return {index,sourceName:a.name||null,properties:[...paths].sort(),skinTransforms:paths.has('rotation')||paths.has('translation')||paths.has('scale'),morphWeights:paths.has('weights'),physicalSpeed:null,biologicalActionVerified:false};
 });
 const skin=(doc.skins||[]).length>0,morph=meshes.some(m=>m.primitives.some(p=>(p.targets||[]).length>0));
 const materials=(doc.materials||[]).map(material),slots=[];
 meshes.forEach((m,mi)=>m.primitives.forEach((p,pi)=>{variantMaterial(doc,mi,pi,null);slots.push({mesh:mi,primitive:pi,material:p.material??null});}));
 return {schema:'ocean-life-reference-routing-candidate/0.1',role:'source-observation',
  sourceIdentity:structuredClone(doc.asset?.extras||{}),
  motionRepresentation:!actions.length?'static':skin&&morph?'skin-and-morph':skin?'skin':morph?'morph-baked':'node-transform',
  applicationOrder:morph?['morph-deltas','skinning-if-present','scene-transform']:['skinning-if-present','scene-transform'],
  materialSlots:slots,materials,appearanceVariants:variants.map((v,i)=>({index:i,sourceName:v.name||null})),actions,
  continuousColourChange:{status:'not-established',reason:'Material slots or transform/weight animation do not establish biological colour change.'},
  growth:{status:'not-established'},nativeReady:false};
}
function selectableAction(descriptor,index){return structuredClone(requireIndex(index,descriptor.actions,'action'));}
function shareablePair(evidence){
 // Evidence must come from per-channel source comparison, not filenames or visual likeness.
 const eq=(key)=>{const matches=(evidence.geometryArrays||[]).filter(x=>x.attribute===key);return matches.length>0&&matches.every(x=>x.equal===true);};
 return {basePositions:eq('POSITION'),indices:eq('indices'),uv:eq('TEXCOORD_0'),
  normals:eq('NORMAL'),tangents:eq('TANGENT'),
  imagePayloads:Array.isArray(evidence.imagePayloadsExactlyEqual)&&evidence.imagePayloadsExactlyEqual.length>0&&evidence.imagePayloadsExactlyEqual.every(x=>x===true),
  fullAssetDeduplication:false,actionEvidenceMustRemainSeparate:true,sameBiologicalIndividualProven:false};
}
return {material,effectiveColour,variantMaterial,describe,selectableAction,shareablePair};
})();
if(typeof module!=='undefined')module.exports=ReferenceRouting;
