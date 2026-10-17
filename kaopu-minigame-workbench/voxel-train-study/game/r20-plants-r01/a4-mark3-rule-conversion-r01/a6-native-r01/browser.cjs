/** Real browser QA is deliberately restricted to the approved GitHub Actions runner. */
if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('CI_ONLY: Run this browser harness in the approved GitHub Actions workflow. It does not open local sockets or browsers in the editing environment.');
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'qa');
fs.mkdirSync(out, {recursive: true});
const forbiddenPattern = /source-assets|fields\.bin|checkpoint-0|generated\/|original-chassis|exact-decoder|residual|\.(?:glb|gltf|obj|stl|fbx|bin)(?:[?#]|$)/i;
(async () => {
  let browser, server;
  const report = {passed: false, errors: [], requests: [], forbiddenRequests: [], failedRequests: [], checks: [], environment: 'Actual GitHub CI Chromium/SwiftShader; desktop and touch-emulated mobile, not a physical iOS device'};
  try {
    server = http.createServer((req, res) => {
      const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      fs.readFile(file, (error, bytes) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('content-type', /\.(mjs|js)$/.test(file) ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
        res.end(bytes);
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
    const page = await browser.newPage({viewport: {width: 1440, height: 1080}, deviceScaleFactor: 1, hasTouch: true});
    await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => {
      report.requests.push(request.url());
      if (forbiddenPattern.test(request.url())) report.forbiddenRequests.push(request.url());
    });
    page.on('requestfailed', request => report.failedRequests.push({url: request.url(), error: request.failure()?.errorText}));
    await page.route('**/*', route => forbiddenPattern.test(route.request().url()) ? route.abort() : route.continue());
    const url = process.env.NATIVE_URL || `http://127.0.0.1:${server.address().port}/a4-mark3-rule-conversion-r01/a6-native-r01/index.html`;
    await page.goto(url);
    async function settle() {
      await page.waitForFunction(() => NATIVE_QA.ready && !NATIVE_QA.busy && !NATIVE_QA.renderPending, null, {timeout: 240000});
      assert.deepEqual(await page.evaluate(() => NATIVE_QA.errors), []);
    }
    async function shot(name) {
      await settle();
      await page.screenshot({path: path.join(out, name + '.png'), fullPage: true, timeout: 120000});
    }
    async function state() {
      await settle();
      return page.evaluate(() => ({
        view: NATIVE_QA.view, free: NATIVE_QA.state.free, focus: NATIVE_QA.state.focus, zoom: NATIVE_QA.state.zoom,
        scales: NATIVE_QA.scales, diameter: NATIVE_QA.wheelDiameter, axes: NATIVE_QA.driveAxisZ,
        params: NATIVE_QA.shellParameters, centres: NATIVE_QA.panels.map(panel => panel.camera.position.toArray()),
        direction: NATIVE_QA.panels.map(panel => panel.camera.quaternion.toArray()), count: NATIVE_QA.nativeComponentCount,
        mechanicalCounts: NATIVE_QA.mechanicalPartCounts, heightMetrics: NATIVE_QA.heightMetrics, baseline: NATIVE_QA.baselineBounds,
        mechanicalIds: NATIVE_QA.mechanicalGroups.map(group => group.uuid), newDesignConnectionParts: NATIVE_QA.newDesignConnectionParts, staticCouplingId: NATIVE_QA.staticCouplingGroup.uuid, staticCouplingVisible: NATIVE_QA.staticCouplingGroup.visible, layout: NATIVE_QA.connectedLayout,
      }));
    }
    async function mechanicalDigest(kind = 'mechanical') {
      return page.evaluate(async kind => {
        const result = [];
        for (const group of kind === 'static-coupling' ? [NATIVE_QA.staticCouplingGroup] : NATIVE_QA.mechanicalGroups) {
          const bytes = [];
          group.traverse(object => {
            if (!object.isMesh) return;
            for (const attribute of Object.values(object.geometry.attributes)) bytes.push(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
            if (object.geometry.index) {
              const array = object.geometry.index.array;
              bytes.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
            }
            bytes.push(new TextEncoder().encode(JSON.stringify({matrix: object.matrixWorld.toArray(), components: object.userData.nativeComponents, rest: object.userData.nativeMaterial})));
          });
          const buffer = new Uint8Array(bytes.reduce((total, array) => total + array.length, 0));
          let offset = 0;
          for (const array of bytes) { buffer.set(array, offset); offset += array.length; }
          result.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))).map(byte => byte.toString(16).padStart(2, '0')).join(''));
        }
        return result;
      }, kind);
    }
    const initial = await state(), digest = await mechanicalDigest(), staticDigest = await mechanicalDigest('static-coupling');
    assert.equal(initial.view, 'side'); assert.equal(initial.free, false); assert.equal(initial.focus, 'train');
    assert.equal(initial.scales.length, 1); assert.equal(initial.diameter, 2.032);
    assert.deepEqual(initial.axes, [3.5814, 5.7912, 8.001]);
    assert.equal(initial.mechanicalCounts.locomotive, 338); assert.equal(initial.mechanicalCounts.coach, 238);
    assert.equal(initial.mechanicalCounts.nativeWheelInstances, 6); assert.equal(initial.mechanicalIds.length, 8);
    assert.equal(initial.layout.coachOffsetZ, 32.34); assert.equal(report.forbiddenRequests.length, 0);
    assert.equal(initial.newDesignConnectionParts, 6); assert.equal(initial.staticCouplingVisible, true);
    assert.equal(await page.evaluate(() => { let count = 0; NATIVE_QA.staticCouplingGroup.traverse(object => { count += object.userData.nativeComponents?.length ?? 0; }); return count; }), 6);
    report.initial = initial; report.initialMechanicalSHA256 = digest; report.initialStaticCouplingSHA256 = staticDigest;
    report.staticCouplingEvidence = await page.evaluate(() => NATIVE_QA.staticCouplingEvidence);
    report.checks.push('One connected scene defaults to whole-train orthographic side view; all 338 + 238 native mechanics and six wheel instances remain present');

    report.projections = {};
    for (const view of ['side', 'front', 'top']) {
      await page.click('#' + view); await settle();
      const values = await page.evaluate(async view => {
        const T = await import('three'), panel = NATIVE_QA.panels[0], values = [];
        for (const depth of [-5, 0, 32.34]) {
          const a = view === 'side' ? new T.Vector3(depth, 0, 0) : view === 'front' ? new T.Vector3(0, 0, depth) : new T.Vector3(0, depth, 0), b = a.clone();
          if (view === 'top') b.x += 2.032; else b.y += 2.032;
          a.project(panel.camera); b.project(panel.camera);
          values.push(Math.hypot((a.x - b.x) * panel.element.clientWidth / 2, (a.y - b.y) * panel.element.clientHeight / 2));
        }
        return values;
      }, view);
      assert(Math.max(...values) - Math.min(...values) < 1e-8);
      report.projections[view] = values; await shot(view);
    }
    report.checks.push('Canonical side/front/top projections have equal pixels per metre at front/back depths');

    await page.evaluate(() => { NATIVE_QA.setView('side'); NATIVE_QA.setZoom(6); NATIVE_QA.setCaptureTarget([0, 1.1, 20.5]); });
    await shot('static-coupling-side-crop');
    await page.click('#side');
    const beforeEdit = await state();
    await page.locator('#commonRoofHeight-value').fill('4.12'); await page.locator('#commonRoofHeight-value').press('Enter');
    await page.waitForFunction(() => !NATIVE_QA.busy && NATIVE_QA.shellParameters.commonRoofHeight === 4.12);
    await page.locator('#cabForwardShift-value').fill('0.12'); await page.locator('#cabForwardShift-value').press('Enter');
    await page.waitForFunction(() => !NATIVE_QA.busy && NATIVE_QA.shellParameters.cabForwardShift === .12);
    const afterEdit = await state();
    assert.deepEqual(afterEdit.scales, beforeEdit.scales); assert.deepEqual(afterEdit.centres, beforeEdit.centres);
    assert.deepEqual(afterEdit.baseline, beforeEdit.baseline); assert.deepEqual(afterEdit.mechanicalIds, initial.mechanicalIds);
    assert.deepEqual(await mechanicalDigest(), digest);
    const crowns = await page.evaluate(() => ({loco: NATIVE_QA.locoParameters.topHeight, tender: NATIVE_QA.tenderParameters.crownHeight, coach: NATIVE_QA.coachParameters.crownHeight, cabShift: NATIVE_QA.locoParameters.cabShift}));
    assert.deepEqual(crowns, {loco: 4.12, tender: 4.12, coach: 4.12, cabShift: -.12});
    for (const metrics of Object.values(afterEdit.heightMetrics)) assert(Math.abs(metrics.bodyCrownM - 4.12) < .001);
    assert(afterEdit.heightMetrics.loco.overallHeightM > afterEdit.heightMetrics.loco.bodyCrownM);
    assert.equal(afterEdit.staticCouplingId, initial.staticCouplingId);
    assert.deepEqual(await mechanicalDigest('static-coupling'), staticDigest);
    report.edited = afterEdit; report.editedCrowns = crowns;
    report.checks.push('Visible controls link all three roof crowns and move the cab slightly forward; no automatic fitting and no mechanical array/world-matrix changes');
    await shot('edited-side');

    await page.evaluate(async () => Promise.all([NATIVE_QA.setShellParameters({commonRoofHeight: 4.01}), NATIVE_QA.setShellParameters({commonRoofHeight: 4.08}), NATIVE_QA.setShellParameters({commonRoofHeight: 4.13, cabForwardShift: -.1})]));
    assert.deepEqual((await state()).params, {commonRoofHeight: 4.13, cabForwardShift: -.1});
    assert.deepEqual(await mechanicalDigest(), digest);
    report.checks.push('Rapid queued linked roof/cab edits commit only the latest request');

    const beforeFocus = await state(); await page.click('#focus-locomotive');
    const afterFocus = await state(); assert.equal(afterFocus.focus, 'locomotive');
    assert.deepEqual(afterFocus.scales, beforeFocus.scales); assert.equal(afterFocus.zoom, beforeFocus.zoom);
    assert.notDeepEqual(afterFocus.centres, beforeFocus.centres); assert.deepEqual(await mechanicalDigest(), digest);
    await page.click('#zoom-in'); assert.equal((await state()).zoom, 1.25);
    report.checks.push('Explicit focus only moves the camera centre; visible zoom buttons separately change magnification');

    await page.click('#free');
    const beforeDrag = await state(), box = await page.locator('#train').boundingBox();
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .55, box.y + box.height * .62, {steps: 8}); await page.mouse.up();
    const afterDrag = await state(); assert.equal(afterDrag.free, true); assert.notDeepEqual(afterDrag.direction, beforeDrag.direction);
    await page.mouse.wheel(0, -200); assert((await state()).zoom > afterDrag.zoom);
    assert.equal(await page.evaluate(() => NATIVE_QA.dimensionAcceptanceMode), false);
    await shot('free-observation'); report.checks.push('Actual pointer orbit and wheel zoom work only with explicit free observation label');

    await page.click('#reset'); const reset = await state();
    assert.deepEqual(reset.params, initial.params); assert.equal(reset.focus, 'train'); assert.equal(reset.zoom, 1);
    assert.deepEqual(reset.scales, initial.scales); assert.deepEqual(await mechanicalDigest(), digest);
    await page.click('#structure'); await shot('structure-side');
    assert.equal(await page.evaluate(() => NATIVE_QA.staticCouplingGroup.visible), true);
    assert.deepEqual(await page.evaluate(() => [...NATIVE_QA.shellGroups, NATIVE_QA.brandingGroup].map(group => group.visible)), [false, false, false, false]);
    await page.click('#structure');
    report.checks.push('Reset and repeated structure toggling preserve frozen mechanics and hide all shells plus branding together');

    await page.evaluate(() => { NATIVE_QA.setFocus('locomotive'); NATIVE_QA.setZoom(2.6); NATIVE_QA.setFreeMode(true); });
    await page.locator('#train').focus();
    for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowDown');
    await shot('locomotive-front-three-quarter');
    await page.evaluate(() => { NATIVE_QA.setView('side'); NATIVE_QA.setFocus('locomotive'); NATIVE_QA.setZoom(6); NATIVE_QA.setCaptureTarget([0, 2.35, 3.1664]); });
    await shot('driver-crop');
    await page.evaluate(() => { NATIVE_QA.setView('front'); NATIVE_QA.setZoom(1); });
    await shot('cab-front');
    await page.click('#reset'); await settle();
    await page.setViewportSize({width: 390, height: 844}); await settle(); await shot('mobile-side');
    await page.click('#focus-locomotive'); await page.evaluate(() => NATIVE_QA.setZoom(4)); await shot('mobile-locomotive-focus');
    await page.click('#free'); await page.locator('#train').scrollIntoViewIfNeeded();
    const mobileBefore = await state(), mobileBox = await page.locator('#train').boundingBox();
    const cdp = await page.context().newCDPSession(page), x = mobileBox.x + mobileBox.width * .5, y = mobileBox.y + mobileBox.height * .5;
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x + 45, y: y + 20, id: 1}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    assert.notDeepEqual((await state()).direction, mobileBefore.direction);
    const pinchBefore = await state();
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: x - 25, y, id: 1}, {x: x + 25, y, id: 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x - 35, y, id: 1}, {x: x + 35, y, id: 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    assert((await state()).zoom > pinchBefore.zoom); await shot('mobile-free');
    report.checks.push('390×844 emulated one-finger orbit and two-finger pinch work in the connected view');
    await page.click('#reset'); report.final = await state(); assert.equal(report.final.free, false);
    assert.deepEqual(await mechanicalDigest(), digest); assert.deepEqual(report.final.mechanicalIds, initial.mechanicalIds);
    report.finalMechanicalSHA256 = await mechanicalDigest();
    assert.equal(report.final.staticCouplingId, initial.staticCouplingId);
    assert.deepEqual(await mechanicalDigest('static-coupling'), staticDigest);
    report.finalStaticCouplingSHA256 = await mechanicalDigest('static-coupling');
    report.checks.push('Six separately identified new static connection parts remain present, visible in structure mode, and byte/world-matrix/object-identical across shell edits; no original mechanic is replaced');

    report.materials = await page.evaluate(() => {
      const materials = new Map(); NATIVE_QA.panels[0].scene.traverse(object => { if (object.isMesh) materials.set(object.material.uuid, object.material); });
      return [...materials.values()].map(material => ({name: material.name, native: !!material.userData.nativeMaster, shaderHookExecuted: material.userData.nativeMaster?.shaderHookExecuted, domain: material.userData.nativeMaster?.domain, a6Instance: material.userData.a6Instance ?? null}));
    });
    assert(report.materials.every(material => material.native));
    report.renderStats = await page.evaluate(() => NATIVE_QA.renderStats);
    assert.equal(report.renderStats.mode, 'webgl2-fence'); assert.equal(report.renderStats.lastGpuCompletionVerified, true);
    assert.equal(report.renderStats.maxFramesInFlight, 1);
    report.network = await page.evaluate(() => {
      const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
      return {count: entries.length, encodedBodyBytes: entries.reduce((n, entry) => n + entry.encodedBodySize, 0), transferBytes: entries.reduce((n, entry) => n + entry.transferSize, 0), entries: entries.map(entry => ({url: entry.name, bytes: entry.encodedBodySize}))};
    });
    assert.equal(report.forbiddenRequests.length, 0); assert.equal(report.failedRequests.length, 0); assert.equal(report.errors.length, 0);
    report.checks.push('All rendered materials use native master factories; one GPU frame maximum in flight; zero source mesh/array/residual requests');
    report.passed = true;
  } catch (error) {
    report.errors.push(error.stack || String(error));
    try { await browser?.contexts()[0]?.pages()[0]?.screenshot({path: path.join(out, 'failure.png'), fullPage: true}); } catch {}
  } finally {
    fs.writeFileSync(path.join(out, 'A6_CONNECTED_QA.json'), JSON.stringify(report, null, 2));
    await browser?.close(); server?.close();
    if (!report.passed) process.exitCode = 1;
  }
})();
