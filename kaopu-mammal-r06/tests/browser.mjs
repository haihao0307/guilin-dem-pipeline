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
async function waitActive(page, globalName, timeout = 120000) {
  await page.waitForFunction((name) => window[name]?.state().frames > 5, globalName, { timeout: 45000 });
  await page.waitForFunction((name) => window[name]?.state().active === true, globalName, { timeout });
}

async function verifyWorkbench(browser, name, viewport, comprehensive) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const report = await trackPage(page);
  try {
    const response = await page.goto(workbenchUrl, { waitUntil: 'load', timeout: 120000 });
    if (!workbenchUrl.startsWith('file:')) assert(response?.ok(), `${name}: HTTP ${response?.status()}`);
    await page.waitForSelector('#viewport canvas', { state: 'visible', timeout: 45000 });
    await waitActive(page, '__KAOPU_MAMMAL_R06__');
    assert(await page.title() === 'KAOPU · Mammal Instrument R06', `${name}: wrong title`);
    const contract = await page.evaluate(() => window.__KAOPU_MAMMAL_R06__.contract);
    assert(contract.identityPresets === 0, `${name}: identity presets found`);
    assert(contract.domain === 'digitigrade-mammal', `${name}: wrong domain`);
    assert(integerText(await page.locator('#preset-count').textContent()) === 0, `${name}: UI identity audit mismatch`);
    const initial = await page.evaluate(() => window.__KAOPU_MAMMAL_R06__.state());
    assert(initial.key === 'neutralDog', `${name}: default must be neutralDog external score`);
    assert(initial.metrics.scoreBytes > 500, `${name}: dog score missing object data`);
    assert(initial.metrics.triangles > 18000, `${name}: default geometry too small`);

    const keys = comprehensive ? ['greyTabby', 'neutralDog', 'grayWolf', 'unseenMammal'] : ['greyTabby', 'neutralDog'];
    const outputs = [];
    for (const key of keys) {
      await page.locator(`[data-score-key="${key}"]`).click();
      await page.waitForFunction((expected) => window.__KAOPU_MAMMAL_R06__.state().key === expected && document.querySelector('#status')?.textContent?.includes('演奏完成'), key, { timeout: 120000 });
      const state = await page.evaluate(() => window.__KAOPU_MAMMAL_R06__.state());
      assert(state.metrics.scoreBytes > 420, `${name}:${key}: score too small`);
      assert(state.metrics.triangles > 18000, `${name}:${key}: no substantial geometry`);
      outputs.push({ key, hash: state.hash, metrics: state.metrics });
      if (comprehensive && ['greyTabby', 'neutralDog', 'grayWolf'].includes(key)) {
        await page.locator('[data-view="quarter"]').click();
        await page.screenshot({ path: `qa-artifacts/${name}-${key}.png`, fullPage: true });
      }
    }
    assert(new Set(outputs.map((item) => item.hash)).size === outputs.length, `${name}: distinct scores collapsed`);

    await page.locator('[data-score-key="neutralDog"]').click();
    await page.locator('#skeleton').click();
    await page.waitForFunction(() => window.__KAOPU_MAMMAL_R06__.state().skeletonVisible === true, null, { timeout: 30000 });
    await page.locator('#verify').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('独立重演校验通过'), null, { timeout: 120000 });

    const instrumentDownloadPromise = page.waitForEvent('download');
    await page.locator('#download-instrument').click();
    const instrumentDownload = await instrumentDownloadPromise;
    assert(instrumentDownload.suggestedFilename() === 'KAOPU_MAMMAL_K5.js', `${name}: wrong instrument filename`);
    const instrumentPath = await instrumentDownload.path();
    const instrument = await readFile(instrumentPath);
    const expectedBytes = Number(await page.locator('meta[name="kaopu-instrument-bytes"]').getAttribute('content'));
    assert(instrument.length === expectedBytes, `${name}: instrument byte mismatch`);
    const lower = instrument.toString('utf8').toLowerCase();
    for (const token of ['grey tabby', 'greytabby', 'neutral dog', 'neutraldog', 'gray wolf', 'graywolf', 'polar bear', 'tortoise', '灰虎斑', '中型短毛犬', '灰狼']) {
      assert(!lower.includes(token), `${name}: pure instrument contains identity token ${token}`);
    }

    const canvas = page.locator('#viewport canvas');
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const before = await page.evaluate(() => window.__KAOPU_MAMMAL_R06__.state().camera);
    const box = await canvas.boundingBox();
    assert(box && box.width > 200 && box.height > 200, `${name}: canvas is not interactable`);
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .72, box.y + box.height * .34, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, -180);
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => window.__KAOPU_MAMMAL_R06__.state().camera);
    assert(JSON.stringify(before) !== JSON.stringify(after), `${name}: camera did not move`);
    assertClean(report, name);
    await page.screenshot({ path: `qa-artifacts/${name}-final.png`, fullPage: true });
    return { name, viewport, outputs, instrumentBytes: instrument.length, instrumentSha256: createHash('sha256').update(instrument).digest('hex') };
  } catch (error) {
    await page.screenshot({ path: `qa-artifacts/${name}-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}

async function extractScores(browser) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    await page.goto(workbenchUrl, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__KAOPU_MAMMAL_R06__?.scores, null, { timeout: 45000 });
    return await page.evaluate(() => Object.fromEntries(Object.entries(window.__KAOPU_MAMMAL_R06__.scores).map(([key, value]) => [key, value.score])));
  } finally {
    await page.close();
  }
}

async function verifyEmptyPlayer(browser, name, viewport, scores, comprehensive) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const report = await trackPage(page);
  try {
    const response = await page.goto(playerUrl, { waitUntil: 'load', timeout: 120000 });
    if (!playerUrl.startsWith('file:')) assert(response?.ok(), `${name}: HTTP ${response?.status()}`);
    await page.waitForSelector('#viewport canvas', { state: 'visible', timeout: 45000 });
    await page.waitForFunction(() => window.__KAOPU_EMPTY_K5__?.state().frames > 5, null, { timeout: 45000 });
    const empty = await page.evaluate(() => window.__KAOPU_EMPTY_K5__.state());
    assert(empty.active === false, `${name}: empty player generated an object before score import`);
    assert(empty.metrics === null, `${name}: empty player has hidden result metrics`);
    assert(await page.locator('[data-score-key]').count() === 0, `${name}: empty player contains preset score buttons`);
    const entries = comprehensive ? Object.entries(scores) : Object.entries(scores).filter(([key]) => ['greyTabby', 'neutralDog'].includes(key));
    const replay = [];
    for (const [key, score] of entries) {
      await page.locator('#score').fill(score);
      await page.locator('#play').click();
      await page.waitForFunction((expected) => window.__KAOPU_EMPTY_K5__?.state().active === true && window.__KAOPU_EMPTY_K5__.state().score === expected && document.querySelector('#status')?.textContent?.includes('演奏完成'), score, { timeout: 120000 });
      const state = await page.evaluate(() => window.__KAOPU_EMPTY_K5__.state());
      assert(state.metrics.triangles > 18000, `${name}:${key}: imported score produced no geometry`);
      replay.push({ key, hash: state.hash, metrics: state.metrics });
    }
    assert(new Set(replay.map((item) => item.hash)).size === replay.length, `${name}: empty-player outputs collapsed`);
    assertClean(report, name);
    await page.screenshot({ path: `qa-artifacts/${name}-empty-player.png`, fullPage: true });
    return { name, viewport, replay };
  } catch (error) {
    await page.screenshot({ path: `qa-artifacts/${name}-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const desktop = await verifyWorkbench(browser, 'desktop-1440x960', { width: 1440, height: 960 }, true);
  const mobile = await verifyWorkbench(browser, 'mobile-390x844', { width: 390, height: 844 }, false);
  const scores = await extractScores(browser);
  const emptyDesktop = await verifyEmptyPlayer(browser, 'empty-desktop-1280x800', { width: 1280, height: 800 }, scores, true);
  const emptyMobile = await verifyEmptyPlayer(browser, 'empty-mobile-390x844', { width: 390, height: 844 }, scores, false);
  const mode = workbenchUrl.startsWith('file:') ? 'standalone' : 'public';
  await writeFile(`qa-artifacts/${mode}-results.json`, JSON.stringify({ workbenchUrl, playerUrl, verifiedAt: new Date().toISOString(), desktop, mobile, emptyDesktop, emptyMobile }, null, 2) + '\n');
} finally {
  await browser.close();
}
console.log(`KAOPU Mammal R06 browser QA passed: ${workbenchUrl}`);
