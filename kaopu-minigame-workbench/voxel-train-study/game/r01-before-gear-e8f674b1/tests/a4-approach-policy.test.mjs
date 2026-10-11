import test from 'node:test';import assert from 'node:assert/strict';
import {Session,replay} from '../session.mjs';import policy from './approach-policy.cjs';
const until=(s,p)=>{for(let i=0;i<90000&&!p();i++)s.stepTicks(1);assert(p());};
function brake(s,lag){s.stepTicks(Math.round(lag*30));s.command('brake',true);until(s,()=>s.velocity===0);s.command('brake',false);s.stepTicks(30);}
function service(s){until(s,()=>s.canOpen());s.command('station-action');until(s,()=>s.phase==='ready-depart');until(s,()=>s.view().timetable.dwellRemaining<=0);s.command('station-action');until(s,()=>s.phase==='running');}
function precise(s,target,lag){for(let i=0;i<1000;i++){const action=policy.approachAction(s.view(),target);if(action==='brake'){brake(s,lag);return;}if(action==='accelerate'||action==='decelerate'){s.stepTicks(Math.round(lag*30));s.command(action==='accelerate'?'throttle-up':'throttle-down');}s.stepTicks(60);}throw Error('Approach did not converge');}
for(const lag of[0,.5,1,2])test('Real command-only approach handles 2s observation cadence plus '+lag+'s control latency',()=>{
 const s=new Session({line:'kcr1',seed:'KCR-0620'});s.command('start');service(s);s.command('throttle-up');s.command('throttle-up');
 while(s.station.target-s.distance>s.brakingDistance()+140)s.stepTicks(60);brake(s,lag);precise(s,700,lag);assert(s.canOpen());service(s);assert.equal(s.stats.stops,2);assert.equal(s.stats.missed,0);
 precise(s,790,lag);assert(s.distance>=786&&s.distance<=794,JSON.stringify({lag,distance:s.distance}));assert.equal(s.velocity,0);assert.deepEqual(replay(s.replayPacket()).view().physics,s.view().physics);
});
