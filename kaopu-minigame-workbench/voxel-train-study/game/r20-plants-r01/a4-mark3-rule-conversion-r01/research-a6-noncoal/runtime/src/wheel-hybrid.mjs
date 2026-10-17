/** WRH1 retains unmodeled positions explicitly, interleaved with exact WRP1 radial output. */
import {decodeRaw as decodeRadialRaw} from './wheel-profile.mjs';
export function decodeRaw(input) {
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<32||String.fromCharCode(...bytes.subarray(0,4))!=='WRH1')throw new Error('Not WRH1');
 const mesh=v.getUint32(4,true),field=v.getUint32(8,true),vertexCount=v.getUint32(12,true),radialSubsetVertices=v.getUint32(16,true),
  maskLength=v.getUint32(20,true),innerLength=v.getUint32(24,true),rawLength=v.getUint32(28,true);
 if(maskLength!==Math.ceil(vertexCount/8)||rawLength!==(vertexCount-radialSubsetVertices)*12||32+maskLength+innerLength+rawLength!==bytes.length)throw new Error('Invalid hybrid wheel lengths');
 const mask=bytes.subarray(32,32+maskLength),inner=decodeRadialRaw(bytes.subarray(32+maskLength,32+maskLength+innerLength));
 if(inner.mesh!==mesh||inner.field!==field||inner.vertexCount!==radialSubsetVertices)throw new Error('Hybrid source identity mismatch');
 const generated=new Uint8Array(inner.positions.buffer),unmodeled=bytes.subarray(32+maskLength+innerLength),output=new Uint8Array(vertexCount*12);
 let gi=0,ri=0;
 for(let i=0;i<vertexCount;i++){
  if(mask[i>>3]&(1<<(i&7))){output.set(generated.subarray(gi,gi+12),i*12);gi+=12;}
  else{output.set(unmodeled.subarray(ri,ri+12),i*12);ri+=12;}
 }
 if(gi!==generated.length||ri!==unmodeled.length)throw new Error('Invalid hybrid subset mask');
 return {...inner,vertexCount,radialSubsetVertices,unmodeledRawVertices:vertexCount-radialSubsetVertices,positions:new Float32Array(output.buffer)};
}
export async function decodeGzip(input){
 const stream=new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'));
 return decodeRaw(new Uint8Array(await new Response(stream).arrayBuffer()));
}
