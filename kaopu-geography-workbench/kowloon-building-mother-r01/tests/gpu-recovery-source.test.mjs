import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildRendererSources as frozenSources} from '../r07/renderer.mjs';
import {buildRendererSources as candidateSources} from '../gpu-recovery-r01/renderer.mjs';
import {defaultFieldConfig,deriveField} from '../r07/field.mjs';
import {deriveMeasuredCase} from '../r07/cases.mjs';
import {deriveEvidenceAssembly} from '../r07/assemblies.mjs';
import {CASE_PROFILES} from '../r07/profiles.mjs';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url));
test('frozen runtime fingerprints remain unchanged by the isolated recovery patch',()=>{
 const hashes={'r06/app.mjs':'a9ac70e53fa873c64bed835ac14e98cc00b9a07f61a4c5222be3e1c830f60d0f','r06/renderer.mjs':'ba9578a55c71f147c3804bd30db9fb13748a52cbe9c60517a88f6a998d7110f2','r07/app.mjs':'bb55ac2fc268268bd9824e4c88d55b54242ffba641029ac387739181fc2c8fce','r07/renderer.mjs':'1f5ab010ce8008fe3bce79f1f59b109ec51e75bde7de20e3f7b2a4986fb6a881','r06/frame-scheduler.mjs':'5ccdc2ef75d83ad143a3c8e8a9dc70752554cf22c1756ec56742431110441ca0','r07/frame-scheduler.mjs':'5ccdc2ef75d83ad143a3c8e8a9dc70752554cf22c1756ec56742431110441ca0'};
 for(const [name,expected] of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(read(name)).digest('hex'),expected,name);
});
test('signed design geometry/material GLSL is byte-identical for every trace variant',()=>{for(const variant of [0,1,2,3,4]){const spec=deriveField(defaultFieldConfig());assert.deepEqual(candidateSources(spec,variant),frozenSources(spec,variant));}});
for(const profile of CASE_PROFILES)test(`${profile.id} measured and assembly shader sources preserve all frozen fields/materials`,()=>{
 const source=fs.readFileSync(new URL(profile.scoreUrl,new URL('../r07/app.mjs',import.meta.url)),'utf8');const spec=deriveMeasuredCase(JSON.parse(source));assert.deepEqual(candidateSources(spec),frozenSources(spec));const assembly=deriveEvidenceAssembly(profile.id,spec);assert.deepEqual(candidateSources(assembly),frozenSources(assembly));
});
test('all runtime model/material imports refer to frozen R07 authority and the isolated HTML is explicit',()=>{
 for(const file of ['app.mjs','renderer.mjs']){const source=read('gpu-recovery-r01/'+file).toString();for(const module of ['field','cases','assemblies','hosted-scene'])assert(source.includes(`from '../r07/${module}.mjs'`));assert(!source.includes("from './material.mjs'"));}
 const html=read('gpu-recovery-r01.html').toString();assert(html.includes('隔离修复候选'));assert(html.includes('真实设备仍待复验'));const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);assert(html.includes('./gpu-recovery-r01/app.mjs'));
});
