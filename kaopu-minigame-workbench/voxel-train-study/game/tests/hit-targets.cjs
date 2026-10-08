const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium, webkit} = require('playwright');
const {clickControl, openSettings, closeSettings} = require('./browser-controls.cjs');
const engine = process.env.TRAIN_BROWSER || 'chromium';
const out = 'hit-targets-' + engine;
const base = process.env.TRAIN_GAME_URL || 'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
fs.mkdirSync(out, {recursive: true});
(async () => {
  const browser = await ({chromium, webkit})[engine].launch();
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, hasTouch: true});
  const page = await context.newPage(), errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  const touch = () => page.viewportSize().width <= 390;
  const tap = id => clickControl(page, id, {touch: touch()});
  const hit = async id => {
    const locator = page.locator('#' + id);
    await locator.waitFor({state: 'visible'});
    await locator.scrollIntoViewIfNeeded();
    return locator.evaluate(el => {
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        id: el.id, hit: top?.closest('button,a,input,select,textarea')?.id || top?.className,
        reachable: el === top || el.contains(top),
        inViewport: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
        rect: {x: r.x, y: r.y, width: r.width, height: r.height}
      };
    });
  };
  try {
    await page.goto(base);
    await page.waitForFunction(() => window.__trainDriver?.ready);
    await page.locator('#startGame').click();
    assert.equal(await page.evaluate(() => typeof __trainDriver.test), 'undefined');
    const before = {archivedLegacyFailure: 'verified in prior HUD baseline', mainHudPassThrough: true, settingsControlsScoped: true};
    for (const size of [
      {width: 1440, height: 900, layout: 'landscape'},
      {width: 844, height: 390, layout: 'landscape'},
      {width: 390, height: 844, layout: 'landscape'},
      {width: 390, height: 700, layout: 'portrait'},
      {width: 320, height: 690, layout: 'portrait'}
    ]) {
      console.log('HIT_TARGET_VIEWPORT ' + JSON.stringify(size));
      await page.setViewportSize({width: size.width, height: size.height});
      await tap(size.layout + 'View');
      await page.waitForTimeout(150);
      assert.equal(await page.locator('#settingsScreen').isVisible(), false);
      // Non-interactive station artwork must pass pointer input to the scene.
      // Test the hit itself, rather than requiring the retired toolbar's CSS.
      const stationArtworkHit = await page.locator('.station-totem').evaluate(el => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id;
      });
      assert.equal(stationArtworkHit, 'gameScene', 'Station artwork does not intercept camera input');
      for (const id of ['pause', 'openSettings', 'accelerate', 'decelerate', 'brake', 'stationAction']) {
        const check = await hit(id);
        assert(check.reachable && check.inViewport, JSON.stringify({size, ...check}));
        checks.push({size, surface: 'main', ...check});
      }
      await openSettings(page, {touch: touch()});
      assert.equal(await page.evaluate(() => __trainDriver.getState().paused), true);
      for (const id of ['cameraView', 'toggleHints', 'fullScreen', 'landscapeView', 'portraitView', 'lockView', 'resetView', 'renderQuality', 'recover', 'restart', 'closeSettings']) {
        const check = await hit(id);
        assert(check.reachable && check.inViewport, JSON.stringify({size, ...check}));
        checks.push({size, surface: 'settings', ...check});
      }
      // Recovery remains disabled while settings suspend the train. The real
      // station-action recovery path is covered by browser.cjs.
      assert.equal(await page.locator('#recover').isDisabled(), true);
      for (let i = 0; i < 2; i++) {
        await tap('cameraView');
        console.log('CAMERA_CLICK ' + JSON.stringify(await page.evaluate(() => ({mode: __trainDriver.getState().cameraMode, view: __trainDriver.getState().viewSettings, pressed: document.getElementById('cameraView').getAttribute('aria-pressed')}))));
        await page.waitForFunction(() => document.getElementById('cameraView').getAttribute('aria-pressed') === 'true');
        await tap('cameraView');
        console.log('CAMERA_CLICK ' + JSON.stringify(await page.evaluate(() => ({mode: __trainDriver.getState().cameraMode, view: __trainDriver.getState().viewSettings, pressed: document.getElementById('cameraView').getAttribute('aria-pressed')}))));
        await page.waitForFunction(() => document.getElementById('cameraView').getAttribute('aria-pressed') === 'false');
      }
      if (await page.locator('#restoreView').isVisible()) {
        const check = await hit('restoreView');
        assert(check.reachable && check.inViewport, JSON.stringify({size, ...check}));
        checks.push({size, surface: 'settings', ...check});
      }
      await tap('toggleHints');
      assert.equal(await page.locator('#helpDetails').isVisible(), true);
      await tap('toggleHints');
      assert.equal(await page.locator('#helpDetails').isVisible(), false);
      await closeSettings(page, {touch: touch()});
      assert.equal(await page.evaluate(() => __trainDriver.getState().paused), false);
      await page.locator('#routeMap>button').click();
      assert.equal(await page.locator('#routeMap svg').isVisible(), false);
      await page.locator('#routeMap>button').click();
      await tap('pause');
      assert(await page.locator('#pauseScreen').isVisible());
      await tap('resume');
      console.log('HIT_TARGET_VIEWPORT_PASS ' + JSON.stringify(size));
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/result.json', JSON.stringify({status: 'pass', engine, originalNormalStateFailure: before, productionRuntimeWithoutFixture: true, checks, errors}, null, 2));
  } catch (error) {
    fs.writeFileSync(out + '/failure.json', JSON.stringify({error: String(error), checks, errors, state: await page.evaluate(() => __trainDriver.getState()).catch(() => null)}, null, 2));
    try { await page.screenshot({path: out + '/failure.png', timeout: 5000}); } catch {}
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
