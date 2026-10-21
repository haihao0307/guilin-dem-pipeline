import test from 'node:test';import assert from 'node:assert/strict';import {segmentPacket,roadFrame,pointAt,anchors,sampleRoad,traceRoad} from '../core.mjs';
const road={id:'synthetic-test-not-Hong-Kong',points:[[0,0],[20,0],[20,20],[40,20]],halfWidth:2,height:0};const spec={roads:[road]};
test('all intermediate segments and cumulative stations enter GPU packet',()=>{const p=segmentPacket(spec);assert.equal(p.count,3);assert.deepEqual(p.segments,[[0,0,20,0],[20,0,20,20],[20,20,40,20]]);assert.deepEqual(p.meta.map(x=>x[0]),[0,20,40]);});
test('bend midpoint hits polyline not endpoint chord',()=>{const f=roadFrame([20,10],road);assert.equal(f.dist,0);assert.equal(f.s,30);assert.ok(sampleRoad([20,0,10],spec).field<=0);assert.ok(traceRoad([20,10,10],[0,-1,0],spec));assert.ok(sampleRoad([10,0,10],spec).field>0);assert.equal(traceRoad([10,10,10],[0,-1,0],spec),null);});
test('lamp station follows full path and local tangent',()=>{assert.deepEqual(pointAt(road,30),{point:[20,10],normal:[-1,0]});const a=anchors(spec,{spacing:20,clearance:1});assert.deepEqual(a.filter(x=>x.s===30).map(x=>x.position),[[23,.16,10],[17,.16,10]]);});

test('endpoint chord is not the road footprint',()=>{assert.ok(sampleRoad([10,0,5],spec).field>0);assert.equal(traceRoad([10,10,5],[0,-1,0],spec),null);});
