import assert from 'node:assert/strict';
import{boundedFit}from'./EyeCurve.mjs';
const c=[[1,0,0],[0,1,0],[0,0,1]],bounds=[[-1,1],[-1,1],[-1,1]];
const a=boundedFit(c,[.3,-.4,.2],[1,1,1],bounds,1e-8);assert(Math.max(...a.error.map(Math.abs))<1e-7);
const b=boundedFit(c,[2,-2,.2],[1,1,1],bounds,1e-8);assert.equal(b.x[0],1);assert.equal(b.x[1],-1);
const coupled=boundedFit([[1,1],[2,2],[3,3]],[1,0],[1,4],bounds,.01);assert(Math.abs(coupled.predicted[0]-coupled.predicted[1])<1e-12);assert(coupled.error[0]<-.7,'Cannot falsely claim independent upper/lower action');
assert.throws(()=>boundedFit(c,[NaN,0,0],[1,1,1],bounds));
console.log('4 bounded response tests passed');
