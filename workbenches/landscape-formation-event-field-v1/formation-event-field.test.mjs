import assert from 'node:assert/strict';
import {
  evaluateFormationEventField,
  evaluateGrid,
  periodicAngularField,
  FormationEventFieldV1,
} from './formation-event-field.mjs';

function nearly(a, b, eps = 1e-12) { assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`); }

for (let y = -50; y <= 100; y += 3.7) {
  nearly(periodicAngularField(0, y, 83), periodicAngularField(Math.PI * 2, y, 83), 2e-14);
}

const sample = { x: 23.4, z: -17.2, baseHeight: 44, slope: 0.78, curvature: -0.23, drainage: 0.64, cliff: 0.9, lithology: 1, exposure: 0.8, seed: 83 };
const a = evaluateFormationEventField(sample);
const b = evaluateFormationEventField(sample);
assert.deepEqual(a, b, 'field must be deterministic');

const protectedSample = evaluateFormationEventField({ ...sample, protectedTruthMask: 1 });
assert.equal(protectedSample.heightDelta, 0, 'protected truth must have exact zero height delta');
assert.ok(protectedSample.fracture >= 0 && protectedSample.cavity >= 0, 'diagnostic masks remain available');

const neutral = evaluateFormationEventField({ ...sample, neutralGeometry: true });
assert.equal(neutral.heightDelta, 0, 'neutral geometry must be exact zero');
assert.ok(neutral.fracture + neutral.cavity + neutral.collapse > 0, 'neutral mode must expose event diagnostics');

for (let i = 0; i < 2500; i++) {
  const v = evaluateFormationEventField({
    x: Math.sin(i * 0.17) * 300,
    z: Math.cos(i * 0.23) * 300,
    baseHeight: (i % 150) - 20,
    slope: (i % 101) / 100,
    curvature: Math.sin(i * 0.13) * 0.8,
    drainage: (i % 83) / 82,
    cliff: (i % 97) / 96,
    lithology: (i % 91) / 90,
    exposure: (i % 73) / 72,
    seed: 83 + (i % 7),
  });
  for (const key of ['fracture', 'cavity', 'sinkhole', 'collapse', 'wetFlow', 'deposition', 'rockExposure', 'oxidation']) {
    assert.ok(Number.isFinite(v[key]) && v[key] >= 0 && v[key] <= 1, `${key} out of range`);
  }
  assert.ok(Number.isFinite(v.heightDelta), 'height delta finite');
  for (const value of Object.values(v.material)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, 'material channel range');
}

const cliff = evaluateFormationEventField({ ...sample, cliff: 1, slope: 0.95, lithology: 1 });
const plain = evaluateFormationEventField({ ...sample, cliff: 0, slope: 0.05, lithology: 0 });
assert.ok(cliff.cavity >= plain.cavity, 'cavity must be geology/cliff gated');
assert.ok(cliff.fracture >= plain.fracture, 'fracture must respond to cliff/slope');

const grid = evaluateGrid({ size: 41, spanM: 260, seed: 83 });
assert.equal(grid.values.length, 41 * 41 * 8);
assert.ok(grid.maxAbsDelta > 0.05, 'event geometry must produce visible change');
assert.ok(grid.eventPixels > 0, 'event masks must activate');

const neutralGrid = evaluateGrid({ size: 25, neutralGeometry: true });
for (let k = 1; k < neutralGrid.values.length; k += 8) assert.equal(neutralGrid.values[k], 0);

console.log(JSON.stringify({
  pass: true,
  version: FormationEventFieldV1.version,
  periodicSeam: 'pass',
  deterministic: 'pass',
  protectedTruthDeltaZero: 'pass',
  neutralGeometryDeltaZero: 'pass',
  boundedSamples: 2500,
  gridEventPixels: grid.eventPixels,
  gridMaxAbsDeltaM: grid.maxAbsDelta,
}, null, 2));
