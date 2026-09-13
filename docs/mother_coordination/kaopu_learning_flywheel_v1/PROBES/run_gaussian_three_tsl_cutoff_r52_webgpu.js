import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=vulkan',
    '--use-vulkan=swiftshader',
    '--use-webgpu-adapter=swiftshader',
    '--disable-vulkan-surface',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

const page = await browser.newPage({ viewport: { width: 160, height: 64 } });
let browserPageError = null;
let rejectPageError;
const pageErrorPromise = new Promise((_, reject) => { rejectPageError = reject; });
page.on('console', msg => console.log(`[browser:r52-webgpu] ${msg.type()}: ${msg.text()}`));
page.on('pageerror', error => {
  browserPageError ||= error;
  console.error(`[browser:r52-webgpu] pageerror: ${error.stack || error}`);
  rejectPageError(error);
});

const url = ['http:', '', '127.0.0.1:8765', 'docs', 'mother_coordination', 'kaopu_learning_flywheel_v1', 'PROBES', 'gaussian_three_tsl_cutoff_r51.html?mode=webgpu'].join('/');
let result;
try {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  if (browserPageError) throw browserPageError;
  await Promise.race([
    page.waitForFunction(() => window.__KAOPU_DONE__ === true, null, { timeout: 300000 }),
    pageErrorPromise,
  ]);
  result = await page.evaluate(() => window.__KAOPU_RESULT__);
} catch (error) {
  let progress = null;
  try {
    progress = await page.evaluate(() => window.__KAOPU_PROGRESS__ || null);
  } catch {}
  result = {
    schema: 'kaopu-gaussian-three-tsl-cutoff-runner/r52',
    status: 'timeout-or-runner-error',
    requestedMode: 'webgpu',
    progress,
    message: String(error?.message || error),
    stack: String(error?.stack || ''),
  };
} finally {
  await browser.close();
}

const output = 'r52-result-webgpu.json';
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  output,
  status: result.status,
  requestedMode: result.requestedMode,
  actualBackend: result.actualBackend,
  identity: result.identity,
  progress: result.progress,
  fixture: result.fixture,
  summary: result.summary,
  checks: result.checks,
  reason: result.reason,
  message: result.message,
}, null, 2));

if (result.status !== 'candidate-observation') process.exitCode = 2;
if (result.actualBackend !== 'webgpu') process.exitCode = 3;
if (result.fixture?.caseCount !== 4644) process.exitCode = 4;
if (result.fixture?.renderSubmissionCount !== 36) process.exitCode = 5;
if (result.fixture?.readbackCount !== 36) process.exitCode = 6;
if (!result.checks?.allCasesExecuted || !result.checks?.fullR50UlpRangeCovered) process.exitCode = 7;
