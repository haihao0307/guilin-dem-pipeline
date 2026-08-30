import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4176/';
const outputDir = process.argv[3] || 'build/landscape-mother-v002/qa';
fs.mkdirSync(outputDir, { recursive: true });
const results = [];
const modeThresholds = Object.freeze({
  composite: { luminanceStdDev: 0.020, edgeEnergy: 0.0015 },
  truth: { luminanceStdDev: 0.020, edgeEnergy: 0.0015 },
  geomorphology: { luminanceStdDev: 0.018, edgeEnergy: 0.0013 },
  fields: { luminanceStdDev: 0.015, edgeEnergy: 0.0008 },
  hydrology: { luminanceStdDev: 0.015, edgeEnergy: 0.0009 },
  events: { luminanceStdDev: 0.015, edgeEnergy: 0.0011 },
  compare: { luminanceStdDev: 0.020, edgeEnergy: 0.0012 },
});

function writePartial(name, payload) {
  fs.writeFileSync(
    path.join(outputDir, `${name}-partial.json`),
    `${JSON.stringify({
      schema: 'landscape-mother-v2-browser-partial-diagnostics/v1',
      generatedAt: new Date().toISOString(),
      name,
      imageFileCount: 0,
      screenshotArtifactCount: 0,
      materialTextureCount: 0,
      ...payload,
    }, null, 2)}\n`,
  );
}

async function run(name, viewport, quality, isMobile) {
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
  const imageRequests = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });
  page.on('request', request => {
    const url = request.url().toLowerCase();
    if (/\.(png|jpe?g|webp|gif|svg|bmp|tiff?|ktx2?|dds|exr|hdr)(\?|$)/.test(url) || url.startsWith('data:image/')) {
      imageRequests.push(request.url());
    }
  });

  await page.goto(`${baseUrl}?quality=${quality}&tier=evidence`, {
    waitUntil: 'networkidle',
    timeout: 180_000,
  });
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, {
    timeout: 180_000,
  });
  await page.waitForTimeout(500);

  const staticState = await page.evaluate(() => ({
    qa: window.__LANDSCAPE_MOTHER_QA__,
    canvasCount: document.querySelectorAll('canvas').length,
    imageElementCount: document.querySelectorAll('img,picture,svg').length,
    modeCount: document.querySelectorAll('[data-mode]').length,
    viewCount: document.querySelectorAll('[data-view]').length,
    tierCount: document.querySelectorAll('[data-tier]').length,
    stylesheetBackgroundImages: [...document.styleSheets].flatMap(sheet => {
      try {
        return [...sheet.cssRules]
          .map(rule => rule.style?.backgroundImage || '')
          .filter(value => /url\(|image-set\(|data:image\//i.test(value));
      } catch {
        return [];
      }
    }),
  }));
  writePartial(name, { stage: 'static-contract', viewport, quality, isMobile, staticState });
  const qa = staticState.qa;

  if (!qa?.passed) throw new Error(`${name}: browser QA failed\n${JSON.stringify(staticState, null, 2)}`);
  if (qa.runtimeVersion !== '2.0.0' || qa.fieldGraphVersion !== '1.0.0') throw new Error(`${name}: V2 runtime identity failed`);
  if (qa.renderMode !== 'interactive-webgl2-3d' || !qa.webgl2Active) throw new Error(`${name}: WebGL2 3D gate failed`);
  if (staticState.canvasCount !== 1 || staticState.imageElementCount !== 0) throw new Error(`${name}: image-free DOM gate failed`);
  if (staticState.stylesheetBackgroundImages.length) throw new Error(`${name}: CSS image resource exists`);
  if (staticState.modeCount !== 7 || staticState.viewCount !== 4 || staticState.tierCount !== 3) throw new Error(`${name}: interactive controls incomplete`);
  if (qa.truthGrid?.[0] !== 81 || qa.truthSpacingM !== 12.5) throw new Error(`${name}: truth identity mismatch`);

  const expectedGrid = quality === 'desktop' ? 641 : 321;
  const expectedSpacing = quality === 'desktop' ? 1.5625 : 3.125;
  const expectedTriangles = (expectedGrid - 1) * (expectedGrid - 1) * 2;
  if (qa.renderGrid?.[0] !== expectedGrid || qa.renderSpacingM !== expectedSpacing) throw new Error(`${name}: render grid mismatch`);
  if (qa.terrainVertexCount !== expectedGrid * expectedGrid) throw new Error(`${name}: terrain vertex count mismatch`);
  if (qa.terrainTriangleCount !== expectedTriangles || qa.evidenceTriangleCount !== expectedTriangles) throw new Error(`${name}: evidence triangle count mismatch`);
  if (qa.activeTriangleCount !== expectedTriangles || qa.qualityTier !== 'evidence') throw new Error(`${name}: evidence tier was not active`);

  if (!(qa.sourceNodeMaxErrorM <= 1e-6)) throw new Error(`${name}: source node preservation failed`);
  if (!(qa.sourceCellMeanMaxAbsDeltaM <= 0.24)) throw new Error(`${name}: source cell mean budget failed`);
  if (!(qa.macroBlurMaxAbsDeltaM <= 0.40)) throw new Error(`${name}: macro residual budget failed`);
  if (!(qa.peakShiftM <= 25)) throw new Error(`${name}: peak shift budget failed`);
  if (qa.sourceResampling || qa.truthOverwrite || qa.syntheticGapFill || qa.verticalScale !== 1) throw new Error(`${name}: truth protection failed`);
  if (qa.proceduralMacroMountains !== false) throw new Error(`${name}: procedural macro mountains enabled`);
  if (qa.materialTextureCount || qa.terrainImageTextureCount || qa.imageFileCount || qa.screenshotArtifactCount) throw new Error(`${name}: image or texture count is non-zero`);
  if (qa.plantLayerCount || qa.vegetationInstanceCount) throw new Error(`${name}: plant count is non-zero`);
  if (!(qa.waterSegmentCount > 0) || !(qa.waterJoinCount > 0) || !qa.riverContinuityPass || qa.waterVisualGapCount !== 0) throw new Error(`${name}: continuous real-water gate failed`);
  if (qa.seedChannelCount !== 8 || qa.diagnosticFieldCount < 24 || qa.runtimeTierCount !== 3) throw new Error(`${name}: procedural field contract incomplete`);
  if (!/^[0-9a-f]{8}$/.test(qa.fieldGraphHash || '')) throw new Error(`${name}: deterministic field hash missing`);
  if (qa.knowledgeArchiveSha256 !== 'd69ecd2677507db9342a1d66092a8d6cf4255141346b14cc4629303bf1c4f396') throw new Error(`${name}: knowledge package receipt mismatch`);
  if (qa.visualAcceptance !== false || qa.visualApproved !== false || qa.productionReady !== false) throw new Error(`${name}: approval flags changed`);

  const tierDiagnostics = await page.evaluate(() => {
    const api = window.__LANDSCAPE_MOTHER_TEST_API__;
    const evidence = api.setQualityTier('evidence');
    const preview = api.setQualityTier('preview');
    const interaction = api.interaction(true);
    const released = api.interaction(false);
    const review = api.setQualityTier('review');
    api.setQualityTier('evidence');
    return { evidence, preview, interaction, released, review };
  });
  if (!(tierDiagnostics.preview.activeTriangleCount < tierDiagnostics.evidence.activeTriangleCount)) throw new Error(`${name}: preview LOD did not reduce triangles`);
  if (tierDiagnostics.interaction.effectiveQualityTier !== 'preview') throw new Error(`${name}: interaction preview did not activate`);
  if (tierDiagnostics.released.effectiveQualityTier !== 'preview') throw new Error(`${name}: requested preview tier was not preserved after interaction`);
  if (!(tierDiagnostics.review.activeTriangleCount < tierDiagnostics.evidence.activeTriangleCount)) throw new Error(`${name}: review LOD did not reduce triangles`);

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
      api.setQualityTier('evidence');
      api.setView(view);
      api.setMode(mode);
      return api.signature();
    }, { mode, view });
    const diagnostic = {
      name,
      modeName,
      signature: signatures[modeName],
      threshold: modeThresholds[modeName],
    };
    console.log(JSON.stringify(diagnostic));
    writePartial(name, {
      stage: `signature-${modeName}`,
      viewport,
      quality,
      isMobile,
      staticState,
      tierDiagnostics,
      signatures,
    });
    const threshold = modeThresholds[modeName];
    if (!(signatures[modeName].luminanceStdDev > threshold.luminanceStdDev)) {
      throw new Error(`${name}: ${modeName} luminance structure too weak: ${JSON.stringify(diagnostic)}`);
    }
    if (!(signatures[modeName].edgeEnergy > threshold.edgeEnergy)) {
      throw new Error(`${name}: ${modeName} edge energy too weak: ${JSON.stringify(diagnostic)}`);
    }
  }

  if (signatures.composite.hash === signatures.truth.hash) throw new Error(`${name}: composite and truth signatures are identical`);
  if (signatures.fields.hash === signatures.truth.hash) throw new Error(`${name}: field and truth signatures are identical`);
  if (signatures.fields.hash === signatures.hydrology.hash) throw new Error(`${name}: field and hydrology signatures are identical`);
  if (signatures.events.hash === signatures.geomorphology.hash) throw new Error(`${name}: event and geomorphology signatures are identical`);

  const beforeInteraction = signatures.composite.hash;
  const afterInteraction = await page.evaluate(() => {
    const api = window.__LANDSCAPE_MOTHER_TEST_API__;
    api.setQualityTier('evidence');
    api.setView('overview');
    api.setMode(0);
    api.orbit(42, -18);
    api.zoom(-120);
    return api.signature();
  });
  if (afterInteraction.hash === beforeInteraction) throw new Error(`${name}: orbit and zoom did not change the 3D frame`);

  const finalQa = await page.evaluate(() => window.__LANDSCAPE_MOTHER_QA__);
  const result = {
    name,
    viewport,
    quality,
    isMobile,
    staticState,
    tierDiagnostics,
    signatures,
    afterInteraction,
    finalQa,
    consoleErrors,
    pageErrors,
    failedRequests,
    imageRequests,
  };
  writePartial(name, { stage: 'complete', ...result });
  if (consoleErrors.length || pageErrors.length || failedRequests.length || imageRequests.length || finalQa.runtimeErrors.length) {
    throw new Error(`${name}: browser diagnostics failed\n${JSON.stringify(result, null, 2)}`);
  }
  results.push(result);
  await browser.close();
}

await run('desktop-1440x1000', { width: 1440, height: 1000 }, 'desktop', false);
await run('mobile-390x844', { width: 390, height: 844 }, 'mobile', true);

const report = {
  schema: 'landscape-mother-v2-browser-evidence/v1',
  generatedAt: new Date().toISOString(),
  passed: true,
  evidenceType: 'numeric-webgl-frame-signatures',
  modeThresholds,
  imageFileCount: 0,
  screenshotArtifactCount: 0,
  materialTextureCount: 0,
  plantLayerCount: 0,
  truthApproved: false,
  visualAcceptance: false,
  productionReady: false,
  results,
};
fs.writeFileSync(path.join(outputDir, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
