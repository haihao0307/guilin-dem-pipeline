#!/usr/bin/env node
'use strict';

// No geometry, source mother, camera, or shader changes are made by this runner.
// Default: one genuine 16 x 16 WebGPU tile, never an implicit expensive frame.
// Full normal-perspective review:
//   node qa/local-review.cjs --mode full --view overall --out qa/local-full
// Installed Chromium rather than Playwright's bundled browser:
//   CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node qa/local-review.cjs

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATES = Object.freeze(['whole-frontage-r04']);
const FLAGS = Object.freeze([
  '--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=swiftshader',
  '--use-vulkan=swiftshader', '--enable-features=Vulkan', '--disable-vulkan-surface',
]);
const HELP = `Usage: node qa/local-review.cjs [options]
  --mode smoke|full|init       Default smoke; full must be explicitly requested
  --view overall|pair-cut|frontage-diagnostic|facade-detail|borrow  Default overall
  --candidate whole-frontage-r04  Optional isolated candidate; original is default
  --viewport WIDTHxHEIGHT     Default 640x800, giving native 320x400
  --rect X,Y,W,H               Smoke rectangle; maximum 16x16 (default central tile)
  --growth on|off              Default on; requests runtime's existing world switch
  --out PATH                  Default qa/local-review-MODE-TIMESTAMP
  --init-timeout-ms N          Default 360000
  --render-timeout-ms N        Default 180000 smoke / 7200000 full
  --max-submissions N          Default 20000 smoke / 2000000 full
CHROMIUM_EXECUTABLE_PATH is optional; otherwise use Playwright's installed browser.
Artifacts: receipt.json, proof.json, source-hashes.json, frame.json,
native-canvas.png (direct canvas export), ui.png (separate browser screenshot),
progress.jsonl and console.jsonl. Smoke artifacts are never full-frame acceptance.
`;

function positiveInteger(value, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw Error(`${label} must be a positive integer`);
  return n;
}
function dimensions(viewport) {
  const aspect = viewport.width / viewport.height;
  let w = Math.min(480, Math.floor(viewport.width * .5));
  let h = Math.floor(w / aspect);
  if (w * h > 480 * 600) {
    w = Math.floor(Math.sqrt(480 * 600 * aspect));
    h = Math.floor(w / aspect);
  }
  return [Math.max(64, w), Math.max(64, h)];
}
function parseOptions(argv) {
  const args = {};
  const allowed = new Set(['mode', 'view', 'candidate', 'viewport', 'rect', 'growth', 'out',
    'init-timeout-ms', 'render-timeout-ms', 'max-submissions']);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help') return { help: true };
    if (!argv[i].startsWith('--') || !allowed.has(argv[i].slice(2))) throw Error(`Unknown option ${argv[i]}`);
    const key = argv[i].slice(2);
    if (args[key] !== undefined || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw Error(`Missing or duplicate value for --${key}`);
    args[key] = argv[++i];
  }
  const mode = args.mode ?? 'smoke', view = args.view ?? 'overall';
  if (!['smoke', 'full', 'init'].includes(mode)) throw Error('Unknown review mode');
  if (!['overall', 'pair-cut', 'frontage-diagnostic', 'facade-detail', 'borrow'].includes(view)) throw Error('Unknown review view');
  const candidate = args.candidate ?? null;
  if (candidate !== null && !CANDIDATES.includes(candidate)) throw Error('Unknown review candidate');
  const match = /^(\d+)x(\d+)$/.exec(args.viewport ?? '640x800');
  if (!match) throw Error('--viewport must be WIDTHxHEIGHT');
  const viewport = { width: positiveInteger(match[1], 'viewport width'), height: positiveInteger(match[2], 'viewport height') };
  if (viewport.width > 4096 || viewport.height > 4096) throw Error('Viewport is bounded to 4096x4096');
  const nativePixels = dimensions(viewport);
  let rect = args.rect ? args.rect.split(',').map(Number) : [Math.floor((nativePixels[0] / 2 - 8) / 16) * 16, Math.floor((nativePixels[1] / 2 - 8) / 16) * 16, 16, 16];
  if (args.rect && mode !== 'smoke') throw Error('--rect is only supported in smoke mode');
  if (rect.length !== 4 || rect.some(n => !Number.isSafeInteger(n)) || rect[0] < 0 || rect[1] < 0 || rect[2] < 1 || rect[3] < 1 || rect[2] > 16 || rect[3] > 16 || rect[0] + rect[2] > nativePixels[0] || rect[1] + rect[3] > nativePixels[1]) throw Error('Smoke rectangle must fit the canvas and be at most 16x16');
  if (mode !== 'smoke') rect = mode === 'full' ? [0, 0, ...nativePixels] : null;
  const growth = args.growth ?? 'on';
  if (!['on', 'off'].includes(growth)) throw Error('--growth must be on or off');
  return { mode, view, candidate, viewport, nativePixels, rect, growth,
    out: path.resolve(ROOT, args.out ?? `qa/local-review-${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`),
    initTimeoutMs: positiveInteger(args['init-timeout-ms'] ?? 360000, 'init timeout'),
    renderTimeoutMs: positiveInteger(args['render-timeout-ms'] ?? (mode === 'full' ? 7200000 : 180000), 'render timeout'),
    maxSubmissions: positiveInteger(args['max-submissions'] ?? (mode === 'full' ? 2000000 : 20000), 'max submissions'),
  };
}
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function snapshotRuntime(root = ROOT, candidate = null) {
  if (candidate !== null && !CANDIDATES.includes(candidate)) throw Error('Unknown review candidate');
  const bytes = new Map(), hashes = {};
  function walk(dir, relative) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, entry.name), name = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error(`Runtime symlink is not served: ${name}`);
      if (entry.isDirectory()) walk(absolute, name);
      else if (entry.isFile()) {
        const data = fs.readFileSync(absolute);
        bytes.set(name, data); hashes[name.slice(1)] = { bytes: data.length, sha256: sha256(data) };
      }
    }
  }
  walk(path.join(root, 'runtime'), '/runtime');
  if (candidate) walk(path.join(root, candidate, 'runtime'), `/${candidate}/runtime`);
  const locks = JSON.parse(bytes.get('/runtime/sources/PAIR_MOTHER_LOCK.json'));
  const motherParity = Object.entries(locks).map(([name, expected]) => ({ name, expected, actual: hashes[`runtime/mothers/${name}`]?.sha256, matches: hashes[`runtime/mothers/${name}`]?.sha256 === expected }));
  if (!motherParity.every(m => m.matches)) throw Error('A source mother differs from PAIR_MOTHER_LOCK.json');
  return { bytes, hashes, motherParity };
}
function createSnapshotServer(snapshot) {
  const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    let pathname;
    try {
      pathname = decodeURIComponent(req.url.split('?')[0]);
      if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(segment => segment === '.' || segment === '..')) throw Error('Disallowed path');
    } catch { res.writeHead(400); return res.end(); }
    const data = snapshot.bytes.get(pathname);
    if (!data) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(pathname)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'content-length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}
async function bounded(promise, ms, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} exceeded ${ms} ms`)), ms); })]); }
  finally { clearTimeout(timer); }
}
function stageTimings(stages = []) {
  const output = {};
  for (const event of stages) {
    if (event.stage.endsWith('-end')) {
      const start = stages.find(s => s.stage === event.stage.replace(/-end$/, '-start'));
      if (start) output[event.stage.replace(/^pipeline-|-end$/g, '')] = event.ms - start.ms;
    }
  }
  return output;
}
function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Canvas did not return a PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
function validateFrame(frame, options) {
  if (!frame || frame.view !== options.view || frame.snapshot?.debug !== 0) throw Error('Runtime returned the wrong camera or debug mode');
  if (JSON.stringify(frame.pixels) !== JSON.stringify(options.nativePixels) || JSON.stringify(frame.rect) !== JSON.stringify(options.rect)) throw Error('Runtime output dimensions or rectangle differ from the requested review');
  if (!!frame.inspectionCrop !== (options.mode === 'smoke')) throw Error('Full frame / smoke crop classification mismatch');
  if (options.view === 'overall' && JSON.stringify(frame.snapshot.cut) !== '[0,0,1,1000000]') throw Error('Overall review unexpectedly has a section cut');
  if (options.view === 'overall' && !(frame.snapshot.tanFov > 0)) throw Error('Overall review is not a perspective camera');
  const ray = frame.rayStatus ?? {};
  const area = options.rect[2] * options.rect[3];
  if (ray.hit + ray.trueMiss + ray.exhausted !== area) throw Error('Primary ray accounting differs from requested pixel count');
  if (ray.exhausted || ray.visibilityUnresolved || ray.candidateOverflows || ray.activeQueries) throw Error('Frame contains unresolved or overflowing queries');
}
async function run(options) {
  const start = Date.now();
  fs.mkdirSync(options.out, { recursive: true });
  if (fs.existsSync(path.join(options.out, 'receipt.json'))) throw Error('Output already has a receipt; choose a new directory to preserve its evidence');
  const json = (name, value) => fs.writeFileSync(path.join(options.out, name), JSON.stringify(value, null, 2) + '\n');
  const receipt = { schema: 'local-webgpu-review-v1', status: 'initializing', startedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null, options, browserFlags: FLAGS,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? 'Playwright bundled Chromium',
    host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, cpuCount: os.cpus().length, availableParallelism: os.availableParallelism?.(), memoryBytes: os.totalmem(), node: process.version },
    errors: [], files: [], notClaims: ['Software WebGPU timings are not hardware-GPU performance.', 'Smoke is one bounded tile, not full-frame or visual acceptance.', 'Native PNG is a canvas export; UI screenshot is separately labeled.'] };
  const save = () => { receipt.wallMs = Date.now() - start; json('receipt.json', receipt); };
  let browser, page, server, temporary;
  save();
  try {
    const snapshot = snapshotRuntime(ROOT, options.candidate);
    receipt.sourceSnapshot = { frozenAt: new Date().toISOString(), fileCount: snapshot.bytes.size, motherParity: snapshot.motherParity, manifestSha256: sha256(Buffer.from(JSON.stringify(snapshot.hashes))) };
    json('source-hashes.json', snapshot.hashes);
    server = createSnapshotServer(snapshot);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    receipt.url = `http://127.0.0.1:${server.address().port}/${options.candidate ? options.candidate + '/' : ''}runtime/index.html?manual=1&view=${options.view}&growth=${options.growth}`;
    receipt.stage = 'browser-launch'; save();
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'city-review-browser-'));
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true, args: [...FLAGS], timeout: 45000,
      ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
      env: { ...process.env, XDG_CONFIG_HOME: path.join(temporary, 'config'), XDG_CACHE_HOME: path.join(temporary, 'cache') },
    });
    receipt.browserVersion = browser.version();
    page = await browser.newPage({ viewport: options.viewport, deviceScaleFactor: 1 });
    page.on('pageerror', error => { receipt.errors.push({ type: 'pageerror', message: error.message }); save(); });
    page.on('console', message => fs.appendFileSync(path.join(options.out, 'console.jsonl'), JSON.stringify({ type: message.type(), text: message.text() }) + '\n'));
    page.on('requestfailed', request => { receipt.errors.push({ type: 'requestfailed', url: request.url(), failure: request.failure() }); save(); });
    await page.exposeFunction('__qaProgress', event => {
      fs.appendFileSync(path.join(options.out, 'progress.jsonl'), JSON.stringify(event) + '\n');
      receipt.lastProgress = { stage: event.stage, ms: event.ms, tiles: event.tiles, total: event.total };
      save();
      if (event.stage !== 'wavefront-batch-progress') console.log('CITY_REVIEW_PROGRESS', JSON.stringify(receipt.lastProgress));
    });
    receipt.stage = 'runtime-initialization'; save();
    const initStart = Date.now();
    await page.goto(receipt.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.__settlementGPU?.proof.controlsReady || window.__settlementGPU?.proof.status === 'failed', null, { timeout: options.initTimeoutMs });
    const initial = await page.evaluate(() => structuredClone(window.__settlementGPU.proof));
    receipt.initializationMs = Date.now() - initStart;
    receipt.adapter = initial.adapter;
    receipt.pipelineMs = stageTimings(initial.stages);
    json('initial-proof.json', initial);
    if (initial.status === 'failed' || initial.compilation.some(x => x.type === 'error') || initial.deviceErrors.length) throw Error(JSON.stringify(initial.failure ?? initial.deviceErrors));
    if (!initial.controlsReady || initial.frames.length) throw Error('Manual initialization unexpectedly rendered a frame');
    receipt.status = 'initialized'; save();
    if (options.mode !== 'init') {
      receipt.stage = 'render'; save();
      const renderStart = Date.now();
      const frame = await bounded(page.evaluate(async ({ mode, view, rect, maxSubmissions }) => {
        const api = window.__settlementGPU;
        const config = { debug: 0, primaryDiagnostics: true, maxSubmissions };
        const result = mode === 'smoke' ? await api.crop(view, rect, config) : await api.view(view, config);
        // Export the actual native canvas immediately after completed presentation.
        window.__cityNativePNG = document.querySelector('#c').toDataURL('image/png');
        return result;
      }, options), options.renderTimeoutMs, `${options.mode} WebGPU rendering`);
      receipt.renderWallMs = Date.now() - renderStart;
      json('frame.json', frame);
      receipt.frame = { epoch: frame.epoch, view: frame.view, pixels: frame.pixels, rect: frame.rect, tiles: frame.tiles, inspectionCrop: frame.inspectionCrop, submittedThroughCompletionWallMs: frame.submittedThroughCompletionWallMs, rayStatus: frame.rayStatus, scheduler: frame.scheduler };
      const dataURL = await page.evaluate(() => window.__cityNativePNG);
      if (!dataURL?.startsWith('data:image/png;base64,')) throw Error('Native canvas PNG export is absent');
      const png = Buffer.from(dataURL.slice('data:image/png;base64,'.length), 'base64');
      if (JSON.stringify(pngDimensions(png)) !== JSON.stringify(options.nativePixels)) throw Error('Native PNG has been scaled or has the wrong dimensions');
      fs.writeFileSync(path.join(options.out, 'native-canvas.png'), png);
      receipt.files.push({ name: 'native-canvas.png', purpose: options.mode === 'smoke' ? 'Native whole canvas containing only the explicitly requested smoke tile' : 'Unscaled native full perspective canvas', bytes: png.length, sha256: sha256(png), pixels: pngDimensions(png) });
      validateFrame(frame, options);
    }
    const proof = await page.evaluate(() => structuredClone(window.__settlementGPU.proof));
    json('proof.json', proof);
    await page.screenshot({ path: path.join(options.out, 'ui.png'), fullPage: true, timeout: 15000 });
    receipt.files.push({ name: 'ui.png', purpose: 'Separate UI screenshot; not substituted for native render' });
    if (receipt.errors.length || proof.deviceErrors.length || proof.status === 'failed') throw Error('Browser or device reported errors; inspect proof and console');
    receipt.status = options.mode === 'init' ? 'initialization-passed' : options.mode === 'smoke' ? 'smoke-passed-not-full-frame' : 'full-frame-rendered-for-review';
    receipt.stage = 'complete';
    save();
    console.log('CITY_REVIEW_RESULT', JSON.stringify({ status: receipt.status, out: options.out, initializationMs: receipt.initializationMs, renderWallMs: receipt.renderWallMs, adapter: receipt.adapter }));
    return receipt;
  } catch (error) {
    receipt.status = 'failed'; receipt.failure = { stage: receipt.stage, message: error.message, stack: error.stack };
    if (page && !page.isClosed()) {
      const proof = await bounded(page.evaluate(() => { window.__settlementGPU?.cancel?.('review-runner-failure'); return structuredClone(window.__settlementGPU?.proof ?? null); }), 3000, 'failure proof capture').catch(e => ({ unavailable: e.message }));
      json('proof.json', proof);
      await page.screenshot({ path: path.join(options.out, 'failure-ui.png'), fullPage: true, timeout: 3000 }).catch(() => {});
    }
    save();
    console.error(error.stack);
    return receipt;
  } finally {
    if (browser) await bounded(browser.close(), 10000, 'browser cleanup').catch(error => { receipt.cleanupError = error.message; save(); });
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
}

module.exports = { FLAGS, CANDIDATES, parseOptions, dimensions, snapshotRuntime, createSnapshotServer, bounded, stageTimings, pngDimensions, validateFrame, run };
if (require.main === module) {
  (async () => {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) return console.log(HELP);
    const receipt = await run(options);
    process.exitCode = receipt.status === 'failed' || receipt.cleanupError ? 1 : 0;
  })().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
