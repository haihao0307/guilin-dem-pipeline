import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitCamera, zoomCamera, panCamera, attachCameraControls } from '../whole-building-interaction-r01/camera-controls.mjs';

const initial = () => ({ eye: [0, 0, 10], target: [0, 0, 0], fov: Math.PI / 2 });
const distance = camera => Math.hypot(...camera.eye.map((v, i) => v - camera.target[i]));
const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const vectorNear = (a, b) => a.forEach((v, i) => near(v, b[i]));
const finiteCamera = camera => {
  assert.ok([...camera.eye, ...camera.target, camera.fov].every(Number.isFinite));
  assert.ok(distance(camera) > 0);
};

test('orbit is spherical around target, changes both axes, and never mutates input', () => {
  const camera = initial(), before = structuredClone(camera);
  const horizontal = orbitCamera(camera, 100, 0, { rotateSpeed: Math.PI / 200 });
  vectorNear(horizontal.eye, [-10, 0, 0]);
  const vertical = orbitCamera(camera, 0, 50, { rotateSpeed: Math.PI / 200 });
  near(vertical.eye[1], 10 / Math.sqrt(2));
  near(vertical.eye[2], 10 / Math.sqrt(2));
  near(distance(vertical), 10);
  vectorNear(vertical.target, camera.target);
  assert.deepEqual(camera, before);
});

test('orbit pole clamp prevents pole crossing and repeated drags remain finite', () => {
  let camera = orbitCamera(initial(), 0, 10000);
  near(Math.acos(camera.eye[1] / distance(camera)), .05);
  for (let i = 0; i < 1000; i++) camera = orbitCamera(camera, 135, i % 2 ? 40 : -40);
  finiteCamera(camera); near(distance(camera), 10, 1e-7);
  camera = orbitCamera(camera, 0, -10000);
  near(Math.acos(camera.eye[1] / distance(camera)), Math.PI - .05);
});

test('exponential zoom preserves target, direction, and respects both distance bounds', () => {
  const camera = initial();
  near(distance(zoomCamera(camera, 200)), 10 * Math.exp(.3));
  const twice = zoomCamera(zoomCamera(camera, 100), 100);
  vectorNear(twice.eye, zoomCamera(camera, 200).eye);
  near(distance(zoomCamera(camera, -10000, { minDistance: 2, maxDistance: 20 })), 2);
  near(distance(zoomCamera(camera, 10000, { minDistance: 2, maxDistance: 20 })), 20);
  vectorNear(zoomCamera(camera, 100).target, camera.target);
});

test('pan follows camera screen basis, CSS viewport height, and vertical FOV', () => {
  const camera = initial();
  const moved = panCamera(camera, 100, 50, { viewportHeight: 1000 });
  vectorNear(moved.target, [-2, 1, 0]);
  vectorNear(moved.eye, [-2, 1, 10]);
  near(distance(moved), 10);
  const reverseView = { ...camera, eye: [0, 0, -10] };
  vectorNear(panCamera(reverseView, 100, 0, { viewportHeight: 1000 }).target, [2, 0, 0]);
  const closerFov = panCamera(camera, 100, 0, { viewportHeight: 1000, fov: Math.PI / 4 });
  near(closerFov.target[0], -2 * Math.tan(Math.PI / 8));
});

test('zero-length, vertical, malformed and extreme input cameras never produce NaN', () => {
  const cameras = [
    { eye: [0, 0, 0], target: [0, 0, 0] },
    { eye: [0, 10, 0], target: [0, 0, 0] },
    { eye: [0, -10, 0], target: [0, 0, 0] },
    { eye: [NaN, Infinity, -Infinity], target: [NaN, 1e300, -1e300], fov: Infinity },
    null,
  ];
  for (const camera of cameras) {
    finiteCamera(orbitCamera(camera, NaN, Infinity));
    finiteCamera(zoomCamera(camera, -1e300));
    finiteCamera(panCamera(camera, 1e300, -1e300, { viewportHeight: 0, fov: NaN }));
    finiteCamera(panCamera(camera, Infinity, NaN, { viewportHeight: Infinity }));
  }
  const verticalPan = panCamera(cameras[1], 100, 50, { viewportHeight: 1000 });
  vectorNear(verticalPan.target, [100 * 20 * Math.tan(Math.PI / 8) / 1000, 0, 50 * 20 * Math.tan(Math.PI / 8) / 1000]);
});

class MockTarget {
  listeners = new Map();
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, properties = {}) {
    const event = { type, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1,
      clientX: 0, clientY: 0, shiftKey: false, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (const handler of this.listeners.get(type) ?? []) handler(event);
    return event;
  }
}

function harness(options = {}) {
  const root = new MockTarget(), canvas = new MockTarget();
  canvas.ownerDocument = { defaultView: root };
  canvas.style = { touchAction: 'pan-y' };
  canvas.captures = new Set();
  canvas.setPointerCapture = id => canvas.captures.add(id);
  canvas.hasPointerCapture = id => canvas.captures.has(id);
  canvas.releasePointerCapture = id => canvas.captures.delete(id);
  canvas.getBoundingClientRect = () => ({ height: 1000, width: 1000 });
  let camera = initial();
  const starts = [], changes = [], ends = [];
  const cleanup = attachCameraControls(canvas, {
    getCamera: () => camera,
    setCamera: next => { camera = next; },
    onStart: metadata => starts.push(metadata),
    onChange: (next, metadata) => { assert.equal(next, camera); changes.push({ camera: next, ...metadata }); },
    onEnd: metadata => ends.push(metadata), ...options,
  });
  return { canvas, root, starts, changes, ends, cleanup, get camera() { return camera; } };
}

test('left drag continuously updates orbit; capture failure still works via window', () => {
  const h = harness();
  h.canvas.setPointerCapture = () => { throw Error('Capture unavailable'); };
  assert.equal(h.canvas.dispatch('pointerdown').defaultPrevented, true);
  h.root.dispatch('pointermove', { clientX: 10 });
  h.root.dispatch('pointermove', { clientX: 20 });
  assert.equal(h.changes.length, 2); assert.equal(h.starts.length, 1);
  vectorNear(h.camera.eye, orbitCamera(initial(), 20, 0).eye);
  h.root.dispatch('pointerup');
  assert.equal(h.ends.length, 1); assert.equal(h.ends[0].cancelled, false);
  assert.equal(h.root.dispatch('pointermove', { clientX: 30 }).defaultPrevented, false);
  h.cleanup();
});

test('right button and shift-left drag pan rather than orbit', () => {
  for (const properties of [{ button: 2 }, { button: 0, shiftKey: true }]) {
    const h = harness();
    h.canvas.dispatch('pointerdown', properties);
    h.root.dispatch('pointermove', { clientX: 100, clientY: 50 });
    vectorNear(h.camera.target, [-2, 1, 0]);
    assert.equal(h.changes[0].kind, 'pan');
    h.cleanup();
  }
});

test('two touches combine exact pinch and midpoint pan, then resume one-touch orbit', () => {
  const h = harness(), touch = { pointerType: 'touch' };
  h.canvas.dispatch('pointerdown', { ...touch, pointerId: 1, clientX: -50 });
  h.canvas.dispatch('pointerdown', { ...touch, pointerId: 2, clientX: 50 });
  h.root.dispatch('pointermove', { ...touch, pointerId: 1, clientX: -100 });
  h.root.dispatch('pointermove', { ...touch, pointerId: 2, clientX: 100 });
  near(distance(h.camera), 5); vectorNear(h.camera.target, [0, 0, 0]);
  h.root.dispatch('pointermove', { ...touch, pointerId: 1, clientX: -80, clientY: 40 });
  h.root.dispatch('pointermove', { ...touch, pointerId: 2, clientX: 120, clientY: 40 });
  near(distance(h.camera), 5); vectorNear(h.camera.target, [-.2, .4, 0]);
  h.root.dispatch('pointerup', { ...touch, pointerId: 2 });
  assert.equal(h.ends.length, 0);
  const before = structuredClone(h.camera);
  h.root.dispatch('pointermove', { ...touch, pointerId: 1, clientX: -70, clientY: 40 });
  vectorNear(h.camera.eye, orbitCamera(before, 10, 0).eye);
  h.root.dispatch('pointercancel', { ...touch, pointerId: 1 });
  assert.equal(h.ends.length, 1); assert.equal(h.ends[0].cancelled, true);
  assert.equal(h.canvas.captures.size, 0);
  h.cleanup();
});

test('pointer cancellation, lost capture, blur and idempotent disposal clean all state', () => {
  for (const end of ['pointercancel', 'lostpointercapture', 'blur', 'dispose']) {
    const h = harness();
    h.canvas.dispatch('pointerdown');
    if (end === 'dispose') h.cleanup();
    else (end === 'lostpointercapture' ? h.canvas : h.root).dispatch(end);
    assert.equal(h.ends.length, 1); assert.equal(h.ends[0].cancelled, true);
    assert.equal(h.canvas.captures.size, 0);
    h.root.dispatch('pointermove', { clientX: 100 });
    assert.equal(h.changes.length, 0);
    h.cleanup(); h.cleanup();
    assert.equal(h.canvas.style.touchAction, 'pan-y');
    assert.equal(h.ends.length, 1);
    assert.ok([...h.canvas.listeners.values(), ...h.root.listeners.values()].every(set => set.size === 0));
  }
});

test('wheel units normalize, only handled canvas input is prevented, and wheel ends once', async () => {
  const h = harness({ wheelEndDelay: 5 });
  const event = h.canvas.dispatch('wheel', { deltaY: 1, deltaMode: 1 });
  assert.equal(event.defaultPrevented, true);
  vectorNear(h.camera.eye, zoomCamera(initial(), 16).eye);
  h.canvas.dispatch('wheel', { deltaY: 1, deltaMode: 2 });
  vectorNear(h.camera.eye, zoomCamera(zoomCamera(initial(), 16), 1000).eye);
  assert.equal(h.starts.length, 1);
  assert.equal(h.canvas.dispatch('wheel', { deltaY: NaN }).defaultPrevented, false);
  assert.equal(h.canvas.dispatch('pointerdown', { button: 1 }).defaultPrevented, false);
  assert.equal(h.root.dispatch('wheel', { deltaY: 10 }).defaultPrevented, false);
  assert.equal(h.canvas.dispatch('contextmenu').defaultPrevented, true);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.ends.length, 1); assert.equal(h.ends[0].reason, 'wheel-idle');
  h.cleanup();
});

test('pointer cancellation also clears a concurrent wheel interaction immediately', async () => {
  const h = harness({ wheelEndDelay: 5 });
  h.canvas.dispatch('pointerdown');
  h.canvas.dispatch('wheel', { deltaY: 10 });
  h.root.dispatch('pointercancel');
  assert.equal(h.ends.length, 1); assert.equal(h.ends[0].cancelled, true);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(h.ends.length, 1);
  h.cleanup();
});

test('configured zoom distance limits remain consistent when panning or orbiting', () => {
  const h = harness({ zoomOptions: { minDistance: .01, maxDistance: 20 } });
  h.canvas.dispatch('wheel', { deltaY: -10000 });
  near(distance(h.camera), .01);
  h.canvas.dispatch('pointerdown');
  h.root.dispatch('pointermove', { clientX: 10 });
  near(distance(h.camera), .01);
  h.root.dispatch('pointermove', { clientX: 20, shiftKey: true });
  near(distance(h.camera), .01);
  h.cleanup();
});
