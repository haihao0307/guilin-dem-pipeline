/** WN01 rotational normal templates plus exact bit corrections and explicit raw exceptions. */
import {sin64} from './wheel-profile.mjs';
export function decodeRaw(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<32||String.fromCharCode(...b.subarray(0,4))!=='WN01')throw new Error('Not WN01');
 const mesh=v.getUint32(4,true),field=v.getUint32(8,true),vertexCount=v.getUint32(12,true),tc=v.getUint32(16,true),cb=v.getUint32(20,true),rb=v.getUint32(24,true),ub=v.getUint32(28,true);
 if(cb!==vertexCount*2)throw new Error('Invalid normal map length');
 let at=32;const templates=[];
 for(let i=0;i<tc;i++,at+=12)templates.push([v.getFloat32(at,true),v.getFloat32(at+4,true),v.getFloat32(at+8,true)]);
 const codeAt=at;at+=cb;const end=at+rb;let rawAt=end;
 if(end+ub!==b.length)throw new Error('Invalid normal data length');
 const normals=new Float32Array(vertexCount*3),bits=new Uint32Array(normals.buffer),tmp=new Float32Array(3),tmpBits=new Uint32Array(tmp.buffer);
 for(let i=0;i<vertexCount;i++){
  const code=v.getUint16(codeAt+i*2,true);
  if(code===65535){for(let j=0;j<3;j++)bits[i*3+j]=v.getUint32(rawAt+j*4,true);rawAt+=12;continue;}
  const t=templates[Math.floor(code/128)],side=Math.floor(code%128/64),k=code%64,co=sin64(k+16),si=sin64(k);
  if(!t)throw new Error('Unknown normal template');
  const y1=t[1]*co,y2=t[2]*si,z1=t[1]*si,z2=t[2]*co;
  tmp[0]=side===0?t[0]:-t[0];tmp[1]=-y1+y2;tmp[2]=z1+z2;
  for(let j=0;j<3;j++){
   let zig=0,mul=1,c;
   do{if(at>=end||mul>2**35)throw new Error('Invalid normal residual');c=b[at++];zig+=(c&127)*mul;mul*=128;}while(c>=128);
   bits[i*3+j]=tmpBits[j]+(zig%2===0?zig/2:-(zig+1)/2);
  }
 }
 if(at!==end||rawAt!==b.length)throw new Error('Invalid normal payload tail');
 return {mesh,field,vertexCount,templates,normals};
}
export async function decodeGzip(input){const stream=new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'));return decodeRaw(new Uint8Array(await new Response(stream).arrayBuffer()));}
