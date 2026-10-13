'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{contactBeyondSharedTopology:check}=require('./local-intersections.cjs');
const a={ids:[0,1,2],p:[[0,0,0],[1,0,0],[0,1,0]]};
test('ordinary neighboring faces may meet along their shared edge',()=>{const b={ids:[1,0,3],p:[[1,0,0],[0,0,0],[0,-1,0]]};assert.equal(check(a,b,{line:[[0,0,0],[1,0,0]]}),false);});
test('adjacent coplanar overlap beyond the common edge is retained',()=>{const b={ids:[1,0,3],p:[[1,0,0],[0,0,0],[.5,.5,0]]};assert.equal(check(a,b,{line:[[0,0,0],[1,0,0]],polygon:[[0,0,0],[1,0,0],[.5,.5,0]]}),true);});
test('a shared vertex does not hide a longer crossing',()=>{const b={ids:[0,3,4],p:[[0,0,0],[.2,.2,1],[.2,.2,-1]]};assert.equal(check(a,b,{line:[[0,0,0],[.2,.2,0]]}),true);assert.equal(check(a,b,{line:[[0,0,0],[0,0,0]]}),false);});
test('unresolved adjacent intersection is not silently excluded',()=>{assert.equal(check(a,{ids:[0,3,4],p:[[0,0,0],[1,1,0],[1,2,0]]},{kind:'near_parallel_uncertain',line:null}),true);});
