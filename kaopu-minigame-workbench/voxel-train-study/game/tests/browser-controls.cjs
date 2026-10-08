const assert = require('node:assert/strict');

// Exercise the same settings entry and controls as a player. In particular, do
// not reveal hidden elements or dispatch synthetic clicks to bypass the dialog.
async function activate(locator, {touch = false} = {}) {
  await locator.waitFor({state: 'visible'});
  await locator.scrollIntoViewIfNeeded();
  const center = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {id: el.id, x, y, width: r.width, height: r.height, reachable: el === hit || el.contains(hit), viewport: [innerWidth, innerHeight]};
  });
  assert(center.width > 0 && center.height > 0 && center.x >= 0 && center.y >= 0 && center.x < center.viewport[0] && center.y < center.viewport[1], 'Offscreen control: ' + center.id);
  assert(center.reachable, 'Another element intercepts control: ' + center.id);
  if (touch) await locator.tap();
  else await locator.click();
}

async function openSettings(page, {touch = false} = {}) {
  if (await page.locator('#settingsScreen').isVisible()) return false;
  await activate(page.locator('#openSettings'), {touch});
  await page.locator('#settingsScreen').waitFor({state: 'visible'});
  return true;
}

async function closeSettings(page, {touch = false} = {}) {
  if (!await page.locator('#settingsScreen').isVisible()) return false;
  await activate(page.locator('#closeSettings'), {touch});
  await page.locator('#settingsScreen').waitFor({state: 'hidden'});
  return true;
}

async function clickControl(page, id, {touch = false, close = true} = {}) {
  const target = page.locator('#' + id);
  const insideSettings = await target.evaluate(el => !!el.closest('#settingsScreen'));
  const before = insideSettings ? await page.evaluate(() => {
    const v = window.__trainDriver?.getState?.();
    return v ? {started: v.started, paused: v.paused, phase: v.phase} : null;
  }) : null;
  const opened = insideSettings ? await openSettings(page, {touch}) : false;
  await activate(target, {touch});
  if (opened && close) {
    await closeSettings(page, {touch});
    if (before?.started && before.phase !== 'summary' && id !== 'restart') {
      const afterPaused = await page.evaluate(() => __trainDriver.getState().paused);
      assert.equal(afterPaused, before.paused, id + ': settings preserve the prior pause state');
    }
  }
}

module.exports = {clickControl, openSettings, closeSettings};
