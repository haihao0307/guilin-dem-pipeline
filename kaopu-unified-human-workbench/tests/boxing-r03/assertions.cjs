'use strict';
const assert = require('node:assert/strict');
function near(a, b, tolerance = 1e-8, label = 'number') {
  assert(Number.isFinite(a) && Number.isFinite(b), label + ' must be finite');
  assert(Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b} (tolerance ${tolerance})`);
}
function validateContactEvent(e, {actors, responseEnabled}) {
  assert.equal(e.schema, 'kaopu-contact-event/1');
  assert.equal(e.source, 'JoltPhysics.js/1.1.0 WASM TransformedShape.CastShape');
  assert.match(e.eventId, /^jolt-r03-\d+$/);
  assert.equal(e.proxyApproximation, true);
  assert.equal(e.rotationalCCD, false);
  assert.equal(e.impulseSolved, false);
  assert(e.toi >= 0 && e.toi <= 1, 'Actual Jolt TOI must be in [0,1]');
  assert(e.closingSpeed >= .08 - 1e-9, 'Contact must pass closing-speed policy');
  assert(Number.isFinite(e.time) && Number.isFinite(e.canonicalTime));
  for (const name of ['contactPoint', 'normal', 'relativeVelocity']) {
    assert.equal(e[name].length, 3);
    assert(e[name].every(Number.isFinite), name + ' must be finite');
  }
  near(Math.hypot(...e.normal), 1, 1e-5, 'Contact normal');
  assert(Number.isInteger(e.attackerId) && Number.isInteger(e.defenderId));
  assert.notEqual(e.attackerId, e.defenderId);
  assert.equal(Math.floor(e.attackerId / 2), e.pairId);
  assert.equal(Math.floor(e.defenderId / 2), e.pairId);
  for (const id of [e.attackerId, e.defenderId]) assert(!['child', 'teen'].includes(actors[id].stage), 'Light child/teen actor entered adult collision experiment');
  if (e.blockedByGlove || e.attackIntent !== 'active-punch' || e.mode !== 'contact' || !responseEnabled) assert.equal(e.responseApplied, false, 'Non-qualifying contact must not produce a recovery');
  if (e.responseApplied) {
    assert.equal(e.mode, 'contact');
    assert.equal(e.attackIntent, 'active-punch');
    assert.equal(e.blockedByGlove, false);
  }
}
function compareFloatArrays(a, b, tolerance = 1e-7, label = 'pose') {
  assert.equal(a.length, b.length, label + ' length');
  let max = 0;
  for (let i = 0; i < a.length; ++i) {
    assert(Number.isFinite(a[i]) && Number.isFinite(b[i]), label + ' must be finite');
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  assert(max <= tolerance, label + ' max difference ' + max);
  return max;
}
module.exports = {near, validateContactEvent, compareFloatArrays};
