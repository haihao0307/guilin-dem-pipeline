import assert from 'node:assert/strict';
import {smokeFrameState,smokeParticle} from '../smoke-profile.mjs';
import {createGameTrain} from '../train-model.mjs';
const v={tick:300,velocity:1,throttle:3,station:{remaining:500},events:[]};
const s=smokeFrameState(v,{tallExhaust:true}),p=Array.from({length:160},(_,i)=>smokeParticle(i,2.2,s));
assert.equal(s.starting,true);assert(Math.max(...p.filter(p=>p.upper).map(p=>p.position[1]))>14);assert(p.filter(p=>p.upper).every(p=>p.position[1]>3.7));
const station=smokeFrameState({...v,velocity:0,door:1,station:{remaining:0},events:[{tick:240,type:'doors-opening'}]},{tallExhaust:true});assert(station.draining);assert(Array.from({length:84},(_,i)=>smokeParticle(i,2.2,station)).every(p=>p.position[1]>.82));
const train=createGameTrain();assert.deepEqual(train.proof.placeholderDriver.position,[-1.74,2.82,.78]);assert.equal(train.proof.placeholderDriver.cap,'peaked');assert.equal(train.proof.placeholderDriver.openWindow,true);
console.log(JSON.stringify({pass:true,driverVisible:true,cap:'peaked',exhaustMaxY:Math.max(...p.map(p=>p.position[1])),particleBudget:p.length,platformSteamRetained:true}));
