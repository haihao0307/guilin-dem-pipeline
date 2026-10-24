/** Original, dependency-free controls for the field camera. No rendering or RAF.
 * Camera: { eye: [x,y,z], target: [x,y,z], fov: vertical radians }.
 * Inputs/viewport dimensions use CSS pixels, not the GPU render resolution.
 */
const PI = Math.PI;
const WORLD_LIMIT = 1e9;
const DEFAULT_FOV = PI / 4;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const delta = value => clamp(finite(value), -10000, 10000);
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = a => { const length = Math.hypot(...a); return a.map(v => v / (length || 1)); };
const vector = (value, fallback) => fallback.map((v, i) => clamp(finite(value?.[i], v), -WORLD_LIMIT, WORLD_LIMIT));
const fovValue = value => clamp(finite(value, DEFAULT_FOV), .01, PI - .01);

function limits(options = {}) {
  const min = clamp(finite(options.minDistance, .25), .0001, 1e7);
  return { min, max: clamp(finite(options.maxDistance, 10000), min, 1e8) };
}

function cameraState(camera, options = {}) {
  const target = vector(camera?.target, [0, 0, 0]);
  const eye = vector(camera?.eye, [0, 0, 10]);
  let offset = subtract(eye, target);
  const rawDistance = Math.hypot(...offset);
  const { min, max } = limits(options);
  const distance = clamp(rawDistance > 1e-10 ? rawDistance : 10, min, max);
  offset = rawDistance > 1e-10 ? offset.map(v => v / rawDistance * distance) : [0, 0, distance];
  return { camera: { ...camera, eye: target.map((v, i) => v + offset[i]), target, fov: fovValue(camera?.fov) }, offset, distance };
}

/** Spherical Y-up orbit. Default pole clamp also avoids the renderer up-axis switch. */
export function orbitCamera(camera, dx, dy, options = {}) {
  const state = cameraState(camera, options);
  const speed = clamp(finite(options.rotateSpeed, .006), 0, .1);
  const minPhi = clamp(finite(options.minPolarAngle, .05), .0001, PI - .0001);
  const maxPhi = clamp(finite(options.maxPolarAngle, PI - .05), minPhi, PI - .0001);
  const theta = Math.atan2(state.offset[0], state.offset[2]) - delta(dx) * speed;
  const phi = clamp(Math.acos(clamp(state.offset[1] / state.distance, -1, 1)) - delta(dy) * speed, minPhi, maxPhi);
  const radius = state.distance;
  const offset = [radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.cos(theta)];
  return { ...state.camera, eye: state.camera.target.map((v, i) => v + offset[i]) };
}

/** Positive delta moves away; negative moves closer. Exponential, bounded dolly. */
export function zoomCamera(camera, wheelDelta, options = {}) {
  const state = cameraState(camera, options), { min, max } = limits(options);
  const speed = clamp(finite(options.zoomSpeed, .0015), 0, 10);
  const distance = clamp(state.distance * Math.exp(clamp(delta(wheelDelta) * speed, -20, 20)), min, max);
  return { ...state.camera, eye: state.camera.target.map((v, i) => v + state.offset[i] * distance / state.distance) };
}

/** Screen-space grab pan. Moves eye and target equally, using the shader's basis. */
export function panCamera(camera, dx, dy, options = {}) {
  const state = cameraState(camera, options);
  const forward = state.offset.map(v => -v / state.distance);
  // Match whole-building rayDirection exactly, including its vertical-ray fallback.
  const right = normalize(cross(forward, Math.abs(forward[1]) > .999 ? [0, 0, 1] : [0, 1, 0]));
  const up = normalize(cross(right, forward));
  const height = clamp(finite(options.viewportHeight, 1), 1, 1e6);
  const speed = clamp(finite(options.panSpeed, 1), 0, 10);
  const scale = 2 * state.distance * Math.tan(fovValue(options.fov ?? state.camera.fov) / 2) / height * speed;
  const shift = right.map((v, i) => (-delta(dx) * v + delta(dy) * up[i]) * scale);
  // Clamp the translation, not each point, to preserve the view ray at world bounds.
  const boundedShift = shift.map((v, i) => clamp(v, -WORLD_LIMIT - state.camera.target[i], WORLD_LIMIT - state.camera.target[i]));
  return { ...state.camera, eye: state.camera.eye.map((v, i) => v + boundedShift[i]), target: state.camera.target.map((v, i) => v + boundedShift[i]) };
}

/** Bind canvas-only input. setCamera runs before onChange(camera, metadata).
 * onStart(metadata) / onEnd(metadata) delimit an interaction (wheel uses a short
 * idle timer). Metadata has kind, pointerCount and, for end, cancelled/reason.
 * Options: orbitOptions, zoomOptions, panOptions and wheelEndDelay (milliseconds).
 * Return an idempotent cleanup function. The host owns all GPU scheduling.
 */
export function attachCameraControls(canvas, {
  getCamera, setCamera, onStart = () => {}, onChange = () => {}, onEnd = () => {},
  orbitOptions = {}, zoomOptions = {}, panOptions = {}, wheelEndDelay = 150,
} = {}) {
  if (!canvas?.addEventListener || typeof getCamera !== 'function' || typeof setCamera !== 'function') {
    throw new TypeError('Canvas, getCamera and setCamera are required');
  }
  const pointers = new Map();
  const root = canvas.ownerDocument?.defaultView ?? canvas;
  const oldTouchAction = canvas.style?.touchAction;
  if (canvas.style) canvas.style.touchAction = 'none';
  let active = false, disposed = false, wheelTimer = null, multi = null, lastKind = 'orbit';
  const point = event => ({ x: finite(event.clientX), y: finite(event.clientY) });
  const viewportHeight = () => clamp(finite(canvas.getBoundingClientRect?.().height, canvas.clientHeight || 1), 1, 1e6);
  const meta = (kind = lastKind, extra = {}) => ({ kind, pointerCount: pointers.size, ...extra });
  const begin = kind => {
    lastKind = kind;
    if (!active) { active = true; onStart(meta(kind)); }
  };
  const finish = (cancelled = false, reason = 'release') => {
    if (active && !pointers.size && wheelTimer === null) {
      active = false;
      onEnd(meta(lastKind, { cancelled, reason }));
    }
  };
  const change = (camera, kind) => {
    lastKind = kind;
    setCamera(camera);
    onChange(camera, meta(kind));
  };
  const geometry = () => {
    const [a, b] = pointers.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const resetMulti = () => {
    multi = pointers.size === 2 ? { ...geometry(), camera: cameraState(getCamera(), zoomOptions).camera } : null;
  };
  const release = pointerId => {
    try {
      if (!canvas.hasPointerCapture || canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture?.(pointerId);
    } catch { /* Capture can already have been released by the browser. */ }
  };
  const pointerDown = event => {
    if (disposed || pointers.has(event.pointerId) || pointers.size >= 2) return;
    if (event.pointerType !== 'touch' && event.button !== 0 && event.button !== 2) return;
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    const mode = event.button === 2 || event.shiftKey ? 'pan' : 'orbit';
    pointers.set(event.pointerId, { ...point(event), mode });
    resetMulti();
    event.preventDefault?.();
    try { canvas.setPointerCapture?.(event.pointerId); } catch { /* Window listeners handle failed capture. */ }
    begin(pointers.size === 2 ? 'pinch-pan' : mode);
  };
  const pointerMove = event => {
    const previous = pointers.get(event.pointerId);
    if (disposed || !previous || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    event.preventDefault?.();
    const next = point(event), dx = next.x - previous.x, dy = next.y - previous.y;
    if (!dx && !dy) return;
    pointers.set(event.pointerId, { ...previous, ...next });
    if (pointers.size === 2) {
      const current = geometry();
      let camera = multi.camera;
      if (multi.distance >= 2 && current.distance >= 2) {
        camera = zoomCamera(camera, Math.log(multi.distance / current.distance), { ...zoomOptions, zoomSpeed: 1 });
      }
      camera = panCamera(camera, current.x - multi.x, current.y - multi.y, { ...zoomOptions, ...panOptions, viewportHeight: viewportHeight() });
      change(camera, 'pinch-pan');
    } else {
      const mode = event.shiftKey || previous.mode === 'pan' ? 'pan' : 'orbit';
      const camera = mode === 'pan'
        ? panCamera(getCamera(), dx, dy, { ...zoomOptions, ...panOptions, viewportHeight: viewportHeight() })
        : orbitCamera(getCamera(), dx, dy, { ...zoomOptions, ...orbitOptions });
      change(camera, mode);
    }
  };
  const pointerEnd = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault?.();
    pointers.delete(event.pointerId);
    resetMulti();
    release(event.pointerId);
    if (event.type !== 'pointerup' && !pointers.size && wheelTimer !== null) {
      clearTimeout(wheelTimer); wheelTimer = null;
    }
    finish(event.type !== 'pointerup', event.type);
  };
  const wheel = event => {
    if (disposed || !Number.isFinite(event.deltaY) || !event.deltaY) return;
    event.preventDefault?.();
    begin('zoom');
    const modeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight() : 1;
    change(zoomCamera(getCamera(), event.deltaY * modeScale, zoomOptions), 'zoom');
    // Rebase an in-progress pinch if a device emits wheel and pointer input together.
    resetMulti();
    if (wheelTimer !== null) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelTimer = null; finish(false, 'wheel-idle'); }, clamp(finite(wheelEndDelay, 150), 0, 1000));
  };
  const cancelAll = (reason = 'blur') => {
    const ids = [...pointers.keys()];
    pointers.clear(); multi = null;
    ids.forEach(release);
    if (wheelTimer !== null) { clearTimeout(wheelTimer); wheelTimer = null; }
    finish(true, reason);
  };
  const blur = () => cancelAll('blur');
  const contextmenu = event => event.preventDefault?.();
  const bindings = [
    [canvas, 'pointerdown', pointerDown], [root, 'pointermove', pointerMove],
    [root, 'pointerup', pointerEnd], [root, 'pointercancel', pointerEnd],
    [canvas, 'lostpointercapture', pointerEnd], [canvas, 'wheel', wheel],
    [canvas, 'contextmenu', contextmenu], [root, 'blur', blur],
  ];
  for (const [target, type, handler] of bindings) target.addEventListener(type, handler, { passive: false });
  return () => {
    if (disposed) return;
    disposed = true;
    for (const [target, type, handler] of bindings) target.removeEventListener(type, handler);
    cancelAll('dispose');
    if (canvas.style?.touchAction === 'none') canvas.style.touchAction = oldTouchAction ?? '';
  };
}
