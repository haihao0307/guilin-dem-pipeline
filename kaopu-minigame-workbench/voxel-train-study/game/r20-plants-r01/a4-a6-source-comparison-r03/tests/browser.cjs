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
  physicalCalibration: false, projectionChecks: [], rasterChecks: [], dragChecks: [], zoomChecks: [],
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
          sourceUnits: comparison.sourceUnits, view: comparison.view,
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
    await page.screenshot({path: path.join(qa, name), timeout: 90000});
    report.screenshots.push(name);
  } catch (error) { report.diagnosticErrors.push(`${name}: ${failureText(error)}`); }
}

async function inspectProjection(expectedView) {
  return page.evaluate(view => {
    const close = (a, b, tolerance = 1e-7) => Number.isFinite(a) && Number.isFinite(b) &&
      Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));
    const expected = {
      side: {direction: [-1, 0, 0], up: [0, 1, 0]},
      front: {direction: [0, 0, -1], up: [0, 1, 0]},
      top: {direction: [0, -1, 0], up: [0, 0, -1]}
    }[view];
    const panels = COMPARISON.panels.map(panel => {
      const camera = panel.camera, rect = panel.element.getBoundingClientRect();
      camera.updateMatrixWorld(true);
      const vector = (x, y, z) => camera.position.clone().set(x, y, z);
      const direction = camera.getWorldDirection(vector(0, 0, 0));
      const right = vector(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = vector(0, 1, 0).applyQuaternion(camera.quaternion);
      const unitsPerPixel = {x: (camera.right - camera.left) / camera.zoom / rect.width,
        y: (camera.top - camera.bottom) / camera.zoom / rect.height};
      const expectedPixels = Math.min(rect.width, rect.height) * .1;
      const length = expectedPixels * unitsPerPixel.x;
      const span = camera.far - camera.near;
      const offset = Math.min(span, rect.width * unitsPerPixel.x, rect.height * unitsPerPixel.y) * .1;
      const probes = [];
      for (const [depth, fraction] of [['near', .2], ['middle', .5], ['far', .8]]) {
        const center = camera.position.clone().addScaledVector(direction, camera.near + span * fraction);
        for (const [position, sign] of [['rear', -1], ['middle', 0], ['front', 1]]) {
          const location = center.clone().add(vector(0, 0, offset * sign));
          for (const [axis, axisVector] of [['horizontal', right], ['vertical', up]]) {
            const start = location.clone().addScaledVector(axisVector, -length / 2).project(camera);
            const end = location.clone().addScaledVector(axisVector, length / 2).project(camera);
            const pixels = Math.hypot((end.x - start.x) * rect.width / 2, (end.y - start.y) * rect.height / 2);
            probes.push({depth, position, axis, worldLength: length, pixels, expectedPixels,
              passed: close(pixels, expectedPixels)});
          }
        }
      }
      return {id: panel.id || panel.element.id, source: panel.source.key, width: rect.width, height: rect.height,
        orthographic: Boolean(camera.isOrthographicCamera), direction: direction.toArray(), up: up.toArray(),
        unitsPerPixel, probes, projectionMatrix: camera.projectionMatrix.elements.slice(),
        axisAligned: direction.toArray().every((v, i) => close(v, expected.direction[i])) &&
          up.toArray().every((v, i) => close(v, expected.up[i])),
        validClipRange: camera.near >= 0 && camera.far > camera.near,
        squarePixelScale: unitsPerPixel.x > 0 && close(unitsPerPixel.x, unitsPerPixel.y)};
    });
    const byID = Object.fromEntries(panels.map(panel => [panel.id, panel]));
    const pairChecks = [['a4', 'a6'], ['mark3', 'coach']].map(([left, right]) => {
      const a = byID[left], b = byID[right];
      return {left, right, sameSource: Boolean(a && b && a.source === b.source),
        matched: Boolean(a && b && close(a.unitsPerPixel.x, b.unitsPerPixel.x) && close(a.unitsPerPixel.y, b.unitsPerPixel.y))};
    });
    return {expectedView: view, actualView: COMPARISON.view, panels, pairChecks,
      axisAligned: COMPARISON.view === view && panels.length === 4 && panels.every(p => p.axisAligned),
      equalProjectedLengths: panels.every(p => p.validClipRange && p.probes.every(probe => probe.passed)),
      squarePixelScale: panels.every(p => p.squarePixelScale),
      sourcePairScaleMatched: pairChecks.every(pair => pair.sameSource && pair.matched)};
  }, expectedView);
}

async function inspectRasterProjection(expectedView) {
  return page.evaluate(async view => {
    const T = await import('three');
    const renderer = COMPARISON.renderer;
    const saved = {target: renderer.getRenderTarget(), viewport: renderer.getViewport(new T.Vector4()),
      scissor: renderer.getScissor(new T.Vector4()), scissorTest: renderer.getScissorTest(),
      clearColor: renderer.getClearColor(new T.Color()).clone(), clearAlpha: renderer.getClearAlpha()};
    const scene = new T.Scene();
    scene.background = new T.Color(0x000000);
    const geometry = new T.PlaneGeometry(1, 1);
    const material = new T.MeshBasicMaterial({color: 0xffffff, toneMapped: false, side: T.DoubleSide});
    const marker = new T.Mesh(geometry, material);
    scene.add(marker);
    const groupWorldLengths = new Map();
    const panels = [];
    try {
      renderer.setScissorTest(false);
      for (const panel of COMPARISON.panels) {
        const camera = panel.camera.clone();
        camera.updateMatrixWorld(true);
        const rect = panel.element.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
        const xWorldPerPixel = (camera.right - camera.left) / camera.zoom / width;
        const yWorldPerPixel = (camera.top - camera.bottom) / camera.zoom / height;
        const source = panel.source.key;
        if (!groupWorldLengths.has(source)) groupWorldLengths.set(source, xWorldPerPixel * 48);
        const length = groupWorldLengths.get(source);
        const target = new T.WebGLRenderTarget(width, height, {depthBuffer: false, stencilBuffer: false});
        const buffer = new Uint8Array(width * height * 4);
        const direction = camera.getWorldDirection(new T.Vector3());
        const span = camera.far - camera.near;
        const offset = Math.min(span, width * xWorldPerPixel, height * yWorldPerPixel) * .1;
        const probes = [];
        marker.quaternion.copy(camera.quaternion);
        try {
          renderer.setRenderTarget(target);
          renderer.setViewport(0, 0, width, height);
          for (const [depth, fraction] of [['near', .2], ['far', .8]]) {
            const center = camera.position.clone().addScaledVector(direction, camera.near + span * fraction);
            for (const [position, sign] of [['rear', -1], ['front', 1]]) {
              marker.position.copy(center).add(new T.Vector3(0, 0, offset * sign));
              for (const axis of ['horizontal', 'vertical']) {
                marker.scale.set(axis === 'horizontal' ? length : xWorldPerPixel * 5,
                  axis === 'vertical' ? length : yWorldPerPixel * 5, 1);
                renderer.clear();
                renderer.render(scene, camera);
                renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
                let minX = width, maxX = -1, minY = height, maxY = -1, litPixels = 0;
                for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                  const i = (y * width + x) * 4;
                  if (buffer[i] > 127 && buffer[i + 1] > 127 && buffer[i + 2] > 127) {
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y); litPixels++;
                  }
                }
                const rasterPixels = litPixels ? axis === 'horizontal' ? maxX - minX + 1 : maxY - minY + 1 : 0;
                const expectedPixels = length / (axis === 'horizontal' ? xWorldPerPixel : yWorldPerPixel);
                const cssPixels = rasterPixels * (axis === 'horizontal' ? rect.width / width : rect.height / height);
                probes.push({depth, position, axis, worldLength: length, litPixels,
                  bbox: {minX, maxX, minY, maxY}, rasterPixels, cssPixels, expectedPixels,
                  errorPixels: Math.abs(rasterPixels - expectedPixels),
                  passed: litPixels > 0 && Math.abs(rasterPixels - expectedPixels) <= 1 + 1e-7});
              }
            }
          }
        } finally { target.dispose(); }
        const spreads = ['horizontal', 'vertical'].map(axis => {
          const values = probes.filter(probe => probe.axis === axis).map(probe => probe.rasterPixels);
          return {axis, min: Math.min(...values), max: Math.max(...values),
            passed: Math.max(...values) - Math.min(...values) <= 1};
        });
        panels.push({id: panel.id || panel.element.id, source, width, height, worldLength: length, probes, spreads,
          passed: probes.every(probe => probe.passed) && spreads.every(spread => spread.passed)});
      }
    } finally {
      scene.remove(marker); geometry.dispose(); material.dispose();
      renderer.setRenderTarget(saved.target);
      renderer.setViewport(saved.viewport);
      renderer.setScissor(saved.scissor);
      renderer.setScissorTest(saved.scissorTest);
      renderer.setClearColor(saved.clearColor, saved.clearAlpha);
      // Markers only existed in the separate test scene. Restore the real view
      // before ordinary model screenshots, including when the pixel test fails.
      COMPARISON.render();
    }
    const byID = Object.fromEntries(panels.map(panel => [panel.id, panel]));
    const pairs = [['a4', 'a6'], ['mark3', 'coach']].map(([a, b]) => ({a, b,
      passed: Boolean(byID[a] && byID[b] && byID[a].worldLength === byID[b].worldLength &&
        byID[a].probes.every((probe, i) => Math.abs(probe.cssPixels - byID[b].probes[i].cssPixels) <= 1))}));
    return {view, method: 'same WebGL renderer; isolated white planes; readRenderTargetPixels bounding boxes',
      tolerancePixels: 1, panels, pairs, passed: panels.length === 4 && panels.every(p => p.passed) && pairs.every(p => p.passed)};
  }, expectedView);
}

function sameDirections(before, after) {
  return before.actualView === after.actualView && before.panels.length === after.panels.length &&
    before.panels.every((panel, i) => [...panel.direction, ...panel.up].every((v, j) =>
      Math.abs(v - [...after.panels[i].direction, ...after.panels[i].up][j]) < 1e-8));
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
      displayRegistrations: COMPARISON.panels.map(p=>({data:p.displayRegistration.userData,sourceLocalUnchanged:JSON.stringify(p.source.root.matrix.elements)===JSON.stringify(p.displayRegistration.userData.originalRootLocalMatrix)})),
      panelLabelsOnTop: [...document.querySelectorAll('.label')].every(element => Number(getComputedStyle(element).zIndex) > 0),
      cabVisibility:COMPARISON.design.auditVisibility(),
      locomotivePaint:(()=>{const m=COMPARISON.design.skin.material[0];return{color:m.color.getHexString(),metalness:m.metalness,roughness:m.roughness,clearcoat:m.clearcoat}})(),
      designGlass: {opacity: COMPARISON.design.designGlass.opacity, transmission: COMPARISON.design.designGlass.transmission},
      oilWaterRoofClosed: COMPARISON.design.oilWaterRoof.userData.everyEdgeUsedTwice,
      coachDesign:COMPARISON.coachDesign?{metadata:COMPARISON.coachDesign.root.userData,meshCount:(()=>{let n=0;COMPARISON.coachDesign.root.traverse(o=>{if(o.isMesh)n++});return n})(),hiddenSourcePrimitives:COMPARISON.sources[3].primitives.filter(p=>!p.object.visible).map(p=>p.sourceNode),protectedVisible:COMPARISON.coachDesign.root.userData.protectedMechanicalPrimitiveNodes.every(id=>{const a=COMPARISON.sources[3].primitives.filter(p=>p.sourceNode===id);return a.length>0&&a.every(p=>p.object.visible)}),paint:{color:COMPARISON.coachDesign.materials.paint.color.getHexString(),metalness:COMPARISON.coachDesign.materials.paint.metalness,roughness:COMPARISON.coachDesign.materials.paint.roughness,clearcoat:COMPARISON.coachDesign.materials.paint.clearcoat}}:null
    }));
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
    report.originalRestoredByToggle = await page.evaluate(() => [COMPARISON.sources[1],COMPARISON.sources[3]].every(source=>source.primitives.every(primitive => primitive.object.visible)));
    await page.locator('#shell').click();
    report.noQuarterView = await page.locator('#quarter').count() === 0;
    for (const [view, screenshot] of [
      ['side', '01-source-side-comparison.png'],
      ['front', '02-source-front-comparison.png'],
      ['top', '03-source-top-comparison.png']
    ]) {
      await page.locator('#' + view).click();
      await page.waitForTimeout(150);
      const projection = await inspectProjection(view);
      report.projectionChecks.push(projection);
      report.rasterChecks.push(await inspectRasterProjection(view));
      await shot(screenshot);
      if(view==='side'){
        const detailPanel=await page.locator('#a6').boundingBox();
        await page.mouse.move(detailPanel.x+detailPanel.width/2,detailPanel.y+detailPanel.height/2);
        await page.mouse.wheel(0,-1000);await page.waitForTimeout(150);
        await shot('04-shared-scale-side-driver-detail.png');
        await page.locator('#side').click();await page.waitForTimeout(100);
      }
      // A pointer drag must never reintroduce the rejected free-orbit view.
      const target = await page.locator('#a6').boundingBox();
      await page.mouse.move(target.x + target.width * .4, target.y + target.height * .4);
      await page.mouse.down();
      await page.mouse.move(target.x + target.width * .6, target.y + target.height * .6, {steps: 6});
      await page.mouse.up();
      const afterDrag = await inspectProjection(view);
      report.dragChecks.push({view, unchanged: sameDirections(projection, afterDrag), projection: afterDrag});
      // Zoom may change scale, but it must stay synchronized and axis-aligned.
      await page.mouse.wheel(0, -160);
      await page.waitForTimeout(150);
      const afterZoom = await inspectProjection(view);
      const ratios = afterZoom.panels.map((panel, i) => panel.unitsPerPixel.x / afterDrag.panels[i].unitsPerPixel.x);
      report.zoomChecks.push({view, ratios, changed: ratios.every(ratio => ratio < 1 - 1e-6),
        synchronized: ratios.every(ratio => Math.abs(ratio - ratios[0]) < 1e-8), projection: afterZoom});
    }
    await page.locator('#side').click();
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(200);
    for (const view of ['side', 'front', 'top']) {
      await page.locator('#' + view).click();
      await page.waitForTimeout(100);
      report.projectionChecks.push({...await inspectProjection(view), mobile: true});
      if(view==='side')await shot(`04-mobile-${view}-comparison.png`);
    }
    report.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    report.errors.push(...await page.evaluate(() => COMPARISON.errors));
    const counts = report.runtime.sourceCounts;
    report.sameScale = counts.every(source => JSON.stringify(source.scale) === '[1,1,1]');
    report.assertions = {
      sourceNodesPreserved: counts.map(source => source.nodes).join(',') === '331,331,145,145',
      sourceMeshesPreserved: counts.map(source => source.meshes).join(',') === '200,200,89,89',
      panelLabelsOnTop: report.runtime.panelLabelsOnTop,
      cabForwardAndStreetVisibility:report.runtime.cabVisibility?.status==='PASS_REQUIRED_ACTUAL_MESH_RAYS',
      coachHasRealDesignLayer:!!report.runtime.coachDesign&&report.runtime.coachDesign.meshCount>0,
      unifiedLocomotiveCoachPaint:JSON.stringify(report.runtime.locomotivePaint)===JSON.stringify(report.runtime.coachDesign.paint),
      coachMechanicalPrimitivesVisible:report.runtime.coachDesign?.protectedVisible===true,
      coachExactExteriorOnly:report.runtime.coachDesign?.hiddenSourcePrimitives.slice().sort((a,b)=>a-b).join(',')==='15,17,18,130,134',
      coachOriginalWindowsRetained:report.runtime.coachDesign?.metadata.windowOpeningsPreserved===true&&report.runtime.coachDesign.metadata.windowCount===20,
      oilWaterRoofClosed: report.runtime.oilWaterRoofClosed,
      designGlassOpaque: report.runtime.designGlass.opacity === 1,
      sameScale: report.sameScale,
      displayOnlyRegistration:report.runtime.displayRegistrations.length===4&&report.runtime.displayRegistrations.every(p=>p.sourceLocalUnchanged&&p.data.sourceGeometryChanged===false&&p.data.physicalRailDatumCertified===false),
      noQuarterView: report.noQuarterView,
      threeAxisAlignedViews: report.projectionChecks.length === 6 && report.projectionChecks.every(check => check.axisAligned),
      equalProjectedLengths: report.projectionChecks.every(check => check.equalProjectedLengths),
      equalRasterPixelLengths: report.rasterChecks.length === 3 && report.rasterChecks.every(check => check.passed),
      sourcePairScaleMatched: report.projectionChecks.every(check => check.sourcePairScaleMatched),
      globalNumericalSourceScaleMatched: report.projectionChecks.every(check=>check.panels.every(p=>Math.abs(p.unitsPerPixel.x-check.panels[0].unitsPerPixel.x)<1e-10&&Math.abs(p.unitsPerPixel.y-check.panels[0].unitsPerPixel.y)<1e-10)),
      squarePixelScale: report.projectionChecks.every(check => check.squarePixelScale),
      noFreeOrbit: report.dragChecks.length === 3 && report.dragChecks.every(check => check.unchanged && check.projection.axisAligned),
      synchronizedZoom: report.zoomChecks.length === 3 && report.zoomChecks.every(check => check.changed && check.synchronized && check.projection.sourcePairScaleMatched && check.projection.axisAligned && check.projection.equalProjectedLengths),
      requiredViewScreenshots: ['01-source-side-comparison.png', '02-source-front-comparison.png', '03-source-top-comparison.png'].every(name => report.screenshots.includes(name)),
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
