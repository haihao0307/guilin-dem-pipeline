#!/usr/bin/env node
'use strict';
/**
 * Select complete native packets from actual cumulative DOM assets.served.
 * No coefficient-derived list is used. The full manifest/cache are retained.
 * This is packaging evidence, not a new browser or visual acceptance result.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const here = __dirname;
const VERSION = 'NPC-LIVING-COURTYARD-R01';
const CANONICAL_SHA = 'd1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const MANIFEST_SHA = 'f3075563d5b20ae6bd6471de77eb6394fa4cb12f5aa37774075ccaadd9c7fbd4';
const NATIVE_BASE = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/';
const EXPECTED = {A: ['r02-adult-male-tall-slim', 'P01'], B: ['r02-adult-male-short-heavy', 'P02']};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');

function usage() {
  console.log(`Usage: node prune-observed.cjs --evidence <actual-final.json> [options]

  --evidence FILE     Repeat to union actual cumulative DOM resource observations.
  --qa FILE           Optional companion qa.json; record its source head/HTML hash.
  --packets FILE      Full lock input (default vendor/PACKETS.full.json if present,
                      otherwise vendor/PACKETS.json).
  --manifest FILE     Original full manifest (default vendor/StreamingManifest.json).
  --assets DIR        Complete local chunk cache (default vendor/assets).
  --backup FILE       Byte-exact full lock backup (default vendor/PACKETS.full.json).
  --output FILE       Selected lock (default vendor/PACKETS.observed.json).
  --report FILE       Provenance report (default <output>.provenance.json).
  --stage-assets DIR  Copy ONLY selected chunks into an absent or empty directory.
  --help              Show this text without writing files.

All supplied paths resolve from the current directory. Defaults resolve beside
this tool. Evidence may be the verifier's {source,capturedAt,state} wrapper or
an extracted state retaining complete source.identities and assets.served/missing.
Old startup source heads are accepted when the exact canonical source, manifest,
and A/B native identities match; their hashes are retained as provenance.

Example, before the candidate's network build and suite:
  node prune-observed.cjs --evidence qa/final.json --qa qa/qa.json \\
    --output vendor/PACKETS.json --stage-assets dist/assets

dist/assets must be absent/empty for staging. This tool never deletes an old
cache. build.cjs copies selected files but does not remove stale full-cache
files: use a clean/staged assets directory, not an old complete dist/assets.
Run suite on the resulting exact index.html; then build --offline separately.
The full StreamingManifest.json and vendor/assets are never pruned or rewritten.`);
}

function options(argv) {
  const o = {evidence: []};
  const known = new Set(['evidence', 'qa', 'packets', 'manifest', 'assets', 'backup', 'output', 'report', 'stage-assets']);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    assert(argv[i].startsWith('--') && known.has(key), 'Unknown option: ' + argv[i]);
    assert(argv[i + 1] && !argv[i + 1].startsWith('--'), 'Missing value for --' + key);
    const value = path.resolve(argv[++i]);
    if (key === 'evidence') o.evidence.push(value);
    else { assert(!o[key], 'Duplicate --' + key); o[key] = value; }
  }
  assert(o.evidence.length > 0, 'Provide --evidence from an actual completed native startup DOM capture.');
  o.backup ||= path.join(here, 'vendor/PACKETS.full.json');
  o.packets ||= fs.existsSync(o.backup) ? o.backup : path.join(here, 'vendor/PACKETS.json');
  o.manifest ||= path.join(here, 'vendor/StreamingManifest.json');
  o.assets ||= path.join(here, 'vendor/assets');
  o.output ||= path.join(here, 'vendor/PACKETS.observed.json');
  o.report ||= o.output + '.provenance.json';
  const protectedPaths = [o.manifest, o.backup, ...o.evidence, o.qa].filter(Boolean);
  assert(!protectedPaths.includes(o.output), 'Output must not overwrite the manifest, full backup, or evidence.');
  assert(![o.output, o.packets, ...protectedPaths].includes(o.report), 'Report must have its own path.');
  assert(o.backup !== o.manifest && !o.evidence.includes(o.backup) && o.backup !== o.qa, 'Backup must have its own path.');
  if (o['stage-assets']) {
    assert(path.resolve(o['stage-assets']) !== path.resolve(o.assets), 'Staging must not overwrite the full cache.');
    if (fs.existsSync(o['stage-assets'])) {
      assert(fs.lstatSync(o['stage-assets']).isDirectory(), 'Staging must be a real directory, not a symlink/file.');
      assert.equal(fs.readdirSync(o['stage-assets']).length, 0, 'Staging directory must be empty; stale assets are never silently removed.');
    }
  }
  return o;
}

function readJSON(file) {
  const bytes = fs.readFileSync(file);
  return {file, bytes, sha256: hash(bytes), value: JSON.parse(bytes.toString('utf8'))};
}

function writeAtomic(file, bytes) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temp = file + '.tmp-' + process.pid;
  try { fs.writeFileSync(temp, bytes, {flag: 'wx'}); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function checkFullCache(o, manifest, full) {
  assert.equal(manifest.sha256, MANIFEST_SHA, 'Exact original native streaming manifest');
  assert.equal(manifest.value.schema, 'kaopu-native-streaming/1');
  const lock = full.value;
  assert.equal(lock.schema, 'kaopu/npc-native-packets@1');
  assert.equal(lock.nativeBase, NATIVE_BASE, 'Immutable native asset source');
  assert.equal(lock.sourceManifestSHA256, manifest.sha256, 'Full lock matches original manifest');
  assert.equal(lock.allNativePackets, true, 'Input must be the complete original packet lock, not a prior subset.');
  const files = manifest.value.files;
  assert(Array.isArray(files) && files.length > 0, 'Native manifest has files');
  assert.deepEqual(lock.packetIds, files.map(f => f.id), 'Full lock packet order/completeness');
  assert.equal(new Set(lock.packetIds).size, lock.packetIds.length, 'Unique packet IDs');
  assert.equal(lock.packets.length, files.length, 'Complete packet metadata');
  const packetById = new Map(lock.packets.map(p => [p.id, p]));
  assert.equal(packetById.size, files.length, 'Unique packet metadata');
  const chunks = new Map();
  const locals = new Set();
  for (const chunk of lock.chunks) {
    assert(typeof chunk.url === 'string' && !chunks.has(chunk.url), 'Unique absolute chunk URL');
    assert(/^[a-zA-Z0-9._-]+\.bin$/.test(chunk.local) && !locals.has(chunk.local), 'Safe unique cache filename');
    assert(Number.isSafeInteger(chunk.bytes) && chunk.bytes > 0, 'Valid chunk byte count');
    assert(/^[a-f0-9]{64}$/.test(chunk.sha256), 'Valid chunk SHA256');
    chunks.set(chunk.url, {...chunk, packetId: null}); locals.add(chunk.local);
  }
  let total = 0;
  for (const file of files) {
    const packet = packetById.get(file.id);
    for (const key of ['bytes', 'sha256', 'rawBytes', 'rawSHA256']) assert.equal(packet[key], file[key], 'Packet metadata ' + file.id + '/' + key);
    let offset = 0;
    const packetHash = crypto.createHash('sha256');
    assert(Array.isArray(file.chunks) && file.chunks.length, 'Packet has complete chunk references');
    for (const item of file.chunks) {
      const url = new URL(item.url, lock.nativeBase).href;
      const chunk = chunks.get(url);
      assert(chunk, 'Manifest chunk absent from full lock: ' + url);
      assert.equal(chunk.packetId, null, 'Ambiguous/multiple packet mapping for ' + url);
      assert.equal(item.offset, offset, 'Contiguous complete packet ' + file.id);
      assert.equal(item.bytes, chunk.bytes, 'Chunk byte count ' + url);
      assert.equal(item.sha256, chunk.sha256, 'Chunk SHA reference ' + url);
      assert.equal(new URL(url).pathname.split('/').pop(), chunk.local, 'Cache filename matches original URL');
      const cached = path.join(o.assets, chunk.local);
      assert(fs.lstatSync(cached).isFile(), 'Cache entry must be a regular file: ' + cached);
      const bytes = fs.readFileSync(cached);
      assert.equal(bytes.length, item.bytes, 'Existing chunk byte length ' + chunk.local);
      assert.equal(hash(bytes), item.sha256, 'Existing chunk SHA256 ' + chunk.local);
      packetHash.update(bytes); offset += bytes.length; chunk.packetId = file.id;
    }
    assert.equal(offset, file.bytes, 'Complete packet bytes ' + file.id);
    assert.equal(packetHash.digest('hex'), file.sha256, 'Complete compressed packet SHA256 ' + file.id);
    total += offset;
  }
  assert([...chunks.values()].every(c => c.packetId), 'Every full-lock chunk maps to an original packet');
  assert.equal(lock.compressedBytes, total, 'Full lock byte total');
  return {chunks, files, total};
}

function observation(file, chunkMap) {
  const input = readJSON(file), doc = input.value, state = doc.state || doc;
  assert(state && typeof state === 'object', 'Evidence state object: ' + file);
  const source = state.source, assets = state.assets;
  assert.equal(source?.canonicalVersion, 'HUMAN-INTEGRATED-R07', 'Evidence canonical version');
  assert.equal(source.canonicalSHA256, CANONICAL_SHA, 'Evidence exact canonical source');
  if (state.version) {
    assert.equal(typeof state.version === 'string' ? state.version : state.version.version, VERSION, 'Evidence app version');
    if (typeof state.version === 'object' && state.version.canonicalSHA256) assert.equal(state.version.canonicalSHA256, CANONICAL_SHA);
  }
  if (Object.hasOwn(state, 'ready')) assert.equal(state.ready, true, 'Observed native startup must be ready');
  if (Object.hasOwn(state, 'errors')) assert.deepEqual(state.errors, [], 'Observed app errors must be empty');
  if (state.render) {
    assert.equal(state.render.startupDrain?.completed, true, 'Observed startup GPU drain');
    assert(state.render.completed >= 1 && state.render.maxInFlight <= 1, 'Observed completed native frame');
  }
  assert(Array.isArray(source.identities) && source.identities.length === 2, 'Evidence must retain both complete native A/B identities');
  assert.deepEqual(source.identities.map(a => a.id).sort(), ['A', 'B'], 'Exactly actors A and B');
  for (const actor of source.identities) {
    assert.equal(actor.identity?.presetId, EXPECTED[actor.id][0], 'Same original body preset ' + actor.id);
    assert.equal(actor.identity.portraitId, EXPECTED[actor.id][1], 'Same original portrait ' + actor.id);
    const b = actor.binding;
    assert.equal(b?.nativeBones, 104, 'Complete native skeleton ' + actor.id);
    assert.equal(b.weightsTruncated, false, 'Complete skin weights ' + actor.id);
    assert.equal(b.originalAttributesRetained, true, 'Original native attributes ' + actor.id);
    assert.equal(b.r07MaterialGroups, 2, 'Both native materials ' + actor.id);
    assert(Number.isInteger(b.nativeVertices) && b.nativeVertices > 0 && b.displayVertices >= b.nativeVertices, 'Complete native/display vertices ' + actor.id);
  }
  assert(assets && ['same-origin-native-packets', 'embedded'].includes(assets.mode), 'Observed native transport mode');
  assert.deepEqual(assets.missing, [], 'No missing/unregistered native assets in supplied observation');
  assert(Array.isArray(assets.served) && assets.served.length > 0, 'Actual nonempty cumulative assets.served is required');
  if (assets.servedCount !== undefined) assert.equal(assets.servedCount, assets.served.length, 'Unmodified cumulative request count');
  const urls = [...new Set(assets.served)];
  const packetIds = new Set();
  for (const url of urls) {
    assert(typeof url === 'string', 'Observed URLs must be exact strings');
    const chunk = chunkMap.get(url);
    assert(chunk, 'Observed URL cannot map exactly to the original full manifest: ' + url);
    packetIds.add(chunk.packetId);
  }
  assert(packetIds.has('hot'), 'Cumulative evidence must include original initial hot loading, not only a later actor fragment.');
  return {urls, packetIds, provenance: {
    file, sha256: input.sha256, bytes: input.bytes.length,
    capturedAt: doc.capturedAt || null,
    description: typeof doc.source === 'string' ? doc.source : 'Provided extracted DOM state; provenance is the supplied file hash.',
    sourceHead: doc.sourceHead || state.version?.sourceHead || null,
    canonicalSHA256: source.canonicalSHA256,
    identities: source.identities,
    readyField: Object.hasOwn(state, 'ready') ? state.ready : 'not retained in extracted evidence',
    renderField: state.render ? {startupDrainCompleted: true, completed: state.render.completed} : 'not retained in extracted evidence',
    errorsField: Object.hasOwn(state, 'errors') ? state.errors : 'not retained in extracted evidence',
    assetMode: assets.mode, requestCount: assets.served.length, uniqueChunkCount: urls.length,
    served: urls, missing: assets.missing
  }};
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) { usage(); return; }
  const o = options(process.argv.slice(2));
  const manifest = readJSON(o.manifest), full = readJSON(o.packets);
  if (fs.existsSync(o.backup)) assert.equal(hash(fs.readFileSync(o.backup)), full.sha256, 'Existing full backup must be byte-identical; never overwrite a different backup.');
  const cache = checkFullCache(o, manifest, full);
  const observations = o.evidence.map(file => observation(file, cache.chunks));
  const requested = new Set(observations.flatMap(x => x.urls));
  const chosen = new Set(observations.flatMap(x => [...x.packetIds]));
  const packetIds = cache.files.filter(p => chosen.has(p.id)).map(p => p.id);
  const chunks = full.value.chunks.filter(c => chosen.has(cache.chunks.get(c.url).packetId));
  const compressedBytes = chunks.reduce((sum, c) => sum + c.bytes, 0);
  let qa = null;
  if (o.qa) {
    const q = readJSON(o.qa), value = q.value;
    if (value.version) assert.equal(value.version, VERSION, 'Companion QA app version');
    if (value.observedPreviewSHA256 && value.expectedPreviewSHA256) assert.equal(value.observedPreviewSHA256, value.expectedPreviewSHA256, 'Companion QA HTML source gate');
    qa = {file: q.file, sha256: q.sha256, bytes: q.bytes.length, sourceHead: value.sourceHead || null,
      phase: value.phase || null, status: value.status || null,
      sourceGatePassed: value.sourceGate?.passed === true, startupPassed: value.startupPassed === true,
      fullSuitePassed: value.fullSuitePassed === true,
      observedPreviewSHA256: value.observedPreviewSHA256 || null, expectedPreviewSHA256: value.expectedPreviewSHA256 || null};
  }
  const selection = {schema: 'kaopu/observed-native-packet-closure@1',
    basis: 'Exact cumulative assets.served URLs from supplied actual DOM evidence; retain every chunk in each referenced original packet.',
    observationSemantics: 'Cumulative registered native fetch attempts, including any subsequently cancelled attempt; not a claim that each request completed. Local cached bytes are independently SHA-verified.',
    originalManifestSHA256: manifest.sha256, originalFullLockSHA256: full.sha256,
    canonicalSHA256: CANONICAL_SHA, completePacketClosure: true,
    sourceInitialLoadAndActors: ['original-host-initial-load', 'A', 'B'],
    sourceHeadEqualityRequired: false,
    evidence: observations.map(({provenance: p}) => ({file: p.file, sha256: p.sha256, bytes: p.bytes, capturedAt: p.capturedAt, sourceHead: p.sourceHead})),
    companionQA: qa, actualUniqueRequestedChunks: requested.size,
    closureAddedChunks: chunks.filter(c => !requested.has(c.url)).map(c => c.url),
    browserRuntimeVerifiedByThisTool: false, visualAcceptance: false};
  const selected = {...full.value, packetIds, allNativePackets: packetIds.length === cache.files.length,
    compressedBytes, packets: full.value.packets.filter(p => chosen.has(p.id)), chunks, observedClosure: selection};
  const output = jsonBytes(selected);
  const report = {...selection, schema: 'kaopu/observed-native-prune-report@1', generatedAt: new Date().toISOString(),
    observations: observations.map(x => x.provenance),
    manifest: {file: o.manifest, sha256: manifest.sha256, unchanged: true},
    fullLock: {file: o.packets, backup: o.backup, sha256: full.sha256, packetCount: cache.files.length, chunkCount: cache.chunks.size, compressedBytes: cache.total},
    validatedExistingCache: {chunkCount: cache.chunks.size, completePacketHashes: cache.files.length, bytes: cache.total},
    selected: {file: o.output, sha256: hash(output), packetIds, packetCount: packetIds.length, chunkCount: chunks.length, compressedBytes},
    staging: {directory: o['stage-assets'] || null, selectedChunksOnly: Boolean(o['stage-assets']),
      requirement: 'Use only selected chunk files in the published assets directory. build.cjs does not delete stale assets; never copy an old full dist/assets.'},
    fullCacheRetained: true, newBrowserTestRun: false, visualAcceptance: false, productionReady: false};

  // No output mutation occurs before every source/evidence/cache check succeeds.
  if (!fs.existsSync(o.backup)) {
    fs.mkdirSync(path.dirname(o.backup), {recursive: true});
    fs.writeFileSync(o.backup, full.bytes, {flag: 'wx'});
  }
  if (o['stage-assets']) {
    fs.mkdirSync(o['stage-assets'], {recursive: true});
    for (const chunk of chunks) {
      const destination = path.join(o['stage-assets'], chunk.local);
      fs.copyFileSync(path.join(o.assets, chunk.local), destination, fs.constants.COPYFILE_EXCL);
      assert.equal(hash(fs.readFileSync(destination)), chunk.sha256, 'Staged chunk SHA256 ' + chunk.local);
    }
    assert.deepEqual(fs.readdirSync(o['stage-assets']).sort(), chunks.map(c => c.local).sort(), 'Staging contains selected chunks only');
  }
  writeAtomic(o.output, output);
  writeAtomic(o.report, jsonBytes(report));
  assert.equal(hash(fs.readFileSync(o.manifest)), manifest.sha256, 'Original full manifest unchanged');
  assert.equal(hash(fs.readFileSync(o.backup)), full.sha256, 'Original full lock preserved byte-for-byte');
  console.log(JSON.stringify({status: 'observed-packet-closure-written', output: o.output, report: o.report,
    packetIds, selectedPackets: packetIds.length, fullPackets: cache.files.length,
    selectedChunks: chunks.length, fullChunks: cache.chunks.size, compressedBytes,
    fullCompressedBytes: cache.total, sha256: hash(output), fullLockBackup: o.backup,
    stagedAssets: o['stage-assets'] || null, stagingRequirement: report.staging.requirement,
    browserRuntimeVerifiedByThisTool: false, visualAcceptance: false}, null, 2));
}

try { main(); } catch (error) { console.error('prune-observed: ' + error.message); process.exitCode = 1; }
