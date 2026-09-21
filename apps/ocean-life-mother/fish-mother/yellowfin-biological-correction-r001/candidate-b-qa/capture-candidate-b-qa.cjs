'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.QA_CANDIDATE_URL || 'http://127.0.0.1:4173/apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/candidate-b-qa.html';
const outDir = path.resolve(process.env.QA_CANDIDATE_OUT || 'apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/evidence/candidate-b-browser');
const viewport = { width: 1440, height: 900 };
const receiptPath = path.join(outDir, 'CANDIDATE_B_BROWSER_QA_RECEIPT.json');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function maximum(samples, selector) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  return Math.max(...samples.flatMap(selector).map(Number));
}

function minimum(samples, selector) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  return Math.min(...samples.flatMap(selector).map(Number));
}

function buildReceipt({ qa, screenshots, consoleErrors, pageErrors, fatalError = null }) {
  const failedChecks = Object.entries(qa?.checks || {}).filter(([, value]) => value !== true).map(([key]) => key);
  return {
    schema: 'kaopu.fish-mother.yellowfin-biological-correction-candidate-b-browser-qa/1.0',
    date: '2026-09-21',
    build: 'YELLOWFIN-BIOLOGICAL-CORRECTION-R001-CANDIDATE-B-BROWSER-QA',
    url,
    viewport: { ...viewport, deviceScaleFactor: 1 },
    renderer: 'headless Chromium WebGL / SwiftShader',
    frozenSha256: qa?.frozenSha || null,
    candidateSha256: qa?.candidateSha || null,
    frozenStats: qa?.frozenStats || null,
    candidateStats: qa?.candidateStats || null,
    frozenAnimations: qa?.frozenAnimations || [],
    candidateBnimations: qa?.candidateBnimations || [],
    animationName: qa?.animationName || null,
    duration: qa?.duration ?? null,
    samples: qa?.samples || [],
    minimumSampledSpanRatio: minimum(qa?.samples, sample => sample.spanRatios || []),
    maximumSampledSpanRatio: maximum(qa?.samples, sample => sample.spanRatios || []),
    maximumSampledCenterDelta: maximum(qa?.samples, sample => [sample.centerDelta]),
    maximumCandidateBoneMagnitude: maximum(qa?.samples, sample => [sample.candidateBones?.maximum]),
    thresholds: qa?.thresholds || {},
    focusAvailable: qa?.focusAvailable || {},
    checks: qa?.checks || {},
    failedChecks,
    screenshots,
    consoleErrors,
    pageErrors,
    fatalError,
    manualVisualAcceptancePending: true,
    productionReady: false,
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
    await page.waitForFunction(() => window.__candidateQa?.ready === true || document.querySelector('#stateDot')?.classList.contains('bad'), null, { timeout: 210_000 });
    const initial = await page.evaluate(() => ({
      ready: window.__candidateQa?.ready,
      title: document.querySelector('#stateTitle')?.textContent,
      detail: document.querySelector('#stateText')?.textContent,
      qa: JSON.parse(JSON.stringify(window.__candidateQa || {})),
    }));
    if (!initial.ready) {
      await snap('candidate-b-qa-failure.png');
      const receipt = buildReceipt({ qa: initial.qa, screenshots, consoleErrors, pageErrors, fatalError: `${initial.title}: ${initial.detail}` });
      fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      throw new Error(receipt.fatalError);
    }

    await page.waitForTimeout(600);
    await snap('candidate-b-workbench-ui.png');
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
      await page.waitForFunction(expected => window.__candidateQa?.mode === expected, mode);
      await page.waitForTimeout(220);
    };
    const selectView = async (view) => {
      await page.evaluate(expected => {
        const button = document.querySelector(`button[data-view="${expected}"]`);
        if (!button) throw new Error(`missing view control: ${expected}`);
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, view);
      await page.waitForFunction(expected => window.__candidateQa?.activeView === expected, view);
      await page.waitForTimeout(220);
    };
    const selectTimeRatio = async (ratio) => {
      await page.evaluate(value => {
        const slider = document.querySelector('#timeSlider');
        if (!slider) throw new Error('missing time control');
        slider.value = String(value);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }, ratio);
      await page.waitForFunction(expected => Math.abs((window.__candidateQa?.activeTime || 0) - expected.time) < 0.002, {
        time: initial.qa.duration * ratio,
      });
      await page.waitForTimeout(220);
    };

    await selectTimeRatio(0);
    await selectView('side');
    await selectMode('frozen');
    await snap('candidate-b-frozen-side-rest.png');
    await selectMode('candidate');
    await snap('candidate-b-corrected-side-rest.png');
    await selectMode('overlay');
    await snap('candidate-b-overlay-side-rest.png');

    await selectMode('candidate');
    for (const view of ['quarter', 'top', 'front', 'dorsal', 'pectoral']) {
      await selectView(view);
      await snap(`candidate-b-corrected-${view}-rest.png`);
    }

    await selectMode('overlay');
    await selectView('dorsal');
    await snap('candidate-b-overlay-dorsal-rest.png');
    await selectView('pectoral');
    await snap('candidate-b-overlay-pectoral-rest.png');

    for (const ratio of [0.25, 0.5, 0.75, 0.999]) {
      await selectMode('overlay');
      await selectView('side');
      await selectTimeRatio(ratio);
      await snap(`candidate-b-overlay-side-t${String(Math.round(ratio * 1000)).padStart(3, '0')}.png`);
    }

    await selectMode('candidate');
    await selectTimeRatio(0.5);
    await selectView('quarter');
    await snap('candidate-b-corrected-quarter-tmid.png');
    await selectView('top');
    await snap('candidate-b-corrected-top-tmid.png');

    const qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__candidateQa)));
    const receipt = buildReceipt({ qa, screenshots, consoleErrors, pageErrors });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    if (!receipt.passed) {
      throw new Error(`Candidate B browser QA failed: ${JSON.stringify({ failedChecks: receipt.failedChecks, consoleErrors, pageErrors })}`);
    }
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    if (!fs.existsSync(receiptPath)) {
      try { await snap('candidate-b-qa-failure.png'); } catch {}
      let qa = {};
      try { qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__candidateQa || {}))); } catch {}
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
