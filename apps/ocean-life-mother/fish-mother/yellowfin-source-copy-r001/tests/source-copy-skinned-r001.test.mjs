import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sourcePath = path.join(root, 'source-workspace', 'source', 'tuna_fish_4k.glb');
const outputPath = path.join(root, 'geometry', 'YELLOWFIN_SOURCE_COPY_SKINNED_R001.glb');
const receiptPath = path.join(root, 'SOURCE_COPY_SKINNED_R001.json');
const browserReceiptPath = path.join(root, 'evidence', 'skinned-browser', 'SKINNED_BROWSER_QA_RECEIPT.json');
const statusPath = path.join(root, 'CURRENT_STATUS.json');

for (const required of [sourcePath, outputPath, receiptPath, browserReceiptPath, statusPath]) {
  assert.equal(fs.existsSync(required), true, `missing required artifact: ${required}`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseGlb(buffer) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', 'GLB magic');
  assert.equal(buffer.readUInt32LE(4), 2, 'GLB version');
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'GLB length');
  let offset = 12;
  let document = null;
  let binary = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    assert.ok(end <= buffer.length, 'chunk within GLB');
    if (type === 0x4e4f534a) document = JSON.parse(buffer.subarray(start, end).toString('utf8').replace(/[\x00\s]+$/g, ''));
    if (type === 0x004e4942) binary = buffer.subarray(start, end);
    offset = end;
  }
  assert.ok(document, 'JSON chunk exists');
  assert.ok(binary, 'BIN chunk exists');
  return { document, binary };
}

const componentReaders = {
  5121: { bytes: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
  5123: { bytes: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
  5125: { bytes: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
};

function readScalarAccessor(glb, accessorIndex) {
  const accessor = glb.document.accessors[accessorIndex];
  assert.equal(accessor.type, 'SCALAR', `accessor ${accessorIndex} is scalar`);
  const view = glb.document.bufferViews[accessor.bufferView];
  const reader = componentReaders[accessor.componentType];
  assert.ok(reader, `supported index component type ${accessor.componentType}`);
  const stride = view.byteStride || reader.bytes;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = new Array(accessor.count);
  for (let index = 0; index < accessor.count; index++) values[index] = reader.read(glb.binary, start + index * stride);
  return values;
}

function without(object, keys) {
  return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
}

function triangleInventory(indices) {
  assert.equal(indices.length % 3, 0, 'triangle index count divisible by three');
  const inventory = new Map();
  for (let index = 0; index < indices.length; index += 3) {
    const signature = `${indices[index]},${indices[index + 1]},${indices[index + 2]}`;
    inventory.set(signature, (inventory.get(signature) || 0) + 1);
  }
  return inventory;
}

const sourceBytes = fs.readFileSync(sourcePath);
const outputBytes = fs.readFileSync(outputPath);
const source = parseGlb(sourceBytes);
const output = parseGlb(outputBytes);
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const browserReceipt = JSON.parse(fs.readFileSync(browserReceiptPath, 'utf8'));
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

assert.equal(sourceBytes.length, 58908280);
assert.equal(sha256(sourceBytes), '5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe');
assert.equal(receipt.schema, 'kaopu.fish-mother.yellowfin-source-copy-skinned/1.0');
assert.equal(receipt.referenceId, 'FISH-REF-002');
assert.equal(receipt.source.sha256, sha256(sourceBytes));
assert.equal(receipt.output.sha256, sha256(outputBytes));
assert.equal(receipt.output.bytes, outputBytes.length);
assert.equal(receipt.output.sourceBufferPrefixSha256, receipt.source.bufferSha256);
assert.equal(sha256(output.binary.subarray(0, receipt.source.bufferBytes)), receipt.source.bufferSha256);
assert.deepEqual(output.binary.subarray(0, receipt.source.bufferBytes), source.binary.subarray(0, receipt.source.bufferBytes));

for (const field of ['nodes', 'skins', 'animations', 'materials', 'textures', 'samplers', 'images']) {
  assert.deepEqual(output.document[field] || [], source.document[field] || [], `${field} retained byte-semantically`);
}
assert.equal(output.document.meshes.length, source.document.meshes.length);
assert.equal(receipt.output.meshCount, receipt.source.meshCount);
assert.equal(receipt.output.nodeCount, receipt.source.nodeCount);
assert.equal(receipt.output.skinCount, receipt.source.skinCount);
assert.equal(receipt.output.animationCount, receipt.source.animationCount);
assert.equal(receipt.output.materialCount, receipt.source.materialCount);
assert.equal(receipt.output.imageCount, receipt.source.imageCount);

const sourcePrimary = source.document.meshes[0].primitives[0];
const regionCount = receipt.regions.length;
const outputRegions = output.document.meshes[0].primitives.slice(0, regionCount);
assert.equal(outputRegions.length, receipt.output.semanticPrimitiveCount);
assert.equal(new Set(receipt.regions.map(region => region.name)).size, regionCount);
assert.deepEqual(
  output.document.meshes[0].primitives.slice(regionCount),
  source.document.meshes[0].primitives.slice(1),
  'non-primary primitives in mesh zero retained',
);
assert.deepEqual(output.document.meshes.slice(1), source.document.meshes.slice(1), 'all non-primary meshes retained');

const originalInventory = triangleInventory(readScalarAccessor(source, sourcePrimary.indices));
const partitionedIndices = [];
for (let index = 0; index < regionCount; index++) {
  const primitive = outputRegions[index];
  const region = receipt.regions[index];
  assert.equal(primitive.extras.kaopuSourceCopyRegion, region.name);
  assert.equal(primitive.extras.sourceFaceCount, region.faces);
  assert.equal(primitive.indices, region.indexAccessor);
  assert.deepEqual(without(primitive, ['indices', 'extras']), without(sourcePrimary, ['indices', 'extras']), `${region.name} retains source attributes/material/targets/extensions`);
  const indices = readScalarAccessor(output, primitive.indices);
  assert.equal(indices.length, region.index.count);
  assert.equal(indices.length / 3, region.faces);
  partitionedIndices.push(...indices);
}
const partitionedInventory = triangleInventory(partitionedIndices);
assert.equal(partitionedInventory.size, originalInventory.size, 'partition keeps source triangle inventory size');
for (const [signature, count] of originalInventory) assert.equal(partitionedInventory.get(signature), count, `triangle retained: ${signature}`);
assert.equal(partitionedIndices.length, readScalarAccessor(source, sourcePrimary.indices).length);

for (const gate of [
  'exactSourceBound',
  'classificationRegeneratedWithoutDrift',
  'primaryFacesPartitionedExactlyOnce',
  'sourceBinaryPrefixByteIdentical',
  'sourcePositionNormalUvJointWeightAccessorsRetained',
  'sourceNodesRetained',
  'sourceSkinsRetained',
  'sourceInverseBindMatricesRetained',
  'sourceAnimationsRetained',
  'sourceMaterialsTexturesImagesRetained',
  'nonPrimaryPrimitivesRetained',
  'browserRestPoseQAPassed',
  'browserAnimationQAPassed',
]) {
  assert.equal(receipt.gates[gate], true, `skinned-copy gate failed: ${gate}`);
}
assert.equal(receipt.gates.productionReady, false);

assert.equal(browserReceipt.schema, 'kaopu.fish-mother.yellowfin-source-copy-skinned-browser-qa/1.0');
assert.equal(browserReceipt.passed, true);
assert.equal(browserReceipt.sourceSha256, receipt.source.sha256);
assert.equal(browserReceipt.copySha256, receipt.output.sha256);
assert.deepEqual(browserReceipt.consoleErrors, []);
assert.deepEqual(browserReceipt.pageErrors, []);
assert.deepEqual(browserReceipt.failedChecks, []);
assert.ok(browserReceipt.samples.length >= 4);
assert.ok(browserReceipt.screenshots.length >= 10);

const acceptedPhases = new Set([
  'SOURCE_COPY_SKINNED_R001_BROWSER_QA_PASSED',
  'SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED',
]);
assert.ok(acceptedPhases.has(status.phase), `unexpected skinned-copy lifecycle phase: ${status.phase}`);
assert.equal(status.gates.sourceCopySkinTransferred, true);
assert.equal(status.gates.sourceCopyAnimationTransferred, true);
assert.equal(status.gates.sourceCopyMaterialsTransferred, true);
assert.equal(status.gates.sourceCopySkinnedBrowserQAPassed, true);

if (status.phase === 'SOURCE_COPY_R001_FROZEN_MACHINE_ACCEPTED') {
  assert.equal(status.gates.sourceCopyR001Frozen, true);
  assert.equal(status.gates.sourceCopyImmutable, true);
  assert.equal(status.gates.sourceCopyMachineAcceptancePassed, true);
  assert.equal(status.gates.biologicalCorrectionCandidateUnlocked, true);
  assert.equal(status.gates.independentReconstructionUnlocked, true);
  assert.equal(status.gates.generationLocked, false);
} else {
  assert.equal(status.gates.independentReconstructionUnlocked, false);
  assert.equal(status.gates.generationLocked, true);
}

console.log(JSON.stringify({
  ok: true,
  lifecyclePhase: status.phase,
  sourceBytes: sourceBytes.length,
  outputBytes: outputBytes.length,
  outputSha256: receipt.output.sha256,
  semanticPrimitiveCount: receipt.output.semanticPrimitiveCount,
  sourceTriangles: originalInventory.size,
  skinCount: receipt.output.skinCount,
  animationCount: receipt.output.animationCount,
  materialCount: receipt.output.materialCount,
}, null, 2));
