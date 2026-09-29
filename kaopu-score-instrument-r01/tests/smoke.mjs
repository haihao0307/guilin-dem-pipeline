import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const targetUrl = process.env.TARGET_URL;
if (!targetUrl) throw new Error('TARGET_URL is required');

await mkdir('qa-artifacts', { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function integerText(value) {
  return Number(String(value ?? '').replace(/[^0-9]/g, ''));
}

async function verifyViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const dependencyRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
  });
  page.on('request', (request) => {
    if (request.resourceType() !== 'document' && !request.url().startsWith('data:')) {
      dependencyRequests.push(`${request.resourceType()} ${request.url()}`);
    }
  });

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'load', timeout: 120_000 });
    if (!targetUrl.startsWith('file:')) assert(response?.ok(), `${name}: public URL returned ${response?.status()}`);

    await page.waitForSelector('#viewport canvas', { state: 'visible', timeout: 30_000 });
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 30_000 });

    const title = await page.title();
    assert(title === 'KAOPU · Score Instrument R01', `${name}: wrong title ${title}`);

    const canvas = page.locator('#viewport canvas');
    const canvasBox = await canvas.boundingBox();
    assert(canvasBox && canvasBox.width > 200 && canvasBox.height > 200, `${name}: canvas is not visibly sized`);

    const initialObjects = integerText(await page.locator('#objects').textContent());
    const initialTriangles = integerText(await page.locator('#triangles').textContent());
    const initialScoreBytes = integerText(await page.locator('#bytes').textContent());
    const instrumentBytes = Number(await page.locator('meta[name="kaopu-instrument-bytes"]').getAttribute('content'));
    assert(initialObjects > 0, `${name}: no objects were generated`);
    assert(initialTriangles > 0, `${name}: no triangles were generated`);
    assert(initialScoreBytes > 0, `${name}: score byte count is empty`);
    assert(instrumentBytes > 100_000, `${name}: instrument byte ledger is not credible`);
    assert((await page.locator('#network').textContent())?.trim() === '0', `${name}: required network metric is not zero`);

    const presetButtons = page.locator('[data-score]');
    const presetCount = await presetButtons.count();
    assert(presetCount >= 9, `${name}: expected at least 9 score presets`);

    for (let index = 0; index < presetCount; index += 1) {
      await presetButtons.nth(index).click();
      await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 15_000 });
      const status = await page.locator('#status').textContent();
      assert(!status?.includes('未执行'), `${name}: preset ${index + 1} failed: ${status}`);
    }

    await presetButtons.first().click();
    const firstHash = (await page.locator('#hash').textContent())?.trim();
    await presetButtons.nth(1).click();
    await presetButtons.first().click();
    const replayHash = (await page.locator('#hash').textContent())?.trim();
    assert(firstHash && firstHash === replayHash, `${name}: identical score did not retain deterministic hash`);

    await page.locator('#score').fill('K1|A4,1{s.2#e7b34e};b.5,.8,.5#6ea870');
    await page.locator('#play').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 15_000 });
    const customObjects = integerText(await page.locator('#objects').textContent());
    assert(customObjects === 5, `${name}: expected 5 objects from custom score, got ${customObjects}`);

    const beforeDrag = await page.locator('#hash').textContent();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.36, { steps: 8 });
      await page.mouse.up();
      await page.mouse.wheel(0, -240);
    }
    await page.locator('#camera').click();
    assert((await page.locator('#hash').textContent()) === beforeDrag, `${name}: camera interaction changed object identity`);

    await page.locator('#score').fill('K1|A0,1{s.2}');
    await page.locator('#play').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('谱子未执行'), null, { timeout: 15_000 });

    assert(dependencyRequests.length === 0, `${name}: standalone page made dependency requests:\n${dependencyRequests.join('\n')}`);
    assert(pageErrors.length === 0, `${name}: page errors:\n${pageErrors.join('\n')}`);
    assert(consoleErrors.length === 0, `${name}: console errors:\n${consoleErrors.join('\n')}`);
    assert(failedRequests.length === 0, `${name}: failed requests:\n${failedRequests.join('\n')}`);

    await page.screenshot({ path: `qa-artifacts/${name}.png`, fullPage: true });
  } catch (error) {
    const status = (await page.locator('#status').count())
      ? await page.locator('#status').textContent({ timeout: 1_000 }).catch(() => 'unreadable')
      : 'missing';
    console.error(`${name} diagnostics:`);
    console.error(JSON.stringify({ consoleErrors, pageErrors, failedRequests, dependencyRequests }, null, 2));
    console.error(`Current page URL: ${page.url()}`);
    console.error(`Current status: ${status}`);
    await page.screenshot({ path: `qa-artifacts/${name}-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});

try {
  await verifyViewport(browser, 'desktop-1440x900', { width: 1440, height: 900 });
  await verifyViewport(browser, 'mobile-390x844', { width: 390, height: 844 });
} finally {
  await browser.close();
}

console.log(`KAOPU Score Instrument browser QA passed: ${targetUrl}`);
