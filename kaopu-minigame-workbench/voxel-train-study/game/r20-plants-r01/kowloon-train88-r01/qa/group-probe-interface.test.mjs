import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const text=fs.readFileSync(new URL('./geometry-group-probe.mjs',import.meta.url),'utf8');
test('WebGPU probe retains full 64-byte HitField in storage without exceeding color attachment baseline',()=>{
 assert.match(text,/createComputePipelineAsync/);assert.match(text,/@workgroup_size\(1\)/);assert.match(text,/array<GeometryGroupResult>/);assert.doesNotMatch(text,/createRenderPipelineAsync|maxColorAttachmentBytesPerSample/);
 assert.match(text,/vec2<f32>\(gid.xy\)\+vec2<f32>\(\.5\)/);assert.match(text,/recordFloats=16/);
});
test('four vec4 fields round-trip storage layout exactly without reduced precision or discarded fields',()=>{
 const samples=192,recordFloats=16,packed=Float32Array.from({length:samples*recordFloats},(_,i)=>Math.sin(i)*31),attachments=[];
 for(let a=0;a<4;a++){const values=new Float32Array(samples*4);for(let i=0;i<samples;i++)values.set(packed.subarray(i*recordFloats+a*4,i*recordFloats+a*4+4),i*4);attachments.push(values);}
 for(let i=0;i<samples;i++)for(let a=0;a<4;a++)for(let k=0;k<4;k++)assert.equal(attachments[a][i*4+k],packed[i*recordFloats+a*4+k]);
});
