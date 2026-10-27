'use strict';

const assert = require('node:assert/strict');

// Source-derived model for trial/a4-r32-normal-chrome-20261027
// gpu-interval-runtime.js blob 9a3e04b76f2e6281d1feb8cb6b4f2bb9160cc101.
const DEPTH_MASK = 0x3f;
const STATUS_MASK = 0xc0;
const VISITED_MASK = 0x1fff; // 13 bits, enough for the frozen 4096 budget.
const REASON_SHIFT = 21;
const REASON_MASK = 0x7;

const STATUS = Object.freeze({
  ACTIVE: 0,
  HIT: 1,
  MISS: 2,
  EXHAUSTED: 3
});

const INVALID_REASON = Object.freeze({
  NONE: 0,
  NONFINITE_INTERVAL: 1,
  NONFINITE_FIELD: 2,
  UNCONVERGED_RESIDUAL: 3,
  INVALID_GRADIENT: 4,
  DOMAIN_MAYBE_NAN: 5
});

function packLegacy(depth, status, visited) {
  return (depth & DEPTH_MASK) | ((status & 3) << 6) | ((visited & VISITED_MASK) << 8);
}

function packCandidate(depth, status, visited, invalidReason) {
  return (
    packLegacy(depth, status, visited) |
    ((invalidReason & REASON_MASK) << REASON_SHIFT)
  ) >>> 0;
}

function decodeCurrent(meta) {
  return {
    depth: meta & DEPTH_MASK,
    status: (meta >>> 6) & 3,
    visited: meta >>> 8
  };
}

function decodeCandidate(meta) {
  return {
    depth: meta & DEPTH_MASK,
    status: (meta >>> 6) & 3,
    visited: (meta >>> 8) & VISITED_MASK,
    invalidReason: (meta >>> REASON_SHIFT) & REASON_MASK
  };
}

function preHitDecision({ finiteInterval, finiteField, residualOK, finiteGradient, gradientOK }) {
  if (!finiteInterval) return INVALID_REASON.NONFINITE_INTERVAL;
  if (!finiteField) return INVALID_REASON.NONFINITE_FIELD;
  if (!residualOK) return INVALID_REASON.UNCONVERGED_RESIDUAL;
  if (!finiteGradient || !gradientOK) return INVALID_REASON.INVALID_GRADIENT;
  return INVALID_REASON.NONE;
}

const checks = [];
function check(name, fn) {
  fn();
  checks.push({ name, status: 'PASS' });
}

check('two status bits are saturated by four operational states', () => {
  assert.deepEqual(Object.values(STATUS), [0, 1, 2, 3]);
});

check('legacy words leave bits 21..31 clear at the frozen budget', () => {
  const word = packLegacy(30, STATUS.EXHAUSTED, 4096);
  assert.equal(word >>> REASON_SHIFT, 0);
});

check('naively adding a high-bit reason corrupts the current visited decode', () => {
  const word = packCandidate(7, STATUS.MISS, 91, INVALID_REASON.INVALID_GRADIENT);
  assert.notEqual(decodeCurrent(word).visited, 91);
});

check('masking visited restores the exact node count', () => {
  const word = packCandidate(7, STATUS.MISS, 91, INVALID_REASON.INVALID_GRADIENT);
  assert.equal(decodeCandidate(word).visited, 91);
});

check('candidate reason round-trips through the existing 32-bit word', () => {
  for (let reason = 0; reason <= 5; reason++) {
    const decoded = decodeCandidate(packCandidate(30, STATUS.MISS, 4096, reason));
    assert.deepEqual(decoded, { depth: 30, status: STATUS.MISS, visited: 4096, invalidReason: reason });
  }
});

check('legacy words decode unchanged under the candidate decoder', () => {
  const legacy = packLegacy(12, STATUS.HIT, 387);
  assert.deepEqual(decodeCandidate(legacy), {
    depth: 12,
    status: STATUS.HIT,
    visited: 387,
    invalidReason: INVALID_REASON.NONE
  });
});

check('invalid gradient is rejectable before writing HIT', () => {
  const reason = preHitDecision({
    finiteInterval: true,
    finiteField: true,
    residualOK: true,
    finiteGradient: true,
    gradientOK: false
  });
  assert.equal(reason, INVALID_REASON.INVALID_GRADIENT);
  assert.notEqual(reason, INVALID_REASON.NONE);
});

check('a fully valid sample remains eligible for HIT', () => {
  assert.equal(preHitDecision({
    finiteInterval: true,
    finiteField: true,
    residualOK: true,
    finiteGradient: true,
    gradientOK: true
  }), INVALID_REASON.NONE);
});

check('budget exhaustion remains orthogonal to invalid reason', () => {
  const decoded = decodeCandidate(packCandidate(30, STATUS.EXHAUSTED, 4096, INVALID_REASON.NONE));
  assert.equal(decoded.status, STATUS.EXHAUSTED);
  assert.equal(decoded.visited, 4096);
});

const result = {
  status: 'PASS',
  conclusion: 'SPARE_BITS_EXIST_BUT_PHASE_AND_DECODE_CHANGES_REQUIRED',
  scope: 'Source-derived bit-packing and phase-contract replay; no browser/GPU pixels and no production implementation.',
  subject: {
    repository: 'haihao0307/guilin-dem-pipeline',
    branch: 'trial/a4-r32-normal-chrome-20261027',
    commit: '580acd1c8b851d0c843826e2b49c7079411473bd',
    runtimeBlob: '9a3e04b76f2e6281d1feb8cb6b4f2bb9160cc101'
  },
  checks,
  counts: { passed: checks.length, failed: 0 },
  currentLayout: {
    depth: 'bits 0..5',
    status: 'bits 6..7 (saturated)',
    visited: 'bits 8..20 by declared 13-bit contract',
    currentlyUnwritten: 'bits 21..31'
  },
  candidate: {
    operationalStatus: 'keep bits 6..7 unchanged',
    invalidReason: 'bits 21..23, values 0..7',
    mandatoryDecodeChange: 'visited = (meta >>> 8) & 0x1fff',
    mandatoryPhaseChange: 'validate gradient before committing HIT, or add a separate validity render/readback before visible tail submission'
  },
  boundary: {
    sourceConfirmed: 'The current 2-bit status cannot hold an invalid state. Spare high bits can hold an orthogonal reason only after visited masking.',
    phaseConfirmed: 'The current tail reads hitState textures and writes visible color after searchComplete; it has no state-output/readback path for INVALID_GRADIENT.',
    stillUnknown: 'Performance cost and real-device behavior of pre-hit gradient validation versus a separate validity pass.'
  }
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
