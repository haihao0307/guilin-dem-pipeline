'use strict';

/* Stone Money Island fishing core prototype.
 * Pure deterministic logic only: no renderer, no final species claim, no final tuning.
 * One fish identity crosses water -> air -> water without replacement.
 */

const VERSION = 'smi-fishing-core/0.1';
const EPS = 1e-9;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = v => Math.hypot(v[0], v[1], v[2]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = v => { const d = len(v); return d > EPS ? mul(v, 1 / d) : [0, 0, 0]; };
const finiteVector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

function defaultEnvironment() {
  return {
    surfaceAt(x, z, t) {
      return { eta: 0.06 * Math.sin(0.55 * x + 0.8 * t) + 0.03 * Math.cos(0.4 * z - 0.6 * t), normal: [0, 1, 0], surfaceVelocity: [0, 0, 0] };
    },
    currentAt() { return [0.05, 0, 0.02]; },
    snagAt() { return { contact: false, abrasionRate: 0 }; },
  };
}

function createFishingSession(options = {}) {
  const fishPosition = options.fishPosition || [7.5, -1.1, 0.5];
  const fishVelocity = options.fishVelocity || [0.2, 0, 0.1];
  const anchor = options.anchor || [0, 1.15, 0];
  if (!finiteVector(fishPosition) || !finiteVector(fishVelocity) || !finiteVector(anchor)) throw new TypeError('finite vec3 values required');
  const distance = len(sub(fishPosition, anchor));
  return {
    version: VERSION, sessionId: options.sessionId || 'fishing-session-01', time: Number(options.time || 0), phase: 'fight_underwater', outcome: null,
    rngState: (options.seed == null ? 0x6d2b79f5 : options.seed) >>> 0,
    fish: {
      fishId: options.fishId || 'fish-candidate-a-01', position: [...fishPosition], velocity: [...fishVelocity], orientation: [0, 0, 0, 1], angularVelocity: [0, 0, 0],
      medium: 'water', immersionFraction: 1, stamina: clamp(options.stamina == null ? 0.86 : options.stamina, 0, 1), stress: 0.35, hookHold: 1,
      massKg: options.massKg == null ? 1.4 : options.massKg, breachAllowed: options.breachAllowed !== false, behaviorState: 'fight_underwater'
    },
    line: {
      lineId: options.lineId || 'line-01', anchor: [...anchor], restLength: options.restLength == null ? distance + 0.35 : options.restLength,
      tension: 0, strength: options.lineStrength == null ? 19 : options.lineStrength, abrasion: 0, slackDuration: 0, hookSet: true
    },
    telemetry: { maxTension: 0, crossingJumpMax: 0, steps: 0 }, events: []
  };
}

function pushEvent(s, type, data = {}) { s.events.push({ index: s.events.length, time: Number(s.time.toFixed(6)), type, fishId: s.fish.fishId, ...data }); }
function random01(s) { let x = s.rngState >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rngState = x >>> 0; return s.rngState / 4294967296; }
function validateSession(s) {
  if (!s || s.version !== VERSION || !Number.isFinite(s.time)) throw new TypeError('invalid fishing session');
  if (!finiteVector(s.fish.position) || !finiteVector(s.fish.velocity) || !finiteVector(s.line.anchor)) throw new TypeError('invalid vector');
  if (!Number.isFinite(s.line.restLength) || s.line.restLength <= 0 || !Number.isFinite(s.line.strength) || s.line.strength <= 0) throw new TypeError('invalid line');
  return s;
}
function surfaceSample(env, p, t) {
  const q = env.surfaceAt(p[0], p[2], t); if (!q || !Number.isFinite(q.eta)) throw new Error('surfaceAt must return finite eta');
  return { eta: q.eta, normal: finiteVector(q.normal) ? norm(q.normal) : [0, 1, 0], surfaceVelocity: finiteVector(q.surfaceVelocity) ? q.surfaceVelocity : [0, 0, 0] };
}

function updateLine(s, input, dt, env) {
  const line = s.line;
  line.restLength = clamp(line.restLength + clamp(input.give || 0, 0, 1) * 1.5 * dt - clamp(input.reel || 0, 0, 1) * 1.1 * dt, 0.9, 80);
  const delta = sub(s.fish.position, line.anchor), distance = len(delta), dir = distance > EPS ? mul(delta, 1 / distance) : [0, 0, 0];
  const relativeSpeed = dot(s.fish.velocity, dir), stretch = Math.max(0, distance - line.restLength);
  line.tension = Math.max(0, stretch * 24 + Math.max(0, relativeSpeed) * 2.1);
  line.slackDuration = line.tension < 0.22 ? line.slackDuration + dt : Math.max(0, line.slackDuration - dt * 1.5);
  const snag = env.snagAt ? env.snagAt(s.fish.position, line.anchor, s.time) : null;
  if (snag && snag.contact) {
    line.abrasion = clamp(line.abrasion + Math.max(0, Number(snag.abrasionRate) || 0) * (0.25 + line.tension / Math.max(1, line.strength)) * dt, 0, 1.5);
    if (!s.events.length || s.events[s.events.length - 1].type !== 'snag_contact') pushEvent(s, 'snag_contact', { abrasion: line.abrasion });
  }
  s.telemetry.maxTension = Math.max(s.telemetry.maxTension, line.tension);
  if (line.tension >= line.strength * (1 - 0.55 * clamp(line.abrasion, 0, 1))) {
    s.phase = 'line_broken'; s.outcome = 'line_broken'; s.fish.behaviorState = 'escaped'; pushEvent(s, 'line_broken', { tension: line.tension, abrasion: line.abrasion });
    return { dir, force: [0, 0, 0] };
  }
  if (line.slackDuration > 2.4) {
    s.fish.hookHold = Math.max(0, s.fish.hookHold - dt * (0.22 + 0.08 * random01(s)));
    if (s.fish.hookHold <= 0) { s.phase = 'escaped'; s.outcome = 'escaped'; s.fish.behaviorState = 'escaped'; pushEvent(s, 'fish_escaped', { reason: 'prolonged_slack' }); }
  }
  return { dir, force: mul(dir, -line.tension / Math.max(0.1, s.fish.massKg)) };
}

function stepFishingSession(session, input = {}, env = defaultEnvironment(), dt = 1 / 60) {
  const s = validateSession(session); if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) throw new RangeError('dt must be in (0, 0.05]'); if (s.outcome) return s;
  const prevPos = [...s.fish.position], prevSurface = surfaceSample(env, prevPos, s.time), prevSigned = prevSurface.eta - prevPos[1];
  const lineResult = updateLine(s, input, dt, env); if (s.outcome) return s;
  const fish = s.fish, current = env.currentAt ? env.currentAt(fish.position[0], fish.position[1], fish.position[2], s.time) : [0, 0, 0];
  const fishSpeed = len(fish.velocity), phase = 0.83 * s.time + (s.rngState % 997) * 0.001, runDirection = norm([Math.sin(phase), 0, Math.cos(phase * 0.87)]), effort = 0.45 + 0.55 * fish.stamina;
  let acceleration;
  if (fish.medium === 'air') {
    acceleration = add(add(lineResult.force, [0, -9.81, 0]), mul(fish.velocity, -0.07)); fish.behaviorState = 'airborne';
  } else {
    const surface = surfaceSample(env, fish.position, s.time), preferredDepth = input.forceBreach && fish.breachAllowed && fish.stamina > 0.2 ? 0.04 : 0.85 + 0.18 * Math.sin(s.time * 0.55);
    const desiredY = surface.eta - preferredDepth, verticalControl = clamp((desiredY - fish.position[1]) * 3.5 - fish.velocity[1] * 1.7, -4.5, 8.5), burstUp = input.forceBreach && fish.breachAllowed ? 9.2 : 0;
    const swim = mul(runDirection, (2.0 + 3.0 * fish.stamina) * effort), flowPull = mul(sub(current, fish.velocity), 0.65);
    acceleration = add(add(add(add(swim, flowPull), lineResult.force), [0, verticalControl + burstUp, 0]), mul(fish.velocity, -0.42));
    fish.behaviorState = input.forceBreach ? 'surface_approach' : 'fight_underwater';
  }
  fish.velocity = add(fish.velocity, mul(acceleration, dt)); const speedLimit = fish.medium === 'air' ? 18 : 8.5, speed = len(fish.velocity); if (speed > speedLimit) fish.velocity = mul(fish.velocity, speedLimit / speed);
  fish.position = add(fish.position, mul(fish.velocity, dt)); s.time += dt;
  const nowSurface = surfaceSample(env, fish.position, s.time), signed = nowSurface.eta - fish.position[1];
  if (fish.medium === 'water' && prevSigned >= 0 && signed < 0 && fish.velocity[1] > 0.35 && fish.breachAllowed) {
    fish.medium = 'air'; fish.immersionFraction = 0; s.phase = 'airborne'; fish.behaviorState = 'airborne'; pushEvent(s, 'breach_begin', { position: [...fish.position], velocity: [...fish.velocity] });
  } else if (fish.medium === 'air' && prevSigned < 0 && signed >= 0 && fish.velocity[1] < 0) {
    const relative = sub(fish.velocity, nowSurface.surfaceVelocity), impactEnergy = 0.5 * fish.massKg * dot(relative, relative);
    fish.medium = 'water'; fish.immersionFraction = 1; fish.velocity = add(mul(fish.velocity, 0.46), mul(nowSurface.normal, 0.28)); s.phase = 'fight_underwater'; fish.behaviorState = 'recovery';
    fish.stamina = Math.max(0, fish.stamina - clamp(impactEnergy / 320, 0.025, 0.22)); pushEvent(s, 'splashdown', { position: [...fish.position], impactEnergy });
  } else fish.immersionFraction = fish.medium === 'water' ? clamp(signed / 0.35, 0, 1) : 0;
  if (fish.medium === 'air' && fish.velocity[1] < 0 && !s.events.some(e => e.type === 'breach_apex' && e.index > Math.max(0, s.events.length - 5))) pushEvent(s, 'breach_apex', { position: [...fish.position] });
  const exertion = (0.018 + 0.012 * fishSpeed + 0.012 * s.line.tension) * dt; fish.stamina = clamp(fish.stamina - exertion, 0, 1); fish.stress = clamp(fish.stress + (0.08 * s.line.tension - 0.02) * dt, 0, 1);
  const distanceToAnchor = len(sub(fish.position, s.line.anchor));
  if (fish.medium === 'water' && fish.stamina < 0.16 && distanceToAnchor < 1.85 && (input.lift || 0) > 0.7) { s.phase = 'landed'; s.outcome = 'landed'; fish.behaviorState = 'landed'; pushEvent(s, 'fish_landed', { position: [...fish.position] }); }
  const jump = len(sub(fish.position, prevPos)); s.telemetry.crossingJumpMax = Math.max(s.telemetry.crossingJumpMax, jump); s.telemetry.steps += 1; return s;
}

function cloneSession(session) { return JSON.parse(JSON.stringify(validateSession(session))); }
module.exports = { VERSION, createFishingSession, stepFishingSession, cloneSession, defaultEnvironment };
