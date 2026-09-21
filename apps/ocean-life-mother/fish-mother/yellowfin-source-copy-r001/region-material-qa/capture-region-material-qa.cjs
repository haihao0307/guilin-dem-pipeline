'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.QA_REGION_URL || 'http://127.0.0.1:4173/apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/region-material-qa.html';
const outDir = path.resolve(process.env.QA_REGION_OUT || 'apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/evidence/region-material-browser');
const receiptPath = path.join(outDir, 'REGION_MATERIAL_BROWSER_QA_RECEIPT.json');
const viewport = { width: 1440, height: 900 };

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function buildReceipt({ qa, screenshots, consoleErrors, pageErrors, fatalError = null }) {
  const failedChecks = Object.entries(qa?.checks || {}).filter(([, value]) => value !== true).map(([name]) => name);
  return {
    schema: 'kaopu.fish-mother.yellowfin-source-copy-region-material-browser-qa/1.0',
    date: '2026-09-21',
    build: 'YELLOWFIN-SOURCE-COPY-R001-REGION-MATERIAL-ACCEPTANCE',
    url,
    viewport: { ...viewport, deviceScaleFactor: 1 },
    renderer: 'headless Chromium WebGL / SwiftShader',
    copySha256: qa?.copySha || null,
    copyBytes: qa?.copyBytes ?? null,
    duration: qa?.duration ?? null,
    regionInventory: qa?.regionInventory || [],
    materialInventory: qa?.materialInventory || [],
    boundary: qa?.report?.boundary || null,
    targets: qa?.targets || [],
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
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  const screenshots = [];
  const snap = async (name) => {
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage: false });
    screenshots.push({ name, bytes: fs.statSync(file).size, sha256: sha256(file) });
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__regionMaterialQa?.ready === true || document.querySelector('#stateDot')?.classList.contains('bad'), null, { timeout: 180_000 });
    const initial = await page.evaluate(() => ({
      ready: window.__regionMaterialQa?.ready,
      title: document.querySelector('#stateTitle')?.textContent,
      detail: document.querySelector('#stateText')?.textContent,
      qa: JSON.parse(JSON.stringify(window.__regionMaterialQa || {})),
    }));
    if (!initial.ready) {
      await snap('region-material-qa-failure.png');
      const receipt = buildReceipt({ qa: initial.qa, screenshots, consoleErrors, pageErrors, fatalError: `${initial.title}: ${initial.detail}` });
      fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      throw new Error(receipt.fatalError);
    }

    await page.waitForTimeout(500);
    await snap('region-material-workbench-ui.png');
    await page.evaluate(() => {
      document.querySelector('.panel').style.display = 'none';
      document.querySelector('.badge').style.display = 'none';
    });

    const selectView = async (view) => {
      await page.evaluate(expected => {
        const button = document.querySelector(`button[data-view="${expected}"]`);
        if (!button) throw new Error(`missing view control: ${expected}`);
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, view);
      await page.waitForFunction(expected => window.__regionMaterialQa?.activeView === expected, view);
      await page.waitForTimeout(180);
    };
    const selectTarget = async (target) => {
      await page.evaluate(expected => {
        const select = document.querySelector('#targetSelect');
        if (!select) throw new Error('missing target control');
        select.value = expected;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, target);
      await page.waitForFunction(expected => window.__regionMaterialQa?.activeTarget === expected, target);
      await page.waitForTimeout(180);
    };
    const selectTimeRatio = async (ratio) => {
      await page.evaluate(value => {
        const slider = document.querySelector('#timeSlider');
        if (!slider) throw new Error('missing time control');
        slider.value = String(value);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }, ratio);
      await page.waitForFunction(expected => Math.abs((window.__regionMaterialQa?.activeTime || 0) - expected.time) < 0.002, {
        time: initial.qa.duration * ratio,
      });
      await page.waitForTimeout(180);
    };

    await selectTarget('all');
    await selectTimeRatio(0);
    await selectView('side');
    await snap('region-all-side-rest.png');
    await selectTimeRatio(0.5);
    await selectView('quarter');
    await snap('region-all-quarter-mid-swim.png');

    const regions = initial.qa.regionInventory.map(item => item.name);
    for (let index = 0; index < regions.length; index++) {
      const region = regions[index];
      await selectTarget(region);
      await selectTimeRatio(0.5);
      await selectView('side');
      await snap(`region-${String(index + 1).padStart(2, '0')}-${region}-side-mid.png`);
    }

    const quarterRegions = ['pectoral_fin', 'pelvic_fin', 'dorsal_fin', 'anal_fin', 'dorsal_finlets', 'ventral_finlets', 'caudal_upper', 'caudal_lower'];
    for (const region of quarterRegions) {
      await selectTarget(region);
      await selectView('quarter');
      await snap(`region-${region}-quarter-mid.png`);
    }

    await selectTimeRatio(0);
    await selectTarget('source_eye_material');
    await selectView('front');
    await snap('material-eye-front-rest.png');
    await selectTarget('source_cornea_material');
    await selectView('quarter');
    await snap('material-cornea-quarter-rest.png');

    const qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__regionMaterialQa)));
    const receipt = buildReceipt({ qa, screenshots, consoleErrors, pageErrors });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    if (!receipt.passed) throw new Error(`region/material browser QA failed: ${JSON.stringify({ failedChecks: receipt.failedChecks, consoleErrors, pageErrors })}`);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    if (!fs.existsSync(receiptPath)) {
      try { await snap('region-material-qa-failure.png'); } catch {}
      let qa = {};
      try { qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__regionMaterialQa || {}))); } catch {}
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
