'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const fixturePath = path.resolve(process.argv[2] || path.join(__dirname, 'partial_transfer_fixture_n27.json'));
const repoPath = path.resolve(process.argv[3] || '.');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function gitBytes(commit, filePath) {
  return execFileSync('git', ['show', `${commit}:${filePath}`], {
    cwd: repoPath,
    encoding: null,
    maxBuffer: 8 * 1024 * 1024
  });
}

function strictBase64(encodedBytes) {
  const text = encodedBytes.toString('ascii');
  const normalized = text.replace(/[\r\n]/g, '');
  const invalid = [];
  for (let i = 0; i < normalized.length; i += 1) {
    if (!/[A-Za-z0-9+/=]/.test(normalized[i])) invalid.push({ offset: i, char: normalized[i] });
  }
  const alphabetValid = invalid.length === 0;
  const quantumValid = normalized.length % 4 === 0;
  const paddingValid = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized);
  if (!alphabetValid || !quantumValid || !paddingValid) {
    return { passed: false, alphabetValid, quantumValid, paddingValid, invalid };
  }
  const decoded = Buffer.from(normalized, 'base64');
  const canonical = decoded.toString('base64');
  return {
    passed: canonical === normalized,
    alphabetValid,
    quantumValid,
    paddingValid,
    canonicalRoundTrip: canonical === normalized,
    decodedBytes: decoded.length,
    decodedSha256: sha256(decoded),
    decoded
  };
}

function evaluateStage(spec, readChunk) {
  const checks = [];
  checks.push({ check: 'stageMarkerCleared', passed: spec.stageMarker === null });
  checks.push({ check: 'manifestPresent', passed: Boolean(spec.chunkManifest) });
  checks.push({ check: 'expectedChunkCountKnown', passed: Number.isInteger(spec.expectedChunkCount) });
  checks.push({
    check: 'chunkCountMatches',
    passed: Number.isInteger(spec.expectedChunkCount) && spec.chunks.length === spec.expectedChunkCount
  });

  const decoded = [];
  const chunkResults = spec.chunks.map(chunk => {
    const bytes = readChunk(chunk);
    const base = strictBase64(bytes);
    const result = {
      index: chunk.index,
      path: chunk.path,
      encodedBytes: bytes.length,
      encodedSizeMatches: bytes.length === chunk.encodedBytes,
      strictBase64Passed: base.passed,
      invalidCharacters: base.invalid || [],
      descriptorPresent: Boolean(chunk.descriptor)
    };
    if (base.passed) decoded.push(base.decoded);
    if (chunk.descriptor && base.passed) {
      result.decodedBytes = base.decodedBytes;
      result.decodedSha256 = base.decodedSha256;
      result.descriptorMatches = base.decodedBytes === chunk.descriptor.size && base.decodedSha256 === chunk.descriptor.sha256;
    } else {
      result.descriptorMatches = false;
    }
    return result;
  });

  checks.push({ check: 'allChunksStrictBase64', passed: chunkResults.every(x => x.strictBase64Passed) });
  checks.push({ check: 'allChunkDescriptorsPresent', passed: chunkResults.every(x => x.descriptorPresent) });
  checks.push({ check: 'allChunkDescriptorsMatch', passed: chunkResults.every(x => x.descriptorMatches) });

  let assembled = null;
  if (checks.every(x => x.passed)) assembled = Buffer.concat(decoded);
  const assembledResult = assembled ? {
    bytes: assembled.length,
    sha256: sha256(assembled),
    targetSizeMatches: assembled.length === spec.target.bytes,
    targetDigestMatches: sha256(assembled) === spec.target.sha256
  } : {
    bytes: null,
    sha256: null,
    targetSizeMatches: false,
    targetDigestMatches: false
  };
  checks.push({ check: 'targetSizeMatches', passed: assembledResult.targetSizeMatches });
  checks.push({ check: 'targetDigestMatches', passed: assembledResult.targetDigestMatches });

  const passed = checks.every(x => x.passed);
  return {
    passed,
    state: passed ? 'SOURCE_TRANSFER_VERIFIED' : 'HOLD_SOURCE_INCOMPLETE_OR_CORRUPT',
    checks,
    chunkResults,
    assembled: assembledResult
  };
}

const actual = evaluateStage(fixture, chunk => gitBytes(fixture.commit, chunk.path));
assert.equal(actual.passed, false);
assert.equal(actual.state, 'HOLD_SOURCE_INCOMPLETE_OR_CORRUPT');
assert.equal(actual.chunkResults[0].strictBase64Passed, false);
assert.equal(actual.chunkResults[1].strictBase64Passed, false);
assert.deepEqual(actual.chunkResults[0].invalidCharacters.slice(0, 5).map(x => x.char), ['.', '.', '.', ' ', '(']);
assert.equal(
  actual.chunkResults[1].invalidCharacters.some(x => x.char === '['),
  true,
  'chunk-01 must preserve the literal ellipsization marker as invalid evidence'
);

// Falsification control: a complete manifest with strict chunks and final identity must pass.
const source = Buffer.from('KAOPU atomic transfer control: exact bytes, ordered chunks, no silent fallback.');
const parts = [source.subarray(0, 19), source.subarray(19, 47), source.subarray(47)];
const controlChunks = parts.map((bytes, index) => ({
  index,
  path: `control-${index}.b64`,
  encodedBytes: Buffer.byteLength(bytes.toString('base64')),
  descriptor: { size: bytes.length, sha256: sha256(bytes) },
  encoded: Buffer.from(bytes.toString('base64'))
}));
const control = evaluateStage({
  stageMarker: null,
  chunkManifest: { schema: 'kaopu.chunk-manifest/0.1-candidate' },
  expectedChunkCount: controlChunks.length,
  chunks: controlChunks,
  target: { bytes: source.length, sha256: sha256(source) }
}, chunk => chunk.encoded);
assert.equal(control.passed, true);
assert.equal(control.state, 'SOURCE_TRANSFER_VERIFIED');

const result = {
  suite: 'KAOPU partial-source atomic promotion replay N27',
  passed: true,
  hypothesis: 'A staged source cannot become a publishable or parent artifact until every ordered chunk has a size and digest descriptor, strict decoding passes, and the reconstructed bytes match the frozen target size and digest.',
  actualHistory: actual,
  falsificationControl: control,
  currentBestView: 'Treat chunk commits as quarantine transport state. Only the verified reconstructed object may receive SOURCE_TRANSFER_VERIFIED and become a publication input or parent.',
  boundary: [
    'This gate validates transfer integrity, not visual correctness or user acceptance.',
    'It does not require every artifact to use base64 or chunking.',
    'It does not repair or publish Stone Money R015.2.',
    'Global R2 adoption requires one real Mother trial and an independent verifier receipt.'
  ]
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
