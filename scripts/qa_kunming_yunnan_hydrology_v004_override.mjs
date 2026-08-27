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
const cameraChanged = (before, after) =>
  Math.abs(after.yaw - before.yaw) > 0.0001 ||
  Math.abs(after.pitch - before.pitch) > 0.0001 ||
  Math.abs(after.distance - before.distance) > 0.01 ||
  Math.abs(after.x - before.x) > 0.01 ||
  Math.abs(after.z - before.z) > 0.01;

async function dispatchTouchDrag(page, startX, startY, endX, endY) {
  const client = await page.createCDPSession();
  const touchPoint = (x, y) => ({
    x,
    y,
    id: 1,
    radiusX: 2,
    radiusY: 2,
    rotationAngle: 0,
    force: 1
  });
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touchPoint(startX, startY)]
    });
    for (let step = 1; step <= 10; step += 1) {
      const t = step / 10;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [touchPoint(
          startX + (endX - startX) * t,
          startY + (endY - startY) * t
        )]
      });
      await delay(20);
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
  } finally {
    await client.detach();
  }
}

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
  buttonlessCameraVerified: false,
  touchDragVerified: false,
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  desktop: null,
  mobile: null
};

async function audit(name, viewport, screenshotName) {
  const page = await browser.newPage();
  const desktopMouseAudit = name === 'desktop';
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
      buttonlessCameraEnabled: document.documentElement.dataset.buttonlessCamera === 'enabled',
      qaCameraAvailable: Boolean(window.__KUNMING_V004_QA_CAMERA__),
      touchAction: canvas?.style.touchAction || '',
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
  if (!runtime.buttonlessCameraEnabled || !runtime.qaCameraAvailable || runtime.touchAction !== 'none') {
    throw new Error(`${name} camera state or touch-action contract missing: ${JSON.stringify(runtime)}`);
  }

  const canvasHandle = await page.$('#terrain');
  const box = await canvasHandle.boundingBox();
  if (!box || box.width < 100 || box.height < 100) throw new Error(`${name} canvas bounding box invalid`);

  const beforeData = await page.evaluate(() => document.getElementById('terrain').toDataURL('image/png'));
  const cameraBefore = await page.evaluate(() => ({ ...window.__KUNMING_V004_QA_CAMERA__ }));
  const centerX = box.x + box.width * 0.58;
  const centerY = box.y + box.height * 0.55;

  let cameraAfterHover = cameraBefore;
  let buttonlessCameraVerified = null;
  if (desktopMouseAudit) {
    await page.mouse.move(centerX, centerY);
    await delay(80);
    await page.mouse.move(
      centerX + Math.min(82, box.width * 0.16),
      centerY - Math.min(38, box.height * 0.10),
      { steps: 10 }
    );
    await delay(300);
    cameraAfterHover = await page.evaluate(() => ({ ...window.__KUNMING_V004_QA_CAMERA__ }));
    buttonlessCameraVerified = cameraChanged(cameraBefore, cameraAfterHover);
    if (!buttonlessCameraVerified) {
      throw new Error(`${name} camera did not change after buttonless mouse movement: ${JSON.stringify({ cameraBefore, cameraAfterHover })}`);
    }
  }

  if (desktopMouseAudit) {
    const dragStartX = centerX + Math.min(82, box.width * 0.16);
    const dragStartY = centerY - Math.min(38, box.height * 0.10);
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(
      dragStartX + Math.min(72, box.width * 0.16),
      dragStartY - Math.min(42, box.height * 0.12),
      { steps: 8 }
    );
    await page.mouse.up({ button: 'left' });
    await page.mouse.wheel({ deltaY: -360 });
  } else {
    await dispatchTouchDrag(
      page,
      centerX,
      centerY,
      centerX + Math.min(72, box.width * 0.16),
      centerY - Math.min(42, box.height * 0.12)
    );
  }
  await delay(650);

  const cameraAfterDrag = await page.evaluate(() => ({ ...window.__KUNMING_V004_QA_CAMERA__ }));
  const dragCameraVerified = cameraChanged(cameraAfterHover, cameraAfterDrag);
  if (!dragCameraVerified) {
    throw new Error(`${name} camera did not change after ${desktopMouseAudit ? 'drag or wheel' : 'real touch drag'} input: ${JSON.stringify({ cameraAfterHover, cameraAfterDrag })}`);
  }

  await page.evaluate(() => {
    const richness = document.getElementById('richness');
    richness.value = '73';
    richness.dispatchEvent(new Event('input', { bubbles: true }));
    const riverWidth = document.getElementById('riverWidth');
    riverWidth.value = '58';
    riverWidth.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay(550);

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
    cameraBefore,
    cameraAfterHover,
    cameraAfterDrag,
    buttonlessCameraVerified,
    dragCameraVerified,
    touchDragVerified: desktopMouseAudit ? null : dragCameraVerified,
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
  aggregate.buttonlessCameraVerified = aggregate.desktop.buttonlessCameraVerified === true;
  aggregate.touchDragVerified = aggregate.mobile.touchDragVerified === true;
  if (!aggregate.buttonlessCameraVerified) throw new Error('desktop buttonless mouse camera verification failed');
  if (!aggregate.touchDragVerified) throw new Error('mobile touch drag verification failed');
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
