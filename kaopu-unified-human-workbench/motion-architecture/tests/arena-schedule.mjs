import assert from 'node:assert/strict';
import {createComparisonRound} from '../arena_schedule.mjs';
const h=n=>n.toString(16).padStart(64,'0');
const characters=Array.from({length:36},(_,i)=>({id:'fixture-character-'+i,restFingerprint:h(i+1)}));
const library=Array.from({length:18},(_,i)=>({semanticMotionId:'fixture-action-'+i,takeId:'fixture-take-'+i,
  canonicalClipSha256:h(i+100),actorCount:2,fps:30,durationSeconds:4,qualityStatus:'reviewed',
  semanticReviewEvidence:'synthetic contract test only; not an actual motion review',redistributionApproved:true,testFixture:true,
  source:{kind:'self-authored-procedural',neuralInferenceExecuted:false},
  bakes:characters.flatMap((c,j)=>['A','B'].map(role=>({characterId:c.id,partnerId:characters[j^1].id,role,
    restFingerprint:c.restFingerprint,partnerRestFingerprint:characters[j^1].restFingerprint,packetSha256:h(i*100+j*2+(role==='A'?1:2)+1000),fps:30,frameCount:121})))
}));
assert.throws(()=>createComparisonRound(library,characters,0),/synthetic test catalogue/);
const all=[];
for(let round=0;round<36;round++) {
  const out=createComparisonRound(library,characters,round,{allowSyntheticFixtures:true});
  assert.equal(out.validationOnly,true);
  assert.equal(new Set(out.arenas.map(a=>a.semanticMotionId)).size,18);
  assert(out.arenas.every(a=>a.clock.startSeconds===0&&a.actors.length===2));all.push(out);
}
for(let arena=0;arena<18;arena++)assert.equal(new Set(all.map(r=>r.arenas[arena].semanticMotionId)).size,18);
for(let arena=0;arena<18;arena++)for(let actor=0;actor<2;actor++)assert.equal(new Set(all.map(r=>r.arenas[arena].semanticMotionId+':'+r.arenas[arena].actors[actor].role)).size,36);
const options={allowSyntheticFixtures:true};
assert.throws(()=>createComparisonRound(library.slice(0,3),characters,0,options),/have 3/);
let altered=structuredClone(library);altered[1].semanticMotionId=altered[0].semanticMotionId;
assert.throws(()=>createComparisonRound(altered,characters,0,options),/semantic motions/);
altered=structuredClone(library);altered[1].canonicalClipSha256=altered[0].canonicalClipSha256;
assert.throws(()=>createComparisonRound(altered,characters,0,options),/renaming/);
altered=structuredClone(library);altered[0].bakes=[];
assert.throws(()=>createComparisonRound(altered,characters,0,options),/calibrated bake/);
let changed=structuredClone(characters);changed[0].restFingerprint=h(9999);
assert.throws(()=>createComparisonRound(library,changed,0,options),/shape changed/);
altered=structuredClone(library);altered[0].source.neuralInferenceExecuted=true;
assert.throws(()=>createComparisonRound(altered,characters,0,options),/cannot claim neural/);
altered=structuredClone(library);altered[0].redistributionApproved=false;
assert.throws(()=>createComparisonRound(altered,characters,0,options),/rights review/);
altered=structuredClone(library);altered[0].bakes[0].frameCount=120;
assert.throws(()=>createComparisonRound(altered,characters,0,options),/bake timing/);
assert.throws(()=>createComparisonRound(library,characters,0,{allowSyntheticFixtures:'false'}),/boolean/);
console.log(JSON.stringify({passed:true,syntheticFixturesOnly:true,neuralModelsExecuted:[],rounds:36,arenasPerRound:18,
  uniqueCharacters:36,everyCharacterComparedWithAll18MotionsInBothRoles:true,negativeCases:10,note:'This validates schedule and provenance gates. It does not generate or add 18 real actions.'},null,2));
