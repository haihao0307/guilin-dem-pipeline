import assert from 'node:assert/strict';

const observed = {
  nativeOnly: {
    runId: 37877021198,
    headSha: '4a96d7bef1b4b80f495ba2417845d55f6966b691',
    conclusion: 'success',
    scope: 'native-only',
    artifact: {
      id: 11592852195,
      digest: 'sha256:5f8ffe20e35dddfbf475791566d3b5c095ba27d0a5c8e880bf29a2fbc0702613'
    }
  },
  attempts: [
    {
      runId: 37878896327,
      headSha: '3463c654def88fed4cad8315fd7d7b36b6d06d87',
      conclusion: 'failure',
      failedStep: 'local-browser',
      failureSignature: 'BROWSER_PATTERN_RECIPE_HASH_SERIALIZATION_MISMATCH',
      nativePresetCount: 60,
      browserPresetCount: 60,
      distinctSourceGeometries: 60,
      artifact: {
        id: 11593617373,
        digest: 'sha256:88e0f2f24c9403237c0cabf9d8e1701890dad523422afbace1432099227fdb54'
      },
      publication: 'skipped',
      publicBrowser: 'skipped'
    },
    {
      runId: 37880361490,
      headSha: '7e21a019512adfda29fd5d457fdf03c94563a0f9',
      conclusion: 'failure',
      failedStep: 'local-browser',
      failureSignature: 'LOCAL_BROWSER_REGENERATED_PAPER_GEOMETRY_MISMATCH',
      nativePresetCount: 60,
      browserPresetCount: 60,
      distinctSourceGeometries: 60,
      browserChecksBeforeFailure: 74,
      numericTransportCheck: 'success',
      maximumObservedMillimetreError: 0.06899010856065502,
      allowedMillimetreError: 0.001,
      artifact: {
        id: 11594128833,
        digest: 'sha256:c3862b9b473b257b016fae7be1c66513ad1c656d0cdc153c4f444eb28e021460'
      },
      sourceLock: 'skipped',
      retain: 'skipped',
      publication: 'skipped',
      publicBytes: 'skipped',
      publicBrowser: 'skipped'
    }
  ],
  workflowTrigger: {
    coveredPushPaths: [
      '.github/workflows/tailor-preset-library-p01.yml',
      'kaopu-tailor-workbench/presets/r01/BUILD_TRIGGER.json'
    ],
    runtimeSourceCovered: false
  },
  declarations: {
    allParametersMastered: false,
    physicalFitAccepted: false,
    dynamicWearCertified: false
  }
};

function evaluate(receipt) {
  const attempts = receipt.attempts ?? [];
  if (attempts.length < 2 || attempts.some(attempt => !attempt.artifact?.digest)) {
    return 'HOLD_ATTEMPT_LEDGER_INCOMPLETE';
  }
  const terminal = attempts.at(-1);
  if (terminal.untestedNonMetadataDelta === true) {
    return 'HOLD_UNTESTED_NONMETADATA_DELTA';
  }
  if (terminal.maximumObservedMillimetreError > terminal.allowedMillimetreError) {
    return 'HOLD_LOCAL_BROWSER_GEOMETRY_PARITY_FAILED';
  }
  const critical = ['sourceLock', 'retain', 'publication', 'publicBytes', 'publicBrowser'];
  if (critical.some(key => terminal[key] !== 'success')) {
    return 'HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE';
  }
  return 'PUBLIC_PAPER_PRESET_LIBRARY_VERIFIED_SCOPED';
}

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check('binds the native-only run without promoting it to delivery', () => {
  assert.equal(observed.nativeOnly.scope, 'native-only');
  assert.equal(observed.nativeOnly.conclusion, 'success');
  assert.equal(observed.nativeOnly.runId, 37877021198);
});
check('retains both exact failed subjects', () => {
  assert.deepEqual(observed.attempts.map(x => x.runId), [37878896327, 37880361490]);
  assert.deepEqual(observed.attempts.map(x => x.headSha), [
    '3463c654def88fed4cad8315fd7d7b36b6d06d87',
    '7e21a019512adfda29fd5d457fdf03c94563a0f9'
  ]);
});
check('retains immutable artifacts for both failures', () => {
  for (const attempt of observed.attempts) {
    assert.ok(Number.isInteger(attempt.artifact.id));
    assert.match(attempt.artifact.digest, /^sha256:[a-f0-9]{64}$/);
  }
});
check('records native and browser enumeration without treating counts as acceptance', () => {
  const terminal = observed.attempts.at(-1);
  assert.equal(terminal.nativePresetCount, 60);
  assert.equal(terminal.browserPresetCount, 60);
  assert.equal(terminal.distinctSourceGeometries, 60);
  assert.equal(terminal.conclusion, 'failure');
});
check('binds the exact geometric mismatch and tolerance', () => {
  const terminal = observed.attempts.at(-1);
  assert.equal(terminal.maximumObservedMillimetreError, 0.06899010856065502);
  assert.equal(terminal.allowedMillimetreError, 0.001);
  assert.ok(terminal.maximumObservedMillimetreError > terminal.allowedMillimetreError);
});
check('keeps the real terminal attempt on geometry hold', () => {
  assert.equal(evaluate(observed), 'HOLD_LOCAL_BROWSER_GEOMETRY_PARITY_FAILED');
});
check('rejects a missing failed-attempt ledger', () => {
  const incomplete = structuredClone(observed);
  incomplete.attempts.shift();
  assert.equal(evaluate(incomplete), 'HOLD_ATTEMPT_LEDGER_INCOMPLETE');
});
check('rejects skipped publication and public checks after synthetic geometry repair', () => {
  const skipped = structuredClone(observed);
  skipped.attempts.at(-1).maximumObservedMillimetreError = 0.0005;
  assert.equal(evaluate(skipped), 'HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE');
});
check('rejects an untested non-metadata descendant', () => {
  const descendant = structuredClone(observed);
  descendant.attempts.at(-1).maximumObservedMillimetreError = 0.0005;
  descendant.attempts.at(-1).untestedNonMetadataDelta = true;
  assert.equal(evaluate(descendant), 'HOLD_UNTESTED_NONMETADATA_DELTA');
});
check('allows scoped public pass only for a synthetic exact-subject all-critical-pass control', () => {
  const allPass = structuredClone(observed);
  const terminal = allPass.attempts.at(-1);
  terminal.maximumObservedMillimetreError = 0.0005;
  terminal.sourceLock = 'success';
  terminal.retain = 'success';
  terminal.publication = 'success';
  terminal.publicBytes = 'success';
  terminal.publicBrowser = 'success';
  assert.equal(evaluate(allPass), 'PUBLIC_PAPER_PRESET_LIBRARY_VERIFIED_SCOPED');
});

const result = {
  schema: 'kaopu.learning-probe-result/1',
  probe: 'tailor-p01-evidence-closure-n123',
  pass: true,
  checksPassed: checks.length,
  checksTotal: 10,
  checks,
  decision: 'HOLD_LOCAL_BROWSER_GEOMETRY_PARITY_FAILED',
  gateState: 'HOLD_LOCAL_BROWSER_GEOMETRY_PARITY_FAILED',
  causalState: 'NATIVE_PRESET_ENUMERATION_PASSED_BROWSER_REGEN_GEOMETRY_MISMATCH_PUBLICATION_SKIPPED',
  novelty: 'NO_NOVELTY_EXISTING_EVIDENCE_CLOSURE_CASES_APPLY',
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
