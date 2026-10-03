'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Homepage/lazy-lifecycle and first-screen Rabbit controls regression evidence.
 * Uses only the supplied Chromium browser, real WebGL readbacks, Playwright
 * mouse, and CDP native touch. Never launches browsers, installs, or publishes.
 * Existing shape, shader, DPR, grooming and interaction suites remain required.
 */
module.exports = async function catalogControls(browser, url, outDir, check) {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(), url,
    scope: 'Object catalog, chosen-only WebGL startup, native first-screen Rabbit controls, absolute zoom and inactive-renderer lifecycle',
    physicalIPhoneTested: false, physicalSafariTested: false,
    visualAcceptance: false, productionReady: false, passed: false,
    tests: [], errors: [], requests: [], requestFailures: [], screenshots: [], probes: [], lifecycle: [], touchTrace: [],
    desktopContext: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
    portraitContext: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  };
  const selectors = {
    rabbit: '#catalogRabbit', anemone: '#catalogAnemone',
    home: '#catalogHomeButton', length: '#range-hairLength', width: '#rabbitMaskWidth', density: '#rabbitVisualDensity',
    zoom: value => '[data-rabbit-zoom="' + value + '"]', palette: id => '[data-rabbit-color="' + id + '"]'
  };
  const contexts = [];
  let context, page, cdp, phase = 'desktop', activeTouches = 0;
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
  const assert = (name, pass, detail) => {
    const test = { name: 'catalog ' + phase + ': ' + name, pass: Boolean(pass), detail };
    report.tests.push(test);
    if (check) check(test.name, test.pass, detail);
    if (!test.pass) throw Error(test.name + ': ' + JSON.stringify(detail));
  };
  const wait = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
  const raf = count => page.evaluate(count => new Promise(resolve => {
    let n = 0; const tick = () => ++n >= count ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count || 2);
  const screenshot = async name => {
    const file = path.join(outDir, phase + '-' + name + '.jpg');
    await page.screenshot({ path: file, fullPage: false, type: 'jpeg', quality: 85 });
    report.screenshots.push({ phase, name, path: file });
  };
  const lifecycle = async label => {
    const state = await page.evaluate(() => {
      const surfaces = [{ role: 'top', window }];
      for (const role of ['candidate', 'teacher']) {
        const frame = document.getElementById(role + 'Frame');
        if (frame?.contentWindow) surfaces.push({ role, window: frame.contentWindow });
      }
      const gpu = surfaces.map(({ role, window: w }) => ({ role,
        contexts: w.__catalogGpu?.contexts.length || 0,
        draws: (w.__catalogGpu?.contexts || []).reduce((sum, c) => sum + c.draws, 0),
        canvases: (w.__catalogGpu?.contexts || []).map(c => c.canvas)
      }));
      const frame = role => {
        const f = document.getElementById(role + 'Frame'), r = f?.contentWindow?.runtime;
        return { srcdoc: !!f?.getAttribute('srcdoc'), runtime: !!r, frames: r?.frameCount || 0,
          reportedFrames: workbench.frameStats[role]?.frames || 0, orbit: r?.orbit || null,
          pointers: r?.pointerCount || 0 };
      };
      return {
        module: platform.module, bodyModule: document.body.dataset.module,
        anemoneReady: !!window.anemone?.ready, kukoReady: !!window.kuko?.ready,
        rabbitStarted: !!workbench.started, rabbitReady: { ...workbench.ready },
        anemoneFrames: anemone.metrics()?.frames || 0, anemoneTime: anemone.state.time,
        anemoneOrbit: anemone.orbit, kukoFrames: (kuko.renderers || []).map(r => r.frames),
        candidate: frame('candidate'), teacher: frame('teacher'), gpu,
        contexts: gpu.reduce((n, x) => n + x.contexts, 0), draws: gpu.reduce((n, x) => n + x.draws, 0),
        errors: [...platform.errors, ...workbench.errors, ...anemone.errors, ...kuko.errors]
      };
    });
    report.lifecycle.push({ label, phase, ...state });
    return state;
  };
  const nativeTouch = async (type, points, label) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ radiusX: 5, radiusY: 5, force: 1, ...p })) });
    activeTouches = type === 'touchCancel' || (type === 'touchEnd' && !points.length) ? 0 : points.length;
    await raf(2);
    report.touchTrace.push({ type, points, label, ...await page.evaluate(() => ({ x: scrollX, y: scrollY, scale: visualViewport?.scale || 1 })) });
  };
  const bounds = async selector => page.locator(selector).evaluate(el => {
    const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom,
      viewport: { width: innerWidth, height: innerHeight },
      hit: !!top && (top === el || el.contains(top)), disabled: !!el.disabled,
      range: el.type === 'range', visible: !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' };
  });
  const visible = async (selector, label) => {
    await page.locator(selector).waitFor({ state: 'visible' });
    const b = await bounds(selector);
    assert(label + ' reachable without opening a drawer or scrolling', b.visible && b.hit && !b.disabled &&
      b.width >= 20 && b.height >= (b.range ? 4 : 20) && b.x >= -1 && b.y >= -1 &&
      b.right <= b.viewport.width + 1 && b.bottom <= b.viewport.height + 1, { selector, ...b });
    return b;
  };
  const click = async (selector, label) => {
    const b = await visible(selector, label);
    await page.locator(selector).evaluate(el => {
      el.__catalogClicks = [];
      el.addEventListener('click', e => el.__catalogClicks.push({ trusted: e.isTrusted, pointerType: e.pointerType }));
    });
    if (phase === 'portrait') {
      await nativeTouch('touchStart', [{ id: 7, x: b.x + b.width / 2, y: b.y + b.height / 2 }], label + ' down');
      await nativeTouch('touchEnd', [], label + ' up');
    } else {
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await raf(2);
    }
    const events = await page.locator(selector).evaluate(el => el.__catalogClicks);
    assert(label + ' activates through trusted native input', events.length > 0 && events.every(e => e.trusted) &&
      (phase !== 'portrait' || events.some(e => e.pointerType === 'touch')), events);
  };
  const waitRabbit = async (expected = {}, after = null) => wait(({ expected, after }) => {
    const r = document.getElementById('candidateFrame').contentWindow.runtime, s = r?.state();
    const matches = state => state && Object.entries(expected).every(([key, value]) => JSON.stringify(state[key]) === JSON.stringify(value));
    return matches(s) && matches(workbench.candidate) && (after === null || r.frameCount > after) &&
      workbench.frameStats.candidate?.frames >= r.frameCount;
  }, { expected, after });
  const probe = async label => {
    const p = await page.evaluate(() => {
      const w = document.getElementById('candidateFrame').contentWindow, r = w.runtime;
      const c = w.document.getElementById('canvasGL'), gl = w.gl;
      r.renderer.drawScene();
      const data = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let hash = 2166136261, changed = 0;
      for (const byte of data) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
      for (let i = 0; i < data.length; i += 4)
        if (Math.max(Math.abs(data[i] - data[0]), Math.abs(data[i + 1] - data[1]), Math.abs(data[i + 2] - data[2])) > 12) changed++;
      return { state: r.state(), host: structuredClone(workbench.candidate), teacher: structuredClone(workbench.baseline),
        teacherState: document.getElementById('teacherFrame').contentWindow.runtime.state(),
        frames: r.frameCount, pointers: r.pointerCount, orbit: r.orbit,
        pixels: { hash, changed, width: c.width, height: c.height, glError: gl.getError() },
        errors: [...workbench.errors, ...platform.errors, ...anemone.errors, ...kuko.errors] };
    });
    report.probes.push({ phase, label, ...p });
    assert(label + ' real nonempty WebGL image and no application errors', p.pixels.changed > 500 && p.pixels.glError === 0 && !p.errors.length, p.pixels);
    return p;
  };
  const dragRange = async (selector, fraction, label) => {
    const b = await visible(selector, label);
    const initial = await page.locator(selector).evaluate(el => {
      el.__catalogInputs = [];
      el.addEventListener('input', e => el.__catalogInputs.push({ trusted: e.isTrusted, value: Number(el.value) }));
      return { type: el.type, min: Number(el.min), max: Number(el.max), step: Number(el.step), value: Number(el.value),
        thumb: parseFloat(getComputedStyle(el, '::-webkit-slider-thumb').width) || 20 };
    });
    assert(label + ' is a native bounded range', initial.type === 'range' && initial.max > initial.min && b.width > 60, initial);
    const inset = initial.thumb > 0 && initial.thumb < 40 ? initial.thumb / 2 : 10;
    const travel = b.width - inset * 2, y = b.y + b.height / 2;
    const from = b.x + inset + travel * (initial.value - initial.min) / (initial.max - initial.min), to = b.x + inset + travel * fraction;
    if (phase === 'portrait') {
      await nativeTouch('touchStart', [{ id: 31, x: from, y }], label + ' down');
      for (let i = 1; i <= 4; ++i) await nativeTouch('touchMove', [{ id: 31, x: from + (to - from) * i / 4, y }], label + ' move');
      await nativeTouch('touchEnd', [], label + ' up');
    } else {
      await page.mouse.move(from, y); await page.mouse.down();
      await page.mouse.move(to, y, { steps: 4 }); await page.mouse.up(); await raf(2);
    }
    const result = await page.locator(selector).evaluate(el => ({ value: Number(el.value), events: el.__catalogInputs }));
    const target = initial.min + (initial.max - initial.min) * fraction;
    assert(label + ' edits through trusted native range events', result.events.length >= 2 && result.events.every(e => e.trusted) &&
      Math.abs(result.value - initial.value) > (initial.max - initial.min) * .08 &&
      Math.abs(result.value - target) <= Math.max(initial.step, (initial.max - initial.min) * .05), { initial, target, result });
    return result.value;
  };
  const boot = async () => {
    context = await browser.newContext(phase === 'portrait' ? report.portraitContext : report.desktopContext);
    contexts.push(context); page = await context.newPage(); page.setDefaultTimeout(30000);
    const sourcePhase = phase;
    page.on('pageerror', e => report.errors.push({ phase: sourcePhase, message: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ phase: sourcePhase, message: m.text() }); });
    page.on('request', r => { if (!/^(data|blob):/.test(r.url())) report.requests.push({ phase: sourcePhase, url: r.url() }); });
    page.on('requestfailed', r => report.requestFailures.push({ phase: sourcePhase, url: r.url(), error: r.failure()?.errorText }));
    await page.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.getContext, seen = new WeakSet();
      window.__catalogGpu = { contexts: [] };
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        const gl = native.call(this, type, ...args);
        if (gl && /^(webgl2?|experimental-webgl)$/.test(type) && !seen.has(gl)) {
          seen.add(gl);
          const record = { canvas: this.id || '(unnamed)', type, draws: 0 };
          window.__catalogGpu.contexts.push(record);
          for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
            if (typeof gl[method] !== 'function') continue;
            const draw = gl[method];
            gl[method] = function (...values) { record.draws++; return draw.apply(this, values); };
          }
        }
        return gl;
      };
    });
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await wait(() => window.platform?.module === 'home' && window.catalogUI, null, 120000);
    if (phase === 'portrait') cdp = await context.newCDPSession(page); else cdp = null;
    await raf(12);
    const home = await lifecycle('initial home');
    assert('home starts zero WebGL contexts, model frames, or renderers', home.contexts === 0 && home.draws === 0 &&
      !home.anemoneReady && !home.kukoReady && !home.rabbitStarted && !home.rabbitReady.teacher && !home.rabbitReady.candidate &&
      !home.candidate.runtime && !home.teacher.runtime && !home.candidate.srcdoc && !home.teacher.srcdoc &&
      home.anemoneFrames === 0 && home.candidate.frames === 0 && home.teacher.frames === 0 && !home.errors.length, home);
    await visible(selectors.rabbit, 'Rabbit catalog entry');
    await visible(selectors.anemone, 'Anemone catalog entry');
    const cards = await page.evaluate(({ rabbit, anemone }) => {
      const r = document.querySelector(rabbit), a = document.querySelector(anemone);
      return { rabbitFirst: !!(r.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING),
        text: [r.textContent.trim(), a.textContent.trim()], overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    }, { rabbit: selectors.rabbit, anemone: selectors.anemone });
    assert('catalog shows Rabbit before Anemone without horizontal overflow', cards.rabbitFirst && !cards.overflow, cards);
    await screenshot('home');
  };
  const returnHome = async label => {
    await click(selectors.home, label + ' home');
    await wait(() => platform.module === 'home');
    await raf(3);
    const stopped = await lifecycle(label + ' stopped');
    await raf(12);
    const later = await lifecycle(label + ' remains stopped');
    const clocks = x => ({ draws: x.draws, anemoneFrames: x.anemoneFrames, anemoneTime: x.anemoneTime,
      candidateFrames: x.candidate.frames, teacherFrames: x.teacher.frames, kukoFrames: x.kukoFrames });
    assert(label + ' home stops background drawing and automatic motion', equal(clocks(stopped), clocks(later)) &&
      !later.anemoneOrbit.playing && !later.candidate.orbit?.playing && !later.teacher.orbit?.playing &&
      !later.candidate.pointers && !later.teacher.pointers, { stopped, later });
    return later;
  };

  try {
    for (phase of ['desktop', 'portrait']) {
      await boot();
      await click(selectors.rabbit, 'choose Rabbit');
      await page.evaluate(() => workbench.ensureStarted());
      await wait(() => platform.module === 'rabbit' && workbench.ready.candidate && workbench.frameStats.candidate?.frames >= 2, null, 120000);
      await waitRabbit();
      const selected = await lifecycle('Rabbit first selection');
      assert('choosing Rabbit initializes its candidate only', selected.rabbitStarted && !selected.rabbitReady.teacher && selected.rabbitReady.candidate &&
        !selected.anemoneReady && !selected.kukoReady && !selected.teacher.runtime && !selected.teacher.srcdoc && selected.contexts === 1 &&
        selected.gpu.find(x => x.role === 'candidate').contexts === 1, selected);
      assert('first-screen appearance is outside closed optional drawers', await page.evaluate(() =>
        ['rabbitControlsDrawer', 'rabbitTeacherDrawer'].every(id => !document.getElementById(id).open)));
      for (const [key, label] of [['length', 'length'], ['width', 'mask width'], ['density', 'visual density']]) await visible(selectors[key], label);
      for (const size of [1, 1.5, 2]) await visible(selectors.zoom(size), Math.round(size * 100) + '% zoom');
      await visible('#resetCamera', 'reset camera');
      const colors = await page.locator('[data-rabbit-color]').evaluateAll(buttons => buttons.map(b => b.dataset.rabbitColor));
      assert('named palette offers at least six first-screen colors', colors.length >= 6, colors);
      for (const color of colors) await visible(selectors.palette(color), color + ' palette');
      const canvasLayout = await page.frameLocator('#candidateFrame').locator('#canvasGL').evaluate(c => ({ width: c.clientWidth, height: c.clientHeight }));
      const viewport = page.viewportSize();
      assert('visible adjustments preserve a usable first-screen 3D canvas', canvasLayout.width >= viewport.width * .92 &&
        canvasLayout.height >= Math.max(300, viewport.height * .4), { canvas: canvasLayout, viewport });
      await screenshot('rabbit-first-screen');
      await click('#rabbitTeacherToggle', 'open Teacher on request');
      await wait(() => workbench.ready.teacher && workbench.frameStats.teacher?.frames >= 2 &&
        document.getElementById('rabbitTeacherDrawer').open, null, 120000);
      const teacherLoaded = await lifecycle('Teacher explicitly requested');
      assert('only explicit Teacher action creates its additional WebGL context', teacherLoaded.contexts === 2 && teacherLoaded.teacher.runtime &&
        !teacherLoaded.anemoneReady && !teacherLoaded.kukoReady && teacherLoaded.gpu.find(x => x.role === 'teacher').contexts === 1, teacherLoaded);
      await click('#rabbitTeacherClose', 'close Teacher');
      await wait(() => !document.getElementById('rabbitTeacherDrawer').open);
      await raf(3);
      const baseline = await probe('Rabbit initial');
      const selectedColor = colors.includes('teal') ? 'teal' : colors[colors.length - 1];
      await click(selectors.palette(selectedColor), selectedColor + ' palette');
      await waitRabbit(await page.evaluate(() => ({ furColor: workbench.candidate.furColor })), baseline.frames);
      const colored = await probe('palette actual image');
      assert('first-screen palette changes true pixels and preserves teacher', colored.pixels.hash !== baseline.pixels.hash &&
        !equal(colored.state.furColor, baseline.state.furColor) && equal(colored.teacherState, baseline.teacherState), { before: baseline.pixels, after: colored.pixels });
      const length = await dragRange(selectors.length, .68, 'first-screen length');
      await waitRabbit({ hairLength: length }, colored.frames);
      const lengthened = await probe('length actual image');
      assert('first-screen length controls original hairLength and true pixels', near(lengthened.state.hairLength, length) &&
        lengthened.pixels.hash !== colored.pixels.hash && equal(lengthened.teacherState, baseline.teacherState));
      const width = await dragRange(selectors.width, .78, 'first-screen mask width');
      await waitRabbit({ maskWidth: width }, lengthened.frames);
      const widened = await probe('mask width actual image');
      assert('first-screen mask width changes true pixels and preserves length', near(widened.state.maskWidth, width) &&
        near(widened.state.hairLength, length) && widened.pixels.hash !== lengthened.pixels.hash && equal(widened.teacherState, baseline.teacherState));
      const density = await dragRange(selectors.density, .76, 'first-screen visual density');
      await waitRabbit({ shellTextureSize: Number(density.toFixed(4)), finTextureSize: Number((.7 * density).toFixed(4)) }, widened.frames);
      const dense = await probe('density actual image');
      assert('first-screen density controls original texture repeats and true pixels', near(dense.state.shellTextureSize, density) &&
        near(dense.state.finTextureSize, .7 * density, 1e-4) && dense.pixels.hash !== widened.pixels.hash && equal(dense.teacherState, baseline.teacherState));
      const appearance = Object.fromEntries(Object.entries(dense.state).filter(([key]) => !['angles', 'size'].includes(key)));
      for (const size of [2, 1.5, 1.5, 1, 2, 2, 1]) {
        await click(selectors.zoom(size), Math.round(size * 100) + '% absolute zoom');
        await waitRabbit({ size });
        const zoomed = await probe('absolute zoom ' + size);
        assert('zoom ' + size + ' is absolute and preserves appearance', near(zoomed.state.size, size) &&
          equal(appearance, Object.fromEntries(Object.entries(zoomed.state).filter(([key]) => !['angles', 'size'].includes(key)))), zoomed.state);
      }
      if (phase === 'portrait') {
        const c = await page.frameLocator('#candidateFrame').locator('#canvasGL').boundingBox();
        const at = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
        await page.evaluate(() => {
          const w = document.getElementById('candidateFrame').contentWindow;
          w.__catalogTouchEvents = [];
          w.document.getElementById('canvasGL').addEventListener('pointerdown', e => w.__catalogTouchEvents.push({ trusted: e.isTrusted, type: e.pointerType }));
        });
        const before = await probe('before native pinch');
        const start = [{ id: 41, x: at.x - 40, y: at.y }, { id: 42, x: at.x + 40, y: at.y }];
        await nativeTouch('touchStart', start, 'Rabbit pinch start');
        await wait(() => document.getElementById('candidateFrame').contentWindow.runtime.pointerCount === 2);
        for (let i = 1; i <= 4; ++i) await nativeTouch('touchMove', [
          { ...start[0], x: start[0].x - i * 7 }, { ...start[1], x: start[1].x + i * 7 }
        ], 'Rabbit native pinch spread');
        await nativeTouch('touchEnd', [], 'Rabbit pinch end');
        await wait(() => document.getElementById('candidateFrame').contentWindow.runtime.pointerCount === 0);
        await waitRabbit({}, before.frames);
        const after = await probe('native pinch actual image');
        const touches = await page.evaluate(() => document.getElementById('candidateFrame').contentWindow.__catalogTouchEvents);
        assert('native two-finger pinch still enlarges true Rabbit without rotating', after.state.size > before.state.size + .15 &&
          after.state.angles.every((a, i) => near(a, before.state.angles[i], .01)) && after.pixels.hash !== before.pixels.hash &&
          touches.length >= 2 && touches.every(e => e.trusted && e.type === 'touch'), { before: before.state, after: after.state, touches });
        await click(selectors.zoom(1.5), 'absolute 150% after pinch'); await waitRabbit({ size: 1.5 });
        await click(selectors.zoom(1.5), 'repeat absolute 150% after pinch'); await waitRabbit({ size: 1.5 });
      }
      await click('#resetCamera', 'camera reset'); await waitRabbit({ size: 1, angles: [0, 0] });
      const reset = await probe('native camera reset');
      assert('native reset restores exact edited-appearance image and camera', reset.pixels.hash === dense.pixels.hash &&
        near(reset.state.size, baseline.state.size) && equal(reset.state.angles, baseline.state.angles), { dense: dense.pixels, reset: reset.pixels });
      await screenshot('rabbit-edited-reset');
      await click('#autoRotate', 'automatic orbit before home');
      await wait(() => document.getElementById('candidateFrame').contentWindow.runtime.orbit.playing);
      await wait(angles => workbench.candidate.angles.some((v, i) => Math.abs(v - angles[i]) > .015), reset.state.angles);
      const beforeHome = await page.evaluate(() => ({ ...workbench.candidate }));
      const home = await returnHome('Rabbit');
      await click(selectors.rabbit, 'reopen Rabbit'); await page.evaluate(() => workbench.ensureStarted());
      await waitRabbit();
      const revisited = await lifecycle('Rabbit revisited');
      assert('reopening reuses contexts and keeps edited appearance', revisited.contexts === home.contexts &&
        await page.evaluate(before => ['furColor', 'hairLength', 'maskWidth', 'shellTextureSize', 'finTextureSize'].every(k =>
          JSON.stringify(workbench.candidate[k]) === JSON.stringify(before[k])), beforeHome), { home: home.contexts, reopened: revisited.contexts });
      await returnHome('Rabbit revisit');
      await context.close();
    }

    phase = 'anemone-first';
    await boot();
    const requestsBefore = report.requests.length;
    await click(selectors.anemone, 'choose Anemone first');
    await wait(() => anemone.ready && platform.module === 'anemone', null, 120000);
    const chosen = await lifecycle('Anemone first selection');
    assert('choosing Anemone initializes no Rabbit or KuKo', chosen.anemoneReady && !chosen.kukoReady && !chosen.rabbitStarted &&
      !chosen.candidate.srcdoc && !chosen.teacher.srcdoc && chosen.contexts === 1 && chosen.gpu.find(x => x.role === 'top').contexts === 1, chosen);
    assert('Anemone-first selection requests no Rabbit asset bundle', report.requests.slice(requestsBefore).every(r => !/rabbit.*bundle|bundle.*rabbit/i.test(r.url)), report.requests.slice(requestsBefore));
    const rendered = await page.evaluate(() => ({ pixels: anemone.pixels(), metrics: anemone.metrics(), state: anemone.state }));
    assert('chosen Anemone keeps actual 240-tentacle WebGL rendering', rendered.pixels.glError === 0 && rendered.pixels.changed > 500 && rendered.metrics.tentacles === 240, rendered);
    await wait(time => anemone.state.time > time + .035, rendered.state.time);
    await returnHome('Anemone');
    assert('native portrait input never scrolls or zooms document', report.touchTrace.every(t => t.x === 0 && t.y === 0 && near(t.scale, 1, 1e-4)), report.touchTrace);
    assert('zero JavaScript errors and failed requests', !report.errors.length && !report.requestFailures.length, { errors: report.errors, requestFailures: report.requestFailures });
    if (url.startsWith('file:')) assert('offline catalog and controls need no external network', report.requests.every(r => /^(file:|about:srcdoc$|about:blank$)/.test(r.url)), report.requests);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page && !page.isClosed()) {
      try { await screenshot('failure'); } catch (e) { report.screenshotFailure = String(e); }
      try { await lifecycle('failure'); } catch (e) { report.failureStateError = String(e); }
    }
  } finally {
    if (cdp && activeTouches) try { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); } catch (_) {}
    for (const owned of contexts) try { await owned.close(); } catch (e) { report.cleanupWarning = String(e); }
    report.summary = { passed: report.passed, assertionsPassed: report.tests.filter(t => t.pass).length,
      assertionsFailed: report.tests.filter(t => !t.pass).length, lifecycleChecks: report.lifecycle.length,
      nativeTouchCommands: report.touchTrace.length, screenshots: report.screenshots.length };
    fs.writeFileSync(path.join(outDir, 'catalog-controls-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
};
