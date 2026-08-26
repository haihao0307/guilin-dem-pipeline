import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1720, height: 1080 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60000);
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));

await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle', timeout: 240000 });
await page.waitForFunction(() => window.__XIAOGUI_TERRAIN_READY === true, null, { timeout: 240000 });
await page.waitForTimeout(3500);

if (await page.locator('#viewer canvas').count() !== 1) throw new Error('WebGL canvas missing');
if (await page.locator('.landmark-label').count() !== 4) throw new Error('Four landmark labels missing');
for (const id of ['colorRichness', 'karstDetail', 'riverWidth', 'riverDepth', 'riverColor']) {
  if (await page.locator(`#${id}`).count() !== 1) throw new Error(`Missing control: ${id}`);
}
if (await page.locator('[data-season]').count() !== 4) throw new Error('Four season presets missing');

const contracts = await page.evaluate(() => ({
  coordinate: window.__XIAOGUI_COORDINATE_CONTRACT,
  render: window.__XIAOGUI_RENDER_CONTRACT,
  river: window.__XIAOGUI_RIVER_CONTRACT,
}));

if (!contracts.coordinate || !contracts.render || !contracts.river) throw new Error('Runtime contracts missing');
if (contracts.render.source_elevation_modified_m !== 0) throw new Error('Source elevation modification must be zero');
if (contracts.render.vertical_scale !== 1) throw new Error('Vertical scale must stay at 1');
if (!contracts.render.normal_file || !contracts.render.karst_detail_file) throw new Error('Rich terrain detail assets missing');
if (contracts.river.centerline_geometry_mutated !== false) throw new Error('River centerline must remain immutable');
if (contracts.river.geometry.ribbon_triangles <= 0) throw new Error('River ribbon geometry missing');
if (contracts.river.geometry.drape_offset_m > 2.0) throw new Error('River surface is too far above terrain');

const landmarkOrder = ['zhenbaoding', 'guilin', 'yangtang', 'yangshuo'];
for (let index = 0; index < landmarkOrder.length - 1; index += 1) {
  const north = contracts.coordinate.landmarks[landmarkOrder[index]];
  const south = contracts.coordinate.landmarks[landmarkOrder[index + 1]];
  if (!(north.northing > south.northing && north.z < south.z)) throw new Error('Landmark north/south order regression');
}

const background = await page.locator('.landmark-label').first().evaluate(element => getComputedStyle(element).backgroundColor);
if (!['rgba(0, 0, 0, 0)', 'transparent'].includes(background)) throw new Error(`Landmark background must be transparent: ${background}`);

await page.evaluate(() => {
  const button = document.querySelector('[data-season="summer"]');
  if (!button) throw new Error('Summer preset button missing');
  button.click();
});
await page.waitForFunction(() => window.__XIAOGUI_RIVER_CONTRACT?.season === 'summer', null, { timeout: 60000 });
const summer = await page.evaluate(() => window.__XIAOGUI_RIVER_CONTRACT);
if (Math.abs(summer.controls.width_scale - 1.38) > 0.001) throw new Error('Summer width preset failed');
if (Math.abs(summer.controls.depth_visual - 0.88) > 0.001) throw new Error('Summer depth preset failed');

await page.evaluate(() => {
  const button = document.querySelector('[data-target="yangshuo"]');
  if (!button) throw new Error('Yangshuo camera button missing');
  button.click();
});
await page.waitForTimeout(1400);

await fs.mkdir('dist/evidence', { recursive: true });
await page.screenshot({ path: 'dist/evidence/guilin-v072-rich-terrain-seasonal-rivers.png', fullPage: true, timeout: 120000 });
await fs.writeFile('dist/evidence/runtime-contracts.json', JSON.stringify({ initial: contracts, summer }, null, 2));
await fs.writeFile('dist/evidence/browser-console.json', JSON.stringify({ errors }, null, 2));

await browser.close();
if (errors.length) throw new Error(`Browser console errors: ${errors.join(' | ')}`);
console.log('OK: rich terrain, karst normal detail, seasonal river ribbons and coordinate contract passed.');
