/** Compact non-coal associations -> original A4 audit identities, then fixed v3.1.
 * This audit view is NEVER parsed/rendered. Actual glTF objects remain compact.
 */
import {installTrainMaster as installFixedV31} from './vendor/master-materials-v3-1/train-binding.mjs';
import {SOURCE_SEMANTIC_BINDINGS as SPEC} from './vendor/master-materials-v3-1/source-semantic-bindings.mjs';
import {runtimeLock} from './identity-hash.mjs';
import {PROJECTION_IDENTITY_LOCK as LOCK} from './projection-identity-lock.mjs';
export const TRAIN_PROJECTION_BINDING_VERSION='kaopu.train-noncoal-material-binding/2';
const must=(x,message)=>{if(!x)throw Error('PROJECTION_MATERIAL_IDENTITY '+message);};
const tuple=x=>[x.source,x.materialIndex,x.nodeIndex,x.meshIndex,x.primitiveIndex].join(':');
const definition=g=>Object.fromEntries(LOCK.definitionKeys.map(k=>[k,g[k]??null]));
const identity=p=>Object.fromEntries(LOCK.identityKeys.map(k=>[k,p[k]??null]));
const remap=(array,i,label)=>{must(Number.isInteger(i)&&i>=0&&i<array.length,'Invalid compact '+label+' '+i);return array[i];};
// Exact synchronous comparison preserves signed zero and rejects any mutation during SHA awaits.
const same=(a,b)=>{if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&same(a[k],b[k]));};
/** Async only for identity SHA preflight; returned mode/records/dispose API is v3.1-compatible. */
export async function installTrainMaster(T,source,options={}){
 const getManifest=()=>options.manifest??source?.manifest;
 const getProjection=()=>getManifest()?.projection??source?.projection;
 const liveP=getProjection(),parser=source?.model?.parser,liveG=source?.g??parser?.json;
 const root=source?.root??source?.model?.scene,rest=source?.materialRestMatrices,sourceModel=source?.model,manifest=getManifest();
 must(source&&liveP&&liveG&&root&&parser?.associations instanceof Map,'Need verified projection, glTF parser and compact definitions.');
 must(liveP.schema===LOCK.projectionSchema,'Unsupported projection schema.');
 must(rest instanceof WeakMap,'Need caller-captured materialRestMatrices before animation/display transforms.');
 must(source.paintFinishOverrides==null,'This projection adapter does not introduce per-use clearcoat candidates.');
 // Every mutable definition used below is detached before the FIRST await. Never clone large buffer URIs.
 const p=structuredClone(liveP),g=structuredClone(definition(liveG)),parserJson=parser.json,parserDefinition=structuredClone(definition(parserJson));
 const associationsReference=parser.associations,associationSnapshot=[...associationsReference].map(([object,value])=>({object,reference:value,value:structuredClone(value)}));
 const restSnapshot=new WeakMap(),sceneSnapshot=[];
 root.traverse(object=>{const item={object,parent:object.parent,children:object.children.slice()};if(object.isMesh){const matrix=rest.get(object);must(matrix?.isMatrix4,'Missing captured rest matrix for '+object.name);item.rest=matrix;item.restElements=matrix.elements.slice();restSnapshot.set(object,matrix.clone());item.assignment=object.material;item.materials=Array.isArray(object.material)?object.material.slice():null;}sceneSnapshot.push(item);});
 const scope=LOCK.supportedScopes.find(x=>same(x.historicalA4Anchors,p.historicalA4Anchors));
 must(scope&&p.scope===LOCK.scope&&p.a6DesignCompleted===false&&p.newRulesLearned===0,'Unsupported historical projection scope.');
 const manifestModel=manifest?.model;
 must(manifestModel===undefined||manifestModel===scope.model,'Manifest model differs from its known historical projection anchor.');
 const hashes=await Promise.all([runtimeLock(identity(p)),runtimeLock(g),runtimeLock(parserDefinition)]);
 must(hashes[0]===LOCK.identitySHA256,'Projection sourceIndices/locks/exclusion scope mismatch.');
 must(hashes[1]===LOCK.compactDefinitionSHA256,'Compact model differs from the locked non-coal projection.');
 must(hashes[2]===LOCK.parserDefinitionSHA256,'Parser and supplied projection definitions do not match.');
 // Fail closed on concurrent mutation, even though all mapping uses the detached snapshots.
 must(getManifest()===manifest&&manifest?.model===manifestModel&&getProjection()===liveP&&same(liveP,p),'Projection mutated during identity verification.');
 must(source.model===sourceModel&&source.model.parser===parser&&(source.g??parser.json)===liveG&&parser.json===parserJson&&same(definition(liveG),g)&&same(definition(parser.json),parserDefinition),'Definitions mutated during identity verification.');
 must(source.materialRestMatrices===rest&&(source.root??source.model.scene)===root&&source.paintFinishOverrides==null,'Source binding inputs mutated during identity verification.');
 must(parser.associations===associationsReference&&associationsReference.size===associationSnapshot.length&&associationSnapshot.every(e=>associationsReference.get(e.object)===e.reference&&same(e.reference,e.value)),'Parser associations mutated during identity verification.');
 const currentObjects=[];root.traverse(object=>currentObjects.push(object));
 must(currentObjects.length===sceneSnapshot.length&&sceneSnapshot.every((e,i)=>currentObjects[i]===e.object&&e.object.parent===e.parent&&e.object.children.length===e.children.length&&e.children.every((x,j)=>e.object.children[j]===x)&&(!e.object.isMesh||(rest.get(e.object)===e.rest&&same(e.rest.elements,e.restElements)&&e.object.material===e.assignment&&(!e.materials||(e.object.material.length===e.materials.length&&e.materials.every((x,j)=>e.object.material[j]===x)))))),'Scene material/rest/hierarchy inputs mutated during identity verification.');
 const ids=p.sourceIndices;
 for(const [k,n]of Object.entries(LOCK.projectedCounts))must(ids[k].length===n,'Unexpected '+k+' count.');
 const view={nodes:[],meshes:[],materials:[]};
 g.materials.forEach((m,i)=>{view.materials[ids.materials[i]]=structuredClone(m);});
 g.meshes.forEach((m,i)=>{const v=structuredClone(m);for(const primitive of v.primitives){if(primitive.material!==undefined)primitive.material=remap(ids.materials,primitive.material,'material');for(const [key,a]of Object.entries(primitive.attributes??{}))primitive.attributes[key]=remap(ids.fields,a,'attribute');if(primitive.indices!==undefined)primitive.indices=remap(ids.fields,primitive.indices,'index accessor');}view.meshes[ids.meshes[i]]=v;});
 g.nodes.forEach((n,i)=>{const v=structuredClone(n);if(v.mesh!==undefined)v.mesh=remap(ids.meshes,v.mesh,'mesh');if(v.children)v.children=v.children.map(c=>remap(ids.nodes,c,'child node'));view.nodes[ids.nodes[i]]=v;});
 for(const i of p.removed.sourceNodes)must(!(i in view.nodes),'Removed node was reintroduced.');
 for(const i of p.removed.sourceMeshes)must(!(i in view.meshes),'Removed mesh was reintroduced.');
 for(const i of p.removed.sourceMaterials)must(!(i in view.materials),'Removed material was reintroduced.');
 // Copy ALL associations, including ancestor Group node records. No source mutation.
 const associations=new Map();
 for(const {object,value}of associationSnapshot){
  const a={...value};for(const key of ['nodes','meshes','materials'])if(a[key]!==undefined)a[key]=remap(ids[key],a[key],key);
  associations.set(object,a);
 }
 const auditSource={key:'a4',root,g:view,model:{parser:{json:view,associations}},materialRestMatrices:restSnapshot};
 const api=installFixedV31(T,auditSource);
 const inverse=Object.fromEntries(['nodes','meshes','materials'].map(k=>[k,new Map(ids[k].map((v,i)=>[v,i]))]));
 for(const r of api.records){r.identitySpace='original-a4';r.projectionModel=scope.model;r.projectedMaterialIndex=r.sourceMaterialIndex===null?null:inverse.materials.get(r.sourceMaterialIndex);
  const old=r.sourcePrimitive;r.projectedPrimitive=old?{materialIndex:inverse.materials.get(old.materialIndex),nodeIndex:inverse.nodes.get(old.nodeIndex),meshIndex:inverse.meshes.get(old.meshIndex),primitiveIndex:old.primitiveIndex}:null;
  if(old){must(view.nodes[old.nodeIndex]?.mesh===old.meshIndex&&view.meshes[old.meshIndex]?.primitives?.[old.primitiveIndex]?.material===old.materialIndex,'Non-closing final source tuple.');}
 }
 const selected=api.records.filter(r=>r.selected),selectedTuples=selected.map(r=>tuple(r.sourcePrimitive));
 must(new Set(selectedTuples).size===selectedTuples.length,'Duplicate source tuple in scene.');
 const expected=SPEC.selectedPrimitives.filter(e=>e.source==='a4'&&inverse.nodes.has(e.nodeIndex)&&inverse.meshes.has(e.meshIndex)&&inverse.materials.has(e.materialIndex)).map(tuple);
 const missing=expected.filter(k=>!selectedTuples.includes(k));
 const projectionReport={version:TRAIN_PROJECTION_BINDING_VERSION,model:scope.model,sourceIdentity:'a4',originalMaterialRecipeVersion:'3.1',recipeChanged:false,synchronousInputSnapshot:true,concurrentInputMutationRejected:true,sourceIndicesVerified:true,compactDefinitionVerified:true,originalParserMutated:false,geometryChanged:false,coalDependenciesReintroduced:false,removedSourceIdentity:structuredClone(p.removed),projectedCounts:{...LOCK.projectedCounts},actualMeshSlots:api.records.length,selectedMeshSlots:selected.length,retainedMeshSlots:api.records.length-selected.length,selectedSourceMaterialDefinitions:api.materialRecords.filter(r=>r.selected).length,kinds:Object.fromEntries([...new Set(selected.map(r=>r.kind))].map(k=>[k,selected.filter(r=>r.kind===k).length])),expectedAuditedTuples:expected.length,allExpectedTuplesMapped:missing.length===0,selectedTuples,unmatchedAuditedTuples:missing,sourceExactDefinitionCount:g.materials.length,sourceExactDefinitionUniverse:42,visualAcceptance:false,microTextureVisibleAcceptance:false,scaleStatus:'uncalibrated-reference',limits:['Only inherited original-A4 identities, not an A6 final-design certification.','Original fixed v3.1 appearance recipe is unchanged.','Prior microtexture visibility review did not pass.','Missing/inconsistent primitive associations retain their original material; unmatched audited tuples are reported.']};
 return {version:TRAIN_PROJECTION_BINDING_VERSION,adapterVersion:api.adapterVersion,records:api.records,materialRecords:api.materialRecords,projectionReport,get mode(){return api.mode;},switchMode(mode){return {...api.switchMode(mode),projection:projectionReport};},dispose(){api.dispose();}};
}
export const installProjectedTrainMaster=installTrainMaster;
