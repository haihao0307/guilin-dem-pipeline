import assert from 'node:assert/strict';
import {createLifeSeries,sampleLifeSeries,physicalSection} from '../src/measurement.mjs';

const grid=[0,0.25,0.5,0.75,1];
const curve=(vals)=>grid.map((u,i)=>({u,v:vals[i]}));
const morph=(scale,eyeU)=>({
  side:{dorsal:curve([0.02,0.16,0.20,0.13,0].map(x=>x*scale)),ventral:curve([-0.01,-0.11,-0.15,-0.08,0].map(x=>x*scale))},
  top:{leftHalfWidth:curve([0.01,0.07,0.10,0.06,0].map(x=>x*scale)),rightHalfWidth:curve([0.01,0.07,0.10,0.06,0].map(x=>x*scale))},
  anchors:[{id:'eye.L',kind:'eye',u:eyeU,sideV:0.07,topV:-0.03,sizeRel:0.025},{id:'eye.R',kind:'eye',u:eyeU,sideV:0.07,topV:0.03,sizeRel:0.025},{id:'mouth',kind:'mouth',u:0.01,sideV:0,topV:0,sizeRel:0.04}]
});
const p0={ageDays:10,lengthMm:20,lengthDefinition:'TL',evidence:{sourceId:'SYNTHETIC_TEST_ONLY'},morphology:morph(0.8,0.12)};
const p1={ageDays:110,lengthMm:100,lengthDefinition:'TL',evidence:{sourceId:'SYNTHETIC_TEST_ONLY'},morphology:morph(1.0,0.10)};
const s=createLifeSeries([p1,p0]);
assert.equal(s.lengthDefinition,'TL');
assert.equal(sampleLifeSeries(s,10).status,'measured_point');
const mid=sampleLifeSeries(s,60);
assert.equal(mid.status,'interpolated_between_measured_points');
assert.equal(mid.lengthMm,60);
assert(Math.abs(mid.morphology.anchors.find(x=>x.id==='eye.L').u-0.11)<1e-12);
assert.equal(sampleLifeSeries(s,0).status,'unsupported_outside_evidence_range');
const sec=physicalSection(mid,2);
assert(sec.bodyHeightMm>0 && sec.bodyWidthMm>0);
assert.throws(()=>createLifeSeries([p0,{...p1,lengthDefinition:'SL'}]),/mixed_length_definitions/);
const absent=structuredClone(p1); absent.morphology.anchors=absent.morphology.anchors.filter(a=>a.id!=='mouth');
const series2=createLifeSeries([p0,absent]);
assert.equal(sampleLifeSeries(series2,60).morphology.anchors.find(x=>x.id==='mouth').status,'unknown_between_evidence_points');
console.log('Original Fish measurement kernel: 9 assertions passed');
