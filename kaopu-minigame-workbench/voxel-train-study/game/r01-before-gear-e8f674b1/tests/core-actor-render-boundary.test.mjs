import test from 'node:test';
import assert from 'node:assert/strict';
import {flatActor} from '../flat-terrain.mjs';

test('Rendering train-local actors cannot mutate authoritative Session positions',()=>{
 const actor={id:'seated-passenger',frame:'train',kind:'seated',position:[-12.6,1.04,-.62]};
 const original=structuredClone(actor);
 for(let i=0;i<100;i++){
  const rendered=flatActor(actor,30,5);
  assert.notEqual(rendered,actor);assert.notEqual(rendered.position,actor.position);
  rendered.position=[rendered.position[0],rendered.position[1]+.001,rendered.position[2]-.002];
  rendered.position[0]+=1;
 }
 assert.deepEqual(actor,original);
});
test('World actors remain transformed once with independent render coordinates',()=>{
 const actor={id:'waiting',frame:'world',position:[100,1.1,3]};
 const rendered=flatActor(actor,30,5);
 assert.deepEqual(rendered.position,[75,1.1,3]);assert.equal(rendered.frame,'train');
 rendered.position[0]=0;assert.deepEqual(actor.position,[100,1.1,3]);assert.equal(actor.frame,'world');
});
