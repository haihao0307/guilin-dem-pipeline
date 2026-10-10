/** Execute the exact browser worker under Node; only transport adapters are replaced. */
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{gunzipSync,gzipSync}from'node:zlib';import{createHash}from'node:crypto';
const P=path.dirname(fileURLToPath(import.meta.url)),id=process.argv[2],out=process.argv[3]||P+'/batch-r043/'+id+'.json.gz';
if(!/^[A-Z]\d\d$/.test(id))throw Error('invalid source preset');
const workerPath=P+'/native/kaopu-tailor-workbench/catalogue/native-adapter-r043-test.mjs';
try{await fs.access(workerPath)}catch{throw Error('Run prepare_node_r043.py before this test.');}
globalThis.self=globalThis;globalThis.fetch=async u=>{const s=String(u),p=s.startsWith('file:')?fileURLToPath(s):s.startsWith('http://local/')?P+'/'+s.slice(13):null;if(!p)throw Error('Unexpected network use: '+s);try{return new Response(await fs.readFile(p),{status:200})}catch(e){return new Response(String(e),{status:404})}};
const lock=JSON.parse(await fs.readFile(P+'/assets/identity.json','utf8'));let mod,spec,binding,checkpoint=null,done=false,resolve,reject;let stages=[];const started=performance.now(),completion=new Promise((r,j)=>{resolve=r;reject=j});
async function save(d){if(done)return;done=true;d.elapsedSeconds=(performance.now()-started)/1000;d.stages=stages;d.originalStaticGateUnchanged=true;await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,gzipSync(JSON.stringify(d),{level:9}));console.log('OUTCOME',JSON.stringify({id,complete:!!d.record,checkpoint:!!d.checkpoint,passed:d.record?.staticGate?.passed,failures:d.record?.staticGate?.failures,reason:d.error,seconds:d.elapsedSeconds}));resolve(d);}
globalThis.postMessage=d=>{
 if(d.type==='paper'){spec=d.spec;binding=d.binding;if(!d.canSew)save({id,binding,spec,error:d.fitPreflight?.message||'preflight blocked',phase:'material-preflight'});else setTimeout(()=>self.onmessage({data:{type:'run',requestId:1,person:lock.person}}),0);}
 if(d.type==='stage'){let waist=[];const state=mod.__probe43();for(const p of state.spec.panels.filter(p=>p.id.startsWith('wb_'))){const offset=state.lab.offsets.get(p.id);for(let i=0;i<p.uvMm.length;i++)waist.push(state.lab.positions[offset+i][1]*1000)}stages.push({stage:d.completedStage,maximumStrain:d.metrics?.maxPrincipalStrain,waistMinimumMm:waist.length?Math.min(...waist):null,waistMaximumMm:waist.length?Math.max(...waist):null});console.log(id,d.completedStage,d.metrics?.maxPrincipalStrain);}
 if(d.type==='paused'&&d.budgetCheckpoint){stages.push({checkpoint:true,stage:d.stage,seconds:d.activeWallMs/1000});setTimeout(()=>self.onmessage({data:{type:'resume',requestId:1}}),0);}
 if(d.type==='checkpoint'){checkpoint={binding:d.binding,spec:structuredClone(spec),positionsM:Array.from(d.positionsM),metrics:d.metrics,stage:d.stage,complete:false,accepted:false};}
 if(d.type==='done')save({id,binding:d.binding,spec:mod.__probe43().spec,record:d.record,regions:d.regions,intersections:d.intersections,profile:d.profile});
 if(d.type==='error')save({id,binding,spec,checkpoint,error:d.message,phase:spec?'solve-aborted':'material-rejected'});
};
process.on('SIGTERM',async()=>{if(done)return;const st=mod?.__probe43();const cp=st?.lab&&st.lab.positions.every(v=>Array.from(v).every(Number.isFinite))?{binding:st.nativeBinding,spec:st.spec,positionsM:st.lab.positions.flatMap(v=>Array.from(v)),metrics:st.lab.metrics(),stage:st.stages[st.stageIndex],complete:false,accepted:false}:checkpoint;await save({id,binding:st?.nativeBinding||binding,spec:st?.spec||spec,checkpoint:cp,error:'审计计算片段结束，已保留真实中间状态；不是完成成衣。',phase:'audit-checkpoint'});process.exit(0);});
mod=await import(workerPath);await self.onmessage({data:{type:'boot',root:'http://local/',patternBase:'http://local/unused-pattern-runtime/'}});
await self.onmessage({data:{type:'load-native-paper',requestId:1,presetId:id,person:lock.person,paperText:gunzipSync(await fs.readFile(P+'/assets/papers/'+id+'.json.gz')).toString()}});
await completion;
