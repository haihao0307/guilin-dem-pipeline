/** Conservative binding by exact GLTFLoader material associations; no name-only index guess. */
import {createTrainMasterMaterial,TRAIN_MASTER_VERSION} from './train-master-materials.mjs';
export const TRAIN_BINDING_VERSION='kaopu.train-master-binding/1';
const noSuffix=name=>String(name??'').replace(/\.\d+$/,'').toLowerCase();
export function selectMasterKind(definition){
 const m=definition,p=m.pbrMetallicRoughness??{},name=noSuffix(m.name);
 if(p.baseColorTexture)return {selected:false,reason:'Source baseColor artwork/UV binding is retained; no master replacement of textured materials.'};
 if(m.extensions&&Object.keys(m.extensions).length)return {selected:false,reason:'Uninterpreted source material extension: keep exact source.'};
 if(/copper|gold|brass|logo|crest/.test(name))return {selected:false,reason:'Copper/gold/brass/logo semantics are not silently replaced by the R06 coated-steel/zinc recipes.'};
 if(name==='glass'||name==='faded_glass')return {selected:true,kind:'glass',reason:'Explicit source Glass/Faded_Glass material name; existing R03 finite-glass upgrade with source optical differences recorded.'};
 if((m.alphaMode??'OPAQUE')!=='OPAQUE')return {selected:false,reason:'Non-glass MASK/BLEND material is retained; alpha alone does not identify glass.'};
 if(name==='black_paint'||name==='paint')return {selected:true,kind:'coated-steel',reason:'Explicit source paint name, no baseColor artwork. Existing R06 coated-steel palette is a visibly different study recipe.'};
 if((p.metallicFactor??1)>0&&['button_silver','wheels','steel','iron','silver'].includes(name))return {selected:true,kind:'zinc',reason:'Explicit metallic source role, no artwork; existing R06 zinc receiver is an upgrade candidate, not a claim that the source alloy was zinc.'};
 return {selected:false,reason:'No explicit supported metal/paint/Glass role. Body/roof/plastic/fabric/light and unknown names retain exact source.'};
}
export function installTrainMaster(T,source){
 const model=source?.model,root=source?.root??model?.scene,parser=model?.parser,g=source?.g??parser?.json;
 if(!root||!parser?.associations||!g?.materials)throw Error('installTrainMaster requires source.root, source.model.parser.associations and glTF materials (source.g or parser.json).');
 const verifiedRest=source.materialRestMatrices;
 if(!verifiedRest&&source.sourceRestConfirmed!==true)throw Error('A captured source.materialRestMatrices map is required; current animated pose is not a rest frame. Static tests may explicitly set sourceRestConfirmed=true.');
 if(!verifiedRest)root.updateMatrixWorld(true);
 const inverseRoot=!verifiedRest?root.matrixWorld.clone().invert():null,bindings=[],records=[],materialSummary=new Map(),allMeshes=[];
 let mode='source-exact',disposed=false;
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.material)return;
  const originalAssignment=mesh.material,list=Array.isArray(originalAssignment)?originalAssignment:[originalAssignment],slots=[];
  const captured=verifiedRest?.get(mesh);
  if(verifiedRest&&!captured)throw Error('Missing captured rest matrix for mesh '+mesh.name);
  const domainMatrix=captured?captured.clone():new T.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld);
  list.forEach((material,slot)=>{
   const association=parser.associations.get(material),index=association?.materials;
   const assocValid=Number.isInteger(index)&&index>=0&&index<g.materials.length;
   const definition=assocValid?g.materials[index]:null;
   const choice=definition?selectMasterKind(definition):{selected:false,reason:'No valid exact material index in GLTFLoader parser.associations; no inferred index.'};
   const record={model:source.key??null,meshName:mesh.name,meshUuid:mesh.uuid,slot,sourceMaterialIndex:assocValid?index:null,sourceMaterialName:definition?.name??material.name??null,selected:choice.selected,kind:choice.kind??null,reason:choice.reason,sourceAssociationVerified:assocValid,sourceToMaterialMatrix:choice.selected?domainMatrix.toArray():null,referenceScale:choice.selected?1:null,scaleStatus:choice.selected?'uncalibrated-reference':null,frame:verifiedRest?'caller-captured verified source-scene rest matrix, excluding animated/current display/world transforms':'explicit sourceRestConfirmed static test frame; excluding later display/world transforms',geometryChanged:false,sourceEquivalentUpgrade:false};
   records.push(record);const binding={material,definition,record,candidate:null};slots.push(binding);
   if(choice.selected)bindings.push(binding);
   if(assocValid){let s=materialSummary.get(index);if(!s){s={sourceMaterialIndex:index,name:definition.name??null,selected:choice.selected,kind:choice.kind??null,reason:choice.reason,meshSlotCount:0};materialSummary.set(index,s);}s.meshSlotCount++;}
  });allMeshes.push({mesh,originalAssignment,slots});
 });
 function make(binding){if(binding.candidate)return binding.candidate;const r=binding.record;
  const candidate=createTrainMasterMaterial(T,binding.definition,binding.material,{mode:'master-upgrade',kind:r.kind,sourceToMaterialMatrix:r.sourceToMaterialMatrix,referenceScale:1,scaleStatus:'uncalibrated-reference',frameEvidence:r.frame,state:{wear:0,history:0,wet:0,repair:0,mode:0},variant:r.kind==='glass'?0:1});
  binding.candidate=candidate;r.differences=candidate.differences;r.domainWrapper=candidate.wrapper;r.actualMasterFactoryCalled=true;return candidate;
 }
 function switchMode(next){
  if(disposed)throw Error('Train master binding has been disposed.');
  if(!['source-exact','master-upgrade'].includes(next))throw Error('Mode must be source-exact or master-upgrade.');
  // Prepare first, so factory failure cannot leave a half-switched scene.
  if(next==='master-upgrade')for(const b of bindings)make(b);
  for(const e of allMeshes){if(next==='source-exact')e.mesh.material=e.originalAssignment;else{const materials=e.slots.map(b=>b.record.selected?b.candidate.material:b.material);e.mesh.material=Array.isArray(e.originalAssignment)?materials:materials[0];}}
  mode=next;return {mode,selectedMeshSlots:bindings.length,preservedMeshSlots:records.length-bindings.length,sourceMaterialDefinitionsUntouched:true,geometryChanged:false,physicalScaleCalibrated:false,visualAcceptance:false};
 }
 function dispose(){if(disposed)return;switchMode('source-exact');for(const b of bindings)b.candidate?.dispose();disposed=true;}
 return {version:TRAIN_BINDING_VERSION,adapterVersion:TRAIN_MASTER_VERSION,switchMode,records,materialRecords:[...materialSummary.values()].sort((a,b)=>a.sourceMaterialIndex-b.sourceMaterialIndex),get mode(){return mode;},dispose};
}
