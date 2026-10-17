/** Sparse field72 ring+loft overlay, with no uncovered source tail. */
import {generate} from './body-rings.mjs';
import {decodeRaw as decodeLoft} from './loft-coordinate.mjs';
export function decodeRaw(input,{widthScale=1,zShift=0,ringRadiusScale=1}={}) {
 const raw=input instanceof Uint8Array?input:new Uint8Array(input),dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);if(raw.length<36)throw new Error('truncated sparse ring loft');
 if(new TextDecoder().decode(raw.subarray(0,8))!=='A4SPLX01'||dv.getUint32(8,true)!==1)throw new Error('invalid sparse ring loft');
 const field=dv.getUint32(12,true),targetRows=dv.getUint32(16,true),ng=dv.getUint32(20,true),glen=dv.getUint32(24,true),dlen=dv.getUint32(28,true),llen=dv.getUint32(32,true);
 if(raw.length!==36+glen+dlen+llen)throw new Error('invalid sparse ring loft layout');let off=36;const entries=[];
 for(let g=0;g<ng;g++){
  const axis=dv.getUint8(off),n=dv.getUint8(off+1),count=dv.getUint16(off+2,true);off+=4;if(axis>2||![8,16,32,64].includes(n))throw new Error('invalid axial profile');
  const params=[];for(let k=0;k<7;k++){params.push(dv.getFloat64(off,true));off+=8;}if(!params.every(Number.isFinite))throw new Error('invalid parameters');for(let k=3;k<7;k++)params[k]*=ringRadiusScale;
  const labels=raw.slice(off,off+count);off+=count;if(labels.some(v=>v>=n))throw new Error('invalid labels');const points=generate(params,labels,axis,n);
  for(let k=0;k<count;k++){const id=dv.getUint32(off,true);off+=4;if(id>=targetRows)throw new Error('invalid source address');entries.push({id,bits:new Uint32Array(points.buffer,k*12,3).slice()});}
 }
 if(off!==36+glen)throw new Error('invalid group length');entries.sort((a,b)=>a.id-b.id);if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error('duplicate ring source address');const dend=off+dlen;
 for(const entry of entries)for(let axis=0;axis<3;axis++){
  let value=0,mul=1,b;do{if(off>=dend||mul>2**35)throw new Error('invalid correction');b=raw[off++];value+=(b&127)*mul;mul*=128;}while(b&128);
  const delta=value%2===0?value/2:-(value+1)/2;if(ringRadiusScale===1)entry.bits[axis]=(entry.bits[axis]+delta)>>>0;
 }
 if(off!==dend)throw new Error('invalid correction length');const loft=decodeLoft(raw.subarray(off),{widthScale,zShift});if(loft.targetSourceRows!==targetRows)throw new Error('target mismatch');const lb=new Uint32Array(loft.positions.buffer);
 for(let k=0;k<loft.sourceRows.length;k++)entries.push({id:loft.sourceRows[k],bits:lb.slice(k*3,k*3+3)});entries.sort((a,b)=>a.id-b.id);if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error('overlapping sparse sections');
 const ids=new Uint32Array(entries.length),positions=new Float32Array(entries.length*3),bits=new Uint32Array(positions.buffer);entries.forEach((e,k)=>{ids[k]=e.id;bits.set(e.bits,k*3);});return {field,sourceVertexCount:targetRows,vertexIndices:ids,ids,positions};
}
