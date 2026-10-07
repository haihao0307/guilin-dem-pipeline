'use strict';
// Real browser UI checks. Viewport emulation is not a physical-phone test.
// No mocked renderers, forced clicks, synthetic input events, or product edits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium, webkit } = require('playwright');

const engine = process.env.OVERVIEW_BROWSER || 'chromium';
const base = new URL(process.env.OVERVIEW_URL || 'http://127.0.0.1:8765/kaopu-human-overview/').href;
const out = process.env.OVERVIEW_QA_DIR || 'ui-evidence';
const sizes = [
  { name: 'wide', width: 2048, height: 1040 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone-viewport', width: 390, height: 844 },
  { name: 'landscape-viewport', width: 844, height: 390 },
];
const hubPath = '../kaopu-hair-workbench/qa/kuko-anemone-candidate.html';
const cases = [
  { name: 'r9', path: '../kaopu-hair-workbench/qa/gnm-groom-editor/experiment.html', root: '#gnmWorkbench', stage: '#stage', canvas: '#canvas', scroll: '#gnmControlScroll', sliders: [['#hairLength', 'hairLength'], ['#hairDensity', 'hairDensity']] },
  { name: 'anemone', path: hubPath, root: '#anemoneModule', stage: '#anemoneModule .anemone-stage', canvas: '#anemoneCanvas', scroll: '#anemoneControlScroll', sliders: [['#anemone-swayAmplitude', 'swayAmplitude'], ['#anemone-flowSpeed', 'flowSpeed']] },
  { name: 'rabbit', path: hubPath, root: '#rabbitModule', stage: '#rabbitModule .workspace', canvas: '#canvasGL', scroll: '#rabbitControlScroll', sliders: [['#range-hairLength', 'hairLength']] },
  { name: 'kuko', path: hubPath, root: '#kukoModule', stage: '#kukoViews', canvas: '#kukoCopy', scroll: '#kukoControlScroll', sliders: [['#study-current', 'current'], ['#kukoTime', 'time']] },
];
fs.mkdirSync(out, { recursive: true });
const report = {
  engine, base, startedAt: new Date().toISOString(), sizes, rows: [], navigation: [], catalog: [],
  sourceDialogs: [], errors: [], warnings: [], artifacts: [], passed: false,
  physicalPhone: false, inputMethod: 'Playwright real keyboard, mouse wheel, clicks and canvas drag',
  scope: 'UI presentation and original renderer responsiveness; no full hair physics or device-performance acceptance',
};
let browser, ctx, page, tracing = false, active = 'setup', finished = false;
const filename = name => path.join(out, `hair-${name}-${engine}`);
const save = () => {
  fs.writeFileSync(filename('ui') + '.json', JSON.stringify(report, null, 2));
  if (report.errors.length) fs.writeFileSync(filename('failure') + '.json', JSON.stringify({
    engine, base, phase: active, blockedBeforeLaunch: report.blockedBeforeLaunch || false,
    errors: report.errors, completedRows: report.rows.filter(row => row.passed).map(row => `${row.name}/${row.size}`),
    failedRows: report.rows.filter(row => row.failure).map(row => ({ name: row.name, size: row.size, failure: row.failure })),
    report: filename('ui') + '.json', artifacts: report.artifacts,
  }, null, 2));
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const errText = error => error?.stack || String(error);

async function screenshot(name, locator) {
  const file = filename(name) + '.png';
  await (locator || page).screenshot({ path: file, timeout: 30000 });
  report.artifacts.push(file);
  return file;
}
async function failure(error, phase = active) {
  report.errors.push({ phase, url: page?.url(), message: errText(error) });
  save();
  console.error('HAIR_UI_FAIL', engine, phase, error.message || error);
  if (page && !page.isClosed()) {
    try { await screenshot(`failure-${report.errors.length}`); } catch (captureError) {
      report.warnings.push({ phase, type: 'failure-screenshot', message: String(captureError) });
    }
  }
  save();
}
function inspectLocalManifest() {
  const manifestPath = path.resolve(__dirname, '../hair-ui-verification.json');
  if (!fs.existsSync(manifestPath)) {
    report.warnings.push({ type: 'manifest-unavailable', message: 'Browser checks continue; local source-integrity manifest was not supplied.' });
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  report.sourceIntegrity = { manifestSha256: hash(fs.readFileSync(manifestPath)), priorBrowserCheck: manifest.browser_check, files: [] };
  for (const [relative, evidence] of Object.entries(manifest)) {
    if (!evidence.baseline_script_sha256) continue;
    const file = path.resolve(__dirname, '../site', relative);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match => hash(match[1]));
    const originalScriptsUnchanged = evidence.baseline_script_sha256.every((digest, i) => scripts[i] === digest);
    report.sourceIntegrity.files.push({ path: relative, sha256: hash(html), originalScriptsUnchanged, scripts: scripts.length });
    assert(originalScriptsUnchanged, `${relative}: original script source changed`);
  }
}
async function ready(c) {
  await page.waitForFunction(name => {
    if (name === 'r9') return window.groomStudy?.ready && window.groomStudy.diagnostics().frameCount > 0;
    if (name === 'anemone') return window.anemone?.ready && window.anemone.metrics()?.frames > 0;
    if (name === 'rabbit') return window.workbench?.ready.candidate && document.querySelector('#candidateFrame')?.contentWindow?.runtime?.frameCount > 0;
    return window.kuko?.ready && window.kuko.renderers.every(r => r.frames > 0);
  }, c.name, { timeout: 240000 });
  await page.locator(c.scroll).waitFor({ state: 'visible', timeout: 30000 });
}
async function settle(c) {
  await page.evaluate(name => {
    if (name === 'r9') window.groomStudy.freeze();
    if (name === 'anemone') { window.anemone.pause(); window.anemone.pauseOrbit(); window.anemone.seek(2.5); }
    if (name === 'rabbit') { window.rabbitUI.pauseOrbit(); window.workbench.setMode('orbit'); }
    if (name === 'kuko') { window.kuko.pause(true); window.kuko.seek(2.5); }
  }, c.name);
  // Allow the original resize observers and iframe messages to finish.
  await page.waitForTimeout(150);
}
function canvasLocator(c) {
  return c.name === 'rabbit' ? page.frameLocator('#candidateFrame').locator(c.canvas) : page.locator(c.canvas);
}
async function state(c) {
  return page.evaluate(name => {
    if (name === 'r9') {
      const d = window.groomStudy.diagnostics();
      return { state: window.groomStudy.getState(), camera: d.camera, geometryHashes: d.geometryHashes, editors: d.editors, frameCount: d.frameCount, model: d.model, errors: d.errors, graphics: d.graphics, drawingBuffer: d.drawingBuffer };
    }
    if (name === 'anemone') {
      const a = window.anemone, data = a.renderer.data;
      let h = 2166136261;
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      for (const value of bytes) h = Math.imul(h ^ value, 16777619) >>> 0;
      return { state: a.state, camera: a.state.camera, geometryHash: h, jointValues: data.length, metrics: a.metrics(), errors: a.errors };
    }
    if (name === 'rabbit') {
      const runtime = document.querySelector('#candidateFrame').contentWindow.runtime;
      const s = runtime.state();
      return { state: window.workbench.candidate, renderedState: s, camera: { angles: s.angles, size: s.size, pan: s.pan }, frameCount: runtime.frameCount, startup: runtime.startup, errors: window.workbench.errors };
    }
    return { state: window.kuko.state, frameCount: window.kuko.renderers.map(r => r.frames), errors: window.kuko.errors };
  }, c.name);
}
// Read the actual WebGL framebuffer immediately after the original renderer draws.
// Sample RGB values on the CPU; no shaders, model geometry or renderer APIs are replaced.
async function pixels(c) {
  return page.evaluate(name => {
    let canvas;
    if (name === 'r9') { window.groomStudy.render(); canvas = document.querySelector('#canvas'); }
    if (name === 'anemone') { window.anemone.redraw(); canvas = document.querySelector('#anemoneCanvas'); }
    if (name === 'rabbit') {
      const win = document.querySelector('#candidateFrame').contentWindow;
      win.runtime.renderer.drawScene(); canvas = win.document.querySelector('#canvasGL');
    }
    if (name === 'kuko') { window.kuko.draw(); canvas = document.querySelector('#kukoCopy'); }
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl || gl.isContextLost()) throw Error('Live canvas WebGL context is missing or lost');
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const bytes = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    const glError = gl.getError(), step = Math.max(1, Math.floor(w * h / 16384));
    let value = 2166136261, samples = 0;
    const colors = new Map();
    for (let i = 0; i < w * h; i += step) {
      const k = i * 4, rgb = (bytes[k] << 16) | (bytes[k + 1] << 8) | bytes[k + 2];
      colors.set(rgb, (colors.get(rgb) || 0) + 1);
      value = Math.imul(value ^ rgb, 16777619) >>> 0;
      samples++;
    }
    return { hash: value, width: w, height: h, samples, colors: colors.size, nonDominantSamples: samples - Math.max(0, ...colors.values()), glError };
  }, c.name);
}
function checkPixels(proof, label) {
  assert.equal(proof.glError, 0, `${label}: WebGL read error`);
  assert(proof.width > 64 && proof.height > 64, `${label}: empty drawing buffer`);
  assert(proof.colors > 24 && proof.nonDominantSamples > 100, `${label}: rendered canvas is blank or nearly uniform`);
}
function parameter(proof, c, key) {
  if (c.name === 'r9') return proof.state.groom[key];
  if (c.name === 'anemone') return proof.state.params[key];
  if (c.name === 'rabbit') return proof.renderedState[key];
  return key === 'time' ? proof.state.time : proof.state.experiment[key];
}
async function revealControl(selector) {
  const control = page.locator(selector);
  // Open real <details> by clicking their summaries, from outermost to innermost.
  for (let i = 0; i < 8; i++) {
    const closed = control.locator('xpath=ancestor::details[not(@open)]').first();
    if (!await closed.count()) break;
    await closed.locator(':scope > summary').click();
  }
  await control.scrollIntoViewIfNeeded();
  await control.focus();
  return control;
}
async function layout(c, controlSelector) {
  return page.evaluate(({ c, controlSelector }) => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const root = document.querySelector(c.root), scroll = document.querySelector(c.scroll), control = document.querySelector(controlSelector);
    const visibleCanvas = c.name === 'rabbit' ? document.querySelector('#candidateFrame') : document.querySelector(c.canvas);
    const stage = document.querySelector(c.stage), panel = scroll.closest('.wb-controls');
    const cb = box(control), sb = box(visibleCanvas), hit = document.elementFromPoint(sb.x + sb.width / 2, sb.y + sb.height / 2);
    return {
      stage: box(stage), canvas: sb, panel: box(panel), scroll: box(scroll), control: cb,
      root: box(root), scrollTop: scroll.scrollTop, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
      overflowY: getComputedStyle(scroll).overflowY, outerScrollY: scrollY, bodyWidth: document.documentElement.scrollWidth,
      viewport: { width: innerWidth, height: innerHeight }, controlFont: parseFloat(getComputedStyle(control).fontSize),
      modalDialogs: [...document.querySelectorAll('dialog:modal')].map(d => d.id),
      controlInsideDialog: !!control.closest('dialog'), controlInsidePanel: scroll.contains(control),
      canvasCenterUnobstructed: hit === visibleCanvas || visibleCanvas.contains(hit),
      controlCenterUnobstructed: document.elementFromPoint(cb.x + cb.width / 2, cb.y + cb.height / 2) === control,
      expanded: root.querySelector('[data-wb-toggle]')?.getAttribute('aria-expanded'),
    };
  }, { c, controlSelector });
}
function checkLayout(p, c, size) {
  const label = `${c.name}/${size.name}`;
  assert(p.stage.width > 200 && p.stage.height > 140, `${label}: useful model stage`);
  assert(p.canvas.width > 140 && p.canvas.height > 64, `${label}: useful live canvas`);
  for (const [name, b] of [['stage', p.stage], ['canvas', p.canvas], ['panel', p.panel]]) {
    assert(b.x >= -1 && b.y >= -1 && b.right <= size.width + 1 && b.bottom <= size.height + 1, `${label}: ${name} leaves viewport`);
  }
  assert(p.control.y >= p.scroll.y - 1 && p.control.bottom <= p.scroll.bottom + 1, `${label}: parameter is clipped by scroll panel`);
  assert(p.control.width >= 44 && p.control.height >= 43 && p.controlFont >= 14, `${label}: readable 44px input target`);
  assert.equal(p.outerScrollY, 0, `${label}: outer page moved while editing`);
  assert(p.bodyWidth <= size.width, `${label}: horizontal document overflow`);
  assert.equal(p.modalDialogs.length, 0, `${label}: parameter controls unexpectedly modal`);
  assert(p.controlInsidePanel && !p.controlInsideDialog, `${label}: parameter still belongs to a dialog`);
  assert(p.canvasCenterUnobstructed, `${label}: model blocked by a panel or overlay`);
  assert(p.controlCenterUnobstructed, `${label}: visible parameter is covered by another element`);
  assert(['auto', 'scroll'].includes(p.overflowY), `${label}: parameters lack independent overflow`);
  if (size.width >= 640) assert(p.panel.x >= p.stage.right - 1, `${label}: parameters must sit beside model`);
  else assert(p.panel.y >= p.stage.bottom - 1, `${label}: portrait parameters overlap model`);
  if (size.width >= 960) assert(p.stage.width >= size.width * .6, `${label}: desktop stage too narrow`);
}
async function independentScroll(c, row) {
  const control = await revealControl(c.sliders[0][0]);
  const before = await layout(c, c.sliders[0][0]);
  const scroll = page.locator(c.scroll);
  // Restore to the start without scrolling the document, then use real wheel input.
  await scroll.evaluate(el => { el.scrollTop = 0; });
  const origin = await layout(c, c.sliders[0][0]);
  await page.mouse.move(origin.scroll.x + origin.scroll.width - 18, origin.scroll.y + Math.min(60, origin.scroll.height / 2));
  await page.mouse.wheel(0, 800);
  if (origin.scrollHeight > origin.clientHeight + 2) {
    await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 0, c.scroll, { timeout: 10000 });
  }
  const after = await layout(c, c.sliders[0][0]);
  assert.equal(after.outerScrollY, 0, `${c.name}: wheel scroll leaked to document`);
  for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(origin.stage[key] - after.stage[key]) < 1, `${c.name}: independent scrolling moved stage ${key}`);
  row.scrolling = { before: origin.scrollTop, after: after.scrollTop, scrollHeight: origin.scrollHeight, clientHeight: origin.clientHeight, overflowPresent: origin.scrollHeight > origin.clientHeight + 2, stageBefore: origin.stage, stageAfter: after.stage };
  if (row.size === 'phone-viewport' || row.size === 'landscape-viewport') assert(row.scrolling.overflowPresent && after.scrollTop > 0, `${c.name}: short viewport must demonstrate real independent scrolling`);
  await control.scrollIntoViewIfNeeded();
  return before;
}
async function keyboardEdit(c, selector, key, row) {
  const control = await revealControl(selector);
  const beforeValue = Number(await control.inputValue());
  const bounds = await control.evaluate(el => ({ min: Number(el.min), max: Number(el.max), step: Number(el.step) || 1 }));
  const direction = beforeValue + bounds.step <= bounds.max ? 'ArrowRight' : 'ArrowLeft';
  const before = await state(c), beforePixels = await pixels(c);
  const beforeFile = await screenshot(`${c.name}-${row.size}-${key}-before`, canvasLocator(c));
  await control.press(direction);
  const afterValue = Number(await control.inputValue());
  assert.notEqual(afterValue, beforeValue, `${c.name}/${key}: actual keyboard slider did not change`);
  const expected = direction === 'ArrowRight' ? beforeValue + bounds.step : beforeValue - bounds.step;
  assert(Math.abs(afterValue - expected) < 1e-6, `${c.name}/${key}: keyboard step differs from slider step`);
  await page.waitForFunction(({ name, key, value }) => {
    let actual;
    if (name === 'r9') actual = window.groomStudy.getState().groom[key];
    if (name === 'anemone') actual = window.anemone.state.params[key];
    if (name === 'rabbit') actual = document.querySelector('#candidateFrame').contentWindow.runtime.state()[key];
    if (name === 'kuko') actual = key === 'time' ? window.kuko.state.time : window.kuko.state.experiment[key];
    return Math.abs(actual - value) < 1e-6;
  }, { name: c.name, key, value: afterValue }, { timeout: 30000 });
  const afterPixels = await pixels(c), after = await state(c);
  const afterFile = await screenshot(`${c.name}-${row.size}-${key}-after`, canvasLocator(c));
  const edit = { selector, key, keyboard: direction, beforeValue, afterValue, before, after, beforePixels, afterPixels, screenshots: [beforeFile, afterFile] };
  row.edits.push(edit);
  save();
  checkPixels(afterPixels, `${c.name}/${key}`);
  assert.equal(parameter(after, c, key), afterValue, `${c.name}/${key}: renderer API does not reflect UI`);
  const changesGeometry = c.name === 'anemone' && key === 'swayAmplitude';
  if (changesGeometry) assert.notEqual(after.geometryHash, before.geometryHash, 'sway keyboard edit did not change rendered joints');
  if (key !== 'flowSpeed') assert.notEqual(afterPixels.hash, beforePixels.hash, `${c.name}/${key}: frozen rendered pixels did not change`);
  // Speed changes playback rate, so paused frames should not be used as its visual proof.
  if (key === 'flowSpeed') {
    const startTime = after.state.time;
    await page.locator('#anemonePause').click();
    await page.waitForFunction(t => window.anemone.state.time > t + .02, startTime, { timeout: 30000 });
    await page.locator('#anemonePause').click();
    edit.playback = await state(c);
    assert(edit.playback.state.params.paused && edit.playback.state.time > startTime, 'edited flow speed must still drive original playback');
    edit.playbackPixels = await pixels(c);
    assert.notEqual(edit.playbackPixels.hash, afterPixels.hash, 'flow playback produced no pixel change');
    await page.evaluate(() => window.anemone.seek(2.5));
  }
  await revealControl(selector);
  const proof = await layout(c, selector);
  checkLayout(proof, c, row.viewport);
  row.layouts.push(proof);
  // Restore with the opposite real key so repeated viewport checks start consistently.
  await control.focus();
  await control.press(direction === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight');
  assert(Math.abs(Number(await control.inputValue()) - beforeValue) < 1e-6, `${c.name}/${key}: inverse keyboard edit failed`);
  if (c.name === 'rabbit') await page.waitForFunction(value => Math.abs(document.querySelector('#candidateFrame').contentWindow.runtime.state().hairLength - value) < 1e-6, beforeValue, { timeout: 30000 });
}
async function colorEdit(c, row) {
  await revealControl('#hairColor');
  const before = await state(c), beforePixels = await pixels(c);
  const previous = before.state.groom.hairColor;
  const selected = previous === '#63341e' ? '#291c12' : '#63341e';
  await page.locator(`[data-color="${selected}"]`).click();
  assert.equal(await page.locator('#hairColor').inputValue(), selected);
  const after = await state(c), afterPixels = await pixels(c);
  row.color = { selector: '#hairColor', inputMethod: 'existing visible color swatch click', before: previous, after: selected, beforePixels, afterPixels };
  assert.equal(after.state.groom.hairColor, selected);
  assert.deepEqual(after.geometryHashes, before.geometryHashes, 'color control unexpectedly changed geometry');
  assert.notEqual(afterPixels.hash, beforePixels.hash, 'hair color click did not change rendered pixels');
  await screenshot(`${c.name}-${row.size}-color`, canvasLocator(c));
  await page.locator(`[data-color="${previous}"]`).click();
}
async function drag(c, row) {
  if (c.name === 'kuko') {
    row.drag = { applicable: false, reason: 'Original KuKo shader scene has playback controls but no canvas camera-drag handler.' };
    return;
  }
  const before = await state(c), beforePixels = await pixels(c);
  const canvas = canvasLocator(c), box = await canvas.boundingBox();
  assert(box && box.width > 100 && box.height > 100, 'Drag target canvas missing');
  assert.equal(await page.locator('dialog:modal').count(), 0);
  const x = box.x + box.width * .45, y = box.y + box.height * .45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.min(70, box.width * .15), y + Math.min(18, box.height * .08), { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(({ name, camera }) => {
    const next = name === 'r9' ? window.groomStudy.diagnostics().camera : name === 'anemone' ? window.anemone.state.camera : (() => { const s = document.querySelector('#candidateFrame').contentWindow.runtime.state(); return { angles: s.angles, size: s.size, pan: s.pan }; })();
    return JSON.stringify(next) !== camera;
  }, { name: c.name, camera: JSON.stringify(before.camera) }, { timeout: 30000 });
  const afterPixels = await pixels(c), after = await state(c);
  row.drag = { applicable: true, beforeCamera: before.camera, afterCamera: after.camera, beforePixels, afterPixels, parameterPanelStayedOpen: await page.locator(c.scroll).isVisible() };
  assert.notDeepEqual(after.camera, before.camera, 'Original drag did not move the camera');
  assert.notEqual(afterPixels.hash, beforePixels.hash, 'Original canvas drag produced no changed pixels');
  assert.equal(await page.locator('dialog:modal').count(), 0, 'Canvas gesture unexpectedly opened a modal');
  assert(row.drag.parameterPanelStayedOpen, 'Parameter panel disappeared during model drag');
}
async function collapsePhone(c, row) {
  const toggle = page.locator(`${c.root} [data-wb-toggle]`);
  const before = await page.locator(c.stage).boundingBox();
  await toggle.click();
  await page.locator(c.scroll).waitFor({ state: 'hidden' });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  const collapsed = await page.locator(c.stage).boundingBox();
  assert(collapsed.height > before.height + 80, `${c.name}: collapse did not free useful canvas height`);
  await screenshot(`${c.name}-${row.size}-collapsed`);
  await toggle.click();
  await page.locator(c.scroll).waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  const expanded = await page.locator(c.stage).boundingBox();
  assert(Math.abs(expanded.height - before.height) < 2, `${c.name}: expand did not restore layout`);
  row.collapse = { before, collapsed, expanded };
}
async function openFromOverview(c) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const link = page.locator(`a[data-entry][href="${c.path}"]`).first();
  assert.equal(await link.count(), 1, `${c.name}: overview entry missing`);
  const target = await link.getAttribute('target');
  assert(!target || target === '_self', `${c.name}: entry opens a new tab`);
  await link.click();
  await page.waitForURL(new URL(c.path, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(ctx.pages().length, 1, `${c.name}: page opened outside existing tab`);
}
async function selectHub(c) {
  await page.waitForFunction(() => !!window.platform?.select && !!document.querySelector('#catalogHome'), null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.platform.module), 'home', 'Hair hub must initially show its catalog');
  assert(await page.locator('#catalogHome').isVisible());
  await page.evaluate(name => window.platform.select(name), c.name);
  await ready(c);
}
async function navigation(c) {
  const expected = new URL(c.path, base).href;
  const back = page.locator('[data-wb-back]');
  assert.equal(await back.count(), 1, 'Expected one ordinary overview return link');
  assert.equal(await back.evaluate(el => el.tagName), 'A');
  assert.equal(await back.evaluate(el => el.href), base);
  assert(!await back.getAttribute('target') || await back.getAttribute('target') === '_self');
  await back.click();
  await page.waitForURL(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(ctx.pages().length, 1);
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL(expected, { timeout: 60000 });
  if (c.name === 'r9') await ready(c);
  else {
    await page.waitForFunction(() => !!window.platform?.select, null, { timeout: 60000 });
    // A BFCache restoration may retain the module; a reload returns to catalog.
    if (await page.evaluate(() => window.platform.module) !== c.name) await page.evaluate(name => window.platform.select(name), c.name);
    await ready(c);
  }
  await page.locator('[data-wb-back]').click();
  await page.waitForURL(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const link = page.locator(`a[data-entry][href="${c.path}"]`).first();
  await link.click();
  await page.waitForURL(expected, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (c.name === 'r9') await ready(c); else await selectHub(c);
  await settle(c);
  const rendered = await pixels(c);
  checkPixels(rendered, `${c.name}: reopen`);
  assert.equal(ctx.pages().length, 1);
  report.navigation.push({ name: c.name, backLinkSameTab: true, browserBackReady: true, reopenedReady: true, pixels: rendered });
  await screenshot(`${c.name}-reopened`);
}
async function sourceDialogCheck(c) {
  if (c.name !== 'anemone' && c.name !== 'kuko') return;
  const button = c.name === 'anemone' ? '#referenceToggle' : '#kukoSource';
  const dialog = c.name === 'anemone' ? '#referenceDrawer' : '#kukoSourceDialog';
  await page.locator(button).click();
  await page.locator(`${dialog}:modal`).waitFor({ state: 'visible' });
  assert.equal(await page.locator(`${dialog}:modal`).count(), 1, 'Original source/reference dialog lost modal behavior');
  await page.keyboard.press('Escape');
  await page.locator(dialog).waitFor({ state: 'hidden' });
  assert(await page.locator(c.scroll).isVisible(), 'Closing source dialog must leave parameter panel available');
  report.sourceDialogs.push({ name: c.name, button, dialog, preservedModal: true, escapeCloses: true });
}
async function main() {
  assert(['chromium', 'webkit'].includes(engine), 'OVERVIEW_BROWSER must be chromium or webkit');
  inspectLocalManifest();
  active = 'browser-launch';
  browser = await ({ chromium, webkit })[engine].launch(engine === 'webkit' ? { headless: true } : { headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  report.browserVersion = browser.version();
  ctx = await browser.newContext({ viewport: { width: sizes[0].width, height: sizes[0].height }, deviceScaleFactor: 1, hasTouch: true });
  ctx.setDefaultTimeout(30000);
  page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60000);
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });
  tracing = true;
  page.on('pageerror', error => { report.errors.push({ phase: active, type: 'pageerror', url: page.url(), message: error.message }); save(); });
  page.on('crash', () => { report.errors.push({ phase: active, type: 'crash', url: page.url() }); save(); });
  page.on('popup', popup => { report.errors.push({ phase: active, type: 'unexpected-new-tab', url: popup.url() }); save(); });
  page.on('requestfailed', request => report.warnings.push({ phase: active, type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.warnings.push({ phase: active, type: 'http-error', url: response.url(), status: response.status() }); });
  for (const c of cases) {
    active = `${c.name}/open`;
    console.log('HAIR_UI_START', engine, c.name);
    try {
      await page.setViewportSize({ width: sizes[0].width, height: sizes[0].height });
      await openFromOverview(c);
      if (c.name === 'r9') await ready(c);
      else {
        if (c.name === 'anemone') {
          await page.locator('#catalogHome').waitFor({ state: 'visible', timeout: 60000 });
          for (const size of sizes) {
            await page.setViewportSize({ width: size.width, height: size.height });
            const p = await page.evaluate(() => ({ module: window.platform.module, width: innerWidth, bodyWidth: document.documentElement.scrollWidth, cards: document.querySelectorAll('#catalogHome [data-catalog-object]').length }));
            assert.equal(p.module, 'home'); assert(p.cards >= 2); assert(p.bodyWidth <= p.width, 'Initial catalog overflows horizontally');
            report.catalog.push({ size: size.name, ...p });
            await screenshot(`catalog-${size.name}`);
          }
          await page.setViewportSize({ width: sizes[0].width, height: sizes[0].height });
        }
        await selectHub(c);
      }
      for (const size of sizes) {
        active = `${c.name}/${size.name}`;
        const row = { name: c.name, size: size.name, viewport: size, edits: [], layouts: [], passed: false };
        report.rows.push(row); save();
        try {
          await page.setViewportSize({ width: size.width, height: size.height });
          await settle(c);
          await independentScroll(c, row);
          for (const [selector, key] of c.sliders) await keyboardEdit(c, selector, key, row);
          if (c.name === 'r9') await colorEdit(c, row);
          await drag(c, row);
          await revealControl(c.sliders[0][0]);
          row.finalLayout = await layout(c, c.sliders[0][0]);
          checkLayout(row.finalLayout, c, size);
          row.finalState = await state(c);
          assert.equal(row.finalState.errors.length, 0, `${c.name}: renderer errors`);
          await screenshot(`${c.name}-${size.name}`);
          if (size.name === 'phone-viewport') await collapsePhone(c, row);
          row.passed = true;
          console.log('HAIR_UI_VIEWPORT_PASS', engine, c.name, size.name);
        } catch (error) { row.failure = errText(error); await failure(error); }
        save();
      }
      active = `${c.name}/source-dialog`;
      await sourceDialogCheck(c);
      active = `${c.name}/navigation`;
      await navigation(c);
    } catch (error) { await failure(error); }
    save();
  }
  report.passed = report.rows.length === cases.length * sizes.length && report.rows.every(row => row.passed) && report.navigation.length === cases.length && report.errors.length === 0;
  report.finishedAt = new Date().toISOString();
  save();
}
async function cleanup() {
  if (finished) return;
  finished = true;
  report.finishedAt = new Date().toISOString();
  if (tracing) {
    try { const file = filename('trace') + '.zip'; await ctx.tracing.stop({ path: file }); report.artifacts.push(file); }
    catch (error) { report.warnings.push({ type: 'trace-save', message: String(error) }); }
  }
  save();
  try { await browser?.close(); } catch {}
}
// Per-action waits are bounded; this also bounds a hung software-GPU/browser process.
const deadline = setTimeout(async () => {
  report.errors.push({ phase: active, type: 'suite-timeout', message: 'Hair UI suite exceeded its 30-minute overall limit.' });
  report.passed = false; save();
  const exit = setTimeout(() => process.exit(1), 15000);
  await cleanup(); clearTimeout(exit); process.exit(1);
}, 30 * 60 * 1000);
main().catch(async error => {
  report.blockedBeforeLaunch = !browser;
  await failure(error);
}).finally(async () => {
  clearTimeout(deadline);
  const exit = setTimeout(() => process.exit(1), 30000);
  await cleanup(); clearTimeout(exit);
  console.log(report.passed ? 'HAIR_UI_PASS' : 'HAIR_UI_FAILED', engine, filename('ui') + '.json');
  process.exit(report.passed ? 0 : 1);
});
