import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {Session,replay} from '../session.mjs';
import {encodeGame,decodeGame,decodeGameFile,pinnedDependencies,appearanceRecipe,verifyDependencyBytes,MAX_FILE_BYTES} from '../native-a4/game-save.mjs';
import {decodeEnvelope,encodeEnvelope,formatInfo} from '../codec/sqlite-envelope.mjs';
const root=new URL('../',import.meta.url),dependencyBytes=Object.fromEntries(await Promise.all(pinnedDependencies().map(async d=>[d.id,new Uint8Array(await fs.readFile(new URL(d.path,root)))]))),options={dependencyBytes};
const make=()=>{const s=new Session({line:'legacy',seed:'NATIVE-SQLITE-QA'});s.command('start');s.command('throttle-up');s.stepTicks(240);s.command('throttle-up');s.stepTicks(120);return s;};
let sample;
test('actual running game saves as a real independently readable SQLite .KaoPu and restores full physical replay',async()=>{
 const s=make();sample=await encodeGame(s,options);assert.equal(new TextDecoder().decode(sample.subarray(0,16)),'SQLite format 3\0');assert.equal(sample.length,MAX_FILE_BYTES);
 const restored=await decodeGame(sample,options);assert.deepEqual(restored.packet,s.replayPacket());assert.equal(restored.session.signature(),s.signature());assert.deepEqual(restored.session.view().physics,s.view().physics);assert.deepEqual(restored.appearance,appearanceRecipe());
 const file='/tmp/FH88_Actual_Game_Save.KaoPu';await fs.writeFile(file,sample);
 const result=JSON.parse(execFileSync('python',['-c',`import sqlite3,json,hashlib\np='${file}'\nc=sqlite3.connect('file:'+p+'?mode=ro',uri=True)\nrole,mime,sha,data=c.execute('select * from assets').fetchone()\nm=json.loads(data)\nprint(json.dumps({'integrity':c.execute('pragma integrity_check').fetchone()[0],'profile':dict(c.execute('select * from header'))['profile'],'role':role,'digest':hashlib.sha256(data).hexdigest()==sha,'restoreMode':m['restoreMode'],'packetTicks':m['packet']['ticks'],'records':c.execute('select count(*) from records').fetchone()[0]}))`],{encoding:'utf8'}));
 assert.equal(result.integrity,'ok');assert.equal(result.profile,formatInfo.profile);assert.equal(result.digest,true);assert.equal(result.role,'game_session_manifest');assert.equal(result.restoreMode,'verified-session-replay');assert.equal(result.packetTicks,s.tick);assert.equal(result.records,3);
});
test('paused save retains every thermal/kinematic value and resumes identically',async()=>{
 const s=make();s.command('pause',true);const decoded=await decodeGame(await encodeGame(s,options),options);assert.equal(decoded.session.paused,true);assert.deepEqual(decoded.session.view().physics,s.view().physics);
 for(const game of [s,decoded.session]){game.command('pause',false);game.command('brake',true);game.stepTicks(150);}assert.equal(decoded.session.signature(),s.signature());assert.deepEqual(decoded.session.view().physics,s.view().physics);
});
test('station passenger progress and door state are reconstructed, not a hot-start reset',async()=>{
 const s=new Session({line:'kcr1',seed:'DOORS-SQLITE'});s.command('start');s.stepTicks(30);s.command('station-action');s.stepTicks(90);assert.notEqual(s.phase,'running');
 const decoded=await decodeGame(await encodeGame(s,options),options);assert.equal(decoded.session.phase,s.phase);assert.equal(decoded.session.door,s.door);assert.deepEqual(decoded.session.actors,s.actors);assert.deepEqual(decoded.session.view().physics,s.view().physics);
});
test('encode captures before asynchronous dependency verification, so live motion cannot corrupt a save',async()=>{
 const s=make(),packet=s.replayPacket(),sig=s.signature(),operation=encodeGame(s,options);s.stepTicks(60);const decoded=await decodeGame(await operation,options);assert.deepEqual(decoded.packet,packet);assert.equal(decoded.session.signature(),sig);assert.notEqual(decoded.session.signature(),s.signature());
});
test('bad bytes, corrupt SQLite layout, bad payload digest and obsolete profiles reject without mutation',async()=>{
 const live=make(),before=live.signature(),bytes=await encodeGame(live,options);
 await assert.rejects(decodeGame(bytes.subarray(1),options),/SIZE/);const header=bytes.slice();header[0]^=1;await assert.rejects(decodeGame(header,options),/SIGNATURE/);const layout=bytes.slice();layout[200]^=1;await assert.rejects(decodeGame(layout,options),/CONTAINER/);const payload=bytes.slice();payload[payload.length-200]^=1;await assert.rejects(decodeGame(payload,options),/HASH|CONTAINER/);
 await assert.rejects(decodeGameFile({size:100,arrayBuffer:()=>{throw Error('must not allocate');}},options),/SIZE/);assert.equal(live.signature(),before);
});
test('rehashed wrong appearance, rules, replay controls and physical state are semantically rejected',async()=>{
 const bytes=await encodeGame(make(),options),manifest=await decodeEnvelope(bytes);
 for(const [mutate,pattern] of [[m=>{m.appearance.dimensions.driverDiameterM=1.9;},/APPEARANCE/],[m=>{m.dependencies[0].sha256='0'.repeat(64);},/RULE/],[m=>{m.packet.inputs[0].type='execute-code';},/INPUT/],[m=>{m.verification.physics.speedMps+=1;},/STATE_MISMATCH/],[m=>{m.packet.ticks=1e12;},/BUDGET/]]){
  const bad=structuredClone(manifest);mutate(bad);await assert.rejects(decodeGame(await encodeEnvelope(bad),options),pattern);
 }
});
test('actual available dependency bytes must match the embedded pinned hashes',async()=>{
 const bad={...dependencyBytes};bad['session.mjs']=new Uint8Array([1,2,3]);await assert.rejects(verifyDependencyBytes(bad),/RULE_HASH/);const missing={...dependencyBytes};delete missing['session.mjs'];await assert.rejects(verifyDependencyBytes(missing),/MISSING_GAME_RULE/);
});
test('the entire nine-station actual input log fits the SQLite profile and continues from the same endpoint',async()=>{
 const game=new Session({line:'kcr1',seed:'SAVE-WHOLE-ROUTE'});game.command('start');for(let i=0;i<90000&&game.phase!=='summary';i++){
  const v=game.view();if(v.station.canOpen&&!game.serviceLocked())game.command('station-action');else if(game.phase==='ready-depart'){if(v.timetable.dwellRemaining<=0)game.command('station-action');}else if(!game.serviceLocked()){
   const remaining=v.station.remaining,stop=v.brakingDistance+1.1;if(remaining<=stop&&v.velocity>.08)game.command('brake',true);else if(v.velocity<.3&&remaining<=6&&remaining>=-6)game.command('brake',true);else if(v.velocity<14&&remaining>stop){if(game.brake)game.command('brake',false);if(game.throttle<3)game.command('throttle-up');}else if(v.velocity>14.7&&game.throttle>0)game.command('throttle-down');}
  game.stepTicks(1);
 }
 assert.equal(game.stats.stops,9);assert.equal(game.stats.missed,0);const bytes=await encodeGame(game,options),decoded=await decodeGame(bytes,options);assert.equal(decoded.session.signature(),game.signature());assert.deepEqual(decoded.session.view().physics,game.view().physics);
});

test('unlogged fixture placement is rejected before export instead of producing an unloadable file',async()=>{
 const s=make();s.distance+=12;await assert.rejects(encodeGame(s,options),/STATE_MISMATCH/);
});

test('actual game and native Musa SQLite profiles reject one another rather than loading a renamed container',async()=>{
 const plant=await import('../plants/native-codec/codec.mjs');
 const plantBytes=await plant.encode(plant.createPlantRecipe()),gameBytes=await encodeGame(make(),options);
 assert.equal(new TextDecoder().decode(plantBytes.subarray(0,16)),'SQLite format 3\0');
 await assert.rejects(decodeGame(plantBytes,options));
 await assert.rejects(plant.decode(gameBytes));
});
