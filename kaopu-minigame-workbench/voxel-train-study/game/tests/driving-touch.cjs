const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');
const engine = process.env.TRAIN_BROWSER || 'chromium';
assert(['chromium', 'webkit'].includes(engine), 'TRAIN_BROWSER must be chromium or webkit');
const out = process.env.TRAIN_TOUCH_QA_DIR || 'driving-touch-' + engine;
const base = process.env.TRAIN_GAME_URL || 'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const harness = fs.readFileSync(path.join(__dirname, 'browser-harness.mjs'), 'utf8');
fs.mkdirSync(out, {recursive: true});

(async () => {
  const browser = await ({chromium, webkit})[engine].launch();
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, hasTouch: true, acceptDownloads: true});
  const page = await context.newPage(), errors = [], checks = [], uiAudits = [], gestures = [];
  let phase = 'load', fixtureInstalled = false;
  page.on('pageerror', error => errors.push(error.message));
  // Observe trusted input without replacing handlers or exposing a production test API.
  await page.addInitScript(() => {
    window.__touchQaEvents = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'selectstart']) document.addEventListener(type, event => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      window.__touchQaEvents.push({type, id: target?.closest('button,a,input,select,textarea')?.id || target?.id || '', pointerType: event.pointerType || '', defaultPrevented: event.defaultPrevented});
    });
  });
  const state = () => page.evaluate(() => __trainDriver.getState());
  const selectionEmpty = async () => assert.equal(await page.evaluate(() => getSelection().toString()), '', phase + ': no selected game text');
  const screenshot = name => page.screenshot({path: path.join(out, name + '.png'), timeout: 10000});
  const eventsSince = start => page.evaluate(n => __touchQaEvents.slice(n), start);
  const center = async selector => {
    const locator = page.locator(selector);
    await locator.waitFor({state: 'visible'});
    await page.waitForFunction(selector => !document.querySelector(selector)?.closest('button')?.disabled, selector);
    await locator.scrollIntoViewIfNeeded();
    const p = await locator.evaluate(el => {
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
      return {x, y, width: r.width, height: r.height, reachable: hit === el || el.contains(hit), viewport: [innerWidth, innerHeight]};
    });
    assert(p.width > 0 && p.height > 0 && p.x >= 0 && p.y >= 0 && p.x < p.viewport[0] && p.y < p.viewport[1], phase + ': offscreen control ' + selector);
    assert(p.reachable, phase + ': another element intercepts ' + selector);
    return {x: p.x, y: p.y};
  };
  const tap = async id => {
    const p = await center('#' + id), begin = await page.evaluate(() => __touchQaEvents.length);
    await page.touchscreen.tap(p.x, p.y);
    assert((await eventsSince(begin)).some(e => e.type === 'pointerdown' && e.pointerType === 'touch' && e.id === id), phase + ': trusted native touch reaches ' + id);
  };
  const freezeCheck = async () => {
    const before = await state();
    assert.equal(before.paused, true);
    await page.waitForTimeout(400);
    const after = await state();
    for (const key of ['tick', 'elapsed', 'distance', 'velocity']) assert.equal(after[key], before[key], 'Pause freezes ' + key);
    assert.equal(after.brake, false, 'Pause clears held braking');
    return before;
  };
  const freshSameRoute = async seed => {
    await page.waitForFunction(() => __trainDriver.getState().started && !__trainDriver.getState().paused && __trainDriver.getState().phase !== 'summary');
    const fresh = await state();
    assert.equal(fresh.seed, seed, 'Same-route restart keeps the route seed');
    assert.equal(fresh.station.index, 0);
    assert.equal(fresh.stats.score, 0);
    assert.equal(fresh.stats.stops, 0);
    assert.equal(fresh.throttle, 0);
    assert.equal(fresh.brake, false);
    assert.ok(fresh.distance < .01, 'Restart begins at the original position');
    assert.ok(fresh.tick < 30, 'Restart resets simulation, rather than merely closing the overlay');
  };
  // Cover every non-editable node, including hidden button labels and SVG descendants.
  // Cancellable synthetic events test the guard, not an operating-system context menu.
  const auditUi = async label => {
    const audit = await page.evaluate(() => {
      const editable = 'input,textarea,select,option,[contenteditable]:not([contenteditable="false"])';
      const calloutSupported = CSS.supports('-webkit-touch-callout', 'none');
      const nodes = [...document.querySelectorAll('#driverGame, #driverGame *')].filter(el => !el.closest(editable));
      const failures = [], buttonIds = [], textFailures = [];
      for (const el of nodes) {
        const id = el.id || el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].join('.') : ''), style = getComputedStyle(el);
        if (style.userSelect !== 'none' && style.webkitUserSelect !== 'none') failures.push({id, reason: 'selectable', userSelect: style.userSelect, webkitUserSelect: style.webkitUserSelect});
        if (calloutSupported && style.getPropertyValue('-webkit-touch-callout') !== 'none') failures.push({id, reason: 'callout enabled'});
        if (el.matches('button')) buttonIds.push(el.id || '(unnamed button)');
        for (const type of ['selectstart', 'contextmenu']) {
          const event = new Event(type, {bubbles: true, cancelable: true});
          if (el.dispatchEvent(event) || !event.defaultPrevented) failures.push({id, reason: type + ' was not canceled'});
          for (const node of el.childNodes) {
            if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
            const textEvent = new Event(type, {bubbles: true, cancelable: true});
            if (node.dispatchEvent(textEvent) || !textEvent.defaultPrevented) textFailures.push({id, type, text: node.textContent.trim()});
          }
        }
      }
      return {nodeCount: nodes.length, buttonIds, calloutSupported, failures, textFailures};
    });
    uiAudits.push({label, ...audit});
    assert.deepEqual(audit.failures, [], label + ': all non-editable UI is protected');
    assert.deepEqual(audit.textFailures, [], label + ': text-node event targets are protected');
    assert(audit.nodeCount > 80, 'Audit covers the whole game, not only driving controls');
    for (const id of ['startGame', 'continueSaved', 'pause', 'resume', 'restartPaused', 'restart', 'playAgain', 'newRoute', 'saveReplay']) assert(audit.buttonIds.includes(id), label + ': missing button ' + id);
  };
  const auditEditableExceptions = async () => {
    const result = await page.evaluate(() => {
      // Ephemeral DOM probes only; no production runtime or exported API changes.
      const host = document.createElement('div');
      host.innerHTML = '<textarea id="touchQaTextarea">Editable text</textarea><div contenteditable="true"><span id="touchQaEditableChild">Editable child text</span></div><div id="touchQaNonEditable" contenteditable="false">UI text</div>';
      document.querySelector('#startScreen .sheet').append(host);
      try {
        return ['seed', 'duration', 'touchQaTextarea', 'touchQaEditableChild', 'touchQaNonEditable'].map(id => {
          const el = document.getElementById(id), style = getComputedStyle(el), events = {};
          for (const type of ['selectstart', 'contextmenu']) {
            const event = new Event(type, {bubbles: true, cancelable: true});
            events[type] = {allowed: el.dispatchEvent(event), prevented: event.defaultPrevented};
          }
          return {id, userSelect: style.userSelect || style.webkitUserSelect, callout: style.getPropertyValue('-webkit-touch-callout'), events};
        });
      } finally { host.remove(); }
    });
    for (const item of result) {
      const editable = item.id !== 'touchQaNonEditable';
      assert.equal(item.userSelect === 'none', !editable, item.id + ': native editable selection');
      if (item.callout) assert.equal(item.callout, editable ? 'default' : 'none', item.id + ': editable callout exception');
      for (const event of Object.values(item.events)) {
        assert.equal(event.allowed, editable, item.id + ': cancellable dispatch');
        assert.equal(event.prevented, !editable, item.id + ': delegated guard exception');
      }
    }
    return result;
  };
  const pointerHold = async (id, {cancel = false} = {}) => {
    const p = await center('#' + id), start = await page.evaluate(() => __touchQaEvents.length);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    try {
      await page.waitForTimeout(1100);
      await selectionEmpty();
      if (cancel) {
        const outside = await page.evaluate(id => {
          const el = document.getElementById(id);
          for (const [x, y] of [[3, 3], [innerWidth - 3, 3], [3, innerHeight - 3], [innerWidth - 3, innerHeight - 3]]) {
            const hit = document.elementFromPoint(x, y);
            if (hit !== el && !el.contains(hit)) return {x, y};
          }
          throw new Error('No outside release point for ' + id);
        }, id);
        await page.mouse.move(outside.x, outside.y);
      }
    } finally { await page.mouse.up(); }
    const events = await eventsSince(start);
    assert(events.some(e => e.type === 'pointerdown' && e.id === id), 'Held pointer reaches ' + id);
    assert.equal(events.filter(e => e.type === 'click' && e.id === id).length, cancel ? 0 : 1, id + ': held pointer activates once; outside release cancels');
    await selectionEmpty();
    gestures.push({kind: 'held-pointer', id, canceledByOutsideRelease: cancel, events});
  };
  try {
    await page.goto(base);
    await page.waitForFunction(() => window.__trainDriver?.ready);
    assert.equal(await page.evaluate(() => typeof __trainDriver.test), 'undefined', 'Real input precedes the CI-only fixture');
    const response = await context.request.get(new URL('./game.css', base).href);
    assert(response.ok(), 'Read the actual served stylesheet');
    const css = await response.text();
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({selector: m[1].trim(), declarations: m[2]}));
    assert(rules.some(r => r.selector.split(',').map(s => s.trim()).includes('#driverGame') && /-webkit-user-select\s*:\s*none/.test(r.declarations) && /(?:^|;)\s*user-select\s*:\s*none/.test(r.declarations) && /-webkit-touch-callout\s*:\s*none/.test(r.declarations)), 'Game-root selection and iOS callout declarations are present');
    assert(rules.some(r => /input/.test(r.selector) && /textarea/.test(r.selector) && /select/.test(r.selector) && /contenteditable/.test(r.selector) && /user-select\s*:\s*text/.test(r.declarations) && /-webkit-touch-callout\s*:\s*default/.test(r.declarations)), 'Editable controls explicitly retain native selection/callout');
    phase = 'start-screen';
    await auditUi(phase);
    const editableExceptions = await auditEditableExceptions();
    await page.locator('#seed').fill('TOUCH-OLD-ROUTE');
    await tap('seed');
    await page.keyboard.press('ControlOrMeta+A');
    const selected = await page.locator('#seed').evaluate(el => ({start: el.selectionStart, end: el.selectionEnd, length: el.value.length, focused: document.activeElement === el}));
    assert.deepEqual(selected, {start: 0, end: 15, length: 15, focused: true}, 'Seed supports native touch focus followed by text selection');
    const routeSeed = 'TOUCH-REPLACED-ROUTE';
    await page.keyboard.insertText(routeSeed);
    assert.equal(await page.locator('#seed').inputValue(), routeSeed, 'Typing replaces selected text');
    for (const value of ['15', '20', '10']) {
      await page.locator('#duration').selectOption(value);
      assert.equal(await page.locator('#duration').inputValue(), value, 'Duration select remains functional');
    }
    await tap('startGame');
    await page.waitForFunction(() => __trainDriver.getState().started);
    assert.equal((await state()).seed, routeSeed);
    assert.equal(await page.locator('#startScreen').isVisible(), false);
    await selectionEmpty();
    // Preserve original real-driving assertions in all three layouts; no fixture commands.
    for (const size of [{width: 390, height: 844, layout: 'landscape'}, {width: 390, height: 844, layout: 'portrait'}, {width: 844, height: 390, layout: 'landscape'}]) {
      phase = 'live-' + size.width + 'x' + size.height + '-' + size.layout;
      await page.setViewportSize({width: size.width, height: size.height});
      await tap(size.layout + 'View');
      await page.waitForTimeout(120);
      await auditUi(phase);
      assert.equal(await page.locator('#accelerate').evaluate(el => getComputedStyle(el).touchAction), 'manipulation');
      await tap('accelerate'); await tap('accelerate');
      const throttle = (await state()).throttle;
      await tap('decelerate');
      assert.equal((await state()).throttle, throttle - 1);
      await page.waitForFunction(() => __trainDriver.getState().velocity > .1);
      const speed = (await state()).velocity, p = await center('#brake');
      await page.mouse.move(p.x, p.y); await page.mouse.down();
      await page.waitForFunction(() => __trainDriver.getState().brake);
      await page.waitForTimeout(1100);
      assert.equal((await state()).brake, true);
      assert((await state()).velocity < speed, 'Holding brake genuinely slows the train');
      await page.mouse.move(5, 5); await page.mouse.up();
      await page.waitForFunction(() => !__trainDriver.getState().brake);
      await selectionEmpty();
      await tap('pause');
      assert.equal(await page.locator('#pauseScreen').isVisible(), true);
      const paused = await freezeCheck();
      await auditUi(phase + '-pause-screen');
      await screenshot(phase + '-pause');
      await tap('resume');
      await page.waitForFunction(tick => !__trainDriver.getState().paused && __trainDriver.getState().tick > tick, paused.tick);
      assert.equal(await page.locator('#pauseScreen').isVisible(), false);
      await tap('pause'); await tap('restartPaused');
      await freshSameRoute(routeSeed);
      checks.push({size, allGameUiProtected: true, buttonTouchAction: 'manipulation', nativeTaps: true, holdBrake: true, actualDeceleration: true, releaseOutside: true, pauseFreezesSimulation: true, resumeAdvances: true, sameRouteRestart: true, selectionEmpty: true});
    }
    phase = 'long-hold';
    if (engine === 'chromium') {
      const cdp = await context.newCDPSession(page);
      let touchId = 1;
      const holdTouch = async (selector, {cancel = false, during} = {}) => {
        const p = await center(selector), start = await page.evaluate(() => __touchQaEvents.length);
        const id = await page.locator(selector).evaluate(el => el.closest('button').id);
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...p, id: touchId++}]});
        try {
          await page.waitForTimeout(1100); await selectionEmpty();
          if (during) await during();
        } finally { await cdp.send('Input.dispatchTouchEvent', {type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: []}); }
        await page.waitForTimeout(100);
        const events = await eventsSince(start);
        assert(events.some(e => e.type === 'pointerdown' && e.pointerType === 'touch' && e.id === id), 'CDP touch reaches ' + id);
        // Brake intentionally suppresses compatibility click in pointerdown.
        if (id !== 'brake') assert.equal(events.filter(e => e.type === 'click' && e.id === id).length, cancel ? 0 : 1, id + ': completed hold activates once; canceled hold never activates');
        if (cancel) assert(events.some(e => e.type === 'pointercancel' && e.id === id), id + ': cancellation reaches the pointer handler');
        await selectionEmpty();
        gestures.push({kind: 'chromium-cdp-touch', id, canceled: cancel, events});
      };
      try {
        await holdTouch('#pause', {cancel: true, during: async () => assert.equal((await state()).paused, false)});
        assert.equal((await state()).paused, false, 'Canceled pause touch does not pause');
        await holdTouch('#pause');
        const paused = await freezeCheck();
        await holdTouch('#restartPaused', {cancel: true});
        assert.equal((await state()).paused, true, 'Canceled restart stays paused');
        assert.equal((await state()).tick, paused.tick, 'Canceled restart does not reset the session');
        await holdTouch('#restartPaused'); await freshSameRoute(routeSeed);
        const before = (await state()).throttle;
        await holdTouch('#accelerate span');
        assert.equal((await state()).throttle, before + 1, 'Long-held label increments throttle exactly once');
        await page.waitForFunction(() => __trainDriver.getState().velocity > .1);
        await holdTouch('#brake', {cancel: true, during: async () => assert.equal((await state()).brake, true)});
        await page.waitForFunction(() => !__trainDriver.getState().brake);
      } finally { await cdp.detach(); }
    } else {
      // WebKit exposes trusted touchscreen taps, not native touchStart/touchEnd through Playwright.
      // Held mouse/pointer checks must not be represented as real iOS long presses.
      await pointerHold('pause');
      const paused = await freezeCheck();
      await pointerHold('restartPaused', {cancel: true});
      assert.equal((await state()).paused, true);
      assert.equal((await state()).tick, paused.tick, 'Outside release cancels held restart');
      await pointerHold('restartPaused'); await freshSameRoute(routeSeed);
    }
    phase = 'saved-journey-native-tap';
    await tap('pause'); const saved = await freezeCheck();
    await page.reload(); await page.waitForFunction(() => window.__trainDriver?.ready);
    assert.equal(await page.evaluate(() => typeof __trainDriver.test), 'undefined');
    assert.equal(await page.locator('#continueSaved').isVisible(), true);
    await auditUi('start-screen-with-saved-journey');
    await tap('continueSaved');
    await page.waitForFunction(() => __trainDriver.getState().started && !__trainDriver.getState().paused);
    assert.equal((await state()).seed, routeSeed);
    assert((await state()).tick >= saved.tick, 'Continue restores rather than restarts the saved session');
    assert((await state()).frames > 0); assert.deepEqual(errors, []);
    await screenshot('production-controls');
    // Real-input assertions above use the unmodified module. The existing CI-only adapter
    // accelerates only timeout-summary setup below, instead of waiting ten wall-clock minutes.
    phase = 'summary-fixture-setup';
    const appPath = new URL('./app.mjs', base).pathname;
    await page.route(url => url.pathname === appPath, async route => {
      const response = await route.fetch();
      await route.fulfill({response, body: (await response.text()) + '\n' + harness});
    });
    await page.reload(); await page.waitForFunction(() => window.__trainDriver?.test);
    fixtureInstalled = true;
    const showSummary = async seed => {
      await page.evaluate(seed => {
        const api = __trainDriver; api.test.start({seed, durationMinutes: 10});
        const game = api.test.session();
        for (let batch = 0; batch < 120 && game.phase !== 'summary'; batch++) game.stepTicks(300);
        api.test.stepTicks(0);
      }, seed);
      assert.equal((await state()).phase, 'summary', 'Real authority ticks reach timeout summary');
      assert.equal(await page.locator('#summaryScreen').isVisible(), true);
      await auditUi('summary-screen');
    };
    const summaryChecks = [];
    for (const size of [{width: 390, height: 844, layout: 'portrait'}, {width: 844, height: 390, layout: 'landscape'}]) {
      phase = 'summary-' + size.layout;
      await page.evaluate(seed => __trainDriver.test.start({seed, durationMinutes: 10}), routeSeed);
      await page.setViewportSize({width: size.width, height: size.height}); await tap(size.layout + 'View');
      await showSummary(routeSeed); await screenshot(phase);
      const expectedReplay = await page.evaluate(() => __trainDriver.exportReplay());
      const downloadPromise = page.waitForEvent('download'); await tap('saveReplay');
      const download = await downloadPromise;
      assert.equal(await download.failure(), null);
      const replayFile = path.join(out, 'touch-replay-' + size.layout + '.json');
      await download.saveAs(replayFile);
      const replay = JSON.parse(fs.readFileSync(replayFile, 'utf8'));
      assert(replay.signature, 'Replay includes authoritative signature');
      const {signature, ...packet} = replay;
      assert.deepEqual(packet, expectedReplay, 'Replay button downloads exactly the current session');
      assert.equal((await state()).phase, 'summary', 'Saving replay leaves summary open');
      await tap('playAgain'); await freshSameRoute(routeSeed);
      assert.equal(await page.locator('#summaryScreen').isVisible(), false);
      await showSummary(routeSeed); await tap('newRoute');
      await page.waitForFunction(seed => __trainDriver.getState().seed !== seed && __trainDriver.getState().phase !== 'summary', routeSeed);
      assert.equal((await state()).started, true); assert.equal((await state()).station.index, 0); assert.equal((await state()).stats.score, 0);
      assert.equal(await page.locator('#summaryScreen').isVisible(), false); await selectionEmpty();
      summaryChecks.push({size, allButtonTextProtected: true, nativeReplayDownload: true, downloadedReplayMatches: true, nativeSameRouteRestart: true, nativeNewRoute: true});
    }
    assert.deepEqual(errors, []);
    const result = {
      engine, status: 'passed', url: base, productionRuntimeWithoutFixture: true,
      fixtureScope: 'Only deterministic timeout-summary preparation, after production driving and saved-journey checks pass',
      cssScope: 'All non-editable UI inside driverGame, including start, pause and summary screens',
      editableExceptions, seedSelectionAndReplacement: true, durationOptions: ['15', '20', '10'],
      iosCalloutRulePresent: true, realIosSystemMenuValidated: false,
      nativeTouchHold: engine === 'chromium' ? 'Chromium CDP touchStart / touchEnd / touchCancel on pause, restart, acceleration label and brake' : 'WebKit trusted native taps plus held pointer and outside release; native iOS touch hold/system menu is not exposed by Playwright',
      checks, uiAudits, gestures, summaryChecks, errors
    };
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    await screenshot('controls'); console.log('DRIVING_TOUCH_PASS ' + engine);
  } catch (error) {
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({error: String(error), stack: error.stack, phase, fixtureInstalled, checks, uiAudits, gestures, errors, state: await state().catch(() => null), nativeEvents: await page.evaluate(() => window.__touchQaEvents || []).catch(() => [])}, null, 2));
    try { await screenshot('failure'); }
    catch (captureError) { fs.writeFileSync(path.join(out, 'failure-screenshot-warning.txt'), String(captureError)); }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
