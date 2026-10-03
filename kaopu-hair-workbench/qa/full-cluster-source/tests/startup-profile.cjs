'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Optional, caller-owned Chromium startup measurement. No launch, dependency
 * install, production mutation, publication, or implicit module warm-up.
 *
 * const report = await require('./startup-profile.cjs')(browser, url, outDir, {
 *   label: 'catalog', htmlPath, expectedInitialModule: 'home',
 *   assertNoInitialWebGL: true,
 *   steps: ['anemone', 'rabbit', 'kuko', 'home']
 * });
 * if (!report.passed) throw Error(report.failure);
 *
 * Profile the preserved baseline in a SEPARATE invocation/context with no
 * initial-module assertion. Cold browser HTTP cache is disabled via CDP.
 * Timings include lightweight instrumentation overhead and are descriptive,
 * not hardware-independent pass/fail budgets. GPU execution time and physical
 * iPhone/Safari performance are not inferred from CPU API call durations.
 */
module.exports = async function startupProfile(browser, url, outDir, options = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const label = String(options.label || 'startup').replace(/[^a-zA-Z0-9_-]/g, '-');
  const timeout = options.timeoutMs || 120000;
  const report = {
    timestamp: new Date().toISOString(), label, url, passed: false,
    scope: 'Cold navigation, API initialization, allocated WebGL contexts, hidden draw/RAF activity, and optional explicit module visits',
    limitations: [
      'Instrumented CPU timings; no GPU timer queries or visual acceptance',
      'Ready-state polling has 50 ms observation granularity; context creation and message timestamps are event-based',
      'Draw calls are not animation frames; runtime frame counters are reported separately',
      'Request byte counts and decoded resource sizes are separate; file/data/srcdoc transfers may report zero or unavailable',
      'Nominal texture/renderbuffer storage calls are not a measurement of resident GPU memory',
      'No physical iPhone or Safari measurement'
    ],
    errors: [], requestFailures: [], requests: [], snapshots: [], intervals: [], steps: [], checks: []
  };
  if (options.htmlPath) {
    const b = fs.readFileSync(options.htmlPath);
    report.html = { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') };
  }
  const assert = (name, pass, detail) => {
    report.checks.push({ name, pass: Boolean(pass), detail });
    if (!pass) throw Error(name + ': ' + JSON.stringify(detail));
  };
  let context, page, watchdog;
  const deadline = Date.now() + timeout;
  const remaining = () => Math.max(1, deadline - Date.now());
  const network = new Map();
  const compactUrl = value => /^(data:|blob:)/.test(value) ? value.split(',')[0].slice(0, 100) + ' [payload omitted]' : value;
  try {
    context = await browser.newContext({
      viewport: options.viewport || { width: 1440, height: 1000 },
      deviceScaleFactor: options.deviceScaleFactor || 1,
      serviceWorkers: 'block'
    });
    // Bound the whole optional measurement, not each individual wait. Closing
    // the isolated context also interrupts a stalled navigation or evaluation.
    watchdog = setTimeout(() => {
      report.timedOut = true;
      context.close().catch(() => {});
    }, remaining());
    await context.addInitScript(() => {
      if (window.__startupAudit) return;
      const began = performance.timeOrigin;
      const contexts = [], attempts = [], events = [], first = {}, parse = [], longTasks = [];
      const pendingRaf = new Set();
      const raf = { requested: 0, executed: 0, cancelled: 0, hiddenRealmExecuted: 0 };
      const originalRaf = window.requestAnimationFrame.bind(window);
      const originalCancel = window.cancelAnimationFrame.bind(window);
      const now = () => performance.now();
      const visible = element => {
        try {
          if (document.hidden || !element?.isConnected) return false;
          let el = element, w = window;
          while (el) {
            if (el.checkVisibility) {
              if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
            } else {
              if (!el.getClientRects().length) return false;
              for (let a = el; a; a = a.parentElement) {
                const style = w.getComputedStyle(a);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
              }
            }
            if (w === w.top) break;
            el = w.frameElement; w = w.parent;
          }
          return true;
        } catch (_) { return null; }
      };
      const realmVisible = () => {
        if (document.hidden) return false;
        try { return window === window.top || visible(window.frameElement); }
        catch (_) { return null; }
      };
      window.requestAnimationFrame = function (callback) {
        raf.requested++;
        let id;
        id = originalRaf(timestamp => {
          pendingRaf.delete(id); raf.executed++;
          if (realmVisible() === false) raf.hiddenRealmExecuted++;
          return callback(timestamp);
        });
        pendingRaf.add(id); return id;
      };
      window.cancelAnimationFrame = function (id) {
        if (pendingRaf.delete(id)) raf.cancelled++;
        return originalCancel(id);
      };
      const jsonParse = JSON.parse;
      JSON.parse = function (text, reviver) {
        if (typeof text !== 'string' || text.length < 100000) return jsonParse.call(this, text, reviver);
        const started = now();
        try { return jsonParse.call(this, text, reviver); }
        finally { parse.push({ at: started, inputCharacters: text.length, durationMs: now() - started }); }
      };
      const instrumentContext = (gl, canvas, kind, started, ended) => {
        const row = {
          id: contexts.length, canvas, canvasId: canvas.id || '(unnamed)', kind,
          createdAtMs: started, createDurationMs: ended - started, createdWhileVisible: visible(canvas),
          calls: {}, cpuMs: {}, drawCalls: 0, hiddenDrawCalls: 0,
          noise4096DrawCalls: 0, firstDrawAtMs: null, lastDrawAtMs: null,
          storage: [], firstHiddenDrawAtMs: null, wrapErrors: []
        };
        contexts.push(row);
        let viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
        const names = ['viewport', 'drawArrays', 'drawElements', 'drawRangeElements', 'drawArraysInstanced',
          'drawElementsInstanced', 'texImage2D', 'texStorage2D', 'renderbufferStorage',
          'renderbufferStorageMultisample', 'compileShader', 'linkProgram', 'getShaderParameter', 'getProgramParameter'];
        for (const name of names) {
          if (typeof gl[name] !== 'function') continue;
          const original = gl[name];
          try {
            gl[name] = function (...args) {
              row.calls[name] = (row.calls[name] || 0) + 1;
              const draw = name.startsWith('draw');
              if (name === 'viewport') viewport = args.slice(0, 4);
              if (draw) {
                const at = now(); row.drawCalls++; row.firstDrawAtMs ??= at; row.lastDrawAtMs = at;
                if (visible(canvas) === false) { row.hiddenDrawCalls++; row.firstHiddenDrawAtMs ??= at; }
                if (viewport[2] === 4096 && viewport[3] === 4096) row.noise4096DrawCalls++;
              }
              let dimensions = null;
              if (name === 'texImage2D') {
                if (args.length >= 9) dimensions = [args[3], args[4]];
                else if (args.length === 6) dimensions = [args[5]?.width, args[5]?.height];
              } else if (name === 'texStorage2D') dimensions = [args[3], args[4]];
              else if (name === 'renderbufferStorage') dimensions = [args[2], args[3]];
              else if (name === 'renderbufferStorageMultisample') dimensions = [args[3], args[4]];
              if (dimensions && row.storage.length < 2000) row.storage.push({ api: name, atMs: now(), width: dimensions[0], height: dimensions[1] });
              const measure = ['compileShader', 'linkProgram', 'getShaderParameter', 'getProgramParameter', 'texImage2D', 'renderbufferStorage'].includes(name);
              const start = measure ? now() : 0;
              try { return original.apply(this, args); }
              finally { if (measure) row.cpuMs[name] = (row.cpuMs[name] || 0) + now() - start; }
            };
          } catch (e) { row.wrapErrors.push({ method: name, message: String(e) }); }
        }
        return row;
      };
      const tracked = new WeakMap();
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        const start = now();
        const result = getContext.call(this, kind, ...args);
        if (/webgl/.test(String(kind))) {
          const end = now();
          attempts.push({ canvasId: this.id, kind, atMs: start, durationMs: end - start, success: !!result });
          if (result && !tracked.has(result)) tracked.set(result, instrumentContext(result, this, kind, start, end));
        }
        return result;
      };
      const mark = (key, value) => { if (value && !(key in first)) first[key] = now(); };
      const observeReady = () => {
        mark('platformApi', !!window.platform);
        mark('home', window.platform?.module === 'home');
        mark('anemoneReady', window.anemone?.ready);
        mark('anemoneFirstFrame', (window.anemone?.renderer?.frames || 0) > 0);
        mark('kukoReady', window.kuko?.ready);
        for (const role of ['teacher', 'candidate']) {
          mark('rabbit' + role + 'Ready', window.workbench?.ready?.[role]);
          mark('rabbit' + role + 'FirstFrame', (window.workbench?.frameStats?.[role]?.frames || 0) > 0);
        }
      };
      document.addEventListener('DOMContentLoaded', () => { first.domContentLoaded = now(); observeReady(); });
      window.addEventListener('load', () => { first.load = now(); observeReady(); });
      window.addEventListener('message', event => {
        const d = event.data;
        if (d?.kaopu && ['ready', 'error', 'gl-error'].includes(d.type)) events.push({ atMs: now(), role: d.role, type: d.type, message: d.message });
        if (d?.kaopu && d.type === 'frame') mark('rabbit' + d.role + 'FirstFrameMessage', true);
      });
      const timer = setInterval(observeReady, 50);
      try { new PerformanceObserver(list => { for (const e of list.getEntries()) longTasks.push({ startTime: e.startTime, duration: e.duration, name: e.name }); }).observe({ type: 'longtask', buffered: true }); }
      catch (_) { /* Not every engine provides long-task entries. */ }
      window.__startupAudit = {
        snapshot() {
          observeReady();
          return {
            timeOrigin: began, nowMs: now(), windowName: window.name, documentHidden: document.hidden,
            first: { ...first }, events: events.slice(), attempts: attempts.slice(),
            raf: { ...raf, outstanding: pendingRaf.size }, parse: parse.slice(), longTasks: longTasks.slice(),
            contexts: contexts.map(({ canvas, ...row }) => ({ ...row, visibleNow: visible(canvas),
              width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight }))
          };
        },
        stopObserver() { clearInterval(timer); }
      };
    });
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('requestfailed', r => report.requestFailures.push({ url: compactUrl(r.url()), error: r.failure()?.errorText }));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    cdp.on('Network.requestWillBeSent', e => {
      network.set(e.requestId, { id: e.requestId, url: compactUrl(e.request.url), type: e.type, startTimestamp: e.timestamp, dataLength: 0, encodedChunks: 0 });
    });
    cdp.on('Network.responseReceived', e => {
      const r = network.get(e.requestId); if (!r) return;
      Object.assign(r, { status: e.response.status, mimeType: e.response.mimeType, fromDiskCache: e.response.fromDiskCache,
        responseEncodedDataLength: e.response.encodedDataLength, protocol: e.response.protocol,
        contentLength: e.response.headers['content-length'] || e.response.headers['Content-Length'],
        contentEncoding: e.response.headers['content-encoding'] || e.response.headers['Content-Encoding'] });
    });
    cdp.on('Network.dataReceived', e => {
      const r = network.get(e.requestId); if (r) { r.dataLength += e.dataLength; r.encodedChunks += e.encodedDataLength; }
    });
    cdp.on('Network.loadingFinished', e => {
      const r = network.get(e.requestId); if (r) Object.assign(r, { encodedDataLength: e.encodedDataLength, finishedTimestamp: e.timestamp });
    });
    cdp.on('Network.loadingFailed', e => {
      const r = network.get(e.requestId); if (r) Object.assign(r, { failure: e.errorText, cancelled: e.canceled });
    });
    const ready = async expected => {
      await page.waitForFunction(expected => {
        if (!window.platform) return false;
        const current = platform.module;
        if (expected && expected !== current) return false;
        if (current === 'home') return true;
        if (current === 'anemone') return window.anemone?.ready && anemone.renderer?.frames > 0;
        if (current === 'rabbit') return window.workbench?.ready?.candidate && (workbench.frameStats?.candidate?.frames || 0) > 0;
        if (current === 'kuko') return window.kuko?.ready && kuko.renderers?.every(r => r.frames > 0);
        return false;
      }, expected || null, { timeout: remaining(), polling: 50 });
    };
    const snapshot = async name => {
      const main = await page.evaluate(() => ({
        module: window.platform?.module, bodyModule: document.body?.dataset.module,
        navigation: performance.getEntriesByType('navigation').map(e => e.toJSON()),
        resources: performance.getEntriesByType('resource').map(e => ({ name: /^(data:|blob:)/.test(e.name) ? e.name.split(',')[0].slice(0, 100) : e.name,
          initiatorType: e.initiatorType, startTime: e.startTime, duration: e.duration, transferSize: e.transferSize,
          encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize })),
        runtime: {
          anemone: { ready: !!window.anemone?.ready, frames: window.anemone?.renderer?.frames || 0 },
          kuko: { ready: !!window.kuko?.ready, frames: (window.kuko?.renderers || []).map(r => r.frames) },
          rabbit: Object.fromEntries(['teacher', 'candidate'].map(role => {
            const frame = document.getElementById(role + 'Frame');
            let r; try { r = frame?.contentWindow?.runtime; } catch (_) { /* cross-origin frame */ }
            return [role, { ready: !!window.workbench?.ready?.[role], frames: r?.frameCount || 0, srcdocCharacters: frame?.srcdoc?.length || 0 }];
          }))
        },
        errors: [...(window.platform?.errors || []), ...(window.workbench?.errors || []), ...(window.anemone?.errors || []), ...(window.kuko?.errors || [])]
      }));
      const frames = [];
      for (const frame of page.frames()) {
        try {
          const metrics = await frame.evaluate(() => window.__startupAudit?.snapshot() || null);
          frames.push({ frameName: frame.name(), url: compactUrl(frame.url()), metrics });
        } catch (e) { frames.push({ frameName: frame.name(), snapshotError: e.message }); }
      }
      const result = { name, takenAt: new Date().toISOString(), ...main, frames,
        network: [...network.values()].map(r => ({ ...r })) };
      result.successfulContexts = frames.reduce((n, f) => n + (f.metrics?.contexts?.length || 0), 0);
      report.snapshots.push(result); return result;
    };
    const interval = (name, before, after) => {
      const deltas = [];
      for (const frame of after.frames) {
        const old = before.frames.find(f => f.frameName === frame.frameName && f.url === frame.url);
        if (!frame.metrics || !old?.metrics) continue;
        for (const row of frame.metrics.contexts) {
          const prior = old.metrics.contexts.find(c => c.id === row.id);
          deltas.push({ frame: frame.frameName, canvasId: row.canvasId, visibleBefore: prior?.visibleNow,
            visibleAfter: row.visibleNow, drawCalls: row.drawCalls - (prior?.drawCalls || 0),
            hiddenDrawCalls: row.hiddenDrawCalls - (prior?.hiddenDrawCalls || 0),
            noise4096DrawCalls: row.noise4096DrawCalls - (prior?.noise4096DrawCalls || 0),
            createdDuringInterval: !prior });
        }
      }
      const value = { name, before: before.name, after: after.name, contextDeltas: deltas,
        runtimeBefore: before.runtime, runtimeAfter: after.runtime };
      report.intervals.push(value); return value;
    };
    const started = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: remaining() });
    report.gotoDomContentLoadedWallMs = Date.now() - started;
    await ready(options.expectedInitialModule);
    const first = await snapshot('initial-ready');
    // Optional baseline-only observation: wait for the old eager startup to
    // finish without selecting or otherwise initializing any additional module.
    if (options.waitForBaselineModules) {
      await page.waitForFunction(() => window.anemone?.ready && window.kuko?.ready &&
        window.workbench?.ready?.teacher && window.workbench?.ready?.candidate &&
        (workbench.frameStats?.teacher?.frames || 0) >= 2 &&
        (workbench.frameStats?.candidate?.frames || 0) >= 2,
      null, { timeout: remaining(), polling: 50 });
    }
    await page.waitForTimeout(options.observeMs ?? 1500);
    const settled = await snapshot('initial-observed');
    interval('initial observation', first, settled);
    assert('startup instrumentation present', !!settled.frames[0]?.metrics, settled.frames[0]?.snapshotError);
    assert('no initial runtime errors', !settled.errors.length, settled.errors);
    if (options.expectedInitialModule) assert('expected initial module', settled.module === options.expectedInitialModule, settled.module);
    if (options.assertNoInitialWebGL) {
      assert('catalog creates zero WebGL contexts', settled.successfulContexts === 0, settled.successfulContexts);
      assert('catalog never attempts WebGL initialization', settled.frames.every(f => !f.metrics?.attempts?.length), settled.frames.map(f => ({ frame: f.frameName, attempts: f.metrics?.attempts })));
    }
    for (const step of options.steps || []) {
      const module = typeof step === 'string' ? step : step.module;
      const selectionAt = await page.evaluate(module => {
        const began = performance.now();
        const result = platform.select(module);
        if (result?.catch) result.catch(e => { window.__startupSelectionError = String(e); });
        return began;
      }, module);
      await ready(module);
      const a = await snapshot(module + '-ready');
      await page.waitForTimeout(typeof step === 'object' ? (step.observeMs ?? options.observeMs ?? 750) : (options.observeMs ?? 750));
      const b = await snapshot(module + '-observed');
      const quiet = interval(module + ' observation', a, b);
      report.steps.push({ module, selectedAtMs: selectionAt, readyObservedAtMs: a.frames.find(f => !f.frameName)?.metrics?.nowMs,
        contextsAfter: b.successfulContexts, interval: quiet.name });
      assert(module + ' selected successfully', b.module === module && !b.errors.length, { module: b.module, errors: b.errors });
      if (module === 'home' && options.assertHiddenIdle) assert('returning home produces no hidden draw calls after ready', quiet.contextDeltas.every(d => d.drawCalls === 0), quiet.contextDeltas);
    }
    assert('no page JavaScript errors', report.errors.length === 0, report.errors);
    assert('no failed external requests', report.requestFailures.length === 0, report.requestFailures);
    report.passed = true;
  } catch (e) {
    report.failure = e.stack || String(e);
  } finally {
    if (watchdog) clearTimeout(watchdog);
    report.requests = [...network.values()];
    report.networkTotals = {
      requests: report.requests.length,
      httpRequests: report.requests.filter(r => /^https?:/.test(r.url)).length,
      encodedDataLength: report.requests.reduce((n, r) => n + (r.encodedDataLength || 0), 0),
      decodedDataLength: report.requests.reduce((n, r) => n + (r.dataLength || 0), 0)
    };
    fs.writeFileSync(path.join(outDir, label + '-startup-profile.json'), JSON.stringify(report, null, 2));
    if (context) await context.close();
  }
  return report;
};
