#!/usr/bin/env node
/**
 * Functional CI acceptance, not visual approval.
 *
 *   node tests/browser-smoke.mjs --file dist/index.html --report evidence/local-browser-smoke.json
 *   node tests/browser-smoke.mjs --url https://example.test/study/ --report evidence/public-browser-smoke.json
 *
 * Install Playwright in .ci-runtime and its Chromium browser in the CI job.
 * App mutations are exclusively real pointer/keyboard interactions. The
 * __CLO_STUDY__.snapshot() hook and DOM/WebGL queries are used only for reads.
 * Exactly one complete live solve is requested; the second job is cancelled.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOTAL_TIMEOUT_MS = 420_000;
const SOLVE_TIMEOUT_MS = 180_000;
const DESKTOP = {width: 1440, height: 1000};
const MOBILE = {width: 390, height: 844};
const LIVE_DELTA = 20;
const CANCEL_DELTA = 30;
// Source identities and precomputed mesh identities independently audited at
// the frozen upstream commit. A deliberate fixture change needs fresh review.
const LOCK = Object.freeze({
  upstream: 'c84b16a0ae022dda9fe22c09df758fcb8095bc07',
  personGeometry: 'fbc056553c1731b790769124bee121554f0800400271eaf564a0ad5e6f458571',
  personTopology: 'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de',
  basePaper: '3e54c6322a46ea7232644f341a4f5ea300d0b20a24a1d45765138b707d753baa',
  baseMaterial: '9560f8c32c476636596e489be45cdc3bb19ba3356c2fb11445011a6fcdeb6208',
  initialMaterial: '27130b8a0ff4636976dd8538df65e4df5a76422bc98e94faeddaf9835782701a',
  panelIds: ['skirt_back', 'skirt_front', 'wb_back', 'wb_front'],
  baseFrontLengthMm: 630.5168433422547
});
const THRESHOLDS = Object.freeze({maximumTensionPercent: 15, maximumCompressionPercent: 15, maximumNeedleGapMm: .25, minimumBodyDistanceMm: -.05, maximumWholeSeamSeparationMm: .25});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const digest = value => hash(JSON.stringify(canonical(value)));
const isSHA256 = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const cm = delta => ((LOCK.baseFrontLengthMm + delta) / 10).toFixed(1) + ' cm';
const timestamp = () => new Date().toISOString();

function options() {
  const result = {};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (!['--file', '--url', '--report'].includes(key) || !process.argv[i + 1] || process.argv[i + 1].startsWith('--')) {
      throw Error('Usage: node tests/browser-smoke.mjs (--file dist/index.html | --url HTTPS) --report evidence/report.json');
    }
    if (result[key.slice(2)]) throw Error('Repeated option: ' + key);
    result[key.slice(2)] = process.argv[++i];
  }
  if (!!result.file === !!result.url || !result.report) throw Error('Provide exactly one of --file / --url and a --report destination.');
  if (result.url && new URL(result.url).protocol !== 'https:') throw Error('--url must use HTTPS.');
  return result;
}

async function playwright() {
  if (process.env.CLO_PLAYWRIGHT_MODULE) {
    const configured = process.env.CLO_PLAYWRIGHT_MODULE;
    return import(configured.startsWith('file:') ? configured : pathToFileURL(path.resolve(configured)).href);
  }
  const candidates = [...new Set([process.cwd(), PROJECT, path.dirname(PROJECT)])]
    .map(root => path.join(root, '.ci-runtime/node_modules/playwright/index.mjs'));
  for (const candidate of candidates) {
    try { await fs.access(candidate); } catch { continue; }
    return import(pathToFileURL(candidate).href);
  }
  throw Error('Playwright is missing: install it into .ci-runtime/node_modules/playwright before running this CI script.');
}

async function main() {
  const args = options();
  const mode = args.file ? 'file' : 'https';
  const reportPath = path.resolve(args.report);
  const reportDirectory = path.dirname(reportPath);
  const screenshotPrefix = path.basename(reportPath, path.extname(reportPath));
  await fs.mkdir(reportDirectory, {recursive: true});
  const report = {
    schema: 'kaopu-clo-browser-smoke/1', startedAt: timestamp(), completedAt: null,
    mode, target: args.file ? path.resolve(args.file) : args.url,
    sourceHead: null, expectedSourceHead: process.env.GITHUB_SHA || null,
    passed: false, desktopPassed: false, mobileViewportPassed: false,
    standaloneCoreNetworkRequests: 0, visualAcceptance: false,
    browser: {engine: 'Chromium', headless: true, graphics: 'ANGLE SwiftShader explicitly requested'},
    timeouts: {totalMs: TOTAL_TIMEOUT_MS, eachCompleteSolveMs: SOLVE_TIMEOUT_MS},
    checks: [], screenshots: {}, evidence: {},
    network: {bootstrap: [], core: [], optionalBrowserIcons: [], failures: [], blockedHttpRequests: 0},
    consoleErrors: [], consoleWarnings: [], pageErrors: [], contextLossObserved: false,
    workers: [], phaseTimeline: [],
    limits: ['Automated functional and viewport checks only; screenshots require separate visual review.', '390 px is a responsive viewport check, not a mobile-device performance or touch certification.', 'One complete +20 mm live solve; no full-range physics sweep.']
  };
  let browser, context, page, suiteTimer;
  let localManifest = null, manifest = null, htmlBytes = null, finalURL = null;
  let manifestURL = mode === 'https' ? new URL('manifest.json', args.url).href : null;
  let lastPhaseKey = null;
  const check = (id, condition, detail = {}) => {
    const item = {id, passed: !!condition, ...detail};
    report.checks.push(item);
    if (!condition) throw Error('Check failed: ' + id + (detail.reason ? ' — ' + detail.reason : ''));
  };
  const recordState = state => {
    if (!state) return;
    if (state.geometry?.contextLost) report.contextLossObserved = true;
    const key = [state.phase, state.busy, state.requestId, state.revision, state.liveSolveCount].join('|');
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      report.phaseTimeline.push({at: timestamp(), phase: state.phase, busy: state.busy, requestId: state.requestId, revision: state.revision, currentDelta: state.currentDelta, requestedDelta: state.requestedDelta, liveSolveCount: state.liveSolveCount});
    }
  };
  const snapshot = async () => {
    const state = await page.evaluate(() => window.__CLO_STUDY__?.snapshot() ?? null);
    recordState(state);
    return state;
  };
  async function waitState(label, predicate, timeout = 20_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const state = await snapshot();
      if (state?.lastError) throw Error(label + ': app error: ' + state.lastError);
      if (state?.geometry?.contextLost) throw Error(label + ': WebGL context lost.');
      if (state && predicate(state)) return state;
      if (!state && await page.locator('#errorBanner').isVisible()) throw Error(label + ': ' + await page.locator('#errorBanner').innerText());
      await page.waitForTimeout(250);
    }
    throw Error(label + ' timed out after ' + timeout + ' ms.');
  }
  const saveScreenshot = async name => {
    const filename = screenshotPrefix + '.' + name + '.png';
    await page.screenshot({path: path.join(reportDirectory, filename), fullPage: true, animations: 'disabled', timeout: 30_000});
    report.screenshots[name] = filename;
  };
  const readDOM = () => page.evaluate(() => ({
    sourceCommit: document.documentElement.dataset.sourceCommit,
    buildId: document.documentElement.dataset.buildId,
    baselineLength: document.getElementById('baselineLength')?.textContent,
    candidateLength: document.getElementById('candidateLength')?.textContent,
    lengthValue: document.getElementById('lengthValue')?.textContent,
    seamValue: document.getElementById('seamValue')?.textContent,
    strainValue: document.getElementById('strainValue')?.textContent,
    penetrationValue: document.getElementById('penetrationValue')?.textContent,
    paper: Array.from(document.querySelectorAll('#patternSvg [data-panel-id]')).map(group => ({
      id: group.dataset.panelId,
      current: group.querySelector('.current-outline')?.getAttribute('d'),
      original: group.querySelector('path:not(.current-outline)')?.getAttribute('d')
    }))
  }));
  async function committedState() {
    const state = await snapshot(), dom = await readDOM();
    return {
      currentDelta: state.currentDelta, binding: state.binding, staticGate: state.staticGate,
      candidateRevision: state.geometry.candidateRevision, candidateGeometry: state.geometry.candidate,
      originalGeometry: state.geometry.original, candidateLength: dom.candidateLength,
      seamValue: dom.seamValue, strainValue: dom.strainValue, penetrationValue: dom.penetrationValue, paper: dom.paper
    };
  }
  async function layout(label, viewport) {
    const state = await snapshot();
    const measured = await page.evaluate(() => {
      const canvas = document.getElementById('stageCanvas'), rect = canvas.getBoundingClientRect();
      const gl = canvas.getContext('webgl2');
      const overflowing = Array.from(document.body.querySelectorAll('*')).flatMap(element => {
        const r = element.getBoundingClientRect(), css = getComputedStyle(element);
        if (!r.width || !r.height || css.display === 'none' || css.visibility === 'hidden') return [];
        return r.left < -1 || r.right > innerWidth + 1 ? [{tag: element.tagName, id: element.id, left: r.left, right: r.right}] : [];
      }).slice(0, 20);
      return {
        innerWidth, innerHeight, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
        overflowing,
        canvas: {cssWidth: rect.width, cssHeight: rect.height, pixelWidth: canvas.width, pixelHeight: canvas.height, webgl2: !!gl, contextLost: gl?.isContextLost() ?? null, version: gl?.getParameter(gl.VERSION), renderer: gl?.getParameter(gl.RENDERER)}
      };
    });
    check(label + '-no-horizontal-overflow', measured.innerWidth === viewport.width && measured.documentWidth <= viewport.width + 1 && measured.bodyWidth <= viewport.width + 1 && measured.overflowing.length === 0, measured);
    check(label + '-live-webgl', measured.canvas.webgl2 && !measured.canvas.contextLost && measured.canvas.cssWidth > 100 && measured.canvas.cssHeight > 100 && state.geometry.ready && state.geometry.renderCalls > 0 && state.geometry.sceneDraws >= 2, {canvas: measured.canvas, renders: state.geometry.renderCalls});
    report.evidence[label + 'Layout'] = measured;
    return measured;
  }
  async function clickView(value) {
    const before = await snapshot();
    await page.locator('[data-view="' + value + '"]').click();
    const after = await waitState('View ' + value, state => state.geometry.namedView === value && state.geometry.renderCalls > before.geometry.renderCalls);
    check('view-' + value, await page.locator('[data-view="' + value + '"]').getAttribute('aria-pressed') === 'true', {camera: after.geometry.camera});
    return after;
  }
  async function setSlider(delta) {
    const slider = page.locator('#lengthInput');
    const min = Number(await slider.getAttribute('min')), max = Number(await slider.getAttribute('max')), step = Number(await slider.getAttribute('step'));
    if (!(delta >= min && delta <= max && Number.isInteger((delta - min) / step))) throw Error('Test delta does not fit actual slider range.');
    await slider.press('Home');
    for (let i = 0; i < (delta - min) / step; i++) await slider.press('ArrowRight');
    check('slider-keyboard-' + delta, Number(await slider.inputValue()) === delta, {min, max, step});
    return waitState('Slider ' + delta, state => state.requestedDelta === delta && !state.busy);
  }
  function assertBodyAndGeometry(state, id) {
    const geometry = state.geometry;
    check(id + '-native-body', geometry.body.verticesPerView === 25417 && geometry.body.trianglesPerView === 50624 && geometry.body.geometrySHA256 === LOCK.personGeometry && geometry.body.topologySHA256 === LOCK.personTopology, {body: geometry.body});
    check(id + '-physical-mesh', geometry.original.vertices === 3476 && geometry.original.triangles === 6160 && geometry.candidate.vertices > 3000 && geometry.candidate.triangles > 5000 && geometry.original.panels === 4 && geometry.candidate.panels === 4 && geometry.original.activeSeams === 20 && geometry.candidate.activeSeams === 20 && equal(geometry.original.panelIds, LOCK.panelIds) && equal(geometry.candidate.panelIds, LOCK.panelIds), {original: geometry.original, candidate: geometry.candidate});
    check(id + '-source-binding', state.binding.presetId === 'S03' && state.binding.person.geometrySHA256 === geometry.body.geometrySHA256 && state.binding.person.topologySHA256 === geometry.body.topologySHA256 && ['recipeHash', 'paperSHA256', 'materialSHA256'].every(key => isSHA256(state.binding[key])), {binding: state.binding});
    check(id + '-renderer-contract', geometry.noProxy && !geometry.bodyScaling && !geometry.garmentScaling && geometry.singleRenderer && geometry.sharedCamera && !geometry.candidate.movedSolvedVertices && !geometry.candidate.physicalTopologyChanged && geometry.candidate.strain.pressure === false);
  }
  async function run() {
    if (mode === 'file') {
      const input = path.resolve(args.file);
      htmlBytes = await fs.readFile(input);
      try { localManifest = JSON.parse(await fs.readFile(path.join(path.dirname(input), 'manifest.json'), 'utf8')); }
      catch (error) { if (!process.env.GITHUB_SHA || error.code !== 'ENOENT') throw error; }
      manifest = localManifest;
      report.expectedSourceHead ||= manifest?.sourceHead || manifest?.sourceCommit || null;
      if (!report.expectedSourceHead) throw Error('No expected source head: set GITHUB_SHA or supply dist/manifest.json.');
    }
    const {chromium} = await playwright();
    browser = await chromium.launch({headless: true, timeout: 60_000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage']});
    report.browser.version = browser.version();
    context = await browser.newContext({viewport: DESKTOP, deviceScaleFactor: 1, locale: 'zh-CN', serviceWorkers: 'block', reducedMotion: 'reduce', extraHTTPHeaders: {'Cache-Control': 'no-cache', Pragma: 'no-cache'}});
    // A file run cannot accidentally borrow a CDN asset or remote solver. Any
    // attempted HTTP(S) request counts as a failure, even though it is blocked.
    if (mode === 'file') await context.route(/^https?:\/\//, async route => { report.network.blockedHttpRequests++; await route.abort('blockedbyclient'); });
    context.on('request', request => {
      if (!/^https?:/.test(request.url())) return;
      const row = {url: request.url(), resourceType: request.resourceType(), method: request.method()};
      let isMainDocument = false;
      try { isMainDocument = request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page?.mainFrame(); } catch { /* Worker requests have no frame. */ }
      const u = new URL(request.url()), m = manifestURL ? new URL(manifestURL) : null;
      if (mode === 'https' && (isMainDocument || m && u.origin === m.origin && u.pathname === m.pathname)) report.network.bootstrap.push(row);
      else if (mode === 'https' && request.resourceType() === 'other' && u.pathname.endsWith('/favicon.ico')) report.network.optionalBrowserIcons.push(row);
      else { report.standaloneCoreNetworkRequests++; if (report.network.core.length < 200) report.network.core.push(row); }
    });
    context.on('requestfailed', request => {
      if (report.network.failures.length < 100) report.network.failures.push({url: request.url(), error: request.failure()?.errorText});
    });
    page = await context.newPage();
    page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(60_000);
    page.on('console', message => {
      const row = {type: message.type(), text: message.text().slice(0, 2000), location: message.location()};
      if (message.type() === 'error' && report.consoleErrors.length < 100) report.consoleErrors.push(row);
      if (message.type() === 'warning' && report.consoleWarnings.length < 100) report.consoleWarnings.push(row);
    });
    page.on('pageerror', error => { if (report.pageErrors.length < 50) report.pageErrors.push({message: error.message, stack: error.stack?.slice(0, 3000)}); });
    page.on('crash', () => report.pageErrors.push({message: 'Browser page crashed.'}));
    page.on('worker', worker => {
      const row = {url: worker.url(), createdAt: timestamp(), closedAt: null};
      report.workers.push(row); worker.on('close', () => { row.closedAt = timestamp(); });
    });
    const target = mode === 'file' ? pathToFileURL(path.resolve(args.file)).href : args.url;
    const response = await page.goto(target, {waitUntil: 'domcontentloaded'});
    finalURL = page.url(); report.evidence.finalURL = finalURL;
    if (mode === 'https') {
      check('https-document', new URL(finalURL).protocol === 'https:' && response?.ok(), {status: response?.status(), finalURL});
      htmlBytes = await response.body();
      manifestURL = new URL('manifest.json', finalURL).href;
      const fetched = await context.request.get(manifestURL, {timeout: 30_000, headers: {'Cache-Control': 'no-cache'}});
      report.network.bootstrap.push({url: manifestURL, resourceType: 'manifest', method: 'GET', status: fetched.status(), initiatedBy: 'acceptance script'});
      check('public-manifest', fetched.ok(), {status: fetched.status()});
      manifest = await fetched.json();
      report.expectedSourceHead ||= manifest.sourceHead || manifest.sourceCommit || null;
      if (!report.expectedSourceHead) throw Error('Public manifest has no source head and GITHUB_SHA is unset.');
    }
    if (manifest) {
      check('manifest-source-head', (manifest.sourceHead || manifest.sourceCommit) === report.expectedSourceHead && (!manifest.sourceCommit || manifest.sourceCommit === report.expectedSourceHead), {sourceHead: manifest.sourceHead, sourceCommit: manifest.sourceCommit});
      check('html-content-hash', isSHA256(manifest.htmlSHA256) && hash(htmlBytes) === manifest.htmlSHA256, {actual: hash(htmlBytes), expected: manifest.htmlSHA256, bytes: htmlBytes.length});
    }
    const initial = await waitState('Initial real 3D', state => state.ready && !state.busy && state.geometry?.ready && state.geometry.renderCalls > 0, 60_000);
    const initialDOM = await readDOM();
    report.sourceHead = initial.source.sourceHead || initial.source.sourceCommit;
    check('embedded-source-head', report.sourceHead === report.expectedSourceHead && initial.source.sourceCommit === report.expectedSourceHead && initialDOM.sourceCommit === report.expectedSourceHead, {embedded: report.sourceHead, expected: report.expectedSourceHead});
    check('frozen-upstream-and-scope', initial.source.upstreamCommit === LOCK.upstream && initial.source.productionReady === false && initial.source.visualAcceptance === false && initial.source.requiredRuntimeNetworkRequests === 0);
    assertBodyAndGeometry(initial, 'initial');
    check('initial-candidate-binding', initial.currentDelta === 60 && initial.requestedDelta === 60 && initial.liveSolveCount === 0 && initial.binding.operation?.deltaMm === 60 && initial.binding.basePaperSHA256 === LOCK.basePaper && initial.binding.materialSHA256 === LOCK.initialMaterial && initial.binding.materialSHA256 !== LOCK.baseMaterial && initial.geometry.candidate.vertices === 3742 && initial.geometry.candidate.triangles === 6676, {binding: initial.binding});
    check('initial-static-check', initial.staticGate.passed === true && equal(initial.staticGate.thresholds, THRESHOLDS) && initial.staticGate.dynamicWearCertified === false && initial.staticGate.continuousCollisionCertified === false);
    report.evidence.initial = initial;
    await layout('desktopInitial', DESKTOP);
    await saveScreenshot('desktop');

    const back = await clickView('back'), front = await clickView('front'), detail = await clickView('detail');
    const distance = camera => Math.hypot(...camera.position.map((value, i) => value - camera.target[i]));
    check('camera-views-change', back.geometry.camera.position[2] < back.geometry.camera.target[2] && front.geometry.camera.position[2] > front.geometry.camera.target[2] && distance(detail.geometry.camera) < distance(front.geometry.camera), {back: back.geometry.camera, front: front.geometry.camera, detail: detail.geometry.camera});
    await page.locator('[data-display="strain"]').click();
    const strain = await waitState('Strain display', state => state.display === 'strain' && state.geometry.display === 'strain');
    check('strain-color-contract', await page.locator('#strainLegend').isVisible() && strain.geometry.candidate.strain.trianglesMeasured === strain.geometry.candidate.triangles && strain.geometry.strainColors.saturationAbsoluteStrain === .15 && strain.geometry.candidate.strain.pressure === false);
    await page.locator('#seamsToggle').click();
    await waitState('Visible seam annotations', state => state.geometry.seamsVisible === true);
    check('seams-control', await page.locator('#seamsToggle').isChecked());
    await page.locator('#patternSvg [data-panel-id="skirt_back"]').click();
    const selected = await waitState('2D selection reaches 3D', state => state.selectedPanel === 'skirt_back' && state.geometry.selectedPanel === 'skirt_back');
    check('paper-to-garment-selection', await page.locator('#patternSvg [data-panel-id="skirt_back"]').getAttribute('aria-pressed') === 'true' && await page.locator('#patternLegend [data-panel-id="skirt_back"]').getAttribute('aria-pressed') === 'true', {selectedPanel: selected.geometry.selectedPanel});
    await page.locator('#patternSvg [data-panel-id="wb_front"]').press('Enter');
    await waitState('Keyboard panel selection', state => state.selectedPanel === 'wb_front' && state.geometry.selectedPanel === 'wb_front');
    await page.locator('#patternSvg [data-panel-id="wb_front"]').press('Enter');
    await waitState('Clear panel selection', state => state.selectedPanel === null && state.geometry.selectedPanel === null);
    await clickView('detail');
    await saveScreenshot('detail');

    await page.locator('[data-display="fabric"]').click();
    await page.locator('#seamsToggle').click();
    await clickView('front');
    const preMobile = await snapshot();
    await page.setViewportSize(MOBILE);
    await waitState('390 px render', state => state.geometry.ready && state.geometry.viewport.width < 390 && state.geometry.renderCalls > preMobile.geometry.renderCalls);
    await layout('mobile390', MOBILE);
    await clickView('back');
    await clickView('front');
    await saveScreenshot('mobile390');
    report.evidence.mobile390 = {state: await snapshot(), responsiveViewportOnly: true};
    check('mobile-no-errors', report.consoleErrors.length === 0 && report.pageErrors.length === 0 && !report.contextLossObserved);
    report.mobileViewportPassed = true;
    await page.setViewportSize(DESKTOP);
    await waitState('Desktop restored', state => state.geometry.viewport.width > 700 && state.geometry.ready);
    await clickView('front');

    const beforeDirty = await committedState();
    const beforeLive = await snapshot();
    await setSlider(LIVE_DELTA);
    const dirty = await waitState('Uncommitted length', state => state.phase === 'dirty' && state.requestedDelta === LIVE_DELTA && state.currentDelta === 60);
    const dirtyCommitted = await committedState();
    check('dirty-preserves-completed-result', equal(beforeDirty, dirtyCommitted) && dirty.liveSolveCount === beforeLive.liveSolveCount && await page.locator('#applyButton').isEnabled(), {beforeDigest: digest(beforeDirty), afterDigest: digest(dirtyCommitted)});
    check('dirty-length-label', (await readDOM()).lengthValue === cm(LIVE_DELTA));
    report.evidence.dirty = {state: dirty, committedDigest: digest(dirtyCommitted)};

    const liveStarted = Date.now(), workersBeforeLive = report.workers.length;
    await page.locator('#applyButton').click();
    const sewing = await waitState('Fresh paper reaches live sewing', state => state.busy && ['solving', 'auditing'].includes(state.phase), 45_000);
    const pendingPaper = (await readDOM()).paper;
    check('live-paper-before-new-garment', sewing.currentDelta === beforeLive.currentDelta && sewing.binding.materialSHA256 === beforeLive.binding.materialSHA256 && sewing.geometry.candidateRevision === beforeLive.geometry.candidateRevision && !equal(pendingPaper, beforeDirty.paper), {currentDelta: sewing.currentDelta, pendingPaperDigest: digest(pendingPaper), previousPaperDigest: digest(beforeDirty.paper)});
    check('live-worker-created', report.workers.length === workersBeforeLive + 1 && report.workers.at(-1).url.startsWith('blob:'), {worker: report.workers.at(-1)});
    const remaining = Math.max(1, SOLVE_TIMEOUT_MS - (Date.now() - liveStarted));
    const solved = await waitState('One complete live +20 mm solve', state => !state.busy && state.liveSolveCount === beforeLive.liveSolveCount + 1 && state.currentDelta === LIVE_DELTA, remaining);
    const liveElapsed = Date.now() - liveStarted;
    assertBodyAndGeometry(solved, 'live');
    check('fresh-live-binding', solved.binding.operation?.requestId === solved.requestId && solved.binding.operation?.expectedRevision === beforeLive.revision && solved.binding.operation?.deltaMm === LIVE_DELTA && solved.binding.materialSHA256 !== beforeLive.binding.materialSHA256 && solved.binding.paperSHA256 !== beforeLive.binding.paperSHA256 && isSHA256(solved.binding.operationSHA256) && solved.binding.basePaperSHA256 === LOCK.basePaper && equal(solved.binding.person, beforeLive.binding.person), {binding: solved.binding});
    check('fresh-live-mesh', solved.geometry.candidateRevision === beforeLive.geometry.candidateRevision + 1 && solved.geometry.candidate.vertices !== beforeLive.geometry.candidate.vertices && solved.geometry.candidate.triangles !== beforeLive.geometry.candidate.triangles && equal(solved.geometry.original, initial.geometry.original));
    check('fresh-live-static-check', solved.staticGate.passed === true && solved.staticGate.failures.length === 0 && equal(solved.staticGate.thresholds, THRESHOLDS) && solved.staticGate.wholeSeamAudit.measuredSeams === 20 && solved.staticGate.wholeSeamAudit.maxSpanUpperBoundMm <= .25 && solved.staticGate.minimumBodyVertexDistanceMm >= -.05 && solved.staticGate.dynamicWearCertified === false);
    const solvedDOM = await readDOM();
    check('live-visible-numbers-match-result', solvedDOM.candidateLength === cm(LIVE_DELTA) && solvedDOM.lengthValue === cm(LIVE_DELTA) && solvedDOM.seamValue === solved.staticGate.wholeSeamAudit.maxSpanUpperBoundMm.toFixed(3) + ' mm' && solvedDOM.strainValue === (solved.geometry.candidate.strain.maximumPrincipal * 100).toFixed(2) + '%' && solvedDOM.penetrationValue === solved.staticGate.minimumBodyVertexDistanceMm.toFixed(2) + ' mm', {dom: solvedDOM});
    report.evidence.liveSolve = {deltaMm: LIVE_DELTA, wallMs: liveElapsed, completeSolvesRequested: 1, state: solved};

    const completed = await committedState();
    await setSlider(CANCEL_DELTA);
    const workersBeforeCancel = report.workers.length;
    await page.locator('#applyButton').click();
    await waitState('Cancellable job has new paper', state => state.busy && ['solving', 'auditing'].includes(state.phase), 45_000);
    check('cancel-job-started', report.workers.length === workersBeforeCancel + 1);
    const cancelledWorker = report.workers.at(-1);
    await page.locator('#cancelButton').click();
    const cancelled = await waitState('Cancel completes', state => !state.busy && state.phase === 'cancelled');
    check('cancel-preserves-completed-result', equal(completed, await committedState()) && cancelled.currentDelta === LIVE_DELTA && cancelled.requestedDelta === CANCEL_DELTA && cancelled.liveSolveCount === solved.liveSolveCount && cancelled.revision === solved.revision);
    // Observe a quiet interval after the real Worker was terminated, including
    // any already queued message. This does not start another complete solve.
    await page.waitForTimeout(1500);
    const afterCancel = await snapshot();
    check('cancel-no-late-overwrite', equal(completed, await committedState()) && afterCancel.phase === 'cancelled' && afterCancel.liveSolveCount === solved.liveSolveCount && !!cancelledWorker.closedAt, {worker: cancelledWorker, committedDigest: digest(completed)});
    report.evidence.cancel = {state: afterCancel, resultPreserved: true, workerClosed: !!cancelledWorker.closedAt, quietIntervalMs: 1500};

    await page.locator('#resetButton').click();
    const reset = await waitState('Restore original', state => !state.busy && state.currentDelta === 0 && state.requestedDelta === 0 && state.phase === 'restored');
    const resetDOM = await readDOM();
    check('reset-original-binding', reset.binding.paperSHA256 === LOCK.basePaper && reset.binding.materialSHA256 === LOCK.baseMaterial && equal(reset.geometry.candidate, reset.geometry.original) && reset.liveSolveCount === solved.liveSolveCount && equal(reset.geometry.original, initial.geometry.original), {binding: reset.binding});
    check('reset-original-paper-and-label', resetDOM.candidateLength === resetDOM.baselineLength && resetDOM.candidateLength === cm(0) && resetDOM.paper.length === 4 && resetDOM.paper.every(panel => panel.current === panel.original) && Number(await page.locator('#lengthInput').inputValue()) === 0 && await page.locator('#applyButton').isDisabled());
    report.evidence.reset = reset;
    await layout('desktopFinal', DESKTOP);
    check('exactly-one-complete-live-solve', reset.liveSolveCount === 1 && report.workers.length === workersBeforeLive + 2, {liveSolveCount: reset.liveSolveCount, workers: report.workers.length});
    check('no-runtime-errors', report.consoleErrors.length === 0 && report.pageErrors.length === 0 && !report.contextLossObserved && !reset.lastError, {consoleErrors: report.consoleErrors, pageErrors: report.pageErrors});
    check('standalone-core-network', report.standaloneCoreNetworkRequests === 0 && (mode !== 'file' || report.network.blockedHttpRequests === 0), {count: report.standaloneCoreNetworkRequests, blockedHttpRequests: report.network.blockedHttpRequests, bootstrapExcluded: report.network.bootstrap.length, optionalBrowserIconsExcluded: report.network.optionalBrowserIcons.length});
    report.desktopPassed = true;
    report.passed = report.desktopPassed && report.mobileViewportPassed && report.checks.every(item => item.passed);
  }
  try {
    const timeout = new Promise((_, reject) => { suiteTimer = setTimeout(() => reject(Error('Suite timed out after ' + TOTAL_TIMEOUT_MS + ' ms.')), TOTAL_TIMEOUT_MS); });
    await Promise.race([run(), timeout]);
  } catch (error) {
    report.passed = false;
    report.failure = {message: error.message, stack: error.stack?.slice(0, 5000)};
    if (page && !page.isClosed()) {
      try { report.evidence.failureState = await snapshot(); } catch { /* Preserve original failure. */ }
      try { await saveScreenshot('failure'); } catch { /* A crashed page may not support screenshots. */ }
    }
  } finally {
    clearTimeout(suiteTimer);
    try { await browser?.close(); } catch (error) { report.browser.closeError = error.message; }
    // A timed-out run must never be converted into a pass by a late continuation.
    report.passed = report.passed && !report.failure && report.consoleErrors.length === 0 && report.pageErrors.length === 0 && !report.contextLossObserved && report.standaloneCoreNetworkRequests === 0;
    report.completedAt = timestamp();
    report.durationMs = Date.parse(report.completedAt) - Date.parse(report.startedAt);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({report: reportPath, sourceHead: report.sourceHead, passed: report.passed, desktopPassed: report.desktopPassed, mobileViewportPassed: report.mobileViewportPassed, standaloneCoreNetworkRequests: report.standaloneCoreNetworkRequests, visualAcceptance: false, screenshots: report.screenshots, failure: report.failure?.message}));
  if (!report.passed) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
