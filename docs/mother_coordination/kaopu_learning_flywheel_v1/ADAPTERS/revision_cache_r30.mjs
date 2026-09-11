// Candidate CPU cache inspired by Tellux's request lifecycle; not a GPU memory manager.
export class RevisionCache {
  #generation = 0;
  #pending = new Map();
  #settled = new Map();
  #bytes = 0;
  constructor({ maxPending = 4, maxSettled = 32, maxBytes = 1048576 } = {}) {
    for (const n of [maxPending, maxSettled, maxBytes]) {
      if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('positive integer budget required');
    }
    this.limits = Object.freeze({ maxPending, maxSettled, maxBytes });
  }
  get stats() { return { generation: this.#generation, pending: this.#pending.size,
    settled: this.#settled.size, declaredBytes: this.#bytes }; }
  get({ sourceId, sourceRevision, queryKey }, loader) {
    for (const id of [sourceId, sourceRevision, queryKey]) {
      if (typeof id !== 'string' || !id.trim()) throw new TypeError('source identity, revision and query required');
    }
    const generation = this.#generation;
    const key = JSON.stringify([generation, sourceId, sourceRevision, queryKey]);
    const cached = this.#settled.get(key);
    if (cached) {
      this.#settled.delete(key); this.#settled.set(key, cached);
      return cached.promise;
    }
    if (this.#pending.has(key)) return this.#pending.get(key).promise;
    if (this.#pending.size >= this.limits.maxPending) return Promise.reject(new Error('pending-budget-exhausted'));
    const controller = new AbortController();
    const promise = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('stale-generation');
      return loader(controller.signal);
    }).then(({ value, bytes }) => {
      if (generation !== this.#generation) throw new Error('stale-generation');
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new RangeError('declared bytes required');
      if (bytes <= this.limits.maxBytes) {
        while (this.#settled.size >= this.limits.maxSettled || this.#bytes + bytes > this.limits.maxBytes) {
          const oldest = this.#settled.keys().next().value;
          this.#bytes -= this.#settled.get(oldest).bytes;
          this.#settled.delete(oldest);
        }
        this.#settled.set(key, { promise, bytes }); this.#bytes += bytes;
      }
      return value;
    }).finally(() => this.#pending.delete(key));
    this.#pending.set(key, { promise, controller });
    return promise;
  }
  invalidate() {
    const previous = [...this.#pending.values()];
    this.#generation++;
    this.#settled.clear(); this.#bytes = 0;
    // Retain pending accounting until loaders actually settle, even if they ignore abort.
    for (const entry of previous) entry.controller.abort();
  }
}
