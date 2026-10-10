/** Independent Node regression for the one-shot UI recipe. No downloaded dependencies. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createDemoStart,motionReason} from './drive-assist.mjs';
import {DrivingPhysics} from './physics/driving-physics.mjs';
import {createDrivingBridge} from './physics/adapter-bridge.mjs';
import {buildPreview} from './adapter.mjs';
const readJSON=async path=>JSON.parse(await fs.readFile(new URL(path,import.meta.url),'utf8'));
const parameters=await readJSON('./physics/parameters.json');
const checks=[],evidence={};
async function test(name,body){try{await body();checks.push({name,pass:true});console.log('PASS',name);}catch(error){checks.push({name,pass:false,error:String(error.stack||error)});console.error('FAIL',name,String(error.message||error));}}
function fixture(initial={},hooks={}){
 const physics=new DrivingPhysics(parameters);physics.reset(initial);physics.setPaused(true);
 const calls=[];
 const assist=createDemoStart({snapshot:()=>physics.snapshot(),applyControls:patch=>{calls.push({kind:'controls',patch:{...patch},tick:physics.tick});hooks.beforeControls?.(patch,calls,physics);const value=physics.setControls(patch);hooks.afterControls?.(patch,calls,physics);return value;},setPaused:value=>{calls.push({kind:'pause',value,tick:physics.tick});hooks.beforePause?.(value,calls,physics);physics.setPaused(value);hooks.afterPause?.(value,calls,physics);}});
 const advance=seconds=>physics.stepTicks(Math.round(seconds/parameters.clock.fixedDtS));
 return {physics,assist,calls,advance};
}
const withoutControls=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['controls','paused'].includes(k)));
await test('default: paused, stopped and eligible; run alone does not release brake',()=>{
 const f=fixture();assert.equal(f.assist.available(),true);assert.equal(motionReason(f.physics.snapshot(),f.assist.state()).code,'paused');f.physics.setPaused(false);f.advance(10);const s=f.physics.snapshot();assert.equal(s.speedMps,0);assert.equal(s.positionM,0);assert.equal(s.controls.throttle,0);assert.equal(s.controls.brake,1);assert.equal(motionReason(s,f.assist.state()).code,'brake-command');
});
await test('one shot changes only commands and paused flag; no time, velocity, position, wheel, energy or inventory write',()=>{
 const f=fixture({positionM:123.456,controls:{reverser:-1,throttle:.47,cutoff:.2,firingKgS:.31,grade:.001}}),before=f.physics.snapshot();assert.equal(f.assist.start().applied,true);const after=f.physics.snapshot();assert.deepEqual(withoutControls(after),withoutControls(before));assert.deepEqual(after.controls,{...before.controls,reverser:1,throttle:.30,brake:0,cutoff:.55});assert.equal(after.paused,false);assert.deepEqual(f.calls.map(x=>x.tick),[0,0,0]);assert.deepEqual(f.assist.state(),{used:true,emergencyLocked:false,mode:'demo'});
});
await test('starts safely from forward, neutral and reverse with pre-existing positive throttle',()=>{
 for(const reverser of [-1,0,1]){const f=fixture({controls:{reverser,throttle:.7}}),before=f.physics.snapshot();assert.equal(f.assist.start().applied,true);assert.deepEqual(withoutControls(f.physics.snapshot()),withoutControls(before));f.advance(8);assert.ok(f.physics.snapshot().speedMps>0);}
});
await test('actual 120 Hz physics releases brake progressively, then produces displacement and shaft motion',()=>{
 const f=fixture();f.assist.start();assert.equal(f.physics.snapshot().brakeFraction,1);const first=f.advance(.5);assert.ok(first.brakeFraction>0&&first.brakeFraction<1);const later=f.advance(7.5);assert.ok(later.speedMps>0);assert.ok(later.positionM>0);assert.ok(later.wheelAngleRad>0);assert.ok(later.waterKg<parameters.supply.waterInitialKg);assert.ok(later.ledger.steamMassKg>0);assert.ok(later.diagnostics.tractionForceN>0);assert.ok(Math.abs(later.positionM-later.wheelRadiusM*later.wheelAngleRad)<1e-8);evidence.startAtEightSeconds={timeS:later.timeS,speedMps:later.speedMps,positionM:later.positionM,brakeFraction:later.brakeFraction,wheelAngleRad:later.wheelAngleRad,waterUsedKg:parameters.supply.waterInitialKg-later.waterKg};
});
await test('repeated clicks never reapply demo commands, including after manual takeover at rest',()=>{
 const f=fixture();f.assist.start();f.physics.setControls({throttle:.07,cutoff:.18,brake:.8});f.assist.manual();const before=f.physics.snapshot(),n=f.calls.length;for(let i=0;i<100;i++)assert.equal(f.assist.start().applied,false);assert.deepEqual(f.physics.snapshot(),before);assert.equal(f.calls.length,n);assert.equal(f.assist.available(),false);assert.equal(f.assist.state().mode,'manual');
});
await test('moving forward or backward cannot trigger demo, including paused moving snapshots',()=>{
 for(const speedMps of [-3,-.0001,.0001,3])for(const paused of [false,true]){const f=fixture({speedMps,positionM:12});f.physics.setPaused(paused);const before=f.physics.snapshot();assert.equal(f.assist.available(),false);assert.equal(f.assist.start().applied,false);assert.deepEqual(f.physics.snapshot(),before);assert.equal(f.calls.length,0);assert.equal(f.assist.state().used,false);}
});
for(const scenario of ['first control before commit','second control before commit','second control after commit','pause before commit','pause after commit'])await test('atomic rollback: '+scenario,()=>{
 let thrown=false,controlCount=0;
 const shouldThrow=(point)=>{if(!thrown&&point===scenario){thrown=true;throw new Error('TEST_INJECTED_FAILURE');}};
 const f=fixture({positionM:37,controls:{reverser:-1,throttle:.44,cutoff:.22,brake:.7}}, {beforeControls(){controlCount++;shouldThrow(controlCount===1?'first control before commit':controlCount===2?'second control before commit':'');},afterControls(){shouldThrow(controlCount===2?'second control after commit':'');},beforePause(){shouldThrow('pause before commit');},afterPause(){shouldThrow('pause after commit');}});
 const before=f.physics.snapshot();assert.throws(()=>f.assist.start(),/TEST_INJECTED_FAILURE/);assert.deepEqual(f.physics.snapshot(),before);assert.deepEqual(f.assist.state(),{used:false,emergencyLocked:false,mode:'manual'});assert.equal(f.assist.start().applied,true);
});
await test('emergency before first demo locks it until explicit reset and never unpauses by itself',async()=>{
 const f=fixture();f.assist.emergency();const before=f.physics.snapshot(),n=f.calls.length;for(let i=0;i<20;i++)assert.equal(f.assist.start().applied,false);await new Promise(resolve=>setTimeout(resolve,25));assert.deepEqual(f.physics.snapshot(),before);assert.equal(f.calls.length,n);assert.equal(f.assist.available(),false);f.physics.reset();f.physics.setPaused(true);f.assist.reset();assert.equal(f.assist.available(),true);assert.equal(f.assist.start().applied,true);
});
await test('emergency from actual motion eventually stops; no rebound or implicit demo recovery',async()=>{
 const f=fixture();f.assist.start();f.advance(20);const initial=f.physics.snapshot();assert.ok(initial.speedMps>0);f.assist.emergency();let s=f.physics.snapshot(),elapsed=0;while(s.speedMps!==0&&elapsed<180){s=f.advance(.25);elapsed+=.25;}assert.equal(s.speedMps,0);assert.equal(s.controls.throttle,0);assert.equal(s.controls.brake,1);const stopPosition=s.positionM;f.advance(30);assert.equal(f.physics.snapshot().speedMps,0);assert.equal(f.physics.snapshot().positionM,stopPosition);for(let i=0;i<20;i++)assert.equal(f.assist.start().applied,false);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(f.physics.snapshot().controls.throttle,0);assert.equal(f.physics.snapshot().controls.brake,1);assert.equal(f.assist.state().emergencyLocked,true);evidence.emergency={fromSpeedMps:initial.speedMps,stopAfterS:elapsed,stopPositionM:stopPosition,noReboundS:30};
});
await test('manual takeover after emergency remains usable while demo stays locked',()=>{
 const f=fixture();f.assist.emergency();f.physics.setControls({throttle:.25,brake:0});f.assist.manual();f.physics.setPaused(false);f.advance(8);assert.ok(f.physics.snapshot().speedMps>0);assert.equal(f.assist.state().emergencyLocked,true);assert.equal(f.assist.state().mode,'manual');assert.equal(f.assist.start().applied,false);assert.equal(motionReason(f.physics.snapshot(),f.assist.state()).code,'moving');f.physics.setPaused(true);assert.equal(motionReason(f.physics.snapshot(),f.assist.state()).code,'paused');
});
await test('diagnostics do not claim a still-rolling emergency is stopped',()=>{
 const f=fixture({speedMps:.015});f.physics.setPaused(false);f.assist.emergency();const reason=motionReason(f.physics.snapshot(),f.assist.state());assert.match(reason.code,/^emergency(?:-creeping)?$/);assert.doesNotMatch(reason.text,/急刹停车/);
});
await test('diagnostics do not recommend unavailable demo after used or emergency-locked manual takeover',()=>{
 const f=fixture();f.assist.start();f.physics.setControls({throttle:0,brake:1});f.assist.manual();const reason=motionReason(f.physics.snapshot(),f.assist.state());assert.doesNotMatch(reason.text,/点一次演示起步/);f.assist.emergency();f.assist.manual();const lockedReason=motionReason(f.physics.snapshot(),f.assist.state());assert.doesNotMatch(lockedReason.text,/点一次演示起步/);
});
await test('diagnostics never label ordinary low-speed rolling as parked',()=>{
 for(const speedMps of [-.015,.015]){const f=fixture({speedMps});f.physics.setPaused(false);const reason=motionReason(f.physics.snapshot(),f.assist.state());assert.doesNotMatch(reason.short,/停车/);assert.doesNotMatch(reason.text,/^停车[：:]/);}
});
await test('paused moving state does not suggest an unavailable demo',()=>{
 const f=fixture({speedMps:2});const reason=motionReason(f.physics.snapshot(),f.assist.state());assert.doesNotMatch(reason.text,/演示起步会/);assert.equal(f.assist.available(),false);
});
await test('assist has no timer, animation loop or simulation mutation API',async()=>{
 const text=await fs.readFile(new URL('./drive-assist.mjs',import.meta.url),'utf8');assert.doesNotMatch(text,/\b(?:setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\s*\(/);assert.doesNotMatch(text,/\b(?:stepTicks|advance|frame)\s*\(/);assert.doesNotMatch(text,/\.(?:speedMps|positionM|timeS|wheelAngleRad)\s*=/);
});
await test('real function-generated mechanism and real bridge move only through physics steps',async()=>{
 const recipe=await readJSON('./frozen/learned-shape/recovered-recipe.json'),design=await readJSON('./frozen/three-cylinder/design.json');const model=buildPreview(recipe,design),bridge=createDrivingBridge(parameters,model);bridge.pause(true);const assist=createDemoStart({snapshot:()=>bridge.snapshot(),applyControls:patch=>bridge.controls(patch),setPaused:value=>bridge.pause(value)}),beforePhysics=bridge.snapshot(),beforeModel=model.snapshot();assert.equal(assist.start().applied,true);assert.deepEqual(withoutControls(bridge.snapshot()),withoutControls(beforePhysics));assert.deepEqual(model.snapshot(),beforeModel);bridge.frame(8);const after=bridge.snapshot(),mechanism=model.snapshot();assert.ok(after.speedMps>0);assert.equal(model.train.position.x,after.positionM);assert.ok(Math.abs(after.wheelAngleRad*after.wheelRadiusM-after.positionM)<1e-8);evidence.realBridge={timeS:after.timeS,speedMps:after.speedMps,positionM:after.positionM,trainX:model.train.position.x,mechanism};
});
const report={schema:'FH88_DEMO_START_INDEPENDENT_NODE_REVIEW_R01',passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks,evidence,limitations:['Node verification includes real 120 Hz physics and function-generated mechanism; this is not browser input/layout validation.','Fault injection covers transient command/pause failures; permanently broken callbacks are outside the current adapter contract.']};
await fs.writeFile(new URL('./DEMO_START_NODE_REVIEW.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed,evidence:{...evidence,realBridge:evidence.realBridge&&{...evidence.realBridge,mechanism:'see saved report'}}},null,2));
if(report.failed)process.exitCode=1;
