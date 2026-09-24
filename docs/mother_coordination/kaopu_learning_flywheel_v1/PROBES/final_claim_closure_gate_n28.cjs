'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fixturePath = path.resolve(process.argv[2] || path.join(__dirname, 'final_claim_closure_fixture_n28.json'));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function technicalEvidence(run) {
  const stepFailures = fixture.requiredSteps
    .map(name => ({ name, conclusion: run.steps[name] || 'missing' }))
    .filter(item => item.conclusion !== 'success');

  const subject = run.subject || {};
  const evidence = run.evidence || {};
  const proofChecks = [
    { key: 'assemblyExact', passed: evidence.assemblyProof?.state === 'EXACT_SOURCE_RECONSTRUCTED' && evidence.assemblyProof?.bytes === subject.bytes && evidence.assemblyProof?.subjectSha256 === subject.sha256 },
    { key: 'localBrowserPassed', passed: evidence.localBrowser?.passed === true && evidence.localBrowser?.desktopPassed === true && evidence.localBrowser?.mobile390x844Passed === true },
    { key: 'publicBytesVerified', passed: evidence.publicationProof?.state === 'PUBLIC_BYTES_VERIFIED' && evidence.publicationProof?.deployed === true && evidence.publicationProof?.httpStatus === 200 && evidence.publicationProof?.publicSha256 === subject.sha256 },
    { key: 'publicBrowserPassed', passed: evidence.publicBrowser?.passed === true && evidence.publicBrowser?.desktopPassed === true && evidence.publicBrowser?.mobile390x844Passed === true }
  ];

  return {
    stepFailures,
    proofChecks,
    passed: stepFailures.length === 0 && proofChecks.every(item => item.passed)
  };
}

function evaluateClaim(run) {
  const technical = technicalEvidence(run);
  if (!technical.passed) {
    return { state: 'HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE', passed: false, technical };
  }

  const closure = run.closureReceipt;
  if (!closure) {
    return { state: 'HOLD_FINAL_CLAIM_UNSEALED', passed: false, technical };
  }

  const evidenceDigests = Object.values(run.evidence).map(item => item.sha256).filter(Boolean).sort();
  const closureDigests = [...closure.evidenceSha256].sort();
  const closureChecks = {
    claimMatches: closure.claim === fixture.claim,
    runMatches: closure.runId === run.runId && closure.headSha === run.headSha,
    subjectMatches: closure.subjectBytes === run.subject.bytes && closure.subjectSha256 === run.subject.sha256,
    evidenceSetMatches: JSON.stringify(evidenceDigests) === JSON.stringify(closureDigests),
    issuedAfterCriticalSteps: closure.issuedAfterCriticalSteps === true,
    claimStateVerified: closure.claimState === 'CLAIM_VERIFIED'
  };
  const passed = Object.values(closureChecks).every(Boolean);
  return {
    state: passed ? 'CLAIM_VERIFIED' : 'HOLD_FINAL_CLAIM_INVALID',
    passed,
    technical,
    closureChecks
  };
}

const oldResult = evaluateClaim(fixture.oldHistory);
const newResult = evaluateClaim(fixture.newHistory);

assert.equal(oldResult.state, 'HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE');
assert.equal(oldResult.passed, false);
assert.equal(newResult.technical.passed, true);
assert.equal(newResult.state, 'HOLD_FINAL_CLAIM_UNSEALED');
assert.equal(newResult.passed, false);
assert.equal(fixture.newHistory.evidence.publicationProof.publicBrowserPassed, false);
assert.equal(fixture.newHistory.evidence.publicBrowser.passed, true);

// Falsification control: a post-critical-step closure over the exact run,
// subject and evidence set must pass without implying iPhone, Game or user acceptance.
const control = JSON.parse(JSON.stringify(fixture.newHistory));
control.closureReceipt = {
  claim: fixture.claim,
  runId: control.runId,
  headSha: control.headSha,
  subjectBytes: control.subject.bytes,
  subjectSha256: control.subject.sha256,
  evidenceSha256: Object.values(control.evidence).map(item => item.sha256).filter(Boolean),
  issuedAfterCriticalSteps: true,
  claimState: 'CLAIM_VERIFIED',
  excludedClaims: ['REAL_IPHONE_VERIFIED', 'VISUAL_ACCEPTED', 'GAME_BASELINE_PROMOTED', 'USER_ACCEPTED']
};
const controlResult = evaluateClaim(control);
assert.equal(controlResult.state, 'CLAIM_VERIFIED');
assert.equal(controlResult.passed, true);

const result = {
  suite: 'KAOPU final-claim closure replay N28',
  passed: true,
  hypothesis: 'A named claim may be promoted only by a final receipt issued after all claim-critical steps and bound to the exact run, head, subject and evidence digests.',
  oldGreenSkippedHistory: oldResult,
  r0153ActualHistory: {
    result: newResult,
    observation: 'All technical evidence atoms pass, but PUBLICATION_PROOF was produced before the public-browser step and still records shareAllowed=false/publicBrowserPassed=false. No final closure receipt exists.'
  },
  falsificationControl: controlResult,
  currentBestView: 'Keep evidence atoms immutable and scope-specific. Derive a final named claim once, after the last critical step, in a digest-bound closure receipt. Missing closure is HOLD, not implicit success.',
  boundary: [
    'R015.3 exact source, public bytes and desktop/390x844 Chromium evidence are real and remain valid.',
    'This gate does not imply real iPhone verification, independent human visual acceptance, Game baseline promotion or user acceptance.',
    'The candidate does not modify the production workflow or global R2.',
    'Mother implementation and independent verifier adoption remain unknown.'
  ]
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
