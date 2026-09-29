import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const workbenchUrl = process.env.WORKBENCH_URL;
const playerUrl = process.env.PLAYER_URL;
if (!workbenchUrl || !playerUrl) throw new Error('WORKBENCH_URL and PLAYER_URL are required');
await mkdir('qa-artifacts', { recursive: true });

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
    await page.waitForFunction(() => window.__KAOPU_QUADRUPED_R04__?.state().frames > 5, null, { timeout: 45_000 });
    await page.waitForFunction(() => window.__KAOPU_QUADRUPED_R04__?.state().active === true, null, { timeout: 90_000 });
    assert(await page.title() === 'KAOPU · Quadruped Instrument R04', `${name}: wrong title`);

    const contract = await page.evaluate(() => window.__KAOPU_QUADRUPED_R04__.contract);
    assert(contract.identityPresets === 0, `${name}: instrument contains identity presets`);
    assert(contract.domain === 'bilateral-quadruped', `${name}: wrong domain`);
    assert(integerText(await page.locator('#preset-count').textContent()) === 0, `${name}: UI preset audit mismatch`);

    const initial = await page.evaluate(() => window.__KAOPU_QUADRUPED_R04__.state());
    assert(initial.metrics.scoreBytes > 180, `${name}: corrected score is suspiciously small`);
    assert(initial.metrics.triangles > 10000, `${name}: initial output too small`);
    assert(initial.metrics.meshes >= 2, `${name}: initial output missing score details/cover`);

    const buttons = page.locator('[data-score-key]');
    assert(await buttons.count() === 3, `${name}: expected 3 external score fixtures`);
    const outputs = [];
    for (const key of ['polarBear', 'tortoise', 'neutral']) {
      await page.locator(`[data-score-key="${key}"]`).click();
      await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 90_000 });
      const state = await page.evaluate(() => window.__KAOPU_QUADRUPED_R04__.state());
      assert(state.metrics.scoreBytes > 180, `${name}:${key}: score missing structural data`);
      assert(state.metrics.triangles > 10000, `${name}:${key}: no substantial geometry`);
      outputs.push({ key, hash: state.hash, metrics: state.metrics });
    }
    assert(new Set(outputs.map((item) => item.hash)).size === 3, `${name}: different scores did not generate distinct output`);

    await page.locator('[data-score-key="neutral"]').click();
    await page.locator('#verify').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('独立重演校验通过'), null, { timeout: 90_000 });

    const instrumentDownloadPromise = page.waitForEvent('download');
    await page.locator('#download-instrument').click();
    const instrumentDownload = await instrumentDownloadPromise;
    assert(instrumentDownload.suggestedFilename() === 'KAOPU_QUADRUPED_K4.js', `${name}: wrong instrument filename`);
    const instrumentPath = await instrumentDownload.path();
    const instrument = await readFile(instrumentPath);
    const expectedInstrumentBytes = Number(await page.locator('meta[name="kaopu-instrument-bytes"]').getAttribute('content'));
    assert(instrument.length === expectedInstrumentBytes, `${name}: instrument byte mismatch`);
    const lower = instrument.toString('utf8').toLowerCase();
    for (const word of ['polar bear', 'polarbear', 'tortoise', 'eagle', '北极熊', '陆龟']) assert(!lower.includes(word), `${name}: pure instrument contains identity ${word}`);

    const canvas = page.locator('#viewport canvas');
    await canvas.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.__KAOPU_QUADRUPED_R04__.state().camera);
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .7, box.y + box.height * .35, { steps: 10 });
      await page.mouse.up();
      await page.mouse.wheel(0, -220);
    }
    const after = await page.evaluate(() => window.__KAOPU_QUADRUPED_R04__.state().camera);
    assert(JSON.stringify(before) !== JSON.stringify(after), `${name}: camera did not move`);

    assertClean(report, name);
    await page.screenshot({ path: `qa-artifacts/${name}-workbench.png`, fullPage: true });
    return { name, viewport, outputs, instrumentBytes: instrument.length, instrumentSha256: createHash('sha256').update(instrument).digest('hex') };
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
    for (const [key, score] of Object.entries(scores)) {
      await page.locator('#score').fill(score);
      await page.locator('#play').click();
      await page.waitForFunction(() => window.__KAOPU_EMPTY_K4__?.state().active === true && document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 90_000 });
      const state = await page.evaluate(() => window.__KAOPU_EMPTY_K4__.state());
      assert(state.score === score, `${name}:${key}: player did not use imported score verbatim`);
      assert(state.metrics.triangles > 10000, `${name}:${key}: imported score produced no geometry`);
      replay.push({ key, hash: state.hash });
    }
    assert(new Set(replay.map((item) => item.hash)).size === Object.keys(scores).length, `${name}: empty player replay hashes collapsed`);
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
    await scorePage.waitForFunction(() => Boolean(window.__KAOPU_QUADRUPED_R04__?.scores), null, { timeout: 45_000 });
    scores = await scorePage.evaluate(() => Object.fromEntries(Object.entries(window.__KAOPU_QUADRUPED_R04__.scores).map(([key, value]) => [key, value.score])));
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
console.log(`KAOPU Quadruped R04 browser QA passed: ${workbenchUrl}`);
