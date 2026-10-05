'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Native Chromium touch/layout QA. Uses a caller-owned Playwright browser and a
 * fresh mobile context, never a desktop page resized and called an iPhone test.
 *
 * The optional check(name, pass, detail) receives each assertion. Its exceptions
 * are recorded in the returned report; callers must also assert report.passed.
 * Evidence is persisted even on failure. This module never launches a browser,
 * installs packages, publishes, or substitutes DOM-dispatched PointerEvents.
 */
module.exports = async function mobileControls(browser, url, outDir, check) {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    scope: 'Chromium touch emulation through CDP Input.dispatchTouchEvent; not physical iPhone or Safari validation',
    physicalIPhoneTested: false,
    physicalSafariTested: false,
    visualAcceptance: false,
    productionReady: false,
    url,
    context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    tests: [], errors: [], requests: [], requestFailures: [], screenshots: [], layouts: [], touchTrace: [],
    passed: false
  };
  let context, page, cdp, activeTouches = 0;
  const assert = (name, pass, detail) => {
    const test = { name: 'mobile touch: ' + name, pass: Boolean(pass), detail };
    report.tests.push(test);
    if (check) check(test.name, test.pass, detail);
    if (!test.pass) throw new Error(test.name + ': ' + JSON.stringify(detail));
  };
  const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;
  const sameCamera = (a, b) => ['azimuth', 'elevation', 'distance'].every(k => close(a[k], b[k], 1e-12));
  const orbitDifference = (a, b) => Math.hypot(a.azimuth - b.azimuth, a.elevation - b.elevation);
  const settle = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const probe = async (withPixels = false) => page.evaluate(withPixels => {
    const a = window.anemone, renderer = a.renderer;
    if (withPixels) a.redraw();
    let hash = 2166136261;
    const data = renderer.data;
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
    const state = a.state;
    return {
      camera: state.camera, time: state.time, paused: state.params.paused,
      params: state.params, material: state.material,
      geometryHash: hash, geometryBytes: bytes.byteLength,
      pointerCount: a.pointerCount,
      metrics: a.metrics(), pixels: withPixels ? a.pixels() : null,
      errors: [...a.errors, ...(window.platform?.errors || []), ...(window.workbench?.errors || []), ...(window.kuko?.errors || [])],
      scroll: { x: scrollX, y: scrollY, scale: visualViewport?.scale || 1 }
    };
  }, withPixels);
  const immutable = (name, before, after) => assert(name, before.paused && after.paused &&
    before.time === after.time && before.geometryHash === after.geometryHash && before.geometryBytes === after.geometryBytes &&
    JSON.stringify(before.params) === JSON.stringify(after.params) && JSON.stringify(before.material) === JSON.stringify(after.material),
  { before: { time: before.time, geometryHash: before.geometryHash, geometryBytes: before.geometryBytes },
    after: { time: after.time, geometryHash: after.geometryHash, geometryBytes: after.geometryBytes } });
  const touch = async (type, points, label) => {
    // Coordinates are CSS viewport pixels, not device-pixel backing coordinates.
    const touchPoints = points.map(p => ({ radiusX: 5, radiusY: 5, force: 1, ...p }));
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    if (type === 'touchCancel' || (type === 'touchEnd' && points.length === 0)) activeTouches = 0;
    else if (type !== 'touchEnd') activeTouches = points.length;
    await settle();
    report.touchTrace.push({ label, type, points: points.map(p => ({ ...p })),
      ...await page.evaluate(() => ({ pointerCount: anemone.pointerCount, scrollX, scrollY, viewportScale: visualViewport?.scale || 1 })) });
  };
  const tap = async (selector, label) => {
    const target = page.locator(selector);
    await target.waitFor({ state: 'visible', timeout: 15000 });
    const box = await target.boundingBox();
    if (!box || !box.width || !box.height) throw new Error('Touch target has no bounds: ' + selector);
    const point = { id: 7, x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const hit = await page.evaluate(({ selector, x, y }) => {
      const target = document.querySelector(selector), top = document.elementFromPoint(x, y);
      return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && target && (top === target || target.contains(top));
    }, { selector, ...point });
    assert(label + ' touch target visible and unobstructed', hit, { selector, box });
    await touch('touchStart', [point], label + ' down');
    await touch('touchEnd', [], label + ' up');
  };
  const screenshot = async (name, canvasOnly = false) => {
    const file = path.join(outDir, name + '.png');
    if (canvasOnly) await page.locator('#anemoneCanvas').screenshot({ path: file });
    else await page.screenshot({ path: file, fullPage: false });
    report.screenshots.push({ name, path: file, type: canvasOnly ? 'canvas' : 'first-screen' });
  };
  const layout = async (name, width, height) => {
    if (width && height) await page.setViewportSize({ width, height });
    await settle();
    await page.evaluate(() => { anemone.redraw(); window.__qaResizeStable = { key: '', count: 0 }; });
    // ResizeObserver/visualViewport updates can land after the first two RAFs.
    // Observe the completed native backing-store transition, without changing
    // dimensions, forcing extra draws, sleeping a guessed duration, or relaxing
    // any DPR assertion. A broken resize implementation still times out.
    await page.waitForFunction(() => {
      const r=anemone.renderer,c=r.canvas,d=r.display,w=c.clientWidth,h=c.clientHeight;
      const ratio=Math.min(devicePixelRatio,r.maxSurfaceSize/w,r.maxSurfaceSize/h);
      const ok=w>0&&h>0&&c.width===Math.round(w*ratio)&&c.height===Math.round(h*ratio)&&
        d?.cssWidth===w&&d?.cssHeight===h&&d?.backingWidth===c.width&&d?.backingHeight===c.height;
      const key=[w,h,c.width,c.height,visualViewport?.width,visualViewport?.height].join('/');
      const s=window.__qaResizeStable;s.count=ok&&s.key===key?s.count+1:(ok?1:0);s.key=key;
      return ok&&s.count>=3;
    },null,{polling:'raf',timeout:15000});
    const l = await page.evaluate(() => {
      const c = anemone.renderer.canvas, rect = c.getBoundingClientRect(), gl = anemone.renderer.gl;
      const viewport = { width: visualViewport?.width || innerWidth, height: visualViewport?.height || innerHeight,
        scale: visualViewport?.scale || 1, innerWidth, innerHeight, dpr: devicePixelRatio };
      const maxViewport = Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS));
      const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE), maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      const limit = Math.min(devicePixelRatio, maxTexture / c.clientWidth, maxTexture / c.clientHeight,
        maxRenderbuffer / c.clientWidth, maxRenderbuffer / c.clientHeight, maxViewport[0] / c.clientWidth, maxViewport[1] / c.clientHeight);
      const rectData = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
      };
      return {
        viewport, canvas: { ...rectData(c), clientWidth: c.clientWidth, clientHeight: c.clientHeight, backingWidth: c.width, backingHeight: c.height },
        display: anemone.metrics().display,
        gpu: { maxTexture, maxRenderbuffer, maxViewport, expectedDpr: limit },
        overflow: { x: document.documentElement.scrollWidth > innerWidth + 1, y: document.documentElement.scrollHeight > innerHeight + 1,
          scrollX, scrollY, scrollHeight: document.documentElement.scrollHeight },
        drawers: ['referenceDrawer', 'controlsDrawer', 'learningDrawer'].map(id => ({ id, exists: !!document.getElementById(id), open: !!document.getElementById(id)?.open })),
        reset: rectData(document.getElementById('anemoneCamera')),
        resetStyles: (()=>{const e=document.getElementById('anemoneCamera'),t=e?.parentElement;if(!e||!t)return null;const a=getComputedStyle(e),b=getComputedStyle(t);return{fontSize:a.fontSize,lineHeight:a.lineHeight,textSizeAdjust:a.webkitTextSizeAdjust,button:rectData(e),tools:rectData(t),columns:b.gridTemplateColumns,rows:b.gridTemplateRows,gap:b.gap,scrollHeight:t.scrollHeight,clientHeight:t.clientHeight,fontsStatus:document.fonts?.status};})(),
        touchAction: getComputedStyle(c).touchAction,
        module: platform.module
      };
    });
    report.layouts.push({ name, ...l });
    const landscape = l.viewport.width > l.viewport.height;
    assert(name + ' canvas dominates first screen', l.module === 'anemone' && l.canvas.top >= -1 && l.canvas.top <= 90 &&
      l.canvas.bottom <= l.viewport.height + 1 && l.canvas.left >= -1 && l.canvas.right <= l.viewport.width + 1 &&
      l.canvas.width >= l.viewport.width * (landscape ? .72 : .92) && l.canvas.height >= l.viewport.height * (landscape ? .35 : .5), l);
    assert(name + ' no document scrolling or viewport zoom', !l.overflow.x && !l.overflow.y &&
      l.overflow.scrollX === 0 && l.overflow.scrollY === 0 && close(l.viewport.scale, 1, 1e-4), l.overflow);
    assert(name + ' optional drawers closed', l.drawers.every(d => d.exists && !d.open), l.drawers);
    assert(name + ' camera reset remains on screen', l.reset && l.reset.top >= 0 && l.reset.bottom <= l.viewport.height + 1 &&
      l.reset.left >= 0 && l.reset.right <= l.viewport.width + 1, l.reset);
    assert(name + ' canvas owns touch gesture', l.touchAction === 'none', l.touchAction);
    assert(name + ' native DPR backing store', close(l.viewport.dpr, 2) &&
      Math.abs(l.canvas.backingWidth - Math.round(l.canvas.clientWidth * l.gpu.expectedDpr)) <= 1 &&
      Math.abs(l.canvas.backingHeight - Math.round(l.canvas.clientHeight * l.gpu.expectedDpr)) <= 1,
    { canvas: l.canvas, dpr: l.viewport.dpr, gpu: l.gpu });
    assert(name + ' display metrics match actual canvas', l.display &&
      l.display.cssWidth === l.canvas.clientWidth && l.display.cssHeight === l.canvas.clientHeight &&
      l.display.backingWidth === l.canvas.backingWidth && l.display.backingHeight === l.canvas.backingHeight &&
      close(l.display.requestedDpr, l.viewport.dpr) && close(l.display.effectiveDpr, l.gpu.expectedDpr, .005), l.display);
    const frame = await probe(true);
    assert(name + ' real rendered frame without JS or GL errors', frame.pixels.glError === 0 && frame.pixels.changed > 500 && !frame.errors.length,
      { pixels: frame.pixels, errors: frame.errors });
    await screenshot('mobile-' + name);
    return l;
  };
  const center = async () => {
    const box = await page.locator('#anemoneCanvas').boundingBox();
    return { x: Math.round(box.x + box.width * .5), y: Math.round(box.y + box.height * .5) };
  };
  const orbit = async (label, dx = 46, dy = 22) => {
    const at = await center(), before = await probe();
    await touch('touchStart', [{ id: 11, ...at }], label + ' start');
    assert(label + ' tracks one pointer', (await probe()).pointerCount === 1);
    for (let i = 1; i <= 4; ++i) await touch('touchMove', [{ id: 11, x: at.x + dx * i / 4, y: at.y + dy * i / 4 }], label + ' move ' + i);
    await touch('touchEnd', [], label + ' end');
    const after = await probe();
    assert(label + ' changes orbit but not zoom', orbitDifference(before.camera, after.camera) > .03 && close(before.camera.distance, after.camera.distance),
      { before: before.camera, after: after.camera });
    assert(label + ' releases all pointers', after.pointerCount === 0, after.pointerCount);
    immutable(label + ' preserves paused time and geometry', before, after);
    return after;
  };

  try {
    context = await browser.newContext(report.context);
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('request', request => {
      if (!request.url().startsWith('data:') && !request.url().startsWith('blob:')) report.requests.push(request.url());
    });
    page.on('requestfailed', request => report.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.platform?.module === 'home' && window.catalogUI, null, { timeout: 120000 });
    // Catalog/lazy startup is independently tested; this suite requests only Anemone.
    await page.evaluate(() => platform.select('anemone'));
    await page.waitForFunction(() => window.anemone?.ready && window.platform?.module === 'anemone' &&
      typeof anemone.redraw === 'function' && typeof anemone.pointerCount === 'number', null, { timeout: 120000 });
    await page.evaluate(() => { anemone.pause(); anemone.seek(0); });
    cdp = await context.newCDPSession(page);
    await page.evaluate(() => {
      window.__mobileQaPointerEvents = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
        anemone.renderer.canvas.addEventListener(type, e => window.__mobileQaPointerEvents.push({
          type, trusted: e.isTrusted, pointerType: e.pointerType, pointerId: e.pointerId, x: e.clientX, y: e.clientY
        }), { passive: true });
    });
    await layout('portrait-390x844');
    const baseline = await probe(true);
    assert('default full cluster has 240 tentacles', baseline.metrics.tentacles === 240, baseline.metrics.tentacles);
    await orbit('single finger orbit');
    await screenshot('mobile-orbit', true);

    // Two real touch contacts, symmetric separation change, then lifting one.
    const at = await center(), beforePinch = await probe();
    const start = [{ id: 21, x: at.x - 50, y: at.y }, { id: 22, x: at.x + 50, y: at.y }];
    await touch('touchStart', start, 'pinch start');
    assert('pinch tracks two pointers', (await probe()).pointerCount === 2);
    const pinchingStart = await probe();
    assert('adding second finger does not jump camera', sameCamera(beforePinch.camera, pinchingStart.camera),
      { before: beforePinch.camera, after: pinchingStart.camera });
    let stretched;
    for (let i = 1; i <= 4; ++i) {
      const spread = 50 + 9 * i;
      stretched = [{ id: 21, x: at.x - spread, y: at.y }, { id: 22, x: at.x + spread, y: at.y }];
      await touch('touchMove', stretched, 'pinch spread ' + i);
    }
    const zoomed = await probe();
    assert('two-finger spread zooms camera in', zoomed.camera.distance < beforePinch.camera.distance - .15 &&
      orbitDifference(beforePinch.camera, zoomed.camera) < .01,
    { before: beforePinch.camera, after: zoomed.camera });
    immutable('pinch preserves paused time and geometry', beforePinch, zoomed);
    await screenshot('mobile-pinch', true);

    // Chromium's synthetic-pointer backend releases omitted IDs on touchMove.
    // Its WebTouchEvent backend instead supports touchEnd with the released ID.
    // Both are real CDP input paths; no DOM events or app handlers are invoked.
    // Source: chromium/chromium 140.0.7339.16, input_handler.cc, lines 498-530,
    // 1613-1628 and 1690-1704. Require the observable pointer count either way.
    await touch('touchMove', [stretched[0]], 'lift second finger / active list');
    let lifted = await probe();
    if (lifted.pointerCount === 2) {
      await touch('touchEnd', [stretched[1]], 'lift second finger / WebTouchEvent backend');
      activeTouches = 1;
      lifted = await probe();
      report.partialLiftBackend = 'WebTouchEvent touchEnd with released ID';
    } else report.partialLiftBackend = 'SyntheticPointerActions touchMove active list';
    assert('lifting one finger leaves one active pointer', lifted.pointerCount === 1, lifted.pointerCount);
    assert('lifting one finger does not jump camera', sameCamera(zoomed.camera, lifted.camera),
      { before: zoomed.camera, after: lifted.camera });
    const smallMove = { ...stretched[0], x: stretched[0].x + 3, y: stretched[0].y + 2 };
    await touch('touchMove', [smallMove], 'one-finger continuation small move');
    const continued = await probe();
    const continuationDelta = orbitDifference(lifted.camera, continued.camera);
    assert('remaining finger resumes orbit without stale-anchor jump', continuationDelta > .0001 && continuationDelta < .08 &&
      close(lifted.camera.distance, continued.camera.distance),
    { before: lifted.camera, after: continued.camera, orbitDelta: continuationDelta, movementCssPixels: [3, 2] });
    await touch('touchEnd', [], 'one-finger continuation end');
    assert('pinch transition releases all pointers', (await probe()).pointerCount === 0);
    immutable('pinch transition preserves paused time and geometry', beforePinch, await probe());

    // Cancellation must clear both contacts and allow an entirely new gesture.
    await touch('touchStart', start, 'cancel test start');
    await touch('touchMove', [{ ...start[0], x: start[0].x - 8 }, { ...start[1], x: start[1].x + 8 }], 'cancel test move');
    const beforeCancel = await probe();
    await touch('touchCancel', [], 'cancel both contacts');
    const canceled = await probe();
    assert('touchCancel clears pointer state without moving camera', canceled.pointerCount === 0 && sameCamera(beforeCancel.camera, canceled.camera),
      { before: beforeCancel.camera, after: canceled.camera, pointers: canceled.pointerCount });
    await orbit('fresh gesture after cancellation', -33, 16);

    await tap('#anemoneCamera', 'camera reset');
    const reset = await probe(true);
    assert('camera reset restores exact state and pixels', sameCamera(baseline.camera, reset.camera) && baseline.pixels.hash === reset.pixels.hash,
      { baseline: { camera: baseline.camera, pixels: baseline.pixels.hash }, reset: { camera: reset.camera, pixels: reset.pixels.hash } });
    immutable('camera reset preserves paused time and geometry', baseline, reset);

    for (const kind of ['reference', 'controls', 'learning']) {
      const drawer = '#' + kind + 'Drawer';
      await tap('#' + kind + 'Toggle', kind + ' open');
      assert(kind + ' drawer opens natively', await page.locator(drawer).evaluate(d => d instanceof HTMLDialogElement && d.open));
      await screenshot('mobile-' + kind + '-drawer');
      await tap('#' + kind + 'Close', kind + ' close');
      assert(kind + ' drawer closes', !(await page.locator(drawer).evaluate(d => d.open)));
      await orbit('canvas after ' + kind + ' close', 20, -10);
    }
    // Native range drags exercise the browser's range input, then the app's
    // input handler. Do not use locator.fill(), DOM events, or direct values.
    await tap('#controlsToggle', 'open native range controls');
    const savedControlsState = await page.evaluate(() => anemone.exportState());
    const beforeRanges = await probe(true);
    const rangeValues = async () => page.evaluate(() => ({
      open: document.getElementById('controlsDrawer').open,
      camera: anemone.state.camera,
      material: anemone.material,
      zoom: Number(document.getElementById('studioZoom').value),
      zoomOutput: document.getElementById('studioZoomValue').textContent.trim(),
      translucency: Number(document.getElementById('studioTranslucency').value),
      translucencyOutput: document.getElementById('studioTranslucencyValue').textContent.trim()
    }));
    const dragRange = async (selector, targetFraction, label) => {
      const input = page.locator(selector);
      await input.waitFor({ state: 'visible' });
      const initial = await input.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        el.__nativeRangeInputEvents = [];
        el.addEventListener('input', event => el.__nativeRangeInputEvents.push({ trusted: event.isTrusted, value: Number(el.value) }), { passive: true });
        return { type: el.type, min: Number(el.min), max: Number(el.max), value: Number(el.value),
          direction: getComputedStyle(el).direction, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      });
      assert(label + ' is a visible horizontal range', initial.type === 'range' && initial.direction === 'ltr' && initial.width > 60,
        { selector, initial });
      // The production stylesheet defines a 20 CSS-pixel thumb. Both endpoints
      // stay inside its center travel, so the first contact grabs the thumb.
      const inset = 10, travel = initial.width - inset * 2;
      const fromX = initial.x + inset + travel * (initial.value - initial.min) / (initial.max - initial.min);
      const toX = initial.x + inset + travel * targetFraction, y = initial.y + initial.height / 2;
      const hit = await page.evaluate(({ selector, x, y }) => document.elementFromPoint(x, y) === document.querySelector(selector),
        { selector, x: fromX, y });
      assert(label + ' thumb is unobstructed', hit, { selector, fromX, toX, y });
      await touch('touchStart', [{ id: 31, x: fromX, y }], label + ' thumb down');
      for (let i = 1; i <= 4; ++i) await touch('touchMove', [{ id: 31, x: fromX + (toX - fromX) * i / 4, y }], label + ' drag ' + i);
      await touch('touchEnd', [], label + ' thumb up');
      const final = await input.evaluate(el => ({ value: Number(el.value), inputEvents: el.__nativeRangeInputEvents }));
      const expected = initial.min + (initial.max - initial.min) * targetFraction;
      assert(label + ' changes value through trusted native input', Math.abs(final.value - initial.value) > (initial.max - initial.min) * .1 &&
        Math.abs(final.value - expected) <= (initial.max - initial.min) * .04 && final.inputEvents.length >= 2 && final.inputEvents.every(e => e.trusted),
      { initial: initial.value, expected, final });
      return final;
    };
    const sameShapeAndTime = (name, before, after) => assert(name,
      before.paused && after.paused && before.time === after.time && before.geometryHash === after.geometryHash &&
      before.geometryBytes === after.geometryBytes && JSON.stringify(before.params) === JSON.stringify(after.params),
    { before: { time: before.time, geometryHash: before.geometryHash }, after: { time: after.time, geometryHash: after.geometryHash } });
    await dragRange('#studioZoom', .78, 'native zoom slider');
    const zoomControls = await rangeValues(), afterZoomRange = await probe(true);
    assert('zoom range updates camera and displayed value', zoomControls.open && close(zoomControls.zoom, zoomControls.camera.distance) &&
      zoomControls.zoomOutput === zoomControls.camera.distance.toFixed(2) && afterZoomRange.pixels.hash !== beforeRanges.pixels.hash,
      zoomControls);
    immutable('zoom range preserves paused time, geometry, and material', beforeRanges, afterZoomRange);
    await dragRange('#studioTranslucency', .27, 'native translucency slider');
    const translucentControls = await rangeValues(), afterTranslucencyRange = await probe(true);
    assert('translucency range updates material and displayed value', translucentControls.open &&
      close(translucentControls.translucency, translucentControls.material.translucency) &&
      translucentControls.translucencyOutput === Math.round(translucentControls.material.translucency * 100) + '%' &&
      afterTranslucencyRange.pixels.hash !== afterZoomRange.pixels.hash && sameCamera(afterZoomRange.camera, afterTranslucencyRange.camera) &&
      afterZoomRange.material.palette === afterTranslucencyRange.material.palette && afterZoomRange.material.mode === afterTranslucencyRange.material.mode,
      translucentControls);
    sameShapeAndTime('translucency range preserves paused time and geometry', beforeRanges, afterTranslucencyRange);
    await screenshot('mobile-native-range-controls');
    // Read inside the import call's same JS turn: re-opening the dialog, waiting
    // for RAF, or manually refreshing controls must not hide stale UI values.
    const restoredControls = await page.evaluate(saved => {
      anemone.importState(saved);
      return {
        open: document.getElementById('controlsDrawer').open,
        camera: anemone.state.camera, material: anemone.material,
        zoom: Number(document.getElementById('studioZoom').value),
        zoomOutput: document.getElementById('studioZoomValue').textContent.trim(),
        translucency: Number(document.getElementById('studioTranslucency').value),
        translucencyOutput: document.getElementById('studioTranslucencyValue').textContent.trim()
      };
    }, savedControlsState);
    assert('state import immediately synchronizes both open-drawer controls', restoredControls.open &&
      sameCamera(restoredControls.camera, savedControlsState.camera) &&
      close(restoredControls.zoom, savedControlsState.camera.distance) && restoredControls.zoomOutput === savedControlsState.camera.distance.toFixed(2) &&
      close(restoredControls.translucency, savedControlsState.material.translucency) &&
      close(restoredControls.material.translucency, savedControlsState.material.translucency) &&
      restoredControls.translucencyOutput === Math.round(savedControlsState.material.translucency * 100) + '%',
      { savedCamera: savedControlsState.camera, savedMaterial: savedControlsState.material, restoredControls });
    const restoredRanges = await probe(true);
    immutable('state import restores range-test time, geometry, and material', beforeRanges, restoredRanges);
    assert('state import restores exact pre-range pixels', beforeRanges.pixels.hash === restoredRanges.pixels.hash,
      { before: beforeRanges.pixels.hash, restored: restoredRanges.pixels.hash });
    await tap('#controlsClose', 'close native range controls');
    assert('range controls drawer closes', !(await page.locator('#controlsDrawer').evaluate(d => d.open)));
    await tap('#anemoneCamera', 'reset before viewport resize');
    await layout('short-390x650', 390, 650);
    await orbit('short viewport gesture', 23, 12);
    await tap('#anemoneCamera', 'short viewport reset');
    await layout('landscape-844x390', 844, 390);
    await orbit('landscape gesture', 26, 10);
    await tap('#anemoneCamera', 'landscape reset');
    await layout('portrait-restored-390x844', 390, 844);
    const final = await probe(true);
    assert('viewport changes preserve exact camera and restored pixels', sameCamera(baseline.camera, final.camera) && baseline.pixels.hash === final.pixels.hash,
      { baseline: baseline.camera, final: final.camera, baselineHash: baseline.pixels.hash, finalHash: final.pixels.hash });
    immutable('all camera UI and viewport changes preserve shape and time', baseline, final);
    const events = await page.evaluate(() => window.__mobileQaPointerEvents);
    report.pointerEvents = events;
    assert('touch tests delivered trusted native touch PointerEvents', events.length > 0 &&
      events.every(e => e.trusted && e.pointerType === 'touch') &&
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].every(type => events.some(e => e.type === type)),
    { count: events.length, types: [...new Set(events.map(e => e.type))], allTrusted: events.every(e => e.trusted) });
    assert('touches never scroll or zoom the document', report.touchTrace.every(e =>
      e.scrollX === 0 && e.scrollY === 0 && close(e.viewportScale, 1, 1e-4)), report.touchTrace.filter(e => e.scrollX || e.scrollY || !close(e.viewportScale, 1, 1e-4)));
    assert('zero JS, WebGL, or failed-request errors', !report.errors.length && !final.errors.length && !report.requestFailures.length,
      { console: report.errors, application: final.errors, requests: report.requestFailures });
    if (url.startsWith('file:')) assert('standalone touch workbench needs no network',
      report.requests.every(u => u.startsWith('file:') || u === 'about:srcdoc' || u === 'about:blank'), report.requests);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page && !page.isClosed()) {
      try { await screenshot('mobile-failure'); } catch (captureError) { report.screenshotFailure = String(captureError); }
    }
  } finally {
    // Release pending contacts before disposing only our own isolated context.
    if (cdp && activeTouches) {
      try { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); }
      catch (error) { report.cleanupWarning = String(error); }
    }
    if (context) {
      try { await context.close(); } catch (error) { report.cleanupWarning = String(error); }
    }
    report.summary = { passed: report.passed, assertionsPassed: report.tests.filter(t => t.pass).length,
      assertionsFailed: report.tests.filter(t => !t.pass).length, layoutsChecked: report.layouts.map(l => l.name),
      touchCommands: report.touchTrace.length, screenshots: report.screenshots.length };
    fs.writeFileSync(path.join(outDir, 'mobile-controls-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
};
