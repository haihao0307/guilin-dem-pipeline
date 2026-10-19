import * as T from 'three';
import {GLTFLoader} from '../a4-full-source-replica-r01/vendor/GLTFLoader.mjs';
import {checkpoint,stageDeadline} from './load-bytes.mjs';
/** Reassemble unchanged scene/material/animation semantics from independently decoded fields. */
export async function restoreDecodedScene(gltf,definitions,fieldBytes,imageURLs,imageDefinitions){
 const g=structuredClone(gltf),offsets=[];let length=0;
 for(const bytes of fieldBytes){length=(length+3)&~3;offsets.push(length);length+=bytes.byteLength;}
 const binary=new Uint8Array(length);fieldBytes.forEach((bytes,i)=>binary.set(bytes,offsets[i]));
 const binaryURL=URL.createObjectURL(new Blob([binary]));g.buffers=[{byteLength:length,uri:binaryURL}];
 g.bufferViews=fieldBytes.map((bytes,i)=>({buffer:0,byteOffset:offsets[i],byteLength:bytes.byteLength}));
 g.accessors=definitions.map((definition,i)=>({...definition,bufferView:i,byteOffset:0}));
 g.images=imageDefinitions.map((definition,i)=>({...definition,uri:imageURLs[i]}));
 await checkpoint('解析学生几何、原材质与动画');
 let model;try{model=await stageDeadline(new GLTFLoader().parseAsync(JSON.stringify(g),location.href),'学生GLTF解析');}finally{URL.revokeObjectURL(binaryURL);}
 const nodes=await Promise.all(g.nodes.map((_,i)=>model.parser.getDependency('node',i)));
 const parents=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>parents.set(j,i)));
 const primitives=[];for(const [i,n] of g.nodes.entries())if(n.mesh!==undefined){const src=g.meshes[n.mesh];const target=nodes[i];const matches=src.primitives.length===1?[target]:target.children.filter(x=>x.isMesh);if(matches.length!==src.primitives.length)throw Error('PRIMITIVE_MAPPING_INCOMPLETE '+i);src.primitives.forEach((p,j)=>{const mesh=matches[j];if(!mesh.isMesh)throw Error('SOURCE_MESH_NOT_RESTORED '+i);mesh.userData.originalPrimitive={source:"a4-student",node:i,mesh:n.mesh,primitive:j,definition:structuredClone(p)};primitives.push({sourceNode:i,primitive:j,definition:p,object:mesh});});}
 nodes.forEach((n,i)=>{n.userData.originalNode={source:"a4-student",index:i,destinationId:`student-a4/node-${i}`,definition:structuredClone(g.nodes[i])};});
 const rest=nodes.map(n=>({position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),matrix:n.matrix.clone()}));
 const mixer=new T.AnimationMixer(model.scene);let action=null;
 function setTime(t,clip=0){if(!Number.isFinite(t)||t<0)throw Error('INVALID_SOURCE_TIME');mixer.stopAllAction();nodes.forEach((n,i)=>{n.position.copy(rest[i].position);n.quaternion.copy(rest[i].quaternion);n.scale.copy(rest[i].scale);n.matrix.copy(rest[i].matrix);});if(model.animations[clip]){action=mixer.clipAction(model.animations[clip]);action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(t);}model.scene.updateMatrixWorld(true);}

 function showAll(){for(const p of primitives)p.object.visible=true;}
 model.scene.updateMatrixWorld(true);
 return{g,binary,model,root:model.scene,nodes,primitives,rest,mixer,setTime,showAll};
}
