#!/usr/bin/env node
'use strict';

// Diagnostic only. Never edits the renderer, geometry, shared mothers, or QA runner.
// Example (prepare-only performs no browser launch):
// node qa/inspect-dark-shapes.cjs --tile 144,192 --prepare-only --out qa/dark-plan
// An actual run must be explicitly invoked without --prepare-only in an allowed host.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { FLAGS, snapshotRuntime, createSnapshotServer, bounded, pngDimensions, dimensions } = require('./local-review.cjs');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATE = 'whole-frontage-r04';
const LOCKED_COMMIT = '22f4ce8590878233be1361a9e6c80b1ac630100c';
const APP_PATH = '/whole-frontage-r04/runtime/app.mjs';
const ORIGINAL_CONDITION = 'if(f[idx*4+3]>.5)';
const DIAGNOSTIC_CONDITION = 'if(true)';
const MODES = Object.freeze([
  { debug: 0, name: 'normal' }, { debug: 1, name: 'macro-normal' },
  { debug: 2, name: 'material-id' }, { debug: 3, name: 'albedo' },
  { debug: 4, name: 'actual-normal' },
]);
const LIMITATIONS = Object.freeze([
  'Only explicitly selected 16x16 crops are computed. No full frame or delivery image is generated.',
  'Only one host readback filter is removed from the in-memory served app; all geometry, shaders, mothers, and disk files stay frozen.',
  'Visibility records have distance, coefficient, steps, and pending status, but no occluder identity. They cannot name the shadow-casting object.',
  'Debug colors still undergo the existing glass blend, tone mapping, and gamma transform; raw IDs and normals are authoritative.',
  'Visibility=1 can mean the light-facing test skipped a query; use visibilityQueried and normalLightDot before interpreting it.',
  'Object/material IDs belong to the first opaque hit after glass, not necessarily the foremost transparent pane.',
]);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function parseOptions(argv) {
  const values = {}, tiles = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') return { help: true };
    if (flag === '--prepare-only') { if (values.prepareOnly) throw Error('Duplicate --prepare-only'); values.prepareOnly = true; continue; }
    if (!['--tile', '--baseline', '--out', '--timeout-ms', '--max-submissions'].includes(flag) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw Error(`Unknown or incomplete option: ${flag}`);
    const value = argv[++i];
    if (flag === '--tile') {
      if (!/^\d+,\d+$/.test(value)) throw Error('--tile must be integer X,Y; size is always 16x16');
      tiles.push(value.split(',').map(Number).concat([16, 16]));
    } else {
      const key = flag.slice(2);
      if (values[key] !== undefined) throw Error(`Duplicate ${flag}`);
      values[key] = value;
    }
  }
  if (!tiles.length || tiles.length > 3) throw Error('Provide one to three explicit --tile X,Y selections');
  if (new Set(tiles.map(t => t.join(','))).size !== tiles.length) throw Error('Duplicate tile selection');
  const timeoutMs = Number(values['timeout-ms'] ?? 300000), maxSubmissions = Number(values['max-submissions'] ?? 20000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10000 || timeoutMs > 300000) throw Error('Total timeout must be 10000..300000 ms, including launch and initialization');
  if (!Number.isSafeInteger(maxSubmissions) || maxSubmissions < 1 || maxSubmissions > 20000) throw Error('Each tile is bounded to at most 20000 submissions');
  return { tiles, timeoutMs, maxSubmissions, prepareOnly: !!values.prepareOnly,
    baseline: path.resolve(ROOT, values.baseline ?? 'qa/public-baseline-22f4ce-overall'),
    out: path.resolve(ROOT, values.out ?? `qa/dark-shapes-${new Date().toISOString().replace(/[:.]/g, '-')}`) };
}
function patchReadback(bytes) {
  const source = bytes.toString('utf8');
  if (source.split(ORIGINAL_CONDITION).length !== 2) throw Error('Expected exactly one original visibility readback filter');
  const start = source.indexOf('async function readVisibilityTile('), end = source.indexOf('async function readTraceTile(', start);
  const condition = source.indexOf(ORIGINAL_CONDITION);
  if (start < 0 || end < 0 || condition < start || condition >= end) throw Error('Readback filter is outside the expected host function');
  const patched = source.slice(0, condition) + DIAGNOSTIC_CONDITION + source.slice(condition + ORIGINAL_CONDITION.length);
  if (patched.slice(0, condition) + ORIGINAL_CONDITION + patched.slice(condition + DIAGNOSTIC_CONDITION.length) !== source) throw Error('Patch would change more than the single readback filter');
  return { bytes: Buffer.from(patched), record: { path: APP_PATH.slice(1), operation: 'In-memory host readback condition only', original: ORIGINAL_CONDITION, replacement: DIAGNOSTIC_CONDITION, replacements: 1, offset: condition, beforeSha256: hash(bytes), afterSha256: hash(Buffer.from(patched)) } };
}
function prepare(options, root = ROOT) {
  const baselineReceipt = JSON.parse(fs.readFileSync(path.join(options.baseline, 'public-baseline.json')));
  const baselineFrame = JSON.parse(fs.readFileSync(path.join(options.baseline, 'camera-baseline.json')));
  const baselineHashes = JSON.parse(fs.readFileSync(path.join(options.baseline, 'source-hashes.json')));
  const baselinePNG = fs.readFileSync(path.join(options.baseline, 'native-canvas.png'));
  if (baselineReceipt.commit !== LOCKED_COMMIT || baselineReceipt.status !== 'full-frame-rendered-for-review') throw Error('Baseline must be the successful frozen 22f4ce full-frame receipt');
  if (baselineReceipt.options?.candidate !== CANDIDATE || baselineFrame.snapshot?.debug !== 0 || baselineFrame.inspectionCrop) throw Error('Baseline must be a normal full frame of the frozen candidate');
  const viewport = baselineReceipt.options.viewport;
  if (JSON.stringify(dimensions(viewport)) !== JSON.stringify(baselineFrame.pixels) || JSON.stringify(pngDimensions(baselinePNG)) !== JSON.stringify(baselineFrame.pixels)) throw Error('Baseline viewport, frame, and PNG dimensions disagree');
  for (const [x, y, w, h] of options.tiles) if (![x, y].every(Number.isSafeInteger) || x < 0 || y < 0 || w !== 16 || h !== 16 || x + w > baselineFrame.pixels[0] || y + h > baselineFrame.pixels[1]) throw Error('Selected 16x16 tile extends outside the frozen native frame');
  const snapshot = snapshotRuntime(root, CANDIDATE);
  const keys = Object.keys(snapshot.hashes).sort();
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(baselineHashes).sort())) throw Error('Frozen runtime file inventory differs from the completed baseline');
  const mismatches = keys.filter(key => snapshot.hashes[key].sha256 !== baselineHashes[key].sha256 || snapshot.hashes[key].bytes !== baselineHashes[key].bytes);
  if (mismatches.length) throw Error(`Runtime differs from frozen 22f4ce source: ${mismatches.join(', ')}`);
  const patch = patchReadback(snapshot.bytes.get(APP_PATH));
  snapshot.bytes.set(APP_PATH, patch.bytes);
  snapshot.bytes.set('/diagnostic-baseline.png', baselinePNG);
  const servedHashes = Object.fromEntries([...snapshot.bytes].map(([name, bytes]) => [name.slice(1), { bytes: bytes.length, sha256: hash(bytes) }]));
  const changed = keys.filter(key => servedHashes[key].sha256 !== baselineHashes[key].sha256);
  if (JSON.stringify(changed) !== JSON.stringify([APP_PATH.slice(1)])) throw Error('Unexpected served runtime differences');
  return { snapshot, baselineReceipt, baselineFrame, baselineHashes, servedHashes,
    plan: { commit: LOCKED_COMMIT, candidate: CANDIDATE, viewport, view: baselineFrame.view, nativePixels: baselineFrame.pixels, snapshotId: baselineFrame.snapshot.snapshotId, growth: baselineReceipt.options.growth, tiles: options.tiles, modes: MODES, totalRenderCalls: options.tiles.length * MODES.length, totalTimeoutMs: options.timeoutMs, maxSubmissionsPerTile: options.maxSubmissions, patch: patch.record, unchangedRuntimeFiles: keys.length - 1, motherParity: snapshot.motherParity, baselinePNG: { bytes: baselinePNG.length, sha256: hash(baselinePNG) }, limitations: LIMITATIONS } };
}
const norm = v => { const length = Math.hypot(...v); return length > 0 ? v.map(x => x / length) : [0, 0, 0]; };
const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
function pixelRecord(raw, snapshot) {
  if (!Array.isArray(raw.hitRecord) || raw.hitRecord.length !== 24 || raw.ids?.length !== 4 || raw.normalAndVisibility?.length !== 4 || raw.initial?.length !== 4 || raw.final?.length !== 4) throw Error('Unexpected GPU readback layout');
  const h = raw.hitRecord, status = h[3], macro = h.slice(12, 15), actual = raw.normalAndVisibility.slice(0, 3), light = norm([-3, 7, -4]);
  if (status === 1 && [...macro, ...actual, raw.normalAndVisibility[3]].some(v => !Number.isFinite(v))) throw Error('Hit has a non-finite normal or visibility');
  const [x, y] = raw.pixel, uv = [((x + .5) / snapshot.width * 2 - 1) * snapshot.width / snapshot.height, -((y + .5) / snapshot.height * 2 - 1)];
  const ray = norm(snapshot.fw.map((n, i) => n + (snapshot.rt[i] * uv[0] + snapshot.up[i] * uv[1]) * snapshot.tanFov));
  const validHit = status === 1;
  return { pixel: raw.pixel, hitStatus: status, hitStatusName: ['miss', 'opaque-hit', 'exhausted'][status] ?? 'unknown', rawHitRecord: h, ids: raw.ids,
    materialId: raw.ids[0], buildingId: raw.ids[1], componentId: raw.ids[2], stateId: raw.ids[3], objectId: h[7],
    rayDistance: h[0], geometryDistance: h[1], primarySteps: h[2], localPoint: h.slice(4, 7), worldPoint: validHit ? snapshot.eye.map((n, i) => n + ray[i] * h[0]) : null,
    macroNormal: macro, actualNormal: actual, sectionCap: h[15],
    macroNormalLength: Math.hypot(...macro), actualNormalLength: Math.hypot(...actual),
    normalAngleDegrees: validHit && Math.hypot(...macro) > 0 && Math.hypot(...actual) > 0 ? Math.acos(Math.max(-1, Math.min(1, dot(norm(macro), norm(actual))))) * 180 / Math.PI : null,
    macroLightDot: validHit ? dot(macro, light) : null, normalLightDot: validHit ? dot(actual, light) : null,
    visibility: raw.normalAndVisibility[3], visibilityQueried: validHit && raw.final[2] > 0, visibilityInitial: { distance: raw.initial[0], value: raw.initial[1], steps: raw.initial[2], pending: raw.initial[3] }, visibilityFinal: { distance: raw.final[0], value: raw.final[1], steps: raw.final[2], pending: raw.final[3] },
    throughGlass: h[19] >= 0, glassRecord: h.slice(16, 20), transmissionRecord: h.slice(20, 24),
    interpretationLimit: validHit ? 'No shadow-occluder ID is recorded; display colors include glass and tone mapping.' : 'IDs and normals on misses/exhausted rays are not valid opaque-surface identification.' };
}
function validateCrop(frame, tile, mode, baseline) {
  if (frame?.view !== baseline.view || !frame.inspectionCrop || frame.tiles !== 1 || frame.snapshot?.debug !== mode.debug || JSON.stringify(frame.rect) !== JSON.stringify(tile) || JSON.stringify(frame.pixels) !== JSON.stringify(baseline.pixels)) throw Error('Diagnostic crop, camera, mode, or native dimensions differ');
  for (const key of ['eye', 'target', 'fw', 'rt', 'up', 'tanFov', 'cut', 'width', 'height', 'stoneScale', 'hostSeconds', 'year', 'snapshotId', 'worldId']) if (JSON.stringify(frame.snapshot[key]) !== JSON.stringify(baseline.snapshot[key])) throw Error(`Diagnostic changes the frozen camera/world field ${key}`);
  const ray = frame.rayStatus;
  if (!ray || ray.hit + ray.trueMiss + ray.exhausted !== 256 || ray.exhausted || ray.visibilityUnresolved || ray.candidateOverflows || ray.activeQueries) throw Error('Diagnostic has missing or unresolved rays');
  const records = frame.visibilityContinuations;
  if (!Array.isArray(records) || records.length !== 256 || new Set(records.map(r => r.pixel.join(','))).size !== 256) throw Error('Unfiltered readback must contain all 256 distinct pixels');
  for (const r of records) if (r.pixel[0] < tile[0] || r.pixel[0] >= tile[0] + 16 || r.pixel[1] < tile[1] || r.pixel[1] >= tile[1] + 16) throw Error('Readback contains a pixel outside the selected tile');
}
function compareRGBA(actual, baseline) {
  if (actual.length !== 1024 || baseline.length !== 1024) throw Error('Expected two 16x16 RGBA arrays');
  let differingPixels = 0, maximumChannelDelta = 0, absoluteChannelDelta = 0;
  for (let i = 0; i < actual.length; i += 4) {
    let changed = false;
    for (let c = 0; c < 4; c++) { const d = Math.abs(actual[i + c] - baseline[i + c]); changed ||= d !== 0; maximumChannelDelta = Math.max(maximumChannelDelta, d); absoluteChannelDelta += d; }
    if (changed) differingPixels++;
  }
  return { exactMatch: differingPixels === 0, differingPixels, maximumChannelDelta, meanAbsoluteChannelDelta: absoluteChannelDelta / 1024 };
}
async function runWorker(options) {
  const started = Date.now(), deadline = started + options.timeoutMs - 5000;
  fs.mkdirSync(options.out, { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(options.out, name), JSON.stringify(value, null, 2) + '\n');
  if (fs.existsSync(path.join(options.out, 'receipt.json'))) throw Error('Preserve prior evidence: select a new output directory');
  const receipt = { status: 'preparing', workerPid: process.pid, startedAt: new Date().toISOString(), options, renderCalls: [], errors: [], limitations: LIMITATIONS };
  const save = () => { receipt.wallMs = Date.now() - started; write('receipt.json', receipt); };
  const remaining = () => { const ms = deadline - Date.now(); if (ms <= 0) throw Error('Five-minute diagnostic budget exhausted'); return ms; };
  const within = (promise, label) => bounded(promise, remaining(), label);
  let browser, browserServer, page, server, temporary, prepared;
  save();
  try {
    prepared = prepare(options);
    write('plan.json', prepared.plan); write('original-source-hashes.json', prepared.baselineHashes); write('served-source-hashes.json', prepared.servedHashes);
    receipt.plan = prepared.plan;
    if (options.prepareOnly) { receipt.status = 'prepared-only-not-executed'; save(); return receipt; }
    server = createSnapshotServer(prepared.snapshot);
    await within(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }), 'server startup');
    const origin = `http://127.0.0.1:${server.address().port}`;
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dark-shapes-browser-'));
    const { chromium } = require('playwright');
    receipt.stage = 'browser-launch'; save();
    browserServer = await within(chromium.launchServer({ headless: true, host: '127.0.0.1', args: [...FLAGS], timeout: Math.min(45000, remaining()), ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), env: { ...process.env, XDG_CONFIG_HOME: path.join(temporary, 'config'), XDG_CACHE_HOME: path.join(temporary, 'cache') } }), 'browser startup');
    receipt.ownedBrowserPid = browserServer.process().pid; save();
    browser = await within(chromium.connect(browserServer.wsEndpoint(), { timeout: remaining() }), 'browser connection');
    receipt.browserVersion = browser.version(); receipt.browserFlags = FLAGS;
    page = await within(browser.newPage({ viewport: prepared.plan.viewport, deviceScaleFactor: 1 }), 'page creation');
    page.on('pageerror', e => { receipt.errors.push(e.message); save(); });
    page.on('console', m => fs.appendFileSync(path.join(options.out, 'console.jsonl'), JSON.stringify({ type: m.type(), text: m.text() }) + '\n'));
    await page.exposeFunction('__qaProgress', e => { fs.appendFileSync(path.join(options.out, 'progress.jsonl'), JSON.stringify(e) + '\n'); receipt.lastProgress = { stage: e.stage, ms: e.ms }; save(); });
    receipt.stage = 'initialization'; save();
    const initStarted = Date.now();
    await within(page.goto(`${origin}/${CANDIDATE}/runtime/index.html?manual=1&view=${prepared.plan.view}&growth=${prepared.plan.growth}`, { waitUntil: 'domcontentloaded', timeout: Math.min(30000, remaining()) }), 'page navigation');
    await page.waitForFunction(() => window.__settlementGPU?.proof.controlsReady || window.__settlementGPU?.proof.status === 'failed', null, { timeout: remaining() });
    const initial = await within(page.evaluate(() => structuredClone(window.__settlementGPU.proof)), 'initial proof');
    write('initial-proof.json', initial); receipt.initializationMs = Date.now() - initStarted; receipt.adapter = initial.adapter;
    if (!initial.controlsReady || initial.status === 'failed' || initial.deviceErrors.length || initial.compilation.some(e => e.type === 'error') || initial.frames.length) throw Error('Manual WebGPU initialization did not complete cleanly');
    for (const tile of options.tiles) {
      const directory = `tile-${tile[0]}-${tile[1]}`; fs.mkdirSync(path.join(options.out, directory));
      let normalRecords;
      const combined = new Map();
      for (const mode of MODES) {
        remaining(); receipt.stage = `${directory}/${mode.name}`; save();
        const result = await within(page.evaluate(async ({ tile, mode, view, maxSubmissions }) => {
          const frame = await window.__settlementGPU.crop(view, tile, { debug: mode.debug, primaryDiagnostics: true, visibilityDiagnostics: true, maxSubmissions });
          const canvas = document.querySelector('#c'), nativePNG = canvas.toDataURL('image/png');
          const crop = document.createElement('canvas'); crop.width = 16; crop.height = 16;
          const ctx = crop.getContext('2d'); ctx.drawImage(canvas, tile[0], tile[1], 16, 16, 0, 0, 16, 16);
          const png = crop.toDataURL('image/png'), rgba = Array.from(ctx.getImageData(0, 0, 16, 16).data);
          let baselineRGBA = null;
          if (mode.debug === 0) {
            const image = await createImageBitmap(await (await fetch('/diagnostic-baseline.png')).blob());
            ctx.clearRect(0, 0, 16, 16); ctx.drawImage(image, tile[0], tile[1], 16, 16, 0, 0, 16, 16); image.close();
            baselineRGBA = Array.from(ctx.getImageData(0, 0, 16, 16).data);
          }
          return { frame, nativePNG, png, rgba, baselineRGBA };
        }, { tile, mode, view: prepared.plan.view, maxSubmissions: options.maxSubmissions }), receipt.stage);
        write(`${directory}/${mode.name}-frame.json`, result.frame);
        for (const [suffix, dataURL, size] of [['.png', result.png, [16, 16]], ['-native-canvas.png', result.nativePNG, prepared.plan.nativePixels]]) {
          if (!dataURL.startsWith('data:image/png;base64,')) throw Error('Actual canvas PNG export missing');
          const bytes = Buffer.from(dataURL.slice('data:image/png;base64,'.length), 'base64');
          if (JSON.stringify(pngDimensions(bytes)) !== JSON.stringify(size)) throw Error('Canvas artifact has unexpected dimensions');
          fs.writeFileSync(path.join(options.out, directory, mode.name + suffix), bytes);
        }
        validateCrop(result.frame, tile, mode, prepared.baselineFrame);
        const raw = result.frame.visibilityContinuations, records = raw.map(r => pixelRecord(r, result.frame.snapshot));
        const invariant = JSON.stringify(raw);
        if (mode.debug === 0) normalRecords = invariant;
        else if (normalRecords !== invariant) throw Error('GPU hit/normal/visibility records changed across debug-only modes');
        records.forEach((record, i) => {
          const key = record.pixel.join(',');
          if (!combined.has(key)) combined.set(key, { ...record, displayRGBA: {} });
          combined.get(key).displayRGBA[mode.name] = result.rgba.slice(i * 4, i * 4 + 4);
        });
        const call = { tile, debug: mode.debug, mode: mode.name, wallMs: result.frame.submittedThroughCompletionWallMs, rayStatus: result.frame.rayStatus, records: records.length, diagnosticRecordsIdenticalAcrossModes: true };
        if (mode.debug === 0) call.baselineImageComparison = compareRGBA(result.rgba, result.baselineRGBA);
        receipt.renderCalls.push(call); write(`${directory}/pixels.json`, [...combined.values()]); save();
      }
      const pixels = [...combined.values()];
      write(`${directory}/summary.json`, { tile, pixelCount: pixels.length, countsByMaterialAndComponent: pixels.reduce((counts, p) => { const key = `${p.hitStatusName}:material=${p.materialId}:building=${p.buildingId}:component=${p.componentId}:state=${p.stateId}`; counts[key] = (counts[key] ?? 0) + 1; return counts; }, {}), rawRecordsIdenticalAcrossAllDebugModes: true, limitations: LIMITATIONS });
    }
    const proof = await within(page.evaluate(() => structuredClone(window.__settlementGPU.proof)), 'final proof'); write('proof.json', proof);
    if (receipt.errors.length || proof.deviceErrors.length || proof.status === 'failed') throw Error('Browser/device errors occurred');
    receipt.status = 'diagnostic-complete-not-delivery-image'; save();
    return receipt;
  } catch (error) {
    receipt.status = 'failed'; receipt.failure = { stage: receipt.stage, message: error.message, stack: error.stack }; save();
    if (page && !page.isClosed()) await bounded(page.evaluate(() => { window.__settlementGPU?.cancel?.('diagnostic-budget-or-failure'); return structuredClone(window.__settlementGPU?.proof); }), 1000, 'failure cleanup').then(proof => write('proof.json', proof)).catch(() => {});
    return receipt;
  } finally {
    if (browser) await bounded(browser.close(), 2000, 'browser cleanup').catch(() => {});
    if (browserServer) await bounded(browserServer.kill(), 1000, 'owned browser process cleanup').catch(() => {});
    if (server) { server.closeAllConnections(); server.close(); }
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
    if (prepared) {
      const changed = Object.keys(prepared.baselineHashes).filter(name => hash(fs.readFileSync(path.join(ROOT, name))) !== prepared.baselineHashes[name].sha256);
      receipt.diskRuntimeChangedDuringDiagnostic = changed;
      if (changed.length) { receipt.status = 'failed'; receipt.failure = { message: 'Runtime disk files changed during diagnostic', files: changed }; }
      save();
    }
  }
}
async function supervise(options, argv) {
  // Own worker process group only. Hard cleanup stops Chromium too, even if the
  // browser protocol or a driver hangs and cannot honor a cancellation request.
  const started = Date.now();
  const worker = spawn(process.execPath, [__filename, ...argv], { stdio: 'inherit', detached: process.platform !== 'win32', env: { ...process.env, CITY_DARK_DIAGNOSTIC_WORKER: '1' } });
  const signal = name => {
    const pids = [worker.pid];
    // Playwright may give Chromium its own process group. Its public process()
    // PID is recorded by this worker, allowing the supervisor to stop both groups.
    try { const r = JSON.parse(fs.readFileSync(path.join(options.out, 'receipt.json'))); if (r.workerPid === worker.pid && Number.isSafeInteger(r.ownedBrowserPid) && r.ownedBrowserPid > 1 && r.ownedBrowserPid !== process.pid) pids.push(r.ownedBrowserPid); } catch {}
    for (const pid of pids) try { process.kill(process.platform === 'win32' ? pid : -pid, name); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  };
  let timedOut = false;
  const soft = setTimeout(() => { timedOut = true; signal('SIGTERM'); }, options.timeoutMs - 1000);
  const hard = setTimeout(() => { timedOut = true; signal('SIGKILL'); }, options.timeoutMs);
  const code = await new Promise((resolve, reject) => { worker.once('error', reject); worker.once('exit', c => resolve(c ?? 1)); });
  clearTimeout(soft); clearTimeout(hard);
  if (timedOut) {
    signal('SIGKILL');
    fs.mkdirSync(options.out, { recursive: true });
    const file = path.join(options.out, 'receipt.json');
    let receipt = {}; try { receipt = JSON.parse(fs.readFileSync(file)); } catch {}
    receipt.status = 'bounded-timeout'; receipt.supervisorWallMs = Date.now() - started; receipt.failure = { message: 'Total diagnostic budget expired; owned worker/browser process group stopped' };
    fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
  }
  return timedOut ? 1 : code;
}
module.exports = { LOCKED_COMMIT, APP_PATH, ORIGINAL_CONDITION, DIAGNOSTIC_CONDITION, MODES, parseOptions, patchReadback, prepare, pixelRecord, validateCrop, compareRGBA, runWorker };
if (require.main === module) (async () => {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) return console.log('Usage: node qa/inspect-dark-shapes.cjs --tile X,Y [--tile X,Y] [--baseline PATH] [--out PATH] [--prepare-only] [--timeout-ms 300000]\nOne to three explicit 16x16 tiles; normal, macro-normal, material-ID, albedo, and actual-normal modes. Frozen 22f4ce sources required. No full render.');
  if (options.prepareOnly || process.env.CITY_DARK_DIAGNOSTIC_WORKER === '1') {
    const receipt = await runWorker(options); console.log(JSON.stringify({ status: receipt.status, out: options.out, wallMs: receipt.wallMs, failure: receipt.failure?.message }));
    process.exitCode = ['prepared-only-not-executed', 'diagnostic-complete-not-delivery-image'].includes(receipt.status) ? 0 : 1;
  } else process.exitCode = await supervise(options, process.argv.slice(2));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
