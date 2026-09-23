import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PUBLIC_URL || 'https://haihao0307.github.io/guilin-dem-pipeline/coral/blue-coral-a04/';
const out = path.resolve(process.env.QA_OUT || 'dist/coral-blue-a04');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

async function verifyViewport(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('requestfailed', request => requestFailures.push({
    url: request.url(),
    error: request.failure()?.errorText || 'unknown',
  }));

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  assert(response, `${name}: missing document response`);
  assert.equal(response.status(), 200, `${name}: public HTTP status is not 200`);
  await page.waitForFunction(() => window.__CORAL_READY__ === true || Boolean(window.__CORAL_ERROR__), null, { timeout: 360_000 });
  const runtimeError = await page.evaluate(() => window.__CORAL_ERROR__ || null);
  assert.equal(runtimeError, null, `${name}: runtime error: ${runtimeError}`);
  await page.waitForFunction(() => window.__RENDER_COUNT__ >= 2, null, { timeout: 60_000 });

  const capabilities = await page.evaluate(() => ({
    webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
    ready: window.__CORAL_READY__ === true,
    renderCount: window.__RENDER_COUNT__ || 0,
    hasRuntimeApi: Boolean(window.coralA04),
    canvas: (() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { width: rect.width, height: rect.height } : null;
    })(),
  }));
  assert(capabilities.webgl2, `${name}: WebGL2 is unavailable`);
  assert(capabilities.ready, `${name}: ready flag missing`);
  assert(capabilities.hasRuntimeApi, `${name}: A04 runtime API missing`);
  assert(capabilities.canvas && capabilities.canvas.width > 300 && capabilities.canvas.height > 300, `${name}: 3D canvas is not visible`);

  const audit = await page.evaluate(() => window.coralA04.verify());
  assert.equal(audit.mismatchBytes, 0, `${name}: teacher-field byte mismatch`);
  assert.equal(audit.accessorMismatch, 0, `${name}: accessor mismatch`);
  assert.equal(audit.maxPosition, 0, `${name}: position mismatch`);
  assert.equal(audit.maxNormal, 0, `${name}: normal mismatch`);
  assert.equal(audit.maxUv, 0, `${name}: UV mismatch`);
  assert.equal(audit.indexMismatch, 0, `${name}: index mismatch`);
  assert.equal(audit.separateTypedArrays, true, `${name}: teacher and candidate share typed arrays`);
  assert.equal(audit.separateGpuBuffers, true, `${name}: teacher and candidate share GPU buffers`);
  assert.equal(audit.noSourceObjectClone, true, `${name}: source object clone gate failed`);
  assert.equal(audit.gltfLoaderUsedForCandidate, false, `${name}: candidate used GLTFLoader`);
  assert.equal(audit.highDimensionalFieldExpression, true, `${name}: high-dimensional field contract missing`);
  assert.equal(audit.finalGenerator, false, `${name}: A04 incorrectly claims final generator status`);
  assert(Array.isArray(audit.silhouettes) && audit.silhouettes.length === 4, `${name}: silhouette suite incomplete`);
  assert(audit.silhouettes.every(item => item.union > 0 && item.iou >= 0.99999), `${name}: silhouette mismatch`);

  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  await context.close();
  return {
    name,
    viewport,
    httpStatus: response.status(),
    capabilities,
    audit,
    consoleErrors,
    pageErrors,
    requestFailures,
    passed: consoleErrors.length === 0 && pageErrors.length === 0 && requestFailures.length === 0,
  };
}

try {
  const desktop = await verifyViewport('public-desktop-1440x1000', { width: 1440, height: 1000 });
  const mobile = await verifyViewport('public-mobile-390x844', { width: 390, height: 844 });
  assert(desktop.passed, `desktop browser errors: ${JSON.stringify(desktop)}`);
  assert(mobile.passed, `mobile browser errors: ${JSON.stringify(mobile)}`);
  const receipt = {
    schema: 'kaopu.browser-qa/1.0',
    version: 'BLUE_CORAL_A04_HIGH_DIMENSIONAL_FUNCTION_EXPRESSION',
    url,
    verifiedAt: new Date().toISOString(),
    desktop,
    mobile,
    physicalMobileDeviceTested: false,
    userVisualApproval: false,
    productionReady: false,
    passed: true,
  };
  fs.writeFileSync(path.join(out, 'PUBLIC_BROWSER_QA.json'), JSON.stringify(receipt, null, 2));
  console.log('BLUE_CORAL_A04_PUBLIC_BROWSER_QA_PASS', JSON.stringify(receipt));
} finally {
  await browser.close();
}
