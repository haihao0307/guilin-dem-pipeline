import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const reportPath = path.join(root, 'SOURCE_COPY_REGION_MATERIAL_ACCEPTANCE_R001.json');
const browserPath = path.join(root, 'evidence', 'region-material-browser', 'REGION_MATERIAL_BROWSER_QA_RECEIPT.json');
const statusPath = path.join(root, 'CURRENT_STATUS.json');
const copyPath = path.join(root, 'geometry', 'YELLOWFIN_SOURCE_COPY_SKINNED_R001.glb');

for (const required of [reportPath, browserPath, statusPath, copyPath]) {
  assert.equal(fs.existsSync(required), true, `missing required artifact: ${required}`);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const browser = JSON.parse(fs.readFileSync(browserPath, 'utf8'));
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

assert.equal(report.schema, 'kaopu.fish-mother.yellowfin-source-copy-region-material-acceptance/1.0');
assert.equal(report.referenceId, 'FISH-REF-002');
assert.equal(report.source.sha256, '5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe');
assert.equal(report.source.bytes, 58908280);
assert.equal(report.copy.sha256, status.sourceCopySkinned.sha256);
assert.equal(report.copy.bytes, status.sourceCopySkinned.bytes);
assert.equal(report.copy.semanticRegionCount, 13);
assert.equal(report.copy.semanticFaces, 6920);
assert.equal(report.copy.skinCount, 1);
assert.equal(report.copy.animationCount, 1);
assert.deepEqual(report.copy.regionMaterialIndices, [0]);

const names = report.regions.map(region => region.name);
assert.equal(names.length, 13);
assert.equal(new Set(names).size, names.length);
assert.equal(report.regions.reduce((sum, region) => sum + region.faces, 0), 6920);
for (const region of report.regions) {
  assert.equal(region.usesOriginalPrimaryMaterial, true, `${region.name} material drift`);
  assert.equal(region.attributesEqualSourcePrimary, true, `${region.name} attribute drift`);
  assert.equal(region.modeEqualSourcePrimary, true, `${region.name} mode drift`);
  assert.equal(region.targetsEqualSourcePrimary, true, `${region.name} target drift`);
  assert.equal(region.extensionsEqualSourcePrimary, true, `${region.name} extension drift`);
  assert.equal(region.material.index, 0, `${region.name} source material index`);
  assert.equal(region.material.name, 'Material', `${region.name} source material name`);
}

assert.ok(report.boundary.interRegionEdges > 0);
assert.ok(report.boundary.interRegionVertices > 0);
assert.ok(report.boundary.adjacency.length > 0);
assert.match(report.boundary.interpretation, /shared|source vertex/i);

assert.equal(report.materials.inventory.length, 3);
assert.deepEqual(report.materials.inventory.map(material => material.name), ['Material', 'Material.003', 'Material.004']);
assert.equal(report.materials.primaryBodyMaterialIndex, 0);
assert.equal(report.materials.eyeMaterial.index, 1);
assert.equal(report.materials.eyeMaterial.name, 'Material.003');
assert.equal(report.materials.corneaMaterial.index, 2);
assert.equal(report.materials.corneaMaterial.name, 'Material.004');
assert.equal(report.materials.corneaMaterial.alphaMode, 'BLEND');

for (const gate of [
  'exactSourceBound',
  'acceptedSkinnedCopyBound',
  'semanticRegionCountExact',
  'semanticRegionOrderMatchesReceipt',
  'semanticRegionNamesUnique',
  'primaryTriangleInventoryExact',
  'everyPrimaryFaceAssignedExactlyOnce',
  'allSemanticRegionsUseOriginalPrimaryMaterial',
  'allSemanticRegionsShareOriginalAttributes',
  'allSemanticRegionsRetainModeTargetsExtensions',
  'interRegionBoundaryUsesSharedSourceVertexIds',
  'sourceBinaryPrefixByteIdentical',
  'sourceMaterialTableUnchanged',
  'sourceTextureTableUnchanged',
  'sourceImageTableUnchanged',
  'sourceSamplerTableUnchanged',
  'eyeMaterialRetained',
  'corneaMaterialRetained',
  'corneaBlendModeRetained',
  'skinnedMotionBrowserQAPassed',
  'skinnedDynamicBoundsExact',
  'skinnedBoneMatricesExact',
  'browserRegionVisibilityQAPassed',
  'sourceCopyR001Frozen',
  'sourceCopyMachineAcceptancePassed',
]) {
  assert.equal(report.gates[gate], true, `acceptance gate failed: ${gate}`);
}
assert.equal(report.gates.productionReady, false);

assert.equal(browser.schema, 'kaopu.fish-mother.yellowfin-source-copy-region-material-browser-qa/1.0');
assert.equal(browser.passed, true);
assert.equal(browser.copySha256, report.copy.sha256);
assert.equal(browser.copyBytes, report.copy.bytes);
assert.equal(browser.regionInventory.length, 13);
assert.equal(browser.materialInventory.length, 3);
assert.equal(browser.regionInventory.every(region => region.expectedFaces === region.actualFaces), true);
assert.equal(browser.regionInventory.every(region => region.expectedMaterial === region.actualMaterial), true);
assert.deepEqual(browser.failedChecks, []);
assert.deepEqual(browser.consoleErrors, []);
assert.deepEqual(browser.pageErrors, []);
assert.ok(browser.screenshots.length >= 26);

assert.equal(status.phase, 'SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED');
assert.equal(status.gates.sourceCopyRegionVisibilityPassed, true);
assert.equal(status.gates.sourceCopyMaterialBoundaryPassed, true);
assert.equal(status.gates.sourceCopyR001Frozen, true);
assert.equal(status.gates.sourceCopyImmutable, true);
assert.equal(status.gates.sourceCopyMachineAcceptancePassed, true);
assert.equal(status.gates.sourceCopyManualVisualAcceptancePending, true);
assert.equal(status.gates.biologicalCorrectionCandidateUnlocked, true);
assert.equal(status.gates.independentReconstructionUnlocked, true);
assert.equal(status.gates.generationLocked, false);
assert.equal(status.sourceCopyRegionMaterial.report, 'SOURCE_COPY_REGION_MATERIAL_ACCEPTANCE_R001.json');
assert.equal(status.sourceCopyRegionMaterial.browserReceipt, 'evidence/region-material-browser/REGION_MATERIAL_BROWSER_QA_RECEIPT.json');
assert.equal(status.sourceCopyRegionMaterial.semanticRegionCount, 13);
assert.equal(status.sourceCopyRegionMaterial.materialCount, 3);
assert.equal(status.sourceCopyRegionMaterial.sourceCopyR001Frozen, true);

console.log(JSON.stringify({
  ok: true,
  copySha256: report.copy.sha256,
  semanticRegions: report.copy.semanticRegionCount,
  semanticFaces: report.copy.semanticFaces,
  interRegionEdges: report.boundary.interRegionEdges,
  materials: report.materials.inventory.map(material => ({ index: material.index, name: material.name, alphaMode: material.alphaMode })),
  screenshots: browser.screenshots.length,
  next: status.next,
}, null, 2));
