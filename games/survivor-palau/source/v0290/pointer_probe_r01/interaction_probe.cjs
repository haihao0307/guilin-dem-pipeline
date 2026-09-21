'use strict';

const DEFAULTS = Object.freeze({
  smoothing: 0.5,
  idleDelayMs: 60,
  idleDecayRate: 12,
  minimumSampleSeconds: 0.004,
  stopSpeed: 1e-4,
});

function finite3(v, label) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) {
    throw new TypeError(`${label} must be a finite [x,y,z] array`);
  }
  return v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function magnitude(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function clone3(v) {
  return [v[0], v[1], v[2]];
}

function createInteractionProbe(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  if (!(cfg.smoothing >= 0 && cfg.smoothing <= 1)) throw new RangeError('smoothing must be in [0,1]');
  if (!(cfg.idleDelayMs >= 0)) throw new RangeError('idleDelayMs must be >= 0');
  if (!(cfg.idleDecayRate >= 0)) throw new RangeError('idleDecayRate must be >= 0');
  if (!(cfg.minimumSampleSeconds > 0)) throw new RangeError('minimumSampleSeconds must be > 0');

  const probeId = options.probeId || 'smi-pointer-probe';
  const sourceKind = options.sourceKind || 'DIRECT_TOUCH_PROBE';

  let active = false;
  let pointerId = null;
  let worldPosition = [0, 0, 0];
  let worldVelocity = [0, 0, 0];
  let pressure = 0;
  let confidence = 0;
  let lastEventTimeMs = null;
  let lastWorldTime = null;

  function snapshot(worldTime = lastWorldTime ?? 0) {
    return Object.freeze({
      probeId,
      sourceKind,
      pointerId,
      active,
      worldPosition: clone3(worldPosition),
      worldVelocity: clone3(worldVelocity),
      worldTime,
      pressure,
      confidence,
    });
  }

  function sample({ worldPosition: nextPosition, eventTimeMs, worldTime, pointerId: nextPointerId = 0, pressure: nextPressure = 0.5, confidence: nextConfidence = 1 }) {
    finite3(nextPosition, 'worldPosition');
    if (!Number.isFinite(eventTimeMs)) throw new TypeError('eventTimeMs must be finite');
    if (!Number.isFinite(worldTime)) throw new TypeError('worldTime must be finite');

    const pointerChanged = pointerId !== null && nextPointerId !== pointerId;
    if (lastEventTimeMs === null || pointerChanged) {
      worldVelocity = [0, 0, 0];
    } else {
      const seconds = Math.max(cfg.minimumSampleSeconds, (eventTimeMs - lastEventTimeMs) / 1000);
      const instant = [
        (nextPosition[0] - worldPosition[0]) / seconds,
        (nextPosition[1] - worldPosition[1]) / seconds,
        (nextPosition[2] - worldPosition[2]) / seconds,
      ];
      worldVelocity = [
        lerp(worldVelocity[0], instant[0], cfg.smoothing),
        lerp(worldVelocity[1], instant[1], cfg.smoothing),
        lerp(worldVelocity[2], instant[2], cfg.smoothing),
      ];
    }

    pointerId = nextPointerId;
    active = true;
    worldPosition = clone3(nextPosition);
    pressure = Number.isFinite(nextPressure) ? Math.max(0, Math.min(1, nextPressure)) : 0;
    confidence = Number.isFinite(nextConfidence) ? Math.max(0, Math.min(1, nextConfidence)) : 0;
    lastEventTimeMs = eventTimeMs;
    lastWorldTime = worldTime;
    return snapshot(worldTime);
  }

  function advance({ dt, nowMs, worldTime }) {
    if (!Number.isFinite(dt) || dt < 0) throw new TypeError('dt must be finite and >= 0');
    if (!Number.isFinite(nowMs)) throw new TypeError('nowMs must be finite');
    if (!Number.isFinite(worldTime)) throw new TypeError('worldTime must be finite');

    if (lastEventTimeMs !== null && nowMs - lastEventTimeMs > cfg.idleDelayMs) {
      const decay = Math.exp(-cfg.idleDecayRate * dt);
      worldVelocity = worldVelocity.map((v) => v * decay);
      if (magnitude(worldVelocity) < cfg.stopSpeed) worldVelocity = [0, 0, 0];
    }
    lastWorldTime = worldTime;
    return snapshot(worldTime);
  }

  function cancel({ worldTime, pointerId: cancelPointerId = pointerId } = {}) {
    if (cancelPointerId !== pointerId && pointerId !== null) return snapshot(worldTime ?? lastWorldTime ?? 0);
    active = false;
    pressure = 0;
    confidence = 0;
    if (Number.isFinite(worldTime)) lastWorldTime = worldTime;
    return snapshot(lastWorldTime ?? 0);
  }

  function reset({ worldTime = 0 } = {}) {
    active = false;
    pointerId = null;
    worldPosition = [0, 0, 0];
    worldVelocity = [0, 0, 0];
    pressure = 0;
    confidence = 0;
    lastEventTimeMs = null;
    lastWorldTime = worldTime;
    return snapshot(worldTime);
  }

  return Object.freeze({ sample, advance, cancel, reset, snapshot, config: Object.freeze({ ...cfg }) });
}

module.exports = { createInteractionProbe };
