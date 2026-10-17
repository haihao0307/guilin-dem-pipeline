const SIN=[0,.3826834323650898,.7071067811865476,.9238795325112867,1],COS=[...SIN].reverse();
export function generateInteriorFloor(p){
 const [y,xc,rx,zc,az,bz,left,right,step,endWidth,endZ]=p,out=[];
 for(const sx of [-1,1])for(const sz of [-1,1])for(let k=0;k<5;k++)out.push(sx*(xc+rx*COS[k]),y,sz*(zc+az*COS[k]+bz*SIN[k]));
 for(const [sx,start]of [[-1,left],[1,right]])for(let j=0;j<16;j++)out.push(sx*(xc+rx),y,start+step*j);
 for(const sz of [-1,1])for(const j of [-1,0,1])out.push(j*endWidth,y,sz*endZ);
 return Float32Array.from(out);
}
export function generateInteriorWalls(p){
 const [halfWidth,bottom,top,left,right,step]=p,out=[];
 for(const [side,start]of [[-1,left],[1,right]])for(let j=0;j<16;j++)for(const y of [bottom,top])out.push(side*halfWidth,y,start+step*j);
 return Float32Array.from(out);
}
export function decodeInteriorPlanesOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength),magic=new TextDecoder().decode(b.subarray(0,8));let at,canonical,labels,ids,field,n,rs;
 if(magic==='M3FLR001'){field=v.getUint32(8,true);n=v.getUint32(12,true);rs=v.getUint32(16,true);canonical=generateInteriorFloor(Array.from({length:11},(_,i)=>v.getFloat64(20+i*8,true)));at=108;labels=Array.from({length:58},(_,i)=>i);ids=Array.from({length:n},(_,i)=>i);}
 else if(magic==='M3WALL01'){field=v.getUint32(8,true);n=v.getUint32(12,true);const es=v.getUint32(16,true),el=v.getUint32(20,true);rs=v.getUint32(24,true);canonical=generateInteriorWalls(Array.from({length:6},(_,i)=>v.getFloat64(28+i*8,true)));at=76;labels=Array.from({length:64},(_,i)=>i).filter(i=>i!==el);ids=Array.from({length:n},(_,i)=>i).filter(i=>i!==es);}
 else throw Error('Bad interior rule');
 function vu(){let x=0,s=0,c;do{if(at>=b.length)throw Error('Truncated integer');c=b[at++];x+=(c&127)*2**s;s+=7;if(s>35)throw Error('Bad integer');}while(c&128);return x;}
 const bits=new Uint32Array(canonical.buffer),end=at+rs;for(const label of labels)for(let axis=0;axis<3;axis++){const z=vu();bits[label*3+axis]+=z%2?-(Math.floor(z/2)+1):z/2;}
 if(at!==end)throw Error('Bad correction length');const positions=new Float32Array(ids.length*3);
 for(let i=0;i<ids.length;i++){const label=b[at++];if(!labels.includes(label))throw Error('Bad source mapping');positions.set(canonical.subarray(label*3,label*3+3),i*3);}
 if(at!==b.length)throw Error('Bad trailing bytes');return {field,sourceVertexCount:n,vertexIndices:Uint32Array.from(ids),positions};
}
