import assert from 'node:assert/strict';
import {Session,replay,COACHES,FRONT_X} from '../session.mjs';
function power(game,n){while(game.throttle<n)game.command('throttle-up');while(game.throttle>n)game.command('throttle-down');}
function brake(game,on){if(game.brake!==on)game.command('brake',on);}
function normalPilot(game,earlyOffset=0){
  const v=game.view();
  if(v.phase==='ready-depart'){game.command('station-action');return;}
  if(game.serviceLocked()||v.phase==='summary')return;
  if(v.station.canOpen){game.command('station-action');return;}
  const remaining=v.station.remaining-earlyOffset,decel=v.station.wet?2.4:3.1;
  if(v.velocity>.02&&remaining<=v.velocity*v.velocity/(2*decel)+.08){brake(game,true);return;}
  if(Math.abs(v.velocity)<.02&&Math.abs(v.station.remaining)<=7){brake(game,false);return;}
  brake(game,false);power(game,v.speedKmh>v.station.limit-5?0:3);
}
function checkPeople(game){
  const seats=game.actors.filter(a=>a.seatId!==null&&a.seatId!==undefined).map(a=>a.seatId);assert.equal(new Set(seats).size,seats.length,'A seat cannot be reserved twice');
  for(const a of game.actors)if(a.path&&a.position[2]>.99&&a.position[2]<1.22){const x=a.position[0]-game.distance+FRONT_X,doors=COACHES.map(c=>a.kind==='boarding'?c.frontDoor:c.rearDoor);assert.ok(doors.some(d=>Math.abs(d-x)<.38),'People cross the sidewall only through real door openings');assert.equal(game.velocity,0,'Train must be held while people cross');assert.equal(game.door,1,'Door must be fully open while people cross');}
}
const game=new Session({seed:'QA-DRIVER-01',durationMinutes:10});game.command('start');
let samples=0;
for(let i=0;i<20000&&game.phase!=='summary';i++){normalPilot(game);game.stepTicks(1);checkPeople(game);samples++;}
assert.equal(game.phase,'summary','Six stations must finish without re-entering running');assert.equal(game.route.length,6);assert.equal(game.stats.stops,6);assert.ok(game.stats.pickedUp>0);assert.equal(game.stats.delivered,game.stats.pickedUp+4,'Every boarded and initial passenger reaches the terminal');assert.equal(game.view().onboard,0);assert.equal(game.stats.missed,0);assert.equal(game.stats.bestCombo,6);assert.ok(game.elapsed>0&&game.elapsed<600);assert.equal(game.station.index,5);assert(game.view().routeStations.every(s=>s.completed));
assert.equal(replay(game.replayPacket()).signature(),game.signature(),'Seed plus input log reproduces the final score, actors and physics');
const resumed=replay(game.replayPacket());assert.equal(resumed.replayPacket().inputs.length,game.inputLog.length,'Resume keeps the complete input history');

const early=new Session({seed:'EARLY-STOP'});early.command('start');for(let i=0;i<3000&&early.phase!=='ready-depart';i++){normalPilot(early,5);early.stepTicks(1);checkPeople(early);}assert.equal(early.phase,'ready-depart');assert.equal(early.station.walkStop,true);assert.equal(early.stats.stops,1);assert.ok(early.stats.satisfaction>70);

const miss=new Session({seed:'RECOVERY'});miss.command('start');power(miss,1);while(miss.velocity<7)miss.stepTicks(1);power(miss,0);while(!miss.station.missed)miss.stepTicks(1);brake(miss,true);while(miss.velocity>.001)miss.stepTicks(1);assert.ok(miss.canRecover());assert.equal(miss.stats.missed,1);assert.notEqual(miss.phase,'summary');assert.ok(miss.actors.some(a=>a.kind==='angry'));
assert.equal(miss.command('recover').accepted,true);assert.equal(miss.canRecover(),false,'An active recovery cannot be triggered twice');assert.equal(miss.command('recover').accepted,false);let sawRocks=false,sawHit=false;
for(let i=0;i<1500&&miss.phase!=='ready-depart';i++){
  const v=miss.view();sawRocks||=v.rocks.length>0;sawHit||=v.stats.stoneHits>0;
  if(v.station.canOpen)miss.command('station-action');
  else if(!miss.serviceLocked()&&v.station.remaining>=-.55&&v.reverse)brake(miss,true);
  miss.stepTicks(1);checkPeople(miss);
}
assert.equal(miss.phase,'ready-depart');assert.equal(miss.stats.recovered,1);assert.ok(miss.stats.pickedUp>0);assert.ok(sawRocks,'Missed stop produces visible ballistic projectiles');assert.ok(sawHit,'At least one aimed projectile collides with a carriage');

const skip=new Session({seed:'FORWARD'});skip.command('start');power(skip,3);while(skip.stationIndex===0)skip.stepTicks(1);assert.equal(skip.stats.missed,1);assert.equal(skip.phase,'running','An unrecoverable missed stop does not end the game');
const before=skip.signature();skip.command('pause',true);skip.advance(.2);skip.stepTicks(200);assert.equal(skip.signature(),before);assert.equal(skip.command('brake',true,{role:'passenger'}).accepted,false);skip.command('pause',false);skip.stepTicks(1);assert.notEqual(skip.signature(),before);

const slowFrames=new Session({seed:'FRAME-CADENCE'}),fastFrames=new Session({seed:'FRAME-CADENCE'});for(const g of [slowFrames,fastFrames]){g.command('start');g.command('throttle-up');}for(let i=0;i<20;i++)slowFrames.advance(.5);for(let i=0;i<600;i++)fastFrames.advance(1/60);assert.equal(slowFrames.tick,300,'Ten seconds of wall time remain ten simulation seconds at low frame rates');assert.equal(slowFrames.signature(),fastFrames.signature(),'Render cadence does not change motion or session time');
const timedEnd=new Session({seed:'CLOCK-END'});timedEnd.command('start');for(let i=0;i<301;i++)timedEnd.advance(2);assert.equal(timedEnd.phase,'summary');assert.equal(timedEnd.tick,18000,'Catch-up stops at the completed-session tick');const ended=timedEnd.signature();timedEnd.advance(2);assert.equal(timedEnd.signature(),ended,'A finished session does not consume more catch-up ticks');
console.log(JSON.stringify({status:'passed',fullSession:{seed:game.config.seed,ticks:game.tick,seconds:game.elapsed,stats:game.stats,inputCount:game.inputLog.length,pathSamples:samples},earlyWalk:true,recovery:{hits:miss.stats.stoneHits,pickedUp:miss.stats.pickedUp},missedStopContinues:true,pause:true,replay:true,roleValidation:true,wallClockCadence:true,summaryStopsCatchUp:true},null,2));
