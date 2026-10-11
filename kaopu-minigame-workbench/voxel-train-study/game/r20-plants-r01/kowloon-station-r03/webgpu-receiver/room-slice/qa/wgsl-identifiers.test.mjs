import assert from 'node:assert/strict';import {KEYWORDS,RESERVED,scanWGSLIdentifiers as scan} from './wgsl-identifiers.mjs';
assert.equal(KEYWORDS.length,26);assert.equal(RESERVED.length,146);
for(const word of [...KEYWORDS,...RESERVED])for(const text of [`fn ${word}(){}`,`struct X {${word}:f32,}`,`fn x(${word}:f32){}`,`var<private> ${word}:f32;`,`fn x(){let ${word}=0.;}`,`alias ${word}=f32;`])assert(scan(text).some(x=>x.name===word),`${word}: ${text}`);
assert.deepEqual(scan('diagnostic(off, derivative_uniformity); struct X { ok:f32, }; @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) p:vec3<u32>){var<function> a=0.; for(var i=0;i<2;i++){a+=1.;}}'),[]);
assert.deepEqual(scan('// ref macro diagnostic\n/* class /* private */ readonly */ fn ok(){}'),[]);
console.log(`WGSL fixed-spec lexical gate: ${KEYWORDS.length} keywords, ${RESERVED.length} reserved words; 1032 invalid declaration fixtures and valid/comment controls passed.`);
