(() => {
  'use strict';

  const ORIGINAL_FETCH = window.fetch.bind(window);
  const STORE_MANIFEST_URL = new URL(
    '../guilin-elevation-store-v1/CANONICAL_ELEVATION_MANIFEST.json',
    window.location.href,
  ).href;
  const STORE_BASE_URL = new URL('../guilin-elevation-store-v1/', window.location.href).href;
  const EXPECTED_CANONICAL_SHA = '91154cbe7c29220c9da41efc98105f1d36b614a343636543f7dd230735da079a';
  const EXPECTED_SOURCE_SHA = '9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
  const EXPECTED_AOI_SHA = '36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80';
  const AOI_WIDTH = 11_983;
  const AOI_HEIGHT = 17_685;
  const SAMPLE_COUNT = 211_919_355;
  const DATA_BYTES = 423_838_710;
  const CHUNK_SIZE = 512;
  const CHUNK_COUNT = 840;
  const SHARD_COUNT = 7;
  const LEGACY_TILE_GRID = 2048;
  const LEGACY_TILE_STRIDE = 2047;
  const LEGACY_TILE_BYTES = 8_388_608;
  const MAX_CHUNK_CACHE = 72;
  const LEGACY_TILE_PATTERN = /\/guilin-truth-data\/native\/native-r(\d+)-c(\d+)-2048x2048-i16\.bin$/;

  const runtime = {
    schema: 'guilin-canonical-elevation-browser-runtime/v1',
    ready: false,
    manifest_loaded: false,
    manifest_url: STORE_MANIFEST_URL,
    store_base_url: STORE_BASE_URL,
    source_tiff_read: false,
    source_tiff_role: 'cold-backup-only',
    source_tiff_sha256: EXPECTED_SOURCE_SHA,
    canonical_stream_sha256: EXPECTED_CANONICAL_SHA,
    canonical_sample_count: SAMPLE_COUNT,
    canonical_data_bytes: DATA_BYTES,
    logical_chunk_count: CHUNK_COUNT,
    physical_shard_count: SHARD_COUNT,
    overlap_samples: 0,
    padding_samples: 0,
    compression: 'none',
    resampling: 'none',
    quantization: 'none',
    interpolation: 'none',
    source_elevation_modified_m: 0,
    full_truth_downloaded_on_page_open: false,
    legacy_tile_network_request_count: 0,
    virtual_legacy_tile_count: 0,
    virtual_legacy_tile_bytes: 0,
    range_request_count: 0,
    range_response_206_count: 0,
    range_response_other_count: 0,
    range_network_bytes: 0,
    maximum_range_response_bytes: 0,
    loaded_chunk_count: 0,
    cached_chunk_count: 0,
    chunk_sha256_verified_count: 0,
    last_virtual_tile_id: null,
    last_error: null,
  };

  let manifestPromise = null;
  let manifest = null;
  const chunkByMatrix = new Map();
  const chunkCache = new Map();
  const chunkPromises = new Map();

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function hostIsLittleEndian() {
    const probe = new ArrayBuffer(2);
    new DataView(probe).setUint16(0, 0x00ff, true);
    return new Uint16Array(probe)[0] === 0x00ff;
  }

  function decodeInt16LE(buffer) {
    if (hostIsLittleEndian()) return new Int16Array(buffer);
    const view = new DataView(buffer);
    const values = new Int16Array(buffer.byteLength / 2);
    for (let index = 0; index < values.length; index += 1) {
      values[index] = view.getInt16(index * 2, true);
    }
    return values;
  }

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  }

  function validateManifest(value) {
    assert(value?.schema === 'guilin-canonical-elevation-store/v1', '无损高程真值库清单版本错误');
    assert(
      value.status === 'pixel_exact_verified_cutover_pending' ||
      value.status === 'authoritative_production_source',
      '无损高程真值库尚未通过逐像元验证',
    );
    assert(value.source_cold_backup?.sha256 === EXPECTED_SOURCE_SHA, '冷备份 TIFF 身份错误');
    assert(value.aoi?.geometry_sha256 === EXPECTED_AOI_SHA, '无损高程真值库 AOI 身份错误');
    assert(value.aoi?.grid?.[0] === AOI_WIDTH && value.aoi?.grid?.[1] === AOI_HEIGHT, 'AOI 高程网格错误');
    assert(value.aoi?.sample_count === SAMPLE_COUNT, 'AOI 高程样本总数错误');
    const stream = value.canonical_row_major_stream;
    assert(stream?.sha256 === EXPECTED_CANONICAL_SHA, '无损高程流 SHA256 错误');
    assert(stream?.sample_count === SAMPLE_COUNT && stream?.bytes === DATA_BYTES, '无损高程流大小错误');
    assert(stream?.compression === 'none', '无损高程流出现压缩');
    assert(stream?.resampling === 'none', '无损高程流出现重采样');
    assert(stream?.quantization === 'none', '无损高程流出现量化');
    assert(stream?.interpolation === 'none', '无损高程流出现插值');
    assert(stream?.source_elevation_modified_m === 0, '源高程发生改动');
    const logical = value.logical_chunks;
    assert(logical?.chunk_count === CHUNK_COUNT, '无损高程分块数量错误');
    assert(logical?.matrix_rows === 35 && logical?.matrix_columns === 24, '无损高程分块矩阵错误');
    assert(logical?.overlap_samples === 0, '无损高程分块出现重复像元');
    assert(logical?.padding_samples === 0, '无损高程分块出现补齐像元');
    assert(logical?.each_source_sample_stored_once === true, '源高程没有做到每像元只存一次');
    const physical = value.physical_shards;
    assert(physical?.shard_count === SHARD_COUNT, '无损高程分片数量错误');
    assert(physical?.total_bytes === DATA_BYTES, '无损高程分片总字节数错误');
    assert(physical?.compression === 'none', '无损高程分片出现压缩');
    assert(Array.isArray(value.chunks) && value.chunks.length === CHUNK_COUNT, '无损高程分块索引不完整');
    for (const chunk of value.chunks) {
      assert(chunk.compression === 'none', `${chunk.id} 出现压缩`);
      assert(chunk.resampling === 'none', `${chunk.id} 出现重采样`);
      assert(chunk.quantization === 'none', `${chunk.id} 出现量化`);
      assert(chunk.padding_samples === 0, `${chunk.id} 出现补齐`);
      assert(chunk.shared_edge_duplicate_samples === 0, `${chunk.id} 出现共享边重复`);
      assert(chunk.source_elevation_modified_m === 0, `${chunk.id} 高程发生改动`);
      chunkByMatrix.set(`${chunk.matrix_index[0]},${chunk.matrix_index[1]}`, chunk);
    }
  }

  async function ensureManifest() {
    if (manifest) return manifest;
    if (!manifestPromise) {
      manifestPromise = (async () => {
        const response = await ORIGINAL_FETCH(STORE_MANIFEST_URL, { cache: 'no-store' });
        assert(response.ok, `无损高程真值库清单 HTTP ${response.status}`);
        const value = await response.json();
        validateManifest(value);
        manifest = value;
        runtime.ready = true;
        runtime.manifest_loaded = true;
        return value;
      })().catch(error => {
        runtime.last_error = String(error?.stack || error?.message || error);
        manifestPromise = null;
        throw error;
      });
    }
    return manifestPromise;
  }

  function chunkKey(row, column) {
    return `${row},${column}`;
  }

  function evictChunkCache(protectedIds = new Set()) {
    if (chunkCache.size <= MAX_CHUNK_CACHE) return;
    const candidates = [...chunkCache.entries()]
      .filter(([id]) => !protectedIds.has(id))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (chunkCache.size > MAX_CHUNK_CACHE && candidates.length) {
      const [id] = candidates.shift();
      chunkCache.delete(id);
    }
    runtime.cached_chunk_count = chunkCache.size;
  }

  async function loadChunk(chunk) {
    const cached = chunkCache.get(chunk.id);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.codes;
    }
    if (chunkPromises.has(chunk.id)) return chunkPromises.get(chunk.id);

    const promise = (async () => {
      const start = Number(chunk.shard_byte_offset);
      const end = start + Number(chunk.bytes) - 1;
      const shardUrl = new URL(chunk.shard, STORE_BASE_URL).href;
      const response = await ORIGINAL_FETCH(shardUrl, {
        cache: 'no-store',
        headers: { Range: `bytes=${start}-${end}` },
      });
      runtime.range_request_count += 1;
      if (response.status === 206) runtime.range_response_206_count += 1;
      else runtime.range_response_other_count += 1;
      assert(response.status === 206, `${chunk.id} 未获得 HTTP 206 字节范围响应，实际 ${response.status}`);
      const buffer = await response.arrayBuffer();
      runtime.range_network_bytes += buffer.byteLength;
      runtime.maximum_range_response_bytes = Math.max(runtime.maximum_range_response_bytes, buffer.byteLength);
      assert(buffer.byteLength === chunk.bytes, `${chunk.id} 范围响应字节数错误`);
      const digest = await sha256Hex(buffer);
      assert(digest === chunk.sha256, `${chunk.id} SHA256 错误`);
      const codes = decodeInt16LE(buffer);
      assert(codes.length === chunk.sample_count, `${chunk.id} 高程样本数量错误`);
      chunkCache.set(chunk.id, { codes, lastUsed: performance.now() });
      runtime.loaded_chunk_count += 1;
      runtime.cached_chunk_count = chunkCache.size;
      runtime.chunk_sha256_verified_count += 1;
      chunkPromises.delete(chunk.id);
      evictChunkCache(new Set([chunk.id]));
      return codes;
    })().catch(error => {
      runtime.last_error = String(error?.stack || error?.message || error);
      chunkPromises.delete(chunk.id);
      throw error;
    });
    chunkPromises.set(chunk.id, promise);
    return promise;
  }

  async function reconstructLegacyTile(tileRow, tileColumn) {
    await ensureManifest();
    assert(Number.isInteger(tileRow) && Number.isInteger(tileColumn), '旧瓦片索引不是整数');
    assert(tileRow >= 0 && tileRow < 9 && tileColumn >= 0 && tileColumn < 6, '旧瓦片索引超出范围');
    const tileId = `native-r${String(tileRow).padStart(2, '0')}-c${String(tileColumn).padStart(2, '0')}`;
    const startRow = tileRow * LEGACY_TILE_STRIDE;
    const startColumn = tileColumn * LEGACY_TILE_STRIDE;
    const validHeight = Math.max(0, Math.min(LEGACY_TILE_GRID, AOI_HEIGHT - startRow));
    const validWidth = Math.max(0, Math.min(LEGACY_TILE_GRID, AOI_WIDTH - startColumn));
    const output = new Int16Array(LEGACY_TILE_GRID * LEGACY_TILE_GRID);
    const required = [];
    if (validWidth > 0 && validHeight > 0) {
      const firstChunkRow = Math.floor(startRow / CHUNK_SIZE);
      const lastChunkRow = Math.floor((startRow + validHeight - 1) / CHUNK_SIZE);
      const firstChunkColumn = Math.floor(startColumn / CHUNK_SIZE);
      const lastChunkColumn = Math.floor((startColumn + validWidth - 1) / CHUNK_SIZE);
      for (let chunkRow = firstChunkRow; chunkRow <= lastChunkRow; chunkRow += 1) {
        for (let chunkColumn = firstChunkColumn; chunkColumn <= lastChunkColumn; chunkColumn += 1) {
          const chunk = chunkByMatrix.get(chunkKey(chunkRow, chunkColumn));
          assert(chunk, `找不到无损高程分块 ${chunkRow},${chunkColumn}`);
          required.push(chunk);
        }
      }
    }
    const loaded = await Promise.all(required.map(async chunk => ({ chunk, codes: await loadChunk(chunk) })));
    for (const { chunk, codes } of loaded) {
      const chunkRow = chunk.matrix_index[0];
      const chunkColumn = chunk.matrix_index[1];
      const chunkStartRow = chunkRow * CHUNK_SIZE;
      const chunkStartColumn = chunkColumn * CHUNK_SIZE;
      const chunkWidth = chunk.grid[0];
      const chunkHeight = chunk.grid[1];
      const overlapLeft = Math.max(startColumn, chunkStartColumn);
      const overlapTop = Math.max(startRow, chunkStartRow);
      const overlapRight = Math.min(startColumn + validWidth, chunkStartColumn + chunkWidth);
      const overlapBottom = Math.min(startRow + validHeight, chunkStartRow + chunkHeight);
      if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;
      const copyWidth = overlapRight - overlapLeft;
      for (let sourceRow = overlapTop; sourceRow < overlapBottom; sourceRow += 1) {
        const sourceOffset =
          (sourceRow - chunkStartRow) * chunkWidth +
          (overlapLeft - chunkStartColumn);
        const targetOffset =
          (sourceRow - startRow) * LEGACY_TILE_GRID +
          (overlapLeft - startColumn);
        output.set(codes.subarray(sourceOffset, sourceOffset + copyWidth), targetOffset);
      }
    }
    runtime.virtual_legacy_tile_count += 1;
    runtime.virtual_legacy_tile_bytes += LEGACY_TILE_BYTES;
    runtime.last_virtual_tile_id = tileId;
    evictChunkCache(new Set(required.map(chunk => chunk.id)));
    return new Response(output.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(LEGACY_TILE_BYTES),
        'X-Guilin-Elevation-Source': 'canonical-pixel-exact-store',
        'X-Guilin-Canonical-SHA256': EXPECTED_CANONICAL_SHA,
        'X-Guilin-Source-Tiff-Read': 'false',
      },
    });
  }

  function resolveUrl(input) {
    if (typeof input === 'string' || input instanceof URL) return new URL(String(input), window.location.href);
    if (input instanceof Request) return new URL(input.url, window.location.href);
    return null;
  }

  window.fetch = async function canonicalStoreFetch(input, init) {
    const url = resolveUrl(input);
    const match = url?.pathname.match(LEGACY_TILE_PATTERN);
    if (!match) return ORIGINAL_FETCH(input, init);
    const tileRow = Number(match[1]);
    const tileColumn = Number(match[2]);
    return reconstructLegacyTile(tileRow, tileColumn);
  };

  runtime.getState = () => ({
    ...runtime,
    canonical_manifest_status: manifest?.status || null,
    loaded_fraction: Number((runtime.range_network_bytes / DATA_BYTES).toFixed(8)),
    all_range_responses_partial: runtime.range_request_count > 0 && runtime.range_response_other_count === 0,
    first_load_canonical_elevation_bytes: 0,
  });
  runtime.ensureManifest = ensureManifest;
  window.__GUILIN_CANONICAL_STORE_RUNTIME = runtime;
})();
