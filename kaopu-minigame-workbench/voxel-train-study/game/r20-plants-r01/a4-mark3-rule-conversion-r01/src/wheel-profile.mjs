/**
 * Exact portable WRP1 radial wheel coordinate decoder.
 * No source positions in code; shape comes from float32 profile parameters.
 * Trig uses fixed binary64 samples; no Math.sin/cos and no fused multiply-add.
 * This produces POSITION only. Normals, UVs, indices and materials are retained.
 */
export const QUARTER_SIN = Object.freeze([
 0.0,0.0980171403295606,0.19509032201612825,0.29028467725446233,
 0.3826834323650898,0.47139673682599764,0.5555702330196022,0.6343932841636455,
 0.7071067811865475,0.773010453362737,0.8314696123025452,0.8819212643483549,
 0.9238795325112867,0.9569403357322089,0.9807852804032304,0.9951847266721968,1.0,
]);
export function sin64(k) {
  k=((k%64)+64)%64;
  const q=Math.floor(k/16),j=k%16;
  return [QUARTER_SIN[j],QUARTER_SIN[16-j],-QUARTER_SIN[j],-QUARTER_SIN[16-j]][q];
}
export function generateBase(profiles) {
  const pointCount=profiles.reduce((sum,p)=>sum+p.samples*p.sides,0);
  const out=new Float32Array(pointCount*3);let at=0;
  for (const p of profiles) {
    for(let side=0;side<p.sides;side++) {
      const xx=side===0?p.x:-p.x;
      for(let k=0;k<p.samples;k++) {
        const step=p.samples===1?0:p.phase+(64/p.samples)*k;
        // Explicit separate IEEE-754 binary64 multiply/subtract/add, then binary32.
        const dy=p.radius*sin64(step+16),dz=p.radius*sin64(step);
        out[at++]=xx;out[at++]=p.centerY-dy;out[at++]=p.centerZ+dz;
      }
    }
  }
  return out;
}
export function decodeRaw(input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<32 || String.fromCharCode(...bytes.subarray(0,4))!=='WRP1')throw new Error('Not WRP1');
  const mesh=view.getUint32(4,true),field=view.getUint32(8,true),vertexCount=view.getUint32(12,true),
    profileCount=view.getUint32(16,true),uniqueCount=view.getUint32(20,true),
    orderBytes=view.getUint32(24,true),residualBytes=view.getUint32(28,true);
  if(orderBytes!==vertexCount*2)throw new Error('Invalid source-order map length');
  let at=32;const profiles=[];
  for(let i=0;i<profileCount;i++,at+=20) {
    const p={x:view.getFloat32(at,true),radius:view.getFloat32(at+4,true),centerY:view.getFloat32(at+8,true),
      centerZ:view.getFloat32(at+12,true),samples:view.getUint8(at+16),sides:view.getUint8(at+17),phase:view.getUint16(at+18,true)};
    if(![1,32,64].includes(p.samples)||![1,2].includes(p.sides)||p.phase>1)throw new Error('Invalid radial profile');
    profiles.push(p);
  }
  const orderAt=at;at+=orderBytes;
  if(at+residualBytes!==bytes.length)throw new Error('Invalid record length');
  const canonical=generateBase(profiles),bits=new Uint32Array(canonical.buffer);
  if(canonical.length!==uniqueCount*3)throw new Error('Invalid canonical point count');
  for(let i=0;i<bits.length;i++) {
    let zig=0,multiplier=1,byte;
    do {
      if(at>=bytes.length || multiplier>2**35)throw new Error('Invalid residual varint');
      byte=bytes[at++];zig+=(byte&127)*multiplier;multiplier*=128;
    } while(byte>=128);
    const delta=zig%2===0?zig/2:-(zig+1)/2;
    bits[i]=bits[i]+delta;
  }
  if(at!==bytes.length)throw new Error('Trailing residual bytes');
  const positions=new Float32Array(vertexCount*3),outputBits=new Uint32Array(positions.buffer);
  for(let i=0;i<vertexCount;i++) {
    const key=view.getUint16(orderAt+i*2,true);
    if(key>=uniqueCount)throw new Error('Invalid canonical point address');
    outputBits.set(bits.subarray(key*3,key*3+3),i*3);
  }
  return {mesh,field,vertexCount,uniqueCount,profiles,positions};
}
export async function decodeGzip(input) {
  // Works in current browsers. Node caller can invoke decodeRaw(gunzipSync(...)).
  const stream=new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'));
  return decodeRaw(new Uint8Array(await new Response(stream).arrayBuffer()));
}
