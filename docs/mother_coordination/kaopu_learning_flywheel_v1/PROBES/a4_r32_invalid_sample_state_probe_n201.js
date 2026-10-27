'use strict';

const assert = require('node:assert/strict');

// Semantic replay of the exact control predicates inspected at R32 commit
// 580acd1c8b851d0c843826e2b49c7079411473bd. This does not claim browser/GPU
// pixel evidence; it isolates state-classification behavior.
const statusNames = ['active', 'hit', 'miss', 'exhausted'];

function intervalDecision(rangeLower, width, leafField) {
  let descend = false;
  let hit = false;
  if (!(rangeLower > 0)) {
    if (width < 0.0005) {
      if (leafField <= 0.0005) hit = true;
    } else {
      descend = true;
    }
  }
  return { descend, hit, terminal: hit ? 'hit' : descend ? 'active' : 'miss' };
}

function normalize3(v) {
  const length = Math.hypot(...v);
  return v.map(x => x / length);
}

const checks = [];
function check(name, fn) {
  fn();
  checks.push({ name, status: 'PASS' });
}

check('status vocabulary has no invalid-nonfinite or invalid-gradient state', () => {
  assert.deepEqual(statusNames, ['active', 'hit', 'miss', 'exhausted']);
  assert.equal(statusNames.some(x => x.startsWith('invalid')), false);
});

check('NaN interval lower bound descends instead of becoming invalid', () => {
  assert.deepEqual(intervalDecision(Number.NaN, 0.01, 1), {
    descend: true,
    hit: false,
    terminal: 'active'
  });
});

check('NaN leaf field cannot become hit', () => {
  assert.deepEqual(intervalDecision(Number.NaN, 0.0001, Number.NaN), {
    descend: false,
    hit: false,
    terminal: 'miss'
  });
});

check('finite positive interval lower bound remains miss', () => {
  assert.equal(intervalDecision(0.2, 0.01, -1).terminal, 'miss');
});

check('finite valid leaf remains hit', () => {
  assert.equal(intervalDecision(-0.2, 0.0001, 0.0004).terminal, 'hit');
});

check('zero finite-difference gradient normalizes to non-finite components', () => {
  assert.equal(normalize3([0, 0, 0]).every(Number.isFinite), false);
});

check('non-finite gradient normalizes to non-finite components', () => {
  assert.equal(normalize3([Number.NaN, 1, 1]).every(Number.isFinite), false);
});

check('budget exhaustion is distinguishable and therefore a positive control', () => {
  assert.equal(statusNames[3], 'exhausted');
});

const result = {
  status: 'PASS',
  conclusion: 'SOURCE-PATH-CONFIRMED_STATE_COLLAPSE',
  scope: 'Exact predicate semantic replay only; not browser/GPU pixel evidence and not user-device root-cause proof.',
  subject: {
    repository: 'haihao0307/guilin-dem-pipeline',
    branch: 'trial/a4-r32-normal-chrome-20261027',
    commit: '580acd1c8b851d0c843826e2b49c7079411473bd',
    runtimeBlob: '9a3e04b76f2e6281d1feb8cb6b4f2bb9160cc101',
    appBlob: '0139cc195c164574bd94a9a8cb0bce444076c686'
  },
  checks,
  counts: { passed: checks.length, failed: 0 },
  boundary: {
    sourceConfirmed: 'Non-finite interval/leaf samples have no invalid state; a NaN leaf can terminate as miss. Zero/non-finite gradients reach normalization without a finite/magnitude guard.',
    preservedPositiveControl: 'Interval-node budget exhaustion has an explicit exhausted state and is rejected at frame level.',
    stillUnknown: 'Whether these paths caused the observed black-point/flicker symptom on a real browser/device.'
  }
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
