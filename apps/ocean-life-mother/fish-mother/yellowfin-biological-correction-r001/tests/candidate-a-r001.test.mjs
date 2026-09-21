import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repoRoot = path.resolve(root, '../../../..');
const frozenPath = path.join(repoRoot, 'apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/geometry/YELLOWFIN_SOURCE_COPY_SKINNED_R001.glb');
const candidatePath = path.join(root, 'geometry/YELLOWFIN_BIOLOGICAL_CORRECTION_R001_CANDIDATE_A.glb');
const receiptPath = path.join(root, 'CANDIDATE_A_RECEIPT.json');
const controlsPath = path.join(root, 'CANDIDATE_A_CONTROLS.json');
const statusPath = path.join(root, 'CURRENT_STATUS.json');
const baselinePath = path.join(repoRoot, 'CURRENT_BASELINE.json');

for (const required of [frozenPath, candidatePath, receiptPath, controlsPath, statusPath, baselinePath]) {
  assert.equal(fs.existsSync(required), true, `missing Candidate A artifact: ${required}`);
}

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const controls = JSON.parse(fs.readFileSync(controlsPath, 'utf8'));
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const frozenBytes = fs.readFileSync(frozenPath);
const candidateBytes = fs.readFileSync(candidatePath);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const frozenSha = sha(frozenBytes);
const candidateSha = sha(candidateBytes);

assert.equal(receipt.schema, 'kaopu.fish-mother.yellowfin-biological-correction-candidate/1.0');
assert.equal(receipt.candidate, 'YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A');
assert.equal(frozenSha, '2130a3c03fc50d22676919c3599e75707e61d9f75ddd90523a6897887715ec02');
assert.equal(receipt.frozenInput.sha256, frozenSha);
assert.equal(receipt.frozenInput.bytes, 58956620);
assert.equal(receipt.frozenInput.immutable, true);
assert.equal(candidateSha, receipt.output.sha256);
assert.notEqual(candidateSha, frozenSha);
assert.equal(candidateBytes.length, receipt.output.bytes);

assert.equal(receipt.output.meshCount, 3);
assert.equal(receipt.output.primitiveCount, 15);
assert.equal(receipt.output.nodeCount, 113);
assert.equal(receipt.output.skinCount, 1);
assert.equal(receipt.output.jointCount, 98);
assert.equal(receipt.output.animationCount, 1);
assert.equal(receipt.output.materialCount, 3);
assert.equal(receipt.output.imageCount, 6);
assert.equal(receipt.output.semanticRegionCount, 13);
assert.equal(receipt.output.semanticFaceCount, 6920);

const windows = controls.acceptanceWindows;
const within = (value, range) => value >= range[0] && value <= range[1];
for (const key of [
  'maximumBodyDepthOverForkLength',
  'semanticHeadLengthOverForkLength',
  'pectoralLengthOverForkLength',
  'secondDorsalHeightOverForkLength',
  'analHeightOverForkLength',
  'caudalVerticalSpanOverForkLength',
  'peduncleDepthOverForkLength',
]) {
  assert.equal(within(receipt.after[key], windows[key]), true, `${key} outside Candidate A acceptance window`);
}
assert.equal(receipt.after.deepestBodyNearFirstDorsalBase, true);
assert.ok(receipt.after.maximumBodyDepthOverForkLength < receipt.before.maximumBodyDepthOverForkLength);
assert.ok(receipt.after.pectoralLengthOverForkLength > receipt.before.pectoralLengthOverForkLength);
assert.ok(receipt.after.secondDorsalHeightOverForkLength > receipt.before.secondDorsalHeightOverForkLength);
assert.ok(receipt.after.analHeightOverForkLength > receipt.before.analHeightOverForkLength);
assert.ok(Math.abs(receipt.delta.semanticHeadLengthOverForkLength) < 1e-6);
assert.ok(Math.abs(receipt.delta.caudalVerticalSpanOverForkLength) < 0.01);

assert.equal(receipt.rig.rest.jointCount, 98);
assert.ok(receipt.rig.rest.maximumRestJointOriginError <= 1e-7);
assert.ok(receipt.rig.rest.maximumRestSkinIdentityError <= 1e-7);
assert.equal(receipt.rig.animation.translationChannelCount, 97);
assert.equal(receipt.rig.animation.rotationChannelsRetained, 97);
assert.equal(receipt.rig.animation.scaleChannelsRetained, 97);
assert.ok(receipt.rig.animation.maximumJointOriginPropagationError <= 1e-6);
assert.ok(receipt.rig.shading.normalAccessors.length > 0);
assert.ok(receipt.rig.shading.tangentAccessors.length > 0);
assert.equal(receipt.deformation.firstDorsalIndependentlyElongated, false);
assert.equal(receipt.deformation.caudalIndependentlyRescaled, false);
assert.equal(receipt.deformation.finletCountChanged, false);
assert.ok(receipt.deformation.changedPrimaryVertices > 0);
assert.ok(receipt.deformation.maximumPrimaryVertexDisplacementOverForkLength > 0);

for (const [gate, value] of Object.entries(receipt.gates)) {
  if (['candidateBrowserQAPassed', 'productionReady'].includes(gate)) {
    assert.equal(value, false, `${gate} must remain false before browser QA`);
  } else if (gate === 'manualVisualAcceptancePending') {
    assert.equal(value, true);
  } else {
    assert.equal(value, true, `Candidate A gate failed: ${gate}`);
  }
}

assert.equal(status.phase, 'CANDIDATE_A_GENERATED_MACHINE_ACCEPTED');
assert.equal(status.gates.correctionCandidateGenerated, true);
assert.equal(status.gates.candidateMachineAcceptancePassed, true);
assert.equal(status.gates.candidateBrowserQAPassed, false);
assert.equal(status.gates.manualVisualAcceptancePending, true);
assert.equal(status.gates.productionReady, false);
assert.equal(status.candidateA.sha256, candidateSha);

assert.equal(baseline.activeState.phase, 'YELLOWFIN_BIOLOGICAL_CORRECTION_R001_CANDIDATE_A_MACHINE_ACCEPTED');
assert.equal(baseline.activeState.biologicalCorrectionCandidateSha256, candidateSha);
assert.equal(baseline.activeState.correctionCandidateGenerated, true);
assert.equal(baseline.activeState.candidateMachineAcceptancePassed, true);
assert.equal(baseline.activeState.candidateBrowserQAPassed, false);
assert.equal(baseline.activeState.productionReady, false);
assert.equal(baseline.activeState.nextAllowedBuild, 'YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A-BROWSER-QA');

console.log(JSON.stringify({
  ok: true,
  frozenSha,
  candidateSha,
  before: receipt.before,
  after: receipt.after,
  bodyDepthAmplitude: receipt.controls.bodyDepthAmplitude,
  pectoralFactors: receipt.controls.pectoralFactors,
  secondDorsalFactor: receipt.controls.secondDorsalFactor,
  analFactor: receipt.controls.analFactor,
  translationChannels: receipt.rig.animation.translationChannelCount,
  next: receipt.next,
}, null, 2));
