import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const archiveRoot = path.resolve('n255_source/extracted');
const reviewRoot = path.join(archiveRoot, 'evidence', 'independent-review');
const inputManifest = JSON.parse(
  fs.readFileSync(path.join(reviewRoot, 'INPUTS_SHA256.json'), 'utf8'),
);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function walk(root) {
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute));
    else result.push(absolute);
  }
  return result;
}

const reviewSources = walk(reviewRoot).filter(file => /\.(?:mjs|sh|md|json)$/.test(file));
const absolutePathFindings = [];
for (const file of reviewSources) {
  const text = fs.readFileSync(file, 'utf8');
  const matches = text.match(/\/workspace\/shared\/[A-Za-z0-9_./-]+/g) ?? [];
  for (const literal of matches) {
    absolutePathFindings.push({ file: path.relative(archiveRoot, file), literal });
  }
}

function verifyMountMap(manifest, mountMap) {
  const verified = [];
  for (const item of manifest) {
    const actualPath = mountMap[item.logicalPath];
    if (!actualPath) throw new Error(`MISSING_MAPPING:${item.logicalPath}`);
    const bytes = fs.readFileSync(actualPath);
    const actualDigest = sha256(bytes);
    if (actualDigest !== item.sha256) {
      throw new Error(`DIGEST_MISMATCH:${item.logicalPath}:${actualDigest}`);
    }
    verified.push({ logicalPath: item.logicalPath, sha256: actualDigest });
  }
  return verified;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaopu-n256-'));
const inputDir = path.join(fixtureRoot, 'input');
fs.mkdirSync(inputDir, { recursive: true });
const exactInput = path.join(inputDir, 'value.mjs');
fs.writeFileSync(exactInput, 'export default 41;\n');
const logicalManifest = [
  { logicalPath: 'inputs/value.mjs', sha256: sha256(fs.readFileSync(exactInput)) },
];
const exactMap = { 'inputs/value.mjs': exactInput };
const exactVerified = verifyMountMap(logicalManifest, exactMap);

let missingMappingError = null;
try {
  verifyMountMap(logicalManifest, {});
} catch (error) {
  missingMappingError = error.message;
}

const tampered = path.join(inputDir, 'tampered.mjs');
fs.writeFileSync(tampered, 'export default 99;\n');
let digestMismatchError = null;
try {
  verifyMountMap(logicalManifest, { 'inputs/value.mjs': tampered });
} catch (error) {
  digestMismatchError = error.message;
}

const absoluteConsumer = path.join(fixtureRoot, 'absolute-consumer.mjs');
fs.writeFileSync(
  absoluteConsumer,
  "import value from '/workspace/shared/n256-fixture/value.mjs'; console.log(value + 1);\n",
);
const absoluteRun = spawnSync(process.execPath, [absoluteConsumer], { encoding: 'utf8' });

const relativeConsumer = path.join(fixtureRoot, 'relative-consumer.mjs');
fs.writeFileSync(
  relativeConsumer,
  "import value from './input/value.mjs'; console.log(value + 1);\n",
);
const relativeRun = spawnSync(process.execPath, [relativeConsumer], { encoding: 'utf8' });

const actualR127Run = spawnSync(
  process.execPath,
  [path.join(reviewRoot, 'source-audit.mjs')],
  { encoding: 'utf8' },
);

const checks = {
  r127ContainsHostAbsolutePathLiterals: absolutePathFindings.length > 0,
  r127FailsDuringAbsoluteEsmResolution:
    actualR127Run.status !== 0 && /ERR_MODULE_NOT_FOUND/.test(actualR127Run.stderr),
  exactContentAddressedMappingPasses:
    exactVerified.length === 1 && exactVerified[0].logicalPath === 'inputs/value.mjs',
  missingMappingFailsClosed: missingMappingError === 'MISSING_MAPPING:inputs/value.mjs',
  digestMismatchFailsClosed: digestMismatchError?.startsWith('DIGEST_MISMATCH:') === true,
  relativeInputRootConsumerRuns:
    relativeRun.status === 0 && relativeRun.stdout.trim() === '42',
  mountMapAloneDoesNotRewriteStaticAbsoluteImport:
    absoluteRun.status !== 0 && /ERR_MODULE_NOT_FOUND/.test(absoluteRun.stderr),
};

assert.equal(Object.values(checks).every(Boolean), true);

const result = {
  probe: 'N256_R127_CONTENT_ADDRESSED_RELATIVE_INPUT_ROOT',
  runtime: process.version,
  subjectArchiveSha256: '59c6dd88d0e57b2cd03a3314c93257e58cb6446ecb5c669a50deb7bee51af585',
  manifestAbsoluteInputCount: Object.keys(inputManifest.files).length,
  reviewSourceFileCount: reviewSources.length,
  absolutePathLiteralOccurrenceCount: absolutePathFindings.length,
  absolutePathSourceFileCount: new Set(absolutePathFindings.map(item => item.file)).size,
  executableAbsolutePathSourceFileCount: new Set(
    absolutePathFindings
      .filter(item => /\.(?:mjs|sh)$/.test(item.file))
      .map(item => item.file),
  ).size,
  sampleFindings: absolutePathFindings.slice(0, 8),
  actualR127ExitCode: actualR127Run.status,
  actualR127Failure:
    actualR127Run.stderr.split('\n').find(line => line.includes('Error [ERR_MODULE_NOT_FOUND]')) ?? null,
  exactVerified,
  missingMappingError,
  digestMismatchError,
  absoluteFixtureExitCode: absoluteRun.status,
  relativeFixtureExitCode: relativeRun.status,
  relativeFixtureOutput: relativeRun.stdout.trim(),
  checks,
  passCount: Object.values(checks).filter(Boolean).length,
  totalChecks: Object.keys(checks).length,
  boundary:
    'A content-addressed mount map validates caller-supplied bytes but cannot rewrite pre-existing static absolute ESM imports. Provider/verifier source must consume a relative logical input root or bind a versioned loader whose identity is part of the receipt.',
};

console.log(JSON.stringify(result, null, 2));
