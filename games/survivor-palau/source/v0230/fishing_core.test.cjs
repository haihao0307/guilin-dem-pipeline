'use strict';
const assert = require('node:assert/strict');
const { createFishingSession, stepFishingSession, cloneSession, defaultEnvironment } = require('./fishing_core.cjs');

function run(session, seconds, inputFn, env = defaultEnvironment(), dt = 1 / 120) {
  const n = Math.ceil(seconds / dt);
  for (let i = 0; i < n && !session.outcome; i++) stepFishingSession(session, inputFn ? inputFn(session, i) : {}, env, dt);
  return session;
}

// Same fish identity survives water -> air -> water.
{
  const s = createFishingSession({ fishId: 'continuous-fish', fishPosition: [3.0, -0.12, 0], fishVelocity: [0.2, 0.1, 0], restLength: 4.5, lineStrength: 200, stamina: 0.9 });
  run(s, 0.48, () => ({ forceBreach: true, give: 1 }));
  run(s, 2.5, () => ({ give: 1 }));
  assert.equal(s.fish.fishId, 'continuous-fish');
  assert.ok(s.events.some(e => e.type === 'breach_begin'));
  assert.ok(s.events.some(e => e.type === 'splashdown'));
  assert.equal(s.fish.medium, 'water');
  assert.ok(s.telemetry.crossingJumpMax < 0.20);
}

// Hard reeling on weak line deterministically breaks the line.
{
  const a = createFishingSession({ seed: 42, fishPosition: [8, -1, 0], restLength: 4, lineStrength: 5 });
  const b = cloneSession(a);
  run(a, 2, () => ({ reel: 1 }));
  run(b, 2, () => ({ reel: 1 }));
  assert.equal(a.outcome, 'line_broken');
  assert.deepEqual(a, b);
}

// Save/restore at a frame boundary continues deterministically.
{
  const a = createFishingSession({ seed: 91, lineStrength: 80 });
  run(a, 0.75, s => ({ reel: s.time < 0.4 ? 0.25 : 0, give: s.time >= 0.4 ? 0.25 : 0 }));
  const restored = cloneSession(a);
  run(a, 1.25, s => ({ give: 0.3, forceBreach: s.time > 1.1 && s.time < 1.45 }));
  run(restored, 1.25, s => ({ give: 0.3, forceBreach: s.time > 1.1 && s.time < 1.45 }));
  assert.deepEqual(a, restored);
}

// Reef contact accumulates abrasion.
{
  const env = defaultEnvironment();
  env.snagAt = () => ({ contact: true, abrasionRate: 1.8 });
  const s = createFishingSession({ fishPosition: [7, -1, 0], restLength: 8.5, lineStrength: 100 });
  run(s, 3, () => ({ reel: 0.15 }), env);
  assert.ok(s.line.abrasion > 0.1);
  assert.ok(s.events.some(e => e.type === 'snag_contact'));
}

console.log('fishing_core tests: PASS');
