import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_PATH;
const baseUrl = process.env.QA_BASE || 'http://127.0.0.1:8765';
const outputDir = process.env.QA_OUT || 'browser-qa';

if (!chromePath) throw new Error('CHROME_PATH is required');
fs.mkdirSync(outputDir, { recursive: true });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--window-size=900,650'
  ]
});

const aggregate = {
  status: 'running',
  webgl2Active: false,
  manualCameraInteractionVerified: false,
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  desktop: null,
  mobile: null
};

async function audit(name, viewport, screenshotName) {
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(() => {
    try {
      Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 4 });
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 });
    } catch (_) {}
  });

  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => {
    const failure = request.failure();
    requestFailures.push(`${request.url()} :: ${failure?.errorText || 'request failed'}`);
  });

  const url = `${baseUrl}/index.html?qa=${Date.now()}-${name}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

  await page.waitForFunction(() => {
    const viewer = document.documentElement.dataset.viewer || '';
    const text = document.getElementById('status')?.textContent || '';
    return viewer === 'ready' || viewer === 'fallback' || /^V004\s*·/.test(text) || /失败|无法|错误|二维云南/.test(text);
  }, { polling: 500, timeout: 180000 });

  const runtime = await page.evaluate(() => {
    const canvas = document.getElementById('terrain');
    const fallback = document.getElementById('fallback');
    const status = document.getElementById('status')?.textContent || '';
    const viewer = document.documentElement.dataset.viewer || '';
    const gl = canvas?.getContext('webgl2');
    const count = id => Number((document.getElementById(id)?.textContent || '').replace(/[^0-9]/g, ''));
    const text = document.body.innerText;
    const expectedControlIds = [
      'richness',
      'moisture',
      'rock',
      'waterColor',
      'hydroDetail',
      'riverWidth',
      'flowSpeed',
      'wave',
      'toggleRivers',
      'toggleLakes'
    ];
    return {
      viewer,
      readyByStatus: /^V004\s*·/.test(status),
      status,
      webgl2Active: Boolean(gl),
      canvasHidden: Boolean(canvas?.hidden),
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      fallbackHidden: Boolean(fallback?.hidden),
      waterwayCount: count('riverCount'),
      waterAreaCount: count('lakeCount'),
      modeButtonCount: document.querySelectorAll('[data-mode]').length,
      hasCameraPresetButtons: ['overview', 'top', 'north', 'viewHome', 'viewTop', 'viewLow'].some(id => document.getElementById(id)),
      hasExpectedControls: expectedControlIds.every(id => document.getElementById(id)),
      bodyMentionsOsm: /OSM/.test(text)
    };
  });

  if (!(runtime.viewer === 'ready' || runtime.readyByStatus)) {
    throw new Error(`${name} viewer did not enter ready state: ${JSON.stringify(runtime)}`);
  }
  if (!runtime.webgl2Active || runtime.canvasHidden || !runtime.fallbackHidden) {
    throw new Error(`${name} WebGL2 canvas validation failed: ${JSON.stringify(runtime)}`);
  }
  if (runtime.waterwayCount < 1 || runtime.waterAreaCount < 1 || !runtime.bodyMentionsOsm) {
    throw new Error(`${name} OSM counts or attribution missing: ${JSON.stringify(runtime)}`);
  }
  if (runtime.hasCameraPresetButtons || !runtime.hasExpectedControls || runtime.modeButtonCount !== 4) {
    throw new Error(`${name} control contract failed: ${JSON.stringify(runtime)}`);
  }

  const canvasHandle = await page.$('#terrain');
  const box = await canvasHandle.boundingBox();
  if (!box || box.width < 100 || box.height < 100) throw new Error(`${name} canvas bounding box invalid`);

  const beforeData = await page.evaluate(() => document.getElementById('terrain').toDataURL('image/png'));
  const centerX = box.x + box.width * 0.58;
  const centerY = box.y + box.height * 0.55;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(centerX + Math.min(90, box.width * 0.18), centerY - Math.min(45, box.height * 0.12), { steps: 10 });
  await page.mouse.up({ button: 'left' });
  await page.mouse.wheel({ deltaY: -360 });
  await delay(900);

  await page.evaluate(() => {
    const richness = document.getElementById('richness');
    richness.value = '73';
    richness.dispatchEvent(new Event('input', { bubbles: true }));
    const riverWidth = document.getElementById('riverWidth');
    riverWidth.value = '58';
    riverWidth.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay(700);

  const afterData = await page.evaluate(() => document.getElementById('terrain').toDataURL('image/png'));
  const beforeHash = digest(beforeData);
  const afterHash = digest(afterData);
  if (beforeHash === afterHash) throw new Error(`${name} canvas did not change after camera and parameter interaction`);

  const screenshotPath = path.join(outputDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  if (!fs.existsSync(screenshotPath) || fs.statSync(screenshotPath).size < 30000) {
    throw new Error(`${name} screenshot missing or too small`);
  }

  const result = {
    ...runtime,
    viewport,
    screenshot: screenshotName,
    screenshotBytes: fs.statSync(screenshotPath).size,
    canvasBeforeSha256: beforeHash,
    canvasAfterSha256: afterHash,
    manualCameraInteractionVerified: true,
    consoleErrors,
    pageErrors,
    requestFailures
  };

  aggregate.consoleErrors.push(...consoleErrors.map(value => `${name}: ${value}`));
  aggregate.pageErrors.push(...pageErrors.map(value => `${name}: ${value}`));
  aggregate.requestFailures.push(...requestFailures.map(value => `${name}: ${value}`));
  await page.close();
  return result;
}

try {
  aggregate.desktop = await audit('desktop', { width: 900, height: 650, deviceScaleFactor: 1 }, 'KUNMING_V004_DESKTOP.png');
  aggregate.mobile = await audit('mobile', { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, 'KUNMING_V004_MOBILE.png');
  aggregate.webgl2Active = aggregate.desktop.webgl2Active && aggregate.mobile.webgl2Active;
  aggregate.manualCameraInteractionVerified = aggregate.desktop.manualCameraInteractionVerified && aggregate.mobile.manualCameraInteractionVerified;
  if (aggregate.consoleErrors.length || aggregate.pageErrors.length || aggregate.requestFailures.length) {
    throw new Error(`browser errors detected: ${JSON.stringify({ consoleErrors: aggregate.consoleErrors, pageErrors: aggregate.pageErrors, requestFailures: aggregate.requestFailures })}`);
  }
  aggregate.status = 'pass';
} catch (error) {
  aggregate.status = 'fail';
  aggregate.failure = String(error?.stack || error);
  console.error(aggregate.failure);
} finally {
  fs.writeFileSync(path.join(outputDir, 'BROWSER_QA.json'), JSON.stringify(aggregate, null, 2));
  await browser.close();
}

if (aggregate.status !== 'pass') process.exit(1);
console.log(JSON.stringify(aggregate, null, 2));
