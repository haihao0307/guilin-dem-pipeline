/** WCC1 circular arc completion of WSC1 raw tail; no old raw tail remains in record. */
import {sin64} from './wheel-profile.mjs';import {decodeRaw as decodeSpokeRaw} from './spoke-shape.mjs';
export function decodeRaw(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<48||String.fromCharCode(...b.subarray(0,4))!=='WCC1')throw new Error('Not WCC1');
 const [mesh,field,vertexCount,sl,tc,gc,pc,pl,ml,rl,ul]=Array.from({length:11},(_,i)=>v.getUint32(4+i*4,true));if(ml!==tc*2||pl!==pc*24)throw new Error('Bad offset arc map');
 let at=48;const prefix=b.subarray(at,at+sl);at+=sl;const profiles=Array.from({length:pc},(_,i)=>Array.from({length:6},(_,j)=>v.getFloat32(at+i*24+j*4,true)));at+=pl;const mapAt=at;at+=ml;const end=at+rl;let rawAt=end,generated=0;if(end+ul!==b.length)throw new Error('Bad arc length');
 const tail=new Uint8Array(tc*12),tailView=new DataView(tail.buffer),tmp=new Float32Array(3),tmpBits=new Uint32Array(tmp.buffer);
 for(let i=0;i<tc;i++){
  const code=v.getUint16(mapAt+i*2,true);if(code===65535){tail.set(b.subarray(rawAt,rawAt+12),i*12);rawAt+=12;continue;}
  const p=profiles[Math.floor(code/128)],side=Math.floor(code%128/64),k=code%64,co=sin64(k+16),si=sin64(k);if(!p)throw new Error('Unknown arc profile');const [x,cy,cz,r,cp,sp]=p;tmp[0]=side?-x:x;tmp[1]=cy+r*(co*cp-si*sp);tmp[2]=cz+r*(si*cp+co*sp);generated++;
  for(let c=0;c<3;c++){let zig=0,m=1,ch;do{if(at>=end||m>2**35)throw new Error('Bad arc residual');ch=b[at++];zig+=(ch&127)*m;m*=128;}while(ch>=128);tailView.setUint32(i*12+c*4,tmpBits[c]+(zig%2===0?zig/2:-(zig+1)/2),true);}
 }
 if(at!==end||rawAt!==b.length||generated!==gc)throw new Error('Bad arc tail reconstruction');const combined=new Uint8Array(sl+tail.length);combined.set(prefix);combined.set(tail,sl);const result=decodeSpokeRaw(combined);if(result.mesh!==mesh||result.field!==field||result.vertexCount!==vertexCount)throw new Error('Wrong spoke prefix');return {...result,newAnalyticCircularArcVertices:gc,remainingExplicitRawVertices:ul/12};
}
export async function decodeGzip(input){return decodeRaw(new Uint8Array(await new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));}
