import assert from 'node:assert/strict';
import {BundleFriction} from '../src/BundleFriction.mjs';
function fixture(mu){const d={q:new Float64Array(50*3),velocity:new Float64Array(50*3),invMass:new Float64Array(50).fill(1),steps:0};for(let i=0;i<50;i++){d.q[i*3]=i*.1;d.q[i*3+1]=-i*.02;}d.q.set([0,0,0],3*3);d.q.set([.004,0,0],28*3);d.velocity.set([0,1,0],28*3);const f=new BundleFriction(d);f.mu=mu;return{d,f};}
const a=fixture(0),b=fixture(.24);for(const x of [a,b])x.f.solve(1/120);
const momentum=x=>[0,1,2].map(k=>x.d.velocity[3*3+k]+x.d.velocity[28*3+k]);for(let k=0;k<3;k++)assert(Math.abs(momentum(b)[k]-[0,1,0][k])<1e-12);
const relative=x=>Math.abs(x.d.velocity[28*3+1]-x.d.velocity[3*3+1]);assert(relative(b)<relative(a));assert(b.f.dissipated>0);assert.equal(b.f.contacts,1);b.d.q[28*3]=.04;b.f.rebuild();b.f.solve(1/120);assert.equal(b.f.contacts,0);console.log(JSON.stringify({passed:true,momentum:momentum(b),relativeWithFriction:relative(b),relativeWithoutFriction:relative(a)}));

const quiet=fixture(.24);quiet.d.velocity.fill(0);quiet.f.solve(1/60);assert(quiet.d.velocity.every(v=>v===0),'compression preload must not inject separating velocity into resting hair');
