import {decodeRaw as decodeWheelHybrid} from './wheel-hybrid.mjs';
import {decodeSpringTorusPositions} from './spring-tori.mjs';
import {decodeRaw as decodeWheel} from './wheel-profile.mjs';
import {decodeRivetPositions} from './rivet-spheres.mjs';
/** kaopu.exact-component-program v1. Data rules and complete component instantiation. */
export const CONTRACT='kaopu.exact-component-program/1';
const clone=x=>structuredClone(x);
const componentTypes={5120:['getInt8','setInt8',1],5121:['getUint8','setUint8',1],5122:['getInt16','setInt16',2],5123:['getUint16','setUint16',2],5125:['getUint32','setUint32',4],5126:['getFloat32','setFloat32',4]};
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function runtimeLock(value){
 const tagged=x=>{
  if(x===null)return ['null'];if(typeof x==='boolean')return ['bool',x];
  if(typeof x==='number'){const b=new ArrayBuffer(8);new DataView(b).setFloat64(0,x,false);return ['number64',[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('')];}
  if(typeof x==='string')return ['string',x];
  if(Array.isArray(x))return ['array',x.map(tagged)];
  return ['object',Object.keys(x).sort().map(k=>[k,tagged(x[k])])];
 };
 return sha256(new TextEncoder().encode(JSON.stringify(tagged(value))));
}
function hexBytes(hex){if(hex.length%2)throw Error('Invalid hex');return Uint8Array.from(hex.match(/../g)||[],x=>parseInt(x,16));}
function concatenate(chunks){const out=new Uint8Array(chunks.reduce((n,c)=>n+c.byteLength,0));let p=0;for(const chunk of chunks){out.set(chunk,p);p+=chunk.byteLength;}return out;}
export function generateRule(rule,definition,residual,shapeAssets=new Map()){
 const op=rule.op, spec=componentTypes[definition.componentType];if(!spec)throw Error('Unsupported componentType');
 const [get,set,size]=spec;
 if(op==='radialWheelExact'||op==='radialWheelSubsetExact'||op==='rivetSpheresExact'||op==='springToriExact'){const asset=shapeAssets.get(rule.asset);if(!asset)throw Error('Missing shape asset');const positions=op==='radialWheelExact'?decodeWheel(asset).positions:(op==='radialWheelSubsetExact'?decodeWheelHybrid(asset).positions:(op==='rivetSpheresExact'?decodeRivetPositions(asset):decodeSpringTorusPositions(asset)));return new Uint8Array(positions.buffer,positions.byteOffset,positions.byteLength);}
 if(op==='residual'){const end=rule.byteOffset+rule.byteLength;if(rule.byteOffset<0||end>residual.length)throw Error('Truncated residual');return residual.slice(rule.byteOffset,end);}
 if(op==='constantTuple'){const tuple=hexBytes(rule.tupleHex),out=new Uint8Array(tuple.length*rule.repeatCount);for(let i=0;i<rule.repeatCount;i++)out.set(tuple,i*tuple.length);return out;}
 if(op==='arithmeticExact'){
  const out=new Uint8Array(rule.scalarCount*size),view=new DataView(out.buffer);
  for(let i=0;i<rule.scalarCount;i++){const value=rule.first+i*rule.step;view[set](i*size,value,true);if(view[get](i*size,true)!==value)throw Error('Arithmetic rule would round');}
  return out;
 }
 if(op==='repeatIndexBlock'){
  if(definition.componentType===5126)throw Error('Index rule requires integer definition');
  const out=new Uint8Array(rule.block.length*rule.repeatCount*size),view=new DataView(out.buffer);let offset=0;
  for(let i=0;i<rule.repeatCount;i++)for(const base of rule.block){const value=base+i*rule.stride;view[set](offset,value,true);if(view[get](offset,true)!==value)throw Error('Index rule overflow');offset+=size;}
  return out;
 }
 throw Error('Unknown rule '+op);
}
export async function decodeField(fun,residual,shapeAssets=new Map()){
 const bytes=concatenate(fun.program.map(r=>generateRule(r,fun.definition,residual,shapeAssets)));
 if(bytes.byteLength!==fun.byteLength||await sha256(bytes)!==fun.sha256)throw Error('Field integrity mismatch '+fun.id);
 return bytes;
}
export function instantiateMesh(fun,instance){
 if(fun.primitives.length!==instance.primitiveBindings.length)throw Error('Primitive binding count');
 const result=clone(instance.properties);
 result.primitives=fun.primitives.map((t,i)=>{const b=instance.primitiveBindings[i],p=clone(t.properties);
  if('attributes'in t)p.attributes=Object.fromEntries(Object.keys(t.attributes).map(name=>[name,b.attributes[name]]));
  if('indices'in t)p.indices=b.indices;
  if('targets'in t)p.targets=t.targets.map((target,j)=>Object.fromEntries(Object.keys(target).map(name=>[name,b.targets[j][name]])));
  if(b.materialPresent)p.material=clone(b.material);return p;
 });return result;
}
export function instantiateComponent(fun,instance,meshInstances){
 const slots=new Map(instance.slots.map(s=>[s.slotId,s]));
 return fun.slots.map(t=>{const p=slots.get(t.slotId);if(!p)throw Error('Missing component slot');const node=clone(p.properties);
  if(t.children==='external'){if(p.childrenPresent)node.children=clone(p.externalChildren);}
  else if(t.children!==null)node.children=t.children.map(id=>slots.get(id).sourceNodeIndex);
  if(t.meshFunction!==null){if(meshInstances.get(p.sourceMeshIndex)?.function!==t.meshFunction)throw Error('Component mesh binding mismatch');node.mesh=p.sourceMeshIndex;}
  return {index:p.sourceNodeIndex,node,graph:{...clone(p.graphMetadata),definition:clone(node)}};
 });
}
export function instantiateAnimation(animation,curves){return {...clone(animation.properties),channels:clone(animation.channels),samplers:animation.samplerInstances.map(s=>({...clone(curves.get(s.function).properties),input:s.input,output:s.output}))};}
function validateMeshBindings(fun,instance,fieldIds){
 for(let i=0;i<fun.primitives.length;i++){const t=fun.primitives[i],b=instance.primitiveBindings[i];
  const check=(expected,actual)=>{if(fieldIds.get(actual)!==expected)throw Error('Typed field binding mismatch');};
  if(t.attributes)for(const name of Object.keys(t.attributes))check(t.attributes[name],b.attributes[name]);
  if('indices'in t)check(t.indices,b.indices);
  if(t.targets)t.targets.forEach((target,j)=>{for(const name of Object.keys(target))check(target[name],b.targets[j][name]);});
 }
}
export async function reconstructDocument(manifest,residual,shapeAssets=new Map()){
 if(manifest.schema!=='kaopu.exact-component-program'||manifest.version!==1)throw Error('Unsupported program schema');
 if(residual.byteLength!==manifest.residual.bytes||await sha256(residual)!==manifest.residual.sha256)throw Error('Residual integrity mismatch');
 const rawShapes=new Map();
 for(const asset of manifest.shapeAssets||[]){const bytes=shapeAssets.get(asset.path);if(!bytes)throw Error('Missing shape asset '+asset.path);if(bytes.length!==asset.bytes||await sha256(bytes)!==asset.sha256)throw Error('Shape asset integrity mismatch');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));const raw=new Uint8Array(await new Response(stream).arrayBuffer());if(raw.length!==asset.uncompressedBytes||await sha256(raw)!==asset.uncompressedSHA256)throw Error('Shape raw integrity mismatch');rawShapes.set(asset.path,raw);}
 const fieldFunctions=new Map(manifest.fieldFunctions.map(f=>[f.id,f])),decoded=new Map();
 for(const fun of manifest.fieldFunctions)decoded.set(fun.id,await decodeField(fun,residual,rawShapes));
 const payload=new Uint8Array(manifest.source.fieldPayloadBytes),fields=[],fieldIds=new Map();
 for(const binding of manifest.fieldInstances){const fun=fieldFunctions.get(binding.function),entry={...clone(binding.properties),definition:clone(fun.definition)},bytes=decoded.get(binding.function);
  if(bytes.length!==entry.byteLength||await sha256(bytes)!==entry.sha256)throw Error('Source field integrity mismatch');
  payload.set(bytes,entry.byteOffset);fields.push(entry);fieldIds.set(entry.sourceAccessor,binding.function);
 }
 if(await sha256(payload)!==manifest.source.fieldPayloadSHA256)throw Error('Source payload integrity mismatch');
 const meshFunctions=new Map(manifest.meshFunctions.map(f=>[f.id,f])),meshInstances=new Map(manifest.meshInstances.map(p=>[p.sourceMeshIndex,p]));
 const meshes=Array(meshInstances.size);
 for(const [index,instance]of meshInstances){const fun=meshFunctions.get(instance.function);validateMeshBindings(fun,instance,fieldIds);meshes[index]=instantiateMesh(fun,instance);}
 const componentFunctions=new Map(manifest.componentFunctions.map(f=>[f.id,f])),nodes=Array(manifest.source.nodeCount),graph=Array(nodes.length);
 for(const instance of manifest.componentInstances)for(const item of instantiateComponent(componentFunctions.get(instance.function),instance,meshInstances)){
  if(nodes[item.index]!==undefined)throw Error('Node instantiated twice');nodes[item.index]=item.node;graph[item.index]=item.graph;
 }
 for(let i=0;i<nodes.length;i++)if(nodes[i]===undefined)throw Error('Uninstantiated node');
 const skeleton={...clone(manifest.sceneConstants),nodes,meshes};
 if(manifest.source.animationsPresent){const curves=new Map(manifest.curveFunctions.map(c=>[c.id,c]));
  for(const a of manifest.animations)for(const s of a.samplerInstances){const c=curves.get(s.function);if(fieldIds.get(s.input)!==c.input||fieldIds.get(s.output)!==c.output)throw Error('Curve field binding mismatch');}
  skeleton.animations=manifest.animations.map(a=>instantiateAnimation(a,curves));
 }
 const document={...clone(manifest.sourceEnvelope),content:{...clone(manifest.contentMetadata),fields,objectGraph:graph,displaySkeleton:skeleton}};
 if(await runtimeLock(document.content)!==manifest.source.runtimeDefinitionSHA256)throw Error('Runtime definition integrity mismatch');
 return {document,payload,sharedDecodedFields:decoded};
}
/** Renderer adapter only: GLTFLoader is optional and is not the stored model expression. */
export function makeGltfBridge(document,binaryURI,imageBaseURL=''){
 const c=document.content,g=clone(c.displaySkeleton);
 g.buffers=[{byteLength:c.fieldPayload.bytes,uri:binaryURI}];
 g.bufferViews=c.fields.map(f=>({buffer:0,byteOffset:f.byteOffset,byteLength:f.byteLength}));
 g.accessors=c.fields.map((f,i)=>({...clone(f.definition),bufferView:i,byteOffset:0}));
 g.images=c.images.map(im=>({...clone(im.definition),uri:imageBaseURL+im.payload}));return g;
}

/** Fetches only this program, explicit residual, and its shape assets. No R03 fallback. */
export async function loadProgram(baseURL){
 const base=new URL(baseURL,globalThis.location?.href||'http://localhost/');
 const get=async path=>{const response=await fetch(new URL(path,base));if(!response.ok)throw Error('Asset fetch failed '+path);return new Uint8Array(await response.arrayBuffer());};
 const manifest=JSON.parse(new TextDecoder().decode(await get('program.json')));
 const residual=await get(manifest.residual.path);const shapes=new Map();
 for(const asset of manifest.shapeAssets||[])shapes.set(asset.path,await get(asset.path));
 return reconstructDocument(manifest,residual,shapes);
}
