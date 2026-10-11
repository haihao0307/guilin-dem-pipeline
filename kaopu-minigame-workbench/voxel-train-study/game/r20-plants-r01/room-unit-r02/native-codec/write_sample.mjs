import {writeFile, mkdir, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash, webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const {encode, decode, verifyDependencyBytes, pinnedDependencies, formatInfo} = await import('./codec.mjs');
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.dirname(dir);
const dependencyBytes = {};
for (const pin of pinnedDependencies()) {
  dependencyBytes[pin.id] = new Uint8Array(await readFile(path.join(root, pin.id.replaceAll('__', '/'))));
}
assert.equal(pinnedDependencies().length, 8);
await verifyDependencyBytes(dependencyBytes);
const bytes = await encode({}), score = await decode(bytes);
assert.equal(score.schema, 'kaopu.dwelling-unit/2');
assert.equal(score.kind, 'dwelling');
assert.equal(score.width, 4);
assert.equal(score.depth, 4);
assert.equal(score.height, 3);
assert.equal(score.presetId, 'yunnan_light_weathered_v2');
assert.equal(score.wallBindingMode, 'declared');
await mkdir(path.join(dir, 'samples'), {recursive: true});
await writeFile(path.join(dir, 'samples/original-material-dwelling.KaoPu'), bytes);
await writeFile(path.join(dir, 'samples/original-material-dwelling.score.json'), JSON.stringify(score, null, 2) + '\n');
const receipt = {
  file: 'original-material-dwelling.KaoPu', bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  format: formatInfo, score, dependencies: pinnedDependencies(),
};
await writeFile(path.join(dir, 'sample-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
