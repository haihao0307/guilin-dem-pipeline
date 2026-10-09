import test from 'node:test';
import assert from 'node:assert/strict';
import { createSteamDynamics, STEAM_DYNAMICS_SPEC } from '../steam-dynamics.mjs';

const close = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) <= e, `${a} is not within ${e} of ${b}`);
const view = (time, fields = {}) => ({ elapsed: time, tick: Math.round(time * 30), distance: 0,
  velocity: 0, throttle: 0, brake: false, started: true, phase: 'running', seed: 'test-steam',
  station: { index: 0, target: 200, remaining: 200 }, events: [], ...fields });
function run(engine, from, to, make, hz = 60) {
  let result;
  for (let i = 1; i <= Math.round((to - from) * hz); i++) {
    const time = from + i / hz; result = engine.update(view(time, make(time)));
  }
  return result;
}
const moving = (speed, throttle = 3) => t => ({ velocity: speed, distance: speed * t, throttle });
const active = result => result.particles.filter(p => p.opacity > .0001);

test('One wheel revolution has four distance-locked powered beats; zero speed has none', () => {
  const engine = createSteamDynamics(), circumference = Math.PI * 2 * .61;
  engine.update(view(0, { velocity: circumference, throttle: 3 }));
  const frame = run(engine, 0, 1, moving(circumference));
  assert.equal(frame.proof.pulseCount, 4); close(frame.proof.wheelAngle, -Math.PI * 2);
  const stopped = createSteamDynamics(); stopped.update(view(0, { throttle: 3 }));
  const idle = run(stopped, 0, 6, () => ({ throttle: 3 }));
  assert.equal(idle.proof.pulseCount, 0); assert.equal(idle.state.pulseStrength, 0);
});

test('30 Hz and 60 Hz render sampling have identical bounded emission histories', () => {
  const a = createSteamDynamics(), b = createSteamDynamics();
  a.update(view(0, moving(7)(0))); b.update(view(0, moving(7)(0)));
  const p = run(a, 0, 8, moving(7), 30), q = run(b, 0, 8, moving(7), 60);
  assert.equal(p.proof.pulseCount, q.proof.pulseCount); assert.deepEqual(p.proof.emitted, q.proof.emitted);
  for (let i = 0; i < p.particles.length; i++) {
    const x = p.particles[i], y = q.particles[i]; assert.equal(x.id, y.id);
    close(x.opacity, y.opacity); close(x.size, y.size);
    x.position.forEach((n, axis) => close(n, y.position[axis]));
  }
});

test('Repeated Session snapshots and pause freeze particle age, position, texture rotation and counts', () => {
  const engine = createSteamDynamics(); engine.update(view(0, moving(4)(0)));
  const frame = run(engine, 0, 1, moving(4)), saved = structuredClone(frame.particles);
  for (let i = 0; i < 120; i++) {
    const paused = engine.update(view(1, { ...moving(4)(1), paused: true }));
    assert.deepEqual(paused.particles, saved); assert.equal(paused.proof.pulseCount, frame.proof.pulseCount);
    assert.equal(paused.proof.framePulses, 0); assert.equal(paused.state.paused, true);
  }
});

test('Sub-tick and uneven render calls retain every crossed wheel beat', () => {
  const circumference = .61 * 2 * Math.PI, speed = circumference * 3;
  const reference = createSteamDynamics(), highRate = createSteamDynamics(), uneven = createSteamDynamics();
  for (const engine of [reference, highRate, uneven]) engine.update(view(0, moving(speed)(0)));
  const a = run(reference, 0, 2, moving(speed), 30), b = run(highRate, 0, 2, moving(speed), 144);
  let c, time = 0, i = 0;
  while (time < 2) { time = Math.min(2, time + [1 / 72, 1 / 91, 1 / 43, 1 / 120][i++ % 4]); c = uneven.update(view(time, moving(speed)(time))); }
  assert.equal(a.proof.pulseCount, 24); assert.equal(b.proof.pulseCount, 24); assert.equal(c.proof.pulseCount, 24);
  assert.deepEqual(a.proof.emitted, b.proof.emitted); assert.deepEqual(a.proof.emitted, c.proof.emitted);
});

test('Coasting keeps weaker residual smoke, without powered exhaust beats or permanent lower steam', () => {
  const engine = createSteamDynamics(); engine.update(view(0, moving(8)(0)));
  const power = run(engine, 0, 4, moving(8)), beats = power.proof.pulseCount;
  const coast = run(engine, 4, 10, moving(8, 0));
  assert.equal(coast.proof.pulseCount, beats); assert.equal(coast.state.pulseStrength, 0);
  assert.equal(coast.proof.lowerActive, 0); assert.ok(coast.proof.upperActive > 0);
  assert.ok(coast.proof.upperActive < power.proof.upperActive / 2);
});

test('Ordinary braking near a platform does not open drains or create station choreography', () => {
  const engine = createSteamDynamics(); engine.update(view(0, { velocity: 2, brake: true }));
  const result = run(engine, 0, 8, t => ({ distance: t * 2, velocity: 2, brake: true, throttle: 0,
    station: { target: 20, remaining: 20 - t * 2, index: 0 } }));
  assert.equal(result.state.draining, false); assert.equal(result.proof.lowerActive, 0);
  assert.equal(result.proof.warmReleases, 0); assert.equal(result.proof.stationReleases, 0);
});

test('Station release is a single event-driven deck layer and repeating a snapshot does not replay it', () => {
  const engine = createSteamDynamics(); engine.update(view(0, { station: { target: 0, remaining: 0 } }));
  const fields = () => ({ station: { target: 0, remaining: 0 }, events: [{ id: 1, type: 'doors-opening', tick: 1 }] });
  let result = run(engine, 0, 3, fields);
  assert.equal(result.proof.stationReleases, 1); assert.equal(result.state.draining, false);
  assert.ok(result.proof.platformActive > 20); assert.ok(result.proof.cylinderActive > 0);
  const jets = active(result).filter(p => p.source === 'cylinder');
  assert.ok(jets.every(p => p.reason === 'station-choreography' && p.eventId === 1));
  assert.ok(jets.every(p => p.birthPosition[0] === 3.3 && p.birthPosition[1] === 1.06));
  assert.ok(jets.some(p => p.position[2] > 2.2 && p.position[0] < 1), 'Valve jets spread laterally and rearward toward the deck layer');
  const cloud = active(result).filter(p => p.source === 'platform');
  assert.ok(cloud.every(p => p.position[1] > .82));
  assert.ok(Math.max(...cloud.map(p => p.position[1])) > 1.5, 'Vapour reaches passenger legs and bodies');
  assert.ok(Math.min(...cloud.map(p => p.position[0])) < -18, 'The release spreads along the deck');
  assert.ok(cloud.every(p => p.position[2] > 2.2));
  result = run(engine, 3, 12, fields);
  assert.equal(result.proof.stationReleases, 1); assert.equal(result.proof.lowerActive, 0);
});

test('Approach and door events remain distinct one-time releases, with bounded event memory', () => {
  const engine = createSteamDynamics(); engine.update(view(0));
  const fields = t => ({ station: { index: 0, target: 0, remaining: 0 }, events: [
    { id: 1, type: 'approach-steam', tick: 1 }, ...(t > 1 ? [{ id: 2, type: 'doors-opening', tick: 31 }] : [])] });
  const result = run(engine, 0, 5, fields);
  assert.equal(result.proof.stationReleases, 2); assert.ok(result.proof.stationSourceCount <= 2);
  assert.ok(result.proof.rememberedEvents <= 256);
});

test('Cold departure gets brief two-sided cylinder steam; only a long stop rearms it', () => {
  const engine = createSteamDynamics(); engine.update(view(0));
  let result = run(engine, 0, 1, moving(1));
  assert.equal(result.proof.warmReleases, 1); assert.equal(result.state.draining, true);
  const cylinder = active(result).filter(p => p.source === 'cylinder');
  assert.ok(cylinder.some(p => p.position[2] < -.965)); assert.ok(cylinder.some(p => p.position[2] > .965));
  assert.ok(cylinder.every(p => p.birthPosition[0] === 3.3 && p.birthPosition[1] === 1.06));
  result = run(engine, 1, 8, t => ({ velocity: 1, distance: t, throttle: 3 }));
  assert.equal(result.proof.lowerActive, 0); assert.equal(result.state.draining, false);
  run(engine, 8, 10, () => ({ distance: 8 }));
  result = run(engine, 10, 11, t => ({ velocity: 1, distance: 8 + t - 10, throttle: 3 }));
  assert.equal(result.proof.warmReleases, 1);
  run(engine, 11, 24, () => ({ distance: 9 }));
  result = run(engine, 24, 25, t => ({ velocity: 1, distance: 9 + t - 24, throttle: 3 }));
  assert.equal(result.proof.warmReleases, 2); assert.equal(result.state.draining, true);
});

test('Released clouds preserve birth socket, distance and load across emitter motion and throttle changes', () => {
  const a = createSteamDynamics(), b = createSteamDynamics();
  a.update(view(0, moving(6)(0))); b.update(view(0, moving(6)(0)));
  const before = run(a, 0, 1, moving(6)); run(b, 0, 1, moving(6));
  const old = active(before).filter(p => p.upper).map(p => p.id);
  const changed = a.update(view(1 + 1 / 30, moving(6, 0)(1 + 1 / 30)), { emitters: { chimney: [3.4, 4.1, .2] } });
  const control = b.update(view(1 + 1 / 30, moving(6)(1 + 1 / 30)));
  for (const id of old) {
    const x = changed.particles.find(p => p.id === id), y = control.particles.find(p => p.id === id);
    if (!x || !y) continue;
    assert.deepEqual(x.position, y.position); assert.deepEqual(x.color, y.color);
    assert.deepEqual(x.birthPosition, [3.03, 3.72, 0]); assert.equal(x.birthLoad, 1);
  }
  const newest = run(a, 1 + 1 / 30, 2 + 1 / 30, moving(6, 0));
  assert.ok(active(newest).some(p => p.upper && p.birthPosition[1] === 4.1));
});

test('Smoke always starts at the single chimney, grows lighter and larger, and trails a moving source', () => {
  const engine = createSteamDynamics(); engine.update(view(0, moving(10)(0)));
  const result = run(engine, 0, 4, moving(10));
  const upper = active(result).filter(p => p.upper), young = upper.filter(p => p.age < .25), old = upper.filter(p => p.age > 2.5);
  assert.ok(young.length > 0 && old.length > 0);
  assert.ok(upper.every(p => p.birthPosition[0] === 3.03 && p.birthPosition[1] === 3.72 && p.birthPosition[2] === 0));
  assert.ok(Math.max(...young.map(p => p.size)) < Math.min(...old.map(p => p.size)));
  assert.ok(Math.max(...young.map(p => p.color[0])) < Math.min(...old.map(p => p.color[0])));
  assert.ok(Math.max(...old.map(p => p.position[0])) < 0);
  assert.ok(Math.max(...upper.map(p => p.position[1])) > 11);
});

test('Stopped residual smoke gradually dies away instead of cycling forever', () => {
  const engine = createSteamDynamics(); engine.update(view(0, moving(5)(0)));
  run(engine, 0, 3, moving(5));
  const early = run(engine, 3, 4, () => ({ distance: 15 }));
  const late = run(engine, 4, 24, () => ({ distance: 15 }));
  assert.ok(early.proof.upperActive > 0); assert.equal(late.proof.upperActive, 0);
  assert.equal(late.proof.lowerActive, 0); assert.equal(late.state.pulseStrength, 0);
});

test('Restore, rewind, distance teleport and explicit reset clear history without replaying old events', () => {
  const engine = createSteamDynamics(); engine.update(view(0, moving(3)(0)));
  run(engine, 0, 2, moving(3));
  let result = engine.update(view(90, { distance: 230, velocity: 3, throttle: 3,
    events: [{ id: 50, type: 'doors-opening', tick: 2700 }], station: { target: 230, remaining: 0 } }));
  assert.equal(result.proof.latestResetReason, 'time-jump'); assert.equal(result.proof.activeParticles, 0);
  assert.equal(result.proof.pulseCount, 0); assert.equal(result.proof.stationReleases, 0);
  result = engine.update(view(0)); assert.equal(result.proof.latestResetReason, 'time-rewound');
  result = engine.update(view(1 / 30, { distance: 500 })); assert.equal(result.proof.latestResetReason, 'distance-jump');
  result = engine.reset(view(1)); assert.equal(result.proof.latestResetReason, 'explicit-reset');
  assert.equal(result.proof.activeParticles, 0); assert.equal(result.proof.poolSize, 160);
});

test('Long runs keep separate pools, finite geometry and a hard ceiling of 160 particles', () => {
  const engine = createSteamDynamics({ maxParticles: 10000 }); engine.update(view(0, moving(18)(0)));
  let result;
  for (let i = 1; i <= 60 * 60; i++) {
    const t = i / 60; result = engine.update(view(t, { ...moving(18)(t),
      station: { target: t * 18, remaining: 0 },
      events: [{ id: Math.floor(t / 2) + 1, tick: Math.floor(t / 2) * 60, type: 'doors-opening' }] }));
    assert.equal(result.particles.length, 160);
    assert.ok(result.proof.upperActive <= 96 && result.proof.lowerActive <= 64);
    for (const p of result.particles) {
      assert.ok(p.position.every(Number.isFinite)); assert.ok(Number.isFinite(p.rotation));
      assert.ok(p.opacity >= 0 && p.opacity <= 1); assert.ok(p.size >= 0 && p.size <= 8.2);
      assert.ok(p.color.every(v => v >= 0 && v <= 1));
    }
  }
  assert.equal(result.proof.upperCapacity + result.proof.lowerCapacity, 160);
  assert.ok(result.proof.stationSourceCount <= 2); assert.ok(result.proof.geometryBounds.upper.max[1] < 22);
  assert.equal(STEAM_DYNAMICS_SPEC.assumptions.includes('game choreography'), true);
});

test('Pool reuse never makes a visible plume disappear, even when a tiny pool is saturated', () => {
  for (const capacity of [8, 160]) {
    const engine = createSteamDynamics({ maxParticles: capacity });
    let previous = engine.update(view(0, moving(18)(0)));
    for (let i = 1; i <= 900; i++) {
      const t = i / 60, result = engine.update(view(t, { ...moving(18)(t),
        station: { target: t * 18, remaining: 0 },
        events: [{ id: Math.floor(t / 2) + 1, type: 'doors-opening', tick: Math.floor(t / 2) * 60 }] }));
      const ids = new Set(result.particles.map(p => p.id));
      for (const particle of previous.particles) if (particle.id && !ids.has(particle.id)) {
        assert.ok(particle.opacity < .002, `Visible ${particle.source} cloud popped at opacity ${particle.opacity}`);
      }
      assert.equal(result.proof.liveSlotOverwrites, 0); previous = result;
    }
    if (capacity === 8) assert.ok(previous.proof.droppedBirths > 0, 'Saturation drops new births instead of old clouds');
  }
});

test('Default pool budget fits start-up, fast cruise and a station release without replacing live clouds', () => {
  for (const speed of [0, 1, 4, 8, 18]) {
    const engine = createSteamDynamics(); engine.update(view(0, moving(speed)(0)));
    const result = run(engine, 0, 10, t => ({ ...moving(speed)(t), station: { target: 0, remaining: 0 },
      events: [{ id: 1, type: 'doors-opening', tick: 1 }] }));
    assert.equal(result.proof.droppedBirths, 0, `Default ${speed} m/s scenario exceeds its birth budget`);
    assert.equal(result.proof.liveSlotOverwrites, 0);
  }
});
