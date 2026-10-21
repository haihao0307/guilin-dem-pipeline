import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentFrame,sampleRoad,materialAt,anchors,validateSpec,signalState,extrude,traceRoad,laneGraph,compileRoad} from '../core.mjs';
// Synthetic unit fixtures only. Never used as a claimed real-world visual scene.
const spec={source:{url:'test://unit-fixture',dataset:'synthetic test fixture'},roads:[{id:'unit',points:[[0,0],[30,0]],halfWidth:3,height:0,widthEvidence:'inferred',heightEvidence:'inferred'}]};
test('grammar rejects absent data/evidence',()=>{assert.ok(validateSpec({}).length);assert.deepEqual(validateSpec(spec),[]);});
test('metre frame and signed lateral coordinate',()=>{const f=segmentFrame([10,2],[0,0],[30,0]);assert.equal(f.t,2);assert.equal(f.u,1/3);});
test('exact slab field boundary and collision',()=>{assert.equal(sampleRoad([10,0,0],spec).field,0);assert.ok(sampleRoad([10,-0.1,0],spec).field<0);assert.ok(Math.abs(sampleRoad([10,2,0],spec).field-2)<1e-12);assert.equal(sampleRoad([10,-.09,5],spec).field,2);});
test('extrusion is finite and continuous',()=>{assert.equal(extrude(0,0,-.18,0),0);assert.ok(Math.abs(extrude(.001,0,-.18,0)-.001)<1e-12);});
test('geometry and material are deterministic',()=>{assert.deepEqual(sampleRoad([4,0,1],spec),sampleRoad([4,0,1],spec));assert.deepEqual(materialAt([4,0,1],spec),materialAt([4,0,1],spec));});
test('anchor offsets follow width, not stale coordinates',()=>{const a=anchors(spec),b=anchors({...spec,roads:[{...spec.roads[0],halfWidth:5}]});assert.equal(Math.abs(b[0].position[2])-Math.abs(a[0].position[2]),2);});
test('no contradictory green in illustrative controller',()=>{for(let t=-50;t<500;t+=.1){const s=signalState(t);assert.ok(!(s.A==='green'&&s.B==='green'));}});
test('ray hits function surface without triangle geometry',()=>{const hit=traceRoad([10,12,0],[0,-1,0],spec);assert.ok(hit);assert.ok(Math.abs(hit.point[1])<.002);assert.equal(hit.roadId,'unit');});
test('crossing lines do not invent lane connections',()=>{const other={...spec.roads[0],id:'above',height:5,points:[[15,-10],[15,10]]};assert.deepEqual(laneGraph({...spec,roads:[...spec.roads,other]}).movements,[]);});
test('layer codes cannot be mistaken for metre height',()=>{assert.ok(validateSpec({...spec,roads:[{...spec.roads[0],height:'A02'}]}).length);});
test('compiled query snapshots mutable caller data',()=>{const input=structuredClone(spec),q=compileRoad(input);input.roads[0].height=20;assert.equal(q.sample([10,0,0]).field,0);assert.equal(q.diagnostics.mesh,false);});
