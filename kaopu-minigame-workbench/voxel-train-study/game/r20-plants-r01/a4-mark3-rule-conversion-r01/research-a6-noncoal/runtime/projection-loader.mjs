/** Independent non-coal projection loader. No source-package fallback or hidden coal. */
import {reconstructDocument,verifyImplementation,sha256,runtimeLock} from './src/exact-decoder.mjs';
const unpack=async bytes=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
const requireThat=(value,message)=>{if(!value)throw Error(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function loadProjection(readBytes){
 const requested=[];
 const read=async path=>{requireThat(!path.startsWith('/')&&!path.split('/').includes('..'),'Unsafe dependency path');requested.push(path);return new Uint8Array(await readBytes(path));};
 const manifest=JSON.parse(new TextDecoder().decode(await unpack(await read('a6-inheritance/program.json.gz'))));
 requireThat(manifest.model==='a6-noncoal-inheritance-r01'&&manifest.projection?.schema==='kaopu.noncoal-inheritance-projection/1','Projection scope required');
 await verifyImplementation(manifest,read);
 const record=JSON.parse(new TextDecoder().decode(await read('a6-inheritance/storage-manifest.json'))).residual;
 const chunks=[];let offset=0;
 for(const part of record.parts){const b=await read('a6-inheritance/'+part.path);requireThat(part.offset===offset&&b.length===part.bytes&&await sha256(b)===part.sha256,'Transport part integrity mismatch');chunks.push(b);offset+=b.length;}
 const encoded=new Uint8Array(offset);let pos=0;for(const b of chunks){encoded.set(b,pos);pos+=b.length;}
 requireThat(encoded.length===record.bytes&&await sha256(encoded)===record.sha256,'Assembled transport integrity mismatch');
 const residual=await unpack(encoded);requireThat(residual.length===record.rawBytes&&await sha256(residual)===record.rawSHA256,'Transport raw integrity mismatch');
 const assets=new Map();for(const a of manifest.shapeAssets)assets.set(a.path,await read('a6-inheritance/'+a.path));
 const {document,payload}=await reconstructDocument(manifest,residual,assets);
 for(const im of document.content.images){const b=await read('a6-inheritance/'+im.payload);requireThat(b.length===im.bytes&&await sha256(b)===im.sha256,'Image integrity mismatch');}
 const p=manifest.projection,c=document.content;
 const complement=(count,removed)=>Array.from({length:count},(_,i)=>i).filter(i=>!removed.includes(i));
 requireThat(same(p.removed.sourceFields,Array.from({length:20},(_,i)=>748+i))&&same(p.removed.sourceNodes,[311,312,313,314,315,316])&&same(p.removed.sourceMeshes,[187,188,189,190,191])&&same(p.removed.sourceMaterials,[20]),'Unexpected exclusion scope');
 requireThat(same(p.sourceIndices.fields,complement(942,p.removed.sourceFields))&&same(p.sourceIndices.nodes,complement(331,p.removed.sourceNodes))&&same(p.sourceIndices.meshes,complement(200,p.removed.sourceMeshes))&&same(p.sourceIndices.materials,complement(22,p.removed.sourceMaterials)),'Non-coal inheritance incomplete');
 requireThat(c.fields.length===922&&c.displaySkeleton.nodes.length===325&&c.displaySkeleton.meshes.length===195&&c.displaySkeleton.materials.length===21,'Inheritance count mismatch');
 requireThat(p.fieldLocks.length===922&&p.nodeLocks.length===325,'Missing original identity locks');
 for(let i=0;i<c.fields.length;i++){
  const f=c.fields[i],lock=p.fieldLocks[i];requireThat(lock.projectedAccessor===i&&lock.sourceAccessor===p.sourceIndices.fields[i]&&f.sourceAccessor===i&&f.id===lock.sourceId&&f.byteOffset===lock.projectedByteOffset&&f.byteLength===lock.bytes&&f.sha256===lock.sha256&&await runtimeLock(f.definition)===lock.typedDefinitionSHA256,'Original retained field lock mismatch');
 }
 for(let i=0;i<c.displaySkeleton.nodes.length;i++){
  const n=c.displaySkeleton.nodes[i],g=c.objectGraph[i],lock=p.nodeLocks[i],transform={};for(const k of ['matrix','translation','rotation','scale'])if(k in n)transform[k]=n[k];
  requireThat(lock.projectedNodeIndex===i&&lock.sourceNodeIndex===p.sourceIndices.nodes[i]&&g.id===lock.sourceNodeId&&g.parent===lock.sourceParentId&&await runtimeLock(transform)===lock.sourceTransformSHA256&&await runtimeLock(n)===lock.projectedDefinitionSHA256,'Original retained node lock mismatch');
 }
 requireThat(manifest.source.fieldPayloadSHA256!==p.historicalA4Anchors.fullFieldPayloadSHA256&&manifest.source.fieldPayloadBytes===35178744&&p.newRulesLearned===0&&p.a6DesignCompleted===false,'Full-source/subset scope confusion');
 return {manifest,document,payload,requested};
}
