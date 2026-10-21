// Bounded acceptance of the actual R03 page, on a CI localhost server or its
// public URL. This does not replace the full release matrix. No application
// API, clock, readiness flag, geometry, material or sampler is patched.
// The existing read-only observer records the real cloth Worker traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync, inflateSync} from 'node:zlib';
import {installClothObserver, readClothObservation, waitForClothIdle} from './cloth-observer.mjs';
import {auditObservedGeometry, assertNoObservedCrossings} from './observed-geometry.mjs';
import {verifyReferenceBodyLoading} from './reference-body-observation.mjs';

if (process.argv.includes('--help')) {
  console.log(`R03 real-browser smoke (run in GitHub Actions, not this interactive workspace)

Install: npm install --prefix experiments/tailor-layering-r03/.ci-runtime playwright@1.64.0
Browser: experiments/tailor-layering-r03/.ci-runtime/node_modules/.bin/playwright install --with-deps chromium
Local:   build with LAYERING_SOURCE_SHA=<40-char-source-sha>, serve dist/
         on http://127.0.0.1:8765/ in the CI job, then
         node experiments/tailor-layering-r03/tests/public-smoke.mjs
Public:  LAYERING_PUBLIC_URL=https://host/path/ LAYERING_EXPECT_SOURCE_SHA=<40-char-source-sha> \\
         node experiments/tailor-layering-r03/tests/public-smoke.mjs

LAYERING_PUBLIC_URL defaults to http://127.0.0.1:8765/.
LAYERING_EXPECT_SOURCE_SHA is required for public URLs. For localhost only,
it may default to the local dist/SOURCE_PROVENANCE.json sourceCommit.
LAYERING_SMOKE_EVIDENCE_DIR optionally overrides evidence/public-smoke/.
The script does not start a server, build, publish, sign in or edit the page.
It requires GITHUB_ACTIONS=true, Node 22+, Playwright 1.64.0 and Chromium.
SwiftShader preserves the original scene; its timings do not represent user GPUs.
Allow a 20-minute test budget plus CI setup/artifact upload time.
Evidence includes original browser PNGs, exact-source readbacks, raw numeric
Worker observations (.json.gz), summary, console, network, errors and progress.
`);
  process.exit(0);
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TARGET = new URL(process.env.LAYERING_PUBLIC_URL || 'http://127.0.0.1:8765/');
if (!TARGET.pathname.endsWith('/') && !/\.html?$/i.test(TARGET.pathname)) TARGET.pathname += '/';
const BASE = TARGET.href;
const EVIDENCE = path.resolve(process.env.LAYERING_SMOKE_EVIDENCE_DIR || path.join(ROOT, 'evidence/public-smoke'));
const TIMEOUT = {ready: 480_000, action: 120_000, worker: 100_000, gpu: 180_000,
  screenshot: 180_000, browser: 1_200_000};
const VERSION = 'TAILOR-LAYERING-R03';
const UPSTREAM = 'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49';
const PERSON = 'd413d108704af47cf531ee8c25d93f682c3176e3';
const EXPECTED = {inner: {preset: 'T08', material: 'knit-fine-0'},
  outer: {preset: 'T03', material: 'knit-soft-0'}, pants: {preset: 'P02', material: 'denim-raw'}};
const LIMITS = {maxEdgeStretch: 1.45, seamGapMM: .01, contactResidualM: .0005,
  bodyHalfThicknessOverlapMM: .001};
const began = Date.now(), observations = [], consoleMessages = [], pageErrors = [];
const requestStarts = [], network = [], forbiddenRequests = [], resourceReadbacks = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let browser, context, page, watchdog, heartbeat, expectedSHA, provenance, failure;
let phase = 'setup', writes = Promise.resolve(), nativeInput;
const summary = {schema: 'kaopu-r03-public-smoke@1', startedUTC: new Date().toISOString(),
  targetURL: BASE, passed: false, publicationPerformed: false,
  fullReleaseMatrixReplaced: false, visualAcceptance: false, productionReady: false,
  screenshotsAreOriginalBrowserCaptures: true, execution: 'GitHub Actions / fresh Chromium / SwiftShader',
  readinessContract: '#layer-app data-ready + published diagnostics + actual Worker and GPU frame completion',
  budgetsMS: TIMEOUT, viewport: {width: 1440, height: 1000, deviceScaleFactor: 1}, limits: LIMITS,
  limitations: [
    'One actual 1/120-second step, one read-only audit, execution toggles and one camera operation; the full CI matrix is still required.',
    'The original static native person, T08/T03 knits and P02 denim remain intact; no dynamic-body or arbitrary-layering certification.',
    'Independent complete discrete surface checks do not certify time between snapshots, self-collision or individual yarns.',
    'SwiftShader CPU/GPU timings and observer overhead do not represent user hardware or establish real-time performance.',
    'Execution toggles test preservation of this current state; equal-duration ON/OFF solver replay belongs to the separate native A/B suite.',
  ]};

async function writeJSON(name, value) {
  await fs.writeFile(path.join(EVIDENCE, name), JSON.stringify(value, null, 2) + '\n');
}
function progress(kind, extra = {}) {
  const row = {kind, phase, wallMS: Date.now() - began, observedUTC: new Date().toISOString(), ...extra};
  writes = writes.then(() => fs.appendFile(path.join(EVIDENCE, 'progress.ndjson'), JSON.stringify(row) + '\n'))
    .catch(error => {failure ??= error;});
  console.log('R03_SMOKE_PROGRESS ' + JSON.stringify(row));
}
function mark(value) {phase = value; progress('phase');}
async function bounded(promise, ms, message) {
  let timer;
  try {return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  })]);} finally {clearTimeout(timer);}
}
async function fetchBuildFile(name) {
  const url = new URL(name, BASE).href;
  const response = await context.request.get(url, {timeout: 60_000,
    headers: {'Cache-Control': 'no-cache', Pragma: 'no-cache'}});
  const bytes = await response.body();
  resourceReadbacks.push({path: name, requestedURL: url, finalURL: response.url(),
    status: response.status(), bytes: bytes.length, sha256: sha256(bytes)});
  assert.equal(response.status(), 200, name + ' must return HTTP 200');
  assert.equal(new URL(response.url()).origin, TARGET.origin, 'A build file redirected off origin');
  return bytes;
}
async function diagnostic() {
  const value = JSON.parse(await page.locator('#layer-app #diagnostics').textContent());
  assert.equal(value.error, null, 'Application error: ' + value.error);
  assert.equal(value.ready, true, 'The actual native scene is not ready');
  assert.equal(value.version, VERSION);
  assert.equal(value.sourceCommit, expectedSHA, 'The page is not the expected source commit');
  return value;
}
async function waitIdle() {
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app');
    if (app?.dataset.status === 'error') return true;
    if (app?.dataset.ready !== 'true' || app.querySelector('#reset')?.disabled
      || app.dataset.busy === 'true' || app.dataset.renderPending === 'true'
      || app.dataset.renderInFlight === 'true') return false;
    let value;
    try {value = JSON.parse(app.querySelector('#diagnostics')?.textContent || 'null');} catch {return false;}
    const gate = value?.render?.frameGate, queue = value?.render?.presentationQueue;
    if (value?.error || gate?.failed) return true;
    return gate && gate.pending === 0 && gate.inFlight === 0
      && (!queue || (queue.pending === false && queue.inFlight === false));
  }, null, {timeout: TIMEOUT.gpu, polling: 250});
  const value = await diagnostic(), gate = value.render.frameGate, queue = value.render.presentationQueue;
  assert.equal(gate.failed, false);
  assert.equal(gate.pending, 0); assert.equal(gate.inFlight, 0);
  assert.ok(gate.submitted > 0 && gate.completed === gate.submitted, 'Every native GPU frame must finish');
  assert.ok(queue && queue.pending === false && queue.inFlight === false, 'Presentation is not idle');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
function verifyGarments(value) {
  assert.deepEqual(value.dynamicGarments.map(row => row.id).sort(), Object.keys(EXPECTED).sort());
  assert.equal(value.physics.garmentCount, 3);
  assert.equal(value.playing, false);
  assert.equal(value.displayOnlySeparation, false); assert.equal(value.displayOnlyIsolation, false);
  assert.equal(value.nativePerson.sameModel, true); assert.equal(value.nativePerson.sameViewer, true);
  assert.equal(value.nativePerson.revision, PERSON); assert.equal(value.nativePerson.iframes, 0);
  assert.match(value.nativePerson.topology, /^[0-9a-f]{64}$/);
  assert.equal(value.physics.staticNativeBody, true); assert.equal(value.physics.temporaryBodyMotion, false);
  assert.equal(value.physics.continuousCollision, false); assert.equal(value.physics.sweptVertexFace, true);
  assert.equal(value.physics.edgeEdgeCollision, true); assert.equal(value.physics.kinematicShapeAttraction, false);
  assert.equal(value.physics.contactEnabled, true);
  assert.equal(value.render.demand.hiddenSimulationSkipped, false);
  assert.equal(value.render.demand.occludedRegionCullingImplemented, false);
  for (const row of value.dynamicGarments) {
    assert.equal(row.preset, EXPECTED[row.id].preset); assert.equal(row.material, EXPECTED[row.id].material);
    for (const key of ['displayVertices', 'solverParticles', 'solverTriangles', 'yarnSpans', 'envelopeMM']) {
      assert.ok(Number.isFinite(row[key]) && row[key] > 0, row.id + '.' + key + ' must describe real geometry');
    }
    assert.equal(row.opaqueBackingSheets, 0); assert.equal(row.fixedDistanceTiers, false);
    assert.match(row.representation, /closed.*yarns.*continuous sampling/);
  }
  assert.ok(value.render.calls > 0 && value.render.triangles > 1000, 'Actual native drawing is required');
}
function verifyPhysics(value, fullBody = false) {
  const p = value.physics;
  for (const [key, maximum] of [['maxEdgeStretch', LIMITS.maxEdgeStretch], ['seamGapMM', LIMITS.seamGapMM]]) {
    assert.ok(Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= maximum, key + ' exceeded the unchanged limit');
  }
  assert.ok(Number.isFinite(p.contact?.residualMaxPenetration)
    && p.contact.residualMaxPenetration <= LIMITS.contactResidualM, 'Cloth thickness residual exceeded 0.5 mm');
  if (!fullBody) {assert.equal(p.contact.measuredAfterBodyProjection, true); return;}
  assert.equal(p.explicitContactInspection?.measurementOnly, true);
  assert.equal(p.explicitContactInspection.advancedSimulation, false);
  assert.ok(Number.isFinite(p.explicitContactInspection.measurementMS) && p.explicitContactInspection.measurementMS >= 0);
  assert.equal(p.contact.measurementOnly, true);
  const particles = value.dynamicGarments.reduce((sum, row) => sum + row.solverParticles, 0);
  assert.equal(p.bodySampledVertices, particles); assert.equal(p.bodyInsideVertices, 0);
  assert.ok(Number.isFinite(p.bodyMinimumMM) && p.bodyMinimumMM >= 0);
  assert.ok(Number.isFinite(p.bodyThicknessOverlapMM) && p.bodyThicknessOverlapMM >= 0
    && p.bodyThicknessOverlapMM <= LIMITS.bodyHalfThicknessOverlapMM);
  assert.deepEqual(p.bodyPerGarment.map(row => row.id).sort(), Object.keys(EXPECTED).sort());
  for (const row of p.bodyPerGarment) assert.ok(Number.isFinite(row.minimumHalfThicknessClearanceMM)
    && row.minimumHalfThicknessClearanceMM >= -LIMITS.bodyHalfThicknessOverlapMM);
  const envelope = p.bodyEnvelope;
  assert.deepEqual(envelope.rows.map(row => row.id).sort(), Object.keys(EXPECTED).sort());
  assert.equal(envelope.triangles, value.dynamicGarments.reduce((sum, row) => sum + row.solverTriangles, 0));
  assert.ok(Number.isFinite(envelope.maxHalfThicknessOverlapM) && envelope.maxHalfThicknessOverlapM >= 0
    && envelope.maxHalfThicknessOverlapM <= LIMITS.bodyHalfThicknessOverlapMM / 1000);
  for (const row of envelope.rows) {assert.equal(row.measurementOnly, true); assert.equal(row.residualMeasured, true);}
}
function geometryDigest(snapshot) {
  assert.ok(snapshot?.rows?.length === 3, 'The real Worker must contain three independent clothes');
  const hashArray = (values, Type) => {
    const a = Type.from(values); return sha256(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  };
  return snapshot.rows.map(row => ({id: row.id, positions: hashArray(row.positions, Float32Array),
    normals: hashArray(row.normals, Float32Array), indices: hashArray(row.indices, Uint32Array)}))
    .sort((a, b) => a.id.localeCompare(b.id));
}
async function state({initialInput = false} = {}) {
  await waitForClothIdle(page, TIMEOUT.worker); await waitIdle();
  const traffic = await readClothObservation(page, {geometry: true, initialInput});
  const value = await diagnostic();
  assert.equal(traffic.errors.length, 0); assert.equal(traffic.pending.length, 0);
  assert.deepEqual(value.physics, JSON.parse(JSON.stringify(traffic.audit)), 'Published physics differs from its real Worker reply');
  verifyGarments(value);
  return {diagnostic: value, traffic, digest: geometryDigest(traffic.snapshot)};
}
function assertUnmoved(before, after, reason) {
  assert.equal(after.traffic.audit.completedSteps, before.traffic.audit.completedSteps, reason + ' changed the step count');
  assert.equal(after.traffic.audit.simulationSeconds, before.traffic.audit.simulationSeconds, reason + ' changed the physical clock');
  assert.equal(after.traffic.checkpointGeneration, before.traffic.checkpointGeneration, reason + ' restarted the world');
  assert.deepEqual(after.digest, before.digest, reason + ' changed actual positions, normals or topology');
}
async function record(name, current, extra = {}) {
  const rawName = name + '-worker.json.gz';
  const raw = gzipSync(Buffer.from(JSON.stringify({schema: 'kaopu-smoke-worker-observation@1',
    scope: 'Read-only observation of actual Worker requests/replies; no substitute geometry', traffic: current.traffic})), {level: 6});
  await fs.writeFile(path.join(EVIDENCE, rawName), raw);
  const entry = {name, wallMS: Date.now() - began, diagnostic: current.diagnostic,
    actualWorkerReply: current.traffic.snapshot.id, geometryDigest: current.digest,
    workerObservation: {file: rawName, sha256: sha256(raw), bytes: raw.length}, ...extra};
  observations.push(entry); await writeJSON(name + '.json', entry);
}
async function workerAction(name, type, before, action) {
  mark(name); await action();
  await page.waitForFunction(id => {
    const o = globalThis.__KAOPU_CI_CLOTH_OBSERVER__;
    return o?.errors.length || document.getElementById('layer-app')?.dataset.status === 'error'
      || (o?.latest?.id > id && o.pending.size === 0);
  }, before.traffic.snapshot.id, {timeout: TIMEOUT.worker, polling: 100});
  const after = await state();
  assert.equal(after.traffic.requestCount, before.traffic.requestCount + 1, name + ' must send exactly one real Worker action');
  assert.equal(after.traffic.responseCount, before.traffic.responseCount + 1);
  assert.equal(after.traffic.responses.at(-1).type, type);
  assert.equal(after.traffic.responses.at(-1).id, after.traffic.snapshot.id);
  return after;
}

// Decode only the original lossless browser PNG, using the existing CI pixel
// gate. No pixels are generated, repainted, composited or substituted.
function decodePNG(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const pieces = []; let width, height, depth, color, interlace;
  for (let at = 8; at + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(at), type = buffer.toString('ascii', at + 4, at + 8);
    assert.ok(at + 12 + length <= buffer.length, 'Truncated browser PNG');
    const data = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12];}
    if (type === 'IDAT') pieces.push(data);
    at += length + 12; if (type === 'IEND') break;
  }
  assert.equal(depth, 8); assert.equal(interlace, 0);
  const channels = {0: 1, 2: 3, 4: 2, 6: 4}[color]; assert.ok(channels);
  const stride = width * channels, raw = inflateSync(Buffer.concat(pieces)), decoded = new Uint8Array(stride * height);
  assert.equal(raw.length, (stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, left = x >= channels ? decoded[i - channels] : 0;
      const up = y ? decoded[i - stride] : 0, corner = y && x >= channels ? decoded[i - stride - channels] : 0;
      const p = left + up - corner, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
      const paeth = a <= b && a <= c ? left : b <= c ? up : corner;
      const correction = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      decoded[i] = (raw[y * (stride + 1) + x + 1] + correction) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < decoded.length; i += channels, p += 4) {
    const gray = color === 0 || color === 4;
    rgba[p] = decoded[i]; rgba[p + 1] = decoded[i + (gray ? 0 : 1)]; rgba[p + 2] = decoded[i + (gray ? 0 : 2)];
    rgba[p + 3] = color === 6 ? decoded[i + 3] : color === 4 ? decoded[i + 1] : 255;
  }
  return {width, height, rgba};
}
function pixelStats(image) {
  const bins = new Set(), sums = [0, 0, 0], squares = [0, 0, 0]; let edges = 0;
  for (let p = 0; p < image.rgba.length; p += 4) {
    const [r, g, b] = image.rgba.subarray(p, p + 3); bins.add((r >> 4) * 256 + (g >> 4) * 16 + (b >> 4));
    let difference = 0;
    for (let c = 0; c < 3; c++) {
      sums[c] += image.rgba[p + c]; squares[c] += image.rgba[p + c] ** 2;
      if ((p / 4) % image.width) difference = Math.max(difference, Math.abs(image.rgba[p + c] - image.rgba[p - 4 + c]));
    }
    if (difference > 15) edges++;
  }
  const count = image.width * image.height;
  return {width: image.width, height: image.height, quantizedColors: bins.size, horizontalEdges: edges,
    channelVariance: squares.map((value, c) => value / count - (sums[c] / count) ** 2)};
}
async function capture(name) {
  mark('capture:' + name); await waitIdle();
  const pageBytes = await page.screenshot({path: path.join(EVIDENCE, name + '.png'),
    fullPage: false, animations: 'disabled', timeout: TIMEOUT.screenshot});
  const canvas = page.locator('#layer-app #layer-stage canvas');
  const bytes = await canvas.screenshot({path: path.join(EVIDENCE, name + '-canvas.png'),
    animations: 'disabled', timeout: TIMEOUT.screenshot});
  const image = decodePNG(bytes), pixels = pixelStats(image);
  const webgl = await canvas.evaluate(canvas => {
    const gl = canvas.getContext('webgl2'); if (!gl) return {context: false};
    const extension = gl.getExtension('WEBGL_debug_renderer_info'), program = gl.getParameter(gl.CURRENT_PROGRAM);
    return {context: true, contextLost: gl.isContextLost(), version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR),
      unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight,
      currentProgram: !!program, linked: program ? gl.getProgramParameter(program, gl.LINK_STATUS) : false,
      iframes: document.querySelectorAll('iframe').length};
  });
  const report = {name, pixels, webgl, screenshots: [
    {file: name + '.png', sha256: sha256(pageBytes), bytes: pageBytes.length},
    {file: name + '-canvas.png', sha256: sha256(bytes), bytes: bytes.length}]};
  (summary.captures ??= []).push(report); await writeJSON(name + '-capture.json', report);
  assert.equal(webgl.context, true); assert.equal(webgl.contextLost, false); assert.equal(webgl.iframes, 0);
  assert.equal(webgl.currentProgram, true); assert.equal(webgl.linked, true); assert.match(webgl.version, /WebGL 2/);
  assert.ok(webgl.drawingBufferWidth >= 300 && webgl.drawingBufferHeight >= 350);
  assert.ok(pixels.quantizedColors >= 36 && Math.max(...pixels.channelVariance) >= 80
    && pixels.horizontalEdges >= 500, 'The raw native canvas capture is blank or lacks scene detail');
  return image;
}
async function nativeIdentity() {
  const result = await page.evaluate(async () => {
    const input = globalThis.__KAOPU_CI_CLOTH_OBSERVER__?.init;
    const model = window.__IDENTITY_QA__?.model?.(), viewer = window.__IDENTITY_QA__?.viewer?.();
    if (!input?.body || !model?.positions || !model?.faces) throw new Error('Actual native model/init input missing');
    const expected = new Float32Array(model.positions.length);
    for (let i = 0; i < expected.length; i += 3) {
      expected[i] = model.positions[i]; expected[i + 1] = model.positions[i + 2]; expected[i + 2] = -model.positions[i + 1];
    }
    const bytes = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const actual = bytes(input.body.positions), original = bytes(expected);
    const digest = async a => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(a)))].map(v => v.toString(16).padStart(2, '0')).join('');
    return {positionType: input.body.positions.constructor.name,
      exactYUpBytesMatch: actual.length === original.length && actual.every((v, i) => v === original[i]),
      exactTopologyMatch: input.body.faces.length === model.faces.length && input.body.faces.every((v, i) => v === model.faces[i]),
      nativeGeometrySHA256: await digest(model.positions), observedBodySHA256: await digest(input.body.positions),
      vertices: input.body.positions.length / 3, triangles: input.body.faces.length / 3,
      sameCanvas: viewer?.canvas === document.querySelector('#layer-app #layer-stage canvas'),
      platformReady: window.platformReview?.ready?.() === true};
  });
  assert.equal(result.positionType, 'Float32Array'); assert.equal(result.exactYUpBytesMatch, true);
  assert.equal(result.exactTopologyMatch, true); assert.equal(result.sameCanvas, true); assert.equal(result.platformReady, true);
  assert.equal(result.vertices, 25417); assert.equal(result.triangles, 50624); return result;
}

try {
  await fs.mkdir(EVIDENCE, {recursive: true});
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This test launches Chromium only in GitHub Actions, as the existing browser suites require.');
  assert.ok(['http:', 'https:'].includes(TARGET.protocol), 'Use an HTTP(S) build URL');
  assert.equal(TARGET.username + TARGET.password, '', 'Use a public build without embedded credentials');
  expectedSHA = process.env.LAYERING_EXPECT_SOURCE_SHA;
  if (!expectedSHA) {
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(TARGET.hostname), 'Public smoke requires LAYERING_EXPECT_SOURCE_SHA; never infer expected identity from the remote page.');
    expectedSHA = JSON.parse(await fs.readFile(path.join(ROOT, 'dist/SOURCE_PROVENANCE.json'), 'utf8')).sourceCommit;
    summary.expectedSourceOrigin = 'Local dist/SOURCE_PROVENANCE.json';
  } else summary.expectedSourceOrigin = 'LAYERING_EXPECT_SOURCE_SHA';
  assert.match(expectedSHA, /^[0-9a-f]{40}$/, 'Expected source identity must be a full lowercase commit SHA');
  summary.expectedSourceCommit = expectedSHA;
  summary.ci = {runID: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    workflowCommit: process.env.GITHUB_SHA, repository: process.env.GITHUB_REPOSITORY};
  const require = createRequire(path.join(ROOT, '.ci-runtime/package.json'));
  const {chromium} = require('playwright');
  summary.playwrightVersion = require('playwright/package.json').version;
  assert.equal(summary.playwrightVersion, '1.64.0');
  watchdog = setTimeout(() => {
    failure ??= new Error('Public smoke exceeded its 20-minute budget'); progress('watchdog');
    browser?.close().catch(() => {});
  }, TIMEOUT.browser);
  browser = await chromium.launch({headless: true, channel: 'chromium', timeout: 60_000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage']});
  summary.browserVersion = browser.version();
  context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1,
    colorScheme: 'light', locale: 'zh-CN', reducedMotion: 'reduce', serviceWorkers: 'block'});
  await installClothObserver(context, {checkpointSteps: [0, 1], checkpointLimit: 4});
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === TARGET.origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    forbiddenRequests.push({url: url.href, type: route.request().resourceType()}); return route.abort('blockedbyclient');
  });
  page = await context.newPage(); page.setDefaultTimeout(TIMEOUT.action);
  page.on('console', message => consoleMessages.push({type: message.type(), text: message.text(), location: message.location(), wallMS: Date.now() - began}));
  page.on('pageerror', error => {pageErrors.push({message: error.message, stack: error.stack}); progress('page-error', {message: error.message});});
  page.on('request', request => requestStarts.push({url: request.url(), type: request.resourceType(), wallMS: Date.now() - began}));
  page.on('response', response => network.push({url: response.url(), status: response.status(), type: response.request().resourceType(), wallMS: Date.now() - began}));
  page.on('requestfailed', request => network.push({url: request.url(), failure: request.failure()?.errorText, type: request.resourceType(), wallMS: Date.now() - began}));
  heartbeat = setInterval(() => progress('heartbeat', {browserConnected: browser.isConnected()}), 15_000);
  mark('exact-source-readback');
  const provenanceBytes = await fetchBuildFile('SOURCE_PROVENANCE.json');
  provenance = JSON.parse(provenanceBytes);
  assert.equal(provenance.version, VERSION); assert.equal(provenance.sourceCommit, expectedSHA);
  assert.equal(provenance.upstreamRevision, UPSTREAM); assert.equal(provenance.personRevision, PERSON);
  assert.equal(provenance.sameDocumentNativeHost, true); assert.equal(provenance.iframeRequired, false);
  assert.equal(provenance.upstreamFiles.length, 286);
  await fs.writeFile(path.join(EVIDENCE, 'SOURCE_PROVENANCE.json'), provenanceBytes);
  const manifestBytes = await fetchBuildFile('BUILD_MANIFEST.json'), manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.version, VERSION); assert.equal(manifest.personRevision, PERSON);
  assert.equal(manifest.physicalSleep, false); assert.equal(manifest.automaticOccludedRegionCulling, false);
  assert.deepEqual(manifest.garments.map(row => ({id: row.id, preset: row.pattern, material: row.material})).sort((a, b) => a.id.localeCompare(b.id)),
    Object.entries(EXPECTED).map(([id, row]) => ({id, ...row})).sort((a, b) => a.id.localeCompare(b.id)));
  await fs.writeFile(path.join(EVIDENCE, 'BUILD_MANIFEST.json'), manifestBytes);
  for (const name of ['app.mjs', 'layer-worker.mjs', 'layer-world.mjs', 'layer-contact.mjs', 'local-broadphase.mjs', 'body-envelope.mjs', 'render-demand.mjs']) {
    const entry = provenance.authoredFiles.find(row => row.path === name); assert.ok(entry, 'Missing source fingerprint: ' + name);
    const bytes = await fetchBuildFile(name); assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256, 'Stale or mixed source file: ' + name);
  }
  mark('native-scene-ready');
  const navigation = await page.goto(BASE, {waitUntil: 'domcontentloaded', timeout: 60_000});
  assert.equal(navigation?.status(), 200, 'The final workbench entry must return HTTP 200');
  summary.finalURL = page.url();
  assert.equal(new URL(summary.finalURL).origin, TARGET.origin);
  assert.equal(sha256(await navigation.body()), provenance.hostHTML.sha256, 'Entry HTML differs from the verified build');
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app');
    return app?.dataset.ready === 'true' || app?.dataset.status === 'error';
  }, null, {timeout: TIMEOUT.ready, polling: 250});
  assert.equal(await page.locator('#layer-app').getAttribute('data-ready'), 'true',
    await page.locator('#layer-app #load-text').textContent());
  const initial = await state({initialInput: true}); nativeInput = initial.traffic.init;
  assert.equal(initial.traffic.audit.completedSteps, 0); assert.equal(initial.traffic.audit.simulationSeconds, 0);
  assert.equal(initial.traffic.audit.execution.contactDemand, true);
  assert.equal(await page.locator('#layer-app #contact-demand').isChecked(), true);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').count(), 1);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').isVisible(), true);
  assert.equal(await page.locator('#layer-app #layer-loading').isVisible(), false);
  assert.equal(await page.locator('#layer-app #layer-list [data-garment]').count(), 3);
  summary.nativeIdentity = await nativeIdentity();
  await record('initial', initial); await capture('initial');

  const stepped = await workerAction('one-step', 'step', initial, () => page.locator('#layer-app #step').click());
  await record('one-step', stepped);
  assert.equal(stepped.traffic.audit.completedSteps, 1); assert.equal(stepped.traffic.audit.simulationSeconds, 1 / 120);
  assert.equal(stepped.traffic.audit.nominalStepSeconds, 1 / 120);
  assert.ok(Number.isFinite(stepped.traffic.audit.solverMS) && stepped.traffic.audit.solverMS > 0);
  assert.ok(stepped.traffic.audit.execution.lastStepWork?.body && stepped.traffic.audit.execution.lastStepWork?.layer);
  // The retained native first-step fixture moves each independently simulated
  // garment. A clock-only reply or a frozen supporting inner layer must fail.
  for (const row of stepped.digest) {
    const before = initial.digest.find(item => item.id === row.id);
    assert.notEqual(row.positions, before.positions, row.id + ' did not respond to the actual first solver step');
    assert.equal(row.indices, before.indices, row.id + ' changed topology during a step');
  }
  verifyPhysics(stepped.diagnostic);
  const audited = await workerAction('manual-audit', 'snapshot', stepped, () => page.locator('#layer-app #audit-contact').click());
  await record('manual-audit', audited); assertUnmoved(stepped, audited, 'Manual contact audit');
  verifyPhysics(audited.diagnostic, true);
  const geometryReport = auditObservedGeometry({body: nativeInput.body, snapshot: audited.traffic.snapshot});
  await writeJSON('manual-audit-independent-geometry.json', geometryReport);
  assertNoObservedCrossings(geometryReport);
  summary.independentGeometry = {file: 'manual-audit-independent-geometry.json', garmentPairs: geometryReport.garmentPairs,
    bodyPairs: geometryReport.bodyPairs, scope: geometryReport.scope};
  const frontPixels = await capture('after-step-audit');
  let current = audited;
  for (const enabled of [false, true]) {
    const name = 'contact-demand-' + (enabled ? 'on' : 'off');
    const after = await workerAction(name, 'execution', current, () => page.locator('#layer-app #contact-demand').setChecked(enabled));
    await record(name, after); assertUnmoved(current, after, name);
    assert.equal(after.traffic.audit.execution.contactDemand, enabled);
    assert.equal(after.traffic.audit.execution.lastStepWork, null, 'A toggle must not impersonate a new solver step');
    assert.equal(await page.locator('#layer-app #contact-demand').isChecked(), enabled);
    current = after;
  }
  summary.contactDemandToggle = {sequence: [false, true], completedSteps: current.traffic.audit.completedSteps,
    simulationSeconds: current.traffic.audit.simulationSeconds, unchangedGeometryDigest: current.digest,
    changedPhysicalClock: false, restartedWorld: false};

  mark('view-side');
  const cameraPosition = () => page.evaluate(() => window.__IDENTITY_QA__.viewer().camera.position.toArray());
  const previousCamera = await cameraPosition(), previousFrames = current.diagnostic.render.frameGate.submitted;
  await page.locator('#layer-app #view-side').click();
  const side = await state(); await record('view-side', side); assertUnmoved(current, side, 'Camera operation');
  assert.equal(side.traffic.requestCount, current.traffic.requestCount, 'Camera controls must not send physics actions');
  assert.notDeepEqual(await cameraPosition(), previousCamera, 'The visible side-view control did not move the real camera');
  assert.ok(side.diagnostic.render.frameGate.submitted > previousFrames, 'Camera operation did not submit a native frame');
  const sidePixels = await capture('view-side');
  assert.equal(sidePixels.width, frontPixels.width); assert.equal(sidePixels.height, frontPixels.height);
  let changed = 0;
  for (let i = 0; i < sidePixels.rgba.length; i += 4) if ([0, 1, 2].some(c => Math.abs(sidePixels.rgba[i + c] - frontPixels.rgba[i + c]) > 12)) changed++;
  summary.cameraChange = {changedPixels: changed, changedFraction: changed / (sidePixels.width * sidePixels.height)};
  assert.ok(summary.cameraChange.changedFraction > .005, 'The native canvas did not visibly respond to the camera control');
  assert.deepEqual(side.traffic.requests.map(row => row.type), ['init', 'step', 'snapshot', 'execution', 'execution'], 'Unexpected physics action or reinitialization during smoke');
  summary.referenceBodyLoading = verifyReferenceBodyLoading({baseURL: BASE, provenance,
    allocation: initial.diagnostic.bootTimings?.referenceBodyAllocation, requestStarts, responses: network});
  assert.equal(forbiddenRequests.length, 0, 'A runtime resource escaped the build origin');
  assert.equal(pageErrors.length, 0, 'Browser JavaScript errors occurred');
  const failedResources = network.filter(row => (row.status >= 400 || row.failure) && !new URL(row.url).pathname.endsWith('/favicon.ico'));
  assert.equal(failedResources.length, 0, 'A runtime resource failed: ' + JSON.stringify(failedResources));
  const shaderErrors = consoleMessages.filter(row => row.type === 'error' && /shader|webgl|compile|link|context lost/i.test(row.text));
  assert.equal(shaderErrors.length, 0, 'A real WebGL shader/frame failed');
  if (failure) throw failure;
  summary.passed = true; mark('passed');
} catch (error) {
  failure ??= error; summary.error = {message: failure.message || String(failure), stack: failure.stack};
  progress('failed', {error: summary.error});
  if (page && !page.isClosed()) {
    try {
      const traffic = await bounded(readClothObservation(page, {geometry: true, initialInput: true, checkpoints: true}),
        10_000, 'Failure Worker observation exceeded 10 seconds');
      await fs.writeFile(path.join(EVIDENCE, 'failure-worker.json.gz'), gzipSync(Buffer.from(JSON.stringify({
        scope: 'Latest accepted Worker geometry and actual rejected-response diagnostics; no new physics action', traffic})), {level: 6}));
    } catch (error) {summary.failureObservationError = String(error);}
    try {summary.failureDOM = await page.locator('#layer-app').innerText({timeout: 5000});}
    catch (error) {summary.failureDOMError = String(error);}
    try {await page.screenshot({path: path.join(EVIDENCE, 'failure.png'), fullPage: false, timeout: 15_000});}
    catch (error) {summary.failureCaptureError = String(error);}
  }
} finally {
  clearTimeout(watchdog); clearInterval(heartbeat);
  await fs.mkdir(EVIDENCE, {recursive: true}); await writes;
  if (failure) {summary.passed = false; summary.error ??= {message: failure.message || String(failure), stack: failure.stack};}
  summary.elapsedMS = Date.now() - began; summary.lastPhase = phase; summary.observations = observations;
  summary.resourceReadbacks = resourceReadbacks; summary.forbiddenRequests = forbiddenRequests;
  summary.pageErrorCount = pageErrors.length; summary.consoleErrorCount = consoleMessages.filter(row => row.type === 'error').length;
  await Promise.all([
    writeJSON('summary.json', summary), writeJSON('console.json', consoleMessages),
    writeJSON('network.json', {requestStarts, responses: network, explicitBuildReadbacks: resourceReadbacks}),
    writeJSON('errors.json', {failure: summary.error || null, pageErrors, consoleErrors: consoleMessages.filter(row => row.type === 'error'),
      failedRequests: network.filter(row => row.status >= 400 || row.failure), forbiddenRequests}),
  ]);
  await context?.close().catch(() => {}); await browser?.close().catch(() => {});
}
console.log(JSON.stringify({passed: summary.passed, targetURL: BASE, sourceCommit: expectedSHA,
  elapsedMS: summary.elapsedMS, evidenceDirectory: EVIDENCE, error: summary.error?.message}, null, 2));
if (!summary.passed) process.exitCode = 1;
