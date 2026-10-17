/** Shared sphere lattice also drives affine quarter-circle bevels. No source arrays. */
import {sinSample} from './sphere-kernel.mjs';
export function sampleArc(params,k,radiusScale=1){
  if(!Number.isInteger(k)||k<0||k>4)throw new Error('Quarter arc sample outside 0..4');
  const c=sinSample(k+4,16),s=sinSample(k,16);
  return [0,1,2].map(a=>params[a]+((params[3+a]*c+params[6+a]*s)*radiusScale));
}
export function decodeRaw(bytes,{radiusScale=1}={}){
  if(!Number.isFinite(radiusScale)||radiusScale<=0)throw new Error('radiusScale must be positive and finite');
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(new TextDecoder().decode(data.subarray(0,8))!=='A4QARC01')throw new Error('Invalid quarter-arc program');
  let off=8;const u32=()=>{const v=dv.getUint32(off,true);off+=4;return v;};
  const vertices=u32(),arcs=u32(),nraw=u32(),deltaBytes=u32();
  if(arcs>6553||vertices>10000000)throw new Error('Invalid quarter-arc counts');
  const params=[];
  for(let i=0;i<arcs;i++){const p=[];for(let a=0;a<9;a++){p.push(dv.getFloat32(off,true));off+=4;}if(!p.every(Number.isFinite))throw new Error('Nonfinite arc parameters');params.push(p);}
  const tags=new Uint16Array(vertices);let rawCount=0;
  for(let i=0;i<vertices;i++){const tag=dv.getUint16(off,true);off+=2;if(tag>arcs*10)throw new Error('Invalid target address');tags[i]=tag;if(tag===0)rawCount++;}
  if(rawCount!==nraw)throw new Error('Invalid raw point count');
  const rawStart=off;off+=nraw*12;if(off+deltaBytes!==data.length)throw new Error('Incorrect residual length');
  const points=new Float32Array(arcs*15),bits=new Uint32Array(points.buffer);
  for(let i=0;i<arcs;i++)for(let k=0;k<5;k++){
    const at=i*15+k*3;points.set(sampleArc(params[i],k,radiusScale),at);
    for(let a=0;a<3;a++){
      let v=0,mul=1,b;do{if(off>=data.length||mul>2**35)throw new Error('Invalid bit correction');b=data[off++];v+=(b&127)*mul;mul*=128;}while(b&128);
      const delta=v%2===0?v/2:-(v+1)/2;bits[at+a]=(bits[at+a]+delta)>>>0;
    }
  }
  if(off!==data.length)throw new Error('Trailing quarter-arc bytes');
  const out=new Float32Array(vertices*3),obits=new Uint32Array(out.buffer);let r=rawStart;
  for(let i=0;i<vertices;i++){
    const tag=tags[i];if(!tag){for(let a=0;a<3;a++){obits[i*3+a]=dv.getUint32(r,true);r+=4;}continue;}
    const index=tag-1,arc=Math.floor(index/10),k=index%10,at=arc*15+(k%5)*3;
    for(let a=0;a<3;a++)obits[i*3+a]=bits[at+a];if(k>=5)obits[i*3]^=0x80000000;
  }
  return out;
}
