/** Bounded lossless transport; cancelled consumers never poison later requests. */
export const abortError = () => new DOMException('请求已取消', 'AbortError');
export function throwIfAborted(signal) { if (signal?.aborted) throw abortError(); }
export function abortable(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const cancel = () => { cleanup(); reject(abortError()); };
    const cleanup = () => signal.removeEventListener('abort', cancel);
    signal.addEventListener('abort', cancel, {once:true});
    promise.then(v => { cleanup(); resolve(v); }, e => { cleanup(); reject(e); });
  });
}
export async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw Error('浏览器缺少安全 SHA-256 校验能力');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
}
export async function readExact(stream, expected, signal) {
  if (!Number.isSafeInteger(expected) || expected <= 0 || expected > 8*1024*1024 || !stream) throw Error('载荷长度越界');
  const reader = stream.getReader(), result = new Uint8Array(expected);
  let offset = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, {once:true});
  try {
    throwIfAborted(signal);
    while (true) {
      const {value, done} = await reader.read();
      throwIfAborted(signal);
      if (done) break;
      if (offset + value.byteLength > expected) throw Error('载荷超过已锁定字节数');
      result.set(value, offset); offset += value.byteLength;
    }
    if (offset !== expected) throw Error('载荷字节数与索引不符');
    return result;
  } catch (e) { await reader.cancel().catch(() => {}); throw e; }
  finally { signal?.removeEventListener('abort', cancel); reader.releaseLock(); }
}
export async function checkedGzip(fetcher, url, bytes, hash, decodedBytes, signal) {
  throwIfAborted(signal);
  if (typeof DecompressionStream !== 'function') throw Error('当前浏览器不支持 gzip 解压；未退回旧大文件，请更新浏览器');
  const response = await fetcher(url, {signal});
  if (!response.ok) throw Error(`压缩载荷读取失败 (${response.status})`);
  const packed = await readExact(response.body, bytes, signal);
  if (await sha256(packed) !== hash) throw Error('压缩载荷 SHA-256 不符');
  throwIfAborted(signal);
  return readExact(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')), decodedBytes, signal);
}
export function retryableIndex(fetcher, url, validate) {
  let value, pending;
  return async () => {
    if (value) return value;
    if (!pending) pending = (async () => {
      const response = await fetcher(url);
      if (!response.ok) throw Error(`压缩索引读取失败 (${response.status})`);
      const candidate = await response.json(); validate(candidate); value = candidate; return value;
    })().finally(() => { pending = null; });
    return pending;
  };
}
export function sharedPool(maxEntries) {
  const cached = new Map(), jobs = new Map();
  let hits = 0, starts = 0, aborts = 0;
  return {
    stats: () => ({cacheEntries:cached.size, pendingJobs:jobs.size, hits, starts, aborts, maxEntries}),
    get(key, load, signal) {
      if (signal?.aborted) return Promise.reject(abortError());
      if (cached.has(key)) { const v = cached.get(key); cached.delete(key); cached.set(key, v); hits++; return Promise.resolve(v); }
      let job = jobs.get(key);
      if (!job || job.controller.signal.aborted) {
        job = {controller:new AbortController(), consumers:0, done:false}; starts++;
        jobs.set(key, job);
        job.promise = Promise.resolve().then(() => { throwIfAborted(job.controller.signal); return load(job.controller.signal); }).then(value => {
          if (!job.controller.signal.aborted && job.consumers > 0) {
            cached.set(key, value);
            while (cached.size > maxEntries) cached.delete(cached.keys().next().value);
          }
          return value;
        }).finally(() => { job.done = true; if (jobs.get(key) === job) jobs.delete(key); });
        void job.promise.catch(() => {});
      } else hits++;
      job.consumers++;
      return new Promise((resolve, reject) => {
        let finished = false;
        const finish = (fn, result) => {
          if (finished) return; finished = true;
          signal?.removeEventListener('abort', cancel); job.consumers--;
          if (!job.done && job.consumers === 0) {
            job.controller.abort(); aborts++;
            if (jobs.get(key) === job) jobs.delete(key);
          }
          fn(result);
        };
        const cancel = () => finish(reject, abortError());
        signal?.addEventListener('abort', cancel, {once:true});
        job.promise.then(v => finish(resolve, v), e => finish(reject, e));
        if (signal?.aborted) cancel();
      });
    }
  };
}
export function fetchInfo(input, init) {
  const request = typeof Request !== 'undefined' && input instanceof Request;
  return {url:new URL(request ? input.url : String(input), location.href), signal:init?.signal ?? (request ? input.signal : undefined), method:(init?.method || (request ? input.method : 'GET')).toUpperCase()};
}
export function scopedName(url, directories) {
  for (const base of directories) if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) {
    const name = url.pathname.slice(base.pathname.length);
    if (name && !name.includes('/')) return name;
  }
  return null;
}
