import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const require=createRequire(import.meta.url),base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.dirname(base);
const B=require('../src/behavior.js'),K=require('../src/schooling-r08.js'),anchor=JSON.parse(fs.readFileSync(path.join(base,'TASK_ANCHOR_R08.json')));
const baselineText=execFileSync('git',['show',anchor.productionBaseline+':fish-five-r01/src/behavior.js'],{cwd:repo,encoding:'utf8'});
const oldModule=new Module(path.join(base,'src','__baseline_r08.cjs'));oldModule.filename=path.join(base,'src','__baseline_r08.cjs');oldModule.paths=Module._nodeModulePaths(path.join(base,'src'));oldModule._compile(baselineText,oldModule.filename);const Old=oldModule.exports;
const rows=[],failures=[];
function check(label,fn){try{const data=fn();rows.push({label,pass:true,...data});console.log('PASS '+label);}catch(e){rows.push({label,pass:false,error:e.message});failures.push({label,error:e.message});console.log('FAIL '+label+': '+e.message);}}
const diff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const percentile=(v,p)=>v.slice().sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*p))];
const modes=['cruise','burst','turn','cruise','hover','cruise','rest','cruise'];
function graph(s){const S=s.school,n=s.count,seen=new Set(),sizes=[],c=[0,0,0];let nearest=0,degree=0;
 for(const a of s.actors)for(let k=0;k<3;k++)c[k]+=a.position[k]/n;
 for(let i=0;i<n;i++){let d=Infinity;for(let j=0;j<n;j++)if(i!==j)d=Math.min(d,distance(s.actors[i].position,s.actors[j].position));nearest+=d/n;for(let k=0;k<S.k;k++)if(S.neighbor[i*S.k+k]>=0&&S.neighborDistance[i*S.k+k]<S.params.perception**2)degree++;}
 for(let i=0;i<n;i++)if(!seen.has(i)){const q=[i];seen.add(i);for(let at=0;at<q.length;at++)for(let j=0;j<n;j++){let linked=false;for(let k=0;k<S.k;k++)if((S.neighbor[q[at]*S.k+k]===j&&S.neighborDistance[q[at]*S.k+k]<S.params.perception**2)||(S.neighbor[j*S.k+k]===q[at]&&S.neighborDistance[j*S.k+k]<S.params.perception**2))linked=true;if(linked&&!seen.has(j)){seen.add(j);q.push(j);}}sizes.push(q.length);}
 return {radius:Math.max(...s.actors.map(a=>distance(a.position,c))),meanRadius:s.actors.reduce((x,a)=>x+distance(a.position,c)/n,0),nearest,components:sizes.length,largestComponent:Math.max(...sizes),meanDegree:degree/n};
}
function run(id,seed,variable=false,seconds=120,disturb=false){const s=B.create(id,30,seed),p=s.school.params,dtPattern=variable?[1/120,1/45,1/90,1/60,1/30]:[1/60],old=s.actors.map(a=>({v:a.velocity.slice(),speed:a.speed,yaw:a.yaw,pitch:a.pitch,roll:a.roll,yr:0,pr:0,rr:0,cr:0,cpr:0,crr:0,acc:[0,0,0]}));
 let min=Infinity,guards=0,maxScalar=0,maxWorld=0,maxYawAcc=0,maxPitchAcc=0,maxRollAcc=0,maxTurn=0,maxPitch=0,maxRoll=0,maxSlip=0,maxSat=0,maxCorrection=0,maxRadius=0,minLargest=30,maxComponents=1,maxNearest=0,sumCruise=0,nCruise=0,threatPeak=0,frame=0,lastGraph;
 const durations=[],jerks=[],axisRates=[];let target=null;
 while(s.time<seconds-1e-8){const dt=Math.min(dtPattern[frame%dtPattern.length],seconds-s.time),mode=modes[Math.min(7,Math.floor(s.time/15))],input={mode};
  if(disturb&&s.time>=20&&s.time<25){target??=s.actors[0].position.slice();input.pointerRay={origin:[target[0],target[1],target[2]-20],direction:[0,0,1]};input.disturbance={point:target,strength:.4};}
  const start=performance.now();B.update(s,dt,input);durations.push(performance.now()-start);guards+=s.school.operations.safetyClamps;min=Math.min(min,s.contact.minimumClearance+s.shape.gap);maxSat=Math.max(maxSat,s.school.operations.satTests);maxCorrection=Math.max(maxCorrection,s.contact.maxCorrection);
  for(let i=0;i<30;i++){const a=s.actors[i],o=old[i],acc=a.velocity.map((v,k)=>(v-o.v[k])/dt),yawRate=diff(a.yaw,o.yaw)/dt,pitchRate=(a.pitch-o.pitch)/dt,rollRate=(a.roll-o.roll)/dt;
   maxScalar=Math.max(maxScalar,Math.abs(a.speed-o.speed)/dt);maxWorld=Math.max(maxWorld,Math.hypot(...acc));maxYawAcc=Math.max(maxYawAcc,Math.abs(a.turnRate-o.cr)/dt);maxPitchAcc=Math.max(maxPitchAcc,Math.abs(s.school.pitchRate[i]-o.cpr)/dt);maxRollAcc=Math.max(maxRollAcc,Math.abs(s.school.rollRate[i]-o.crr)/dt);maxTurn=Math.max(maxTurn,Math.abs(a.turnRate));maxPitch=Math.max(maxPitch,Math.abs(a.pitch));maxRoll=Math.max(maxRoll,Math.abs(a.roll));
   if(a.speed>1e-5)maxSlip=Math.max(maxSlip,Math.abs(diff(Math.atan2(a.velocity[2],-a.velocity[0]),a.yaw)));
   if(frame>1)jerks.push(Math.hypot(...acc.map((v,k)=>(v-o.acc[k])/dt)));
   threatPeak=Math.max(threatPeak,a.threat);if(mode==='cruise'&&s.time>5){sumCruise+=a.speed;nCruise++;}
   assert.ok([a.yaw,a.pitch,a.roll,a.speed,a.beatPhase,a.frequency,a.amplitude,...a.position,...a.velocity,...Object.values(a.finAngles)].every(Number.isFinite),'finite final committed pose/gait');
   Object.assign(o,{v:a.velocity.slice(),speed:a.speed,yaw:a.yaw,pitch:a.pitch,roll:a.roll,yr:yawRate,pr:pitchRate,rr:rollRate,cr:a.turnRate,cpr:s.school.pitchRate[i],crr:s.school.rollRate[i],acc});
  }
  if(frame%60===0){lastGraph=graph(s);maxRadius=Math.max(maxRadius,lastGraph.radius);minLargest=Math.min(minLargest,lastGraph.largestComponent);maxComponents=Math.max(maxComponents,lastGraph.components);maxNearest=Math.max(maxNearest,lastGraph.nearest);}
  frame++;
 }
 // Actual committed angular rates use exactly the same cap at every delta.
 const angularMultiplier=1;
 const data={id,seed,seconds,count:30,variableDt:variable,pointerRay:disturb,minFullSourceClearance:min,safetyClamps:guards,maxScalarAcceleration:maxScalar,maxWorldVectorAcceleration:maxWorld,maxYawAcceleration:maxYawAcc,maxPitchAcceleration:maxPitchAcc,maxRollAcceleration:maxRollAcc,maxTurn,maxPitch,maxRoll,maxHeadingSlip:maxSlip,maxSatCalls:maxSat,maxPositionCorrection:maxCorrection,maxRadius,minLargestComponent:minLargest,maxComponents,maxMeanNearestDistance:maxNearest,finalGraph:graph(s),meanCruiseSpeed:sumCruise/nCruise,finalMeanSpeed:s.actors.reduce((x,a)=>x+a.speed/30,0),threatPeak,finalThreat:Math.max(...s.actors.map(a=>a.threat)),cpuMs:{mean:durations.reduce((x,t)=>x+t,0)/durations.length,p95:percentile(durations,.95)},worldJerkP95:percentile(jerks,.95),buffersBytes:s.school.allocatedBytes,parameters:p};
 assert.ok(min>=s.shape.gap*.5,'unchanged positive complete-source clearance gate');assert.equal(guards,0,'emergency guard cannot bypass declared acceleration');assert.equal(maxCorrection,0,'no post-step positional projection');
 assert.ok(maxScalar<=p.maxAcceleration+1e-7,'committed speed acceleration');assert.ok(maxYawAcc<=p.maxAngularAcceleration*angularMultiplier+1e-6,'committed yaw acceleration');assert.ok(maxPitchAcc<=p.maxPitchAcceleration*angularMultiplier+1e-6,'committed pitch acceleration');assert.ok(maxRollAcc<=p.maxRollAcceleration*angularMultiplier+1e-6,'committed roll acceleration');
 assert.ok(maxTurn<=p.maxTurn+1e-9&&maxPitch<=p.maxPitch+1e-9&&maxRoll<=p.maxRoll+1e-9,'source engineering pose limits');
 assert.ok(maxWorld<=p.maxAcceleration+(p.maxSpeed??p.burst*1.06)*Math.hypot(p.maxTurn,p.maxPitchRate)+1e-5,'world acceleration includes bounded centripetal heading change');
 assert.ok(maxSlip<.01,'body-heading agrees with actual movement; variable dt can average internal headings');assert.ok(data.meanCruiseSpeed>B.profiles[id].speed*.6,'no schooling freeze');
 assert.ok(data.finalGraph.largestComponent===30&&data.finalGraph.nearest<2.3,'final local-perception graph connected with finite neighbor spacing');if(disturb)assert.ok(threatPeak>.1&&data.finalThreat<1e-5,'ray disturbance activates and decays');
 return data;
}
for(const id of Object.keys(B.profiles)){
 check(id+' original single-fish solver, source spine and profile exact parity',()=>{const a=B.create(id,1,73),b=Old.create(id,1,73);for(let f=0;f<1200;f++){const dt=[1/60,1/120,1/45][f%3],input={mode:modes[Math.floor(f/150)],pointer:f>400&&f<500?[1,.1,-.1]:null};B.update(a,dt,input);Old.update(b,dt,input);}assert.deepEqual(B.snapshot(a),Old.snapshot(b));assert.deepEqual(B.sampleSpine(a.actors[0],id),Old.sampleSpine(b.actors[0],id));assert.deepEqual(B.collisionBox(a.actors[0],a).half,Old.collisionBox(b.actors[0],b).half);assert.equal(B.deform.toString(),Old.deform.toString());return {frames:1200,sourceVerticesUnmodified:true};});
 for(const [seed,variable,disturb] of [[723,false,false],[73,true,true],[199,false,true]])check(id+' 120s 30-source committed trajectory seed '+seed,()=>run(id,seed,variable,120,disturb));
 check(id+' group determinism, independent phases, safe reset and pause',()=>{const a=B.create(id,30,41),b=B.create(id,30,41);for(let f=0;f<180;f++){B.update(a,1/60,{mode:'turn'});B.update(b,1/60,{mode:'turn'});}assert.deepEqual(B.snapshot(a),B.snapshot(b));assert.ok(new Set(a.actors.map(x=>x.beatPhase.toFixed(5))).size>25);const snap=K.snapshot(a.school);K.step(a.school,1/60,{paused:true});assert.deepEqual(K.snapshot(a.school),snap);B.reset(a);assert.deepEqual(B.snapshot(a),B.snapshot(B.create(id,30,41)));assert.ok(K.clearance(a.school)+a.shape.gap>=a.shape.gap*.5);return {deterministicSteps:180,independentPhases:30,pauseClockFrozen:true};});
}
check('R07 and R08 same-hardware 30 fish CPU workload',()=>{const timings=[];for(const id of Object.keys(B.profiles)){const old=Old.create(id,30,723),current=B.create(id,30,723),a=[],b=[];for(let f=0;f<240;f++){let t=performance.now();Old.update(old,1/60);if(f>=60)a.push(performance.now()-t);t=performance.now();B.update(current,1/60);if(f>=60)b.push(performance.now()-t);}const result={id,r07Mean:a.reduce((x,v)=>x+v,0)/a.length,r08Mean:b.reduce((x,v)=>x+v,0)/b.length,r07P95:percentile(a,.95),r08P95:percentile(b,.95),lastOperations:{...current.school.operations},numericBufferBytes:current.school.allocatedBytes};assert.ok(result.r08Mean<result.r07Mean,'CPU mean improves without source reduction');timings.push(result);}return {hardware:'same Node process, warmup60 measured180; not browser FPS',timings};});
const sourceHashes=Object.fromEntries(['src/behavior.js','src/schooling-r08.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex')]));
const report={schema:'fish.schooling-r08.cpu/1',taskId:anchor.taskId,dispatchTime:anchor.dispatchTime,createdAt:new Date().toISOString(),baseline:anchor.productionBaseline,sourceHashes,pass:failures.length===0,tests:rows,failures,scope:'Producer CPU continuity/contact/cohesion/cost checks, no browser/GPU/independent approval',visualAcceptance:false,productionReady:false};
fs.writeFileSync(path.join(base,'evidence/R08_SCHOOLING_REPORT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,tests:rows.length,failures,sourceHashes},null,2));if(failures.length)process.exitCode=1;
