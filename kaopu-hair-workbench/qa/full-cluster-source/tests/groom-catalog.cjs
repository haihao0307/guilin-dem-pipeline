'use strict';
const fs = require('fs');
const path = require('path');
const crypto=require('crypto');

// Uses the supplied browser only. No launch, installation or publishing. Each
// scenario owns its context; the caller's other catalog tests are unaffected.
module.exports = async function groomCatalog(browser, url, outDir, check) {
  fs.mkdirSync(outDir, {recursive: true});
  const report = {
    timestamp: new Date().toISOString(), url, passed: false,
    physicalIPhoneTested: false, physicalSafariTested: false, visualAcceptance: false,
    tests: [], errors: [], expectedFailureErrors: [], requests: [], screenshots: [], lifecycle: [],
    scope: 'Fourth 梳理 entry: chosen-only iframe, real GL, native touch, retained state, hidden RAF, full child controls, interrupted load, retry and existing objects'
  };
  const contexts = [];
  let page, currentContext, phase = 'desktop';
  const assert = (name, pass, detail) => {
    const test = {name: 'groom catalog ' + phase + ': ' + name, pass: !!pass, detail};
    report.tests.push(test);
    if (check) check(test.name, test.pass, detail);
    if (!test.pass) throw Error(test.name + ': ' + JSON.stringify(detail));
  };
  const wait = (fn, timeout = 120000) => page.waitForFunction(fn, null, {timeout});
  const child = () => page.frameLocator('#groomFrame');
  const snapshot = () => page.evaluate(() => {
    const r = document.getElementById('groomFrame')?.contentWindow?.GroomStudy;
    return {
      module: platform.module, body: document.body.dataset.module, status: groomCatalog.status,
      ready: r?.ready || false, stats: r?.stats || null, state: r?.exportState() || null,
      groomErrors: [...groomCatalog.errors, ...(r?.errors || [])],
      rabbitFrames: document.getElementById('candidateFrame')?.contentWindow?.runtime?.frameCount || 0,
      anemoneFrames: anemone.metrics()?.frames || 0,
      anemoneTime: anemone.state.time,
      fiberFrames: document.getElementById('fiberFrame')?.contentWindow?.FiberStudy?.stats.frames || 0,
      fiberTime: document.getElementById('fiberFrame')?.contentWindow?.FiberStudy?.exportState().time || 0,
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
    const response=await page.goto(url,{waitUntil:'load',timeout:120000});
    if(url.startsWith('http')){const local=fs.readFileSync(path.join(path.dirname(process.env.HAIR_KUKO_HTML),path.basename(new URL(url).pathname)));const served=await response.body();assert('exact public integration candidate bytes',response.status()===200&&crypto.createHash('sha256').update(local).digest('hex')===crypto.createHash('sha256').update(served).digest('hex'),{status:response.status(),bytes:served.length});}
    await wait(() => window.catalogUI && window.groomCatalog && platform.module === 'home');
    return context;
  };
  const ready = async () => {
    await wait(() => window.groomCatalog?.ready && document.getElementById('groomFrame')?.contentWindow?.GroomStudy?.ready);
    const s = await snapshot();
    assert('selected module is ready and only one iframe exists', s.module === 'groom' && s.body === 'groom' &&
      s.ready && await page.locator('#groomFrame').count() === 1 && !s.groomErrors.length && !s.errors.length, s);
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
      el.__groomTap = null;
      el.addEventListener('click', e => {el.__groomTap = {trusted: e.isTrusted, type: e.pointerType};}, {once: true});
    });
    await locator.tap();
    const e = await locator.evaluate(el => el.__groomTap);
    assert(name + ' uses trusted native touch', e?.trusted && e.type === 'touch', e);
  };
  const gl = async () => {
    const p = await page.evaluate(() => {
      const r = document.getElementById('groomFrame').contentWindow.GroomStudy;
      return {pixels: r.diagnostics(), stats: r.stats, errors: r.errors};
    });
    assert('real WebGL2 pixels and zero GL/runtime errors', p.pixels.glError === 0 && p.pixels.darkPixels > 500 && p.pixels.rootCount > 10000 && p.stats.frames > 0 && !p.errors.length, p);
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
    assert('accepted Rabbit renderer remains byte exact',crypto.createHash('sha256').update(await page.evaluate(()=>FRAME_RUNTIME)).digest('hex')==='019a2371d87139af19c5fbc4048a87eb490586143271b4528ab8158ed52435d7');
    const home = await page.evaluate(() => ({
      frame: !!document.getElementById('groomFrame'), groom: groomCatalog.stats,
      cards: Array.from(document.querySelectorAll('.catalog-grid > [data-catalog-object]')).map(c => ({
        object: c.dataset.catalogObject, image: c.querySelector('img')?.currentSrc,
        complete: c.querySelector('img')?.complete, width: c.querySelector('img')?.naturalWidth,
        height: c.querySelector('img')?.naturalHeight
      })),
      started: workbench.started, anemone: anemone.ready, kuko: kuko.ready,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    }));
    assert('home has ordered Rabbit, Anemone, Fiber, Groom real thumbnails and no renderers',
      JSON.stringify(home.cards.map(c => c.object)) === JSON.stringify(['rabbit','anemone','fiber','groom']) &&
      home.cards.every(c => c.complete && c.width >= 200 && c.height >= 100 && c.image.startsWith('data:image/jpeg;')) &&
      new Set(home.cards.map(c => c.image)).size === 4 && !home.frame && !home.groom && !home.started && !home.anemone && !home.kuko && !home.overflow,
      {...home, cards: home.cards.map(c => ({...c, image: c.image?.slice(0, 30)}))});
    assert('home never requests the groom module', !report.requests.some(r => r.phase === phase && /houdini-groom-study/.test(r.url)), report.requests);
    await capture('home-four-thumbnails');
    await page.locator('#catalogGroom').click();
    await ready();
    await gl();
    await capture('groom-first-entry');
    const mode = await page.evaluate(() => ({embedded: typeof GROOM_MODULE_HTML === 'string',
      src: document.getElementById('groomFrame').getAttribute('src'), srcdoc: document.getElementById('groomFrame').hasAttribute('srcdoc')}));
    assert('offline embeds frozen document; online requests its relative URL only on entry', url.startsWith('file:') ? mode.embedded && mode.srcdoc && !mode.src : !mode.embedded && !mode.srcdoc && mode.src === './houdini-groom-study/index.html', mode);
    if ((await snapshot()).state.running) await child().locator('#play').click();
    await child().locator('#beard').focus();
    await child().locator('#beard').press('ArrowRight');
    const saved = (await snapshot()).state;
    assert('native control edits the actual groom parameter', Math.abs(saved.state.beard - .76) < 1e-6 && !saved.running, saved);
    await page.locator('#catalogHomeButton').click();
    assert('home return focuses the fourth entry', await page.evaluate(() => platform.module === 'home' && document.activeElement.id === 'catalogGroom'));
    await assertHiddenFrozen('home-hidden groom');
    await page.locator('#catalogGroom').click();
    await ready();
    const restored = (await snapshot()).state;
    assert('home/reentry preserves parameters, camera, time and paused playback', JSON.stringify(restored) === JSON.stringify(saved), {saved, restored});
    // Start playback, then leave. The host must cancel the live RAF synchronously.
    await child().locator('#play').click();
    await wait(() => document.getElementById('groomFrame').contentWindow.GroomStudy.stats.raf > 0);
    await page.locator('#catalogHomeButton').click();
    await assertHiddenFrozen('previously playing hidden groom');
    await page.locator('#catalogRabbit').click();
    await wait(() => platform.module === 'rabbit' && workbench.ready.candidate && document.getElementById('candidateFrame').contentWindow.runtime?.frameCount > 0, 180000);
    assert('Rabbit still works after groom', (await snapshot()).module === 'rabbit');
    await page.locator('#catalogHomeButton').click();
    await page.locator('#catalogAnemone').click();
    await wait(() => platform.module === 'anemone' && anemone.ready);
    const ap = await page.evaluate(() => {anemone.pause();anemone.seek(0);return anemone.pixels()});
    assert('Anemone still renders real GL after groom', ap.glError === 0 && ap.changed > 500, ap);
    assert('accepted Anemone default pixels remain exact after grooming',ap.hash===159461793&&ap.width===1440&&ap.height===685,ap);
    await page.locator('#catalogHomeButton').click();await page.locator('#catalogFiber').click();await wait(()=>fiberCatalog.ready&&document.getElementById('fiberFrame').contentWindow.FiberStudy.ready);assert('Fiber still renders real GL after groom',await page.evaluate(()=>document.getElementById('fiberFrame').contentWindow.FiberStudy.diagnostics().glError===0));
    await page.locator('#catalogHomeButton').click();
    await page.locator('#catalogGroom').click();
    await ready();
    await page.waitForTimeout(120);
    const othersBefore = await snapshot();
    await page.waitForFunction(before=>{const r=document.getElementById('groomFrame')?.contentWindow?.GroomStudy;return r?.stats.active&&r.stats.running&&r.stats.frames>=before.frames+2&&r.exportState().time>before.time;},{frames:othersBefore.stats.frames,time:othersBefore.state.time},{timeout:20000,polling:100});
    const othersAfter = await snapshot();
    assert('groom resumes previous playback and other objects remain paused', othersAfter.stats.active && othersAfter.stats.frames > othersBefore.stats.frames &&
      othersAfter.rabbitFrames === othersBefore.rabbitFrames && othersAfter.anemoneFrames === othersBefore.anemoneFrames && othersAfter.anemoneTime === othersBefore.anemoneTime && othersAfter.fiberFrames === othersBefore.fiberFrames && othersAfter.fiberTime === othersBefore.fiberTime, {othersBefore, othersAfter});
    assert('no source/runtime errors in normal desktop flow', !report.errors.length && !othersAfter.errors.length && !othersAfter.groomErrors.length, report.errors);
    // pagehide is the actual event subscribed by the host. Keep an API reference
    // to prove dispose ran before removing the iframe, rather than merely hiding it.
    const disposed = await page.evaluate(() => {
      const r = document.getElementById('groomFrame').contentWindow.GroomStudy;
      window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
      return {disposed: r.stats.disposed, raf: r.stats.raf, frame: !!document.getElementById('groomFrame')};
    });
    assert('pagehide disposes GL/RAF before iframe removal', disposed.disposed && !disposed.raf && !disposed.frame, disposed);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})));
    await ready();
    assert('back-forward restoration creates a fresh usable instance', (await snapshot()).state.state.beard === saved.state.beard);

    await openPage('portrait', {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    await nativeTap(page.locator('#catalogGroom'), 'fourth catalog card');
    await ready();
    await gl();
    await reachable(page.locator('#catalogHomeButton'), 'outer 首页 return');
    await capture('groom-mobile-stage');
    const canvas=child().locator('#groomCanvas');await reachable(canvas,'mobile groom canvas');const canvasBox=await canvas.boundingBox();
    const cameraBefore=(await snapshot()).state.camera;const cdp=await page.context().newCDPSession(page);
    const cx=canvasBox.x+canvasBox.width*.5,cy=canvasBox.y+canvasBox.height*.45;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+45,y:cy-15,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const cameraDragged=(await snapshot()).state.camera;assert('native one-finger drag rotates the head camera',cameraDragged.yaw!==cameraBefore.yaw||cameraDragged.pitch!==cameraBefore.pitch,{cameraBefore,cameraDragged});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-50,y:cy,id:1},{x:cx+50,y:cy,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    const cameraPinched=(await snapshot()).state.camera;assert('native pinch changes actual head zoom',cameraPinched.zoom!==cameraDragged.zoom,{cameraDragged,cameraPinched});
    await nativeTap(child().locator('#resetCamera'),'groom camera reset');assert('head camera reset exact',JSON.stringify((await snapshot()).state.camera)===JSON.stringify(cameraBefore));

    const controls = ['play','front','profile','back','resetCamera','capture','export','import','reset','sweep','volume','length','beard','curl','clump','frizz','density','roughness','tone','showHair','showBeard','showMoustache','showBrows','reseed'];
    for (const id of controls) await reachable(child().locator('#' + id), 'complete child control ' + id);
    await capture('groom-mobile-controls');
    const range = child().locator('#beard');
    await reachable(range, 'mobile beard slider');
    const initialBeard = (await snapshot()).state.state.beard;
    const box = await range.boundingBox();
    await range.evaluate(el => {el.__groomInput = null; el.addEventListener('input', e => {el.__groomInput = {trusted: e.isTrusted, value: Number(el.value)};});});
    await page.touchscreen.tap(box.x + box.width * .72, box.y + box.height / 2);
    const nativeInput = await range.evaluate(el => el.__groomInput);
    const mobileSaved = (await snapshot()).state.state;
    assert('native mobile range changes the actual parameter', nativeInput?.trusted && mobileSaved.beard !== initialBeard && mobileSaved.beard === nativeInput.value, {nativeInput, mobileSaved});
    await page.setViewportSize({width: 390, height: 690});
    await reachable(page.locator('#catalogHomeButton'), '首页 after viewport shrink');
    const viewport = await page.evaluate(() => {
      const b = document.getElementById('groomFrame').getBoundingClientRect();
      return {top: b.top, bottom: b.bottom, vh: visualViewport?.height || innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1};
    });
    assert('safe dynamic viewport contains the whole iframe', !viewport.overflow && viewport.top >= 0 && viewport.bottom <= viewport.vh + 1, viewport);
    await nativeTap(page.locator('#catalogHomeButton'), 'outer 首页');
    await assertHiddenFrozen('mobile hidden groom');
    await nativeTap(page.locator('#catalogGroom'), 'mobile reentry');
    await ready();
    assert('mobile edits survive home switching', JSON.stringify((await snapshot()).state.state) === JSON.stringify(mobileSaved), mobileSaved);

    await openPage('interrupted');
    await page.evaluate(() => {platform.select('groom'); platform.select('home'); platform.select('groom'); platform.select('home');});
    await wait(() => groomCatalog.ready);
    assert('rapid enter/leave finishes hidden without returning from home', (await snapshot()).module === 'home' && await page.locator('#groomFrame').count() === 1);
    await assertHiddenFrozen('load completing after rapid leave');
    await page.locator('#catalogGroom').click();
    await ready();
    await gl();

    // Controlled failure uses an inert, valid document instead of altering the
    // immutable module or relying on network instability. Retry restores the
    // original offline payload or online URL, and no extra context is launched.
    await openPage('retry', {}, true);
    await page.evaluate(() => {window.__originalGroomHtml = window.GROOM_MODULE_HTML; window.GROOM_MODULE_HTML = '<!doctype html><title>Controlled load failure</title><p>No module in this test document</p>';});
    await page.locator('#catalogGroom').click();
    await wait(() => groomCatalog.status === 'error');
    assert('load error is visible with retry and usable 首页', await page.locator('#groomRetry').isVisible() && await page.locator('#catalogHomeButton').isVisible() && await page.locator('#groomFrame').count() === 0,
      await page.locator('#groomLoadMessage').textContent());
    await page.locator('#catalogHomeButton').click();
    assert('load error never traps the user', await page.evaluate(() => platform.module === 'home'));
    await page.locator('#catalogGroom').click();
    await page.evaluate(() => {if (typeof window.__originalGroomHtml === 'string') window.GROOM_MODULE_HTML = window.__originalGroomHtml; else delete window.GROOM_MODULE_HTML;});
    await page.locator('#groomRetry').click();
    await wait(() => groomCatalog.ready && document.getElementById('groomFrame').contentWindow.GroomStudy.ready);
    await gl();
    assert('retry produces one usable frame and clears the error UI', await page.locator('#groomFrame').count() === 1 && !await page.locator('#groomRetry').isVisible());
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
    fs.writeFileSync(path.join(outDir, 'groom-catalog-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
};
