'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Focused automatic-orbit / rabbit-appearance regression helper.
 * Uses caller-owned Chromium; owns and closes separate desktop/touch contexts.
 * No browser launch, dependencies, network setup, or publishing. Callers must
 * assert report.passed; even a throwing check callback leaves failure evidence.
 * Readbacks are real WebGL frames. Input is native Playwright mouse / CDP touch.
 * This supplements (does not replace) mobile-controls and rabbit-controls.
 */
module.exports = async function orbitAppearance(browser, url, outDir, check) {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(), url,
    scope: 'Real WebGL automatic camera motion, native input takeover, rabbit appearance and JSON regressions in isolated Chromium contexts',
    physicalIPhoneTested: false, physicalSafariTested: false,
    visualAcceptance: false, productionReady: false, passed: false,
    tests: [], errors: [], requests: [], requestFailures: [], probes: [], screenshots: [], layouts: [], touchTrace: [],
    desktopContext: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, hasTouch: false, acceptDownloads: true },
    mobileContext: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true }
  };
  const contexts = [];
  let context, page, cdp, activeTouches = 0, phase = 'desktop', currentModule = 'anemone';
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;
  const camera = (module, state) => module === 'anemone' ? state.camera : { angles: state.angles, size: state.size };
  const delta = (module, a, b) => module === 'anemone' ? Math.hypot(a.azimuth - b.azimuth, a.elevation - b.elevation) : Math.hypot(...a.angles.map((v, i) => v - b.angles[i]));
  const sameCamera = (module, a, b) => delta(module, a, b) <= 1e-10 && near(module === 'anemone' ? a.distance : a.size, module === 'anemone' ? b.distance : b.size);
  const rabbitShape = state => Object.fromEntries(Object.entries(state).filter(([key]) => !['angles', 'size', 'maskWidth'].includes(key)));
  const assert = (name, pass, detail) => {
    const test = { name: 'orbit/appearance ' + phase + ': ' + name, pass: Boolean(pass), detail };
    report.tests.push(test);
    if (check) check(test.name, test.pass, detail);
    if (!test.pass) throw Error(test.name + ': ' + JSON.stringify(detail));
  };
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 25000 });
  // Stability is observed over actual delivered RAF opportunities, never a
  // guessed sleep. waitForFunction supplies the finite failure deadline.
  const rafWindow = async (count = 8) => {
    await page.evaluate(count => {
      window.__orbitQaWindow = { count: 0, target: count };
      const tick = () => { if (++window.__orbitQaWindow.count < count) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, count);
    await wait(() => window.__orbitQaWindow.count >= window.__orbitQaWindow.target);
  };
  const snapshot = async name => {
    const file = path.join(outDir, phase + '-' + name + '.jpg');
    await page.screenshot({ path: file, fullPage: false, type:'jpeg',quality:90 });
    report.screenshots.push({ name, phase, path: file });
  };
  const probe = async (module, label, role = 'candidate', canonical = false) => {
    const result = await page.evaluate(({ module, role, canonical }) => {
      const hash = data => { let h = 2166136261; for (const b of data) h = Math.imul(h ^ b, 16777619) >>> 0; return h; };
      const errors = [...(window.anemone?.errors || []), ...(window.platform?.errors || []), ...(window.workbench?.errors || []), ...(window.kuko?.errors || [])];
      if (module === 'anemone') {
        const pixels = anemone.pixels();
        const state = anemone.state, r = anemone.renderer, bytes = new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength);
        return { module, state, orbit: anemone.orbit, frames: anemone.metrics().frames, pointerCount: anemone.pointerCount,
          geometry: { hash: hash(bytes), bytes: bytes.length }, pixels, errors };
      }
      const w = document.getElementById(role + 'Frame').contentWindow, r = w.runtime, c = w.document.getElementById('canvasGL'), gl = w.gl;
      const oldStyle = c.style.cssText;
      try {
        if (canonical) { c.style.width = '600px'; c.style.height = '600px'; r.renderer.resizeCanvas(); }
        r.renderer.drawScene();
        const bytes = new Uint8Array(c.width * c.height * 4);
        gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        const background = Array.from(bytes.slice(0, 3)); let changed = 0;
        for (let i = 0; i < bytes.length; i += 4) if (Math.max(Math.abs(background[0] - bytes[i]), Math.abs(background[1] - bytes[i + 1]), Math.abs(background[2] - bytes[i + 2])) > 12) changed++;
        return { module, role, state: r.state(), host: structuredClone(workbench[role === 'teacher' ? 'baseline' : 'candidate']),
          orbit: r.orbit, hostOrbit: rabbitUI.orbit, frames: r.frameCount, pointerCount: r.pointerCount,
          pixels: { hash: hash(bytes), changed, width: c.width, height: c.height, glError: gl.getError() }, errors };
      } finally { if (canonical) { c.style.cssText = oldStyle; r.requestDraw(); } }
    }, { module, role, canonical });
    report.probes.push({ label, phase, ...result });
    assert(label + ' nonempty real WebGL and GL 0', result.pixels.glError === 0 && result.pixels.changed > 500 && !result.errors.length, { pixels: result.pixels, errors: result.errors });
    return result;
  };
  const normals = async (role, label) => {
    const result = await page.evaluate(role => {
      const w = document.getElementById(role + 'Frame').contentWindow, gl = w.gl, r = w.runtime.renderer, model = r.models.get(r.currentPreset.mesh);
      const previous = gl.getParameter(gl.COPY_READ_BUFFER_BINDING), buffers = {};
      try {
        for (const key of ['bufferNormals', 'bufferCombNormals', 'finBufferNormals', 'finBufferCombedNormals']) {
          gl.bindBuffer(gl.COPY_READ_BUFFER, model[key]);
          const bytes = new Uint8Array(gl.getBufferParameter(gl.COPY_READ_BUFFER, gl.BUFFER_SIZE));
          gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, bytes);
          let hash = 2166136261; for (const b of bytes) hash = Math.imul(hash ^ b, 16777619) >>> 0;
          buffers[key] = { bytes: bytes.length, hash };
        }
      } finally { gl.bindBuffer(gl.COPY_READ_BUFFER, previous); }
      return { buffers, glError: gl.getError() };
    }, role);
    assert(label + ' GPU buffer readback GL 0', result.glError === 0 && Object.values(result.buffers).every(b => b.bytes > 0), result);
    return result.buffers;
  };
  const waitRabbit = async (expected = {}, after = null, role = 'candidate') => wait(({ expected, after, role }) => {
    const r = document.getElementById(role + 'Frame').contentWindow.runtime, state = r.state();
    const host = workbench[role === 'teacher' ? 'baseline' : 'candidate'];
    const matches = actual => Object.entries(expected).every(([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value));
    return matches(state) && matches(host) && (after === null || (r.frameCount > after && workbench.frameStats[role]?.frames >= r.frameCount));
  }, { expected, after, role });
  const waitOrbit = async (module, playing) => wait(({ module, playing }) => {
    if (module === 'anemone') return anemone.orbit.playing === playing;
    const r = document.getElementById('candidateFrame').contentWindow.runtime;
    return rabbitUI.orbit.playing === playing && r.orbit.playing === playing;
  }, { module, playing });
  const button = module => module === 'anemone' ? '#anemoneAutoRotate' : '#autoRotate';
  const startOrbit = async module => {
    await page.locator(button(module)).click(); await waitOrbit(module, true);
    assert(module + ' explicit play has accessible running state', await page.locator(button(module)).getAttribute('aria-pressed') === 'true');
  };
  const waitMotion = async (module, from, minimum = .025) => wait(({ module, from, minimum }) => {
    if (module === 'anemone') return Math.abs(anemone.state.camera.azimuth - from.azimuth) > minimum;
    const s = document.getElementById('candidateFrame').contentWindow.runtime.state();
    return Math.abs(s.angles[1] - from.angles[1]) > minimum;
  }, { module, from, minimum });
  const select = async module => {
    await page.evaluate(async module => { platform.select(module); if (module === 'rabbit') { await workbench.ensureStarted(); await workbench.ensureTeacher(); } }, module); currentModule = module;
    await wait(module => platform.module === module && (module === 'anemone' ? anemone.ready :
      workbench.ready.teacher && workbench.ready.candidate && workbench.frameStats.teacher?.frames >= 2 && workbench.frameStats.candidate?.frames >= 2), module);
    if (module === 'rabbit') {
      await wait(() => window.rabbitUI?.setOrbit && window.rabbitAppearance?.setWidth &&
        ['teacher', 'candidate'].every(role => document.getElementById(role + 'Frame').contentWindow.runtime?.renderer.loaded));
      await waitRabbit(await page.evaluate(() => workbench.candidate));
    }
    await installTrace();
  };
  const center = async module => {
    const locator = module === 'anemone' ? page.locator('#anemoneCanvas') : page.frameLocator('#candidateFrame').locator('#canvasGL');
    const b = await locator.boundingBox();
    if (!b?.width || !b?.height) throw Error(module + ' canvas has no native-input bounds');
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  };
  const waitPointers = async (module, count) => wait(({ module, count }) => (module === 'anemone' ? anemone.pointerCount : document.getElementById('candidateFrame').contentWindow.runtime.pointerCount) === count, { module, count });
  const touch = async (type, points, label) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ radiusX: 5, radiusY: 5, force: 1, ...p })) });
    activeTouches = type === 'touchCancel' || (type === 'touchEnd' && !points.length) ? 0 : points.length;
    report.touchTrace.push({ type, label, points, ...await page.evaluate(() => ({ scrollX, scrollY, scale: visualViewport?.scale || 1 })) });
  };
  const installTrace = async () => page.evaluate(() => {
    window.__orbitQaEvents ||= [];
    for (const module of ['anemone', 'rabbit']) {
      if (module === 'anemone' ? !window.anemone?.ready : !window.workbench?.ready.candidate) continue;
      const w = module === 'anemone' ? window : document.getElementById('candidateFrame').contentWindow;
      const canvas = module === 'anemone' ? anemone.renderer.canvas : w.document.getElementById('canvasGL');
      if (canvas.__orbitQaTraceInstalled) continue;
      canvas.__orbitQaTraceInstalled = true;
      const read = () => module === 'anemone' ? { camera: anemone.state.camera, orbit: anemone.orbit } : { camera: { angles: w.runtime.state().angles, size: w.runtime.state().size }, orbit: w.runtime.orbit };
      // Capture and bubble observe one native event, removing RAF race ambiguity.
      canvas.addEventListener('pointerdown', e => { e.__qaBefore = read(); }, true);
      canvas.addEventListener('pointerdown', e => window.__orbitQaEvents.push({ module, type: e.type, trusted: e.isTrusted, pointerType: e.pointerType, before: e.__qaBefore, after: read() }));
    }
  });
  const assertTakeover = async (module, pointerType) => {
    const events = await page.evaluate(({ module, pointerType }) => window.__orbitQaEvents.filter(e => e.module === module && e.pointerType === pointerType), { module, pointerType });
    const event = [...events].reverse().find(e => e.before.orbit.playing);
    assert(module + ' ' + pointerType + ' pauses orbit in native pointerdown without camera jump', !!event && event.trusted && !event.after.orbit.playing && sameCamera(module, event.before.camera, event.after.camera), event);
  };
  const reset = async (module, expected) => {
    await page.locator(module === 'anemone' ? '#anemoneCamera' : '#resetCamera').click();
    await waitOrbit(module, false);
    if (module === 'rabbit') await waitRabbit({ angles: expected.state.angles, size: expected.state.size });
    const result = await probe(module, module + ' exact camera reset');
    assert(module + ' reset restores exact initial camera and pixels', sameCamera(module, camera(module, expected.state), camera(module, result.state)) && expected.pixels.hash === result.pixels.hash, { before: expected.pixels, after: result.pixels });
    return result;
  };
  const boot = async options => {
    context = await browser.newContext(options); contexts.push(context); page = await context.newPage(); page.setDefaultTimeout(25000);
    const sourcePhase = phase;
    page.on('pageerror', e => report.errors.push({ phase: sourcePhase, message: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ phase: sourcePhase, message: m.text() }); });
    page.on('request', r => { if (!/^(data|blob):/.test(r.url())) report.requests.push(r.url()); });
    page.on('requestfailed', r => report.requestFailures.push({ phase: sourcePhase, url: r.url(), error: r.failure()?.errorText }));
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.platform?.module === 'home' && window.catalogUI, null, { timeout: 120000 });
    await page.evaluate(() => platform.select('anemone'));
    await page.waitForFunction(() => window.anemone?.ready && typeof anemone.setOrbit === 'function', null, { timeout: 120000 });
    await page.evaluate(() => { anemone.pauseOrbit(); anemone.pause(); anemone.seek(0); });
    currentModule = 'anemone'; await installTrace();
    if (phase === 'mobile') cdp = await context.newCDPSession(page);
  };

  try {
    await boot(report.desktopContext);
    const initialAnemone = await probe('anemone', 'initial paused anemone');
    assert('automatic orbit defaults paused at speed .12', !initialAnemone.orbit.playing && near(initialAnemone.orbit.speed, .12), initialAnemone.orbit);
    for (const module of ['anemone', 'rabbit']) {
      await select(module);
      const baseline = module === 'anemone' ? initialAnemone : await probe(module, 'initial paused rabbit');
      const speedSelector = module === 'anemone' ? '#anemoneOrbitSpeed' : '#rabbitOrbitSpeed';
      await page.locator(module === 'anemone' ? '#controlsToggle' : '#rabbitControlsToggle').click();
      await page.locator(speedSelector).selectOption('0.24');
      await page.locator(module === 'anemone' ? '#controlsClose' : '#rabbitControlsClose').click();
      const speedState = await page.evaluate(module => module === 'anemone' ? anemone.orbit : rabbitUI.orbit, module);
      assert(module + ' native speed selector updates paused orbit without starting it', near(speedState.speed, .24) && !speedState.playing, speedState);
      await startOrbit(module); await waitMotion(module, camera(module, baseline.state));
      await page.locator(button(module)).click(); await waitOrbit(module, false);
      const paused = await probe(module, module + ' automatic orbit moved pixels');
      assert(module + ' automatic camera motion changes actual WebGL pixels', delta(module, camera(module, baseline.state), camera(module, paused.state)) > .025 && baseline.pixels.hash !== paused.pixels.hash, { before: camera(module, baseline.state), after: camera(module, paused.state), pixels: [baseline.pixels.hash, paused.pixels.hash] });
      if (module === 'anemone') assert('camera orbit leaves paused water time and geometry unchanged', baseline.state.time === paused.state.time && equal(baseline.geometry, paused.geometry));
      else assert('rabbit orbit preserves original material/shape', equal(rabbitShape(baseline.state), rabbitShape(paused.state)));
      await rafWindow();
      const stable = await probe(module, module + ' explicit pause is stable');
      assert(module + ' explicit pause holds camera and exact pixels across RAF window', !stable.orbit.playing && sameCamera(module, camera(module, paused.state), camera(module, stable.state)) && paused.pixels.hash === stable.pixels.hash);
      assert(module + ' explicit pause accessible state', await page.locator(button(module)).getAttribute('aria-pressed') === 'false');
      await snapshot(module + '-auto-paused');
      await startOrbit(module); await waitMotion(module, camera(module, stable.state));
      const at = await center(module);
      await page.mouse.move(at.x, at.y); await page.mouse.down(); await waitPointers(module, 1); await waitOrbit(module, false);
      await assertTakeover(module, 'mouse');
      const held = await probe(module, module + ' mouse holds current orbit view');
      await page.mouse.move(at.x + 3, at.y + 2); await page.mouse.up(); await waitPointers(module, 0);
      const dragged = await probe(module, module + ' mouse continuation');
      const change = delta(module, camera(module, held.state), camera(module, dragged.state));
      assert(module + ' small native mouse drag continues without stale-angle jump', change > .0001 && change < .12, { change });
      await reset(module, baseline);
      await startOrbit(module); await waitMotion(module, camera(module, baseline.state));
      await select(module === 'anemone' ? 'rabbit' : 'anemone'); await waitOrbit(module, false);
      const stopped = await page.evaluate(module => module === 'anemone' ? anemone.state.camera : document.getElementById('candidateFrame').contentWindow.runtime.state().angles, module);
      await rafWindow();
      assert(module + ' leaving module cancels automatic orbit', equal(stopped, await page.evaluate(module => module === 'anemone' ? anemone.state.camera : document.getElementById('candidateFrame').contentWindow.runtime.state().angles, module)));
      await select(module); await waitOrbit(module, false); await reset(module, baseline);
    }

    await select('anemone');
    await startOrbit('anemone');
    await page.locator('#anemonePause').click();
    await wait(() => !anemone.state.params.paused);
    const flowingTime = await page.evaluate(() => anemone.state.time);
    await wait(time => anemone.state.time > time + .035, flowingTime);
    await page.locator('#anemonePause').click(); await wait(() => anemone.state.params.paused && anemone.orbit.playing);
    const waterPaused = await probe('anemone', 'water paused independently');
    await waitMotion('anemone', waterPaused.state.camera);
    await page.locator('#anemoneAutoRotate').click(); await waitOrbit('anemone', false);
    const orbitAfterWater = await probe('anemone', 'orbit continued after water pause');
    assert('water pause does not stop orbit or alter frozen water geometry', waterPaused.state.time === orbitAfterWater.state.time && equal(waterPaused.geometry, orbitAfterWater.geometry) && waterPaused.pixels.hash !== orbitAfterWater.pixels.hash);
    await page.locator('#anemonePause').click();
    await wait(time => anemone.state.time > time + .035, orbitAfterWater.state.time);
    await page.locator('#anemonePause').click();
    const flowAfterOrbit = await probe('anemone', 'water resumed with orbit paused');
    assert('orbit pause does not stop water flow', !flowAfterOrbit.orbit.playing && sameCamera('anemone', orbitAfterWater.state.camera, flowAfterOrbit.state.camera) && flowAfterOrbit.state.time > orbitAfterWater.state.time && !equal(flowAfterOrbit.geometry, orbitAfterWater.geometry));

    await select('rabbit');
    await page.locator('#resetCamera').click(); await waitRabbit({ angles: [0, 0], size: 1 });
    // Appearance regression retains the exact original single-lamp reference.
    // Default side-light behavior is tested independently by lighting-geometry.
    await page.evaluate(() => objectLighting.set('rabbit', { mode: 'legacy' }));
    await waitRabbit({ lighting: await page.evaluate(() => objectLighting.get('rabbit')) });
    const teacherStart = await probe('rabbit', 'canonical frozen teacher', 'teacher', true);
    const candidateStart = await probe('rabbit', 'canonical default rabbit', 'candidate', true);
    assert('width1 with explicit legacy lights renders exact canonical teacher pixels', candidateStart.state.maskWidth === 1 && equal(rabbitShape(candidateStart.state), rabbitShape(teacherStart.state)) && candidateStart.pixels.hash === teacherStart.pixels.hash && [candidateStart, teacherStart].every(x => x.pixels.width === 600 && x.pixels.height === 600), { teacher: teacherStart.pixels, candidate: candidateStart.pixels });
    const defaultExport = await page.evaluate(() => workbench.exportState());
    const teacherNormals = await normals('teacher', 'frozen teacher baseline');
    // Common appearance now stays on the first screen, outside the drawer.
    const colors = [];
    for (const color of ['cream', 'ivory', 'graphite', 'honey', 'lavender', 'teal']) {
      const before = await page.evaluate(() => document.getElementById('candidateFrame').contentWindow.runtime.frameCount);
      await page.locator('[data-rabbit-color="' + color + '"]').click();
      const expected = await page.evaluate(() => workbench.candidate.furColor); await waitRabbit({ furColor: expected }, before);
      const frame = await probe('rabbit', 'palette ' + color, 'candidate', true);
      colors.push({ color, rgb: frame.state.furColor, hash: frame.pixels.hash });
      assert(color + ' palette preserves canonical teacher state', equal(teacherStart.host, await page.evaluate(() => workbench.baseline)));
    }
    assert('six rabbit colors produce six distinct actual images', new Set(colors.map(c => c.hash)).size === colors.length, colors);
    assert('cream palette preserves exact source RGB precision', equal(colors[0].rgb, [.89, .82, .65]) && colors[0].hash === teacherStart.pixels.hash, colors[0]);
    await page.locator('[data-rabbit-color="cream"]').click(); await waitRabbit({ furColor: [.89, .82, .65] });
    // Native keyboard editing exercises the real range control and input handler.
    const nativeRange = async (selector, presses, label) => {
      const range = page.locator(selector); await range.scrollIntoViewIfNeeded();
      await range.evaluate(el => { el.__orbitQaInputs = []; el.addEventListener('input', e => el.__orbitQaInputs.push({ trusted: e.isTrusted, value: Number(el.value) })); });
      await range.focus(); for (let i = 0; i < presses; i++) await range.press('ArrowRight');
      const result = await range.evaluate(el => ({ value: Number(el.value), events: el.__orbitQaInputs }));
      assert(label + ' uses trusted native range input', result.events.length >= presses && result.events.every(e => e.trusted), result);
      return result.value;
    };
    const width = await nativeRange('#rabbitMaskWidth', 8, 'rabbit hair width');
    await waitRabbit({ maskWidth: width });
    const widened = await probe('rabbit', 'width changes pixels', 'candidate', true);
    assert('width changes true rabbit pixels and preserves all source shape/material fields', width > 1.2 && widened.pixels.hash !== candidateStart.pixels.hash && equal(rabbitShape(widened.state), rabbitShape(candidateStart.state)), { width, pixels: widened.pixels });
    await page.evaluate(() => rabbitAppearance.setWidth(1)); await waitRabbit({ maskWidth: 1 });
    const density = await nativeRange('#rabbitVisualDensity', 10, 'rabbit visual density');
    await waitRabbit(await page.evaluate(() => ({ shellTextureSize: workbench.candidate.shellTextureSize, finTextureSize: workbench.candidate.finTextureSize })));
    const dense = await probe('rabbit', 'density changes pixels', 'candidate', true);
    assert('density controls original shell/fin texture frequencies and changes true pixels', near(dense.state.shellTextureSize, density) && near(dense.state.finTextureSize, .7 * density) && dense.pixels.hash !== candidateStart.pixels.hash && dense.state.maskWidth === 1, { density, state: dense.state, pixels: dense.pixels });
    await page.evaluate(() => rabbitAppearance.setDensity(1)); await waitRabbit({ shellTextureSize: 1, finTextureSize: .7 });
    const appearanceRestored = await probe('rabbit', 'default appearance exact restoration', 'candidate', true);
    const teacherAfter = await probe('rabbit', 'teacher after appearance edits', 'teacher', true);
    assert('appearance edits preserve teacher exact pixels and GPU normals', teacherAfter.pixels.hash === teacherStart.pixels.hash && equal(teacherAfter.state, teacherStart.state) && equal(await normals('teacher', 'teacher after appearance edits'), teacherNormals));
    assert('returning width/density/color to defaults restores exact teacher image', appearanceRestored.pixels.hash === teacherStart.pixels.hash);

    await page.evaluate(() => { rabbitAppearance.setPalette('teal'); rabbitAppearance.setWidth(1.4); rabbitAppearance.setDensity(1.5); });
    await waitRabbit(await page.evaluate(() => workbench.candidate));
    const roundtripFrame = await probe('rabbit', 'edited JSON source', 'candidate', true);
    await page.locator('#rabbitControlsToggle').click();
    const downloadPromise = page.waitForEvent('download'); await page.locator('#exportButton').click();
    const download = await downloadPromise, jsonPath = path.join(outDir, 'rabbit-appearance-v3.json'); await download.saveAs(jsonPath);
    const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert('actual export button writes version3 width/lighting and honest grooming exclusion', exported.version === 3 && exported.lighting.mode === 'legacy' && exported.state.maskWidth === 1.4 && exported.groomingIncluded === false && equal(exported, await page.evaluate(() => workbench.exportState())), exported);
    await page.evaluate(() => { rabbitAppearance.setPalette('graphite'); rabbitAppearance.setWidth(.6); rabbitAppearance.setDensity(.7); });
    await page.locator('#importFile').setInputFiles({ name: 'rabbit-appearance-roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await waitRabbit(exported.state);
    const imported = await probe('rabbit', 'actual v3 JSON import', 'candidate', true);
    assert('actual JSON import restores exact edited state and pixels', imported.pixels.hash === roundtripFrame.pixels.hash && equal(exported, await page.evaluate(() => workbench.exportState())));
    const immediateControls = await page.evaluate(() => ({ width: Number(document.getElementById('rabbitMaskWidth').value), widthNumber: Number(document.getElementById('rabbitMaskWidthNumber').value), density: Number(document.getElementById('rabbitVisualDensity').value) }));
    assert('import synchronizes new appearance controls', near(immediateControls.width, 1.4) && near(immediateControls.widthNumber, 1.4) && near(immediateControls.density, 1.5), immediateControls);
    const legacy = { ...defaultExport, version: 1, state: { ...defaultExport.state } }; delete legacy.state.maskWidth; delete legacy.lighting;
    await page.evaluate(data => workbench.importState(data), legacy); await waitRabbit({ ...legacy.state, maskWidth: 1 });
    const legacyFrame = await probe('rabbit', 'legacy version1 width migration', 'candidate', true);
    assert('legacy JSON missing width migrates to exact source default', legacyFrame.state.maskWidth === 1 && legacyFrame.pixels.hash === teacherStart.pixels.hash && (await page.evaluate(() => workbench.exportState())).version === 3);
    await page.locator('#rabbitControlsClose').click();

    // Confirm a real GPU comb stroke first, then demand bit-exact buffer survival.
    const beforeComb = await normals('candidate', 'candidate before native comb');
    await page.locator('#combButton').click();
    assert('native mode button synchronizes iframe immediately',await page.evaluate(()=>document.getElementById('candidateFrame').contentWindow.runtime.mode==='comb'));
    const combCamera=await page.evaluate(()=>document.getElementById('candidateFrame').contentWindow.runtime.state().angles);
    const combAt = await center('rabbit');
    await page.mouse.move(combAt.x, combAt.y); await page.mouse.down(); await waitPointers('rabbit', 1);
    assert('native comb pointer is truly held in renderer',await page.evaluate(()=>document.getElementById('candidateFrame').contentWindow.runtime.renderer.combing));
    await page.evaluate(()=>document.getElementById('candidateFrame').contentWindow.postMessage({kaopu:true,type:'mode',mode:'comb'},'*'));await rafWindow(2);
    assert('duplicate delayed comb mode keeps held gesture',await page.evaluate(()=>{const r=document.getElementById('candidateFrame').contentWindow.runtime;return r.pointerCount===1&&r.mode==='comb'&&r.renderer.combing}));
    for (let i = 1; i <= 5; i++) { await page.mouse.move(combAt.x + i * 8, combAt.y + i * 3); await rafWindow(2); }
    await page.mouse.up(); await waitPointers('rabbit', 0); await rafWindow(2);
    const combed = await normals('candidate', 'candidate native GPU comb');
    assert('native comb never rotates the camera',equal(combCamera,await page.evaluate(()=>document.getElementById('candidateFrame').contentWindow.runtime.state().angles)));
    assert('native comb really changed GPU grooming normals', !equal(beforeComb.bufferCombNormals, combed.bufferCombNormals) || !equal(beforeComb.finBufferCombedNormals, combed.finBufferCombedNormals), { beforeComb, combed });
    await page.evaluate(() => { rabbitAppearance.setPalette('lavender'); rabbitAppearance.setWidth(1.3); rabbitAppearance.setDensity(1.4); });
    await waitRabbit(await page.evaluate(() => workbench.candidate));
    const groomedMaterial = await probe('rabbit', 'grooming after appearance edits', 'candidate', true);
    assert('color width and density edits preserve all GPU groomed normals exactly', equal(combed, await normals('candidate', 'grooming survives appearance')));
    assert('groomed appearance edits still preserve frozen teacher buffers', equal(teacherNormals, await normals('teacher', 'teacher after grooming')));
    const atomicBefore = await page.evaluate(() => ({ exported: workbench.exportState(), baseline: workbench.baseline, orbit: rabbitUI.orbit }));
    const invalidResults = await page.evaluate(async () => {
      const saved = structuredClone(workbench.exportState()), results = [];
      for (const invalid of ['missing', .49, 1.81, '1.2', null, 'nan']) {
        const data = structuredClone(saved); data.state.furColor = [1, 0, 0];
        if (invalid === 'missing') delete data.state.maskWidth; else data.state.maskWidth = invalid === 'nan' ? NaN : invalid;
        let rejected = false, message = ''; try { await workbench.importState(data); } catch (e) { rejected = true; message = e.message; }
        results.push({ invalid, rejected, message, unchanged: JSON.stringify(workbench.exportState()) === JSON.stringify(saved) });
      }
      return results;
    });
    assert('invalid version3 width imports reject before any host mutation', invalidResults.every(r => r.rejected && r.unchanged), invalidResults);
    await rafWindow(3);
    const atomicAfter = await probe('rabbit', 'invalid import atomic GPU result', 'candidate', true);
    assert('invalid imports preserve baseline orbit pixels and grooming atomically', equal(atomicBefore, await page.evaluate(() => ({ exported: workbench.exportState(), baseline: workbench.baseline, orbit: rabbitUI.orbit }))) && atomicAfter.pixels.hash === groomedMaterial.pixels.hash && equal(combed, await normals('candidate', 'invalid import grooming atomicity')));
    await snapshot('rabbit-groomed-appearance');

    report.desktopPointerEvents = await page.evaluate(() => window.__orbitQaEvents);
    phase = 'mobile'; cdp = null;
    await boot(report.mobileContext);
    const layout = async (module, name, width, height) => {
      if (width) await page.setViewportSize({ width, height });
      await select(module);
      await wait(module => {
        const c = module === 'anemone' ? anemone.renderer.canvas : document.getElementById('candidateFrame').contentDocument.getElementById('canvasGL');
        const gl = module === 'anemone' ? anemone.renderer.gl : document.getElementById('candidateFrame').contentWindow.gl;
        const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
        const dpr = Math.min(devicePixelRatio, limit / Math.max(1, c.clientWidth, c.clientHeight));
        return c.clientWidth > 0 && c.clientHeight > 0 && c.width === Math.round(c.clientWidth * dpr) && c.height === Math.round(c.clientHeight * dpr);
      }, module);
      await rafWindow(2);
      const result = await page.evaluate(module => {
        const ids = module === 'anemone' ? ['anemoneAutoRotate', 'anemonePause', 'anemoneCamera'] : ['autoRotate', 'resetCamera', 'combButton', 'rabbitControlsToggle'];
        const controls = ids.map(id => { const el = document.getElementById(id), b = el.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2, top = document.elementFromPoint(x, y); return { id, width: b.width, height: b.height, left: b.left, right: b.right, top: b.top, bottom: b.bottom, hit: top === el || el.contains(top) }; });
        const w = module === 'rabbit' ? document.getElementById('candidateFrame').contentWindow : window;
        return { module, width: innerWidth, height: innerHeight, scale: visualViewport?.scale || 1, controls,
          overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1 || w.document.documentElement.scrollWidth > w.innerWidth + 1 || w.document.documentElement.scrollHeight > w.innerHeight + 1,
          scroll: [scrollX, scrollY, w.scrollX, w.scrollY] };
      }, module);
      report.layouts.push({ name, ...result });
      assert(name + ' compact primary controls visible unobstructed with no overflow', !result.overflow && result.scroll.every(v => v === 0) && near(result.scale, 1, .0001) && result.controls.every(c => c.width > 20 && c.height > 20 && c.hit && c.left >= -1 && c.top >= -1 && c.right <= result.width + 1 && c.bottom <= result.height + 1), result);
      await probe(module, name + ' layout pixels'); await snapshot(name);
    };
    for (const module of ['anemone', 'rabbit']) {
      await layout(module, module + '-portrait');
      const baseline = await probe(module, module + ' mobile baseline');
      await startOrbit(module); await waitMotion(module, camera(module, baseline.state));
      const at = await center(module);
      await touch('touchStart', [{ id: 21, ...at }], module + ' takeover'); await waitPointers(module, 1); await waitOrbit(module, false);
      await assertTakeover(module, 'touch');
      const held = await probe(module, module + ' touch holds orbit');
      await touch('touchMove', [{ id: 21, x: at.x + 3, y: at.y + 2 }], module + ' small continuation');
      const moved = await probe(module, module + ' touch continuation');
      const change = delta(module, camera(module, held.state), camera(module, moved.state));
      assert(module + ' touch continuation has no stale-anchor jump', change > .0001 && change < .15, { change });
      await touch('touchEnd', [], module + ' touch end'); await waitPointers(module, 0);
      await startOrbit(module); await waitMotion(module, camera(module, moved.state));
      const pinch = [{ id: 31, x: at.x - 40, y: at.y }, { id: 32, x: at.x + 40, y: at.y }];
      await touch('touchStart', pinch, module + ' pinch takeover'); await waitPointers(module, 2); await waitOrbit(module, false);
      await assertTakeover(module, 'touch');
      const pinchStart = await probe(module, module + ' pinch stable initial camera');
      await touch('touchMove', [{ ...pinch[0], x: pinch[0].x - 18 }, { ...pinch[1], x: pinch[1].x + 18 }], module + ' native pinch spread');
      const zoomed = await probe(module, module + ' pinch changes rendered pixels');
      const beforeCamera = camera(module, pinchStart.state), afterCamera = camera(module, zoomed.state);
      assert(module + ' auto-to-pinch takeover zooms without unwanted orbit', delta(module, beforeCamera, afterCamera) < .01 && (module === 'anemone' ? afterCamera.distance < beforeCamera.distance - .15 : afterCamera.size > beforeCamera.size + .15) && pinchStart.pixels.hash !== zoomed.pixels.hash, { beforeCamera, afterCamera });
      await touch('touchEnd', [], module + ' pinch end'); await waitPointers(module, 0);
      await rafWindow(); const stable = await probe(module, module + ' touch takeover remains paused');
      assert(module + ' orbit stays paused after native touch release', !stable.orbit.playing && sameCamera(module, camera(module, zoomed.state), camera(module, stable.state)) && zoomed.pixels.hash === stable.pixels.hash);
      await reset(module, baseline);
    }
    for (const module of ['anemone', 'rabbit']) await layout(module, module + '-landscape', 844, 390);
    report.pointerEvents = await page.evaluate(() => window.__orbitQaEvents);
    assert('native touch does not scroll or zoom document', report.touchTrace.every(t => !t.scrollX && !t.scrollY && near(t.scale, 1, .0001)), report.touchTrace);
    assert('zero JavaScript errors and failed requests', !report.errors.length && !report.requestFailures.length, { errors: report.errors, requestFailures: report.requestFailures });
    if (url.startsWith('file:')) assert('standalone feature QA uses no external network', report.requests.every(u => u.startsWith('file:') || u === 'about:srcdoc' || u === 'about:blank'), report.requests);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page && !page.isClosed()) {
      try { await snapshot('failure'); } catch (e) { report.screenshotFailure = String(e); }
      try { report.failureState = await page.evaluate(() => ({ module: platform?.module, anemone: window.anemone?.state, orbit: window.anemone?.orbit, rabbit: window.workbench?.candidate, rabbitOrbit: window.rabbitUI?.orbit, errors: window.workbench?.errors })); } catch (e) { report.failureStateError = String(e); }
      try { await probe(currentModule, 'failure frame'); } catch (e) { report.failureProbeError = String(e); }
    }
  } finally {
    if (cdp && activeTouches) try { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); } catch (e) { report.cleanupWarning = String(e); }
    for (const owned of contexts) try { await owned.close(); } catch (e) { report.cleanupWarning = String(e); }
    report.summary = { passed: report.passed, assertionsPassed: report.tests.filter(t => t.pass).length, assertionsFailed: report.tests.filter(t => !t.pass).length, probes: report.probes.length, touchCommands: report.touchTrace.length, layouts: report.layouts.map(l => l.name), screenshots: report.screenshots.length };
    fs.writeFileSync(path.join(outDir, 'orbit-appearance-results.json'), JSON.stringify(report, null, 2));
  }
  return report;
};
