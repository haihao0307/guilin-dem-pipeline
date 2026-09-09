import { chromium } from 'playwright';

const target = process.env.R32_URL || 'http://127.0.0.1:8765/r3-2/';
const failures = [];
const notes = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
if (target.includes('raw.githack.com')) {
  await context.addCookies([{ name: '__Http-phish', value: '1', domain: 'raw.githack.com', path: '/' }]);
}
const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', e => runtimeErrors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') runtimeErrors.push(`console: ${m.text()}`); });

await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => document.querySelector('#terrain')?.dataset.ready === 'true', null, { timeout: 120000 });
assert((await page.title()).includes('R3.2'), 'page title is not R3.2');

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
}

async function enterEyeAndCheck(id) {
  await selectPatch(id);
  if ((await page.getAttribute('#eye-view', 'aria-pressed')) === 'true') await page.click('#eye-view');
  await page.click('#eye-view');
  await page.waitForFunction(() => document.querySelector('#eye-view')?.getAttribute('aria-pressed') === 'true');
  await page.waitForFunction(() => {
    const v = Number(document.querySelector('#terrain')?.dataset.eyeHeightM);
    return Number.isFinite(v);
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

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
const mobileErrors = [];
mobile.on('pageerror', e => mobileErrors.push(e.message));
await mobile.goto(target, { waitUntil: 'domcontentloaded', timeout: 120000 });
await mobile.waitForFunction(() => document.querySelector('#terrain')?.dataset.ready === 'true', null, { timeout: 120000 });
const mobileLayout = await mobile.evaluate(() => {
  const eye = document.querySelector('#eye-view')?.getBoundingClientRect();
  const controls = document.querySelector('.camera-controls')?.getBoundingClientRect();
  return {
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    eyeInside: !!eye && eye.left >= 0 && eye.right <= innerWidth,
    controlsInside: !!controls && controls.left >= 0 && controls.right <= innerWidth
  };
});
assert(mobileLayout.scrollWidth <= mobileLayout.innerWidth, `mobile horizontal overflow ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.eyeInside && mobileLayout.controlsInside, `mobile controls outside viewport ${JSON.stringify(mobileLayout)}`);
assert(mobileErrors.length === 0, `mobile runtime errors: ${mobileErrors.join(' | ')}`);

console.log(JSON.stringify({ passed: failures.length === 0, target, patches, successfulMoves, notes, mobileLayout, runtimeErrors, mobileErrors, failures }, null, 2));
await browser.close();
if (failures.length) process.exit(1);
