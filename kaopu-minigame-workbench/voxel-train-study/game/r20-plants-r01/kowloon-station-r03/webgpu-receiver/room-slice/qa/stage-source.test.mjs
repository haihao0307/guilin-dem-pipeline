import assert from 'node:assert/strict';import {selectStageSource}from'../stage-source.mjs';
const shader=`struct A {x:f32}; @group(0) @binding(0) var<uniform> u:A; @group(0) @binding(1) var<storage,read_write> unused:A;
// fn fake() { dead(); }
fn leaf(x:f32)->f32{return x*3.;} fn dead()->f32{return 4.;}
@compute @workgroup_size(1) fn root(){let a=leaf(u.x);}`;
const r=selectStageSource(shader,['root']);assert.deepEqual(r.functionNames,['leaf','root']);assert(!r.code.includes('fn dead'));assert(!r.code.includes('var<storage'));assert(r.code.includes('fn leaf(x:f32)->f32{return x*3.;}'));assert(r.code.includes('@compute @workgroup_size(1) fn root'));assert.equal(r.bindings.length,1);assert.throws(()=>selectStageSource(shader,['missing']));console.log('7 stage-source closure tests passed; retained function bytes unchanged.');
