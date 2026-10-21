/* Exhaustive JS-loader tests, using exact range reads from verified local shards. */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash, webcrypto} = require('node:crypto');
const root = __dirname;
require('./candidate/guilin/canonical-tile-source.js');
const manifestBytes = fs.readFileSync(path.join(root, 'CANONICAL_ELEVATION_MANIFEST.json'));
const manifest = JSON.parse(manifestBytes);
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'baseline/guilin/data/NATIVE_ELEVATION_MANIFEST.json')));
const sha = data => createHash('sha256').update(Buffer.from(data)).digest('hex');
const base = 'https://example.invalid/guilin-elevation-store-v1/';

function mockTransport(mode = 'ok') {
  const stats = {manifestRequests: 0, ranges: 0, maxRangeBytes: 0, active: 0, peakActive: 0, bodyReads: 0, cancelled: 0, requestedChunks: new Set()};
  const offsets = new Map(manifest.chunks.map(t => [`${t.shard}:${t.shard_byte_offset}`, t.id]));
  async function fetchFn(url, options) {
    assert.ok(url.startsWith(base), 'Unexpected request destination');
    if (url.endsWith('CANONICAL_ELEVATION_MANIFEST.json')) {
      stats.manifestRequests++;
      const b = Buffer.from(manifestBytes);
      if (mode === 'bad-manifest-sha') b[0] ^= 1;
      return new Response(b, {status: 200});
    }
    const name = url.slice(base.length);
    assert.match(name, /^shards\/elevation-shard-00[0-6]\.i16pack$/);
    const range = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
    assert.ok(range, 'Every shard request needs a single bounded range');
    const start = +range[1], end = +range[2], size = end-start+1;
    stats.ranges++; stats.maxRangeBytes = Math.max(stats.maxRangeBytes, size);
    stats.requestedChunks.add(offsets.get(`${name}:${start}`));
    assert.ok(size <= 524288);
    stats.active++; stats.peakActive = Math.max(stats.peakActive, stats.active);
    const file = path.join(root, 'payload/guilin-elevation-store-v1', name);
    const total = fs.statSync(file).size;
    const f = await fsp.open(file, 'r'), b = Buffer.alloc(size);
    try { const read = await f.read(b, 0, size, start); assert.equal(read.bytesRead, size); }
    finally { await f.close(); stats.active--; }
    if (mode === 'wrong-sha') b[0] ^= 1;
    const headers = new Headers({'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(size)});
    if (mode === 'wrong-content-range') headers.set('Content-Range', `bytes ${start+1}-${end}/${total}`);
    if (mode === 'wrong-content-length') headers.set('Content-Length', String(total));
    if (mode === 'encoded-response') headers.set('Content-Encoding', 'gzip');
    return {
      status: mode === 'whole-shard-200' ? 200 : mode === 'range-416' ? 416 : 206,
      headers,
      body: {cancel: async () => { stats.cancelled++; }},
      arrayBuffer: async () => {
        stats.bodyReads++;
        const data = mode === 'truncated-body' ? b.subarray(0, size-2) : b;
        return data.buffer.slice(data.byteOffset, data.byteOffset+data.byteLength);
      },
    };
  }
  return {stats, fetchFn};
}

async function main() {
  const good = mockTransport();
  const source = createGuilinCanonicalTileSource({baseUrl: base, fetchFn: good.fetchFn, cryptoImpl: webcrypto});
  assert.equal(good.stats.ranges, 0, 'No eager native fetch');
  const tiles = [];
  for (const tile of legacy.tiles) {
    const buffer = await source.loadTile(tile);
    assert.equal(buffer.byteLength, 8388608);
    assert.equal(sha(buffer), tile.sha256, tile.id);
    tiles.push({id: tile.id, complete_8388608_byte_sha_matches_legacy: true});
  }
  assert.equal(good.stats.manifestRequests, 1);
  assert.equal(good.stats.requestedChunks.size, 840);
  assert.ok(!good.stats.requestedChunks.has(undefined));
  assert.ok(good.stats.peakActive <= 4);
  const memory = source.diagnostics();
  assert.ok(memory.cachedChunks <= 32 && memory.cachedChunkBytes <= 16777216 && memory.peakRetainedCacheBytes <= 16777216);
  assert.equal(memory.activeRangeLoads, 0); assert.equal(memory.queuedRangeLoads, 0); assert.equal(memory.assemblingTiles, 0);
  const concurrent = mockTransport();
  const shared = createGuilinCanonicalTileSource({baseUrl: base, fetchFn: concurrent.fetchFn, cryptoImpl: webcrypto});
  const first = legacy.tiles[0];
  const pair = await Promise.all([shared.loadTile(first), shared.loadTile(first)]);
  assert.equal(sha(pair[0]), first.sha256); assert.equal(sha(pair[1]), first.sha256);
  assert.equal(concurrent.stats.manifestRequests, 1);
  assert.equal(concurrent.stats.ranges, 16, 'Inflight chunks must deduplicate');
  const failures = [];
  for (const mode of ['whole-shard-200','range-416','wrong-content-range','wrong-content-length','encoded-response','wrong-sha','truncated-body','bad-manifest-sha']) {
    const transport = mockTransport(mode);
    const broken = createGuilinCanonicalTileSource({baseUrl: base, fetchFn: transport.fetchFn, cryptoImpl: webcrypto});
    await assert.rejects(broken.loadTile(first));
    while (transport.stats.active) await new Promise(resolve => setTimeout(resolve, 1));
    if (['whole-shard-200','range-416','wrong-content-range','wrong-content-length','encoded-response'].includes(mode)) {
      assert.equal(transport.stats.bodyReads, 0, mode+' must reject before payload consumption');
      assert.ok(transport.stats.cancelled > 0);
    }
    failures.push({mode, rejected: true, binary_body_reads: transport.stats.bodyReads});
  }
  const beforeInvalid = good.stats.ranges;
  const outside = JSON.parse(JSON.stringify(first)); outside.source_window[0]--;
  await assert.rejects(source.loadTile(outside));
  const badPadding = JSON.parse(JSON.stringify(legacy.tiles.at(-1))); badPadding.valid_grid[0]++;
  await assert.rejects(source.loadTile(badPadding));
  assert.equal(good.stats.ranges, beforeInvalid, 'Invalid mapping must not issue a shard request');
  const four = mockTransport();
  const fourSource = createGuilinCanonicalTileSource({baseUrl: base, fetchFn: four.fetchFn, cryptoImpl: webcrypto});
  const cornerTiles = [legacy.tiles[0], legacy.tiles[5], legacy.tiles[48], legacy.tiles[53]];
  const cornerBuffers = await Promise.all(cornerTiles.map(t => fourSource.loadTile(t)));
  cornerBuffers.forEach((buffer, i) => assert.equal(sha(buffer), cornerTiles[i].sha256));
  const fourMemory = fourSource.diagnostics();
  assert.ok(fourMemory.cachedChunkBytes <= 16777216 && fourMemory.peakRetainedCacheBytes <= 16777216);
  assert.equal(fourMemory.peakAssemblingTiles, 4); assert.ok(four.stats.peakActive <= 4);
  const result = {passed: true, test_environment: 'Node real adapter + mocked HTTP backed by exact local file range reads',
    all_54_legacy_virtual_tiles_whole_buffer_sha_matched: true, unique_aoi_samples_covered: 211919355,
    virtual_tile_samples_including_duplicate_edges_and_padding: 54*2048*2048,
    all_840_canonical_chunks_exercised: true, native_requests_before_first_tile: 0,
    manifest_requests: good.stats.manifestRequests, range_requests: good.stats.ranges,
    largest_range_bytes: good.stats.maxRangeBytes, peak_active_range_requests: good.stats.peakActive,
    concurrent_duplicate_tile_requests_share_chunks: true, failures, tiles,
    invalid_extent_and_padding_rejected_before_range_request: true,
    adapter_cache_limit_verified_bytes: 16777216, adapter_diagnostics_after_54_tiles: memory,
    four_corner_concurrent_diagnostics: fourMemory,
    memory_scope: '16 MiB retained canonical chunk cache, <=4 active range reads; output 8 MiB per virtual tile belongs to unchanged legacy cache. Browser total RSS/GC peak not measured.',
    hydrology_rendering_and_sampling_changed: false, browser_acceptance_completed: false,
    remote_upload_or_deletion_performed: false};
  fs.writeFileSync(path.join(root,'reports/JS_ADAPTER_FULL_EQUIVALENCE.json'), JSON.stringify(result,null,2)+'\n');
  const {tiles: _, ...summary} = result; console.log(JSON.stringify(summary,null,2));
}
main().catch(error => {console.error(error); process.exitCode=1;});
