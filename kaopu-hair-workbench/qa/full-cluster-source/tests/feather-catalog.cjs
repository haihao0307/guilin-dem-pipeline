'use strict';
const fs = require('fs');
const path = require('path');
const crypto=require('crypto');

// Uses the supplied browser only. No launch, installation or publishing. Each
// scenario owns its context; the caller's other catalog tests are unaffected.
module.exports = async function featherCatalog(browser, url, outDir, check) {
  fs.mkdirSync(outDir, {recursive: true});
  const report = {
    timestamp: new Date().toISOString(), url, passed: false,
    physicalIPhoneTested: false, physicalSafariTested: false, visualAcceptance: false,
    tests: [], errors: [], expectedFailureErrors: [], requests: [], screenshots: [], lifecycle: [],
    scope: 'Fifth 羽毛 entry: chosen-only iframe, real GL, native touch, retained state, hidden RAF, full child controls, interrupted load, retry and existing objects'
  };
  const contexts = [];
  let page, currentContext, phase = 'desktop';
  const assert = (name, pass, detail) => {
    const test = {name: 'feather catalog ' + phase + ': ' + name, pass: !!pass, detail};
    report.tests.push(test);
    if (check) check(test.name, test.pass, detail);
    if (!test.pass) throw Error(test.name + ': ' + JSON.stringify(detail));
  };
  const wait = (fn, timeout = 120000) => page.waitForFunction(fn, null, {timeout});
  const child = () => page.frameLocator('#featherFrame');
  const snapshot = () => page.evaluate(() => {
    const r = document.getElementById('featherFrame')?.contentWindow?.FeatherStudy;
    return {
      module: platform.module, body: document.body.dataset.module, status: featherCatalog.status,
      ready: r?.ready || false, stats: r?.stats || null, state: r?.exportState() || null,
      featherErrors: [...featherCatalog.errors, ...(r?.errors || [])],
      rabbitFrames: document.getElementById('candidateFrame')?.contentWindow?.runtime?.frameCount || 0,
      anemoneFrames: anemone.metrics()?.frames || 0,
      anemoneTime: anemone.state.time,
      fiberFrames: document.getElementById('fiberFrame')?.contentWindow?.FiberStudy?.stats.frames || 0,
      fiberTime: document.getElementById('fiberFrame')?.contentWindow?.FiberStudy?.exportState().time || 0,
      groomFrames: document.getElementById('groomFrame')?.contentWindow?.GroomStudy?.stats.frames || 0,
      groomTime: document.getElementById('groomFrame')?.contentWindow?.GroomStudy?.exportState().time || 0,
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
    await wait(() => window.catalogUI && window.featherCatalog && platform.module === 'home');
    return context;
  };
  const ready = async () => {
    await wait(() => window.featherCatalog?.ready && document.getElementById('featherFrame')?.contentWindow?.FeatherStudy?.ready);
    const s = await snapshot();
    assert('selected module is ready and only one iframe exists', s.module === 'feather' && s.body === 'feather' &&
      s.ready && await page.locator('#featherFrame').count() === 1 && !s.featherErrors.length && !s.errors.length, s);
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
      el.__featherTap = null;
      el.addEventListener('click', e => {el.__featherTap = {trusted: e.isTrusted, type: e.pointerType};}, {once: true});
    });
    await locator.tap();
    const e = await locator.evaluate(el => el.__featherTap);
    assert(name + ' uses trusted native touch', e?.trusted && e.type === 'touch', e);
  };
  const gl = async () => {
    const p = await page.evaluate(() => {
      const r = document.getElementById('featherFrame').contentWindow.FeatherStudy;
      return {pixels: r.diagnostics(), stats: r.stats, errors: r.errors};
    });
    assert('real WebGL2 pixels and zero GL/runtime errors', p.pixels.glError === 0 && p.pixels.darkPixels > 500 && p.pixels.curveCount > 10000 && p.stats.frames > 0 && !p.errors.length, p);
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
      frame: !!document.getElementById('featherFrame'), feather: featherCatalog.stats,
      cards: Array.from(document.querySelectorAll('.catalog-grid > [data-catalog-object]')).map(c => ({
        object: c.dataset.catalogObject, image: c.querySelector('img')?.currentSrc,
        complete: c.querySelector('img')?.complete, width: c.querySelector('img')?.naturalWidth,
        height: c.querySelector('img')?.naturalHeight
      })),
      started: workbench.started, anemone: anemone.ready, kuko: kuko.ready,
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    }));
    assert('home has ordered Rabbit, Anemone, Fiber, Groom, Feather real thumbnails and no renderers',
      JSON.stringify(home.cards.map(c => c.object)) === JSON.stringify(['rabbit','anemone','fiber','groom','feather']) &&
      home.cards.every(c => c.complete && c.width >= 200 && c.height >= 100 && c.image.startsWith('data:image/jpeg;')) &&
      new Set(home.cards.map(c => c.image)).size === 5 && !home.frame && !home.feather && !home.started && !home.anemone && !home.kuko && !home.overflow,
      {...home, cards: home.cards.map(c => ({...c, image: c.image?.slice(0, 30)}))});
    assert('home never requests the feather module', !report.requests.some(r => r.phase === phase && /feather-study/.test(r.url)), report.requests);
    await capture('home-five-thumbnails');
    await page.locator('#catalogFeather').click();
    await ready();
    await gl();
    await capture('feather-first-entry');
    const mode = await page.evaluate(() => ({embedded: typeof FEATHER_MODULE_HTML === 'string',
      src: document.getElementById('featherFrame').getAttribute('src'), srcdoc: document.getElementById('featherFrame').hasAttribute('srcdoc')}));
    assert('offline embeds frozen document; online requests its relative URL only on entry', url.startsWith('file:') ? mode.embedded && mode.srcdoc && !mode.src : !mode.embedded && !mode.srcdoc && mode.src === './feather-study/index.html', mode);
    if ((await snapshot()).state.running) await child().locator('#play').click();
    await child().locator('#width').focus();
    await child().locator('#width').press('ArrowRight');
    const saved = (await snapshot()).state;
    assert('native control edits the actual feather parameter', Math.abs(saved.state.width - 1.01) < 1e-6 && !saved.running, saved);
    await page.locator('#catalogHomeButton').click();
    assert('home return focuses the fifth entry', await page.evaluate(() => platform.module === 'home' && document.activeElement.id === 'catalogFeather'));
    await assertHiddenFrozen('home-hidden feather');
    await page.locator('#catalogFeather').click();
    await ready();
    const restored = (await snapshot()).state;
    assert('home/reentry preserves parameters, camera, time and paused playback', JSON.stringify(restored) === JSON.stringify(saved), {saved, restored});
    // Start playback, then leave. The host must cancel the live RAF synchronously.
    await child().locator('#play').click();
    await wait(() => document.getElementById('featherFrame').contentWindow.FeatherStudy.stats.raf > 0);
    await page.locator('#catalogHomeButton').click();
    await assertHiddenFrozen('previously playing hidden feather');
    await page.locator('#catalogRabbit').click();
    await wait(() => platform.module === 'rabbit' && workbench.ready.candidate && document.getElementById('candidateFrame').contentWindow.runtime?.frameCount > 0, 180000);
    assert('Rabbit still works after feather', (await snapshot()).module === 'rabbit');
    await page.locator('#catalogHomeButton').click();
    await page.locator('#catalogAnemone').click();
    await wait(() => platform.module === 'anemone' && anemone.ready);
    const ap = await page.evaluate(() => {anemone.pause();anemone.seek(0);return anemone.pixels()});
    assert('Anemone still renders real GL after feather', ap.glError === 0 && ap.changed > 500, ap);
    assert('accepted Anemone default pixels remain exact after feather use',ap.hash===159461793&&ap.width===1440&&ap.height===685,ap);
    await page.locator('#catalogHomeButton').click();await page.locator('#catalogFiber').click();await wait(()=>fiberCatalog.ready&&document.getElementById('fiberFrame').contentWindow.FiberStudy.ready);assert('Fiber still renders real GL after feather',await page.evaluate(()=>document.getElementById('fiberFrame').contentWindow.FiberStudy.diagnostics().glError===0));
    await page.locator('#catalogHomeButton').click();await page.locator('#catalogGroom').click();await wait(()=>groomCatalog.ready&&document.getElementById('groomFrame').contentWindow.GroomStudy.ready);assert('Groom still renders real GL after feather',await page.evaluate(()=>document.getElementById('groomFrame').contentWindow.GroomStudy.diagnostics().glError===0));
    await page.locator('#catalogHomeButton').click();
    await page.locator('#catalogFeather').click();
    await ready();
    await page.waitForTimeout(120);
    const othersBefore = await snapshot();
    await page.waitForFunction(before=>{const r=document.getElementById('featherFrame')?.contentWindow?.FeatherStudy;return r?.stats.active&&r.stats.running&&r.stats.frames>=before.frames+2&&r.exportState().time>before.time;},{frames:othersBefore.stats.frames,time:othersBefore.state.time},{timeout:20000,polling:100});
    const othersAfter = await snapshot();
    assert('feather resumes previous playback and other objects remain paused', othersAfter.stats.active && othersAfter.stats.frames > othersBefore.stats.frames &&
      othersAfter.rabbitFrames === othersBefore.rabbitFrames && othersAfter.anemoneFrames === othersBefore.anemoneFrames && othersAfter.anemoneTime === othersBefore.anemoneTime && othersAfter.fiberFrames === othersBefore.fiberFrames && othersAfter.fiberTime === othersBefore.fiberTime && othersAfter.groomFrames === othersBefore.groomFrames && othersAfter.groomTime === othersBefore.groomTime, {othersBefore, othersAfter});
    assert('no source/runtime errors in normal desktop flow', !report.errors.length && !othersAfter.errors.length && !othersAfter.featherErrors.length, report.errors);
    // pagehide is the actual event subscribed by the host. Keep an API reference
    // to prove dispose ran before removing the iframe, rather than merely hiding it.
    const disposed = await page.evaluate(() => {
      const r = document.getElementById('featherFrame').contentWindow.FeatherStudy;
      window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
      return {disposed: r.stats.disposed, raf: r.stats.raf, frame: !!document.getElementById('featherFrame')};
    });
    assert('pagehide disposes GL/RAF before iframe removal', disposed.disposed && !disposed.raf && !disposed.frame, disposed);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})));
    await ready();
    assert('back-forward restoration creates a fresh usable instance', (await snapshot()).state.state.width === saved.state.width);

    await openPage('portrait', {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    await nativeTap(page.locator('#catalogFeather'), 'fifth catalog card');
    await ready();
    await gl();
    await reachable(page.locator('#catalogHomeButton'), 'outer 首页 return');
    await capture('feather-mobile-stage');
    const canvas=child().locator('#featherCanvas');await reachable(canvas,'mobile feather canvas');const canvasBox=await canvas.boundingBox();
    const cameraBefore=(await snapshot()).state.camera;const cdp=await page.context().newCDPSession(page);
    const cx=canvasBox.x+canvasBox.width*.5,cy=canvasBox.y+canvasBox.height*.45;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+45,y:cy-15,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const cameraDragged=(await snapshot()).state.camera;assert('native one-finger drag rotates the feather camera',cameraDragged.yaw!==cameraBefore.yaw||cameraDragged.pitch!==cameraBefore.pitch,{cameraBefore,cameraDragged});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-50,y:cy,id:1},{x:cx+50,y:cy,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    const cameraPinched=(await snapshot()).state.camera;assert('native pinch changes actual feather zoom',cameraPinched.zoom!==cameraDragged.zoom,{cameraDragged,cameraPinched});
    await nativeTap(child().locator('#resetCamera'),'feather camera reset');assert('feather camera reset exact',JSON.stringify((await snapshot()).state.camera)===JSON.stringify(cameraBefore));

    const controls = ['play','front','profile','back','macro','resetCamera','capture','export','import','reset','width','asymmetry','bend','twist','separation','down','wind','density','roughness','tone','showBarbules','showDown','reseed'];
    for (const id of controls) await reachable(child().locator('#' + id), 'complete child control ' + id);
    await capture('feather-mobile-controls');
    const range = child().locator('#width');
    await reachable(range, 'mobile feather width slider');
    const initialWidth = (await snapshot()).state.state.width;
    const box = await range.boundingBox();
    await range.evaluate(el => {el.__featherInput = null; el.addEventListener('input', e => {el.__featherInput = {trusted: e.isTrusted, value: Number(el.value)};});});
    await page.touchscreen.tap(box.x + box.width * .72, box.y + box.height / 2);
    const nativeInput = await range.evaluate(el => el.__featherInput);
    const mobileSaved = (await snapshot()).state.state;
    assert('native mobile range changes the actual parameter', nativeInput?.trusted && mobileSaved.width !== initialWidth && mobileSaved.width === nativeInput.value, {nativeInput, mobileSaved});
    await page.setViewportSize({width: 390, height: 690});
    await reachable(page.locator('#catalogHomeButton'), '首页 after viewport shrink');
    const viewport = await page.evaluate(() => {
      const b = document.getElementById('featherFrame').getBoundingClientRect();
      return {top: b.top, bottom: b.bottom, vh: visualViewport?.height || innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1};
    });
    assert('safe dynamic viewport contains the whole iframe', !viewport.overflow && viewport.top >= 0 && viewport.bottom <= viewport.vh + 1, viewport);
    await nativeTap(page.locator('#catalogHomeButton'), 'outer 首页');
    await assertHiddenFrozen('mobile hidden feather');
    await nativeTap(page.locator('#catalogFeather'), 'mobile reentry');
    await ready();
    assert('mobile edits survive home switching', JSON.stringify((await snapshot()).state.state) === JSON.stringify(mobileSaved), mobileSaved);

    await openPage('interrupted');
    await page.evaluate(() => {platform.select('feather'); platform.select('home'); platform.select('feather'); platform.select('home');});
    await wait(() => featherCatalog.ready);
    assert('rapid enter/leave finishes hidden without returning from home', (await snapshot()).module === 'home' && await page.locator('#featherFrame').count() === 1);
    await assertHiddenFrozen('load completing after rapid leave');
    await page.locator('#catalogFeather').click();
    await ready();
    await gl();

    // Controlled failure uses an inert, valid document instead of altering the
    // immutable module or relying on network instability. Retry restores the
    // original offline payload or online URL, and no extra context is launched.
    await openPage('retry', {}, true);
    await page.evaluate(() => {window.__originalFeatherHtml = window.FEATHER_MODULE_HTML; window.FEATHER_MODULE_HTML = '<!doctype html><title>Controlled load failure</title><p>No module in this test document</p>';});
    await page.locator('#catalogFeather').click();
    await wait(() => featherCatalog.status === 'error');
    assert('load error is visible with retry and usable 首页', await page.locator('#featherRetry').isVisible() && await page.locator('#catalogHomeButton').isVisible() && await page.locator('#featherFrame').count() === 0,
      await page.locator('#featherLoadMessage').textContent());
    await page.locator('#catalogHomeButton').click();
    assert('load error never traps the user', await page.evaluate(() => platform.module === 'home'));
    await page.locator('#catalogFeather').click();
    await page.evaluate(() => {if (typeof window.__originalFeatherHtml === 'string') window.FEATHER_MODULE_HTML = window.__originalFeatherHtml; else delete window.FEATHER_MODULE_HTML;});
    await page.locator('#featherRetry').click();
    await wait(() => featherCatalog.ready && document.getElementById('featherFrame').contentWindow.FeatherStudy.ready);
    await gl();
    assert('retry produces one usable frame and clears the error UI', await page.locator('#featherFrame').count() === 1 && !await page.locator('#featherRetry').isVisible());
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
    fs.writeFileSync(path.join(outDir, 'feather-catalog-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
};
