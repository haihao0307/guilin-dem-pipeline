/** P3 verified chunk transport. The manifest is generated from retained native
 * bytes. Resume is at completed-chunk boundaries, not a claim of HTTP Range.
 * No frame, material, model coefficient or user archive is changed here. */
export function createLipTransport(manifest, options = {}) {
  const nativeFetch = options.fetch || globalThis.fetch.bind(globalThis);
  const origin = new URL(options.base || globalThis.location.href).origin;
  const base = new URL(options.base || globalThis.location.href).href;
  const idleMS = options.idleMS ?? 30000;
  const attempts = options.attempts ?? 3;
  const parallel = options.parallel ?? 3;
  const budget = options.budget ?? 128 * 1024 * 1024;
  const cacheName = 'kaopu-human-verified-stream-r05';
  const legacyCache = 'kaopu-lips-verified-assets-p1';
  const notify = options.notify || (() => {});
  const resources = new Map(manifest.files.map(f => [new URL(f.logical, base).href, f]));
  const controller = new AbortController();
  let active = 0, writes = Promise.resolve(), storage, storageChecked = false;
  const queue = [], credited = new Set();
  const stats = { networkBytes: 0, cacheBytes: 0, verifiedBytes: 0, cacheHits: 0,
    retries: 0, requests: 0, chunksVerified: 0, filesVerified: 0,
    totalBytes: manifest.files.reduce((n, f) => n + f.bytes, 0),
    totalChunks: manifest.files.reduce((n, f) => n + f.chunks.length, 0),
    lastProgress: performance.now(), active: {}, events: [], warnings: [],
    maximumActive: 0, concurrencyLimit: parallel, idleMS, attempts,
    cacheName, cacheBudgetBytes: budget };
  const signalError = s => s.reason || new DOMException('载入已取消', 'AbortError');
  function alive(s) { if (controller.signal.aborted) throw signalError(controller.signal); if (s?.aborted) throw signalError(s); }
  function emit(type, data = {}) { stats.events.push({ type, ms: performance.now(), ...data }); if (stats.events.length > 160) stats.events.shift(); notify(stats); }
  function warning(text) { if (!stats.warnings.includes(text)) stats.warnings.push(text); notify(stats); }
  const digest = async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2, '0')).join('');
  const key = hash => new URL('/.kaopu-lips-chunks/' + hash, origin).href;
  async function cacheAPI() {
    if (!storageChecked) { storageChecked = true; try { storage = options.caches || globalThis.caches; if (!storage) throw Error('unavailable'); } catch { warning('资源缓存不可用；继续校验网络数据，刷新后可能需要重下。'); } }
    return storage;
  }
  async function cached(hash, size, legacy = false) {
    try {
      const api = await cacheAPI(); if (!api) return null;
      const name = legacy ? legacyCache : cacheName;
      if (legacy && !(await api.has(name))) return null;
      const cache = await api.open(name), url = legacy ? new URL('/.kaopu-lips-verified/' + hash, origin).href : key(hash);
      const response = await cache.match(url); if (!response) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === size && await digest(bytes) === hash) {
        stats.cacheHits++; stats.cacheBytes += size; emit('cache-hit', { hash, bytes: size, legacy }); return bytes;
      }
      // Never delete or alter an earlier version's cache. Only discard our corrupt chunk.
      if (!legacy) await cache.delete(url);
      emit('cache-corrupt', { hash, legacy }); return null;
    } catch { warning('资源缓存读写受限；继续校验网络数据。'); return null; }
  }
  async function save(hash, data) {
    const work = async () => {
      try {
        const api = await cacheAPI(); if (!api) return;
        const put = async () => {
          const cache = await api.open(cacheName), target = key(hash);
          const rows = []; let used = 0;
          for (const request of await cache.keys()) {
            const r = await cache.match(request), size = Number(r?.headers.get('x-kaopu-size') || 0);
            if (request.url !== target) { used += size; rows.push({ request, size }); }
          }
          for (const row of rows) { if (used + data.byteLength <= budget) break; await cache.delete(row.request); used -= row.size; }
          if (data.byteLength <= budget) await cache.put(target, new Response(data, { headers: { 'content-type': 'application/octet-stream', 'x-kaopu-size': String(data.byteLength) } }));
        };
        if (globalThis.navigator?.locks) await navigator.locks.request(cacheName + '-write', put); else await put();
      } catch { warning('资源缓存写入失败；本次仍可继续，刷新后的分块复用可能不可用。'); }
    };
    writes = writes.then(work, work); await writes;
  }
  function credit(file, chunk) {
    const id = file.sha256 + ':' + chunk.offset;
    if (!credited.has(id)) { credited.add(id); stats.verifiedBytes += chunk.bytes; stats.chunksVerified++; }
    stats.lastProgress = performance.now(); notify(stats);
  }
  function pump() {
    while (active < parallel && queue.length) {
      const item = queue.shift(); item.cleanup();
      try { alive(item.signal); } catch (e) { item.reject(e); continue; }
      active++; stats.maximumActive = Math.max(stats.maximumActive, active); item.resolve();
    }
  }
  function acquire(signal) {
    alive(signal);
    return new Promise((resolve, reject) => {
      const item = { resolve, reject, signal, cleanup: () => {} };
      const cancel = () => { const i = queue.indexOf(item); if (i >= 0) { queue.splice(i, 1); item.cleanup(); reject(signal?.aborted ? signalError(signal) : signalError(controller.signal)); } };
      item.cleanup = () => { signal?.removeEventListener('abort', cancel); controller.signal.removeEventListener('abort', cancel); };
      signal?.addEventListener('abort', cancel, { once: true }); controller.signal.addEventListener('abort', cancel, { once: true });
      queue.push(item); pump();
    });
  }
  const backoff = (ms, signal) => new Promise((resolve, reject) => {
    const cancel = () => { cleanup(); reject(signal?.aborted ? signalError(signal) : signalError(controller.signal)); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); controller.signal.removeEventListener('abort', cancel); };
    signal?.addEventListener('abort', cancel, { once: true }); controller.signal.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted || controller.signal.aborted) cancel();
  });
  async function downloadChunk(file, chunk, index, signal) {
    const old = await cached(chunk.sha256, chunk.bytes); alive(signal);
    if (old) { credit(file, chunk); return old; }
    const label = file.label + ' · 分块 ' + (index + 1) + '/' + file.chunks.length;
    const url = new URL(chunk.file, base).href;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await acquire(signal);
      const abort = new AbortController(); let timer, reader, count = 0, failure;
      const cancel = () => abort.abort(signal?.aborted ? signalError(signal) : signalError(controller.signal));
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => abort.abort(new DOMException('连续' + idleMS / 1000 + '秒没有新数据', 'TimeoutError')), idleMS); };
      signal?.addEventListener('abort', cancel, { once: true }); controller.signal.addEventListener('abort', cancel, { once: true });
      stats.requests++; stats.active[url] = { label, attempt, received: 0, expected: chunk.bytes }; emit('attempt', { label, attempt, url }); arm();
      try {
        alive(signal);
        const response = await nativeFetch(url, { signal: abort.signal, cache: attempt > 1 ? 'reload' : 'default' });
        if (!response.ok) { const e = new Error('HTTP ' + response.status); e.status = response.status; await response.body?.cancel(); throw e; }
        if (!response.body) throw new Error('响应没有可读取的数据');
        const data = new Uint8Array(chunk.bytes); reader = response.body.getReader();
        while (true) {
          const result = await reader.read(); if (result.done) break;
          if (count + result.value.length > data.length) throw new Error('分块长度超过清单');
          data.set(result.value, count); count += result.value.length;
          stats.networkBytes += result.value.length; stats.lastProgress = performance.now();
          stats.active[url].received = count; arm(); notify(stats);
        }
        clearTimeout(timer); alive(signal);
        if (count !== chunk.bytes) throw new Error('分块数据不完整：' + count + '/' + chunk.bytes);
        if (await digest(data) !== chunk.sha256) throw new Error('分块 SHA-256 校验不一致');
        await save(chunk.sha256, data); alive(signal); credit(file, chunk); emit('chunk-complete', { label, bytes: count }); return data;
      } catch (e) {
        failure = abort.signal.aborted ? abort.signal.reason : e;
        try { await reader?.cancel(failure); } catch {}
        alive(signal);
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); controller.signal.removeEventListener('abort', cancel);
        delete stats.active[url]; active--; pump();
      }
      const retryable = !failure.status || failure.status === 408 || failure.status === 429 || failure.status >= 500;
      if (!retryable || attempt === attempts) {
        const e = new Error(label + ' · ' + failure.name + ': ' + failure.message + '（已校验分块保留，可继续载入）');
        emit('failed', { label, attempt, cause: String(failure), url }); throw e;
      }
      stats.retries++; emit('retry', { label, attempt, receivedBeforeFailure: count, cause: String(failure) });
      await backoff(options.retryMS ?? Math.min(800 * 2 ** (attempt - 1), 4000), signal);
    }
  }
  async function loadVerified(url, expected, signal) {
    alive(signal); const full = new URL(url, base).href, file = resources.get(full);
    if (!file || file.sha256 !== expected) throw new Error('资源清单不匹配：' + full);
    // Previously verified P2 full files are read, not overwritten or deleted.
    let data = await cached(expected, file.bytes, true); alive(signal);
    if (data) { for (const c of file.chunks) credit(file, c); }
    else {
      data = new Uint8Array(file.bytes);
      for (let i = 0; i < file.chunks.length; i++) { alive(signal); const chunk = file.chunks[i]; data.set(await downloadChunk(file, chunk, i, signal), chunk.offset); }
    }
    if (await digest(data) !== expected) throw new Error(file.label + ' · 完整资源校验失败');
    alive(signal); stats.filesVerified++; emit('file-complete', { label: file.label, bytes: file.bytes }); return data.buffer;
  }
  return { loadVerified, stats, settled: () => writes,
    cancel: (reason = new DOMException('已暂停；已完成分块保留', 'AbortError')) => { controller.abort(reason); pump(); },
    snapshot: () => structuredClone(stats) };
}
