'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.QA_SKINNED_URL || 'http://127.0.0.1:4173/apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/skinned-qa.html';
const outDir = path.resolve(process.env.QA_SKINNED_OUT || 'apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/evidence/skinned-browser');
const viewport = { width: 1440, height: 900 };
const receiptPath = path.join(outDir, 'SKINNED_BROWSER_QA_RECEIPT.json');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function buildReceipt({ qa, screenshots, consoleErrors, pageErrors, fatalError = null }) {
  const failedChecks = Object.entries(qa?.checks || {}).filter(([, value]) => value !== true).map(([key]) => key);
  const maximum = (key) => qa?.samples?.length ? Math.max(...qa.samples.map(sample => Number(sample[key]))) : null;
  return {
    schema: 'kaopu.fish-mother.yellowfin-source-copy-skinned-browser-qa/1.0',
    date: '2026-09-21',
    build: 'YELLOWFIN-SOURCE-COPY-R001-SKINNED',
    url,
    viewport: { ...viewport, deviceScaleFactor: 1 },
    renderer: 'headless Chromium WebGL / SwiftShader',
    sourceSha256: qa?.sourceSha || null,
    copySha256: qa?.copySha || null,
    sourceStats: qa?.sourceStats || null,
    copyStats: qa?.copyStats || null,
    sourceAnimations: qa?.sourceAnimations || [],
    copyAnimations: qa?.copyAnimations || [],
    animationName: qa?.animationName || null,
    duration: qa?.duration ?? null,
    samples: qa?.samples || [],
    maximumDynamicBoundsDelta: maximum('boundsDelta'),
    maximumBoneMatrixDelta: maximum('boneMatrixDelta'),
    boundsTolerance: qa?.boundsTolerance ?? 0.00005,
    boneTolerance: qa?.boneTolerance ?? 0.000001,
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
    await page.waitForFunction(() => window.__skinnedQa?.ready === true || document.querySelector('#stateDot')?.classList.contains('bad'), null, { timeout: 180_000 });
    const initial = await page.evaluate(() => ({
      ready: window.__skinnedQa?.ready,
      title: document.querySelector('#stateTitle')?.textContent,
      detail: document.querySelector('#stateText')?.textContent,
      qa: JSON.parse(JSON.stringify(window.__skinnedQa || {})),
    }));
    if (!initial.ready) {
      await snap('skinned-qa-failure.png');
      const receipt = buildReceipt({ qa: initial.qa, screenshots, consoleErrors, pageErrors, fatalError: `${initial.title}: ${initial.detail}` });
      fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      throw new Error(receipt.fatalError);
    }

    await page.waitForTimeout(500);
    await snap('skinned-workbench-ui.png');
    await page.evaluate(() => {
      document.querySelector('.panel').style.display = 'none';
      document.querySelector('.badge').style.display = 'none';
    });

    const selectMode = async (mode) => {
      await page.evaluate(expected => {
        const button = document.querySelector(`button[data-mode="${expected}"]`);
        if (!button) throw new Error(`missing mode control: ${expected}`);
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, mode);
      await page.waitForFunction(expected => window.__skinnedQa?.mode === expected, mode);
      await page.waitForTimeout(180);
    };
    const selectView = async (view) => {
      await page.evaluate(expected => {
        const button = document.querySelector(`button[data-view="${expected}"]`);
        if (!button) throw new Error(`missing view control: ${expected}`);
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, view);
      await page.waitForFunction(expected => window.__skinnedQa?.activeView === expected, view);
      await page.waitForTimeout(180);
    };
    const selectTimeRatio = async (ratio) => {
      await page.evaluate(value => {
        const slider = document.querySelector('#timeSlider');
        if (!slider) throw new Error('missing time control');
        slider.value = String(value);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }, ratio);
      await page.waitForFunction(expected => Math.abs((window.__skinnedQa?.activeTime || 0) - expected.time) < 0.002, {
        time: initial.qa.duration * ratio,
      });
      await page.waitForTimeout(180);
    };

    await selectView('side');
    await selectTimeRatio(0);
    await selectMode('source');
    await snap('skinned-source-side-t000.png');
    await selectMode('copy');
    await snap('skinned-copy-side-t000.png');
    await selectMode('overlay');
    await snap('skinned-overlay-side-t000.png');

    const ratios = [0.25, 0.5, 0.75, 0.999];
    for (const ratio of ratios) {
      await selectMode('overlay');
      await selectView('side');
      await selectTimeRatio(ratio);
      await snap(`skinned-overlay-side-t${String(Math.round(ratio * 1000)).padStart(3, '0')}.png`);
    }

    await selectMode('copy');
    await selectTimeRatio(0.5);
    for (const view of ['quarter', 'top', 'front']) {
      await selectView(view);
      await snap(`skinned-copy-${view}-tmid.png`);
    }

    const qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__skinnedQa)));
    const receipt = buildReceipt({ qa, screenshots, consoleErrors, pageErrors });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    if (!receipt.passed) throw new Error(`skinned browser QA failed: ${JSON.stringify({ failedChecks: receipt.failedChecks, consoleErrors, pageErrors })}`);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    if (!fs.existsSync(receiptPath)) {
      try { await snap('skinned-qa-failure.png'); } catch {}
      let qa = {};
      try { qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__skinnedQa || {}))); } catch {}
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
