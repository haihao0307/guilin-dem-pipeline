/** WU01 projected/angle-strip UVs with exact bits and explicit seam/outlier records. */
import {sin64} from './wheel-profile.mjs';
export function decodeRaw(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<32||String.fromCharCode(...b.subarray(0,4))!=='WU01')throw new Error('Not WU01');
 const mesh=v.getUint32(4,true),field=v.getUint32(8,true),vertexCount=v.getUint32(12,true),tc=v.getUint32(16,true),cb=v.getUint32(20,true),rb=v.getUint32(24,true),ub=v.getUint32(28,true);
 if(cb!==vertexCount*2)throw new Error('Invalid UV map');let at=32;const templates=[];
 for(let i=0;i<tc;i++,at+=28)templates.push([...Array.from({length:6},(_,j)=>v.getFloat32(at+j*4,true)),v.getUint8(at+24)]);
 const codeAt=at;at+=cb;const end=at+rb;let rawAt=end;if(end+ub!==b.length)throw new Error('Invalid UV length');
 const uv=new Float32Array(vertexCount*2),bits=new Uint32Array(uv.buffer),tmp=new Float32Array(2),tmpBits=new Uint32Array(tmp.buffer);
 for(let i=0;i<vertexCount;i++){
  const code=v.getUint16(codeAt+i*2,true);
  if(code===65535){bits[i*2]=v.getUint32(rawAt,true);bits[i*2+1]=v.getUint32(rawAt+4,true);rawAt+=8;continue;}
  const t=templates[Math.floor(code/64)],k=code%64;if(!t)throw new Error('Unknown UV template');
  if(t[6]===0){const co=sin64(k+16),si=sin64(k);tmp[0]=(t[0]+t[1]*co)+t[2]*si;tmp[1]=(t[3]+t[4]*co)+t[5]*si;}
  else{tmp[0]=t[0]+t[1]*k;tmp[1]=t[3]+t[4]*k;}
  for(let j=0;j<2;j++){let zig=0,m=1,c;do{if(at>=end||m>2**35)throw new Error('Invalid UV residual');c=b[at++];zig+=(c&127)*m;m*=128;}while(c>=128);bits[i*2+j]=tmpBits[j]+(zig%2===0?zig/2:-(zig+1)/2);}
 }
 if(at!==end||rawAt!==b.length)throw new Error('Invalid UV payload tail');return {mesh,field,vertexCount,templates,uv};
}
export async function decodeGzip(input){const stream=new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'));return decodeRaw(new Uint8Array(await new Response(stream).arrayBuffer()));}
