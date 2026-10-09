import assert from 'node:assert/strict';
import {CollisionWorld} from '../CollisionWorld.mjs';
const world=await CollisionWorld.create(),target={pairId:0,actorId:'B',bodyRegion:'torso',from:[0,1,0],to:[0,1,0],radius:.2,halfHeight:.3};
const attack={pairId:0,actorId:'A',hand:'L',from:[-1,1,0],to:[1,1,0],radius:.1};
const hit=world.cast({...attack,target});assert(hit);assert(Math.abs(hit.toi-.35)<1e-6);assert(Math.abs(hit.contactPoint[0]+.2)<1e-6);assert(hit.normal[0]>.9999);
assert.equal(world.cast({...attack,from:[-1,1,1],to:[1,1,1],target}),null);
const dynamic=world.cast({...attack,target:{...target,to:[.5,1,0]}});assert(Math.abs(dynamic.toi-.7/1.5)<1e-6);
assert(Math.abs(dynamic.contactPoint[0]-(-.2+.5*dynamic.toi))<1e-6);
let events=world.step({time:1,dt:1/120,attacks:[attack],targets:[target]});assert.equal(events.length,1);assert.equal(events[0].impulseSolved,false);assert(events[0].closingSpeed>0);
assert.equal(world.step({time:1.3,dt:1/120,attacks:[attack],targets:[target]}).length,0,'sustained/repeated contact must not retrigger');
world.step({time:1.4,dt:1/120,attacks:[{...attack,from:[-1,1,1],to:[1,1,1]}],targets:[target]});assert.equal(world.step({time:1.5,dt:1/120,attacks:[attack],targets:[target]}).length,1);
world.reset();assert.deepEqual(world.step({time:1,dt:1/120,attacks:[attack],targets:[target]}),events,'reset replay is deterministic');
world.reset();assert.equal(world.step({time:1,dt:1/120,attacks:[attack],targets:[{...target,actorId:'A'}]}).length,0);
assert.equal(world.step({time:1,dt:1/120,attacks:[attack],targets:[{...target,pairId:1}]}).length,0);
assert.throws(()=>world.cast({...attack,from:[NaN,0,0],target}));assert.throws(()=>world.step({time:1,dt:1/30,attacks:[],targets:[]}));
for(const s of [.4,.65,1,1.3,1.6]){const a={...attack,from:attack.from.map(v=>v*s),to:attack.to.map(v=>v*s),radius:attack.radius*s},t={...target,from:target.from.map(v=>v*s),to:target.to.map(v=>v*s),radius:target.radius*s,halfHeight:target.halfHeight*s};assert(Math.abs(world.cast({...a,target:t}).toi-.35)<2e-6);}
const memory=()=>world.J.JoltInterface.prototype.sGetFreeMemory();for(let i=0;i<100;i++)world.cast({...attack,target});const before=memory();for(let i=0;i<10000;i++)world.cast({...attack,target});const after=memory();assert.equal(before,after,'steady-state WASM allocations must be released');
const report={passed:true,backend:world.diagnostics(),analyticTOI:hit.toi,movingTargetTOI:dynamic.toi,cases:['hit','miss','relative-motion','world-contact','debounce','rearm','deterministic-reset','self-filter','pair-filter','invalid-input','fixed-step','five-scales','10000-cast-memory'],wasmHeapDelta:before-after};world.dispose();console.log(JSON.stringify(report,null,2));
