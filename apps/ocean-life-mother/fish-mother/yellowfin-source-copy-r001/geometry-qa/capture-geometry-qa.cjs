'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.QA_GEOMETRY_URL || 'http://127.0.0.1:4173/apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/geometry-qa.html';
const outDir = path.resolve(process.env.QA_GEOMETRY_OUT || 'apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/evidence/geometry-browser');
const viewport = { width: 1440, height: 900 };
const receiptPath = path.join(outDir, 'GEOMETRY_BROWSER_QA_RECEIPT.json');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function buildReceipt({ qa, screenshots, consoleErrors, pageErrors, fatalError = null }) {
  const failedChecks = Object.entries(qa?.checks || {}).filter(([, value]) => value !== true).map(([key]) => key);
  return {
    schema: 'kaopu.fish-mother.yellowfin-source-copy-geometry-browser-qa/1.0',
    date: '2026-09-21',
    build: 'YELLOWFIN-SOURCE-COPY-R001',
    url,
    viewport: { ...viewport, deviceScaleFactor: 1 },
    renderer: 'headless Chromium WebGL / SwiftShader',
    sourceSha256: qa?.sourceSha || null,
    copySha256: qa?.copySha || null,
    sourceStats: qa?.sourceStats || null,
    copyStats: qa?.copyStats || null,
    exactPackageBounds: qa?.receiptBounds || null,
    sourceBrowserBounds: qa?.sourceBrowserBounds || null,
    copyBrowserBounds: qa?.copyBrowserBounds || null,
    copyVsExactPackageBoundsDelta: qa?.copyVsReceiptBoundsDelta ?? null,
    sourceVsCopyBrowserBoundsDelta: qa?.sourceCopyBrowserBoundsDelta ?? null,
    boundsTolerance: qa?.boundsTolerance ?? 0.00005,
    browserBoundsPolicy: qa?.browserBoundsPolicy || null,
    regionCount: qa?.receipt?.regions?.length ?? null,
    copiedPrimitiveInstances: qa?.receipt?.source?.copiedPrimitiveInstances ?? null,
    checks: qa?.checks || {},
    failedChecks,
    screenshots,
    consoleErrors,
    pageErrors,
    fatalError,
    passed: qa?.ready === true && failedChecks.length === 0 && consoleErrors.length === 0 && pageErrors.length === 0 && !fatalError,
  };
}

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));

  const screenshots = [];
  const snap = async (name) => {
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage: false });
    screenshots.push({ name, bytes: fs.statSync(file).size, sha256: sha256(file) });
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__geometryQa?.ready === true || document.querySelector('#stateDot')?.classList.contains('bad'), null, { timeout: 180_000 });
    const initialState = await page.evaluate(() => ({
      ready: window.__geometryQa?.ready,
      title: document.querySelector('#stateTitle')?.textContent,
      detail: document.querySelector('#stateText')?.textContent,
      qa: JSON.parse(JSON.stringify(window.__geometryQa || {})),
    }));
    if (!initialState.ready) {
      await snap('geometry-qa-failure.png');
      const failureReceipt = buildReceipt({
        qa: initialState.qa,
        screenshots,
        consoleErrors,
        pageErrors,
        fatalError: `${initialState.title}: ${initialState.detail}`,
      });
      fs.writeFileSync(receiptPath, `${JSON.stringify(failureReceipt, null, 2)}\n`);
      throw new Error(failureReceipt.fatalError);
    }

    await page.waitForTimeout(500);
    await snap('geometry-workbench-ui.png');
    await page.evaluate(() => {
      document.querySelector('.panel').style.display = 'none';
      document.querySelector('.badge').style.display = 'none';
    });

    const selectView = async (view) => {
      await page.locator(`button[data-view="${view}"]`).click();
      await page.waitForFunction(expected => window.__geometryQa?.activeView === expected, view);
      await page.waitForTimeout(220);
    };
    const selectMode = async (mode) => {
      await page.locator(`button[data-mode="${mode}"]`).click();
      await page.waitForFunction(expected => window.__geometryQa?.mode === expected, mode);
      await page.waitForTimeout(220);
    };
    const selectRegion = async (region) => {
      await page.locator('#regionSelect').selectOption(region);
      await page.waitForFunction(expected => window.__geometryQa?.activeRegion === expected, region);
      await page.waitForTimeout(220);
    };

    await selectRegion('all');
    await selectView('side');
    await selectMode('source');
    await snap('geometry-source-side.png');
    await selectMode('copy');
    await snap('geometry-copy-side.png');
    await selectMode('overlay');
    await snap('geometry-overlay-side.png');

    await selectMode('copy');
    await selectView('quarter');
    await snap('geometry-copy-quarter.png');
    await selectView('top');
    await snap('geometry-copy-top.png');
    await selectView('front');
    await snap('geometry-copy-head-on.png');

    await selectView('side');
    await selectRegion('dorsal_finlets');
    await snap('geometry-copy-dorsal-finlets.png');
    await selectRegion('ventral_finlets');
    await snap('geometry-copy-ventral-finlets.png');
    await selectRegion('all');

    const qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__geometryQa)));
    const receipt = buildReceipt({ qa, screenshots, consoleErrors, pageErrors });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    if (!receipt.passed) throw new Error(`geometry browser QA failed: ${JSON.stringify({ failedChecks: receipt.failedChecks, consoleErrors, pageErrors })}`);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    if (!fs.existsSync(receiptPath)) {
      try { await snap('geometry-qa-failure.png'); } catch {}
      let qa = {};
      try { qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__geometryQa || {}))); } catch {}
      const receipt = buildReceipt({ qa, screenshots, consoleErrors, pageErrors, fatalError: error?.message || String(error) });
      fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    }
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
