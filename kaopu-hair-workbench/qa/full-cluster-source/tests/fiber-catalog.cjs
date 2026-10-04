'use strict';
const fs = require('fs');
const path = require('path');

// Uses the supplied browser only. No launch, installation or publishing. Each
// scenario owns its context; the caller's other catalog tests are unaffected.
module.exports = async function fiberCatalog(browser, url, outDir, check) {
  fs.mkdirSync(outDir, {recursive: true});
  const report = {
    timestamp: new Date().toISOString(), url, passed: false,
    physicalIPhoneTested: false, physicalSafariTested: false, visualAcceptance: false,
    tests: [], errors: [], expectedFailureErrors: [], requests: [], screenshots: [], lifecycle: [],
    scope: 'Third 毛束 entry: chosen-only iframe, real GL, native touch, retained state, hidden RAF, full child controls, interrupted load, retry and existing objects'
  };
  const contexts = [];
  let page, currentContext, phase = 'desktop';
  const assert = (name, pass, detail) => {
    const test = {name: 'fiber catalog ' + phase + ': ' + name, pass: !!pass, detail};
    report.tests.push(test);
    if (check) check(test.name, test.pass, detail);
    if (!test.pass) throw Error(test.name + ': ' + JSON.stringify(detail));
  };
  const wait = (fn, timeout = 120000) => page.waitForFunction(fn, null, {timeout});
  const child = () => page.frameLocator('#fiberFrame');
  const snapshot = () => page.evaluate(() => {
    const r = document.getElementById('fiberFrame')?.contentWindow?.FiberStudy;
    return {
      module: platform.module, body: document.body.dataset.module, status: fiberCatalog.status,
      ready: r?.ready || false, stats: r?.stats || null, state: r?.exportState() || null,
      fiberErrors: [...fiberCatalog.errors, ...(r?.errors || [])],
      rabbitFrames: document.getElementById('candidateFrame')?.contentWindow?.runtime?.frameCount || 0,
      anemoneFrames: anemone.metrics()?.frames || 0,
      anemoneTime: anemone.state.time,
      errors: [...platform.errors, ...workbench.errors, ...anemone.errors, ...kuko.errors],
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  });
  const capture = async name => {
    const file = path.join(outDir, phase + '-' + name + '.jpg');
    await page.screenshot({path: file, type: 'jpeg', quality: 86});
    report.screenshots.push(file);
  };
  const openPage = async (name, options = {}, expectedFailure = false) => {
    if (currentContext) await currentContext.close();
    phase = name;
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1, ...options});
    contexts.push(context);
    currentContext = context;
    page = await context.newPage();
    const errors = expectedFailure ? report.expectedFailureErrors : report.errors;
    page.on('pageerror', e => errors.push({phase: name, message: e.message}));
    page.on('console', m => {if (m.type() === 'error') errors.push({phase: name, message: m.text()});});
    page.on('request', r => report.requests.push({phase: name, url: r.url()}));
    await page.goto(url, {waitUntil: 'load', timeout: 120000});
    await wait(() => window.catalogUI && window.fiberCatalog && platform.module === 'home');
    return context;
  };
  const ready = async () => {
    await wait(() => window.fiberCatalog?.ready && document.getElementById('fiberFrame')?.contentWindow?.FiberStudy?.ready);
    const s = await snapshot();
    assert('selected module is ready and only one iframe exists', s.module === 'fiber' && s.body === 'fiber' &&
      s.ready && await page.locator('#fiberFrame').count() === 1 && !s.fiberErrors.length && !s.errors.length, s);
  };
  const hit = async locator => locator.evaluate(el => {
    const b = el.getBoundingClientRect();
    const d = el.ownerDocument, w = d.defaultView;
    const top = d.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return {width: b.width, height: b.height, x: b.x, y: b.y, right: b.right, bottom: b.bottom,
      vw: w.innerWidth, vh: w.innerHeight,
      visible: b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden',
      hit: !!top && (top === el || el.contains(top)), disabled: !!el.disabled,
      overflow: d.documentElement.scrollWidth > w.innerWidth + 1};
  });
  const reachable = async (locator, name) => {
    await locator.scrollIntoViewIfNeeded();
    const b = await hit(locator);
    assert(name + ' visible and reachable', b.visible && b.hit && !b.disabled && !b.overflow && b.x >= -1 && b.y >= -1 && b.right <= b.vw + 1 && b.bottom <= b.vh + 1, b);
    return b;
  };
  const nativeTap = async (locator, name) => {
    await reachable(locator, name);
    await locator.evaluate(el => {
      el.__fiberTap = null;
      el.addEventListener('click', e => {el.__fiberTap = {trusted: e.isTrusted, type: e.pointerType};}, {once: true});
    });
    await locator.tap();
    const e = await locator.evaluate(el => el.__fiberTap);
    assert(name + ' uses trusted native touch', e?.trusted && e.type === 'touch', e);
  };
  const gl = async () => {
    const p = await page.evaluate(() => {
      const r = document.getElementById('fiberFrame').contentWindow.FiberStudy;
      return {pixels: r.diagnostics(), stats: r.stats, errors: r.errors};
    });
    assert('real WebGL2 pixels and zero GL/runtime errors', p.pixels.glError === 0 && p.pixels.nonBackground > 500 && p.stats.frames > 0 && !p.errors.length, p);
    return p;
  };
  const assertHiddenFrozen = async label => {
    const start = await snapshot();
    await page.waitForTimeout(400);
    const end = await snapshot();
    report.lifecycle.push({phase, label, start, end});
    assert(label + ' has zero RAF and no rendered-frame/time change', !start.stats.active && start.stats.raf === 0 &&
      !end.stats.active && end.stats.raf === 0 && end.stats.frames === start.stats.frames && end.state.time === start.state.time, {start, end});
  };
  try {
    await openPage('desktop');
    await page.waitForTimeout(300);
    const home = await page.evaluate(() => ({
      frame: !!document.getElementById('fiberFrame'), fiber: fiberCatalog.stats,
      cards: Array.from(document.querySelectorAll('.catalog-grid > [data-catalog-object]')).map(c => ({
        object: c.dataset.catalogObject, image: c.querySelector('img')?.currentSrc,
        complete: c.querySelector('img')?.complete, width: c.querySelector('img')?.naturalWidth,
        height: c.querySelector('img')?.naturalHeight
      })),
      started: workbench.started, anemone: anemone.ready, kuko: kuko.ready,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    }));
    assert('home has ordered Rabbit, Anemone, Fiber, Groom and Feather real thumbnails and no renderers',
      JSON.stringify(home.cards.map(c => c.object)) === JSON.stringify(['rabbit','anemone','fiber','groom','feather']) &&
      home.cards.every(c => c.complete && c.width >= 200 && c.height >= 100 && c.image.startsWith('data:image/jpeg;')) &&
      new Set(home.cards.map(c => c.image)).size === 5 && !home.frame && !home.fiber && !home.started && !home.anemone && !home.kuko && !home.overflow,
      {...home, cards: home.cards.map(c => ({...c, image: c.image?.slice(0, 30)}))});
    assert('home never requests the fiber module', !report.requests.some(r => r.phase === phase && /c4d-fiber-study/.test(r.url)), report.requests);
    await capture('home-five-thumbnails');
    await page.locator('#catalogFiber').click();
    await ready();
    await gl();
    await capture('fiber-first-entry');
    const mode = await page.evaluate(() => ({embedded: typeof FIBER_MODULE_HTML === 'string',
      src: document.getElementById('fiberFrame').getAttribute('src'), srcdoc: document.getElementById('fiberFrame').hasAttribute('srcdoc')}));
    assert('offline embeds frozen document; online requests its relative URL only on entry', url.startsWith('file:') ? mode.embedded && mode.srcdoc && !mode.src : !mode.embedded && !mode.srcdoc && mode.src === './c4d-fiber-study/index.html', mode);
    if ((await snapshot()).state.running) await child().locator('#play').click();
    await child().locator('#turns').focus();
    await child().locator('#turns').press('ArrowRight');
    const saved = (await snapshot()).state;
    assert('native control edits the actual fiber parameter', Math.abs(saved.state.turns - 3.4) < 1e-6 && !saved.running, saved);
    await page.locator('#catalogHomeButton').click();
    assert('home return focuses the third entry', await page.evaluate(() => platform.module === 'home' && document.activeElement.id === 'catalogFiber'));
    await assertHiddenFrozen('home-hidden fiber');
    await page.locator('#catalogFiber').click();
    await ready();
    const restored = (await snapshot()).state;
    assert('home/reentry preserves parameters, camera, time and paused playback', JSON.stringify(restored) === JSON.stringify(saved), {saved, restored});
    // Start playback, then leave. The host must cancel the live RAF synchronously.
    await child().locator('#play').click();
    await wait(() => document.getElementById('fiberFrame').contentWindow.FiberStudy.stats.raf > 0);
    await page.locator('#catalogHomeButton').click();
    await assertHiddenFrozen('previously playing hidden fiber');
    await page.locator('#catalogRabbit').click();
    await wait(() => platform.module === 'rabbit' && workbench.ready.candidate && document.getElementById('candidateFrame').contentWindow.runtime?.frameCount > 0, 180000);
    assert('Rabbit still works after fiber', (await snapshot()).module === 'rabbit');
    await page.locator('#catalogHomeButton').click();
    await page.locator('#catalogAnemone').click();
    await wait(() => platform.module === 'anemone' && anemone.ready);
    const ap = await page.evaluate(() => anemone.pixels());
    assert('Anemone still renders real GL after fiber', ap.glError === 0 && ap.changed > 500, ap);
    await page.locator('#catalogHomeButton').click();
    await page.locator('#catalogFiber').click();
    await ready();
    await page.waitForTimeout(120);
    const othersBefore = await snapshot();
    await page.waitForFunction(before=>{const r=document.getElementById('fiberFrame')?.contentWindow?.FiberStudy;return r?.stats.active&&r.stats.running&&r.stats.frames>=before.frames+2&&r.exportState().time>before.time;},{frames:othersBefore.stats.frames,time:othersBefore.state.time},{timeout:20000,polling:100});
    const othersAfter = await snapshot();
    assert('fiber resumes previous playback and other objects remain paused', othersAfter.stats.active && othersAfter.stats.frames > othersBefore.stats.frames &&
      othersAfter.rabbitFrames === othersBefore.rabbitFrames && othersAfter.anemoneFrames === othersBefore.anemoneFrames && othersAfter.anemoneTime === othersBefore.anemoneTime, {othersBefore, othersAfter});
    assert('no source/runtime errors in normal desktop flow', !report.errors.length && !othersAfter.errors.length && !othersAfter.fiberErrors.length, report.errors);
    // pagehide is the actual event subscribed by the host. Keep an API reference
    // to prove dispose ran before removing the iframe, rather than merely hiding it.
    const disposed = await page.evaluate(() => {
      const r = document.getElementById('fiberFrame').contentWindow.FiberStudy;
      window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
      return {disposed: r.stats.disposed, raf: r.stats.raf, frame: !!document.getElementById('fiberFrame')};
    });
    assert('pagehide disposes GL/RAF before iframe removal', disposed.disposed && !disposed.raf && !disposed.frame, disposed);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})));
    await ready();
    assert('back-forward restoration creates a fresh usable instance', (await snapshot()).state.state.turns === saved.state.turns);

    await openPage('portrait', {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    await nativeTap(page.locator('#catalogFiber'), 'third catalog card');
    await ready();
    await gl();
    await reachable(page.locator('#catalogHomeButton'), 'outer 首页 return');
    await capture('fiber-mobile-stage');
    const controls = ['play','resetCamera','capture','export','import','reset','turns','radius','spread','noise','strands','diameter','roughness','tone','motion','speed','reseed'];
    for (const id of controls) await reachable(child().locator('#' + id), 'complete child control ' + id);
    await capture('fiber-mobile-controls');
    const range = child().locator('#turns');
    await reachable(range, 'mobile turns slider');
    const initialTurns = (await snapshot()).state.state.turns;
    const box = await range.boundingBox();
    await range.evaluate(el => {el.__fiberInput = null; el.addEventListener('input', e => {el.__fiberInput = {trusted: e.isTrusted, value: Number(el.value)};});});
    await page.touchscreen.tap(box.x + box.width * .72, box.y + box.height / 2);
    const nativeInput = await range.evaluate(el => el.__fiberInput);
    const mobileSaved = (await snapshot()).state.state;
    assert('native mobile range changes the actual parameter', nativeInput?.trusted && mobileSaved.turns !== initialTurns && mobileSaved.turns === nativeInput.value, {nativeInput, mobileSaved});
    await page.setViewportSize({width: 390, height: 690});
    await reachable(page.locator('#catalogHomeButton'), '首页 after viewport shrink');
    const viewport = await page.evaluate(() => {
      const b = document.getElementById('fiberFrame').getBoundingClientRect();
      return {top: b.top, bottom: b.bottom, vh: visualViewport?.height || innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1};
    });
    assert('safe dynamic viewport contains the whole iframe', !viewport.overflow && viewport.top >= 0 && viewport.bottom <= viewport.vh + 1, viewport);
    await nativeTap(page.locator('#catalogHomeButton'), 'outer 首页');
    await assertHiddenFrozen('mobile hidden fiber');
    await nativeTap(page.locator('#catalogFiber'), 'mobile reentry');
    await ready();
    assert('mobile edits survive home switching', JSON.stringify((await snapshot()).state.state) === JSON.stringify(mobileSaved), mobileSaved);

    await openPage('interrupted');
    await page.evaluate(() => {platform.select('fiber'); platform.select('home'); platform.select('fiber'); platform.select('home');});
    await wait(() => fiberCatalog.ready);
    assert('rapid enter/leave finishes hidden without returning from home', (await snapshot()).module === 'home' && await page.locator('#fiberFrame').count() === 1);
    await assertHiddenFrozen('load completing after rapid leave');
    await page.locator('#catalogFiber').click();
    await ready();
    await gl();

    // Controlled failure uses an inert, valid document instead of altering the
    // immutable module or relying on network instability. Retry restores the
    // original offline payload or online URL, and no extra context is launched.
    await openPage('retry', {}, true);
    await page.evaluate(() => {window.__originalFiberHtml = window.FIBER_MODULE_HTML; window.FIBER_MODULE_HTML = '<!doctype html><title>Controlled load failure</title><p>No module in this test document</p>';});
    await page.locator('#catalogFiber').click();
    await wait(() => fiberCatalog.status === 'error');
    assert('load error is visible with retry and usable 首页', await page.locator('#fiberRetry').isVisible() && await page.locator('#catalogHomeButton').isVisible() && await page.locator('#fiberFrame').count() === 0,
      await page.locator('#fiberLoadMessage').textContent());
    await page.locator('#catalogHomeButton').click();
    assert('load error never traps the user', await page.evaluate(() => platform.module === 'home'));
    await page.locator('#catalogFiber').click();
    await page.evaluate(() => {if (typeof window.__originalFiberHtml === 'string') window.FIBER_MODULE_HTML = window.__originalFiberHtml; else delete window.FIBER_MODULE_HTML;});
    await page.locator('#fiberRetry').click();
    await wait(() => fiberCatalog.ready && document.getElementById('fiberFrame').contentWindow.FiberStudy.ready);
    await gl();
    assert('retry produces one usable frame and clears the error UI', await page.locator('#fiberFrame').count() === 1 && !await page.locator('#fiberRetry').isVisible());
    assert('all normal scenarios have zero source/runtime errors', report.errors.length === 0, report.errors);
    assert('retry also has zero source/runtime errors', report.expectedFailureErrors.length === 0, report.expectedFailureErrors);
    report.passed = true;
    report.summary = {checks: report.tests.length, scenarios: ['desktop','portrait','interrupted','retry'], realWebGL: true, nativeMobileInput: true, hiddenRafFrozen: true};
  } catch (error) {
    report.passed = false;
    report.failure = error.stack;
    if (page) {try {await capture('failure');} catch (_) {}}
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    fs.writeFileSync(path.join(outDir, 'fiber-catalog-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
};
