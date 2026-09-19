/* SMI environment consumer bridge R01. Read-only: no clock, wave model, renderer or assets. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SMIEnvironmentBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'smi-environment-consumers/0.1';
  const ROLES = Object.freeze(['ocean', 'fish', 'coral', 'tree', 'game']);
  function number(v, label, lo = -Infinity, hi = Infinity) {
    if (!Number.isFinite(v) || v < lo || v > hi) throw new TypeError('Invalid ' + label);
    return v;
  }
  function text(v, label) {
    if (typeof v !== 'string' || !v.trim()) throw new TypeError('Missing ' + label);
    return v;
  }
  function vec(v, label) {
    if (!Array.isArray(v) || v.length !== 3) throw new TypeError('Invalid ' + label);
    return v.map((x, i) => number(x, label + '[' + i + ']'));
  }
  function unit(v, label) {
    const a = vec(v, label);
    if (Math.abs(Math.hypot(...a) - 1) > 1e-6) throw new TypeError('Non-unit ' + label);
    return a;
  }
  function freeze(v) {
    if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
    return v;
  }
  function sampleFrame(provider, options) {
    if (!provider || typeof provider.getEnvironment !== 'function') throw new TypeError('getEnvironment required');
    const frameId = text(options?.frameId, 'frameId');
    const sourceId = text(options?.sourceId, 'sourceId');
    const worldSeconds = number(options?.worldSeconds, 'worldSeconds', 0);
    // Exactly one provider read. Consumers never call getEnvironment or tick.
    const e = provider.getEnvironment();
    if (e?.format !== 'weather-mother-environment' || e.schemaVersion !== 1) throw new TypeError('Unsupported source schema');
    if (e.units?.length !== 'metre' || e.units.velocity !== 'metre/second' || e.units.time !== 'simulation second') throw new TypeError('Unsupported source units');
    if (e.axes?.east !== '+X' || e.axes.up !== '+Y' || e.axes.north !== '-Z') throw new TypeError('Unsupported source axes');
    const simulationSeconds = number(e.simulationSeconds, 'simulationSeconds', 0);
    if (typeof e.paused !== 'boolean') throw new TypeError('paused must be boolean');
    const clockErrorSeconds = simulationSeconds - worldSeconds;
    const diagnostics = [];
    if (Math.abs(clockErrorSeconds) > 1e-6) diagnostics.push('CLOCK_MISMATCH');
    return freeze({
      version: VERSION, frameId, sourceId,
      clock: { worldSeconds, simulationSeconds, errorSeconds: clockErrorSeconds,
        coherent: diagnostics.length === 0, paused: e.paused, sourceTimeScale: number(e.timeScale, 'timeScale', 0) },
      axes: { east: '+X', up: '+Y', north: '-Z' },
      wind: { velocityMps: vec(e.wind?.velocityMps, 'wind.velocityMps'),
        direction: unit(e.wind?.direction, 'wind.direction'),
        fromDegrees: number(e.wind?.fromDegrees, 'wind.fromDegrees'),
        meanSpeedMps: number(e.wind?.forceMps, 'wind.forceMps', 0),
        gustMultiplier: number(e.wind?.gustMultiplier, 'wind.gustMultiplier', 0) },
      cloud: { kind: text(e.cloud?.kind, 'cloud.kind'), seed: number(e.cloud?.seed, 'cloud.seed', 0),
        velocityMps: vec(e.cloud?.velocityMps, 'cloud.velocityMps'),
        offsetMetres: vec(e.cloud?.offsetMetres, 'cloud.offsetMetres'),
        loopPhase: number(e.cloud?.loopPhase, 'cloud.loopPhase', 0, 1) },
      sun: { direction: unit(e.sun?.direction, 'sun.direction'),
        linearColor: vec(e.sun?.linearColor, 'sun.linearColor'),
        intensity: number(e.sun?.intensity, 'sun.intensity', 0),
        skylight: number(e.sun?.skylight, 'sun.skylight', 0),
        exposure: number(e.sun?.exposure, 'sun.exposure', 0) },
      weather: { case: text(e.weather?.case, 'weather.case'),
        rainControl: number(e.weather?.rain, 'weather.rain', 0, 1),
        fogControl: number(e.weather?.fog, 'weather.fog', 0, 1),
        snowControl: number(e.weather?.snow, 'weather.snow', 0, 1),
        humidityPercent: number(e.weather?.humidityPercent, 'weather.humidityPercent', 0, 100) },
      physical: { rainfallMmPerHour: null, visibilityMetres: null, currentVelocityMps: null,
        tideMetres: null, waterTemperatureC: null, salinityPsu: null },
      diagnostics,
      limitations: [
        ...(Array.isArray(e.limitations) ? e.limitations.map(String) : []),
        'Read-only consumer bridge; not production renderer integration.',
        'Rain/fog controls are dimensionless; they do not establish rainfall or visibility.',
        'Wind velocity is not water current, tide, wave height or a force in newtons.',
        'Cloud drift may be independent of surface wind; no species response inferred.',
        'Clock mismatch is diagnosed, never hidden by retiming or advancing the provider.',
        'A frame serializes observations only, not the full Weather/Ocean simulation state.'
      ]
    });
  }
  function inputsFor(frame, role) {
    if (frame?.version !== VERSION || !ROLES.includes(role)) throw new TypeError('Unsupported frame or consumer');
    if (!frame.clock?.coherent) throw new Error('CLOCK_MISMATCH: align the authoritative owner before consuming');
    const shared = { version: VERSION, role, frameId: frame.frameId, sourceId: frame.sourceId, clock: frame.clock };
    if (role === 'ocean') return freeze({ ...shared, wind: frame.wind, sun: frame.sun, weather: frame.weather,
      requiredExternal: ['surfaceAt', 'sharedBed', 'waveState'] });
    if (role === 'tree') return freeze({ ...shared, wind: frame.wind, sun: frame.sun, weather: frame.weather,
      requiredExternal: ['plantGenerator', 'rootAnchors', 'speciesResponse'] });
    if (role === 'fish' || role === 'coral') return freeze({ ...shared, sun: frame.sun, weather: frame.weather,
      physical: frame.physical, requiredExternal: ['surfaceAt', 'currentAt', 'habitatAt', 'speciesResponse'] });
    return freeze({ ...shared, wind: frame.wind, sun: frame.sun, weather: frame.weather, physical: frame.physical,
      requiredExternal: ['shelterAt', 'visibilityAt', 'rainfallCalibration'] });
  }
  return Object.freeze({ VERSION, ROLES, sampleFrame, inputsFor });
});
