import { chromium } from 'playwright';

const target = process.env.R32_URL || 'http://127.0.0.1:8765/r3-2/';
const failures = [];
const notes = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

async function allowGithack(context) {
  if (target.includes('raw.githack.com')) {
    await context.setExtraHTTPHeaders({ Cookie: '__Http-phish=1' });
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await allowGithack(context);
const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', e => runtimeErrors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') runtimeErrors.push(`console: ${m.text()}`); });

await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => document.querySelector('#terrain')?.dataset.ready === 'true', null, { timeout: 120000 });
assert((await page.title()).includes('R3.2'), 'page title is not R3.2');

await page.waitForFunction(() => document.querySelector('#terrain')?.dataset.seaSurfaceKind === 'demonstration', null, { timeout: 30000 });
const seaInitial = await page.evaluate(() => {
  const c = document.querySelector('#terrain');
  return {
    kind: c?.dataset.seaSurfaceKind,
    visible: c?.dataset.seaVisible,
    datumM: Number(c?.dataset.seaDisplayDatumM),
    amplitudeM: Number(c?.dataset.seaWaveAmplitudeM),
    checkbox: document.querySelector('#show-sea')?.checked
  };
});
assert(seaInitial.kind === 'demonstration', `sea kind ${JSON.stringify(seaInitial)}`);
assert(seaInitial.visible === 'true' && seaInitial.checkbox === true, `sea not initially visible ${JSON.stringify(seaInitial)}`);
assert(seaInitial.datumM === 0, `sea display datum changed ${JSON.stringify(seaInitial)}`);
assert(Math.abs(seaInitial.amplitudeM - 0.22) < 1e-6, `sea wave amplitude changed ${JSON.stringify(seaInitial)}`);
const seaOnPixels = await page.locator('#terrain').screenshot();
await page.uncheck('#show-sea');
await page.waitForFunction(() => document.querySelector('#terrain')?.dataset.seaVisible === 'false');
await page.waitForTimeout(100);
const seaOffPixels = await page.locator('#terrain').screenshot();
assert(!seaOnPixels.equals(seaOffPixels), 'sea toggle changed state but did not change rendered WebGL pixels');
await page.check('#show-sea');
await page.waitForFunction(() => document.querySelector('#terrain')?.dataset.seaVisible === 'true');
await page.waitForTimeout(100);
const seaRestoredPixels = await page.locator('#terrain').screenshot();
assert(!seaRestoredPixels.equals(seaOffPixels), 'restored sea did not change rendered WebGL pixels');

const contract = await page.evaluate(async () => {
  const r = await fetch(new URL('../r3-1/data/terrain.json', location.href));
  if (!r.ok) throw new Error(`terrain.json ${r.status}`);
  return r.json();
});
const riverPatches = [...new Set((contract.hydrography?.riverFocus || []).map(v => v.patch))];
const patches = [...new Set(['overview', 'mountains', ...riverPatches])];
let successfulMoves = 0;

async function selectPatch(id) {
  await page.selectOption('#location', id);
  await page.waitForFunction(expected => {
    const c = document.querySelector('#terrain');
    return c?.dataset.ready === 'true' && c?.dataset.patch === expected;
  }, id, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#terrain')?.dataset.seaSurfaceKind === 'demonstration');
  assert((await page.getAttribute('#terrain', 'data-sea-visible')) === 'true', `${id}: sea layer disappeared after patch change`);
}

async function enterEyeAndCheck(id) {
  await selectPatch(id);
  if ((await page.getAttribute('#eye-view', 'aria-pressed')) === 'true') await page.click('#eye-view');
  await page.click('#eye-view');
  await page.waitForFunction(() => document.querySelector('#eye-view')?.getAttribute('aria-pressed') === 'true');
  await page.waitForFunction(() => {
    const raw = document.querySelector('#terrain')?.dataset.eyeHeightM;
    if (raw === undefined || raw === '') return false;
    return Number.isFinite(Number(raw));
  });
  const h0 = Number(await page.getAttribute('#terrain', 'data-eye-height-m'));
  assert(Math.abs(h0 - 1.6) <= 0.002, `${id}: eye height before movement = ${h0}`);

  const before = await page.getAttribute('#terrain', 'data-camera');
  await page.locator('#terrain').focus();
  await page.keyboard.press('w');
  await page.waitForTimeout(150);
  const h1 = Number(await page.getAttribute('#terrain', 'data-eye-height-m'));
  const after = await page.getAttribute('#terrain', 'data-camera');
  assert(Number.isFinite(h1) && Math.abs(h1 - 1.6) <= 0.002, `${id}: eye height after movement = ${h1}`);
  if (before !== after) successfulMoves++;
  notes.push({ patch: id, h0, h1, moved: before !== after, status: await page.textContent('#eye-status') });

  await page.keyboard.press('r');
  await page.waitForFunction(() => document.querySelector('#eye-view')?.getAttribute('aria-pressed') === 'false');
  assert((await page.getAttribute('#terrain', 'data-eye-height-m')) === '', `${id}: reset did not clear eye height`);
}

for (const id of patches) await enterEyeAndCheck(id);
assert(successfulMoves > 0, 'no tested patch allowed a valid near-ground move');
assert(runtimeErrors.length === 0, `runtime errors: ${runtimeErrors.join(' | ')}`);

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
await allowGithack(mobileContext);
const mobile = await mobileContext.newPage();
const mobileErrors = [];
mobile.on('pageerror', e => mobileErrors.push(e.message));
mobile.on('console', m => { if (m.type() === 'error') mobileErrors.push(m.text()); });
await mobile.goto(target, { waitUntil: 'domcontentloaded', timeout: 120000 });
await mobile.waitForFunction(() => document.querySelector('#terrain')?.dataset.ready === 'true', null, { timeout: 120000 });
await mobile.waitForFunction(() => document.querySelector('#terrain')?.dataset.seaSurfaceKind === 'demonstration', null, { timeout: 30000 });
const mobileLayout = await mobile.evaluate(() => {
  const eye = document.querySelector('#eye-view')?.getBoundingClientRect();
  const controls = document.querySelector('.camera-controls')?.getBoundingClientRect();
  const sea = document.querySelector('#show-sea')?.getBoundingClientRect();
  return {
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    eyeInside: !!eye && eye.left >= 0 && eye.right <= innerWidth,
    controlsInside: !!controls && controls.left >= 0 && controls.right <= innerWidth,
    seaControlInside: !!sea && sea.left >= 0 && sea.right <= innerWidth,
    seaKind: document.querySelector('#terrain')?.dataset.seaSurfaceKind,
    seaVisible: document.querySelector('#terrain')?.dataset.seaVisible
  };
});
assert(mobileLayout.scrollWidth <= mobileLayout.innerWidth, `mobile horizontal overflow ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.eyeInside && mobileLayout.controlsInside && mobileLayout.seaControlInside, `mobile controls outside viewport ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.seaKind === 'demonstration' && mobileLayout.seaVisible === 'true', `mobile sea missing ${JSON.stringify(mobileLayout)}`);
assert(mobileErrors.length === 0, `mobile runtime errors: ${mobileErrors.join(' | ')}`);

console.log(JSON.stringify({ passed: failures.length === 0, target, patches, successfulMoves, seaInitial, seaPixelToggleVerified: !seaOnPixels.equals(seaOffPixels) && !seaRestoredPixels.equals(seaOffPixels), notes, mobileLayout, runtimeErrors, mobileErrors, failures }, null, 2));
await mobileContext.close();
await context.close();
await browser.close();
if (failures.length) process.exit(1);
