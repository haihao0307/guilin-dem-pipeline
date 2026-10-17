import * as T from 'three';
import {GLTFLoader} from '../../a4-a6-source-comparison-r03/vendor/GLTFLoader.mjs';
import {loadProjection} from '../research-a6-noncoal/runtime/projection-loader.mjs';
import {makeGltfBridge,sha256} from '../research-a6-noncoal/runtime/src/exact-decoder.mjs';
import {getBytes} from './transport.mjs';
export async function loadNoncoal(progress){
 const base=new URL('../research-a6-noncoal/runtime/',import.meta.url),cache=new Map(),requests=[];
 const read=path=>{if(!cache.has(path))cache.set(path,getBytes(new URL(path,base),e=>progress('a4-converted','无煤继承 '+path,e)).then(bytes=>{requests.push({path,bytes:bytes.length});return bytes;}));return cache.get(path);};
 const result=await loadProjection(read),urls=[],binary=URL.createObjectURL(new Blob([result.payload]));urls.push(binary);const g=makeGltfBridge(result.document,binary);
 for(let i=0;i<result.document.content.images.length;i++){const im=result.document.content.images[i],b=await read('a6-inheritance/'+im.payload);const u=URL.createObjectURL(new Blob([b],{type:im.definition.mimeType||'image/png'}));urls.push(u);g.images[i].uri=u;}
 let model;try{model=await new GLTFLoader().parseAsync(JSON.stringify(g),'');}finally{urls.forEach(URL.revokeObjectURL);}
 const nodes=await Promise.all(g.nodes.map((_,i)=>model.parser.getDependency('node',i))),rest=nodes.map(n=>({position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),matrix:n.matrix.clone()})),mixer=new T.AnimationMixer(model.scene);
 const source={key:'a4',root:model.scene,model,nodes,rest,mixer,g,projection:result.manifest.projection,setTime(t){mixer.stopAllAction();nodes.forEach((n,i)=>{n.position.copy(rest[i].position);n.quaternion.copy(rest[i].quaternion);n.scale.copy(rest[i].scale);n.matrix.copy(rest[i].matrix);});if(model.animations[0]){const a=mixer.clipAction(model.animations[0]);a.reset().setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);}model.scene.updateMatrixWorld(true);}};
 return{source,report:{fieldPayloadSHA256:await sha256(result.payload),nodeCount:g.nodes.length,meshCount:g.meshes.length,sourceFallbackUsed:false,coalDependencyPresent:false,removedSourceNodes:result.manifest.projection.removed.sourceNodes,textureMode:'verified-noncoal-dependency-images',requests,storedDependencyBytes:requests.reduce((s,r)=>s+r.bytes,0),a6ExteriorCompleted:false}};
}
