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
 * Two complete live solves: a verified pass and a known failing candidate.
 * A third job is cancelled while the failed candidate remains visible.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync, gunzipSync} from 'node:zlib';

// Verification-only copy: target the frozen application checkout explicitly.
const PROJECT = path.resolve(process.env.CLO_PROJECT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const {verifyPacketIntegrity} = await import(pathToFileURL(path.join(PROJECT, 'tests/packet-integrity.mjs')).href);
const TOTAL_TIMEOUT_MS = 600_000;
const SOLVE_TIMEOUT_MS = 180_000;
const DESKTOP = {width: 1440, height: 1000};
const MOBILE = {width: 390, height: 844};
const LIVE_DELTA = 20;
const LIVE_SLIT_DELTA = 0;
const REVIEW_DELTA = 100;
const REVIEW_SLIT_DELTA = -40;
const CANCEL_DELTA = 30;
const CANCEL_SLIT_DELTA = 30;
// Source and baked initial identities are locked to reviewed fixtures. Live
// results are independently verified from actual paper/mesh packets; a Node
// byte-level material golden is not assumed universal across JS engines.
const LOCK = Object.freeze({
  upstream: 'c84b16a0ae022dda9fe22c09df758fcb8095bc07',
  personGeometry: 'fbc056553c1731b790769124bee121554f0800400271eaf564a0ad5e6f458571',
  personTopology: 'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de',
  basePaper: '3e54c6322a46ea7232644f341a4f5ea300d0b20a24a1d45765138b707d753baa',
  baseMaterial: '9560f8c32c476636596e489be45cdc3bb19ba3356c2fb11445011a6fcdeb6208',
  initialMaterial: '8a39364094ae4bfac0ea4f434cc579fc67bcd37cc87857455e8995d77d31b3a3',
  panelIds: ['skirt_back', 'skirt_front', 'wb_back', 'wb_front'],
  baseFrontLengthMm: 630.5168433422547,
  baseSlitDepthMm: 86.10410305727925,
  operationSchema: 'kaopu-s03-length-and-opening/2'
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
const slitCm = delta => ((LOCK.baseSlitDepthMm + delta) / 10).toFixed(1) + ' cm';
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
  const basePaperText = gunzipSync(await fs.readFile(path.join(PROJECT, 'upstream/kaopu-tailor-workbench/presets/r04/assets/papers/S03.json.gz'))).toString('utf8');
  const reportPath = path.resolve(args.report);
  const reportDirectory = path.dirname(reportPath);
  const screenshotPrefix = path.basename(reportPath, path.extname(reportPath));
  await fs.mkdir(reportDirectory, {recursive: true});
  const report = {
    schema: 'kaopu-clo-browser-smoke/3', startedAt: timestamp(), completedAt: null,
    mode, target: args.file ? path.resolve(args.file) : args.url,
    sourceHead: null, expectedSourceHead: process.env.CLO_EXPECTED_SOURCE_HEAD || null,
    verifierSourceHead: process.env.GITHUB_SHA || null,
    passed: false, desktopPassed: false, mobileViewportPassed: false,
    standaloneCoreNetworkRequests: 0, visualAcceptance: false,
    browser: {engine: 'Chromium', headless: true, graphics: 'ANGLE SwiftShader explicitly requested'},
    timeouts: {totalMs: TOTAL_TIMEOUT_MS, eachCompleteSolveMs: SOLVE_TIMEOUT_MS},
    checks: [], screenshots: {}, evidence: {},
    network: {bootstrap: [], core: [], optionalBrowserIcons: [], failures: [], blockedHttpRequests: 0},
    consoleErrors: [], consoleWarnings: [], pageErrors: [], contextLossObserved: false,
    workers: [], phaseTimeline: [],
    packetAudit: {enabled:true, purpose:'Independently verify actual paper, material geometry and result bindings without changing source, geometry or solver.', mode:'Passive observation of paper/done packets produced by actual UI operations; typed arrays serialized as arrays in the evidence.', materialIdentityPolicy:'Source and baked initial fixtures remain pinned. Every live result uses independently recomputed actual hashes, protected geometry and mesh checks; no universal Node material byte golden is assumed.', packets:[], captureErrors:[], integrityReports:[]},
    limits: ['Automated functional and viewport checks only; screenshots require separate visual review.', '390 px is a responsive viewport check, not a mobile-device performance or touch certification.', 'Two complete real solves: 20/0 mm expected pass and 100/-40 mm browser-observed cloth-intersection candidate. Every run must observe its own actual failure, never assume it. This does not certify the parameter domain.']
  };
  let browser, context, page, suiteTimer;
  let localManifest = null, manifest = null, htmlBytes = null, finalURL = null;
  let manifestURL = mode === 'https' ? new URL('manifest.json', args.url).href : null;
  let lastPhaseKey = null;
  let lastPacketSequence = 0;
  const capturedPackets = new Map();
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
      report.phaseTimeline.push({at: timestamp(), phase: state.phase, busy: state.busy, requestId: state.requestId, revision: state.revision, currentDelta: state.currentDelta, requestedDelta: state.requestedDelta, currentSlitDelta: state.currentSlitDelta, requestedSlitDelta: state.requestedSlitDelta, liveSolveCount: state.liveSolveCount});
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
  async function flushPacketEvidence() {
    if(!page || page.isClosed())return;
    const captured=await page.evaluate(sequence=>window.__CLO_STUDY_PACKET_AUDIT__?.readAfter(sequence)??null,lastPacketSequence);
    if(!captured)throw Error('Passive Worker packet observer is missing.');
    report.packetAudit.captureErrors=captured.errors;
    if(captured.errors.length)throw Error('Worker packet capture failed: '+captured.errors.join('; '));
    for(const row of captured.packets){
      const packet=JSON.parse(row.packetJSON);
      capturedPackets.set(packet.type + ':' + packet.requestId, packet);
      const record={schema:'kaopu.clo-worker-packet-audit/1',sourceHead:report.sourceHead,mode,sequence:row.sequence,workerIndex:row.workerIndex,capturedAt:row.capturedAt,packet};
      const bytes=Buffer.from(JSON.stringify(record)),compressed=gzipSync(bytes,{level:9});
      const filename=screenshotPrefix+'.packet-'+row.sequence+'-'+packet.type+'-request-'+packet.requestId+'.json.gz';
      await fs.writeFile(path.join(reportDirectory,filename),compressed);
      report.packetAudit.packets.push({sequence:row.sequence,workerIndex:row.workerIndex,type:packet.type,requestId:packet.requestId,file:filename,bytes:compressed.length,sha256:hash(compressed),decodedSHA256:hash(bytes),paperSHA256:packet.binding?.paperSHA256,materialSHA256:packet.binding?.materialSHA256,operationSHA256:packet.binding?.operationSHA256,staticGatePassed:packet.record?.staticGate?.passed});
      lastPacketSequence=row.sequence;
    }
  }
  const readDOM = () => page.evaluate(() => ({
    sourceCommit: document.documentElement.dataset.sourceCommit,
    buildId: document.documentElement.dataset.buildId,
    baselineLength: document.getElementById('baselineLength')?.textContent,
    candidateLength: document.getElementById('candidateLength')?.textContent,
    lengthValue: document.getElementById('lengthValue')?.textContent,
    baselineSlitDepth: document.getElementById('baselineSlitDepth')?.textContent,
    candidateSlitDepth: document.getElementById('candidateSlitDepth')?.textContent,
    slitValue: document.getElementById('slitValue')?.textContent,
    paperSlitDepth: document.getElementById('paperSlitDepth')?.textContent,
    paperSlitMouthWidth: document.getElementById('paperSlitMouthWidth')?.textContent,
    patternState: document.getElementById('patternState')?.textContent,
    patternStateMode: document.getElementById('patternState')?.dataset.mode,
    candidateState: document.getElementById('candidateState')?.textContent,
    phaseStatus: document.getElementById('phaseStatus')?.textContent,
    reviewState: document.body.dataset.review,
    reviewVisible: !!document.getElementById('reviewBanner') && !document.getElementById('reviewBanner').hidden,
    reviewReasons: Array.from(document.querySelectorAll('#reviewReasons li')).map(element => ({code: element.dataset.failure, text: element.textContent})),
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
      currentDelta: state.currentDelta, currentSlitDelta: state.currentSlitDelta, binding: state.binding, staticGate: state.staticGate,
      candidateRevision: state.geometry.candidateRevision, candidateGeometry: state.geometry.candidate,
      originalGeometry: state.geometry.original, candidateLength: dom.candidateLength, candidateSlitDepth: dom.candidateSlitDepth,
      measurements: state.measurements.committed, paperSlitDepth: dom.paperSlitDepth, paperSlitMouthWidth: dom.paperSlitMouthWidth,
      reviewState: dom.reviewState, reviewVisible: dom.reviewVisible, reviewReasons: dom.reviewReasons,
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
  async function setSlider(delta, axis = 'length') {
    const slider = page.locator(axis === 'slit' ? '#slitInput' : '#lengthInput');
    const min = Number(await slider.getAttribute('min')), max = Number(await slider.getAttribute('max')), step = Number(await slider.getAttribute('step'));
    if (!(delta >= min && delta <= max && Number.isInteger((delta - min) / step))) throw Error('Test delta does not fit actual slider range.');
    await slider.press('Home');
    for (let i = 0; i < (delta - min) / step; i++) await slider.press('ArrowRight');
    check(axis + '-slider-keyboard-' + delta, Number(await slider.inputValue()) === delta, {min, max, step});
    return waitState(axis + ' slider ' + delta, state => state[axis === 'slit' ? 'requestedSlitDelta' : 'requestedDelta'] === delta && !state.busy);
  }
  function assertBodyAndGeometry(state, id) {
    const geometry = state.geometry;
    check(id + '-native-body', geometry.body.verticesPerView === 25417 && geometry.body.trianglesPerView === 50624 && geometry.body.geometrySHA256 === LOCK.personGeometry && geometry.body.topologySHA256 === LOCK.personTopology, {body: geometry.body});
    check(id + '-physical-mesh', geometry.original.vertices === 3476 && geometry.original.triangles === 6160 && geometry.candidate.vertices > 3000 && geometry.candidate.triangles > 5000 && geometry.original.panels === 4 && geometry.candidate.panels === 4 && geometry.original.activeSeams === 20 && geometry.candidate.activeSeams === 20 && equal(geometry.original.panelIds, LOCK.panelIds) && equal(geometry.candidate.panelIds, LOCK.panelIds), {original: geometry.original, candidate: geometry.candidate});
    check(id + '-source-binding', state.binding.presetId === 'S03' && state.binding.person.geometrySHA256 === geometry.body.geometrySHA256 && state.binding.person.topologySHA256 === geometry.body.topologySHA256 && ['recipeHash', 'paperSHA256', 'materialSHA256'].every(key => isSHA256(state.binding[key])), {binding: state.binding});
    check(id + '-renderer-contract', geometry.noProxy && !geometry.bodyScaling && !geometry.garmentScaling && geometry.singleRenderer && geometry.sharedCamera && !geometry.candidate.movedSolvedVertices && !geometry.candidate.physicalTopologyChanged && geometry.candidate.strain.pressure === false);
  }
  function assertFreshBinding(state, before, delta, slitDelta, id) {
    const binding = state.binding, operation = binding.operation;
    check(id + '-two-parameter-binding', operation?.schema === LOCK.operationSchema && operation.requestId === state.requestId && operation.expectedRevision === before.revision && operation.deltaMm === delta && operation.slitDeltaMm === slitDelta && state.currentDelta === delta && state.currentSlitDelta === slitDelta && binding.paperSHA256 !== before.binding.paperSHA256 && binding.materialSHA256 !== before.binding.materialSHA256 && binding.basePaperSHA256 === LOCK.basePaper && binding.operationSHA256 === digest(operation) && equal(binding.person, before.binding.person), {binding});
    const paperPacket = capturedPackets.get('paper:' + state.requestId), donePacket = capturedPackets.get('done:' + state.requestId);
    let integrity;
    try {
      integrity = verifyPacketIntegrity({paperPacket, donePacket, basePaperText, expected: {deltaMm: delta, slitDeltaMm: slitDelta, requestId: state.requestId, expectedRevision: before.revision}, previousBinding: before.binding});
    } catch (error) {
      report.packetAudit.integrityReports.push({id, passed: false, evidence: error.evidence || null, message: error.message});
      throw error;
    }
    report.packetAudit.integrityReports.push({id, ...integrity});
    check(id + '-independent-packet-integrity', integrity.passed, {hashes: integrity.hashes, measurements: integrity.measurements, mesh: integrity.mesh});
    check(id + '-committed-result-matches-actual-worker', equal(binding, donePacket.binding) && equal(state.staticGate, donePacket.record.staticGate) && equal(state.intersections, donePacket.intersections), {requestId: state.requestId});
    check(id + '-fresh-mesh-and-revision', state.revision === before.revision + 1 && state.geometry.candidateRevision === before.geometry.candidateRevision + 1 && equal(state.geometry.original, before.geometry.original));
  }
  async function assertVisibleNumbers(state, delta, slitDelta, id) {
    const dom = await readDOM();
    check(id + '-visible-numbers-match-result', dom.candidateLength === cm(delta) && dom.lengthValue === cm(delta) && dom.candidateSlitDepth === slitCm(slitDelta) && dom.slitValue === slitCm(slitDelta) && dom.paperSlitDepth === slitCm(slitDelta) && dom.paperSlitMouthWidth === '2.0 cm' && dom.seamValue === state.staticGate.wholeSeamAudit.maxSpanUpperBoundMm.toFixed(3) + ' mm' && dom.strainValue === (Math.max(0, state.geometry.candidate.strain.maximumPrincipal) * 100).toFixed(2) + '%' && dom.penetrationValue === state.staticGate.minimumBodyVertexDistanceMm.toFixed(2) + ' mm', {dom});
    check(id + '-dimension-measurements', Math.abs(state.measurements.committed.frontLengthMm - LOCK.baseFrontLengthMm - delta) < 1e-7 && Math.abs(state.measurements.committed.slitDepthMm - LOCK.baseSlitDepthMm - slitDelta) < 1e-7 && state.measurements.committed.slitMouthWidthMm === 20, {measurements: state.measurements});
    return dom;
  }
  async function run() {
    if (mode === 'file') {
      const input = path.resolve(args.file);
      htmlBytes = await fs.readFile(input);
      try { localManifest = JSON.parse(await fs.readFile(path.join(path.dirname(input), 'manifest.json'), 'utf8')); }
      catch (error) { if (!process.env.CLO_EXPECTED_SOURCE_HEAD || error.code !== 'ENOENT') throw error; }
      manifest = localManifest;
      report.expectedSourceHead ||= manifest?.sourceHead || manifest?.sourceCommit || null;
      if (!report.expectedSourceHead) throw Error('No expected source head: set CLO_EXPECTED_SOURCE_HEAD or supply dist/manifest.json.');
    }
    const {chromium} = await playwright();
    browser = await chromium.launch({headless: true, timeout: 60_000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage']});
    report.browser.version = browser.version();
    context = await browser.newContext({viewport: DESKTOP, deviceScaleFactor: 1, locale: 'zh-CN', serviceWorkers: 'block', reducedMotion: 'reduce', extraHTTPHeaders: {'Cache-Control': 'no-cache', Pragma: 'no-cache'}});
    // The original Worker still receives the original URL and messages. This
    // observer only copies its outgoing evidence, before app event handlers run.
    // It does not call app state functions, send commands or substitute results.
    await context.addInitScript(()=>{
      const packets=[],errors=[];let sequence=0,workerIndex=0;
      const NativeWorker=window.Worker;
      window.Worker=new Proxy(NativeWorker,{construct(target,args,newTarget){
        const worker=Reflect.construct(target,args,newTarget),index=++workerIndex;
        worker.addEventListener('message',event=>{
          const packet=event.data;if(!packet||!['paper','done'].includes(packet.type))return;
          try{packets.push({sequence:++sequence,workerIndex:index,capturedAt:new Date().toISOString(),packetJSON:JSON.stringify(packet,(_key,value)=>ArrayBuffer.isView(value)?Array.from(value):value)});}
          catch(error){errors.push(String(error?.message||error));}
        });
        return worker;
      }});
      Object.defineProperty(window,'__CLO_STUDY_PACKET_AUDIT__',{value:Object.freeze({readAfter:after=>({packets:packets.filter(row=>row.sequence>after),errors:[...errors]})}),writable:false,configurable:false});
    });
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
      // APIRequestContext reads the large immutable HTML independently of
      // Chromium's DevTools response cache. Navigation and all real page
      // interactions remain on the original public URL; no route is fulfilled.
      const htmlReadback = await context.request.get(finalURL, {timeout: 60_000, headers: {'Cache-Control': 'no-cache', Pragma: 'no-cache'}});
      report.network.bootstrap.push({url: htmlReadback.url(), resourceType: 'document-byte-verification', method: 'GET', status: htmlReadback.status(), initiatedBy: 'acceptance script APIRequestContext'});
      check('public-html-readback', htmlReadback.ok() && htmlReadback.url() === finalURL, {status: htmlReadback.status(), url: htmlReadback.url(), browserDocumentURL: finalURL});
      htmlBytes = await htmlReadback.body();
      report.evidence.htmlByteReadback = {method: 'APIRequestContext', url: finalURL, bytes: htmlBytes.length, sha256: hash(htmlBytes), browserDocumentStatus: response.status()};
      await htmlReadback.dispose();
      manifestURL = new URL('manifest.json', finalURL).href;
      const fetched = await context.request.get(manifestURL, {timeout: 30_000, headers: {'Cache-Control': 'no-cache'}});
      report.network.bootstrap.push({url: manifestURL, resourceType: 'manifest', method: 'GET', status: fetched.status(), initiatedBy: 'acceptance script'});
      check('public-manifest', fetched.ok(), {status: fetched.status()});
      manifest = await fetched.json();
      report.expectedSourceHead ||= manifest.sourceHead || manifest.sourceCommit || null;
      if (!report.expectedSourceHead) throw Error('Public manifest has no source head and CLO_EXPECTED_SOURCE_HEAD is unset.');
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
    check('initial-candidate-binding', initial.studyVersion === 'R02' && initial.source.taskId === 'CLO-LEARNING-PILOT-R02-20261022' && initial.currentDelta === 60 && initial.requestedDelta === 60 && initial.currentSlitDelta === 40 && initial.requestedSlitDelta === 40 && initial.liveSolveCount === 0 && initial.binding.operation?.schema === LOCK.operationSchema && initial.binding.operation?.deltaMm === 60 && initial.binding.operation?.slitDeltaMm === 40 && initial.binding.basePaperSHA256 === LOCK.basePaper && initial.binding.materialSHA256 === LOCK.initialMaterial && initial.binding.materialSHA256 !== LOCK.baseMaterial && initial.geometry.candidate.vertices === 3742 && initial.geometry.candidate.triangles === 6672, {binding: initial.binding});
    check('initial-static-check', initial.staticGate.passed === true && equal(initial.staticGate.thresholds, THRESHOLDS) && initial.staticGate.dynamicWearCertified === false && initial.staticGate.continuousCollisionCertified === false);
    check('initial-back-detail-and-paper-dimensions', initial.geometry.namedView === 'back-detail' && initialDOM.baselineSlitDepth === slitCm(0) && initialDOM.candidateSlitDepth === slitCm(40) && initialDOM.paperSlitDepth === slitCm(40) && initialDOM.paperSlitMouthWidth === '2.0 cm' && !initialDOM.reviewVisible);
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
    await clickView('back-detail');
    await saveScreenshot('detail');

    await page.locator('[data-display="fabric"]').click();
    await page.locator('#seamsToggle').click();
    await clickView('front');
    const preMobile = await snapshot();
    await page.setViewportSize(MOBILE);
    await waitState('390 px render', state => state.geometry.ready && state.geometry.viewport.width < 390 && state.geometry.renderCalls > preMobile.geometry.renderCalls);
    await layout('mobile390', MOBILE);
    await clickView('back');
    await clickView('back-detail');
    await saveScreenshot('mobile390');
    report.evidence.mobile390 = {state: await snapshot(), responsiveViewportOnly: true};
    check('mobile-no-errors', report.consoleErrors.length === 0 && report.pageErrors.length === 0 && !report.contextLossObserved);
    report.mobileViewportPassed = true;
    await page.setViewportSize(DESKTOP);
    await waitState('Desktop restored', state => state.geometry.viewport.width > 700 && state.geometry.ready);
    await clickView('front');

    const beforeDirty = await committedState();
    const beforeLive = await snapshot();
    await setSlider(20, 'slit');
    const openingOnly = await waitState('Uncommitted opening only', state => state.phase === 'dirty' && state.requestedDelta === 60 && state.requestedSlitDelta === 20 && state.currentDelta === 60 && state.currentSlitDelta === 40);
    const openingDOM = await readDOM();
    check('opening-only-dirty-keeps-completed-result', equal(beforeDirty, await committedState()) && openingOnly.liveSolveCount === 0 && openingDOM.lengthValue === cm(60) && openingDOM.slitValue === slitCm(20) && openingDOM.candidateSlitDepth === slitCm(40) && openingDOM.paperSlitDepth === slitCm(40) && openingDOM.patternStateMode === 'dirty' && await page.locator('#applyButton').isEnabled());
    await setSlider(40, 'slit');
    const returned = await waitState('Both controls return to completed values', state => state.phase === 'complete' && state.requestedDelta === 60 && state.requestedSlitDelta === 40);
    check('returning-only-opening-clears-dirty', equal(beforeDirty, await committedState()) && returned.liveSolveCount === 0 && await page.locator('#applyButton').isDisabled());
    await setSlider(LIVE_DELTA);
    const lengthOnly = await waitState('Uncommitted length only', state => state.phase === 'dirty' && state.requestedDelta === LIVE_DELTA && state.requestedSlitDelta === 40 && state.currentDelta === 60 && state.currentSlitDelta === 40);
    check('length-only-dirty-keeps-opening-and-result', equal(beforeDirty, await committedState()) && (await readDOM()).slitValue === slitCm(40));
    await setSlider(LIVE_SLIT_DELTA, 'slit');
    const dirty = await waitState('Both requested parameters are pending', state => state.phase === 'dirty' && state.requestedDelta === LIVE_DELTA && state.requestedSlitDelta === LIVE_SLIT_DELTA && state.currentDelta === 60 && state.currentSlitDelta === 40);
    const dirtyCommitted = await committedState(), dirtyDOM = await readDOM();
    check('dirty-preserves-completed-result', equal(beforeDirty, dirtyCommitted) && dirty.liveSolveCount === beforeLive.liveSolveCount && await page.locator('#applyButton').isEnabled(), {beforeDigest: digest(beforeDirty), afterDigest: digest(dirtyCommitted)});
    check('dirty-two-dimension-labels', dirtyDOM.lengthValue === cm(LIVE_DELTA) && dirtyDOM.slitValue === slitCm(LIVE_SLIT_DELTA) && dirtyDOM.candidateLength === cm(60) && dirtyDOM.candidateSlitDepth === slitCm(40));
    report.evidence.dirty = {openingOnly, lengthOnly, state: dirty, committedDigest: digest(dirtyCommitted)};

    const liveStarted = Date.now(), workersBeforeLive = report.workers.length;
    await page.locator('#applyButton').click();
    const sewing = await waitState('Fresh two-parameter paper reaches sewing', state => state.busy && ['solving', 'auditing'].includes(state.phase), 45_000);
    await flushPacketEvidence();
    const pendingDOM = await readDOM();
    check('live-paper-before-new-garment', sewing.currentDelta === beforeLive.currentDelta && sewing.currentSlitDelta === beforeLive.currentSlitDelta && sewing.binding.materialSHA256 === beforeLive.binding.materialSHA256 && sewing.geometry.candidateRevision === beforeLive.geometry.candidateRevision && !equal(pendingDOM.paper, beforeDirty.paper) && pendingDOM.patternStateMode === 'pending' && pendingDOM.paperSlitDepth === slitCm(LIVE_SLIT_DELTA) && pendingDOM.candidateSlitDepth === slitCm(40), {pendingPaperDigest: digest(pendingDOM.paper), previousPaperDigest: digest(beforeDirty.paper)});
    check('busy-controls-and-worker', report.workers.length === workersBeforeLive + 1 && report.workers.at(-1).url.startsWith('blob:') && await page.locator('#lengthInput').isDisabled() && await page.locator('#slitInput').isDisabled() && await page.locator('#applyButton').isDisabled() && await page.locator('#resetButton').isDisabled() && await page.locator('#cancelButton').isVisible(), {worker: report.workers.at(-1)});
    const solved = await waitState('Complete live 20/0 mm positive case', state => !state.busy && state.liveSolveCount === beforeLive.liveSolveCount + 1 && state.currentDelta === LIVE_DELTA && state.currentSlitDelta === LIVE_SLIT_DELTA, Math.max(1, SOLVE_TIMEOUT_MS - (Date.now() - liveStarted)));
    await flushPacketEvidence();
    assertBodyAndGeometry(solved, 'live');
    assertFreshBinding(solved, beforeLive, LIVE_DELTA, LIVE_SLIT_DELTA, 'live');
    check('fresh-live-mesh', solved.geometry.candidate.vertices === 3548 && solved.geometry.candidate.triangles === 6296 && equal(solved.geometry.original, initial.geometry.original));
    check('fresh-live-static-check', solved.phase === 'complete' && solved.staticGate.passed === true && solved.staticGate.failures.length === 0 && equal(solved.staticGate.thresholds, THRESHOLDS) && solved.staticGate.wholeSeamAudit.measuredSeams === 20 && solved.staticGate.wholeSeamAudit.maxSpanUpperBoundMm <= .25 && solved.staticGate.minimumBodyVertexDistanceMm >= -.05 && solved.staticGate.dynamicWearCertified === false && solved.intersections.bodyIntersectingFaceCount === 0 && solved.intersections.selfStrictTriangleIntersectionCount === 0);
    const solvedDOM = await assertVisibleNumbers(solved, LIVE_DELTA, LIVE_SLIT_DELTA, 'live');
    check('passing-candidate-hides-review', !solvedDOM.reviewVisible && solvedDOM.reviewState === 'passed' && solvedDOM.patternStateMode === 'complete');
    report.evidence.liveSolve = {deltaMm: LIVE_DELTA, slitDeltaMm: LIVE_SLIT_DELTA, wallMs: Date.now() - liveStarted, expectedGatePassed: true, state: solved};

    // This candidate produced 14 actual cloth intersection pairs in Chromium
    // run39714823932. Every new run must independently finish and expose its
    // own real failure; otherwise publication is blocked. No result or solver
    // threshold is substituted.
    const beforeReview = await snapshot(), positiveCommitted = await committedState();
    await setSlider(REVIEW_DELTA); await setSlider(REVIEW_SLIT_DELTA, 'slit');
    check('review-request-keeps-previous-completed-candidate', equal(positiveCommitted, await committedState()));
    const reviewStarted = Date.now(), workersBeforeReview = report.workers.length;
    await page.locator('#applyButton').click();
    await waitState('Known-negative paper reaches sewing', state => state.busy && ['solving', 'auditing'].includes(state.phase), 45_000);
    await flushPacketEvidence();
    check('review-worker-created', report.workers.length === workersBeforeReview + 1);
    const failed = await waitState('Complete real 100/-40 mm candidate', state => !state.busy && state.liveSolveCount === beforeReview.liveSolveCount + 1 && state.currentDelta === REVIEW_DELTA && state.currentSlitDelta === REVIEW_SLIT_DELTA, Math.max(1, SOLVE_TIMEOUT_MS - (Date.now() - reviewStarted)));
    await flushPacketEvidence();
    assertBodyAndGeometry(failed, 'review');
    assertFreshBinding(failed, beforeReview, REVIEW_DELTA, REVIEW_SLIT_DELTA, 'review');
    check('known-negative-retains-actual-failure', failed.phase === 'review' && failed.staticGate.passed === false && equal(failed.staticGate.failures, ['cloth-intersections']) && equal(failed.staticGate.thresholds, THRESHOLDS) && failed.intersections.selfStrictTriangleIntersectionCount > 0 && failed.intersections.bodyIntersectingFaceCount === 0 && failed.staticGate.wholeSeamAudit.measuredSeams === 20 && failed.staticGate.wholeSeamAudit.maxSpanUpperBoundMm <= .25 && failed.staticGate.dynamicWearCertified === false && !failed.lastError, {failures: failed.staticGate.failures, intersections: failed.intersections});
    const failedDOM = await assertVisibleNumbers(failed, REVIEW_DELTA, REVIEW_SLIT_DELTA, 'review');
    check('negative-shown-as-review-with-specific-reason', failedDOM.reviewVisible && failedDOM.reviewState === 'failed' && failedDOM.reviewReasons.some(r => r.code === 'cloth-intersections' && r.text.length > 0) && await page.locator('#reviewBanner').isVisible() && await page.locator('#reviewReasons [data-failure="cloth-intersections"]').isVisible() && failedDOM.phaseStatus === '本次检查未通过' && failedDOM.candidateState.includes('未通过') && !failedDOM.candidateState.includes('静态检查通过'));
    report.evidence.reviewSolve = {deltaMm: REVIEW_DELTA, slitDeltaMm: REVIEW_SLIT_DELTA, wallMs: Date.now() - reviewStarted, expectedGatePassed: false, state: failed};
    await clickView('back-detail');
    await saveScreenshot('review');

    const completed = await committedState();
    await setSlider(CANCEL_DELTA); await setSlider(CANCEL_SLIT_DELTA, 'slit');
    const workersBeforeCancel = report.workers.length;
    await page.locator('#applyButton').click();
    await waitState('Cancellable job has new paper', state => state.busy && ['solving', 'auditing'].includes(state.phase), 45_000);
    await flushPacketEvidence();
    check('cancel-job-started', report.workers.length === workersBeforeCancel + 1);
    const cancelledWorker = report.workers.at(-1);
    await page.locator('#cancelButton').click();
    const cancelled = await waitState('Cancel completes', state => !state.busy && state.phase === 'cancelled');
    const cancelledDOM = await readDOM();
    check('cancel-preserves-completed-failed-candidate', equal(completed, await committedState()) && cancelled.currentDelta === REVIEW_DELTA && cancelled.currentSlitDelta === REVIEW_SLIT_DELTA && cancelled.requestedDelta === CANCEL_DELTA && cancelled.requestedSlitDelta === CANCEL_SLIT_DELTA && cancelled.liveSolveCount === failed.liveSolveCount && cancelled.revision === failed.revision && cancelled.staticGate.passed === false && cancelledDOM.reviewVisible && cancelledDOM.reviewState === 'failed' && cancelledDOM.reviewReasons.some(r => r.code === 'cloth-intersections') && cancelledDOM.candidateState.includes('未通过') && !cancelledDOM.candidateState.includes('静态检查通过'));
    await page.waitForTimeout(1500);
    const afterCancel = await snapshot();
    check('cancel-no-late-overwrite-or-false-pass', equal(completed, await committedState()) && afterCancel.phase === 'cancelled' && afterCancel.liveSolveCount === failed.liveSolveCount && afterCancel.staticGate.passed === false && !!cancelledWorker.closedAt, {worker: cancelledWorker, committedDigest: digest(completed)});
    report.evidence.cancel = {state: afterCancel, resultPreserved: true, preservedCandidateGatePassed: false, workerClosed: !!cancelledWorker.closedAt, quietIntervalMs: 1500};

    await page.locator('#resetButton').click();
    const reset = await waitState('Restore original two parameters', state => !state.busy && state.currentDelta === 0 && state.requestedDelta === 0 && state.currentSlitDelta === 0 && state.requestedSlitDelta === 0 && state.phase === 'restored');
    const resetDOM = await readDOM();
    check('reset-original-binding', reset.binding.paperSHA256 === LOCK.basePaper && reset.binding.materialSHA256 === LOCK.baseMaterial && equal(reset.geometry.candidate, reset.geometry.original) && reset.liveSolveCount === failed.liveSolveCount && equal(reset.geometry.original, initial.geometry.original), {binding: reset.binding});
    check('reset-original-paper-and-two-labels', resetDOM.candidateLength === resetDOM.baselineLength && resetDOM.candidateLength === cm(0) && resetDOM.candidateSlitDepth === resetDOM.baselineSlitDepth && resetDOM.candidateSlitDepth === slitCm(0) && resetDOM.paperSlitDepth === slitCm(0) && resetDOM.paperSlitMouthWidth === '2.0 cm' && resetDOM.paper.length === 4 && resetDOM.paper.every(panel => panel.current === panel.original) && Number(await page.locator('#lengthInput').inputValue()) === 0 && Number(await page.locator('#slitInput').inputValue()) === 0 && await page.locator('#applyButton').isDisabled() && !resetDOM.reviewVisible);
    report.evidence.reset = reset;
    await layout('desktopFinal', DESKTOP);
    check('exactly-two-complete-live-solves', reset.liveSolveCount === 2 && report.workers.length === workersBeforeLive + 3, {liveSolveCount: reset.liveSolveCount, workers: report.workers.length, positive: [20, 0], expectedReview: [100, -40], cancelled: [30, 30]});
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
      try { await flushPacketEvidence(); } catch (captureError) { report.packetAudit.flushError=captureError.message; }
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
