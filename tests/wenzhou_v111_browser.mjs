import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const url = process.env.WENZHOU_V111_URL || 'http://127.0.0.1:18992/web/wenzhou-v111/';
const root = process.cwd();
const evidenceDir = path.join(root, 'projects/wenzhou/evidence/v111');
const reportPath = path.join(root, 'projects/wenzhou/reports/WENZHOU_V111_BROWSER_QA.json');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitReady(page, timeout = 180000) {
  await page.waitForFunction(() => window.__WENZHOU_V111_DIAGNOSTICS__?.ready === true, null, { timeout });
  return page.evaluate(() => structuredClone(window.__WENZHOU_V111_DIAGNOSTICS__));
}

async function activateAnchor(page, id) {
  const started = Date.now();
  await page.evaluate((anchorId) => {
    const button = document.querySelector(`[data-anchor="${anchorId}"]`);
    if (!(button instanceof HTMLButtonElement)) throw new Error(`missing camera anchor: ${anchorId}`);
    button.click();
  }, id);
  await page.waitForFunction((anchorId) => {
    const button = document.querySelector(`[data-anchor="${anchorId}"]`);
    return button?.classList.contains('active') === true;
  }, id, { timeout: 120000 });
  return Date.now() - started;
}

async function scenario(browser, name, viewport, mobile) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message || error)));
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'failed' }));

  const started = Date.now();
  await page.goto(`${url}?qa=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const initial = await waitReady(page);
  const readyMs = Date.now() - started;

  const overviewFile = path.join(evidenceDir, `${name}-overview.png`);
  await page.screenshot({ path: overviewFile, fullPage: false });

  const canvas = page.locator('#gl');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('WebGL canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.50, box.y + box.height * 0.52);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.66, box.y + box.height * 0.40, { steps: 14 });
  await page.mouse.up();
  await sleep(1000);
  const afterDrag = await page.evaluate(() => structuredClone(window.__WENZHOU_V111_DIAGNOSTICS__));

  let detail = null;
  let yandangFile = null;
  const interactionTimingsMs = {};
  if (!mobile) {
    interactionTimingsMs.yandangAnchor = await activateAnchor(page, 'yandang');
    const detailStarted = Date.now();
    await page.waitForFunction(() => window.__WENZHOU_V111_DIAGNOSTICS__?.detailGrid?.[0] >= 1025, null, { timeout: 180000 });
    interactionTimingsMs.yandangDetailReady = Date.now() - detailStarted;
    await sleep(1800);
    detail = await page.evaluate(() => structuredClone(window.__WENZHOU_V111_DIAGNOSTICS__));
    yandangFile = path.join(evidenceDir, `${name}-yandang-12_5m.png`);
    await page.screenshot({ path: yandangFile, fullPage: false });

    interactionTimingsMs.oujiangAnchor = await activateAnchor(page, 'oujiang');
    await sleep(3200);
    await page.screenshot({ path: path.join(evidenceDir, `${name}-oujiang.png`), fullPage: false });

    interactionTimingsMs.yueqingAnchor = await activateAnchor(page, 'yueqing');
    await sleep(3200);
    await page.screenshot({ path: path.join(evidenceDir, `${name}-yueqing-bay.png`), fullPage: false });
  }

  const fatalRequests = requestFailures.filter((item) => {
    if (item.url.includes('tiles.maps.eox.at')) return false;
    return true;
  });
  const passed = initial.renderer === 'WebGL2'
    && initial.perspectiveProjectionActive === true
    && initial.depthTestActive === true
    && initial.terrainGrid[0] >= (mobile ? 513 : 1025)
    && initial.terrainElevationRangeMeters[1] > initial.terrainElevationRangeMeters[0]
    && Math.abs(afterDrag.camera.azimuth - initial.camera.azimuth) > 0.01
    && consoleErrors.length === 0
    && pageErrors.length === 0
    && fatalRequests.length === 0
    && (mobile || (
      detail?.detailGrid?.[0] >= 1025
      && detail?.detailSpacingMeters === 12.5
      && interactionTimingsMs.yandangAnchor < 10000
      && interactionTimingsMs.yandangDetailReady < 120000
    ));

  const files = fs.readdirSync(evidenceDir)
    .filter((entry) => entry.startsWith(`${name}-`) && entry.endsWith('.png'))
    .map((entry) => ({
      path: `projects/wenzhou/evidence/v111/${entry}`,
      bytes: fs.statSync(path.join(evidenceDir, entry)).size,
      sha256: sha256(path.join(evidenceDir, entry)),
    }));

  await context.close();
  return {
    name,
    viewport,
    mobile,
    passed,
    readyMs,
    initial,
    afterDrag,
    detail,
    interactionTimingsMs,
    consoleErrors,
    pageErrors,
    requestFailures,
    fatalRequestFailures: fatalRequests,
    screenshots: files,
  };
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
});

let report;
try {
  const desktop = await scenario(browser, 'desktop-1920x1080', { width: 1920, height: 1080 }, false);
  const mobile = await scenario(browser, 'mobile-390x844', { width: 390, height: 844 }, true);
  report = {
    schema: 'wenzhou_v111_browser_qa@1.1.1',
    generatedAtUtc: new Date().toISOString(),
    url,
    passed: desktop.passed && mobile.passed,
    desktop,
    mobile,
    acceptance: {
      truthful3D: true,
      terrainOverviewMinimumGrid: 1025,
      nativeDetailSpacingMeters: 12.5,
      losslessOfflineTexture: true,
      vectorsClippedToTruthAoi: true,
      riverSamplesSourceDraped: true,
      floatingOuterRingForbidden: true,
      permanentWaterVaporArtifactForbidden: true,
      globalHydrologyUsesScreenLod: true,
      localHydrologyUsesFull25mSamples: true,
      consoleErrorsRequired: 0,
      pageErrorsRequired: 0,
    },
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser.close();
}
