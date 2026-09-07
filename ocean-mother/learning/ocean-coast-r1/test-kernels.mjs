import assert from 'node:assert/strict';
import {
  beamTransmittanceRGB,
  createDirectionalWave,
  evaluateParametricSurface,
  invertWorldXZ,
  isWet,
  sampleSurfaceWorld,
  waterDepthM,
} from './reference-kernels.mjs';

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function approx(actual, expected, tolerance = 1e-9, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, got ${actual}`,
  );
}

function vectorApprox(actual, expected, tolerance = 1e-9, message = '') {
  assert.equal(actual.length, expected.length, `${message} length`);
  for (let index = 0; index < actual.length; index += 1) {
    approx(actual[index], expected[index], tolerance, `${message}[${index}]`);
  }
}

const verticalWave = createDirectionalWave({
  amplitudeM: 0.8,
  wavelengthM: 11,
  directionRad: 0.37,
  phaseRad: 0.21,
  angularFrequencyRadPerS: 1.13,
  horizontalAmplitudeM: 0,
});

const displacedRecipe = {
  tideOffsetM: 0.35,
  waves: [
    createDirectionalWave({
      amplitudeM: 0.72,
      wavelengthM: 13,
      directionRad: 0.31,
      phaseRad: 0.19,
      angularFrequencyRadPerS: 1.07,
      horizontalAmplitudeM: 0.44,
    }),
    createDirectionalWave({
      amplitudeM: 0.26,
      wavelengthM: 6.5,
      directionRad: 1.77,
      phaseRad: 1.03,
      angularFrequencyRadPerS: 1.64,
      horizontalAmplitudeM: 0.12,
    }),
  ],
};

test('01 flat surface returns parameter coordinates in world space', () => {
  const surface = evaluateParametricSurface(4, -2, 3, { tideOffsetM: 1.25, waves: [] });
  vectorApprox(surface.positionM, [4, 1.25, -2]);
  vectorApprox(surface.normal, [0, 1, 0]);
});

test('02 zero horizontal displacement uses the direct inverse path', () => {
  const inverse = invertWorldXZ(2.4, -1.8, 0.7, { waves: [verticalWave] });
  assert.equal(inverse.method, 'direct-zero-horizontal-displacement');
  assert.equal(inverse.iterations, 0);
  vectorApprox(inverse.q, [2.4, -1.8]);
});

test('03 tide adds to the same free surface height', () => {
  const noTide = evaluateParametricSurface(1.2, 0.8, 0.4, { waves: [verticalWave] });
  const tide = evaluateParametricSurface(1.2, 0.8, 0.4, {
    tideOffsetM: 1.7,
    waves: [verticalWave],
  });
  approx(tide.heightM - noTide.heightM, 1.7);
});

test('04 an externally sampled tide state is used at the requested world time', () => {
  const absoluteTimeS = 2;
  const tideOffsetM = 0.1 * absoluteTimeS + 0.07;
  const surface = evaluateParametricSurface(5, -3, absoluteTimeS, { tideOffsetM, waves: [] });
  approx(surface.tideM, 0.27);
  approx(surface.heightM, 0.27);
});

test('05 parametric normal is unit length and points upward', () => {
  const surface = evaluateParametricSurface(0.7, 2.1, 1.2, displacedRecipe);
  approx(Math.hypot(...surface.normal), 1, 1e-12);
  assert.ok(surface.normal[1] > 0);
});

test('06 parametric velocity matches a centered finite difference', () => {
  const qx = 0.7;
  const qz = -1.1;
  const timeS = 1.35;
  const dt = 1e-5;
  const before = evaluateParametricSurface(qx, qz, timeS - dt, displacedRecipe).positionM;
  const after = evaluateParametricSurface(qx, qz, timeS + dt, displacedRecipe).positionM;
  const finiteDifference = after.map((value, index) => (value - before[index]) / (2 * dt));
  const analytic = evaluateParametricSurface(qx, qz, timeS, displacedRecipe).velocityMPerS;
  vectorApprox(analytic, finiteDifference, 2e-8, 'velocity');
});

test('07 forward and inverse horizontal mapping agree across a sample grid', () => {
  for (const timeS of [0, 0.7, 2.4]) {
    for (const qx of [-4, -1.25, 0.5, 3.8]) {
      for (const qz of [-3.1, 0.2, 2.7]) {
        const forward = evaluateParametricSurface(qx, qz, timeS, displacedRecipe);
        const inverse = invertWorldXZ(
          forward.positionM[0],
          forward.positionM[2],
          timeS,
          displacedRecipe,
        );
        assert.equal(inverse.converged, true);
        assert.ok(inverse.residualM <= 1e-9);
        vectorApprox(inverse.q, [qx, qz], 1e-8, 'inverse q');
      }
    }
  }
});

test('08 world query returns the same visible parametric point', () => {
  const forward = evaluateParametricSurface(1.75, -0.85, 0.93, displacedRecipe);
  const query = sampleSurfaceWorld(
    forward.positionM[0],
    forward.positionM[2],
    0.93,
    displacedRecipe,
  );
  assert.equal(query.queryConverged, true);
  assert.equal(query.approximate, false);
  vectorApprox(query.positionM, forward.positionM, 1e-8, 'world query');
});

test('09 world query residual reports horizontal agreement', () => {
  const sample = sampleSurfaceWorld(2.2, -1.7, 1.8, displacedRecipe);
  assert.ok(sample.queryResidualM <= 1e-9);
});

test('10 direct world-as-parameter sampling differs when horizontal displacement exists', () => {
  let maximumHeightError = 0;
  for (const worldX of [-3, -1, 0.5, 2.5, 4]) {
    for (const worldZ of [-2, 0.4, 2.2]) {
      const correct = sampleSurfaceWorld(worldX, worldZ, 1.15, displacedRecipe);
      const naive = evaluateParametricSurface(worldX, worldZ, 1.15, displacedRecipe);
      maximumHeightError = Math.max(maximumHeightError, Math.abs(correct.heightM - naive.heightM));
    }
  }
  assert.ok(maximumHeightError > 0.01, `expected a material error, got ${maximumHeightError}`);
});

test('11 setting horizontal amplitudes to zero restores direct query', () => {
  const zeroHorizontalRecipe = {
    ...displacedRecipe,
    waves: displacedRecipe.waves.map((wave) => ({ ...wave, horizontalAmplitudeM: 0 })),
  };
  const query = sampleSurfaceWorld(2.2, -1.7, 1.8, zeroHorizontalRecipe);
  assert.equal(query.queryMethod, 'direct-zero-horizontal-displacement');
  const direct = evaluateParametricSurface(2.2, -1.7, 1.8, zeroHorizontalRecipe);
  approx(query.heightM, direct.heightM);
});

test('12 query outputs horizontal displacement in metres', () => {
  const query = sampleSurfaceWorld(1.1, 0.6, 0.8, displacedRecipe);
  vectorApprox(
    query.horizontalDisplacementM,
    [query.positionM[0] - query.q[0], query.positionM[2] - query.q[1]],
  );
});

test('13 dry bed produces zero water depth', () => {
  approx(waterDepthM(1.0, 1.4), 0);
  assert.equal(isWet(1.0, 1.4), false);
});

test('14 submerged bed produces positive water depth', () => {
  approx(waterDepthM(1.0, -2.5), 3.5);
  assert.equal(isWet(1.0, -2.5), true);
});

test('15 wet epsilon creates a stable shoreline threshold', () => {
  assert.equal(isWet(1.0, 0.96, 0.05), false);
  assert.equal(isWet(1.0, 0.90, 0.05), true);
});

test('16 zero optical path returns full beam transmittance', () => {
  vectorApprox(beamTransmittanceRGB([0.1, 0.2, 0.3], [0.01, 0.02, 0.03], 0), [1, 1, 1]);
});

test('17 transmittance stays inside the physical unit interval', () => {
  const transmission = beamTransmittanceRGB([0.1, 0.2, 0.3], [0.01, 0.02, 0.03], 7);
  for (const value of transmission) {
    assert.ok(value > 0 && value <= 1);
  }
});

test('18 a longer path reduces transmittance for positive extinction', () => {
  const shortPath = beamTransmittanceRGB([0.1, 0.2, 0.3], [0.01, 0.02, 0.03], 2);
  const longPath = beamTransmittanceRGB([0.1, 0.2, 0.3], [0.01, 0.02, 0.03], 5);
  for (let index = 0; index < 3; index += 1) {
    assert.ok(longPath[index] < shortPath[index]);
  }
});

test('19 segmented homogeneous paths multiply to the full path', () => {
  const sigmaA = [0.08, 0.13, 0.21];
  const sigmaS = [0.02, 0.03, 0.04];
  const first = beamTransmittanceRGB(sigmaA, sigmaS, 2.25);
  const second = beamTransmittanceRGB(sigmaA, sigmaS, 4.75);
  const full = beamTransmittanceRGB(sigmaA, sigmaS, 7);
  vectorApprox(first.map((value, index) => value * second[index]), full, 1e-12);
});

test('20 zero extinction preserves light over a nonzero path', () => {
  vectorApprox(beamTransmittanceRGB([0, 0, 0], [0, 0, 0], 100), [1, 1, 1]);
});

test('21 invalid wavelength is rejected', () => {
  assert.throws(
    () => createDirectionalWave({
      amplitudeM: 1,
      wavelengthM: 0,
      directionRad: 0,
      angularFrequencyRadPerS: 1,
    }),
    /wavelengthM/,
  );
});

test('22 negative optical coefficients are rejected', () => {
  assert.throws(() => beamTransmittanceRGB([-0.1, 0, 0], [0, 0, 0], 1), /non-negative/);
});

test('23 a zero iteration budget reports an approximate result', () => {
  const inverse = invertWorldXZ(1.2, -0.8, 0.5, displacedRecipe, { maxIterations: 0 });
  assert.equal(inverse.converged, false);
  assert.equal(inverse.approximate, true);
  assert.ok(Number.isFinite(inverse.residualM));
});

test('24 repeated evaluation is deterministic for the same recipe and absolute time', () => {
  const first = sampleSurfaceWorld(-0.7, 2.9, 4.2, displacedRecipe);
  const second = sampleSurfaceWorld(-0.7, 2.9, 4.2, displacedRecipe);
  assert.deepEqual(first, second);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`not ok ${name}`);
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  }
}

console.log(JSON.stringify({ passed, failed: tests.length - passed, total: tests.length }));
