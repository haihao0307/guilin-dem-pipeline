// No fixtures or mock Session/Three classes: these imports are the existing production files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Session,FRONT_X,TICK_HZ} from '../../../voxel-train-study/game/session.mjs';
import {createSteamLocomotive,STEAM_SPEC} from '../../../voxel-train-study/game/steam-model.mjs';
import * as THREE from '../../../voxel-train-study/vendor/three.module.js';
import {attachAssembly,restoreAssembly,legacySteamWheelHandles} from '../session-bridge.mjs';
import {legacyPoint,objectMatrix,wheelKinematics} from '../adapter.mjs';
const sensor={powered:true,roadClear:true,request:true,occupied:false,reset:false};
function start(){const s=new Session({line:'kcr1',seed:'assembly-r01'});s.command('start');s.command('throttle-up');return s;}
const near=(a,b,e=1e-6)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
test('real Session advances all 30-Hz ticks, with unchanged gameplay signature',()=>{
  assert.equal(TICK_HZ,30);assert.equal(FRONT_X,5);
  const a=start(),b=start(),bridge=attachAssembly(a,{readSensors:()=>sensor});
  for(let i=0;i<4;i++){a.advance(1.5);b.advance(1.5);}assert.equal(a.tick,180);
  assert.equal(a.signature(),b.signature());assert.equal(bridge.channel.state.phase,'CLOSED');
  assert.equal(bridge.snapshot().authorityInterlockInstalled,false);
  assert.equal(bridge.snapshot().frame.worldTime,6);bridge.dispose();
});
test('coarse render frames vs fine frames consume identical detector tick history',()=>{
  const a=start(),b=start(),sensorAt=t=>({...sensor,occupied:t>=200&&t<250,request:t<250});
  const x=attachAssembly(a,{readSensors:sensorAt}),y=attachAssembly(b,{readSensors:sensorAt});
  for(let i=0;i<10;i++)a.advance(1.5);for(let i=0;i<150;i++)b.advance(.1);
  assert.equal(a.signature(),b.signature());assert.deepEqual(x.channel.save(),y.channel.save());x.dispose();y.dispose();
});
test('pause and repeated snapshot reads do not advance shared time',()=>{
  const s=start(),b=attachAssembly(s,{readSensors:()=>sensor});s.advance(1);s.command('pause',true);
  const old=b.save();s.advance(1.5);b.snapshot();b.snapshot();assert.deepEqual(b.save(),old);
  s.command('pause',false);s.advance(1/30);assert.equal(b.channel.tick,31);b.dispose();
});
test('all real train-local and world actor positions map without changing Session arrays',()=>{
  const s=start();s.advance(1.5);const before=JSON.stringify(s.actors),b=attachAssembly(new Session());b.dispose();
  for(const actor of s.actors){const local=legacyPoint(actor.position,{frame:actor.frame,distance:s.distance,frontX:FRONT_X});
    const world=actor.frame==='train'?s.toWorld(actor.position):actor.position;
    near(local[0],-world[2]);near(local[1],world[1]);near(local[2],world[0]);}
  assert.equal(JSON.stringify(s.actors),before);
});
test('save/restore reuses existing replay plus validated detector history',()=>{
  const a=start(),x=attachAssembly(a,{readSensors:()=>sensor});a.advance(1.5);a.command('brake',true);a.advance(1.5);
  const p=JSON.parse(JSON.stringify(x.save())),y=restoreAssembly(p,{readSensors:()=>sensor});
  assert.equal(a.signature(),y.session.signature());assert.deepEqual(x.channel.save(),y.channel.save());
  a.advance(.5);y.session.advance(.5);assert.equal(a.signature(),y.session.signature());assert.deepEqual(x.channel.save(),y.channel.save());
  const inspect=restoreAssembly(p);assert(inspect.inspectionOnly);assert(!inspect.snapshot().crossing.railProceed);
  const bad=JSON.parse(JSON.stringify(p));bad.crossing.state.phase='CLOSED';bad.crossing.state.gate=1;bad.crossing.state.elapsed=0;
  assert.throws(()=>restoreAssembly(bad,{readSensors:()=>sensor}),/history/);x.dispose();y.dispose();
});
test('binding is reversible and refuses duplicate, late and detector-invalid attachment',()=>{
  const s=start(),original=s.step,b=attachAssembly(s);assert.throws(()=>attachAssembly(s),/already/);
  s.advance(.1);assert.equal(b.snapshot().crossing.roadProceed,false);b.dispose();assert.equal(s.step,original);
  assert.throws(()=>attachAssembly(s),/late/);
  const q=start();assert.throws(()=>attachAssembly(q,{readSensors:()=>({})}),/boolean/);assert.equal(q.tick,0);
});
test('actual WD instanced-wheel hubs attach to real root under parent transforms',()=>{
  const steam=createSteamLocomotive(),parent=new THREE.Group();parent.position.set(3,2,-4);parent.rotation.y=.4;parent.add(steam.root);
  const handles=legacySteamWheelHandles(steam);assert.equal(handles.length,18);assert.equal(handles.filter(h=>h.kind==='driver').length,8);
  const s=start(),b=attachAssembly(s);
  for(let i=0;i<3;i++){s.advance(1);steam.update(s.distance);for(const h of handles){const report=b.joint(h.rotating,h.support,h.rule);
    assert(report.anchorAndAxisValid,JSON.stringify({id:h.id,report}));assert.equal(report.physicsSolved,false);}}
  const h=handles[0];assert(!b.joint(h.rotating,h.support,{...h.rule,anchorB:[h.rule.anchorB[0]+.1,...h.rule.anchorB.slice(1)]}).anchorAndAxisValid);
  assert.throws(()=>objectMatrix({object:h.rotating.object},s.view(),{frontX:FRONT_X}),/instanceIndex/);b.dispose();
});
test('actual current crank pins match adapter coordinates and phases; no model renaming',()=>{
  const steam=createSteamLocomotive();assert.equal(STEAM_SPEC.driverRadius,.61);
  for(const distance of [0,.2,4,20]){steam.update(distance);for(const [j,sign] of [-1,1].entries()){
    const k=wheelKinematics({distance,radius:STEAM_SPEC.driverRadius,phase:sign<0?Math.PI/2:0,rotationSign:-1,crankRadius:STEAM_SPEC.driverRadius*.43,rodLength:2.6});
    const p=legacyPoint(steam.motion.crankPins[j][0],{frame:'train',distance,frontX:FRONT_X});
    near(p[1],STEAM_SPEC.railHead+STEAM_SPEC.driverRadius+k.pin[1]);near(p[2],STEAM_SPEC.driverAxles[0]+distance-FRONT_X+k.pin[2]);
  }}
  assert(legacySteamWheelHandles(steam).every(h=>h.sourceModel==='legacy-wd-inspired-2-8-0'));
  assert.throws(()=>legacySteamWheelHandles({proof:{wheelArrangement:'4-6-2'},wheels:[]}),/not Scotsman/);
});
