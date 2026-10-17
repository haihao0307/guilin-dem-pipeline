import {parseRule} from './body-attributes.mjs';
export function decodeRaw(bytes){
 const{meta,sections:s}=parseRule(bytes);if(meta.kind!=='source_sphere_topology')throw new Error('Wrong topology rule');
 const u16=b=>{const out=new Uint16Array(b.length/2);for(let i=0;i<out.length;i++)out[i]=b[i*2]+b[i*2+1]*256;return out;};
 const templates=meta.templates.map((_,i)=>u16(s[`t${i}`])),instances=[],data=s.instances,dv=new DataView(data.buffer,data.byteOffset,data.byteLength);let off=0;
 const u32=()=>{const v=dv.getUint32(off,true);off+=4;return v;};
 for(let g=0;g<meta.instances;g++){const ti=u32(),start=u32(),mode=u32(),count=u32(),ix=new Uint32Array(count);for(let j=0;j<count;j++)ix[j]=mode?u32():start+j;instances.push({ti,ix});}
 if(off!==data.length)throw new Error('Wrong instance length');
 const original=new DataView(s.rawTriangles.buffer,s.rawTriangles.byteOffset,s.rawTriangles.byteLength),runs=new DataView(s.runs.buffer,s.runs.byteOffset,s.runs.byteLength),out=new Uint32Array(meta.outputBytes/4);let at=0;
 for(let r=0;r<s.runs.length;r+=12){
  const group=runs.getUint32(r,true),start=runs.getUint32(r+4,true),count=runs.getUint32(r+8,true);
  if(group===0xffffffff){for(let i=start*3;i<(start+count)*3;i++)out[at++]=original.getUint32(i*4,true);}
  else{const{ti,ix}=instances[group],template=templates[ti];for(let i=start*3;i<(start+count)*3;i++){const index=template[i];if(index>=ix.length)throw new Error('Invalid topology address');out[at++]=ix[index];}}
 }
 if(at!==out.length)throw new Error('Wrong topology output length');return out;
}
