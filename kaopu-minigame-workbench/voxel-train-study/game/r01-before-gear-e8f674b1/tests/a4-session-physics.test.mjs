import test from 'node:test';
import assert from 'node:assert/strict';
import {Session,replay,DT} from '../session.mjs';
import {DrivingPhysics} from '../physics/driving-physics.mjs';
import {A4_GAME_PARAMETERS} from '../physics/parameters.mjs';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} ≠ ${b}`);
const begin=()=>{const s=new Session({seed:'A4-SI-QA',line:'kcr1'});s.command('start');return s;};
function advanceUntil(s,condition,max=30000){for(let i=0;i<max&&!condition();i++)s.stepTicks(1);assert.ok(condition(),'condition reached');}
function checkRolling(s){const p=s.view().physics;close(s.distance,p.positionM);close(s.velocity,p.speedMps);close(p.positionM-p.rollingOriginPositionM,p.wheelRadiusM*p.wheelAngleRad);close(p.wheelAngularSpeedRadS,p.speedMps/p.wheelRadiusM);return p;}

test('actual Session controls drive the SI engine, supply, wheel rotation and only physical position',()=>{
 const s=begin();s.command('throttle-up');s.command('throttle-up');s.command('throttle-up');s.stepTicks(300);
 const p=checkRolling(s);assert.ok(s.velocity>0);assert.ok(s.distance>0);assert.equal(p.wheelDiameterM,2.032);assert.equal(p.tick,s.tick*4);close(p.timeS,s.tick*DT);
 assert.equal(p.controls.throttle,1);assert.ok(p.diagnostics.tractionForceN>0);assert.ok(p.ledger.steamMassKg>0);assert.ok(p.waterKg<A4_GAME_PARAMETERS.supply.waterInitialKg);
 assert.ok(p.diagnostics.tractionForceN<=p.diagnostics.adhesionLimitN+1e-7);
 for(const [key,value] of Object.entries(p.residuals))assert.ok(Math.abs(value)<1e-4,`${key}: ${value}`);
 const d=s.distance;const isolated=s.view();isolated.physics.positionM=9999;assert.equal(s.distance,d);
});
test('pause freezes physics, coal, pressure, time, passengers and queued host time without resume jump',()=>{
 const s=begin();s.command('throttle-up');s.stepTicks(240);s.command('pause',true);
 const p=s.view().physics,before=s.signature(),elapsed=s.elapsed;s.advance(60);s.stepTicks(600);
 assert.deepEqual(s.view().physics,p);assert.equal(s.signature(),before);assert.equal(s.elapsed,elapsed);assert.equal(s.command('throttle-up').accepted,false);
 s.command('pause',false);s.stepTicks(1);close(s.view().physics.timeS,p.timeS+DT);assert.equal(s.tick,241);
});
test('emergency brake has priority over simultaneous throttle and removes speed without reverse',()=>{
 const s=begin();for(let i=0;i<3;i++)s.command('throttle-up');s.stepTicks(420);const speed=s.velocity;
 s.command('brake',true);assert.equal(s.command('throttle-up').accepted,false);assert.equal(s.brake,true);assert.equal(s.throttle,0);
 s.stepTicks(60);assert.ok(s.velocity<speed);assert.equal(s.view().physics.controls.throttle,0);assert.equal(s.view().physics.controls.brake,1);
 advanceUntil(s,()=>s.velocity===0);const d=s.distance;s.stepTicks(180);assert.equal(s.velocity,0);assert.equal(s.distance,d);checkRolling(s);
});
test('negative notches apply physical service brake and coasting cannot secretly power wheels',()=>{
 const s=begin();s.command('throttle-up');s.stepTicks(300);s.command('throttle-down');s.stepTicks(1);assert.equal(s.view().physics.controls.throttle,0);assert.equal(s.view().physics.controls.brake,0);
 s.command('throttle-down');s.stepTicks(1);assert.equal(s.view().physics.controls.brake,.35);s.command('throttle-down');s.stepTicks(1);assert.equal(s.view().physics.controls.brake,.7);
});
test('doors require complete stop, stable dwell and actual platform coverage then hold physics stationary',()=>{
 const s=begin();s.distance=s.station.target;s.velocity=.1;s.stopStable=2;assert.equal(s.canOpen(),false);
 s.velocity=0;s.stopStable=.3;assert.equal(s.canOpen(),false);s.stopStable=1;s.distance=s.station.target-20;assert.equal(s.canOpen(),false);
 s.distance=s.station.target;s.stepTicks(30);assert.equal(s.command('station-action').accepted,true);const d=s.distance;
 assert.equal(s.command('throttle-up').accepted,false);s.stepTicks(240);assert.equal(s.distance,d);assert.equal(s.velocity,0);assert.equal(s.view().physics.controls.throttle,0);assert.equal(s.view().physics.controls.brake,1);
});
test('recovery switches direction only near stop and governor returns toward station using wheel-distance physics',()=>{
 const s=new Session({seed:'A4-recover',line:'legacy'});s.command('start');s.distance=s.station.target+13;s.velocity=1;assert.equal(s.command('recover').accepted,false);
 s.velocity=0;assert.equal(s.command('recover').accepted,true);const d=s.distance;s.stepTicks(300);assert.ok(s.distance<d);assert.ok(s.velocity<0);assert.ok(s.velocity>-1.8);assert.equal(s.view().physics.controls.reverser,-1);checkRolling(s);
 s.command('brake',true);advanceUntil(s,()=>s.velocity===0);assert.equal(s.reverse,false);s.command('brake',false);s.command('throttle-up');s.stepTicks(180);assert.ok(s.velocity>0);checkRolling(s);
});
test('replay reproduces complete physical state after throttle, pause, service and emergency braking',()=>{
 const s=begin();s.command('throttle-up');s.stepTicks(180);s.command('pause',true);s.advance(4);s.command('pause',false);s.command('throttle-up');s.stepTicks(90);s.command('throttle-down');s.command('throttle-down');s.command('throttle-down');s.stepTicks(60);s.command('brake',true);s.stepTicks(180);
 const played=replay(s.replayPacket());assert.equal(s.signature(),played.signature());assert.deepEqual(s.view().physics,played.view().physics);assert.equal(s.replayPacket().physicsModel,'FH88_A4_SI_R01');
});
test('30, 60 and 144 Hz host frames generate the same deterministic 120 Hz physical state',()=>{
 const games=[30,60,144].map(hz=>{const s=begin();s.command('throttle-up');for(let i=0;i<hz*12;i++)s.advance(1/hz);return s;});
 for(const s of games.slice(1)){assert.equal(s.signature(),games[0].signature());assert.deepEqual(s.view().physics,games[0].view().physics);}
});
test('terminal summary accounts stopped kinetic energy and freezes physical state',()=>{
 const s=begin();s.command('throttle-up');s.stepTicks(300);s.command('finish');const p=s.view().physics;assert.equal(s.phase,'summary');assert.equal(s.velocity,0);assert.equal(p.paused,true);assert.ok(Math.abs(p.residuals.mechanicalEnergyJ)<1e-5);s.advance(2);assert.deepEqual(s.view().physics,p);
});
test('unmodified SI parameter validation remains enforced on calibrated train settings',()=>{
 assert.doesNotThrow(()=>new DrivingPhysics(A4_GAME_PARAMETERS));const bad=structuredClone(A4_GAME_PARAMETERS);bad.train.wheelDiameterM=0;assert.throws(()=>new DrivingPhysics(bad));
});

test('native command log can overshoot, brake, recover, open doors and replay without placement fixtures',()=>{
 const s=new Session({seed:'A4-native-recovery',line:'legacy'});s.command('start');s.command('throttle-up');advanceUntil(s,()=>s.distance>=78);s.command('brake',true);advanceUntil(s,()=>s.velocity===0);
 assert.equal(s.station.missed,true);assert.equal(s.canRecover(),true);assert.equal(s.command('recover').accepted,true);advanceUntil(s,()=>s.canOpen(),6000);
 checkRolling(s);assert.equal(s.command('station-action').accepted,true);s.stepTicks(120);assert.equal(s.velocity,0);assert.equal(s.station.recovered,true);
 const played=replay(s.replayPacket());assert.equal(played.signature(),s.signature());assert.deepEqual(played.view().physics,s.view().physics);
});
