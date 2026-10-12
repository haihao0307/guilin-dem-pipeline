import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {GEOMETRY_WGSL} from '../runtime/geometry.mjs';
import {MATERIAL_DOMAIN_WGSL} from '../runtime/materials.mjs';
import {KP_CONCRETE_WGSL} from '../runtime/mothers/concrete-kst.mjs';
test('building concrete and exterior slate remain different material domains',()=>{
 assert.doesNotMatch(GEOMETRY_WGSL,/,6u,s/);
 assert.equal((GEOMETRY_WGSL.match(/,9u,s/g)||[]).length,7);
 assert.match(GEOMETRY_WGSL,/min\(maximum,p.y\),6u,0u,0u,0u,p/);
});
test('concrete shape and PBR use identical metric coordinates and life state',()=>{
 assert.equal((MATERIAL_DOMAIN_WGSL.match(/kpConcreteStation\(state.q,state.age,state.wet,state.repair/g)||[]).length,2);
 assert.match(MATERIAL_DOMAIN_WGSL,/q=p-vec3<f32>\(a.x,a.y,b.x\)/);
 assert.match(MATERIAL_DOMAIN_WGSL,/d-=kpConcreteStation\([^;]+\)\.height/);
 assert.match(KP_CONCRETE_WGSL,/\(fine-\.5\)\*\.00042-chip\*\.0007/);
 // Original bounded fields: fine/chip in [0,1]. Shape upper bound remains .012m.
 for(const fine of [0,.5,1])for(const chip of [0,.5,1]){
  const h=(fine-.5)*.00042-chip*.0007;
  assert.ok(h>=-.00091-1e-12&&h<=.00021+1e-12);
  assert.ok(Math.abs(h)<.012);
 }
});
test('concrete adapter is pinned to the existing KST1 source and original bytes',()=>{
 const source=JSON.parse(fs.readFileSync(new URL('../runtime/sources/concrete.json',import.meta.url)));
 const bytes=fs.readFileSync(new URL('../runtime/mothers/concrete-kst.mjs',import.meta.url));
 assert.equal(source.sha256,'4f427344d7c37b7fb80074e5d132a49c877280321a6a0d12083991ce06db85e5');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'e0eb596c2d3b38526c2bcecadb2baa10b197e8cf9669fab37c9654cdad3f1d5d');
 assert.equal(source.cityBinding.visualAcceptance,false);
});
