import assert from 'node:assert/strict';
import {canSweptShapesMeet,stepWithConservativePruning,capsuleExtent} from './CollisionPruning.mjs';
const capsule={actorId:1,pairId:0,from:[0,1,0],to:[0,1,0],radius:.2,halfHeight:.4,rotation:[0,0,0,1]},hand={actorId:0,pairId:0,from:[-1,1,0],to:[1,1,0],radius:.1};
assert(canSweptShapesMeet(hand,capsule));assert(!canSweptShapesMeet({...hand,from:[-1,3,0],to:[1,3,0]},capsule));
const q=[0,0,Math.sin(Math.PI/4),Math.cos(Math.PI/4)],extent=capsuleExtent({...capsule,rotation:q});assert(Math.abs(extent[0]-.6)<1e-12);assert(Math.abs(extent[1]-.2)<1e-12);
let seed=771,checked=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
// Construct known touching sphere/capsule samples at swept times. None may be culled.
for(let i=0;i<1000;i++){
 const theta=random()*Math.PI*2,axis=[Math.sin(theta),Math.cos(theta),0],rotation=[0,0,-Math.sin(theta/2),Math.cos(theta/2)],from=[random(),random(),random()],to=from.map(v=>v+(random()-.5)*.8),u=random(),center=from.map((v,k)=>v+(to[k]-v)*u),s=(random()*2-1)*.4;
 const point=center.map((v,k)=>v+axis[k]*s),d=[(random()-.5)*.4,(random()-.5)*.4,(random()-.5)*.4],a={...hand,from:point.map((v,k)=>v-u*d[k]),to:point.map((v,k)=>v+(1-u)*d[k])};
 assert(canSweptShapesMeet(a,{...capsule,from,to,rotation}));checked++;
}
const calls=[];const result=stepWithConservativePruning({step:s=>(calls.push(s),[])},{time:1,dt:1/120,attacks:[hand,{...hand,from:[0,5,0],to:[0,5,0]}],targets:[capsule]});assert.equal(calls.length,2);assert.equal(calls[1].targets.length,0);assert.equal(result.broadPhaseRejected,1);
console.log(JSON.stringify({passed:true,knownTouchingCasesPreserved:checked,separatedHandsStillRearmed:true,actualJoltValidationRequired:true}));
