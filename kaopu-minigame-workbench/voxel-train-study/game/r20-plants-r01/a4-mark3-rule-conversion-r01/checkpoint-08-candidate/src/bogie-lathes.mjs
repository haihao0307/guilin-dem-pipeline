import {sinPi24,cosPi24} from './spring-tori.mjs';
/** Partial geometry only. The caller must retain non-target vertices separately. */
export function decodeLatheOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3LATHE1')throw Error('Invalid lathe overlay');
 const field=view.getUint32(8,true),components=view.getUint32(12,true),count=view.getUint32(16,true),sourceVertexCount=view.getUint32(20,true);
 const indices=new Uint32Array(count),positions=new Float32Array(count*3),bits=new Uint32Array(positions.buffer);
 let at=24,out=0;
 for(let component=0;component<components;component++){
   const n=view.getUint32(at,true),indexBytes=view.getUint32(at+4,true);at+=8;
   const p=Array.from({length:40},(_,i)=>view.getFloat64(at+i*8,true));at+=320;
   const indexEnd=at+indexBytes;let previous=0;
   for(let vertex=0;vertex<n;vertex++){
     let delta=0,shift=0,byte;
     do{byte=b[at++];delta+=(byte&127)*2**shift;shift+=7;if(shift>35)throw Error('Bad index delta');}while(byte&128);
     previous+=delta;indices[out+vertex]=previous;
     if(previous>=sourceVertexCount)throw Error('Out-of-range overlay vertex');
   }
   if(at!==indexEnd)throw Error('Lathe index stream length mismatch');
   const labelAt=at;at+=n*2;const correctionAt=at;at+=n*3;
   for(let vertex=0;vertex<n;vertex++){
     const address=view.getUint16(labelAt+vertex*2,true),profile=Math.floor(address/48),theta=address%48;
     if(profile>=14)throw Error('Unknown profile control');
     const h=p[12+profile*2],radius=p[13+profile*2],c=cosPi24(theta),s=sinPi24(theta);
     for(let axis=0;axis<3;axis++){
       const axial=h*p[3+axis];
       const radialDirection=c*p[6+axis]+s*p[9+axis];
       const radial=radius*radialDirection;
       const scalar=(out+vertex)*3+axis;
       positions[scalar]=Math.fround((p[axis]+axial)+radial);
       bits[scalar]+=view.getInt8(correctionAt+vertex*3+axis);
     }
   }
   out+=n;
 }
 if(out!==count||at!==b.length)throw Error('Lathe overlay count mismatch');
 return {field,sourceVertexCount,vertexIndices:indices,positions};
}
