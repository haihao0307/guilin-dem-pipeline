/* Ocean Mother O1A: read-only adapter for the verified Weather Mother clean API.
 * Owns no renderer, wave simulation, clock, density field, or weather controls.
 * Contract source: weather-mother/clean-v1/OCEAN_HANDOFF.md at PUBLICATION_REF.
 */
(function (root) {
  'use strict';
  const PUBLICATION_REF = '2619725efe236d2df8f2a55031bdae9e60a51555';
  const PACKAGE_VERSION = '1.0.0-clean';
  const CLOUD_GENERA = ['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs'];
  const WEATHER_CASES = ['fair','coast','mountain','rain','storm','rainbow','snow','high'];
  class BridgeError extends Error {
    constructor(code, message) { super(message); this.name = 'OceanBridgeError'; this.code = code; }
  }
  const reject = (code, message) => { throw new BridgeError(code, message); };
  function finite(value, label, min = -Infinity, max = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      reject('INVALID_ENVIRONMENT', 'Invalid ' + label);
    return value;
  }
  function vector(value, label, nonnegative = false) {
    if (!Array.isArray(value) || value.length !== 3) reject('INVALID_ENVIRONMENT', 'Invalid ' + label);
    return value.map((v, i) => finite(v, label + '[' + i + ']', nonnegative ? 0 : -Infinity));
  }
  function unit(value, label) {
    const v = vector(value, label);
    if (Math.abs(Math.hypot(...v) - 1) > 1e-6) reject('INVALID_ENVIRONMENT', label + ' is not a unit vector');
    return v;
  }
  function boolean(value, label) {
    if (typeof value !== 'boolean') reject('INVALID_ENVIRONMENT', 'Invalid ' + label);
    return value;
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  class EnvironmentBridge {
    /** provider: () => iframe.contentWindow.WeatherMother, from the same origin. */
    constructor(provider) {
      if (typeof provider !== 'function') throw new TypeError('A WeatherMother provider function is required');
      this.provider = provider;
      this.previous = null;
      this.source = null;
      this.epoch = 0;
      this.needsResync = false;
      this.disposed = false;
      this.lastError = null;
    }
    sample() {
      try { const frame = this.read(); this.lastError = null; return frame; }
      catch (error) {
        this.needsResync = true;
        const e = error instanceof BridgeError ? error : new BridgeError('SOURCE_UNAVAILABLE', error?.message ?? String(error));
        this.lastError = {code: e.code, message: e.message};
        throw e; // Never fabricate a replacement environment or return stale data as ready.
      }
    }
    read() {
      if (this.disposed) reject('DISPOSED', 'The Ocean Mother bridge has been disposed');
      const source = this.provider();
      if (!source || typeof source.getEnvironment !== 'function' || typeof source.getState !== 'function')
        reject('SOURCE_UNAVAILABLE', 'Weather Mother API is unavailable');
      if (source.packageVersion !== PACKAGE_VERSION || source.qa?.version !== PACKAGE_VERSION)
        reject('VERSION_MISMATCH', 'The frozen clean Weather Mother package is required');
      if (source.qa.ready !== true) reject('NOT_READY', 'Weather Mother is initializing');
      if (!Array.isArray(source.qa.errors) || source.qa.errors.length)
        reject('SOURCE_ERROR', 'Weather Mother reports a runtime error');
      const env = source.getEnvironment();
      const state = source.getState();
      if (!env || env.format !== 'weather-mother-environment' || env.schemaVersion !== 1)
        reject('SCHEMA_MISMATCH', 'Unsupported Weather Mother environment schema');
      if (env.units?.length !== 'metre' || env.units?.velocity !== 'metre/second' || env.units?.time !== 'simulation second')
        reject('UNITS_MISMATCH', 'The bridge requires the metre-based public API');
      if (env.axes?.east !== '+X' || env.axes?.up !== '+Y' || env.axes?.north !== '-Z')
        reject('AXES_MISMATCH', 'The bridge requires +X east, +Y up, -Z north');
      if (!state || finite(state.blend, 'state.blend', 0, 1) < 1 || source.qa.activeCloudKind !== env.cloud?.kind || source.qa.seed !== env.cloud?.seed)
        reject('SOURCE_TRANSITION', 'The requested cloud field is not active and settled');
      const time = finite(env.simulationSeconds, 'simulationSeconds', 0);
      const paused = boolean(env.paused, 'paused');
      const timeScale = finite(env.timeScale, 'timeScale', 0);
      const windDirection = unit(env.wind?.direction, 'wind.direction');
      const fromDegrees = finite(env.wind?.fromDegrees, 'wind.fromDegrees', 0, 360);
      const bearing = fromDegrees * Math.PI / 180;
      const expectedDirection = [-Math.sin(bearing), 0, Math.cos(bearing)];
      if (windDirection.some((v, i) => Math.abs(v - expectedDirection[i]) > 1e-6))
        reject('INVALID_ENVIRONMENT', 'Wind bearing disagrees with its direction vector');
      if (!CLOUD_GENERA.includes(env.cloud?.kind) || !WEATHER_CASES.includes(env.weather?.case))
        reject('INVALID_ENVIRONMENT', 'Unknown frozen cloud genus or weather case');
      if (!Array.isArray(env.limitations) || !env.limitations.every(v => typeof v === 'string'))
        reject('INVALID_ENVIRONMENT', 'Source limitations must be an array of strings');
      const windVelocity = vector(env.wind?.velocityMps, 'wind.velocityMps');
      const windForce = finite(env.wind?.forceMps, 'wind.forceMps', 0);
      const gust = finite(env.wind?.gustMultiplier, 'wind.gustMultiplier', 0);
      const cloudSpeed = finite(env.cloud?.driftMps, 'cloud.driftMps', 0);
      const cloudVelocity = vector(env.cloud?.velocityMps, 'cloud.velocityMps');
      const seed = finite(env.cloud?.seed, 'cloud.seed', 0, 4294967295);
      if (!Number.isInteger(seed)) reject('INVALID_ENVIRONMENT', 'cloud.seed must be uint32');
      for (let i = 0; i < 3; i++) {
        if (Math.abs(windVelocity[i] - windDirection[i] * windForce * gust) > 1e-6 ||
            Math.abs(cloudVelocity[i] - windDirection[i] * cloudSpeed * gust) > 1e-6)
          reject('INVALID_ENVIRONMENT', 'Wind/cloud velocity does not match the source contract');
      }
      const first = this.previous === null;
      const replaced = !first && source !== this.source;
      const backwards = !first && time < this.previous;
      const reset = first || replaced || backwards || this.needsResync;
      const resetReason = first ? 'initial' : replaced ? 'source-replaced' : backwards ? 'source-clock-rewind' : this.needsResync ? 'source-reacquired' : null;
      const nextEpoch = this.epoch + ((!first && reset) ? 1 : 0);
      const frame = {
        format: 'ocean-mother-environment-frame', schemaVersion: 1,
        source: {productionLine: 'Weather Mother', packageVersion: PACKAGE_VERSION, requiredPublicationRef: PUBLICATION_REF,
          runtimeByteIdentityVerified: false,
          identityMethod: 'runtime version only; deployment byte verification required separately', ready: true},
        units: {length: 'metre', velocity: 'metre/second', time: 'simulation second'},
        axes: {east: '+X', up: '+Y', north: '-Z'},
        clock: {simulationSeconds: time, deltaSimulationSeconds: reset ? 0 : time - this.previous,
          paused, timeScale, epoch: nextEpoch, discontinuity: reset, resetReason},
        hour: finite(env.hour, 'hour', 0, 24),
        wind: {fromDegrees, direction: windDirection,
          forceMps: windForce, gustMultiplier: gust, velocityMps: windVelocity},
        cloud: {kind: env.cloud.kind, seed, driftMps: cloudSpeed, velocityMps: cloudVelocity,
          offsetMetres: vector(env.cloud.offsetMetres, 'cloud.offsetMetres'), loopPhase: finite(env.cloud.loopPhase, 'cloud.loopPhase', 0, 1)},
        sun: {direction: unit(env.sun?.direction, 'sun.direction'), linearColor: vector(env.sun?.linearColor, 'sun.linearColor', true),
          intensity: finite(env.sun?.intensity, 'sun.intensity', 0), skylight: finite(env.sun?.skylight, 'sun.skylight', 0), exposure: finite(env.sun?.exposure, 'sun.exposure', 0)},
        weather: {case: env.weather?.case, rain: finite(env.weather?.rain, 'weather.rain', 0, 1),
          fog: finite(env.weather?.fog, 'weather.fog', 0, 1), snow: finite(env.weather?.snow, 'weather.snow', 0, 1),
          humidityPercent: finite(env.weather?.humidityPercent, 'weather.humidityPercent', 0, 100)},
        limitations: [...env.limitations],
        claims: {oceanRendererImplemented: false, sharedDepthImplemented: false, skyReflectionImplemented: false,
          visualAcceptance: false, productionReady: false}
      };
      // Commit history only after complete validation. The adapter never writes to source.
      this.previous = time; this.source = source; this.epoch = nextEpoch; this.needsResync = false;
      return freeze(frame);
    }
    resynchronize() {
      if (this.disposed) reject('DISPOSED', 'The Ocean Mother bridge has been disposed');
      this.needsResync = true;
    }
    dispose() {
      this.disposed = true; this.provider = null; this.source = null; this.previous = null;
      // Does not pause, dispose, or otherwise control the upstream weather workbench.
    }
  }
  const api = {EnvironmentBridge, BridgeError, PUBLICATION_REF, PACKAGE_VERSION};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OceanMotherBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
