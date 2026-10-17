/** v2: exact parser tuple + audited per-primitive semantics + source PBR recipe. */
import {createTrainMasterMaterial,TRAIN_MASTER_VERSION} from './train-master-materials.mjs';
import {SOURCE_SEMANTIC_BINDINGS as SPEC} from './source-semantic-bindings.mjs';
export const TRAIN_BINDING_VERSION='kaopu.train-master-binding/2';
const tuple=e=>[e.source,e.materialIndex,e.nodeIndex,e.meshIndex,e.primitiveIndex].join(':');
const allowed=new Map(SPEC.selectedPrimitives.map(e=>[tuple(e),e]));
const excluded=new Map(SPEC.retainedPreviousV1Uses.map(e=>[tuple(e),e]));
export function selectMasterKind(definition,context={}){
 const p=definition.pbrMetallicRoughness??{};
 if(p.baseColorTexture||p.metallicRoughnessTexture)return {selected:false,reason:'Source color/metallic/roughness texture binding retained; v2 scalar recipe cannot replace texture fields.'};
 if(definition.extensions&&Object.keys(definition.extensions).length)return {selected:false,reason:'Source material extensions retained without interpretation.'};
 const e=allowed.get(tuple(context));
 if(!e)return {selected:false,reason:excluded.get(tuple(context))?.reason??'Outside the audited v2 per-node/mesh/primitive allowlist. Body/Roof/artwork/plastic and other uses retain source.'};
 const expected=SPEC.parameters[context.source]?.[context.materialIndex];
 if(!expected||definition.name!==expected.name||JSON.stringify(p.baseColorFactor??[1,1,1,1])!==JSON.stringify(expected.baseColorFactor)||(p.metallicFactor??1)!==expected.metallicFactor||(p.roughnessFactor??1)!==expected.roughnessFactor||('roughnessFactor'in p)!==expected.roughnessWasExplicit)return {selected:false,reason:'Source definition differs from the audited v2 PBR instance; no fallback.'};
 if(e.kind!=='glass'&&(definition.alphaMode??'OPAQUE')!=='OPAQUE')return {selected:false,reason:'Non-glass alpha mode is outside this candidate.'};
 return {selected:true,kind:e.kind,reason:e.reason,parentName:e.parentName,sourcePbr:expected};
}
function primitiveContext(mesh,parser,g,source,index,slot){
 const a=parser.associations.get(mesh),mi=a?.meshes,pi=a?.primitives;
 if(!Number.isInteger(mi)||!Number.isInteger(pi)||slot!==0)return null;
 let ni=a?.nodes;
 if(!Number.isInteger(ni)){for(let p=mesh.parent;p;p=p.parent){const n=parser.associations.get(p)?.nodes;if(Number.isInteger(n)&&g.nodes?.[n]?.mesh===mi){ni=n;break;}}}
 if(!Number.isInteger(ni)||g.nodes?.[ni]?.mesh!==mi||g.meshes?.[mi]?.primitives?.[pi]?.material!==index)return null;
 return {source,materialIndex:index,nodeIndex:ni,meshIndex:mi,primitiveIndex:pi};
}
export function installTrainMaster(T,source){
 const model=source?.model,root=source?.root??model?.scene,parser=model?.parser,g=source?.g??parser?.json;
 if(!root||!parser?.associations||!g?.materials)throw Error('installTrainMaster requires source.root, source.model.parser.associations and glTF definitions.');
 const verifiedRest=source.materialRestMatrices;
 if(!verifiedRest&&source.sourceRestConfirmed!==true)throw Error('Captured source.materialRestMatrices is required; current animated pose is not rest.');
 if(!verifiedRest)root.updateMatrixWorld(true);
 const inverseRoot=!verifiedRest?root.matrixWorld.clone().invert():null,bindings=[],records=[],summary=new Map(),allMeshes=[];
 let mode='source-exact',disposed=false;
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.material)return;
  const originalAssignment=mesh.material,list=Array.isArray(originalAssignment)?originalAssignment:[originalAssignment],slots=[];
  const captured=verifiedRest?.get(mesh);if(verifiedRest&&!captured)throw Error('Missing captured rest matrix for '+mesh.name);
  const domainMatrix=captured?captured.clone():new T.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld);
  list.forEach((material,slot)=>{
   const index=parser.associations.get(material)?.materials,valid=Number.isInteger(index)&&index>=0&&index<g.materials.length,definition=valid?g.materials[index]:null;
   const context=valid?primitiveContext(mesh,parser,g,source.key,index,slot):null;
   const choice=definition&&context?selectMasterKind(definition,context):{selected:false,reason:'Missing/inconsistent exact material + node/mesh/primitive parser association; no index or semantic guess.'};
   const record={model:source.key??null,meshName:mesh.name,meshUuid:mesh.uuid,slot,sourceMaterialIndex:valid?index:null,sourceMaterialName:definition?.name??null,sourcePrimitive:context,selected:choice.selected,kind:choice.kind??null,reason:choice.reason,parentName:choice.parentName??null,sourcePbr:choice.sourcePbr??null,sourceAssociationVerified:!!context,sourceToMaterialMatrix:choice.selected?domainMatrix.toArray():null,referenceScale:choice.selected?1:null,scaleStatus:choice.selected?'uncalibrated-reference':null,frame:verifiedRest?'caller-captured verified source-scene rest matrix':'explicit sourceRestConfirmed static test frame',geometryChanged:false,sourceEquivalentUpgrade:false,visualAcceptance:false};
   records.push(record);const b={material,definition,record,candidate:null};slots.push(b);if(choice.selected)bindings.push(b);
   if(valid){let s=summary.get(index);if(!s){s={sourceMaterialIndex:index,name:definition.name??null,selected:false,kinds:[],meshSlotCount:0,selectedMeshSlots:0,retainedMeshSlots:0};summary.set(index,s);}s.meshSlotCount++;if(choice.selected){s.selected=true;s.selectedMeshSlots++;if(!s.kinds.includes(choice.kind))s.kinds.push(choice.kind);}else s.retainedMeshSlots++;}
  });allMeshes.push({mesh,originalAssignment,slots});
 });
 function make(b){if(b.candidate)return b.candidate;const r=b.record;
  const c=createTrainMasterMaterial(T,b.definition,b.material,{mode:'master-upgrade',kind:r.kind,sourceToMaterialMatrix:r.sourceToMaterialMatrix,referenceScale:1,scaleStatus:'uncalibrated-reference',frameEvidence:r.frame,state:{wear:0,history:0,wet:0,repair:0,mode:0},variant:0});
  b.candidate=c;r.differences=c.differences;r.domainWrapper=c.wrapper;r.sourceRecipe=c.material.userData.sourceRecipe??null;r.actualMasterFactoryCalled=true;return c;
 }
 function switchMode(next){
  if(disposed)throw Error('Train master v2 binding has been disposed.');
  if(!['source-exact','master-upgrade'].includes(next))throw Error('Mode must be source-exact or master-upgrade.');
  if(next==='master-upgrade')for(const b of bindings)make(b);
  for(const e of allMeshes){if(next==='source-exact')e.mesh.material=e.originalAssignment;else{const materials=e.slots.map(b=>b.record.selected?b.candidate.material:b.material);e.mesh.material=Array.isArray(e.originalAssignment)?materials:materials[0];}}
  mode=next;return {mode,version:TRAIN_BINDING_VERSION,selectedMeshSlots:bindings.length,preservedMeshSlots:records.length-bindings.length,sourceMaterialDefinitionsUntouched:true,geometryChanged:false,physicalScaleCalibrated:false,visualAcceptance:false,metalRecipe:'R06 source-surface parameterized v2; not zinc; no inferred oil or weathering'};
 }
 function dispose(){if(disposed)return;switchMode('source-exact');for(const b of bindings)b.candidate?.dispose();disposed=true;}
 return {version:TRAIN_BINDING_VERSION,adapterVersion:TRAIN_MASTER_VERSION,switchMode,records,materialRecords:[...summary.values()].sort((a,b)=>a.sourceMaterialIndex-b.sourceMaterialIndex),get mode(){return mode;},dispose};
}
