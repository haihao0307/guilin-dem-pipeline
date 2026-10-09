'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {near, compareFloatArrays, validateContactEvent} = require('./assertions.cjs');
test('numeric helpers reject nonfinite arrays and nondeterministic poses',()=>{
  near(1,1+1e-10);assert.throws(()=>near(NaN,0));
  compareFloatArrays([1,2],[1,2+1e-10]);assert.throws(()=>compareFloatArrays([0],[NaN]));assert.throws(()=>compareFloatArrays([0],[.01]));
});
test('event validator has a strict actual-Jolt provenance and response policy',()=>{
  // Synthetic objects are used ONLY to unit-test the validator. Browser QA
  // never imports this file or supplies these fixtures to the runtime.
  const actors=[{stage:'young'},{stage:'young'}];
  const event={schema:'kaopu-contact-event/1',source:'JoltPhysics.js/1.1.0 WASM TransformedShape.CastShape',eventId:'jolt-r03-1',proxyApproximation:true,rotationalCCD:false,impulseSolved:false,toi:.5,closingSpeed:1,time:1,canonicalTime:1,contactPoint:[0,0,0],normal:[1,0,0],relativeVelocity:[1,0,0],attackerId:0,defenderId:1,pairId:0,blockedByGlove:false,attackIntent:'active-punch',mode:'contact',responseApplied:true};
  validateContactEvent(event,{actors,responseEnabled:true});
  assert.throws(()=>validateContactEvent({...event,source:'scheduled-hit'},{actors,responseEnabled:true}));
  assert.throws(()=>validateContactEvent({...event,blockedByGlove:true},{actors,responseEnabled:true}));
  assert.throws(()=>validateContactEvent(event,{actors:[{stage:'child'},actors[1]],responseEnabled:true}));
  assert.throws(()=>validateContactEvent(event,{actors,responseEnabled:false}));
});
