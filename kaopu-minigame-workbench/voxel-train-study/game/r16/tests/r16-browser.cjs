/* R16 browser acceptance, for the approved CI browser ONLY.
 * Local sandbox browser launch was denied: this file must not be used to retry it.
 * CI: Ubuntu 24.04, Playwright 1.57.0 Chromium / ANGLE SwiftShader.
 * Native journey tests use trusted UI and the production animation clock. The
 * route-appended observer does not change Session, camera, scene or animation.
 * Only the separately named R14/R16 comparison fixtures place simulation state.
 * Serve the repository root; TRAIN_GAME_URL and TRAIN_QA_OUT are optional.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {chromium} = require('playwright');
const {clickTarget, clickControl, controlGeometry, assertControlGeometry} = require('../../tests/browser-controls.cjs');
const base = new URL(process.env.TRAIN_GAME_URL || 'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r16/').href;
const baseline = new URL('../', base).href;
const study = new URL('../../', base).href;
const out = path.resolve(process.env.TRAIN_QA_OUT || 'train-r16-webgl-qa');
const args = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const VIEWPORT = {width: 1280, height: 720};
const VERSION = 'kcr-kst1-r16';
const checks = [], failures = [], consoleMessages = [], pageErrors = [], requests = [], responseErrors = [], requestFailures = [], prohibitedRequests = [];
const launchStarted = performance.now(), runnerCPU = process.cpuUsage();
const oldStorage = {'kaopu.train-driver.save.v1': 'R14-SAVE-ISOLATION-SENTINEL', 'kaopu.train-driver.views.r09': 'R14-VIEWS-ISOLATION-SENTINEL', 'kaopu.train-driver.quality.v1': 'R14-QUALITY-ISOLATION-SENTINEL'};
fs.mkdirSync(out, {recursive: true});
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const state = page => page.evaluate(() => window.__trainDriver.getState());
const until = (page, fn, arg, options = {}) => page.waitForFunction(fn, arg, {polling: 100, timeout: 60000, ...options});
const stats = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {count: sorted.length, min: sorted[0] ?? null, median: sorted[Math.floor(sorted.length / 2)] ?? null,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? null, max: sorted.at(-1) ?? null};
};

// Observation installed before the application's first WebGL call. These
// wrappers preserve arguments/results and record actual driver allocations.
function initObservation({storage = null} = {}) {
  if (storage) for (const [key, value] of Object.entries(storage)) {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }
  const q = window.__r16QA = {events: [], frameIntervals: [], frameCallbackMs: [], longTasks: [], contexts: [], contextEvents: [], shaderFailures: []};
  const bounded = (list, entry, max = 2400) => { list.push(entry); if (list.length > max) list.shift(); };
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup']) document.addEventListener(type, event => {
    const target = event.target?.closest?.('button,input,select,canvas');
    if (target) bounded(q.events, {type, id: target.id, camera: target.dataset?.camera || null, trusted: event.isTrusted,
      pointerType: event.pointerType || null, key: event.key || null, at: performance.now()});
  }, true);
  for (const type of ['webglcontextlost', 'webglcontextrestored']) document.addEventListener(type, event => {
    bounded(q.contextEvents, {type, id: event.target.id, at: performance.now()});
  }, true);
  try { new PerformanceObserver(list => list.getEntries().forEach(e => bounded(q.longTasks, {start: e.startTime, duration: e.duration}))).observe({type: 'longtask', buffered: true}); } catch {}
  const originalRAF = window.requestAnimationFrame.bind(window);
  let lastRAF = null;
  window.requestAnimationFrame = callback => originalRAF(now => {
    if (lastRAF !== null) bounded(q.frameIntervals, now - lastRAF);
    lastRAF = now; const start = performance.now();
    try { return callback(now); } finally { bounded(q.frameCallbackMs, performance.now() - start); }
  });
  const originalContext = HTMLCanvasElement.prototype.getContext, observed = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (...params) {
    const gl = originalContext.apply(this, params);
    if (!gl || !/^webgl2?$|^experimental-webgl$/.test(params[0]) || observed.has(gl)) return gl;
    observed.add(gl);
    const counters = {canvas: this.id, type: params[0], resources: {}, bufferDataCalls: 0, bufferSubDataCalls: 0,
      bufferDataBytesSubmitted: 0, bufferSubDataBytesSubmitted: 0, liveBufferBytes: 0};
    q.contexts.push(counters);
    const bufferBytes = new Map(), bindings = new Map();
    for (const name of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'VertexArray', 'Program', 'Shader', 'Query', 'Sampler']) {
      const create = 'create' + name, remove = 'delete' + name;
      if (!gl[create] || !gl[remove]) continue;
      const createFn = gl[create].bind(gl), deleteFn = gl[remove].bind(gl), live = new Set();
      const count = counters.resources[name] = {created: 0, deleted: 0, live: 0, peak: 0};
      gl[create] = (...values) => { const obj = createFn(...values); if (obj) { live.add(obj); count.created++; count.live = live.size; count.peak = Math.max(count.peak, count.live); } return obj; };
      gl[remove] = obj => {
        if (live.delete(obj)) { count.deleted++; count.live = live.size; }
        if (name === 'Buffer' && bufferBytes.has(obj)) { counters.liveBufferBytes -= bufferBytes.get(obj); bufferBytes.delete(obj); }
        return deleteFn(obj);
      };
    }
    const bindBuffer = gl.bindBuffer.bind(gl); gl.bindBuffer = (target, buffer) => { bindings.set(target, buffer); return bindBuffer(target, buffer); };
    const size = (data, sourceOffset, length) => typeof data === 'number' ? data : data ? (length ? length * (data.BYTES_PER_ELEMENT || 1) : data.byteLength - (sourceOffset || 0) * (data.BYTES_PER_ELEMENT || 1)) : 0;
    const bufferData = gl.bufferData.bind(gl); gl.bufferData = (...values) => {
      const n = size(values[1], values[3], values[4]), buffer = bindings.get(values[0]);
      counters.bufferDataCalls++; counters.bufferDataBytesSubmitted += n;
      if (buffer) { counters.liveBufferBytes += n - (bufferBytes.get(buffer) || 0); bufferBytes.set(buffer, n); }
      return bufferData(...values);
    };
    const bufferSubData = gl.bufferSubData.bind(gl); gl.bufferSubData = (...values) => {
      counters.bufferSubDataCalls++; counters.bufferSubDataBytesSubmitted += size(values[2], values[3], values[4]); return bufferSubData(...values);
    };
    const linkProgram = gl.linkProgram.bind(gl); gl.linkProgram = program => {
      const result = linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) q.shaderFailures.push({program: gl.getProgramInfoLog(program), shaders: (gl.getAttachedShaders(program) || []).map(s => ({compiled: gl.getShaderParameter(s, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(s)}))});
      return result;
    };
    return gl;
  };
}

// Read-only application-module observer. Renderer wrapping measures the original
// render call. Optional GPU timer queries are bounded and excluded from plateau
// assertions; they never advance the Session or select a camera.
const observerHarness = `
;(() => {
  const qa = window.__r16QA;
  const renderMs = [], gpuMs = [], pending = [], transitions = [], disposals = [], watched = new WeakSet();
  function watchStreet() {
    const handle = world.streetDistrict?.handle; if (!handle || watched.has(handle)) return;
    watched.add(handle);
    const resources = {geometry: new Set(handle.resources?.geometries || []), material: new Set(handle._library?.materials || []), instancedMesh: new Set()};
    handle.root.traverse(o => { if (o.geometry) resources.geometry.add(o.geometry); if (o.isInstancedMesh) resources.instancedMesh.add(o); for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) resources.material.add(m); });
    const report = {loadCount: world.streetDistrict.proof.loadCount, expected: {}, events: {}, duplicates: 0};
    for (const [kind, objects] of Object.entries(resources)) {
      report.expected[kind] = objects.size; report.events[kind] = 0;
      for (const object of objects) { let fired = false; object.addEventListener('dispose', () => { if (fired) report.duplicates++; fired = true; report.events[kind]++; }); }
    }
    disposals.push(report);
  }
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let measured = 0, previousLifecycle = '';
  const originalRender = renderer.render.bind(renderer);
  function drainTimers() {
    for (let i = pending.length - 1; i >= 0; i--) {
      const query = pending[i];
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) gpuMs.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(query); pending.splice(i, 1);
    }
  }
  renderer.render = function (...values) {
    watchStreet(); const started = performance.now(); let query = null;
    if (timer && measured < 90 && !gl.isContextLost()) {
      query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); measured++;
    }
    try { return originalRender(...values); }
    finally {
      if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); pending.push(query); }
      if (timer && !gl.isContextLost()) drainTimers();
      renderMs.push(performance.now() - started); if (renderMs.length > 2400) renderMs.shift();
      const proof = world.streetDistrict?.proof;
      const key = proof ? [proof.status, proof.loadCount, proof.unloadCount].join(':') : 'baseline';
      if (key !== previousLifecycle) {
        previousLifecycle = key; transitions.push({at: performance.now(), status: key, distance: game.distance,
          elapsed: game.elapsed, renderSubmitMs: renderMs.at(-1), memory: {...renderer.info.memory}, programs: renderer.info.programs.length});
      }
    }
  };
  const hash = array => { let h = 2166136261; const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); for (const v of bytes) { h ^= v; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  function snapshot(visual = false) {
    const district = world.streetDistrict, handle = district?.handle;
    const geometries = new Set(), materials = new Set();
    scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) materials.add(m); });
    watchStreet();
    const steamGeometry = []; smoke.root.traverse(o => { if (o.geometry) { const attributes = {}; for (const [name, a] of Object.entries(o.geometry.attributes)) attributes[name] = hash(a.array); steamGeometry.push(attributes); } });
    const cloth = (handle?.cloth || []).map(c => {
      const positions = c.mesh.geometry.attributes.position.array; let pinned = 0, pinMaxError = 0;
      for (let i = 0; i < c.pinned.length; i++) if (c.pinned[i]) { pinned++; for (let k = 0; k < 3; k++) pinMaxError = Math.max(pinMaxError, Math.abs(positions[i * 3 + k] - c.rest[i * 3 + k])); }
      return {name: c.mesh.name, hash: hash(positions), pinned, pinMaxError};
    });
    const streetMaterials = [...materials].filter(m => m.userData?.street).map(m => ({id: m.uuid, name: m.name,
      family: m.userData.street.family, config: m.userData.street.config,
      time: m.userData.street.uniforms.stTime.value, worldOffset: m.userData.street.uniforms.stWorldOffset.value.toArray()}));
    const programs = renderer.info.programs.map(p => ({name: p.name, id: p.id, usedTimes: p.usedTimes,
      linked: gl.getProgramParameter(p.program, gl.LINK_STATUS), log: gl.getProgramInfoLog(p.program),
      diagnostic: p.diagnostics ? {runnable: p.diagnostics.runnable, programLog: p.diagnostics.programLog} : null}));
    const result = {state: __trainDriver.getState(), threeRevision: THREE.REVISION,
      renderer: {memory: {...renderer.info.memory}, render: {...renderer.info.render}, programs, sceneGeometries: geometries.size, sceneMaterials: materials.size},
      gl: qa.contexts, disposals, shaderFailures: qa.shaderFailures, contextLost: gl.isContextLost(),
      timing: {renderSubmitMs: renderMs.slice(), gpuFrameMs: gpuMs.slice(), timerAvailable: !!timer, pendingQueries: pending.length,
        frameIntervals: qa.frameIntervals.slice(), frameCallbackMs: qa.frameCallbackMs.slice(), longTasks: qa.longTasks.slice(), transitions: transitions.slice()},
      motion: {cloth, actors: game.actors.map(a => ({id: a.id, kind: a.kind, position: a.position.slice()})),
        peopleMatrix: world.people.mesh.instanceMatrix ? hash(world.people.mesh.instanceMatrix.array) : null,
        steam: {particleCapacity: smoke.particles, geometry: steamGeometry, state: smoke.root.userData.effects}, locomotiveBody: world.train.proof.bodyMotion || world.train.proof.inherited?.bodyMotion,
        coachBodies: world.train.proof.coachBodyMotion?.coaches.map(c => c.state)},
      street: {rootPosition: district?.root.position.toArray(), childCount: district?.root.children.length || 0,
        meshIds: [], materials: streetMaterials, cloth, frustumMeshes: null, trainRays: null}};
    handle?.root.traverse(o => { if (o.isMesh) result.street.meshIds.push(o.uuid); });
    if (visual && handle) {
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      let visible = 0; handle.root.traverse(o => { if (o.isMesh && o.visible && frustum.intersectsObject(o)) visible++; });
      result.street.frustumMeshes = visible;
      const origin = camera.getWorldPosition(new THREE.Vector3()), ray = new THREE.Raycaster();
      result.street.trainRays = [[3, 2, 0], [-3.7, 1.6, 0], [-10, 2, 0], [-18, 2, 0]].map(point => {
        const target = new THREE.Vector3(...point).applyMatrix4(world.train.root.matrixWorld), direction = target.clone().sub(origin), distance = direction.length();
        ray.set(origin, direction.normalize()); ray.far = distance - .05;
        const hits = ray.intersectObject(handle.root, true);
        return {trainLocalPoint: point, distance, streetHitsBeforeTrain: hits.length, nearest: hits[0] ? {name: hits[0].object.name, distance: hits[0].distance} : null};
      });
    }
    return result;
  }
  window.__r16Observe = {snapshot, timings: () => ({renderMs: renderMs.slice(), gpuMs: gpuMs.slice(), timerAvailable: !!timer}),
    resetTiming: () => {renderMs.length = 0; gpuMs.length = 0; qa.frameIntervals.length = 0; qa.frameCallbackMs.length = 0; qa.longTasks.length = 0;}};
})();
`;
const fixtureHarness = `
// EXPLICIT COMPARISON FIXTURE. Never part of native-journey evidence.
window.__r16CompareFixture = {
  place() {
    start({line: 'kcr1', seed: 'R16-WEBGL-COMPARE'});
    game.activateStation(1); game.distance = 30; game.velocity = 0; game.throttle = 0;
    game.stopStable = 1; game.elapsed = 20; game.tick = 600; game.phase = 'running';
    setPaused(true); $('pauseScreen').hidden = true;
    draw(game.view(), 1, true); updateHUD(game.view()); needsRender = false;
  },
  sample(n) { const times = []; for (let i = 0; i < n; i++) { const t = performance.now(); draw(game.view(), 1, true); gl.finish(); times.push(performance.now() - t); } return times; }
};
`;

function forbidden(url) {
  const p = new URL(url).pathname;
  return /\/game\/(?:r15\/|city-assets\/)/.test(p) || /\.bin(?:\.gz)?$|\.(?:gltf|glb|obj|fbx|blend|ply)$/i.test(p) || /\/r16\/street\/.*\.(?:png|jpe?g|webp|avif|gif|svg|woff2?|ttf|otf)$/i.test(p);
}
function observe(page, label, expectedScoreFailure = false) {
  page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(60000);
  page.on('console', message => consoleMessages.push({label, type: message.type(), text: message.text(), location: message.location(), expected: expectedScoreFailure && /503|Failed to load resource/.test(message.text())}));
  page.on('pageerror', error => pageErrors.push({label, message: error.message, stack: error.stack}));
  page.on('request', request => { const item = {label, method: request.method(), type: request.resourceType(), url: request.url()}; requests.push(item); if (forbidden(item.url)) prohibitedRequests.push(item); });
  page.on('response', response => { if (response.status() >= 400) responseErrors.push({label, url: response.url(), status: response.status(), expected: expectedScoreFailure && response.status() === 503 && /first-street\.score\.json/.test(response.url())}); });
  page.on('requestfailed', request => requestFailures.push({label, url: request.url(), failure: request.failure(), navigationCancellation: /ERR_ABORTED/.test(request.failure()?.errorText || '')}));
}
async function instrument(page, url = base, fixture = false) {
  const target = new URL('app.mjs', url);
  await page.route(u => u.origin === target.origin && u.pathname === target.pathname, async route => {
    const response = await route.fetch(), original = await response.text(), suffix = observerHarness + (fixture ? fixtureHarness : '');
    write((fixture ? (url === baseline ? 'r14' : 'r16') + '-fixture' : 'native') + '-instrumentation.json', {
      url: target.href, originalSHA256: sha(original), deliveredSHA256: sha(original + suffix), suffixSHA256: sha(suffix),
      fixtureStateWrites: fixture, note: 'Original response preserved byte-for-byte before this test-only appended observer. Route interception disables HTTP cache; cache evidence comes from the separate unrouted cold/warm test.'});
    await route.fulfill({response, body: original + suffix});
  });
}
async function open(page, url = base, version = VERSION) {
  const response = await page.goto(url, {waitUntil: 'load'}); assert(response?.ok(), 'HTTP entry is successful');
  await until(page, () => window.__trainDriver?.ready);
  assert.equal(await page.evaluate(() => __trainDriver.version), version);
}
async function activeStreet(page) {
  await until(page, () => { const s = __trainDriver.getState(); return s.streetDistrict?.active && s.streetDistrict.elapsed === s.elapsed; });
}
async function inspect(page, visual = false) { return page.evaluate(v => __r16Observe.snapshot(v), visual); }
function streetAssertions(s) {
  assert.equal(s.worldMode, 'flat'); assert.equal(s.proof.addedCoaches, 2); assert.equal(s.proof.coachBodyMotion.coaches.length, 2);
  assert.equal(s.streetDistrict.version, 'r16-kst1'); assert.equal(s.streetDistrict.externalMesh, false); assert.equal(s.streetDistrict.externalImageTextures, false);
  assert.equal(s.streetDistrict.clock, 'Session.view.elapsed'); assert(s.drawCalls > 0 && s.triangles > 0);
  if (s.streetDistrict.active) {
    assert.equal(s.streetDistrict.elapsed, s.elapsed); assert(s.streetDistrict.metrics.instances > 500);
    assert(s.streetDistrict.metrics.expandedTriangles <= 180000); assert.equal(s.streetDistrict.metrics.textures, 0);
  }
}
async function shot(page, name, kind = 'native-ui-production-clock', visual = true) {
  const report = await page.evaluate(v => window.__r16Observe ? __r16Observe.snapshot(v) : {state: __trainDriver.getState()}, visual);
  const png = await page.screenshot({path: path.join(out, name + '.png'), timeout: 60000});
  assert(png.length > 12000, 'Screenshot is nontrivial: ' + name);
  const result = {name, evidenceKind: kind, fixtureStateWrites: kind.includes('fixture'), viewport: page.viewportSize(), pngBytes: png.length, sha256: sha(png), ...report};
  write(name + '.json', result);
  if (report.renderer) { assert(report.renderer.programs.every(p => p.linked), 'Every actual WebGL program links: ' + name); assert.deepEqual(report.shaderFailures, [], 'No captured shader failures: ' + name); assert.equal(report.threeRevision, '170'); }
  return result;
}
async function camera(page, id, touch = false) {
  const paused = (await state(page)).paused;
  await clickTarget(page, '#openCameraMenu', {touch}); await clickTarget(page, `[data-camera="${id}"]`, {touch});
  await until(page, id => __trainDriver.getState().cameraMode === id && document.getElementById('settingsScreen').hidden, id);
  assert.equal((await state(page)).paused, paused); await page.waitForTimeout(250);
}
async function inputLatency(page, name, action, expected) {
  const start = performance.now(); await action(); await until(page, expected, null, {polling: 25});
  return {name, observedRoundTripMs: performance.now() - start, boundary: 'Node→trusted input→observable browser state; includes automation transport and polling, not photon latency'};
}
async function runCase(browser, name, test, options = {}) {
  const started = performance.now(); let context, page;
  try {
    context = await browser.newContext({viewport: VIEWPORT, deviceScaleFactor: 1, hasTouch: true});
    await context.addInitScript(initObservation, {storage: options.storage ? oldStorage : null});
    page = await context.newPage(); observe(page, name, options.expectedScoreFailure);
    const result = await test(page, context);
    checks.push({name, pass: true, wallMs: performance.now() - started, result});
    write(name + '-result.json', checks.at(-1)); console.log('PASS ' + name);
  } catch (error) {
    const failure = {name, pass: false, wallMs: performance.now() - started, error: String(error), stack: error.stack};
    if (page) {
      failure.state = await state(page).catch(() => null);
      failure.observer = await inspect(page).catch(() => null);
      await page.screenshot({path: path.join(out, name + '-failure.png'), timeout: 30000}).catch(e => { failure.screenshotError = String(e); });
      failure.inputs = await page.evaluate(() => window.__r16QA).catch(() => null);
    }
    failures.push(failure); write(name + '-failure.json', failure); console.error(name + ': ' + error);
  } finally {
    if (context) await context.close().catch(() => {});
    write('progress.json', {checks, failures, pageErrors, prohibitedRequests});
  }
}

async function coldWarm(page, context) {
  // No Playwright routes: retain the browser's actual HTTP cache behavior.
  const closure = JSON.parse(fs.readFileSync(path.join(__dirname, '../evidence/load-closure.json'), 'utf8'));
  const expected = new Map([...closure.modules, ...closure.assets].filter(x => x.sha256).map(x => [new URL(x.path, study).href, x]));
  const entries = [], pending = [], sourceProof = {}, cdp = await context.newCDPSession(page);
  let stage = 'cold';
  await cdp.send('Network.enable');
  const byId = new Map();
  cdp.on('Network.responseReceived', e => { const record = {stage, requestId: e.requestId, url: e.response.url, status: e.response.status,
    fromDiskCache: !!e.response.fromDiskCache, fromServiceWorker: !!e.response.fromServiceWorker, mimeType: e.response.mimeType,
    headers: {contentEncoding: e.response.headers['Content-Encoding'] || e.response.headers['content-encoding'] || null,
      cacheControl: e.response.headers['Cache-Control'] || e.response.headers['cache-control'] || null}};
    entries.push(record); byId.set(e.requestId, record); });
  cdp.on('Network.requestServedFromCache', e => { const r = byId.get(e.requestId); if (r) r.servedFromCache = true; });
  cdp.on('Network.loadingFinished', e => { const r = byId.get(e.requestId); if (r) r.chromiumEncodedDataLength = e.encodedDataLength; });
  page.on('response', response => {
    let key = response.url(); if (key === base) key = new URL('index.html', base).href;
    if (!expected.has(key)) return;
    const entryStage = stage;
    pending.push(response.body().then(body => {
      const target = expected.get(key), actual = sha(body);
      sourceProof[entryStage + ':' + target.path] = {path: target.path, bytes: body.length, actualSHA256: actual, expectedSHA256: target.sha256, match: actual === target.sha256};
    }).catch(e => { sourceProof[entryStage + ':' + key] = {bodyReadError: String(e)}; }));
  });
  await open(page); await activeStreet(page); await page.waitForTimeout(200);
  const cold = await shot(page, '01-cold-unmodified-first-frame', 'unmodified-production-entry', false);
  await Promise.all(pending); const coldResources = await page.evaluate(() => ({navigation: performance.getEntriesByType('navigation').map(e => e.toJSON()), resources: performance.getEntriesByType('resource').map(e => e.toJSON()), qa: __r16QA}));
  stage = 'warm'; await page.reload({waitUntil: 'load'}); await until(page, () => window.__trainDriver?.ready); await activeStreet(page); await page.waitForTimeout(200);
  const warm = await shot(page, '02-warm-unmodified-first-frame', 'unmodified-production-entry', false);
  await Promise.all(pending); const warmResources = await page.evaluate(() => ({navigation: performance.getEntriesByType('navigation').map(e => e.toJSON()), resources: performance.getEntriesByType('resource').map(e => e.toJSON()), qa: __r16QA}));
  const report = {sourceProof, entries, coldResources, warmResources, cold: cold.state, warm: warm.state,
    encodingBoundary: 'CDP encodedDataLength is Chromium-reported transferred bytes, including protocol overhead where Chromium reports it. ResourceTiming encodedBodySize/decodedBodySize are reported separately. If Content-Encoding is absent, no gzip/Brotli saving is claimed. Cache reuse depends on the server headers and is measured, not assumed.'};
  write('cold-warm-network-and-source-hashes.json', report);
  for (const target of expected.values()) {
    const item = sourceProof['cold:' + target.path]; assert(item, 'Loaded closure resource captured: ' + target.path); assert.equal(item.match, true, 'Candidate hash matches frozen closure: ' + target.path);
  }
  const engines = requests.filter(r => r.label === 'cold-warm' && /three(?:\.module)?\.js/.test(r.url));
  assert.equal(new Set(engines.map(r => r.url)).size, 1, 'One shared Three module URL');
  assert.equal(cold.state.proof.addedCoaches, 2); assert.equal(warm.state.proof.addedCoaches, 2);
  assert.deepEqual(coldResources.qa.shaderFailures, []); assert.deepEqual(warmResources.qa.shaderFailures, []);
  return report;
}

async function nativeJourney(page) {
  await instrument(page); await open(page); await activeStreet(page);
  const input = [], startedAt = performance.now();
  await clickTarget(page, '#startGame'); await until(page, () => __trainDriver.getState().station.canOpen);
  await clickTarget(page, '#stationAction');
  await until(page, () => ['doors-opening', 'unloading', 'boarding'].includes(__trainDriver.getState().phase));
  assert(await page.locator('#accelerate').isDisabled(), 'Real door interlock disables throttle');
  await until(page, () => __trainDriver.getState().phase === 'ready-depart', null, {timeout: 90000});
  const served = await state(page); assert.equal(served.stats.stops, 1); assert.equal(served.audio.unlocked, true);
  await clickTarget(page, '#stationAction'); await until(page, () => __trainDriver.getState().phase === 'running');
  // Actual trusted keyboard and button controls; close-doors may already apply notch 1.
  while ((await state(page)).throttle > 0) await clickTarget(page, '#decelerate');
  input.push(await inputLatency(page, 'keyboard throttle W', () => page.keyboard.press('w'), () => __trainDriver.getState().throttle === 1));
  await page.keyboard.press('s'); await until(page, () => __trainDriver.getState().throttle === 0);
  for (let i = 0; i < 3; i++) await clickTarget(page, '#accelerate');
  await until(page, () => { const s = __trainDriver.getState(); return s.distance + s.velocity * s.velocity / (2 * 3.10) >= 30; }, null, {polling: 25});
  const brake = await controlGeometry(page.locator('#brake')); assertControlGeometry(brake);
  await page.mouse.move(brake.x, brake.y); await page.mouse.down();
  await until(page, () => __trainDriver.getState().brake); await until(page, () => __trainDriver.getState().velocity === 0);
  await page.mouse.up(); await until(page, () => !__trainDriver.getState().brake);
  const stopped = await state(page); assert(stopped.distance >= 20 && stopped.distance <= 65, 'Native braking stops in the near-street interval: ' + stopped.distance);
  assert.equal(stopped.throttle, 0); await activeStreet(page); streetAssertions(await state(page));
  const shots = [];
  for (const id of ['platform', 'overview', 'city']) {
    await camera(page, id); const evidence = await shot(page, '03-native-landscape-' + id);
    assert(evidence.street.frustumMeshes > 0, 'Street meshes intersect actual camera frustum');
    if (id === 'overview') assert(evidence.street.trainRays.every(r => r.streetHitsBeforeTrain === 0), 'Street does not cover the four overview train landmarks');
    shots.push({name: evidence.name, sha256: evidence.sha256, distance: evidence.state.distance, frustumMeshes: evidence.street.frustumMeshes});
  }
  // Portrait is the SAME genuine live journey, with native touch controls.
  await page.setViewportSize({width: 390, height: 844}); await clickControl(page, 'portraitView', {touch: true}); await camera(page, 'city', true);
  const portraitGeometry = {};
  for (const id of ['pause', 'accelerate', 'decelerate', 'brake', 'openCameraMenu', 'openSettings']) {
    const g = await controlGeometry(page.locator('#' + id)); assertControlGeometry(g); assert(g.width >= 44 && g.height >= 44, id + ' touch target'); portraitGeometry[id] = g;
  }
  const portrait = await shot(page, '04-native-portrait-city'); assert(portrait.street.frustumMeshes > 0);
  await clickTarget(page, '#accelerate', {touch: true}); await clickTarget(page, '#decelerate', {touch: true});
  await page.setViewportSize(VIEWPORT); await clickControl(page, 'landscapeView'); await camera(page, 'city');
  // Shared-clock freeze checks include actual cloth vertices and actor/body state.
  input.push(await inputLatency(page, 'pause button', () => clickTarget(page, '#pause'), () => __trainDriver.getState().paused));
  await page.waitForTimeout(300); const paused = await inspect(page);
  await page.waitForTimeout(700); const still = await inspect(page);
  assert.equal(still.state.tick, paused.state.tick); assert.equal(still.state.elapsed, paused.state.elapsed); assert.equal(still.state.streetDistrict.elapsed, paused.state.streetDistrict.elapsed);
  assert.deepEqual(still.motion, paused.motion, 'Cloth, people, steam and train bodies freeze together');
  await clickTarget(page, '#resume'); await until(page, t => __trainDriver.getState().elapsed > t, paused.state.elapsed); await activeStreet(page);
  const resumed = await inspect(page); write('native-pause-resume.json', {paused, still, resumed}); assert.notDeepEqual(resumed.motion.cloth, paused.motion.cloth, 'Cloth resumes with Session elapsed');
  // Menus pause without interpreting drive shortcuts. Escape restores prior state.
  await clickTarget(page, '#openSettings'); const menu = await state(page);
  await page.keyboard.press('w'); await page.keyboard.press('e'); await page.keyboard.press('p');
  assert.equal((await state(page)).tick, menu.tick); assert.equal((await state(page)).throttle, menu.throttle);
  await clickTarget(page, '#soundToggle'); await clickTarget(page, '#soundToggle');
  await page.keyboard.press('Escape'); await page.locator('#settingsScreen').waitFor({state: 'hidden'}); assert.equal((await state(page)).paused, false);
  await clickTarget(page, '#openSettings'); await clickTarget(page, '#closeSettings'); assert.equal((await state(page)).paused, false);
  await clickTarget(page, '#whistle');
  // Six seconds minimum of actual advancing game, as an inspectable PNG sequence.
  await page.evaluate(() => __r16Observe.resetTiming()); await clickTarget(page, '#accelerate');
  const motion = [], motionStart = performance.now();
  for (let i = 0; i < 7; i++) {
    if (i) await page.waitForTimeout(1000);
    const f = await shot(page, '05-motion-' + String(i).padStart(2, '0'), 'native-ui-production-clock', false);
    motion.push({file: f.name + '.png', sha256: f.sha256, capturedAfterMs: performance.now() - motionStart, state: f.state, motion: f.motion,
      rootPosition: f.street.rootPosition, meshIds: f.street.meshIds, materials: f.street.materials});
    streetAssertions(f.state); assert(f.motion.cloth.every(c => c.pinMaxError < 1e-7), 'Cloth pins stay on authored positions');
    for (const material of f.street.materials) {
      assert.deepEqual(material.worldOffset, f.street.rootPosition, 'Weather shader local anchor follows street origin exactly');
      assert.equal(material.time, f.state.elapsed, 'Shader clock is Session elapsed, not timetable minutes');
    }
  }
  assert(motion.at(-1).capturedAfterMs >= 6000); assert(motion.at(-1).state.distance > motion[0].state.distance);
  assert(new Set(motion.map(f => f.sha256)).size > 1); assert(new Set(motion.map(f => JSON.stringify(f.motion.cloth))).size > 1);
  for (const f of motion) { assert.deepEqual(f.meshIds, motion[0].meshIds, 'Street meshes do not switch with camera-side/clock'); assert.deepEqual(f.materials.map(m => m.config), motion[0].materials.map(m => m.config), 'Material weather configuration remains anchored'); }
  const timing = await inspect(page); write('native-motion-sequence.json', {kind: 'native-ui-production-clock', fixtureStateWrites: false, durationMs: performance.now() - motionStart, frames: motion, timing: timing.timing});
  // Three actual unload→UI restart→re-entry cycles. Later runs deliberately drive
  // away without serving the first station; no teleport or accelerated clock.
  await camera(page, 'overview');
  const cycles = [], recipeMetrics = (await state(page)).streetDistrict.metrics;
  for (let cycle = 0; cycle < 3; cycle++) {
    while ((await state(page)).throttle < 3) await clickTarget(page, '#accelerate');
    const before = await inspect(page), mark = performance.now();
    await until(page, () => { const s = __trainDriver.getState(), p = s.streetDistrict.placement; return s.distance > s.routeStations[0].target + p.offset + p.unloadRadius && !s.streetDistrict.active; }, null, {timeout: 120000});
    await clickTarget(page, '#pause'); await page.waitForTimeout(150);
    const unloaded = await inspect(page);
    assert.equal(unloaded.state.streetDistrict.unloadCount, before.state.streetDistrict.unloadCount + 1);
    assert.equal(unloaded.street.childCount, 0);
    const disposal = unloaded.disposals.at(-1); assert(disposal, 'Disposal observation attached to actual street resources');
    assert.equal(disposal.duplicates, 0); assert(disposal.expected.instancedMesh > 0);
    for (const kind of ['geometry', 'material', 'instancedMesh']) assert.equal(disposal.events[kind], disposal.expected[kind], kind + ' receives exactly one dispose event');
    assert.deepEqual(unloaded.state.streetDistrict.liveResources, {geometries: 0, materials: 0});
    const oldLoads = unloaded.state.streetDistrict.loadCount;
    await clickTarget(page, '#restartPaused'); await activeStreet(page); await page.waitForTimeout(150);
    const reentered = await inspect(page);
    assert.equal(reentered.state.streetDistrict.loadCount, oldLoads + 1); assert(reentered.state.distance < 5); assert.equal(reentered.state.seed, served.seed);
    for (const key of ['meshes', 'instances', 'geometries', 'materials', 'expandedTriangles', 'textures']) assert.equal(reentered.state.streetDistrict.metrics[key], recipeMetrics[key], 'Identical recipe after re-entry: ' + key);
    assert(unloaded.renderer.memory.geometries < reentered.renderer.memory.geometries, 'Actual renderer geometry allocation drops when street is released');
    cycles.push({cycle: cycle + 1, wallMs: performance.now() - mark, before, unloaded, reentered}); write('native-lifecycle-cycles.json', cycles);
  }
  const unloaded = cycles.map(c => c.unloaded), restarted = cycles.map(c => c.reentered), plateau = {};
  for (const [label, values, slack] of [
    ['rendererGeometries', unloaded.map(x => x.renderer.memory.geometries), 4],
    ['rendererTextures', unloaded.map(x => x.renderer.memory.textures), 2],
    ['rendererPrograms', unloaded.map(x => x.renderer.programs.length), 4],
    ['driverBuffers', unloaded.map(x => x.gl[0].resources.Buffer.live), 8],
    ['driverBufferBytes', unloaded.map(x => x.gl[0].liveBufferBytes), 65536],
    ['reenteredGeometries', restarted.map(x => x.renderer.memory.geometries), 4],
    ['reenteredTextures', restarted.map(x => x.renderer.memory.textures), 2],
    ['reenteredPrograms', restarted.map(x => x.renderer.programs.length), 4],
    ['reenteredBuffers', restarted.map(x => x.gl[0].resources.Buffer.live), 8]]) {
    plateau[label] = {values, slack, maxGrowth: Math.max(...values) - values[0]};
    assert(plateau[label].maxGrowth <= slack, 'Resources plateau after three genuine releases: ' + JSON.stringify(plateau[label]));
  }
  // Preserve and assert trusted inputs before navigation creates a new document.
  const preReloadEvents = await page.evaluate(() => __r16QA.events);
  for (const id of ['startGame', 'stationAction', 'accelerate', 'decelerate', 'brake', 'pause', 'openCameraMenu', 'restartPaused']) assert(preReloadEvents.some(e => e.id === id && e.trusted && ['pointerdown', 'click'].includes(e.type)), 'Trusted native input: ' + id);
  assert(preReloadEvents.some(e => e.trusted && e.type === 'keydown' && e.key === 'w'));
  assert(preReloadEvents.some(e => e.trusted && e.pointerType === 'touch'));
  write('native-input-events-before-reload.json', preReloadEvents);
  // Reload and native saved-game continuation; no injected replay/state writes.
  await clickTarget(page, '#pause'); const beforeReload = await state(page); await page.reload({waitUntil: 'load'}); await until(page, () => window.__trainDriver?.ready); await activeStreet(page);
  assert(await page.locator('#continueSaved').isVisible()); await clickTarget(page, '#continueSaved'); await until(page, () => __trainDriver.getState().started);
  assert.equal((await state(page)).seed, beforeReload.seed); assert((await state(page)).tick >= beforeReload.tick);
  const restored = await shot(page, '06-native-reload-continued');
  const storage = await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(oldStorage)); assert.deepEqual(storage, oldStorage, 'R14 save, view and quality storage remains byte-for-byte unchanged');
  const events = await page.evaluate(() => __r16QA.events);
  const report = {kind: 'native-ui-production-clock', fixtureStateWrites: false, wallMs: performance.now() - startedAt, served, stopped, shots,
    portraitGeometry, pause: {paused, still, resumed}, inputLatency: input, cycles, plateau, continued: restored.state, storage, events, preReloadEvents,
    performance: {renderSubmissionMs: stats(timing.timing.renderSubmitMs), animationCallbackMs: stats(timing.timing.frameCallbackMs), frameIntervalMs: stats(timing.timing.frameIntervals), gpuFrameMs: stats(timing.timing.gpuFrameMs), timerAvailable: timing.timing.timerAvailable},
    limitations: ['Viewport emulation is not a physical phone test.', 'Resource counts are instrumented driver/renderer object accounting, not exact device VRAM. Observer wrappers and timer queries add overhead, so timings are instrumented diagnostic measurements.', 'Pixel sequence requires independent visual review for glyph quality, wetness, support placement and grass coverage.']};
  return report;
}

async function delayedScore(page) {
  let release, intercepted;
  const held = new Promise(resolve => { release = resolve; }), requested = new Promise(resolve => { intercepted = resolve; });
  const target = new URL('street/first-street.score.json', base).href;
  await page.route(target, async route => { intercepted(); await held; await route.continue(); });
  await instrument(page);
  // DOMContentLoaded avoids waiting on a deliberately held fetch.
  await page.goto(base, {waitUntil: 'domcontentloaded'}); await until(page, () => window.__trainDriver?.ready); await requested;
  await clickTarget(page, '#startGame'); await clickTarget(page, '#pause'); const paused = await state(page);
  assert.equal(paused.streetDistrict.status, 'score-loading'); release(); await activeStreet(page);
  const loaded = await inspect(page); assert.equal(loaded.state.paused, true); assert.equal(loaded.state.elapsed, paused.elapsed); assert.equal(loaded.state.streetDistrict.elapsed, paused.elapsed);
  await clickTarget(page, '#resume'); await clickTarget(page, '#accelerate'); await until(page, () => __trainDriver.getState().distance > 0);
  const evidence = await shot(page, '07-score-delayed-pause-resume'); return {paused, loaded, resumed: evidence.state, kind: 'network-interruption-fixture-with-native-controls', fixtureStateWrites: false};
}
async function scoreFailure(page) {
  await page.route(new URL('street/first-street.score.json', base).href, route => route.fulfill({status: 503, contentType: 'text/plain', body: 'Intentional R16 acceptance score-load failure'}));
  await instrument(page); await open(page); await until(page, () => __trainDriver.getState().streetDistrict?.status === 'error');
  await clickTarget(page, '#startGame'); await clickTarget(page, '#accelerate'); await until(page, () => __trainDriver.getState().distance > 1);
  await page.keyboard.press('p'); assert.equal((await state(page)).paused, true); await clickTarget(page, '#resume'); await camera(page, 'overview');
  const evidence = await shot(page, '08-score-failure-original-train-usable', 'network-failure-fixture-with-native-controls', false);
  assert.equal(evidence.state.proof.addedCoaches, 2); assert.equal(evidence.state.streetDistrict.active, false); assert(evidence.state.drawCalls > 0);
  return {intentionalStatus: 503, fixtureStateWrites: false, originalTrainControlsUsable: true, state: evidence.state};
}
async function contextRecovery(page) {
  await instrument(page); await open(page); await activeStreet(page); await clickTarget(page, '#startGame');
  const supported = await page.evaluate(() => {
    const gl = document.getElementById('gameScene').getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) return false; window.__r16RestoreContext = () => extension.restoreContext(); extension.loseContext(); return true;
  });
  if (!supported) return {supported: false, tested: false, reason: 'WEBGL_lose_context is unavailable; no synthetic event substituted'};
  await until(page, () => __trainDriver.getState().paused && __r16QA.contextEvents.some(e => e.type === 'webglcontextlost'));
  const lost = await state(page); await page.waitForTimeout(250); await page.evaluate(() => __r16RestoreContext());
  await until(page, () => __r16QA.contextEvents.some(e => e.type === 'webglcontextrestored'), null, {timeout: 30000});
  await until(page, () => document.getElementById('loading').hidden); // production restoration hides interruption notice
  await clickTarget(page, '#resume'); await clickTarget(page, '#accelerate'); await until(page, t => __trainDriver.getState().elapsed > t, lost.elapsed);
  const restored = await shot(page, '09-webgl-context-restored'); assert.equal(restored.contextLost, false); assert(restored.renderer.programs.every(p => p.linked));
  return {supported: true, lost, restored: restored.state, events: await page.evaluate(() => __r16QA.contextEvents)};
}
async function comparison(page, which) {
  const url = which === 'r14' ? baseline : base;
  await instrument(page, url, true); await open(page, url, which === 'r14' ? 'kcr-hud-r14' : VERSION);
  if (which === 'r16') await activeStreet(page);
  await page.evaluate(() => __r16CompareFixture.place()); await camera(page, 'overview');
  // Comparison deliberately hides only the pause overlay in its own fixture.
  await page.evaluate(() => { document.getElementById('pauseScreen').hidden = true; });
  await page.evaluate(() => __r16CompareFixture.sample(3)); await page.evaluate(() => __r16Observe.resetTiming());
  const synchronousFrameMs = await page.evaluate(() => __r16CompareFixture.sample(12));
  const evidence = await shot(page, '10-comparison-' + which, 'deterministic-placement-comparison-fixture');
  if (which === 'r14') assert.equal(evidence.state.streetDistrict, undefined, 'Preserved R14 has no street injected');
  assert.equal(evidence.state.distance, 30); assert.equal(evidence.state.elapsed, 20); assert.equal(evidence.state.proof.addedCoaches, 2);
  const report = {fixtureStateWrites: true, fixture: 'Exact seed R16-WEBGL-COMPARE, distance 30m, elapsed 20s, zero velocity, paused, overview preset, 1280×720 CSS, DPR1, clear default. Fixture is not native driving.',
    rendererName: evidence.state.rendererName, canvasPixels: evidence.state.canvasPixels, qualityMode: evidence.state.qualityMode,
    synchronousRenderAndFinishMs: stats(synchronousFrameMs), renderer: evidence.renderer, timing: evidence.timing,
    gpuFrameMs: stats(evidence.timing.gpuFrameMs), limitation: 'draw()+gl.finish() measures CPU and real SwiftShader completion together, not isolated GPU time. GPU timer samples, when available, are separate.'};
  write('comparison-' + which + '.json', report); return report;
}

(async () => {
  let browser;
  try {
    // Exactly one launch. No retry, alternate executable, or sandbox fallback.
    browser = await chromium.launch({headless: true, args});
    await runCase(browser, 'cold-warm', coldWarm);
    await runCase(browser, 'native-journey', nativeJourney, {storage: true});
    await runCase(browser, 'delayed-score', delayedScore);
    await runCase(browser, 'score-failure', scoreFailure, {expectedScoreFailure: true});
    await runCase(browser, 'context-recovery', contextRecovery);
    await runCase(browser, 'comparison-r14', page => comparison(page, 'r14'));
    await runCase(browser, 'comparison-r16', page => comparison(page, 'r16'));
  } catch (error) { failures.push({name: 'launch-or-runner', error: String(error), stack: error.stack}); }
  finally {
    const browserVersion = browser ? await browser.version() : null;
    if (browser) await browser.close().catch(() => {});
    const unexpectedConsole = consoleMessages.filter(m => m.type === 'error' && !m.expected);
    const shaderConsole = consoleMessages.filter(m => /VALIDATE_STATUS|shader error|shader.*compil|program.*link.*fail|THREE.WebGLProgram.*Error/i.test(m.text));
    const unexpectedHTTP = responseErrors.filter(r => !r.expected), unexpectedNetwork = requestFailures.filter(r => !r.navigationCancellation);
    const pass = failures.length === 0 && pageErrors.length === 0 && unexpectedConsole.length === 0 && shaderConsole.length === 0 && unexpectedHTTP.length === 0 && unexpectedNetwork.length === 0 && prohibitedRequests.length === 0;
    let nodeCPUReport = null; try { nodeCPUReport = JSON.parse(fs.readFileSync(path.join(__dirname, '../evidence/street-costs.json'), 'utf8')); } catch {}
    const report = {pass, base, baseline, commit: process.env.GITHUB_SHA || null, browserVersion, playwright: require('playwright/package.json').version, launchArgs: args,
      environment: {os: process.platform, architecture: process.arch, softwareRasterizer: 'ANGLE SwiftShader requested explicitly; inspect rendererName in every capture for verification', physicalDeviceTest: false},
      evidenceBoundary: 'Cold/warm is unmodified production network. Native journey uses trusted inputs and production time with read-only observation. Score/network and context interruptions are explicit fixtures. R14/R16 comparison alone uses deterministic state placement. No R15 entry/assets requested. Functional pass does not constitute an independent artistic/film-quality approval.',
      wallMs: performance.now() - launchStarted,
      costs: {runnerNodeCPU: process.cpuUsage(runnerCPU), runnerNodeCPUBoundary: 'Only the Node automation process CPU; excludes Chromium and SwiftShader.', existingNodeGeometryReport: nodeCPUReport,
        browserBoundary: 'Actual browser renderer, driver resource counts, frame/callback/render durations and optional GPU query samples are in each case. Generated mesh bytes are not a browser GPU-performance measure. First-load parse/build/upload are not independently isolated; navigation timings and first render after each lifecycle transition are recorded.'},
      checks, failures, consoleMessages, pageErrors, responseErrors, requestFailures, prohibitedRequests, requests,
      gates: {noPageErrors: !pageErrors.length, noUnexpectedConsoleErrors: !unexpectedConsole.length, noShaderErrors: !shaderConsole.length,
        noUnexpectedHTTP: !unexpectedHTTP.length, noUnexpectedNetwork: !unexpectedNetwork.length, noProhibitedAssets: !prohibitedRequests.length},
      remainingVisualReview: ['Traditional glyph holes and stroke ends', 'Facade depth, cages and interior occlusion', 'Per-tenant sign ages and rain/repair correlation', 'Brick/mortar scale and wet roughness', 'No grass covering street ground', 'Support beams do not cut important lettering', 'No temporal shader mask swim or view-side popping']};
    write('result.json', report); write('console.json', consoleMessages); write('network.json', {requests, responseErrors, requestFailures, prohibitedRequests});
    console.log('R16 WebGL acceptance: ' + (pass ? 'PASS' : 'FAIL') + ' — ' + out);
    if (!pass) process.exitCode = 1;
  }
})();
