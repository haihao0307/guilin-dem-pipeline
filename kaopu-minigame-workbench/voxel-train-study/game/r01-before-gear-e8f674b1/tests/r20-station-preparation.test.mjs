import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../../../vendor/three.module.js';
import {createGameWorld,createStationModel,WORLD} from '../world.mjs';
import {createStationStreaming,STATION_PREPARATION_METRES,STATION_MAX_CONTINUOUS_STEP} from '../station-streaming.mjs';
import {PLATFORM_LAYOUT} from '../metre-scale.mjs';
import {FLAT_WORLD} from '../flat-terrain.mjs';
import {Session,DT} from '../session.mjs';
import {kcrRoute} from '../timetable.mjs';

// Actual Three geometry and all actual procedural texture drawing commands.
// This is CPU equivalence evidence; canvas rasterization/GPU timing is measured
// separately in the browser, never inferred from this deterministic canvas spy.
globalThis.document={createElement:()=>{
  const hash=createHash('sha256'),canvas={width:0,height:0},ctx={};
  for(const name of ['fillRect','fillText'])ctx[name]=(...args)=>hash.update(JSON.stringify([name,ctx.fillStyle,ctx.font,ctx.textAlign,ctx.textBaseline,...args]));
  canvas.getContext=()=>ctx;canvas.paintHash=()=>hash.copy().digest('hex');return canvas;
}};
const route=kcrRoute(123),minOffset=WORLD.centerX-FLAT_WORLD.terrainRadius-5,maxOffset=WORLD.centerX+FLAT_WORLD.terrainRadius-PLATFORM_LAYOUT.minX;
const entry=route[1].target-maxOffset,prep=entry-STATION_PREPARATION_METRES,exit=route[0].target-minOffset;
const isVisible=offset=>!(offset+5<WORLD.centerX-FLAT_WORLD.terrainRadius||offset+PLATFORM_LAYOUT.minX>WORLD.centerX+FLAT_WORLD.terrainRadius);
function view(distance,velocity=14){return{distance,velocity,tick:500,elapsed:12,started:true,phase:'running',throttle:2,brake:false,door:0,station:{...route[1],canOpen:false},timetable:{minutes:407.25},nearbyStations:[],actors:[],rocks:[],events:[]};}
function meshHash(model){
  const hash=createHash('sha256');model.group.updateMatrixWorld(true);
  const json=value=>hash.update(JSON.stringify(value));
  model.group.traverse(object=>{
    json([object.type,object.name,object.position.toArray(),object.quaternion.toArray(),object.scale.toArray(),object.visible,object.castShadow,object.receiveShadow,object.matrixWorld.elements]);
    if(object.geometry){for(const [name,attribute] of Object.entries({...object.geometry.attributes,index:object.geometry.index})){if(!attribute)continue;json([name,attribute.itemSize,attribute.count,attribute.normalized,attribute.array.constructor.name]);hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));}json([object.geometry.groups,object.geometry.drawRange]);}
    for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
      json(Object.fromEntries(Object.entries(material).filter(([name,value])=>name!=='uuid'&&['string','number','boolean'].includes(typeof value))));
      for(const [name,value] of Object.entries(material)){if(value?.isColor)json([name,value.toArray()]);if(value?.isTexture)json([name,value.image.width,value.image.height,value.image.paintHash?.(),value.colorSpace,value.wrapS,value.wrapT,value.flipY,value.anisotropy,value.repeat.toArray(),value.offset.toArray()]);}
    }
  });return hash.digest('hex');
}
function trackModel(plan,records){
  const model=createStationModel(plan),resources=new Set(),disposals=new Map();
  model.group.traverse(object=>{if(object.geometry)resources.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});
  for(const resource of resources){disposals.set(resource,0);resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1));}
  const record={index:plan.index,model,resources,disposals,updates:0,disposed:0},update=model.update,dispose=model.dispose;
  model.update=(...args)=>{record.updates++;return update(...args);};model.dispose=()=>{record.disposed++;dispose();};records.push(record);return model;
}
function harness(options={}){const root=new THREE.Group(),records=[],stream=createStationStreaming({root,createModel:plan=>trackModel(plan,records),minOffset,maxOffset,isVisible,...options});return{root,records,...stream};}
// Independently retain the former world.mjs attach/build/update/detach loop.
function baseline(){const root=new THREE.Group(),stations=new Map(),records=[];return{root,stations,records,update(v,r){const visible=new Set(),nearby=new Map(v.nearbyStations.map(plan=>[plan.index,plan]));for(const source of r){const offset=source.target-v.distance;if(offset+5<WORLD.centerX-FLAT_WORLD.terrainRadius||offset+PLATFORM_LAYOUT.minX>WORLD.centerX+FLAT_WORLD.terrainRadius)continue;const plan=nearby.get(source.index)||source;visible.add(plan.index);if(!stations.has(plan.index))stations.set(plan.index,trackModel(plan,records));const model=stations.get(plan.index);if(!model.group.parent)root.add(model.group);model.update(v,plan);}for(const [id,model] of stations)if(!visible.has(id)){root.remove(model.group);model.dispose();stations.delete(id);}},dispose(){for(const model of stations.values()){root.remove(model.group);model.dispose();}stations.clear();}};}
function equalVisible(a,b){assert.deepEqual([...a.stations.keys()],[...b.stations.keys()]);for(const [id,model] of a.stations)assert.equal(meshHash(model),meshHash(b.stations.get(id)),`Exact geometry/material/texture-command/transform equivalence at station ${id}`);}
function released(records){for(const record of records){assert.equal(record.disposed,1);assert.equal(record.model.group.parent,null);for(const count of record.disposals.values())assert.equal(count,1,'Every owned geometry, texture and material disposed once');}}

test('70 m CPU preparation changes no original attach boundary, geometry, crew update or texture commands',()=>{
  const a=harness(),b=baseline();try{
    for(const distance of [prep-1,prep,prep+1,...[30,60].map(x=>prep+x),entry-1,entry,entry+1]){
      const v=view(distance);a.update(v,route);b.update(v,route);equalVisible(a,b);const p=a.snapshot();assert(p.pendingCount<=1);
      if(distance<prep){assert.equal(p.buildCount,0);assert.equal(p.pendingCount,0);}
      if(distance>=prep&&distance<entry){assert.equal(p.pendingId,1);assert.equal(p.pendingPrepareDistance,prep);assert.equal(p.pendingCount,1);assert(p.pendingCpuBytes>8e6);assert.equal(p.cpuTextureSourceBytesEstimate,4096*512*4);assert.equal(a.records[0].model.group.parent,null);assert.equal(a.records[0].model.group.visible,false);assert.equal(a.records[0].updates,0);assert(!a.root.children.includes(a.records[0].model.group));}
      if(distance===prep)assert.equal(p.lastUpdatePreparationCount,1);
      if(distance===entry){assert.equal(p.lastUpdatePreparationCount,0);assert.equal(p.lastUpdateBuildCount,0);assert.equal(p.lastUpdateReuseCount,1);assert.equal(p.reuseCount,1);assert.equal(p.pendingId,null);assert.equal(p.pendingCpuBytes,0);assert.equal(p.liveCount,1);}
    }
    assert.equal(a.snapshot().buildCount,1);assert.equal(b.records.length,1);assert.equal(a.snapshot().events.find(e=>e.type==='prepare').distance,prep);
  }finally{a.dispose();b.dispose();}released(a.records);released(b.records);
});

test('real-geometry 0→700→0 full sweep matches the unprefetched loop and its three builds, including reverse boundaries',()=>{
  const a=harness(),b=baseline(),forward=[...Array.from({length:71},(_,i)=>i*10),prep-1,prep,prep+1,entry-1,entry,entry+1,exit-1,exit,exit+1].sort((x,y)=>x-y),back=[...forward].reverse();let frameCount=0,preparations=0;
  try{for(const [direction,distances] of [[1,forward],[-1,back]])for(const distance of distances){const v=view(distance,direction*14);a.update(v,route);b.update(v,route);equalVisible(a,b);const p=a.snapshot();assert(p.pendingCount<=1);assert(p.liveCount<=1);assert.equal(p.buildCount-p.disposeCount,p.liveCount+p.pendingCount);assert.equal(p.cpuSourceBytes,p.liveCpuBytes+p.pendingCpuBytes);preparations+=p.lastUpdatePreparationCount;frameCount++;}
    const p=a.snapshot();assert.equal(p.buildCount,b.records.length);assert.equal(p.buildCount,3);assert.equal(p.preparationCount,2);assert.equal(preparations,2);assert.equal(p.reuseCount,2);assert.equal(p.pendingDisposeCount,0);assert.equal(p.pendingId,null);assert.equal(p.liveCount,1);assert(p.peakPendingCpuBytes>8e6);console.log({stationPreparationSweep:{frameCount,builds:p.buildCount,preparations,reuses:p.reuseCount,peakCpuBytes:p.peakCpuSourceBytes}});
  }finally{a.dispose();b.dispose();}released(a.records);released(b.records);assert.equal(a.snapshot().cpuSourceBytes,0);assert.equal(a.snapshot().pendingCount,0);assert.equal(a.snapshot().liveCount,0);
});

test('ordinary, maximum Session speed and maximum two-second update steps all prepare before attachment',()=>{
  assert.equal(STATION_MAX_CONTINUOUS_STEP,36);
  for(const [speed,seconds] of [[14,1/30],[18,1/30],[18,2],[-1.8,1/30]]){
    const a=harness(),b=baseline(),reverse=speed<0,start=reverse?exit+100:prep-20,step=speed*seconds,end=reverse?exit-5:entry+Math.abs(step)+5;let last=null,prepared=null,reused=null;
    try{for(let distance=start;reverse?distance>=end:distance<=end;distance+=step){const v=view(distance,speed);a.update(v,route);b.update(v,route);const p=a.snapshot();if(p.lastUpdatePreparationCount)prepared=distance;if(p.lastUpdateReuseCount)reused=distance;assert.equal(p.lastUpdatePreparationCount<=1,true);assert.equal(p.pendingCount<=1,true);if(last!==p.liveCount){equalVisible(a,b);last=p.liveCount;}}
      const p=a.snapshot();assert.notEqual(prepared,null);assert.notEqual(reused,null);assert(reverse?prepared>reused:prepared<reused);assert.equal(p.buildCount,b.records.length);assert.equal(p.buildCount,1);assert.equal(p.reuseCount,1);assert.equal(p.pendingDisposeCount,0);
    }finally{a.dispose();b.dispose();}released(a.records);released(b.records);
  }
});

test('aborted preparation is bounded and honestly counted; repeated updates and reverse dithering do not rebuild',()=>{
  const a=harness();try{
    for(const distance of [prep-1,prep,prep+1,prep+2,prep+1,prep,prep,prep])a.update(view(distance),route);
    assert.equal(a.snapshot().buildCount,1);assert.equal(a.snapshot().pendingCount,1);assert.equal(a.snapshot().liveCount,0);assert.equal(a.records[0].updates,0);
    a.update(view(prep-1,-1.8),route);assert.equal(a.snapshot().pendingCount,0);assert.equal(a.snapshot().pendingDisposeCount,1);assert.equal(a.snapshot().cpuSourceBytes,0);assert.equal(a.snapshot().events.at(-1).reason,'left-preparation-window');
    for(let i=0;i<20;i++)a.update(view(prep-1-i/10,-1.8),route);assert.equal(a.snapshot().buildCount,1);
  }finally{a.dispose();}released(a.records);
});

test('jump, reset, route replacement and in-place radius invalidation release prepared CPU sources exactly once',()=>{
  for(const reason of ['jump','reset','route-change','radius']){
    const a=harness(),r=route.map(p=>({...p}));try{a.update(view(prep),r);assert.equal(a.snapshot().pendingCount,1);const old=a.records[0];
      if(reason==='jump')a.update(view(700),r);
      else if(reason==='reset')a.reset();
      else if(reason==='route-change')a.update(view(prep),r.map(p=>({...p})));
      else{r[1].radius=3.4;a.update(view(prep),r);}
      assert.equal(old.disposed,1);assert.equal(a.snapshot().pendingCount,0);assert.equal(a.snapshot().pendingDisposeCount,1);assert.equal(a.snapshot().pendingCpuBytes,0);assert.equal(a.snapshot().events.find(e=>e.type==='dispose').reason,reason==='radius'?'route-change':reason);
      if(reason==='jump'){assert.equal(a.snapshot().buildCount,2);assert.equal(a.snapshot().reuseCount,0);assert.equal(a.snapshot().liveCount,1);}
      else if(reason==='radius'){a.update(view(prep+1),r);assert.equal(a.snapshot().buildCount,2);assert.equal(a.snapshot().pendingCount,1);assert.equal(a.snapshot().pendingId,1);}
    }finally{a.dispose();a.dispose();}released(a.records);
  }
});

test('nearby plan radius changes invalidate a prepared model before reuse rather than change the stop zone',()=>{
  const a=harness(),b=baseline();try{a.update(view(prep),route);for(let d=prep+20;d<entry;d+=20)a.update(view(d),route);const v=view(entry);v.nearbyStations=[{...route[1],radius:4.5,missed:true}];a.update(v,route);b.update(v,route);equalVisible(a,b);assert.equal(a.snapshot().reuseCount,0);assert.equal(a.snapshot().pendingDisposeCount,1);assert.equal(a.snapshot().events.find(e=>e.type==='dispose').reason,'plan-change');assert.equal(a.snapshot().buildCount,2);
  }finally{a.dispose();b.dispose();}released(a.records);released(b.records);
});

test('dense routes still own at most one pending model and dispose every live/prepared instance on teardown',()=>{
  const a=harness(),r=[...route.slice(0,4)].map((plan,index)=>({...plan,target:700+index*12}));try{
    for(let distance=prep-1;distance<=entry+50;distance+=1){a.update(view(distance),r);const p=a.snapshot();assert(p.pendingCount<=1);assert(p.lastUpdatePreparationCount<=1);assert.equal(p.buildCount-p.disposeCount,p.liveCount+p.pendingCount);}
    assert(a.snapshot().liveCount>=3);
  }finally{a.dispose();}released(a.records);assert.equal(a.snapshot().cpuSourceBytes,0);assert.equal(a.snapshot().buildCount,a.snapshot().disposeCount);assert.equal(a.root.children.length,0);
});

test('all nine stations, 0→6000→0, retain the baseline 17 builds instead of caching the route at startup',()=>{
  const a=harness(),b=baseline();let maxPending=0,maxLive=0,lastIds='';
  try{for(const [direction,start,end] of [[1,0,6000],[-1,6000,0]])for(let distance=start;direction>0?distance<=end:distance>=end;distance+=direction*10){
    const v=view(distance,direction*14);a.update(v,route);b.update(v,route);const p=a.snapshot(),ids=[...a.stations.keys()].join(',');
    if(distance===0&&direction===1){assert.equal(p.buildCount,1);assert.equal(p.pendingCount,0);}
    assert.equal(p.buildCount-p.disposeCount,p.liveCount+p.pendingCount);assert(p.pendingCount<=1);maxPending=Math.max(maxPending,p.pendingCount);maxLive=Math.max(maxLive,p.liveCount);
    assert.deepEqual([...a.stations.keys()],[...b.stations.keys()]);if(ids!==lastIds){equalVisible(a,b);lastIds=ids;}
  }
    const p=a.snapshot();assert.equal(p.buildCount,17);assert.equal(p.buildCount,b.records.length);assert.equal(p.preparationCount,16);assert.equal(p.reuseCount,16);assert.equal(p.pendingDisposeCount,0);assert.equal(maxPending,1);assert(maxLive<=2);console.log({stationPreparationWholeRoute:{builds:p.buildCount,preparations:p.preparationCount,reuses:p.reuseCount,maxPending,maxLive,peakCpuBytes:p.peakCpuSourceBytes}});
  }finally{a.dispose();b.dispose();}released(a.records);released(b.records);assert.equal(a.snapshot().cpuSourceBytes,0);
});

test('actual Session max-throttle stepping retains identical signature, actors and complete events',()=>{
  const a=harness(),game=new Session({line:'kcr1',seed:'actual-station-stream'}),control=new Session({line:'kcr1',seed:'actual-station-stream'});
  for(const session of [game,control]){session.command('start');for(let i=0;i<3;i++)session.command('throttle-up');}
  let maximum=0,preparations=0,governorTicks=0;
  try{for(let i=0;i<3000&&game.distance<=700;i++){
    const beforeSpeed=game.velocity;game.stepTicks(1);control.stepTicks(1);if(beforeSpeed>18){governorTicks++;assert.equal(game.physics.controls.throttle,0);assert(game.physics.controls.brake>0);}
    const signature=game.signature(),events=JSON.stringify(game.events);a.update(game.view(),game.route);maximum=Math.max(maximum,game.velocity);preparations+=a.snapshot().lastUpdatePreparationCount;
    assert.equal(game.signature(),signature);assert.equal(JSON.stringify(game.events),events);assert.equal(game.signature(),control.signature());assert.deepEqual(game.events,control.events);
  }
    assert(game.distance>=700);const p=game.physics.p,oneHostTickAcceleration=p.rail.adhesionCoefficient*p.train.adhesiveMassKg*p.rail.gravityMps2/game.physics.effectiveMassKg*DT;assert(maximum>=18&&maximum<=18+oneHostTickAcceleration+1e-8);assert(governorTicks>0);assert.equal(preparations,1);assert.equal(a.snapshot().buildCount,2);assert.equal(a.snapshot().reuseCount,1);
  }finally{a.dispose();}released(a.records);
});

test('world integration excludes pending stations from audio/proof, leaves Session untouched, and resets/disposes them',()=>{
  const world=createGameWorld({street:false}),game=new Session({line:'kcr1',seed:'prepare-contract'}),before=game.signature(),initialEvents=structuredClone(game.events),output=()=>Object.fromEntries(['wheelFront','wheelRear','cylinderLeft','cylinderRight','whistle','guard','crowdFront','crowdRear'].map(name=>[name,[]]));
  try{
    const at0=game.view();world.update(at0,game.route);const initial=world.stationProof();assert.equal(initial.length,1);assert.equal(initial[0].index,0);assert.equal(world.stationPreparationProof().buildCount,1);
    for(let distance=20;distance<prep;distance+=20)world.update({...at0,distance,velocity:14},game.route);
    const v={...at0,distance:prep,velocity:14};world.update(v,game.route);const p=world.stationPreparationProof();assert.equal(p.pendingId,1);assert.equal(p.lastUpdatePreparationCount,1);assert.deepEqual(world.stationProof(),[]);
    const audio=world.fillAudioSources(output(),v);for(const name of ['guard','crowdFront','crowdRear'])assert.deepEqual(audio[name],[10000,0,0]);assert.equal(game.signature(),before);assert.equal(game.distance,0);assert.deepEqual(game.events,initialEvents);
    world.resetEffects();assert.equal(world.stationPreparationProof().pendingCount,0);assert.equal(world.stationPreparationProof().pendingDisposeCount,1);assert.equal(world.stationPreparationProof().cpuSourceBytes,0);
    world.update(v,game.route);assert.equal(world.stationPreparationProof().pendingCount,1);world.dispose();const disposed=world.stationPreparationProof();assert.equal(disposed.disposed,true);assert.equal(disposed.buildCount,disposed.disposeCount);assert.equal(disposed.cpuSourceBytes,0);assert.equal(world.root.children.length,0);world.update(v,game.route);assert.deepEqual(world.stationPreparationProof(),disposed);world.dispose();assert.deepEqual(world.stationPreparationProof(),disposed);
  }finally{world.dispose();}
});
