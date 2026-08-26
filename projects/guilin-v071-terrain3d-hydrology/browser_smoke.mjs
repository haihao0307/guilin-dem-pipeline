import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));

await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForFunction(() => window.__XIAOGUI_TERRAIN_READY === true, null, { timeout: 180000 });
await page.waitForTimeout(2500);

if (await page.locator('#viewer canvas').count() !== 1) throw new Error('WebGL canvas missing');
if (await page.locator('.landmark-label').count() !== 4) throw new Error('Four landmark labels missing');
const landmarkTexts = (await page.locator('.landmark-label strong').allTextContents()).map(text => text.trim());
for (const name of ['陽朔縣', '秧塘機場', '桂林城', '真寶鼎']) {
  if (!landmarkTexts.includes(name)) throw new Error(`Missing landmark DOM text: ${name}; found=${landmarkTexts.join('|')}`);
}
if ((await page.locator('#source').textContent()) === '--') throw new Error('Terrain manifest not displayed');

await fs.mkdir('dist/evidence', { recursive: true });
await page.screenshot({ path: 'dist/evidence/guilin-v071-terrain3d-hydrology.png', fullPage: true });
await fs.writeFile('dist/evidence/browser-console.json', JSON.stringify({ errors }, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser console errors: ${errors.join(' | ')}`);
console.log('OK: 3D terrain viewer passed smoke test with four landmarks and zero console errors.');
