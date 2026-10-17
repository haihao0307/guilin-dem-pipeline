const SIN=[0,.5,.8660254037844386,1],COS=[...SIN].reverse(),U=.7365470801275338,V=.47827732475813883;
export function generateSeatCushion(p){
 const [hw,hd,yb,yt,rx,ry,rz,fy,fz]=p,zf=hd,zb=-hd+rz,a=[];
 for(const side of [-1,1]){const x=side*hw;a.push([x,yb,zb],[x,yb,zf-fz]);for(const k of [1,2,3])a.push([x,yb+fy*(1-COS[k]),(zf-fz)+fz*SIN[k]]);a.push([x,yt,zf],[x,yt,zb]);}
 for(const side of [-1,1]){const cx=side*(hw-rx);for(const z of [zf,zb])for(const k of [1,2,3])a.push([cx+side*rx*COS[k],yt+ry*SIN[k],z]);for(const y of [yb,yt])for(const k of [1,2,3])a.push([cx+side*rx*COS[k],y,zb-rz*SIN[k]]);for(const k of [1,2])a.push([cx,yt+ry*SIN[k],zb-rz*COS[k]]);for(const [u,v,w]of [[U,V,V],[V,U,V],[V,V,U]])a.push([cx+side*rx*u,yt+ry*v,zb-rz*w]);}
 return Float32Array.from(a.flat());
}
export function decodeSeatCushionOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3SCUS01')throw Error('Bad cushion overlay');
 const field=v.getUint32(8,true),sourceVertexCount=v.getUint32(12,true),instances=v.getUint32(16,true),total=v.getUint32(20,true),rs=v.getUint32(24,true),params=Array.from({length:9},(_,i)=>v.getFloat64(28+i*8,true));let at=100,out=0;
 function vu(){let x=0,s=0,c;do{if(at>=b.length)throw Error('Truncated integer');c=b[at++];x+=(c&127)*2**s;s+=7;if(s>35)throw Error('Bad integer');}while(c&128);return x;}
 function delta(){const z=vu();return z%2?-(Math.floor(z/2)+1):z/2;}
 const canonical=generateSeatCushion(params),cb=new Uint32Array(canonical.buffer),end=at+rs;for(let j=0;j<144;j++)cb[j]+=delta();if(at!==end)throw Error('Bad shared correction size');
 const vertexIndices=new Uint32Array(total),positions=new Float32Array(total*3);
 for(let ins=0;ins<instances;ins++){
  const flags=v.getUint32(at,true),n=v.getUint32(at+4,true),rs=v.getUint32(at+8,true),ads=v.getUint32(at+12,true);at+=16;const tx=v.getFloat64(at,true),tz=v.getFloat64(at+8,true);at+=16;if(flags>3)throw Error('Bad reflection');const sx=flags&1?-1:1,sz=flags&2?-1:1;
  const world=new Float32Array(144),wb=new Uint32Array(world.buffer);for(let j=0;j<48;j++)world.set([sx*canonical[j*3]+tx,canonical[j*3+1],sz*canonical[j*3+2]+tz],j*3);
  const re=at+rs;for(let j=0;j<48;j++){wb[j*3]+=delta();wb[j*3+2]+=delta();}if(at!==re)throw Error('Bad instance correction size');const ae=at+ads;let previous=0;
  for(let i=0;i<n;i++){previous+=vu();if(previous>=sourceVertexCount)throw Error('Bad source index');vertexIndices[out+i]=previous;}if(at!==ae)throw Error('Bad source index size');
  for(let i=0;i<n;i++){const j=b[at++];if(j>=48)throw Error('Bad sample');positions.set(world.subarray(j*3,j*3+3),(out+i)*3);}out+=n;
 }
 if(at!==b.length||out!==total||new Set(vertexIndices).size!==total)throw Error('Bad cushion totals');return {field,sourceVertexCount,vertexIndices,positions};
}
