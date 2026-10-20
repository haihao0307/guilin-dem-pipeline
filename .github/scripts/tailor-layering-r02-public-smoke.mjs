// One short post-publication check of the immutable public R02 URL.
// Draft for CI review. No local server/build, no long play loop or full release matrix.
// The only physics actions are visible #step and #audit-contact button clicks.
// The inherited observer only copies actual application Worker traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateSync, gzipSync} from 'node:zlib';

const REPO = process.cwd();
const PROJECT = path.join(REPO, 'experiments/tailor-layering-r02');
const OUT = path.resolve(REPO, process.env.SMOKE_OUT || 'smoke-evidence');
const TARGET = 'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/layering-r02-20261020-5186f8a/';
const SOURCE_HEAD = '5186f8a5d71a5e75059539f83a31b2ba1e53042b';
const PROVENANCE_SHA = 'b2e7b1640e15e52a8e152084a6b3dc0c00dedb3f45143269d83499b5ec2afa96';
const READY_MS = 480_000, ACTION_MS = 180_000, SCREENSHOT_MS = 120_000, BUDGET_MS = 720_000;
const EXPECTED = {pants: {preset: 'P02', material: 'denim-raw'},
  inner: {preset: 'T08', material: 'knit-fine-0'}, outer: {preset: 'T03', material: 'knit-soft-0'}};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const started = Date.now(), network = [], consoleMessages = [], pageErrors = [], observations = [], progress = [];
let browser, context, page, watchdog, heartbeat, failure, phase = 'setup';
let installClothObserver, readClothObservation, waitForClothIdle;
let writes = Promise.resolve();
const summary = {schema: 'kaopu-public-r02-smoke@1', startedUTC: new Date().toISOString(),
  passed: false, targetURL: TARGET, publishedSourceHead: SOURCE_HEAD,
  execution: 'GitHub Actions Chromium with software WebGL; not the user local browser or GPU',
  runnerCheckoutSHA: process.env.SMOKE_CHECKOUT_SHA || null,
  runnerBaseSHA: process.env.SMOKE_BASE_SHA || null,
  githubEventSHA: process.env.GITHUB_SHA || null, workflowRunID: process.env.GITHUB_RUN_ID || null,
  viewport: {width: 1440, height: 1000, deviceScaleFactor: 1},
  budgetsMS: {ready: READY_MS, action: ACTION_MS, screenshot: SCREENSHOT_MS, total: BUDGET_MS},
  plannedPhysicsSteps: 1, plannedManualInspections: 1,
  localServerUsed: false, localBuildUsed: false, requestRoutingOrAssetSubstitutionUsed: false,
  hiddenApplicationActionsUsed: false, readOnlyNativeIdentityGettersUsed: true,
  screenshotPixelsModified: false, screenshotsAreOriginalBrowserPNGs: true,
  scope: 'Published HTTPS loading, actual native model and three independent garments, one visible UI step, one read-only UI contact inspection, original screenshots and network/error observations.',
  limitations: ['This smoke is not the six-job release acceptance or a long continuous/reentry test.',
    'Displayed physics measurements are retained source engineering diagnostics, not a complete continuous collision or rendered-yarn certificate.',
    'No independent whole-mesh geometry replay is repeated here; raw actual Worker checkpoints are saved for review.',
    'Wall times include CI software rendering and observation overhead, and do not establish user-device or real-time performance.']};

async function jsonFile(name, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  await fs.writeFile(path.join(OUT, name), bytes);
  return {file: name, bytes: bytes.length, sha256: hash(bytes)};
}
async function rawCheckpoint(name, traffic) {
  const bytes = gzipSync(Buffer.from(JSON.stringify({schema: 'kaopu-public-smoke-worker-observation@1',
    source: 'Read-only copies of actual page Worker messages; numeric arrays, not fabricated geometry', traffic})), {level: 6});
  const file = name + '.json.gz';
  await fs.writeFile(path.join(OUT, file), bytes);
  return {file, bytes: bytes.length, sha256: hash(bytes)};
}
function mark(next) {
  phase = next;
  const row = {phase, observedUTC: new Date().toISOString(), wallMS: Date.now() - started};
  progress.push(row);
  writes = writes.then(() => fs.appendFile(path.join(OUT, 'progress.ndjson'), JSON.stringify(row) + '\n'));
  console.log('PUBLIC_SMOKE ' + JSON.stringify(row));
}
async function diagnostic() {
  const value = JSON.parse(await page.locator('#layer-app #diagnostics').textContent());
  assert.equal(value.error, null, 'Published application error: ' + value.error);
  assert.equal(value.ready, true);
  assert.equal(value.playing, false, 'The smoke must never start a play loop');
  return value;
}
async function idle() {
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app');
    if (app?.dataset.status === 'error') return true;
    if (app?.dataset.ready !== 'true' || app.querySelector('#reset')?.disabled) return false;
    if (['busy', 'renderPending', 'renderInFlight'].some(key => app.dataset[key] === 'true')) return false;
    let value;
    try {value = JSON.parse(app.querySelector('#diagnostics')?.textContent || 'null');} catch {return false;}
    const frame = value?.render?.frameGate, presentation = value?.render?.presentationQueue;
    return value?.error || frame?.failed || (frame && frame.pending === 0 && frame.inFlight === 0
      && (!presentation || (!presentation.pending && !presentation.inFlight)));
  }, null, {timeout: ACTION_MS, polling: 250});
  const d = await diagnostic(), frame = d.render.frameGate;
  assert.equal(frame.failed, false);
  assert.equal(frame.pending, 0); assert.equal(frame.inFlight, 0);
  assert.ok(frame.submitted > 0); assert.equal(frame.completed, frame.submitted);
  await waitForClothIdle(page, ACTION_MS);
}
function verifyGarments(d) {
  assert.equal(d.version, 'TAILOR-LAYERING-R02');
  assert.deepEqual(d.dynamicGarments.map(x => x.id).sort(), Object.keys(EXPECTED).sort());
  assert.equal(d.physics.garmentCount, 3);
  assert.equal(d.nativePerson.sameModel, true); assert.equal(d.nativePerson.sameViewer, true);
  assert.equal(d.nativePerson.iframes, 0);
  assert.equal(d.nativePerson.revision, 'd413d108704af47cf531ee8c25d93f682c3176e3');
  assert.equal(d.nativePerson.topology, 'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de');
  assert.equal(d.physics.staticNativeBody, true); assert.equal(d.physics.continuousCollision, false);
  assert.equal(d.physics.contactEnabled, true);
  for (const row of d.dynamicGarments) {
    assert.equal(row.preset, EXPECTED[row.id].preset); assert.equal(row.material, EXPECTED[row.id].material);
    for (const key of ['displayVertices', 'solverParticles', 'solverTriangles', 'yarnSpans', 'envelopeMM'])
      assert.ok(Number.isFinite(row[key]) && row[key] > 0, row.id + '.' + key);
    assert.equal(row.opaqueBackingSheets, 0); assert.equal(row.fixedDistanceTiers, false);
    assert.match(row.representation, /closed.*yarns.*continuous sampling/);
  }
  assert.ok(d.render.triangles > 1000 && d.render.calls > 0);
  assert.equal(d.render.demand.hiddenSimulationSkipped, false);
}
function geometryDigest(snapshot) {
  const digest = (values, Type) => hash(Buffer.from(Type.from(values).buffer));
  assert.equal(snapshot?.rows?.length, 3);
  return snapshot.rows.map(row => ({id: row.id, positions: digest(row.positions, Float32Array),
    normals: digest(row.normals, Float32Array), indices: digest(row.indices, Uint32Array)}))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function motion(before, after) {
  return after.rows.map(row => {
    const old = before.rows.find(x => x.id === row.id);
    assert.ok(old); assert.equal(old.positions.length, row.positions.length);
    assert.deepEqual(old.indices, row.indices);
    let maxMoveM = 0;
    for (let i = 0; i < row.positions.length; i += 3) {
      const delta = Math.hypot(row.positions[i] - old.positions[i], row.positions[i + 1] - old.positions[i + 1], row.positions[i + 2] - old.positions[i + 2]);
      assert.ok(Number.isFinite(delta)); maxMoveM = Math.max(maxMoveM, delta);
    }
    assert.ok(maxMoveM > 0, row.id + ' did not move in the real UI step');
    return {id: row.id, maxVertexMoveMM: maxMoveM * 1000};
  });
}
function physicalMetrics(p, manual = false) {
  assert.equal(p.completedSteps, 1); assert.equal(p.nominalStepSeconds, 1 / 120);
  assert.ok(Math.abs(p.simulationSeconds - 1 / 120) < 1e-12);
  assert.ok(Number.isFinite(p.maxEdgeStretch) && p.maxEdgeStretch <= 1.45);
  assert.ok(Number.isFinite(p.seamGapMM) && p.seamGapMM <= .01);
  assert.ok(p.contact && Number.isFinite(p.contact.residualMaxPenetration));
  assert.ok(p.contact.residualMaxPenetration <= .0005);
  if (manual) assert.equal(p.contact.measurementOnly, true);
  else assert.equal(p.contact.measuredAfterBodyProjection, true);
}
async function nativeIdentity() {
  // These are inherited read-only identity getters, not simulation controls.
  const value = await page.evaluate(async () => {
    const input = globalThis.__KAOPU_CI_CLOTH_OBSERVER__?.init;
    const model = window.__IDENTITY_QA__?.model?.(), viewer = window.__IDENTITY_QA__?.viewer?.();
    if (!input?.body || !model?.positions || !model?.faces) throw Error('Actual native model/init input missing');
    const expected = new Float32Array(model.positions.length);
    for (let i = 0; i < expected.length; i += 3) {
      expected[i] = model.positions[i]; expected[i + 1] = model.positions[i + 2]; expected[i + 2] = -model.positions[i + 1];
    }
    const bytes = value => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const actualBytes = bytes(input.body.positions), expectedBytes = bytes(expected);
    const digest = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(v => v.toString(16).padStart(2, '0')).join('');
    return {bodyType: input.body.positions.constructor.name,
      exactYUpBytesMatch: actualBytes.length === expectedBytes.length && actualBytes.every((v, i) => v === expectedBytes[i]),
      exactTopologyMatch: input.body.faces.length === model.faces.length && input.body.faces.every((v, i) => v === model.faces[i]),
      bodySHA256: await digest(actualBytes), nativeGeometrySHA256: await digest(bytes(model.positions)),
      vertices: input.body.positions.length / 3, triangles: input.body.faces.length / 3,
      sameCanvas: viewer?.canvas === document.querySelector('#layer-app #layer-stage canvas'),
      platformReady: window.platformReview?.ready?.() === true,
      coordinateConversion: '[native x,native z,-native y]; no second ground shift'};
  });
  assert.equal(value.bodyType, 'Float32Array'); assert.equal(value.exactYUpBytesMatch, true);
  assert.equal(value.exactTopologyMatch, true); assert.equal(value.sameCanvas, true); assert.equal(value.platformReady, true);
  assert.equal(value.vertices, 25417); assert.equal(value.triangles, 50624);
  assert.equal(value.bodySHA256, '651fe7ced01fd42418347b77dba3d3ad70a7bd8d9b899a94a9790c9624f6e8f3');
  return value;
}
async function webglFacts() {
  return page.locator('#layer-app #layer-stage canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return {context: false};
    const debug = gl.getExtension('WEBGL_debug_renderer_info'), program = gl.getParameter(gl.CURRENT_PROGRAM);
    return {context: true, contextLost: gl.isContextLost(), version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR),
      unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      currentProgramLinked: !!program && gl.getProgramParameter(program, gl.LINK_STATUS),
      drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight};
  });
}
// Lossless PNG decoding/pixel checks copied unchanged from tests/browser-ci.mjs.
// The original screenshot bytes are never repainted, resized, or replaced.
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


async function capture(name) {
  mark('capture:' + name); await idle();
  const fullFile = name + '.png', canvasFile = name + '-canvas.png';
  const full = await page.screenshot({path: path.join(OUT, fullFile), fullPage: false, animations: 'disabled', timeout: SCREENSHOT_MS});
  const canvas = await page.locator('#layer-app #layer-stage canvas').screenshot({path: path.join(OUT, canvasFile), animations: 'disabled', timeout: SCREENSHOT_MS});
  const pixels = pixelStats(decodePNG(canvas)), gl = await webglFacts();
  assert.equal(gl.context, true); assert.equal(gl.contextLost, false); assert.equal(gl.currentProgramLinked, true);
  assert.match(gl.version, /WebGL 2/); assert.match(gl.unmaskedRenderer || gl.renderer, /SwiftShader|llvmpipe|Software/i);
  assert.ok(gl.drawingBufferWidth >= 300 && gl.drawingBufferHeight >= 350);
  assert.ok(pixels.quantizedColors >= 36 && Math.max(...pixels.channelVariance) >= 80 && pixels.horizontalEdges >= 500,
    'Original browser canvas capture is blank or lacks the retained scene detail');
  const value = {name, diagnostic: await diagnostic(), webgl: gl, pixels,
    screenshots: [{file: fullFile, bytes: full.length, sha256: hash(full)}, {file: canvasFile, bytes: canvas.length, sha256: hash(canvas)}]};
  observations.push(value); await jsonFile(name + '.json', value); return value;
}
async function uiWorkerAction(id, requestType) {
  await idle(); const before = await readClothObservation(page, {geometry: true});
  mark('ui:' + id); await page.locator('#layer-app #' + id).click();
  await page.waitForFunction(n => {
    const o = globalThis.__KAOPU_CI_CLOTH_OBSERVER__;
    return o && (o.responseCount > n || o.errors.length > 0);
  }, before.responseCount, {timeout: ACTION_MS, polling: 100});
  await idle(); const after = await readClothObservation(page, {geometry: true});
  assert.equal(after.requestCount - before.requestCount, 1, 'The visible control must send one actual request');
  assert.equal(after.responseCount - before.responseCount, 1);
  assert.equal(after.requests.at(-1).type, requestType); assert.equal(after.responses.at(-1).type, requestType);
  assert.equal(after.errors.length, 0); assert.equal(after.pending.length, 0);
  assert.ok(after.snapshot.id > before.snapshot.id);
  return {before, after, diagnostic: await diagnostic()};
}

try {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This draft may only launch Chromium in GitHub Actions, not the user local environment.');
  assert.equal(process.env.LAYERING_PUBLIC_URL || TARGET, TARGET, 'The smoke is locked to the immutable public R02 HTTPS URL.');
  assert.equal(process.env.SMOKE_EXPECTED_SOURCE_SHA || SOURCE_HEAD, SOURCE_HEAD);
  await fs.mkdir(OUT, {recursive: true});
  const script = await fs.readFile(fileURLToPath(import.meta.url));
  const helperFile = path.join(PROJECT, 'tests/cloth-observer.mjs');
  summary.runnerScript = {file: path.relative(REPO, fileURLToPath(import.meta.url)), bytes: script.length, sha256: hash(script)};
  summary.readOnlyObserver = {file: path.relative(REPO, helperFile), sha256: hash(await fs.readFile(helperFile))};
  ({installClothObserver, readClothObservation, waitForClothIdle} = await import(pathToFileURL(helperFile).href));
  const require = createRequire(path.join(REPO, '.ci-runtime/package.json'));
  const {chromium} = require('playwright');
  summary.playwrightVersion = require('playwright/package.json').version;
  assert.equal(summary.playwrightVersion, '1.64.0');
  watchdog = setTimeout(() => {
    failure ||= Error('Public smoke exceeded its 12-minute browser budget');
    mark('budget-exceeded'); void browser?.close().catch(() => {});
  }, BUDGET_MS);
  browser = await chromium.launch({headless: true, channel: 'chromium', timeout: 60_000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage']});
  summary.browserVersion = browser.version();
  context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1,
    colorScheme: 'light', locale: 'zh-CN', reducedMotion: 'reduce'});
  await installClothObserver(context, {checkpointSteps: [0, 1], checkpointLimit: 4});
  // No routes, mocks, local asset overrides, signed-in state, or application control hooks.
  page = await context.newPage(); page.setDefaultTimeout(60_000);
  page.on('console', m => consoleMessages.push({type: m.type(), text: m.text(), location: m.location(), wallMS: Date.now() - started}));
  page.on('pageerror', e => pageErrors.push({message: e.message, stack: e.stack, wallMS: Date.now() - started}));
  page.on('request', r => network.push({event: 'request', url: r.url(), resourceType: r.resourceType(), wallMS: Date.now() - started}));
  page.on('response', r => network.push({event: 'response', url: r.url(), status: r.status(), resourceType: r.request().resourceType(), wallMS: Date.now() - started}));
  page.on('requestfailed', r => network.push({event: 'requestfailed', url: r.url(), resourceType: r.resourceType(), failure: r.failure()?.errorText, wallMS: Date.now() - started}));
  heartbeat = setInterval(() => {
    console.log('PUBLIC_SMOKE_HEARTBEAT ' + JSON.stringify({phase, wallMS: Date.now() - started, connected: browser.isConnected()}));
  }, 30_000);
  mark('public-source-provenance');
  const provenanceURL = new URL('SOURCE_PROVENANCE.json', TARGET).href;
  const provenanceResponse = await context.request.get(provenanceURL, {timeout: 60_000});
  const provenanceBytes = await provenanceResponse.body();
  summary.publicProvenance = {url: provenanceURL, status: provenanceResponse.status(), bytes: provenanceBytes.length,
    sha256: hash(provenanceBytes), requestKind: 'Explicit read-only HTTPS artifact fingerprint; separate from page network records'};
  assert.equal(provenanceResponse.status(), 200); assert.equal(hash(provenanceBytes), PROVENANCE_SHA);
  await fs.writeFile(path.join(OUT, 'public-SOURCE_PROVENANCE.json'), provenanceBytes);
  mark('public-navigation');
  const navigation = await page.goto(TARGET, {waitUntil: 'domcontentloaded', timeout: 60_000});
  summary.navigation = {status: navigation.status(), requestedURL: TARGET, finalURL: page.url()};
  assert.equal(navigation.status(), 200); assert.equal(page.url(), TARGET);
  await page.waitForFunction(() => {
    const a = document.getElementById('layer-app');
    return a?.dataset.ready === 'true' || a?.dataset.status === 'error';
  }, null, {timeout: READY_MS, polling: 250});
  await idle();
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').count(), 1);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').isVisible(), true);
  assert.equal(await page.locator('#layer-app #layer-loading').isVisible(), false);
  assert.equal(await page.locator('#layer-app #layer-list [data-garment]').count(), 3);
  assert.equal((await page.locator('#layer-app #metric-layers').textContent()).trim(), '3');
  let d = await diagnostic(); verifyGarments(d);
  assert.equal(d.physics.completedSteps, 0); assert.equal(d.physics.simulationSeconds, 0);
  summary.nativeIdentity = await nativeIdentity();
  const initial = await readClothObservation(page, {geometry: true, initialInput: true});
  summary.initialCheckpoint = await rawCheckpoint('initial-worker-observation', initial);
  await capture('initial');

  const step = await uiWorkerAction('step', 'step');
  physicalMetrics(step.diagnostic.physics); verifyGarments(step.diagnostic);
  assert.equal(step.after.audit.completedSteps, step.before.audit.completedSteps + 1);
  assert.ok(Number.isFinite(step.diagnostic.physics.solverMS) && step.diagnostic.physics.solverMS > 0);
  summary.step = {actualWorkerRequestID: step.after.snapshot.id,
    actualPhysicalSteps: step.after.audit.completedSteps - step.before.audit.completedSteps,
    actualPhysicalSeconds: step.after.audit.simulationSeconds - step.before.audit.simulationSeconds,
    movement: motion(step.before.snapshot, step.after.snapshot),
    checkpoint: await rawCheckpoint('stepped-worker-observation', step.after)};
  await capture('stepped');

  const inspection = await uiWorkerAction('audit-contact', 'snapshot');
  const p = inspection.after.audit, previous = inspection.before.audit;
  assert.equal(p.completedSteps, previous.completedSteps); assert.equal(p.simulationSeconds, previous.simulationSeconds);
  assert.deepEqual(geometryDigest(inspection.after.snapshot), geometryDigest(inspection.before.snapshot), 'Manual inspection changed positions, normals or topology');
  assert.equal(p.explicitContactInspection?.measurementOnly, true); assert.equal(p.explicitContactInspection.advancedSimulation, false);
  assert.ok(Number.isFinite(p.explicitContactInspection.measurementMS) && p.explicitContactInspection.measurementMS >= 0);
  assert.deepEqual(inspection.diagnostic.physics.explicitContactInspection, p.explicitContactInspection);
  assert.deepEqual(inspection.diagnostic.physics.contact, JSON.parse(JSON.stringify(p.contact)));
  assert.deepEqual(inspection.diagnostic.physics.bodyEnvelope, JSON.parse(JSON.stringify(p.bodyEnvelope)));
  physicalMetrics(p, true); verifyGarments(inspection.diagnostic);
  const particles = inspection.diagnostic.dynamicGarments.reduce((n, r) => n + r.solverParticles, 0);
  assert.equal(p.bodySampledVertices, particles); assert.equal(p.bodyInsideVertices, 0);
  assert.ok(Number.isFinite(p.bodyMinimumMM) && p.bodyMinimumMM >= 0);
  assert.ok(Number.isFinite(p.bodyThicknessOverlapMM) && p.bodyThicknessOverlapMM <= .001);
  assert.equal(p.bodyEnvelope?.rows?.length, 3);
  assert.deepEqual(p.bodyEnvelope.rows.map(r => r.id).sort(), Object.keys(EXPECTED).sort());
  assert.equal(p.bodyEnvelope.triangles, inspection.diagnostic.dynamicGarments.reduce((n, r) => n + r.solverTriangles, 0));
  assert.ok(Number.isFinite(p.bodyEnvelope.maxHalfThicknessOverlapM) && p.bodyEnvelope.maxHalfThicknessOverlapM <= .000001);
  assert.ok(p.bodyEnvelope.rows.every(r => r.measurementOnly === true && r.residualMeasured === true));
  summary.manualInspection = {advancedSimulation: false, geometryUnchanged: true,
    requestID: inspection.after.snapshot.id, geometryDigest: geometryDigest(inspection.after.snapshot),
    explicitContactInspection: p.explicitContactInspection,
    checkpoint: await rawCheckpoint('manual-inspection-worker-observation', inspection.after)};
  // Open the existing disclosure through UI so the published JSON is visibly accessible.
  if (await page.locator('#layer-app #help').getAttribute('open') === null)
    await page.locator('#layer-app #help > summary').click();
  assert.equal(await page.locator('#layer-app #diagnostics').isVisible(), true);
  await capture('manual-inspection');
  const final = await readClothObservation(page, {geometry: true});
  assert.equal(final.requests.filter(r => r.type === 'step').length, 1);
  assert.equal(final.requests.filter(r => r.type === 'snapshot').length, 1);
  assert.equal(final.audit.completedSteps, 1); assert.equal(final.errors.length, 0);
  assert.deepEqual(geometryDigest(final.snapshot), geometryDigest(inspection.after.snapshot));
  summary.actualRequestTypes = final.requests.map(r => r.type);
  summary.workerErrors = final.errors;
  // A browser-initiated site-root favicon is not an application dependency.
  // Preserve any such 404 explicitly; never ignore a failed app script/asset.
  const rootFavicon = new URL('/favicon.ico', TARGET).href;
  const issues = network.filter(r => r.event === 'requestfailed' || (r.event === 'response' && r.status >= 400));
  summary.nonApplicationFaviconIssues = issues.filter(r => r.url === rootFavicon && r.status === 404);
  summary.applicationNetworkIssues = issues.filter(r => !(r.url === rootFavicon && r.status === 404));
  summary.consoleErrors = consoleMessages.filter(r => r.type === 'error');
  const faviconConsole = summary.consoleErrors.filter(r => r.location.url === rootFavicon
    && /^Failed to load resource: the server responded with a status of 404\b/.test(r.text));
  // Chromium may report its browser-initiated favicon in the page console but
  // omit that request from page.on('request'/'response'). Verify the exact URL
  // explicitly before classifying only this exact 404 as non-application.
  if (faviconConsole.length && summary.nonApplicationFaviconIssues.length === 0) {
    const response = await context.request.get(rootFavicon, {timeout: 30_000});
    summary.siteRootFaviconProbe = {url: rootFavicon, finalURL: response.url(), status: response.status(),
      requestKind: 'Explicit read-only HTTPS check of the exact browser-reported site-root favicon'};
    if (response.status() === 404 && response.url() === rootFavicon)
      summary.nonApplicationFaviconIssues.push({event: 'explicit-http-verification', url: rootFavicon, status: 404});
  }
  summary.nonApplicationFaviconConsole = summary.nonApplicationFaviconIssues.length ? faviconConsole : [];
  const criticalConsole = summary.consoleErrors.filter(r => !summary.nonApplicationFaviconConsole.includes(r));
  summary.applicationConsoleErrors = criticalConsole;
  assert.equal(pageErrors.length, 0, 'Browser pageerror occurred');
  assert.equal(summary.applicationNetworkIssues.length, 0, 'A public application dependency failed');
  assert.equal(criticalConsole.length, 0, 'Browser console error occurred');
  if (failure) throw failure;
  summary.passed = true; mark('completed');
} catch (error) {
  failure ||= error; summary.passed = false;
  summary.error = {message: failure.message, stack: failure.stack, phase};
  if (page && !page.isClosed()) {
    try {summary.failureDOM = await page.locator('#layer-app').innerText({timeout: 5000});} catch (e) {summary.failureDOMError = String(e);}
    try {
      const actual = await readClothObservation(page, {geometry: true});
      summary.failureWorkerObservation = await rawCheckpoint('failure-latest-accepted-worker-observation', actual);
      summary.failureGeometryMeaning = 'Latest successful real Worker reply; not rejected-step geometry. Worker errors retain their own diagnostics.';
    } catch (e) {summary.failureObserverError = String(e);}
    try {await page.screenshot({path: path.join(OUT, 'failure.png'), fullPage: false, timeout: 30_000});}
    catch (e) {summary.failureScreenshotError = String(e);}
  }
} finally {
  clearTimeout(watchdog); clearInterval(heartbeat);
  summary.elapsedMS = Date.now() - started; summary.lastPhase = phase; summary.observations = observations;
  summary.pageErrors = pageErrors; summary.networkEventCount = network.length;
  await fs.mkdir(OUT, {recursive: true});
  try {await writes;} catch (e) {summary.evidenceWriteError = String(e); summary.passed = false; failure ||= e;}
  await Promise.all([jsonFile('public-smoke-summary.json', summary), jsonFile('browser-network.json', network),
    jsonFile('browser-console.json', consoleMessages), jsonFile('browser-errors.json', pageErrors), jsonFile('progress.json', progress)]);
  await context?.close().catch(() => {}); await browser?.close().catch(() => {});
}
console.log(JSON.stringify({passed: summary.passed, target: TARGET, execution: summary.execution,
  output: OUT, physicalSteps: summary.step?.actualPhysicalSteps || 0,
  manualInspectionAdvancedClock: summary.manualInspection?.advancedSimulation ?? null,
  error: summary.error?.message || null}, null, 2));
if (failure) process.exitCode = 1;
