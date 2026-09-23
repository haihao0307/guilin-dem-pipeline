import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.PUBLIC_URL || 'https://haihao0307.github.io/guilin-dem-pipeline/coral/blue-coral-a04/';
const out = path.resolve(process.env.QA_OUT || 'dist/coral-blue-a04');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
});

async function verifyViewport(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('requestfailed', request => requestFailures.push({
    url: request.url(),
    error: request.failure()?.errorText || 'unknown',
  }));

  const started = Date.now();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 300_000 });
  assert(response, `${name}: missing document response`);
  assert.equal(response.status(), 200, `${name}: public HTTP status is not 200`);
  await page.waitForFunction(
    () => window.__CORAL_READY__ === true || Boolean(window.__CORAL_STARTUP_ERROR__),
    null,
    { timeout: 360_000 },
  );
  const runtimeError = await page.evaluate(() => window.__CORAL_STARTUP_ERROR__ || null);
  assert.equal(runtimeError, null, `${name}: runtime error: ${runtimeError}`);

  const silhouette = await page.evaluate(() => window.coralA04.runSilhouetteAudit());
  assert.equal(silhouette.passed, true, `${name}: silhouette audit failed`);
  assert(silhouette.views.length === 4, `${name}: four silhouette views were not checked`);
  assert(silhouette.minIoU >= 0.99999, `${name}: silhouette IoU ${silhouette.minIoU}`);

  // The regular workbench renders continuously for OrbitControls. Stop that loop
  // after readiness on the software-GPU runner and render explicitly for evidence.
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
    window.coralA04.render();
  });
  await page.waitForTimeout(300);

  const runtime = await page.evaluate(() => ({
    ready: window.__CORAL_READY__ === true,
    hasRuntimeApi: Boolean(window.coralA04),
    audit: window.coralA04.audit(),
    layout: (() => {
      const canvas = document.querySelector('#coralCanvas')?.getBoundingClientRect();
      const controls = document.querySelector('.controls')?.getBoundingClientRect();
      const leftTag = document.querySelector('.tag.left')?.getBoundingClientRect();
      const rightTag = document.querySelector('.tag.right')?.getBoundingClientRect();
      const divider = document.querySelector('.divider')?.getBoundingClientRect();
      return {
        innerWidth,
        innerHeight,
        bodyWidth: document.body.scrollWidth,
        canvas: canvas && { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
        controls: controls && { x: controls.x, y: controls.y, width: controls.width, height: controls.height },
        leftTag: leftTag && { x: leftTag.x, y: leftTag.y, width: leftTag.width, height: leftTag.height },
        rightTag: rightTag && { x: rightTag.x, y: rightTag.y, width: rightTag.width, height: rightTag.height },
        divider: divider && { x: divider.x, y: divider.y, width: divider.width, height: divider.height },
      };
    })(),
  }));

  assert(runtime.ready, `${name}: ready flag missing`);
  assert(runtime.hasRuntimeApi, `${name}: A04 runtime API missing`);
  assert(runtime.layout.canvas?.width > 300 && runtime.layout.canvas?.height > 300, `${name}: 3D canvas is not visible`);
  const audit = runtime.audit;
  assert.equal(audit.version, 'BLUE_CORAL_CANONICAL_A04', `${name}: wrong version`);
  assert.equal(audit.stage, 'ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION', `${name}: wrong stage`);
  assert.equal(audit.webgl2, true, `${name}: WebGL2 unavailable`);
  assert.equal(audit.allSourceAccessorsDecoded, true, `${name}: not all source accessors decoded`);
  assert.equal(audit.decodedAccessorCount, 36, `${name}: accessor count changed`);
  assert.equal(audit.surfaceCount, 9, `${name}: surface count changed`);
  assert.equal(audit.vertexRecordCount, 582034, `${name}: vertex-record count changed`);
  assert.equal(audit.triangleCount, 1000000, `${name}: triangle count changed`);
  assert.equal(audit.separateTypedArrays, true, `${name}: candidate typed arrays are not independent`);
  assert.equal(audit.separateArrayBuffers, true, `${name}: candidate ArrayBuffers are not independent`);
  assert.equal(audit.separateGpuBuffers, true, `${name}: candidate GPU buffers are not independent`);
  assert.equal(audit.teacherGeometryAliasCount, 0, `${name}: candidate aliases teacher geometry`);
  assert.equal(audit.teacherBufferAliasCount, 0, `${name}: candidate aliases teacher buffers`);
  assert.equal(audit.noTeacherAliasing, true, `${name}: teacher-aliasing gate failed`);
  assert.equal(audit.sameScaleSameCameraCompare, true, `${name}: same-camera comparison gate failed`);
  assert.equal(audit.silhouetteAudit.passed, true, `${name}: runtime silhouette gate missing`);
  assert(audit.silhouetteAudit.minIoU >= 0.99999, `${name}: runtime silhouette IoU changed`);
  assert.equal(audit.sourceCloneUsed, false, `${name}: candidate cloned teacher object`);
  assert.equal(audit.gltfLoaderUsedForCandidate, false, `${name}: candidate used GLTFLoader`);
  for (const key of ['meshSimplification', 'decimation', 'remeshing', 'voxelization', 'marchingCubes']) {
    assert.equal(audit[key], false, `${name}: forbidden method ${key} enabled`);
  }
  assert.equal(audit.structureGrammarUnlocked, false, `${name}: structure grammar unlocked too early`);
  assert.equal(audit.finalGenerator, false, `${name}: A04 incorrectly claims final generator status`);
  assert.equal(audit.productionReady, false, `${name}: A04 incorrectly claims production-ready status`);

  if (viewport.width === 390) {
    assert.equal(runtime.layout.innerWidth, 390, `${name}: mobile inner width changed`);
    assert(runtime.layout.bodyWidth <= 390, `${name}: mobile horizontal overflow`);
    assert(runtime.layout.divider?.width >= 389 && runtime.layout.divider?.height <= 2, `${name}: mobile divider is not horizontal`);
    assert(runtime.layout.rightTag?.y > runtime.layout.leftTag?.y + 150, `${name}: mobile teacher/candidate labels are not stacked`);
  } else {
    assert(runtime.layout.divider?.height > 400 && runtime.layout.divider?.width <= 2, `${name}: desktop divider is not vertical`);
    assert(runtime.layout.rightTag?.x > runtime.layout.leftTag?.x + 300, `${name}: desktop teacher/candidate labels are not side by side`);
  }

  const screenshot = path.join(out, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const screenshotBytes = fs.statSync(screenshot).size;
  assert(screenshotBytes > 50_000, `${name}: screenshot is unexpectedly empty`);
  await context.close();

  return {
    name,
    viewport,
    loadSeconds: (Date.now() - started) / 1000,
    httpStatus: response.status(),
    silhouette,
    runtime,
    screenshot: { file: path.basename(screenshot), bytes: screenshotBytes },
    consoleErrors,
    pageErrors,
    requestFailures,
    passed: consoleErrors.length === 0 && pageErrors.length === 0 && requestFailures.length === 0,
  };
}

try {
  const desktop = await verifyViewport('public-desktop-1440x1000', { width: 1440, height: 1000 });
  const mobile = await verifyViewport('public-mobile-390x844', { width: 390, height: 844 });
  assert(desktop.passed, `desktop browser errors: ${JSON.stringify(desktop)}`);
  assert(mobile.passed, `mobile browser errors: ${JSON.stringify(mobile)}`);
  const receipt = {
    schema: 'kaopu.browser-qa/2.1',
    version: 'BLUE_CORAL_CANONICAL_A04',
    stage: 'ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION',
    url,
    verifiedAt: new Date().toISOString(),
    desktop,
    mobile,
    physicalMobileDeviceTested: false,
    userVisualApproval: false,
    structureGrammarUnlocked: false,
    finalGenerator: false,
    productionReady: false,
    passed: true,
  };
  fs.writeFileSync(path.join(out, 'PUBLIC_BROWSER_QA.json'), JSON.stringify(receipt, null, 2));
  console.log('BLUE_CORAL_A04_PUBLIC_BROWSER_QA_PASS', JSON.stringify(receipt));
} finally {
  await browser.close();
}
