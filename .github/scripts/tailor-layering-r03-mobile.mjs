// Supplement the frozen R03 desktop smoke with the required mobile entrance.
// This CI-only observer drives public UI and reads actual state. It does not
// patch the application, body, material, geometry, readiness or physical clock.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {installClothObserver, readClothObservation, waitForClothIdle} from '../../experiments/tailor-layering-r03/tests/cloth-observer.mjs';
import {classifyPublicConsole} from './tailor-layering-r03-console-classifier.mjs';

const ROOT = fileURLToPath(new URL('../../experiments/tailor-layering-r03/', import.meta.url));
const OUTPUT = path.join(ROOT, 'evidence/public-mobile');
const BASE = process.env.LAYERING_PUBLIC_URL;
const EXPECTED = process.env.LAYERING_EXPECT_SOURCE_SHA;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const summary = {schema: 'kaopu-r03-public-mobile@1', passed: false,
  startedUTC: new Date().toISOString(), sourceCommit: EXPECTED, targetURL: BASE,
  viewport: {width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true},
  execution: 'GitHub Actions Chromium / SwiftShader / mobile viewport and touch emulation',
  scope: 'Real native scene entrance, actual touch view change, scrollable controls and layout; not a mobile hardware or performance certification.',
  visualAcceptance: false, productionReady: false, screenshotsAreOriginalBrowserCaptures: true,
  pageErrors: [], console: [], network: [], captures: [], controls: [],
  observationSupplement: {purpose: 'Retain raw console/CDP observations; classify only the independently located optional origin-root favicon 404 under the project public-delivery policy',
    mode: 'Passive console location and CDP Log/Network observations; no routing, filtering, cache override or application changes'},
  cdp: {log: [], requests: [], responses: [], loadingFailures: []}};
let browser, context, page, failure, watchdog, heartbeat;
const began = Date.now();
const writeJSON = (name, data) => fs.writeFile(path.join(OUTPUT, name), JSON.stringify(data, null, 2) + '\n');
const progress = phase => console.log('R03_MOBILE_PROGRESS ' + JSON.stringify({phase, elapsedMS: Date.now() - began}));

// Same lossless PNG decoder as the frozen desktop observer. It only measures
// original captures; it never generates, repaints or composites scene pixels.
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
      decoded[i] = (raw[y * (stride + 1) + x + 1] + [0, left, up, Math.floor((left + up) / 2), paeth][filter]) & 255;
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

async function ready(minCompletedFrames = 0) {
  await waitForClothIdle(page, 120_000);
  await page.waitForFunction(minFrames => {
    const app = document.getElementById('layer-app');
    if (app?.dataset.status === 'error') return true;
    if (app?.dataset.ready !== 'true' || app.querySelector('#reset')?.disabled
      || app.dataset.busy === 'true' || app.dataset.renderPending === 'true'
      || app.dataset.renderInFlight === 'true') return false;
    let d; try {d = JSON.parse(app?.querySelector('#diagnostics')?.textContent || 'null');} catch {return false;}
    const f = d?.render?.frameGate, q = d?.render?.presentationQueue;
    return d?.error || f?.failed || (f?.submitted > 0 && f.completed > minFrames
      && f.completed === f.submitted && f.pending === 0 && f.inFlight === 0
      && q?.pending === false && q.inFlight === false);
  }, minCompletedFrames, {timeout: 240_000, polling: 250});
  const d = JSON.parse(await page.locator('#layer-app #diagnostics').textContent());
  assert.equal(d.error, null); assert.equal(d.ready, true);
  assert.equal(d.version, 'TAILOR-LAYERING-R03'); assert.equal(d.sourceCommit, EXPECTED);
  assert.equal(d.render.frameGate.failed, false);
  assert.equal(d.playing, false); assert.equal(d.physics.completedSteps, 0); assert.equal(d.physics.simulationSeconds, 0);
  assert.deepEqual(d.dynamicGarments.map(row => row.id).sort(), ['inner', 'outer', 'pants']);
  assert.equal(d.physics.garmentCount, 3); assert.equal(d.nativePerson.sameModel, true);
  assert.equal(d.nativePerson.revision, 'd413d108704af47cf531ee8c25d93f682c3176e3');
  return d;
}
async function screenshot(name, canvas = false) {
  const locator = canvas ? page.locator('#layer-app #layer-stage canvas') : page;
  const bytes = await locator.screenshot({path: path.join(OUTPUT, name + '.png'), animations: 'disabled', timeout: 180_000});
  summary.captures.push({file: name + '.png', sha256: sha256(bytes), bytes: bytes.length});
  return canvas ? decodePNG(bytes) : null;
}
async function visibleControl(selector) {
  const locator = page.locator('#layer-app ' + selector);
  await locator.scrollIntoViewIfNeeded();
  assert.equal(await locator.isVisible(), true, selector + ' must be visible');
  const measurement = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {rect: {x: r.x, y: r.y, width: r.width, height: r.height}, viewport: {width: innerWidth, height: innerHeight},
      hit: hit === el || el.contains(hit) || !!(el.closest('label')?.contains(hit)), text: el.textContent || el.closest('label')?.textContent || '',
      appScrollWidth: document.getElementById('layer-app').scrollWidth};
  });
  const r = measurement.rect;
  assert.ok(r.width > 0 && r.height > 0 && r.x >= -1 && r.x + r.width <= 391, selector + ' overflows horizontally');
  assert.ok(r.y >= 0 && r.y + r.height <= 845 && measurement.hit, selector + ' is clipped or covered');
  assert.ok(measurement.appScrollWidth <= 391, 'The mobile workbench has horizontal overflow');
  summary.controls.push({selector, ...measurement});
  return locator;
}

try {
  await fs.mkdir(OUTPUT, {recursive: true});
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Browser launch is restricted to the authored GitHub Actions test.');
  assert.match(BASE || '', /^https:\/\/haihao0307\.github\.io\/guilin-dem-pipeline\/kaopu-tailor-workbench\/material-products\/layering-r03-[a-z0-9-]+\/$/);
  assert.match(EXPECTED || '', /^[0-9a-f]{40}$/);
  const require = createRequire(path.join(ROOT, '.ci-runtime/package.json'));
  assert.equal(require('playwright/package.json').version, '1.64.0');
  const {chromium} = require('playwright');
  watchdog = setTimeout(() => {failure ??= new Error('Mobile entrance exceeded its 10-minute budget'); browser?.close().catch(() => {});}, 600_000);
  heartbeat = setInterval(() => progress('heartbeat'), 15_000);
  browser = await chromium.launch({headless: true, channel: 'chromium', timeout: 60_000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage']});
  summary.browserVersion = browser.version();
  context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: 'zh-CN', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block'});
  await installClothObserver(context, {checkpointSteps: [], checkpointLimit: 1});
  page = await context.newPage(); page.setDefaultTimeout(120_000);
  page.on('pageerror', e => summary.pageErrors.push(String(e)));
  page.on('console', m => summary.console.push({type: m.type(), text: m.text(), location: m.location(), observedAtMS: Date.now() - began}));
  page.on('response', r => summary.network.push({url: r.url(), status: r.status(), type: r.request().resourceType()}));
  page.on('requestfailed', r => summary.network.push({url: r.url(), failure: r.failure()?.errorText}));
  const protocol = await context.newCDPSession(page);
  protocol.on('Log.entryAdded', ({entry}) => summary.cdp.log.push(entry));
  protocol.on('Network.requestWillBeSent', event => summary.cdp.requests.push({
    requestId: event.requestId, frameId: event.frameId, loaderId: event.loaderId,
    timestamp: event.timestamp, wallTime: event.wallTime, type: event.type,
    documentURL: event.documentURL, url: event.request.url, method: event.request.method,
    initiator: event.initiator}));
  protocol.on('Network.responseReceived', event => summary.cdp.responses.push({
    requestId: event.requestId, timestamp: event.timestamp, type: event.type,
    url: event.response.url, status: event.response.status, mimeType: event.response.mimeType,
    fromDiskCache: event.response.fromDiskCache, fromServiceWorker: event.response.fromServiceWorker}));
  protocol.on('Network.loadingFailed', event => summary.cdp.loadingFailures.push({
    requestId: event.requestId, timestamp: event.timestamp, type: event.type,
    errorText: event.errorText, canceled: event.canceled, blockedReason: event.blockedReason,
    corsErrorStatus: event.corsErrorStatus}));
  await Promise.all([protocol.send('Log.enable'), protocol.send('Network.enable')]);
  progress('mobile-native-entrance');
  const navigation = await page.goto(BASE, {waitUntil: 'domcontentloaded', timeout: 60_000});
  assert.equal(navigation?.status(), 200);
  summary.httpStatus = navigation.status(); summary.finalURL = page.url(); assert.equal(summary.finalURL, BASE);
  await page.waitForFunction(() => {
    const app = document.getElementById('layer-app'); return app?.dataset.ready === 'true' || app?.dataset.status === 'error';
  }, null, {timeout: 480_000, polling: 250});
  summary.initial = await ready();
  assert.equal(await page.locator('#layer-app #layer-loading').isVisible(), false);
  const canvas = page.locator('#layer-app #layer-stage canvas');
  summary.webgl = await canvas.evaluate(c => {
    const gl = c.getContext('webgl2'), extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return {context: !!gl, contextLost: gl?.isContextLost(), width: gl?.drawingBufferWidth, height: gl?.drawingBufferHeight,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      touchPoints: navigator.maxTouchPoints, innerWidth, innerHeight, bodyVertices: window.__IDENTITY_QA__?.model?.()?.positions?.length / 3,
      bodyTriangles: window.__IDENTITY_QA__?.model?.()?.faces?.length / 3};
  });
  assert.equal(summary.webgl.context, true); assert.equal(summary.webgl.contextLost, false);
  assert.equal(summary.webgl.innerWidth, 390); assert.equal(summary.webgl.innerHeight, 844);
  assert.ok(summary.webgl.touchPoints > 0); assert.equal(summary.webgl.bodyVertices, 25417); assert.equal(summary.webgl.bodyTriangles, 50624);
  await screenshot('initial'); const front = await screenshot('initial-canvas', true);
  const before = await readClothObservation(page);
  const camera = () => page.evaluate(() => window.__IDENTITY_QA__.viewer().camera.position.toArray());
  const beforeCamera = await camera();
  progress('actual-touch-side-view');
  await (await visibleControl('#view-side')).tap();
  summary.side = await ready(summary.initial.render.frameGate.completed);
  assert.notDeepEqual(await camera(), beforeCamera);
  assert.ok(summary.side.render.frameGate.completed > summary.initial.render.frameGate.completed);
  const after = await readClothObservation(page);
  assert.equal(after.requestCount, before.requestCount); assert.equal(after.responseCount, before.responseCount);
  assert.equal(after.checkpointGeneration, before.checkpointGeneration);
  assert.deepEqual(after.audit, before.audit); assert.equal(after.errors.length, 0);
  await screenshot('view-side'); const side = await screenshot('view-side-canvas', true);
  assert.equal(side.width, front.width); assert.equal(side.height, front.height);
  let changed = 0;
  for (let p = 0; p < front.rgba.length; p += 4) if ([0, 1, 2].some(c => Math.abs(front.rgba[p + c] - side.rgba[p + c]) > 12)) changed++;
  summary.touchInteraction = {control: '#view-side', changedPixels: changed, changedFraction: changed / (front.width * front.height),
    physicsRequestCountBefore: before.requestCount, physicsRequestCountAfter: after.requestCount, physicalStateUnchanged: true};
  assert.ok(summary.touchInteraction.changedFraction > .005, 'Touch did not visibly change the actual canvas');
  progress('scrollable-controls');
  for (const selector of ['#step', '#audit-contact', '#contact-demand', '#help > summary']) await visibleControl(selector);
  await visibleControl('#contact-demand'); await screenshot('contact-controls');
  assert.equal(await page.locator('#layer-app #contact-demand').isChecked(), true);
  assert.match(summary.controls.find(row => row.selector === '#contact-demand').text, /按需接触计算/);
  assert.equal(summary.pageErrors.length, 0);
  summary.consoleAcceptance = classifyPublicConsole(summary, BASE);
  assert.equal(summary.consoleAcceptance.passed, true, 'Unclassified console or CDP error; the only eligible noncritical record is the fully matched browser origin favicon 404');
  const classifiedIconURLs = new Set(summary.consoleAcceptance.acceptedNoncriticalBrowserResourceErrors.map(row => row.url));
  assert.equal(summary.network.filter(row => (row.status >= 400 || row.failure)
    && !(row.status === 404 && !row.failure && classifiedIconURLs.has(row.url))).length, 0);
  if (failure) throw failure;
  summary.passed = true; progress('passed');
} catch (error) {
  failure ??= error; summary.error = {message: failure.message || String(failure), stack: failure.stack};
  if (page && !page.isClosed()) {
    try {await screenshot('failure');} catch {}
  }
} finally {
  clearTimeout(watchdog); clearInterval(heartbeat);
  if (failure) {summary.passed = false; summary.error ??= {message: String(failure)};}
  summary.elapsedMS = Date.now() - began;
  await fs.mkdir(OUTPUT, {recursive: true}); await writeJSON('summary.json', summary);
  await context?.close().catch(() => {}); await browser?.close().catch(() => {});
}
console.log(JSON.stringify({passed: summary.passed, elapsedMS: summary.elapsedMS, error: summary.error?.message}));
if (!summary.passed) process.exitCode = 1;
