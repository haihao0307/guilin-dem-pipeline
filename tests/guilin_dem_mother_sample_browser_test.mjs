import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const evidenceDir = process.argv[3] || 'build/guilin-mother-sample-v001/evidence';
fs.mkdirSync(evidenceDir, { recursive: true });

const results = [];

async function runViewport(name, viewport, isMobile = false) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 120_000 });
  const qa = await page.evaluate(() => window.__GUILIN_DEM_MOTHER_SAMPLE_QA);
  if (!qa) throw new Error(`${name}: QA object missing`);
  if (!qa.passed) throw new Error(`${name}: QA reports failure\n${JSON.stringify(qa, null, 2)}`);
  if (!qa.source_sha_verified || !qa.parent_tile_sha_verified || !qa.hydrology_sha_verified) {
    throw new Error(`${name}: source identity verification failed`);
  }
  if (qa.sample_grid?.[0] !== 81 || qa.sample_grid?.[1] !== 81) throw new Error(`${name}: sample grid mismatch`);
  if (qa.sample_side_m !== 1000 || qa.sample_area_km2 !== 1) throw new Error(`${name}: sample area mismatch`);
  if (qa.source_resampling !== false || qa.truth_overwrite !== false || qa.synthetic_gap_fill !== false) {
    throw new Error(`${name}: truth protection flags failed`);
  }
  if (qa.vertical_scale !== 1) throw new Error(`${name}: vertical scale mismatch`);
  if (!(qa.osm_segment_count > 0)) throw new Error(`${name}: sample contains no OSM waterway segment`);
  if (qa.visualAcceptance !== false || qa.productionReady !== false) throw new Error(`${name}: approval flags changed`);

  await page.screenshot({ path: path.join(evidenceDir, `${name}-mother-composite.png`), fullPage: true });
  await page.evaluate(() => window.__GUILIN_DEM_MOTHER_SAMPLE_TEST_API.setMode(1));
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(evidenceDir, `${name}-truth-elevation.png`), fullPage: true });
  await page.evaluate(() => {
    window.__GUILIN_DEM_MOTHER_SAMPLE_TEST_API.setMode(3);
    window.__GUILIN_DEM_MOTHER_SAMPLE_TEST_API.setView('top');
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(evidenceDir, `${name}-paddy-field.png`), fullPage: true });

  const finalQa = await page.evaluate(() => window.__GUILIN_DEM_MOTHER_SAMPLE_QA);
  const result = {
    name,
    viewport,
    isMobile,
    qa: finalQa,
    consoleErrors,
    pageErrors,
    failedRequests,
  };
  if (consoleErrors.length || pageErrors.length || failedRequests.length) {
    throw new Error(`${name}: browser diagnostics failed\n${JSON.stringify(result, null, 2)}`);
  }
  results.push(result);
  await browser.close();
}

await runViewport('desktop-1440x1000', { width: 1440, height: 1000 }, false);
await runViewport('mobile-390x844', { width: 390, height: 844 }, true);

const output = {
  schema: 'guilin-dem-mother-sample-browser-evidence/v1',
  generated_at: new Date().toISOString(),
  passed: true,
  visualAcceptance: false,
  productionReady: false,
  results,
};
fs.writeFileSync(path.join(evidenceDir, 'browser-qa.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
