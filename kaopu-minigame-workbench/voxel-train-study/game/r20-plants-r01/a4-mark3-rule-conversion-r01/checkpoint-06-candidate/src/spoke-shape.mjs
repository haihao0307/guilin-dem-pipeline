/** WSC1 analytic ellipse plus piecewise-linear clipping; no source vertex prototype. */
import {sin64,decodeRaw as decodeRadialRaw} from './wheel-profile.mjs';
export function decodeRaw(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<48||String.fromCharCode(...b.subarray(0,4))!=='WSC1')throw new Error('Not WSC1');
 const [mesh,field,vertexCount,rc,sc,pc,rl,pl,ml,resl,ul]=Array.from({length:11},(_,i)=>v.getUint32(4+i*4,true));if(ml!==vertexCount*2)throw new Error('Bad spoke map');
 let at=48;const radial=decodeRadialRaw(b.subarray(at,at+rl));at+=rl;if(radial.mesh!==mesh||radial.field!==field||radial.vertexCount!==rc)throw new Error('Wrong radial dependency');const radialBits=new Uint32Array(radial.positions.buffer),profileEnd=at+pl,profiles=[];
 for(let i=0;i<pc;i++){const nk=b[at];at+=4;if(nk>3)throw new Error('Too many clipping knots');const knots=Array.from({length:nk},(_,j)=>v.getFloat32(at+j*4,true));at+=nk*4;const nc=(3+nk)*3,coeff=Array.from({length:nc},(_,j)=>v.getFloat32(at+j*4,true));at+=nc*4;profiles.push({knots,coeff});}
 if(at!==profileEnd)throw new Error('Bad analytic parameter count');const mapAt=at;at+=ml;const end=at+resl;let rawAt=end,ri=0,generated=0;if(end+ul!==b.length)throw new Error('Bad spoke length');
 const positions=new Float32Array(vertexCount*3),outputBits=new Uint32Array(positions.buffer),tmp=new Float32Array(3),tmpBits=new Uint32Array(tmp.buffer);
 for(let i=0;i<vertexCount;i++){
  const code=v.getUint16(mapAt+i*2,true);if(code===0){outputBits.set(radialBits.subarray(ri,ri+3),i*3);ri+=3;continue;}if(code===65535){for(let c=0;c<3;c++)outputBits[i*3+c]=v.getUint32(rawAt+c*4,true);rawAt+=12;continue;}
  const n=code-1,pi=Math.floor(n/64),side=Math.floor(n%64/32),k=n%32,p=profiles[pi],s=sin64(k*2),basis=[1,sin64(k*2+16),s,...p.knots.map(t=>Math.abs(s-t))];generated++;
  for(let c=0;c<3;c++){let value=0;for(let j=0;j<basis.length;j++)value=value+p.coeff[j*3+c]*basis[j];tmp[c]=c===0&&side?-value:value;}
  for(let c=0;c<3;c++){let zig=0,m=1,ch;do{if(at>=end||m>2**35)throw new Error('Bad spoke residual');ch=b[at++];zig+=(ch&127)*m;m*=128;}while(ch>=128);outputBits[i*3+c]=tmpBits[c]+(zig%2===0?zig/2:-(zig+1)/2);}
 }
 if(at!==end||rawAt!==b.length||ri!==radialBits.length||generated!==sc)throw new Error('Spoke subset count mismatch');return {mesh,field,vertexCount,previousRadialVertices:rc,newAnalyticProfileVertices:sc,remainingExplicitRawVertices:ul/12,positions};
}
export async function decodeGzip(input){return decodeRaw(new Uint8Array(await new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));}
