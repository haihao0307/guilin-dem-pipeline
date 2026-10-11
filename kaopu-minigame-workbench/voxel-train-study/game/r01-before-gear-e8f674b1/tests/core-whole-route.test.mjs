import assert from 'node:assert/strict';
import {Session,replay,DT} from '../session.mjs';
import {MILEAGE,KCR_STATIONS,minuteOfDay} from '../timetable.mjs';
const game=new Session({line:'kcr1',seed:'KCR-QA'});assert.equal(game.route.length,9);assert.equal(game.route.at(-1).target,6000);assert.equal(MILEAGE[5].join('/'),'14.25/22.9');assert.deepEqual(game.route.map(x=>x.english),['Kowloon','Yaumati','Shatin','Ma Liu Shui','Tai Po Kau','Tai Po Market','Fanling','Sheung Shui','Lo Wu']);
let lastClock=380,previousStation=0,arrivals=[];game.command('start');
for(let i=0;i<90000&&game.phase!=='summary';i++){
 const v=game.view();assert.ok(game.scheduleMinutes>=lastClock);lastClock=game.scheduleMinutes;
 if(v.station.canOpen&&!game.serviceLocked()){arrivals.push({station:game.stationIndex,elapsed:game.elapsed,clock:v.timetable.clock,late:v.timetable.lateMinutes});game.command('station-action');}
 else if(game.phase==='ready-depart'){if(v.timetable.dwellRemaining<=0)game.command('station-action');}
 else if(!game.serviceLocked()){
   const remaining=v.station.remaining;
   const stop=v.brakingDistance+1.1;
   if(remaining<=stop&&v.velocity>.08)game.command('brake',true);
   else if(v.velocity<.3&&remaining<=6&&remaining>=-6)game.command('brake',true);
   else if(v.velocity<14&&remaining>stop){if(game.brake)game.command('brake',false);if(game.throttle<3)game.command('throttle-up');}
   else if(v.velocity>14.7&&game.throttle>0)game.command('throttle-down');
 }
 game.stepTicks(1);
}
assert.equal(game.phase,'summary');assert.equal(game.stats.stops,9);assert.equal(game.stats.missed,0);assert.equal(game.stats.pickedUp,game.stats.delivered-4);const packet=game.replayPacket();assert.equal(replay(packet).signature(),game.signature());
const paused=new Session({line:'kcr1'});paused.command('start');paused.stepTicks(30);paused.command('pause',true);const snap=paused.view();paused.advance(2);assert.equal(paused.view().timetable.minutes,snap.timetable.minutes);
const legacy=new Session({seed:'old',routeCount:6});assert.equal(legacy.route.length,6);assert.equal(legacy.view().timetable,null);legacy.command('start');legacy.command('throttle-up');legacy.stepTicks(200);assert.equal(replay(legacy.replayPacket()).signature(),legacy.signature());
const late=new Session({line:'kcr1'});late.command('start');late.stepTicks(3000);assert.ok(late.view().timetable.lateMinutes>=2);late.command('finish');assert.equal(late.phase,'summary');
console.log(JSON.stringify({pass:true,realPlaySeconds:game.elapsed,gameClock:game.view().timetable.clock,stops:game.stats.stops,missed:game.stats.missed,arrivals,replay:true,legacy:true,earlyFinish:true},null,2));
