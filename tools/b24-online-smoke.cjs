const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.URL_TO_TEST;
const output = process.env.EVIDENCE;
if (!url || !output) throw new Error('URL_TO_TEST and EVIDENCE are required.');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || 'unknown'
  }));

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__B24_WORKBENCH__?.ready, null, { timeout: 120000 });
  await page.waitForTimeout(800);

  const baseline = await page.evaluate(() => {
    const workbench = window.__B24_WORKBENCH__;
    return {
      state: workbench.getState(),
      stats: workbench.captureState(),
      sceneNames: workbench.scene.children.map(node => node.name),
      iframeCount: document.querySelectorAll('iframe').length,
      canvasCount: document.querySelectorAll('canvas#scene').length,
      playEnabled: !document.querySelector('#play').disabled,
      title: document.title
    };
  });

  await page.evaluate(() => document.querySelector('#play').click());
  await page.waitForFunction(() => window.__B24_WORKBENCH__.mission.time > 6, null, { timeout: 90000 });
  const playing = await page.evaluate(() => window.__B24_WORKBENCH__.getState());

  await page.evaluate(() => window.__B24_WORKBENCH__.seek(136));
  await page.waitForTimeout(600);
  const bombing = await page.evaluate(() => window.__B24_WORKBENCH__.getState());
  await page.screenshot({ path: path.join(output, 'review.png'), timeout: 60000 });

  const checks = {
    http200: response.status() === 200,
    correctTitle: baseline.title.includes('B24') && baseline.title.includes('草地机场'),
    inheritedPayloadVerified: baseline.state.sourcePayloadSha256 === '7ba1b923844f5161911e9aa63b18191e0d08ff8de4b3750204aa544320bd34c2',
    hierarchyRetained: baseline.stats.components === 1784 && baseline.stats.meshes === 348,
    fourOriginalSpindles: baseline.stats.spindles.length === 4,
    oneThreeScene: baseline.iframeCount === 0 && baseline.canvasCount === 1,
    grassAirfieldPresent: baseline.sceneNames.includes('GRASS_AIRFIELD_SHARED_WORLD'),
    noMountainObject: !baseline.sceneNames.some(name => /mountain/i.test(name)),
    controlsUsable: baseline.playEnabled,
    missionAdvances: playing.time > 6 && playing.running,
    fourGroundImpacts: bombing.impacts === 4,
    noPageErrors: pageErrors.length === 0,
    noConsoleErrors: consoleErrors.length === 0,
    noFailedRequests: failedRequests.length === 0
  };
  const report = {
    schema: 'haihao.aircraft/b24-online-html-browser-smoke@1.0.0',
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    url,
    checks,
    pageErrors,
    consoleErrors,
    failedRequests,
    baseline,
    playing,
    bombing,
    visualAcceptance: false,
    productionReady: false
  };
  fs.writeFileSync(path.join(output, 'browser-qa.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (report.status !== 'PASS') process.exit(1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
