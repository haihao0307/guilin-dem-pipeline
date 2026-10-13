const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.QA_OUT || 'qa-output';
const URL = 'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/grand-steam-r01/';
fs.mkdirSync(OUT, { recursive: true });
const report = { url: URL, testedAt: new Date().toISOString(), errors: [], failedRequests: [], passed: false };
const assert = (v, message) => { if (!v) throw Error(message); };
(async () => {
 let browser;
 try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1640, height: 1060 }, deviceScaleFactor: 1 });
  const p = await context.newPage(); p.setDefaultTimeout(120000);
  p.on('pageerror', e => report.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico')) report.errors.push(m.text()); });
  p.on('requestfailed', r => report.failedRequests.push(r.url() + ' ' + r.failure()?.errorText));
  const response = await p.goto(URL, { waitUntil: 'domcontentloaded' }); assert(response.status() === 200, 'ENTRY_HTTP');
  await p.waitForFunction(() => window.GRAND?.ready || window.GRAND?.error, null, { timeout: 240000 });
  assert(await p.evaluate(() => window.GRAND.ready), 'NOT_READY');
  const snap = async name => { await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await p.screenshot({ path: OUT + '/' + name + '.png', fullPage: true, timeout: 120000 }); };
  report.models = await p.evaluate(() => Object.keys(window.GRAND.loaded)); assert(report.models.length === 4, 'MISSING_MODEL');
  await snap('public-locomotive-pair');
  await p.locator('#manual-toggle').click(); assert(await p.locator('#manual').isVisible(), 'MANUAL_OPEN'); await p.locator('#manual-toggle').click(); assert(!(await p.locator('#manual').isVisible()), 'MANUAL_CLOSE');
  for (let i = 0; i < 2; i++) {
   await p.locator('[data-pair="coach"]').click(); await p.locator('#interior').click(); assert(await p.evaluate(() => window.GRAND.interior), 'CUTAWAY_OPEN');
   await p.locator('#doors').click(); assert(await p.evaluate(() => window.GRAND.loaded.coach.api.details.state.doors === 1), 'DOORS_OPEN');
   await p.locator('[data-pair="loco"]').click(); assert(await p.evaluate(() => !window.GRAND.interior), 'PAIR_CLOSE_CUTAWAY');
   await p.locator('#reset').click(); assert(await p.evaluate(() => window.GRAND.loaded.coach.api.details.state.doors === 0 && window.GRAND.view === 'pair'), 'RESET_ALL_DOORS');
  }
  await p.locator('[data-pair="coach"]').click(); await snap('public-coach-pair');
  await p.locator('#eye').click(); await p.locator('#doors').click(); await snap('public-passenger-eye');
  await p.locator('#sofa').click(); await snap('public-sofa-detail');
  await p.locator('#reset').click(); await p.setViewportSize({ width: 390, height: 844 });
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= 392), 'MOBILE_OVERFLOW'); await snap('public-mobile');
  assert(report.errors.length === 0, 'CONSOLE_ERRORS'); assert(report.failedRequests.length === 0, 'REQUEST_FAILURES');
  report.passed = true;
 } catch (e) { report.failure = e.stack; process.exitCode = 1; }
 finally { if (browser) await browser.close(); fs.writeFileSync(OUT + '/PUBLIC_BROWSER_QA.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
})();
