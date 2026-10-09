import assert from 'node:assert/strict';
import {CollisionWorld} from '../../collision-architecture/CollisionWorld.mjs';
import {canSweptShapesMeet} from './CollisionPruning.mjs';
import fs from 'node:fs';
const world=await CollisionWorld.create();let seed=97371,hits=0,falseNegatives=0,rejected=0;
const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),begin=performance.now();
for(let i=0;i<2000;i++){
 const base=[(rnd()-.5)*50,rnd()*3,(rnd()-.5)*30],q=[rnd()-.5,rnd()-.5,rnd()-.5,rnd()-.5],n=Math.hypot(...q);
 const target={from:base,to:base.map(v=>v+(rnd()-.5)*.06),rotation:q.map(v=>v/n),radius:.12+rnd()*.24,halfHeight:rnd()*.4};
 const from=base.map(v=>v+(rnd()-.5)*2),to=from.map(v=>v+(rnd()-.5)*1.4),attack={from,to,radius:.055+rnd()*.085};
 const hit=world.cast({...attack,target}),keep=canSweptShapesMeet(attack,target);if(hit)hits++;if(!keep)rejected++;if(hit&&!keep)falseNegatives++;
}
const report={passed:falseNegatives===0,actualOfficialJoltQueries:2000,actualJoltHits:hits,falseNegatives,broadPhaseRejected:rejected,elapsedMS:performance.now()-begin,backend:world.diagnostics(),numericBroadPhasePaddingMetres:.0001};world.dispose();assert(hits>0);assert.equal(falseNegatives,0);fs.writeFileSync(new URL('./PRUNING-JOLT-QA.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
