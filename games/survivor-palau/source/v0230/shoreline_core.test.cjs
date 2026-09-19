'use strict';
const assert = require('node:assert/strict');
const { PROFILE, profileElevation, profileSlope, createShoreline } = require('./shoreline_core.cjs');

assert.ok(Math.abs(profileElevation(0)) < 1e-12);
let prev = profileElevation(-24);
let maxSlope = 0;
for (let d = -23.95; d <= 24; d += 0.05) {
  const y = profileElevation(d);
  assert.ok(y >= prev - 1e-9, `non-monotone at ${d}`);
  prev = y;
  maxSlope = Math.max(maxSlope, Math.abs(profileSlope(d)));
}
assert.ok(maxSlope < 0.11, `candidate beach too steep: ${maxSlope}`);

for (let i = 1; i < PROFILE.length - 1; i++) {
  const d = PROFILE[i].d;
  const left = profileSlope(d - 1e-4);
  const right = profileSlope(d + 1e-4);
  assert.ok(Math.abs(left - right) < 2e-4, `slope seam at d=${d}: ${left} vs ${right}`);
}

const shore = createShoreline();
for (const x of [4.5, 8, 9, 10.5, 13]) {
  const a = shore.shoreAt(x, 0);
  const b = shore.substrateAt(x, 0);
  assert.ok(Math.abs(a.elevation - b.elevation) < 1e-12);
}
assert.ok(Math.abs(shore.shoreAt(9, 0).elevation) < 1e-12);
assert.equal(shore.substrateAt(9, 0).materialClass, 'white_sand_candidate');
assert.equal(shore.landingAt(9, 0).safe, true);
assert.equal(shore.landingAt(-12, 0).safe, false);

const fresh = shore.wetnessAt(10.5, 0, { worldTime: 100, lastInundationTime: 99 });
const dry = shore.wetnessAt(10.5, 0, { worldTime: 300, lastInundationTime: 99 });
assert.ok(fresh.waterContent > dry.waterContent);
assert.ok(fresh.opticalDarkening > dry.opticalDarkening);

console.log(JSON.stringify({
  test: 'shoreline_core',
  status: 'PASS',
  maxSlope,
  shorelineElevation: shore.shoreAt(9, 0).elevation,
  sharedElevationMatch: true,
  wetnessMemory: true
}, null, 2));
