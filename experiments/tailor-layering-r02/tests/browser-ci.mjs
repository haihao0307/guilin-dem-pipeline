// Real browser acceptance. This file intentionally refuses to launch a browser
// in the current interactive workspace; GitHub Actions is the execution host.
// Controls drive the actual app. Read-only Worker observation and independent
// triangle checks inspect its exact input/output; no substitute geometry is used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inflateSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { installClothObserver, readClothObservation, waitForClothIdle } from './cloth-observer.mjs';
import { runContinuousInterval, runRemovalCycles } from './scenarios-r02.mjs';
import { auditObservedGeometry, assertNoObservedCrossings } from './observed-geometry.mjs';
import { verifyReferenceBodyLoading } from './reference-body-observation.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EVIDENCE = path.join(ROOT, 'evidence');
const BASE = 'http://127.0.0.1:8765/';
const SCENARIO = process.env.LAYERING_CI_SCENARIO || 'all';
const READY_TIMEOUT_MS = 480_000;
const LOCATOR_TIMEOUT_MS = 120_000;
const GPU_IDLE_TIMEOUT_MS = 180_000;
// Current native physics takes about 7–12 wall seconds per 1/120 s step.
// Keep every requested step and the original render quality; the full physics
// scenarios need runner/GPU contention and evidence-writing time as well.
// Display-only acceptance retains its original 20-minute watchdog.
const BROWSER_BUDGET_MS = SCENARIO === 'display' ? 1_200_000 : 7_200_000;
const SCREENSHOT_TIMEOUT_MS = 180_000;
const CONTINUOUS_SECONDS = 2;
const DYNAMIC_LIMITS = {maxEdgeStretch: 1.45, seamGapMM: .01, contactResidualM: .0005,
  bodyHalfThicknessOverlapMM: .001};
const PROGRESS_PREFIX = 'KAOPU_CI_OBSERVATION ';
const EXPECTED = {
  inner: { preset: 'T08', material: 'knit-fine-0' },
  outer: { preset: 'T03', material: 'knit-soft-0' },
  pants: { preset: 'P02', material: 'denim-raw' },
};
const began = Date.now();
const observations = [];
const consoleMessages = [];
const pageErrors = [];
const requests = [];
const forbiddenRequests = [];
const progressEvents = [];
let browser, context, page, watchdog, heartbeat, nativeWorldInput;
let failure = null;
let phase = 'setup', lastDOMObservation = null, lastDOMObservedAt = null;
let evidenceWrites = Promise.resolve();
const summary = {
  schema: 'kaopu-real-webgl-acceptance@2',
  startedUTC: new Date().toISOString(),
  scenario: SCENARIO,
  suiteScope: process.env.LAYERING_CI_SCOPE || 'unspecified',
  requiredReleaseMatrixMember: process.env.LAYERING_CI_SCOPE === 'full',
  requiresAllOtherReleaseJobs: true,
  scenariosCompleted: [],
  passed: false,
  execution: 'GitHub Actions, fresh Playwright Chromium context, software WebGL',
  publicationPerformed: false,
  screenshotsAreBrowserCaptures: true,
  budgetsMS: { ready: READY_TIMEOUT_MS, locator: LOCATOR_TIMEOUT_MS, GPUIdle: GPU_IDLE_TIMEOUT_MS,
    browser: BROWSER_BUDGET_MS, screenshot: SCREENSHOT_TIMEOUT_MS },
  viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  dynamicLimits: {...DYNAMIC_LIMITS, stretchPhase: 'Completed dynamic steps; initial placement stretch is recorded separately'},
  geometryChecks: [],
  limitations: [
    'This checks the fixed native person, two retained tops and retained P02 shorts.',
    'Selected actual middle-surface snapshots receive an independent complete triangle-pair check; times between snapshots, self-intersections and individual yarns are not certified.',
    'Published thickness residuals and full body vertex-distance audits complement surface crossing tests; they do not certify complete continuous collision.',
    'No real-time speed threshold, calibrated friction claim or arbitrary-motion guarantee is made.',
    'Performance comparison preserves geometry and sampling; its small same-session timings are observations, not a cross-device benchmark.',
  ],
};

function appendProgress(value) {
  const event = { observedUTC: new Date().toISOString(), wallMS: Date.now() - began, ...value };
  progressEvents.push(event);
  // Incremental evidence survives a blocked renderer or a later job timeout.
  // Only public DOM/performance observations and local request URLs are saved.
  evidenceWrites = evidenceWrites.then(() => fs.appendFile(path.join(EVIDENCE, 'browser-progress.ndjson'), JSON.stringify(event) + '\n'))
    .catch(error => { failure ??= error; });
}

function markPhase(value) {
  phase = value;
  appendProgress({ kind: 'test-phase', phase });
}

async function installProgressObserver() {
  await context.addInitScript(({ prefix }) => {
    let lastEmission = -Infinity;
    const emit = value => console.debug(prefix + JSON.stringify(value));
    function observeDOM(reason) {
      const now = performance.now();
      if (reason !== 'heartbeat' && now - lastEmission < 2000) return;
      const app = document.getElementById('layer-app');
      if (!app) return;
      lastEmission = now;
      let diagnostic = null;
      try { diagnostic = JSON.parse(app.querySelector('#diagnostics')?.textContent || 'null'); } catch {}
      const canvas = app.querySelector('#layer-stage canvas');
      emit({ kind: 'public-dom', reason, browserMS: now,
        ready: app.dataset.ready || null, status: app.dataset.status || null,
        loadText: app.querySelector('#load-text')?.textContent || null,
        statusText: app.querySelector('#layer-status')?.textContent || null,
        loadingHiddenAttribute: app.querySelector('#layer-loading')?.hidden ?? null,
        canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
        garmentIDs: diagnostic?.dynamicGarments?.map(row => row.id) || [],
        physicsSteps: diagnostic?.physics?.completedSteps ?? null,
        render: diagnostic?.render || null,
        bootTimings: diagnostic?.bootTimings || null,
        error: diagnostic?.error || null,
      });
    }
    // Observe published UI only. No application methods, geometry, WebGL state,
    // solver inputs or readiness flags are modified by this diagnostic probe.
    new MutationObserver(() => observeDOM('mutation')).observe(document, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['data-ready', 'data-status'],
    });
    setInterval(() => observeDOM('heartbeat'), 5000);
    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      new PerformanceObserver(list => {
        const entries = list.getEntries().filter(entry => entry.duration >= 250)
          .map(entry => ({ startMS: entry.startTime, durationMS: entry.duration, name: entry.name }));
        if (entries.length) emit({ kind: 'completed-longtasks', browserMS: performance.now(), entries });
      }).observe({ type: 'longtask', buffered: true });
    }
  }, { prefix: PROGRESS_PREFIX });
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Decode the browser's lossless PNG solely to measure its captured pixels.
// This function does not create, repaint or substitute any screenshot.
function decodePNG(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Browser screenshot must be a PNG');
  const pieces = [];
  let width, height, depth, color, interlace;
  for (let at = 8; at + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(at), type = buffer.toString('ascii', at + 4, at + 8);
    assert.ok(at + 12 + length <= buffer.length, 'Truncated screenshot PNG');
    const data = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
    }
    if (type === 'IDAT') pieces.push(data);
    at += length + 12;
    if (type === 'IEND') break;
  }
  assert.equal(depth, 8, 'Expected the browser screenshot in 8-bit format');
  assert.equal(interlace, 0, 'Expected non-interlaced browser screenshot');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[color];
  assert.ok(channels, `Unsupported screenshot PNG color type ${color}`);
  const stride = width * channels, raw = inflateSync(Buffer.concat(pieces));
  assert.equal(raw.length, (stride + 1) * height, 'Unexpected screenshot PNG scanline length');
  const decoded = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4, 'Unexpected screenshot PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const left = x >= channels ? decoded[i - channels] : 0;
      const up = y ? decoded[i - stride] : 0;
      const upperLeft = y && x >= channels ? decoded[i - stride - channels] : 0;
      const correction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up
        : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      decoded[i] = (raw[y * (stride + 1) + x + 1] + correction) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < decoded.length; i += channels, p += 4) {
    const gray = color === 0 || color === 4;
    rgba[p] = decoded[i]; rgba[p + 1] = decoded[i + (gray ? 0 : 1)]; rgba[p + 2] = decoded[i + (gray ? 0 : 2)];
    rgba[p + 3] = color === 6 ? decoded[i + 3] : color === 4 ? decoded[i + 1] : 255;
  }
  return { width, height, rgba };
}

function pixelStats(image) {
  const bins = new Set(), sums = [0, 0, 0], squares = [0, 0, 0];
  let opaque = 0, chromatic = 0, edges = 0;
  for (let p = 0; p < image.rgba.length; p += 4) {
    const [r, g, b, a] = image.rgba.subarray(p, p + 4);
    bins.add((r >> 4) * 256 + (g >> 4) * 16 + (b >> 4));
    if (a > 250) opaque++;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 12) chromatic++;
    for (let c = 0; c < 3; c++) { sums[c] += image.rgba[p + c]; squares[c] += image.rgba[p + c] ** 2; }
    if ((p / 4) % image.width > 0 && Math.max(...[0, 1, 2].map(c => Math.abs(image.rgba[p + c] - image.rgba[p - 4 + c]))) > 15) edges++;
  }
  const count = image.width * image.height;
  return { width: image.width, height: image.height, pixels: count,
    opaqueFraction: opaque / count, chromaticFraction: chromatic / count,
    quantizedColors: bins.size, horizontalEdges: edges,
    channelVariance: squares.map((value, c) => value / count - (sums[c] / count) ** 2) };
}

function pixelDifference(before, after) {
  assert.equal(before.width, after.width); assert.equal(before.height, after.height);
  let changed = 0, sum = 0;
  for (let p = 0; p < before.rgba.length; p += 4) {
    const delta = Math.max(...[0, 1, 2].map(c => Math.abs(before.rgba[p + c] - after.rgba[p + c])));
    if (delta > 12) changed++;
    sum += delta;
  }
  const pixels = before.width * before.height;
  return { pixels, changedPixels: changed, changedFraction: changed / pixels, meanMaximumChannelDelta: sum / pixels };
}

async function diagnostic() {
  const value = JSON.parse(await page.locator('#layer-app #diagnostics').textContent());
  assert.equal(value.error, null, `Application error: ${value.error}`);
  assert.equal(value.ready, true, 'Native scene is not ready');
  return value;
}

async function record(name, extra = {}) {
  const value = await diagnostic();
  observations.push({ name, wallMS: Date.now() - began, diagnostic: value, ...extra });
  await fs.writeFile(path.join(EVIDENCE, `${name}.json`), JSON.stringify(observations.at(-1), null, 2) + '\n');
  return value;
}

async function waitIdle(timeout = GPU_IDLE_TIMEOUT_MS) {
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app');
    if (app?.dataset.status === 'error') return true;
    if (app?.dataset.ready !== 'true' || app.querySelector('#reset')?.disabled) return false;
    if (app.dataset.busy === 'true' || app.dataset.renderPending === 'true' || app.dataset.renderInFlight === 'true') return false;
    let value;
    try { value = JSON.parse(app.querySelector('#diagnostics')?.textContent || 'null'); } catch { return false; }
    const gate = value?.render?.frameGate;
    const presentation = value?.render?.presentationQueue;
    if (value?.error || gate?.failed) return true;
    return gate && gate.pending === 0 && gate.inFlight === 0
      && (!presentation || (presentation.pending === false && presentation.inFlight === false));
  }, null, { timeout, polling: 250 });
  const value = await diagnostic();
  const gate = value.render.frameGate;
  assert.ok(gate, 'Published GPU frame-gate evidence is missing');
  assert.equal(gate.failed, false, 'A submitted native GPU frame failed');
  assert.equal(gate.pending, 0, 'A display update is still pending');
  assert.equal(gate.inFlight, 0, 'Native GPU rendering has not finished');
  assert.ok(gate.submitted > 0 && gate.completed === gate.submitted, 'Every submitted native frame must complete');
  if (value.render.presentationQueue) {
    assert.equal(value.render.presentationQueue.pending, false, 'A coalesced presentation is still pending');
    assert.equal(value.render.presentationQueue.inFlight, false, 'A serialized presentation is still in flight');
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function verifyGarments(value, ids = ['inner', 'outer', 'pants']) {
  assert.equal(value.version, 'TAILOR-LAYERING-R02');
  assert.deepEqual(value.dynamicGarments.map(row => row.id).sort(), [...ids].sort(), 'Independent garment identities changed');
  assert.equal(value.physics.garmentCount, ids.length, 'The shared solver must contain exactly the displayed independent garments');
  assert.equal(value.nativePerson.sameModel, true);
  assert.equal(value.nativePerson.sameViewer, true);
  assert.equal(value.nativePerson.iframes, 0);
  assert.equal(value.nativePerson.revision, 'd413d108704af47cf531ee8c25d93f682c3176e3');
  assert.match(value.nativePerson.topology, /^[0-9a-f]{64}$/i);
  assert.equal(value.physics.staticNativeBody, true);
  assert.equal(value.physics.continuousCollision, false);
  assert.equal(value.physics.sweptVertexFace, true);
  assert.equal(typeof value.physics.edgeEdgeCollision, 'boolean', 'Report the actual edge/edge contact implementation scope');
  for (const row of value.dynamicGarments) {
    assert.equal(row.preset, EXPECTED[row.id].preset);
    assert.equal(row.material, EXPECTED[row.id].material, 'A retained material was replaced');
    for (const key of ['displayVertices', 'solverParticles', 'solverTriangles', 'yarnSpans', 'envelopeMM']) {
      assert.ok(Number.isFinite(row[key]) && row[key] > 0, `${row.id}.${key} must describe real geometry`);
    }
    assert.equal(row.opaqueBackingSheets, 0, 'An opaque sheet must not replace the original solid yarns');
    assert.equal(row.fixedDistanceTiers, false);
    assert.match(row.representation, /closed.*yarns.*continuous sampling/);
  }
  assert.ok(Number.isFinite(value.render.triangles) && value.render.triangles > 1000);
  assert.ok(Number.isFinite(value.render.calls) && value.render.calls > 0);
}

async function webglFacts() {
  return page.locator('#layer-app #layer-stage canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { context: false };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    const facts = {
      context: true, contextLost: gl.isContextLost(),
      version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
      unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight,
      preserveDrawingBuffer: gl.getContextAttributes()?.preserveDrawingBuffer,
      currentProgram: !!program, currentProgramLinked: program ? gl.getProgramParameter(program, gl.LINK_STATUS) : null,
      actualIframeCount: document.querySelectorAll('iframe').length,
      canvasTag: canvas.tagName, backingWidth: canvas.width, backingHeight: canvas.height,
    };
    // An idle, non-preserved WebGL framebuffer may already be cleared. Record
    // these bytes as supplemental evidence only; browser PNGs are the visual gate.
    try {
      const width = Math.min(32, gl.drawingBufferWidth), height = Math.min(32, gl.drawingBufferHeight);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(Math.max(0, (gl.drawingBufferWidth - width) >> 1), Math.max(0, (gl.drawingBufferHeight - height) >> 1), width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      facts.readPixelsSampleNonzeroBytes = pixels.reduce((n, value) => n + (value !== 0), 0);
      facts.readPixelsSampleBytes = pixels.length;
    } catch (error) { facts.readPixelsError = String(error); }
    return facts;
  });
}

async function capture(name, { requireScene = true } = {}) {
  markPhase('capture:' + name);
  await waitIdle();
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: false, animations: 'disabled', timeout: SCREENSHOT_TIMEOUT_MS });
  const buffer = await page.locator('#layer-app #layer-stage canvas').screenshot({ path: path.join(EVIDENCE, `${name}-canvas.png`), animations: 'disabled', timeout: SCREENSHOT_TIMEOUT_MS });
  const decoded = decodePNG(buffer), pixels = pixelStats(decoded), gl = await webglFacts();
  if (requireScene) {
    assert.equal(gl.context, true, 'No real WebGL context');
    assert.equal(gl.contextLost, false, 'WebGL context was lost');
    assert.equal(gl.actualIframeCount, 0, 'The native person must remain in the same document');
    assert.equal(gl.currentProgram, true, 'No current WebGL shader program');
    assert.equal(gl.currentProgramLinked, true, 'The real shader program did not link');
    assert.match(gl.version, /WebGL 2/);
    assert.ok(gl.drawingBufferWidth >= 300 && gl.drawingBufferHeight >= 350, 'Canvas drawing buffer is too small');
    assert.ok(pixels.quantizedColors >= 36, 'Canvas screenshot is blank or lacks rendered color variation');
    assert.ok(Math.max(...pixels.channelVariance) >= 80, 'Canvas screenshot is nearly uniform');
    assert.ok(pixels.horizontalEdges >= 500, 'Canvas screenshot lacks visible scene detail');
  }
  await record(name, { pixels, webgl: gl });
  return decoded;
}

async function clickAndWait(id, timeout = GPU_IDLE_TIMEOUT_MS) {
  markPhase('control:' + id);
  await page.locator(`#layer-app #${id}`).click({ timeout: LOCATOR_TIMEOUT_MS });
  await waitIdle(timeout);
}

async function advance(id = 'step') {
  const before = await diagnostic();
  await clickAndWait(id);
  const after = await diagnostic();
  assert.equal(after.physics.completedSteps, before.physics.completedSteps + 1, `${id} must execute one actual solver step`);
  assert.ok(after.physics.simulationSeconds > before.physics.simulationSeconds);
  assert.ok(Number.isFinite(after.physics.solverMS) && after.physics.solverMS > 0);
  assert.equal(after.physics.nominalStepSeconds, 1 / 120);
  assert.ok(Number.isFinite(after.physics.contact?.contactCount), 'Contact count must come from a completed solve');
  return after;
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const arrayHash = (values, Type) => {
  const array = Type.from(values);
  return hash(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
};
function geometryDigest(snapshot) {
  assert.ok(snapshot?.rows?.length, 'A real cloth Worker snapshot is required');
  return snapshot.rows.map(row => ({id: row.id,
    positions: arrayHash(row.positions, Float32Array), normals: arrayHash(row.normals, Float32Array),
    topology: arrayHash(row.indices, Uint32Array)})).sort((a, b) => a.id.localeCompare(b.id));
}

async function verifyNativeObservation() {
  const identity = await page.evaluate(async () => {
    const input = globalThis.__KAOPU_CI_CLOTH_OBSERVER__?.init;
    const model = window.__IDENTITY_QA__?.model?.(), viewer = window.__IDENTITY_QA__?.viewer?.();
    if (!input?.body || !model?.positions || !model?.faces) throw new Error('Actual native model or original init input missing');
    const expected = new Float32Array(model.positions.length);
    for (let i = 0; i < expected.length; i += 3) {
      expected[i] = model.positions[i]; expected[i + 1] = model.positions[i + 2]; expected[i + 2] = -model.positions[i + 1];
    }
    const actual = input.body.positions;
    const bytes = value => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const equalBytes = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
    const digest = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    return {bodyPositionType: actual.constructor.name, exactYUpBytesMatch: equalBytes(bytes(actual), bytes(expected)),
      exactTopologyMatch: input.body.faces.length === model.faces.length && input.body.faces.every((value, i) => value === model.faces[i]),
      nativeGeometrySHA256: await digest(bytes(model.positions)),
      observedBodySHA256: await digest(bytes(actual)),
      vertices: actual.length / 3, triangles: input.body.faces.length / 3,
      sameCanvas: viewer?.canvas === document.querySelector('#layer-app #layer-stage canvas'),
      platformReady: window.platformReview?.ready?.() === true,
      coordinateConversion: '[native x,native z,-native y], no additional ground shift'};
  });
  assert.equal(identity.bodyPositionType, 'Float32Array');
  assert.equal(identity.exactYUpBytesMatch, true, 'Worker body differs from the current real native model');
  assert.equal(identity.exactTopologyMatch, true, 'Worker body topology differs from the current real native model');
  assert.equal(identity.sameCanvas, true);
  assert.equal(identity.platformReady, true);
  assert.equal(identity.vertices, 25417);
  assert.equal(identity.triangles, 50624);
  const traffic = await readClothObservation(page, {geometry: true, initialInput: true});
  assert.equal(traffic.errors.length, 0);
  assert.equal(traffic.pending.length, 0);
  nativeWorldInput = traffic.init;
  const file = 'native-world-observation.json.gz';
  const bytes = gzipSync(Buffer.from(JSON.stringify({schema: 'kaopu-browser-init-observation@1',
    identity, init: nativeWorldInput,
    scope: 'Numeric observation from this acceptance run; exact typed-byte baseline capture is a separate artifact'})), {level: 6});
  await fs.writeFile(path.join(EVIDENCE, file), bytes);
  summary.nativeObservation = {...identity, file, fileSHA256: hash(bytes), fileBytes: bytes.length,
    initialObserverCopyMS: traffic.snapshotCopyMS};
  return traffic;
}

function assertPhysicalMetrics(physics, {dynamic = true, fullBody = false, particles} = {}) {
  assert.ok(Number.isFinite(physics.maxEdgeStretch));
  assert.ok(Number.isFinite(physics.seamGapMM));
  assert.ok(physics.seamGapMM <= DYNAMIC_LIMITS.seamGapMM, 'Sewn boundaries opened');
  if (dynamic && physics.completedSteps > 0) {
    assert.ok(physics.maxEdgeStretch <= DYNAMIC_LIMITS.maxEdgeStretch,
      'A completed dynamic step exceeded the retained source 1.45x stretch guard');
    assert.ok(physics.contact, 'A completed contact-enabled step must retain its measurement');
    if (fullBody) {
      // An explicit snapshot inspects the current state without completing a
      // new substep; it must identify that measurement rather than impersonate
      // the last solve's post-body-projection result.
      assert.equal(physics.explicitContactInspection?.measurementOnly, true);
      assert.equal(physics.explicitContactInspection.advancedSimulation, false);
      assert.equal(physics.contact.measurementOnly, true);
    } else assert.equal(physics.contact.measuredAfterBodyProjection, true);
    assert.ok(Number.isFinite(physics.contact.residualMaxPenetration));
    assert.ok(physics.contact.residualMaxPenetration <= DYNAMIC_LIMITS.contactResidualM,
      'Measured middle-surface thickness residual exceeded the 0.5 mm engineering acceptance bound');
  }
  if (fullBody) {
    assert.equal(physics.bodySampledVertices, particles, 'Every physical cloth vertex must be measured against the actual native body');
    assert.equal(physics.bodyInsideVertices, 0, 'A cloth vertex is inside the current native body');
    assert.ok(Number.isFinite(physics.bodyMinimumMM) && physics.bodyMinimumMM >= 0);
    assert.match(physics.bodyMetric, /all cloth vertices/);
    assert.ok(Number.isFinite(physics.bodyThicknessOverlapMM) && physics.bodyThicknessOverlapMM >= 0,
      'Actual native-body half-thickness overlap must be measured and finite');
    assert.ok(physics.bodyThicknessOverlapMM <= DYNAMIC_LIMITS.bodyHalfThicknessOverlapMM,
      'The cloth envelope exceeds the 0.001 mm body half-thickness overlap tolerance');
    assert.ok(Number.isInteger(physics.bodyThicknessOverlappingVertices)
      && physics.bodyThicknessOverlappingVertices >= 0 && physics.bodyThicknessOverlappingVertices <= particles);
    assert.equal(physics.bodyPerGarment?.length, physics.garmentCount,
      'Body thickness measurement must include every independent garment');
    for (const row of physics.bodyPerGarment) {
      assert.ok(Number.isFinite(row.minimumMiddleSurfaceDistanceMM));
      assert.ok(Number.isFinite(row.minimumHalfThicknessClearanceMM));
      assert.ok(row.minimumHalfThicknessClearanceMM >= -DYNAMIC_LIMITS.bodyHalfThicknessOverlapMM,
        row.id + ' has insufficient measured body half-thickness clearance');
    }
  }
}

async function geometryCheckpoint(name, snapshot) {
  assert.match(name, /^[a-z0-9-]+$/);
  const report = auditObservedGeometry({body: nativeWorldInput.body, snapshot});
  const rawName = `${name}-geometry.json.gz`, reportName = `${name}-geometry-audit.json`;
  const bytes = gzipSync(Buffer.from(JSON.stringify({schema: 'kaopu-actual-response-checkpoint@1',
    nativeBodyObservation: summary.nativeObservation.file, snapshot})), {level: 6});
  await fs.writeFile(path.join(EVIDENCE, rawName), bytes);
  await fs.writeFile(path.join(EVIDENCE, reportName), JSON.stringify(report, null, 2) + '\n');
  const row = {name, requestID: snapshot.id, physicalStep: snapshot.audit.completedSteps,
    physicalSeconds: snapshot.audit.simulationSeconds, rawName, rawSHA256: hash(bytes), rawBytes: bytes.length,
    reportName, garmentPairs: report.garmentPairs, bodyPairs: report.bodyPairs,
    degenerateTriangles: report.intersections.degenerateTriangles,
    hasReportedIntersections: report.intersections.hasReportedIntersections, elapsedMS: report.intersections.elapsedMS};
  summary.geometryChecks.push(row);
  // Persist the actual failing geometry before enforcing the gate.
  assertNoObservedCrossings(report);
  return row;
}

async function continuousCheckpoint({before, after, metrics, traffic, geometryStates}) {
  assert.equal(traffic.droppedCheckpoints, 0, 'Selected intermediate geometry was discarded before acceptance');
  let metricError;
  for (const response of metrics.responseAudits) {
    try {assertPhysicalMetrics(response.audit);} catch (error) {metricError ??= error;}
  }
  const states = new Map(geometryStates.map(row => [row.requestID, row.snapshot]));
  states.set(traffic.snapshot.id, traffic.snapshot);
  const reports = [];
  for (const [id, snapshot] of states) {
    reports.push(await geometryCheckpoint(`generation-${traffic.checkpointGeneration}-reply-${id}`, snapshot));
  }
  assert.equal(after.physics.completedSteps, traffic.snapshot.audit.completedSteps);
  assert.ok(after.physics.simulationSeconds > before.physics.simulationSeconds);
  if (metricError) throw metricError;
  return reports;
}

async function fullBodyAudit(name, {enforcePhysics = true} = {}) {
  markPhase('full-body-audit:' + name);
  await waitForClothIdle(page);
  const before = await readClothObservation(page, {geometry: true});
  await clickAndWait('audit-contact');
  await waitForClothIdle(page);
  const after = await readClothObservation(page, {geometry: true});
  const value = await diagnostic();
  assert.ok(after.snapshot.id > before.snapshot.id, 'The contact inspection must receive a new real Worker reply');
  assert.equal(after.responses.find(row => row.id === after.snapshot.id)?.type, 'snapshot');
  assert.equal(after.audit.completedSteps, before.audit.completedSteps);
  assert.equal(after.audit.simulationSeconds, before.audit.simulationSeconds);
  assert.deepEqual(geometryDigest(after.snapshot), geometryDigest(before.snapshot), 'The read-only contact audit moved real cloth');
  const inspection = after.audit.explicitContactInspection;
  assert.equal(inspection?.measurementOnly, true, 'The Worker reply must identify a current read-only contact measurement');
  assert.equal(inspection.advancedSimulation, false);
  assert.ok(Number.isFinite(inspection.measurementMS) && inspection.measurementMS >= 0);
  assert.deepEqual(value.physics.explicitContactInspection, inspection, 'The UI must expose the actual manual Worker measurement');
  if (after.audit.contactEnabled) assert.equal(after.audit.contact?.measurementOnly, true);
  else assert.equal(after.audit.contact, null);
  const envelope = after.audit.bodyEnvelope;
  assert.equal(envelope?.rows?.length, value.dynamicGarments.length);
  assert.deepEqual(envelope.rows.map(row => row.id).sort(), value.dynamicGarments.map(row => row.id).sort());
  assert.equal(envelope.triangles, value.dynamicGarments.reduce((sum, row) => sum + row.solverTriangles, 0));
  for (const row of envelope.rows) {
    assert.equal(row.measurementOnly, true);
    assert.equal(row.residualMeasured, true);
  }
  assert.deepEqual(value.physics.contact, JSON.parse(JSON.stringify(after.audit.contact)),
    'The published JSON contact measurement must match its actual Worker reply');
  assert.deepEqual(value.physics.bodyEnvelope, JSON.parse(JSON.stringify(envelope)),
    'The published JSON body-envelope measurement must match its actual Worker reply');
  const particles = value.dynamicGarments.reduce((sum, row) => sum + row.solverParticles, 0);
  assert.equal(value.physics.bodySampledVertices, particles);
  assert.ok(Number.isFinite(value.physics.bodyMinimumMM));
  if (enforcePhysics) assertPhysicalMetrics(value.physics,
    {dynamic: value.physics.completedSteps > 0, fullBody: true, particles});
  await record(name, {fullBodyAudit: true, physicalLimitsEnforced: enforcePhysics,
    explicitContactInspection: inspection, actualWorkerReply: after.snapshot.id});
  return {value, traffic: after};
}

async function setColor(value) {
  await page.locator('#layer-app #color').evaluate((input, color) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, color);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await waitIdle();
}

async function setRenderDemand(enabled) {
  const before = await readClothObservation(page, {geometry: true});
  await page.locator('#layer-app #render-demand').setChecked(enabled);
  await waitIdle(); await waitForClothIdle(page);
  const after = await readClothObservation(page, {geometry: true}), value = await diagnostic();
  assert.equal(value.render.demand.enabled, enabled);
  assert.equal(value.render.demand.hiddenSimulationSkipped, false);
  assert.equal(value.render.demand.occludedRegionCullingImplemented, false);
  assert.equal(after.requestCount, before.requestCount, 'Render optimization toggle sent an unsolicited physics operation');
  assert.deepEqual(geometryDigest(after.snapshot), geometryDigest(before.snapshot));
  assert.equal(after.audit.simulationSeconds, before.audit.simulationSeconds);
  assert.equal(after.audit.completedSteps, before.audit.completedSteps);
}

async function runDemandComparison() {
  markPhase('same-state-render-demand-comparison');
  await clickAndWait('all-visible');
  const trials = [], pixelsByMode = new Map();
  let identicalResetGeometry;
  // ABBA reduces a simple one-way cache warming bias. Timings remain a small
  // observational sample, while exact upload/frame counts are deterministic
  // work measurements. The same current body, garments and materials persist.
  for (const [index, enabled] of [false, true, true, false].entries()) {
    await clickAndWait('reset'); await waitForClothIdle(page);
    await setRenderDemand(enabled);
    const before = await diagnostic(), beforeTraffic = await readClothObservation(page, {geometry: true});
    assert.equal(before.playing, false);
    assert.equal(before.physics.completedSteps, 0);
    assert.equal(before.physics.simulationSeconds, 0);
    const digest = geometryDigest(beforeTraffic.snapshot);
    identicalResetGeometry ??= digest;
    assert.deepEqual(digest, identicalResetGeometry, 'A/B modes did not start from identical reset geometry');
    const started = Date.now(), name = `demand-${enabled ? 'on' : 'off'}-trial-${index + 1}`;
    const {value: after, traffic} = await fullBodyAudit(name, {enforcePhysics: false});
    const wallMS = Date.now() - started;
    assert.deepEqual(geometryDigest(traffic.snapshot), digest);
    assert.equal(traffic.audit.completedSteps, 0);
    assert.equal(traffic.audit.simulationSeconds, 0);
    verifyGarments(after);
    const perGarmentUploads = Object.fromEntries(['pants', 'inner', 'outer'].map(id => [id,
      (after.render.demand.uploadedByGarment[id] || 0) - (before.render.demand.uploadedByGarment[id] || 0)]));
    for (const [id, count] of Object.entries(perGarmentUploads)) {
      if (enabled) assert.equal(count, 0, id + ' re-uploaded exact unchanged geometry in demand mode');
      else assert.ok(count > 0, id + ' did not exercise the unconditional comparison path');
    }
    const trial = {name, enabled, wallMS, physicalSeconds: 0, physicsSteps: 0,
      workerResponses: traffic.responseCount - beforeTraffic.responseCount,
      perGarmentUploads,
      submittedFrames: after.render.frameGate.submitted - before.render.frameGate.submitted,
      completedFrames: after.render.frameGate.completed - before.render.frameGate.completed,
      geometryStageMS: after.render.demand.stageMS - before.render.demand.stageMS,
      nativeCommitMS: after.render.demand.commitMS - before.render.demand.commitMS,
      unchangedRows: after.render.demand.unchangedRows - before.render.demand.unchangedRows,
      diagnosticWrites: after.render.demand.diagnosticWrites - before.render.demand.diagnosticWrites,
      geometryDigest: digest};
    assert.equal(trial.workerResponses, 1, 'The visible audit operation must perform exactly one real snapshot request');
    assert.equal(trial.submittedFrames, trial.completedFrames);
    trials.push(trial);
    await record(name + '-measurement', {sameStateRenderComparison: trial});
    if (!pixelsByMode.has(enabled)) pixelsByMode.set(enabled, await capture(enabled ? 'demand-on' : 'demand-off'));
  }
  const pixels = pixelDifference(pixelsByMode.get(false), pixelsByMode.get(true));
  assert.ok(pixels.changedFraction <= .005 && pixels.meanMaximumChannelDelta <= 1,
    'Optimization changed the paused, same-state native canvas beyond the declared pixel tolerance');
  const onFrames = trials.filter(row => row.enabled).reduce((sum, row) => sum + row.submittedFrames, 0);
  const offFrames = trials.filter(row => !row.enabled).reduce((sum, row) => sum + row.submittedFrames, 0);
  assert.ok(onFrames < offFrames, 'The same-state demand path did not reduce actual native frame submissions');
  summary.renderDemandComparison = {order: ['off', 'on', 'on', 'off'], trials, pixels,
    optimizationSubmittedFrames: onFrames, comparisonSubmittedFrames: offFrames,
    geometryAndClockIdentical: true, solverParametersChanged: false,
    interpretation: 'Repeated read-only snapshot actions in one paused page after identical resets; upload/frame counts prove avoided work, small timing samples do not establish real-time performance. This comparison does not accept the initial physical fit; separate continuous, removal and native replay gates enforce it.'};
  await setRenderDemand(true);
}

async function runHiddenRestore() {
  markPhase('isolated-geometry-deferral-and-restoration');
  await clickAndWait('reset'); await waitForClothIdle(page);
  await setRenderDemand(true);
  await page.locator('#layer-app #layer-list [data-garment="outer"]').click();
  await clickAndWait('isolate-selected');
  const before = await diagnostic(), beforeTraffic = await readClothObservation(page, {geometry: true});
  assert.equal(before.displayOnlyIsolation, true);
  assert.deepEqual(before.render.demand.requiredIDs, ['outer']);
  const sustained = await runContinuousInterval({page, diagnostic, record, capture, waitIdle,
    seconds: .2, name: 'isolated-sustained', checkpoint: continuousCheckpoint});
  const {value: hidden, traffic: hiddenTraffic} = await fullBodyAudit('isolated-body-audit');
  verifyGarments(hidden);
  const beforeGeometry = new Map(geometryDigest(beforeTraffic.snapshot).map(row => [row.id, row]));
  const afterGeometry = new Map(geometryDigest(hiddenTraffic.snapshot).map(row => [row.id, row]));
  for (const id of ['pants', 'inner']) {
    assert.equal(hidden.render.demand.uploadedByGarment[id], before.render.demand.uploadedByGarment[id],
      id + ' uploaded geometry while explicitly hidden from both beauty and shadows');
    assert.equal(hidden.render.demand.lastUploadedSnapshotIDByGarment[id], before.render.demand.lastUploadedSnapshotIDByGarment[id]);
    assert.ok(hidden.render.demand.pendingIDs.includes(id), id + ' did not retain its newer hidden geometry');
    assert.notEqual(afterGeometry.get(id).positions, beforeGeometry.get(id).positions,
      id + ' was incorrectly frozen in physical simulation while hidden');
    assert.equal(hidden.render.demand.latestSnapshotIDByGarment[id], hiddenTraffic.snapshot.id);
  }
  await clickAndWait('all-visible'); await waitForClothIdle(page);
  const shown = await diagnostic(), shownTraffic = await readClothObservation(page, {geometry: true});
  verifyGarments(shown);
  assert.equal(shown.displayOnlyIsolation, false);
  assert.equal(shownTraffic.requestCount, hiddenTraffic.requestCount, 'Restoring display sent a physics mutation');
  assert.deepEqual(geometryDigest(shownTraffic.snapshot), geometryDigest(hiddenTraffic.snapshot));
  assert.equal(shown.physics.simulationSeconds, hidden.physics.simulationSeconds);
  assert.deepEqual(shown.render.demand.pendingIDs, []);
  for (const id of ['pants', 'inner']) {
    assert.ok(shown.render.demand.uploadedByGarment[id] > hidden.render.demand.uploadedByGarment[id]);
    assert.equal(shown.render.demand.lastUploadedSnapshotIDByGarment[id], hiddenTraffic.snapshot.id,
      id + ' did not restore the newest retained geometry');
    assert.equal(shown.render.demand.lastUploadedPhysicalStepByGarment[id], hidden.physics.completedSteps);
  }
  await capture('restored-newest-hidden-geometry');
  summary.hiddenGeometryRestore = {actualSeconds: sustained.metrics.actualSeconds, actualSteps: sustained.metrics.actualSteps,
    hiddenGarments: ['pants', 'inner'], hiddenUploads: {pants: 0, inner: 0},
    hiddenGarmentsStillPhysicallyEvolved: true, restoredSnapshotID: hiddenTraffic.snapshot.id,
    restoredPhysicalStep: hidden.physics.completedSteps, newestGeometryPresented: true,
    bodyAndOtherGarmentsWereOnlyDisplayHidden: true, occlusionCullingClaimed: false};
}

try {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Browser execution is reserved for GitHub Actions; do not launch a local browser for this test.');
  assert.ok(['all', 'display', 'demand', 'continuous', 'reentry'].includes(SCENARIO),
    'LAYERING_CI_SCENARIO must be all, display, demand, continuous or reentry');
  await fs.mkdir(EVIDENCE, { recursive: true });
  const require = createRequire(path.join(ROOT, '.ci-runtime', 'package.json'));
  const { chromium } = require('playwright');
  summary.playwrightVersion = require('playwright/package.json').version;
  assert.equal(summary.playwrightVersion, '1.64.0');
  const provenance = JSON.parse(await fs.readFile(path.join(ROOT, 'dist/SOURCE_PROVENANCE.json'), 'utf8'));
  assert.equal(provenance.upstreamRevision, 'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49');
  assert.equal(provenance.sameDocumentNativeHost, true);
  assert.equal(provenance.iframeRequired, false);
  assert.equal(provenance.upstreamFiles.length, 286);
  summary.sourceProvenance = provenance;
  // Keep the exact original rendering. Each acceptance job owns one real page
  // and its complete budget; no quality reduction is used to finish faster.
  watchdog = setTimeout(() => {
    failure = new Error(`Browser acceptance exceeded its ${BROWSER_BUDGET_MS / 60_000}-minute budget.`);
    appendProgress({ kind: 'browser-budget-exceeded', phase });
    browser?.close().catch(() => {});
  }, BROWSER_BUDGET_MS);
  browser = await chromium.launch({ headless: true, channel: 'chromium', timeout: 60_000, args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
  ] });
  summary.browserVersion = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1,
    colorScheme: 'light', locale: 'zh-CN', reducedMotion: 'reduce' });
  await installClothObserver(context);
  await installProgressObserver();
  // No signed-in state, external models, remote scripts or user profile.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(BASE).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    forbiddenRequests.push({ url: url.href, resourceType: route.request().resourceType() });
    return route.abort('blockedbyclient');
  });
  page = await context.newPage();
  page.setDefaultTimeout(LOCATOR_TIMEOUT_MS);
  page.on('console', message => {
    const row = { type: message.type(), text: message.text(), location: message.location(), wallMS: Date.now() - began };
    consoleMessages.push(row);
    if (row.text.startsWith(PROGRESS_PREFIX)) {
      try {
        const observation = JSON.parse(row.text.slice(PROGRESS_PREFIX.length));
        if (observation.kind === 'public-dom') { lastDOMObservation = observation; lastDOMObservedAt = Date.now(); }
        appendProgress(observation);
      } catch (error) { appendProgress({ kind: 'progress-observer-error', message: String(error) }); }
    } else appendProgress({ kind: 'console', ...row });
  });
  page.on('pageerror', error => {
    const row = { message: error.message, stack: error.stack, wallMS: Date.now() - began };
    pageErrors.push(row); appendProgress({ kind: 'page-error', ...row });
  });
  page.on('request', request => appendProgress({ kind: 'request-start', url: request.url(), type: request.resourceType() }));
  page.on('response', response => {
    const row = { url: response.url(), status: response.status(), type: response.request().resourceType(), wallMS: Date.now() - began };
    requests.push(row); appendProgress({ kind: 'response', ...row });
  });
  page.on('requestfailed', request => {
    const row = { url: request.url(), failure: request.failure()?.errorText, type: request.resourceType(), wallMS: Date.now() - began };
    requests.push(row); appendProgress({ kind: 'request-failed', ...row });
  });
  heartbeat = setInterval(() => {
    const row = { kind: 'runner-heartbeat', phase, browserConnected: browser.isConnected(),
      lastDOMAgeMS: lastDOMObservedAt === null ? null : Date.now() - lastDOMObservedAt,
      lastStatus: lastDOMObservation?.statusText || null,
      frameGate: lastDOMObservation?.render?.frameGate || null };
    appendProgress(row);
    console.log('CI_PROGRESS ' + JSON.stringify({ wallMS: Date.now() - began, ...row }));
  }, 15_000);
  markPhase('navigation');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  markPhase('native-person-and-garments-ready');
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app');
    return app?.dataset.ready === 'true' || app?.dataset.status === 'error';
  }, null, { timeout: READY_TIMEOUT_MS, polling: 250 });
  assert.equal(await page.locator('#layer-app').getAttribute('data-ready'), 'true', await page.locator('#layer-app #load-text').textContent());
  await waitIdle();
  await waitForClothIdle(page);
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').count(), 1);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').isVisible(), true);
  assert.equal(await page.locator('#layer-app #layer-loading').isVisible(), false, 'Loading overlay still hides the real scene');
  assert.equal(await page.locator('#layer-app #layer-list [data-garment]').count(), 3);
  assert.equal((await page.locator('#layer-app #metric-layers').textContent()).trim(), '3');
  const initial = await diagnostic();
  verifyGarments(initial);
  summary.referenceBodyLoading = verifyReferenceBodyLoading({baseURL: BASE, provenance,
    allocation: initial.bootTimings?.referenceBodyAllocation,
    requestStarts: progressEvents.filter(row => row.kind === 'request-start'), responses: requests});
  assert.equal(initial.playing, false);
  summary.actualContactScope = Object.fromEntries(['continuousCollision', 'sweptVertexFace', 'edgeEdgeCollision',
    'completeSelfCollision', 'materialCalibrated', 'arbitraryLayeringCertified', 'constraintModel']
    .map(key => [key, initial.physics[key]]));
  const initialTraffic = await verifyNativeObservation();
  await capture('initial');

  if (['all', 'continuous', 'reentry'].includes(SCENARIO)) {
    await geometryCheckpoint('initial', initialTraffic.snapshot);
    await fullBodyAudit('initial-body-audit');
  }

  // Each scenario keeps one continuous, real page/scene. CI runs both scenarios
  // on separate runners, and requires both jobs to pass the complete gates.
  if (SCENARIO === 'all' || SCENARIO === 'display') {
    // Independent display and dye tests operate through the normal controls.
    assert.equal(await page.locator('#layer-app #layer-list [data-garment="outer"]').getAttribute('aria-pressed'), 'true', 'The real default selection must be the outer garment');
    await clickAndWait('isolate-selected');
    assert.equal((await diagnostic()).displayOnlyIsolation, true);
    const isolatedPixels = await capture('isolated');
    const originalColor = await page.locator('#layer-app #color').inputValue();
    await setColor('#ee285a');
    const recoloredPixels = await capture('recolored');
    const dyeDifference = pixelDifference(isolatedPixels, recoloredPixels);
    assert.ok(dyeDifference.changedFraction > .005, 'Changing the selected dye did not visibly alter the actual canvas');
    summary.dyePixelDifference = dyeDifference;
    await setColor(originalColor);
    await clickAndWait('view-detail');
    await capture('detail');
    // The application restores the full-outfit front camera in this action.
    // A second view-front action would redraw the same accepted state.
    await clickAndWait('all-visible');

    // The displayed separation is a view operation: it must leave every exposed
    // physics measurement and the simulation clock unchanged.
    const beforeSeparation = await diagnostic();
    await page.locator('#layer-app #exploded').check();
    await waitIdle();
    const separated = await diagnostic();
    assert.equal(separated.displayOnlySeparation, true);
    assert.deepEqual(separated.physics, beforeSeparation.physics, 'Exploded view changed the physics state');
    verifyGarments(separated);
    await capture('separated');
    // A dedicated display job ends at its verified separated view. Restore it
    // only when the same page will continue into the contact scenario.
    if (SCENARIO === 'all') {
      await page.locator('#layer-app #exploded').uncheck();
      await waitIdle();
      assert.deepEqual((await diagnostic()).physics, beforeSeparation.physics);
    }
    summary.scenariosCompleted.push('display');
  }

  if (SCENARIO === 'all' || SCENARIO === 'demand') {
    await runDemandComparison();
    await runHiddenRestore();
    summary.scenariosCompleted.push('demand');
  }

  if (SCENARIO === 'all' || SCENARIO === 'continuous') {
    if (SCENARIO === 'all') {await clickAndWait('reset'); await waitForClothIdle(page);}
    markPhase('continuous-native-world');
    const sustained = await runContinuousInterval({page, diagnostic, record, waitIdle,
      capture: name => capture(name + '-view'), seconds: CONTINUOUS_SECONDS,
      name: 'sustained', checkpoint: continuousCheckpoint});
    await fullBodyAudit('sustained-body-audit');
    summary.continuous = {actualSeconds: sustained.metrics.actualSeconds, actualSteps: sustained.metrics.actualSteps,
      wallMS: sustained.metrics.wallMS, maximumRecordedStretch: sustained.metrics.maximumRecordedStretch,
      selectedGeometryChecks: sustained.metrics.geometryChecks};
    // Exercise the existing, bounded normal UI impulse after actual settling.
    // No direct Worker message, fabricated pointer or altered geometry is used.
    const pushed = await advance('push');
    assertPhysicalMetrics(pushed.physics);
    await waitForClothIdle(page);
    await geometryCheckpoint('bounded-push', (await readClothObservation(page, {geometry: true})).snapshot);
    const recovered = await runContinuousInterval({page, diagnostic, record, waitIdle,
      capture: name => capture(name + '-view'), seconds: .25,
      name: 'push-recovery', checkpoint: continuousCheckpoint});
    await fullBodyAudit('push-recovery-body-audit');
    summary.boundedPerturbation = {control: 'push', physicalSecondsAfterImpulse: recovered.metrics.actualSeconds,
      actualSteps: recovered.metrics.actualSteps, selectedGeometryChecks: recovered.metrics.geometryChecks};
    summary.scenariosCompleted.push('continuous');
  }

  if (SCENARIO === 'all' || SCENARIO === 'reentry') {
    markPhase('repeated-removal-and-restoration');
    const cycles = await runRemovalCycles({page, diagnostic, record, waitIdle, verifyGarments,
      capture: name => capture(name + '-view'), checkpoint: continuousCheckpoint,
      cycles: 3, secondsWhileRemoved: .2, secondsAfterRestore: .25,
      initialCheckpoint: async ({cycle, traffic}) => geometryCheckpoint(`cycle-${cycle}-restored-initial`, traffic.snapshot),
      afterCycle: async ({cycle}) => fullBodyAudit(`cycle-${cycle}-restored-body-audit`)});
    summary.removalCycles = cycles.map((row, i) => ({cycle: i + 1,
      restoredActualSeconds: row.metrics.actualSeconds, restoredActualSteps: row.metrics.actualSteps,
      maximumRecordedStretch: row.metrics.maximumRecordedStretch, geometryChecks: row.metrics.geometryChecks}));
    summary.scenariosCompleted.push('reentry');
  }

  assert.deepEqual(summary.scenariosCompleted, SCENARIO === 'all' ? ['display', 'demand', 'continuous', 'reentry'] : [SCENARIO]);
  // Recheck the same observed traffic through the final scenario: a late
  // request for the removed reference payload must also fail acceptance.
  summary.referenceBodyLoading = verifyReferenceBodyLoading({baseURL: BASE, provenance,
    allocation: initial.bootTimings?.referenceBodyAllocation,
    requestStarts: progressEvents.filter(row => row.kind === 'request-start'), responses: requests});
  assert.equal(forbiddenRequests.length, 0, 'The build requested resources outside the verified local closure');
  assert.equal(pageErrors.length, 0, 'Browser JavaScript errors occurred');
  const failedResources = requests.filter(row => row.status >= 400 && !new URL(row.url).pathname.endsWith('/favicon.ico'));
  assert.equal(failedResources.length, 0, 'A runtime asset failed to load');
  const shaderErrors = consoleMessages.filter(row => row.type === 'error' && /shader|webgl|compile|link|context lost/i.test(row.text));
  assert.equal(shaderErrors.length, 0, 'A WebGL or shader error occurred');
  if (failure) throw failure;
  summary.passed = true;
} catch (error) {
  failure ??= error;
  summary.error = { message: failure.message || String(failure), stack: failure.stack };
  appendProgress({ kind: 'acceptance-failed', phase, error: summary.error });
  if (page && !page.isClosed()) {
    try {
      summary.failureDOM = await page.locator('#layer-app').innerText({ timeout: 5000 });
    } catch (domError) { summary.failureDOMError = String(domError); }
    // A blocked DOM read must not prevent an independent real screenshot attempt.
    try {
      await page.screenshot({ path: path.join(EVIDENCE, 'failure.png'), fullPage: false, timeout: SCREENSHOT_TIMEOUT_MS });
    } catch (captureError) { summary.failureCaptureError = String(captureError); }
  }
} finally {
  clearTimeout(watchdog);
  clearInterval(heartbeat);
  summary.elapsedMS = Date.now() - began;
  summary.observations = observations;
  summary.lastPhase = phase;
  summary.lastPublicDOMObservation = lastDOMObservation;
  summary.progressEventCount = progressEvents.length;
  summary.consoleErrorCount = consoleMessages.filter(row => row.type === 'error').length;
  summary.pageErrors = pageErrors;
  summary.forbiddenRequests = forbiddenRequests;
  await fs.mkdir(EVIDENCE, { recursive: true });
  await evidenceWrites;
  await Promise.all([
    fs.writeFile(path.join(EVIDENCE, 'browser-metrics.json'), JSON.stringify(summary, null, 2) + '\n'),
    fs.writeFile(path.join(EVIDENCE, 'browser-console.json'), JSON.stringify(consoleMessages, null, 2) + '\n'),
    fs.writeFile(path.join(EVIDENCE, 'browser-network.json'), JSON.stringify(requests, null, 2) + '\n'),
    fs.writeFile(path.join(EVIDENCE, 'browser-errors.json'), JSON.stringify(pageErrors, null, 2) + '\n'),
    fs.writeFile(path.join(EVIDENCE, 'browser-progress.json'), JSON.stringify(progressEvents, null, 2) + '\n'),
  ]);
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}

console.log(JSON.stringify({ passed: summary.passed, scenario: SCENARIO, scenariosCompleted: summary.scenariosCompleted, elapsedMS: summary.elapsedMS, screenshots: observations.map(row => row.name),
  suiteScope: summary.suiteScope, continuous: summary.continuous && {seconds: summary.continuous.actualSeconds, steps: summary.continuous.actualSteps},
  demandFrames: summary.renderDemandComparison && {on: summary.renderDemandComparison.optimizationSubmittedFrames, off: summary.renderDemandComparison.comparisonSubmittedFrames},
  error: summary.error?.message }, null, 2));
if (failure) throw failure;
