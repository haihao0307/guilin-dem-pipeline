'use strict';
/*
 * Local reference re-expression of the 4D algorithm read from:
 * jwagner/simplex-noise.js @ 6bfff874f5f0efed6375a9bf27fbd39b3cec6b4e
 * simplex-noise.ts, 4D constants, gradients, rank ordering and permutation.
 * This compact loop-based re-expression is NOT the unmodified npm package.
 * Upstream work: Jonas Wagner; Stefan Gustavson; Peter Eastman.
 * Copyright (c) 2024 Jonas Wagner
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * Test scenarios and semantic drivers below are our own synthetic examples.
 */
const assert = require('node:assert/strict');
const F4 = (Math.sqrt(5) - 1) / 4;
const G4 = (5 - Math.sqrt(5)) / 20;
const gradients = [];
for (let zero = 0; zero < 4; zero++) {
  for (let bits = 0; bits < 8; bits++) {
    let j = 2;
    gradients.push(Array.from({length:4}, (_, a) => a === zero ? 0 : ((bits >> j--) & 1 ? -1 : 1)));
  }
}
function seedOf(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let z = Math.imul(a ^ a >>> 15, 1 | a);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
function fromRng(random) {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 0; i < 255; i++) {
    const r = i + Math.floor(random() * (256 - i));
    [perm[i], perm[r]] = [perm[r], perm[i]];
  }
  for (let i = 256; i < 512; i++) perm[i] = perm[i-256];
  return (...q) => {
    // Conservative wrapper domain; not an upstream API guarantee.
    if (q.length !== 4 || q.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) {
      throw new RangeError('Four finite local coordinates, |coordinate| <= 1e6, required');
    }
    const skew = q.reduce((s,v) => s+v, 0) * F4;
    const cell = q.map(v => Math.floor(v+skew));
    const unskew = cell.reduce((s,v) => s+v, 0) * G4;
    const x0 = q.map((v,i) => v - (cell[i]-unskew));
    const rank = [0,0,0,0];
    for (let a=0; a<4; a++) for (let b=a+1; b<4; b++) rank[x0[a] > x0[b] ? a : b]++;
    const index = cell.map(v => v & 255);
    let result = 0;
    for (let c=0; c<5; c++) {
      const off = rank.map(r => c === 0 ? 0 : c === 4 ? 1 : r >= 4-c ? 1 : 0);
      const x = x0.map((v,i) => v - off[i] + c*G4);
      let radius = 0.6;
      for (const v of x) radius -= v*v;
      if (radius <= 0) continue;
      const hash = perm[index[0]+off[0] + perm[index[1]+off[1] + perm[index[2]+off[2] + perm[index[3]+off[3]]]]];
      const g = gradients[hash % 32];
      radius *= radius;
      result += radius * radius * x.reduce((s,v,i) => s + g[i]*v, 0);
    }
    return 27*result;
  };
}
const keyed = key => fromRng(rngOf(seedOf(key)));
const points = Array.from({length:25}, (_,i) => [0.13+(i%5)*0.31, -0.7+Math.floor(i/5)*0.29, 0.41]);
const n = keyed('subject/A/field/v1');
const again = keyed('subject/A/field/v1');
let replayCount=0, valueMin=Infinity, valueMax=-Infinity;
for (const p of points) for (let i=0; i<=120; i++) {
  const t = i/15;
  const expected = n(...p,t*0.07);
  for (let j=0; j<3; j++) n(j+0.1, .9, .8, 2.4);
  assert.equal(n(...p,t*0.07), expected);
  assert.equal(again(...p,t*0.07), expected);
  // Compare common physical times at 15 and 60 displayed frames per second.
  assert.equal(n(...p,(4*i/60)*0.07), expected);
  valueMin=Math.min(valueMin,expected); valueMax=Math.max(valueMax,expected);
  replayCount++;
}
assert(valueMin >= -1 && valueMax <= 1);
const keys=['chest','shoulder','head'];
const makeChannels = order => Object.fromEntries(order.map(k => [k,keyed('A/'+k)]));
const abc=makeChannels(keys), cba=makeChannels([...keys].reverse());
for (const k of keys) for (const p of points) assert.equal(abc[k](...p,0.35),cba[k](...p,0.35));
function sharedChannels(order) {
  const rng=rngOf(123);
  return Object.fromEntries(order.map(k => [k,fromRng(rng)]));
}
const badA=sharedChannels(keys), badB=sharedChannels([...keys].reverse());
const badDifference=Math.max(...points.map(p => Math.abs(badA.chest(...p,0.35)-badB.chest(...p,0.35))));
assert(badDifference > 1e-3);

const T=6.0, R=1.2, eps=1e-5;
const loop = (x,y,t) => n(x,y,R*Math.cos(2*Math.PI*t/T),R*Math.sin(2*Math.PI*t/T));
let loopValueError=0, loopDerivativeError=0, linearSeam=0;
for (const [x,y,z] of points) {
  loopValueError=Math.max(loopValueError,Math.abs(loop(x,y,0)-loop(x,y,T)));
  const d0=(loop(x,y,eps)-loop(x,y,-eps))/(2*eps);
  const dT=(loop(x,y,T+eps)-loop(x,y,T-eps))/(2*eps);
  loopDerivativeError=Math.max(loopDerivativeError,Math.abs(d0-dT));
  linearSeam=Math.max(linearSeam,Math.abs(n(x,y,z,0)-n(x,y,z,1)));
}
assert(loopValueError < 1e-12);
assert(loopDerivativeError < 1e-7);
assert(linearSeam > 1e-3);

// Artistic driver, no anatomical or physiological calibration.
const na=keyed('A/breathAmplitude'), np=keyed('A/breathPhase');
const basePhaseNoise=np(.17,.29,.43,0);
function driver(t) {
  if (!Number.isFinite(t) || t<0) throw new RangeError('Finite nonnegative seconds required');
  const amplitude=1+.05*na(.19,.33,.47,t*.07);
  const phase=2*Math.PI*.25*t + .04*(np(.17,.29,.43,t*.09)-basePhaseNoise);
  return {value:amplitude*.5*(1-Math.cos(phase)),phase};
}
let driverMin=Infinity,driverMax=-Infinity, maxStep=0,minPhaseDelta=Infinity;
let previous=driver(0);
for(let i=1;i<=3600;i++) {
  const current=driver(i/60);
  assert(current.value>=0 && current.value<=1.05);
  assert(current.phase>previous.phase);
  maxStep=Math.max(maxStep,Math.abs(current.value-previous.value));
  minPhaseDelta=Math.min(minPhaseDelta,current.phase-previous.phase);
  driverMin=Math.min(driverMin,current.value); driverMax=Math.max(driverMax,current.value);
  previous=current;
}
assert.throws(() => n(0,0,0,NaN),RangeError);
assert.throws(() => n(0,0,0,2**31),RangeError);
assert.throws(() => driver(-1),RangeError);
console.log(JSON.stringify({
  executedAt:new Date().toISOString(),runtime:process.version,
  implementation:'local_reference_reexpression_not_unmodified_upstream',
  upstream_ref:'6bfff874f5f0efed6375a9bf27fbd39b3cec6b4e',
  same_seed_replay_and_common_time_samples:replayCount,
  sampled_range:[valueMin,valueMax],
  keyed_channel_order_comparisons:keys.length*points.length,
  shared_rng_order_counterexample_max_difference:badDifference,
  circular_2D_time_loop:{locations:points.length,maxValueSeam:loopValueError,maxDerivativeSeam:loopDerivativeError},
  linear_w_slice_counterexample_max_seam:linearSeam,
  synthetic_breath_driver:{samples:3601,seconds:60,min:Math.min(0,driverMin),max:driverMax,maxAdjacentChange:maxStep,minPhaseDelta},
  invalid_input_classes_rejected:3,
  original_package_build:false,moonbit_executed:false,rig_tested:false,
  gpu_tested:false,human_motion_validated:false,physiological_claim:false,
  limits:['Local CPU reference uses a loop rewrite of read source; no bitwise parity test against complete upstream',
    'Circular time embedding tests 2 spatial coordinates, not a full 3D looping field',
    'Key hashes are 32-bit with possible collisions; this probe does not establish globally unique identities',
    'Pure noise query replay does not replay history-dependent behavior or constraint solutions',
    'Finite samples do not establish global smoothness, timing safety or natural-looking animation']
},null,2));
