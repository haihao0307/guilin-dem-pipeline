const test=require('node:test'),assert=require('node:assert/strict'),{lightCases}=require('./light-cases.cjs');
test('Lighting controls separate fill redistribution from cast-shadow removal',()=>{
 const original={key:2.7,fill:1.4,color:16773095,offset:[-.65,.4,1.1],radius:4},saved=structuredClone(original),[a,b,c]=lightCases(original);
 assert.deepEqual(original,saved);assert.deepEqual(a.options,original);assert.deepEqual(c.options,original);assert.equal(c.castShadows,false);assert.equal(b.castShadows,true);
 assert(Math.abs(b.options.key+b.options.fill-original.key-original.fill)<1e-12);
 assert.deepEqual(b.options.offset,original.offset);assert.equal(b.options.color,original.color);
 a.options.offset[0]=99;assert.deepEqual(original,saved);assert.deepEqual(c.options,original);
});
test('Invalid illumination is rejected instead of silently clamped',()=>{for(const x of [NaN,Infinity,-1])assert.throws(()=>lightCases({key:x,fill:1}));});
