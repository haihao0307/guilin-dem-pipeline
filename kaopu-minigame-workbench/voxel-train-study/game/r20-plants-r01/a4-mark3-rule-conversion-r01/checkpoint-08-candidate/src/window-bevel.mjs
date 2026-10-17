const SIN=[0,.3090169943749474,.5877852522924731,.8090169943749475,.9510565162951535,1],COS=[...SIN].reverse(),H=.7071067811865476;
export function generateWindowBand(p,stations){
 const [cy,cz,hw,hh,r,ix,slope,thick,axial,radial,radialZ]=p;
 const depths=[-thick,-thick+axial*(1-H),-thick+axial,-axial,-axial*(1-H),0],factors=[2,2-H,1,1,H,0];
 const out=new Float32Array(180*3);
 for(let layer=0;layer<6;layer++){
  const dy=radial*factors[layer],dz=radialZ*factors[layer],ry=r+.5*dy,rz=r+.5*dz,w=hw+dz,h=hh+dy;
  for(let point=0;point<30;point++){
   let y,z;
   if(point<24){const corner=Math.floor(point/6),k=point%6,sy=corner<2?-1:1,sz=corner%2===0?-1:1;y=cy+sy*((h-ry)+ry*COS[k]);z=cz+sz*((w-rz)+rz*SIN[k]);}
   else{const side=Math.floor((point-24)/3),k=(point-24)%3;y=stations[k];z=cz+(side===0?-1:1)*w;}
   const at=(layer*30+point)*3;out[at]=(ix+slope*y)+depths[layer];out[at+1]=y;out[at+2]=z;
  }
 }
 return out;
}
export function decodeWindowCandidate(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3WBEV01')throw Error('Bad window candidate');
 const field=v.getUint32(8,true),windows=v.getUint32(12,true),sourceVertexCount=v.getUint32(16,true),total=v.getUint32(20,true),stations=Array.from({length:3},(_,i)=>v.getFloat64(24+i*8,true));
 let at=48,out=0;const ids=new Uint32Array(total),positions=new Float32Array(total*3);
 function vu(){let value=0,shift=0,byte;do{byte=b[at++];value+=(byte&127)*2**shift;shift+=7;if(shift>35)throw Error('Bad integer');}while(byte&128);return value;}
 for(let window=0;window<windows;window++){
  const n=v.getUint32(at,true),nu=v.getUint32(at+4,true),indexBytes=v.getUint32(at+8,true),residualBytes=v.getUint32(at+12,true);at+=16;
  const p=Array.from({length:11},(_,i)=>v.getFloat64(at+i*8,true));at+=88;
  const labels=b.subarray(at,at+nu);at+=nu;const grid=generateWindowBand(p,stations),unique=new Float32Array(nu*3),bits=new Uint32Array(unique.buffer);
  for(let i=0;i<nu;i++){if(labels[i]>=180)throw Error('Bad sample');unique.set(grid.subarray(labels[i]*3,labels[i]*3+3),i*3);}
  const residualEnd=at+residualBytes;
  for(let i=0;i<nu*3;i++){const z=vu(),delta=z%2?-(Math.floor(z/2)+1):z/2;bits[i]+=delta;}
  if(at!==residualEnd)throw Error('Residual size mismatch');const indexEnd=at+indexBytes;let previous=0;
  for(let i=0;i<n;i++){previous+=vu();if(previous>=sourceVertexCount)throw Error('Bad source address');ids[out+i]=previous;}
  if(at!==indexEnd)throw Error('Address size mismatch');
  for(let i=0;i<n;i++){const j=b[at++];if(j>=nu)throw Error('Bad source mapping');positions.set(unique.subarray(j*3,j*3+3),(out+i)*3);}
  out+=n;
 }
 if(at!==b.length||out!==total||new Set(ids).size!==total)throw Error('Invalid candidate totals');return {field,sourceVertexCount,vertexIndices:ids,positions};
}
