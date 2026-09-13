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

async function runMode(mode) {
  const page = await browser.newPage({ viewport: { width: 160, height: 64 } });
  let pageError = null;
  let rejectPageError;
  const pageErrorPromise = new Promise((_, reject) => { rejectPageError = reject; });
  page.on('console', msg => console.log(`[browser:r53:${mode}] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', error => {
    pageError ||= error;
    console.error(`[browser:r53:${mode}] pageerror: ${error.stack || error}`);
    rejectPageError(error);
  });
  const url = `http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_cross_backend_mask_r53.html?mode=${mode}`;
  let result;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    if (pageError) throw pageError;
    await Promise.race([
      page.waitForFunction(() => window.__KAOPU_DONE__ === true, null, { timeout: 300000 }),
      pageErrorPromise,
    ]);
    result = await page.evaluate(() => window.__KAOPU_RESULT__);
  } catch (error) {
    let progress = null;
    try { progress = await page.evaluate(() => window.__KAOPU_PROGRESS__ || null); } catch {}
    result = {
      schema: 'kaopu-gaussian-cross-backend-mask-runner/r53',
      status: 'timeout-or-runner-error', requestedMode: mode, progress,
      message: String(error?.message || error), stack: String(error?.stack || ''),
    };
  } finally {
    await page.close();
  }
  fs.writeFileSync(`r53-result-${mode}.json`, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function firstBitDifference(a = '', b = '') {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return -1;
}

const webgl = await runMode('webgl');
const webgpu = await runMode('webgpu');
await browser.close();

const comparison = {
  schema: 'kaopu-gaussian-cross-backend-mask-comparison/r53',
  status: 'candidate-observation',
  inputs: {
    webglStatus: webgl.status,
    webgpuStatus: webgpu.status,
    webglActualBackend: webgl.actualBackend,
    webgpuActualBackend: webgpu.actualBackend,
    webglThreeRevision: webgl.threeRevision,
    webgpuThreeRevision: webgpu.threeRevision,
    webglIdentity: webgl.identity,
    webgpuIdentity: webgpu.identity,
  },
  summary: {
    webglAggregateBackendMaskSha256: webgl.summary?.aggregateBackendMaskSha256 || null,
    webgpuAggregateBackendMaskSha256: webgpu.summary?.aggregateBackendMaskSha256 || null,
    webglAggregateFloat32MaskSha256: webgl.summary?.aggregateFloat32MaskSha256 || null,
    webgpuAggregateFloat32MaskSha256: webgpu.summary?.aggregateFloat32MaskSha256 || null,
    webglAggregateInputSha256: webgl.summary?.aggregateInputSha256 || null,
    webgpuAggregateInputSha256: webgpu.summary?.aggregateInputSha256 || null,
    webglFloat32MismatchCount: webgl.summary?.float32PredicateMismatchCount ?? null,
    webgpuFloat32MismatchCount: webgpu.summary?.float32PredicateMismatchCount ?? null,
    webglDoubleMismatchCount: webgl.summary?.doublePredicateMismatchCount ?? null,
    webgpuDoubleMismatchCount: webgpu.summary?.doublePredicateMismatchCount ?? null,
  },
  groupComparisons: [],
  firstDivergence: null,
};

const wg = Array.isArray(webgl.groups) ? webgl.groups : [];
const wp = Array.isArray(webgpu.groups) ? webgpu.groups : [];
const groupCount = Math.max(wg.length, wp.length);
let exactInputIdentity = wg.length === 36 && wp.length === 36;
let exactBackendCoverageMaskIdentity = exactInputIdentity;
let bothBackendsMatchFloat32Masks = exactInputIdentity;

for (let i = 0; i < groupCount; i++) {
  const a = wg[i];
  const b = wp[i];
  const inputSame = !!a && !!b && a.inputSha256 === b.inputSha256;
  const backendMaskSame = !!a && !!b && a.backendCoverageMask === b.backendCoverageMask;
  const webglMatchesFloat = !!a && a.backendCoverageMask === a.float32CoverageMask;
  const webgpuMatchesFloat = !!b && b.backendCoverageMask === b.float32CoverageMask;
  exactInputIdentity &&= inputSame;
  exactBackendCoverageMaskIdentity &&= backendMaskSame;
  bothBackendsMatchFloat32Masks &&= webglMatchesFloat && webgpuMatchesFloat;
  const diffIndex = a && b ? firstBitDifference(a.backendCoverageMask, b.backendCoverageMask) : -1;
  const item = {
    groupIndex: i,
    scaleIndex: a?.scaleIndex ?? b?.scaleIndex ?? null,
    direction: a?.direction ?? b?.direction ?? null,
    inputSame,
    backendMaskSame,
    webglMatchesFloat,
    webgpuMatchesFloat,
    firstDifferingUlpIndex: diffIndex,
    firstDifferingUlpStep: diffIndex >= 0 ? diffIndex - 64 : null,
  };
  comparison.groupComparisons.push(item);
  if (!comparison.firstDivergence && (!inputSame || !backendMaskSame || !webglMatchesFloat || !webgpuMatchesFloat)) {
    comparison.firstDivergence = item;
  }
}

comparison.checks = {
  webglCandidateObservation: webgl.status === 'candidate-observation',
  webgpuCandidateObservation: webgpu.status === 'candidate-observation',
  actualBackendsAreDistinctAndCorrect: webgl.actualBackend === 'webgl' && webgpu.actualBackend === 'webgpu',
  sameThreeRevision: String(webgl.threeRevision) === '186' && String(webgpu.threeRevision) === '186',
  fullCaseCounts: webgl.fixture?.caseCount === 4644 && webgpu.fixture?.caseCount === 4644,
  fullGroupCounts: webgl.fixture?.groupCount === 36 && webgpu.fixture?.groupCount === 36,
  exactInputIdentity,
  exactBackendCoverageMaskIdentity,
  bothBackendsMatchFloat32Masks,
  aggregateBackendMaskHashIdentity: webgl.summary?.aggregateBackendMaskSha256 === webgpu.summary?.aggregateBackendMaskSha256,
  aggregateInputHashIdentity: webgl.summary?.aggregateInputSha256 === webgpu.summary?.aggregateInputSha256,
  expectedDoubleCounterexampleCounts: webgl.summary?.doublePredicateMismatchCount === 32 && webgpu.summary?.doublePredicateMismatchCount === 32,
};

const requiredChecks = Object.values(comparison.checks).every(Boolean);
comparison.status = requiredChecks ? 'Candidate-pass' : 'Candidate-fail';
comparison.interpretation = requiredChecks
  ? 'Under one Chromium 143 / Three.js r186 toolchain, direct WebGL and confirmed WebGPU produced identical per-case coverage masks for all 4,644 locked cutoff-neighbor samples; both matched the stepwise float32 model exactly.'
  : 'Cross-backend exactness failed or evidence was incomplete. Inspect firstDivergence and backend identities; do not reduce this to summary-count agreement.';

fs.writeFileSync('r53-comparison.json', `${JSON.stringify(comparison, null, 2)}\n`);
console.log(JSON.stringify({ status: comparison.status, summary: comparison.summary, checks: comparison.checks, firstDivergence: comparison.firstDivergence }, null, 2));
if (!requiredChecks) process.exitCode = 10;
