import fs from 'node:fs';import zlib from 'node:zlib';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {RigidPoseSampler} from '../../motion-review-r04/Core.mjs';
import {ArmContinuity,canonicalSource} from '../../motion-review-r04/ArmContinuity.mjs';
import {ThumbContact} from '../../motion-review-r04/ThumbContact.mjs';
import {buildCapturedClip} from '../../motion-review-r04/CapturedCycles.mjs';
import {buildBasicClip} from '../../motion-review-r04/BasicActions.mjs';
import {MotionContinuity} from '../Continuity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),fixture=process.env.NATIVE_FIXTURE||path.join(root,'qa/native-fixture.json.gz');
// The fixture is a LOCAL extraction of the actual original person, produced by
// R04 verification/inspect.cjs. Never package a substitute rig into this test.
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync(fixture))),binding={...f,N:f.positions.length/3,names:f.rig.names},sampler=new RigidPoseSampler(binding.rig),thumb=new ThumbContact(binding),clips={};
for(const [id,file] of [['walk-loop','16_15'],['run-loop','16_35']]){const arm=new ArmContinuity(binding),row={id,kind:'capture2',label:id,continuous:true},source=canonicalSource(JSON.parse(fs.readFileSync(path.join(root,'kaopu-unified-human-workbench/motion-review-r04/'+file+'-SOURCE.json'))));clips[id]=await buildCapturedClip(binding,row,source,sampler,{decorate:f=>thumb.repair(arm.apply(f),row,0)});}
clips.idle=await buildBasicClip({binding,sampler,generation:0,status:()=>{}},{id:'idle',kind:'basic',task:'idle',duration:4,continuous:true},0);
const result={version:'R05-common-gait-phase-sweep',fixtureSHA256:null,cases:[],pass:false};
const {createHash}=await import('node:crypto');result.fixtureSHA256=createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
for(const [from,to] of [['walk-loop','run-loop'],['run-loop','walk-loop'],['walk-loop','idle'],['run-loop','idle']])for(let i=0;i<24;i++){
 const c=new MotionContinuity(binding);c.configure(clips[from]);const t=clips[from].duration*(i+.37)/24,previous=c.sample(t),past=c.sample(Math.max(0,t-1/120)),contacts=c.contacts(clips[from],t);c.configure(clips[to],{previous,past,contacts});const quality=c.quality();result.cases.push({from,to,phaseFraction:(i+.37)/24,...quality,report:c.report()});
}
result.pass=result.cases.every(c=>c.maxStepDegrees<15&&c.minSole>-.008);result.maximumStepDegrees=Math.max(...result.cases.map(c=>c.maxStepDegrees));result.minimumSoleM=Math.min(...result.cases.map(c=>c.minSole));
const out=process.env.SWEEP_OUT||path.join(root,'qa/phase-sweep-r05.json');fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({cases:result.cases.length,pass:result.pass,maximumStepDegrees:result.maximumStepDegrees,minimumSoleM:result.minimumSoleM,worst:result.cases.slice().sort((a,b)=>b.maxStepDegrees-a.maxStepDegrees).slice(0,5).map(c=>({from:c.from,to:c.to,phase:c.phaseFraction,maxStepDegrees:c.maxStepDegrees}))},null,2));if(!result.pass)process.exitCode=1;
