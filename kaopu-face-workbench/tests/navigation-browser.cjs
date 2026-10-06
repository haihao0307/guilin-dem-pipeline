/* DOM navigation only. Run against the real overview and face directories served
 * from the same repository root; CI sparse-checkout must include both directories.
 * FACE_BROWSER=chromium|webkit FACE_URL=http://127.0.0.1:8000/kaopu-face-workbench/
 * node tests/navigation-browser.cjs
 * Runtime requests are aborted before any bundle or GNM model can download.
 * This test does not validate rendering, numerical results, or real-device behavior.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('/opt/codex/cua_node/lib/node_modules/playwright'); }

const engine = process.env.FACE_BROWSER || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'FACE_BROWSER must be chromium or webkit');
const input = new URL(process.env.FACE_URL || 'http://127.0.0.1:8000/kaopu-face-workbench/');
assert.ok(['http:', 'https:'].includes(input.protocol), 'FACE_URL must use HTTP or HTTPS');
assert.match(input.pathname, /\/kaopu-face-workbench\/(?:index\.html|r01\.html)?$/,
  'FACE_URL must identify the face directory, index.html, or r01.html');
const faceBase = new URL('./', input);
const overviewURL = new URL('../kaopu-human-overview/', faceBase).href;
const runtimePath = new URL('runtime/', faceBase).pathname;
const output = process.env.FACE_NAVIGATION_QA_DIR || '.';
const filenames=(process.env.FACE_NAVIGATION_PAGES||'index.html,r01.html').split(',');
assert.ok(filenames.length>0&&filenames.every(name=>['index.html','r01.html'].includes(name)),'FACE_NAVIGATION_PAGES must contain index.html and/or r01.html');
const report = {
  engine, faceBase: faceBase.href, overviewURL, filenames, passed: false,
  scope: 'Actual HTML links and inline shell/history navigation, with runtime fetches aborted',
  realOverviewRequired: true, runtimeAndModelTested: false, actualDeviceTested: false,
  cases: [], documents: [], blockedRequests: [], pageErrors: [], nonGetRequests: [], screenshots: [],
};
let modelRequests = 0;
const heavyResponses = [];

function isHeavy(url) {
  const u = new URL(url);
  return (u.origin === faceBase.origin && u.pathname.startsWith(runtimePath)) ||
    /\/gnm_head_web\.bin$/.test(u.pathname) || /\.(?:wasm|task)$/.test(u.pathname);
}

async function fresh(browser, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 }, serviceWorkers: 'block', ...options,
  });
  await context.route('**/*', async route => {
    const request = route.request();
    if (isHeavy(request.url())) {
      report.blockedRequests.push({ url: request.url(), type: request.resourceType() });
      if (/\/gnm_head_web\.bin(?:\?|$)/.test(request.url())) modelRequests++;
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => report.pageErrors.push({ url: page.url(), message: error.message }));
  page.on('request', request => {
    if (request.method() !== 'GET') report.nonGetRequests.push({ url: request.url(), method: request.method() });
  });
  page.on('response', response => {
    if (isHeavy(response.url())) heavyResponses.push(response.url());
    if (response.request().resourceType() === 'document') {
      report.documents.push({ url: response.url(), status: response.status(), mime: response.headers()['content-type'] || '' });
    }
  });
  return { context, page };
}

function sameTab(page) {
  assert.equal(page.context().pages().length, 1, 'Navigation must stay in the same tab');
}

async function gotoDocument(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.ok(response, 'Expected an actual HTML document response: ' + url);
  assert.equal(response.status(), 200, url);
  assert.match(response.headers()['content-type'] || '', /text\/html/i, url);
  assert.equal(page.url(), url, 'Unexpected redirect');
  sameTab(page);
}

async function overview(page) {
  await page.waitForURL(overviewURL, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.title(), 'KAOPU · 统一创作工作台');
  await page.locator('#title').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#gnm a.card-link').count(), 1, 'Must use the real overview GNM card');
  sameTab(page);
}

async function returnLinks(page) {
  for (const id of ['home', 'workbench']) {
    const link = page.locator('#' + id + ' a[data-overview-return]');
    assert.equal(await link.count(), 1, 'One ordinary overview anchor is required in #' + id);
    const value = await link.evaluate(a => ({
      raw: a.getAttribute('href'), resolved: a.href, target: a.getAttribute('target'),
      onclick: a.getAttribute('onclick'), download: a.hasAttribute('download'), label: a.textContent.trim(),
    }));
    assert.equal(value.raw, '../kaopu-human-overview/');
    assert.equal(value.resolved, overviewURL, 'Return link must resolve to the real overview');
    assert.ok(value.target === null || value.target === '_self');
    assert.equal(value.onclick, null, 'Return must not depend on an inline JavaScript handler');
    assert.equal(value.download, false);
    assert.match(value.label, /返回总工作台/);
  }
  assert.match(await page.locator('#back').textContent(), /返回捏脸入口/);
}

async function faceShell(page, expectedURL) {
  await page.waitForURL(expectedURL, { waitUntil: 'domcontentloaded' });
  const editing = new URL(expectedURL).hash === '#edit';
  await page.locator(editing ? '#workbench' : '#home').waitFor({ state: 'visible' });
  assert.equal(await page.locator(editing ? '#home' : '#workbench').isVisible(), false);
  await returnLinks(page);
  if (editing) {
    await page.waitForFunction(() => window.faceBoot && window.faceBoot.phase === 'failed');
    assert.equal(await page.evaluate(() => window.faceBoot.errorCode), 'DOWNLOAD_FAILED',
      'Editing must use the real inline shell with its runtime request deliberately aborted');
  }
  assert.deepEqual(await page.evaluate(() => ({
    execCount: window.faceBoot && window.faceBoot.execCount,
    ready: window.faceBoot && window.faceBoot.ready,
    modelAPI: typeof window.faceWorkbench,
  })), { execCount: 0, ready: false, modelAPI: 'undefined' });
  sameTab(page);
}

async function clickTo(page, locator, target, keyboard = false) {
  if (keyboard) await locator.focus();
  await Promise.all([
    page.waitForURL(target, { waitUntil: 'domcontentloaded' }),
    keyboard ? page.keyboard.press('Enter') : locator.click(),
  ]);
  sameTab(page);
}

async function historyTo(page, direction, target) {
  const length = await page.evaluate(() => history.length);
  await page[direction]({ waitUntil: 'domcontentloaded' });
  await page.waitForURL(target, { waitUntil: 'domcontentloaded' });
  if (target === overviewURL) await overview(page);
  else await faceShell(page, target);
  assert.equal(await page.evaluate(() => history.length), length,
    'Back/Forward must traverse existing entries without adding a navigation loop');
}

(async () => {
  const browser = await playwright[engine].launch(engine === 'webkit'
    ? { headless: true }
    : { headless: true, executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  report.version = browser.version();
  fs.mkdirSync(output, { recursive: true });
  try {
    // Follow the unmodified, real overview card, including its query and #edit.
    {
      const { context, page } = await fresh(browser);
      try {
        await gotoDocument(page, overviewURL);
        await overview(page);
        const card = page.locator('#gnm a.card-link');
        const entry = await card.evaluate(a => ({ href: a.href, raw: a.getAttribute('href'), target: a.target }));
        const destination = new URL(entry.href);
        assert.equal(destination.origin, faceBase.origin);
        assert.ok([faceBase.pathname, new URL('index.html', faceBase).pathname].includes(destination.pathname));
        assert.equal(destination.hash, '#edit');
        assert.ok(!entry.target || entry.target === '_self');
        report.overviewFaceLink = entry;
        await clickTo(page, card, entry.href, true);
        await faceShell(page, entry.href);
        await historyTo(page, 'goBack', overviewURL);
        await historyTo(page, 'goForward', entry.href);
        await clickTo(page, page.locator('#workbench a[data-overview-return]'), overviewURL);
        await overview(page);
        await historyTo(page, 'goBack', entry.href);
        await historyTo(page, 'goForward', overviewURL);
        await page.screenshot({path:path.join(output,'navigation-overview-returned.png'),fullPage:false});report.screenshots.push('navigation-overview-returned.png');
        report.cases.push('Real overview card → face editor → overview; same tab, keyboard, Back/Forward');
      } finally { await context.close(); }
    }

    for (const filename of filenames) {
      const url = new URL(filename, faceBase).href;
      // Fresh, direct URLs have no overview referrer or prior overview history.
      for (const hash of ['', '#edit']) {
        const { context, page } = await fresh(browser);
        try {
          const direct = url + hash;
          await gotoDocument(page, direct);
          assert.equal(await page.evaluate(() => document.referrer), '');
          await faceShell(page, direct);
          await clickTo(page, page.locator((hash ? '#workbench' : '#home') + ' a[data-overview-return]'), overviewURL);
          await overview(page);
          await historyTo(page, 'goBack', direct);
          await historyTo(page, 'goForward', overviewURL);
          report.cases.push(filename + hash + ': direct entry → overview, Back/Forward without a loop');
        } finally { await context.close(); }
      }

      {
        const { context, page } = await fresh(browser);
        try {
          await gotoDocument(page, url);
          await faceShell(page, url);
          const screenshot='navigation-'+filename.replace('.html','')+'-home.png';await page.screenshot({path:path.join(output,screenshot),fullPage:false});report.screenshots.push(screenshot);
          await clickTo(page, page.locator('#enter'), url + '#edit');
          await faceShell(page, url + '#edit');
          await clickTo(page, page.locator('#back'), url + '#home');
          await faceShell(page, url + '#home');
          await clickTo(page, page.locator('#enter'), url + '#edit');
          await faceShell(page, url + '#edit');
          await clickTo(page, page.locator('#workbench a[data-overview-return]'), overviewURL);
          await overview(page);
          await historyTo(page, 'goBack', url + '#edit');
          await historyTo(page, 'goBack', url + '#home');
          await historyTo(page, 'goForward', url + '#edit');
          await historyTo(page, 'goForward', overviewURL);
          report.cases.push(filename + ': enter, return to face introduction, re-enter, overview, hash/document history');
        } finally { await context.close(); }
      }

      {
        const { context, page } = await fresh(browser, { javaScriptEnabled: false });
        try {
          await gotoDocument(page, url);
          await returnLinks(page);
          await clickTo(page, page.locator('#home a[data-overview-return]'), overviewURL, true);
          await overview(page);
          report.cases.push(filename + ': ordinary home return link works with JavaScript disabled');
        } finally { await context.close(); }
      }
    }
    assert.ok(report.blockedRequests.some(r => new URL(r.url).pathname.startsWith(runtimePath)), 'Runtime interception was exercised');
    assert.equal(modelRequests, 0, 'No GNM request should even start when the runtime is blocked');
    assert.deepEqual(heavyResponses, [], 'No runtime/model response may download in navigation-only QA');
    assert.deepEqual(report.nonGetRequests, []);
    assert.deepEqual(report.pageErrors, []);
    for (const document of report.documents) {
      assert.equal(document.status, 200, document.url);
      assert.match(document.mime, /text\/html/i, document.url);
    }
    report.gnmRequests = modelRequests;
    report.heavyResponses = heavyResponses;
    report.passed = true;
  } finally {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'navigation-' + engine + '-result.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
