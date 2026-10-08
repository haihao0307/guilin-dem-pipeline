const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');
const {clickControl, openSettings, closeSettings} = require('./browser-controls.cjs');
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
  let phase = 'load', fixtureInstalled = false, lastResetClickMark = null;
  fs.writeFileSync(path.join(out, 'progress.jsonl'), '');
  const progress = (event, detail = {}) => {
    const record = {time: new Date().toISOString(), engine, phase, event, ...detail};
    console.log('DRIVING_TOUCH ' + JSON.stringify(record));
    fs.appendFileSync(path.join(out, 'progress.jsonl'), JSON.stringify(record) + '\n');
  };
  const enterPhase = name => { phase = name; progress('phase'); };
  const bounded = async (label, promise, milliseconds = 5000) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' timed out after ' + milliseconds + ' ms')), milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  };
  progress('phase');
  page.on('pageerror', error => errors.push(error.message));
  // Observe trusted input without replacing handlers or exposing a production test API.
  await page.addInitScript(() => {
    window.__touchQaEvents = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'selectstart']) document.addEventListener(type, event => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const id = target?.closest('button,a,input,select,textarea')?.id || target?.id || '';
      const entry = {type, id, pointerType: event.pointerType || '', defaultPrevented: event.defaultPrevented};
      if (type === 'click' && ['restartPaused', 'restart', 'playAgain'].includes(id)) {
        // The real target click handler has completed before bubbling to document.
        // Capture reset atomically in that event task, before a render tick can advance it.
        const v = window.__trainDriver?.getState();
        entry.resetSnapshot = v ? {
          documentTimeOrigin: performance.timeOrigin, sequence: window.__touchQaEvents.length,
          started: v.started, paused: v.paused, phase: v.phase, tick: v.tick, elapsed: v.elapsed,
          seed: v.seed, stationIndex: v.station.index, score: v.stats.score, stops: v.stats.stops,
          throttle: v.throttle, brake: v.brake, distance: v.distance
        } : null;
      }
      window.__touchQaEvents.push(entry);
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
    progress('tap-begin', {id});
    const begin = await page.evaluate(() => __touchQaEvents.length);
    await clickControl(page, id, {touch: true});
    assert((await eventsSince(begin)).some(e => e.type === 'pointerdown' && e.pointerType === 'touch' && e.id === id), phase + ': trusted native touch reaches ' + id);
    progress('tap-done', {id});
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
    const resetClick = await page.evaluate(() => [...__touchQaEvents].reverse().find(event => event.type === 'click' && ['restartPaused', 'restart', 'playAgain'].includes(event.id)) || null);
    assert(resetClick?.resetSnapshot, 'A trusted real restart click must produce a synchronous reset snapshot');
    const reset = resetClick.resetSnapshot, mark = reset.documentTimeOrigin + ':' + reset.sequence;
    assert.notEqual(mark, lastResetClickMark, 'Each restart assertion consumes a new trusted click, not an earlier reset');
    assert.equal(reset.tick, 0, 'The real restart click resets tick in its own event task');
    assert.equal(reset.elapsed, 0, 'The real restart click resets elapsed time in its own event task');
    assert.equal(reset.seed, seed, 'The real restart click keeps the same route');
    assert.equal(reset.stationIndex, 0);
    assert.equal(reset.score, 0);
    assert.equal(reset.stops, 0);
    assert.equal(reset.throttle, 0);
    assert.equal(reset.brake, false);
    assert.equal(reset.distance, 0);
    assert.equal(reset.started, true);
    assert.equal(reset.paused, false);
    assert.notEqual(reset.phase, 'summary');
    lastResetClickMark = mark;
    progress('restart-synchronous-reset-verified', {id: resetClick.id, reset});
    await page.waitForFunction(() => {const v=__trainDriver.getState();return v.started&&!v.paused&&v.phase!=='summary'&&v.tick>0&&v.elapsed>0;});
    const fresh = await state();
    assert(fresh.tick>0&&fresh.elapsed>0,'The restarted session advances again from its synchronous zero state');
    assert.equal(fresh.seed, seed, 'Same-route restart keeps the route seed');
    assert.equal(fresh.station.index, 0);
    assert.equal(fresh.stats.score, 0);
    assert.equal(fresh.stats.stops, 0);
    assert.equal(fresh.throttle, 0);
    assert.equal(fresh.brake, false);
    assert.ok(fresh.distance < .01, 'Restart begins at the original position');
    // No wall-clock tick ceiling here: slow browser round trips may legitimately advance time.
  };
  // Cover every non-editable node, including hidden button labels and SVG descendants.
  // Cancellable synthetic events test the guard, not an operating-system context menu.
  const auditUi = async label => {
    progress('ui-audit-begin', {label});
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
    for (const id of ['startGame', 'continueSaved', 'pause', 'openSettings', 'closeSettings', 'resume', 'restartPaused', 'restart', 'playAgain', 'newRoute', 'saveReplay']) assert(audit.buttonIds.includes(id), label + ': missing button ' + id);
    progress('ui-audit-done', {label, nodeCount: audit.nodeCount});
  };
  const auditEditableExceptions = async () => {
    const result = await page.evaluate(() => {
      // Ephemeral DOM probes only; no production runtime or exported API changes.
      const host = document.createElement('div');
      host.innerHTML = '<textarea id="touchQaTextarea">Editable text</textarea><div contenteditable="true"><span id="touchQaEditableChild">Editable child text</span></div><div id="touchQaNonEditable" contenteditable="false">UI text</div>';
      document.querySelector('#startScreen .sheet').append(host);
      try {
        return ['seed', 'duration', 'renderQuality', 'touchQaTextarea', 'touchQaEditableChild', 'touchQaNonEditable'].map(id => {
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
    enterPhase('start-screen');
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
      enterPhase('live-' + size.width + 'x' + size.height + '-' + size.layout);
      await page.setViewportSize({width: size.width, height: size.height});
      await tap(size.layout + 'View');
      await page.waitForTimeout(120);
      await openSettings(page, {touch: true});
      await freezeCheck();
      await auditUi(phase + '-settings-screen');
      await closeSettings(page, {touch: true});
      assert.equal((await state()).paused, false, 'Closing settings resumes a running journey');
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
      await tap('restart');
      await freshSameRoute(routeSeed);
      assert.equal(await page.locator('#settingsScreen').isVisible(), false, 'Settings restart dismisses the panel');
      checks.push({size, allGameUiProtected: true, buttonTouchAction: 'manipulation', nativeTaps: true, holdBrake: true, actualDeceleration: true, releaseOutside: true, pauseFreezesSimulation: true, resumeAdvances: true, sameRouteRestart: true, settingsRestart: true, settingsPauseFreezesSimulation: true, selectionEmpty: true});
    }
    enterPhase('long-hold');
    if (engine === 'chromium') {
      const cdp = await context.newCDPSession(page);
      let touchId = 1;
      const holdTouch = async (selector, {cancel = false, during} = {}) => {
        const p = await center(selector), start = await page.evaluate(() => __touchQaEvents.length);
        const id = await page.locator(selector).evaluate(el => el.closest('button').id);
        progress('cdp-touchStart-send', {id, cancel});
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...p, id: touchId++}]});
        progress('cdp-touchStart-ack', {id, cancel});
        try {
          await page.waitForTimeout(1100); await selectionEmpty();
          if (during) await during();
        } finally {
          progress('cdp-release-send', {id, cancel});
          await cdp.send('Input.dispatchTouchEvent', {type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: []});
          progress('cdp-release-ack', {id, cancel});
        }
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
      } finally { progress('cdp-detach-begin'); await cdp.detach(); progress('cdp-detach-done'); }
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
    enterPhase('saved-journey-native-tap');
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
    enterPhase('summary-fixture-setup');
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
      enterPhase('summary-' + size.layout);
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
      cssScope: 'All non-editable UI inside driverGame, including start, settings, pause and summary screens',
      editableExceptions, seedSelectionAndReplacement: true, durationOptions: ['15', '20', '10'],
      iosCalloutRulePresent: true, realIosSystemMenuValidated: false,
      nativeTouchHold: engine === 'chromium' ? 'Chromium CDP touchStart / touchEnd / touchCancel on pause, restart, acceleration label and brake' : 'WebKit trusted native taps plus held pointer and outside release; native iOS touch hold/system menu is not exposed by Playwright',
      checks, uiAudits, gestures, summaryChecks, errors
    };
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    await screenshot('controls'); progress('passed'); console.log('DRIVING_TOUCH_PASS ' + engine);
  } catch (error) {
    // Persist known evidence before awaiting anything from a possibly unresponsive renderer.
    const failure = {error: String(error), stack: error.stack, phase, fixtureInstalled, checks, uiAudits, gestures, errors};
    const writeFailure = () => fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify(failure, null, 2));
    writeFailure(); progress('failed', {error: String(error)});
    try { failure.state = await bounded('failure state collection', state()); }
    catch (diagnosticError) { failure.stateCollectionError = String(diagnosticError); }
    writeFailure();
    try { failure.nativeEvents = await bounded('failure native-event collection', page.evaluate(() => window.__touchQaEvents || [])); }
    catch (diagnosticError) { failure.eventCollectionError = String(diagnosticError); }
    writeFailure();
    try { await screenshot('failure'); }
    catch (captureError) { fs.writeFileSync(path.join(out, 'failure-screenshot-warning.txt'), String(captureError)); }
    throw error;
  } finally { await bounded('browser close', browser.close(), 10000); }
})().catch(error => { console.error(error); process.exit(1); });
