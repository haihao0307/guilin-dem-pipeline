import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const workbenchUrl = process.env.WORKBENCH_URL;
const playerUrl = process.env.PLAYER_URL;
if (!workbenchUrl || !playerUrl) throw new Error('WORKBENCH_URL and PLAYER_URL are required');
await mkdir('qa-artifacts', { recursive: true });

const R04_INSTRUMENT_SHA256 = 'e0f6c35710561dad66e8ffbc748fc28d2bac61a6771549eb89611db165669435';
const KEYS = ['polarBear', 'tortoise', 'neutral', 'grayWolf'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function integerText(value) {
  return Number(String(value ?? '').replace(/[^0-9]/g, ''));
}

async function trackPage(page) {
  const report = { consoleErrors: [], pageErrors: [], failedRequests: [], dependencyRequests: [] };
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('requestfailed', (request) => report.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('request', (request) => {
    const url = request.url();
    if (request.resourceType() !== 'document' && !url.startsWith('data:') && !url.startsWith('blob:')) report.dependencyRequests.push(`${request.resourceType()} ${url}`);
  });
  return report;
}

function assertClean(report, name) {
  assert(report.consoleErrors.length === 0, `${name}: console errors\n${report.consoleErrors.join('\n')}`);
  assert(report.pageErrors.length === 0, `${name}: page errors\n${report.pageErrors.join('\n')}`);
  assert(report.failedRequests.length === 0, `${name}: failed requests\n${report.failedRequests.join('\n')}`);
  assert(report.dependencyRequests.length === 0, `${name}: dependency requests\n${report.dependencyRequests.join('\n')}`);
}

async function verifyWorkbench(browser, name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const report = await trackPage(page);
  try {
    const response = await page.goto(workbenchUrl, { waitUntil: 'load', timeout: 120_000 });
    if (!workbenchUrl.startsWith('file:')) assert(response?.ok(), `${name}: HTTP ${response?.status()}`);
    await page.waitForSelector('#viewport canvas', { state: 'visible', timeout: 45_000 });
    await page.waitForFunction(() => window.__KAOPU_QUADRUPED_R05__?.state().frames > 5, null, { timeout: 45_000 });
    await page.waitForFunction(() => window.__KAOPU_QUADRUPED_R05__?.state().active === true, null, { timeout: 90_000 });
    assert(await page.title() === 'KAOPU · Quadruped Instrument R05', `${name}: wrong title`);

    const contract = await page.evaluate(() => window.__KAOPU_QUADRUPED_R05__.contract);
    assert(contract.identityPresets === 0, `${name}: instrument contains identity presets`);
    assert(contract.domain === 'bilateral-quadruped', `${name}: wrong domain`);
    assert(integerText(await page.locator('#preset-count').textContent()) === 0, `${name}: UI preset audit mismatch`);

    const initial = await page.evaluate(() => window.__KAOPU_QUADRUPED_R05__.state());
    const initialScore = await page.evaluate(() => window.__KAOPU_QUADRUPED_R05__.scores.grayWolf.score);
    assert(initial.score === initialScore, `${name}: R05 should open on the new wolf score`);
    assert(initial.metrics.scoreBytes > 180, `${name}: wolf score is suspiciously small`);
    assert(initial.metrics.triangles > 10000, `${name}: initial wolf output too small`);
    assert(initial.metrics.meshes >= 2, `${name}: wolf output missing details/cover`);

    const buttons = page.locator('[data-score-key]');
    assert(await buttons.count() === 4, `${name}: expected 4 external score fixtures`);
    const outputs = [];
    for (const key of KEYS) {
      await page.locator(`[data-score-key="${key}"]`).click();
      await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 90_000 });
      const state = await page.evaluate(() => window.__KAOPU_QUADRUPED_R05__.state());
      assert(state.metrics.scoreBytes > 180, `${name}:${key}: score missing structural data`);
      assert(state.metrics.triangles > 10000, `${name}:${key}: no substantial geometry`);
      outputs.push({ key, hash: state.hash, metrics: state.metrics });
    }
    assert(new Set(outputs.map((item) => item.hash)).size === 4, `${name}: different scores did not generate four distinct outputs`);

    await page.locator('[data-score-key="grayWolf"]').click();
    await page.locator('#verify').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('独立重演校验通过'), null, { timeout: 90_000 });

    const instrumentDownloadPromise = page.waitForEvent('download');
    await page.locator('#download-instrument').click();
    const instrumentDownload = await instrumentDownloadPromise;
    assert(instrumentDownload.suggestedFilename() === 'KAOPU_QUADRUPED_K4.js', `${name}: wrong instrument filename`);
    const instrumentPath = await instrumentDownload.path();
    const instrument = await readFile(instrumentPath);
    const instrumentSha256 = createHash('sha256').update(instrument).digest('hex');
    const expectedInstrumentBytes = Number(await page.locator('meta[name="kaopu-instrument-bytes"]').getAttribute('content'));
    assert(instrument.length === expectedInstrumentBytes, `${name}: instrument byte mismatch`);
    assert(instrumentSha256 === R04_INSTRUMENT_SHA256, `${name}: K4 instrument changed from R04`);
    const lower = instrument.toString('utf8').toLowerCase();
    for (const word of ['polar bear', 'polarbear', 'tortoise', 'eagle', 'gray wolf', 'graywolf', '北极熊', '陆龟', '灰狼']) {
      assert(!lower.includes(word), `${name}: pure instrument contains identity ${word}`);
    }

    const canvas = page.locator('#viewport canvas');
    await canvas.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.__KAOPU_QUADRUPED_R05__.state().camera);
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .7, box.y + box.height * .35, { steps: 10 });
      await page.mouse.up();
      await page.mouse.wheel(0, -220);
    }
    const after = await page.evaluate(() => window.__KAOPU_QUADRUPED_R05__.state().camera);
    assert(JSON.stringify(before) !== JSON.stringify(after), `${name}: camera did not move`);
    await page.locator('#camera').click();

    assertClean(report, name);
    await page.screenshot({ path: `qa-artifacts/${name}-gray-wolf.png`, fullPage: true });
    return { name, viewport, outputs, instrumentBytes: instrument.length, instrumentSha256, initialWolfHash: initial.hash };
  } finally {
    await page.close();
  }
}

async function verifyEmptyPlayer(browser, name, viewport, scores) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const report = await trackPage(page);
  try {
    const response = await page.goto(playerUrl, { waitUntil: 'load', timeout: 120_000 });
    if (!playerUrl.startsWith('file:')) assert(response?.ok(), `${name}: HTTP ${response?.status()}`);
    await page.waitForSelector('#viewport canvas', { state: 'visible', timeout: 45_000 });
    await page.waitForFunction(() => window.__KAOPU_EMPTY_K4__?.state().frames > 5, null, { timeout: 45_000 });
    const empty = await page.evaluate(() => window.__KAOPU_EMPTY_K4__.state());
    assert(empty.active === false, `${name}: empty player generated an object before receiving a score`);
    assert(empty.metrics === null, `${name}: empty player has hidden result metrics`);
    assert(await page.locator('[data-score-key]').count() === 0, `${name}: empty player contains score preset buttons`);

    const replay = [];
    for (const key of KEYS) {
      const score = scores[key];
      await page.locator('#score').fill(score);
      await page.locator('#play').click();
      await page.waitForFunction(() => window.__KAOPU_EMPTY_K4__?.state().active === true && document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 90_000 });
      const state = await page.evaluate(() => window.__KAOPU_EMPTY_K4__.state());
      assert(state.score === score, `${name}:${key}: player did not use imported score verbatim`);
      assert(state.metrics.triangles > 10000, `${name}:${key}: imported score produced no geometry`);
      replay.push({ key, hash: state.hash, metrics: state.metrics });
    }
    assert(new Set(replay.map((item) => item.hash)).size === KEYS.length, `${name}: empty player replay hashes collapsed`);
    assertClean(report, name);
    await page.screenshot({ path: `qa-artifacts/${name}-empty-player.png`, fullPage: true });
    return { name, viewport, replay };
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const desktop = await verifyWorkbench(browser, 'desktop-1440x960', { width: 1440, height: 960 });
  const mobile = await verifyWorkbench(browser, 'mobile-390x844', { width: 390, height: 844 });
  const scorePage = await browser.newPage();
  let scores;
  try {
    await scorePage.goto(workbenchUrl, { waitUntil: 'load', timeout: 120_000 });
    await scorePage.waitForFunction(() => Boolean(window.__KAOPU_QUADRUPED_R05__?.scores), null, { timeout: 45_000 });
    scores = await scorePage.evaluate(() => Object.fromEntries(Object.entries(window.__KAOPU_QUADRUPED_R05__.scores).map(([key, value]) => [key, value.score])));
  } finally {
    await scorePage.close();
  }
  const emptyDesktop = await verifyEmptyPlayer(browser, 'empty-desktop-1280x800', { width: 1280, height: 800 }, scores);
  const emptyMobile = await verifyEmptyPlayer(browser, 'empty-mobile-390x844', { width: 390, height: 844 }, scores);
  const mode = workbenchUrl.startsWith('file:') ? 'standalone' : 'public';
  await writeFile(`qa-artifacts/${mode}-results.json`, JSON.stringify({ workbenchUrl, playerUrl, verifiedAt: new Date().toISOString(), desktop, mobile, emptyDesktop, emptyMobile }, null, 2) + '\n');
} finally {
  await browser.close();
}
console.log(`KAOPU Quadruped R05 browser QA passed: ${workbenchUrl}`);
