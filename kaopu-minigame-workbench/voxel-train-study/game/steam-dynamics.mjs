// Bounded visual model, not a fluid simulation or a measured reconstruction.
// Four exhaust beats per driving-wheel revolution assume two double-acting cylinders.
// Distances are metres; time comes only from the Session clock, never the camera.
export const STEAM_DYNAMICS_SPEC = Object.freeze({
  version: 'r14-stateful-steam', maxParticles: 160, upperParticles: 96,
  lowerParticles: 64, wheelRadius: .61, beatsPerRevolution: 4, fixedStep: 1 / 60,
  platformTop: .82, maximumLifetime: 5.2, maximumCatchUp: 1,
  chimney: Object.freeze([3.03, 3.72, 0]),
  cylinders: Object.freeze([Object.freeze([3.30, 1.06, -.965]), Object.freeze([3.30, 1.06, .965])]),
  warmCylinderSeconds: 5.4, warmTaperSeconds: 1.6, longStopSeconds: 12,
  stationReleaseSeconds: 3.8, stationJetSeconds: 1.45,
  brakeVisualSeconds: 4, brakeVisualCooldown: 6.5, brakeStopWindow: 8, brakeStopPuffSeconds: 1.35,
  assumptions: 'Four distance-driven beats assume two double-acting cylinders; station deck vapour and braking/stop vents are game choreography, not a claim that braking opens physical drain cocks. Plume dimensions and rates are bounded artistic parameters.'
});

const TAU = Math.PI * 2, EPS = 1e-8;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const finite = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const mix = (a, b, f) => a + (b - a) * f;
const hash = n => { let v = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
const point = (value, fallback) => Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite) ? value.slice(0, 3) : fallback.slice();

function snapshot(view = {}) {
  return {
    time: Math.max(0, finite(view.elapsed, finite(view.tick) / 30)),
    tick: Math.max(0, finite(view.tick)), distance: finite(view.distance),
    speed: clamp(finite(view.velocity), -20, 20), load: clamp(finite(view.throttle) / 3, 0, 1),
    brake: !!view.brake, paused: !!view.paused, phase: view.phase || 'running',
    enabled: view.started !== false && view.phase !== 'summary',
    seed: String(view.seed ?? ''),
    stationTarget: finite(view.station?.target, finite(view.distance) + finite(view.station?.remaining)),
    remaining: finite(view.station?.remaining), stationIndex: finite(view.station?.index),
    events: Array.isArray(view.events) ? view.events : []
  };
}

export function createSteamDynamics({ wheelRadius = .61, maxParticles = 160 } = {}) {
  const radius = clamp(finite(wheelRadius, .61), .1, 3);
  const capacity = clamp(Math.floor(finite(maxParticles, 160)), 8, 160);
  const upperCapacity = Math.round(capacity * .6), lowerCapacity = capacity - upperCapacity;
  const slots = new Array(capacity).fill(null);
  const emitters = { chimney: STEAM_DYNAMICS_SPEC.chimney.slice(), cylinders: STEAM_DYNAMICS_SPEC.cylinders.map(p => p.slice()) };
  let previous = null, simulated = null, cached = null, simTime = 0, generation = 0, serial = 0;
  let upperCursor = 0, lowerCursor = 0, upperCredit = 0, lowerCredit = 0, platformCredit = 0;
  let pulseCount = 0, framePulses = 0, lastPulseTime = -Infinity;
  let highestEventId = 0, seenFallback = [], stationSources = [], stationReleases = 0;
  let warmUntil = -Infinity, warmEligible = true, warmReleases = 0, stoppedFor = 0;
  let brakeSource = null, lastBrakeStart = -Infinity, brakeVisualReleases = 0, brakeStopPuffs = 0, lowerPoolPeak = 0;
  let emitted = { upper: 0, cylinder: 0, platform: 0 }, droppedBirths = 0, resetReason = 'initial';
  let latestResetReason = 'initial', resetCount = 0, lastResetTime = 0;

  function configure(input) {
    if (!input) return;
    emitters.chimney = point(input.chimney, emitters.chimney);
    if (Array.isArray(input.cylinders)) emitters.cylinders = emitters.cylinders.map((p, i) => point(input.cylinders[i], p));
    // Named points make integration with the body-local audio/model sockets simple.
    emitters.cylinders[0] = point(input.cylinderLeft, emitters.cylinders[0]);
    emitters.cylinders[1] = point(input.cylinderRight, emitters.cylinders[1]);
  }

  function rememberEvent(e) {
    if (Number.isFinite(Number(e.id))) {
      const id = Number(e.id);
      if (id <= highestEventId) return false;
      highestEventId = id;
      return true;
    }
    const key = `${e.type}:${e.tick}:${e.station ?? ''}`;
    if (seenFallback.includes(key)) return false;
    seenFallback.push(key); if (seenFallback.length > 256) seenFallback.shift();
    return true;
  }

  function clear(s, reason) {
    slots.fill(null); generation++; serial = 0; upperCursor = lowerCursor = 0;
    upperCredit = lowerCredit = platformCredit = 0; pulseCount = framePulses = 0;
    highestEventId = 0; seenFallback = []; stationSources = []; stationReleases = 0;
    warmUntil = lastPulseTime = -Infinity; warmReleases = 0; stoppedFor = 0;
    brakeSource = null; lastBrakeStart = -Infinity; brakeVisualReleases = brakeStopPuffs = lowerPoolPeak = 0;
    warmEligible = s.time < .1; emitted = { upper: 0, cylinder: 0, platform: 0 }; droppedBirths = 0;
    simTime = s.time; previous = simulated = s; cached = null; resetReason = latestResetReason = reason;
    lastResetTime = s.time;
    if (reason !== 'initial') resetCount++;
    // Old snapshots cannot replay historical releases or backfill missed exhaust beats.
    for (const e of s.events) rememberEvent(e);
  }

  function allocate(type, born, s, options = {}) {
    const upper = type === 'chimney';
    const start = upper ? upperCursor : lowerCursor, count = upper ? upperCapacity : lowerCapacity, offset = upper ? 0 : upperCapacity;
    let index = -1;
    // A live cloud owns its slot until it fades completely. Overflow drops only a NEW birth.
    for (let n = 0; n < count; n++) {
      const candidate = offset + (start + n) % count, old = slots[candidate];
      if (!old || born - old.born >= old.life - EPS) { index = candidate; break; }
    }
    if (index < 0) { droppedBirths++; return null; }
    if (upper) upperCursor = (index + 1) % count; else lowerCursor = (index - offset + 1) % count;
    const id = ++serial, a = hash(id * 5 + 1), b = hash(id * 5 + 2), c = hash(id * 5 + 3);
    const starting = Math.abs(s.speed) < 4.5 && s.load > 0;
    const source = options.position || (upper ? emitters.chimney : emitters.cylinders[options.side > 0 ? 1 : 0]);
    const p = {
      id: `${generation}:${id}`, index, upper, type, born, birthDistance: s.distance,
      birthPosition: source.slice(), speed: s.speed, load: s.load,
      starting, a, b, c, side: options.side || (b > .5 ? 1 : -1),
      residual: upper && !working(s),
      // Neighbouring births roll as a loose cloud family, instead of all following one pipe.
      billowPhase: hash(Math.floor(born / .72) + 817) * TAU,
      billowScale: hash(Math.floor(born / .72) + 223),
      energy: clamp(options.energy ?? (upper ? .3 + .7 * s.load : 1), .05, 1.4),
      pulse: !!options.pulse, eventId: options.eventId ?? null,
      reason: options.reason || (upper ? 'exhaust' : type === 'platform' ? 'station-choreography' : 'startup-warmup'),
      channel: options.channel || (upper ? 'upper-exhaust' : type === 'platform' || options.reason === 'station-choreography' ? 'station-visual' : 'startup-warmup'),
      releaseStage: options.releaseStage || null,
      life: upper ? (starting ? 4.6 : s.load > 0 ? 3.9 : 3.1) + b * .5 : type === 'platform' ? 3.5 + b * .7 : options.channel === 'brake-visual' ? 2.65 + b * .30 : 2.8 + b * .45
    };
    slots[index] = p;
    emitted[upper ? 'upper' : type === 'platform' ? 'platform' : 'cylinder']++;
    return p;
  }

  function sampleBetween(a, b, time) {
    const f = clamp((time - a.time) / Math.max(EPS, b.time - a.time), 0, 1);
    return { ...b, time, distance: mix(a.distance, b.distance, f), speed: mix(a.speed, b.speed, f) };
  }

  function working(s) { return s.enabled && !s.brake && s.load > 0 && Math.abs(s.speed) > .035; }

  function brakeVisual(time, held) {
    if (!brakeSource) return { strength: 0, stage: null, age: 0 };
    const age = time - brakeSource.start;
    const application = 1 - smooth(.75, 1.7, age);
    const sustain = held ? .52 * smooth(.8, 1.2, age) * (1 - smooth(3, STEAM_DYNAMICS_SPEC.brakeVisualSeconds, age)) : 0;
    const stopAge = brakeSource.stopAt === null ? Infinity : time - brakeSource.stopAt;
    const stop = stopAge >= 0 ? .94 * (1 - smooth(.45, STEAM_DYNAMICS_SPEC.brakeStopPuffSeconds, stopAge)) : 0;
    const strength = Math.max(0, application, sustain, stop);
    return { strength, age, stage: !strength ? null : stop > application && stop >= sustain ? 'stop-puff' : sustain > application ? 'held-brake' : 'brake-application' };
  }

  function receiveEvents(s) {
    // Session events are monotonically numbered and ordered. Retain only bounded source state.
    for (const e of s.events) {
      if (!rememberEvent(e)) continue;
      if (e.type !== 'approach-steam' && e.type !== 'doors-opening') continue;
      const age = Math.max(0, (s.tick - finite(e.tick, s.tick)) / 30);
      if (age > .5 || s.remaining < -12 || s.remaining > 65) continue;
      stationReleases++;
      stationSources.push({ id: e.id ?? `${e.type}:${e.tick}`, type: e.type, start: s.time - age, target: s.stationTarget });
      if (stationSources.length > 2) stationSources.shift();
    }
  }

  function step(a, b) {
    const dt = b.time - a.time, moving = Math.abs(b.speed) > .035;
    stoppedFor = moving ? 0 : stoppedFor + dt;
    if (stoppedFor >= STEAM_DYNAMICS_SPEC.longStopSeconds) warmEligible = true;
    if (working(b) && warmEligible && Math.abs(b.speed) < 4.5) {
      warmEligible = false; warmUntil = b.time + STEAM_DYNAMICS_SPEC.warmCylinderSeconds; warmReleases++;
    } else if (working(b) && Math.abs(b.speed) >= 4.5) warmEligible = false;

    // This is a requested cinematic channel. It neither changes Session braking nor opens physical drains.
    if (b.enabled && b.brake && !a.brake && Math.max(Math.abs(a.speed), Math.abs(b.speed)) > .35 && b.time - lastBrakeStart >= STEAM_DYNAMICS_SPEC.brakeVisualCooldown) {
      brakeSource = { start: b.time, stopAt: null }; lastBrakeStart = b.time; brakeVisualReleases++;
    }
    if (brakeSource && brakeSource.stopAt === null && b.brake && Math.abs(a.speed) > .08 && Math.abs(b.speed) <= .08 && b.time - brakeSource.start <= STEAM_DYNAMICS_SPEC.brakeStopWindow) {
      brakeSource.stopAt = b.time; brakeStopPuffs++;
    }
    if (brakeSource && b.time - brakeSource.start > STEAM_DYNAMICS_SPEC.brakeStopWindow + STEAM_DYNAMICS_SPEC.brakeStopPuffSeconds) brakeSource = null;

    // Crossings, rather than a time sine wave, keep the beats locked to the rods.
    const beatDistance = radius * TAU / 4, da = a.distance / beatDistance, db = b.distance / beatDistance;
    if (working(b) && Math.abs(b.distance - a.distance) > EPS) {
      const direction = db > da ? 1 : -1;
      const from = direction > 0 ? Math.floor(da + EPS) + 1 : Math.ceil(da - EPS) - 1;
      const to = direction > 0 ? Math.floor(db + EPS) : Math.ceil(db - EPS);
      for (let beat = from, budget = 0; direction > 0 ? beat <= to && budget < 8 : beat >= to && budget < 8; beat += direction, budget++) {
        const f = clamp((beat * beatDistance - a.distance) / (b.distance - a.distance), 0, 1);
        const time = mix(a.time, b.time, f), source = sampleBetween(a, b, time);
        pulseCount++; framePulses++; lastPulseTime = time;
        allocate('chimney', time, source, { pulse: true, energy: .70 + source.load * .55 });
      }
    }
    const work = working(b), residual = moving ? 1 : Math.exp(-stoppedFor / 2.8);
    const longestLife = Math.abs(b.speed) < 4.5 ? 5.1 : 4.4;
    const totalUpperRate = upperCapacity / (longestLife + .05) * .93;
    const beatRate = Math.abs(b.speed) / beatDistance;
    // Powered wheel beats consume the same budget as the continuous connecting plume.
    const coastRate = 7.8 + 1.8 * Math.sin(b.time * 1.3) + .6 * Math.sin(b.time * 3.7);
    const rate = !b.enabled && b.phase === 'ready' ? 1.4 * residual : work ? Math.max(0, totalUpperRate - beatRate) : (moving ? coastRate : 3.0) * residual;
    upperCredit += dt * rate;
    while (upperCredit >= 1) {
      upperCredit--; allocate('chimney', b.time, b, { energy: work ? .6 + b.load * .4 : .18 + .12 * residual });
    }
    if (!work && rate < .08) upperCredit = 0;

    stationSources = stationSources.filter(source => b.time - source.start < 8.1);
    const jet = stationSources.filter(source => b.time >= source.start && b.time - source.start < STEAM_DYNAMICS_SPEC.stationJetSeconds).at(-1);
    const stationEmitting = stationSources.some(source => b.time >= source.start && b.time - source.start < STEAM_DYNAMICS_SPEC.stationReleaseSeconds);
    const braking = brakeVisual(b.time, b.brake);
    const warming = b.time < warmUntil && !b.brake && !stationEmitting && Math.abs(b.speed) < 8;
    const liveLower = slots.slice(upperCapacity).filter(p => p && b.time - p.born < p.life).length;
    lowerPoolPeak = Math.max(lowerPoolPeak, liveLower);
    // Taper NEW emission before capacity is reached. Existing clouds always retain their full fade.
    const headroom = 1 - smooth(lowerCapacity * .78, lowerCapacity * .94, liveLower);
    // One bilateral outlet stream can serve overlapping visual requests without stacking hidden jets.
    if (braking.strength > 0 || jet || warming) {
      const isBrake = braking.strength > 0;
      const strength = isBrake ? braking.strength : jet ? 1 - smooth(.95, STEAM_DYNAMICS_SPEC.stationJetSeconds, b.time - jet.start) : (1 - smooth(warmUntil - STEAM_DYNAMICS_SPEC.warmTaperSeconds, warmUntil, b.time)) * (1 - smooth(4.5, 8, Math.abs(b.speed)));
      const rate = isBrake ? stationEmitting ? 10 : 18 : jet ? 12 : 16;
      lowerCredit += dt * rate * strength * lowerCapacity / 64 * headroom;
      while (lowerCredit >= 1) {
        lowerCredit--;
        allocate('cylinder', b.time, b, { side: emitted.cylinder % 2 ? 1 : -1, energy: .78 * strength + .18,
          reason: isBrake ? 'brake-choreography' : jet ? 'station-choreography' : 'startup-warmup',
          channel: isBrake ? 'brake-visual' : jet ? 'station-visual' : 'startup-warmup',
          releaseStage: isBrake ? braking.stage : null, eventId: jet?.id });
      }
    } else lowerCredit = 0;

    const source = stationSources.filter(source => b.time >= source.start && b.time - source.start < STEAM_DYNAMICS_SPEC.stationReleaseSeconds).at(-1);
    if (source) {
      const age = b.time - source.start;
      platformCredit += dt * (braking.strength > 0 ? 8 : 16) * (1 - smooth(2.8, 3.8, age)) * lowerCapacity / 64 * headroom;
      while (platformCredit >= 1) {
        platformCredit--; const seed = hash((serial + 1) * 7), spread = Math.min(26, 3 + age * 12);
        const position = [source.target - b.distance - 2 - seed * spread, STEAM_DYNAMICS_SPEC.platformTop + .36 + hash(serial + 67) * .24, 2.25 + hash(serial + 19) * 1.25];
        allocate('platform', b.time, b, { position, side: 1, energy: .88, eventId: source.id });
      }
    } else platformCredit = 0;
  }

  function visible(p, s) {
    const age = s.time - p.born, f = age / p.life;
    if (age < -EPS || f >= 1) return null;
    const q = Math.max(0, age), phase = p.a * TAU, core = smooth(.12, 1.55, q);
    const travelled = s.distance - p.birthDistance;
    let x, y, z, size, opacity, color;
    if (p.upper) {
      const billow = smooth(.45, 1.4, q), group = p.billowPhase, roll = group + q * 1.45;
      const curl = billow * (.30 + q * .58) * (.82 + p.billowScale * .36);
      const carry = p.speed * .92 * 2.4 * (1 - Math.exp(-q / 2.4)) * (1 + .07 * billow * Math.sin(group * .61));
      const fineCurl = Math.min(1, q) * (.045 + q * .065);
      const riseSpeed = (p.starting ? 3.8 : 3.2) * (.65 + p.energy * .35) * (.88 + p.billowScale * .24);
      // Velocity decreases with altitude; no quadratic upward acceleration stretches a pipe.
      const rise = riseSpeed * (.58 * q + .92 * (1 - Math.exp(-q / 1.2)));
      x = p.birthPosition[0] - travelled + carry - q * .24 + Math.sin(roll) * curl + Math.sin(phase + q * 2) * fineCurl;
      y = p.birthPosition[1] + rise + Math.sin(roll + .65) * curl * .46 + Math.sin(phase + q * 2.5) * fineCurl;
      z = p.birthPosition[2] + Math.cos(roll) * curl + (p.b - .5) * billow * q * .36 + Math.sin(phase + q * 2.2) * fineCurl;
      const earlySpread = 2.1 * smooth(.40, 1.50, q);
      const lobe = 1 + billow * (.16 * Math.sin(group + q * .65) + (p.a - .5) * .15);
      size = clamp((.30 + q * (.95 + p.energy * .25) + earlySpread + q * q * .065) * lobe, .28, 8.2);
      const density = p.residual ? .13 + p.energy * .10 : .46 + p.energy * .28;
      opacity = density * smooth(0, .055, q) * (1 - smooth(p.residual ? .36 : .62, 1, f));
      // Birth energy survives throttle changes; each released puff lightens on its own clock.
      const dark = .31 + (1 - p.energy) * .20;
      const mature = p.residual ? .60 + p.billowScale * .045 : .755 + p.billowScale * .055;
      color = [mix(dark, mature, core), mix(dark + .015, mature + .01, core), mix(dark + .025, mature + .015, core)];
    } else if (p.type === 'cylinder') {
      const lateral = 2.5 * (1 - Math.exp(-q * 1.25));
      const rearwardSweep = p.reason === 'station-choreography' ? q * 1.8 : q * .23;
      x = p.birthPosition[0] - travelled + p.speed * .32 * (1 - Math.exp(-q)) - rearwardSweep;
      y = p.birthPosition[1] + q * .30 + Math.sin(phase + q * 2.5) * .11 * Math.min(1, q);
      z = p.birthPosition[2] + p.side * lateral + Math.sin(phase + q * 2.8) * .16 * Math.min(1, q);
      size = .35 + q * 1.23;
      opacity = .78 * p.energy * smooth(0, .06, q) * (1 - smooth(.42, 1, f));
      color = [.96, .975, 1];
    } else {
      x = p.birthPosition[0] - travelled - q * .15 + Math.sin(phase + q * 1.8) * .19 * Math.min(1, q);
      y = p.birthPosition[1] + q * .22 + Math.sin(phase + q * 2.2) * .10 * Math.min(1, q);
      z = p.birthPosition[2] + q * .26 + Math.sin(phase + q * 2.0) * .23 * Math.min(1, q);
      size = .88 + q * 1.02;
      opacity = .76 * smooth(0, .08, q) * (1 - smooth(.48, 1, f));
      color = [.97, .985, 1];
    }
    // Normalized sRGB colour; the renderer converts to linear before its output/ACES pipeline.
    return { index: p.index, id: p.id, upper: p.upper, lower: !p.upper, source: p.type,
      position: [x, y, z], size, opacity: clamp(opacity, 0, 1), color: color.map(c => clamp(c, 0, 1)),
      rotation: phase + q * (p.upper ? .8 : 1.05) * p.side, age: q, f,
      birthTime: p.born, birthDistance: p.birthDistance, birthPosition: p.birthPosition.slice(),
      birthLoad: p.load, pulse: p.pulse, eventId: p.eventId, reason: p.reason, residual: p.residual,
      channel: p.channel, releaseStage: p.releaseStage };
  }

  function render(s) {
    const particles = slots.map((p, index) => (p && visible(p, s)) || { index, id: null, upper: index < upperCapacity, lower: index >= upperCapacity, source: 'inactive', position: [0, 0, 0], size: 0, opacity: 0, rotation: 0, color: [1, 1, 1] });
    const active = particles.filter(p => p.opacity > .0001);
    const bounds = list => !list.length ? null : {
      min: [0, 1, 2].map(axis => Math.min(...list.map(p => p.position[axis]))),
      max: [0, 1, 2].map(axis => Math.max(...list.map(p => p.position[axis]))),
      maxSize: Math.max(...list.map(p => p.size))
    };
    const source = stationSources.at(-1), burstAge = source ? s.time - source.start : 99;
    const burstActive = !!source && burstAge >= 0 && burstAge < 8.1;
    const stationJetsActive = !!source && burstAge >= 0 && burstAge < STEAM_DYNAMICS_SPEC.stationJetSeconds;
    const braking = brakeVisual(s.time, s.brake), brakeVisualActive = braking.strength > 0;
    const warmActive = s.time < warmUntil && !s.brake && !brakeVisualActive && Math.abs(s.speed) < 8 && !(burstActive && burstAge < STEAM_DYNAMICS_SPEC.stationReleaseSeconds);
    const state = { profile: STEAM_DYNAMICS_SPEC.version, tallExhaust: true, roundBillboards: true,
      working: working(s), starting: working(s) && Math.abs(s.speed) < 4.5, exhaustSpeed: Math.abs(s.speed),
      stoppedFor, residual: Math.exp(-stoppedFor / 2.8), draining: warmActive,
      cylinderReleaseReason: brakeVisualActive ? 'brake-choreography' : stationJetsActive ? 'station-choreography' : warmActive ? 'startup-warmup' : null,
      cylinderJetsActive: brakeVisualActive || stationJetsActive || warmActive, stationJetsActive,
      brakeVisualActive, brakeVisualStage: braking.stage, brakeVisualStrength: braking.strength,
      brakeVisualIsChoreography: true, physicalDrainOpenedByBrake: false,
      burstAge, burstActive, burst: burstActive ? 1 - smooth(3.8, 8.1, burstAge) : 0,
      platformOffset: s.remaining, platformTop: STEAM_DYNAMICS_SPEC.platformTop,
      platformCentersAboveDeck: active.some(p => p.source === 'platform'),
      stationReleaseIsChoreography: true, ordinaryBrakeOpensDrain: false,
      wheelAngle: -s.distance / radius, exhaustPhase: ((s.distance / radius) % TAU + TAU) % TAU,
      pulseStrength: working(s) ? Math.exp(-(s.time - lastPulseTime) / .13) : 0,
      paused: s.paused, generation };
    const proof = { version: STEAM_DYNAMICS_SPEC.version, assumptions: STEAM_DYNAMICS_SPEC.assumptions,
      poolSize: capacity, upperCapacity, lowerCapacity, activeParticles: active.length,
      upperActive: active.filter(p => p.upper).length, lowerActive: active.filter(p => !p.upper).length,
      cylinderActive: active.filter(p => p.source === 'cylinder').length, platformActive: active.filter(p => p.source === 'platform').length,
      pulseCount, framePulses, beatsPerRevolution: 4, wheelRadius: radius, wheelAngle: state.wheelAngle,
      warmReleases, stationReleases, brakeVisualReleases, brakeStopPuffs,
      brakeVisualParticles: active.filter(p => p.channel === 'brake-visual').length,
      brakeVisualCooldownRemaining: Math.max(0, STEAM_DYNAMICS_SPEC.brakeVisualCooldown - (s.time - lastBrakeStart)),
      brakeVisualAge: braking.age, lowerPoolPeak,
      lowerChannelCounts: { warmup: active.filter(p => p.channel === 'startup-warmup').length, station: active.filter(p => p.channel === 'station-visual').length, braking: active.filter(p => p.channel === 'brake-visual').length },
      highestEventId, rememberedEvents: seenFallback.length,
      stationSourceCount: stationSources.length, emitted: { ...emitted }, droppedBirths, liveSlotOverwrites: 0,
      geometryBounds: { upper: bounds(active.filter(p => p.upper)), cylinder: bounds(active.filter(p => p.source === 'cylinder')), platform: bounds(active.filter(p => p.source === 'platform')) },
      emitters: { chimney: emitters.chimney.slice(), cylinders: emitters.cylinders.map(p => p.slice()) },
      resetReason, latestResetReason, resetCount, lastResetTime, generation, fixedStep: STEAM_DYNAMICS_SPEC.fixedStep,
      simulationTime: simTime, sessionTime: s.time, historicalBirthPositions: true, cameraIndependent: true };
    resetReason = null;
    return { particles, state, proof };
  }

  return {
    update(view = {}, { emitters: inputEmitters } = {}) {
      configure(inputEmitters);
      const s = snapshot(view);
      if (!previous) { clear(s, 'initial'); cached = render(s); return cached; }
      const delta = s.time - previous.time;
      let reason = null;
      if (s.seed !== previous.seed) reason = 'session-changed';
      else if (delta < -EPS || s.tick < previous.tick) reason = 'time-rewound';
      else if (delta > STEAM_DYNAMICS_SPEC.maximumCatchUp + EPS) reason = 'time-jump';
      else if (Math.abs(s.distance - previous.distance) > 2 + 25 * Math.max(0, delta)) reason = 'distance-jump';
      if (reason) { clear(s, reason); cached = render(s); return cached; }
      if (Math.abs(delta) <= EPS) {
        // No emission or motion on repeated Session ticks; one-frame telemetry cannot replay either.
        cached = { ...cached, state: { ...cached.state, paused: s.paused }, proof: { ...cached.proof, framePulses: 0, resetReason: null } };
        return cached;
      }
      framePulses = 0;
      receiveEvents(s);
      // Fixed scheduling gives 30/60 Hz callers identical emission slots and no catch-up backlog.
      while (simTime + STEAM_DYNAMICS_SPEC.fixedStep <= s.time + EPS) {
        const b = sampleBetween(previous, s, simTime + STEAM_DYNAMICS_SPEC.fixedStep);
        step(simulated, b); simulated = b; simTime += STEAM_DYNAMICS_SPEC.fixedStep;
      }
      previous = s; cached = render(s); return cached;
    },
    reset(view, options = {}) {
      if (view === undefined) { previous = cached = null; slots.fill(null); return; }
      configure(options.emitters); const s = snapshot(view); clear(s, 'explicit-reset'); cached = render(s); return cached;
    }
  };
}
