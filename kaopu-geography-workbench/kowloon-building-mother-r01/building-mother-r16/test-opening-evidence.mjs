import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openingFaceInventory} from './opening-evidence-panel.mjs';
const r=JSON.parse(fs.readFileSync(new URL('./evidence/hk-opening-height-r13.json',import.meta.url)));
assert.equal(r.sources[0].minimumClearHeadroomM,2);assert.equal(r.actualClearHeadroomM,null);assert.equal(r.structuralOrFireCertification,false);
const records=[...Array.from({length:3},()=>({role:'source_supported_design_proposal'})),...Array.from({length:4},()=>({role:'observed_glazed_group_static_representation'}))];
const l=openingFaceInventory({caseId:'lowrise',localModel:{hostedComponents:{records}}});assert.deepEqual(l.rows.map(x=>x.count),[3,4,null]);assert.equal(l.absenceInferred,false);
for(const caseId of ['kcc','warehouse']){const x=openingFaceInventory({caseId,localModel:{}});assert.equal(x.rows[0].status,'unknown');assert.equal(x.rows[0].count,null);}
console.log('Opening evidence distinctions: passed, no inferred no-window claim.');
const {WAREHOUSE_CANDIDATES,attachWarehouseCandidates}=await import('./warehouse-observed-candidates.mjs');
const model={caseId:'warehouse',graph:{nodes:[],edges:[]}};attachWarehouseCandidates(model);attachWarehouseCandidates(model);assert.equal(model.observedFacadeCandidates.length,3);assert.equal(model.graph.nodes.length,4);assert.equal(model.graph.edges.length,6);assert(WAREHOUSE_CANDIDATES.every(x=>x.sourcePoint===null&&!x.eligibleForWallCut&&!x.eligibleForWindowEmitter));
for(const c of WAREHOUSE_CANDIDATES){assert.equal(c.sourcePatchId,'p012');assert(c.atlasBBoxXYXY[0]>=2060&&c.atlasBBoxXYXY[2]<=3072&&c.atlasBBoxXYXY[1]>=4&&c.atlasBBoxXYXY[3]<=738);}
console.log('Warehouse observed candidate source/ownership/unknown geometry: passed.');
