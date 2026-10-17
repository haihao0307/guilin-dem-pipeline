import {generateWindowBand} from './window-bevel.mjs';
export function decodeWindowFamilies(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3WINF01')throw Error('Bad window families');
 const field=v.getUint32(8,true),sourceVertexCount=v.getUint32(12,true),families=v.getUint32(16,true),total=v.getUint32(20,true),stations=Array.from({length:3},(_,i)=>v.getFloat64(24+i*8,true));
 let at=48,out=0;const ids=new Uint32Array(total),positions=new Float32Array(total*3),outBits=new Uint32Array(positions.buffer);
 function vu(){let value=0,shift=0,byte;do{if(at>=b.length)throw Error('Truncated integer');byte=b[at++];value+=(byte&127)*2**shift;shift+=7;if(shift>35)throw Error('Bad integer');}while(byte&128);return value;}
 for(let family=0;family<families;family++){
  const nu=v.getUint32(at,true),nc=v.getUint32(at+4,true),rs=v.getUint32(at+8,true);at+=12;
  const p=Array.from({length:11},(_,i)=>v.getFloat64(at+i*8,true));at+=88;const grid=generateWindowBand(p,stations),unique=new Float32Array(nu*3),bits=new Uint32Array(unique.buffer);
  for(let i=0;i<nu;i++){const j=b[at++];if(j>=180)throw Error('Bad sample');unique.set(grid.subarray(j*3,j*3+3),i*3);}
  const end=at+rs;for(let i=0;i<nu*3;i++){const z=vu();bits[i]+=z%2?-(Math.floor(z/2)+1):z/2;}if(at!==end)throw Error('Bad residual length');
  for(let copy=0;copy<nc;copy++){
   const flags=v.getUint32(at,true),n=v.getUint32(at+4,true),ads=v.getUint32(at+8,true);at+=12;if(flags>3)throw Error('Bad reflection');const ae=at+ads;let previous=0;
   for(let i=0;i<n;i++){previous+=vu();if(previous>=sourceVertexCount)throw Error('Bad source address');ids[out+i]=previous;}if(at!==ae)throw Error('Bad address length');
   for(let i=0;i<n;i++){const j=b[at++];if(j>=nu)throw Error('Bad unique mapping');const k=(out+i)*3;positions.set(unique.subarray(j*3,j*3+3),k);if(flags&1)outBits[k]^=0x80000000;if(flags&2)outBits[k+2]^=0x80000000;}
   out+=n;
  }
 }
 if(at!==b.length||out!==total||new Set(ids).size!==total)throw Error('Bad family totals');return {field,sourceVertexCount,vertexIndices:ids,positions};
}
