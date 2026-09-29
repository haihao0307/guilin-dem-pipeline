import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

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
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('request', (request) => {
    const url = request.url();
    if (request.resourceType() !== 'document' && !url.startsWith('data:') && !url.startsWith('blob:')) {
      dependencyRequests.push(`${request.resourceType()} ${url}`);
    }
  });

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'load', timeout: 120_000 });
    if (!targetUrl.startsWith('file:')) assert(response?.ok(), `${name}: public URL returned ${response?.status()}`);
    await page.waitForSelector('#viewport canvas', { state: 'visible', timeout: 45_000 });
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 45_000 });
    await page.waitForFunction(() => window.__KAOPU_R02__?.state().frames > 5, null, { timeout: 30_000 });

    assert(await page.title() === 'KAOPU · Spatial Score Instrument R02', `${name}: wrong title`);
    const canvas = page.locator('#viewport canvas');
    const canvasBox = await canvas.boundingBox();
    assert(canvasBox && canvasBox.width > 250 && canvasBox.height > 250, `${name}: canvas is not visibly sized`);

    const initial = await page.evaluate(() => ({
      metrics: window.__KAOPU_R02__.metrics(),
      state: window.__KAOPU_R02__.state(),
      bounds: window.__KAOPU_R02__.bounds(),
      score: window.__KAOPU_R02__.fullScore,
      metas: {
        instrument: Number(document.querySelector('meta[name="kaopu-instrument-file-bytes"]').content),
        core: Number(document.querySelector('meta[name="kaopu-instrument-core-bytes"]').content),
        workbench: Number(document.querySelector('meta[name="kaopu-workbench-bytes"]').content)
      }
    }));
    assert(initial.metrics.bytes === 1012, `${name}: default score should be 1012 bytes, got ${initial.metrics.bytes}`);
    assert(initial.metrics.objects === 259, `${name}: default score should produce 259 objects, got ${initial.metrics.objects}`);
    assert(initial.metrics.triangles > 200_000, `${name}: complex composition triangle count is unexpectedly low`);
    assert(initial.state.calls > 150, `${name}: renderer did not draw the spatial composition`);
    assert(initial.state.renderedTriangles > 200_000, `${name}: renderer triangle telemetry is unexpectedly low`);
    assert(initial.bounds.max[0] - initial.bounds.min[0] > 12, `${name}: X span is too small`);
    assert(initial.bounds.max[2] - initial.bounds.min[2] > 12, `${name}: Z span is too small`);
    assert(initial.bounds.max[1] - initial.bounds.min[1] > 5, `${name}: Y span is too small`);
    assert(initial.metas.instrument > 400_000, `${name}: standalone instrument byte ledger is not credible`);
    assert(initial.metas.core > 10_000 && initial.metas.core < initial.metas.instrument, `${name}: core-source byte ledger is invalid`);
    assert(initial.metas.workbench > initial.metas.instrument, `${name}: workbench byte ledger is invalid`);
    assert(initial.state.instrumentBytes === initial.metas.instrument, `${name}: embedded instrument does not match byte ledger`);
    assert(integerText(await page.locator('#objects').textContent()) === 259, `${name}: UI object ledger mismatch`);

    await page.locator('#verify').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('重演校验通过'), null, { timeout: 45_000 });

    const presetButtons = page.locator('[data-score-key]');
    const presetCount = await presetButtons.count();
    assert(presetCount === 7, `${name}: expected 7 spatial score views`);
    for (let index = 0; index < presetCount; index += 1) {
      await presetButtons.nth(index).click();
      await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 30_000 });
      const metrics = await page.evaluate(() => window.__KAOPU_R02__.metrics());
      assert(metrics.objects > 0, `${name}: preset ${index + 1} generated no geometry`);
      assert(!String(await page.locator('#status').textContent()).includes('未执行'), `${name}: preset ${index + 1} failed`);
    }

    await page.locator('[data-score-key="full"]').click();
    const fullHash = (await page.locator('#hash').textContent())?.trim();
    await page.locator('[data-score-key="core"]').click();
    await page.locator('[data-score-key="full"]').click();
    const replayHash = (await page.locator('#hash').textContent())?.trim();
    assert(fullHash && fullHash === replayHash, `${name}: full spatial score did not replay to the same output hash`);

    await page.locator('#score').fill('K2|G@0,1,0{A6,1.2,0,90{b.15,.8,.15};H8,.6,1.6,1{s.08}}');
    await page.locator('#play').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('演奏完成'), null, { timeout: 30_000 });
    const custom = await page.evaluate(() => window.__KAOPU_R02__.metrics());
    assert(custom.objects === 14, `${name}: custom group score should generate 14 objects, got ${custom.objects}`);

    await page.locator('#score').fill('K2|b');
    await page.locator('#play').click();
    const shortHash = (await page.locator('#hash').textContent())?.trim();
    await page.locator('#score').fill('K2|b1,1,1');
    await page.locator('#play').click();
    const explicitHash = (await page.locator('#hash').textContent())?.trim();
    assert(shortHash === explicitHash, `${name}: equivalent scores produced different actual-output hashes`);

    const hashBeforeCamera = explicitHash;
    const cameraBefore = await page.evaluate(() => window.__KAOPU_R02__.state().camera);
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    const box = await canvas.boundingBox();
    assert(box && box.width > 250 && box.height > 250, `${name}: canvas unavailable for camera interaction`);
    assert(box.y < viewport.height && box.y + box.height > 0, `${name}: canvas remained outside the viewport`);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.34, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(120);
    const cameraAfter = await page.evaluate(() => window.__KAOPU_R02__.state().camera);
    assert(JSON.stringify(cameraBefore) !== JSON.stringify(cameraAfter), `${name}: camera interaction did not move`);
    assert((await page.locator('#hash').textContent())?.trim() === hashBeforeCamera, `${name}: camera movement changed object identity`);
    await page.locator('#camera').click();

    const objectsBeforeError = integerText(await page.locator('#objects').textContent());
    const hashBeforeError = (await page.locator('#hash').textContent())?.trim();
    await page.locator('#score').fill('K2|X2,2,2,1,0,1{s}');
    await page.locator('#play').click();
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('谱子未执行'), null, { timeout: 15_000 });
    assert(integerText(await page.locator('#objects').textContent()) === objectsBeforeError, `${name}: invalid score replaced valid output`);
    assert((await page.locator('#hash').textContent())?.trim() === hashBeforeError, `${name}: invalid score changed output hash`);

    const instrumentDownloadPromise = page.waitForEvent('download');
    await page.locator('#download-instrument').click();
    const instrumentDownload = await instrumentDownloadPromise;
    assert(instrumentDownload.suggestedFilename() === 'KAOPU_INSTRUMENT_K2.js', `${name}: wrong instrument filename`);
    const instrumentPath = await instrumentDownload.path();
    const instrumentFile = await readFile(instrumentPath);
    assert(instrumentFile.length === initial.metas.instrument, `${name}: downloaded instrument byte count mismatch`);
    assert(instrumentFile.includes(Buffer.from('KAOPU_INSTRUMENT_K2')), `${name}: downloaded file is not the instrument`);
    assert(instrumentFile.includes(Buffer.from('globalThis.KAOPUInstrument')), `${name}: downloaded instrument does not expose its API`);

    await page.locator('[data-score-key="full"]').click();
    const scoreDownloadPromise = page.waitForEvent('download');
    await page.locator('#download-score').click();
    const scoreDownload = await scoreDownloadPromise;
    const scorePath = await scoreDownload.path();
    const scoreFile = await readFile(scorePath, 'utf8');
    assert(scoreFile.trim() === initial.score, `${name}: downloaded score does not match the default score`);

    assert(dependencyRequests.length === 0, `${name}: standalone page made dependency requests:\n${dependencyRequests.join('\n')}`);
    assert(pageErrors.length === 0, `${name}: page errors:\n${pageErrors.join('\n')}`);
    assert(consoleErrors.length === 0, `${name}: console errors:\n${consoleErrors.join('\n')}`);
    assert(failedRequests.length === 0, `${name}: failed requests:\n${failedRequests.join('\n')}`);

    await page.screenshot({ path: `qa-artifacts/${name}.png`, fullPage: true });
    return {
      name,
      viewport,
      title: await page.title(),
      defaultMetrics: initial.metrics,
      defaultBounds: initial.bounds,
      instrumentBytes: instrumentFile.length,
      instrumentSha256: createHash('sha256').update(instrumentFile).digest('hex'),
      workbenchBytes: initial.metas.workbench,
      externalRequests: dependencyRequests.length,
      outputReplay: true,
      equivalentScores: true,
      instrumentDownload: true,
      cameraMovement: true,
      errors: []
    };
  } catch (error) {
    const status = (await page.locator('#status').count()) ? await page.locator('#status').textContent().catch(() => 'unreadable') : 'missing';
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

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const results = [];
  results.push(await verifyViewport(browser, 'desktop-1440x900', { width: 1440, height: 900 }));
  results.push(await verifyViewport(browser, 'mobile-390x844', { width: 390, height: 844 }));
  const prefix = targetUrl.startsWith('file:') ? 'standalone' : 'public';
  await writeFile(`qa-artifacts/${prefix}-results.json`, JSON.stringify({ targetUrl, verifiedAt: new Date().toISOString(), results }, null, 2) + '\n');
} finally {
  await browser.close();
}
console.log(`KAOPU Score Instrument R02 browser QA passed: ${targetUrl}`);
