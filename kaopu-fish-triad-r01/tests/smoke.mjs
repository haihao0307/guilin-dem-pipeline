import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const target = process.env.TARGET_URL;
if (!target) throw new Error('TARGET_URL is required');
const artifactDir = process.env.QA_DIR || 'qa-artifacts';
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { target, testedAtUtc: new Date().toISOString(), desktop: null, mobile: null };

async function run(name, viewport) {
  const page = await browser.newPage({ viewportSize: viewport, deviceScaleFactor: 1 });
  const errors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('request', (request) => {
    const url = new URL(request.url());
    const origin = new URL(target).origin;
    if (!['file:', 'data:', 'blob:'].includes(url.protocol) && url.origin !== origin) externalRequests.push(request.url());
  });
  await page.goto(target, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__KAOPU_READY__ === true, null, { timeout: 120000 });
  await page.waitForTimeout(1400);
  const initial = await page.evaluate(() => ({
    ready: window.__KAOPU_READY__,
    stats: window.__KAOPU_DIAGNOSTICS__?.stats,
    canvas: { width: document.querySelector('#stage')?.width, height: document.querySelector('#stage')?.height },
    externalModels: window.__KAOPU_SCORE__?.provenance?.externalAssetInFormalBuild,
    bones: window.__KAOPU_HANDLE__?.skeleton?.bones?.length,
    bodySkinned: Boolean(window.__KAOPU_HANDLE__?.body?.isSkinnedMesh)
  }));
  if (!initial.ready || !initial.bodySkinned) throw new Error(`${name}: formal SkinnedMesh not ready`);
  if (initial.externalModels !== false) throw new Error(`${name}: formal runtime must have zero external teacher assets`);
  if (initial.bones !== 14) throw new Error(`${name}: expected 14 bones, got ${initial.bones}`);
  if (!initial.stats || initial.stats.vertices < 6500 || initial.stats.triangles < 12000) throw new Error(`${name}: geometry metrics too small`);
  if (!initial.canvas.width || !initial.canvas.height) throw new Error(`${name}: canvas has no drawable size`);
  await page.click('[data-motion="RIG_SERIAL_CHECK"]');
  await page.waitForTimeout(650);
  const rigMode = await page.textContent('#motionReadout');
  if (rigMode !== 'RIG_SERIAL_CHECK') throw new Error(`${name}: motion button did not change formal performer`);
  await page.click('[data-view="skeleton"]');
  await page.waitForTimeout(350);
  const skeletonVisible = await page.evaluate(() => window.__KAOPU_HANDLE__.skeletonHelper.visible);
  if (!skeletonVisible) throw new Error(`${name}: skeleton helper not visible`);
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
  const result = { viewport, initial, errors, failedRequests, externalRequests, rigMode, skeletonVisible };
  await page.close();
  if (errors.length) throw new Error(`${name}: browser errors: ${errors.join(' | ')}`);
  if (failedRequests.length) throw new Error(`${name}: failed requests: ${failedRequests.join(' | ')}`);
  if (externalRequests.length) throw new Error(`${name}: required external requests: ${externalRequests.join(' | ')}`);
  return result;
}

try {
  results.desktop = await run('desktop', { width: 1440, height: 920 });
  results.mobile = await run('mobile', { width: 390, height: 844 });
  await writeFile(path.join(artifactDir, target.startsWith('http') ? 'public-results.json' : 'standalone-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, target, desktop: results.desktop.initial.stats, mobile: results.mobile.initial.stats }, null, 2));
} finally {
  await browser.close();
}
