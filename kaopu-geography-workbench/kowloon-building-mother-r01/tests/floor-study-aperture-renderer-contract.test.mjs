import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const candidate=read('../whole-building-floor-study-r01/renderer.mjs');
const baseline=read('../whole-building-floor-study-r01/renderer.baseline-4722b220.mjs');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
test('frozen 4722 renderer remains exact',()=>assert.equal(createHash('sha256').update(baseline).digest('hex'),'2c980fb6e4e202e963b5419406f82b5709b58871c5a91f3343d9c52e598d1d9e'));
test('secondary ray generation, assembly solver and ping-pong trace paths unchanged',()=>{
 for(const [a,b]of [['function assemblyShader(','function apertureShader('],['function opticalRayShader(','const SHADE='],['    const pass=',' const trace=']]) assert.equal(section(candidate,a,b),section(baseline,a,b),a);
});
test('shader and renderer both gate primary-only aperture candidates',()=>{
 assert.ok(candidate.includes('floorPrimaryApertureRay=uRayMode==0'));
 assert.ok(candidate.includes("g.uniform1i(L('uPrimaryApertureIndexEnabled'),rayMode===0&&primaryApertureIndex?1:0)"));
 assert.ok(candidate.includes("g.uniform1i(L('uPrimaryApertureIndexRow'),rayMode===0?apertureTileRow("));
 assert.ok(candidate.includes('o.apertureTileIndex!==false'));
 assert.ok(candidate.includes("this.model.placementMode==='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'"));
});
