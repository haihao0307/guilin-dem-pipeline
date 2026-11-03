// Assertions over the existing browser network/boot observations only.
// This helper does not fetch an asset, invoke the page or create a browser.
import assert from 'node:assert/strict';

export function verifyReferenceBodyLoading({baseURL, provenance, allocation, requestStarts, responses}) {
  const packaging = provenance.referenceBodyPackaging;
  assert.equal(packaging?.schema, 'kaopu-reference-body-geometry@1');
  assert.equal(packaging.originalSourceFilesModified, false);
  assert.equal(packaging.visibleNativePersonChanged, false);
  assert.equal(packaging.source.path, 'upstream/assets/native-person.json.gz');
  assert.deepEqual(packaging.generatedFiles.map(row => row.path).sort(),
    ['reference-body/geometry.bin.gz', 'reference-body/manifest.json']);
  const resource = value => {
    const url = new URL(value, baseURL);
    return url.origin + url.pathname;
  };
  const matching = (rows, file) => rows.filter(row => resource(row.url) === resource(file));
  // Include request starts: an unfinished or aborted old-asset request must
  // not disappear from this assertion merely because it has no response.
  const oldRequests = matching(requestStarts, packaging.source.path);
  const oldResponses = matching(responses, packaging.source.path);
  assert.equal(oldRequests.length, 0, 'The page requested the unused original reference-body payload');
  assert.equal(oldResponses.length, 0, 'The page received the unused original reference-body payload');
  const files = packaging.generatedFiles.map(file => {
    assert.ok(Number.isInteger(file.bytes) && file.bytes > 0);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    const starts = matching(requestStarts, file.path), observed = matching(responses, file.path);
    const successful = observed.filter(row => row.status >= 200 && row.status < 300);
    assert.ok(starts.length > 0, 'No actual request was observed for ' + file.path);
    assert.ok(successful.length > 0, 'No successful response was observed for ' + file.path);
    return {path: file.path, expectedBytes: file.bytes, expectedSHA256: file.sha256,
      requestCount: starts.length, responses: observed.map(({url, status, failure, wallMS}) => ({url, status, failure, wallMS})),
      successfulResponseCount: successful.length};
  });
  const geometry = packaging.generatedFiles.find(row => row.path === 'reference-body/geometry.bin.gz');
  const descriptor = packaging.generatedFiles.find(row => row.path === 'reference-body/manifest.json');
  assert.ok(allocation, 'Actual native boot allocation audit is missing');
  assert.equal(allocation.oldSkinTypedArraysCreated, false);
  assert.equal(allocation.oldActorCreated, false);
  assert.equal(allocation.networkPayloadChanged, true);
  assert.equal(allocation.geometryIdentityVerified, true);
  assert.equal(allocation.sourceCompressedBytes, packaging.source.bytes);
  assert.equal(allocation.loadedCompressedBytes, geometry.bytes);
  assert.equal(allocation.avoidedCompressedPayloadBytes, packaging.avoidedCompressedPayloadBytes);
  assert.equal(allocation.avoidedCompressedPayloadBytes, packaging.source.bytes - geometry.bytes);
  assert.equal(allocation.avoidedTypedArrayBytes, packaging.avoidedOldSkinAndActorTypedArrayBytes);
  return {schema: 'kaopu-reference-body-load-observation@1', passed: true, files,
    oldReferencePayload: {path: packaging.source.path, requestCount: oldRequests.length, responseCount: oldResponses.length},
    allocation: {...allocation}, descriptorBytes: descriptor.bytes,
    expectedHashSource: 'Build SOURCE_PROVENANCE.json; the native reader separately verifies downloaded gzip and decoded geometry hashes',
    scope: 'Only the old coordinate-reference asset and its boot allocation audit; current native identity and worker input are checked separately'};
}
