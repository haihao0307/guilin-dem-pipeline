// XY comes from a shared retained transverse profile; Z and domain samples are explicit data.
export function sampleShellProfile(profile,label,q){
 if(label<128)return [profile[label*2],profile[label*2+1]];
 const j=label-128,t=q/65535;
 return [profile[j*2]+(profile[(j+1)*2]-profile[j*2])*t,profile[j*2+1]+(profile[(j+1)*2+1]-profile[j*2+1])*t];
}
export function decodeShellProfile(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3SHPR01')throw Error('Bad shell profile');
 const field=v.getUint32(8,true),sourceVertexCount=v.getUint32(12,true),n=v.getUint32(16,true),nu=v.getUint32(20,true),np=v.getUint32(24,true),nz=v.getUint32(28,true),rs=v.getUint32(32,true),ads=v.getUint32(36,true);
 let at=40;const profile=Array.from({length:np*2},(_,i)=>v.getFloat32(at+i*4,true));at+=np*8;
 const zv=Array.from({length:nz},(_,i)=>v.getFloat32(at+i*4,true));at+=nz*4;
 function vu(){let value=0,shift=0,byte;do{if(at>=b.length)throw Error('Truncated integer');byte=b[at++];value+=(byte&127)*2**shift;shift+=7;if(shift>35)throw Error('Bad integer');}while(byte&128);return value;}
 const unique=new Float32Array(nu*3),bits=new Uint32Array(unique.buffer);
 for(let i=0;i<nu;i++){
  const label=b[at++];let q=0;if(label>=128){q=v.getUint16(at,true);at+=2;}
  const zi=vu();if(zi>=nz||(label&127)>=np-(label>=128?1:0))throw Error('Bad sample');
  const [x,y]=sampleShellProfile(profile,label,q);unique.set([x,y,zv[zi]],i*3);
 }
 const end=at+rs;
 for(let i=0;i<nu;i++)for(let k=0;k<2;k++){const z=vu(),delta=z%2?-(Math.floor(z/2)+1):z/2;bits[i*3+k]+=delta;}
 if(at!==end)throw Error('Bad residual length');
 const ids=new Uint32Array(n),positions=new Float32Array(n*3),outBits=new Uint32Array(positions.buffer),ae=at+ads;let previous=0;
 for(let i=0;i<n;i++){previous+=vu();if(previous>=sourceVertexCount)throw Error('Bad source address');ids[i]=previous;}
 if(at!==ae)throw Error('Bad address length');
 for(let i=0;i<n;i++){const m=v.getUint16(at,true);at+=2;const j=m&32767;if(j>=nu)throw Error('Bad source map');positions.set(unique.subarray(j*3,j*3+3),i*3);if(m&32768)outBits[i*3]^=0x80000000;}
 if(at!==b.length||new Set(ids).size!==n)throw Error('Invalid shell profile');
 return {field,sourceVertexCount,vertexIndices:ids,positions};
}
