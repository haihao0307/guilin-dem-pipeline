import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),delta=Number(process.argv[2]??60),slitDelta=Number(process.argv[3]??40);
const backend=path.join(ROOT,'upstream/kaopu-tailor-workbench/pattern-batch/r02/backend');
const read=p=>fs.readFile(path.join(backend,p)),encode=b=>Buffer.from(b).toString('base64');
const assets={bodyGzip:encode(gzipSync(await read('assets/common-body.json'))),sdfGzip:encode(await read('assets/common-body.sdfd.gz')),metaText:(await read('assets/body-sdf-grid.json')).toString(),wasm:encode(await read('correctives/r043c/joint-r043c.wasm'))};
const identity=JSON.parse(await read('assets/identity.json'));
const paperText=gunzipSync(await fs.readFile(path.join(ROOT,'upstream/kaopu-tailor-workbench/presets/r04/assets/papers/S03.json.gz'))).toString();
globalThis.self=globalThis;
let resolve,reject,spec,analytic,binding,measurements,finished=false;
const promise=new Promise((r,j)=>{resolve=r;reject=j}),start=performance.now();
globalThis.postMessage=d=>{
 if(d.type==='paper'){spec=d.spec;analytic=d.analytic;binding=d.binding;measurements=d.measurements;if(!d.canSew)return reject(Error('Preflight blocked'));console.log('PAPER',delta,spec.panels.reduce((n,p)=>n+p.uvMm.length,0));setTimeout(()=>self.onmessage({data:{type:'run',requestId:1,person:identity.person}}),0);}
 if(d.type==='stage')console.log('STAGE',delta,d.completedStage,Number(((performance.now()-start)/1000).toFixed(2)));
 if(d.type==='paused'&&d.budgetCheckpoint)self.onmessage({data:{type:'resume',requestId:1}});
 if(d.type==='error'&&!finished){finished=true;reject(Error(d.message));}
 if(d.type==='done'&&!finished){finished=true;resolve({schema:'kaopu-clo-learning-result/1',taskId:'CLO-LEARNING-PILOT-R02-20261022',deltaMm:delta,slitDeltaMm:slitDelta,binding:d.binding,spec:d.spec,analytic:d.analytic,measurements,record:d.record,regions:d.regions,intersections:d.intersections,profile:d.profile,measuredWallSeconds:(performance.now()-start)/1000,measurementEnvironment:'Node in build container; not browser/device performance',createdAt:new Date().toISOString(),solverThresholdsUnchanged:true});}
};
await import('./src/worker-entry.mjs');
await self.onmessage({data:{type:'init-study',assets}});
await self.onmessage({data:{type:'load-design-variant',requestId:1,expectedRevision:0,presetId:'S03',paperText,deltaMm:delta,slitDeltaMm:slitDelta,person:identity.person}});
const result=await promise;
await fs.mkdir(path.join(ROOT,'evidence'),{recursive:true});
const file=path.join(ROOT,'evidence/solve-'+delta+'-'+slitDelta+'.json.gz');
await fs.writeFile(file,gzipSync(JSON.stringify(result),{level:9}));
console.log('RESULT',JSON.stringify({deltaMm:delta,slitDeltaMm:slitDelta,seconds:result.measuredWallSeconds,passed:result.record.staticGate.passed,failures:result.record.staticGate.failures,metrics:{tension:result.record.metrics.maxPrincipalStrain,compression:result.record.staticGate.maximumCompressionPercent,minimumBodyVertexDistanceMm:result.record.staticGate.minimumBodyVertexDistanceMm,wholeSeamMm:result.record.staticGate.wholeSeamAudit?.maxSpanUpperBoundMm},file}));
