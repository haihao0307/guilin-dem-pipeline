import assert from 'node:assert/strict';
import {internalSize, MAX_INTERNAL_PIXELS} from '../pixel-budget.mjs';
assert.deepEqual(internalSize(960,640,.5),{width:480,height:320,pixels:153600,limit:153600});
for(const [w,h] of [[1920,1080],[3840,2160],[390,844],[1280,720],[7680,4320],[1,100000],[100000,1]]) {
  const size=internalSize(w,h,.5);assert(size.pixels<=MAX_INTERNAL_PIXELS);assert(size.width>=1&&size.height>=1);
}
for(const x of [NaN,Infinity,0,-1])assert.throws(()=>internalSize(960,640,x));
console.log('pixel budget: exact reviewed viewport preserved, seven other extents bounded, four invalid scales rejected');
