import assert from 'node:assert/strict';

const expectedControls = ['toggleEngine', 'toggleBrake', 'stationAction', 'doorLeft', 'doorRight'];
const expectedPositions = ['center', 'left', 'right', 'top', 'bottom', 'label'];
const expectedCaseKeys = expectedControls.flatMap(control =>
  expectedPositions.map(position => `${control}:${position}`)
);

const observed = {
  headSha: '9ee080929f7311562811b422a218b9e3f7567fb7',
  run: {
    id: 37870709681,
    event: 'push',
    conclusion: 'success',
    url: 'https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37870709681'
  },
  publicBase: 'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/',
  viewport: { width: 2048, height: 1026 },
  hudRefreshesBetweenDownAndUp: 5,
  browsers: {
    chromium: {
      jobId: 113627902996,
      conclusion: 'success',
      artifact: {
        id: 11590631129,
        digest: 'sha256:d52ec986c6980d076b354162e1634322afcf1921ec5e5a8695afceadb15a6229'
      },
      casesPresent: [...expectedCaseKeys],
      semanticPassKeys: [...expectedCaseKeys],
      pageErrors: []
    },
    webkit: {
      jobId: 113627903151,
      conclusion: 'success',
      artifact: {
        id: 11590910093,
        digest: 'sha256:704ffda332e25c8260632d6e3871c85a19ddf98d630574711234992b60555796'
      },
      casesPresent: [...expectedCaseKeys],
      semanticPassKeys: expectedCaseKeys.filter(key => key !== 'stationAction:label'),
      pageErrors: [],
      semanticFailures: [{
        key: 'stationAction:label',
        targetClosest: 'stationAction',
        events: ['pointerdown', 'mousedown', 'pointerup', 'mouseup'],
        clickObserved: false,
        before: { phase: 'running', canOpen: true, remaining: 0.2, disabled: false },
        after: { phase: 'running' },
        expectedAfter: { phase: 'doors-opening' }
      }]
    }
  },
  workflowAssertion: {
    asserted: 'errors=[]',
    perCaseSemanticExpectationAsserted: false,
    clickPresenceAsserted: false
  }
};

function evaluateBrowser(record) {
  if (record.conclusion !== 'success') return 'HOLD_DIAGNOSTIC_PROCESS_FAILED';
  const present = new Set(record.casesPresent ?? []);
  if (expectedCaseKeys.some(key => !present.has(key))) {
    return 'HOLD_DIAGNOSTIC_RECORD_INCOMPLETE';
  }
  const passed = new Set(record.semanticPassKeys ?? []);
  if (expectedCaseKeys.some(key => !passed.has(key))) {
    return 'HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED';
  }
  return 'MOUSE_SEMANTICS_VERIFIED_SCOPED';
}

function evaluateAggregate(receipt) {
  const browserRecords = Object.values(receipt.browsers ?? {});
  if (browserRecords.length !== 2) return 'HOLD_DIAGNOSTIC_RECORD_INCOMPLETE';
  const states = browserRecords.map(evaluateBrowser);
  if (states.includes('HOLD_DIAGNOSTIC_RECORD_INCOMPLETE')) {
    return 'HOLD_DIAGNOSTIC_RECORD_INCOMPLETE';
  }
  if (states.some(state => state !== 'MOUSE_SEMANTICS_VERIFIED_SCOPED')) {
    return 'HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED';
  }
  return 'MOUSE_SEMANTICS_VERIFIED_SCOPED';
}

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check('binds the event-complete push run and exact head', () => {
  assert.equal(observed.run.event, 'push');
  assert.equal(observed.run.id, 37870709681);
  assert.equal(observed.headSha, '9ee080929f7311562811b422a218b9e3f7567fb7');
});
check('binds both successful jobs without promoting their process state', () => {
  assert.equal(observed.browsers.chromium.conclusion, 'success');
  assert.equal(observed.browsers.webkit.conclusion, 'success');
  assert.equal(observed.browsers.chromium.jobId, 113627902996);
  assert.equal(observed.browsers.webkit.jobId, 113627903151);
});
check('binds both immutable artifact receipts', () => {
  assert.equal(observed.browsers.chromium.artifact.id, 11590631129);
  assert.equal(observed.browsers.webkit.artifact.id, 11590910093);
  assert.match(observed.browsers.chromium.artifact.digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(observed.browsers.webkit.artifact.digest, /^sha256:[a-f0-9]{64}$/);
});
check('requires exactly 30 expected cases per browser', () => {
  assert.equal(expectedCaseKeys.length, 30);
  assert.equal(new Set(observed.browsers.chromium.casesPresent).size, 30);
  assert.equal(new Set(observed.browsers.webkit.casesPresent).size, 30);
});
check('records Chromium as 30 of 30 semantic passes', () => {
  assert.equal(observed.browsers.chromium.semanticPassKeys.length, 30);
  assert.equal(evaluateBrowser(observed.browsers.chromium), 'MOUSE_SEMANTICS_VERIFIED_SCOPED');
});
check('records WebKit as 29 of 30 semantic passes', () => {
  assert.equal(observed.browsers.webkit.semanticPassKeys.length, 29);
  assert.equal(evaluateBrowser(observed.browsers.webkit), 'HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED');
});
check('binds the exact WebKit station label failure', () => {
  const failure = observed.browsers.webkit.semanticFailures[0];
  assert.equal(failure.key, 'stationAction:label');
  assert.equal(failure.targetClosest, 'stationAction');
  assert.deepEqual(failure.events, ['pointerdown', 'mousedown', 'pointerup', 'mouseup']);
  assert.equal(failure.clickObserved, false);
  assert.equal(failure.before.disabled, false);
  assert.equal(failure.before.phase, 'running');
  assert.equal(failure.after.phase, 'running');
  assert.equal(failure.expectedAfter.phase, 'doors-opening');
});
check('keeps the complete real receipt on hold', () => {
  assert.equal(evaluateAggregate(observed), 'HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED');
});
check('rejects an incomplete diagnostic ledger', () => {
  const incomplete = structuredClone(observed);
  incomplete.browsers.webkit.casesPresent.pop();
  assert.equal(evaluateAggregate(incomplete), 'HOLD_DIAGNOSTIC_RECORD_INCOMPLETE');
});
check('rejects process green as a semantic substitute', () => {
  const processOnly = structuredClone(observed);
  delete processOnly.browsers.chromium.semanticPassKeys;
  delete processOnly.browsers.webkit.semanticPassKeys;
  assert.equal(evaluateAggregate(processOnly), 'HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED');
});
check('allows scoped pass only for a synthetic complete all-pass control', () => {
  const allPass = structuredClone(observed);
  allPass.browsers.webkit.semanticPassKeys = [...expectedCaseKeys];
  allPass.browsers.webkit.semanticFailures = [];
  assert.equal(evaluateAggregate(allPass), 'MOUSE_SEMANTICS_VERIFIED_SCOPED');
});

const result = {
  schema: 'kaopu.learning-probe-result/1',
  probe: 'train-r12-diagnostic-fail-closed-n122',
  pass: true,
  checksPassed: checks.length,
  checksTotal: 11,
  checks,
  decision: 'HOLD_WEBKIT_STATION_ACTION_LABEL_CLICK_AFTER_HUD_REFRESH',
  gateState: 'HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED',
  causalState: 'DIAGNOSTIC_CAPTURE_SUCCEEDED_ONE_REQUIRED_WEBKIT_SEMANTIC_CHECK_FALSE',
  novelty: 'NO_NOVELTY_EXISTING_DIAGNOSTIC_FAIL_CLOSED_CASE_APPLIES',
  observed,
  lifecycle: {
    POSTED: false,
    ACKNOWLEDGED: false,
    IMPLEMENTED: true,
    'GATE-RUN': true,
    ADOPTED: false,
    'USER-ACCEPTED': false
  }
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
