import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {SPEC,CASES,makeRecipe,sample,riverAt,noise} from './fields.mjs';import {auditRibbon,auditSeams} from './checks.mjs';
test('fixed complete one-metre 2048 metre cases',()=>{assert.equal(SPEC.extent,2048);assert.equal(SPEC.grid,2049);assert.equal(SPEC.spacing,1);assert.equal(SPEC.lod,false);assert.equal(SPEC.textures,false)});
test('three explicit authored cases, no survey identity',()=>{assert.deepEqual(Object.keys(CASES),['karst','river','paddy']);for(const id of Object.keys(CASES))assert.ok(makeRecipe(id).peaks.length>10)});
test('repeatable field values',()=>{for(const id of Object.keys(CASES)){let a=makeRecipe(id,31415),b=makeRecipe(id,31415);for(let i=0;i<100;i++)assert.deepEqual(sample(a,i*9.137-470,i*7.927-380),sample(b,i*9.137-470,i*7.927-380))}});
test('reseed changes authoring, no coordinate chunk phase reset',()=>{let a=makeRecipe('karst',31415),b=makeRecipe('karst',27182);assert.notEqual(sample(a,345,345).h,sample(b,345,345).h);for(let x=-896;x<1024;x+=128)assert.ok(Math.abs(noise((x-1e-6)*.01,3,11)-noise((x+1e-6)*.01,3,11))<1e-5)});
test('invalid seeds and invalid cases fail',()=>{for(const s of [-1,1.5,NaN,1000000])assert.throws(()=>makeRecipe('karst',s));assert.throws(()=>makeRecipe('unknown',7))});
test('cross-sections are finite and decline downstream',()=>{for(const id of Object.keys(CASES)){let c=makeRecipe(id),prev=Infinity;for(let z=-1024;z<=1024;z++){let r=riverAt(c,z);assert.ok(r.level<prev);assert.ok(r.width>0&&Math.abs(r.x)+r.width<1024);prev=r.level}}});
test('authored bed never crosses its water width',()=>{for(const id of Object.keys(CASES)){let c=makeRecipe(id);for(let z=-1024;z<=1024;z+=16){let r=riverAt(c,z);for(let j=-16;j<=16;j++){let h=sample(c,r.x+r.width*j/16,z).h;assert.ok(r.level+.035-h>.20)}}}});
test('shader/material controls never enter geometry fields',()=>{let code=fs.readFileSync(new URL('./fields.mjs',import.meta.url),'utf8');assert.equal(/settings\.(color|wet|gray)|uColor|uGray|camera|devicePixelRatio|navigator|distanceToEye/.test(code),false)});
test('runtime contains no texture allocation, image loading or adaptive geometry',()=>{for(const f of ['fields.mjs','worker.mjs','renderer.mjs','shaders.mjs','app.mjs']){let code=fs.readFileSync(new URL(f,import.meta.url),'utf8');assert.equal(/createTexture\s*\(|texImage|textureSample|sampler2D|sampler3D|\btexture\s*\(|new Image\(|TextureLoader|DataTexture|runtimeTiers|triangleStride/.test(code),false,f)}});
test('seam validator rejects one changed vertex',()=>{let a={x:0,z:0,buffer:new ArrayBuffer(129*129*16)},b={x:128,z:0,buffer:new ArrayBuffer(129*129*16)};assert.equal(auditSeams([a,b]).passed,true);new Uint8Array(b.buffer)[0]=1;assert.equal(auditSeams([a,b]).passed,false)});
// Full numeric compilation is intentionally separated from the small tests.
if(process.argv.includes('--compile')){
 globalThis.self=globalThis;let result;
 globalThis.postMessage=m=>{if(m.type==='error')throw Error(m.message);if(m.type==='result')result=m};await import('./worker.mjs');
 for(const id of Object.keys(CASES)){
  await globalThis.onmessage({data:{caseId:id,seed:31415}});
  assert.ok(result.audit.river.technicalPass);assert.ok(result.audit.seams.passed);assert.equal(result.audit.terrainTriangles,8388608);
  let digest=crypto.createHash('sha256');for(const t of result.tiles)digest.update(new Uint8Array(t.buffer));
  result.audit.geometrySha256=digest.digest('hex');
  console.log('CASE_AUDIT',JSON.stringify(result.audit));result=null;
 }
}
