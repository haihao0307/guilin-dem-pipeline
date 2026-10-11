import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash, webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {encode, decode, decodeFile, validateScoreData, pinnedDependencies, verifyDependencyBytes,
  crc32, canonicalJSON, formatInfo, MAX_FILE_BYTES, MAX_PAYLOAD_BYTES} from './codec.mjs';
import {LAYOUT} from './template-data.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dependencies = {};
for (const pin of pinnedDependencies()) dependencies[pin.id] = new Uint8Array(await readFile(path.join(root, pin.id.replaceAll('__', '/'))));
const expected = [
  'room-recipe.mjs', 'room-unit.mjs', 'room-native.mjs',
  'native__timber__original-core.mjs', 'native__timber__three-adapter.mjs',
  'r312-wall__original-shaders.mjs', 'r312-wall__adapter-shaders.mjs', 'r312-wall__r312-wall.mjs',
];

async function craftedPayload(text) {
  const file = await encode({}), payload = new Uint8Array(MAX_PAYLOAD_BYTES).fill(32);
  payload.set(typeof text === 'string' ? new TextEncoder().encode(text) : text);
  for (const segment of LAYOUT.segments) file.set(payload.subarray(segment.logicalOffset, segment.logicalOffset + segment.length), segment.fileOffset);
  file.set(new TextEncoder().encode(createHash('sha256').update(payload).digest('hex')), LAYOUT.digestOffset);
  file.set(new TextEncoder().encode(crc32(payload)), LAYOUT.crcOffset);
  return file;
}

test('real SQLite 0.2 recipe envelope round-trips deterministic fixed original-material room', async () => {
  const first = await encode({}), second = await encode({});
  assert.deepEqual(first, second);
  assert.equal(new TextDecoder().decode(first.subarray(0, 16)), 'SQLite format 3\0');
  assert.equal(first.length, MAX_FILE_BYTES);
  const score = await decode(first);
  assert.equal(score.schema, 'kaopu.dwelling-unit/2');
  assert.equal(score.kind, 'dwelling');
  assert.deepEqual([score.width, score.depth, score.height], [4, 4, 3]);
  assert.equal(score.presetId, 'yunnan_light_weathered_v2');
  assert.equal(score.wallBindingMode, 'declared');
  assert.equal(validateScoreData(score), true);
  assert.equal(formatInfo.profile, 'kaopu.dwelling-unit/0.2-experimental');
  assert.equal(formatInfo.operator, 'kaopu.dwelling-unit');
  assert.equal(formatInfo.generalKAOPUSupport, false);
  assert.equal(formatInfo.requiredHostMaterialRevision, 'OriginalTimber-v3+BrickR3.12');
  assert.deepEqual(formatInfo.supportedWallBindingModes, ['declared', 'legacy']);
  assert.equal(formatInfo.defaultWallBindingMode, 'declared');
  assert.equal(formatInfo.embeddedGeometry || formatInfo.embeddedTextures || formatInfo.embeddedExecutableCode, false);
});

test('door state survives canonical save; input snapshot precedes asynchronous hashing', async () => {
  const input = {doorOpen: false}, pending = encode(input);
  input.doorOpen = true;
  assert.equal((await decode(await pending)).doorOpen, false);
  assert.equal((await decode(await encode({doorOpen: true}))).doorOpen, true);
});

test('declared array binding is default; explicit legacy A/B mode survives recipe round-trip', async () => {
  for (const wallBindingMode of ['declared', 'legacy']) {
    const score = await decode(await encode({wallBindingMode}));
    assert.equal(score.wallBindingMode, wallBindingMode);
    assert.equal(validateScoreData(score), true);
  }
});

test('exact eight dependency pins include multi-level paths and bytes are verified', async () => {
  assert.deepEqual(pinnedDependencies().map(pin => pin.id).sort(), [...expected].sort());
  assert.equal(await verifyDependencyBytes(dependencies), true);
  const original = pinnedDependencies(); original[0].sha256 = '0'.repeat(64);
  assert.notDeepEqual(original, pinnedDependencies());
  const missing = {...dependencies}; delete missing[expected[0]];
  await assert.rejects(() => verifyDependencyBytes(missing), /MISSING_RULE_BYTES/);
  const corrupted = {...dependencies, [expected[0]]: dependencies[expected[0]].slice()};
  corrupted[expected[0]][0] ^= 1;
  await assert.rejects(() => verifyDependencyBytes(corrupted), /LOADED_RULE_HASH_MISMATCH/);
  await assert.rejects(() => verifyDependencyBytes({...dependencies, [expected[0]]: new Uint8Array(1)}), /LOADED_RULE_SIZE_MISMATCH/);
  let invoked = false;
  const getter = {...dependencies}; Object.defineProperty(getter, expected[0], {get() {invoked = true; return dependencies[expected[0]];}});
  await assert.rejects(() => verifyDependencyBytes(getter), /MISSING_RULE_BYTES/);
  assert.equal(invoked, false);
});

test('schema, geometry ranges, source payloads and executable JS inputs are refused', async () => {
  const invalid = [
    {schema: 'kaopu.dwelling-unit/1'}, {kind: 'plant'}, {width: 3.6}, {depth: 5}, {height: 2.8},
    {doorOpen: 'false'}, {wallBindingMode: 'automatic'}, {wallBindingMode: null}, {presetId: 'invented-preset'},
    {seed: Infinity}, {seed: NaN}, {mesh: []}, {texture: []}, {source: 'https://invalid.example/'},
    {script: 'alert(1)'}, {positions: [0, 0, 0]}, {url: 'https://invalid.example/'},
    {id: 'data:text/javascript,alert(1)'}, {id: 123}, {id: null}, {extra: 1}, {id: () => 'code'},
    {id: 'x'.repeat(300)}, JSON.parse('{"__proto__":{}}'), new Date(),
  ];
  for (const input of invalid) await assert.rejects(() => encode(input), JSON.stringify(input));
  let invoked = false;
  const input = {}; Object.defineProperty(input, 'seed', {enumerable: true, get() {invoked = true; return 1;}});
  await assert.rejects(() => encode(input), /PLAIN_JSON_PROPERTY_REQUIRED/);
  assert.equal(invoked, false);
});

test('foreign bytes, immutable graph changes, padding corruption and malformed checksum fail closed', async () => {
  await assert.rejects(() => decode(new TextEncoder().encode('{"kind":"dwelling"}')), /FILE_SIZE_MISMATCH/);
  const base = await encode({});
  const signature = base.slice(); signature[0] ^= 1;
  await assert.rejects(() => decode(signature), /BAD_SQLITE_SIGNATURE/);
  const graph = base.slice(); graph[24] ^= 1;
  await assert.rejects(() => decode(graph), /IMMUTABLE_CONTAINER_MISMATCH/);
  const payload = base.slice(); payload[LAYOUT.segments.at(-1).fileOffset + LAYOUT.segments.at(-1).length - 1] ^= 1;
  await assert.rejects(() => decode(payload), /ASSET_CRC32_MISMATCH/);
  const hash = base.slice(); hash[LAYOUT.digestOffset] = hash[LAYOUT.digestOffset] === 48 ? 49 : 48;
  await assert.rejects(() => decode(hash), /ASSET_HASH_MISMATCH/);
  const checksum = base.slice(); checksum[LAYOUT.crcOffset] = 122;
  await assert.rejects(() => decode(checksum), /ASSET_CHECKSUM_FORMAT/);
});

test('recomputed checksums cannot bypass recipe validation, UTF-8 or canonical representation', async () => {
  const score = await decode(await encode({}));
  await assert.rejects(() => decodeCraft({ ...score, mesh: [] }));
  await assert.rejects(() => decodeCraft({ ...score, width: 5 }));
  await assert.rejects(async () => decode(await craftedPayload('{}')), /INCOMPLETE_OR_NON_NORMALIZED_SCORE/);
  await assert.rejects(async () => decode(await craftedPayload('{invalid')), /INVALID_JSON_PAYLOAD/);
  await assert.rejects(async () => decode(await craftedPayload(new Uint8Array([0xff]))), /INVALID_JSON_PAYLOAD/);
  const canonical = canonicalJSON(score);
  await assert.rejects(async () => decode(await craftedPayload(' ' + canonical)), /NON_CANONICAL_PAYLOAD/);
  await assert.rejects(async () => decode(await craftedPayload('{"kind":"dwelling",' + canonical.slice(1))), /NON_CANONICAL_PAYLOAD/);
  async function decodeCraft(value) {return decode(await craftedPayload(canonicalJSON(value)));}
});

test('file size is rejected before allocation and alternate byte views are handled safely', async () => {
  let read = false;
  await assert.rejects(() => decodeFile({size: MAX_FILE_BYTES + 1, async arrayBuffer() {read = true;}}), /FILE_SIZE_MISMATCH/);
  assert.equal(read, false);
  const bytes = await encode({doorOpen: false});
  assert.deepEqual(await decodeFile(new Blob([bytes])), await decode(bytes));
  const wrapped = new Uint8Array(bytes.length + 8); wrapped.set(bytes, 4);
  assert.deepEqual(await decode(wrapped.subarray(4, bytes.length + 4)), await decode(bytes));
});
