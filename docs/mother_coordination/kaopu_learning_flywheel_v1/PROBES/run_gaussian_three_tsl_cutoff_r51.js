import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

const mode = process.argv[2] || 'webgl';
if (!['webgl', 'webgpu'].includes(mode)) throw new Error(`invalid mode: ${mode}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 160, height: 64 } });
page.on('console', msg => console.log(`[browser:${mode}] ${msg.type()}: ${msg.text()}`));
page.on('pageerror', error => console.error(`[browser:${mode}] pageerror: ${error.stack || error}`));

const url = ['http:', '', '127.0.0.1:8765', 'docs', 'mother_coordination', 'kaopu_learning_flywheel_v1', 'PROBES', `gaussian_three_tsl_cutoff_r51.html?mode=${mode}`].join('/');
let result;
try {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__KAOPU_DONE__ === true, null, { timeout: 300000 });
  result = await page.evaluate(() => window.__KAOPU_RESULT__);
} catch (error) {
  let progress = null;
  try {
    progress = await page.evaluate(() => window.__KAOPU_PROGRESS__ || null);
  } catch {}
  result = {
    schema: 'kaopu-gaussian-three-tsl-cutoff-runner/r51',
    status: 'timeout-or-runner-error',
    requestedMode: mode,
    progress,
    message: String(error?.message || error),
    stack: String(error?.stack || ''),
  };
} finally {
  await browser.close();
}

const output = `r51-result-${mode}.json`;
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  output,
  status: result.status,
  requestedMode: result.requestedMode,
  actualBackend: result.actualBackend,
  progress: result.progress,
  fixture: result.fixture,
  summary: result.summary,
  checks: result.checks,
}, null, 2));

if (mode === 'webgl') {
  if (result.status !== 'candidate-observation') process.exitCode = 2;
  if (result.actualBackend !== 'webgl') process.exitCode = 3;
  if (result.fixture?.caseCount !== 4644) process.exitCode = 4;
  if (result.fixture?.tslMaterialCount !== 1) process.exitCode = 5;
  if (result.fixture?.renderSubmissionCount !== 36) process.exitCode = 6;
  if (result.fixture?.readbackCount !== 36) process.exitCode = 7;
  const checks = result.checks || {};
  if (!checks.allCasesExecuted ||
      !checks.fullR50UlpRangeCovered ||
      !checks.singleTslMaterialUsed ||
      !checks.renderSubmissionBatchCountIsExpected ||
      !checks.readbackBatchCountIsExpected ||
      !checks.float32ModelMatchesBackendCoverage ||
      !checks.doublePredicateHasCoverageCounterexample ||
      !checks.exactCutoffIsIncluded ||
      !checks.bothSidesOfBoundaryWereSampled) {
    process.exitCode = 8;
  }
}
