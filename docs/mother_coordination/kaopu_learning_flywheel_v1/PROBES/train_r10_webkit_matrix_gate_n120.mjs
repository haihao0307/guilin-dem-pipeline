import assert from 'node:assert/strict';

const requiredCells = ['chromium:scene', 'webkit:scene'];

const observed = {
  attempts: [
    {
      runId: 37825833649,
      headSha: '3db526bd272fbecd6c7dec325a043375561da5a1',
      conclusion: 'cancelled',
      cells: {
        'chromium:scene': { conclusion: 'failure', signature: 'LOCATOR_SCREENSHOT_TIMEOUT' },
        'webkit:scene': { conclusion: 'failure', signature: 'LOCATOR_CLICK_PAUSE_TIMEOUT' }
      }
    },
    {
      runId: 37826431136,
      headSha: '69d0b747260c8488d977ae28dab0e65f6ac294be',
      conclusion: 'failure',
      cells: {
        'chromium:scene': { conclusion: 'success', signature: null },
        'webkit:scene': { conclusion: 'failure', signature: 'LOCATOR_CLICK_CAMERA_PLATFORM_TIMEOUT' }
      },
      webkitArtifact: {
        artifactId: 11572126144,
        digest: 'sha256:ea7f69a9fbf1d1e8b8d8bc67fa537cc18f8f5993e90744a04226f4e9575c0a75',
        liveHudScreenshotsCompleted: 9,
        liveHudScreenshotsRequired: 10,
        consoleErrors: [],
        badHttpResponses: []
      }
    }
  ],
  delta3dbTo69d: {
    changedPaths: ['kaopu-minigame-workbench/voxel-train-study/game/tests/r10-browser.cjs'],
    productionPathCount: 0,
    change: 'locator screenshot replaced by page screenshot clipped to the same bounding box'
  }
};

function evaluateTerminal({ attempt, required = requiredCells }) {
  const missing = required.filter(cell => !attempt.cells[cell]);
  if (missing.length) return 'HOLD_MATRIX_JOB_LEDGER_INCOMPLETE';
  if (required.some(cell => attempt.cells[cell].conclusion !== 'success')) {
    return 'HOLD_REQUIRED_MATRIX_CELL_FAILED';
  }
  return 'CLAIM_VERIFIED_SCOPED';
}

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

const prior = observed.attempts[0];
const terminal = observed.attempts[1];

check('binds exact prior run and subject', () => {
  assert.equal(prior.runId, 37825833649);
  assert.equal(prior.headSha, '3db526bd272fbecd6c7dec325a043375561da5a1');
});
check('preserves both prior matrix failures', () => {
  assert.equal(prior.cells['chromium:scene'].signature, 'LOCATOR_SCREENSHOT_TIMEOUT');
  assert.equal(prior.cells['webkit:scene'].signature, 'LOCATOR_CLICK_PAUSE_TIMEOUT');
});
check('binds exact terminal run and subject', () => {
  assert.equal(terminal.runId, 37826431136);
  assert.equal(terminal.headSha, '69d0b747260c8488d977ae28dab0e65f6ac294be');
});
check('does not promote chromium success over webkit failure', () => {
  assert.equal(evaluateTerminal({ attempt: terminal }), 'HOLD_REQUIRED_MATRIX_CELL_FAILED');
});
check('preserves partial WebKit HUD evidence without claiming completion', () => {
  assert.equal(terminal.webkitArtifact.liveHudScreenshotsCompleted, 9);
  assert.equal(terminal.webkitArtifact.liveHudScreenshotsRequired, 10);
  assert.deepEqual(terminal.webkitArtifact.consoleErrors, []);
  assert.deepEqual(terminal.webkitArtifact.badHttpResponses, []);
});
check('classifies the terminal change as QA-only', () => {
  assert.equal(observed.delta3dbTo69d.productionPathCount, 0);
  assert.deepEqual(observed.delta3dbTo69d.changedPaths, [
    'kaopu-minigame-workbench/voxel-train-study/game/tests/r10-browser.cjs'
  ]);
});
check('rejects a ledger that omits WebKit', () => {
  assert.equal(
    evaluateTerminal({ attempt: { ...terminal, cells: { 'chromium:scene': terminal.cells['chromium:scene'] } } }),
    'HOLD_MATRIX_JOB_LEDGER_INCOMPLETE'
  );
});
check('allows only a fully successful scoped control', () => {
  const control = {
    ...terminal,
    cells: {
      'chromium:scene': { conclusion: 'success', signature: null },
      'webkit:scene': { conclusion: 'success', signature: null }
    }
  };
  assert.equal(evaluateTerminal({ attempt: control }), 'CLAIM_VERIFIED_SCOPED');
});

const result = {
  schema: 'kaopu.learning-probe-result/1',
  probe: 'train-r10-webkit-matrix-gate-n120',
  pass: true,
  checksPassed: checks.length,
  checksTotal: 8,
  checks,
  decision: 'HOLD_REQUIRED_MATRIX_CELL_FAILED',
  causalState: 'QA_FIX_CLOSED_CHROMIUM_SCREENSHOT_ONLY_WEBKIT_INPUT_COMPLETION_UNKNOWN',
  novelty: 'NO_NOVELTY_EXISTING_N71_MATRIX_FAILURE_LINEAGE_APPLIES',
  observed,
  lifecycle: {
    POSTED: false,
    ACKNOWLEDGED: false,
    IMPLEMENTED: false,
    'GATE-RUN': true,
    ADOPTED: false,
    'USER-ACCEPTED': false
  }
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
