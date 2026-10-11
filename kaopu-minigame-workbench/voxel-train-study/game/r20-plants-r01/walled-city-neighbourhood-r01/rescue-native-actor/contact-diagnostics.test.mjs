import test from 'node:test';import assert from 'node:assert/strict';import {summarizeFootContacts} from './contact-diagnostics.mjs';
test('skin-contact gate uses actual sole gaps, not IK target error',()=>{assert.equal(summarizeFootContacts([{gapM:0},{gapM:.005},{gapM:.02}],{planted:true}).candidateGate,true);assert.equal(summarizeFootContacts([{gapM:-.01},{gapM:0}],{planted:true}).candidateGate,false);assert.equal(summarizeFootContacts([{gapM:.02},{gapM:.03}],{planted:true}).candidateGate,false);assert.equal(summarizeFootContacts([{gapM:.08},{gapM:.10}],{planted:false}).candidateGate,true);assert.equal(summarizeFootContacts([{gapM:null}],{planted:true}).candidateGate,false);});

test('actual overlapping stair noses use highest top only inside the same height window',async()=>{
 const {sampleFootObstacle}=await import('./contact-diagnostics.mjs');const {makeBuildingRecipe}=await import('../building-plan.mjs');const {makeRescueContract}=await import('../rescue-contract.mjs');const {makeRescueSupportSampler}=await import('../rescue-gameplay.mjs');
 const sample=makeRescueSupportSampler(makeRescueContract(makeBuildingRecipe())),q={x:.58,z:1.023,referenceY:27.19625};
 assert.equal(sample(q).supportId,'stair-9-return5');const obstacle=sampleFootObstacle(sample,q);assert.equal(obstacle.supportId,'stair-9-return6');assert.equal(obstacle.y,27.368125);assert(obstacle.y<=q.referenceY+.23);assert(obstacle.y>=q.referenceY-.43);
 const calls=[];sampleFootObstacle(x=>{calls.push(x);return null;},{x:1,z:2,referenceY:3,maxRise:.23,maxDrop:.43});assert.equal(calls[0].referenceY,3.23);assert.equal(calls[0].maxRise,0);assert.equal(calls[0].maxDrop,.66);
});
