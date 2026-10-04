const fs = require('node:fs');
const path = require('node:path');

// Run against an already initialized page in a hasTouch:true Chromium context.
// These are real browser input events in Chromium emulation, not iPhone hardware QA.
module.exports = async function mobileCameraQA(page, out, externalCheck) {
  const result = {
    passed: false,
    device: 'Chromium viewport/touch emulation; not a real iPhone or Safari test',
    checks: [], screenshots: [], layouts: [], camera: {},
  };
  const initialViewport = page.viewportSize();
  const initialState = await page.evaluate(() => gnmStudy.getState());
  const initialCamera = await page.evaluate(() => gnmStudy.getDiagnostics().camera);
  let cdp;
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  const radius = c => distance(c.position, c.target);
  const unchangedCamera = (a, b, epsilon = 1e-7) =>
    distance(a.position, b.position) < epsilon && distance(a.target, b.target) < epsilon && Math.abs(a.zoom - b.zoom) < epsilon;
  async function check(name, passed, detail) {
    result.checks.push({name, passed: !!passed, detail});
    if (externalCheck) await externalCheck('r5 ' + name, !!passed, detail);
    if (!passed) throw Error('r5 ' + name + ': ' + JSON.stringify(detail));
  }
  const camera = () => page.evaluate(() => gnmStudy.getDiagnostics().camera);
  const geometry = () => page.evaluate(() => gnmStudy.getPositions());
  const geometryEquals = values => page.evaluate(before => {
    const after = gnmStudy.getPositions();
    return after.length === before.length && after.every((v, i) => v === before[i]);
  }, values);
  async function frame() {
    return page.evaluate(() => {
      gnmStudy.render();
      const canvas = document.querySelector('#canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let hash = 2166136261;
      for (let i = 0; i < pixels.length; i += 16) hash = Math.imul(hash ^ pixels[i] ^ pixels[i + 1] ^ pixels[i + 2], 16777619);
      return {hash: hash >>> 0, glError: gl.getError(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight};
    });
  }
  async function settle() {
    // Damping must finish before a pause/reset assertion. Do not freeze to make it pass.
    let previous = await camera(), stable = 0;
    const until = Date.now() + 12000;
    while (Date.now() < until) {
      await page.waitForTimeout(120);
      const current = await camera();
      stable = unchangedCamera(previous, current, 1e-8) ? stable + 1 : 0;
      if (stable === 3) return current;
      previous = current;
    }
    throw Error('Camera did not settle within 12 seconds with automatic rotation paused');
  }
  async function screenshot(name, locator) {
    const file = name + '.png';
    if (locator) await locator.screenshot({path: path.join(out, file)});
    else await page.screenshot({path: path.join(out, file), fullPage: false});
    result.screenshots.push(file);
  }
  async function top() {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(80);
  }
  async function canvasPoint() {
    await top();
    const box = await page.locator('#canvas').boundingBox();
    return {x: box.x + box.width / 2, y: box.y + box.height / 2};
  }
  async function touch(type, points) {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, id) => ({id, x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: 1})),
    });
  }
  async function gesture(from, to) {
    await touch('touchStart', from);
    for (let step = 1; step <= 12; step++) {
      await touch('touchMove', from.map((p, i) => ({x: p.x + (to[i].x - p.x) * step / 12, y: p.y + (to[i].y - p.y) * step / 12})));
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', []);
  }
  fs.mkdirSync(out, {recursive: true});
  try {
    await page.evaluate(() => {
      gnmStudy.freeze();
      window.__gnmR5InputAudit = {starts: [], touchMoves: 0, trustedTouchMoves: 0};
      const canvas = document.querySelector('#canvas');
      const start = event => {
        const record = {type: event.pointerType, trusted: event.isTrusted, before: gnmStudy.getDiagnostics().camera};
        window.__gnmR5InputAudit.starts.push(record);
      };
      // Registered after OrbitControls' bubble listener; a queued microtask
      // could run between native event listeners and sample too early.
      const started = () => { window.__gnmR5InputAudit.starts.at(-1).after = gnmStudy.getDiagnostics().camera; };
      const move = event => {
        if (event.pointerType === 'touch') {
          window.__gnmR5InputAudit.touchMoves++;
          if (event.isTrusted) window.__gnmR5InputAudit.trustedTouchMoves++;
        }
      };
      canvas.addEventListener('pointerdown', start, true);
      canvas.addEventListener('pointerdown', started);
      canvas.addEventListener('pointermove', move, true);
      window.__gnmR5RemoveInputAudit = () => {
        canvas.removeEventListener('pointerdown', start, true);
        canvas.removeEventListener('pointerdown', started);
        canvas.removeEventListener('pointermove', move, true);
        delete window.__gnmR5InputAudit;
        delete window.__gnmR5RemoveInputAudit;
      };
    });
    await page.setViewportSize({width: 1440, height: 1000});
    await page.evaluate(() => gnmStudy.setCamera('three'));
    await settle();
    const originalGeometry = await geometry();
    const originalFrame = await frame();
    const originalCamera = await camera();
    await page.locator('#autoRotate').click();
    await page.waitForFunction(before => {
      const current = gnmStudy.getDiagnostics().camera;
      return current.autoRotate && Math.hypot(...current.position.map((v, i) => v - before.position[i])) > before.fitDistance * .015;
    }, originalCamera, {timeout: 8000});
    const rotatingCamera = await camera(), rotatingFrame = await frame();
    await check('play rotates camera and rendered pixels without changing model geometry',
      rotatingCamera.autoRotate && rotatingFrame.hash !== originalFrame.hash && rotatingFrame.glError === 0 && await geometryEquals(originalGeometry),
      {before: originalCamera, after: rotatingCamera, pixels: [originalFrame.hash, rotatingFrame.hash]});
    await check('camera rotation does not start expression animation',
      await page.evaluate(() => !gnmStudy.getDiagnostics().expressionAnimating));
    await page.locator('[data-quick-expression="smile_wide"]').click();
    const expressionGeometry = await geometry();
    await check('expression button changes model while camera rotation keeps playing',
      (await camera()).autoRotate && !await geometryEquals(originalGeometry));
    await page.locator('#autoRotate').click();
    const paused = await settle(), pausedFrame = await frame();
    await page.waitForTimeout(350);
    const pausedLater = await camera(), pausedFrameLater = await frame();
    await check('pause keeps camera and pixels stable and preserves expression',
      !pausedLater.autoRotate && unchangedCamera(paused, pausedLater) && pausedFrame.hash === pausedFrameLater.hash && await geometryEquals(expressionGeometry),
      {paused, later: pausedLater, pixels: [pausedFrame.hash, pausedFrameLater.hash]});

    // Capture the same pointerdown event before and after the app listener to
    // distinguish a reset jump from time spent waiting for protocol round trips.
    await page.locator('#autoRotate').click();
    const mouseStart = await canvasPoint();
    await page.mouse.move(mouseStart.x, mouseStart.y);
    await page.mouse.down();
    const handoff = await page.evaluate(() => window.__gnmR5InputAudit.starts.at(-1));
    await check('native mouse drag pauses rotation at the current angle without a jump',
      handoff.trusted && handoff.type === 'mouse' && handoff.before.autoRotate && !handoff.after.autoRotate && unchangedCamera(handoff.before, handoff.after, 1e-10), handoff);
    const dragFrameBefore = await frame();
    await page.mouse.move(mouseStart.x + 110, mouseStart.y + 35, {steps: 12});
    await page.mouse.up();
    const dragged = await settle(), dragFrameAfter = await frame();
    await check('native mouse drag visibly orbits and leaves exact model geometry intact',
      distance(handoff.after.position, dragged.position) > dragged.fitDistance * .03 && dragFrameBefore.hash !== dragFrameAfter.hash && await geometryEquals(expressionGeometry),
      {before: handoff.after, after: dragged, pixels: [dragFrameBefore.hash, dragFrameAfter.hash]});
    result.camera.desktop = {rotating: rotatingCamera, paused: pausedLater, handoff, dragged};

    const expressionState = await page.evaluate(() => gnmStudy.getState());
    await page.locator('[data-tab="sample"]').click();
    await page.getByRole('button', {name: '播放表情渐变', exact: true}).click();
    await page.waitForTimeout(250);
    await check('expression animation runs while camera rotation is paused',
      await page.evaluate(() => gnmStudy.getDiagnostics().expressionAnimating && !gnmStudy.getDiagnostics().camera.autoRotate) &&
      !await geometryEquals(expressionGeometry));
    await page.locator('#autoRotate').click();
    await check('camera play preserves a running expression animation',
      await page.evaluate(() => gnmStudy.getDiagnostics().expressionAnimating && gnmStudy.getDiagnostics().camera.autoRotate));
    await page.locator('#autoRotate').click();
    await check('camera pause preserves a running expression animation',
      await page.evaluate(() => gnmStudy.getDiagnostics().expressionAnimating && !gnmStudy.getDiagnostics().camera.autoRotate));
    await page.evaluate(saved => gnmStudy.setState(saved), expressionState);
    await check('expression animation check restores exact expression geometry', await geometryEquals(expressionGeometry));

    for (const viewport of [{width: 390, height: 844}, {width: 390, height: 664}, {width: 710, height: 1240}]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => { gnmStudy.freeze(); gnmStudy.setCamera('three'); });
      await top();
      await settle();
      const layout = await page.evaluate(() => {
        const rect = element => {
          const r = element.getBoundingClientRect();
          return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
        };
        const canvas = rect(document.querySelector('#canvas'));
        const controls = [...document.querySelectorAll('button, #panel input, #panel select')]
          .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
          .map(element => ({name: element.id || element.textContent.trim() || element.getAttribute('aria-label'), ...rect(element)}));
        const overlaps = controls.filter(r => r.left < canvas.right && r.right > canvas.left && r.top < canvas.bottom - .5 && r.bottom > canvas.top + .5);
        return {viewport: {width: innerWidth, height: innerHeight}, canvas, deck: rect(document.querySelector('#controlDeck')),
          overlaps, controlCount: controls.length, scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight, viewportMeta: document.querySelector('meta[name="viewport"]').content};
      });
      result.layouts.push(layout);
      await check(`all normal controls stay outside canvas at ${viewport.width}x${viewport.height}`,
        layout.overlaps.length === 0 && layout.deck.top >= layout.canvas.bottom - .5 && layout.controlCount >= 16, layout);
      await check(`mobile page scrolls vertically without horizontal overflow at ${viewport.width}x${viewport.height}`,
        layout.scrollWidth <= viewport.width && layout.scrollHeight > viewport.height && layout.viewportMeta.includes('viewport-fit=cover'), layout);
      const prefix = `r5-mobile-${viewport.width}x${viewport.height}`;
      await screenshot(prefix + '-first-screen');
      await screenshot(prefix + '-controls', page.locator('#controlDeck'));
      await page.locator('#import').scrollIntoViewIfNeeded();
      await check(`bottom controls can be reached at ${viewport.width}x${viewport.height}`, await page.locator('#import').evaluate(element => {
        const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return r.top >= 0 && r.bottom <= innerHeight && (hit === element || element.contains(hit)) && scrollY > 0;
      }));
    }
    await check('canvas responds to reduced mobile browser viewport height',
      result.layouts[0].canvas.height > result.layouts[1].canvas.height + 100,
      result.layouts.slice(0, 2).map(x => ({viewport: x.viewport, canvasHeight: x.canvas.height})));

    await page.setViewportSize({width: 390, height: 844});
    await page.locator('#cameraReset').tap();
    await settle();
    const zoomStart = await camera(), zoomSteps = [zoomStart.zoom];
    const zoomStartFrame = await frame();
    for (let expected = 2; expected <= 6; expected++) {
      await page.locator('#zoomIn').tap();
      const actual = await camera();
      zoomSteps.push(actual.zoom);
      await check(`native plus tap sets ${expected * 100}% lens zoom`, actual.zoom === expected, actual);
    }
    const maximumZoom = await camera(), maximumZoomFrame = await frame();
    await check('600% is projection zoom with unchanged safe camera distance',
      Math.abs(radius(maximumZoom) - radius(zoomStart)) < 1e-8 && distance(maximumZoom.position, zoomStart.position) < 1e-8 &&
      distance(maximumZoom.target, zoomStart.target) < 1e-8 && maximumZoom.fitDistance === zoomStart.fitDistance &&
      maximumZoomFrame.hash !== zoomStartFrame.hash && maximumZoomFrame.glError === 0 && await geometryEquals(expressionGeometry),
      {start: zoomStart, maximum: maximumZoom, distances: [radius(zoomStart), radius(maximumZoom)]});
    await check('plus disables at 600%', await page.locator('#zoomIn').isDisabled());
    await screenshot('r5-mobile-600-percent-canvas', page.locator('#canvas'));
    for (let expected = 5; expected >= 1; expected--) {
      await page.locator('#zoomOut').tap();
      const actual = await camera();
      zoomSteps.push(actual.zoom);
      await check(`native minus tap sets ${expected * 100}% lens zoom`, actual.zoom === expected, actual);
    }
    await check('minus disables at 100% and original projection returns',
      await page.locator('#zoomOut').isDisabled() && unchangedCamera(zoomStart, await camera()) && (await frame()).hash === zoomStartFrame.hash);
    result.camera.zoom = {steps: zoomSteps, start: zoomStart, maximum: maximumZoom};

    cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    await top();
    // The deck's right padding is outside both the canvas and its buttons.
    // A swipe here must scroll the document instead of being swallowed by orbit.
    await gesture([{x: 385, y: 810}], [{x: 385, y: 640}]);
    await page.waitForTimeout(150);
    await check('native touch swipe outside canvas scrolls the mobile page', await page.evaluate(() => scrollY > 50),
      await page.evaluate(() => ({scrollY, viewportHeight: innerHeight})));
    let p = await canvasPoint();
    await page.evaluate(() => gnmStudy.setAutoRotate(true));
    const touchBefore = await camera();
    await gesture([{x: p.x - 45, y: p.y}], [{x: p.x + 45, y: p.y + 25}]);
    const touchDragged = await settle();
    await check('native one-finger drag rotates the camera and pauses automatic rotation',
      !touchDragged.autoRotate && distance(touchDragged.position, touchBefore.position) > touchBefore.fitDistance * .03 && await geometryEquals(expressionGeometry),
      {before: touchBefore, after: touchDragged});
    await page.locator('#cameraReset').tap();
    await settle();
    p = await canvasPoint();
    const pinchBefore = await camera(), pinchFrameBefore = await frame();
    await gesture([{x: p.x - 32, y: p.y}, {x: p.x + 32, y: p.y}], [{x: p.x - 100, y: p.y}, {x: p.x + 100, y: p.y}]);
    const pinchAfter = await settle(), pinchFrameAfter = await frame();
    await check('native two-finger spread increases real camera.zoom and changes pixels',
      pinchAfter.zoom > pinchBefore.zoom * 1.5 && pinchAfter.zoom <= 6 && Math.abs(radius(pinchAfter) - radius(pinchBefore)) < 1e-7 &&
      pinchFrameAfter.hash !== pinchFrameBefore.hash && pinchFrameAfter.glError === 0 && await geometryEquals(expressionGeometry),
      {before: pinchBefore, after: pinchAfter, pixels: [pinchFrameBefore.hash, pinchFrameAfter.hash]});
    await gesture([{x: p.x - 100, y: p.y}, {x: p.x + 100, y: p.y}], [{x: p.x - 32, y: p.y}, {x: p.x + 32, y: p.y}]);
    const pinchedBack = await settle();
    await check('native two-finger pinch decreases zoom within 100–600%',
      pinchedBack.zoom < pinchAfter.zoom - .5 && pinchedBack.zoom >= 1, {before: pinchAfter.zoom, after: pinchedBack.zoom});
    await page.locator('#cameraReset').tap();
    await page.locator('#zoomIn').tap();
    await page.locator('#zoomIn').tap();
    await settle();
    p = await canvasPoint();
    const panBefore = await camera();
    await gesture([{x: p.x - 40, y: p.y}, {x: p.x + 40, y: p.y}], [{x: p.x - 12, y: p.y + 24}, {x: p.x + 68, y: p.y + 24}]);
    const panAfter = await settle();
    await check('native two-finger pan moves target and camera together without zoom drift',
      distance(panBefore.target, panAfter.target) > panBefore.fitDistance * .005 &&
      Math.abs(radius(panBefore) - radius(panAfter)) < 1e-7 && Math.abs(panBefore.zoom - panAfter.zoom) < .03 &&
      distance(panBefore.position.map((v, i) => v - panBefore.target[i]), panAfter.position.map((v, i) => v - panAfter.target[i])) < 1e-7 &&
      await geometryEquals(expressionGeometry), {before: panBefore, after: panAfter});
    const inputAudit = await page.evaluate(() => window.__gnmR5InputAudit);
    await check('touch coverage uses trusted browser pointer events',
      inputAudit.touchMoves > 20 && inputAudit.touchMoves === inputAudit.trustedTouchMoves && inputAudit.starts.some(x => x.type === 'touch' && x.trusted),
      {touchMoves: inputAudit.touchMoves, trustedTouchMoves: inputAudit.trustedTouchMoves});
    await page.locator('#cameraReset').tap();
    const resetCamera = await settle();
    await check('native reset returns fitted 100% camera and keeps current expression',
      resetCamera.zoom === 1 && !resetCamera.autoRotate && unchangedCamera(resetCamera, zoomStart, 1e-6) && await geometryEquals(expressionGeometry), resetCamera);
    p = await canvasPoint();
    await gesture([{x: p.x - 35, y: p.y}], [{x: p.x + 55, y: p.y + 30}]);
    // Deliberately reset before damping settles, as a person often does.
    await page.locator('#cameraReset').tap();
    const immediateReset = await camera(), settledReset = await settle();
    await check('reset during drag inertia clears old motion and stays at the fitted pose',
      unchangedCamera(immediateReset, zoomStart, 1e-6) && unchangedCamera(settledReset, zoomStart, 1e-6) &&
      unchangedCamera(immediateReset, settledReset, 1e-7), {immediate: immediateReset, settled: settledReset, fitted: zoomStart});
    result.camera.touch = {oneFinger: touchDragged, pinch: pinchAfter, pinchedBack, pan: panAfter, reset: resetCamera, immediateReset, settledReset};
    result.passed = true;
    return result;
  } catch (error) {
    result.error = error.stack || String(error);
    try { await screenshot('r5-mobile-camera-failure'); } catch {}
    throw error;
  } finally {
    let restorationError;
    try { if (cdp) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []}); await cdp.detach(); } } catch {}
    try {
      await page.mouse.up();
      await page.evaluate(saved => { gnmStudy.freeze(); gnmStudy.setState(saved); window.__gnmR5RemoveInputAudit?.(); }, initialState);
      if (initialViewport) await page.setViewportSize(initialViewport);
      await page.evaluate(saved => { gnmStudy.setCamera(saved.view || 'three'); gnmStudy.setZoom(saved.zoom); gnmStudy.setAutoRotate(saved.autoRotate); }, initialCamera);
      await top();
    } catch (error) { result.restoreError = error.message; result.passed = false; restorationError = error; }
    fs.writeFileSync(path.join(out, 'r5-mobile-camera.json'), JSON.stringify(result, null, 2));
    if (restorationError && !result.error) throw restorationError;
  }
};
