import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {STEAM_SPEC} from '../steam-model.mjs';
import {Session} from '../session.mjs';
import {brakeEffort} from '../brake-effort.mjs';
import {createBrakeEffects,brakeDemand,brakeEffectIntensity,BRAKE_EMITTERS,BRAKE_EFFECTS_SPEC} from '../brake-effects.mjs';

const near=(a,b,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const frame=(tick,velocity=10,extra={})=>({tick,elapsed:tick/30,distance:tick*velocity/30,velocity,throttle:0,brake:false,started:true,paused:false,phase:'running',station:{wet:false},seed:'brake-test',...extra});
function braking(effect,{start=0,ticks=45,speed=12,throttle=0,brake=true,wet=false,matrix=null}={}){
  const deceleration=brakeDemand(frame(start,speed,{brake,throttle,station:{wet}}));
  let distance=0;
  effect.update(frame(start,speed,{distance,brake,throttle,station:{wet}}),{emitters:matrix});
  for(let i=1;i<=ticks;i++){
    const velocity=Math.max(0,speed-deceleration*i/30);distance+=velocity/30;
    effect.update(frame(start+i,velocity,{distance,brake,throttle,station:{wet}}),{emitters:matrix});
  }
  return{effect,distance,velocity:Math.max(0,speed-deceleration*ticks/30),tick:start+ticks};
}
const snapshot=effect=>structuredClone({state:effect.state,proof:effect.proof,slots:effect.slots,lights:effect.root.children.filter(child=>child.isLight).map(light=>({position:light.position.toArray(),intensity:light.intensity}))});

test('Demand agrees with Session rates and stronger measured braking produces stronger bounded effects',()=>{
  const hard=frame(0,10,{brake:true}),wet={...hard,station:{wet:true}},mild=frame(0,10,{throttle:-1}),strong=frame(0,10,{throttle:-2});
  near(brakeDemand(hard),3.1);near(brakeDemand(wet),2.4);near(brakeDemand(mild),.6);near(brakeDemand(strong),1.2);
  assert.equal(brakeDemand({...mild,reverse:true}),0);assert.equal(brakeDemand({...hard,phase:'boarding'}),0);
  assert.equal(brakeDemand(frame(0,10,{throttle:0})),0);
  near(brakeEffectIntensity(hard,3.1),1);near(brakeEffectIntensity(wet,2.4),2.4/3.1);
  assert.ok(brakeEffectIntensity(mild,.6)<brakeEffectIntensity(strong,1.2));
  assert.ok(brakeEffectIntensity(strong,1.2)<brakeEffectIntensity(hard,3.1));
  assert.equal(brakeEffectIntensity(hard,0),0);assert.equal(brakeEffectIntensity({...hard,velocity:0},3.1),0);
  assert.ok(brakeEffectIntensity({...hard,velocity:1},3.1)<brakeEffectIntensity(hard,3.1)/10);
  for(const view of[hard,wet,mild,strong])near(brakeEffort(view).deceleration,brakeDemand(view));
  const light=createBrakeEffects(),heavy=createBrakeEffects();braking(light,{brake:false,throttle:-1});braking(heavy);
  assert.ok(light.proof.emitted.sparks>0);assert.ok(heavy.proof.emitted.sparks>light.proof.emitted.sparks*3);
  assert.ok(heavy.proof.emitted.haze>light.proof.emitted.haze);
});

test('Actual Session mild braking and emergency brake produce effects; rolling drag and parked brake produce none',()=>{
  for(const mode of['drag','park','mild','hard']){
    const game=new Session({seed:280,routeCount:6}),effect=createBrakeEffects();game.command('start');game.velocity=mode==='park'?0:12;game.throttle=mode==='mild'?-1:0;game.brake=mode==='hard'||mode==='park';
    effect.update(game.view());
    for(let tick=0;tick<60;tick++){game.step();effect.update(game.view());}
    if(mode==='mild'||mode==='hard')assert.ok(effect.proof.emitted.sparks>0,mode);
    else{assert.equal(effect.proof.emitted.sparks,0,mode);assert.equal(effect.proof.emitted.haze,0,mode);}
  }
  const frozenSpeed=createBrakeEffects();for(let tick=0;tick<120;tick++)frozenSpeed.update(frame(tick,10,{brake:true}));
  assert.equal(frozenSpeed.proof.emitted.sparks,0,'Brake input without actual deceleration cannot spark');
  const accelerating=createBrakeEffects();for(let tick=0;tick<120;tick++)accelerating.update(frame(tick,1+tick/30,{brake:true}));
  assert.equal(accelerating.proof.emitted.sparks,0);
});

test('All eight sources lie on the real driver tread along the fixed shoe direction, away from hubs',()=>{
  assert.equal(BRAKE_EMITTERS.length,8);
  const y=STEAM_SPEC.railHead+STEAM_SPEC.driverRadius;
  for(const source of BRAKE_EMITTERS){
    const axle=STEAM_SPEC.driverAxles[source.axleIndex],dx=source.position[0]-axle,dy=source.position[1]-y;
    near(Math.hypot(dx,dy),STEAM_SPEC.driverRadius);near(dx/dy,.39/(.89-y));
    assert.deepEqual(source.shoe,[axle+.39,.89,source.side*.84]);near(source.position[2],source.side*.972);
    assert.ok(source.position[1]>STEAM_SPEC.railHead);assert.ok(Math.abs(dx)>.5);
    near(dx*source.tangent[0]+dy*source.tangent[1],0);
  }
});

test('World transforms are applied once to every source; old births retain their historical anchor',()=>{
  const train=new THREE.Group();train.position.set(16,.2,-3);train.rotation.y=.65;train.updateMatrixWorld(true);
  const effect=createBrakeEffects();const run=braking(effect,{ticks:12,matrix:train.matrixWorld});
  for(let i=0;i<8;i++){
    const expected=new THREE.Vector3(...BRAKE_EMITTERS[i].position).applyMatrix4(train.matrixWorld);
    expected.toArray().forEach((value,axis)=>near(effect.proof.sourceOrigins[i][axis],value));
  }
  const born=effect.slots.filter(slot=>slot.active&&slot.kind==='spark').reduce((newest,slot)=>slot.id>newest.id?slot:newest),id=born.id,origin=born.birthPosition.slice();
  assert.deepEqual(origin,effect.proof.sourceOrigins[born.emitter]);
  train.position.x+=.3;train.updateMatrixWorld(true);
  effect.update(frame(run.tick+1,run.velocity-.1,{distance:run.distance+(run.velocity-.1)/30,brake:true}),{emitters:{matrixWorld:train.matrixWorld}});
  const old=effect.slots.find(slot=>slot.id===id);assert.ok(old.active);assert.deepEqual(old.birthPosition,origin);
  assert.notDeepEqual(effect.proof.sourceOrigins[old.emitter],origin);
});

test('Pause and duplicate render calls freeze slots, lights and emission credit; resumed state matches uninterrupted state',()=>{
  const paused=createBrakeEffects(),control=createBrakeEffects();const run=braking(paused);braking(control);
  const held=frame(run.tick,run.velocity,{distance:run.distance,brake:true}),before=snapshot(paused);
  for(let i=0;i<120;i++)paused.update({...held,paused:true});assert.deepEqual(snapshot(paused),before);
  for(let i=0;i<120;i++)paused.update(held);assert.deepEqual(snapshot(paused),before);
  const next=frame(run.tick+1,run.velocity-3.1/30,{distance:run.distance+(run.velocity-3.1/30)/30,brake:true});
  paused.update(next);control.update(next);assert.deepEqual(snapshot(paused),snapshot(control));
});

test('Zero speed immediately ends births and quickly clears friction haze and glow, with no parked loop',()=>{
  const effect=createBrakeEffects(),run=braking(effect,{ticks:30}),births={...effect.proof.emitted};
  let previousLight=Infinity,previousOpacity=Infinity;
  for(let i=1;i<=90;i++){
    effect.update(frame(run.tick+i,0,{distance:run.distance,brake:true,throttle:-2}));
    assert.deepEqual(effect.proof.emitted,births);assert.equal(effect.state.intensity,0);
    const light=effect.root.children.filter(child=>child.isLight).reduce((n,entry)=>n+entry.intensity,0),opacity=effect.slots.reduce((n,p)=>n+(p.active?p.opacity:0),0);
    assert.ok(light<=previousLight);assert.ok(opacity<=previousOpacity);previousLight=light;previousOpacity=opacity;
    if(i>=18){assert.equal(effect.proof.activeSparks,0);assert.equal(effect.proof.activeHaze,0);assert.equal(light,0);}
  }
  assert.equal(effect.state.active,false);
});

test('Pools, GPU buffers, light count, size and opacity stay bounded through repeated use; main steam is separate',()=>{
  const effect=createBrakeEffects(),spec=BRAKE_EFFECTS_SPEC,identities=effect.slots.slice(),buffers=effect.root.children.filter(child=>child.isMesh).map(mesh=>mesh.geometry.attributes.particleCenter.array);
  let distance=0;
  for(let tick=0;tick<3600;tick++){
    const phase=tick%120,velocity=phase<90?14-phase*3.1/30:14;distance+=velocity/30;
    effect.update(frame(tick,velocity,{distance,brake:phase<90}));
    assert.ok(effect.proof.activeSparks<=spec.sparkCapacity);assert.ok(effect.proof.activeHaze<=spec.hazeCapacity);
    for(const slot of effect.slots){assert.equal(slot,identities[slot.index]);assert.ok(slot.opacity<= (slot.kind==='haze'?spec.maxHazeOpacity:1));assert.ok(slot.length<=spec.maxSparkLength);assert.ok(slot.width<=spec.maxSparkWidth);assert.ok(slot.size<=spec.maxHazeSize);assert.ok(slot.position.every(Number.isFinite));}
  }
  assert.equal(effect.slots.length,68);assert.equal(effect.root.children.length,4);assert.equal(effect.proof.lightCount,2);assert.equal(effect.proof.steamSlotsUsed,0);assert.equal(effect.proof.liveSlotOverwrites,0);
  assert.ok(effect.proof.peakSparks>0&&effect.proof.peakHaze>0);
  effect.root.children.filter(child=>child.isMesh).forEach((mesh,index)=>{assert.equal(mesh.geometry.attributes.particleCenter.array,buffers[index]);assert.equal(mesh.castShadow,false);assert.equal(mesh.material.depthWrite,false);});
  for(const light of effect.root.children.filter(child=>child.isLight)){assert.equal(light.castShadow,false);assert.ok(light.intensity<=spec.maxLightIntensity);}
  assert.equal(createBrakeEffects({lights:false}).proof.lightCount,0);
});

test('Long gaps, reset, seed change and rewind never backfill sparks or leave old lights',()=>{
  const effect=createBrakeEffects(),run=braking(effect),births={...effect.proof.emitted};
  effect.update(frame(900,2,{distance:run.distance+100,brake:true}));assert.deepEqual(effect.proof.emitted,births);assert.equal(effect.proof.frameBirths,0);assert.equal(effect.proof.activeSparks,0);assert.equal(effect.proof.activeHaze,0);assert.equal(effect.proof.gapDrops,1);
  effect.update(frame(901,1.9,{distance:run.distance+100.063,brake:true}));assert.ok(effect.proof.frameBirths<=2);
  effect.reset();assert.equal(effect.proof.emitted.sparks,0);assert.equal(effect.proof.activeSparks,0);assert.equal(effect.state.active,false);
  effect.update(frame(3000,10,{brake:true}));assert.equal(effect.proof.frameBirths,0,'First restored snapshot is a baseline, not an emission backlog');
  braking(effect,{start:3001});effect.update(frame(0,0));assert.equal(effect.proof.resetReason,'time-rewound');assert.equal(effect.proof.emitted.sparks,0);
  braking(effect);effect.update(frame(100,10,{seed:'another-session',brake:true}));assert.equal(effect.proof.resetReason,'session-changed');assert.equal(effect.proof.emitted.sparks,0);assert.equal(effect.state.active,false);
});

test('Deterministic braking snapshots match without dependence on camera or extra paused renders',()=>{
  const a=createBrakeEffects(),b=createBrakeEffects();braking(a,{ticks:75});braking(b,{ticks:75});assert.deepEqual(snapshot(a),snapshot(b));
  const tickOnly=createBrakeEffects();let distance=0;
  for(let tick=0;tick<=75;tick++){const velocity=12-3.1*tick/30;if(tick)distance+=velocity/30;const view=frame(tick,velocity,{distance,brake:true});delete view.elapsed;tickOnly.update(view);}
  assert.deepEqual(snapshot(a),snapshot(tickOnly));
});
