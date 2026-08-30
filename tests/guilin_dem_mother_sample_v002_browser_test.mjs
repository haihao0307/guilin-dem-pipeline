import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4174/';
const evidenceDir = process.argv[3] || 'build/guilin-mother-sample-v002/evidence';
fs.mkdirSync(evidenceDir, { recursive: true });
const results = [];

async function capture(name, viewport, isMobile) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 180_000 });
  await page.waitForTimeout(500);

  const initial = await page.evaluate(() => ({
    qa: window.__GUILIN_DEM_MOTHER_SAMPLE_V002__,
    canvasCount: document.querySelectorAll('canvas').length,
    imageCount: document.querySelectorAll('img').length,
    modeCount: document.querySelectorAll('[data-mode]').length,
    hasPlantText: /植物|生态点样|竹林|树木/.test(document.body.innerText),
  }));
  const qa = initial.qa;
  if (!qa?.passed) throw new Error(`${name}: QA failed\n${JSON.stringify(initial, null, 2)}`);
  if (qa.render_mode !== 'interactive-webgl2-3d' || !qa.webgl2_active) throw new Error(`${name}: interactive 3D contract failed`);
  if (initial.canvasCount !== 1 || initial.imageCount !== 0) throw new Error(`${name}: canvas/image delivery contract failed`);
  if (initial.modeCount !== 7) throw new Error(`${name}: expected seven 3D modes`);
  if (initial.hasPlantText) throw new Error(`${name}: removed plant layer still appears in UI`);
  if (qa.truth_grid?.[0] !== 81 || qa.render_grid?.[0] !== 321) throw new Error(`${name}: truth/render grid mismatch`);
  if (qa.render_spacing_m !== 3.125 || qa.render_subdivision_factor !== 4) throw new Error(`${name}: render subdivision mismatch`);
  if (!(qa.source_node_preservation_max_error_m <= 1e-6)) throw new Error(`${name}: source node preservation failed`);
  if (qa.source_resampling || qa.truth_overwrite || qa.synthetic_gap_fill || qa.vertical_scale !== 1) throw new Error(`${name}: truth protection failed`);
  if (!(qa.karst_peak_count >= 5)) throw new Error(`${name}: insufficient karst peak anchors`);
  if (!(qa.karst_additive_range_m?.[1] >= 15)) throw new Error(`${name}: karst additive is not visually meaningful`);
  if (!(qa.terrain_vertex_count >= 100_000 && qa.terrain_triangle_count >= 200_000)) throw new Error(`${name}: 3D geometry density too low`);
  if (!(qa.osm_segment_count > 0)) throw new Error(`${name}: real waterway missing`);
  if (qa.plant_layer_count !== 0 || qa.vegetation_instance_count !== 0) throw new Error(`${name}: vegetation not removed`);
  if (qa.concept_image_count !== 0 || qa.ai_generated_acceptance_image_count !== 0) throw new Error(`${name}: 2D concept image entered delivery`);
  if (qa.terrain_image_texture_count !== 0 || qa.terrain_sampler2d_count !== 0 || qa.external_terrain_image_request_count !== 0) throw new Error(`${name}: terrain image texture contract failed`);
  if (qa.visualAcceptance !== false || qa.productionReady !== false) throw new Error(`${name}: approval flags changed`);

  const api = 'window.__GUILIN_DEM_MOTHER_SAMPLE_V002_TEST_API';
  const set = async (mode, view, wait = 320) => {
    await page.evaluate(({ api, mode, view }) => {
      window.eval(api).setMode(mode);
      window.eval(api).setView(view);
    }, { api, mode, view });
    await page.waitForTimeout(wait);
  };
  const shot = async file => page.screenshot({ path: path.join(evidenceDir, `${name}-${file}.png`), fullPage: true });

  await set(0, 'overview', 360);
  await shot('01-composite-overview');

  await set(0, 'karst', 360);
  await shot('02-composite-karst-close');

  await set(2, 'karst', 300);
  await shot('03-karst-diagnostic-close');

  await set(0, 'field', 360);
  await shot('04-composite-field-close');

  await set(3, 'field', 300);
  await shot('05-field-diagnostic-close');

  await set(1, 'overview', 250);
  await shot('06-truth');

  await set(6, 'overview', 250);
  await shot('07-compare');

  const finalQa = await page.evaluate(() => window.__GUILIN_DEM_MOTHER_SAMPLE_V002__);
  const result = { name, viewport, isMobile, initial, finalQa, consoleErrors, pageErrors, failedRequests };
  if (consoleErrors.length || pageErrors.length || failedRequests.length || finalQa.runtime_errors.length) {
    throw new Error(`${name}: browser diagnostics failed\n${JSON.stringify(result, null, 2)}`);
  }
  results.push(result);
  await browser.close();
}

await capture('desktop-1440x1000', { width: 1440, height: 1000 }, false);
await capture('mobile-390x844', { width: 390, height: 844 }, true);

const report = {
  schema: 'guilin-dem-mother-sample-v002-browser-evidence/v2',
  generated_at: new Date().toISOString(),
  passed: true,
  evidence_source: 'current-interactive-webgl2-runtime',
  screenshot_kind: 'runtime-rendered-3d-only',
  conceptImageCount: 0,
  aiGeneratedAcceptanceImageCount: 0,
  visualAcceptance: false,
  productionReady: false,
  results,
};
fs.writeFileSync(path.join(evidenceDir, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
