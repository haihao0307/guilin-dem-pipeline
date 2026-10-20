import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {fileURLToPath} from 'node:url';

// Copy this directory as research/<audit>/shoe-sharing/. Its sibling cloth/ owns the
// common downloader and source lock; no native source is duplicated here.
const root = new URL('../cloth/', import.meta.url);
const readJSON = async url => JSON.parse(await fs.readFile(url));
const lock = await readJSON(new URL('SOURCE_LOCK_AUDIT.json', root));
const recorded = await readJSON(new URL('./evidence/recorded-shoe-sharing.json', import.meta.url));
const required = [...recorded.sourceFilesVerified,
  {path: recorded.scanData.repositoryPath, sha256: recorded.scanData.sha256},
  {path: 'mp05-r10/vendor/three.module.js', sha256: recorded.runtime.threeFileSha256}];
for (const expected of required) {
  const entry = lock.files.find(f => f.path === expected.path);
  assert.ok(entry, 'Common source lock is missing ' + expected.path);
  assert.equal(entry.sha256, expected.sha256, 'Common lock differs from the measured source');
  const bytes = await fs.readFile(new URL(expected.path, root));
  assert.equal(bytes.length, entry.bytes, 'Source length drift: ' + expected.path);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected.sha256,
    'Source digest drift: ' + expected.path);
}
process.env.THREE_PATH = fileURLToPath(new URL('mp05-r10/vendor/three.module.js', root));
register('./node-loader.mjs', import.meta.url);
await import('./shoe-sharing-experiment.mjs');
