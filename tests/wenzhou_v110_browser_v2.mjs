import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.WENZHOU_V110_URL || 'http://127.0.0.1:18991/web/wenzhou-v110/';
const root = process.cwd();
const evidenceDir = path.join(root, 'projects/wenzhou/evidence/v110');
const reportPath = path.join(root, 'projects/wenzhou/reports/WENZHOU_V110_BROWSER_QA.json');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForRuntime(page) {
  await page.waitForSelector('#gl', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#gl');
    const loading = document.querySelector('#loadingCard');
    const status = document.querySelector('#runtimeState');
    const readyText = `${status?.textContent || ''} ${document.querySelector('#statusText')?.textContent || ''}`;
    const loadingHidden = !loading || loading.classList.contains('hidden') || getComputedStyle(loading).display === 'none' || Number(getComputedStyle(loading).opacity) < 0.05;
    return Boolean(canvas && canvas.width > 64 && canvas.height > 64 && loadingHidden && !/初始化|正在载入真实三维资产/.test(readyText));
  }, { timeout: 75_000 });
  await page.waitForTimeout(2_000);
}

async function canvasProbe(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#gl');
    const gl = canvas?.getContext('webgl2');
    if (!canvas || !gl) return { webgl2: false, width: canvas?.width || 0, height: canvas?.height || 0 };
    const sampleWidth = Math.min(32, canvas.width);
    const sampleHeight = Math.min(32, canvas.height);
    const x = Math.max(0, Math.floor((canvas.width - sampleWidth) / 2));
    const y = Math.max(0, Math.floor((canvas.height - sampleHeight) / 2));
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
    gl.readPixels(x, y, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let minimum = 255;
    let maximum = 0;
    let nonzero = 0;
    let sum = 0;
    const values = new Set();
    for (const value of pixels) {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      sum += value;
      if (value !== 0) nonzero += 1;
      values.add(value);
    }
    return {
      webgl2: true,
      width: canvas.width,
      height: canvas.height,
      minimum,
      maximum,
      mean: sum / pixels.length,
      nonzero,
      uniqueValues: values.size,
      depthTest: gl.isEnabled(gl.DEPTH_TEST),
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
    };
  });
}

async function snapshotCanvas(page, filename) {
  const target = page.locator('#gl');
  const buffer = await target.screenshot({ path: path.join(evidenceDir, filename), type: 'png' });
  return { filename, bytes: buffer.length, sha256: sha256(buffer) };
}

async function readUi(page) {
  return page.evaluate(() => ({
    truth: document.querySelector('#truthTag')?.textContent?.trim() || '',
    material: document.querySelector('#materialTag')?.textContent?.trim() || '',
    hydrology: document.querySelector('#hydrologyTag')?.textContent?.trim() || '',
    runtimeState: document.querySelector('#runtimeState')?.textContent?.trim() || '',
    status: document.querySelector('#statusText')?.textContent?.trim() || '',
    camera: document.querySelector('#cameraReadout')?.textContent?.trim() || '',
    renderer: document.querySelector('#renderReadout')?.textContent?.trim() || '',
    grid: document.querySelector('#gridMetric')?.textContent?.trim() || '',
    triangles: document.querySelector('#triangleMetric')?.textContent?.trim() || '',
    elevation: document.querySelector('#elevationMetric')?.textContent?.trim() || '',
    rivers: document.querySelector('#riverMetric')?.textContent?.trim() || '',
    coast: document.querySelector('#coastMetric')?.textContent?.trim() || '',
    bathy: document.querySelector('#bathyMetric')?.textContent?.trim() || '',
    loadingVisible: (() => {
      const el = document.querySelector('#loadingCard');
      if (!el) return false;
      const style = getComputedStyle(el);
      return !el.classList.contains('hidden') && style.display !== 'none' && Number(style.opacity) > 0.05;
    })(),
    errorVisible: (() => {
      const el = document.querySelector('#errorCard');
      if (!el) return false;
      const style = getComputedStyle(el);
      return el.classList.contains('visible') || (style.display !== 'none' && Number(style.opacity) > 0.05);
    })(),
  }));
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));

  const startedAt = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForRuntime(page);
  const initialProbe = await canvasProbe(page);
  const initialUi = await readUi(page);
  const overall = await snapshotCanvas(page, 'desktop-overall-oblique.png');

  const cameraBeforeAnchor = initialUi.camera;
  await page.click('[data-anchor="yandang"]');
  await page.waitForTimeout(5_000);
  const yandangUi = await readUi(page);
  const yandang = await snapshotCanvas(page, 'desktop-yandang-oblique.png');

  await page.click('[data-anchor="oujiang"]');
  await page.waitForTimeout(5_000);
  const oujiangUi = await readUi(page);
  const oujiang = await snapshotCanvas(page, 'desktop-oujiang-estuary.png');

  const canvas = page.locator('#gl');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('WebGL canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.50);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(box.x + box.width * 0.67, box.y + box.height * 0.37, { steps: 14 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(2_500);
  const rotatedUi = await readUi(page);
  const rotated = await snapshotCanvas(page, 'desktop-oujiang-rotated.png');

  await page.click('[data-material="hillshade"]');
  await page.waitForTimeout(2_000);
  const hillshade = await snapshotCanvas(page, 'desktop-hillshade.png');
  await page.click('[data-material="satellite"]');
  await page.waitForTimeout(1_500);

  await setRange(page, '#riverWidth', 2.0);
  await page.waitForTimeout(1_000);
  const riverWide = await snapshotCanvas(page, 'desktop-river-width-2x.png');
  await setRange(page, '#riverWidth', 1.0);

  await page.click('#showOcean');
  await page.waitForTimeout(800);
  await page.click('#showOcean');
  await page.waitForTimeout(800);
  await page.click('#showRivers');
  await page.waitForTimeout(800);
  await page.click('#showRivers');
  await page.waitForTimeout(800);

  await page.click('[data-anchor="yueqing"]');
  await page.waitForTimeout(4_000);
  const yueqing = await snapshotCanvas(page, 'desktop-yueqing-bay.png');
  const finalUi = await readUi(page);
  const finalProbe = await canvasProbe(page);

  const screenshotHashes = [overall, yandang, oujiang, rotated, hillshade, riverWide, yueqing].map((item) => item.sha256);
  const distinctScreenshotCount = new Set(screenshotHashes).size;
  const cameraChangedByAnchor = Boolean(cameraBeforeAnchor && yandangUi.camera && cameraBeforeAnchor !== yandangUi.camera);
  const cameraChangedByDrag = Boolean(oujiangUi.camera && rotatedUi.camera && oujiangUi.camera !== rotatedUi.camera);

  const passed = initialProbe.webgl2
    && initialProbe.depthTest
    && initialProbe.nonzero > 100
    && initialProbe.uniqueValues > 8
    && finalProbe.webgl2
    && distinctScreenshotCount >= 5
    && cameraChangedByAnchor
    && cameraChangedByDrag
    && !finalUi.loadingVisible
    && !finalUi.errorVisible
    && /513/.test(finalUi.grid)
    && /524/.test(finalUi.triangles)
    && consoleErrors.length === 0
    && pageErrors.length === 0;

  const result = {
    passed,
    elapsedMs: Date.now() - startedAt,
    initialProbe,
    finalProbe,
    initialUi,
    yandangUi,
    oujiangUi,
    rotatedUi,
    finalUi,
    cameraChangedByAnchor,
    cameraChangedByDrag,
    distinctScreenshotCount,
    screenshots: [overall, yandang, oujiang, rotated, hillshade, riverWide, yueqing],
    consoleErrors,
    pageErrors,
    failedRequests,
  };
  await context.close();
  return result;
}

async function runMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForRuntime(page);
  const initial = await snapshotCanvas(page, 'mobile-overall.png');
  await page.click('[data-anchor="yandang"]');
  await page.waitForTimeout(4_000);
  const yandang = await snapshotCanvas(page, 'mobile-yandang.png');
  const probe = await canvasProbe(page);
  const ui = await readUi(page);
  const panelButton = page.locator('#panelToggle');
  if (await panelButton.isVisible()) {
    await panelButton.click();
    await page.waitForTimeout(500);
  }
  const fullPage = await page.screenshot({ path: path.join(evidenceDir, 'mobile-full-page.png'), fullPage: true });
  const passed = probe.webgl2
    && probe.nonzero > 100
    && initial.sha256 !== yandang.sha256
    && !ui.loadingVisible
    && !ui.errorVisible
    && consoleErrors.length === 0
    && pageErrors.length === 0;
  const result = {
    passed,
    viewport: [390, 844],
    probe,
    ui,
    screenshots: [initial, yandang, { filename: 'mobile-full-page.png', bytes: fullPage.length, sha256: sha256(fullPage) }],
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
    '--disable-dev-shm-usage',
  ],
});

let report;
try {
  const desktop = await runDesktop(browser);
  const mobile = await runMobile(browser);
  report = {
    schema: 'wenzhou_v110_browser_qa@2.0.0',
    generatedAtUtc: new Date().toISOString(),
    url,
    passed: desktop.passed && mobile.passed,
    renderer: 'WebGL2 truthful Wenzhou terrain runtime',
    truthDemSha256: '8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e',
    bathymetrySha256: '591e92eef61699088a87e32bfd83417498f89cfe3a6a84f4ce6a2e2ac3b689fc',
    osmRiverSourceSha256: '585220c369ed8ec6b588f1913489870c585cc98ddd7c5357beaff9ddaae7a9d9',
    estuaryConnectivityStatus: 'pending',
    fes2022bStatus: 'blocked-on-authoritative-native-model-files',
    desktop,
    mobile,
  };
} finally {
  await browser.close();
}

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  passed: report.passed,
  desktop: {
    passed: report.desktop.passed,
    webgl2: report.desktop.initialProbe.webgl2,
    depthTest: report.desktop.initialProbe.depthTest,
    distinctScreenshotCount: report.desktop.distinctScreenshotCount,
    cameraChangedByAnchor: report.desktop.cameraChangedByAnchor,
    cameraChangedByDrag: report.desktop.cameraChangedByDrag,
    consoleErrors: report.desktop.consoleErrors.length,
    pageErrors: report.desktop.pageErrors.length,
  },
  mobile: {
    passed: report.mobile.passed,
    consoleErrors: report.mobile.consoleErrors.length,
    pageErrors: report.mobile.pageErrors.length,
  },
}, null, 2));

if (!report.passed) process.exit(2);
