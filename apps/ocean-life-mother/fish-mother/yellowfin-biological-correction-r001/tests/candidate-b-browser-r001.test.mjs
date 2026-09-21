import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repoRoot = path.resolve(root, '../../../..');
const evidenceDir = path.join(root, 'evidence/candidate-b-browser');
const browserPath = path.join(evidenceDir, 'CANDIDATE_B_BROWSER_QA_RECEIPT.json');
const machinePath = path.join(root, 'CANDIDATE_B_RECEIPT.json');
const statusPath = path.join(root, 'CURRENT_STATUS.json');
const baselinePath = path.join(repoRoot, 'CURRENT_BASELINE.json');
const workbenchPath = path.join(root, 'candidate-b-qa.html');

for (const required of [browserPath, machinePath, statusPath, baselinePath, workbenchPath]) {
  assert.equal(fs.existsSync(required), true, `missing Candidate B browser artifact: ${required}`);
}

const browser = JSON.parse(fs.readFileSync(browserPath, 'utf8'));
const machine = JSON.parse(fs.readFileSync(machinePath, 'utf8'));
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

assert.equal(browser.schema, 'kaopu.fish-mother.yellowfin-biological-correction-candidate-b-browser-qa/1.0');
assert.equal(browser.build, 'YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-B-BROWSER-QA');
assert.equal(browser.passed, true);
assert.equal(browser.fatalError, null);
assert.deepEqual(browser.failedChecks, []);
assert.deepEqual(browser.consoleErrors, []);
assert.deepEqual(browser.pageErrors, []);
assert.equal(browser.frozenSha256, machine.frozenInput.sha256);
assert.equal(browser.candidateSha256, machine.output.sha256);
assert.equal(browser.manualVisualAcceptancePending, true);
assert.equal(browser.productionReady, false);

for (const [name, value] of Object.entries(browser.checks)) {
  assert.equal(value, true, `Candidate B browser check failed: ${name}`);
}

assert.equal(browser.frozenStats.bones, 98);
assert.equal(browser.candidateStats.bones, 98);
assert.equal(browser.frozenStats.triangles, browser.candidateStats.triangles);
assert.equal(browser.frozenStats.meshes, browser.candidateStats.meshes);
assert.equal(browser.candidateStats.regions.length, 13);
assert.equal(browser.candidateStats.materialNames.includes('Material.003'), true);
assert.equal(browser.candidateStats.materialNames.includes('Material.004'), true);
assert.ok(browser.candidateStats.transparentMaterials >= 1);
assert.equal(browser.frozenAnimations.length, 1);
assert.equal(browser.candidateBnimations.length, 1);
assert.deepEqual(browser.frozenAnimations, browser.candidateBnimations);
assert.equal(browser.samples.length, 5);
assert.equal(browser.focusAvailable.dorsal, true);
assert.equal(browser.focusAvailable.pectoral, true);
assert.equal(machine.gates.trueSecondDorsalComponentSelected, true);
assert.equal(machine.gates.firstDorsalRearSheetsPreservedFromIndependentElongation, true);
assert.deepEqual(machine.componentSelection.secondDorsalSurfaces.map(item => item.component), [1]);
assert.equal(status.candidateA.manualVisualAcceptance, false);
assert.equal(status.gates.candidateAVisualRejected, true);
assert.ok(browser.minimumSampledSpanRatio >= browser.thresholds.spanRatioMin);
assert.ok(browser.maximumSampledSpanRatio <= browser.thresholds.spanRatioMax);
assert.ok(browser.maximumSampledCenterDelta <= browser.thresholds.centerDeltaMax);
assert.ok(browser.maximumCandidateBoneMagnitude <= browser.thresholds.boneMagnitudeMax);

for (const sample of browser.samples) {
  assert.equal(sample.frozenBounds.finite, true);
  assert.equal(sample.candidateBounds.finite, true);
  assert.equal(sample.frozenBones.finite, true);
  assert.equal(sample.candidateBones.finite, true);
  assert.equal(sample.frozenBones.count, 98);
  assert.equal(sample.candidateBones.count, 98);
  assert.equal(sample.spanRatios.length, 3);
  for (const ratio of sample.spanRatios) {
    assert.ok(Number.isFinite(ratio));
    assert.ok(ratio >= browser.thresholds.spanRatioMin);
    assert.ok(ratio <= browser.thresholds.spanRatioMax);
  }
}

const requiredScreenshots = [
  'candidate-b-workbench-ui.png',
  'candidate-b-frozen-side-rest.png',
  'candidate-b-corrected-side-rest.png',
  'candidate-b-overlay-side-rest.png',
  'candidate-b-corrected-quarter-rest.png',
  'candidate-b-corrected-top-rest.png',
  'candidate-b-corrected-front-rest.png',
  'candidate-b-corrected-dorsal-rest.png',
  'candidate-b-corrected-pectoral-rest.png',
  'candidate-b-overlay-dorsal-rest.png',
  'candidate-b-overlay-pectoral-rest.png',
  'candidate-b-overlay-side-t250.png',
  'candidate-b-overlay-side-t500.png',
  'candidate-b-overlay-side-t750.png',
  'candidate-b-overlay-side-t999.png',
  'candidate-b-corrected-quarter-tmid.png',
  'candidate-b-corrected-top-tmid.png',
];
assert.ok(browser.screenshots.length >= requiredScreenshots.length);
const screenshotMap = new Map(browser.screenshots.map(item => [item.name, item]));
for (const name of requiredScreenshots) {
  assert.equal(screenshotMap.has(name), true, `missing fixed Candidate B screenshot: ${name}`);
  const item = screenshotMap.get(name);
  const file = path.join(evidenceDir, name);
  assert.equal(fs.existsSync(file), true, `missing screenshot file: ${name}`);
  assert.equal(fs.statSync(file).size, item.bytes);
  assert.equal(sha256(file), item.sha256);
  assert.ok(item.bytes > 10_000, `screenshot unexpectedly small: ${name}`);
}

assert.equal(status.phase, 'CANDIDATE_B_BROWSER_QA_PASSED_MACHINE_ACCEPTED');
assert.equal(status.gates.candidateMachineAcceptancePassed, true);
assert.equal(status.gates.candidateBrowserQAPassed, true);
assert.equal(status.gates.candidateFixedViewsCaptured, true);
assert.equal(status.gates.candidateSwimSamplesCaptured, true);
assert.equal(status.gates.candidateConsoleZeroErrors, true);
assert.equal(status.gates.candidatePageErrorsZero, true);
assert.equal(status.gates.manualVisualAcceptancePending, true);
assert.equal(status.gates.productionReady, false);
assert.equal(status.candidateB.sha256, browser.candidateSha256);
assert.equal(status.candidateB.browserPassed, true);
assert.ok(status.candidateB.screenshots >= requiredScreenshots.length);

assert.equal(baseline.activeState.phase, 'YELLOWFIN_BIOLOGICAL_CORRECTION_R001_CANDIDATE_B_BROWSER_QA_PASSED');
assert.equal(baseline.activeState.biologicalCorrectionCandidateSha256, browser.candidateSha256);
assert.equal(baseline.activeState.candidateMachineAcceptancePassed, true);
assert.equal(baseline.activeState.candidateBrowserQAPassed, true);
assert.equal(baseline.activeState.candidateFixedViewsCaptured, true);
assert.equal(baseline.activeState.candidateSwimSamplesCaptured, true);
assert.equal(baseline.activeState.candidateConsoleZeroErrors, true);
assert.equal(baseline.activeState.candidatePageErrorsZero, true);
assert.equal(baseline.activeState.manualVisualAcceptancePending, true);
assert.equal(baseline.activeState.productionReady, false);
assert.equal(baseline.activeState.nextAllowedBuild, 'YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-B-MANUAL-VISUAL-ACCEPTANCE');

console.log(JSON.stringify({
  ok: true,
  frozenSha256: browser.frozenSha256,
  candidateSha256: browser.candidateSha256,
  screenshots: browser.screenshots.length,
  swimSamples: browser.samples.length,
  minimumSampledSpanRatio: browser.minimumSampledSpanRatio,
  maximumSampledSpanRatio: browser.maximumSampledSpanRatio,
  maximumSampledCenterDelta: browser.maximumSampledCenterDelta,
  maximumCandidateBoneMagnitude: browser.maximumCandidateBoneMagnitude,
  consoleErrors: browser.consoleErrors.length,
  pageErrors: browser.pageErrors.length,
  manualVisualAcceptancePending: browser.manualVisualAcceptancePending,
  productionReady: browser.productionReady,
}, null, 2));
