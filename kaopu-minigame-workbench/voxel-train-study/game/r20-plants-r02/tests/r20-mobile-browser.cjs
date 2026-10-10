'use strict';
/* Official CI only: actual Chromium WebGL with a touch-enabled phone viewport.
 * Never use this test to bypass the local Chromium socket/access restriction.
 * No app interception, source suffix, Session placement, synthetic game events,
 * clock override, or fixture teleport. Only trusted touch controls change play.
 * --self-check validates the dependency manifest without loading Playwright.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {clickTarget, controlGeometry, assertControlGeometry} = require('../../tests/browser-controls.cjs');
const gameDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(gameDir, '../../../..');
const defaultURL = 'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r20/';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.split(path.sep).join('/');

function sourceManifest(target) {
  const base = new URL('./', target), publicRoot = new URL(slash(path.relative(gameDir, repoRoot)) + '/', base);
  const expected = new Map();
  function add(file, recurse = false) {
    file = path.resolve(file);
    assert(file.startsWith(repoRoot + path.sep), 'Dependency escaped the checkout: ' + file);
    if (expected.has(file)) return;
    const bytes = fs.readFileSync(file);
    expected.set(file, {file: slash(path.relative(repoRoot, file)), url: new URL(slash(path.relative(gameDir, file)), base).href, sha256: sha(bytes), bytes: bytes.length});
    if (recurse) {
      const source = bytes.toString('utf8');
      for (const match of source.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]/g)) {
        add(path.resolve(path.dirname(file), match[1] || match[2]), true);
      }
    }
  }
  add(path.join(gameDir, 'app.mjs'), true);
  for (const relative of ['index.html', 'game.css', 'street/route.score.json', 'street/first-street.score.json', '../../icon.svg']) add(path.join(gameDir, relative));
  function localFile(url) {
    const value = new URL(url);
    if (value.origin !== publicRoot.origin || !value.pathname.startsWith(publicRoot.pathname)) return null;
    let relative = decodeURIComponent(value.pathname.slice(publicRoot.pathname.length));
    if (value.pathname === base.pathname) relative += 'index.html';
    const file = path.resolve(repoRoot, relative);
    return file.startsWith(repoRoot + path.sep) ? file : null;
  }
  return {base, publicRoot, expected, localFile};
}

// This only records input and WebGL calls; all wrapped methods retain their
// original arguments, result and receiver. No game globals are written.
function installObserver() {
  const contexts = [], inputs = [], shaderErrors = [], contextLosses = [];
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'click', 'keydown', 'keyup']) {
    document.addEventListener(type, event => {
      if (inputs.length < 2000) inputs.push({type, at: performance.now(), trusted: event.isTrusted, pointerType: event.pointerType || null, id: event.target.closest?.('button')?.id || event.target.id || null, camera: event.target.closest?.('[data-camera]')?.dataset.camera || null});
    }, {capture: true, passive: true});
  }
  document.addEventListener('webglcontextlost', event => contextLosses.push({at: performance.now(), id: event.target.id}), true);
  const getContext = HTMLCanvasElement.prototype.getContext, seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const gl = getContext.apply(this, args);
    if (!gl || !/^webgl/.test(args[0]) || seen.has(gl)) return gl;
    seen.add(gl);
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const row = {canvas: this.id, type: args[0], renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), version: gl.getParameter(gl.VERSION), drawCalls: 0, links: 0};
    contexts.push({gl, row});
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      if (!gl[name]) continue;
      const original = gl[name].bind(gl);
      gl[name] = (...values) => { row.drawCalls++; return original(...values); };
    }
    const compile = gl.compileShader.bind(gl), link = gl.linkProgram.bind(gl);
    gl.compileShader = shader => { const result = compile(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) shaderErrors.push({kind: 'compile', log: gl.getShaderInfoLog(shader)}); return result; };
    gl.linkProgram = program => { const result = link(program); row.links++; if (!gl.getProgramParameter(program, gl.LINK_STATUS)) shaderErrors.push({kind: 'link', log: gl.getProgramInfoLog(program)}); return result; };
    return gl;
  };
  window.__r20MobileObservation = () => ({contexts: contexts.map(({gl, row}) => ({...row, lost: gl.isContextLost(), error: gl.getError()})), inputs: inputs.slice(), shaderErrors: shaderErrors.slice(), contextLosses: contextLosses.slice()});
}

async function main() {
  const target = process.env.TRAIN_GAME_URL || defaultURL;
  const manifest = sourceManifest(target);
  if (process.argv.includes('--self-check')) {
    const local = sourceManifest(defaultURL);
    const hosted = sourceManifest('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/r20/');
    for (const mapping of [local, hosted]) {
      for (const [file, row] of mapping.expected) assert.equal(mapping.localFile(row.url), file);
      assert.equal(mapping.localFile(mapping.base.href), path.join(gameDir, 'index.html'));
      assert.equal(mapping.localFile('https://unrelated.invalid/app.mjs'), null);
      assert([...mapping.expected.keys()].some(file => file.endsWith('/vendor/three.module.js')), 'Shared Three dependency must be included');
      assert([...mapping.expected.keys()].some(file => !file.startsWith(gameDir + path.sep)), 'Shared dependencies must be included');
    }
    assert.equal(hosted.publicRoot.pathname, '/guilin-dem-pipeline/');
    assert.equal(local.publicRoot.pathname, '/');
    console.log('R20 mobile manifest self-check passed: ' + manifest.expected.size + ' required source/assets; localhost and Pages prefix mappings verified. No browser launched.');
    return;
  }
  const out = path.resolve(process.env.TRAIN_QA_OUT || 'train-r20-results/mobile');
  fs.mkdirSync(out, {recursive: true});
  const report = {
    pass: false, target, commit: process.env.GITHUB_SHA || null,
    environment: {platform: os.platform(), release: os.release(), viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: true, hasTouch: true, renderer: 'Chromium ANGLE SwiftShader'},
    scope: 'Actual WebGL and trusted touch on an emulated viewport. Not physical phone, Safari, mobile GPU performance, or entire-route acceptance.',
    fixtureStateWrites: false, runtimeSourceModified: false, readOnlyObserverSuffix: null,
    observation: 'Read-only WebGL/input observer installed before page load. Source responses are never intercepted or replaced.',
    expectedSources: [...manifest.expected.values()], sourceHashes: [], requests: [], network: [], errors: [], warnings: [], checkpoints: [], controls: [], screenshots: [], states: []
  };
  const write = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2));
  let browser, context, page, timer;
  const pending = [], fileSnapshots = new Map([...manifest.expected].map(([file, row]) => [file, row.sha256]));
  try {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Browser execution is reserved for approved official GitHub Actions CI; use --self-check locally.');
    const localHost = ['127.0.0.1', 'localhost', '[::1]'].includes(manifest.base.hostname);
    assert(localHost || manifest.base.protocol === 'https:', 'Public smoke target must use HTTPS');
    const {chromium} = require('playwright');
    report.environment.playwright = require('playwright/package.json').version;
    assert.equal(report.environment.playwright, '1.57.0', 'Use the pinned official Playwright 1.57.0 install');
    browser = await chromium.launch({headless: true, timeout: 90000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
    report.environment.browser = browser.version();
    context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block'});
    page = await context.newPage();
    page.setDefaultTimeout(90000);
    await page.addInitScript(installObserver);
    page.on('request', request => report.requests.push({url: request.url(), resourceType: request.resourceType()}));
    page.on('requestfailed', request => report.network.push({url: request.url(), failure: request.failure()?.errorText}));
    page.on('pageerror', error => report.errors.push(String(error)));
    page.on('console', message => {
      if (message.type() === 'error') report.errors.push(message.text());
      else if (message.type() === 'warning') report.warnings.push(message.text());
    });
    page.on('response', response => {
      if (response.status() >= 400) report.network.push({url: response.url(), status: response.status()});
      if (response.status() >= 300 && response.status() < 400) return;
      pending.push((async () => {
        const file = manifest.localFile(response.url());
        assert(file && fs.existsSync(file) && fs.statSync(file).isFile(), 'Unmapped runtime response: ' + response.url());
        const bytes = await response.body(), disk = fs.readFileSync(file);
        if (!fileSnapshots.has(file)) fileSnapshots.set(file, sha(disk));
        report.sourceHashes.push({url: response.url(), file: slash(path.relative(repoRoot, file)), bytes: bytes.length, sha256: sha(bytes), sourceSHA256: fileSnapshots.get(file), matches: sha(bytes) === fileSnapshots.get(file), readOnlyObserverSuffix: false});
      })().catch(error => report.errors.push('Source audit: ' + error.message)));
    });
    const run = async () => {
      const state = () => page.evaluate(() => __trainDriver.getState());
      const until = (predicate, arg, timeout = 90000) => page.waitForFunction(predicate, arg, {polling: 50, timeout});
      const save = async label => {const value = await state(); report.states.push({label, state: value}); write(); return value;};
      const geometry = async (label, selector) => {
        const value = await controlGeometry(page.locator(selector));
        report.controls.push({label, selector, ...value});
        assertControlGeometry(value);
        return value;
      };
      const tap = async (selector, label = selector) => {
        await geometry(label, selector);
        await clickTarget(page, selector, {touch: true});
      };
      const viewport = () => page.evaluate(() => {
        const root = document.querySelector('#driverGame'), canvas = document.querySelector('#gameScene'), vv = visualViewport;
        const rect = element => {const r = element.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};};
        return {inner: {width: innerWidth, height: innerHeight}, visual: vv ? {width: vv.width, height: vv.height, scale: vv.scale, offsetLeft: vv.offsetLeft, offsetTop: vv.offsetTop} : null, dpr: devicePixelRatio, maxTouchPoints: navigator.maxTouchPoints, orientation: screen.orientation?.type, layout: root.dataset.layout, rotated: root.dataset.rotated, root: rect(root), canvas: rect(canvas), drawingBuffer: [canvas.width, canvas.height]};
      });
      const assertViewport = (value, width, height) => {
        assert.equal(value.inner.width, width); assert.equal(value.inner.height, height); assert.equal(value.dpr, 1);
        assert(value.maxTouchPoints > 0); assert(value.visual, 'Effective visualViewport must be recorded');
        assert(Math.abs(value.visual.width - width) <= 1 && Math.abs(value.visual.height - height) <= 1);
        assert.equal(value.visual.scale, 1); assert(value.drawingBuffer.every(n => n > 0));
      };
      const png = async (name, options = {}) => {
        const bytes = await page.screenshot({path: path.join(out, name + '.png'), timeout: 90000, ...options});
        const dimensions = {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
        assert.deepEqual(dimensions, page.viewportSize()); assert(bytes.length > 12000, 'Screenshot unexpectedly small: ' + name);
        report.screenshots.push({name, ...dimensions, bytes: bytes.length, sha256: sha(bytes), pauseOverlayHiddenOnly: !!options.style});
      };
      const frozen = async label => {
        const before = await state(); assert(before.paused);
        // A real-time wait observes that the production clock actually stops.
        await page.waitForTimeout(300);
        const after = await state();
        for (const key of ['distance', 'elapsed', 'tick', 'velocity', 'door']) assert.equal(after[key], before[key], label + ': ' + key + ' changed while paused');
      };
      const checkpoint = async (name, width = 390, height = 844) => {
        if (!(await state()).paused) {await tap('#pause', name + '-pause'); await until(() => __trainDriver.getState().paused);}
        await until(() => !__trainDriver.getState().streetDistrict.pending);
        await frozen(name);
        const value = await state(), view = await viewport(); assertViewport(view, width, height);
        const observation = await page.evaluate(() => __r20MobileObservation());
        assert(value.frames > 0 && value.drawCalls > 0 && value.triangles > 0, 'Actual renderer must have drawn geometry');
        assert.equal(value.streetDistrict.status, 'active'); assert.deepEqual(value.streetDistrict.coverage.missing, []);
        assert(observation.contexts.some(row => row.canvas === 'gameScene' && row.drawCalls > 0 && row.links > 0), 'Actual WebGL draw/link evidence is required');
        for (const row of observation.contexts) {assert.equal(row.error, 0); assert.equal(row.lost, false);}
        assert.deepEqual(observation.shaderErrors, []); assert.deepEqual(observation.contextLosses, []);
        report.checkpoints.push({name, viewport: view, state: value, observation});
        await geometry(name + '-resume', '#resume');
        await png(name + '-paused-ui');
        // Screenshot-only CSS removes the pause sheet for a second city image.
        // The untouched UI capture above proves the pause, and Session stays
        // paused. The actual scene, camera, geometry and clock are not changed.
        await png(name + '-scene', {style: '#pauseScreen { visibility: hidden !important; }'});
        const after = await state(); assert.equal(after.distance, value.distance); assert.equal(after.elapsed, value.elapsed);
        write(); console.log('R20 mobile capture', name, 'distance', value.distance, 'viewport', view.visual);
      };
      const driveControls = async label => {
        for (const id of ['pause', 'accelerate', 'decelerate', 'brake', 'stationAction', 'openSettings', 'openCameraMenu']) await geometry(label, '#' + id);
      };
      const cameraMenu = async (label, cameras = ['city', 'platform', 'overview', 'front', 'rear', 'detail', 'platform']) => {
        for (const camera of cameras) {
          const prior = await state(); await tap('#openCameraMenu', label + '-open-camera-' + camera);
          await page.locator('#settingsScreen').waitFor({state: 'visible'}); await until(() => __trainDriver.getState().paused);
          await frozen(label + '-settings-' + camera);
          await tap('[data-camera="' + camera + '"]', label + '-camera-' + camera);
          await until(camera => __trainDriver.getState().cameraMode === camera, camera);
          assert.equal(await page.locator('[data-camera="' + camera + '"]').getAttribute('aria-pressed'), 'true');
          // Production selectCamera closes the menu and restores its prior pause
          // state. Reopen through the real control for each following selection.
          await page.locator('#settingsScreen').waitFor({state: 'hidden'});
          await until(paused => __trainDriver.getState().paused === paused, prior.paused);
        }
      };
      const brakeToRest = async () => {
        const target = await geometry('phone-hold-brake', '#brake'); assert(!target.disabled && !target.inert);
        const touch = await context.newCDPSession(page);
        try {
          // Playwright tap has no hold API. CDP sends real trusted touch input;
          // it does not dispatch a DOM event or call any game/state API.
          await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: target.x, y: target.y, radiusX: 1, radiusY: 1, force: 1, id: 1}]});
          await until(() => __trainDriver.getState().brake);
          await until(() => __trainDriver.getState().velocity === 0);
        } finally {
          await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
          await touch.detach();
        }
        await until(() => !__trainDriver.getState().brake);
        const stopped = await save('phone-native-touch-brake-stop');
        assert.equal(stopped.velocity, 0); assert.equal(stopped.throttle, 0);
      };

      const started = Date.now();
      const navigation = await page.goto(target, {waitUntil: 'domcontentloaded', timeout: 90000});
      assert(navigation?.ok(), 'Cold navigation failed');
      await until(() => window.__trainDriver?.ready && __trainDriver.getState().streetDistrict.status === 'active' && !__trainDriver.getState().streetDistrict.pending, undefined, 240000);
      report.readyMs = Date.now() - started; report.finalURL = page.url();
      assert.equal(new URL(page.url()).origin, manifest.base.origin);
      assert.equal(await page.evaluate(() => __trainDriver.version), 'kcr-kst1-r20');
      const cold = await save('cold-start'); assert.equal(cold.started, false); assert.equal(cold.distance, 0);
      assert.equal(await page.locator('#continueSaved').isVisible(), false, 'Fresh context must have no saved session');
      report.coldViewport = await viewport(); assertViewport(report.coldViewport, 390, 844);
      await geometry('cold-start', '#startGame'); await png('phone-cold-start');
      await tap('#startGame'); await until(() => __trainDriver.getState().started);
      await driveControls('phone-started');
      await checkpoint('phone-initial-pause');
      await tap('#resume'); await until(() => !__trainDriver.getState().paused);
      for (let i = 0; i < 2; i++) {
        await tap('#openSettings', 'settings-open-' + i); await page.locator('#settingsScreen').waitFor({state: 'visible'});
        await frozen('settings-open-' + i);
        await geometry('settings-open-' + i, '#closeSettings');
        if (i === 0) await png('phone-settings');
        await tap('#closeSettings', 'settings-close-' + i); await page.locator('#settingsScreen').waitFor({state: 'hidden'});
        await until(() => !__trainDriver.getState().paused);
      }
      await cameraMenu('phone');
      await until(() => __trainDriver.getState().station.canOpen);
      await tap('#stationAction', 'first-station-open-doors');
      await until(() => ['doors-opening', 'unloading', 'boarding', 'ready-depart'].includes(__trainDriver.getState().phase));
      await until(() => document.querySelector('#accelerate').disabled && document.querySelector('#decelerate').disabled);
      // Deliberately touch the disabled controls directly: the ordinary helper
      // correctly waits for enabled controls and cannot test this interlock.
      for (const id of ['accelerate', 'decelerate']) {
        const target = await geometry('door-interlock-' + id, '#' + id); assert(target.disabled);
        const before = await state(); await page.touchscreen.tap(target.x, target.y);
        const after = await state(); assert.equal(after.throttle, 0); assert.equal(after.velocity, 0); assert.equal(after.distance, before.distance);
        report.states.push({label: 'door-interlock-' + id, state: after});
      }
      await until(() => __trainDriver.getState().phase === 'ready-depart', undefined, 240000);
      const served = await save('first-station-served');
      assert.equal(served.station.index, 0); assert.equal(served.stats.stops, 1); assert.equal(served.stats.missed, 0);
      assert.equal(served.station.boarded, 3); assert.equal(served.station.alighted, 2); assert.equal(served.distance, 0);
      await checkpoint('phone-first-station');
      await tap('#resume'); await until(() => !__trainDriver.getState().paused);
      await tap('#stationAction', 'first-station-close-and-depart');
      await until(() => {const s = __trainDriver.getState(); return s.phase === 'running' && s.station.index === 1 && s.door === 0;});
      const departure = await save('native-departure'); assert.equal(departure.throttle, 1);
      await tap('#accelerate', 'native-traction-up'); await until(() => __trainDriver.getState().throttle === 2);
      await tap('#decelerate', 'native-traction-down'); await until(() => __trainDriver.getState().throttle === 1);
      // Observe native notch 1 movement and pause via the touch control at 20 m.
      // No screenshot or camera change occurs while approaching this checkpoint.
      await until(() => __trainDriver.getState().distance >= 20, undefined, 180000);
      await checkpoint('phone-native-20m');
      const travelled = await save('native-20m-paused');
      assert(travelled.distance >= 20 && travelled.distance < 160, 'Bounded native departure overshot the smoke-test corridor');
      assert.equal(travelled.station.index, 1); assert.equal(travelled.stats.stops, 1); assert.equal(travelled.stats.missed, 0);

      await tap('#resume', 'phone-resume-for-native-brake'); await until(() => !__trainDriver.getState().paused);
      await brakeToRest();
      await tap('#pause', 'phone-pause-after-native-brake'); await until(() => __trainDriver.getState().paused);
      const orientationDistance = (await state()).distance;

      // Orientation is an actual viewport resize of the same touch context and
      // same paused journey, not a new desktop session or reset placement.
      await page.setViewportSize({width: 1024, height: 600});
      await until(() => innerWidth === 1024 && innerHeight === 600 && !__trainDriver.getState().streetDistrict.pending);
      await checkpoint('landscape-same-native-position', 1024, 600);
      assert.equal((await state()).distance, orientationDistance);
      await tap('#resume', 'landscape-resume'); await until(() => !__trainDriver.getState().paused);
      await driveControls('landscape-started'); await cameraMenu('landscape', ['city', 'platform']);
      await tap('#pause', 'landscape-final-pause'); await until(() => __trainDriver.getState().paused);
      await frozen('landscape-final');
      report.final = await state(); report.observationFinal = await page.evaluate(() => __r20MobileObservation());
      report.replayPacket = await page.evaluate(() => __trainDriver.exportReplay());
      const {replay} = await import(pathToFileURL(path.join(gameDir, 'session.mjs')).href);
      const replayed = replay(report.replayPacket).view();
      for (const key of ['tick', 'distance', 'velocity', 'elapsed', 'phase', 'paused', 'throttle', 'door', 'stats', 'actors']) assert.deepEqual(replayed[key], report.final[key], 'Native touch replay mismatch: ' + key);
      report.replayMatches = true;
      const inputs = report.observationFinal.inputs;
      assert(!inputs.some(event => event.type === 'keydown' || event.type === 'keyup'), 'Smoke journey must use touch, not keyboard');
      for (const id of ['startGame', 'pause', 'resume', 'stationAction', 'accelerate', 'decelerate', 'brake', 'openSettings', 'closeSettings', 'openCameraMenu']) {
        assert(inputs.some(event => event.id === id && event.trusted && event.type === 'pointerdown' && event.pointerType === 'touch'), 'Missing trusted touch evidence for #' + id);
      }
      assert(inputs.some(event => event.camera && event.trusted && event.pointerType === 'touch'), 'Missing trusted camera touch evidence');
      assert.deepEqual(report.observationFinal.shaderErrors, []); assert.deepEqual(report.observationFinal.contextLosses, []);
      assert.deepEqual(report.final.audio.errors, {});
      assert(report.final.frames > cold.frames, 'Render frames did not advance');
      // Await every response body seen so far; leave no quietly rejected audit.
      for (let cursor = 0; cursor < pending.length;) {const batch = pending.slice(cursor); cursor += batch.length; await Promise.all(batch);}
      for (const row of manifest.expected.values()) assert(report.sourceHashes.some(source => source.file === row.file && source.matches), 'Required runtime/shared dependency missing or mismatched: ' + row.file);
      assert(report.sourceHashes.every(source => source.matches), 'Fetched source/assets must match this checkout byte-for-byte');
      for (const [file, original] of fileSnapshots) assert.equal(sha(fs.readFileSync(file)), original, 'Checkout changed during source audit: ' + file);
      assert(!report.requests.some(row => /\/game\/r(?:0\d|1[0-8])\//.test(new URL(row.url).pathname)), 'Historical-version runtime dependency is forbidden');
      assert.deepEqual(report.errors, []); assert.deepEqual(report.network, []);
      assert(!report.warnings.some(value => /shader.*(?:error|fail)|context.*lost/i.test(value)), 'WebGL warning indicates shader/context failure');
      report.pass = true;
    };
    await Promise.race([run(), new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('R20 mobile smoke exceeded its 15-minute wall-clock bound')), 15 * 60 * 1000);})]);
  } catch (error) {
    report.failure = error.stack; console.error(error);
    if (page && !page.isClosed()) {
      await page.screenshot({path: path.join(out, 'failure.png'), timeout: 15000}).catch(() => {});
      await page.evaluate(() => ({state: window.__trainDriver?.getState?.(), observation: window.__r20MobileObservation?.()})).then(value => {report.failureState = value;}).catch(() => {});
    }
  } finally {
    clearTimeout(timer); write();
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
  if (!report.pass) process.exitCode = 1;
}
main().catch(error => {console.error(error); process.exitCode = 1;});
