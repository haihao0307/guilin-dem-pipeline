import assert from 'node:assert/strict';

const requiredJobs = [
  'deterministic',
  'browser (chromium, gameplay, full)',
  'browser (chromium, music, full)',
  'browser (chromium, zoom, full)',
  'browser (chromium, scene, full)',
  'browser (chromium, controls, full)',
  'browser (webkit, scene, desktop, 2048)',
  'browser (webkit, scene, landscape, 844)',
  'browser (webkit, scene, portrait, 390)',
  'browser (webkit, controls, w0, 4, 0)',
  'browser (webkit, controls, w1a, 8, 1)',
  'browser (webkit, controls, w1b, 8, 5)',
  'browser (webkit, controls, w2, 4, 2)',
  'browser (webkit, controls, w3, 4, 3)',
  'browser (webkit, gameplay, full)',
  'browser (webkit, zoom, full)',
  'browser (webkit, music, full)'
];

const observed = {
  candidate: '7df5da1569d1790d85309033ffddd56f4535eb98',
  workflowSubject: 'e8a8027fd8610b58b21b5e031d9d7cfac26a5229',
  releaseCommit: '2bba50071f9dabedc9a69c8fd60e9ca54a07d0f5',
  releaseParent: 'ab911ca428a29c710040e991d229cb53eb54a2b4',
  failedAttempt: {
    runId: 37859882917,
    headSha: '720147581621724c72b3c18c0110623e117830ff',
    conclusion: 'failure',
    signature: 'PUBLIC_ASSET_HOME_HASH_MISMATCH',
    browserMatrix: 'skipped',
    artifact: {
      id: 11586036453,
      digest: 'sha256:26fb19e680ab74932c22fc4865cf6c5f84e3b79b8ca8a1e7086d22236df46ad9'
    }
  },
  terminalAttempt: {
    runId: 37860468924,
    headSha: 'e8a8027fd8610b58b21b5e031d9d7cfac26a5229',
    jobs: Object.fromEntries(requiredJobs.map(name => [name, 'success'])),
    publicHashArtifact: {
      id: 11585857096,
      digest: 'sha256:9290de542edbd602456467c9fe765693c490b3f11554065b52cb8c0757066796',
      checkedAt: '2026-10-08T23:38:21.690Z',
      allMatched: true,
      total: 157,
      release: 140,
      protectedClassic: 16,
      protectedConcurrentBaseline: 1
    }
  },
  gitObjectReplay: {
    releaseCandidatePublishedArtifact: '140/140',
    protectedPublishedArtifact: '16/16',
    homepagePath: 'kaopu-minigame-workbench/index.html',
    homepageBeforeRelease: 'd3303611d4ad0f18fd5343248f56f4750f866563',
    homepageAfterRelease: 'd3303611d4ad0f18fd5343248f56f4750f866563',
    trainIndexCandidate: 'cc4da4bbfb3ef89fe3ba66540fbf35d67d3e436a',
    trainIndexPublished: 'cc4da4bbfb3ef89fe3ba66540fbf35d67d3e436a'
  },
  repairDelta: {
    from: '720147581621724c72b3c18c0110623e117830ff',
    to: 'e8a8027fd8610b58b21b5e031d9d7cfac26a5229',
    changedPaths: ['kaopu-minigame-workbench/voxel-train-study/game/tests/public-manifest.json'],
    productionPathCount: 0,
    oldHomepage: 'c40adc5026c02abb57d0cc8e714bfaff7640df1b',
    currentHomepage: 'd3303611d4ad0f18fd5343248f56f4750f866563',
    currentRole: 'protected-concurrent-release-baseline'
  }
};

function evaluate(receipt) {
  if (!receipt.failureLineage?.some(attempt =>
    attempt.runId === 37859882917 &&
    attempt.signature === 'PUBLIC_ASSET_HOME_HASH_MISMATCH'
  )) return 'HOLD_FAILURE_LINEAGE_INCOMPLETE';

  const missingJobs = requiredJobs.filter(name => !receipt.jobs?.[name]);
  if (missingJobs.length) return 'HOLD_MATRIX_JOB_LEDGER_INCOMPLETE';
  if (requiredJobs.some(name => receipt.jobs[name] !== 'success')) {
    return 'HOLD_REQUIRED_MATRIX_CELL_FAILED';
  }
  if (!receipt.publicHashes?.allMatched || receipt.publicHashes.total !== 157) {
    return 'HOLD_PUBLIC_OBJECT_MISMATCH';
  }
  if (receipt.objectReplay?.releaseCandidatePublishedArtifact !== '140/140' ||
      receipt.objectReplay?.protectedPublishedArtifact !== '16/16' ||
      receipt.objectReplay?.homepageBeforeRelease !== receipt.objectReplay?.homepageAfterRelease) {
    return 'HOLD_PUBLIC_OBJECT_MISMATCH';
  }
  return 'PUBLIC_RELEASE_VERIFIED_SCOPED';
}

const receipt = {
  failureLineage: [observed.failedAttempt],
  jobs: observed.terminalAttempt.jobs,
  publicHashes: observed.terminalAttempt.publicHashArtifact,
  objectReplay: observed.gitObjectReplay
};

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check('binds candidate, workflow subject and release commit', () => {
  assert.equal(observed.candidate, '7df5da1569d1790d85309033ffddd56f4535eb98');
  assert.equal(observed.workflowSubject, observed.terminalAttempt.headSha);
  assert.equal(observed.releaseCommit, '2bba50071f9dabedc9a69c8fd60e9ca54a07d0f5');
});
check('preserves failed public hash attempt and artifact', () => {
  assert.equal(observed.failedAttempt.conclusion, 'failure');
  assert.equal(observed.failedAttempt.signature, 'PUBLIC_ASSET_HOME_HASH_MISMATCH');
  assert.equal(observed.failedAttempt.artifact.id, 11586036453);
});
check('preserves that failed attempt skipped browser matrix', () => {
  assert.equal(observed.failedAttempt.browserMatrix, 'skipped');
});
check('binds terminal run and 17 required jobs', () => {
  assert.equal(observed.terminalAttempt.runId, 37860468924);
  assert.equal(Object.keys(observed.terminalAttempt.jobs).length, 17);
  assert.ok(requiredJobs.every(name => observed.terminalAttempt.jobs[name] === 'success'));
});
check('binds public hash artifact and 157 of 157 result', () => {
  const artifact = observed.terminalAttempt.publicHashArtifact;
  assert.equal(artifact.id, 11585857096);
  assert.equal(artifact.allMatched, true);
  assert.equal(artifact.total, 157);
  assert.equal(artifact.release + artifact.protectedClassic + artifact.protectedConcurrentBaseline, 157);
});
check('replays 140 release and 16 classic Git objects', () => {
  assert.equal(observed.gitObjectReplay.releaseCandidatePublishedArtifact, '140/140');
  assert.equal(observed.gitObjectReplay.protectedPublishedArtifact, '16/16');
});
check('proves concurrent homepage survived publication', () => {
  assert.equal(observed.gitObjectReplay.homepageBeforeRelease, observed.gitObjectReplay.homepageAfterRelease);
  assert.equal(observed.gitObjectReplay.homepageAfterRelease, observed.repairDelta.currentHomepage);
});
check('classifies manifest repair as QA-only', () => {
  assert.equal(observed.repairDelta.productionPathCount, 0);
  assert.deepEqual(observed.repairDelta.changedPaths, [
    'kaopu-minigame-workbench/voxel-train-study/game/tests/public-manifest.json'
  ]);
});
check('accepts the complete immutable receipt', () => {
  assert.equal(evaluate(receipt), 'PUBLIC_RELEASE_VERIFIED_SCOPED');
});
check('rejects a missing required job', () => {
  const jobs = { ...receipt.jobs };
  delete jobs['browser (webkit, controls, w3, 4, 3)'];
  assert.equal(evaluate({ ...receipt, jobs }), 'HOLD_MATRIX_JOB_LEDGER_INCOMPLETE');
});
check('rejects a public object mismatch', () => {
  assert.equal(evaluate({
    ...receipt,
    publicHashes: { ...receipt.publicHashes, allMatched: false }
  }), 'HOLD_PUBLIC_OBJECT_MISMATCH');
});
check('rejects erasure of the prior failure', () => {
  assert.equal(evaluate({ ...receipt, failureLineage: [] }), 'HOLD_FAILURE_LINEAGE_INCOMPLETE');
});

const result = {
  schema: 'kaopu.learning-probe-result/1',
  probe: 'train-r10-public-release-provenance-n121',
  pass: true,
  checksPassed: checks.length,
  checksTotal: 12,
  checks,
  decision: 'PUBLIC_RELEASE_VERIFIED_SCOPED',
  causalState: 'PUBLIC_BYTES_AND_REQUIRED_BROWSER_MATRIX_VERIFIED_WITH_PRIOR_FAILURE_LINEAGE_RETAINED',
  novelty: 'NO_NOVELTY_EXISTING_N83_AND_N71_APPLY',
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
