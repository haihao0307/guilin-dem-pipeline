'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fixturePath = path.resolve(process.argv[2] || path.join(__dirname, 'ci_claim_scope_history_fixture_n26.json'));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const manifests = {
  VERIFIED_SETUP: {
    requiredSteps: [
      'Read only the two source-bound publication files at this exact commit',
      'Preserve execution evidence without claiming that a green preflight is publication'
    ],
    proof: {
      state: 'SOURCE_TRANSFER_REQUIRED',
      shareAllowed: false,
      deployed: false,
      publicBrowserPassed: false
    }
  },
  PUBLICATION_COMPLETE: {
    requiredSteps: [
      'Install real Chromium verification tools',
      'Verify every byte, perform real browser tests, publish, and reread HTTPS'
    ],
    proof: {
      shareAllowed: true,
      deployed: true,
      publicBrowserPassed: true
    }
  }
};

function evaluateClaim(run, claim, manifest) {
  const stepByName = new Map(run.workflow.steps.map(step => [step.name, step.conclusion]));
  const requiredStepResults = manifest.requiredSteps.map(name => ({
    name,
    conclusion: stepByName.get(name) || 'missing'
  }));
  const incompleteSteps = requiredStepResults.filter(step => step.conclusion !== 'success');
  const proofMismatches = Object.entries(manifest.proof)
    .filter(([key, expected]) => run.proof[key] !== expected)
    .map(([key, expected]) => ({ key, expected, actual: run.proof[key] }));
  const passed = incompleteSteps.length === 0 && proofMismatches.length === 0;
  return {
    claim,
    workflowConclusion: run.workflow.jobConclusion,
    requiredStepResults,
    incompleteSteps,
    proofMismatches,
    passed,
    state: passed ? 'CLAIM_VERIFIED' : 'HOLD_CLAIM_INCOMPLETE'
  };
}

const setup = evaluateClaim(fixture, 'VERIFIED_SETUP', manifests.VERIFIED_SETUP);
const publication = evaluateClaim(fixture, 'PUBLICATION_COMPLETE', manifests.PUBLICATION_COMPLETE);

assert.equal(fixture.workflow.jobConclusion, 'success');
assert.equal(setup.passed, true);
assert.equal(setup.state, 'CLAIM_VERIFIED');
assert.equal(publication.passed, false);
assert.equal(publication.state, 'HOLD_CLAIM_INCOMPLETE');
assert.deepEqual(publication.incompleteSteps.map(step => step.conclusion), ['skipped', 'skipped']);
assert.deepEqual(publication.proofMismatches.map(item => item.key).sort(), [
  'deployed',
  'publicBrowserPassed',
  'shareAllowed'
]);

// Falsification control: the rule must not reject a truly complete publication.
const completeControl = JSON.parse(JSON.stringify(fixture));
for (const step of completeControl.workflow.steps) {
  if (manifests.PUBLICATION_COMPLETE.requiredSteps.includes(step.name)) step.conclusion = 'success';
}
Object.assign(completeControl.proof, {
  state: 'PUBLICATION_VERIFIED',
  shareAllowed: true,
  deployed: true,
  publicBrowserPassed: true
});
const completePublication = evaluateClaim(completeControl, 'PUBLICATION_COMPLETE', manifests.PUBLICATION_COMPLETE);
assert.equal(completePublication.passed, true);

const result = {
  suite: 'KAOPU CI claim-scope historical replay N26',
  passed: true,
  hypothesis: 'A green workflow may support only the claims whose required steps and proof fields passed; skipped claim-critical steps must hold the stronger claim.',
  actualHistory: {
    fixtureId: fixture.fixtureId,
    workflowConclusion: fixture.workflow.jobConclusion,
    verifiedSetup: setup,
    publicationComplete: publication
  },
  falsificationControl: completePublication,
  currentBestView: 'Treat workflow conclusion as transport/execution metadata. Promotion must bind a named claim to a required-step manifest and proof predicates.',
  boundary: [
    'This replay does not prove that every workflow needs the same steps.',
    'A skipped step is blocking only when the current named claim declares it critical.',
    'The replay does not publish the Stone Money artifact or resolve source transfer.',
    'Global adoption requires a real Mother trial and verifier receipt.'
  ]
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
