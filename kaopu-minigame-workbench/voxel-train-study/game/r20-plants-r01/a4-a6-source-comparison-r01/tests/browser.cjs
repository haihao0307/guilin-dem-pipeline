const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {performance} = require('node:perf_hooks');

const root = path.resolve(__dirname, '..');
// A supplied URL is always tested directly. Never substitute local files for a public failure.
const externalURL = process.env.TEST_URL || null;
const qa = process.env.TEST_QA_DIR
  ? path.resolve(process.env.TEST_QA_DIR)
  : path.join(root, 'qa', ...(externalURL ? ['public'] : []));
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS || 240000);
const partialLoading = process.env.TEST_PARTIAL_LOADING === '1';
let releaseDelayedSource;
const started = performance.now();
fs.mkdirSync(qa, {recursive: true});
const report = {
  status: 'RUNNING', startedAt: new Date().toISOString(),
  mode: externalURL ? 'PUBLIC_URL_BASELINE' : 'LOCAL_CANDIDATE',
  requestedURL: externalURL, timeoutMs, partialLoading, errors: [], failedRequests: [],
  resources: [], snapshots: [], screenshots: [], diagnosticErrors: [],
  physicalCalibration: false,
  visualAcceptance: 'Screenshots for review; no automatic A6 aesthetic or mechanical approval'
};
const elapsed = () => Math.round(performance.now() - started);
const failureText = error => error?.stack || error?.message || String(error);
let server, browser, page, sampleTimer, sampling = false;
const requests = new Map();
const pendingResources = new Set();

function serveLocal() {
  server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { return res.writeHead(400).end(); }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, body) => {
      if (error) return res.writeHead(404).end();
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' :
        file.endsWith('.html') ? 'text/html' : file.endsWith('.json') ? 'application/json' :
        /\.jpe?g$/.test(file) ? 'image/jpeg' : file.endsWith('.png') ? 'image/png' :
        file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
      res.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}/`));
  });
}

function trackResourceTask(task) {
  pendingResources.add(task);
  task.catch(error => report.diagnosticErrors.push(failureText(error)))
    .finally(() => pendingResources.delete(task));
}

function observeNetwork() {
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) {
      report.errors.push(message.text());
    }
  });
  page.on('request', request => {
    const resource = {
      url: request.url(), method: request.method(), resourceType: request.resourceType(),
      startedMs: elapsed(), state: 'pending',
      redirectedFrom: request.redirectedFrom()?.url() || null
    };
    requests.set(request, resource);
    report.resources.push(resource);
  });
  page.on('response', response => {
    const resource = requests.get(response.request());
    if (!resource) return;
    const headers = response.headers();
    Object.assign(resource, {
      status: response.status(), statusText: response.statusText(), responseMs: elapsed(),
      fromServiceWorker: response.fromServiceWorker(),
      headers: Object.fromEntries([
        'content-type', 'content-length', 'content-encoding', 'cache-control',
        'etag', 'last-modified', 'age', 'date', 'x-cache'
      ].filter(key => headers[key] !== undefined).map(key => [key, headers[key]]))
    });
  });
  page.on('requestfinished', request => {
    const resource = requests.get(request);
    if (!resource) return;
    Object.assign(resource, {
      state: 'finished', finishedMs: elapsed(), durationMs: elapsed() - resource.startedMs,
      timing: request.timing()
    });
    trackResourceTask(request.sizes().then(sizes => { resource.sizes = sizes; }));
  });
  page.on('requestfailed', request => {
    const resource = requests.get(request);
    const failure = {url: request.url(), errorText: request.failure()?.errorText || 'unknown', atMs: elapsed()};
    report.failedRequests.push(failure);
    if (resource) Object.assign(resource, {
      state: 'failed', finishedMs: elapsed(), durationMs: elapsed() - resource.startedMs,
      failure: failure.errorText, timing: request.timing()
    });
  });
}

async function bounded(task, ms, label) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} exceeded ${ms} ms`)), ms); })
    ]);
  } finally { clearTimeout(timer); }
}

async function snapshot(label) {
  if (!page || page.isClosed()) return;
  try {
    const state = await bounded(page.evaluate(() => {
      const safe = (value, depth = 0) => {
        if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
        if (typeof value !== 'object') return String(value);
        if (depth > 4) return '[depth limit]';
        if (Array.isArray(value)) return value.slice(0, 40).map(item => safe(item, depth + 1));
        return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [key, safe(item, depth + 1)]));
      };
      const comparison = window.COMPARISON;
      const status = document.querySelector('#status');
      const loading = document.querySelector('#loading, [data-loading], [role="progressbar"]');
      return {
        url: location.href, documentReadyState: document.readyState, title: document.title,
        status: status?.textContent ?? null,
        comparison: comparison ? {
          present: true, ready: Boolean(comparison.ready), errors: safe(comparison.errors || []),
          loading: safe(comparison.loading), state: safe(comparison.state),
          progress: safe(comparison.progress), visiblePanels: safe(comparison.visiblePanels),
          sourceUnits: comparison.sourceUnits,
          keys: Object.keys(comparison), sources: comparison.sources?.map(source => ({
            key: source.key, nodes: source.nodes?.length, meshes: source.primitives?.length
          }))
        } : {present: false, ready: false},
        loading: loading ? {
          text: loading.textContent, hidden: loading.hidden,
          display: getComputedStyle(loading).display,
          ariaBusy: loading.getAttribute('aria-busy'),
          ariaValueNow: loading.getAttribute('aria-valuenow')
        } : null,
        bodyAriaBusy: document.body?.getAttribute('aria-busy') ?? null,
        canvases: [...document.querySelectorAll('canvas')].map(canvas => ({
          width: canvas.width, height: canvas.height,
          visibleWidth: canvas.getBoundingClientRect().width,
          visibleHeight: canvas.getBoundingClientRect().height
        })),
        resources: performance.getEntriesByType('resource').map(entry => ({
          url: entry.name, initiatorType: entry.initiatorType,
          startTimeMs: entry.startTime, durationMs: entry.duration,
          responseStartMs: entry.responseStart, responseEndMs: entry.responseEnd,
          transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          responseStatus: entry.responseStatus ?? null
        }))
      };
    }), 8000, 'page state collection');
    const result = {label, atMs: elapsed(), ...state};
    report.snapshots.push(result);
    report.lastState = result;
  } catch (error) { report.diagnosticErrors.push(`${label}: ${failureText(error)}`); }
}

async function shot(name) {
  if (!page || page.isClosed()) return;
  try {
    await page.screenshot({path: path.join(qa, name), timeout: 15000});
    report.screenshots.push(name);
  } catch (error) { report.diagnosticErrors.push(`${name}: ${failureText(error)}`); }
}

(async () => {
  try {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error('TEST_TIMEOUT_MS must be positive');
    if (externalURL && !['http:', 'https:'].includes(new URL(externalURL).protocol)) {
      throw Error('TEST_URL must be an absolute http(s) URL');
    }
    if (externalURL && partialLoading) throw Error('Fault injection is local-only; public baseline must use unmodified network');
    const targetURL = externalURL || await serveLocal();
    report.requestedURL = targetURL;
    browser = await chromium.launch({
      headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    });
    report.browserVersion = browser.version();
    page = await browser.newPage({viewport: {width: 1800, height: 1100}});
    page.setDefaultTimeout(timeoutMs);
    observeNetwork();
    if (partialLoading) {
      const gate = new Promise(resolve => { releaseDelayedSource = resolve; });
      await page.route('**/source-assets/mark3/fields.bin.gz', async route => {
        report.delayedSource = {url: route.request().url(), heldAtMs: elapsed()};
        await gate;
        report.delayedSource.releasedAtMs = elapsed();
        await route.continue();
      });
    }
    sampleTimer = setInterval(async () => {
      if (sampling) return;
      sampling = true;
      try { await snapshot('loading-sample'); } finally { sampling = false; }
    }, 10000);
    const navigation = await page.goto(targetURL, {waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 90000)});
    report.navigation = navigation ? {url: navigation.url(), status: navigation.status(), headers: navigation.headers()} : null;
    report.finalURL = page.url();
    await snapshot('domcontentloaded');
    await shot('00-initial-loading-state.png');
    if (!navigation?.ok()) throw Error(`ENTRY_HTTP_FAILED ${navigation?.status() ?? 'no response'} ${targetURL}`);
    if (partialLoading) {
      await page.waitForFunction(() =>
        window.COMPARISON?.visiblePanels?.includes('a4') &&
        window.COMPARISON?.visiblePanels?.includes('a6'), null, {timeout: Math.min(timeoutMs, 80000)});
      await snapshot('a4-visible-while-mark3-network-held');
      report.partialLoadingProof = await page.evaluate(() => ({
        ready: COMPARISON.ready, visiblePanels: COMPARISON.visiblePanels,
        a4Phase: COMPARISON.loading?.a4?.phase,
        mark3Phase: COMPARISON.loading?.mark3?.phase,
        status: document.querySelector('#status')?.textContent
      }));
      await shot('00-partial-a4-visible-mark3-delayed.png');
      if (!report.delayedSource || report.partialLoadingProof.ready ||
          report.partialLoadingProof.visiblePanels.includes('mark3') ||
          report.partialLoadingProof.a4Phase !== 'visible') {
        throw Error('PARTIAL_LOADING_ASSERTION_FAILED');
      }
      releaseDelayedSource();
    }
    await page.waitForFunction(() => window.COMPARISON?.ready || window.COMPARISON?.errors?.length, null, {timeout: timeoutMs});
    clearInterval(sampleTimer);
    await snapshot('comparison-settled');
    if (!await page.evaluate(() => window.COMPARISON?.ready)) {
      throw Error(await page.evaluate(() => (window.COMPARISON?.errors || ['COMPARISON missing']).join('\n')));
    }
    report.readyAtMs = elapsed();
    report.runtime = await page.evaluate(() => ({
      sourceCounts: COMPARISON.sources.map(source => ({
        key: source.key, nodes: source.nodes.length, meshes: source.primitives.length,
        materials: source.g.materials.length, textures: source.g.textures.length,
        tracks: source.model.animations.reduce((sum, clip) => sum + clip.tracks.length, 0),
        scale: source.root.scale.toArray()
      })),
      frustums: COMPARISON.panels.map(panel => [panel.camera.left, panel.camera.right, panel.camera.top, panel.camera.bottom]),
      cameraMatrices: COMPARISON.panels.map(panel => panel.camera.matrixWorld.elements),
      sourceUnits: COMPARISON.sourceUnits,
      panelLabelsOnTop: [...document.querySelectorAll('.label')].every(element => Number(getComputedStyle(element).zIndex) > 0),
      designGlass: {opacity: COMPARISON.design.designGlass.opacity, transmission: COMPARISON.design.designGlass.transmission},
      oilWaterRoofClosed: COMPARISON.design.oilWaterRoof.userData.everyEdgeUsedTwice
    }));
    await shot('01-source-side-comparison.png');
    const pose = () => page.evaluate(() => COMPARISON.sources.slice(0, 2).map(source => source.nodes.map(node => node.matrixWorld.elements.slice())));
    const before = await pose();
    await page.locator('#play').click();
    await page.waitForTimeout(1200);
    await page.locator('#play').click();
    const after = await pose();
    report.animationMoved = JSON.stringify(before) !== JSON.stringify(after);
    report.animationSynchronized = JSON.stringify(after[0]) === JSON.stringify(after[1]);
    await page.locator('#rest').click();
    report.bindPoseRestored = JSON.stringify(before) === JSON.stringify(await pose());
    await page.locator('#shell').click();
    report.originalRestoredByToggle = await page.evaluate(() => COMPARISON.sources[1].primitives.every(primitive => primitive.object.visible));
    await page.locator('#shell').click();
    await page.locator('#quarter').click();
    await shot('02-source-quarter-comparison.png');
    await page.evaluate(() => { COMPARISON.design.designGlass.envMapIntensity = 0; COMPARISON.render(); });
    await shot('04-glass-diagnostic-no-reflection.png');
    await page.evaluate(() => { COMPARISON.design.designGlass.visible = false; COMPARISON.render(); });
    await shot('05-glass-diagnostic-interior-uncovered.png');
    await page.evaluate(() => {
      COMPARISON.design.designGlass.visible = true;
      COMPARISON.design.designGlass.envMapIntensity = .18;
      COMPARISON.render();
    });
    await page.locator('#side').click();
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(200);
    await shot('03-mobile-comparison.png');
    report.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    report.errors.push(...await page.evaluate(() => COMPARISON.errors));
    const counts = report.runtime.sourceCounts;
    report.sameCamera = report.runtime.cameraMatrices.every(matrix => JSON.stringify(matrix) === JSON.stringify(report.runtime.cameraMatrices[0]));
    report.sameScale = counts.every(source => JSON.stringify(source.scale) === '[1,1,1]');
    report.assertions = {
      sourceNodesPreserved: counts.map(source => source.nodes).join(',') === '331,331,145,145',
      sourceMeshesPreserved: counts.map(source => source.meshes).join(',') === '200,200,89,89',
      panelLabelsOnTop: report.runtime.panelLabelsOnTop,
      oilWaterRoofClosed: report.runtime.oilWaterRoofClosed,
      designGlassOpaque: report.runtime.designGlass.opacity === 1,
      sameCamera: report.sameCamera, sameScale: report.sameScale,
      animationMoved: report.animationMoved, animationSynchronized: report.animationSynchronized,
      bindPoseRestored: report.bindPoseRestored, originalRestoredByToggle: report.originalRestoredByToggle,
      mobileFits: !report.mobileOverflow, noRuntimeErrors: !report.errors.length,
      noFailedRequests: !report.failedRequests.length,
      noHTTPFailures: !report.resources.some(resource => resource.status >= 400 && !resource.url.includes('favicon.ico'))
    };
    const failed = Object.entries(report.assertions).filter(([, passed]) => !passed).map(([name]) => name);
    if (failed.length) throw Error(`COMPARISON_ASSERTION_FAILED ${failed.join(', ')}`);
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL';
    report.failure = failureText(error);
    process.exitCode = 1;
    clearInterval(sampleTimer);
    await snapshot('failure');
    await shot('99-failure-state.png');
    if (page && !page.isClosed()) {
      try { fs.writeFileSync(path.join(qa, 'FAILURE_PAGE.html'), await bounded(page.content(), 8000, 'failure HTML')); }
      catch (captureError) { report.diagnosticErrors.push(failureText(captureError)); }
    }
  } finally {
    clearInterval(sampleTimer);
    releaseDelayedSource?.();
    await snapshot('final');
    await bounded(Promise.allSettled([...pendingResources]), 5000, 'network metadata').catch(error => report.diagnosticErrors.push(failureText(error)));
    report.pendingRequestsAtEnd = report.resources.filter(resource => resource.state === 'pending');
    report.httpFailures = report.resources.filter(resource => resource.status >= 400);
    report.finishedAt = new Date().toISOString();
    report.durationMs = elapsed();
    // Write the diagnostics before closing the browser, so pending requests remain distinguishable.
    fs.writeFileSync(path.join(qa, 'BROWSER_QA.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})();
