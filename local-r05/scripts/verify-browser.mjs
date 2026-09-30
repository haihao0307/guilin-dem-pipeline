import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.FISH_PLAYWRIGHT_PATH || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || pathToFileURL(path.join(root, 'dist/KAOPU_FISH_WEIGHTED_EYE_R05_WORKBENCH.html')).href;
const label = process.argv[3] || 'local';
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { startedAt: new Date().toISOString(), target, label, sourceHtmlSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'dist/KAOPU_FISH_WEIGHTED_EYE_R05_WORKBENCH.html'))).digest('hex'), validationOnlyNoSourceDelta: true, views: [] };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [], failedRequests = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== target) externalRequests.push(request.url()); });
    console.log('Opening', label, viewport.width, target);
    const response = await page.goto(target, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__KAOPU_R05__ !== undefined, { timeout: 120000 });
    const ready = await page.evaluate(() => ({ ready: window.__KAOPU_R05__.ready, error: window.__KAOPU_R05__.error }));
    if (!ready.ready) throw new Error(ready.error);
    await page.waitForFunction(() => window.__KAOPU_R05__.renderer.frames > 1, { timeout: 60000 });
    const checks = await page.evaluate(() => {
      const { renderer: r, handle: h, instrument: A } = window.__KAOPU_R05__;
      r.state.playing = false;
      const modes = Object.keys(h.metadata.motion.modes), snapshots = [];
      for (const mode of modes) {
        const options = { ...r.state, mode, weightGains: Array(12).fill(1) };
        A.reset(h, mode, options);
        for (let i = 0; i < 60; i++) A.update(h, 1/60, options);
        const snapshot = A.snapshot(h);
        const positions = Array.from({ length: 80 }, (_, i) => A.deformPoint(h, Math.floor(i * (h.metadata.counts.vertices - 1) / 79))).flat();
        const finite = [...snapshot.q, ...snapshot.response, ...snapshot.eye, ...positions].every(Number.isFinite);
        if (!finite) throw new Error('Non-finite state in ' + mode);
        snapshots.push({ mode, label: h.metadata.motion.modes[mode].label, finite, time: snapshot.time });
      }
      A.reset(h, 'CRUISE', { ...r.state, mode: 'CRUISE' });
      for (let i = 0; i < 60; i++) A.update(h, 1/60, { ...r.state, mode: 'CRUISE' });
      const sixty = A.snapshot(h);
      A.reset(h, 'CRUISE', { ...r.state, mode: 'CRUISE' });
      for (let i = 0; i < 30; i++) A.update(h, 1/30, { ...r.state, mode: 'CRUISE' });
      const thirty = A.snapshot(h);
      const deterministicReplay = JSON.stringify(sixty) === JSON.stringify(thirty);
      A.reset(h, 'REST', { ...r.state, mode: 'REST' });
      r.state.mode = 'REST';
      document.querySelector('[data-motion="REST"]').click();
      r.state.playing = false;
      return { measure: A.measure(h), bodyNodes: h.state.body.q.length, finChains: Object.keys(h.state.parts).length, modes: snapshots, deterministicReplay, eyes: h.metadata.continuum.eyes.eyes.length, glError: r.gl.getError(), frames: r.frames, canvas: [r.canvas.width, r.canvas.height], instrumentAbi: A.ABI, version: document.getElementById('version').textContent };
    });
    await page.screenshot({ path: path.join(root, 'evidence', `${label}-${viewport.width}-rest.png`), fullPage: true });
    await page.locator('[data-motion="EYE_TRACK"]').click();
    await page.locator('[data-view="eyePos"]').click();
    await page.locator('#eyeYaw').evaluate(input => { input.value = '.15'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    const eyeInteraction = await page.evaluate(() => {
      const { renderer: r, handle: h, instrument: A } = window.__KAOPU_R05__;
      r.state.playing = false;
      for (let i = 0; i < 60; i++) A.update(h, 1/60, r.state);
      return { mode: r.state.mode, yawOffset: r.state.eyeYawOffset, eye: A.snapshot(h).eye, cameraZoom: r.camera.zoom, finite: A.snapshot(h).eye.every(Number.isFinite), glError: r.gl.getError() };
    });
    await page.screenshot({ path: path.join(root, 'evidence', `${label}-${viewport.width}-eye.png`), fullPage: true });
    const entry = { viewport, httpStatus: response?.status() ?? null, ready: true, checks, eyeInteraction, errors, failedRequests, externalRequests };
    report.views.push(entry);
    console.log(JSON.stringify({ viewport, modeCount: checks.modes.length, deterministicReplay: checks.deterministicReplay, glError: checks.glError, errors, failedRequests, externalRequests }));
    await context.close();
  }
  report.passed = report.views.every(v => !v.errors.length && !v.failedRequests.length && !v.externalRequests.length && v.checks.glError === 0 && v.eyeInteraction.glError === 0 && v.checks.deterministicReplay && v.eyeInteraction.finite);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.passed = false;
  report.error = String(error.stack || error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, 'evidence', `${label}-BROWSER_REPORT.json`), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
