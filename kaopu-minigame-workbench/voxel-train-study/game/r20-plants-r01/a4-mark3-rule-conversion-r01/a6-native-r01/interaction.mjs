/** A6 UI-only controls. All mechanical generators and materials remain frozen in R01. */
export const SHELL_LIMITS = Object.freeze({
  commonRoofHeight: Object.freeze({min: 3.98, max: 4.15, default: 4.03, step: 0.01}),
  cabForwardShift: Object.freeze({min: -0.15, max: 0.15, default: 0, step: 0.01}),
});
export const CONNECTED_LAYOUT = Object.freeze({
  tenderRearZ: 20.50, coachFrontLocalZ: -11.49, gap: 0.35, coachOffsetZ: 32.34,
  units: 'm', purpose: 'Rigid display arrangement only; functional coupler geometry and clearance are not verified.',
});
export const FOCUS_NAMES = Object.freeze(['train', 'locomotive', 'coach']);
export const DEFAULT_SHELL_PARAMETERS = Object.freeze(Object.fromEntries(Object.entries(SHELL_LIMITS).map(([key, value]) => [key, value.default])));
export const ZOOM_LIMITS = Object.freeze({min: 0.5, max: 6});
export const VIEW_POSES = Object.freeze({side: Object.freeze({yaw: -Math.PI / 2, pitch: 0}), front: Object.freeze({yaw: Math.PI, pitch: 0}), top: Object.freeze({yaw: Math.PI, pitch: Math.PI / 2})});
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function validateShellParameters(patch, base = DEFAULT_SHELL_PARAMETERS) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('外壳参数必须是对象');
  const result = {...base};
  for (const [key, value] of Object.entries(patch)) {
    const limit = Object.hasOwn(SHELL_LIMITS, key) && SHELL_LIMITS[key];
    if (!limit) throw new RangeError(`不可编辑参数：${key}。轮径、轴位与机械结构已锁定。`);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < limit.min || value > limit.max) throw new RangeError(`${key} 必须在 ${limit.min}–${limit.max} 范围内`);
    result[key] = value;
  }
  return result;
}
export function createViewState() { return {view: 'side', free: false, zoom: 1, focus: 'train', ...VIEW_POSES.side}; }
/** Focus changes only the immutable camera target, not zoom or geometry. */
export function selectFocus(state, name) {
  if (!FOCUS_NAMES.includes(name)) throw new RangeError('未知观察中心：' + name);
  state.focus = name;
  return state;
}
/** Standard-view buttons restore a canonical measuring pose and base zoom. */
export function selectView(state, name) {
  if (!Object.hasOwn(VIEW_POSES, name)) throw new RangeError('未知标准视角：' + name);
  Object.assign(state, {view: name, free: false, zoom: 1}, VIEW_POSES[name]);
  return state;
}
export function setViewZoom(state, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('缩放必须为有限数值');
  state.zoom = clamp(value, ZOOM_LIMITS.min, ZOOM_LIMITS.max);
  return state.zoom;
}
export function orbitView(state, deltaX, deltaY) {
  if (!state.free) return false;
  state.yaw -= deltaX * 0.006;
  state.pitch = clamp(state.pitch + deltaY * 0.006, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  return true;
}
/** Immutable default envelopes, never edited shell bounds, drive framing. */
export function baselineMetresPerPixel(bounds, rectangles, view, margin = 1.16) {
  if (!Object.hasOwn(VIEW_POSES, view)) throw new RangeError('未知标准视角：' + view);
  let scale = 0;
  bounds.forEach((box, index) => {
    const size = box.max.map((value, axis) => value - box.min[axis]);
    const rectangle = rectangles[index];
    const width = view === 'side' ? size[2] : size[0];
    const height = view === 'top' ? size[2] : size[1];
    scale = Math.max(scale, width / Math.max(1, rectangle.width), height / Math.max(1, rectangle.height));
  });
  return scale * margin;
}
/** Latest-request-wins queue; never lets an older async build replace a newer edit. */
export function createRebuildQueue({build, commit, dispose, onBusy, onError, delay = 130}) {
  let revision = 0, committedRevision = 0, pending = null, running = false, timer = null;
  const waiters = [];
  const settle = (upTo, error, result) => {
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].revision <= upTo) {
      const [waiter] = waiters.splice(i, 1);
      error ? waiter.reject(error) : waiter.resolve(result);
    }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(drain, delay); };
  async function drain() {
    timer = null;
    if (running || !pending) return;
    running = true;
    const job = pending;
    pending = null;
    let artifact;
    try {
      artifact = await build(job.value);
      if (job.revision === revision) {
        const result = commit(artifact, job.value, job.revision);
        committedRevision = job.revision;
        artifact = null;
        settle(job.revision, null, result);
      }
    } catch (error) {
      if (job.revision === revision) { settle(job.revision, error); onError?.(error); }
    } finally {
      if (artifact) dispose?.(artifact);
      running = false;
      if (pending) schedule(); else onBusy?.(false);
    }
  }
  return {
    enqueue(value) {
      revision += 1; pending = {value: {...value}, revision}; onBusy?.(true);
      const promise = new Promise((resolve, reject) => waiters.push({revision, resolve, reject}));
      if (!running) schedule();
      return promise;
    },
    get state() { return {revision, committedRevision, busy: running || !!pending, running}; },
  };
}

/**
 * One full frame in flight. Draw always reads the newest state; input does not
 * enqueue a list of stale poses. WebGL2 fences are polled with timeout=0, never
 * finish()/blocking waits. The fallback is rate-limited, not proof of GPU idle.
 */
export function createRenderQueue({
  draw, gl, onError,
  now = () => performance.now(),
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = handle => cancelAnimationFrame(handle),
  defer = (callback, delay) => setTimeout(callback, delay),
  cancelDeferred = handle => clearTimeout(handle),
  pollInterval = 16, fallbackInterval = 250,
}) {
  const fenceSupported = !!(gl && typeof gl.fenceSync === 'function' && typeof gl.clientWaitSync === 'function' && typeof gl.deleteSync === 'function');
  let dirty = false, inFlight = false, stopped = false, frameHandle = null, pollHandle = null, fence = null;
  let startedAt = 0, submittedAt = 0, activeRevision = 0;
  const stats = {
    mode: fenceSupported ? 'webgl2-fence' : 'throttled-no-fence', fenceSupported,
    requestedRevision: 0, submittedRevision: 0, completedRevision: 0,
    framesSubmitted: 0, framesCompleted: 0, coalescedRequests: 0,
    maxFramesInFlight: 0, fencePolls: 0, fenceFailures: 0,
    lastCpuSubmissionMs: null, lastGpuWaitMs: null, lastGpuCompletionElapsedMs: null,
    maxGpuCompletionElapsedMs: 0, lastGpuCompletionVerified: null,
    lastRenderedState: null, lastCompletedState: null, failed: null, recentFrames: [],
    timingMeaning: 'Wall-clock elapsed until fence completion, including CPU submission and scheduling; not a GPU timer query. No-fence fallback cannot verify GPU completion.',
  };
  const pending = () => !stopped && (dirty || inFlight || frameHandle !== null);
  function stopWithError(error) {
    stopped = true; dirty = false; inFlight = false;
    if (frameHandle !== null) cancelFrame(frameHandle);
    if (pollHandle !== null) cancelDeferred(pollHandle);
    if (fence) gl.deleteSync(fence);
    frameHandle = pollHandle = fence = null;
    stats.failed = String(error?.message || error);
    onError?.(error);
  }
  function schedule() {
    if (!stopped && dirty && !inFlight && frameHandle === null) frameHandle = requestFrame(submit);
  }
  function complete(verified) {
    const finishedAt = now();
    if (fence) gl.deleteSync(fence);
    fence = null; pollHandle = null; inFlight = false;
    stats.framesCompleted += 1; stats.completedRevision = activeRevision;
    stats.lastGpuCompletionVerified = verified;
    stats.lastGpuWaitMs = verified ? finishedAt - submittedAt : null;
    stats.lastGpuCompletionElapsedMs = verified ? finishedAt - startedAt : null;
    if (verified) stats.maxGpuCompletionElapsedMs = Math.max(stats.maxGpuCompletionElapsedMs, stats.lastGpuCompletionElapsedMs);
    stats.lastCompletedState = stats.lastRenderedState;
    stats.recentFrames.push({revision: activeRevision, cpuSubmissionMs: stats.lastCpuSubmissionMs, gpuWaitMs: stats.lastGpuWaitMs, gpuCompletionElapsedMs: stats.lastGpuCompletionElapsedMs, gpuCompletionVerified: verified});
    if (stats.recentFrames.length > 24) stats.recentFrames.shift();
    schedule();
  }
  function poll() {
    pollHandle = null;
    if (stopped || !inFlight || !fence) return;
    try {
      stats.fencePolls += 1;
      const result = gl.clientWaitSync(fence, 0, 0);
      if (result === gl.ALREADY_SIGNALED || result === gl.CONDITION_SATISFIED) complete(true);
      else if (result === gl.TIMEOUT_EXPIRED) pollHandle = defer(poll, pollInterval);
      else throw new Error('GPU fence wait failed; no further frames will be queued');
    } catch (error) { stopWithError(error); }
  }
  function submit() {
    frameHandle = null;
    if (stopped || inFlight || !dirty) return;
    dirty = false; inFlight = true; activeRevision = stats.requestedRevision;
    stats.submittedRevision = activeRevision; stats.framesSubmitted += 1;
    stats.maxFramesInFlight = Math.max(stats.maxFramesInFlight, 1);
    startedAt = now();
    try {
      stats.lastRenderedState = draw();
      submittedAt = now(); stats.lastCpuSubmissionMs = submittedAt - startedAt;
      if (fenceSupported) fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl?.flush?.();
      if (fence) pollHandle = defer(poll, pollInterval);
      else {
        if (fenceSupported) stats.fenceFailures += 1;
        stats.mode = 'throttled-no-fence';
        // At most four submissions/second, slower for expensive CPU submission.
        // This is an honest fallback bound, not a claim that the GPU has drained.
        pollHandle = defer(() => complete(false), Math.max(fallbackInterval, stats.lastCpuSubmissionMs * 2));
      }
    } catch (error) { stopWithError(error); }
  }
  return {
    request() {
      if (stopped) return stats.requestedRevision;
      if (pending()) stats.coalescedRequests += 1;
      stats.requestedRevision += 1; dirty = true; schedule();
      return stats.requestedRevision;
    },
    get pending() { return pending(); },
    get stats() {
      return {...stats, inFlight, dirty, renderPending: pending(), inFlightElapsedMs: inFlight ? now() - startedAt : 0, recentFrames: stats.recentFrames.map(frame => ({...frame}))};
    },
  };
}
