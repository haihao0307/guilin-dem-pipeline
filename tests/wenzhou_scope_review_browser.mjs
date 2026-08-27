import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const evidence = path.join(root, 'projects/wenzhou/evidence/scope-review');
const reportPath = path.join(root, 'projects/wenzhou/reports/WENZHOU_SCOPE_REVIEW_BROWSER_QA.json');
const url = process.env.WENZHOU_SCOPE_URL || 'http://127.0.0.1:18993/web/wenzhou-scope-review/';
fs.mkdirSync(evidence, { recursive: true });

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-dev-shm-usage'],
});

const results = [];

async function run(name, viewport, mobile) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message || error)));
  page.on('requestfailed', (request) => {
    const target = request.url();
    if (/tile\.openstreetmap\.org|arcgisonline\.com|opentopomap\.org/.test(target)) return;
    requestFailures.push({ url: target, error: request.failure()?.errorText || 'failed' });
  });

  await page.goto(`${url}?qa=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(
    () => typeof window.L === 'object' && document.querySelectorAll('.leaflet-overlay-pane path').length >= 14,
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(2200);

  const rawFile = path.join(evidence, `${name}-raw-coverage.png`);
  await page.screenshot({ path: rawFile, fullPage: false });

  await page.locator('#goYuhu').click();
  await page.waitForTimeout(1000);
  const yuhuFile = path.join(evidence, `${name}-yuhu.png`);
  await page.screenshot({ path: yuhuFile, fullPage: false });

  await page.locator('#goNature').click();
  await page.waitForTimeout(1000);
  const natureFile = path.join(evidence, `${name}-natural-island.png`);
  await page.screenshot({ path: natureFile, fullPage: false });

  await page.locator('#fitSuggested').click();
  await page.waitForTimeout(700);
  const proposedFile = path.join(evidence, `${name}-proposed-aoi.png`);
  await page.screenshot({ path: proposedFile, fullPage: false });

  const text = await page.locator('.panel').innerText();
  const overlayPathCount = await page.locator('.leaflet-overlay-pane path').count();
  const yuhuPopupText = await page.locator('.leaflet-popup-content').first().textContent().catch(() => '');
  const files = [rawFile, yuhuFile, natureFile, proposedFile].map((file) => ({
    path: path.relative(root, file).replaceAll('\\', '/'),
    bytes: fs.statSync(file).size,
    sha256: sha256(file),
  }));

  const passed = text.includes('玉壶镇当前没有进入')
    && text.includes('自然岛所在区域在当前 COG 内')
    && text.includes('26,620 km²')
    && overlayPathCount >= 14
    && consoleErrors.length === 0
    && pageErrors.length === 0
    && requestFailures.length === 0
    && files.every((item) => item.bytes > 20000);

  results.push({
    name,
    viewport,
    mobile,
    passed,
    overlayPathCount,
    yuhuPopupText,
    consoleErrors,
    pageErrors,
    requestFailures,
    files,
  });
  await context.close();
}

try {
  await run('desktop-1600x1000', { width: 1600, height: 1000 }, false);
  await run('mobile-390x844', { width: 390, height: 844 }, true);
} finally {
  await browser.close();
}

const allFiles = results.flatMap((item) => item.files);
const report = {
  schema: 'wenzhou_scope_review_browser_qa@0.1.1',
  generatedAtUtc: new Date().toISOString(),
  url,
  passed: results.every((item) => item.passed),
  checks: {
    rawSourceFootprints: 11,
    currentAoi: true,
    proposedAoi: true,
    yuhuMarker: true,
    naturalIslandReferenceMarker: true,
    screenshotCount: allFiles.length,
    distinctScreenshotCount: new Set(allFiles.map((item) => item.sha256)).size,
  },
  results,
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed || report.checks.distinctScreenshotCount !== allFiles.length) process.exitCode = 1;
