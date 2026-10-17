import {decodeMainShellOverlay} from './main-shell-overlay.mjs';
import {decodeUpperStripOverlay} from './upper-strip.mjs';
export function decodeExtendedMainShell(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<28||new TextDecoder().decode(b.subarray(0,8))!=='M3SHP201')throw Error('Invalid extended main shell');
 const field=v.getUint32(8,true),sourceVertexCount=v.getUint32(12,true),total=v.getUint32(16,true),mainBytes=v.getUint32(20,true),upperBytes=v.getUint32(24,true);
 if(b.length!==28+mainBytes+upperBytes)throw Error('Invalid extended main shell section size');
 const m=decodeMainShellOverlay(b.subarray(28,28+mainBytes)),u=decodeUpperStripOverlay(b.subarray(28+mainBytes));
 if(m.field!==field||u.field!==field||m.sourceVertexCount!==sourceVertexCount||u.sourceVertexCount!==sourceVertexCount||m.vertexIndices.length+u.vertexIndices.length!==total)throw Error('Invalid extended main shell source counts');
 const vertexIndices=new Uint32Array(total),positions=new Float32Array(total*3);vertexIndices.set(m.vertexIndices);vertexIndices.set(u.vertexIndices,m.vertexIndices.length);positions.set(m.positions);positions.set(u.positions,m.positions.length);
 if(new Set(vertexIndices).size!==total||vertexIndices.some(i=>i>=sourceVertexCount))throw Error('Invalid extended main shell bindings');
 return {field,sourceVertexCount,vertexIndices,positions};
}
