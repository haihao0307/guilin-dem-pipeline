import {decodeWindowFamilies}from './window-families.mjs';
import {decodeShellProfile}from './shell-profile.mjs';
export function decodeMainShellOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3MSHL01')throw Error('Bad main shell overlay');
 const field=v.getUint32(8,true),sourceVertexCount=v.getUint32(12,true),total=v.getUint32(16,true),ws=v.getUint32(20,true),ps=v.getUint32(24,true);
 if(b.length!==28+ws+ps)throw Error('Invalid main shell sizes');
 const w=decodeWindowFamilies(b.subarray(28,28+ws)),p=decodeShellProfile(b.subarray(28+ws));
 const vertexIndices=new Uint32Array(total),positions=new Float32Array(total*3);vertexIndices.set(w.vertexIndices);vertexIndices.set(p.vertexIndices,w.vertexIndices.length);positions.set(w.positions);positions.set(p.positions,w.positions.length);
 if(w.field!==field||p.field!==field||w.sourceVertexCount!==sourceVertexCount||p.sourceVertexCount!==sourceVertexCount||w.vertexIndices.length+p.vertexIndices.length!==total||new Set(vertexIndices).size!==total)throw Error('Invalid main shell targets');
 return {field,sourceVertexCount,vertexIndices,positions};
}
