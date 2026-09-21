import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repoRoot = path.resolve(root, '../../../..');
const reportPath = path.join(root, 'BIOLOGICAL_CORRECTION_R001_BASELINE.json');
const specPath = path.join(root, 'BIOLOGICAL_CORRECTION_R001_SPEC.json');
const statusPath = path.join(root, 'CURRENT_STATUS.json');
const frozenPath = path.join(repoRoot, 'apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/geometry/YELLOWFIN_SOURCE_COPY_SKINNED_R001.glb');
const sourceStatusPath = path.join(repoRoot, 'apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/CURRENT_STATUS.json');
const baselinePath = path.join(repoRoot, 'CURRENT_BASELINE.json');

for (const required of [reportPath, specPath, statusPath, frozenPath, sourceStatusPath, baselinePath]) {
  assert.equal(fs.existsSync(required), true, `missing required baseline artifact: ${required}`);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const sourceStatus = JSON.parse(fs.readFileSync(sourceStatusPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const frozenBytes = fs.readFileSync(frozenPath);
const frozenSha = crypto.createHash('sha256').update(frozenBytes).digest('hex');

assert.equal(report.schema, 'kaopu.fish-mother.yellowfin-biological-correction-baseline/1.0');
assert.equal(spec.schema, 'kaopu.fish-mother.yellowfin-biological-correction-spec/1.0');
assert.equal(status.schema, 'kaopu.fish-mother.yellowfin-biological-correction-status/1.0');
assert.equal(report.frozenInput.commit, '9b610f4ef0134e015c2fb6b14574e7e4f48ed943');
assert.equal(report.frozenInput.sha256, '2130a3c03fc50d22676919c3599e75707e61d9f75ddd90523a6897887715ec02');
assert.equal(frozenSha, report.frozenInput.sha256);
assert.equal(frozenBytes.length, 58956620);
assert.equal(report.frozenInput.immutable, true);
assert.equal(sourceStatus.phase, 'SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED');
assert.equal(sourceStatus.gates.sourceCopyImmutable, true);

assert.deepEqual(report.frame.axisContract, {
  x: 'lateral',
  y: 'tail-to-snout',
  z: 'dorsal-negative / ventral-positive',
});
assert.equal(report.frame.forkInference.valid, true);
assert.ok(report.frame.forkInference.sharedCaudalVertexCount >= 2);
assert.ok(report.frame.forkInference.forkLength > 0);
assert.ok(report.frame.forkInference.forkOverTotalLength >= 0.72);
assert.ok(report.frame.forkInference.forkOverTotalLength <= 1.0);

assert.equal(report.regions.length, 13);
assert.deepEqual(report.regions.map(region => region.name), [
  'body_core',
  'upper_jaw',
  'lower_jaw',
  'eye',
  'operculum_candidate',
  'pectoral_fin',
  'pelvic_fin',
  'dorsal_fin',
  'anal_fin',
  'dorsal_finlets',
  'ventral_finlets',
  'caudal_upper',
  'caudal_lower',
]);
assert.equal(report.regions.reduce((sum, region) => sum + region.faces, 0), 6920);
assert.equal(new Set(report.regions.map(region => region.positionAccessor)).size, 1);
assert.ok(report.boundary.interRegionEdges > 0);
assert.ok(report.boundary.interRegionVertices > 0);
assert.equal(report.boundary.nonManifoldEdges, 0);

assert.ok(report.morphometrics.maximumBodyDepthOverForkLength > 0);
assert.ok(report.morphometrics.maximumBodyWidthOverForkLength > 0);
assert.ok(report.morphometrics.semanticHeadLengthOverForkLength > 0);
assert.ok(report.morphometrics.pectoralLengthOverForkLength > 0);
assert.ok(report.morphometrics.caudalVerticalSpanOverForkLength > 0);
assert.ok(report.morphometrics.peduncleDepthOverForkLength > 0);
assert.ok(report.morphometrics.peduncleWidthOverForkLength > 0);
assert.ok(report.morphometrics.profile.samples.length >= 20);
assert.deepEqual(report.morphometrics.publishedPectoralRange, [0.22, 0.31]);

assert.equal(report.skin.skinCount, 1);
assert.equal(report.skin.jointCount, 98);
assert.equal(report.skin.jointNames.length, 98);
assert.ok(report.skin.weightSumMaximumError <= 1e-8);
for (const region of report.regions) {
  const influences = report.skin.regionTopJointInfluences[region.name];
  assert.ok(Array.isArray(influences) && influences.length > 0, `${region.name} missing joint influences`);
}

assert.equal(report.animations.length, 1);
assert.ok(report.animations[0].channelCount > 0);
assert.ok(report.animations[0].translationChannelsRequireCorrectionPropagation >= 0);
assert.equal(report.assetInventory.skinCount, 1);
assert.equal(report.assetInventory.animationCount, 1);
assert.equal(report.assetInventory.materialCount, 3);
assert.equal(report.assetInventory.imageCount, 6);
assert.equal(report.finlets.dorsal, 9);
assert.equal(report.finlets.ventral, 8);

for (const gate of [
  'exactFrozenCopyBound',
  'freezeCommitPinned',
  'frozenStatusBound',
  'frozenCopyImmutable',
  'semanticRegionCountExact',
  'semanticRegionOrderExact',
  'semanticFaceInventoryExact',
  'sharedPositionAccessorRetained',
  'interRegionBoundariesUseSharedVertices',
  'nonManifoldSemanticEdgesZero',
  'forkLengthInferenceValid',
  'singleSkinRetained',
  'jointCountExpected98',
  'skinWeightsNormalized',
  'singleAnimationRetained',
  'materialCountRetained',
  'finletCountsRetained',
  'frozenGlbNotModified',
  'baselineAuditPassed',
]) {
  assert.equal(report.gates[gate], true, `baseline gate failed: ${gate}`);
}
assert.equal(report.gates.candidateGenerated, false);
assert.equal(report.gates.productionReady, false);

assert.equal(status.phase, 'FROZEN_BASELINE_AUDITED');
assert.equal(status.gates.morphometricBaselineAudited, true);
assert.equal(status.gates.forkLengthInferenceValid, true);
assert.equal(status.gates.skinInfluenceAuditPassed, true);
assert.equal(status.gates.animationChannelAuditPassed, true);
assert.equal(status.gates.correctionCandidateGenerated, false);
assert.equal(status.gates.productionReady, false);
assert.equal(status.baseline.frozenCopySha256, report.frozenInput.sha256);
assert.equal(status.baseline.semanticRegions, 13);
assert.equal(status.baseline.semanticFaces, 6920);
assert.equal(status.baseline.joints, 98);

assert.equal(baseline.activeState.phase, 'YELLOWFIN_BIOLOGICAL_CORRECTION_R001_BASELINE_AUDITED');
assert.equal(baseline.activeState.workBranch, 'work/ocean-life-fish-mother-yellowfin-biological-correction-r001-20260921');
assert.equal(baseline.activeState.frozenSourceCopyCommit, report.frozenInput.commit);
assert.equal(baseline.activeState.frozenSourceCopySha256, report.frozenInput.sha256);
assert.equal(baseline.activeState.frozenSourceCopyImmutable, true);
assert.equal(baseline.activeState.morphometricBaselineAudited, true);
assert.equal(baseline.activeState.correctionCandidateGenerated, false);
assert.equal(baseline.activeState.productionReady, false);
assert.equal(baseline.activeState.nextAllowedBuild, 'YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-A');

console.log(JSON.stringify({
  ok: true,
  frozenSha256: report.frozenInput.sha256,
  forkLength: report.frame.forkInference.forkLength,
  forkOverTotalLength: report.frame.forkInference.forkOverTotalLength,
  maximumBodyDepthOverForkLength: report.morphometrics.maximumBodyDepthOverForkLength,
  pectoralLengthOverForkLength: report.morphometrics.pectoralLengthOverForkLength,
  jointCount: report.skin.jointCount,
  translationChannels: report.animations[0].translationChannelsRequireCorrectionPropagation,
  next: report.next,
}, null, 2));
