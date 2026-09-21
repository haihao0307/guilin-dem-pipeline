'use strict';

const assert = require('node:assert/strict');
const { createInteractionProbe } = require('./interaction_probe.cjs');
const { installPointerInputAdapter } = require('./pointer_input_adapter.cjs');

let assertions = 0;
const ok = (condition, message) => { assert.ok(condition, message); assertions++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };

const probe = createInteractionProbe({ probeId: 'finger-1', smoothing: 0.5 });
let s = probe.sample({ worldPosition: [1, 2, 3], eventTimeMs: 1000, worldTime: 4, pointerId: 7, pressure: 0.25 });
eq(s.probeId, 'finger-1', 'probe identity must remain stable');
eq(s.sourceKind, 'DIRECT_TOUCH_PROBE', 'direct touch must be explicit');
eq(s.worldPosition, [1, 2, 3], 'first sample preserves world position');
eq(s.worldVelocity, [0, 0, 0], 'first sample cannot invent velocity');
ok(s.active, 'first sample activates probe');

s = probe.sample({ worldPosition: [1.2, 2, 3], eventTimeMs: 1100, worldTime: 4.1, pointerId: 7, pressure: 0.5 });
ok(s.worldVelocity[0] > 0.9 && s.worldVelocity[0] < 1.1, 'filtered velocity derives from measured world displacement/time');
eq(s.worldVelocity.slice(1), [0, 0], 'no motion on untouched axes');
eq(s.pointerId, 7, 'pointer identity is preserved');
eq(s.worldTime, 4.1, 'world time comes from Game authoritative clock');

const beforeDecay = Math.abs(s.worldVelocity[0]);
s = probe.advance({ dt: 0.1, nowMs: 1300, worldTime: 4.2 });
ok(Math.abs(s.worldVelocity[0]) < beforeDecay, 'idle velocity must decay instead of freezing');
ok(s.active, 'idle decay alone does not synthesize pointer-up');

s = probe.cancel({ worldTime: 4.21, pointerId: 7 });
ok(!s.active, 'pointer-up/cancel deactivates the stimulus');
eq(s.pressure, 0, 'inactive probe has zero pressure');
eq(s.confidence, 0, 'inactive probe cannot remain a confident live stimulus');
const speedAfterCancel = Math.hypot(...s.worldVelocity);
s = probe.advance({ dt: 1.0, nowMs: 2400, worldTime: 5.21 });
ok(Math.hypot(...s.worldVelocity) < speedAfterCancel, 'cancelled velocity decays continuously');

s = probe.sample({ worldPosition: [9, 0, 0], eventTimeMs: 2500, worldTime: 5.3, pointerId: 9 });
eq(s.worldVelocity, [0, 0, 0], 'new pointerId must not inherit previous pointer velocity');
eq(s.pointerId, 9, 'new pointer becomes the active identity');

class FakeTarget {
  constructor() { this.handlers = new Map(); }
  addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }
  removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
  fire(type, event) { for (const fn of this.handlers.get(type) || []) fn(event); }
}

const target = new FakeTarget();
let worldTime = 10;
const emitted = [];
const adapter = installPointerInputAdapter({
  target,
  projectToWorld: (x, y) => [x / 100, 0, y / 100],
  readWorldTime: () => worldTime,
  emit: (state) => emitted.push(state),
  probeOptions: { probeId: 'game-touch', sourceKind: 'PLAYER_HAND', smoothing: 1 },
});
target.fire('pointerdown', { clientX: 100, clientY: 200, timeStamp: 100, pointerId: 3, pressure: 0.8 });
worldTime = 10.05;
target.fire('pointermove', { clientX: 110, clientY: 200, timeStamp: 150, pointerId: 3, pressure: 0.8 });
eq(emitted.at(-1).worldPosition, [1.1, 0, 2], 'adapter projects screen input through Game-supplied projector');
ok(emitted.at(-1).worldVelocity[0] > 1.9 && emitted.at(-1).worldVelocity[0] < 2.1, 'adapter reports world metres per second');
eq(emitted.at(-1).sourceKind, 'PLAYER_HAND', 'Game can label the real world stimulus role');
eq(emitted.at(-1).worldTime, 10.05, 'adapter samples the shared Game clock');
worldTime = 10.06;
target.fire('pointercancel', { pointerId: 3, timeStamp: 160 });
ok(!emitted.at(-1).active, 'pointercancel cannot leave a ghost active stimulus');
const countBeforeDispose = emitted.length;
adapter.dispose();
target.fire('pointermove', { clientX: 120, clientY: 200, timeStamp: 200, pointerId: 3, pressure: 0.8 });
eq(emitted.length, countBeforeDispose, 'dispose removes all browser listeners');

assert.throws(() => createInteractionProbe({ smoothing: 2 }), /smoothing/, 'invalid smoothing rejected'); assertions++;
assert.throws(() => probe.sample({ worldPosition: [NaN, 0, 0], eventTimeMs: 1, worldTime: 1 }), /finite/, 'non-finite world coordinates rejected'); assertions++;

console.log(`interaction_probe tests: PASS (${assertions} assertions)`);
