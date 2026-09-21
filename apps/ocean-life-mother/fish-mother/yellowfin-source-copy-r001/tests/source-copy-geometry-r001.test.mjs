import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const receiptPath = path.join(root, 'SOURCE_COPY_GEOMETRY_R001.json');
const geometryPath = path.join(root, 'geometry', 'YELLOWFIN_SOURCE_COPY_R001.glb');
const browserReceiptPath = path.join(root, 'evidence', 'geometry-browser', 'GEOMETRY_BROWSER_QA_RECEIPT.json');
const statusPath = path.join(root, 'CURRENT_STATUS.json');
const classificationPath = path.join(root, 'SOURCE_COMPONENT_CLASSIFICATION_R001.json');

for (const required of [receiptPath, geometryPath, browserReceiptPath, statusPath, classificationPath]) {
  assert.equal(fs.existsSync(required), true, `missing required artifact: ${required}`);
}

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const browserReceipt = JSON.parse(fs.readFileSync(browserReceiptPath, 'utf8'));
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const classification = JSON.parse(fs.readFileSync(classificationPath, 'utf8'));
const glb = fs.readFileSync(geometryPath);
const glbSha = crypto.createHash('sha256').update(glb).digest('hex');

assert.equal(receipt.schema, 'kaopu.fish-mother.yellowfin-source-copy-geometry/1.0');
assert.equal(receipt.stage, 'STATIC_SEGMENTED_EXACT_SOURCE_COPY');
assert.equal(receipt.referenceId, 'FISH-REF-002');
assert.equal(receipt.source.sha256, '5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe');
assert.equal(receipt.source.bytes, 58908280);
assert.equal(receipt.output.sha256, glbSha);
assert.equal(receipt.output.bytes, glb.length);
assert.ok(glb.length > 100_000, `segmented GLB unexpectedly small: ${glb.length}`);
assert.equal(glb.toString('utf8', 0, 4), 'glTF');
assert.equal(glb.readUInt32LE(4), 2, 'GLB version must be 2');
assert.equal(glb.readUInt32LE(8), glb.length, 'GLB header length must match file size');

const regionNames = receipt.regions.map(region => region.name);
assert.equal(new Set(regionNames).size, regionNames.length, 'region names must be unique');
for (const requiredRegion of [
  'body_core',
  'upper_jaw',
  'lower_jaw',
  'eye',
  'pectoral_fin',
  'pelvic_fin',
  'dorsal_fin',
  'anal_fin',
  'dorsal_finlets',
  'ventral_finlets',
  'caudal_upper',
  'caudal_lower',
]) {
  assert.ok(regionNames.includes(requiredRegion), `missing copied region: ${requiredRegion}`);
}

const assignedFaces = receipt.regions.reduce((sum, region) => sum + region.faces, 0);
assert.equal(assignedFaces, receipt.output.faceCount, 'every source face must appear in exactly one copied region');
assert.equal(receipt.output.meshCount, receipt.regions.length);
assert.ok(receipt.source.copiedPrimitiveInstances >= receipt.source.sceneMeshCount, 'every source mesh primitive instance must be retained');
assert.ok(receipt.output.auxiliaryRegionCount >= 0);
assert.equal(receipt.finlets.dorsalConfirmedCount, 9);
assert.equal(receipt.finlets.ventralConfirmedCount, 8);
assert.equal(classification.finlets.dorsal.confirmedCount, 9);
assert.equal(classification.finlets.ventral.confirmedCount, 8);
assert.deepEqual(receipt.peduncle, classification.peduncle.minimum);

for (const gate of [
  'exactSourceBound',
  'classificationRegeneratedWithoutDrift',
  'allPrimaryFacesAssignedExactlyOnce',
  'allSourceMeshPrimitiveInstancesCopied',
  'allFacesAssignedExactlyOnce',
  'sourcePositionsReusedWithoutModification',
  'sourceProportionsPreserved',
  'sourceBoundsPreserved',
  'segmentedStaticGlbGenerated',
  'browserVisualQAPassed',
]) {
  assert.equal(receipt.gates[gate], true, `geometry gate failed: ${gate}`);
}
assert.equal(receipt.gates.skinnedAnimationTransferred, false);
assert.equal(receipt.gates.sourceMaterialsTransferred, false);
assert.equal(receipt.gates.productionReady, false);

assert.equal(browserReceipt.schema, 'kaopu.fish-mother.yellowfin-source-copy-geometry-browser-qa/1.0');
assert.equal(browserReceipt.passed, true);
assert.equal(browserReceipt.sourceSha256, receipt.source.sha256);
assert.equal(browserReceipt.copySha256, receipt.output.sha256);
assert.equal(browserReceipt.sourceStats.triangles, receipt.output.faceCount);
assert.equal(browserReceipt.copyStats.triangles, receipt.output.faceCount);
assert.equal(browserReceipt.copyStats.meshes, receipt.output.meshCount);
assert.deepEqual(browserReceipt.exactPackageBounds, receipt.output.boundsSourceUnits);
assert.ok(browserReceipt.copyVsExactPackageBoundsDelta <= browserReceipt.boundsTolerance);
assert.ok(Number.isFinite(browserReceipt.sourceVsCopyBrowserBoundsDelta));
assert.ok(browserReceipt.sourceVsAlignedCopyBrowserBoundsDelta <= browserReceipt.boundsTolerance);
assert.ok(browserReceipt.checks.sourceAndAlignedCopyBoundsMatch);
assert.match(browserReceipt.browserBoundsPolicy, /diagnostic|aligned/i);
assert.deepEqual(browserReceipt.failedChecks, []);
assert.deepEqual(browserReceipt.consoleErrors, []);
assert.deepEqual(browserReceipt.pageErrors, []);
assert.ok(browserReceipt.screenshots.length >= 9);

assert.equal(status.phase, 'SOURCE_COPY_GEOMETRY_R001_BROWSER_QA_PASSED_SKIN_TRANSFER_NEXT');
assert.equal(status.gates.sourceCopyStaticGeometryGenerated, true);
assert.equal(status.gates.sourceCopyAllFacesAssignedExactlyOnce, true);
assert.equal(status.gates.sourceCopyEveryPrimitiveCopied, true);
assert.equal(status.gates.sourceCopySourceBoundsPreserved, true);
assert.equal(status.gates.sourceCopyGeometryBrowserQAPassed, true);
assert.equal(status.gates.sourceCopySkinTransferred, false);
assert.equal(status.gates.independentReconstructionUnlocked, false);
assert.equal(status.gates.generationLocked, true);

console.log(JSON.stringify({
  ok: true,
  glbBytes: glb.length,
  glbSha256: glbSha,
  meshCount: receipt.output.meshCount,
  faceCount: receipt.output.faceCount,
  primitiveInstances: receipt.source.copiedPrimitiveInstances,
  copyVsExactPackageBoundsDelta: browserReceipt.copyVsExactPackageBoundsDelta,
  sourceVsCopyBrowserBoundsDelta: browserReceipt.sourceVsCopyBrowserBoundsDelta,
  sourceVsAlignedCopyBrowserBoundsDelta: browserReceipt.sourceVsAlignedCopyBrowserBoundsDelta,
  regions: receipt.regions.map(region => ({ name: region.name, faces: region.faces, vertices: region.vertices })),
}, null, 2));
