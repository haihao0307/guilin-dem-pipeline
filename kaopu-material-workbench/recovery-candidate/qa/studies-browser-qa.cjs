'use strict';

// Real Chromium QA only. This script starts no HTTP server and performs no uploads.
// Run with official playwright@1.55.0 installed and an existing candidate server:
// BASE=http://127.0.0.1:4173/candidate/ OUT=material-studies-qa node studies-browser-qa.cjs
// An existing launchServer endpoint can optionally be supplied as PW_WS_ENDPOINT.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = new URL(process.env.BASE || 'http://127.0.0.1:4173/candidate/');
if (!BASE.pathname.endsWith('/')) BASE.pathname += '/';
const STUDY_URL = new URL('study-r01/', BASE).href;
const OUT = path.resolve(process.env.OUT || path.join(__dirname, 'browser-results'));
const STEP_TIMEOUT_MS = 85000;
const IDS = ['05', '06', '07', '08', '09', '10'];
const LEGACY = {
  KAOPU_MATERIAL_R16: '{\n  "version": 17, "qaMarker": "R16 原字符串，保留空格与换行",\n  "states": {"synthetic": true}\n}\n',
  KAOPU_MATERIAL_R17: '  {"version":17,"qaMarker":"R17 原字符串 / Ω / 中文","states":{"synthetic":true}}  '
};
const AUDIT_KEY = '__KAOPU_STUDIES_QA_LEGACY_WRITES__';
const SEED_KEY = '__KAOPU_STUDIES_QA_SEEDED__';
const report = {
  startedAt: new Date().toISOString(), passed: false,
  scope: 'Focused repeat fullscreen and observation controls after the full 52-stage candidate pass',
  base: BASE.href, studyURL: STUDY_URL, playwrightVersion: require('playwright/package.json').version,
  browser: 'Chromium, launchServer/connect, SwiftShader', stepTimeoutMs: STEP_TIMEOUT_MS,
  steps: [], errors: [], consoleErrors: [], failedRequests: []
};
fs.mkdirSync(OUT, { recursive: true });
let owner, browser, context, page;

function bounded(promise, timeout = STEP_TIMEOUT_MS, label = 'operation') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} exceeded ${timeout} ms`)), timeout); })
  ]).finally(() => clearTimeout(timer));
}
function flush() {
  fs.writeFileSync(path.join(OUT, 'QA.json'), JSON.stringify(report, null, 2));
}
function log(status, name, extra = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), status, step: name, ...extra }));
}
async function step(name, work) {
  const entry = { name, startedAt: new Date().toISOString(), status: 'running' };
  report.steps.push(entry);
  flush(); log('START', name);
  const start = Date.now();
  try {
    entry.result = await bounded(Promise.resolve().then(work), STEP_TIMEOUT_MS, name);
    entry.status = 'passed';
    entry.elapsedMs = Date.now() - start;
    flush(); log('PASS', name, { elapsedMs: entry.elapsedMs });
    return entry.result;
  } catch (error) {
    entry.status = 'failed';
    entry.error = error.stack || String(error);
    entry.elapsedMs = Date.now() - start;
    flush(); log('FAIL', name, { elapsedMs: entry.elapsedMs, error: error.message });
    if (page && !page.isClosed()) {
      const filename = `failure-${String(report.steps.length).padStart(2, '0')}.png`;
      try {
        await bounded(page.screenshot({ path: path.join(OUT, filename), fullPage: true, timeout: 4500 }), 4800, 'failure screenshot');
        entry.screenshot = filename;
      } catch (screenshotError) { entry.screenshotError = screenshotError.message; }
    }
    flush();
    throw error;
  }
}
async function ready() {
  await page.waitForFunction(() => window.KAOPU_STUDIES?.ready === true, null, { timeout: 80000 });
  assert.equal(await page.locator('#error').isVisible(), false, 'The study error banner is visible');
}
async function state() { return page.evaluate(() => KAOPU_STUDIES.getState()); }
async function select(id) {
  await page.locator(`[data-case="${id}"]`).click();
  await page.waitForFunction(value => KAOPU_STUDIES.getState().active === value && KAOPU_STUDIES.packet()?.case === value, id);
  assert.equal(await page.locator(`[data-case="${id}"]`).getAttribute('aria-pressed'), 'true');
}
async function range(name, value) {
  const input = page.locator(`#studyControls input[data-path="${name}"]`);
  await input.evaluate((element, desired) => {
    element.value = String(desired);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  const actual = await input.inputValue();
  assert.equal(Number(actual), value, `${name}: the actual range input did not receive the value`);
  assert.equal((await state()).states[(await state()).active][name], value, `${name}: input did not update the selected study`);
}
async function snapshot(label = null, compareTo = null, redraw = true) {
  return page.evaluate(async ({ label, compareTo, redraw }) => {
    const api = KAOPU_STUDIES;
    if (redraw) api.draw();
    const canvas = document.getElementById('canvas');
    const bytes = Uint8Array.from(api.pixels());
    const cache = window.__KAOPU_STUDIES_QA_PIXELS ||= new Map();
    const previous = compareTo ? cache.get(compareTo) : null;
    if (compareTo && !previous) throw Error('Missing pixel comparison reference: ' + compareTo);
    if (previous && previous.length !== bytes.length) throw Error('Pixel comparison dimensions changed');
    let sum = 0, squared = 0, minimum = 255, maximum = 0, opaque = 0, changedPixels = 0, absoluteDifference = 0;
    const levels = new Set();
    for (let i = 0; i < bytes.length; i += 4) {
      const luma = .299 * bytes[i] + .587 * bytes[i + 1] + .114 * bytes[i + 2];
      sum += luma; squared += luma * luma;
      minimum = Math.min(minimum, luma); maximum = Math.max(maximum, luma);
      levels.add(Math.round(luma));
      if (bytes[i + 3] === 255) opaque++;
      if (previous) {
        const delta = Math.abs(bytes[i] - previous[i]) + Math.abs(bytes[i + 1] - previous[i + 1]) + Math.abs(bytes[i + 2] - previous[i + 2]);
        absoluteDifference += delta;
        if (delta > 3) changedPixels++;
      }
    }
    const count = bytes.length / 4, mean = sum / count;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('');
    if (label) cache.set(label, bytes);
    return {
      width: canvas.width, height: canvas.height, hash,
      pixels: count, opaque, lumaMean: mean, lumaStdDev: Math.sqrt(Math.max(0, squared / count - mean * mean)),
      lumaMin: minimum, lumaMax: maximum, distinctLumaLevels: levels.size,
      comparison: previous ? { reference: compareTo, changedPixels, meanAbsoluteRGBDifference: absoluteDifference / (count * 3) } : null,
      packet: api.packet(), glError: api.glError()
    };
  }, { label, compareTo, redraw });
}
function nonempty(frame, name) {
  assert.equal(frame.glError, 0, name + ': WebGL error');
  assert.ok(frame.width >= 128 && frame.height >= 72, name + ': invalid canvas size');
  assert.equal(frame.opaque, frame.pixels, name + ': unexpected transparent frame');
  assert.ok(frame.lumaStdDev > 5 && frame.lumaMax - frame.lumaMin > 24 && frame.distinctLumaLevels > 24, name + ': blank or nearly uniform image');
}
function changed(frame, name) {
  nonempty(frame, name);
  assert.ok(frame.comparison?.changedPixels > 64, name + ': input did not visibly change enough pixels');
  assert.ok(frame.comparison.meanAbsoluteRGBDifference > .003, name + ': pixel difference is negligible');
}
async function auditLegacy() {
  return page.evaluate(({ values, auditKey }) => {
    const current = Object.fromEntries(Object.keys(values).map(key => [key, localStorage.getItem(key)]));
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('KAOPU_MATERIAL_RECOVERY_R16_RAW:')) backups.push({ key, value: localStorage.getItem(key) });
    }
    return { current, writes: JSON.parse(sessionStorage.getItem(auditKey) || '[]'), backups, protection: window.KAOPU_ANCHOR_PROTECTION || null };
  }, { values: LEGACY, auditKey: AUDIT_KEY });
}
function assertProtected(audit) {
  assert.deepEqual(audit.current, LEGACY, 'Legacy strings changed byte-for-byte');
  assert.equal(audit.writes.length, 0, 'A legacy write/remove/clear attempt was recorded: ' + JSON.stringify(audit.writes));
  assert.equal(audit.backups.length, 1, 'Expected exactly one independent, deduplicated R16 raw backup');
  assert.equal(audit.backups[0].value, LEGACY.KAOPU_MATERIAL_R16, 'The independent backup is not byte-exact');
}

(async () => {
  try {
    await step('launch official Chromium and one shared browser context', async () => {
      assert.equal(report.playwrightVersion, '1.55.0', 'Install the requested official playwright@1.55.0');
      if (process.env.PW_WS_ENDPOINT) {
        browser = await chromium.connect(process.env.PW_WS_ENDPOINT, { timeout: 45000 });
        report.browser = 'Existing Chromium launchServer/connect endpoint; caller supplies SwiftShader launch arguments';
      } else {
        owner = await chromium.launchServer({ headless: true, timeout: 45000, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
        browser = await chromium.connect(owner.wsEndpoint(), { timeout: 20000 });
      }
      context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
      // Installed before any application script. Synthetic seeding occurs once per tab,
      // before instrumentation, and survives reloads/navigation through sessionStorage.
      // Real app writes, equal-value rewrites, removeItem/clear, property assignments,
      // and deletes of either protected key are recorded; reads are expressly allowed.
      await context.addInitScript(({ origin, legacy, seedKey, auditKey }) => {
        if (location.origin !== origin) return;
        // Capture the existing application's GL error without consuming or masking it.
        const glProto = WebGL2RenderingContext.prototype, recentCalls = [];
        for (const name of ['texImage2D', 'viewport', 'uniform1f', 'uniform1i', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'drawArrays', 'readPixels']) {
          const originalCall = glProto[name];
          glProto[name] = function (...args) {
            recentCalls.push({ name, args: args.map(value => ArrayBuffer.isView(value) ? { length: value.length } : typeof value === 'number' ? value : String(value)) });
            if (recentCalls.length > 80) recentCalls.shift();
            return originalCall.apply(this, args);
          };
        }
        const getError = glProto.getError;
        glProto.getError = function () {
          const code = getError.call(this);
          if (code) { (window.__KAOPU_GL_DIAGNOSTICS ||= []).push({ code, width: this.canvas.width, height: this.canvas.height, box: document.getElementById('viewport')?.getBoundingClientRect().toJSON(), maxTexture: this.getParameter(this.MAX_TEXTURE_SIZE), calls: recentCalls.slice() }); sessionStorage.setItem('__KAOPU_GL_DIAGNOSTICS__', JSON.stringify(window.__KAOPU_GL_DIAGNOSTICS)); }
          return code;
        };
        const nativeLocal = window.localStorage, nativeSession = window.sessionStorage;
        const original = {
          get: Storage.prototype.getItem,
          set: Storage.prototype.setItem,
          remove: Storage.prototype.removeItem,
          clear: Storage.prototype.clear
        };
        if (original.get.call(nativeSession, seedKey) !== '1') {
          for (const [key, value] of Object.entries(legacy)) original.set.call(nativeLocal, key, value);
          original.set.call(nativeSession, auditKey, '[]');
          original.set.call(nativeSession, seedKey, '1');
        }
        function record(operation, key) {
          const records = JSON.parse(original.get.call(nativeSession, auditKey) || '[]');
          records.push({ operation, key, url: location.href, at: new Date().toISOString() });
          original.set.call(nativeSession, auditKey, JSON.stringify(records));
        }
        const protectedKey = key => Object.prototype.hasOwnProperty.call(legacy, String(key));
        Storage.prototype.setItem = function(key, value) {
          if (this === nativeLocal && protectedKey(key)) record('setItem', String(key));
          return original.set.call(this, key, value);
        };
        Storage.prototype.removeItem = function(key) {
          if (this === nativeLocal && protectedKey(key)) record('removeItem', String(key));
          return original.remove.call(this, key);
        };
        Storage.prototype.clear = function() {
          if (this === nativeLocal) for (const key of Object.keys(legacy)) record('clear', key);
          return original.clear.call(this);
        };
        const proxy = new Proxy(nativeLocal, {
          get(target, property) {
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
          set(target, property, value) {
            if (protectedKey(property)) record('property assignment', String(property));
            return Reflect.set(target, property, value, target);
          },
          deleteProperty(target, property) {
            if (protectedKey(property)) record('property deletion', String(property));
            return Reflect.deleteProperty(target, property);
          },
          defineProperty(target, property, descriptor) {
            if (protectedKey(property)) record('defineProperty', String(property));
            return Reflect.defineProperty(target, property, descriptor);
          }
        });
        Object.defineProperty(window, 'localStorage', { configurable: true, get: () => proxy });
      }, { origin: BASE.origin, legacy: LEGACY, seedKey: SEED_KEY, auditKey: AUDIT_KEY });
      page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.setDefaultNavigationTimeout(45000);
      page.on('pageerror', error => report.errors.push({ url: page.url(), error: error.message }));
      page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ url: page.url(), error: message.text() }); });
      page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
      return { viewport: { width: 1440, height: 960 }, storageAudit: 'Both legacy keys seeded once; method and property writes audited in sessionStorage across document reloads' };
    });

    await step('load independent page; verify default quality, six IDs and legacy backup', async () => {
      await page.goto(BASE.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.KAOPU_STUDIO?.ready === true, null, { timeout: 80000 });
      assert.equal(await page.locator('#independentStudiesLink a').getAttribute('href'), 'study-r01/');
      await Promise.all([
        page.waitForURL(STUDY_URL),
        page.locator('#independentStudiesLink a').click()
      ]);
      await ready();
      const current = await state();
      assert.equal(current.active, '05');
      assert.deepEqual(Object.keys(current.states).sort(), IDS);
      assert.deepEqual(Object.keys(current.cameras).sort(), IDS);
      assert.equal(current.quality.width, 640);
      assert.equal(current.quality.samples, 2, '2 × 2 spatial samples should be the default');
      assert.equal(current.quality.post, true);
      assert.deepEqual(await page.locator('[data-case]').evaluateAll(buttons => buttons.map(button => button.dataset.case)), IDS);
      assert.equal(await page.locator('.legacyLink').getAttribute('href'), '../anchors-r16.html');
      const audit = await auditLegacy();
      assertProtected(audit);
      assert.equal(audit.protection?.backedUp, true);
      assert.equal(audit.protection?.needsReview, true);
      return { version: await page.evaluate(() => KAOPU_STUDIES.version), quality: current.quality, legacyWrites: audit.writes.length, exactBackup: true };
    });

    await step('use fixed 480 single sampling for interaction comparisons after default-image proof', async () => {
      await page.locator('[data-tab="quality"]').click();
      await page.locator('#resolution').selectOption('480');
      await page.locator('#samples').selectOption('1');
      await page.locator('[data-tab="study"]').click();
      const current = await state();
      assert.equal(current.quality.width, 480); assert.equal(current.quality.samples, 1);
      return { quality: current.quality, defaultVisualsAlreadyTested: '640 budget with four samples for every study' };
    });

    await step('real pointer drag rotates the camera and changes the image', async () => {
      await select('08');
      await page.locator('#resetMaterial').click();
      await page.locator('#cameraReset').click();
      await page.locator('#canvas').scrollIntoViewIfNeeded();
      const before = await state();
      await snapshot('before-drag');
      const box = await page.locator('#canvas').boundingBox();
      assert.ok(box, 'Canvas has no pointer target bounds');
      const x = box.x + box.width * .5, y = box.y + box.height * .5;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 72, y - 34, { steps: 6 }); await page.mouse.up();
      const after = await state();
      assert.notEqual(after.cameras['08'].yaw, before.cameras['08'].yaw);
      assert.notEqual(after.cameras['08'].pitch, before.cameras['08'].pitch);
      const frame = await snapshot(null, 'before-drag'); changed(frame, 'pointer drag');
      return { before: before.cameras['08'], after: after.cameras['08'], frame };
    });

    await step('real wheel zoom changes the camera and rendered pixels', async () => {
      const before = await state();
      await snapshot('before-zoom');
      const box = await page.locator('#canvas').boundingBox();
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
      await page.mouse.wheel(0, -240);
      await page.waitForFunction(value => KAOPU_STUDIES.getState().cameras['08'].zoom !== value, before.cameras['08'].zoom);
      const after = await state();
      assert.ok(after.cameras['08'].zoom > before.cameras['08'].zoom);
      const frame = await snapshot(null, 'before-zoom'); changed(frame, 'wheel zoom');
      return { before: before.cameras['08'].zoom, after: after.cameras['08'].zoom, frame };
    });

    await step('dragged and zoomed camera survives another real reload', async () => {
      const before = await state();
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
      assert.deepEqual((await state()).cameras, before.cameras);
      assertProtected(await auditLegacy());
      return { active: (await state()).active, actualGestureCameraPersists: true };
    });

    await step('auto rotation changes only observation and pauses at the same quality', async () => {
      await snapshot('before-auto'); const before = await state();
      await page.locator('#rotate').click();
      await page.waitForFunction(count => KAOPU_STUDIES.getState().frames >= count + 3, before.frames);
      await page.locator('#rotate').click();
      const after = await state();
      assert.equal(after.running, false); assert.deepEqual(after.quality, before.quality);
      assert.deepEqual(after.states, before.states); assert.notEqual(after.cameras[after.active].yaw, before.cameras[before.active].yaw);
      const frame = await snapshot(null, 'before-auto'); changed(frame, 'auto rotation');
      await page.locator('#cameraReset').click();
      return { paused: true, sameQuality: true, sameMaterialStates: true };
    });
    await step('zoom buttons and camera reset operate on the current study only', async () => {
      const before = await state();
      await page.locator('#zoomIn').click(); assert.equal((await state()).cameras['08'].zoom, 1.2);
      await page.locator('#zoomOut').click(); assert.equal((await state()).cameras['08'].zoom, 1);
      await page.locator('#cameraReset').click();
      assert.deepEqual((await state()).cameras, before.cameras);
      return { zoomButtons: true, reset: true, otherCamerasUnchanged: true };
    });
    await step('both lights, each light and rig reset visibly work', async () => {
      await page.locator('[data-tab="light"]').click();
      const original = await snapshot('both-lights');
      for (const id of ['keyOnly', 'fillOnly']) {
        await page.locator('#' + id).click();
        const frame = await snapshot(null, 'both-lights'); changed(frame, id);
      }
      await page.locator('#bothLights').click(); assert.equal((await snapshot()).hash, original.hash);
      const color = page.locator('#lightControls input[data-path="keyTint"]');
      await color.evaluate(element => { element.value = '#ff8040'; element.dispatchEvent(new Event('input', { bubbles: true })); });
      changed(await snapshot(null, 'both-lights'), 'light tint');
      await page.locator('#rigReset').click(); assert.equal((await snapshot()).hash, original.hash);
      await page.locator('[data-tab="study"]').click();
      return { individualLights: true, combinedLight: true, color: true, reset: true };
    });
    await step('controls hide and reopen through actual buttons', async () => {
      await page.locator('#toggleControls').click(); assert.equal(await page.locator('#controlRoom').isVisible(), false);
      nonempty(await snapshot(), 'controls hidden'); await ready();
      await page.locator('#toggleControls').click(); assert.equal(await page.locator('#controlRoom').isVisible(), true);
      nonempty(await snapshot(), 'controls shown'); await ready();
      return { hiddenAndReopened: true };
    });

    for (let cycle = 1; cycle <= 4; cycle++) {
    await step(`fullscreen cycle ${cycle}: real entry, screenshot and exit`, async () => {
      await page.locator('#fullscreen').click();
      await page.waitForFunction(() => document.fullscreenElement !== null && document.getElementById('fullscreen').textContent === '退出全屏', null, { timeout: 15000 });
      assert.equal(await page.locator('#fullscreen').innerText(), '退出全屏');
      const frame = await snapshot(); nonempty(frame, 'fullscreen');
      await page.screenshot({ path: path.join(OUT, `fullscreen-${cycle}.png`), timeout: 15000, fullPage: cycle % 2 === 0 });
      await ready();
      await page.locator('#fullscreen').click();
      await page.waitForFunction(() => document.fullscreenElement === null && document.getElementById('fullscreen').textContent === '全屏观察', null, { timeout: 15000 });
      assert.equal(await page.locator('#fullscreen').innerText(), '全屏观察');
      return { entered: true, exited: true, fullscreenFrame: { width: frame.width, height: frame.height, hash: frame.hash } };
    });

    }

    for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
      await step(`${viewport.width}px viewport has no horizontal overflow and keeps bottom controls`, async () => {
        await page.setViewportSize(viewport);
        await page.locator('[data-tab="study"]').click();
        const frame = await snapshot(); nonempty(frame, String(viewport.width));
        const layout = await page.evaluate(() => {
          const hero = document.getElementById('viewport').getBoundingClientRect();
          const controls = document.getElementById('controlRoom').getBoundingClientRect();
          return {
            innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
            heroWidth: hero.width, heroLeft: hero.left, heroBottom: hero.bottom, controlsTop: controls.top,
            controlsHidden: getComputedStyle(document.getElementById('controlRoom')).display === 'none',
            offenders: [...document.querySelectorAll('body *')].filter(element => {
              const rectangle = element.getBoundingClientRect();
              return rectangle.width > 0 && (rectangle.left < -2 || rectangle.right > innerWidth + 2);
            }).slice(0, 10).map(element => ({ tag: element.tagName, id: element.id, className: element.className }))
          };
        });
        assert.ok(layout.documentWidth <= layout.innerWidth + 2 && layout.bodyWidth <= layout.innerWidth + 2, 'Horizontal overflow: ' + JSON.stringify(layout));
        assert.ok(layout.heroWidth >= viewport.width - 32, 'Hero no longer fills the available page width');
        assert.ok(layout.controlsTop >= layout.heroBottom, 'Controls are not below the hero');
        assert.equal(layout.controlsHidden, false);
        await page.screenshot({ path: path.join(OUT, `layout-${viewport.width}.png`), fullPage: true, timeout: 15000 });
        return { layout, render: { width: frame.width, height: frame.height, hash: frame.hash } };
      });
    }

    await step('old-case link reaches the actual R16 workbench in the same context', async () => {
      await Promise.all([
        page.waitForURL(url => url.origin === BASE.origin && url.pathname === new URL('anchors-r16.html', BASE).pathname),
        page.locator('.legacyLink').click()
      ]);
      await page.waitForFunction(() => window.KAOPU_STUDIO?.ready === true, null, { timeout: 80000 });
      assert.equal(await page.evaluate(() => KAOPU_STUDIO.version), 16);
      const audit = await auditLegacy(); assertProtected(audit);
      return { url: page.url(), version: 16, legacyWrites: audit.writes.length, note: 'Old workbench is only loaded; its controls are not changed in this test' };
    });

    await step('return from old cases and verify final byte-exact legacy protection', async () => {
      await page.goBack({ waitUntil: 'domcontentloaded' }); await ready();
      assert.equal(new URL(page.url()).pathname, new URL(STUDY_URL).pathname);
      const audit = await auditLegacy(); assertProtected(audit);
      assert.equal(audit.protection?.backedUp, true);
      assert.equal(report.errors.length, 0, 'Uncaught browser errors: ' + JSON.stringify(report.errors));
      assert.equal(report.consoleErrors.length, 0, 'Browser console errors: ' + JSON.stringify(report.consoleErrors));
      report.legacyAudit = audit;
      return { active: (await state()).active, exactOriginalBytes: true, oldKeyWriteAttempts: 0, backupCount: audit.backups.length };
    });

    report.passed = true;
    report.acceptance = 'Automated checks passed; user visual review and acceptance remain separate';
    log('COMPLETE', 'all requested browser checks passed');
  } catch (error) {
    report.error = error.stack || String(error);
    log('STOPPED', 'browser QA failed or was blocked', { error: error.message });
    if (page && !page.isClosed()) {
      try { report.glDiagnostics = await bounded(page.evaluate(() => JSON.parse(sessionStorage.getItem('__KAOPU_GL_DIAGNOSTICS__') || '[]')), 4000, 'GL error details'); } catch {}
      try { report.legacyAuditAtFailure = await bounded(auditLegacy(), 4000, 'failure storage audit'); }
      catch (auditError) { report.legacyAuditAtFailureError = auditError.message; }
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    flush();
    if (context) try { await bounded(context.close(), 5000, 'close test context'); } catch {}
    if (browser) try { await bounded(browser.close(), 5000, 'disconnect browser'); } catch {}
    if (owner) {
      try { await bounded(owner.close(), 5000, 'close owned browser server'); }
      catch { owner.process()?.kill('SIGKILL'); }
    }
    console.log(JSON.stringify({ passed: report.passed, report: path.join(OUT, 'QA.json'), completedSteps: report.steps.filter(entry => entry.status === 'passed').length, failedStep: report.steps.find(entry => entry.status === 'failed')?.name || null }));
    process.exitCode = report.passed ? 0 : 1;
  }
})();
