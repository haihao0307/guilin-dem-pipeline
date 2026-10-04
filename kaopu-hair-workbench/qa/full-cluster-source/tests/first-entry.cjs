'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Focused cold Rabbit entry and recovery regression, using a caller-owned
 * Playwright Chromium browser. No browser launch, package install or publish.
 *
 * await require('./first-entry.cjs')(browser, url, outDir, check)
 * Always assert the returned report.passed. Both fresh mobile contexts belong
 * to this helper and are closed; evidence is written even when check throws.
 * Online bytes/network assertions and standalone embedded-asset assertions are
 * deliberately separate. Timings include instrumentation/readback overhead and
 * are not a physical iPhone/Safari performance or visual-acceptance claim.
 */
module.exports = async function firstEntry(browser, url, outDir, check) {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(), url, passed: false,
    scope: 'First real Rabbit tap, staged full-resolution rendering, deferred original masks, one causal WebGL failure and in-page retry, mobile Anemone quick controls',
    physicalIPhoneTested: false, physicalSafariTested: false, visualAcceptance: false, productionReady: false,
    context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' },
    tests: [], errors: [], requestFailures: [], requests: [], bundleResponses: [], screenshots: [], probes: [],
    limitations: ['CPU wall-clock observations with instrumentation overhead, not GPU timer queries',
      'Standalone masks are embedded, so only an online URL can prove deferred network transfer',
      'Canonical 600×600 source-default pixel fidelity is covered by the existing core suite']
  };
  const contexts = [], pendingBodies = [];
  let context, page, phase = 'cold';
  const save = () => fs.writeFileSync(path.join(outDir, 'first-entry-results.json'), JSON.stringify(report, null, 2));
  const assert = (name, pass, detail) => {
    const row = { name: 'first entry ' + phase + ': ' + name, pass: Boolean(pass), detail };
    report.tests.push(row); save();
    if (check) check(row.name, row.pass, detail);
    if (!row.pass) throw Error(row.name + ': ' + JSON.stringify(detail));
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const bundleURL = value => /\/catalog-assets\/rabbit-[a-f0-9]+\.json(?:[?#]|$)/i.test(value);
  const maskURL = value => /\/catalog-assets\/bunnyalpha_(?:base|tip)-[a-f0-9]+\.png(?:[?#]|$)/i.test(value);
  const wait = (fn, arg, timeout = 120000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });
  const screenshot = async name => {
    const file = path.join(outDir, phase + '-' + name + '.png');
    await page.screenshot({ path: file, fullPage: false });
    report.screenshots.push({ phase, name, path: file });
  };
  const visible = async selector => {
    const row = await page.locator(selector).evaluate(el => {
      const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { selector: el.id || el.outerHTML.slice(0, 160), x: r.x, y: r.y, width: r.width, height: r.height,
        visible: !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' &&
          r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 &&
          (el === top || el.contains(top)), disabled: !!el.disabled };
    });
    assert(selector + ' is visible and unobstructed in the first screen', row.visible && !row.disabled, row);
    return row;
  };
  const tap = async selector => { await visible(selector); await page.locator(selector).tap(); };

  // Runs in every new document, including the Rabbit srcdoc. The failure is
  // consumed by one candidate DOCUMENT, including its WebGL1 fallback, never
  // by home/Anemone or by the fresh candidate document created on retry.
  function instrument({ failFirstCandidate }) {
    const now = () => performance.timeOrigin + performance.now();
    const audit = window.__firstEntryAudit = { contexts: [], attempts: [], progress: [], messages: [], clicks: [],
      parses: [], decodes: [], firstFrame: null, timeOrigin: performance.timeOrigin };
    if (window === window.top) window.__firstEntryFault = { armed: failFirstCandidate, consumed: 0, at: null };
    let failedDocument = false;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const seen = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (!/webgl/i.test(String(kind))) return originalGetContext.call(this, kind, ...args);
      if (window !== window.top && window.name === 'candidate' && this.id === 'canvasGL') {
        const fault = parent.__firstEntryFault;
        if (fault?.armed) { fault.armed = false; fault.consumed++; fault.at = now(); failedDocument = true; }
        if (failedDocument) { audit.attempts.push({ kind, at: now(), success: false, injected: true }); return null; }
      }
      const gl = originalGetContext.call(this, kind, ...args);
      audit.attempts.push({ kind, at: now(), success: !!gl, injected: false });
      if (!gl || seen.has(gl)) return gl;
      seen.add(gl);
      const row = { kind, canvas: this.id, at: now(), draws: 0, defaultDraws: 0, noiseTiles: [], storage: [], errors: [] };
      audit.contexts.push(row);
      let viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight], scissor = null, scissored = false, target = null;
      for (const name of ['viewport', 'scissor', 'enable', 'disable', 'bindFramebuffer', 'texImage2D', 'drawArrays', 'drawElements', 'getError']) {
        const original = gl[name];
        gl[name] = function (...args) {
          if (name === 'viewport') viewport = args.slice(0, 4);
          if (name === 'scissor') scissor = args.slice(0, 4);
          if ((name === 'enable' || name === 'disable') && args[0] === gl.SCISSOR_TEST) scissored = name === 'enable';
          if (name === 'bindFramebuffer' && (args[0] === gl.FRAMEBUFFER || args[0] === gl.DRAW_FRAMEBUFFER)) target = args[1];
          if (name === 'texImage2D' && args.length >= 9) row.storage.push({ at: now(), internalFormat: args[2], width: args[3], height: args[4], format: args[6], type: args[7] });
          if (name === 'drawArrays' || name === 'drawElements') {
            row.draws++; if (!target) row.defaultDraws++;
            if (target && viewport[2] === 4096 && viewport[3] === 4096)
              row.noiseTiles.push({ at: now(), viewport: viewport.slice(), scissor: scissor?.slice(), scissored });
          }
          const result = original.apply(this, args);
          if (name === 'getError' && result) row.errors.push({ at: now(), code: result });
          return result;
        };
      }
      return gl;
    };
    const parse = JSON.parse;
    JSON.parse = function (text, ...args) {
      if (typeof text !== 'string' || text.length < 100000) return parse.call(this, text, ...args);
      const start = now();
      try { return parse.call(this, text, ...args); }
      finally { audit.parses.push({ at: start, characters: text.length, durationMs: now() - start }); }
    };
    const decode = TextDecoder.prototype.decode;
    TextDecoder.prototype.decode = function (bytes, ...args) {
      const start = now();
      try { return decode.call(this, bytes, ...args); }
      finally { if (bytes?.byteLength >= 100000) audit.decodes.push({ at: start, bytes: bytes.byteLength, durationMs: now() - start }); }
    };
    audit.readPixels = () => {
      const gl = window.gl, canvas = gl.canvas, bytes = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      let hash = 2166136261, changed = 0;
      const background = Array.from(bytes.slice(0, 3));
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
      for (let i = 0; i < bytes.length; i += 4)
        if (Math.max(Math.abs(background[0] - bytes[i]), Math.abs(background[1] - bytes[i + 1]), Math.abs(background[2] - bytes[i + 2])) > 12) changed++;
      return { width: canvas.width, height: canvas.height, hash, changed, background, glError: gl.getError() };
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => raf(time => {
      const value = callback(time);
      // Read the FIRST completed application frame before Chromium can discard
      // its default framebuffer. No test draw can manufacture this first frame.
      if (!audit.firstFrame && window.runtime?.frameCount > 0 && window.gl) {
        const submittedAt=now(),pixels=audit.readPixels();
        audit.firstFrame = { at: now(), submittedAt, frames: runtime.frameCount, startup: runtime.startup,
          pixels, defaultDraws: audit.contexts.reduce((n, row) => n + row.defaultDraws, 0) };
      }
      return value;
    });
    document.addEventListener('click', e => {
      const el = e.target.closest?.('#catalogRabbit, #catalogAnemone, #rabbitRetryLoad');
      if (el) audit.clicks.push({ id: el.id, at: now(), trusted: e.isTrusted });
    }, true);
    window.addEventListener('rabbitloadprogress', e => audit.progress.push({ at: now(), ...e.detail }));
    window.addEventListener('message', e => {
      const d = e.data;
      if (!d?.kaopu || d.role !== 'candidate' || !['load-progress', 'ready', 'frame', 'error', 'gl-error'].includes(d.type)) return;
      const frame = document.getElementById('candidateFrame');
      if (e.source !== frame?.contentWindow || d.epoch !== window.FRAME_EPOCHS?.candidate) return;
      const row = { at: now(), type: d.type, epoch: d.epoch, stage: d.stage, loaded: d.loaded, total: d.total, message: d.message,
        frames: d.frames, runtimeFrames: frame.contentWindow.runtime?.frameCount || 0,
        startup: frame.contentWindow.runtime?.startup, firstActualFrameAt: frame.contentWindow.__firstEntryAudit?.firstFrame?.at || null };
      audit.messages.push(row);
      // Observe after the complete dispatch, including production listeners.
      // A microtask can run between listener callbacks in Chromium.
      setTimeout(() => {
        const loading = document.getElementById('candidateLoading');
        row.loadingVisible = !!loading && !loading.hidden;
        row.loadingText = loading?.textContent;
      }, 0);
    });
  }

  const boot = async failFirstCandidate => {
    context = await browser.newContext(report.context); contexts.push(context);
    await context.addInitScript(instrument, { failFirstCandidate });
    page = await context.newPage(); page.setDefaultTimeout(20000);
    const sourcePhase = phase;
    page.on('pageerror', e => report.errors.push({ phase: sourcePhase, message: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ phase: sourcePhase, message: m.text() }); });
    page.on('request', r => {
      if (!/^(data:|blob:)/.test(r.url())) report.requests.push({ phase: sourcePhase, at: Date.now(), url: r.url(), type: r.resourceType() });
    });
    page.on('requestfailed', r => report.requestFailures.push({ phase: sourcePhase, url: r.url(), error: r.failure()?.errorText }));
    page.on('response', response => {
      if (bundleURL(response.url())) pendingBodies.push((async () => {
        try {
          const bytes = await response.body();
          report.bundleResponses.push({ phase: sourcePhase, url: response.url(), status: response.status(), bytes: bytes.length,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
        } catch (error) { report.bundleResponses.push({ phase: sourcePhase, url: response.url(), error: String(error) }); }
      })());
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await wait(() => window.platform?.module === 'home' && window.catalogUI);
  };
  const snapshot = async label => {
    const result = await page.evaluate(() => {
      const frame = document.getElementById('candidateFrame'), w = frame.contentWindow, r = w.runtime;
      const compact = a => a ? Object.fromEntries(Object.entries(a).filter(([key]) => key !== 'readPixels')) : null;
      return { module: platform.module, ready: { ...workbench.ready }, startupStatus: workbench.startupStatus,
        started: workbench.started, teacherStarted: workbench.teacherStarted,
        otherReady: { anemone: anemone.ready, kuko: kuko.ready }, parentProgress: { ...rabbitLoadProgress.state },
        runtime: r ? { frames: r.frameCount, state: r.renderer.currentPreset ? r.state() : null, startup: r.startup, noiseSize: r.renderer.noiseTextSize } : null,
        epoch: window.FRAME_EPOCHS?.candidate, host: compact(window.__firstEntryAudit), frame: compact(w.__firstEntryAudit),
        marks: performance.getEntriesByType('mark').filter(x => x.name.startsWith('rabbit-')).map(x => ({ name: x.name, at: performance.timeOrigin + x.startTime })),
        fault: window.__firstEntryFault,
        errors: [...workbench.errors, ...platform.errors, ...anemone.errors, ...kuko.errors],
        loading: { hidden: document.getElementById('candidateLoading').hidden, text: document.getElementById('candidateLoading').textContent } };
    });
    report.probes.push({ phase, label, ...result }); save(); return result;
  };
  const waitReady = async () => {
    await wait(() => workbench.startupStatus === 'error' || (workbench.ready.candidate && workbench.frameStats.candidate?.frames >= 2 &&
      document.getElementById('candidateFrame').contentWindow.runtime?.startup.busy === false));
    const result = await snapshot('ready observation');
    assert('first entry completes without startup or WebGL errors', result.startupStatus === 'ready' && !result.errors.length &&
      result.runtime?.frames >= 2 && !result.runtime.startup.failed && result.frame.contexts.every(c => !c.errors.length), result);
    return result;
  };
  const pixels = () => page.evaluate(() => {
    const w = document.getElementById('candidateFrame').contentWindow;
    if (w.runtime.startup.busy || !w.runtime.frameCount) throw Error('Pixel probe must follow an actual completed startup frame');
    w.renderer.drawScene(); return w.__firstEntryAudit.readPixels();
  });

  try {
    await boot(false);
    const home = await snapshot('untouched home');
    report.delivery = await page.evaluate(() => WORKBENCH_BUNDLE.modules ? 'standalone-embedded' : 'online-lazy');
    assert('fresh 390×844 DPR2 home has no initialized object or asset request', !home.started && !home.ready.candidate && !home.ready.teacher &&
      !home.otherReady.anemone && !home.otherReady.kuko && !home.runtime && home.host.contexts.length === 0 &&
      !report.requests.some(r => bundleURL(r.url) || maskURL(r.url)), home);
    const thumbnails = await page.locator('.catalog-card').evaluateAll(cards => cards.map(card => {
      const img = card.querySelector('.catalog-preview img');
      return { id: card.id, images: card.querySelectorAll('.catalog-preview img').length, svg: !!card.querySelector('.catalog-preview svg'),
        loaded: !!img?.complete && img.naturalWidth > 0, width: img?.naturalWidth, height: img?.naturalHeight,
        raster: !!img && /^data:image\/(jpeg|png|webp);base64,/.test(img.currentSrc) };
    }));
    assert('home shows two decoded raster render thumbnails rather than SVG icons', thumbnails.length === 2 && thumbnails.every(t =>
      t.images === 1 && !t.svg && t.loaded && t.raster && t.width >= 200 && t.height >= 150), thumbnails);
    await screenshot('home');
    await tap('#catalogRabbit');
    const first = await waitReady();
    await page.evaluate(() => workbench.ensureStarted()); // Observe the already-clicked entry; never warm it in advance.
    await Promise.all(pendingBodies);
    const click = first.host.clicks.find(x => x.id === 'catalogRabbit');
    const firstFrame = first.frame.firstFrame, ready = first.host.messages.find(x => x.type === 'ready');
    const stages = [...first.host.progress, ...first.host.messages.filter(x => x.type === 'load-progress')].sort((a, b) => a.at - b.at);
    report.timings = {
      clickAt: click?.at, requested: first.marks.find(x => x.name === 'rabbit-requested')?.at,
      assetsReady: first.marks.find(x => x.name === 'rabbit-assets-ready')?.at,
      bundleDecode: first.host.decodes, jsonParse: first.host.parses, frameModelParse: first.frame.parses,
      firstNecessaryTextureDecode: stages.find(x => x.stage === 'decode')?.at,
      noiseStart: stages.find(x => x.stage === 'noise')?.at,
      noiseEnd: stages.find(x => x.stage === 'noise' && x.loaded === x.total)?.at,
      firstActualFrame: firstFrame?.at, readyMessage: ready?.at,
      readyPromise: first.marks.find(x => x.name === 'rabbit-ready')?.at,
      clickToFirstActualFrameMs: firstFrame?.at - click?.at,
      clickToReadyMs: ready?.at - click?.at
    };
    assert('Rabbit starts from a trusted first tap and leaves Teacher/other objects cold', click?.trusted && !first.teacherStarted &&
      !first.ready.teacher && !first.otherReady.anemone && !first.otherReady.kuko && first.frame.contexts.length === 1, report.timings);
    assert('ready follows a genuine completed first frame, never an empty/loading frame', ready?.runtimeFrames >= 1 &&
      ready.firstActualFrameAt === firstFrame.at && ready.at >= firstFrame.at && !ready.startup.busy &&
      firstFrame.defaultDraws > 0 && firstFrame.pixels.changed > 500 && firstFrame.pixels.glError === 0 && first.loading.hidden,
    { ready, firstFrame, loading: first.loading });
    assert('visible progress reports initialization, decode and all noise tiles', ['initialize', 'decode', 'noise'].every(s => stages.some(x => x.stage === s)) &&
      first.host.messages.filter(x => x.stage === 'noise').length === 64 &&
      first.host.messages.some(x => x.stage === 'noise' && x.loadingVisible && /4096/.test(x.loadingText)), stages);
    const gpu = first.frame.contexts[0], tiles = gpu.noiseTiles;
    const tileKeys = new Set(tiles.map(t => t.scissor?.join(',')));
    assert('original 4096 RGBA8 noise remains exactly 64 disjoint 512px tiles', first.runtime.noiseSize === 4096 &&
      first.runtime.startup.noise.index === 64 && first.runtime.startup.noise.total === 64 &&
      gpu.storage.some(s => s.width === 4096 && s.height === 4096 && s.internalFormat === 32856 && s.format === 6408 && s.type === 5121) &&
      tiles.length === 64 && tileKeys.size === 64 && tiles.every(t => t.scissored && t.viewport.join(',') === '0,0,4096,4096' &&
        t.scissor[2] === 512 && t.scissor[3] === 512 && t.scissor[0] % 512 === 0 && t.scissor[1] % 512 === 0 &&
        t.scissor[0] >= 0 && t.scissor[0] <= 3584 && t.scissor[1] >= 0 && t.scissor[1] <= 3584),
    { startup: first.runtime.startup, storage: gpu.storage.filter(s => s.width === 4096), tiles });
    const masks = await page.evaluate(() => Object.entries(WORKBENCH_BUNDLE.assets).filter(([name]) => /bunnyalpha_(base|tip)\.png$/.test(name)).map(([name, value]) =>
      ({ name, embedded: value.startsWith('data:'), url: value.startsWith('data:') ? null : new URL(value, location.href).href, metadata: WORKBENCH_BUNDLE.assetMeta?.[name] })));
    assert('both unused original static masks stay deferred on default procedural entry', first.runtime.state.proceduralText === true &&
      first.runtime.startup.deferredMasks === 2 && masks.length === 2 && !report.requests.some(r => maskURL(r.url)), masks);
    if (report.delivery === 'online-lazy') {
      const bundles = report.bundleResponses.filter(r => r.phase === 'cold');
      assert('online first entry downloads the exact 3,983,565-byte primary bundle once', bundles.length === 1 &&
        bundles[0].status === 200 && bundles[0].bytes === 3983565 &&
        first.host.decodes.some(d => d.bytes === 3983565) && masks.every(m => !m.embedded && m.metadata?.bytes > 1000000), bundles);
      assert('online primary download/verification/parsing exposes progress', ['download', 'verify', 'parse'].every(stage => first.host.progress.some(x => x.stage === stage)) &&
        first.host.progress.some(x => x.stage === 'download' && x.loaded === 3983565 && x.total === 3983565), first.host.progress);
    } else assert('standalone retains both complete embedded mask resources', masks.every(m => m.embedded), masks);
    const procedural = await pixels();
    assert('default procedural Rabbit has real pixels and no GL error', procedural.changed > 500 && procedural.glError === 0, procedural);
    await screenshot('rabbit-first-frame');

    // Exercise the real original checkbox in its optional drawer. Native tap
    // reveals the drawer; Playwright uncheck performs trusted browser input.
    await tap('#rabbitControlsToggle');
    const toggle = page.locator('#toggle-proceduralText');
    for (let n = 0; n < 8; n++) {
      const summary = await toggle.evaluate(el => {
        const closed = []; for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) closed.unshift(p);
        return closed.length ? [...document.querySelectorAll('details > summary')].indexOf(closed[0].querySelector(':scope > summary')) : null;
      });
      if (summary === null) break;
      await page.locator('details > summary').nth(summary).click();
    }
    await toggle.uncheck();
    await wait(() => {
      const r = document.getElementById('candidateFrame').contentWindow.runtime;
      return !r.state().proceduralText && r.startup.deferredMasks === 0 && !r.startup.busy;
    });
    await page.locator('#rabbitControlsClose').click();
    const staticPixels = await pixels();
    assert('selecting original static masks loads both and genuinely changes pixels', staticPixels.glError === 0 && staticPixels.changed > 500 &&
      staticPixels.hash !== procedural.hash, { procedural, static: staticPixels });
    if (report.delivery === 'online-lazy') assert('each original static mask URL is requested only after selecting static mode', masks.every(m =>
      report.requests.filter(r => r.phase === 'cold' && r.url === m.url).length === 1), report.requests.filter(r => maskURL(r.url)));
    await screenshot('rabbit-static-masks');
    await page.locator('#rabbitControlsToggle').tap(); await toggle.check(); await page.locator('#rabbitControlsClose').click();
    await wait(() => document.getElementById('candidateFrame').contentWindow.runtime.state().proceduralText);
    const restored = await pixels();
    assert('returning to procedural text restores exact pixels without recomputing noise', restored.hash === procedural.hash &&
      restored.glError === 0 && await page.evaluate(() => document.getElementById('candidateFrame').contentWindow.__firstEntryAudit.contexts[0].noiseTiles.length === 64),
    { before: procedural, after: restored });

    await tap('#catalogHomeButton'); await tap('#catalogAnemone');
    await wait(() => platform.module === 'anemone' && anemone.ready && anemone.renderer.frames > 0);
    await page.evaluate(() => { anemone.pauseOrbit(); anemone.pause(); anemone.seek(0); });
    for (const selector of ['[data-anemone-zoom="1"]', '[data-anemone-zoom="1.5"]', '[data-anemone-zoom="2"]',
      '#anemoneLightingMode', '#anemone-warmPower', '#anemone-coolPower']) await visible(selector);
    const anemoneInitial = await page.evaluate(() => ({ state: anemone.state, pixels: anemone.pixels(), drawers: ['controlsDrawer', 'learningDrawer', 'referenceDrawer'].map(id => document.getElementById(id).open) }));
    assert('Anemone quick controls work with optional drawers closed', anemoneInitial.drawers.every(x => !x) &&
      anemoneInitial.pixels.glError === 0 && anemoneInitial.pixels.changed > 500, anemoneInitial);
    const zooms = [];
    for (const value of [1, 1.5, 1.5, 2, 2, 1]) {
      await tap('[data-anemone-zoom="' + value + '"]');
      const state = await page.evaluate(() => ({ state: anemone.state, pixels: anemone.pixels(), label: document.getElementById('anemoneQuickZoomValue').textContent,
        selected: [...document.querySelectorAll('[data-anemone-zoom][aria-pressed="true"]')].map(b => Number(b.dataset.anemoneZoom)) }));
      assert('Anemone ' + value * 100 + '% is absolute across repeated taps', near(state.state.camera.distance, 4.6 / value) &&
        near(state.state.camera.azimuth, anemoneInitial.state.camera.azimuth) && near(state.state.camera.elevation, anemoneInitial.state.camera.elevation) &&
        state.state.time === anemoneInitial.state.time && state.pixels.glError === 0 && state.pixels.changed > 500 &&
        state.label === value * 100 + '%' && state.selected.length === 1 && state.selected[0] === value, state);
      const previous = zooms.find(x => x.value === value);
      if (previous) assert('repeated ' + value * 100 + '% returns identical paused pixels', previous.pixels.hash === state.pixels.hash, { previous, current: state.pixels });
      zooms.push({ value, pixels: state.pixels });
    }
    report.anemoneZooms = zooms;
    assert('three Anemone zoom levels visibly differ', new Set(zooms.map(x => x.pixels.hash)).size === 3, zooms);
    for (const key of ['warmPower', 'coolPower']) {
      const before = await page.evaluate(() => ({ state: anemone.state, pixels: anemone.pixels() }));
      await page.locator('#anemone-' + key).focus(); await page.locator('#anemone-' + key).press('ArrowLeft');
      const after = await page.evaluate(() => ({ state: anemone.state, pixels: anemone.pixels() }));
      assert('first-screen ' + key + ' changes actual light and pixels', near(after.state.lighting[key], before.state.lighting[key] - .05) &&
        before.pixels.hash !== after.pixels.hash && after.pixels.glError === 0 && JSON.stringify(before.state.camera) === JSON.stringify(after.state.camera), { before, after });
    }
    await screenshot('anemone-first-screen');
    await page.setViewportSize({width:390,height:667});
    await wait(()=>Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--studio-height'))-innerHeight)<1);
    for(const selector of ['[data-anemone-zoom=\"1\"]','[data-anemone-zoom=\"1.5\"]','[data-anemone-zoom=\"2\"]','#anemoneLightingMode','#anemone-warmPower','#anemone-coolPower'])await visible(selector);
    await screenshot('anemone-short-phone');
    await context.close();

    phase = 'causal-retry'; await boot(true);
    await tap('#catalogRabbit');
    await wait(() => workbench.startupStatus === 'error');
    const failed = await snapshot('injected initial missing WebGL context');
    const rejection = await page.evaluate(async () => {
      try { await workbench.ensureStarted(); return { rejected: false }; }
      catch (error) { return { rejected: true, message: error.message, at: performance.timeOrigin + performance.now() }; }
    });
    const firstError = failed.host.messages.find(x => x.type === 'error');
    assert('one missing-context failure is reported immediately with its real cause', failed.fault.consumed === 1 &&
      !failed.ready.candidate && !failed.runtime.frames && failed.runtime.startup.failed &&
      firstError && firstError.at - failed.fault.at < 5000 && /WebGL\s*2/.test(firstError.message) &&
      rejection.rejected && /WebGL\s*2/.test(rejection.message) && !/模型切换未完成|30.*秒|timeout/i.test(rejection.message) &&
      failed.host.messages.every(x => x.type !== 'ready'), { fault: failed.fault, firstError, rejection, loading: failed.loading });
    await visible('#rabbitRetryLoad'); await screenshot('causal-error');
    await page.evaluate(() => { window.__failedCandidateDocument = document.getElementById('candidateFrame').contentDocument; });
    await tap('#rabbitRetryLoad');
    const retried = await waitReady();
    const retryPixels = await pixels();
    const freshFrame = await page.evaluate(() => window.__failedCandidateDocument !== document.getElementById('candidateFrame').contentDocument);
    assert('in-page retry replaces only the failed frame and renders successfully', freshFrame && retried.epoch > failed.epoch &&
      retried.host.timeOrigin === failed.host.timeOrigin && retried.fault.consumed === 1 && retried.startupStatus === 'ready' &&
      retried.runtime.startup.deferredMasks === 2 && retryPixels.glError === 0 && retryPixels.changed > 500 &&
      retried.host.clicks.some(x => x.id === 'rabbitRetryLoad' && x.trusted) && retried.loading.hidden,
    { failedEpoch: failed.epoch, retryEpoch: retried.epoch, freshFrame, fault: retried.fault, pixels: retryPixels });
    await screenshot('retry-ready');
    await Promise.all(pendingBodies);
    assert('no unexpected browser errors or failed network requests', !report.errors.length && !report.requestFailures.length,
      { errors: report.errors, requestFailures: report.requestFailures });
    report.passed = true;
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page && !page.isClosed()) {
      try { await screenshot('failure'); } catch (e) { report.screenshotFailure = String(e); }
      try { await snapshot('failure'); } catch (e) { report.snapshotFailure = String(e); }
    }
  } finally {
    for (const owned of contexts) try { await owned.close(); } catch (e) { report.cleanupWarning = String(e); }
    report.summary = { passed: report.passed, assertionsPassed: report.tests.filter(t => t.pass).length,
      assertionsFailed: report.tests.filter(t => !t.pass).length, screenshots: report.screenshots.length,
      delivery: report.delivery, clickToFirstActualFrameMs: report.timings?.clickToFirstActualFrameMs };
    save();
  }
  return report;
};
