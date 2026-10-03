'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Native Chromium rabbit interaction/layout QA, using a caller-owned Playwright
 * browser. Creates its own mobile AND desktop contexts, then closes only those.
 *
 * Usage: await require('./rabbit-controls.cjs')(browser, url, outDir, check)
 * Always assert report.passed: failures (including a throwing check callback)
 * are captured, with screenshots and rabbit-controls-results.json persisted.
 * Does not launch Chromium, install, publish, or dispatch synthetic DOM input.
 * Original-source/module fidelity must be checked independently by the caller.
 */
module.exports = async function rabbitControls(browser, url, outDir, check) {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(), url,
    scope: 'Native Chromium CDP touch inside original rabbit iframe canvas, desktop mouse, compact layout and state QA; not physical iPhone or Safari validation',
    physicalIPhoneTested: false, physicalSafariTested: false,
    visualAcceptance: false, productionReady: false,
    context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    desktopContext: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    tests: [], errors: [], requests: [], requestFailures: [], screenshots: [], layouts: [], touchTrace: [], passed: false
  };
  let context, page, cdp, activeTouches = 0, phase = 'mobile';
  const contexts = [];
  const assert = (name, pass, detail) => {
    const test = { name: 'rabbit ' + phase + ': ' + name, pass: Boolean(pass), detail };
    report.tests.push(test);
    if (check) check(test.name, test.pass, detail);
    if (!test.pass) throw new Error(test.name + ': ' + JSON.stringify(detail));
  };
  const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sameCamera = (a, b) => close(a.size, b.size) && a.angles.every((v, i) => close(v, b.angles[i]));
  const orbitDelta = (a, b) => Math.hypot(...a.angles.map((v, i) => v - b.angles[i]));
  const shape = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['angles', 'size'].includes(key)));
  const settle = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const canvas = (role = 'candidate') => page.frameLocator('#' + role + 'Frame').locator('#canvasGL');
  const probe = async (pixels = false, role = 'candidate') => page.evaluate(({ pixels, role }) => {
    const w = document.getElementById(role + 'Frame').contentWindow, r = w.runtime;
    const result = { role, state: r.state(), frames: r.frameCount, pointerCount: r.pointerCount,
      host: structuredClone(workbench[role === 'teacher' ? 'baseline' : 'candidate']),
      errors: [...workbench.errors, ...(window.platform?.errors || []), ...(window.anemone?.errors || []), ...(window.kuko?.errors || [])] };
    if (pixels) {
      // Drawing immediately before readback avoids a discarded default buffer;
      // tests first await the adapter's own completed frame, never this draw.
      r.renderer.drawScene();
      const c = w.document.getElementById('canvasGL'), gl = w.gl;
      const data = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let hash = 2166136261, changed = 0, minX = c.width, minY = c.height, maxX = -1, maxY = -1;
      const background = Array.from(data.slice(0, 3));
      for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data[i], 16777619) >>> 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.max(Math.abs(background[0] - data[i]), Math.abs(background[1] - data[i + 1]), Math.abs(background[2] - data[i + 2])) <= 12) continue;
        const pixel = i / 4, x = pixel % c.width, y = Math.floor(pixel / c.width);
        changed++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      result.pixels = { hash, changed, width: c.width, height: c.height, background,
        bounds: { minX, minY, maxX, maxY }, glError: gl.getError() };
    }
    return result;
  }, { pixels, role });
  const waitPointers = async (count, role = 'candidate') => page.waitForFunction(({ count, role }) =>
    document.getElementById(role + 'Frame').contentWindow.runtime.pointerCount === count, { count, role });
  const waitCamera = async (expected = null, after = null, role = 'candidate') => {
    await page.waitForFunction(({ expected, after, role }) => {
      const w = document.getElementById(role + 'Frame').contentWindow, r = w.runtime;
      const s = r.state(), h = workbench[role === 'teacher' ? 'baseline' : 'candidate'];
      const same = (a, b) => Math.abs(a.size - b.size) < 1e-9 && a.angles.every((v, i) => Math.abs(v - b.angles[i]) < 1e-9);
      return same(s, h) && (!expected || same(s, expected)) &&
        (after === null || (r.frameCount > after && (workbench.frameStats[role]?.frames || 0) >= r.frameCount));
    }, { expected, after, role });
  };
  const waitState = async (expected, after = null, role = 'candidate') => {
    await page.waitForFunction(({ expected, after, role }) => {
      const r = document.getElementById(role + 'Frame').contentWindow.runtime, s = r.state();
      const h = workbench[role === 'teacher' ? 'baseline' : 'candidate'];
      const matches = actual => Object.entries(expected).every(([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value));
      return matches(s) && matches(h) && (after === null ||
        (r.frameCount > after && (workbench.frameStats[role]?.frames || 0) >= r.frameCount));
    }, { expected, after, role });
  };
  const immutable = (name, before, after) => assert(name, equal(shape(before.state), shape(after.state)),
    { before: shape(before.state), after: shape(after.state) });
  const screenshot = async (name, role = null) => {
    const file = path.join(outDir, 'rabbit-' + name + '.png');
    if (role) await canvas(role).screenshot({ path: file });
    else await page.screenshot({ path: file, fullPage: false });
    report.screenshots.push({ name, path: file, type: role ? role + '-canvas' : 'first-screen' });
  };
  const touch = async (type, points, label) => {
    // CDP needs TOP-LEVEL CSS viewport coordinates. Playwright's iframe canvas
    // boundingBox below includes its ancestors; device pixels must not be used.
    await cdp.send('Input.dispatchTouchEvent', { type,
      touchPoints: points.map(point => ({ radiusX: 5, radiusY: 5, force: 1, ...point })) });
    if (type === 'touchCancel' || (type === 'touchEnd' && !points.length)) activeTouches = 0;
    else if (type !== 'touchEnd') activeTouches = points.length;
    await settle();
    report.touchTrace.push({ label, type, points: points.map(point => ({ ...point })), ...await page.evaluate(() => {
      const w = document.getElementById('candidateFrame').contentWindow;
      return { pointerCount: w.runtime.pointerCount, scrollX, scrollY, viewportScale: visualViewport?.scale || 1,
        iframeScrollX: w.scrollX, iframeScrollY: w.scrollY };
    }) });
  };
  const reveal = async selector => {
    const target = page.locator(selector);
    // Opening a <details> through its real summary keeps optional original
    // controls reachable without assigning DOM values or firing fake events.
    for (let attempt = 0; attempt < 8; attempt++) {
      const closed = await target.evaluate(el => {
        const ancestors = []; for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) ancestors.unshift(p);
        if (!ancestors.length) return null;
        const summaries = [...document.querySelectorAll('details > summary')];
        return summaries.indexOf(ancestors[0].querySelector(':scope > summary'));
      });
      if (closed === null) break;
      const summary = page.locator('details > summary').nth(closed);
      await summary.scrollIntoViewIfNeeded();
      if (phase === 'mobile') await tapLocator(summary, 'open original controls section');
      else await summary.click();
    }
    await target.scrollIntoViewIfNeeded();
    await settle();
    return target;
  };
  const tapLocator = async (target, label) => {
    await target.waitFor({ state: 'visible' });
    const box = await target.boundingBox();
    if (!box?.width || !box?.height) throw new Error('No touch bounds for ' + label);
    const point = { id: 7, x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const hit = await target.evaluate((el, point) => {
      const top = document.elementFromPoint(point.x, point.y);
      return point.x >= 0 && point.x < innerWidth && point.y >= 0 && point.y < innerHeight && (top === el || el.contains(top));
    }, point);
    assert(label + ' native target is visible and unobstructed', hit, { box, point });
    await touch('touchStart', [point], label + ' down');
    await touch('touchEnd', [], label + ' up');
  };
  const tap = async (selector, label) => tapLocator(await reveal(selector), label);
  const center = async (role = 'candidate') => {
    const box = await canvas(role).boundingBox();
    if (!box?.width || !box?.height) throw new Error(role + ' iframe canvas has no bounds');
    const point = { x: Math.round(box.x + box.width * .5), y: Math.round(box.y + box.height * .5) };
    assert(role + ' canvas receives top-level native input', await page.evaluate(({ role, point }) => {
      const f = document.getElementById(role + 'Frame'), top = document.elementFromPoint(point.x, point.y);
      const rect = f.getBoundingClientRect(), inner = f.contentDocument.elementFromPoint(point.x - rect.x, point.y - rect.y);
      return top === f && inner?.id === 'canvasGL';
    }, { role, point }), { box, point });
    return point;
  };
  const orbit = async (label, dx = 42, dy = 20, role = 'candidate') => {
    const at = await center(role), before = await probe(false, role);
    await touch('touchStart', [{ id: 11, ...at }], label + ' start');
    await waitPointers(1, role);
    for (let i = 1; i <= 4; ++i) await touch('touchMove', [{ id: 11, x: at.x + dx * i / 4, y: at.y + dy * i / 4 }], label + ' move ' + i);
    await touch('touchEnd', [], label + ' end');
    await waitPointers(0, role); await waitCamera(null, before.frames, role);
    const after = await probe(false, role);
    assert(label + ' changes orbit without changing zoom', orbitDelta(before.state, after.state) > .025 && close(before.state.size, after.state.size),
      { before: before.state, after: after.state });
    immutable(label + ' preserves original material and shape parameters', before, after);
    return after;
  };
  const layout = async (name, width, height) => {
    if (width && height) await page.setViewportSize({ width, height });
    await page.waitForFunction(() => {
      const f = document.getElementById('candidateFrame'), r = f.contentWindow.runtime, c = f.contentDocument.getElementById('canvasGL');
      const stats = workbench.frameStats.candidate;
      const gl = f.contentWindow.gl, limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
      const dpr = Math.min(devicePixelRatio, limit / Math.max(1, c.clientWidth, c.clientHeight));
      return c.clientWidth > 0 && c.clientHeight > 0 && c.width === Math.round(c.clientWidth * dpr) && c.height === Math.round(c.clientHeight * dpr) &&
        stats?.width === c.width && stats?.height === c.height && stats.frames >= r.frameCount;
    });
    await settle();
    const l = await page.evaluate(() => {
      const f = document.getElementById('candidateFrame'), w = f.contentWindow, c = w.document.getElementById('canvasGL');
      const gl = w.gl, limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
      const effectiveDpr = Math.min(devicePixelRatio, limit / Math.max(1, c.clientWidth, c.clientHeight));
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
      const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('dialog:not([open])');
      return { module: platform.module, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scale: visualViewport?.scale || 1 },
        iframe: rect(f), canvas: { ...rect(c), backingWidth: c.width, backingHeight: c.height, effectiveDpr, clientWidth: c.clientWidth, clientHeight: c.clientHeight, touchAction: w.getComputedStyle(c).touchAction },
        overflow: { x: document.documentElement.scrollWidth > innerWidth + 1, y: document.documentElement.scrollHeight > innerHeight + 1, scrollX, scrollY,
          iframeX: w.document.documentElement.scrollWidth > w.innerWidth + 1, iframeY: w.document.documentElement.scrollHeight > w.innerHeight + 1 },
        teacherVisible: visible(document.getElementById('teacherFrame')),
        drawers: ['rabbitTeacherDrawer', 'rabbitControlsDrawer'].map(id => ({ id, exists: document.getElementById(id) instanceof HTMLDialogElement, open: !!document.getElementById(id)?.open })),
        controls: ['resetCamera', 'orbitButton', 'combButton', 'resetCombButton', 'rabbitMacro', 'rabbitTeacherToggle', 'rabbitControlsToggle'].map(id => {
          const el = document.getElementById(id); return { id, visible: visible(el), bounds: el ? rect(el) : null };
        }) };
    });
    report.layouts.push({ name, ...l });
    const landscape = l.viewport.width > l.viewport.height;
    assert(name + ' candidate fills first screen', l.module === 'rabbit' && l.iframe.top >= -1 && l.iframe.top <= 95 &&
      l.iframe.bottom <= l.viewport.height + 1 && l.iframe.left >= -1 && l.iframe.right <= l.viewport.width + 1 &&
      l.iframe.width >= (landscape ? Math.max(300, l.viewport.width * .5) : l.viewport.width * .92) &&
      l.iframe.height >= (landscape ? l.viewport.height * .45 : Math.max(300, l.viewport.height * .4)), l);
    assert(name + ' no document or iframe overflow', !Object.values(l.overflow).some(Boolean) && close(l.viewport.scale, 1, 1e-4), l.overflow);
    assert(name + ' teacher and optional controls initially hidden', !l.teacherVisible && l.drawers.every(d => d.exists && !d.open), l);
    assert(name + ' primary actions stay in first screen', l.controls.every(c => c.visible && c.bounds.top >= -1 && c.bounds.bottom <= l.viewport.height + 1 &&
      c.bounds.left >= -1 && c.bounds.right <= l.viewport.width + 1), l.controls);
    assert(name + ' original canvas stays full-size and owns touch', l.canvas.touchAction === 'none' &&
      close(l.canvas.width, l.iframe.width, 1) && close(l.canvas.height, l.iframe.height, 1) &&
      l.canvas.backingWidth === Math.round(l.canvas.clientWidth * l.canvas.effectiveDpr) &&
      l.canvas.backingHeight === Math.round(l.canvas.clientHeight * l.canvas.effectiveDpr), l.canvas);
    assert(name + ' requested real browser DPR', close(l.viewport.dpr, phase === 'mobile' ? 2 : 1), l.viewport);
    const frame = await probe(true);
    assert(name + ' real nonempty original WebGL render and zero application errors', frame.pixels.glError === 0 && frame.pixels.changed > 500 && !frame.errors.length,
      { pixels: frame.pixels, errors: frame.errors });
    await screenshot(name);
    return frame;
  };
  const drawer = async (kind, open) => {
    await tap('#rabbit' + kind + (open ? 'Toggle' : 'Close'), kind.toLowerCase() + (open ? ' open' : ' close'));
    await page.waitForFunction(({ kind, open }) => document.getElementById('rabbit' + kind + 'Drawer').open === open, { kind, open });
    assert(kind.toLowerCase() + ' dialog ' + (open ? 'opens' : 'closes'), await page.locator('#rabbit' + kind + 'Drawer').evaluate((d, open) =>
      d instanceof HTMLDialogElement && d.open === open, open));
    await waitPointers(0);
    if (kind === 'Teacher' && open) await page.waitForFunction(() => {
      const f = document.getElementById('teacherFrame'), c = f.contentDocument.getElementById('canvasGL'), w = f.contentWindow, gl = w.gl;
      const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
      const dpr = Math.min(devicePixelRatio, limit / Math.max(1, c.clientWidth, c.clientHeight));
      const stats = workbench.frameStats.teacher;
      return c.clientWidth > 0 && c.clientHeight > 0 && c.width === Math.round(c.clientWidth * dpr) && c.height === Math.round(c.clientHeight * dpr) &&
        stats?.width === c.width && stats?.height === c.height && stats.frames >= w.runtime.frameCount;
    });
  };
  const dragRange = async (selector, fraction, label) => {
    const input = await reveal(selector);
    const initial = await input.evaluate(el => {
      el.__rabbitNativeInputs = [];
      el.addEventListener('input', event => el.__rabbitNativeInputs.push({ trusted: event.isTrusted, value: Number(el.value) }), { passive: true });
      const b = el.getBoundingClientRect();
      return { type: el.type, min: Number(el.min), max: Number(el.max), value: Number(el.value),
        thumb: parseFloat(getComputedStyle(el, '::-webkit-slider-thumb').width) || 20, x: b.x, y: b.y, width: b.width, height: b.height };
    });
    assert(label + ' native range visible', initial.type === 'range' && initial.width > 60 && initial.max > initial.min, initial);
    // New compact controls use 20px thumbs; computed pseudo-element width may
    // report the track on Chromium, so guard against that browser quirk.
    const inset = initial.thumb > 0 && initial.thumb < 40 ? initial.thumb / 2 : 10;
    const travel = initial.width - inset * 2, y = initial.y + initial.height / 2;
    const fromX = initial.x + inset + travel * (initial.value - initial.min) / (initial.max - initial.min);
    const toX = initial.x + inset + travel * fraction;
    assert(label + ' thumb is unobstructed', await input.evaluate((el, p) => document.elementFromPoint(p.x, p.y) === el, { x: fromX, y }), { fromX, toX, y });
    await touch('touchStart', [{ id: 31, x: fromX, y }], label + ' down');
    for (let i = 1; i <= 4; ++i) await touch('touchMove', [{ id: 31, x: fromX + (toX - fromX) * i / 4, y }], label + ' move ' + i);
    await touch('touchEnd', [], label + ' up');
    const final = await input.evaluate(el => ({ value: Number(el.value), events: el.__rabbitNativeInputs }));
    const expected = initial.min + (initial.max - initial.min) * fraction;
    assert(label + ' changes through trusted native input', Math.abs(final.value - initial.value) > (initial.max - initial.min) * .08 &&
      Math.abs(final.value - expected) <= (initial.max - initial.min) * .05 && final.events.length >= 2 && final.events.every(e => e.trusted),
      { initial, expected, final });
    return final.value;
  };
  const normalBuffers = async role => canvas(role).evaluate(c => {
    const w = c.ownerDocument.defaultView, gl = w.gl, renderer = w.runtime.renderer, model = renderer.models.get(renderer.currentPreset.mesh);
    const previous = gl.getParameter(gl.COPY_READ_BUFFER_BINDING), result = {};
    for (const name of ['bufferNormals', 'bufferCombNormals', 'finBufferNormals', 'finBufferCombedNormals']) {
      gl.bindBuffer(gl.COPY_READ_BUFFER, model[name]);
      const data = new Uint8Array(gl.getBufferParameter(gl.COPY_READ_BUFFER, gl.BUFFER_SIZE));
      gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, data);
      let hash = 2166136261; for (const v of data) hash = Math.imul(hash ^ v, 16777619) >>> 0;
      result[name] = { bytes: data.length, hash };
    }
    gl.bindBuffer(gl.COPY_READ_BUFFER, previous);
    return { buffers: result, glError: gl.getError() };
  });
  const boot = async options => {
    context = await browser.newContext(options); contexts.push(context);
    page = await context.newPage(); page.setDefaultTimeout(25000);
    const sourcePhase = phase;
    page.on('pageerror', error => report.errors.push({ phase: sourcePhase, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ phase: sourcePhase, message: message.text() }); });
    page.on('request', request => { if (!/^(data|blob):/.test(request.url())) report.requests.push(request.url()); });
    page.on('requestfailed', request => report.requestFailures.push({ phase: sourcePhase, url: request.url(), error: request.failure()?.errorText }));
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.platform?.module === 'home' && window.catalogUI, null, { timeout: 120000 });
    await page.evaluate(async () => { platform.select('rabbit'); await workbench.ensureStarted(); await workbench.ensureTeacher(); });
    await page.waitForFunction(() => window.workbench?.ready.teacher && workbench.ready.candidate && window.platform?.select &&
      window.rabbitUI && typeof rabbitUI.clearPointers === 'function' && typeof rabbitUI.sync === 'function' &&
      ['teacher', 'candidate'].every(role => {
        const r = document.getElementById(role + 'Frame')?.contentWindow?.runtime;
        return r?.renderer.loaded && typeof r.pointerCount === 'number' && typeof r.clearPointers === 'function';
      }), null, { timeout: 120000 });
    await page.waitForFunction(() => platform.module === 'rabbit' && workbench.frameStats.candidate?.frames >= 2);
    await waitState(await page.evaluate(() => workbench.candidate));
    await page.evaluate(() => {
      for (const role of ['teacher', 'candidate']) {
        const w = document.getElementById(role + 'Frame').contentWindow;
        w.__rabbitQaPointerEvents = [];
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) w.document.getElementById('canvasGL').addEventListener(type, e =>
          w.__rabbitQaPointerEvents.push({ type, trusted: e.isTrusted, pointerType: e.pointerType, pointerId: e.pointerId, x: e.clientX, y: e.clientY }), { passive: true });
      }
    });
    if (phase === 'mobile') cdp = await context.newCDPSession(page);
  };

  try {
    await boot(report.context);
    const baseline = await layout('portrait-390x844'), teacherBaseline = await probe(false, 'teacher');
    report.baseline = { candidate: baseline.state, teacher: teacherBaseline.state, pixels: baseline.pixels };
    assert('baseline rabbit original parameters match teacher with explicit candidate-only side lights', baseline.state.mesh === 'rabbit' && equal({ ...baseline.state, lighting: undefined }, { ...teacherBaseline.state, lighting: undefined }) && baseline.state.lighting.mode === 'side' && teacherBaseline.state.lighting.mode === 'legacy', report.baseline);
    assert('original advanced controls remain in dialog and common appearance is first-screen', await page.evaluate(() => {
      const d = document.getElementById('rabbitControlsDrawer');
      const keys = ['layers', 'curlyness', 'shellTextureSize', 'finTextureSize', 'persistence', 'lacunarity',
        'lightX', 'lightY', 'lightZ', 'lightIntensity', 'ambientStrength', 'diffusePower', 'specularPower', 'combRadius'];
      return keys.every(key => ['range-', 'number-'].every(prefix => d.contains(document.getElementById(prefix + key)))) &&
        ['renderFur', 'renderFins', 'renderShells', 'finOpacity', 'proceduralText'].every(key => d.contains(document.getElementById('toggle-' + key))) &&
        ['resetAll', 'sourceReset'].every(id => d.contains(document.getElementById(id))) &&
        ['range-hairLength', 'number-hairLength', 'furColor', 'rabbitMaskWidth', 'rabbitVisualDensity'].every(id =>
          document.getElementById('rabbitQuickPanel').contains(document.getElementById(id)));
    }));
    await orbit('single-finger orbit');
    await screenshot('mobile-orbit', 'candidate');
    const at = await center(), beforePinch = await probe();
    const start = [{ id: 21, x: at.x - 45, y: at.y }, { id: 22, x: at.x + 45, y: at.y }];
    await touch('touchStart', start, 'pinch start'); await waitPointers(2);
    assert('second finger causes no camera jump', sameCamera(beforePinch.state, (await probe()).state));
    let stretched;
    for (let i = 1; i <= 4; i++) {
      const spread = 45 + i * 7;
      stretched = [{ id: 21, x: at.x - spread, y: at.y }, { id: 22, x: at.x + spread, y: at.y }];
      await touch('touchMove', stretched, 'pinch spread ' + i);
    }
    await waitCamera(null, beforePinch.frames);
    const zoomed = await probe();
    assert('two-finger spread enlarges original rabbit without orbit', zoomed.state.size > beforePinch.state.size + .15 && orbitDelta(zoomed.state, beforePinch.state) < .01,
      { before: beforePinch.state, after: zoomed.state });
    immutable('pinch preserves shape and material', beforePinch, zoomed);
    await screenshot('mobile-pinch', 'candidate');

    // Chromium has two native CDP backends for a partial release. Do not replace
    // this with DOM PointerEvents: observe which real backend is in use.
    await touch('touchMove', [stretched[0]], 'lift second contact / active list');
    if ((await probe()).pointerCount === 2) {
      await touch('touchEnd', [stretched[1]], 'lift second contact / WebTouchEvent');
      activeTouches = 1; report.partialLiftBackend = 'WebTouchEvent released ID';
    } else report.partialLiftBackend = 'SyntheticPointerActions active list';
    await waitPointers(1);
    const lifted = await probe();
    assert('two-to-one transition has no camera jump', sameCamera(zoomed.state, lifted.state), { before: zoomed.state, after: lifted.state });
    await touch('touchMove', [{ ...stretched[0], x: stretched[0].x + 3, y: stretched[0].y + 2 }], 'remaining finger continuation');
    await waitCamera(null, lifted.frames);
    const continued = await probe(), delta = orbitDelta(lifted.state, continued.state);
    assert('remaining finger resumes without stale-anchor jump', delta > .0001 && delta < .15 && close(lifted.state.size, continued.state.size),
      { delta, before: lifted.state, after: continued.state });
    await touch('touchEnd', [], 'remaining finger end'); await waitPointers(0);
    await touch('touchStart', start, 'cancel start'); await waitPointers(2);
    const beforeCancel = await probe();
    await touch('touchCancel', [], 'cancel both contacts'); await waitPointers(0);
    assert('cancel preserves camera and clears contacts', sameCamera(beforeCancel.state, (await probe()).state));
    await orbit('fresh orbit after cancel', -30, 15);

    // Directly test the public clear hook while native contacts are alive, then
    // cancel those contacts at the browser too before starting another gesture.
    await touch('touchStart', [{ id: 41, ...at }], 'public clear hook start'); await waitPointers(1);
    const beforeClear = await probe();
    await page.evaluate(() => rabbitUI.clearPointers()); await waitPointers(0); await waitPointers(0, 'teacher');
    assert('public clearPointers preserves camera', sameCamera(beforeClear.state, (await probe()).state));
    await touch('touchCancel', [], 'release browser contacts after clear hook');
    await tap('#resetCamera', 'camera reset');
    await waitCamera(baseline.state, beforeClear.frames);
    const reset = await probe(true);
    assert('camera reset restores exact original image', sameCamera(baseline.state, reset.state) && baseline.pixels.hash === reset.pixels.hash,
      { baseline: baseline.pixels, reset: reset.pixels });
    immutable('camera reset leaves original parameters intact', baseline, reset);

    await drawer('Teacher', true);
    await waitCamera(reset.state, null, 'teacher');
    await page.waitForFunction(() => workbench.frameStats.teacher?.frames > 0);
    assert('teacher iframe is visible only inside its open native dialog', await page.locator('#teacherFrame').isVisible() &&
      await page.locator('#teacherFrame').evaluate(f => !!f.closest('#rabbitTeacherDrawer[open]')));
    const teacherOpen = await probe(true, 'teacher');
    assert('visible teacher uses same camera and original parameter baseline', sameCamera(reset.state, teacherOpen.state) &&
      equal(shape(teacherBaseline.state), shape(teacherOpen.state)) && teacherOpen.pixels.changed > 500 && teacherOpen.pixels.glError === 0, teacherOpen);
    await screenshot('teacher-drawer');
    await orbit('teacher touch synchronizes candidate', 25, -10, 'teacher');
    await waitCamera((await probe(false, 'teacher')).state);
    assert('teacher orbit reaches candidate', sameCamera((await probe(false, 'teacher')).state, (await probe()).state));
    await drawer('Teacher', false);
    assert('teacher hides after close', !(await page.locator('#teacherFrame').isVisible()));
    await orbit('candidate after teacher close', -23, 14);
    await drawer('Teacher', true); await waitCamera((await probe()).state, null, 'teacher');
    const reopened = await probe(false, 'teacher');
    assert('reopened teacher catches current camera and keeps original shape', sameCamera((await probe()).state, reopened.state) &&
      equal(shape(teacherBaseline.state), shape(reopened.state)), reopened);
    await drawer('Teacher', false);
    await page.evaluate(() => workbench.setView(false));
    await page.waitForFunction(() => document.getElementById('rabbitTeacherDrawer').open);
    await page.evaluate(() => workbench.setView(true));
    await page.waitForFunction(() => !document.getElementById('rabbitTeacherDrawer').open);
    assert('legacy setView API controls teacher without losing candidate', await canvas().isVisible());

    await tap('#rabbitMacro', 'macro view'); await waitCamera({ angles: (await probe()).state.angles, size: 1.65 });
    assert('macro sets original renderer scale to 1.65', close((await probe()).state.size, 1.65));
    await drawer('Controls', true);
    const rangeBaseline = await probe(true), saved = await page.evaluate(() => JSON.parse(JSON.stringify(workbench.exportState())));
    assert('zoom slider has original scale limits and current value', await page.locator('#rabbitZoom').evaluate(el =>
      el.type === 'range' && Number(el.min) === .3 && Number(el.max) === 2.5 && Math.abs(Number(el.value) - workbench.candidate.size) < 1e-9));
    const zoom = await dragRange('#rabbitZoom', .35, 'zoom range');
    await waitCamera({ size: zoom, angles: rangeBaseline.state.angles }, rangeBaseline.frames);
    const afterZoom = await probe(true);
    assert('zoom range updates original frame and image', close(afterZoom.state.size, zoom) && afterZoom.pixels.hash !== rangeBaseline.pixels.hash,
      { zoom, state: afterZoom.state, pixels: afterZoom.pixels });
    immutable('zoom slider preserves original shape', rangeBaseline, afterZoom);
    await drawer('Controls', false);
    const hair = await dragRange('#range-hairLength', .7, 'original hair-length range');
    await waitState({ hairLength: hair }, afterZoom.frames);
    const altered = await probe(true);
    assert('native adjustment changes candidate hair and rendered frame', close(altered.state.hairLength, hair) && altered.pixels.hash !== afterZoom.pixels.hash, altered);
    await waitState({ hairLength: teacherBaseline.state.hairLength }, null, 'teacher');
    assert('parameter edit never changes original teacher shape', equal(shape(teacherBaseline.state), shape((await probe(false, 'teacher')).state)));
    await screenshot('native-range-controls');
    const editedExport = await page.evaluate(() => JSON.parse(JSON.stringify(workbench.exportState())));
    const beforeImportFrames = altered.frames;
    await drawer('Controls', true);
    const immediate = await page.evaluate(async saved => {
      await workbench.importState(saved);
      return { open: document.getElementById('rabbitControlsDrawer').open,
        zoom: Number(document.getElementById('rabbitZoom').value), hair: Number(document.getElementById('range-hairLength').value),
        candidate: structuredClone(workbench.candidate), exported: workbench.exportState() };
    }, saved);
    assert('JSON import immediately synchronizes open controls', immediate.open && close(immediate.zoom, saved.state.size) &&
      close(immediate.hair, saved.state.hairLength) && equal(immediate.candidate, { ...saved.state, lighting: saved.lighting }) && equal(immediate.exported, saved), immediate);
    await waitState(saved.state, beforeImportFrames);
    const restored = await probe(true);
    assert('JSON roundtrip restores exact original renderer image', restored.pixels.hash === rangeBaseline.pixels.hash,
      { saved: rangeBaseline.pixels, restored: restored.pixels });
    await page.evaluate(async data => { await workbench.importState(data); }, editedExport);
    await waitState(editedExport.state, restored.frames);
    assert('edited JSON values survive a real serialization roundtrip', equal((await page.evaluate(() => workbench.exportState())), editedExport));
    await page.evaluate(async data => { await workbench.importState(data); }, saved); await waitState(saved.state);
    await drawer('Controls', false);
    await tap('#resetCamera', 'reset before native comb'); await waitCamera(baseline.state);

    const beforeComb = await normalBuffers('candidate'), teacherNormals = await normalBuffers('teacher');
    await tap('#combButton', 'enable original GPU comb');
    await page.waitForFunction(() => document.getElementById('combButton').classList.contains('active'));
    const combAt = await center(), combBefore = await probe();
    await touch('touchStart', [{ id: 51, ...combAt }], 'comb start'); await waitPointers(1);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [{ id: 51, x: combAt.x + i * 8, y: combAt.y + i * 3 }], 'comb stroke ' + i);
    await touch('touchEnd', [], 'comb end'); await waitPointers(0);
    await page.waitForFunction(frames => document.getElementById('candidateFrame').contentWindow.runtime.frameCount > frames, combBefore.frames);
    const combed = await normalBuffers('candidate'), combAfter = await probe();
    assert('comb uses original GPU normals and does not orbit', combed.glError === 0 && sameCamera(combBefore.state, combAfter.state) &&
      (!equal(beforeComb.buffers.bufferCombNormals, combed.buffers.bufferCombNormals) ||
       !equal(beforeComb.buffers.finBufferCombedNormals, combed.buffers.finBufferCombedNormals)), { beforeComb, combed });
    assert('comb leaves teacher GPU normals unchanged', equal(teacherNormals, await normalBuffers('teacher')));
    await screenshot('native-comb', 'candidate');
    await tap('#resetCombButton', 'restore original comb directions');
    await page.waitForFunction(frames => document.getElementById('candidateFrame').contentWindow.runtime.frameCount > frames, combAfter.frames);
    const uncombed = await normalBuffers('candidate');
    assert('reset comb exactly restores both original GPU normal buffers', uncombed.glError === 0 &&
      equal(uncombed.buffers.bufferCombNormals, uncombed.buffers.bufferNormals) &&
      equal(uncombed.buffers.finBufferCombedNormals, uncombed.buffers.finBufferNormals), uncombed);
    await tap('#orbitButton', 'restore orbit mode');
    await orbit('orbit resumes after GPU comb reset', 21, -9);
    await tap('#resetCamera', 'reset before landscape'); await waitCamera(baseline.state);
    await layout('landscape-844x390', 844, 390);
    await orbit('landscape orbit', 25, 9);
    await tap('#resetCamera', 'landscape reset'); await waitCamera(baseline.state);
    const finalMobile = await layout('portrait-restored-390x844', 390, 844);
    assert('portrait restoration preserves original camera and pixels', sameCamera(baseline.state, finalMobile.state) &&
      baseline.pixels.hash === finalMobile.pixels.hash, { baseline: baseline.pixels, final: finalMobile.pixels });
    immutable('complete mobile interaction suite preserves original shape after restoration', baseline, finalMobile);
    const events = await page.evaluate(() => ['teacher', 'candidate'].flatMap(role =>
      document.getElementById(role + 'Frame').contentWindow.__rabbitQaPointerEvents.map(e => ({ role, ...e }))));
    report.pointerEvents = events;
    assert('iframe gestures are trusted native touch PointerEvents', events.length > 0 && events.every(e => e.trusted && e.pointerType === 'touch') &&
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].every(type => events.some(e => e.type === type)),
      { count: events.length, types: [...new Set(events.map(e => e.type))] });
    assert('native touch never scrolls or zooms either document', report.touchTrace.every(t => !t.scrollX && !t.scrollY && !t.iframeScrollX && !t.iframeScrollY && close(t.viewportScale, 1, 1e-4)));

    // A separate non-mobile context catches mouse regressions. Resizing the
    // touch context does not constitute a desktop mouse test.
    cdp = null; phase = 'desktop';
    await boot(report.desktopContext);
    const desktopBaseline = await layout('desktop-1440x1000');
    const mouseAt = await center(), mouseBefore = await probe();
    await page.mouse.move(mouseAt.x, mouseAt.y); await page.mouse.down(); await waitPointers(1);
    await page.mouse.move(mouseAt.x + 70, mouseAt.y + 30, { steps: 5 });
    await page.mouse.up(); await waitPointers(0); await waitCamera(null, mouseBefore.frames);
    const mouseAfter = await probe();
    assert('native desktop mouse orbit changes only camera angles', orbitDelta(mouseBefore.state, mouseAfter.state) > .025 && close(mouseBefore.state.size, mouseAfter.state.size),
      { before: mouseBefore.state, after: mouseAfter.state });
    immutable('desktop orbit keeps shape parameters', mouseBefore, mouseAfter);
    await page.mouse.wheel(0, -180); await page.waitForFunction(size => workbench.candidate.size > size + .1, mouseAfter.state.size);
    await waitCamera(null, mouseAfter.frames);
    const wheelAfter = await probe();
    assert('native desktop wheel zoom changes only original scale', wheelAfter.state.size > mouseAfter.state.size + .1 && orbitDelta(mouseAfter.state, wheelAfter.state) < 1e-9,
      { before: mouseAfter.state, after: wheelAfter.state });
    immutable('desktop wheel keeps shape parameters', mouseAfter, wheelAfter);
    await page.locator('#resetCamera').click(); await waitCamera(desktopBaseline.state, wheelAfter.frames);
    const desktopReset = await probe(true);
    assert('desktop reset restores exact original image', desktopReset.pixels.hash === desktopBaseline.pixels.hash,
      { before: desktopBaseline.pixels, reset: desktopReset.pixels });
    const mouseEvents = await page.evaluate(() => document.getElementById('candidateFrame').contentWindow.__rabbitQaPointerEvents);
    report.mouseEvents = mouseEvents;
    assert('desktop input is trusted native mouse input', mouseEvents.length > 0 && mouseEvents.every(e => e.trusted && e.pointerType === 'mouse'));
    await screenshot('desktop-reset');
    assert('zero JavaScript, WebGL, and failed-request errors', !report.errors.length && !finalMobile.errors.length && !desktopReset.errors.length &&
      !report.requestFailures.length && desktopReset.pixels.glError === 0,
      { console: report.errors, mobile: finalMobile.errors, desktop: desktopReset.errors, failedRequests: report.requestFailures });
    if (url.startsWith('file:')) assert('standalone rabbit requires no external network',
      report.requests.every(u => u.startsWith('file:') || u === 'about:srcdoc' || u === 'about:blank'), report.requests);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page && !page.isClosed()) {
      try { await screenshot(phase + '-failure'); } catch (e) { report.screenshotFailure = String(e); }
      try { report.failureState = await probe(); } catch (e) { report.probeFailure = String(e); }
    }
  } finally {
    if (cdp && activeTouches) {
      try { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); }
      catch (error) { report.cleanupWarning = String(error); }
    }
    for (const owned of contexts) {
      try { await owned.close(); } catch (error) { report.cleanupWarning = String(error); }
    }
    report.summary = { passed: report.passed, assertionsPassed: report.tests.filter(t => t.pass).length,
      assertionsFailed: report.tests.filter(t => !t.pass).length, layoutsChecked: report.layouts.map(l => l.name),
      touchCommands: report.touchTrace.length, screenshots: report.screenshots.length };
    fs.writeFileSync(path.join(outDir, 'rabbit-controls-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
};
