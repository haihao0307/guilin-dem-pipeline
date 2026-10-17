import {fetchSourceBytes,withDeadline} from './source-transport.mjs';
import {rebuildDisplayDefinition,describeExpression} from './asset-study-reader.mjs';
import * as T from 'three';
import {GLTFLoader} from '../vendor/GLTFLoader.mjs';
export const ORIGINALS=Object.freeze({mark3:{folder:'../source-assets/mark3/',objectSHA256:'42ab2b0ea3ded8bf1cd3f04e024fb5cb167cf7a67b18b68350fcae9d242c17ea',priorityRoots:[61,37,45]},a4:{folder:'../source-assets/a4/',objectSHA256:'749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4',priorityRoots:[24,26,28,149,258,270,100,102,115,260,290,295,298,300]}});
export async function sha256(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const verifiedSources=new Map();
export function clearVerifiedSourceCache(){verifiedSources.clear();}
async function loadVerified(key,spec,notify){
 if(!globalThis.crypto?.subtle)throw Error('SOURCE_CRYPTO_UNAVAILABLE HTTPS/WebCrypto required');
 const base=new URL(spec.folder,import.meta.url),get=url=>fetchSourceBytes(url,{onProgress:e=>notify({...e,key})});
 const objectBytes=await get(new URL('object.json',base));notify({key,phase:'object-hash'});
 if(await sha256(objectBytes)!==spec.objectSHA256)throw Error('SOURCE_OBJECT_HASH_MISMATCH');
 const object=JSON.parse(new TextDecoder().decode(objectBytes)),c=object.content,packed=await get(new URL('fields.bin.gz',base));
 notify({key,phase:'decompress'});let binary;
 try{if(typeof DecompressionStream==='undefined')throw Error('DECOMPRESSION_UNAVAILABLE');
 // Some CDNs transparently decode Content-Encoding. Either path must pass the identical full SHA and byte count below.
 binary=new Uint8Array(packed)[0]===31&&new Uint8Array(packed)[1]===139?await withDeadline(new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),'gzip '+key):packed;
 }catch(e){throw Error('SOURCE_PAYLOAD_HASH_MISMATCH '+e.message);}
 notify({key,phase:'payload-hash'});
 if(binary.byteLength!==(c.fieldPayload.bytes??c.fieldPayload.byteLength)||await sha256(binary)!==c.fieldPayload.sha256)throw Error('SOURCE_PAYLOAD_HASH_MISMATCH');
 for(const [i,f]of c.fields.entries()){if(await sha256(new Uint8Array(binary,f.byteOffset,f.byteLength))!==f.sha256)throw Error('SOURCE_FIELD_HASH_MISMATCH '+i);if(i%32===0||i===c.fields.length-1)notify({key,phase:'field-hash',loaded:i+1,total:c.fields.length});}
 const images=[];for(const img of c.images||[]){const b=await get(new URL(img.payload,base));if(b.byteLength!==img.bytes||await sha256(b)!==img.sha256)throw Error('SOURCE_IMAGE_HASH_MISMATCH '+img.payload);images.push(b);}
 notify({key,phase:'verified'});return{base,object,c,binary,images,objectBytes};
}
/** Byte cache shares only verified immutable inputs; each view gets separate node/material/mixer state. */
export async function restoreOriginal(key,{onProgress=()=>{}}={}){
 const spec=ORIGINALS[key];if(!spec)throw Error('UNKNOWN_ORIGINAL');
 let entry=verifiedSources.get(key);if(!entry){entry={listeners:new Set()};verifiedSources.set(key,entry);entry.listeners.add(onProgress);entry.promise=loadVerified(key,spec,e=>{entry.last=e;for(const f of entry.listeners)f(e)}).catch(e=>{verifiedSources.delete(key);throw e;});}else{entry.listeners.add(onProgress);if(entry.last)onProgress(entry.last);}
 let data;try{data=await entry.promise;}finally{entry.listeners.delete(onProgress);}
 const{base,object,c,binary,images,objectBytes}=data;
 const binaryURL=URL.createObjectURL(new Blob([binary])),g=rebuildDisplayDefinition(c,binaryURL),imageURLs=[];
 g.images.forEach((img,i)=>{const mime=c.images[i].definition?.mimeType||(/\.jpe?g$/i.test(c.images[i].payload)?'image/jpeg':'image/png');const url=URL.createObjectURL(new Blob([images[i]],{type:mime}));imageURLs.push(url);img.uri=url;});
 onProgress({key,phase:'decode-scene'});let model;
 try{model=await withDeadline(new GLTFLoader().parseAsync(JSON.stringify(g),base.href),'GLTF '+key);}finally{URL.revokeObjectURL(binaryURL);imageURLs.forEach(u=>URL.revokeObjectURL(u));}
 g.images=(c.images||[]).map(img=>({...img.definition,uri:img.payload}));
 onProgress({key,phase:'scene-ready'});
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
 return{expression:describeExpression(c),key,object,g,binary,model,root:model.scene,nodes,primitives,rest,mixer,setTime,closure,showClosures,showChassisCandidates,inventory,showAll};
}
