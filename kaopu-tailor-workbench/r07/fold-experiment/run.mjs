import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const P=path.dirname(fileURLToPath(import.meta.url)),mode=process.argv[2]||'control',inputPath=process.argv[3];
assert(inputPath,'Original browser paper fixture required');
const source=JSON.parse(fs.readFileSync(inputPath));assert(source.source.commit==='d449629979028123a5c4dc9e732a2ec19b7fce31');
const output=path.join(P,'evidence');fs.mkdirSync(output,{recursive:true});
const spacing=mode==='control'?null:Number(mode.replace('fold',''));if(spacing!==null)assert(Number.isFinite(spacing)&&spacing>0);globalThis.FOLD_INTERVAL_MM=spacing;
for(const r of [1.1,1.3,1.45,2]){
 const a=(r+1)/4,b=(r-1)/2,long=[0,a/r,(a+b)/r,1],short=[0,1-a,a,1],world=[0,a,1-a,1];
 for(let i=1;i<4;i++)assert(Math.abs(Math.abs(world[i]-world[i-1])-r*(long[i]-long[i-1]))<1e-12);
 assert(Math.abs(short[3]-short[0]-1)<1e-12);
}
function area(p){return p.triangles.reduce((sum,t)=>{const[a,b,c]=t.map(i=>p.uvMm[i]);return sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2},0);}
let finish,latest=null,mesh=null,started=performance.now(),runStarted=false;
const complete=new Promise(resolve=>finish=resolve);
globalThis.postMessage=data=>{
 if(data.type==='paper'){
  mesh=data.spec;assert(mesh.panels.every(p=>{const q=source.panels.find(q=>q.id===p.id);return JSON.stringify(p.uvMm.slice(0,q.verticesMm.length))===JSON.stringify(q.verticesMm)}));
  queueMicrotask(()=>{runStarted=true;self.onmessage({data:{type:'run',requestId:1}})});
 }
 if(data.type==='stage'){latest=data;console.log(mode,'stage',data.completedStage,'maxPrincipal',data.metrics.maxPrincipalStrain);}
 if(data.type==='done')finish({status:'complete',data});
 if(data.type==='error')finish({status:'error',error:data.message,latest});
};
await import(new URL(mode==='control'?'../../catalogue/fold-control-test.mjs':'../../catalogue/fold-prescribed-test.mjs',import.meta.url));
const root='http://127.0.0.1:8765/kaopu-tailor-workbench/';
await self.onmessage({data:{type:'boot',root,patternBase:root+'garment-pattern-catalogue-r01/browser/'}});
const timer=setTimeout(()=>finish({status:'timeout',latest}),120000);
await self.onmessage({data:{type:'replay-edits',requestId:1,restore:{base:source,operations:[],revision:0,config:{kind:'analytic',recipe:{bodyCm:source.bodyCm,design:{style:'MetaGarmentDress',...source.design}}}}}});
const result=await complete;clearTimeout(timer);
const summary={mode,requestedFoldSpacingMm:spacing,status:result.status,actualInheritedSolverStarted:runStarted,seconds:(performance.now()-started)/1000,
 constructionChange:mode==='control'?'none':'explicit two-turn zero-thickness micropleat constraints; not generic original gathering',
 published:false,physicalThicknessModel:false,materialAndBodyRescaled:false,dynamicWearCertified:false,
 foldedSeams:mesh?.seams.filter(s=>s.experimentalFoldConstruction).map(s=>({id:s.id,...s.experimentalFoldConstruction,addedFoldPairs:s.experimentalFoldPairs.length}))||[],
 panelRestAreaMm2:mesh?Object.fromEntries(mesh.panels.map(p=>[p.id,area(p)])):null,
 vertices:mesh?.panels.reduce((n,p)=>n+p.uvMm.length,0),triangles:mesh?.panels.reduce((n,p)=>n+p.triangles.length,0),error:result.error||null};
if(result.status==='complete'){
 const d=result.data;summary.staticGate=d.record.staticGate;summary.intersections={body:d.intersections.bodyIntersectingFaceCount,self:d.intersections.selfStrictTriangleIntersectionCount,sharedPointPairExclusions:d.intersections.sharedPointPairExclusions};summary.materialMetrics=d.record.metrics;summary.regions=d.regions;
 fs.writeFileSync(path.join(output,mode+'-record.json.gz'),zlib.gzipSync(JSON.stringify(d.record)));
}
fs.writeFileSync(path.join(output,mode+'-summary.json'),JSON.stringify(summary,null,2));
console.log('FOLD_RESULT',JSON.stringify(summary));
process.exit(mode==='control'&&result.status!=='complete'?1:0);
