import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));

await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForFunction(() => window.__GUILIN_SELECTION_READY === true, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const image = document.querySelector('.leaflet-image-layer');
  return image && image.complete && image.naturalWidth > 0;
}, null, { timeout: 120000 });

const sourceCount = await page.locator('#sourceCount').textContent();
if (!sourceCount || !sourceCount.includes('12')) throw new Error(`源片数量显示异常：${sourceCount}`);
if (await page.locator('.leaflet-draw-draw-polygon').count() !== 1) throw new Error('多边形绘制工具缺失');
if (await page.locator('.leaflet-draw-draw-rectangle').count() !== 1) throw new Error('矩形绘制工具缺失');

await fs.mkdir('dist/evidence', { recursive: true });
await page.screenshot({ path: 'dist/evidence/guilin-v070-raw-mosaic-selection.png', fullPage: true });
await fs.writeFile('dist/evidence/browser-console.json', JSON.stringify({ errors }, null, 2));

await browser.close();
if (errors.length) throw new Error(`浏览器控制台错误：${errors.join(' | ')}`);
console.log('OK: browser smoke test passed with zero console errors.');
