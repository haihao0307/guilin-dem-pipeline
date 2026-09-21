'use strict';
const assert=require('node:assert/strict');
const {createPalauWorldFishingAdapter}=require('./palau_world_fishing_adapter.cjs');
const tests=[];const test=(name,fn)=>{fn();tests.push(name);};

test('complete PalauWorld sample maps into the fishing environment without gaps',()=>{
 const adapter=createPalauWorldFishingAdapter({sampleWorld:req=>({water:{eta:.2,normal:[0,1,0],surfaceVelocity:[.1,0,.02],breaker:.3,clarity:.8,current:[.04,0,.01],bed:-2,depth:2.2,evidenceStatus:'measured-or-derived'},habitat:{snagRisk:.8,abrasionRate:.4,snagContact:true,substrate:'coral',evidenceStatus:'derived'}})});
 assert.equal(adapter.surfaceAt(1,2,3).eta,.2);
 assert.deepEqual(adapter.currentAt(1,-1,2,3),[.04,0,.01]);
 assert.equal(adapter.snagAt([1,-1,2],[0,1,0],3).contact,true);
 const c=adapter.capabilities();assert.equal(c.productionCompatible,true);assert.deepEqual(c.missing,[]);assert.equal(c.worldConductor,'PalauWorld.sample()');assert.equal(c.traditionalLOD,false);
});

test('missing current and habitat evidence stays explicitly degraded',()=>{
 const adapter=createPalauWorldFishingAdapter({sampleWorld:()=>({water:{eta:0}})});
 const s=adapter.surfaceAt(0,0,0);assert.deepEqual(s.normal,[0,1,0]);assert.deepEqual(adapter.currentAt(0,0,0,0),[0,0,0]);assert.equal(adapter.snagAt([0,-1,0],[0,1,0],0).contact,false);
 const c=adapter.capabilities();assert.equal(c.productionCompatible,false);assert.equal(c.degraded,true);assert.ok(c.missing.includes('water.normal'));assert.ok(c.missing.includes('water.current'));assert.ok(c.missing.includes('habitat.snagRisk'));
});

test('strict mode rejects invented fallbacks',()=>{
 const adapter=createPalauWorldFishingAdapter({strict:true,sampleWorld:()=>({water:{eta:0}})});
 assert.throws(()=>adapter.surfaceAt(0,0,0),/water\.normal/);
});

test('missing water elevation is a hard failure',()=>{
 const adapter=createPalauWorldFishingAdapter({sampleWorld:()=>({water:{normal:[0,1,0]}})});
 assert.throws(()=>adapter.surfaceAt(0,0,0),/water\.eta/);
});
console.log(JSON.stringify({suite:'PalauWorld fishing adapter R12',passed:tests.length,failed:0,tests},null,2));
