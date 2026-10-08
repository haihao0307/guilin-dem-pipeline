#!/usr/bin/env node
'use strict';

/**
 * Numerical isolation of the R02 shadow-band mechanism.
 * Run from the experiment directory:
 *   node tests/shadow-isolation.cjs > tests/shadow-isolation-results.json
 *
 * This is a JavaScript double-precision model, NOT a browser/WebGL render.
 * It deliberately removes arches, pillars, textures, AO, camera marching,
 * antialiasing, and hyperbolic horizontal coordinates. Floor/ceiling distance
 * along the key-light ray is sufficient to reproduce the discontinuity.
 * It does not establish the final visual result or fidelity of object shadows.
 */

const assert = require('node:assert/strict');

const constants = Object.freeze({
  keyLightHeight: 3.86,
  ceilingHeight: 4.1,
  wallRadius: 7.4,
  floorRayStartHeight: 0.021,
  wallRayStartRadius: 7.38,
  initialTravel: 0.06,
  hitThreshold: 0.002,
  minimumStep: 0.045,
  maximumStep: 0.55,
  endMargin: 0.18,
  shadowFloor: 0.15,
  originalSoftCoefficient: 7,
  finiteEmitterRadius: 0.10,
  sampleSpacing: 0.001,
});

function shadow(radius, startHeight, options = {}) {
  const {
    includeCeiling = true,
    includeWall = false,
    coefficientMode = 'original',
    iterationBudget = 24,
    maximumStep = constants.maximumStep,
  } = options;
  const vertical = constants.keyLightHeight - startHeight;
  const total = Math.hypot(radius, vertical);
  const hs = radius / Math.max(total, 0.001);
  const vs = vertical / Math.max(total, 0.001);
  const coefficient = coefficientMode === 'finite-emitter'
    ? total / constants.finiteEmitterRadius
    : constants.originalSoftCoefficient;
  let travel = constants.initialTravel;
  let result = 1;
  let lastTravel = travel;
  let lastHeight = startHeight;
  let lastDistance = Infinity;
  let steps = 0;
  let exitReason = 'iteration-budget';
  for (let i = 0; i < iterationBudget; i += 1) {
    lastTravel = travel;
    lastHeight = startHeight + travel * vs;
    let sd = lastHeight;
    if (includeCeiling) sd = Math.min(sd, constants.ceilingHeight - lastHeight);
    if (includeWall) {
      // In this isolated radial ray, radius decreases by travel * hs.
      sd = Math.min(sd, constants.wallRadius - (radius - travel * hs));
    }
    lastDistance = sd;
    steps = i + 1;
    if (sd < constants.hitThreshold) {
      result = constants.shadowFloor;
      exitReason = 'hit';
      break;
    }
    result = Math.min(result, coefficient * sd / travel);
    travel += Math.min(maximumStep, Math.max(constants.minimumStep, sd));
    if (travel >= total - constants.endMargin) {
      exitReason = 'end-margin';
      break;
    }
  }
  return {
    shadow: Math.max(constants.shadowFloor, Math.min(1, result)),
    steps,
    lastTravel,
    lastHeight,
    lastDistance,
    total,
    exitReason,
  };
}

function scanFloor(options = {}) {
  return Array.from({ length: 7401 }, (_, index) => {
    const radius = index / 1000;
    return { position: radius, ...shadow(radius, constants.floorRayStartHeight, options) };
  });
}

function scanWall(options = {}) {
  return Array.from({ length: 4061 }, (_, index) => {
    const height = (20 + index) / 1000;
    return {
      position: height,
      ...shadow(constants.wallRayStartRadius, height, { ...options, includeWall: true }),
    };
  });
}

function summarize(samples) {
  let minShadow = Infinity;
  let maxShadow = -Infinity;
  let maximumAdjacentJump = 0;
  let maximumJumpPair = null;
  const exitCounts = { 'end-margin': 0, 'iteration-budget': 0, hit: 0 };
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    minShadow = Math.min(minShadow, sample.shadow);
    maxShadow = Math.max(maxShadow, sample.shadow);
    exitCounts[sample.exitReason] += 1;
    if (index > 0) {
      const difference = Math.abs(sample.shadow - samples[index - 1].shadow);
      if (difference > maximumAdjacentJump) {
        maximumAdjacentJump = difference;
        maximumJumpPair = { before: samples[index - 1], after: sample };
      }
    }
  }
  return {
    sampleCount: samples.length,
    from: samples[0].position,
    to: samples.at(-1).position,
    spacing: constants.sampleSpacing,
    minShadow,
    maxShadow,
    maximumAdjacentJump,
    maximumJumpPair,
    exitCounts,
  };
}

function maximumDifference(left, right) {
  assert.equal(left.length, right.length);
  return left.reduce((maximum, sample, index) =>
    Math.max(maximum, Math.abs(sample.shadow - right[index].shadow)), 0);
}

const originalFloor = scanFloor();
const originalWall = scanWall();
const withoutCeiling = scanFloor({ includeCeiling: false });
const finiteFloor = scanFloor({ coefficientMode: 'finite-emitter' });
const finiteWall = scanWall({ coefficientMode: 'finite-emitter' });
const budget96Floor = scanFloor({ iterationBudget: 96 });
const fineStepFloor = scanFloor({ iterationBudget: 256, maximumStep: 0.05 });

const scenarios = {
  originalFloor: summarize(originalFloor),
  originalWall: summarize(originalWall),
  withoutCeilingFloor: summarize(withoutCeiling),
  finiteEmitterFloor: summarize(finiteFloor),
  finiteEmitterWall: summarize(finiteWall),
  budget96Floor: summarize(budget96Floor),
  fineStepFloor: summarize(fineStepFloor),
};

const checks = {
  originalFloorHasLargeJump: scenarios.originalFloor.maximumAdjacentJump > 0.5,
  originalWallHasLargeJump: scenarios.originalWall.maximumAdjacentJump > 0.2,
  withoutCeilingIsFullyLit: withoutCeiling.every(sample => sample.shadow === 1),
  finiteEmitterFloorIsFullyLit: finiteFloor.every(sample => sample.shadow === 1),
  finiteEmitterWallIsFullyLit: finiteWall.every(sample => sample.shadow === 1),
  originalFloorNeverExhausts24Steps:
    scenarios.originalFloor.exitCounts['iteration-budget'] === 0,
  raisingBudget24To96HasNoEffect: maximumDifference(originalFloor, budget96Floor) === 0,
  reducingMaxStepDoesNotEliminateArtifact:
    scenarios.fineStepFloor.maximumAdjacentJump > 0.1,
};

for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);

const report = {
  schemaVersion: 1,
  title: 'R02 shadow-band numerical isolation',
  evidenceType: 'CPU numerical isolation, not actual browser visual proof',
  sourceReference: 'revisions/index-visual-r02.html, lines 75, 90, 97',
  sourceExpressions: [
    'ceiling distance: 4.1-y',
    'key light height: 3.86',
    'result=min(result,7.*sd/travel)',
    'travel+=clamp(sd,.045,.55)',
    'if(travel>=total-.18)break',
  ],
  scope: 'Only floor/ceiling and an optional radial wall; all other scene geometry and rendering stages omitted.',
  limitations: [
    'JavaScript double precision does not simulate GPU floating-point rounding.',
    'No browser, screenshot, WebGL, network, or source-file mutation is performed.',
    'The finite-emitter substitution is an isolated candidate test, not proof of final scene visual quality.',
    'Full-scene occluder shadows and residual AO artifacts require separate browser comparison.',
    'Some isolated wall rays exhaust 24 steps; the fully lit finite-emitter value is not proof that shadow marching reaches every light.',
  ],
  constants,
  candidateSubstitution: 'Replace only coefficient 7 with total/0.10; retain the original march and termination rules.',
  comparisons: {
    budget24Versus96MaximumShadowDifference: maximumDifference(originalFloor, budget96Floor),
    knownDiscontinuity: {
      before: { radius: 4.258, ...shadow(4.258, constants.floorRayStartHeight) },
      after: { radius: 4.259, ...shadow(4.259, constants.floorRayStartHeight) },
    },
  },
  scenarios,
  checks,
  passed: Object.values(checks).every(Boolean),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
