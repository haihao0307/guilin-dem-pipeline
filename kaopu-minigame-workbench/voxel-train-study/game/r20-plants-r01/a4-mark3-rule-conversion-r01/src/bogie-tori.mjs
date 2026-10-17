import {sinPi24,cosPi24} from './spring-tori.mjs';
export function decodeBogieTorusOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3ATOR01')throw Error('Bad affine torus overlay');
 const field=v.getUint32(8,true),components=v.getUint32(12,true),count=v.getUint32(16,true),sourceVertexCount=v.getUint32(20,true),ratio=v.getFloat64(24,true);
 const indices=new Uint32Array(count),positions=new Float32Array(count*3),bits=new Uint32Array(positions.buffer);let at=32,out=0;
 for(let component=0;component<components;component++){
  const n=v.getUint32(at,true),indexBytes=v.getUint32(at+4,true);at+=8;
  const p=Array.from({length:12},(_,i)=>v.getFloat64(at+i*8,true));at+=96;
  const end=at+indexBytes;let previous=0;
  for(let i=0;i<n;i++){
   let delta=0,shift=0,byte;do{byte=b[at++];delta+=(byte&127)*2**shift;shift+=7;if(shift>35)throw Error('Bad index delta');}while(byte&128);
   previous+=delta;if(previous>=sourceVertexCount)throw Error('Out-of-range overlay vertex');indices[out+i]=previous;
  }
  if(at!==end)throw Error('Bad index stream');const labelAt=at;at+=n*2;const correctionAt=at;at+=n*3;
  for(let vertex=0;vertex<n;vertex++){
   const label=v.getUint16(labelAt+vertex*2,true),theta=Math.floor(label/12),phi=(label%12)*4;
   if(theta>=48)throw Error('Bad torus address');
   const radius=1+ratio*cosPi24(phi),x=radius*cosPi24(theta),y=ratio*sinPi24(phi),z=radius*sinPi24(theta);
   for(let axis=0;axis<3;axis++){
    const scalar=(out+vertex)*3+axis;positions[scalar]=((x*p[3+axis]+y*p[6+axis])+z*p[9+axis])+p[axis];bits[scalar]+=v.getInt8(correctionAt+vertex*3+axis);
   }
  }
  out+=n;
 }
 if(out!==count||at!==b.length)throw Error('Bad torus overlay size');return {field,sourceVertexCount,vertexIndices:indices,positions};
}
