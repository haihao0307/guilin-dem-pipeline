import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {gzipSync,gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url)),id=process.argv[2],reinforce=!process.argv.includes('--control'),out=process.argv[3]&&!process.argv[3].startsWith('--')?process.argv[3]:path.join(root,'data/results',id+'.json.gz');
if(!/^[A-Z]\d\d$/.test(id))throw Error('Invalid pattern ID');
const prior=JSON.parse(await fs.readFile(path.join(root,'../r01/data/catalogue.json'),'utf8'));
const bytes=await fs.readFile(path.join(root,'../r01/data/patterns',id+'.json'));
if(createHash('sha256').update(bytes).digest('hex')!==prior.outputSHA256['patterns/'+id+'.json'])throw Error('Frozen source content mismatch');
const ticket=JSON.parse(bytes);
globalThis.self=globalThis;
globalThis.fetch=async u=>{const s=String(u);if(!s.startsWith('file:'))throw Error('Unexpected network request '+s);try{return new Response(await fs.readFile(fileURLToPath(s)))}catch(e){return new Response(String(e),{status:404})}};
const started=performance.now();let mod,done=false,resolve;const completion=new Promise(r=>resolve=r),stages=[];
let deadline;
async function save(result){if(done)return;done=true;clearTimeout(deadline);const state=mod.__batchState();result.id=id;result.name=ticket.name;result.category=prior.rows.find(r=>r.id===id).category;result.binding=state.nativeBinding;result.spec=state.spec;result.seconds=(performance.now()-started)/1000;result.stages=stages;
 result.warmStart=state.lab?.warmStartProof;result.authoringProfile=process.argv.includes('--legacy')?'preserved-legacy-material-kernel':'source-preset-material-kernel';
 if(!result.record&&state.lab&&state.lab.positions.every(p=>p.every(Number.isFinite)))result.checkpoint={positionsM:state.lab.positions.flatMap(p=>Array.from(p)),metrics:state.lab.metrics(),stage:state.stages[state.stageIndex],complete:false,accepted:false};
 await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,gzipSync(JSON.stringify(result),{level:9}));console.log('OUTCOME',JSON.stringify({id,complete:!!result.record,reinforced:reinforce,passed:result.record?.staticGate?.passed,error:result.error,seconds:result.seconds}));resolve();}
globalThis.postMessage=d=>{
 if(d.type==='started'&&process.argv.includes('--debug-initial')){const s=mod.__batchState();void fs.writeFile(out+'.initial.json.gz',gzipSync(JSON.stringify({spec:s.spec,checkpoint:{positionsM:s.lab.positions.flatMap(p=>Array.from(p)),metrics:s.lab.metrics()}})))}
 if(d.type==='stage'){stages.push({stage:d.completedStage,metrics:d.metrics});console.log('STAGE',id,d.completedStage,d.metrics.maxPrincipalStrain)}
 if(d.type==='paused'&&d.budgetCheckpoint)setTimeout(()=>self.onmessage({data:{type:'resume',requestId:1}}),0);
 if(d.type==='done')void save({record:d.record,regions:d.regions,intersections:d.intersections,profile:d.profile});
 if(d.type==='error')void save({error:d.message});
};
process.on('SIGTERM',()=>save({error:'Bounded authoring run ended; finite intermediate state retained'}).then(()=>process.exit(0)));
const budgetSeconds=Number(process.argv.find(x=>x.startsWith('--budget-seconds='))?.split('=')[1]||540);
const remainingMs=process.env.KAOPU_TASK_DEADLINE_UTC?Date.parse(process.env.KAOPU_TASK_DEADLINE_UTC)-Date.now():3*3600000;
if(!Number.isFinite(budgetSeconds)||budgetSeconds<=0||!Number.isFinite(remainingMs))throw Error('Invalid authoring budget');
deadline=setTimeout(()=>save({error:'This style reached its bounded authoring budget; finite sewing state retained'}).then(()=>process.exit(0)),Math.min(budgetSeconds*1000,remainingMs));
try{
 mod=await import('./backend/native/kaopu-tailor-workbench/catalogue/batch-adapter.mjs');
 let warmStart=null;
 if(reinforce&&!process.argv.includes('--cold')){
  const archived=await fs.readFile(path.join(root,process.argv.includes('--warm-r02')?'data/results':'../../presets/r04/assets/results',id+'.json.gz'));warmStart=JSON.parse(gunzipSync(archived));
  if(warmStart.binding?.presetId!==id)throw Error('Warm garment identity differs');
  warmStart.archiveSHA256=createHash('sha256').update(archived).digest('hex');
  const lock=JSON.parse(await fs.readFile(path.join(root,'data/SOURCE_RESULT_LOCK.json'),'utf8'));
  const wanted=process.argv.includes('--warm-r02')?JSON.parse(await fs.readFile(path.join(root,'data/BATCH_REPORT.json'),'utf8')).rows.find(r=>r.id===id).sha256:lock.results[id].sha256;
  if(wanted!==warmStart.archiveSHA256||JSON.stringify(lock.person)!==JSON.stringify(warmStart.binding.person))throw Error('Verified source sewing archive or person differs');
 }
 const loaded=await mod.__loadBatch(ticket,{reinforce,warmStart,finish:process.argv.includes('--finish'),mirrorLegStart:process.argv.includes('--mirror-leg-start=right')?'right':process.argv.includes('--mirror-leg-start'),continuation:process.argv.includes('--continuation'),variant43:process.argv.includes('--legacy')?false:process.argv.includes('--bending')?true:undefined});if(process.argv.includes('--grip-control')){delete loaded.spec.elasticStays;loaded.spec.source.finishRevision.gripControlDisabled=true;const {materialHash}=await import('./backend/source-contract.mjs');loaded.binding.materialHash=await materialHash(loaded.spec)}console.log('MESH',id,loaded.spec.panels.reduce((s,p)=>s+p.uvMm.length,0),loaded.spec.seams.length);
 await self.onmessage({data:{type:'run',requestId:1,person:loaded.binding.person}});await completion;
}catch(e){if(mod)await save({error:e.stack});else throw e}
