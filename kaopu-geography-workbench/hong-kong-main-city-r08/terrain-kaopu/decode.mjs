// KAOPU HK hierarchical bilinear hat spectrum transport adapter.
// The mathematical basis/order match the existing CEDD height-spectrum/0.1.
// Only lossless sparse byte-plane storage and explicit mask/weight channels are new here.
export async function sha256(bytes){if(!globalThis.crypto?.subtle)throw Error('SHA-256 unavailable');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
function axisLookup(axis,size){const cells=new Uint32Array(size),fractions=new Float64Array(size);let i=0;for(let x=0;x<size;x++){while(i<axis.length-2&&axis[i+1]<=x)i++;cells[x]=i;fractions[x]=(x-axis[i])/(axis[i+1]-axis[i]);}return{cells,fractions};}
export function reconstructSpectrum(meta,coeff){
 if(coeff.length!==meta.coefficients.scalars)throw Error('Coefficient count mismatch '+meta.id);
 const {width:w,height:h}=meta,acc=new Float64Array(w*h);
 for(const l of meta.levels){const x=axisLookup(l.xs,w),y=axisLookup(l.ys,h),stride=l.shapeRC[1],offset=l.offsetScalar;
  for(let r=0;r<h;r++){const v=y.fractions[r],row=offset+y.cells[r]*stride;for(let c=0;c<w;c++){const u=x.fractions[c],k=row+x.cells[c];acc[r*w+c]+=(coeff[k]*(1-u)+coeff[k+1]*u)*(1-v)+(coeff[k+stride]*(1-u)+coeff[k+stride+1]*u)*v;}}
 }
 return Float32Array.from(acc);
}
export async function decodeTerrainPacket(meta,encoded){
 const t0=performance.now();if(encoded.byteLength!==meta.transport.bytes||await sha256(encoded)!==meta.transport.sha256)throw Error('Packet integrity mismatch '+meta.id);
 const expanded=await new Response(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(expanded.byteLength!==meta.transport.expandedBytes)throw Error('Packet decoded size '+meta.id);const decompressMs=performance.now()-t0,t1=performance.now();
 const source=new Uint8Array(expanded),n=meta.coefficients.scalars,packed=new Uint8Array(n*8),storage=meta.transport.coefficientStorage;if(storage?.kind!=='zero-bitset-f64-byteplanes'||storage.bitmapBytes!==Math.ceil(n/8))throw Error('Unsupported coefficient storage '+meta.id);let j=0;for(let i=0;i<n;i++){if(!(source[i>>3]&(1<<(i&7))))continue;for(let b=0;b<8;b++)packed[i*8+b]=source[storage.bitmapBytes+b*storage.storedScalars+j];j++;}if(j!==storage.storedScalars)throw Error('Sparse coefficient count '+meta.id);
 if(await sha256(packed)!==meta.coefficients.decodedSHA256)throw Error('Coefficient content mismatch '+meta.id);
 // Supported browsers are little-endian; reject rather than silently corrupt an unusual host.
 if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)throw Error('Terrain transport requires little-endian runtime');
 const coefficients=new Float64Array(packed.buffer),heights=reconstructSpectrum(meta,coefficients),arrays={heights};
 if(await sha256(heights)!==meta.roundTrip.sourceFloat32SHA256)throw Error('Height round-trip integrity mismatch '+meta.id);
 for(const [name,ch]of Object.entries(meta.channels)){const a=source.slice(ch.offsetBytes,ch.offsetBytes+ch.bytes);if(await sha256(a)!==ch.sha256)throw Error('Mask/weight integrity mismatch '+meta.id);arrays[name]=a;}
 return{arrays,metrics:{id:meta.id,compressedBytes:encoded.byteLength,expandedTransportBytes:expanded.byteLength,coefficientsBytes:coefficients.byteLength,derivedArrayBytes:Object.values(arrays).reduce((n,a)=>n+a.byteLength,0),decompressAndHashMs:decompressMs,reconstructAndVerifyMs:performance.now()-t1,totalDecodeMs:performance.now()-t0,allFloat32BitsVerified:true}};
}
