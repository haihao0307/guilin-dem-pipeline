import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {validateSpec,lengthOf} from '../core.mjs';
const s=JSON.parse(readFileSync(new URL('../scene.json',import.meta.url),'utf8'));
test('three official centreline IDs, no tunnel',()=>{assert.deepEqual(s.roads.map(r=>r.id).sort(),['1810269581','1810269582','1810269595']);assert.ok(s.roads.every(r=>r.streetType!=='Tunnel'));assert.deepEqual(validateSpec(s),[]);});
test('local metre projection round-trips every original vertex',()=>{for(const r of s.roads)r.points.forEach((p,i)=>{assert.ok(Math.abs(p[0]+s.localFrame.originE-r.sourceCoordinates[i][0])<1e-8);assert.ok(Math.abs(s.localFrame.originN-p[1]-r.sourceCoordinates[i][1])<1e-8);});});
test('source geometry is not evidence for assumed width, height or lane connections',()=>{assert.ok(s.roads.every(r=>r.widthEvidence==='design'&&r.heightEvidence==='inferred'));assert.deepEqual(s.movements,[]);assert.equal(s.source.originalUserPack,false);assert.ok(s.source.termsUrl.endsWith('/TNC'));});
test('selected source lengths preserved',()=>{assert.ok(Math.abs(s.roads.reduce((v,r)=>v+lengthOf(r),0)-276.44619953326855)<1e-6);});
