import {angleWeightedNormals} from './sphere-normal-kernel.mjs';
export function parseRule(bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
 if(new TextDecoder().decode(data.subarray(0,8))!=='A4ATTR01')throw new Error('Invalid A4 attribute program');
 const n=dv.getUint32(8,true),meta=JSON.parse(new TextDecoder().decode(data.subarray(12,12+n))),body=data.subarray(12+n),s={};
 for(const[k,v]of Object.entries(meta.sections)){if(v.offset+v.bytes>body.length)throw new Error('Invalid section');s[k]=body.subarray(v.offset,v.offset+v.bytes);}
 return {meta,sections:s};
}
const u16array=bytes=>{const a=new Uint16Array(bytes.length/2);for(let i=0;i<a.length;i++)a[i]=bytes[i*2]+bytes[i*2+1]*256;return a;};
export function generateBaseline(meta,s){
 const normal=meta.kind==='sphere_angle_weighted_normals',stride=normal?3:2,out=new Float32Array(meta.vertices*stride),covered=new Uint8Array(meta.vertices);
 const templates=meta.templates.map((t,i)=>normal?{...t,labels:s[`t${i}.labels`],triangles:u16array(s[`t${i}.triangles`]),shading:u16array(s[`t${i}.shading`])}:{...t,cells:s[`t${i}.uvCells`]});
 const data=s.instances,dv=new DataView(data.buffer,data.byteOffset,data.byteLength);let off=0;
 const u32=()=>{const v=dv.getUint32(off,true);off+=4;return v;};
 for(let g=0;g<meta.instances;g++){
  const ti=u32(),start=u32(),mode=u32(),t=templates[ti];if(!t||mode>1)throw new Error('Invalid template instance');let prediction;
  if(normal){const frame=[];for(let j=0;j<9;j++){frame.push(dv.getFloat64(off,true));off+=8;}prediction=angleWeightedNormals(frame,t.labels,t.lon,t.lat,t.triangles,t.shading);}
  for(let j=0;j<t.count;j++){
   const ix=mode?u32():start+j;if(ix>=meta.vertices||covered[ix])throw new Error('Invalid vertex address');covered[ix]=1;
   if(normal)out.set(prediction.subarray(j*3,j*3+3),ix*3);
   else{out[ix*2]=t.cells[j*2]/(t.lon*2);out[ix*2+1]=t.cells[j*2+1]/t.lat;}
  }
 }
 if(off!==data.length)throw new Error('Unexpected instance data');
 const bits=new Uint32Array(out.buffer),raw=s.rawAttributes,rd=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);let at=0;
 for(let i=0;i<meta.vertices;i++)if(!covered[i])for(let a=0;a<stride;a++){bits[i*stride+a]=rd.getUint32(at,true);at+=4;}
 if(at!==raw.length)throw new Error('Wrong raw residual length');return{out,covered,stride};
}
export function decodeRaw(bytes){
 const{meta,sections:s}=parseRule(bytes),{out,covered,stride}=generateBaseline(meta,s),bits=new Uint32Array(out.buffer),data=s.bitCorrections;let off=0;
 for(let i=0;i<meta.vertices;i++)if(covered[i])for(let a=0;a<stride;a++){
  let val=0,mul=1,b;do{if(off>=data.length||mul>2**35)throw new Error('Invalid bit correction');b=data[off++];val+=(b&127)*mul;mul*=128;}while(b&128);
  const delta=val%2===0?val/2:-(val+1)/2;bits[i*stride+a]+=delta;
 }
 if(off!==data.length)throw new Error('Trailing bit corrections');return out;
}
