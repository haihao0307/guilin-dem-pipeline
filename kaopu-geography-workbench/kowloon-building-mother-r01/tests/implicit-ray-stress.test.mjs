import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {deriveMeasuredCase,intersectCaseRay} from '../r06/cases.mjs';
import {CASE_PROFILES} from '../r06/profiles.mjs';
const code='('+readFileSync(new URL('./implicit-source-ray-stress.js',import.meta.url),'utf8')+')';
function run(profile,corrupt=false){const score=JSON.parse(readFileSync(new URL(profile.scoreUrl,new URL('../r06/profiles.mjs',import.meta.url)),'utf8')),spec=deriveMeasuredCase(score);let largestBatch=0;
 const app={spec:()=>spec,intersectRay:(o,d)=>intersectCaseRay(spec,o,d),probe:(origins,kind,directions)=>{assert.equal(kind,4);largestBatch=Math.max(largestBatch,origins.length);return origins.map((o,i)=>{const h=intersectCaseRay(spec,o,directions[i]);return[h.hit?h.t:0,h.objectId??0,corrupt?3:h.hit?1:2,h.nodeVisits];});}};
 const result=vm.runInNewContext(code,{window:{__IMPLICIT_BUILDING__:app}})();return{result,largestBatch,spec};}
test('browser source-ray QA covers every case patch and both sides of every usable edge without exceeding probe capacity',()=>{for(const profile of CASE_PROFILES){const{result,largestBatch,spec}=run(profile);assert.equal(result.passed,true);assert.equal(result.categories['patch-front'],spec.counts.patches);assert.equal(result.categories['tilted-near-parallel'],spec.counts.patches);assert.ok(result.categories['outer-edge-offset']>=spec.counts.patches*2);assert.ok(largestBatch<=128);assert.equal(result.categories['hole-through']??0,spec.counts.holes);}});
test('browser ray-stress harness fails a substituted unresolved result instead of declaring a miss or pass',()=>{const{result}=run(CASE_PROFILES.find(p=>p.id==='warehouse'),true);assert.equal(result.passed,false);assert.equal(result.mismatches,result.samples);assert.ok(result.examples.length>0);});
