import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const url = arg('--url');
const outDir = arg('--out');
const prefix = arg('--prefix', 'QA');
if (!url || !outDir) {
  throw new Error('usage: node qa_public_browser.mjs --url URL --out DIR [--prefix QA]');
}
fs.mkdirSync(outDir, { recursive: true });

const failures = [];
const pageErrors = [];
const consoleErrors = [];
const requestFailures = [];
const observations = {};

function assert(condition, message, detail = undefined) {
  if (!condition) failures.push({ message, detail });
}

function wire(page, scope) {
  page.on('pageerror', (error) => pageErrors.push({ scope, message: String(error?.stack || error) }));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ scope, message: message.text() });
  });
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || '';
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/i.test(errorText)) {
      requestFailures.push({ scope, url: request.url(), errorText });
    }
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => {
    const state = window.__WZ_FULL__;
    return Boolean(state && state.ready && state.frames > 0 && state.cloudRendered && state.oneCanvas);
  }, null, { timeout: 180_000 });
  await page.waitForTimeout(1400);
}

async function inspectShell(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const release = window.__WZ_RELEASE__ || null;
    const runtime = window.__WZ_FULL__ || null;
    const cloudProfiles = [...new Set([...document.querySelectorAll('#panel [data-weather]')].map((element) => element.dataset.weather).filter(Boolean))];
    return {
      title: document.title,
      release,
      runtime,
      canvasCount: document.querySelectorAll('canvas').length,
      iframeCount: document.querySelectorAll('iframe').length,
      menuVisible: visible('#menuButton'),
      brandVisible: visible('.minimal-brand'),
      toolbarVisible: visible('#touchToolbar'),
      topbarVisible: visible('#topbar'),
      footerVisible: visible('footer'),
      panelVisible: visible('#panel'),
      panelControlCount: document.querySelectorAll('#panel button,#panel select,#panel input').length,
      tabCount: document.querySelectorAll('#panel [data-tab-button]').length,
      cloudProfiles,
      viewButtons: ['home','top','coast','stormView','ground','cloudView','flightView','orbit'].filter((id) => document.getElementById(id)).length,
      worldToggles: ['terrainOn','waterOn','riversOn'].filter((id) => document.getElementById(id)).length,
      weatherControls: ['weatherCase','dateInput','hour','autoWeather','calendarToggle','calendarRate'].filter((id) => document.getElementById(id)).length,
      verticalScale: document.getElementById('verticalScale')?.textContent?.trim() || '',
      canvasWidth: document.querySelector('canvas')?.width || 0,
      canvasHeight: document.querySelector('canvas')?.height || 0,
    };
  });
}

async function openPanel(page, tab = 'view') {
  const panelOpen = await page.locator('#panel').evaluate((element) => element.classList.contains('open'));
  if (!panelOpen) await page.locator('#menuButton').click();
  await page.waitForFunction(() => document.getElementById('panel')?.classList.contains('open'));
  await page.locator(`[data-tab-button="${tab}"]`).click();
  await page.waitForTimeout(120);
}

async function closePanel(page) {
  const panelOpen = await page.locator('#panel').evaluate((element) => element.classList.contains('open'));
  if (panelOpen) await page.locator('#sheetClose').click();
  await page.waitForTimeout(120);
}

async function testCloudProfiles(page, scope) {
  await openPanel(page, 'weather');
  const profiles = ['ci','cc','cs','ac','as','ns','sc','st','cu','cb'];
  const results = [];
  for (const profile of profiles) {
    const button = page.locator(`#panel [data-weather="${profile}"]`).first();
    assert(await button.count() === 1, `${scope}: cloud button missing`, profile);
    if (await button.count() !== 1) continue;
    await button.click();
    await page.waitForTimeout(180);
    const state = await page.evaluate((expected) => ({
      expected,
      selected: document.getElementById('weatherCase')?.value || '',
      bounds: document.getElementById('cloudBounds')?.textContent?.trim() || '',
      thickness: document.getElementById('cloudThickness')?.textContent?.trim() || '',
      envelope: document.getElementById('cloudEnvelope')?.textContent?.trim() || '',
      verticalScale: document.getElementById('verticalScale')?.textContent?.trim() || '',
      runtimeReady: Boolean(window.__WZ_FULL__?.ready),
      cloudRendered: Boolean(window.__WZ_FULL__?.cloudRendered),
    }), profile);
    assert(state.selected === profile, `${scope}: cloud selector did not follow button`, state);
    assert(state.bounds && !/读取中|生成中/.test(state.bounds), `${scope}: cloud bounds unresolved`, state);
    assert(state.thickness && !/读取中|生成中/.test(state.thickness), `${scope}: cloud thickness unresolved`, state);
    assert(state.envelope && !/读取中|生成中/.test(state.envelope), `${scope}: cloud envelope unresolved`, state);
    assert(state.verticalScale.includes('1:1') && state.verticalScale.includes('0 m'), `${scope}: cloud metre lock lost`, state);
    assert(state.runtimeReady && state.cloudRendered, `${scope}: cloud pass stopped`, state);
    results.push(state);
  }
  return results;
}

async function testViews(page, scope) {
  await openPanel(page, 'view');
  const ids = ['home', 'coast', 'flightView', 'cloudView', 'ground'];
  const results = [];
  let previousEye = null;
  for (const id of ids) {
    await page.locator(`#${id}`).click();
    await page.waitForTimeout(id === 'ground' ? 700 : 450);
    const state = await page.evaluate((viewId) => {
      const s = window.__WZ_FULL__ || {};
      return {
        viewId,
        ready: Boolean(s.ready),
        eye: Array.isArray(s.eye) ? [...s.eye] : null,
        target: Array.isArray(s.target) ? [...s.target] : null,
        clearance: s.clearance,
        minClearance: s.minClearance,
        ground: Boolean(s.ground),
        oneCanvas: Boolean(s.oneCanvas),
        sameWebGLContext: Boolean(s.sameWebGLContext),
        sharedDepth: Boolean(s.sharedDepth),
        cloudRendered: Boolean(s.cloudRendered),
      };
    }, id);
    assert(state.ready && state.oneCanvas, `${scope}: view stopped runtime`, state);
    assert(state.sameWebGLContext && state.sharedDepth, `${scope}: shared world/depth relationship lost`, state);
    assert(state.cloudRendered, `${scope}: cloud pass absent in view`, state);
    assert(state.clearance === null || state.clearance >= 1.55, `${scope}: camera entered terrain or water`, state);
    assert(state.minClearance === null || state.minClearance >= 1.5, `${scope}: recorded unsafe camera clearance`, state);
    if (id === 'ground') assert(state.ground, `${scope}: ground mode did not engage`, state);
    if (previousEye && state.eye) {
      const distance = Math.hypot(...state.eye.map((value, index) => value - previousEye[index]));
      assert(distance > 1, `${scope}: view button did not move camera`, { id, distance, state });
    }
    previousEye = state.eye;
    results.push(state);
  }
  await page.locator('#home').click();
  await page.waitForTimeout(450);
  return results;
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 2560, height: 1600 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  wire(page, 'desktop');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitReady(page);
  const initial = await inspectShell(page);
  assert(initial.title.includes('V0.5.9'), 'desktop: wrong release title', initial.title);
  assert(initial.release?.version === 'wenzhou-workbench-0.5.9-full-feature-recovery', 'desktop: release stamp missing', initial.release);
  assert(initial.canvasCount === 1 && initial.iframeCount === 0, 'desktop: scene topology changed', initial);
  assert(initial.menuVisible && !initial.brandVisible && !initial.toolbarVisible && !initial.topbarVisible && !initial.footerVisible, 'desktop: persistent UI is not the single menu button', initial);
  assert(initial.panelControlCount >= 35 && initial.tabCount === 4, 'desktop: full control panel was reduced', initial);
  assert(initial.cloudProfiles.length >= 10, 'desktop: cloud profiles missing', initial.cloudProfiles);
  assert(initial.viewButtons === 8 && initial.worldToggles === 3 && initial.weatherControls === 6, 'desktop: functional controls missing', initial);
  assert(initial.verticalScale.includes('1:1') && initial.verticalScale.includes('0 m'), 'desktop: metre-scale cloud lock missing', initial.verticalScale);
  assert(initial.canvasWidth === 2560 && initial.canvasHeight === 1600, 'desktop: 2560 × 1600 draw buffer not preserved', initial);

  const clouds = await testCloudProfiles(page, 'desktop');
  const views = await testViews(page, 'desktop');
  await closePanel(page);
  await page.screenshot({ path: path.join(outDir, `${prefix}_DESKTOP_2560x1600.png`), fullPage: false });
  await openPanel(page, 'weather');
  await page.screenshot({ path: path.join(outDir, `${prefix}_DESKTOP_MENU_2560x1600.png`), fullPage: false });
  await closePanel(page);
  const final = await inspectShell(page);
  await context.close();
  return { initial, clouds, views, final };
}

async function runMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  wire(page, 'mobile');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitReady(page);
  const initial = await inspectShell(page);
  assert(initial.title.includes('V0.5.9'), 'mobile: wrong release title', initial.title);
  assert(initial.canvasCount === 1 && initial.iframeCount === 0, 'mobile: scene topology changed', initial);
  assert(initial.menuVisible && !initial.brandVisible && !initial.toolbarVisible && !initial.topbarVisible && !initial.footerVisible, 'mobile: persistent UI is not the single menu button', initial);
  assert(initial.panelControlCount >= 35 && initial.cloudProfiles.length >= 10, 'mobile: full controls missing', initial);
  assert(initial.canvasWidth === 780 && initial.canvasHeight === 1688, 'mobile: expected sharp 2× draw buffer missing', initial);

  await page.screenshot({ path: path.join(outDir, `${prefix}_PHONE_390x844.png`), fullPage: false });
  await openPanel(page, 'weather');
  const panelBox = await page.locator('#panel').boundingBox();
  assert(Boolean(panelBox), 'mobile: panel has no layout box');
  if (panelBox) {
    assert(panelBox.x >= -1 && panelBox.y >= -1, 'mobile: panel starts outside viewport', panelBox);
    assert(panelBox.x + panelBox.width <= 391 && panelBox.y + panelBox.height <= 845, 'mobile: panel exceeds viewport', panelBox);
  }
  await page.screenshot({ path: path.join(outDir, `${prefix}_PHONE_MENU_390x844.png`), fullPage: false });
  const clouds = await testCloudProfiles(page, 'mobile');
  await closePanel(page);
  const final = await inspectShell(page);
  await context.close();
  return { initial, panelBox, clouds, final };
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
});

try {
  observations.desktop = await runDesktop(browser);
  observations.mobile = await runMobile(browser);
} finally {
  await browser.close();
}

assert(pageErrors.length === 0, 'page errors detected', pageErrors);
assert(consoleErrors.length === 0, 'console errors detected', consoleErrors);
assert(requestFailures.length === 0, 'resource failures detected', requestFailures);

const report = {
  schema: 'wenzhou_full_feature_recovery_browser_qa@1',
  url,
  checkedAtUtc: new Date().toISOString(),
  prefix,
  observations,
  pageErrors,
  consoleErrors,
  requestFailures,
  failures,
  passed: failures.length === 0,
  shareAllowed: failures.length === 0,
  visualAcceptance: false,
  productionReady: false,
};
fs.writeFileSync(path.join(outDir, `${prefix}_BROWSER_QA.json`), JSON.stringify(report, null, 2));
if (failures.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
