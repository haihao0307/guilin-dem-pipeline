import {decodeLatheOverlay} from './bogie-lathes.mjs';
import {decodeBogieTorusOverlay} from './bogie-tori.mjs';
export function decodeBogieOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3BOVR01')throw Error('Invalid bogie multi-rule pack');
 const nl=v.getUint32(8,true),nt=v.getUint32(12,true);if(b.length!==16+nl+nt)throw Error('Bad bogie pack sections');
 const a=decodeLatheOverlay(b.subarray(16,16+nl)),c=decodeBogieTorusOverlay(b.subarray(16+nl));
 if(a.field!==c.field||a.sourceVertexCount!==c.sourceVertexCount)throw Error('Mismatched bogie fields');
 const indices=new Uint32Array(a.vertexIndices.length+c.vertexIndices.length);indices.set(a.vertexIndices);indices.set(c.vertexIndices,a.vertexIndices.length);
 if(new Set(indices).size!==indices.length)throw Error('Overlapping bogie geometry targets');
 const positions=new Float32Array(a.positions.length+c.positions.length);positions.set(a.positions);positions.set(c.positions,a.positions.length);
 return {field:a.field,sourceVertexCount:a.sourceVertexCount,vertexIndices:indices,positions};
}
