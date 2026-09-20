import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const benchmark = JSON.parse(fs.readFileSync(new URL('benchmark/SOURCE_BENCHMARK_R01_SUMMARY.json', root), 'utf8'));
const anatomy = JSON.parse(fs.readFileSync(new URL('benchmark/ANATOMY_PARTITION_R01_SUMMARY.json', root), 'utf8'));
const qa = JSON.parse(fs.readFileSync(new URL('QA_RECEIPT.json', root), 'utf8'));
let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };

ok(benchmark.schema === 'kaopu.original-fish.source-benchmark-summary/1.0', 'benchmark schema');
ok(benchmark.referenceId === 'FISH-REF-002', 'reference identity');
ok(benchmark.input.sha256 === 'f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0', 'exact source hash');
ok(benchmark.input.bytes === 6137560, 'exact source bytes');
ok(benchmark.coordinateFrame.sceneAxes.tailToHead === '+Y', 'longitudinal axis');
ok(benchmark.coordinateFrame.bodyLengthSourceUnits > 3.0, 'positive source length');
ok(benchmark.sourceCounts.bodyVertices === 4053, 'body vertices');
ok(benchmark.sourceCounts.bodyTriangles === 6920, 'body triangles');
ok(benchmark.sourceCounts.skinJoints === 98, 'source joints');
ok(benchmark.sourceCounts.animationChannels === 291, 'animation channels');
ok(benchmark.skeleton.jointCount === 98, 'bind-pose joint inventory');
ok(benchmark.skeleton.bindInventorySha256.length === 64, 'bind inventory hash');
ok(benchmark.skinInfluence.topInfluenceCount === 30, 'joint influence ranking');
for (const view of ['side_left','three_quarter','front','top']) {
  const v = benchmark.views[view];
  ok(v.contourSamples === 256, `${view} contour count`);
  ok(v.contourSha256.length === 64, `${view} contour hash`);
  ok(v.silhouetteAreaPixels > 0, `${view} silhouette`);
  ok(v.silhouetteAreaRatio > 0 && v.silhouetteAreaRatio < 1, `${view} area ratio`);
}
ok(benchmark.fullLocalBenchmark.repositoryState === 'LOCAL_REPRODUCIBLE_NOT_PUBLISHED', 'full benchmark boundary');
ok(benchmark.restartGate.nativeCandidateAllowed === false, 'candidate blocked');
ok(benchmark.restartGate.anatomicalPartitionAccepted === false, 'anatomical partition pending');

ok(anatomy.schema === 'kaopu.original-fish.tuna-source-anatomy-partition-summary/1.0', 'anatomy schema');
ok(anatomy.sourceSha256 === benchmark.input.sha256, 'anatomy source identity');
ok(anatomy.regions.length === 12, 'source region inventory');
ok(anatomy.warning.includes('Upper/Lower'), 'misleading source-name warning');
ok(anatomy.continuityTargets.length === 5, 'continuity target count');
ok(anatomy.continuityTargets.some(x => x.id === 'BODY_CONTINUITY'), 'body continuity target');
ok(Boolean(anatomy.keyAnchors.UpperJaw_06 && anatomy.keyAnchors.LoweJaw_09), 'jaw anchors');
ok(Boolean(anatomy.keyAnchors['Eye.L_07'] && anatomy.keyAnchors['Eye.R_08']), 'eye anchors');
ok(anatomy.gate.partitionDrafted === true, 'partition drafted');
ok(anatomy.gate.partitionAccepted === false, 'partition not accepted');
ok(anatomy.gate.nativeCandidateAllowed === false, 'partition blocks candidate');

ok(qa.gates.oldProductionLineRejected === true, 'old line rejected');
ok(qa.gates.sourceReferenceRead === true, 'source read');
ok(qa.gates.nativeCandidateAllowed === false, 'QA candidate blocked');
ok(qa.publication.rawSourcePublished === false, 'raw source not published');

console.log(`Original Fish Tuna R08 benchmark and partition: ${checks} assertions passed`);
