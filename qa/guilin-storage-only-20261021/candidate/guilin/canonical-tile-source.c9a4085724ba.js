/* Storage-only adapter: immutable AOI chunks -> byte-identical legacy virtual tile.
 * No rendering, hydrology, interpolation or height changes. */
(() => {
  'use strict';
  const MANIFEST_SHA = '1c20ea78351a7827a033c7a4eef6176f5939efdc16abf436ba95863e34c34e78';
  const AOI_STREAM_SHA = '91154cbe7c29220c9da41efc98105f1d36b614a343636543f7dd230735da079a';
  const CHUNK = 512, LEGACY_GRID = 2048, LEGACY_STRIDE = 2047;
  const MAX_RANGE_BYTES = CHUNK * CHUNK * 2, MAX_CACHE_CHUNKS = 32, MAX_IN_FLIGHT = 4;
  const require = (value, message) => { if (!value) throw new Error(message); };
  const hex = buffer => [...new Uint8Array(buffer)].map(v => v.toString(16).padStart(2, '0')).join('');

  globalThis.createGuilinCanonicalTileSource = ({baseUrl, fetchFn = globalThis.fetch.bind(globalThis), cryptoImpl = globalThis.crypto}) => {
    let manifestPromise = null, active = 0, assembling = 0, peakAssembling = 0, peakCacheBytes = 0;
    const queue = [], cache = new Map();
    const digest = async bytes => hex(await cryptoImpl.subtle.digest('SHA-256', bytes));
    const cancel = async response => { try { await response.body?.cancel?.(); } catch (_) {} };
    async function limited(task) {
      if (active >= MAX_IN_FLIGHT) await new Promise(resolve => queue.push(resolve));
      else active++;
      try { return await task(); }
      finally { if (queue.length) queue.shift()(); else active--; }
    }
    async function manifest() {
      if (!manifestPromise) {
        manifestPromise = (async () => {
          const response = await fetchFn(`${baseUrl}CANONICAL_ELEVATION_MANIFEST.json`, {cache: 'no-store'});
          if (response.status !== 200) { await cancel(response); throw new Error(`Canonical manifest HTTP ${response.status}`); }
          const bytes = await response.arrayBuffer();
          require(bytes.byteLength === 999668, 'Canonical manifest length mismatch');
          require(await digest(bytes) === MANIFEST_SHA, 'Canonical manifest SHA256 mismatch');
          const m = JSON.parse(new TextDecoder().decode(bytes));
          require(m.schema === 'guilin-canonical-elevation-store/v1', 'Canonical manifest schema mismatch');
          require(JSON.stringify(m.aoi.source_window) === '[2438,949,11983,17685]', 'Canonical AOI window mismatch');
          require(m.canonical_row_major_stream.sha256 === AOI_STREAM_SHA, 'Canonical sample identity mismatch');
          require(m.chunks.length === 840 && m.physical_shards.shards.length === 7, 'Canonical layout mismatch');
          require(m.spatial_reference.dtype === 'int16' && m.spatial_reference.nodata === 0, 'Canonical encoding mismatch');
          m.chunkMap = new Map(m.chunks.map(t => [t.matrix_index.join(','), t]));
          m.shardMap = new Map(m.physical_shards.shards.map(s => [s.file, s]));
          return m;
        })().catch(error => { manifestPromise = null; throw error; });
      }
      return manifestPromise;
    }
    function trimCache() {
      if (cache.size > MAX_CACHE_CHUNKS) {
        for (const [key, entry] of cache) {
          if (entry.settled) cache.delete(key);
          if (cache.size <= MAX_CACHE_CHUNKS) break;
        }
      }
      peakCacheBytes = Math.max(peakCacheBytes, [...cache.values()].reduce((sum, e) => sum+(e.bytes || 0), 0));
    }
    function chunk(m, t) {
      const found = cache.get(t.id);
      if (found) { cache.delete(t.id); cache.set(t.id, found); return found.promise; }
      const entry = {settled: false, promise: null};
      entry.promise = limited(async () => {
        require(/^shards\/elevation-shard-00[0-6]\.i16pack$/.test(t.shard), 'Unsafe canonical shard path');
        const shard = m.shardMap.get(t.shard), start = t.shard_byte_offset, end = start + t.bytes - 1;
        require(shard && Number.isInteger(start) && start >= 0 && t.bytes > 0 && t.bytes <= MAX_RANGE_BYTES && end < shard.bytes, 'Canonical range invalid');
        const response = await fetchFn(`${baseUrl}${t.shard}`, {cache: 'no-store', headers: {Range: `bytes=${start}-${end}`}});
        const fail = async message => { await cancel(response); throw new Error(message); };
        if (response.status !== 206) return fail(`Canonical chunk requires HTTP 206, got ${response.status}`);
        if (response.headers.get('Content-Range') !== `bytes ${start}-${end}/${shard.bytes}`) return fail('Canonical Content-Range mismatch');
        const encoding = response.headers.get('Content-Encoding');
        if (encoding && encoding !== 'identity') return fail('Canonical encoded response not allowed');
        const length = response.headers.get('Content-Length');
        if (length !== null && Number(length) !== t.bytes) return fail('Canonical Content-Length mismatch');
        const buffer = await response.arrayBuffer();
        require(buffer.byteLength === t.bytes, 'Canonical response byte length mismatch');
        require(await digest(buffer) === t.sha256, 'Canonical chunk SHA256 mismatch');
        return new Uint8Array(buffer);
      }).then(bytes => { entry.settled = true; entry.bytes = bytes.byteLength; trimCache(); return bytes; })
        .catch(error => { cache.delete(t.id); throw error; });
      cache.set(t.id, entry);
      return entry.promise;
    }
    async function loadTile(tile) {
      const m = await manifest(), [aoiX, aoiY, width, height] = m.aoi.source_window;
      const [sourceX, sourceY, validWidth, validHeight] = tile.source_window;
      const x = sourceX - aoiX, y = sourceY - aoiY;
      require(tile.stored_grid[0] === LEGACY_GRID && tile.stored_grid[1] === LEGACY_GRID, 'Legacy grid mismatch');
      require(x === tile.matrix_index[1] * LEGACY_STRIDE && y === tile.matrix_index[0] * LEGACY_STRIDE, 'Legacy overlap placement mismatch');
      require(x >= 0 && y >= 0 && validWidth === Math.min(LEGACY_GRID, width-x) && validHeight === Math.min(LEGACY_GRID, height-y), 'Legacy valid extent mismatch');
      require(validWidth === tile.valid_grid[0] && validHeight === tile.valid_grid[1], 'Legacy valid grid mismatch');
      assembling++; peakAssembling = Math.max(peakAssembling, assembling);
      try {
      // Zero initialization preserves only the historic east/south NoData padding.
      const result = new Uint8Array(LEGACY_GRID * LEGACY_GRID * 2), jobs = [];
      for (let row = Math.floor(y/CHUNK); row <= Math.floor((y+validHeight-1)/CHUNK); row++) {
        for (let col = Math.floor(x/CHUNK); col <= Math.floor((x+validWidth-1)/CHUNK); col++) {
          const t = m.chunkMap.get(`${row},${col}`);
          require(t, 'Canonical chunk missing');
          jobs.push(chunk(m, t).then(bytes => {
            const [cx, cy, cw, ch] = t.aoi_window;
            const left = Math.max(x, cx), right = Math.min(x+validWidth, cx+cw);
            const top = Math.max(y, cy), bottom = Math.min(y+validHeight, cy+ch);
            for (let yy = top; yy < bottom; yy++) {
              const sourceOffset = ((yy-cy)*cw + left-cx)*2;
              const targetOffset = ((yy-y)*LEGACY_GRID + left-x)*2;
              result.set(bytes.subarray(sourceOffset, sourceOffset+(right-left)*2), targetOffset);
            }
          }));
        }
      }
      await Promise.all(jobs);
      return result.buffer;
      } finally { assembling--; }
    }
    function diagnostics() {
      const settled = [...cache.values()].filter(e => e.settled);
      return Object.freeze({cachedChunks: settled.length,
        cachedChunkBytes: settled.reduce((sum, e) => sum+e.bytes, 0),
        cacheLimitBytes: MAX_CACHE_CHUNKS*MAX_RANGE_BYTES, peakRetainedCacheBytes: peakCacheBytes,
        activeRangeLoads: active, queuedRangeLoads: queue.length, maxConcurrentRangeLoads: MAX_IN_FLIGHT,
        assemblingTiles: assembling, peakAssemblingTiles: peakAssembling,
        note: 'Counts adapter-retained buffers only, not browser/GC overhead or the unchanged caller-owned legacy tile cache.'});
    }
    return Object.freeze({loadTile, diagnostics});
  };
})();
