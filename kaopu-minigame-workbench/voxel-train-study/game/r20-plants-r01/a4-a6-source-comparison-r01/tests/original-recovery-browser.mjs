import * as T from 'three';
import {restoreOriginal,sha256,ORIGINALS} from '../src/original-chassis-recovery.mjs';
const assert=(v,s)=>{if(!v)throw Error(s);};
export async function verifyRecovery(){
 const results=[],mappings=[],closures=[],inventories=[];
 for(const key of Object.keys(ORIGINALS)){
  const r=await restoreOriginal(key),g=r.g,c=r.object.content,nodes=r.nodes;
  assert(nodes.length===g.nodes.length,'ALL_SOURCE_NODES');assert(new Set(nodes).size===nodes.length,'UNIQUE_NODE_MAPPING');
  const worlds=[];function local(n){if(n.matrix)return new T.Matrix4().fromArray(n.matrix);return new T.Matrix4().compose(new T.Vector3().fromArray(n.translation||[0,0,0]),new T.Quaternion().fromArray(n.rotation||[0,0,0,1]),new T.Vector3().fromArray(n.scale||[1,1,1]));}
  const parents=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>parents.set(j,i)));
  function world(i){return worlds[i]??=(parents.has(i)?world(parents.get(i)).clone():new T.Matrix4()).multiply(local(g.nodes[i]));}
  const close=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-7*Math.max(1,Math.abs(v),Math.abs(b[i])));
  nodes.forEach((n,i)=>{assert(close(n.matrixWorld.elements,world(i).elements),'WORLD_MATRIX_'+i);for(const child of g.nodes[i].children||[])assert(nodes[child].parent===n,'HIERARCHY_'+child);});
  let attributes=0,indices=0;const attrNames={POSITION:'position',NORMAL:'normal',TANGENT:'tangent',TEXCOORD_0:'uv',TEXCOORD_1:'uv1',COLOR_0:'color',JOINTS_0:'skinIndex',WEIGHTS_0:'skinWeight'};
  for(const p of r.primitives){const geometry=p.object.geometry;for(const [name,fi]of Object.entries(p.definition.attributes)){const a=geometry.getAttribute(attrNames[name]);assert(a,'ATTRIBUTE_MISSING '+name);assert(await sha256(a.array.buffer.slice(a.array.byteOffset,a.array.byteOffset+a.array.byteLength))===c.fields[fi].sha256,'ATTRIBUTE_HASH_'+name);attributes++;}if(p.definition.indices!==undefined){const a=geometry.index;assert(await sha256(a.array.buffer.slice(a.array.byteOffset,a.array.byteOffset+a.array.byteLength))===c.fields[p.definition.indices].sha256,'INDEX_HASH');indices++;}const mi=p.definition.material;assert(p.object.material.name===g.materials[mi].name,'MATERIAL_NAME');assert(p.object.material.userData!==null,'MATERIAL');}
  const channelCount=(g.animations||[]).reduce((n,a)=>n+a.channels.length,0),trackCount=r.model.animations.reduce((n,a)=>n+a.tracks.length,0);assert(channelCount===trackCount,'ALL_ANIMATION_CHANNELS');
  for(const [ai,a]of (g.animations||[]).entries())for(const [ci,ch]of a.channels.entries()){
   const track=r.model.animations[ai].tracks[ci],sam=a.samplers[ch.sampler];
   for(const [arr,fi]of[[track.times,sam.input],[track.values,sam.output]])assert(await sha256(arr.buffer.slice(arr.byteOffset,arr.byteOffset+arr.byteLength))===c.fields[fi].sha256,'ORIGINAL_ANIMATION_FIELD_HASH');
   const property={translation:'position',rotation:'quaternion',scale:'scale'}[ch.target.path];assert(track.name===(nodes[ch.target.node].name||nodes[ch.target.node].uuid)+'.'+property,'ANIMATION_TARGET_MAPPING');
  }
  const textures=await Promise.all((g.textures||[]).map((_,i)=>r.model.parser.getDependency('texture',i)));assert(textures.every(t=>t.image.width>0&&t.image.height>0),'ACTUAL_IMAGES_DECODED');
  let materialChecks=0,textureBindings=0;
  const materialDefinitions=await Promise.all(g.materials.map((_,i)=>r.model.parser.getDependency('material',i)));
  const filter={9728:T.NearestFilter,9729:T.LinearFilter,9984:T.NearestMipmapNearestFilter,9985:T.LinearMipmapNearestFilter,9986:T.NearestMipmapLinearFilter,9987:T.LinearMipmapLinearFilter},wrap={33071:T.ClampToEdgeWrapping,33648:T.MirroredRepeatWrapping,10497:T.RepeatWrapping};
  for(const [mi,md]of g.materials.entries()){
   const m=materialDefinitions[mi],pbr=md.pbrMetallicRoughness||{},color=pbr.baseColorFactor||[1,1,1,1];
   assert(close(m.color.toArray(),color.slice(0,3)),'ORIGINAL_BASE_COLOR '+mi);assert(m.opacity===color[3],'ORIGINAL_OPACITY '+mi);
   assert(m.metalness===(pbr.metallicFactor??1)&&m.roughness===(pbr.roughnessFactor??1),'ORIGINAL_PBR '+mi);
   assert(m.side===(md.doubleSided?T.DoubleSide:T.FrontSide),'ORIGINAL_SIDEDNESS '+mi);
   assert(m.alphaTest===(md.alphaMode==='MASK'?(md.alphaCutoff??.5):0),'ORIGINAL_ALPHA_CUTOFF '+mi);
   assert(m.transparent===(md.alphaMode==='BLEND'),'ORIGINAL_ALPHA_MODE '+mi);
   if(md.emissiveFactor)assert(close(m.emissive.toArray(),md.emissiveFactor),'ORIGINAL_EMISSIVE '+mi);
   if(pbr.baseColorTexture){const ti=pbr.baseColorTexture.index,t=m.map,td=g.textures[ti],sam=g.samplers[td.sampler]||{};assert(t===textures[ti],'ORIGINAL_TEXTURE_BINDING '+mi);assert(t.channel===(pbr.baseColorTexture.texCoord??0),'ORIGINAL_UV_CHANNEL');assert(t.magFilter===(filter[sam.magFilter]??T.LinearFilter)&&t.minFilter===(filter[sam.minFilter]??T.LinearMipmapLinearFilter),'ORIGINAL_TEXTURE_FILTER');assert(t.wrapS===(wrap[sam.wrapS]??T.RepeatWrapping)&&t.wrapT===(wrap[sam.wrapT]??T.RepeatWrapping),'ORIGINAL_TEXTURE_WRAP');assert(t.colorSpace===T.SRGBColorSpace&&t.flipY===false,'GLTF_TEXTURE_COLORSPACE_ORIENTATION');textureBindings++;}
   materialChecks++;
  }
  for(const p of r.primitives){const m=p.object.material,expected=materialDefinitions[p.definition.material];assert(m.name===expected.name&&m.map===expected.map&&m.color.equals(expected.color)&&m.metalness===expected.metalness&&m.roughness===expected.roughness,'PRIMITIVE_MATERIAL_BINDING');}
  const sampled=[];for(const t of[0,.125,.5,1]){r.setTime(t);let moved=0;nodes.forEach((n,i)=>{assert(n.matrixWorld.elements.every(Number.isFinite),'ANIMATION_FINITE');if(!close(n.matrixWorld.elements,world(i).elements))moved++;});sampled.push({time:t,movedNodes:moved});}if(channelCount)assert(sampled.some(x=>x.movedNodes>0),'ORIGINAL_ANIMATION_ACTIVE');r.setTime(0);
  const selected=r.showClosures(),selectedSet=new Set(selected);assert(r.primitives.every(p=>p.object.visible===selectedSet.has(p.sourceNode)),'ISOLATION_EXACT');assert(r.nodes.length===g.nodes.length,'ISOLATION_NO_DELETION');r.showAll();assert(r.primitives.every(p=>p.object.visible),'SHOW_ALL_RECOVERS_ALL');
  r.showChassisCandidates();for(const i of (key==='a4'?[3,7,11,15,90,94,138,195,197,200,203,206,209,213,217,221,264]:[61,101]))assert(r.inventory.candidateNodes.includes(i),'KNOWN_CHASSIS_NODE_OMITTED '+i);
  assert(nodes.every((n,i)=>{const p=parents.get(i);return p===undefined||n.parent===nodes[p];}),'ANCESTORS_RETAINED_AFTER_ISOLATION');r.showAll();inventories.push({source:key,...r.inventory});
  for(const root of ORIGINALS[key].priorityRoots)closures.push(r.closure(root));
  mappings.push({source:key,nodeCount:nodes.length,sourceObjectSHA256:r.root.userData.recovery.sourceObjectSHA256,nodes:nodes.map((n,i)=>({sourceNode:i,sourceName:g.nodes[i].name,destinationId:n.userData.originalNode.destinationId,parent:parents.get(i)??null,sourceTransform:{...g.nodes[i],children:undefined,name:undefined,mesh:undefined},runtimeRestoration:'VERIFIED_SOURCE_SPACE',a6Assembly:'NOT_ASSEMBLED',physicalConnections:'UNKNOWN_NOT_INFERRED_FROM_SCENE_TREE'}))});
  results.push({source:key,status:'PASS_SOURCE_SPACE_RECOVERY_ONLY',nodeCount:nodes.length,sourceMeshCount:g.meshes.length,primitiveCount:r.primitives.length,attributeHashesChecked:attributes,indexHashesChecked:indices,animationChannels:channelCount,animationTracks:trackCount,animationSamples:sampled,legacyPriorityClosureNodes:selected.length,expandedCandidateNodes:r.inventory.candidateNodes.length,coordinateAncestors:r.inventory.coordinateAncestors.length,remainingUnclassifiedNodes:r.inventory.unresolvedNodes.length,decodedTextures:textures.length,sourceImages:c.images.length,materialDefinitionsChecked:materialChecks,textureBindingsChecked:textureBindings,primitiveMaterialBindingsChecked:r.primitives.length,sourceBuffersUsed:true,sourceUnitsUnchanged:true,physicalCalibration:'BLOCKED',a6AssemblyComplete:false});
 }
 return{results,mappings,closures,inventories,renderingRun:false,physicalAssembly:'BLOCKED',statement:'Real source node restoration, not complete A6 mechanical assembly or dimension calibration.'};
}
