// CPU-only recipe expansion benchmark. No browser or GPU performance claim.
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import * as THREE from '../viewer/vendor/three.module.js';
import {buildGeometry} from '../geometry/reconstruct.mjs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const result={scope:'Node CPU recipe expansion only; excludes file/network startup, shaders, rendering and GPU',platform:process.version,iterations:100,warmup:20,buildings:[]};
for(const b of read('geometry/buildings.json').buildings){
 const score=read(`geometry/${b.id}.score.json`),times=[];let bytes=0,triangles=0;
 for(let i=0;i<120;i++){
  const t=performance.now(),g=buildGeometry(score,THREE),ms=performance.now()-t;
  if(i>=20)times.push(ms);
  bytes=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength||0);triangles=g.attributes.position.count/3;g.dispose();
 }
 times.sort((a,b)=>a-b);result.buildings.push({id:b.id,medianMs:times[50],p95Ms:times[94],generatedBufferBytes:bytes,triangles});
}
fs.mkdirSync(new URL('evidence/',root),{recursive:true});fs.writeFileSync(new URL('evidence/RECONSTRUCTION_CPU_BENCH.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
