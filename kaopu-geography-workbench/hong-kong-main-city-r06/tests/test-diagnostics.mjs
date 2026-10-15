import{normalizeConflictGroups}from '../route/ui.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import {createRouteDisplay} from '../route/display.mjs';
const plan={displayRoutes:[{id:'test',points:[[0,0],[1,1]]}],labels:[{point:[0,0],text:'engineering'}]};
const display=createRouteDisplay(plan);assert.deepEqual(display.stats().newPlanning,false);assert.equal(display.showLegacy,false);
const sources=display.sources([{points:[[0,0],[2,2]],kind:'story'}]);assert(sources.every(r=>!display.visible(r)));
const labels=display.labelSources([{point:[2,2],text:'geographic fact',kind:'reference'}]);assert.equal(display.labelsVisible(labels).length,1);
display.set({newPlanning:true});assert.equal(display.labelsVisible(labels).length,2);display.set({newPlanning:false});assert.equal(display.labelsVisible(labels).length,1);
assert.equal(plan.displayRoutes.length,1);assert.equal(plan.labels.length,1);
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
assert(read('../city-buildings/runtime.mjs').includes('showCoverage=false'));
assert(read('../city-buildings/runtime.mjs').includes('setCoverage(v)'));
assert(!read('../route/ui.mjs').includes('id="r04Planning" checked'));
assert(read('../airport.mjs').includes('window.HKMapDiagnostics?.enabled?G.vertices.length/6:airportVertexCount'));
assert(read('../display/diagnostics.mjs').includes('setEnabled(false)'));
assert(read('../display/diagnostics.mjs').includes('physicalTrackAffected:false'));
console.log(JSON.stringify({passed:true,defaultEngineeringOverlays:false,planningDataPreserved:true,referenceLandmarksPreserved:true,coverageDefault:false,clockRulerOptIn:true,physicalTrackToggleUntouched:true}));

const routePlan=JSON.parse(read('../route/route-plan.json'));const normalized=normalizeConflictGroups(routePlan.conflictClusters);assert.equal(normalized.reduce((n,g)=>n+g.objectIds.length,0),11);assert(normalized.some(g=>g.objectIds.includes('B376362040601063C0')));assert.equal(normalizeConflictGroups([{objectIds:['legacy'],centerS:0}])[0].objectIds[0],'legacy');assert.throws(()=>normalizeConflictGroups([{centerS:0}]));
