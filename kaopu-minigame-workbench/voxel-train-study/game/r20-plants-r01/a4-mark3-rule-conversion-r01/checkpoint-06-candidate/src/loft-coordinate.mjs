/** Sparse LXZ1 replay. Y remains an explicit authored section control. */
export function decodeRaw(input,{widthScale=1,zShift=0}={}) {
 const raw=input instanceof Uint8Array?input:new Uint8Array(input),d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 if(raw.length<32||String.fromCharCode(...raw.subarray(0,4))!=='LXZ1'||d.getUint32(4,true)!==1)throw new Error('invalid LXZ1 header');
 const ns=d.getUint32(8,true),nc=d.getUint32(12,true),nb=d.getUint32(16,true),targetSourceRows=d.getUint32(20,true),n=ns*nc;
 if(ns<=1||nc<=1||d.getUint32(24,true)||d.getUint32(28,true)||raw.length!==32+16+nc*16+ns*4+n*4+n*2+nb*6)throw new Error('invalid LXZ1 layout');
 let off=32;const center=d.getFloat64(off,true),scale=d.getFloat64(off+8,true);off+=16;if(!(scale>0))throw new Error('invalid station normalization');
 const coeff=Array.from({length:nc},()=>{const a=[d.getFloat64(off,true),d.getFloat64(off+8,true)];off+=16;return a;});
 const stations=Array.from({length:ns},()=>{const v=d.getFloat32(off,true);off+=4;return v;});
 const freeY=Array.from({length:n},()=>{const v=d.getFloat32(off,true);off+=4;return v;});
 const corr=off;off+=n*2;const sourceRows=new Uint32Array(nb);for(let i=0;i<nb;i++){sourceRows[i]=d.getUint32(off,true);off+=4;}
 const tags=new Uint16Array(nb);for(let i=0;i<nb;i++){tags[i]=d.getUint16(off,true);off+=2;}
 if(new Set(sourceRows).size!==nb||sourceRows.some(v=>v>=targetSourceRows)||tags.some(v=>(v&0x7fff)>=n))throw new Error('invalid LXZ1 bindings');
 const base=new Float32Array(n*3),bits=new Uint32Array(base.buffer),correctionsApplied={x:widthScale===1,z:zShift===0};
 for(let station=0;station<ns;station++){
  const z=stations[station],v=(z-center)/scale;
  for(let channel=0;channel<nc;channel++){
   const k=station*nc+channel,x=coeff[channel][0]+coeff[channel][1]*v;
   base[k*3]=x*widthScale;base[k*3+1]=freeY[k];base[k*3+2]=z+zShift;
   if(correctionsApplied.x)bits[k*3]=(bits[k*3]+d.getInt8(corr+k*2))>>>0;
   if(correctionsApplied.z)bits[k*3+2]=(bits[k*3+2]+d.getInt8(corr+k*2+1))>>>0;
  }
 }
 const positions=new Float32Array(nb*3),out=new Uint32Array(positions.buffer);
 for(let i=0;i<nb;i++){const k=(tags[i]&0x7fff)*3;out[i*3]=(bits[k]^(tags[i]&0x8000?0x80000000:0))>>>0;out[i*3+1]=bits[k+1];out[i*3+2]=bits[k+2];}
 return {sourceRows,positions,targetSourceRows,correctionsApplied};
}
