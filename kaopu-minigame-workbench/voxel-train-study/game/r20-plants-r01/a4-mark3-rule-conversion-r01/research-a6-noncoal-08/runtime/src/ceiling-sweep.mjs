// A retained free section and explicit global longitudinal sampling law.
export function generateCeilingSweep(profile,weights,p){
 const [start,step,skewStart,skewStep,end0,end1,shear]=p,out=new Float32Array(576);
 for(let k=0;k<12;k++){
  const w=weights[k]/2,reference=(start+step*6)+(w*(skewStart+skewStep*6));
  for(let j=0;j<16;j++){
   let z;if(j===0)z=end0;else if(j===15)z=end1;else{const t=j-1;z=(start+step*t)+(w*(skewStart+skewStep*t));}
   out.set([profile[k*2],profile[k*2+1]+shear*(z-reference),z],(k*16+j)*3);
  }
 }
 return out;
}
export function decodeCeilingSweepOverlay(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(new TextDecoder().decode(b.subarray(0,8))!=='M3CEIL01')throw Error('Bad ceiling asset');
 const [field,n,np,ns,rs]=Array.from({length:5},(_,i)=>v.getUint32(8+i*4,true));if(np!==12||ns!==16)throw Error('Bad sampling dimensions');
 const profile=Array.from({length:24},(_,i)=>v.getFloat32(28+i*4,true)),p=Array.from({length:7},(_,i)=>v.getFloat64(124+i*8,true)),weights=b.subarray(180,192);let at=192;
 const canonical=generateCeilingSweep(profile,weights,p),bits=new Uint32Array(canonical.buffer);
 function vu(){let x=0,s=0,c;do{if(at>=b.length)throw Error('Truncated integer');c=b[at++];x+=(c&127)*2**s;s+=7;if(s>35)throw Error('Bad integer');}while(c&128);return x;}
 const end=at+rs;for(let i=0;i<192;i++)for(const axis of [1,2]){const z=vu();bits[i*3+axis]+=z%2?-(Math.floor(z/2)+1):z/2;}
 if(at!==end)throw Error('Bad correction length');const vertexIndices=new Uint32Array(n),positions=new Float32Array(n*3);
 for(let i=0;i<n;i++){const sample=b[at++];if(sample>=192)throw Error('Bad sample');vertexIndices[i]=i;positions.set(canonical.subarray(sample*3,sample*3+3),i*3);}
 if(at!==b.length)throw Error('Bad source map length');return {field,sourceVertexCount:n,vertexIndices,positions};
}
