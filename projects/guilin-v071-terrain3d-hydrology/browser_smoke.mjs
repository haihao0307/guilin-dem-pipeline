import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];

page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));

await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle', timeout: 240000 });
await page.waitForFunction(() => window.__XIAOGUI_TERRAIN_READY === true, null, { timeout: 240000 });
await page.waitForFunction(() => Boolean(window.__XIAOGUI_COORDINATE_CONTRACT), null, { timeout: 240000 });
await page.waitForFunction(() => Boolean(window.__XIAOGUI_TERRAIN_STYLE), null, { timeout: 240000 });
await page.waitForFunction(() => Boolean(window.__XIAOGUI_WATER_STATE), null, { timeout: 240000 });
await page.waitForTimeout(3500);

if (await page.locator('#viewer canvas').count() !== 1) throw new Error('WebGL canvas missing');
if (await page.locator('.landmark-label').count() !== 4) throw new Error('Four landmark labels missing');

const landmarkTexts = (await page.locator('.landmark-label strong').allTextContents()).map(text => text.trim());
for (const name of ['陽朔縣', '秧塘機場', '桂林城', '真寶鼎']) {
  if (!landmarkTexts.includes(name)) throw new Error(`Missing landmark DOM text: ${name}; found=${landmarkTexts.join('|')}`);
}

if (await page.locator('.landmark-label small').count() !== 4) {
  throw new Error('Each landmark must contain exactly one coordinate line');
}

const coordinateTexts = await page.locator('.landmark-label small').allTextContents();
for (const text of coordinateTexts) {
  if (!/^E \d+\.\d{6}° · N \d+\.\d{6}°$/.test(text.trim())) {
    throw new Error(`Unexpected coordinate label: ${text}`);
  }
  if (/UTM|Lon|Lat/.test(text)) {
    throw new Error(`Redundant coordinate information remains: ${text}`);
  }
}

const backgrounds = await page.locator('.landmark-label').evaluateAll(elements =>
  elements.map(element => getComputedStyle(element).backgroundColor)
);
if (backgrounds.some(value => value !== 'rgba(0, 0, 0, 0)')) {
  throw new Error(`Landmark backgrounds must be transparent: ${backgrounds.join('|')}`);
}

const contract = await page.evaluate(() => window.__XIAOGUI_COORDINATE_CONTRACT);
if (contract.world_axes.north !== 'negative-z') {
  throw new Error(`Coordinate convention regression: ${JSON.stringify(contract.world_axes)}`);
}

const places = contract.landmarks;
if (!(places.zhenbaoding.z < places.guilin.z
  && places.guilin.z < places.yangtang.z
  && places.yangtang.z < places.yangshuo.z)) {
  throw new Error(`North-south order is inverted: ${JSON.stringify(places)}`);
}

const expectedUtm = {
  zhenbaoding: [482534.5, 2890708.1],
  guilin: [429459.2, 2795494.2],
  yangtang: [414949.6, 2789301.9],
  yangshuo: [448648.5, 2740850.8],
};
for (const [id, [expectedE, expectedN]] of Object.entries(expectedUtm)) {
  const actual = places[id];
  if (Math.abs(actual.easting - expectedE) > 50 || Math.abs(actual.northing - expectedN) > 50) {
    throw new Error(`Landmark coordinate drift: ${id} actual=${actual.easting},${actual.northing}`);
  }
  if (Math.abs((actual.y - actual.terrain_height) - 4) > 0.05) {
    throw new Error(`Landmark is not terrain anchored: ${id}`);
  }
}

for (const control of ['#colorRichness', '#karstDetail', '#waterWidth', '#waterDepth', '#waterColor']) {
  if (await page.locator(control).count() !== 1) throw new Error(`Missing control: ${control}`);
}
if (await page.locator('[data-season]').count() !== 4) throw new Error('Four seasonal water presets are required');

let terrainStyle = await page.evaluate(() => window.__XIAOGUI_TERRAIN_STYLE);
if (terrainStyle.source_elevation_changed !== false) throw new Error('Terrain style must not modify source elevation');
if (terrainStyle.texture_style !== 'xiaogui-karst-rich-v1') {
  throw new Error(`Unexpected terrain style: ${terrainStyle.texture_style}`);
}
if (!(terrainStyle.bump_scale > 50)) throw new Error("Karst bump detail too weak: ${terrainStyle.bump_scale}`);

let water = await page.evaluate(() => window.__XIAOGUI_WATER_STATE);
if (water.ribbon_triangles < 1000 || water.ribbon_vertices < 1000 || water.mesh_count < 2) {
  throw new Error(`Hydrology ribbon generation failed: ${JSON.stringify(wate)}`);
}
if (water.displayed_surface_lift_m > 1.2) {
  throw new Error(`Hydrology is lifted too far above terrain: ${water.displayed_surface_lift_m}`);
}

await page.locator('[data-season="winter"]').click();
await page.waitForTimeout(150);
const winter = await page.evaluate(() => window.__XIAOGUI_WATER_STATE);
await page.locator('[data-season="summer"]').click();
await page.waitForTimeout(150);
const summer = await page.evaluate(() => window.__XIAOGUI_WATER_STATE);
if (!(summer.width_scale > winter.width_scale && summer.depth > winter.depth && summer.color !== winter.color)) {
  throw new Error(`Season presets do not change width, depth and color: winter=${JSON.stringify(winter)} summer=${JSON.stringify(summer)}`);
}

await page.locator('#waterWidth').evaluate(element => {
  element.value = '1.46';
  element.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.locator('#waterDepth').evaluate(element => {
  element.value = '0.68';
  element.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.locator('#colorRichness').evaluate(element => {
  element.value = '1.34';
  element.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.locator('#karstDetail').evaluate(element => {
  element.value = '82';
  element.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(250);

water = await page.evaluate(() => window.__XIAOGUI_WATER_STATE);
terrainStyle = await page.evaluate(() => window.__XIAOGUI_TERRAIN_STYLE);
if (Math.abs(water.width_scale - 1.46) > 0.001 || Math.abs(water.depth - 0.68) > 0.001) {
  throw new Error(`Custom water controls failed: ${JSON.stringify(water)}`);
}
if (Math.abs(terrainStyle.color_richness - 1.34) > 0.001 || Math.abs(terrainStyle.karst_detail - 0.82) > 0.001) {
  throw new Error(`Terrain style controls failed: ${JSON.stringify(terrainStyle)}`);
}

if ((await page.locator('#source').textContent()) === '--') throw new Error('Terrain manifest not displayed');

await fs.mkdir('dist/evidence', { recursive: true });
await page.screenshot({ path: 'dist/evidence/guilin-v072-karst-seasonal-water.png', fullPage: true });
await fs.writeFile('dist/evidence/browser-console.json', JSON.stringify){ errors }, null, 2));
await fs.writeFile('dist/evidence/coordinate-contract.json', JSON.stringify(contract, null, 2));
await fs.writeFile('dist/evidence/terrain-style-contract.json', JSON.stringify(terrainStyle, null, 2));
await fs.writeFile('dist/evidence/water-style-contract.json', JSON.stringify(water, null, 2));

await browser.close();

if (errors.length) throw new Error(`Browser console errors: ${errors.join(' | ')}`);
console.log('OK: richer terrain color, karst detail, wide seasonal water ribbons and coordinate contract passed.');
