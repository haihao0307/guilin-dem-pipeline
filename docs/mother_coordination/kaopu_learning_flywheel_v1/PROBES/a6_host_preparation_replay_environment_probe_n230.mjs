import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const manifest = JSON.parse(read('MANIFEST.json'));
const mismatches = [];
for (const entry of manifest.files) {
  const file = path.join(root, entry.path);
  if (!fs.existsSync(file)) {
    mismatches.push({path: entry.path, reason: 'missing'});
    continue;
  }
  const bytes = fs.readFileSync(file);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== entry.bytes || sha256 !== entry.sha256) {
    mismatches.push({path: entry.path, reason: 'bytes-or-sha256-mismatch'});
  }
}
assert.equal(mismatches.length, 0, 'untouched package manifest must verify before replay audit');

const replaySource = read('replay-smoke.mjs');
const scriptNames = [...replaySource.matchAll(/['"]([^'"]+\.mjs)['"]/g)]
  .map((match) => match[1])
  .filter((name) => fs.existsSync(path.join(root, name)));
const uniqueScripts = [...new Set(scriptNames)];
const hardcodedWritableTempPrefixes = [];
for (const script of uniqueScripts) {
  const source = read(script);
  for (const match of source.matchAll(/mkdtempSync\(\s*['"](\/workspace\/[^'"]+)['"]\s*\)/g)) {
    const prefix = match[1];
    hardcodedWritableTempPrefixes.push({
      script,
      prefix,
      requiredParent: path.dirname(prefix),
      parentMentionedInInterfaceOrReadme:
        read('README.md').includes(path.dirname(prefix)) ||
        read('INTERFACE_AND_SCOPE.md').includes(path.dirname(prefix))
    });
  }
}

const result = {
  schema: 'kaopu.candidate.replay-environment-closure-probe/1',
  subject: {
    libraryFileID: 'libfile_b5e6822105808191abb719df0f5a6596',
    archiveSHA256: 'a2b030fb3248049ef73688b2b96ffc786c64aa7bbe28089601458446f9c0ed5c'
  },
  packageManifest: {
    entries: manifest.files.length,
    mismatches: mismatches.length
  },
  coreReplayScripts: uniqueScripts,
  hardcodedWritableTempPrefixes,
  undeclaredAbsoluteWritableRoots: hardcodedWritableTempPrefixes
    .filter((row) => !row.parentMentionedInInterfaceOrReadme)
    .map((row) => row.requiredParent),
  decision: hardcodedWritableTempPrefixes.some((row) => !row.parentMentionedInInterfaceOrReadme)
    ? 'HOLD_A6_HOST_PREPARATION_REPLAY_ENVIRONMENT_CLOSURE_INCOMPLETE'
    : 'CANDIDATE_REPLAY_ENVIRONMENT_CLOSURE_STATIC_CHECK_PASS',
  boundary: 'Static closure check only. Runtime pass/fail and the post-bootstrap replay are recorded separately in the N230 result.'
};
console.log(JSON.stringify(result, null, 2));
