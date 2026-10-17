/** Analytic fixed-sample axial profiles; shares wheel's sin64 operation table. */
import {sin64} from './wheel-profile.mjs';
export function generate(params, labels, axis, n) {
  const out=new Float32Array(labels.length*3),axes=[0,1,2].filter(a=>a!==axis);
  for(let i=0;i<labels.length;i++){
    const step=labels[i]*(64/n),c=sin64(step+16),s=sin64(step);
    out[i*3+axis]=params[0];
    out[i*3+axes[0]]=params[1]+(params[3]*c+params[4]*s);
    out[i*3+axes[1]]=params[2]+(params[5]*c+params[6]*s);
  }
  return out;
}
export function decodeRaw(bytes,{radiusScale=1}={}){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(new TextDecoder().decode(data.subarray(0,8))!=='A4RING01')throw new Error('Invalid A4 circle program');
  const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);let off=8;
  const u32=()=>{const v=dv.getUint32(off,true);off+=4;return v;};
  const vertices=u32(),ng=u32(),nraw=u32(),deltaSize=u32();
  const out=new Float32Array(vertices*3),bits=new Uint32Array(out.buffer),covered=new Uint8Array(vertices);
  for(let g=0;g<ng;g++){
    const axis=dv.getUint8(off),n=dv.getUint8(off+1),count=dv.getUint16(off+2,true);off+=4;
    if(axis>2||![8,16,32,64].includes(n))throw new Error('Invalid axial profile');
    const params=[];for(let j=0;j<7;j++){params.push(dv.getFloat64(off,true));off+=8;}
    if(!params.every(Number.isFinite))throw new Error('Invalid profile parameters');
    for(let j=3;j<7;j++)params[j]*=radiusScale;
    const labels=data.slice(off,off+count);off+=count;const points=generate(params,labels,axis,n);
    for(let j=0;j<count;j++){
      const ix=u32();if(ix>=vertices||covered[ix])throw new Error('Invalid target address');covered[ix]=1;
      out.set(points.subarray(j*3,j*3+3),ix*3);
    }
  }
  let rawCount=0;
  for(let i=0;i<vertices;i++)if(!covered[i]){for(let a=0;a<3;a++)bits[i*3+a]=u32();rawCount++;}
  if(rawCount!==nraw||off+deltaSize!==data.length)throw new Error('Invalid residual bytes');
  for(let i=0;i<vertices;i++)if(covered[i])for(let a=0;a<3;a++){
    let val=0,mul=1,b;do{if(off>=data.length||mul>2**35)throw new Error('Invalid correction');b=data[off++];val+=(b&127)*mul;mul*=128;}while(b&128);
    const delta=val%2===0?val/2:-(val+1)/2;bits[i*3+a]+=delta;
  }
  if(off!==data.length)throw new Error('Trailing corrections');
  return out;
}
