import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {ObservationCycle,approach,rotateToTarget} from '../core.js';
const checks=[];
function test(name,fn){fn();checks.push(name);}
function run(c,t,seen,hz=60,active=true){for(let i=0;i<Math.round(t*hz);i++)c.update(1/hz,seen,active);}
test('Unseen object cannot advance while looking away',()=>{const c=new ObservationCycle();run(c,5,false);assert.equal(c.phase,0);assert.equal(c.stage,'unseen');});
test('Brief glance does not arm a change',()=>{const c=new ObservationCycle();run(c,.3,true);run(c,1,false);assert.equal(c.phase,0);assert.equal(c.stage,'unseen');});
test('Held gaze arms but does not change visible object',()=>{const c=new ObservationCycle();run(c,3,true);assert.equal(c.phase,0);assert.equal(c.stage,'observed');});
test('Look-away change is gated by duration and happens once',()=>{const c=new ObservationCycle();run(c,1,true);run(c,.2,false);assert.equal(c.phase,0);run(c,.2,false);assert.equal(c.phase,1);run(c,3,false);assert.equal(c.phase,1);assert.equal(c.events.filter(x=>x.type==='change').length,1);});
test('Pause freezes elapsed time and progress',()=>{const c=new ObservationCycle();run(c,1,true);const before=c.snapshot();run(c,2,false,60,false);assert.deepEqual(c.snapshot(),before);});
test('Three observations terminate without a fourth phase',()=>{const c=new ObservationCycle();for(let i=0;i<3;i++){run(c,1,true);run(c,.5,false);}assert.equal(c.phase,2);assert.equal(c.stage,'complete');assert.equal(c.events.length,6);run(c,10,false);assert.equal(c.events.length,6);});
test('Reset removes all phase and event memory',()=>{const c=new ObservationCycle();run(c,1,true);run(c,.5,false);c.reset();assert.deepEqual(c.snapshot(),new ObservationCycle().snapshot());});
test('Identical 30 and 60 Hz routes have equal state and event order',()=>{const a=new ObservationCycle(),b=new ObservationCycle();for(let i=0;i<3;i++){run(a,1,true,30);run(a,.5,false,30);run(b,1,true,60);run(b,.5,false,60);}assert.deepEqual(a.events.map(x=>[x.type,x.phase]),b.events.map(x=>[x.type,x.phase]));assert.equal(a.stage,b.stage);});
test('Smoothing is equivalent at 30 and 60 Hz',()=>{let a=0,b=0;for(let i=0;i<30;i++)a=approach(a,5,9,1/30);for(let i=0;i<60;i++)b=approach(b,5,9,1/60);assert(Math.abs(a-b)<1e-12);});
test('Target rotation points toward negative Z baseline',()=>{assert.deepEqual(rotateToTarget({x:0,y:1,z:2},{x:0,y:1,z:-2}),{yaw:-0,pitch:0});});
const result={passed:true,scope:'Original pure state and camera math only; not P.T. runtime execution',checks,checkCount:checks.length};
writeFileSync(new URL('./core-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
