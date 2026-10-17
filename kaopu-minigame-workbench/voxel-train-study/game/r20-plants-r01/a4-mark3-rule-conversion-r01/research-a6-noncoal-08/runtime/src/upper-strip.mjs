// XY profile function; source Z stations remain explicit sampling data.
export function sampleUpperStrip(profile,segment,t,z,side=1){
 const a=segment*2,b=a+2;
 return [side*(profile[a]+(profile[b]-profile[a])*t),profile[a+1]+(profile[b+1]-profile[a+1])*t,z];
}
export function decodeUpperStripOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3UPSEC1')throw Error('Bad upper-section asset');
 const [field,sourceVertexCount,n,nc,nz,rs,ads]=Array.from({length:7},(_,i)=>v.getUint32(8+i*4,true));let at=36;
 const profile=Array.from({length:6},(_,i)=>v.getFloat32(at+i*4,true));at+=24;
 const z=Array.from({length:nz},(_,i)=>v.getFloat32(at+i*4,true));at+=nz*4;
 const canonical=new Float32Array(nc*3),bits=new Uint32Array(canonical.buffer);
 for(let i=0;i<nc;i++){const c=b[at++],pi=c%3,zi=Math.floor(c/3);if(zi>=nz)throw Error('Bad station');canonical.set(sampleUpperStrip(profile,Math.min(pi,1),pi===2?1:0,z[zi]),i*3);}
 function vu(){let x=0,s=0,c;do{if(at>=b.length)throw Error('Truncated integer');c=b[at++];x+=(c&127)*2**s;s+=7;if(s>35)throw Error('Bad integer');}while(c&128);return x;}
 const re=at+rs;
 for(let i=0;i<nc;i++)for(const axis of [0,1]){const z=vu();bits[i*3+axis]+=z%2?-(Math.floor(z/2)+1):z/2;}
 if(at!==re)throw Error('Bad correction length');
 const vertexIndices=new Uint32Array(n),positions=new Float32Array(n*3),ae=at+ads;let previous=0;
 for(let i=0;i<n;i++){previous+=vu();if(previous>=sourceVertexCount)throw Error('Bad source index');vertexIndices[i]=previous;}
 if(at!==ae)throw Error('Bad address length');
 for(let i=0;i<n;i++){const c=b[at++],ci=Math.floor(c/2);if(ci>=nc)throw Error('Bad source sample');positions.set(canonical.subarray(ci*3,ci*3+3),i*3);if(c&1)positions[i*3]=-positions[i*3];}
 if(at!==b.length||new Set(vertexIndices).size!==n)throw Error('Bad totals');
 return {field,sourceVertexCount,vertexIndices,positions};
}
