/** MHR browser inference. Derived from Meta MHR/PyMomentum Apache-2.0.
 * Modified 2026-10-06: exact-zero sparse storage and single-batch JavaScript port.
 * Original float32 weights, all influences, all correctives are retained. */
const TYPES={'<f4':Float32Array,'<u4':Uint32Array,'<i4':Int32Array,'<u2':Uint16Array};
export function unpackModel(meta,buffer){const out={};for(const [n,a] of Object.entries(meta.arrays))out[n]=new TYPES[a.dtype](buffer,a.offset,a.bytes/TYPES[a.dtype].BYTES_PER_ELEMENT);return out;}
export async function decompress(response){if(!response.ok)throw Error(`Asset HTTP ${response.status}`);return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
export async function loadModel(base='./assets/',progress=()=>{}){progress('读取官方权重说明');const meta=await(await fetch(base+'model.json')).json();progress(`下载原版权重 ${(meta.compressed_bytes/1048576).toFixed(1)} MiB`);const packed=new Uint8Array(meta.compressed_bytes);let offset=0;for(let i=0;i<meta.parts.length;i++){const part=meta.parts[i],response=await fetch(base+part.file);if(!response.ok)throw Error(`权重分片 HTTP ${response.status}`);const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==part.bytes)throw Error('权重分片长度不符');packed.set(bytes,offset);offset+=bytes.length;progress(`原版权重 ${i+1}/${meta.parts.length} 已载入`);}const buf=await decompress(new Response(packed));progress('初始化完整骨架与姿态修正');return new MHREngine(meta,unpackModel(meta,buf));}
function mul(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
function norm(q){const d=Math.hypot(...q)||1;return q.map(v=>v/d);}
function rotate(q,v){const [x,y,z,w]=q,[a,b,c]=v,ax=y*c-z*b,ay=z*a-x*c,az=x*b-y*a;return [a+2*(w*ax+y*az-z*ay),b+2*(w*ay+z*ax-x*az),c+2*(w*az+x*ay-y*ax)];}
function combine(a,b){let qa=norm(a.slice(3,7)),qb=norm(b.slice(3,7));const t=rotate(qa,b.slice(0,3));return [a[0]+a[7]*t[0],a[1]+a[7]*t[1],a[2]+a[7]*t[2],...mul(qa,qb),a[7]*b[7]];}
function matrix(s){const [x,y,z,w]=norm(s.slice(3,7)),k=s[7];return [(1-2*y*y-2*z*z)*k,(2*x*y-2*z*w)*k,(2*x*z+2*y*w)*k,s[0],(2*x*y+2*z*w)*k,(1-2*x*x-2*z*z)*k,(2*y*z-2*x*w)*k,s[1],(2*x*z-2*y*w)*k,(2*y*z+2*x*w)*k,(1-2*x*x-2*y*y)*k,s[2]];}
function sparse(d,name,input,output){const p=d[name+'_ptr'],idx=d[name+'_idx'],w=d[name+'_val'];for(let r=0;r<p.length-1;r++){let s=0;for(let k=p[r];k<p[r+1];k++)s+=w[k]*input[idx[k]];output[r]=s;}return output;}
export class MHREngine{
 constructor(meta,data){this.meta=meta;this.d=data;this.lods=new Map();this.state={identity:new Float32Array(45),pose:new Float32Array(204),expression:new Float32Array(72),correctives:true};}
 evaluate(state=this.state){const t=performance.now(),d=this.d,n=this.meta.vertices*3;const rest=new Float32Array(d.base),jp=sparse(d,'transform',state.pose,new Float32Array(889));
  for(let k=0;k<45;k++){const w=state.identity[k];if(w!==0)for(let i=0;i<n;i++)rest[i]+=w*d.identity[k*n+i];}
  for(let k=0;k<72;k++){const w=state.expression[k];if(w!==0)for(let j=d.expression_ptr[k];j<d.expression_ptr[k+1];j++)rest[d.expression_idx[j]]+=w*d.expression_val[j];}
  const joints=new Float32Array(127*8),global=[];
  for(let j=0;j<127;j++){let i=j*7;const x=jp[i+3]/2,y=jp[i+4]/2,z=jp[i+5]/2,sx=Math.sin(x),sy=Math.sin(y),sz=Math.sin(z),cx=Math.cos(x),cy=Math.cos(y),cz=Math.cos(z);const eq=[sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];const q=mul(Array.from(d.prerotation.subarray(j*4,j*4+4)),eq);let local=[d.offset[j*3]+jp[i],d.offset[j*3+1]+jp[i+1],d.offset[j*3+2]+jp[i+2],...q,Math.exp(jp[i+6]*0.6931471824645996)];let p=d.parents[j];global[j]=p<0||p>=127?local:combine(global[p],local);joints.set(global[j],j*8);}
  if(state.correctives){const f=new Float32Array(750);for(let j=2;j<127;j++){const i=j*7,x=jp[i+3],y=jp[i+4],z=jp[i+5],cx=Math.cos(x),cy=Math.cos(y),cz=Math.cos(z),sx=Math.sin(x),sy=Math.sin(y),sz=Math.sin(z),o=(j-2)*6;f[o]=cy*cz-1;f[o+1]=cy*sz;f[o+2]=-sy;f[o+3]=-cx*sz+sx*sy*cz;f[o+4]=cx*cz+sx*sy*sz-1;f[o+5]=sx*cy;}
   const hidden=sparse(d,'mlp0',f,new Float32Array(3000));for(let i=0;i<hidden.length;i++)hidden[i]=Math.max(0,hidden[i]);const delta=sparse(d,'mlp2',hidden,new Float32Array(n));for(let i=0;i<n;i++)rest[i]+=delta[i];}
  const mats=global.map((s,j)=>matrix(combine(s,Array.from(d.inverse_bind.subarray(j*8,j*8+8)))));const verts=new Float32Array(n);
  for(let k=0;k<d.skin_weights.length;k++){const v=d.skin_verts[k]*3,m=mats[d.skin_joints[k]],w=d.skin_weights[k],x=rest[v],y=rest[v+1],z=rest[v+2];verts[v]+=w*(m[0]*x+m[1]*y+m[2]*z+m[3]);verts[v+1]+=w*(m[4]*x+m[5]*y+m[6]*z+m[7]);verts[v+2]+=w*(m[8]*x+m[9]*y+m[10]*z+m[11]);}
  return {vertices:verts,joints,inferenceMs:performance.now()-t,faces:d.faces};
 }
 async loadLOD(lod,base='./assets/'){if(lod===1||this.lods.has(lod))return;const info=await(await fetch(base+`lod${lod}.json`)).json();const buffer=await decompress(await fetch(base+`lod${lod}.bin.gz`));this.lods.set(lod,{info,indices:new Uint32Array(buffer,0,info.vertices*3),bary:new Float32Array(buffer,info.vertices*12,info.vertices*3),faces:new Uint32Array(buffer,info.vertices*24,info.faces*3)});}
 mapLOD(result,lod){if(lod===1)return result;const d=this.lods.get(lod);if(!d)throw Error('LOD not loaded');const out=new Float32Array(d.info.vertices*3);for(let i=0;i<d.info.vertices;i++)for(let c=0;c<3;c++)for(let k=0;k<3;k++)out[i*3+c]+=result.vertices[d.indices[i*3+k]*3+c]*d.bary[i*3+k];return {...result,vertices:out,faces:d.faces};}
}
