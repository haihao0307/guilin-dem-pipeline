#!/usr/bin/env node
/** Encode the final three authoring scores as real, roundtrip-verified SQLite. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash, webcrypto} from 'node:crypto';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {normalizeWallScore, canonicalWallScore, WALL_KINDS} from '../wall-score.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const {encode, decode, formatInfo} = await import('./codec.mjs');
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let input, output = join(here, 'samples');
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--input' && args[index + 1]) input = resolve(args[++index]);
  else if (args[index] === '--out' && args[index + 1]) output = resolve(args[++index]);
  else throw Error('Usage: node native-codec/write_samples.mjs --input native-codec/samples-input.json [--out directory]');
}
if (!input) throw Error('Final sample score input required; no invented release samples');
const source = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(source) || source.length !== 3) throw Error('Exactly three wall scores required');
const kinds = source.map(score => score.kind).sort();
if (JSON.stringify(kinds) !== JSON.stringify([...WALL_KINDS].sort())) throw Error('One sample for each fixed wall kind required');
const ready = [];
for (const item of source) {
  const bytes = await encode(item), score = normalizeWallScore(item);
  if (!isDeepStrictEqual(await decode(bytes), score)) throw Error('Sample score roundtrip mismatch');
  ready.push({score, bytes});
}
await mkdir(output, {recursive: true});
const files = [];
for (const {score, bytes} of ready) {
  const filename = score.kind + '.KaoPu';
  await writeFile(join(output, filename), bytes);
  await writeFile(join(output, score.kind + '.score.json'), canonicalWallScore(score) + '\n');
  files.push({filename, kind: score.kind, id: score.object.id, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')});
}
const manifest = {profile: formatInfo.profile, scoreSchema: formatInfo.scoreSchema,
  dependencyStatus: formatInfo.dependencyStatus, graphSha256: formatInfo.graphSha256,
  files, checks: {roundtrip: 'passed', source: 'author-supplied final scores', sqliteCheck: 'run tests/verify_sqlite.py independently'}};
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
