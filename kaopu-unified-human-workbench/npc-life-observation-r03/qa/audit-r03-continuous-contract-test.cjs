'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {assertContinuousRun}=require('./audit-r03-continuous-contract.cjs');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function fixture(kind='bottle',operation='open'){
  const phases=kind==='bottle'?['waiting','approach','close','lift','transfer','lower','verify','done:rest','done:restored']:
    ['waiting','approach','close-grip','swing','verify','done:withdraw','done:rest','done:restored'];
  const time=2,token='A:window:1',epoch=3;
  const frames=phases.map((p,i)=>{
    const [phase,rest]=p.split(':'),a={id:'A',phase,recovery:rest&&rest!=='restored'?rest:null,taskStarted:time,...(kind==='window'?{taskToken:token}:{})};
    const held=kind==='bottle'?['lift','transfer','lower'].includes(phase):phase==='swing';
    return {serial:11+i,request:22+i,submittedAtMS:100+i*20,completedAtMS:110+i*20,durationMS:10,
      metadata:{sceneEpoch:epoch,phaseKey:epoch+':'+p,simulationTime:time+i/120,mode:'observation',paused:false,
        agents:kind==='bottle'?[a]:[],windowAgents:kind==='window'?[a]:[],
        bottle:{heldBy:kind==='bottle'&&held?'A':null,position:[0,1.09,.44]},
        window:{heldBy:kind==='window'&&held?'A':null,angleDeg:operation==='open'?-35:0}}};
  });
  const result={result:'completed',phases:phases.filter(p=>!p.startsWith('done')),operation,taskToken:token};
  const a={id:'A',phase:'done',recovery:null,result};
  const snapshot={time:+frames.at(-1).metadata.simulationTime.toFixed(3),agents:kind==='bottle'?[a]:[],
    object:{heldBy:null,reservedBy:null,constraintCount:0,supported:true,settled:true,insideTarget:true,position:[0,1.09,.44]},
    window:{agents:kind==='window'?[a]:[],object:{heldBy:null,reservedBy:null,gripConstraintCount:0,hingeConstraintCount:1,
      goalOpen:operation==='open',goalClosed:operation==='close',settled:true,angleDeg:operation==='open'?-35:0}}};
  return {label:'isolated-fixture-'+kind,kind,operation,actorId:'A',before:{renderStatus:{completed:10}},
    after:{renderStatus:{completed:10+frames.length,maxManagedInFlight:1,inFlight:0,failure:null},observation:{completedFrameTrace:frames,lastCompleted:frames.at(-1)},snapshot},
    ui:{buttonId:kind==='bottle'?'npc-pick':'npc-window-'+operation,actionStartedAtMS:90,actionFinishedAtMS:1000,usedPause:false,usedExternalTick:false}};
}
const tests=[];
function test(name,fn){try{fn();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.stack});}}
function reject(name,kind,mutate,pattern){test(name,()=>{const f=fixture(kind);mutate(f);assert.throws(()=>assertContinuousRun(f),pattern);});}
for(const [kind,operation] of [['bottle','open'],['window','open'],['window','close']])test('accept complete independent '+kind+' '+operation,()=>assert.equal(assertContinuousRun(fixture(kind,operation)).accepted,true));
reject('reject empty completed trace','bottle',f=>f.after.observation.completedFrameTrace=[],/trace is required/);
reject('reject omission of a completed frame','bottle',f=>f.after.observation.completedFrameTrace.splice(3,1),/omit any intervening/);
reject('reject duplicate/out-of-order serial','bottle',f=>f.after.observation.completedFrameTrace[3].serial--,/serials are contiguous/);
reject('reject overlapping GPU submissions','bottle',f=>{const r=f.after.observation.completedFrameTrace[2];r.submittedAtMS-=15;r.durationMS+=15;},/cannot overlap/);
reject('reject invented GPU duration','bottle',f=>f.after.observation.completedFrameTrace[2].durationMS=3,/Duration equals/);
reject('reject intermediate pause declaration','bottle',f=>f.ui.usedPause=true,/pause is forbidden/);
reject('reject external tick declaration','bottle',f=>f.ui.usedExternalTick=true,/External ticks/);
reject('reject paused actual task frame','bottle',f=>f.after.observation.completedFrameTrace[3].metadata.paused=true,/paused frame/);
reject('reject accelerated numerical task frame','bottle',f=>f.after.observation.completedFrameTrace[3].metadata.mode='accelerated-numerical-verification',/numerical verification/);
reject('reject bypassed phase display','bottle',f=>f.after.observation.completedFrameTrace[3].metadata.agents[0].phase='transfer',/Every actual success phase/);
reject('reject physics advancing too far before displayed image','bottle',f=>f.after.observation.completedFrameTrace[3].metadata.simulationTime+=.2,/at most 0.12/);
reject('reject changed physics step','bottle',f=>f.after.observation.completedFrameTrace[3].metadata.simulationTime+=.001,/fixed 1\/120/);
reject('reject hidden station reset','window',f=>f.after.observation.completedFrameTrace[3].metadata.sceneEpoch++,/station reset/);
reject('reject substituted window task','window',f=>f.after.observation.completedFrameTrace[3].metadata.windowAgents[0].taskToken='A:window:2',/same window task token/);
reject('reject early unrendered waiting','bottle',f=>f.after.observation.completedFrameTrace[0].metadata.simulationTime+=1/120,/before physics/);
reject('reject stale final bottle image','bottle',f=>f.after.snapshot.object.position[2]+=.1,/framebuffer\/world pose/);
reject('reject stale final window image','window',f=>f.after.snapshot.window.object.angleDeg+=.1,/framebuffer\/world pose/);
reject('reject completion without recovered native rest','window',f=>f.after.snapshot.window.agents[0].recovery={phase:'rest'},/Expected values/);
reject('reject unsuccessful authoritative result','window',f=>f.after.snapshot.window.agents[0].result.result='blocked',/real successful result/);
reject('reject open action replaced by close','window',f=>f.after.snapshot.window.agents[0].result.operation='close',/Expected values/);
reject('reject stale observation summary','bottle',f=>f.after.observation.lastCompleted={serial:3},/summary and trace/);
reject('reject unacknowledged pending final frame','bottle',f=>f.after.renderStatus.inFlight=1,/completed-frame barrier/);
assert(tests.length>=20,'Contract test set must not silently run zero cases');
const report={schema:'kaopu/r03-continuous-contract-tests@1',scope:'Isolated artificial trace fixtures; no browser, real GPU, or visual-performance claim',
  verifierSHA256:sha(fs.readFileSync(path.join(__dirname,'audit-r03-continuous-contract.cjs'))),testSourceSHA256:sha(fs.readFileSync(__filename)),
  tests,passed:tests.every(t=>t.passed),total:tests.length};
fs.writeFileSync(path.join(__dirname,'audit-r03-continuous-contract-test.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
