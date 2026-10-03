import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/r07/registry.json')));
const rows=[];
const types={f32:Float32Array,f64:Float64Array,u32:Uint32Array};
for(const item of registry.items){
  const packed=fs.readFileSync(path.join(root,'data',item.file));
  if(sha(packed)!==item.sha256)throw Error('Immutable baseline mismatch '+item.id);
  const raw=zlib.gunzipSync(packed);
  if(raw.subarray(0,4).toString()!=='FSP7'||raw.readUInt32LE(4)!==1)throw Error('Independent source header');
  const n=raw.readUInt32LE(8),count=raw.readUInt32LE(12),start=Math.ceil((16+n)/8)*8;
  if(start+count!==raw.length)throw Error('Independent source bounds');
  const header=JSON.parse(raw.subarray(16,16+n).toString());
  let previousEnd=0;
  for(const b of header.blocks){
    const T=types[b.type];
    if(!T||b.offset<previousEnd||b.offset%T.BYTES_PER_ELEMENT||b.offset+b.length*T.BYTES_PER_ELEMENT>count)throw Error('Independent source block');
    const bytes=Uint8Array.from(raw.subarray(start+b.offset,start+b.offset+b.length*T.BYTES_PER_ELEMENT));
    header.score.primitives[b.primitive][b.field]=new T(bytes.buffer);
    previousEnd=b.offset+b.length*T.BYTES_PER_ELEMENT;
  }
  const score=header.score,seams=new Map(),finStats=new Map();
  let vertices=0,triangles=0,reconstructionMax=0,seamPositionMax=0,seamFinIdMismatches=0,seamWeightMax=0,seamGradientMax=0,coincidentVertices=0;
  const poly=(c,x)=>c.reduceRight((a,v)=>a*x+v,0),C=score.parameterization.coefficients;
  for(const p of score.primitives){
    const reconstructed=new Float32Array(p.positions.length);
    for(let i=0;i<p.positions.length/3;i++){
      const x=p.paramAddress[i*2]-.5,theta=p.paramAddress[i*2+1];
      const y=poly(C[0],x)+Math.max(Math.abs(poly(C[2],x)),.001)*Math.sin(theta);
      const z=poly(C[1],x)+Math.max(Math.abs(poly(C[3],x)),.001)*Math.cos(theta);
      reconstructed.set([x+p.residual[i*3],y+p.residual[i*3+1],z+p.residual[i*3+2]],i*3);
      for(let k=0;k<3;k++)reconstructionMax=Math.max(reconstructionMax,Math.abs(reconstructed[i*3+k]-p.positions[i*3+k]));
      const q=Array.from(reconstructed.subarray(i*3,i*3+3)),key=q.map(v=>Math.round(v*1e7)).join(','),value={q,id:p.finId[i],weight:p.finWeight[i],gradient:Array.from(p.finGradient.subarray(i*3,i*3+3))};
      const old=seams.get(key);
      if(old){coincidentVertices++;seamPositionMax=Math.max(seamPositionMax,Math.hypot(...q.map((v,k)=>v-old.q[k])));seamFinIdMismatches+=value.id!==old.id?1:0;seamWeightMax=Math.max(seamWeightMax,Math.abs(value.weight-old.weight));seamGradientMax=Math.max(seamGradientMax,Math.hypot(...value.gradient.map((v,k)=>v-old.gradient[k])));}else seams.set(key,value);
      const s=finStats.get(value.id)||{id:value.id,count:0,active:0,minWeight:Infinity,maxWeight:-Infinity,maxGradient:0};
      s.count++;s.active+=value.weight>0?1:0;s.minWeight=Math.min(s.minWeight,value.weight);s.maxWeight=Math.max(s.maxWeight,value.weight);s.maxGradient=Math.max(s.maxGradient,Math.hypot(...value.gradient));finStats.set(value.id,s);
    }
    vertices+=p.positions.length/3;triangles+=p.indices.length/3;
  }
  rows.push({id:item.id,sourceSha256:item.sha256,encodedBytes:packed.length,vertices,triangles,reconstructionMax,coincidentVertices,seamPositionMax,seamFinIdMismatches,seamWeightMax,seamGradientMax,finStats:[...finStats.values()],materials:score.materials.map(m=>({name:m.name,doubleSided:m.doubleSided,alphaMode:m.alphaMode||'OPAQUE',alphaCutoff:m.alphaCutoff})),textureDimensions:score.textures.map(t=>({width:t.width,height:t.height,mimeType:t.mimeType})),passed:reconstructionMax<3e-7});
}
const report={schema:'FISH_R10_INDEPENDENT_BASELINE_FIELDS_1',createdAt:new Date().toISOString(),method:'Independent FSP7 block parser; original chart/residual rest reconstruction; coincident vertices grouped at 1e-7 BL for baseline seam expectations.',rows,passed:rows.length===5&&rows.every(r=>r.passed),visualAcceptance:false,productionReady:false};
fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_R10_BASELINE_FIELDS.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,rows:rows.map(r=>({id:r.id,vertices:r.vertices,reconstructionMax:r.reconstructionMax,coincidentVertices:r.coincidentVertices,seamFinIdMismatches:r.seamFinIdMismatches,seamWeightMax:r.seamWeightMax,seamGradientMax:r.seamGradientMax}))}));
if(!report.passed)process.exitCode=1;
