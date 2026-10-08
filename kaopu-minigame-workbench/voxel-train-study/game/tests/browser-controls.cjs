const assert = require('node:assert/strict');

// Read actual viewport and clipping geometry without waiting for renderer frames.
// Only scroll when a scrollable ancestor currently clips the full target frame.
async function controlGeometry(locator) {
  return locator.evaluate(el => {
    const contains = (outer, inner, tolerance = 0) => inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
    const clips = [];
    let canScroll = false;
    // Body/root overflow propagates to the viewport; an absolutely positioned,
    // rotated game can leave body's layout box at zero height without clipping.
    for (let parent = el.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX + ' ' + style.overflowY)) clips.push(parent);
      if (/(auto|scroll)/.test(style.overflowX + ' ' + style.overflowY) && (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth)) canScroll = true;
    }
    const measure = () => {
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      const clipBounds = clips.map(parent => {
        const b = parent.getBoundingClientRect();
        return {id: parent.id || parent.className, left: b.left, top: b.top, right: b.right, bottom: b.bottom, contains: contains(b, r)};
      });
      return {
        id: el.id, x, y, width: r.width, height: r.height,
        rect: {x: r.x, y: r.y, width: r.width, height: r.height},
        viewport: [innerWidth, innerHeight],
        inViewport: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
        // Keep the pre-existing one-CSS-pixel viewport tolerance for transformed
        // bounds; actual scrollport clipping and center hit testing stay exact.
        fullBoundsInViewport: contains({left: 0, top: 0, right: innerWidth, bottom: innerHeight}, r, 1),
        fullBoundsInClip: clipBounds.every(b => b.contains), clipBounds,
        reachable: el === hit || el.contains(hit),
        hit: hit?.closest('button,a,input,select,textarea')?.id || hit?.id || hit?.className,
        disabled: el.matches(':disabled') || !!el.closest('button:disabled,[aria-disabled="true"]'),
        inert: !!el.closest('[inert]')
      };
    };
    let geometry = measure(), scrolled = false;
    if (canScroll && (!geometry.fullBoundsInViewport || !geometry.fullBoundsInClip)) {
      el.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
      scrolled = true;
      geometry = measure();
    }
    return {...geometry, scrolled};
  });
}

function assertControlGeometry(geometry) {
  assert(geometry.width > 0 && geometry.height > 0 && geometry.inViewport, 'Offscreen control: ' + JSON.stringify(geometry));
  assert(geometry.fullBoundsInViewport && geometry.fullBoundsInClip, 'Clipped control frame: ' + JSON.stringify(geometry));
  assert(geometry.reachable, 'Another element intercepts control: ' + JSON.stringify(geometry));
}

// Native page input avoids two separate animation-frame stability waits in
// locator.scrollIntoViewIfNeeded() and locator.click()/tap(). Geometry, enabled
// state, inert state and hit testing are checked before sending the real input.
async function activate(page, locator, {touch = false} = {}) {
  await locator.waitFor({state: 'visible'});
  let center = await controlGeometry(locator);
  if (center.disabled) {
    assert(center.id, 'Waiting for an enabled control requires its existing ID');
    await page.waitForFunction(id => {
      const el = document.getElementById(id);
      return el && !el.matches(':disabled') && !el.closest('button:disabled,[aria-disabled="true"]');
    }, center.id, {polling: 50});
    center = await controlGeometry(locator);
  }
  assertControlGeometry(center);
  assert(!center.disabled && !center.inert, 'Control is unavailable: ' + JSON.stringify(center));
  if (touch) await page.touchscreen.tap(center.x, center.y);
  else await page.mouse.click(center.x, center.y);
}

async function clickTarget(page, selector, options = {}) {
  await activate(page, page.locator(selector), options);
}

async function openSettings(page, {touch = false} = {}) {
  if (await page.locator('#settingsScreen').isVisible()) return false;
  await activate(page, page.locator('#openSettings'), {touch});
  await page.locator('#settingsScreen').waitFor({state: 'visible'});
  return true;
}

async function closeSettings(page, {touch = false} = {}) {
  if (!await page.locator('#settingsScreen').isVisible()) return false;
  await activate(page, page.locator('#closeSettings'), {touch});
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
  await activate(page, target, {touch});
  if (opened && close) {
    await closeSettings(page, {touch});
    if (before?.started && before.phase !== 'summary' && id !== 'restart') {
      const afterPaused = await page.evaluate(() => __trainDriver.getState().paused);
      assert.equal(afterPaused, before.paused, id + ': settings preserve the prior pause state');
    }
  }
}

module.exports = {clickControl, clickTarget, openSettings, closeSettings, controlGeometry, assertControlGeometry};
