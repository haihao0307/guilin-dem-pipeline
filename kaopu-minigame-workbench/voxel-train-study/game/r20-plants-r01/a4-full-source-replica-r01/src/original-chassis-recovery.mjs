import * as T from 'three';
import {GLTFLoader} from '../vendor/GLTFLoader.mjs';
export const ORIGINALS=Object.freeze({a4:{folder:'../source-assets/a4/',objectSHA256:'749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4',priorityRoots:[24,26,28,149,258,270,100,102,115,260,290,295,298,300]}});
export async function sha256(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function fetchBytes(url){const r=await fetch(url);if(!r.ok)throw Error('SOURCE_FETCH_FAILED '+url);return r.arrayBuffer();}
/** Restore ALL source nodes and buffers, without rescaling or synthesizing parts.
 * Separate, source-space recovery scenes. This does not assemble a four-axle A6.
 * Visibility selection never deletes nodes or animations; unrecognized parts stay in the full scene.
 */
export async function restoreOriginal(key){
 const spec=ORIGINALS[key];if(!spec)throw Error('UNKNOWN_ORIGINAL');
 const base=new URL(spec.folder,import.meta.url),objectBytes=await fetchBytes(new URL('object.json',base));
 if(await sha256(objectBytes)!==spec.objectSHA256)throw Error('SOURCE_OBJECT_HASH_MISMATCH');
 const object=JSON.parse(new TextDecoder().decode(objectBytes)),c=object.content,g=structuredClone(c.displaySkeleton),packed=await fetchBytes(new URL('fields.bin.gz',base));
 let binary;try{binary=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}catch{throw Error('SOURCE_PAYLOAD_HASH_MISMATCH');}
 if(binary.byteLength!==(c.fieldPayload.bytes??c.fieldPayload.byteLength)||await sha256(binary)!==c.fieldPayload.sha256)throw Error('SOURCE_PAYLOAD_HASH_MISMATCH');
 for(const [i,f]of c.fields.entries())if(await sha256(binary.slice(f.byteOffset,f.byteOffset+f.byteLength))!==f.sha256)throw Error('SOURCE_FIELD_HASH_MISMATCH '+i);
 for(const img of c.images||[]){const b=await fetchBytes(new URL(img.payload,base));if(b.byteLength!==img.bytes||await sha256(b)!==img.sha256)throw Error('SOURCE_IMAGE_HASH_MISMATCH '+img.payload);}
 const binaryURL=URL.createObjectURL(new Blob([binary]));g.buffers=[{byteLength:binary.byteLength,uri:binaryURL}];
 g.bufferViews=c.fields.map(f=>({buffer:0,byteOffset:f.byteOffset,byteLength:f.byteLength}));
 g.accessors=c.fields.map((f,i)=>({...f.definition,bufferView:i,byteOffset:0}));
 g.images=(c.images||[]).map(img=>({...img.definition,uri:img.payload}));
 let model;try{model=await new GLTFLoader().parseAsync(JSON.stringify(g),base.href);}finally{URL.revokeObjectURL(binaryURL);}
 const nodes=await Promise.all(g.nodes.map((_,i)=>model.parser.getDependency('node',i)));
 const parents=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>parents.set(j,i)));
 const primitives=[];for(const [i,n] of g.nodes.entries())if(n.mesh!==undefined){const src=g.meshes[n.mesh];const target=nodes[i];const matches=src.primitives.length===1?[target]:target.children.filter(x=>x.isMesh);if(matches.length!==src.primitives.length)throw Error('PRIMITIVE_MAPPING_INCOMPLETE '+i);src.primitives.forEach((p,j)=>{const mesh=matches[j];if(!mesh.isMesh)throw Error('SOURCE_MESH_NOT_RESTORED '+i);mesh.userData.originalPrimitive={source:key,node:i,mesh:n.mesh,primitive:j,definition:structuredClone(p)};primitives.push({sourceNode:i,primitive:j,definition:p,object:mesh});});}
 nodes.forEach((n,i)=>{n.userData.originalNode={source:key,index:i,destinationId:`original-${key}/node-${i}`,definition:structuredClone(g.nodes[i])};});
 const rest=nodes.map(n=>({position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),matrix:n.matrix.clone()}));
 const mixer=new T.AnimationMixer(model.scene);let action=null;
 function setTime(t,clip=0){if(!Number.isFinite(t)||t<0)throw Error('INVALID_SOURCE_TIME');mixer.stopAllAction();nodes.forEach((n,i)=>{n.position.copy(rest[i].position);n.quaternion.copy(rest[i].quaternion);n.scale.copy(rest[i].scale);n.matrix.copy(rest[i].matrix);});if(model.animations[clip]){action=mixer.clipAction(model.animations[clip]);action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(t);}model.scene.updateMatrixWorld(true);}
 function closure(rootIndex){if(!nodes[rootIndex])throw Error('UNKNOWN_SOURCE_NODE');const descendants=[];function walk(i){descendants.push(i);for(const j of g.nodes[i].children||[])walk(j);}walk(rootIndex);const ancestors=[];let i=rootIndex;while(parents.has(i)){i=parents.get(i);ancestors.push(i);}const relevant=new Set([...descendants,...ancestors]);return{source:key,root:rootIndex,descendants,ancestors,destinationIds:descendants.map(i=>nodes[i].userData.originalNode.destinationId),animationChannels:g.animations?.flatMap((a,ai)=>a.channels.flatMap((ch,ci)=>relevant.has(ch.target.node)?[[ai,ci]]:[]))||[],physicalAssembly:'NOT_ASSEMBLED_IN_A6',sourceUnits:'UNCHANGED_UNCALIBRATED'};}
 function showClosures(roots=spec.priorityRoots){const keep=new Set(roots.flatMap(i=>closure(i).descendants));for(const p of primitives)p.object.visible=keep.has(p.sourceNode);return [...keep];}
 // Candidate identity is based on explicit source names, not invented mechanical joints.
 const namedPattern=key==='a4'?/wheel|bogie|undercarriage|axel hubs|wishbone suspension|main gear|back & forth|coupler|front buffer|front hoses/i:/bogies|springs|coupler|buffer mount|bottom box|cables|sockets|^socket_|footplate/i;
 const namedRoots=g.nodes.flatMap((n,i)=>namedPattern.test(n.name||'')?[i]:[]);
 const animationTargets=[...new Set((g.animations||[]).flatMap(a=>a.channels.map(ch=>ch.target.node)))];
 const candidateRoots=[...new Set([...spec.priorityRoots,...namedRoots,...animationTargets])].sort((a,b)=>a-b);
 const candidateNodes=[...new Set(candidateRoots.flatMap(i=>closure(i).descendants))].sort((a,b)=>a-b);
 const candidateAncestors=[...new Set(candidateRoots.flatMap(i=>closure(i).ancestors))].sort((a,b)=>a-b);
 const inventory={namedCandidateRoots:namedRoots,originalAnimationTargetRoots:animationTargets,candidateRoots,candidateNodes,coordinateAncestors:candidateAncestors,
   unresolvedNodes:g.nodes.flatMap((n,i)=>candidateNodes.includes(i)||candidateAncestors.includes(i)?[]:[i]),
   allUnknownNodesRemainInScene:true,selectionCompleteMechanicalChassis:false,
   warning:'Names and animation targets identify a conservative inspection selection, not complete mechanical classification or physical connections.'};
 function showChassisCandidates(){return showClosures(candidateRoots);}
 function showAll(){for(const p of primitives)p.object.visible=true;}
 model.scene.userData.recovery={sourceBuffersUsed:true,generatedReplacementParts:false,allSourceNodesRestored:true,sourceUnits:'UNCHANGED_UNCALIBRATED',a6AssemblyComplete:false,sourceObjectSHA256:await sha256(objectBytes)};
 model.scene.updateMatrixWorld(true);
 return{key,object,g,binary,model,root:model.scene,nodes,primitives,rest,mixer,setTime,closure,showClosures,showChassisCandidates,inventory,showAll};
}
