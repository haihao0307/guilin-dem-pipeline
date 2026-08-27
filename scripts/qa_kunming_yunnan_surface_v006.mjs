import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_PATH;
const baseUrl = process.env.QA_BASE || 'http://127.0.0.1:8765';
const outputDir = process.env.QA_OUT || 'browser-qa-v006';
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
    '--use-angle=swiftshader'
  ]
});

const aggregate = {
  status: 'running',
  webgl2Active: false,
  orientationVerified: false,
  orbitVerified: false,
  panVerified: false,
  riverDefaultsVerified: false,
  staticWaterVerified: false,
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
      Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 });
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 });
    } catch (_) {}
  });
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => requestFailures.push(`${request.url()} :: ${request.failure()?.errorText || 'request failed'}`));

  await page.goto(`${baseUrl}/index.html?qa=${Date.now()}-${name}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => {
    const viewer = document.documentElement.dataset.viewer || '';
    const text = document.getElementById('status')?.textContent || '';
    return viewer === 'ready' || viewer === 'fallback' || /失败|无法|错误/.test(text);
  }, { polling: 400, timeout: 180000 });
  await delay(800);

  const runtime = await page.evaluate(() => {
    const canvas = document.getElementById('terrain');
    const fallback = document.getElementById('fallback');
    const compass = document.getElementById('compassNeedle');
    return {
      viewer: document.documentElement.dataset.viewer || '',
      orientation: document.documentElement.dataset.orientation || '',
      controls: document.documentElement.dataset.controls || '',
      status: document.getElementById('status')?.textContent || '',
      webgl2Active: Boolean(canvas?.getContext('webgl2')),
      canvasHidden: Boolean(canvas?.hidden),
      fallbackHidden: Boolean(fallback?.hidden),
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      riverWidth: document.getElementById('riverWidth')?.value || '',
      hydroDetail: document.getElementById('hydroDetail')?.value || '',
      waveControlPresent: Boolean(document.getElementById('wave')),
      flowControlPresent: Boolean(document.getElementById('flowSpeed')),
      compassTransform: compass?.style.transform || '',
      hasCompass: Boolean(compass),
      bodyMentionsStaticWater: /静态水/.test(document.body.innerText),
      bodyMentionsYunnan: /云南高原/.test(document.body.innerText),
      hasPresetButtons: ['overview','top','north','viewHome','viewTop','viewLow'].some(id => Boolean(document.getElementById(id)))
    };
  });

  if (runtime.viewer !== 'ready') throw new Error(`${name} viewer state failed: ${JSON.stringify(runtime)}`);
  if (!runtime.webgl2Active || runtime.canvasHidden || !runtime.fallbackHidden) throw new Error(`${name} WebGL2 state failed: ${JSON.stringify(runtime)}`);
  if (runtime.orientation !== 'east-positive-x_north-negative-z' || runtime.controls !== 'orbit-standard') throw new Error(`${name} orientation/control contract failed: ${JSON.stringify(runtime)}`);
  if (runtime.riverWidth !== '4' || runtime.hydroDetail !== '0') throw new Error(`${name} river defaults failed: ${JSON.stringify(runtime)}`);
  if (runtime.waveControlPresent || runtime.flowControlPresent || !runtime.bodyMentionsStaticWater) throw new Error(`${name} static water contract failed: ${JSON.stringify(runtime)}`);
  if (!runtime.bodyMentionsYunnan || runtime.hasPresetButtons || !runtime.hasCompass) throw new Error(`${name} UI contract failed: ${JSON.stringify(runtime)}`);

  const canvasHandle = await page.$('#terrain');
  const box = await canvasHandle.boundingBox();
  if (!box || box.width < 100 || box.height < 100) throw new Error(`${name} canvas box invalid`);
  const centerX = name === 'mobile' ? box.x + box.width * 0.72 : box.x + box.width * 0.62;
  const centerY = name === 'mobile' ? box.y + box.height * 0.82 : box.y + box.height * 0.57;
  const hitTarget = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id || document.elementFromPoint(x, y)?.tagName || '', { x: centerX, y: centerY });
  if (hitTarget !== 'terrain') throw new Error(`${name} interaction point blocked by ${hitTarget}`);

  const before = await page.evaluate(() => ({
    canvas: document.getElementById('terrain').toDataURL('image/png'),
    compass: document.getElementById('compassNeedle')?.style.transform || ''
  }));
  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(centerX + Math.min(100, box.width * 0.18), centerY - Math.min(55, box.height * 0.12), { steps: 12 });
  await page.mouse.up({ button: 'left' });
  await delay(500);
  const afterOrbit = await page.evaluate(() => ({
    canvas: document.getElementById('terrain').toDataURL('image/png'),
    compass: document.getElementById('compassNeedle')?.style.transform || ''
  }));
  if (digest(before.canvas) === digest(afterOrbit.canvas) || before.compass === afterOrbit.compass) throw new Error(`${name} orbit or compass did not change`);

  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(centerX - Math.min(70, box.width * 0.12), centerY + Math.min(45, box.height * 0.10), { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await page.mouse.wheel({ deltaY: -260 });
  await delay(600);
  const afterPan = await page.evaluate(() => document.getElementById('terrain').toDataURL('image/png'));
  if (digest(afterOrbit.canvas) === digest(afterPan)) throw new Error(`${name} pan/zoom did not change canvas`);

  const screenshotPath = path.join(outputDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  if (!fs.existsSync(screenshotPath) || fs.statSync(screenshotPath).size < 30000) throw new Error(`${name} screenshot missing or too small`);

  const result = {
    ...runtime,
    viewport,
    interactionPoint: { x: centerX, y: centerY, hitTarget },
    screenshot: screenshotName,
    screenshotBytes: fs.statSync(screenshotPath).size,
    canvasBeforeSha256: digest(before.canvas),
    canvasAfterOrbitSha256: digest(afterOrbit.canvas),
    canvasAfterPanSha256: digest(afterPan),
    compassBefore: before.compass,
    compassAfterOrbit: afterOrbit.compass,
    orbitVerified: true,
    panVerified: true,
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
  aggregate.desktop = await audit('desktop', { width: 1365, height: 900, deviceScaleFactor: 1 }, 'KUNMING_V006_DESKTOP.png');
  aggregate.mobile = await audit('mobile', { width: 390, height: 844, deviceScaleFactor: 1, isMobile: false, hasTouch: false }, 'KUNMING_V006_MOBILE.png');
  aggregate.webgl2Active = aggregate.desktop.webgl2Active && aggregate.mobile.webgl2Active;
  aggregate.orientationVerified = aggregate.desktop.orientation === 'east-positive-x_north-negative-z' && aggregate.mobile.orientation === 'east-positive-x_north-negative-z';
  aggregate.orbitVerified = aggregate.desktop.orbitVerified && aggregate.mobile.orbitVerified;
  aggregate.panVerified = aggregate.desktop.panVerified && aggregate.mobile.panVerified;
  aggregate.riverDefaultsVerified = aggregate.desktop.riverWidth === '4' && aggregate.mobile.riverWidth === '4' && aggregate.desktop.hydroDetail === '0' && aggregate.mobile.hydroDetail === '0';
  aggregate.staticWaterVerified = !aggregate.desktop.waveControlPresent && !aggregate.mobile.waveControlPresent && !aggregate.desktop.flowControlPresent && !aggregate.mobile.flowControlPresent;
  if (aggregate.consoleErrors.length || aggregate.pageErrors.length || aggregate.requestFailures.length) {
    throw new Error(`browser errors: ${JSON.stringify({ consoleErrors: aggregate.consoleErrors, pageErrors: aggregate.pageErrors, requestFailures: aggregate.requestFailures })}`);
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
