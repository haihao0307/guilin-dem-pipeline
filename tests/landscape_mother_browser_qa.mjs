import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4175/';
const outputDir = process.argv[3] || 'build/landscape-mother-v001/qa';
fs.mkdirSync(outputDir, { recursive: true });
const results = [];

async function run(name, viewport, quality, isMobile) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const imageRequests = [];

  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('request', request => {
    const url = request.url().toLowerCase();
    if (/\.(png|jpe?g|webp|gif|svg|bmp|tiff?)(\?|$)/.test(url) || url.startsWith('data:image/')) imageRequests.push(request.url());
  });

  await page.goto(`${baseUrl}?quality=${quality}`, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 180_000 });
  await page.waitForTimeout(500);

  const staticState = await page.evaluate(() => ({
    qa: window.__LANDSCAPE_MOTHER_QA__,
    canvasCount: document.querySelectorAll('canvas').length,
    imageElementCount: document.querySelectorAll('img,picture,svg').length,
    modeCount: document.querySelectorAll('[data-mode]').length,
    viewCount: document.querySelectorAll('[data-view]').length,
    stylesheetBackgroundImages: [...document.styleSheets].flatMap(sheet => {
      try { return [...sheet.cssRules].map(rule => rule.style?.backgroundImage || '').filter(Boolean); }
      catch { return []; }
    }),
  }));
  const qa = staticState.qa;
  if (!qa?.passed) throw new Error(`${name}: browser QA failed\n${JSON.stringify(staticState, null, 2)}`);
  if (qa.renderMode !== 'interactive-webgl2-3d' || !qa.webgl2Active) throw new Error(`${name}: WebGL2 3D gate failed`);
  if (staticState.canvasCount !== 1 || staticState.imageElementCount !== 0) throw new Error(`${name}: image-free DOM gate failed`);
  if (staticState.stylesheetBackgroundImages.length) throw new Error(`${name}: CSS background image exists`);
  if (staticState.modeCount !== 7 || staticState.viewCount !== 4) throw new Error(`${name}: interactive controls incomplete`);
  if (qa.truthGrid?.[0] !== 81 || qa.truthSpacingM !== 12.5) throw new Error(`${name}: truth identity mismatch`);
  const expectedGrid = quality === 'desktop' ? 641 : 321;
  const expectedSpacing = quality === 'desktop' ? 1.5625 : 3.125;
  if (qa.renderGrid?.[0] !== expectedGrid || qa.renderSpacingM !== expectedSpacing) throw new Error(`${name}: render grid mismatch`);
  if (qa.terrainVertexCount !== expectedGrid * expectedGrid) throw new Error(`${name}: terrain vertex count mismatch`);
  if (qa.terrainTriangleCount !== (expectedGrid - 1) * (expectedGrid - 1) * 2) throw new Error(`${name}: terrain triangle count mismatch`);
  if (!(qa.sourceNodeMaxErrorM <= 1e-6)) throw new Error(`${name}: source node preservation failed`);
  if (!(qa.sourceCellMeanMaxAbsDeltaM <= 0.24)) throw new Error(`${name}: source cell mean budget failed`);
  if (!(qa.macroBlurMaxAbsDeltaM <= 0.40)) throw new Error(`${name}: macro residual budget failed`);
  if (!(qa.peakShiftM <= 25)) throw new Error(`${name}: peak shift budget failed`);
  if (qa.sourceResampling || qa.truthOverwrite || qa.syntheticGapFill || qa.verticalScale !== 1) throw new Error(`${name}: truth protection failed`);
  if (qa.proceduralMacroMountains !== false) throw new Error(`${name}: procedural macro mountains enabled`);
  if (qa.materialTextureCount || qa.terrainImageTextureCount || qa.imageFileCount || qa.screenshotArtifactCount) throw new Error(`${name}: image or texture count is non-zero`);
  if (qa.plantLayerCount || qa.vegetationInstanceCount) throw new Error(`${name}: plant count is non-zero`);
  if (!(qa.waterSegmentCount > 0)) throw new Error(`${name}: immutable waterway missing`);
  if (qa.visualAcceptance !== false || qa.productionReady !== false) throw new Error(`${name}: approval flags changed`);

  const signatures = {};
  for (const [modeName, mode, view] of [
    ['composite', 0, 'overview'],
    ['truth', 1, 'overview'],
    ['geomorphology', 2, 'rock'],
    ['fields', 3, 'field'],
    ['hydrology', 4, 'top'],
    ['events', 5, 'rock'],
    ['compare', 6, 'overview'],
  ]) {
    signatures[modeName] = await page.evaluate(({ mode, view }) => {
      const api = window.__LANDSCAPE_MOTHER_TEST_API__;
      api.setView(view);
      api.setMode(mode);
      return api.signature();
    }, { mode, view });
    if (!(signatures[modeName].luminanceStdDev > 0.025)) throw new Error(`${name}: ${modeName} luminance structure too weak`);
    if (!(signatures[modeName].edgeEnergy > 0.0025)) throw new Error(`${name}: ${modeName} edge energy too weak`);
  }
  if (signatures.composite.hash === signatures.truth.hash) throw new Error(`${name}: composite and truth pixel signatures are identical`);
  if (signatures.fields.hash === signatures.hydrology.hash) throw new Error(`${name}: field and hydrology signatures are identical`);
  if (signatures.events.hash === signatures.geomorphology.hash) throw new Error(`${name}: event and geomorphology signatures are identical`);

  const beforeInteraction = signatures.composite.hash;
  const afterInteraction = await page.evaluate(() => {
    const api = window.__LANDSCAPE_MOTHER_TEST_API__;
    api.setView('overview');
    api.setMode(0);
    api.orbit(42, -18);
    api.zoom(-120);
    return api.signature();
  });
  if (afterInteraction.hash === beforeInteraction) throw new Error(`${name}: orbit and zoom did not change the 3D frame`);

  const finalQa = await page.evaluate(() => window.__LANDSCAPE_MOTHER_QA__);
  const result = { name, viewport, quality, isMobile, staticState, signatures, afterInteraction, finalQa, consoleErrors, pageErrors, failedRequests, imageRequests };
  if (consoleErrors.length || pageErrors.length || failedRequests.length || imageRequests.length || finalQa.runtimeErrors.length) {
    throw new Error(`${name}: browser diagnostics failed\n${JSON.stringify(result, null, 2)}`);
  }
  results.push(result);
  await browser.close();
}

await run('desktop-1440x1000', { width: 1440, height: 1000 }, 'desktop', false);
await run('mobile-390x844', { width: 390, height: 844 }, 'mobile', true);

const report = {
  schema: 'landscape-mother-browser-evidence/v1',
  generatedAt: new Date().toISOString(),
  passed: true,
  evidenceType: 'numeric-webgl-frame-signatures',
  imageFileCount: 0,
  screenshotArtifactCount: 0,
  materialTextureCount: 0,
  plantLayerCount: 0,
  visualAcceptance: false,
  productionReady: false,
  results,
};
fs.writeFileSync(path.join(outputDir, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
