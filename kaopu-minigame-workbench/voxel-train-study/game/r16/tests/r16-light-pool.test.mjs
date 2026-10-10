import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import * as Instrument from '../street/instrument.mjs';
import {createStreetDistrict,streetOffset,STREET_PLACEMENT} from '../street-district.mjs';

const source=readFileSync(new URL('../street/first-street.score.json',import.meta.url),'utf8');
const route=[{target:0}];
const recipe=count=>{
 const score=JSON.parse(source);
 score.construction.buildings.forEach((building,index)=>building.shops.forEach(shop=>{shop.open=index<count;}));
 return score;
};
const lights=root=>{const found=[];root.traverse(object=>{if(object.isLight)found.push(object);});return found;};
const slots=district=>district.root.children.filter(object=>object.isPointLight);
const describe=light=>({
 worldMatrix:(light.updateWorldMatrix(true,false),light.matrixWorld.toArray()),
 color:light.color.toArray(),intensity:light.intensity,distance:light.distance,decay:light.decay,
 castShadow:light.castShadow,layers:light.layers.mask,visible:light.visible,
});
function assertDark(district,original){
 assert.deepEqual(slots(district),original);
 assert.equal(lights(district.root).length,2);
 assert.equal(district.proof.lightingSlots,2);assert.equal(district.proof.lightingActive,0);
 for(const light of original){assert.equal(light.visible,true);assert.equal(light.intensity,0);assert.equal(light.castShadow,false);}
}
function spyDispose(object){
 const dispose=object.dispose.bind(object);let calls=0;
 object.dispose=()=>{calls++;return dispose();};
 return()=>calls;
}

for(const count of[0,1,2])test(`pool preserves ${count} lit-building recipe outputs, transforms and generated geometry`,async()=>{
 const score=recipe(count),district=createStreetDistrict({score}),originalSlots=slots(district);
 assertDark(district,originalSlots);await district.ready;
 const reference=Instrument.build(score),referenceRoot=new THREE.Group();referenceRoot.position.y=STREET_PLACEMENT.groundY;referenceRoot.add(reference.root);
 const emitters=lights(reference.root);assert.equal(emitters.length,count);assert.equal(reference.stats.shopLights,count);
 try{
  for(const distance of[30,31,140]){
   const view={distance,elapsed:2};district.update(view,route);referenceRoot.position.x=streetOffset(distance);
   Instrument.update(reference,view.elapsed,{wetness:score.appearance.wetness,railDistance:distance,originOffset:[streetOffset(distance),STREET_PLACEMENT.groundY,0]});
   assert.equal(district.proof.active,true);assert.equal(district.proof.lightingActive,count);assert.equal(district.proof.lightingSlots,2);
   assert.deepEqual(slots(district),originalSlots);assert.equal(lights(district.handle.root).length,0);
   assert.equal(lights(district.root).length,2);assert.equal(district.root.children.length,3);
   assert.deepEqual(originalSlots.slice(0,count).map(describe),emitters.map(describe));
   for(const light of originalSlots.slice(count)){assert.equal(light.intensity,0);assert.equal(light.visible,true);}
   assert.equal(district.snapshot().hash,Instrument.snapshot(reference).hash);
   assert.deepEqual(Instrument.measure(district.handle),Instrument.measure(reference));
  }
 }finally{district.dispose();for(const emitter of emitters)emitter.dispose();Instrument.dispose(reference);}
});

test('light-slot identities survive three releases/re-entries and final cleanup is idempotent',async()=>{
 const district=createStreetDistrict({score:recipe(2)});await district.ready;
 const original=slots(district),slotDisposals=original.map(spyDispose);district.update({distance:30,elapsed:2},route);
 const output=original.map(describe),geometryHash=district.snapshot().hash;
 for(let cycle=0;cycle<3;cycle++){
  const previous=district.handle;
  district.update({distance:1000,elapsed:20},route);assertDark(district,original);
  assert.equal(district.root.children.length,2);assert.equal(district.handle,null);assert.equal(previous.disposed,true);
  assert.deepEqual(district.proof.liveResources,{geometries:0,materials:0});assert.deepEqual(slotDisposals.map(count=>count()),[0,0]);
  district.update({distance:30,elapsed:2},route);assert.notEqual(district.handle,previous);assert.deepEqual(slots(district),original);
  assert.deepEqual(original.map(describe),output);assert.equal(district.snapshot().hash,geometryHash);
 }
 assert.equal(district.proof.loadCount,4);assert.equal(district.proof.unloadCount,3);
 district.dispose();district.dispose();district.update({distance:30,elapsed:2},route);
 assert.deepEqual(slotDisposals.map(count=>count()),[1,1]);assert.equal(district.root.children.length,0);
 assert.equal(district.proof.status,'disposed');assert.equal(district.proof.lightingSlots,0);assert.equal(district.proof.lightingActive,0);
});

test('generated source emitters are disposed once after adoption, independently of slots',async()=>{
 let emitted=[],counts=[];
 const instrument={...Instrument,build(...args){const handle=Instrument.build(...args);emitted=lights(handle.root);counts=emitted.map(spyDispose);return handle;}};
 const district=createStreetDistrict({score:recipe(2),instrument});await district.ready;district.update({distance:30,elapsed:2},route);
 assert.deepEqual(counts.map(count=>count()),[1,1]);assert(emitted.every(light=>light.parent===null));
 district.dispose();district.dispose();assert.deepEqual(counts.map(count=>count()),[1,1]);
});

function fakeInstrument({emitters=2,nested=false,failMeasure=false,failBuild=false,failSourceDispose=false}={}){
 let handle=null,handleDisposals=0;const sourceDisposals=[];
 return{
  parseScore:score=>score,
  build(){
   if(failBuild)throw new Error('injected build failure');
   const root=new THREE.Group();root.position.set(1,2,3);root.rotation.set(.1,.2,.3);root.scale.set(1.1,1.2,.9);
   const holder=nested?new THREE.Group():root;if(nested)root.add(holder);
   for(let i=0;i<emitters;i++){
    const light=new THREE.PointLight(0xffcf8c,5,3.8,2);light.position.set(i+2,3,-4);holder.add(light);
    const dispose=light.dispose.bind(light);sourceDisposals[i]=0;
    light.dispose=()=>{sourceDisposals[i]++;if(failSourceDispose&&i===1)throw new Error('injected source disposal failure');dispose();};
   }
   handle={root,state:{time:2},disposed:false};return handle;
  },
  measure(){if(failMeasure)throw new Error('injected measure failure');return{geometries:0,materials:0};},
  update(){},snapshot(){},dispose(candidate){handleDisposals++;candidate.disposed=true;candidate.root.removeFromParent();candidate.root.clear();},
  inspect:()=>({handle,handleDisposals,sourceDisposals}),
 };
}

for(const [label,options]of[
 ['build',{failBuild:true}],['more than two emitters',{emitters:3}],['nested emitter',{nested:true}],
 ['measurement',{failMeasure:true}],['partial source adoption',{failSourceDispose:true}],
])test(`${label} failure leaves dark slots, no attached candidate and no double disposal`,async()=>{
 const instrument=fakeInstrument(options),district=createStreetDistrict({score:recipe(2),instrument}),original=slots(district);await district.ready;
 assert.doesNotThrow(()=>district.update({distance:30,elapsed:2},route));assertDark(district,original);
 assert.equal(district.proof.status,'error');assert.equal(district.proof.active,false);assert.equal(district.proof.loadCount,0);
 assert.equal(district.handle,null);assert.equal(district.root.children.length,2);
 const first=instrument.inspect();assert.equal(first.handleDisposals,options.failBuild?0:1);
 if(first.handle){assert.equal(first.handle.disposed,true);assert.equal(first.handle.root.parent,null);assert.equal(first.handle.root.children.length,0);}
 assert(first.sourceDisposals.every(count=>count===1));
 district.update({distance:30,elapsed:3},route);district.dispose();district.dispose();
 const final=instrument.inspect();assert.equal(final.handleDisposals,first.handleDisposals);assert(final.sourceDisposals.every(count=>count===1));
 assert.equal(district.root.children.length,0);
});

test('adoption preserves an authored handle-root transform in the complete slot matrix',async()=>{
 const instrument=fakeInstrument(),district=createStreetDistrict({score:recipe(2),instrument});await district.ready;
 const build=instrument.build;let expected;
 instrument.build=(...args)=>{
  const handle=build(...args),referenceRoot=new THREE.Group();referenceRoot.position.set(streetOffset(30),STREET_PLACEMENT.groundY,0);referenceRoot.add(handle.root);
  expected=lights(handle.root).map(describe);handle.root.removeFromParent();return handle;
 };
 district.update({distance:30,elapsed:2},route);assert.equal(district.proof.active,true);
 const actual=slots(district).map(describe);
 for(let i=0;i<actual.length;i++){
  for(let k=0;k<16;k++)assert(Math.abs(actual[i].worldMatrix[k]-expected[i].worldMatrix[k])<1e-12);
  assert.deepEqual({...actual[i],worldMatrix:null},{...expected[i],worldMatrix:null});
 }
 district.dispose();
});

test('pending and failed scores retain dark slots; late completion after disposal cannot revive them',async()=>{
 let resolve;const delayed=createStreetDistrict({loadText:()=>new Promise(done=>{resolve=done;})}),original=slots(delayed);
 delayed.update({distance:30,elapsed:2},route);assertDark(delayed,original);resolve(source);await delayed.ready;
 assert.equal(delayed.proof.lightingActive,2);delayed.dispose();
 const bad=recipe(2);bad.instrument.abi='wrong';const invalid=createStreetDistrict({score:bad});await invalid.ready;
 assertDark(invalid,slots(invalid));assert.equal(invalid.proof.status,'error');invalid.dispose();
 for(const rejected of[false,true]){
  let complete;const late=createStreetDistrict({loadText:()=>new Promise((resolve,reject)=>{complete=rejected?reject:resolve;})});
  const counts=slots(late).map(spyDispose);late.update({distance:30,elapsed:2},route);late.dispose();
  complete(rejected?new Error('late load failure'):source);await late.ready;late.dispose();
  assert.equal(late.proof.status,'disposed');assert.equal(late.proof.loadCount,0);assert.equal(late.root.children.length,0);
  assert.deepEqual(counts.map(count=>count()),[1,1]);
 }
});
