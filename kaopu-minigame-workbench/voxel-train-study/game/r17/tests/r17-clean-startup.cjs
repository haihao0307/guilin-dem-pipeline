/* Clean startup comparison only. No routes, injected app code, WebGL wrappers,
 * RAF wrappers, forced renders, eager shader checks, timer queries or GPU finish.
 * Run only in the authorized CI browser, never to retry a denied local launch.
 * Playwright 1.57.0 / Ubuntu 24.04 / Chromium ANGLE SwiftShader.
 * TRAIN_GAME_URL: R17 directory URL; TRAIN_CLEAN_QA_OUT: output directory.
 * Four fresh contexts alternate R14/R17, each with a same-context warm reload.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');

const base = new URL(process.env.TRAIN_GAME_URL || 'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r17/').href;
const baselineName = process.env.TRAIN_CLEAN_BASELINE_URL ? 'r17-before' : 'r14';
const urls = {[baselineName]: process.env.TRAIN_CLEAN_BASELINE_URL || new URL('../', base).href, r17: base};
const versions = {[baselineName]: baselineName === 'r14' ? 'kcr-hud-r14' : 'kcr-kst1-r17', r17: 'kcr-kst1-r17'};
const out = path.resolve(process.env.TRAIN_CLEAN_QA_OUT || 'train-r17-clean-startup');
const viewport = {width: 1280, height: 720};
const launchArgs = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const order = [baselineName, 'r17', baselineName, 'r17'];
const captures = [], failures = [];
let commit = process.env.GITHUB_SHA || null;
if (!commit) {
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); } catch {}
}
fs.mkdirSync(out, {recursive: true});
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const metricMap = result => Object.fromEntries(result.metrics.map(m => [m.name, m.value]));
const glError = text => /WebGL.*(?:INVALID_|OUT_OF_MEMORY)|GL_INVALID_|GL_OUT_OF_MEMORY|shader error|VALIDATE_STATUS|THREE\.WebGLProgram.*Error/i.test(text);
const median = values => {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2); return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
function metricDelta(before, after) {
  return Object.fromEntries(['ScriptDuration', 'TaskDuration'].map(name => {
    const a = before[name], b = after[name];
    return [name, {unit: 'seconds', before: a ?? null, after: b ?? null,
      delta: Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null,
      counterResetOrUnavailable: !Number.isFinite(a) || !Number.isFinite(b) || b < a}];
  }));
}
function verifyPNG(bytes) {
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Screenshot is a PNG');
  const size = {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
  assert.deepEqual(size, viewport, 'Actual PNG matches the same CSS viewport at DPR1');
  assert(bytes.length > 12000, 'Screenshot contains a nontrivial rendered page');
  return size;
}

async function capture(page, cdp, which, repeat, mode, observations) {
  const name = `${which}-${repeat}-${mode}`;
  observations.phase = name;
  const eventStart = observations.events.length;
  const metricsBefore = metricMap(await cdp.send('Performance.getMetrics'));
  const started = performance.now();
  const response = mode === 'cold-context'
    ? await page.goto(urls[which], {waitUntil: 'domcontentloaded'})
    : await page.reload({waitUntil: 'domcontentloaded'});
  assert(response?.ok(), 'Entry returned a successful HTTP response');
  await page.waitForFunction(({which, version}) => {
    const driver = window.__trainDriver;
    if (!driver?.ready || driver.version !== version) return false;
    const s = driver.getState();
    return s.frames > 0 && s.drawCalls > 0 && s.triangles > 0 &&
      (version !== 'kcr-kst1-r17' || (s.streetDistrict?.ready && s.streetDistrict?.active));
  }, {which, version: versions[which]}, {polling: 100, timeout: 90000});
  const publiclyReadyAfterMs = performance.now() - started;
  // Schedule two ordinary browser RAF callbacks. Do not replace RAF or call the
  // app's draw/animate functions; its own production rendering remains intact.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const nativeFramesAfterMs = performance.now() - started;
  const beforeScreenshot = await page.evaluate(() => ({version: __trainDriver.version, state: __trainDriver.getState()}));
  const screenshotStart = performance.now();
  const bytes = await page.screenshot({path: path.join(out, name + '.png'), timeout: 60000, type: 'png'});
  const screenshotCompletedAfterMs = performance.now() - started;
  const pngSize = verifyPNG(bytes);
  const afterScreenshot = await page.evaluate(() => ({version: __trainDriver.version, state: __trainDriver.getState(),
    navigation: performance.getEntriesByType('navigation').map(e => e.toJSON()),
    resources: performance.getEntriesByType('resource').map(e => e.toJSON()),
    userAgent: navigator.userAgent, devicePixelRatio, viewport: [innerWidth, innerHeight]}));
  const metricsAfter = metricMap(await cdp.send('Performance.getMetrics'));
  const events = observations.events.slice(eventStart);
  const result = {name, which, repeat, mode, commit, sourceCommit: which === 'r17-before' ? process.env.TRAIN_CLEAN_BASELINE_COMMIT : commit, url: urls[which], status: response.status(),
    instrumentation: 'No app route/injection, no addInitScript, no API or GL/RAF wrappers; read-only public-state/ResourceTiming sampling and external CDP Performance counters only.',
    clocks: {
      navigationToPublicReadyMs: publiclyReadyAfterMs,
      navigationToTwoNativeRAFCallbacksMs: nativeFramesAfterMs,
      navigationToVerifiedScreenshotUpperBoundMs: screenshotCompletedAfterMs,
      screenshotRequestToCompletionMs: screenshotCompletedAfterMs - (screenshotStart - started),
      definition: 'Node wall time from issuing goto/reload through completed PNG capture. Includes automation transport, readiness polling, two RAF callbacks, read-only state sampling and PNG capture/write. It is an upper bound for this workflow, not isolated parse/build/render/GPU time.'},
    screenshot: {file: name + '.png', bytes: bytes.length, sha256: hash(bytes), ...pngSize,
      verification: 'PNG signature/dimensions, nontrivial byte count and public ready/draw/triangle state. Independent visual inspection remains separate.'},
    cdpPerformance: {delta: metricDelta(metricsBefore, metricsAfter), before: metricsBefore, after: metricsAfter,
      boundary: 'CDP target ScriptDuration/TaskDuration counters in seconds; includes test read-only evaluate callbacks. Not GPU time and not whole-machine CPU usage. Counter reset/unavailability is explicit.'},
    beforeScreenshot, afterScreenshot, events,
    transfer: {
      resourceRequests: afterScreenshot.resources.length,
      transferSize: afterScreenshot.resources.reduce((n, r) => n + (r.transferSize || 0), 0),
      encodedBodySize: afterScreenshot.resources.reduce((n, r) => n + (r.encodedBodySize || 0), 0),
      decodedBodySize: afterScreenshot.resources.reduce((n, r) => n + (r.decodedBodySize || 0), 0),
      navigation: afterScreenshot.navigation,
      boundary: 'ResourceTiming fields are kept verbatim per resource. Resource sums exclude the navigation document, whose timing is separate. Zero transferSize can represent cached resources; no compression/cache saving is inferred without the reported fields/headers.'},
    environment: {requestedRasterizer: 'Chromium ANGLE SwiftShader software rasterizer', actualRenderer: afterScreenshot.state.rendererName,
      viewport, deviceScaleFactor: 1, physicalDeviceTest: false,
      coldBoundary: 'Fresh browser context, not a fresh Chromium/OS process or an empty GPU-driver cache. Contexts run sequentially in the recorded alternating baseline/candidate order.'}};
  // Always persist measurement and image evidence before evaluating its gates.
  write(name + '.json', result);
  assert.equal(afterScreenshot.version, versions[which]);
  assert.equal(afterScreenshot.devicePixelRatio, 1);
  assert.deepEqual(afterScreenshot.viewport, [viewport.width, viewport.height]);
  assert.equal(afterScreenshot.state.proof.addedCoaches, 2);
  assert(/SwiftShader/i.test(afterScreenshot.state.rendererName), 'Verified renderer must be the requested software rasterizer');
  if (versions[which] === 'kcr-kst1-r17') assert.equal(afterScreenshot.state.streetDistrict.active, true);
  const errors = events.filter(e => e.type === 'pageerror' || e.type === 'console' && (e.level === 'error' || glError(e.text)) ||
    e.type === 'response' && e.status >= 400 || e.type === 'requestfailed' && !/ERR_ABORTED/.test(e.error || ''));
  assert.deepEqual(errors, [], 'Clean startup has no page/GL/HTTP errors');
  captures.push(result); console.log('PASS clean startup ' + name);
  return result;
}

(async () => {
  let browser;
  try {
    // One approved CI launch only. No fallback or launch retry.
    browser = await chromium.launch({headless: true, args: launchArgs});
    for (let i = 0; i < order.length; i++) {
      const which = order[i], repeat = Math.floor(i / 2) + 1;
      let context, page;
      const observations = {phase: `${which}-${repeat}-setup`, events: []};
      try {
        context = await browser.newContext({viewport, deviceScaleFactor: 1});
        page = await context.newPage(); page.setDefaultNavigationTimeout(90000); page.setDefaultTimeout(90000);
        page.on('console', m => observations.events.push({phase: observations.phase, type: 'console', level: m.type(), text: m.text()}));
        page.on('pageerror', e => observations.events.push({phase: observations.phase, type: 'pageerror', message: e.message, stack: e.stack}));
        page.on('requestfailed', r => observations.events.push({phase: observations.phase, type: 'requestfailed', url: r.url(), error: r.failure()?.errorText}));
        page.on('response', r => observations.events.push({phase: observations.phase, type: 'response', url: r.url(), status: r.status(),
          headers: {'content-encoding': r.headers()['content-encoding'] || null, 'cache-control': r.headers()['cache-control'] || null}}));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Performance.enable');
        await capture(page, cdp, which, repeat, 'cold-context', observations);
        await capture(page, cdp, which, repeat, 'warm-reload', observations);
      } catch (error) {
        const failure = {which, repeat, phase: observations.phase, commit, error: String(error), stack: error.stack, observations};
        if (page) {
          failure.publicState = await page.evaluate(() => window.__trainDriver?.getState()).catch(() => null);
          await page.screenshot({path: path.join(out, observations.phase + '-failure.png'), timeout: 30000}).catch(e => { failure.screenshotError = String(e); });
        }
        failures.push(failure); write(observations.phase + '-failure.json', failure); console.error(error);
      } finally {
        if (context) await context.close().catch(() => {});
        write('progress.json', {commit, completed: captures.map(c => c.name), failures});
      }
    }
  } catch (error) { failures.push({phase: 'launch-or-runner', commit, error: String(error), stack: error.stack}); }
  finally {
    const browserVersion = browser ? await browser.version() : null;
    if (browser) await browser.close().catch(() => {});
    const aggregate = {};
    for (const which of [baselineName, 'r17']) for (const mode of ['cold-context', 'warm-reload']) {
      const subset = captures.filter(c => c.which === which && c.mode === mode);
      aggregate[which + '-' + mode] = {samples: subset.length,
        medianNavigationToVerifiedScreenshotUpperBoundMs: median(subset.map(c => c.clocks.navigationToVerifiedScreenshotUpperBoundMs)),
        medianScriptDurationDeltaSeconds: median(subset.map(c => c.cdpPerformance.delta.ScriptDuration.delta)),
        medianTaskDurationDeltaSeconds: median(subset.map(c => c.cdpPerformance.delta.TaskDuration.delta)),
        draws: subset.map(c => c.afterScreenshot.state.drawCalls), triangles: subset.map(c => c.afterScreenshot.state.triangles),
        rendererNames: [...new Set(subset.map(c => c.afterScreenshot.state.rendererName))]};
    }
    const pass = captures.length === 8 && failures.length === 0;
    write('result.json', {pass, scope: 'CLEAN STARTUP COMPARISON ONLY; not native journey, lifecycle or independent visual acceptance', commit,
      browserVersion, playwright: require('playwright/package.json').version, launchArgs, viewport, deviceScaleFactor: 1,
      order, baselineName, baselineCommit: process.env.TRAIN_CLEAN_BASELINE_COMMIT || null, urls, captures: captures.map(c => c.name + '.json'), aggregate, failures,
      limitations: ['Two samples per entry/mode are diagnostic, not a stable performance distribution.',
        'SwiftShader software rendering on CI, not a physical desktop/phone or hardware GPU benchmark.',
        'Navigation-to-PNG is an observed workflow upper bound; it does not isolate GPU, shader compile, upload, parse or street-build time.',
        'Fresh contexts share the Chromium process and host/driver caches; only warm-reload explicitly reuses the same browser context.',
        'No production runtime or render API was replaced or called by the test.']});
    console.log('R17/' + baselineName + ' CLEAN STARTUP ONLY: ' + (pass ? 'PASS' : 'FAIL') + ' — ' + out);
    if (!pass) process.exitCode = 1;
  }
})();
