import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import policy from './photo-approach-policy.cjs';
const action=policy.photoApproachAction;
const state=(distance,velocity=0,throttle=0,brakingDistance=0)=>({distance,velocity,throttle,brakingDistance});
test('photography success retains the original closed 786–794 metre window and exact zero speed',()=>{
 for(const x of[786,789,794])assert.equal(action(state(x)),'done');
 assert.notEqual(action(state(785.999)),'done');
 assert.notEqual(action(state(788,.001)),'done');
 assert.equal(action(state(794.000001)),'overshoot');
 assert.equal(action(state(788,-.01)),'brake');
});
test('braking has priority; early stops must resume; throttle cuts happen in the slow band',()=>{
 assert.equal(action(state(756,.46,1)),'brake');
 assert.equal(action(state(779,.21,1)),'brake');
 assert.equal(action(state(756,.21,1)),'decelerate');
 assert.equal(action(state(780,0,0)),'accelerate');
 assert.equal(action(state(750,1.21,1)),'decelerate');
 assert.equal(action(state(785,.5,0,3)),'brake');
 assert.throws(()=>action(state(NaN)),/Finite/);
});
// Copy this test, policy and replay JSON together into game/tests for CI.
// The second location only supports running the delivered parts in its staging tree.
const sessionCandidates=['../session.mjs','../candidate/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/session.mjs'];
const sessionURL=sessionCandidates.map(p=>new URL(p,import.meta.url)).find(p=>fs.existsSync(p));
assert(sessionURL,'Place this test under game/tests or the delivered parts directory');
const {replay}=await import(sessionURL.href),fixture=JSON.parse(fs.readFileSync(new URL('./photo-approach-start-replay.json',import.meta.url))),packet=fixture.packet;
function advance(g,seconds){for(let i=0;i<Math.ceil(seconds*30);i++)g.step();}
function drive(observationDelay,commandDelay,seed=0){
 const g=replay(packet);assert.equal(g.distance,fixture.provenance.expectedDistanceM);assert.equal(g.velocity,0);assert.equal(g.throttle,1);
 const begin=g.elapsed;let n=0,s=seed>>>0,stops=0;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;},delay=d=>typeof d==='number'?d:.3+random()*1.7;
 while(g.elapsed-begin<600&&n++<20000){const a=action(g.view());
  assert.notEqual(a,'overshoot',`overshoot for obs=${observationDelay}, command=${commandDelay}, seed=${seed}`);
  if(a==='done'){assert(g.distance>=786&&g.distance<=794);assert.equal(g.velocity,0);return{distance:g.distance,stops,elapsed:g.elapsed-begin};}
  if(a==='brake'){advance(g,delay(commandDelay));assert(g.command('brake',true).accepted);let k=0;while(g.velocity!==0&&k++<3000)g.step();assert.equal(g.velocity,0);stops++;advance(g,delay(observationDelay)+delay(commandDelay));assert(g.command('brake',false).accepted);}
  else if(a==='accelerate'||a==='decelerate'){advance(g,delay(commandDelay));assert(g.command(a==='accelerate'?'throttle-up':'throttle-down').accepted);}
  advance(g,delay(observationDelay));assert.notEqual(g.phase,'summary');
 }
 assert.fail(`timed out for obs=${observationDelay}, command=${commandDelay}, seed=${seed}`);
}
test('170 real Session delayed-control approaches reach the unchanged window without state placement',()=>{
 const results=[];
 for(const obs of[.3,.5,.8,1,1.3,1.6,2])for(const cmd of[.3,.5,.8,1,1.3,1.6,2])results.push(drive(obs,cmd));
 for(const obs of[.3,1.3,1.6,2,74/30,2.8,3])for(const cmd of[74/30,2.8,3])results.push(drive(obs,cmd));
 for(let seed=1;seed<=100;seed++)results.push(drive('random','random',seed));
 assert.equal(results.length,170);assert(results.every(r=>r.stops>0));
});
