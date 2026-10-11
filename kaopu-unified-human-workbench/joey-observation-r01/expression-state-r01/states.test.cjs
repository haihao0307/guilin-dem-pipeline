'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildStates,actions}=require('./states.cjs');
const original={state:{owners:{expression:'gnm',gaze:'gnm',headShape:'gnm'},gnm:{expression:[0,0],identity:[.7,-.5]},anny:{facialActions:{},localChanges:{'nose-point-width-incr':-.44},phenotypes:{gender:1}}},surface:{roughness:.55}};
test('only expression owner and explicit actions vary; inputs and all morphology are preserved',()=>{
 const copy=structuredClone(original),states=buildStates(original);
 for(const {archive}of states){const a=structuredClone(archive);a.state.owners.expression='gnm';a.state.anny.facialActions={};assert.deepEqual(a,copy);}
 assert.deepEqual(original,copy);assert.deepEqual(states[0].archive,states[3].archive);
});
test('owner-neutral uses exactly the smile label set at zero',()=>{
 const states=buildStates(original);assert.equal(states[1].archive.state.owners.expression,'anny');assert.deepEqual(Object.keys(states[1].archive.state.anny.facialActions),Object.keys(actions));assert(Object.values(states[1].archive.state.anny.facialActions).every(x=>x===0));
});
test('one symmetric bounded action recipe has no blink, jaw opening or gaze action',()=>{
 assert(Object.values(actions).every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.equal(actions.mouthSmileLeft,actions.mouthSmileRight);assert.equal(actions.cheekSquintLeft,actions.cheekSquintRight);assert.equal(actions.jawOpen,0);assert(!Object.keys(actions).some(k=>/Blink|Look/.test(k)));
});
test('stages own independent deep copies and reject a changed baseline expression',()=>{
 const states=buildStates(original);states[1].archive.surface.roughness=0;assert.equal(states[0].archive.surface.roughness,.55);const changed=structuredClone(original);changed.state.gnm.expression[0]=.1;assert.throws(()=>buildStates(changed),/zero-expression/);
});
