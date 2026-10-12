import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {observerSamplingFrame,observerNeeded,observerLocalExclusions,observerStationPlans,observerSourceWorldX} from '../route-observer-policy.mjs';
// Deployment layout wins; fallback exists only for this local restored snapshot.
// Do not hide transitive import failures in an existing deployed host tree.
const host=new URL(existsSync(new URL('../../flat-terrain.mjs',import.meta.url))?'../../':'../../kowloon-station-r03/restored/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/',import.meta.url);
const {FLAT_WORLD,terrainSlots}=await import(new URL('flat-terrain.mjs',host));
const {PLATFORM_LAYOUT}=await import(new URL('metre-scale.mjs',host));

test('source vertices retain exact world chainage over both directions and tile recycling',()=>{
  for(const distance of [0,12.5,244.01,699.99,1234.56])for(const center of [-700,-250,0,215.9,224.1,700]){
    const f=observerSamplingFrame(distance,center,FLAT_WORLD);
    for(const slot of terrainSlots(f.samplingChainage,FLAT_WORLD))for(const x of [-18,-2.314,40,FLAT_WORLD.sourceStart+FLAT_WORLD.period]){
      const actual=x+slot.offset+f.shiftX,expected=x+FLAT_WORLD.centerX+slot.tile*FLAT_WORLD.period-distance;
      assert.ok(Math.abs(actual-expected)<1e-9);
      assert.ok(Math.abs(observerSourceWorldX(x,slot.tile,f,FLAT_WORLD)-expected)<1e-9);
    }
    assert.equal(f.maxX-f.minX,448);
  }
});

test('return to train-domain or disabled observation retires auxiliary residency',()=>{
  for(const center of [-232,-8,0,216])assert.equal(observerNeeded(true,observerSamplingFrame(0,center,FLAT_WORLD)),false);
  for(const center of [-232.01,216.01,700])assert.equal(observerNeeded(true,observerSamplingFrame(0,center,FLAT_WORLD)),true);
  assert.equal(observerNeeded(false,observerSamplingFrame(0,700,FLAT_WORLD)),false);
  for(const bad of [NaN,Infinity,-Infinity])assert.throws(()=>observerSamplingFrame(0,bad,FLAT_WORLD));
});

test('world site exclusion is translated once into local scenery sampling domain, without changing source boxes',()=>{
  const boxes=[Object.freeze({minX:605,maxX:785,minZ:-141,maxZ:9,reason:'bureau'})],shift=708;
  const local=observerLocalExclusions(boxes,shift);
  assert.deepEqual(local,[{minX:-103,maxX:77,minZ:-141,maxZ:9,reason:'bureau'}]);
  assert.equal(local[0].minX+shift,boxes[0].minX);
  assert.throws(()=>observerLocalExclusions([{minX:0,maxX:Infinity,minZ:0,maxZ:1}],shift));
});

test('only first station and Yaumati can be added, with host-streaming ownership winning',()=>{
  const route=Array.from({length:2000},(_,index)=>({index,target:index===0?0:700,name:'station '+index}));
  const nearby={...route[1],missed:true},view={distance:0,nearbyStations:[nearby]},frame=observerSamplingFrame(0,700,FLAT_WORLD);
  assert.deepEqual(observerStationPlans(view,route,frame,PLATFORM_LAYOUT),[nearby]);
  assert.deepEqual(observerStationPlans(view,route,frame,PLATFORM_LAYOUT,new Set([1])),[]);
  assert.deepEqual(observerStationPlans(view,route,observerSamplingFrame(0,0,FLAT_WORLD),PLATFORM_LAYOUT),[route[0]]);
});
