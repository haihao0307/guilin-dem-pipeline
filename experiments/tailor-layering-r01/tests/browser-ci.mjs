// Real browser acceptance. This file intentionally refuses to launch a browser
// in the current interactive workspace; GitHub Actions is the execution host.
// No application internals, synthetic screenshots or replacement meshes are used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EVIDENCE = path.join(ROOT, 'evidence');
const BASE = 'http://127.0.0.1:8765/';
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
let browser, context, page, watchdog;
let failure = null;
const summary = {
  schema: 'kaopu-real-webgl-acceptance@1',
  startedUTC: new Date().toISOString(),
  passed: false,
  execution: 'GitHub Actions, fresh Playwright Chromium context, software WebGL',
  publicationPerformed: false,
  screenshotsAreBrowserCaptures: true,
  limitations: [
    'This checks the fixed native person, two retained tops and retained P02 shorts.',
    'Contact metrics describe discrete vertex-triangle tests, not continuous collision or all intersections.',
    'No real-time speed threshold, calibrated friction claim or arbitrary-motion guarantee is made.',
  ],
};

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

async function waitIdle(timeout = 120_000) {
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app');
    if (app?.dataset.status === 'error') return true;
    return app?.dataset.ready === 'true' && !app.querySelector('#reset')?.disabled;
  }, null, { timeout });
  await diagnostic();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function verifyGarments(value, ids = ['inner', 'outer', 'pants']) {
  assert.equal(value.version, 'TAILOR-LAYERING-R01');
  assert.deepEqual(value.dynamicGarments.map(row => row.id).sort(), [...ids].sort(), 'Independent garment identities changed');
  assert.equal(value.physics.garmentCount, ids.length, 'The shared solver must contain exactly the displayed independent garments');
  assert.equal(value.nativePerson.sameModel, true);
  assert.equal(value.nativePerson.sameViewer, true);
  assert.equal(value.nativePerson.iframes, 0);
  assert.equal(value.nativePerson.revision, 'd413d108704af47cf531ee8c25d93f682c3176e3');
  assert.match(value.nativePerson.topology, /^[0-9a-f]{64}$/i);
  assert.equal(value.physics.staticNativeBody, true);
  assert.equal(value.physics.continuousCollision, false);
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
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: false, animations: 'disabled', timeout: 45_000 });
  const buffer = await page.locator('#layer-app #layer-stage canvas').screenshot({ path: path.join(EVIDENCE, `${name}-canvas.png`), animations: 'disabled', timeout: 45_000 });
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

async function clickAndWait(id, timeout = 120_000) {
  await page.locator(`#layer-app #${id}`).click({ timeout: 30_000 });
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

async function setColor(value) {
  await page.locator('#layer-app #color').evaluate((input, color) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, color);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await waitIdle();
}

try {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Browser execution is reserved for GitHub Actions; do not launch a local browser for this test.');
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
  // Leave time inside the 12-minute CI job to retain evidence after a slow GPU
  // compile or failed interaction. Normal rendering may take several minutes.
  watchdog = setTimeout(() => {
    failure = new Error('Browser acceptance exceeded its 8-minute budget.');
    browser?.close().catch(() => {});
  }, 480_000);
  browser = await chromium.launch({ headless: true, channel: 'chromium', timeout: 60_000, args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
  ] });
  summary.browserVersion = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1,
    colorScheme: 'light', locale: 'zh-CN', reducedMotion: 'reduce' });
  // No signed-in state, external models, remote scripts or user profile.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(BASE).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    forbiddenRequests.push({ url: url.href, resourceType: route.request().resourceType() });
    return route.abort('blockedbyclient');
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on('console', message => consoleMessages.push({ type: message.type(), text: message.text(), location: message.location(), wallMS: Date.now() - began }));
  page.on('pageerror', error => pageErrors.push({ message: error.message, stack: error.stack }));
  page.on('response', response => requests.push({ url: response.url(), status: response.status(), type: response.request().resourceType() }));
  page.on('requestfailed', request => requests.push({ url: request.url(), failure: request.failure()?.errorText, type: request.resourceType() }));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app');
    return app?.dataset.ready === 'true' || app?.dataset.status === 'error';
  }, null, { timeout: 240_000 });
  assert.equal(await page.locator('#layer-app').getAttribute('data-ready'), 'true', await page.locator('#layer-app #load-text').textContent());
  await waitIdle();
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').count(), 1);
  assert.equal(await page.locator('#layer-app #layer-stage canvas').isVisible(), true);
  assert.equal(await page.locator('#layer-app #layer-loading').isVisible(), false, 'Loading overlay still hides the real scene');
  assert.equal(await page.locator('#layer-app #layer-list [data-garment]').count(), 3);
  assert.equal((await page.locator('#layer-app #metric-layers').textContent()).trim(), '3');
  const initial = await diagnostic();
  verifyGarments(initial);
  assert.equal(initial.playing, false);
  await capture('initial');

  // Independent display and dye tests operate through the normal controls.
  await page.locator('#layer-app #layer-list [data-garment="outer"]').click();
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
  await clickAndWait('all-visible');
  await clickAndWait('view-front');

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
  await page.locator('#layer-app #exploded').uncheck();
  await waitIdle();
  assert.deepEqual((await diagnostic()).physics, beforeSeparation.physics);

  // Advance the real native-body scene. Contact counts are measurements, with
  // no requirement that residuals vanish or that one step run in real time.
  let stepped = await advance();
  await record('stepped');
  if (stepped.physics.contact.contactCount === 0) {
    stepped = await advance('push');
    await record('pushed');
  }
  assert.ok(stepped.physics.contact.contactCount > 0, 'The contact probe did not produce measurable inter-garment contact');
  const countBeforeRemoval = stepped.physics.contact.contactCount;
  await page.locator('#layer-app #layer-list [data-garment="outer"]').click();
  await clickAndWait('remove-selected');
  const removed = await diagnostic();
  verifyGarments(removed, ['inner', 'pants']);
  assert.equal(await page.locator('#layer-app #layer-list [data-garment="outer"]').count(), 0);
  assert.equal((await page.locator('#layer-app #metric-layers').textContent()).trim(), '2');
  assert.equal(removed.physics.contact, null, 'Removing an object must retire the old contact evidence');
  assert.equal((await page.locator('#layer-app #metric-contacts').textContent()).trim(), '0');
  await capture('removed');
  const afterRemovalStep = await advance();
  verifyGarments(afterRemovalStep, ['inner', 'pants']);
  summary.contactRemoval = {
    beforeRemoval: countBeforeRemoval,
    immediatelyAfterRemoval: 0,
    afterNextSolve: afterRemovalStep.physics.contact.contactCount,
    oldEvidenceRetired: removed.physics.contact === null,
    remainingGarments: ['inner', 'pants'],
    interpretation: 'Immediate count is cleared on removal; next-solve count measures the two remaining independent garments.',
  };
  await record('removed-stepped');

  await clickAndWait('add-outer', 150_000);
  const restored = await diagnostic();
  verifyGarments(restored);
  assert.equal(await page.locator('#layer-app #layer-list [data-garment]').count(), 3);
  assert.equal(await page.locator('#layer-app #add-outer').isDisabled(), true);
  await capture('restored');

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
  if (page && !page.isClosed()) {
    try {
      summary.failureDOM = await page.locator('#layer-app').innerText({ timeout: 5000 });
      await page.screenshot({ path: path.join(EVIDENCE, 'failure.png'), fullPage: false, timeout: 15_000 });
    } catch (captureError) { summary.failureCaptureError = String(captureError); }
  }
} finally {
  clearTimeout(watchdog);
  summary.elapsedMS = Date.now() - began;
  summary.observations = observations;
  summary.consoleErrorCount = consoleMessages.filter(row => row.type === 'error').length;
  summary.pageErrors = pageErrors;
  summary.forbiddenRequests = forbiddenRequests;
  await fs.mkdir(EVIDENCE, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(EVIDENCE, 'browser-metrics.json'), JSON.stringify(summary, null, 2) + '\n'),
    fs.writeFile(path.join(EVIDENCE, 'browser-console.json'), JSON.stringify(consoleMessages, null, 2) + '\n'),
    fs.writeFile(path.join(EVIDENCE, 'browser-network.json'), JSON.stringify(requests, null, 2) + '\n'),
    fs.writeFile(path.join(EVIDENCE, 'browser-errors.json'), JSON.stringify(pageErrors, null, 2) + '\n'),
  ]);
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}

console.log(JSON.stringify({ passed: summary.passed, elapsedMS: summary.elapsedMS, screenshots: observations.map(row => row.name),
  contactRemoval: summary.contactRemoval, error: summary.error?.message }, null, 2));
if (failure) throw failure;
