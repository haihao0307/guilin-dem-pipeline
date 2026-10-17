/** UI-only controls. Native geometry and material generators stay in R01. */
export const SHELL_LIMITS = Object.freeze({
  locoTopHeight: Object.freeze({min: 3.85, max: 4.20, default: 4.03, step: 0.01}),
  locoSideTuck: Object.freeze({min: 0.03, max: 0.20, default: 0.11, step: 0.01}),
  coachRoofTop: Object.freeze({min: 3.55, max: 4.05, default: 3.81, step: 0.01}),
});
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
export function createViewState() { return {view: 'side', free: false, zoom: 1, ...VIEW_POSES.side}; }
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
