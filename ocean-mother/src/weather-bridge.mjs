/** Ocean Mother OM-001. Read-only Weather Mother Clean V1 environment adapter. */
export const WEATHER_BASELINE = Object.freeze({
  repository: 'haihao0307/guilin-dem-pipeline',
  startRef: 'c762658e22d76f9d833c726140831ed257162b75',
  deliveryRef: '2619725efe236d2df8f2a55031bdae9e60a51555',
  directory: 'weather-mother/clean-v1',
  packageVersion: '1.0.0-clean',
  renderBaseline: '0.6.2-loop',
});

function finite(value, name, minimum = -Infinity, maximum = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`Invalid Weather Mother ${name}`);
  }
}
function vector(value, name, unit = false) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`Invalid ${name}`);
  value.forEach((v, i) => finite(v, `${name}[${i}]`));
  if (unit && Math.abs(Math.hypot(...value) - 1) > 1e-6) throw new TypeError(`Non-unit ${name}`);
}
function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
export function validateEnvironment(e) {
  if (!e || e.format !== 'weather-mother-environment' || e.schemaVersion !== 1) {
    throw new TypeError('Unsupported Weather Mother environment format');
  }
  if (e.units?.length !== 'metre' || e.units?.velocity !== 'metre/second' ||
      e.units?.time !== 'simulation second') throw new TypeError('Weather Mother unit mismatch');
  if (e.axes?.east !== '+X' || e.axes?.up !== '+Y' || e.axes?.north !== '-Z') {
    throw new TypeError('Weather Mother coordinate-axis mismatch');
  }
  finite(e.simulationSeconds, 'simulationSeconds', 0);
  finite(e.hour, 'hour', 0, 24);
  finite(e.timeScale, 'timeScale', 0);
  if (typeof e.paused !== 'boolean') throw new TypeError('Invalid paused state');
  finite(e.wind?.fromDegrees, 'wind.fromDegrees', 0, 360);
  finite(e.wind?.forceMps, 'wind.forceMps', 0);
  finite(e.wind?.gustMultiplier, 'wind.gustMultiplier', 0);
  vector(e.wind?.direction, 'wind.direction', true);
  vector(e.wind?.velocityMps, 'wind.velocityMps');
  vector(e.cloud?.velocityMps, 'cloud.velocityMps');
  vector(e.cloud?.offsetMetres, 'cloud.offsetMetres');
  finite(e.cloud?.driftMps, 'cloud.driftMps', 0);
  finite(e.cloud?.loopPhase, 'cloud.loopPhase', 0, 1);
  finite(e.cloud?.seed, 'cloud.seed', 0, 4294967295);
  if (!Number.isInteger(e.cloud.seed)) throw new TypeError('Invalid cloud seed');
  if (!['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs'].includes(e.cloud.kind)) {
    throw new TypeError('Unsupported cloud genus');
  }
  vector(e.sun?.direction, 'sun.direction', true);
  vector(e.sun?.linearColor, 'sun.linearColor');
  e.sun.linearColor.forEach((v, i) => finite(v, `sun.linearColor[${i}]`, 0));
  ['intensity','skylight','exposure'].forEach(k => finite(e.sun?.[k], `sun.${k}`, 0));
  if (!['fair','coast','mountain','rain','storm','rainbow','snow','high'].includes(e.weather?.case)) {
    throw new TypeError('Unsupported weather case');
  }
  ['rain','fog','snow'].forEach(k => finite(e.weather?.[k], `weather.${k}`, 0, 1));
  finite(e.weather?.humidityPercent, 'weather.humidityPercent', 0, 100);
  for (let i = 0; i < 3; i++) {
    const expected = e.wind.direction[i] * e.wind.forceMps * e.wind.gustMultiplier;
    if (Math.abs(e.wind.velocityMps[i] - expected) > 1e-6) {
      throw new TypeError('Weather Mother wind velocity is inconsistent');
    }
  }
  return true;
}

/**
 * Read a same-window API or same-origin iframe.contentWindow.WeatherMother.
 * Never creates a renderer, advances a clock, changes controls, or scales SI units.
 * Each call obtains one complete snapshot from the frozen upstream exporter.
 */
export function createWeatherBridge(weatherMother) {
  if (!weatherMother || typeof weatherMother.getEnvironment !== 'function' ||
      weatherMother.packageVersion !== WEATHER_BASELINE.packageVersion) {
    throw new TypeError('Weather Mother Clean V1.0.0 API is required');
  }
  let previousSeconds = null;
  let disposed = false;
  return Object.freeze({
    sample() {
      if (disposed) throw new Error('Weather bridge is disposed');
      if (weatherMother.qa?.ready !== true) throw new Error('Weather Mother is not ready');
      if (weatherMother.qa.errors?.length) throw new Error('Weather Mother reports runtime errors');
      const source = weatherMother.getEnvironment();
      validateEnvironment(source);
      // Exported offsetMetres and velocityMps already use SI; do not multiply by 1000.
      const environment = JSON.parse(JSON.stringify(source));
      const rewound = previousSeconds !== null && environment.simulationSeconds < previousSeconds;
      const deltaSimulationSeconds = previousSeconds === null || rewound
        ? 0 : environment.simulationSeconds - previousSeconds;
      previousSeconds = environment.simulationSeconds;
      return freezeDeep({
        format: 'ocean-mother-weather-bridge', schemaVersion: 1,
        upstream: WEATHER_BASELINE, environment,
        deltaSimulationSeconds, clockRewound: rewound,
        // This is the sole wind input intended for subsequent wave forcing.
        waveWindVelocityMps: [...environment.wind.velocityMps],
        integration: {wavesImplemented: false, sharedCamera: false, sharedDepth: false,
          skyReflection: false, visualAcceptance: false, productionReady: false},
      });
    },
    resetClock() { if (disposed) throw new Error('Weather bridge is disposed'); previousSeconds = null; },
    dispose() { disposed = true; previousSeconds = null; },
  });
}
