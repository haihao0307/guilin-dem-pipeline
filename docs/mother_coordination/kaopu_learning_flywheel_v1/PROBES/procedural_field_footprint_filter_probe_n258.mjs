import assert from 'node:assert/strict';

const u32 = value => value >>> 0;
const mul = (a, b) => Math.imul(a, b) >>> 0;

function hash(x, y, z) {
  let h = u32(mul(u32(x), 1597334677) ^ mul(u32(y), 3812015801) ^ mul(u32(z), 2798796415));
  h = mul(u32(h ^ (h >>> 16)), 2246822519);
  h = u32(h ^ (h >>> 13));
  return (h & 65535) / 65535;
}

function quinticNoiseAndGradient(p) {
  const cell = p.map(Math.floor);
  const f = p.map((v, i) => v - cell[i]);
  const u = f.map(v => v * v * v * (v * (v * 6 - 15) + 10));
  const du = f.map(v => 30 * v * v * (v - 1) * (v - 1));
  let value = 0;
  const gradient = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const c = [i & 1, (i >>> 1) & 1, (i >>> 2) & 1];
    const w = c.map((bit, axis) => bit ? u[axis] : 1 - u[axis]);
    const n = hash(cell[0] + c[0], cell[1] + c[1], cell[2] + c[2]);
    value += n * w[0] * w[1] * w[2];
    for (let axis = 0; axis < 3; axis++) {
      const other = axis === 0 ? w[1] * w[2] : axis === 1 ? w[0] * w[2] : w[0] * w[1];
      gradient[axis] += n * (2 * c[axis] - 1) * du[axis] * other;
    }
  }
  return { value, gradient };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function filterField(value, gradient, footprint, low = 0.18, high = 0.75) {
  const resolved = 1 - smoothstep(low, high, footprint);
  return {
    resolved,
    value: 0.5 + (value - 0.5) * resolved,
    gradient: gradient.map(component => component * resolved)
  };
}

let state = 0x6d2b79f5;
function random() {
  state = u32(state + 0x6d2b79f5);
  let t = state;
  t = mul(t ^ (t >>> 15), t | 1);
  t ^= t + mul(t ^ (t >>> 7), t | 61);
  return u32(t ^ (t >>> 14)) / 4294967296;
}

const epsilon = 1e-5;
let maxGradientError = 0;
for (let sample = 0; sample < 1000; sample++) {
  const p = Array.from({ length: 3 }, () => Math.floor(random() * 12) - 6 + 0.15 + random() * 0.7);
  const exact = quinticNoiseAndGradient(p);
  for (let axis = 0; axis < 3; axis++) {
    const plus = [...p], minus = [...p];
    plus[axis] += epsilon;
    minus[axis] -= epsilon;
    const numeric = (quinticNoiseAndGradient(plus).value - quinticNoiseAndGradient(minus).value) / (2 * epsilon);
    maxGradientError = Math.max(maxGradientError, Math.abs(numeric - exact.gradient[axis]));
  }
}
assert.ok(maxGradientError < 2e-7, `analytic gradient mismatch: ${maxGradientError}`);

const subject = quinticNoiseAndGradient([1.37, -2.42, 3.58]);
const low = filterField(subject.value, subject.gradient, 0.18);
assert.equal(low.resolved, 1);
assert.equal(low.value, subject.value);
assert.deepEqual(low.gradient, subject.gradient);

const high = filterField(subject.value, subject.gradient, 0.75);
assert.equal(high.resolved, 0);
assert.equal(high.value, 0.5);
assert.ok(high.gradient.every(component => Math.abs(component) === 0));

let previous = 1;
for (let i = 0; i <= 100; i++) {
  const current = filterField(subject.value, subject.gradient, 0.18 + (0.75 - 0.18) * i / 100).resolved;
  assert.ok(current <= previous + Number.EPSILON, 'visibility must decrease monotonically with footprint');
  previous = current;
}

const negativeControl = {
  filteredChannel: filterField(subject.value, subject.gradient, 1),
  unfilteredHighFrequencyChannel: quinticNoiseAndGradient([137.1, 19.2, -81.3]).value
};
assert.equal(negativeControl.filteredChannel.value, 0.5);
assert.notEqual(negativeControl.unfilteredHighFrequencyChannel, 0.5,
  'one filtered channel must not be promoted into an all-channel anti-shimmer claim');

console.log(JSON.stringify({
  schema: 'kaopu.probe-result/1',
  probeId: 'N258-PROCEDURAL-FIELD-FOOTPRINT-FILTER',
  subject: 'mrdoob/codevember-2026@0ea8c66a/05 materials.js + geology.js',
  tests: {
    analyticGradientVsCentralDifference: { samples: 1000, axes: 3, maxAbsError: maxGradientError, status: 'PASS' },
    lowFootprintPreservesValueAndGradient: 'PASS',
    highFootprintConvergesToMeanAndZeroGradient: 'PASS',
    footprintFadeMonotonic: 'PASS',
    unfilteredChannelNegativeControl: 'PASS'
  },
  conclusion: 'METHOD_INVARIANTS_REPRODUCED_CPU_ONLY',
  boundary: [
    'No WGSL compilation or GPU execution was performed.',
    'No temporal camera sweep or pixel comparison was performed.',
    'Fragment derivatives are unavailable in ordinary compute-stage evaluation.',
    'Filtering one channel does not prove that all procedural channels are shimmer-safe.'
  ]
}, null, 2));
