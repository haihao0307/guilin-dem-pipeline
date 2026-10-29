import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {deriveMeasuredCase} from '../r07/cases.mjs';import {controllerFor} from '../whole-building-ground-r01/controller.mjs';import {deriveEvidenceFloorPlan} from '../whole-building-floor-study-r01/floor-layout.mjs';
const measured=deriveMeasuredCase(JSON.parse(readFileSync(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json',import.meta.url)))),official=JSON.parse(readFileSync(new URL('../r07/sources/official-footprints.json',import.meta.url))),base=controllerFor('kcc').derive(measured,official),original=JSON.stringify(base);
test('opening variable rebuilds pane and real handle from the same sash transform without touching the whole mother',()=>{
 const closed=deriveEvidenceFloorPlan(base,measured,{windowOpenT:0}),open=deriveEvidenceFloorPlan(base,measured,{windowOpenT:.65});
 const handle=s=>s.evidenceModel.archetypes.flatMap(a=>a.primitives).find(p=>p.nodeId==='evidence-window:vertical-handle');
 const leaf=s=>s.apertures.find(a=>a.config.kind==='window').primitives.find(p=>p.part==='leaf');
 assert.deepEqual(handle(open).origin,leaf(open).origin);assert.deepEqual(handle(open).u,leaf(open).u);assert.deepEqual(handle(open).w,leaf(open).w);assert.notDeepEqual(handle(open).u,handle(closed).u);assert.notDeepEqual(leaf(open).u,leaf(closed).u);
 assert.strictEqual(open.model,base);assert.strictEqual(closed.model,base);assert.equal(JSON.stringify(base),original);assert.deepEqual(open.sourceMasks,[]);assert.equal(open.metadata.registrationAccepted,false);
 assert.throws(()=>deriveEvidenceFloorPlan(base,measured,{windowOpenT:1.1}));
});
