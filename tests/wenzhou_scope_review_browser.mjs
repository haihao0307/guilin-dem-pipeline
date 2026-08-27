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
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const results = [];

async function capture(page, name) {
  const file = path.join(evidence, name);
  await page.screenshot({ path: file, fullPage: false });
  return {
    path: path.relative(root, file).replaceAll('\\', '/'),
    bytes: fs.statSync(file).size,
    sha256: sha256(file),
  };
}

async function run(name, viewport, mobile) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error.stack || error.message || error)));
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'failed' }));

  await page.goto(`${url}?qa=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__WENZHOU_SCOPE_READY__?.ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(500);

  const diagnostics = await page.evaluate(() => structuredClone(window.__WENZHOU_SCOPE_READY__));
  const rawFootprintCount = await page.locator('[data-layer="raw-footprint"]').count();
  const svgShapeCount = await page.locator('#mapSvg polygon, #mapSvg circle, #mapSvg ellipse, #mapSvg line').count();
  const files = [];
  files.push(await capture(page, `${name}-raw-coverage.png`));

  await page.locator('#goYuhu').click();
  await page.waitForTimeout(450);
  const yuhuSelection = await page.locator('#selectionInfo').innerText();
  files.push(await capture(page, `${name}-yuhu.png`));

  await page.locator('#goNature').click();
  await page.waitForTimeout(450);
  const natureSelection = await page.locator('#selectionInfo').innerText();
  files.push(await capture(page, `${name}-natural-island.png`));

  await page.locator('#fitSuggested').click();
  await page.waitForTimeout(450);
  const proposedSelection = await page.locator('#selectionInfo').innerText();
  files.push(await capture(page, `${name}-proposed-aoi.png`));

  const panelText = await page.locator('.panel').innerText();
  const distinctScreenshots = new Set(files.map((item) => item.sha256)).size;
  const passed = diagnostics.rawSourceFootprints === 11
    && diagnostics.externalDependencies === 0
    && rawFootprintCount === 11
    && svgShapeCount >= 35
    && panelText.includes('玉壶镇当前没有进入')
    && panelText.includes('自然岛所在区域在当前 COG 内')
    && panelText.includes('26,620 km²')
    && yuhuSelection.includes('当前 COG 范围外')
    && natureSelection.includes('精确营地 POI 待核验')
    && proposedSelection.includes('建议扩展范围')
    && consoleErrors.length === 0
    && pageErrors.length === 0
    && requestFailures.length === 0
    && files.every((item) => item.bytes > 20000)
    && distinctScreenshots === files.length;

  results.push({
    name,
    viewport,
    mobile,
    passed,
    diagnostics,
    rawFootprintCount,
    svgShapeCount,
    yuhuSelection,
    natureSelection,
    proposedSelection,
    distinctScreenshots,
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
  schema: 'wenzhou_scope_review_browser_qa@0.1.2',
  generatedAtUtc: new Date().toISOString(),
  url,
  passed: results.every((item) => item.passed),
  checks: {
    rawSourceFootprints: 11,
    currentAoi: true,
    proposedAoi: true,
    yuhuMarker: true,
    naturalIslandReferenceMarker: true,
    externalDependencies: 0,
    screenshotCount: allFiles.length,
    distinctScreenshotCount: new Set(allFiles.map((item) => item.sha256)).size,
  },
  results,
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed || report.checks.distinctScreenshotCount !== allFiles.length) process.exitCode = 1;
