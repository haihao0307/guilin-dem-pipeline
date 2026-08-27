import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.WENZHOU_V110_URL || 'http://127.0.0.1:18991/web/wenzhou-v110/';
const evidenceDir = path.resolve('projects/wenzhou/evidence/v110');
await fs.mkdir(evidenceDir, { recursive: true });

const requiredResponses = new Map();
const consoleErrors = [];
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});

async function openPage(viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ label, text: message.text() });
  });
  page.on('pageerror', (error) => pageErrors.push({ label, text: String(error.stack || error) }));
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/web/wenzhou-v110/')) requiredResponses.set(url, response.status());
  });
  const started = Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const domReadyMs = Date.now() - started;
  await page.waitForFunction(() => window.__WENZHOU_V110_DIAGNOSTICS__?.ready === true, null, { timeout: 180_000 });
  const terrainReadyMs = Date.now() - started;
  return { context, page, domReadyMs, terrainReadyMs };
}

const desktop = await openPage({ width: 1600, height: 900 }, 'desktop');
const page = desktop.page;
let diagnostics = await page.evaluate(() => window.__WENZHOU_V110_DIAGNOSTICS__);
if (!diagnostics.ready) throw new Error('runtime not ready');
if (diagnostics.renderer !== 'WebGL2') throw new Error('WebGL2 renderer missing');
if (!diagnostics.perspectiveProjectionActive || !diagnostics.depthTestActive) throw new Error('3D projection or depth test missing');
if (diagnostics.terrainTriangleCount < 100_000) throw new Error('terrain triangle count too low');
if (diagnostics.terrainElevationRangeMeters[1] <= diagnostics.terrainElevationRangeMeters[0]) throw new Error('terrain elevation range is flat');
if (diagnostics.riverParts < 2_000 || diagnostics.coastlineParts < 900) throw new Error('OSM water assets incomplete');
if (!diagnostics.oceanVisible || !diagnostics.bathymetryVisible || !diagnostics.riversVisible) throw new Error('required water layers are hidden');
if (diagnostics.truthDemSha256 !== '8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e') throw new Error('truth SHA mismatch');

await page.screenshot({ path: path.join(evidenceDir, 'desktop-overview-ui.png') });
await page.evaluate(() => document.querySelector('#controller').classList.remove('open'));
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(evidenceDir, 'desktop-overview-clear.png') });

const beforeDrag = await page.evaluate(() => ({ azimuth: window.__WENZHOU_V110_DIAGNOSTICS__.camera.azimuth, elevation: window.__WENZHOU_V110_DIAGNOSTICS__.camera.elevation }));
await page.mouse.move(700, 420);
await page.mouse.down();
await page.mouse.move(840, 500, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(1200);
const afterDrag = await page.evaluate(() => ({ azimuth: window.__WENZHOU_V110_DIAGNOSTICS__.camera.azimuth, elevation: window.__WENZHOU_V110_DIAGNOSTICS__.camera.elevation }));
if (afterDrag.azimuth === beforeDrag.azimuth || afterDrag.elevation === beforeDrag.elevation) throw new Error('camera drag did not change azimuth and elevation');

await page.click('[data-anchor="yandang"]');
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(evidenceDir, 'desktop-yandang.png') });
await page.click('[data-anchor="oujiang"]');
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(evidenceDir, 'desktop-oujiang-estuary.png') });
await page.click('[data-anchor="yueqing"]');
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(evidenceDir, 'desktop-yueqing-bay.png') });

const widthInvariant = await page.evaluate(() => {
  const before = state.riverData.sourceCoordinateSha256;
  const input = document.querySelector('#riverWidth');
  input.value = '2';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return {
    before,
    after: state.riverData.sourceCoordinateSha256,
    width: state.riverWidth,
    partCount: state.riverData.partCount,
  };
});
if (widthInvariant.before !== widthInvariant.after || widthInvariant.width !== 2) throw new Error('river width changed centerline identity');

diagnostics = await page.evaluate(() => window.__WENZHOU_V110_DIAGNOSTICS__);
await desktop.context.close();

const mobile = await openPage({ width: 390, height: 844 }, 'mobile');
await mobile.page.screenshot({ path: path.join(evidenceDir, 'mobile-overview.png') });
const mobileDiagnostics = await mobile.page.evaluate(() => window.__WENZHOU_V110_DIAGNOSTICS__);
if (mobileDiagnostics.terrainGrid[0] !== 257) throw new Error('mobile terrain budget did not select 257 grid');
await mobile.context.close();
await browser.close();

const failedResponses = [...requiredResponses.entries()].filter(([, status]) => status !== 200 && status !== 206);
if (consoleErrors.length || pageErrors.length || failedResponses.length) {
  throw new Error(JSON.stringify({ consoleErrors, pageErrors, failedResponses }, null, 2));
}

const report = {
  schema: 'wenzhou_v110_browser_qa@1.0.0',
  generatedAtUtc: new Date().toISOString(),
  passed: true,
  url: baseURL,
  desktop: {
    viewport: [1600, 900],
    domReadyMs: desktop.domReadyMs,
    terrainReadyMs: desktop.terrainReadyMs,
    diagnostics,
    beforeDrag,
    afterDrag,
    widthInvariant,
  },
  mobile: {
    viewport: [390, 844],
    domReadyMs: mobile.domReadyMs,
    terrainReadyMs: mobile.terrainReadyMs,
    diagnostics: mobileDiagnostics,
  },
  requiredResponses: Object.fromEntries(requiredResponses),
  consoleErrors,
  pageErrors,
  publicationBlocked: true,
};
await fs.writeFile('projects/wenzhou/reports/WENZHOU_V110_BROWSER_QA.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
